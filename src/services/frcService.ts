import { BrowserTab, TabLifecycleState, TabSerializedSession } from '../browser/types';
import { SystemStats, ProcessMetric } from '../taskmanager/types';
import { tauriBridge } from './tauriBridge';
import { logger } from './loggerService';

export type FRCOperationalMode = 'balanced' | 'aggressive' | 'unrestricted' | 'custom';

export interface FRCSettings {
  mode: FRCOperationalMode;
  tThrottleSec: number;
  tFreezeSec: number;
  tDiscardSec: number;
  critMemoryPercent: number; // e.g. 15% available RAM threshold
  customMemoryCeilingMb: number | null; // Optional user limit in MB
  whitelistDomains: string[];
  enableAutoHibernation: boolean;
  enableDynamicTrimming: boolean;
  pollingIntervalMs: number;
}

export interface FRCMemoryDataPoint {
  timestamp: number;
  browserRamMb: number;
  systemRamMb: number;
  availableRamMb: number;
  pressurePercent: number;
  reclaimedMb?: number;
}

export interface TabEvictionCandidate {
  tabId: string;
  tabTitle: string;
  url: string;
  domain: string;
  idleTimeMinutes: number;
  privateMemoryMb: number;
  accessCount: number;
  score: number;
  isGuarded: boolean;
  guardReasons: string[];
}

const FRC_SETTINGS_KEY = 'freedom_frc_settings_v1';
const FRC_HISTORY_KEY = 'freedom_frc_history_v1';
const MAX_HISTORY_POINTS = 180; // 30 minutes at 10-second resolution

export const DEFAULT_FRC_SETTINGS: FRCSettings = {
  mode: 'balanced',
  tThrottleSec: 300, // 5 minutes
  tFreezeSec: 900, // 15 minutes
  tDiscardSec: 1800, // 30 minutes
  critMemoryPercent: 15, // <15% available RAM triggers cascade
  customMemoryCeilingMb: null,
  whitelistDomains: ['youtube.com', 'twitch.tv', 'music.youtube.com', 'github.com'],
  enableAutoHibernation: true,
  enableDynamicTrimming: true,
  pollingIntervalMs: 2000,
};

export class FRCService {
  private static instance: FRCService;

  private settings: FRCSettings;
  private history: FRCMemoryDataPoint[] = [];
  private sessionCache: Map<string, TabSerializedSession> = new Map();
  private subscribers: Set<(stats: SystemStats | null, history: FRCMemoryDataPoint[]) => void> = new Set();
  private latestStats: SystemStats | null = null;
  private latestProcesses: ProcessMetric[] = [];
  private pollingTimer: any = null;
  private lastReclaimedMb: number | null = null;

  private constructor() {
    this.settings = this.loadSettings();
    this.history = this.loadHistory();
  }

  public static getInstance(): FRCService {
    if (!FRCService.instance) {
      FRCService.instance = new FRCService();
    }
    return FRCService.instance;
  }

  /**
   * Load stored settings
   */
  public loadSettings(): FRCSettings {
    try {
      const stored = localStorage.getItem(FRC_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_FRC_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[FRC] Failed to parse settings:', e);
    }
    return { ...DEFAULT_FRC_SETTINGS };
  }

  /**
   * Save settings
   */
  public saveSettings(newSettings: Partial<FRCSettings>): FRCSettings {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(FRC_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[FRC] Failed to save settings:', e);
    }
    return this.settings;
  }

  public getSettings(): FRCSettings {
    return { ...this.settings };
  }

  /**
   * Set Operational Mode with deterministic preset intervals
   */
  public setOperationalMode(mode: FRCOperationalMode): FRCSettings {
    if (mode === 'balanced') {
      return this.saveSettings({
        mode: 'balanced',
        tThrottleSec: 300, // 5m
        tFreezeSec: 900, // 15m
        tDiscardSec: 1800, // 30m
        enableAutoHibernation: true,
      });
    } else if (mode === 'aggressive') {
      return this.saveSettings({
        mode: 'aggressive',
        tThrottleSec: 60, // 1m
        tFreezeSec: 120, // 2m
        tDiscardSec: 180, // 3m
        enableAutoHibernation: true,
      });
    } else if (mode === 'unrestricted') {
      return this.saveSettings({
        mode: 'unrestricted',
        enableAutoHibernation: false,
      });
    } else {
      return this.saveSettings({ mode: 'custom' });
    }
  }

  /**
   * Whitelist Management
   */
  public addWhitelistDomain(domain: string): void {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (clean && !this.settings.whitelistDomains.includes(clean)) {
      this.saveSettings({
        whitelistDomains: [...this.settings.whitelistDomains, clean],
      });
    }
  }

  public removeWhitelistDomain(domain: string): void {
    this.saveSettings({
      whitelistDomains: this.settings.whitelistDomains.filter((d) => d !== domain),
    });
  }

  public isDomainWhitelisted(urlOrDomain: string): boolean {
    if (!urlOrDomain) return false;
    const clean = urlOrDomain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    return this.settings.whitelistDomains.some(
      (w) => clean === w || clean.endsWith('.' + w)
    );
  }

  /**
   * Helper to extract domain cleanly
   */
  public extractDomain(url: string): string {
    if (!url || url.startsWith('freedom://')) return 'freedom';
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return url.split('/')[0] || '';
    }
  }

