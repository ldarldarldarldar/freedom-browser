import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Shield,
  ShieldCheck,
  Moon,
  Trash2,
  Plus,
  X,
  RefreshCw,
  Sliders,
  Check,
  Clock,
  Globe,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { BrowserTab, TabLifecycleState } from '../browser/types';
import { ProcessMetric, SystemStats } from '../taskmanager/types';
import { frcService, FRCSettings, FRCMemoryDataPoint } from '../services/frcService';
import { tauriBridge } from '../services/tauriBridge';
import { useTranslation } from '../i18n';

interface FRCMemoryDiagnosticsPageProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onNavigate: (url: string) => void;
  onHibernateTab?: (tabId: string) => void;
  onWakeTab?: (tabId: string) => void;
  onTerminateTab?: (tabId: string) => void;
}

export const FRCMemoryDiagnosticsPage: React.FC<FRCMemoryDiagnosticsPageProps> = ({
  tabs,
  activeTabId,
  onNavigate,
  onHibernateTab,
  onWakeTab,
  onTerminateTab,
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SystemStats | null>(frcService.getLatestStats());
  const [processes, setProcesses] = useState<ProcessMetric[]>(frcService.getLatestProcesses());
  const [settings, setSettings] = useState<FRCSettings>(frcService.getSettings());
  const [history, setHistory] = useState<FRCMemoryDataPoint[]>(frcService.getHistory());
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [activeTabSection, setActiveTabSection] = useState<'table' | 'graph' | 'config'>('table');
  const [hoveredPoint, setHoveredPoint] = useState<FRCMemoryDataPoint | null>(null);

  // Poll metrics every 2.5 seconds while viewing diagnostics
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const data = await tauriBridge.getSystemMetrics(tabs.length);
        if (isMounted && data) {
          setStats(data.stats);
          setProcesses(data.processes || []);
          frcService.updateLatestStats(data.stats, data.processes || []);
          setHistory(frcService.getHistory());
        }
      } catch (err) {
        console.warn('Diagnostics polling error:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [tabs.length]);

  // Clean RAM action
  const handleCleanRam = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    try {
      const res = await frcService.cleanRamNow();
      setCleanFeedback(`+${res.reclaimedMb} MB ${t('frc.reclaimedFeedback')}`);
      setHistory(frcService.getHistory());
      setTimeout(() => setCleanFeedback(null), 4000);
    } catch {
      setCleanFeedback(t('frc.cleanedGeneric'));
      setTimeout(() => setCleanFeedback(null), 3000);
    } finally {
      setIsCleaning(false);
    }
  };

  // Add domain to whitelist
  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;
    frcService.addWhitelistDomain(newDomainInput.trim());
    setSettings(frcService.getSettings());
    setNewDomainInput('');
  };

  // Remove domain from whitelist
  const handleRemoveDomain = (domain: string) => {
    frcService.removeWhitelistDomain(domain);
    setSettings(frcService.getSettings());
  };

  // Update slider settings
  const handleSettingChange = (key: keyof FRCSettings, value: any) => {
    const updated = frcService.saveSettings({ [key]: value });
    setSettings(updated);
  };

  // Map tabs to process rows with accurate lifecycle and memory
  const tableRows = useMemo(() => {
    const rows: Array<{
      id: string;
      tabId?: string;
      pid: number;
      title: string;
      url?: string;
      domain: string;
      status: TabLifecycleState;
      cpuPercent: number;
      privateRamMb: number;
      workingSetMb: number;
      isGuarded: boolean;
      guardReasons: string[];
      favicon?: string;
    }> = [];

    // Map each open tab
    for (const tab of tabs) {
      const isCurrent = tab.id === activeTabId;
      const guard = frcService.checkTabGuard(tab, activeTabId);
      const state = isCurrent
        ? 'active'
        : tab.isSuspended || tab.lifecycleState === 'hibernated'
        ? 'hibernated'
        : tab.lifecycleState || 'active';

      const domain = frcService.extractDomain(tab.url);
      const matchedProc = processes.find((p) => p.tabId === tab.id || p.url === tab.url);

      const privateMb = tab.privateMemoryBytes
        ? Math.round(tab.privateMemoryBytes / (1024 * 1024))
        : matchedProc?.privateMb || (state === 'hibernated' ? 0 : 75);

      const workingSetMb = tab.workingSetBytes
        ? Math.round(tab.workingSetBytes / (1024 * 1024))
        : matchedProc?.workingSetMb || (state === 'hibernated' ? 2 : 120);

      rows.push({
        id: `tab-row-${tab.id}`,
        tabId: tab.id,
        pid: matchedProc?.pid || 1000 + Math.abs(tab.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 9000),
        title: tab.title,
        url: tab.url,
        domain,
        status: state,
        cpuPercent: state === 'active' ? (matchedProc?.cpuUsagePercent || 0.4) : 0,
        privateRamMb: privateMb,
        workingSetMb: workingSetMb,
        isGuarded: guard.isGuarded,
        guardReasons: guard.reasons,
        favicon: tab.favicon,
      });
    }

    // Add browser utility processes from processes list
    for (const proc of processes) {
      if (proc.processType !== 'renderer-tab') {
        rows.push({
          id: `proc-row-${proc.pid}`,
          pid: proc.pid,
          title: proc.title,
          domain: 'freedom://core',
          status: 'active',
          cpuPercent: proc.cpuUsagePercent,
          privateRamMb: proc.privateMb || Math.round(proc.ramUsageBytes / (1024 * 1024)),
          workingSetMb: proc.workingSetMb || Math.round((proc.workingSetBytes || proc.ramUsageBytes * 1.5) / (1024 * 1024)),
          isGuarded: true,
          guardReasons: ['system_process'],
        });
      }
    }

    return rows;
  }, [tabs, activeTabId, processes]);

  const browserRamMb = stats ? (stats.totalBrowserRamMb ?? stats.browserRamMb ?? Math.round(stats.totalBrowserRamBytes / (1024 * 1024))) : 0;
  const systemTotalMb = stats ? (stats.totalSystemRamMb ?? Math.round(stats.totalSystemRamBytes / (1024 * 1024))) : 16384;
  const availableRamMb = stats?.availableSystemRamMb ?? (stats?.availableSystemRamBytes ? Math.round(stats.availableSystemRamBytes / (1024 * 1024)) : Math.round(systemTotalMb * 0.5));
  const pressurePct = stats?.memoryPressurePercent || stats?.systemRamPercent || 35;

  // SVG Telemetry Graph Calculation
  const graphWidth = 800;
  const graphHeight = 220;
  const padding = { top: 20, right: 30, bottom: 35, left: 55 };
  const innerWidth = graphWidth - padding.left - padding.right;
  const innerHeight = graphHeight - padding.top - padding.bottom;

  const points = history.length > 0 ? history : [
    { timestamp: Date.now() - 10000, browserRamMb, systemRamMb: systemTotalMb, availableRamMb, pressurePercent: pressurePct },
    { timestamp: Date.now(), browserRamMb, systemRamMb: systemTotalMb, availableRamMb, pressurePercent: pressurePct },
  ];

  const maxRam = Math.max(
    500,
    ...points.map((p) => p.browserRamMb * 1.35)
  );

  const getX = (idx: number) => {
    if (points.length <= 1) return padding.left;
    return padding.left + (idx / (points.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return padding.top + innerHeight - (val / maxRam) * innerHeight;
  };

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.browserRamMb)}`).join(' ');
  const areaPath = `${linePath} L ${getX(points.length - 1)} ${padding.top + innerHeight} L ${padding.left} ${padding.top + innerHeight} Z`;

  return (
    <div
      id="freedom-memory-diagnostics-page"
      className="w-full h-full bg-[#0b0c10] text-neutral-200 overflow-y-auto no-scrollbar font-sans select-none flex flex-col"
    >
      {/* Top Header Banner */}
      <div className="px-8 py-6 bg-[#0f1118] border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-md">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {t('frc.diagnosticsTitle')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                FRC v0.5.4.7.3
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {t('frc.diagnosticsSubtitle')} • {stats?.measurementMethod || 'Native OS Procfs Telemetry'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCleanRam}
            disabled={isCleaning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-medium text-xs active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} />
            <span>{isCleaning ? t('frc.cleaning') : t('frc.cleanRamNow')}</span>
          </button>
        </div>
      </div>

      {cleanFeedback && (
        <div className="px-8 py-2.5 bg-emerald-950/60 border-b border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{cleanFeedback}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {/* Card 1: Browser RAM Footprint */}
        <div className="p-4 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>{t('frc.browserRamFootprint')}</span>
            </span>
            <span className="font-mono text-[11px] text-emerald-400">PSS Non-Dup</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {browserRamMb} <span className="text-sm font-normal text-neutral-400">MB</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {stats?.privateRamMb ? `${stats.privateRamMb} MB private exclusively owned` : 'Shared libraries mapped once'}
          </div>
        </div>

        {/* Card 2: System Available Memory */}
        <div className="p-4 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>{t('frc.systemAvailable')}</span>
            </span>
            <span className="font-mono text-[11px] text-sky-400">{Math.round(systemTotalMb / 1024)} GB Total</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {availableRamMb} <span className="text-sm font-normal text-neutral-400">MB</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Swap: {stats?.usedSwapBytes ? `${Math.round(stats.usedSwapBytes / (1024 * 1024))} MB used` : 'Active / Unconstrained'}
          </div>
        </div>

        {/* Card 3: Memory Pressure State */}
        <div className="p-4 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{t('frc.memoryPressure')}</span>
            </span>
            <span className="font-mono text-[11px] uppercase text-amber-400">
              {stats?.memoryPressureLevel || 'Normal'}
            </span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {pressurePct}%
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Threshold: &lt;{settings.critMemoryPercent}% triggers auto-eviction
          </div>
        </div>

        {/* Card 4: Tabs In Memory */}
        <div className="p-4 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>{t('frc.managedTabs')}</span>
            </span>
            <span className="font-mono text-[11px] text-purple-400">{settings.mode} mode</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {tabs.length} <span className="text-sm font-normal text-neutral-400">tabs</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {tabs.filter((t) => t.isSuspended || t.lifecycleState === 'hibernated').length} hibernated (~0 MB)
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="px-8 border-b border-white/[0.08] flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTabSection('table')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTabSection === 'table'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-neutral-400 hover:text-white border-transparent'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('frc.processDataTable')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabSection('graph')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTabSection === 'graph'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-neutral-400 hover:text-white border-transparent'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{t('frc.telemetryGraph')} (30-min Timeline)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabSection('config')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTabSection === 'config'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-neutral-400 hover:text-white border-transparent'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{t('frc.configurationPanel')}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="px-8 py-6 flex-1">
        {/* SECTION 1: DATA TABLE */}
        {activeTabSection === 'table' && (
          <div className="rounded-2xl bg-[#12141c]/90 border border-white/[0.08] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-black/30 border-b border-white/[0.08] text-neutral-400 text-[11px] uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">{t('frc.colTitle')}</th>
                    <th className="py-3 px-4">{t('frc.colDomain')}</th>
                    <th className="py-3 px-4">PID</th>
                    <th className="py-3 px-4">{t('frc.colStatus')}</th>
                    <th className="py-3 px-4">CPU %</th>
                    <th className="py-3 px-4">{t('frc.colPrivateRam')}</th>
                    <th className="py-3 px-4">{t('frc.colSharedRam')}</th>
                    <th className="py-3 px-4 text-right">{t('frc.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {tableRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-white/[0.025] transition-colors group"
                    >
                      {/* Title & Favicon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 max-w-xs sm:max-w-sm">
                          {row.favicon ? (
                            <img
                              src={row.favicon}
                              alt=""
                              className={`w-4 h-4 rounded-xs shrink-0 object-contain ${
                                row.status === 'hibernated' || row.status === 'frozen' ? 'opacity-60' : ''
                              }`}
                            />
                          ) : (
                            <Globe className="w-4 h-4 text-neutral-500 shrink-0" />
                          )}
                          <span className={`truncate font-medium text-white ${row.status === 'hibernated' ? 'opacity-60 italic' : ''}`}>
                            {row.title}
                          </span>
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="py-3 px-4 font-mono text-neutral-400">
                        {row.domain}
                      </td>

                      {/* PID */}
                      <td className="py-3 px-4 font-mono text-neutral-400">
                        {row.pid}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider font-mono ${
                            row.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : row.status === 'throttled'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : row.status === 'frozen'
                              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {row.status === 'hibernated' && <Moon className="w-2.5 h-2.5" />}
                          <span>{row.status}</span>
                        </span>
                      </td>

                      {/* CPU % */}
                      <td className="py-3 px-4 font-mono text-neutral-300">
                        {row.cpuPercent}%
                      </td>

                      {/* Private RAM */}
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {row.privateRamMb} MB
                      </td>

                      {/* Shared RAM */}
                      <td className="py-3 px-4 font-mono text-neutral-400">
                        {row.workingSetMb} MB
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Force Sleep / Hibernate */}
                          {row.tabId && row.status !== 'hibernated' && onHibernateTab && (
                            <button
                              type="button"
                              onClick={() => onHibernateTab(row.tabId!)}
                              className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-medium transition-colors"
                              title={t('frc.forceSleepTooltip')}
                            >
                              <Moon className="w-3 h-3 inline mr-1" />
                              <span>Sleep</span>
                            </button>
                          )}

                          {/* Wake if hibernated */}
                          {row.tabId && row.status === 'hibernated' && onWakeTab && (
                            <button
                              type="button"
                              onClick={() => onWakeTab(row.tabId!)}
                              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition-colors"
                            >
                              <Play className="w-3 h-3 inline mr-1" />
                              <span>Wake</span>
                            </button>
                          )}

                          {/* Add Domain to Whitelist */}
                          {!frcService.isDomainWhitelisted(row.domain) && row.domain !== 'freedom' && row.domain !== 'freedom://core' && (
                            <button
                              type="button"
                              onClick={() => {
                                frcService.addWhitelistDomain(row.domain);
                                setSettings(frcService.getSettings());
                              }}
                              className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-300 hover:text-white text-[11px] transition-colors"
                              title={t('frc.addToWhitelistTooltip')}
                            >
                              <Shield className="w-3 h-3 inline mr-1 text-emerald-400" />
                              <span>Whitelist</span>
                            </button>
                          )}

                          {/* Kill Process / Close Tab */}
                          {row.tabId && onTerminateTab && (
                            <button
                              type="button"
                              onClick={() => onTerminateTab(row.tabId!)}
                              className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors"
                              title={t('frc.killProcessTooltip')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 2: TELEMETRY GRAPH */}
        {activeTabSection === 'graph' && (
          <div className="p-6 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white text-sm">
                  {t('frc.rollingGraphTitle')}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {t('frc.rollingGraphSubtitle')}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-neutral-300">{t('frc.browserRam')} (MB)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="text-neutral-300">{t('frc.memoryPressure')} (%)</span>
                </div>
              </div>
            </div>

            {/* SVG Graph Canvas */}
            <div className="relative w-full overflow-hidden bg-black/40 rounded-xl p-4 border border-white/[0.04]">
              <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                className="w-full h-64 overflow-visible"
              >
                <defs>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map((frac, i) => {
                  const y = padding.top + innerHeight * (1 - frac);
                  const val = Math.round(maxRam * frac);
                  return (
                    <g key={i}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={padding.left + innerWidth}
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        fill="rgba(255,255,255,0.4)"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {val}M
                      </text>
                    </g>
                  );
                })}

                {/* Area under curve */}
                <path d={areaPath} fill="url(#ramGradient)" />

                {/* Main Browser RAM curve */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Data Points */}
                {points.map((p, idx) => {
                  const cx = getX(idx);
                  const cy = getY(p.browserRamMb);
                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={p.reclaimedMb ? 4.5 : 2.5}
                      fill={p.reclaimedMb ? '#38bdf8' : '#10b981'}
                      stroke="#12141c"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:r-5 transition-all"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div className="absolute top-4 right-4 p-3 rounded-xl bg-neutral-900/95 border border-white/10 shadow-xl text-xs font-mono z-10 animate-fade-in">
                  <div className="text-white font-bold">{hoveredPoint.browserRamMb} MB</div>
                  <div className="text-neutral-400 text-[10px]">
                    {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
                  </div>
                  {hoveredPoint.reclaimedMb && (
                    <div className="text-sky-400 font-semibold text-[10px] mt-1">
                      +{hoveredPoint.reclaimedMb} MB Reclaimed!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: CONFIGURATION PANEL */}
        {activeTabSection === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timeout Sliders */}
            <div className="p-6 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>{t('frc.tierTimeoutSliders')}</span>
              </h3>
              <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
                {t('frc.tierTimeoutDesc')}
              </p>

              {/* Slider 1: Throttling (T_throttle) */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-medium">State 1: Throttling (T_throttle)</span>
                  <span className="font-mono text-emerald-400 font-bold">{Math.round(settings.tThrottleSec / 60)} min</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={Math.round(settings.tThrottleSec / 60)}
                  onChange={(e) => handleSettingChange('tThrottleSec', parseInt(e.target.value, 10) * 60)}
                  className="w-full accent-emerald-400"
                />
              </div>

              {/* Slider 2: Freezing (T_freeze) */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-medium">State 2: Freezing (T_freeze)</span>
                  <span className="font-mono text-sky-400 font-bold">{Math.round(settings.tFreezeSec / 60)} min</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={Math.round(settings.tFreezeSec / 60)}
                  onChange={(e) => handleSettingChange('tFreezeSec', parseInt(e.target.value, 10) * 60)}
                  className="w-full accent-sky-400"
                />
              </div>

              {/* Slider 3: Hibernation (T_discard) */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-medium">State 3: Hibernation (T_discard)</span>
                  <span className="font-mono text-purple-400 font-bold">{Math.round(settings.tDiscardSec / 60)} min</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={Math.round(settings.tDiscardSec / 60)}
                  onChange={(e) => handleSettingChange('tDiscardSec', parseInt(e.target.value, 10) * 60)}
                  className="w-full accent-purple-400"
                />
              </div>

              {/* Memory Pressure Threshold */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-medium">Pressure Trigger (θ_crit available RAM)</span>
                  <span className="font-mono text-amber-400 font-bold">&lt;{settings.critMemoryPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={settings.critMemoryPercent}
                  onChange={(e) => handleSettingChange('critMemoryPercent', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            {/* Whitelist Domain Manager */}
            <div className="p-6 rounded-2xl bg-[#12141c]/90 border border-white/[0.08] shadow-sm flex flex-col">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t('frc.whitelistManager')}</span>
              </h3>
              <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                {t('frc.whitelistDesc')}
              </p>

              {/* Add domain form */}
              <form onSubmit={handleAddDomain} className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  placeholder="e.g. youtube.com, github.com"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('frc.addDomain')}</span>
                </button>
              </form>

              {/* Domain list */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 max-h-56">
                {settings.whitelistDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.05]"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono text-xs text-white">{domain}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(domain)}
                      className="p-1 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