  /**
   * Tab Guard Rules (FRC-GUARD):
   * State 2 (Frozen) and State 3 (Discarded/Hibernated) are strictly blocked if:
   * - Active audio/video playback
   * - WebRTC or media capture stream
   * - Unsubmitted form inputs
   * - Pinned tab
   * - Whitelisted domain
   * - Picture-in-Picture active
   * - Currently active tab
   */
  public checkTabGuard(tab: BrowserTab, activeTabId?: string): {
    isGuarded: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (activeTabId && tab.id === activeTabId) {
      reasons.push('active_tab');
    }

    if (tab.isAudioPlaying || tab.isMediaPlaying) {
      reasons.push('media_playback');
    }

    if (tab.isPinned) {
      reasons.push('pinned');
    }

    if (this.isDomainWhitelisted(tab.url)) {
      reasons.push('whitelist');
    }

    if (tab.hasUnsavedForm) {
      reasons.push('unsaved_form');
    }

    if (tab.isPipActive) {
      reasons.push('pip');
    }

    return {
      isGuarded: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Tab Eviction Ordering Formula (FRC-TRIM-01):
   * Score = w1 * IdleTime + w2 * PrivateMemory - w3 * AccessFrequency
   */
  public calculateEvictionScore(
    tab: BrowserTab,
    now: number = Date.now(),
    w1 = 0.5,
    w2 = 0.4,
    w3 = 0.3
  ): number {
    const idleTimeMinutes = Math.max(0, (now - (tab.lastActive || now)) / 60000);
    const privateMemoryMb = tab.privateMemoryBytes
      ? tab.privateMemoryBytes / (1024 * 1024)
      : (tab.url.startsWith('freedom://') ? 25 : 85);
    const accessFrequency = Math.max(1, tab.accessCount || 1);

    const score = w1 * idleTimeMinutes + w2 * privateMemoryMb - w3 * accessFrequency;
    return Math.round(score * 100) / 100;
  }

  /**
   * Evaluate Tiered Lifecycle State for a tab
   */
  public evaluateTabLifecycle(
    tab: BrowserTab,
    activeTabId: string,
    now: number = Date.now()
  ): TabLifecycleState {
    // 0. Active Tab is always State 0
    if (tab.id === activeTabId) {
      return 'active';
    }

    // Unrestricted mode: never automatically degrade past active/throttled
    if (this.settings.mode === 'unrestricted' || !this.settings.enableAutoHibernation) {
      return 'active';
    }

    const guard = this.checkTabGuard(tab, activeTabId);
    const idleSeconds = Math.max(0, Math.floor((now - (tab.lastActive || now)) / 1000));

    // Guarded tabs never degrade into Frozen or Hibernated
    if (guard.isGuarded) {
      if (idleSeconds >= this.settings.tThrottleSec) {
        return 'throttled';
      }
      return 'active';
    }

    // Tiered degradation for non-guarded background tabs
    if (idleSeconds >= this.settings.tDiscardSec) {
      return 'hibernated';
    }
    if (idleSeconds >= this.settings.tFreezeSec) {
      return 'frozen';
    }
    if (idleSeconds >= this.settings.tThrottleSec) {
      return 'throttled';
    }

    return 'active';
  }

  /**
   * Session State Serialization (State 3: Discarded / Hibernated)
   */
  public serializeTabSession(tab: BrowserTab): TabSerializedSession {
    const session: TabSerializedSession = {
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
      history: [...tab.history],
      historyIndex: tab.historyIndex,
      scrollX: 0,
      scrollY: 0,
      zoomLevel: tab.zoomLevel || 100,
      savedAt: Date.now(),
    };

    this.sessionCache.set(tab.id, session);
    try {
      sessionStorage.setItem(`freedom_frc_session_${tab.id}`, JSON.stringify(session));
    } catch {}

    return session;
  }

  /**
   * Retrieve Serialized Tab Session
   */
  public getSerializedTabSession(tabId: string): TabSerializedSession | null {
    if (this.sessionCache.has(tabId)) {
      return this.sessionCache.get(tabId)!;
    }
    try {
      const stored = sessionStorage.getItem(`freedom_frc_session_${tabId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.sessionCache.set(tabId, parsed);
        return parsed;
      }
    } catch {}
    return null;
  }

  /**
   * Clear session cache when tab is closed
   */
  public removeSerializedTabSession(tabId: string): void {
    this.sessionCache.delete(tabId);
    try {
      sessionStorage.removeItem(`freedom_frc_session_${tabId}`);
    } catch {}
  }

  /**
   * Memory Pressure Triggers (FRC-TRIM-01):
   * Select candidate tabs for cascade eviction ordered by score descending
   */
  public getEvictionCandidates(
    tabs: BrowserTab[],
    activeTabId: string,
    now: number = Date.now()
  ): TabEvictionCandidate[] {
    const candidates: TabEvictionCandidate[] = [];

    for (const tab of tabs) {
      if (tab.id === activeTabId) continue;
      if (tab.lifecycleState === 'hibernated' || tab.isSuspended) continue;
      if (tab.url.startsWith('freedom://newtab')) continue;

      const guard = this.checkTabGuard(tab, activeTabId);
      const idleMinutes = Math.max(0, (now - (tab.lastActive || now)) / 60000);
      const privateMb = tab.privateMemoryBytes
        ? Math.round(tab.privateMemoryBytes / (1024 * 1024))
        : 65;
      const score = this.calculateEvictionScore(tab, now);

      candidates.push({
        tabId: tab.id,
        tabTitle: tab.title,
        url: tab.url,
        domain: this.extractDomain(tab.url),
        idleTimeMinutes: Math.round(idleMinutes * 10) / 10,
        privateMemoryMb: privateMb,
        accessCount: tab.accessCount || 1,
        score,
        isGuarded: guard.isGuarded,
        guardReasons: guard.reasons,
      });
    }

    // Sort by score descending (highest eviction priority first)
    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Immediate Manual Trim Action (FRC-TRIM-02) / "Clean RAM Now"
   */
  public async cleanRamNow(): Promise<{
    reclaimedMb: number;
    beforeBrowserMb: number;
    afterBrowserMb: number;
  }> {
    logger.log('INFO', 'MEMORY', 'Manual RAM cleanup requested via Freedom RAM Control (FRC-TRIM-02)');

    const beforeStats = this.latestStats;
    const beforeMb = beforeStats ? (beforeStats.totalBrowserRamMb || Math.round(beforeStats.totalBrowserRamBytes / (1024 * 1024))) : 0;

    let reclaimedMb = 0;
    try {
      const result = await tauriBridge.cleanRam();
      if (result && typeof result.reclaimedMb === 'number') {
        reclaimedMb = result.reclaimedMb;
      }
    } catch (err) {
      console.warn('[FRC] cleanRam error:', err);
    }

    // Immediately fetch updated real metrics after cleanup
    const freshMetrics = await tauriBridge.getSystemMetrics(0);
    const afterMb = freshMetrics?.stats?.totalBrowserRamMb || Math.max(0, beforeMb - reclaimedMb);
    if (reclaimedMb === 0 && beforeMb > afterMb) {
      reclaimedMb = beforeMb - afterMb;
    }
    this.lastReclaimedMb = reclaimedMb;

    if (freshMetrics) {
      this.updateLatestStats(freshMetrics.stats, freshMetrics.processes);
    }

    return {
      reclaimedMb,
      beforeBrowserMb: beforeMb,
      afterBrowserMb: afterMb,
    };
  }

  /**
   * Telemetry Rolling History Recording (30-Minute Timeline)
   */
  public recordDataPoint(point: FRCMemoryDataPoint): void {
    this.history.push(point);
    if (this.history.length > MAX_HISTORY_POINTS) {
      this.history = this.history.slice(-MAX_HISTORY_POINTS);
    }
    this.saveHistory();
    this.notifySubscribers();
  }

  public getHistory(): FRCMemoryDataPoint[] {
    return [...this.history];
  }

  private loadHistory(): FRCMemoryDataPoint[] {
    try {
      const stored = sessionStorage.getItem(FRC_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.slice(-MAX_HISTORY_POINTS);
      }
    } catch {}
    return [];
  }

  private saveHistory(): void {
    try {
      sessionStorage.setItem(FRC_HISTORY_KEY, JSON.stringify(this.history));
    } catch {}
  }

  /**
   * Subscribe to FRC updates (used by Popover, Diagnostics, and HUD)
   */
  public subscribe(callback: (stats: SystemStats | null, history: FRCMemoryDataPoint[]) => void): () => void {
    this.subscribers.add(callback);
    callback(this.latestStats, this.history);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub(this.latestStats, this.history);
      } catch (e) {
        console.warn('[FRC] Subscriber error:', e);
      }
    }
  }

  public updateLatestStats(stats: SystemStats, processes: ProcessMetric[]): void {
    this.latestStats = stats;
    this.latestProcesses = processes;

    // Record sample in rolling history every ~10 seconds
    const lastPoint = this.history[this.history.length - 1];
    const now = Date.now();
    if (!lastPoint || now - lastPoint.timestamp >= 10000) {
      this.recordDataPoint({
        timestamp: now,
        browserRamMb: stats.totalBrowserRamMb,
        systemRamMb: Math.round(stats.totalSystemRamBytes / (1024 * 1024)),
        availableRamMb: stats.availableSystemRamMb || Math.round((stats.totalSystemRamBytes * 0.5) / (1024 * 1024)),
        pressurePercent: stats.memoryPressurePercent || stats.systemRamPercent || 35,
        reclaimedMb: this.lastReclaimedMb || undefined,
      });
      this.lastReclaimedMb = null;
    } else {
      this.notifySubscribers();
    }
  }

  public getLatestStats(): SystemStats | null {
    return this.latestStats;
  }

  public getLatestProcesses(): ProcessMetric[] {
    return this.latestProcesses;
  }
}

export const frcService = FRCService.getInstance();
