import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  HardDrive,
  Sparkles,
  ExternalLink,
  Shield,
  Moon,
  Zap,
  Sliders,
  Check,
  AlertCircle,
  X,
  RefreshCw,
  Layers,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { SystemStats } from '../taskmanager/types';
import { frcService, FRCOperationalMode, FRCSettings } from '../services/frcService';
import { APP_VERSION } from '../version';
import { useTranslation } from '../i18n';

interface FRCPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: BrowserTab[];
  activeTabId: string;
  onHibernateTab: (tabId: string) => void;
  onNavigate: (url: string) => void;
}

export const FRCPopover: React.FC<FRCPopoverProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  onHibernateTab,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(frcService.getLatestStats());
  const [settings, setSettings] = useState<FRCSettings>(frcService.getSettings());
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanedFeedback, setCleanedFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSettings(frcService.getSettings());
    const unsubscribe = frcService.subscribe((newStats) => {
      setStats(newStats);
    });

    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        const hudBtn = document.getElementById('btn-frc-hud');
        if (hudBtn && hudBtn.contains(e.target as Node)) return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleModeChange = (mode: FRCOperationalMode) => {
    const updated = frcService.setOperationalMode(mode);
    setSettings(updated);
  };

  const handleCleanRam = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    try {
      const result = await frcService.cleanRamNow();
      setCleanedFeedback(`+${result.reclaimedMb} MB ${t('frc.reclaimedFeedback')}`);
      setTimeout(() => {
        setCleanedFeedback(null);
      }, 4000);
    } catch {
      setCleanedFeedback(t('frc.cleanedGeneric'));
      setTimeout(() => setCleanedFeedback(null), 3000);
    } finally {
      setIsCleaning(false);
    }
  };

  // Top 3-5 memory consuming non-active background tabs
  const backgroundCandidates = frcService.getEvictionCandidates(tabs, activeTabId).slice(0, 4);

  const browserMb = stats ? (stats.totalBrowserRamMb ?? stats.browserRamMb ?? Math.round(stats.totalBrowserRamBytes / (1024 * 1024))) : 0;
  const systemTotalMb = stats ? (stats.totalSystemRamMb ?? Math.round(stats.totalSystemRamBytes / (1024 * 1024))) : 16384;
  const systemAvailableMb = stats?.availableSystemRamMb ?? (stats?.availableSystemRamBytes ? Math.round(stats.availableSystemRamBytes / (1024 * 1024)) : Math.round(systemTotalMb * 0.5));
  const pressurePct = stats?.memoryPressurePercent || stats?.systemRamPercent || 35;
  const pressureLevel = stats?.memoryPressureLevel || (pressurePct >= 85 ? 'critical' : pressurePct >= 70 ? 'moderate' : 'normal');

  return (
    <div
      ref={popoverRef}
      id="frc-quick-access-popover"
      className="absolute right-14 top-[calc(var(--fb-tabbar-h)+var(--fb-toolbar-h)+6px)] z-50 w-[420px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-96px)] overflow-y-auto p-4 rounded-[var(--fb-radius-lg)] bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-[var(--fb-shadow-pop)] text-neutral-200 text-xs font-sans animate-fade-in select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--fb-surface-hover)] border border-[var(--fb-border)] text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-[13px] tracking-tight">
              {t('frc.title')}
            </h3>
            <span className="text-[10px] text-neutral-400 font-mono">
              {t('frc.subsystem')} • v{APP_VERSION}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Real-time HUD Gauge & RAM metrics */}
      <div className="mt-3.5 p-3 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-neutral-300 font-medium flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('frc.browserRam')}</span>
          </span>
          <span className="font-mono text-xs font-bold text-white">
            {browserMb} MB <span className="text-neutral-500 font-normal">/ {Math.round(systemTotalMb / 1024)} GB</span>
          </span>
        </div>

        {/* Progress bar gauge */}
        <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              pressureLevel === 'critical'
                ? 'bg-rose-500'
                : pressureLevel === 'moderate'
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, pressurePct))}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-[10px] text-neutral-400 font-mono">
          <span>{t('frc.availableRam')}: {systemAvailableMb} MB</span>
          <span className={`uppercase font-semibold ${
            pressureLevel === 'critical' ? 'text-rose-400' : pressureLevel === 'moderate' ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {pressureLevel === 'critical' ? t('frc.pressureCritical') : pressureLevel === 'moderate' ? t('frc.pressureModerate') : t('frc.pressureNormal')}
          </span>
        </div>
      </div>

      {/* Operational Modes Selector */}
      <div className="mt-3">
        <label className="text-[11px] font-semibold text-neutral-300 block mb-1.5">
          {t('frc.operationalMode')}
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)]">
          <button
            type="button"
            onClick={() => handleModeChange('balanced')}
            className={`min-w-0 py-1.5 px-1 rounded-lg text-[10.5px] leading-tight font-medium transition-colors ${
              settings.mode === 'balanced'
                ? 'bg-[var(--fb-surface-3)] text-[var(--fb-text)] border border-[var(--fb-border-strong)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {t('frc.modeBalanced')}
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('aggressive')}
            className={`min-w-0 py-1.5 px-1 rounded-lg text-[10.5px] leading-tight font-medium transition-colors ${
              settings.mode === 'aggressive'
                ? 'bg-[var(--fb-surface-3)] text-[var(--fb-text)] border border-[var(--fb-border-strong)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title={t('frc.modeAggressiveTooltip')}
          >
            {t('frc.modeAggressive')}
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('unrestricted')}
            className={`min-w-0 py-1.5 px-1 rounded-lg text-[10.5px] leading-tight font-medium transition-colors ${
              settings.mode === 'unrestricted'
                ? 'bg-[var(--fb-surface-3)] text-[var(--fb-text)] border border-[var(--fb-border-strong)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {t('frc.modeUnrestricted')}
          </button>
        </div>
      </div>

      {/* Idle Freeze Timeout Selector */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('frc.freezeTimeout')}</span>
          </label>
          <span className="text-[10px] text-sky-400 font-mono font-medium">
            {Math.round(settings.tFreezeSec / 60)} {t('frc.min')}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)]">
          {[1, 3, 5, 15].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => {
                const updated = frcService.setIdleFreezeTimeout(mins * 60);
                setSettings(updated);
              }}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                Math.round(settings.tFreezeSec / 60) === mins
                  ? 'bg-[var(--fb-surface-3)] text-[var(--fb-text)] border border-[var(--fb-border-strong)]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {mins} {t('frc.min')}
            </button>
          ))}
        </div>
      </div>

      {/* Instant Action: Clean RAM Now */}
      <div className="mt-3">
        <button
          type="button"
          onClick={handleCleanRam}
          disabled={isCleaning}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--fb-accent)] hover:bg-[var(--fb-accent-strong)] text-[var(--fb-on-accent)] font-semibold text-xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <Sparkles className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} />
          <span>{isCleaning ? t('frc.cleaning') : t('frc.cleanRamNow')}</span>
        </button>

        {cleanedFeedback && (
          <div className="mt-2 p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium text-center animate-fade-in flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{cleanedFeedback}</span>
          </div>
        )}
      </div>

      {/* Top Consuming Background Tabs & Hibernate */}
      <div className="mt-4 pt-3 border-t border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('frc.topMemoryTabs')}</span>
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">
            {backgroundCandidates.length} {t('frc.tabsEligible')}
          </span>
        </div>

        {backgroundCandidates.length === 0 ? (
          <div className="py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-neutral-400 text-[11px] text-center">
            {t('frc.noEligibleTabs')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {backgroundCandidates.map((candidate) => (
              <div
                key={candidate.tabId}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.05] transition-colors"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <div className="text-white font-medium truncate text-[11px]">
                    {candidate.tabTitle}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2">
                    <span>{candidate.domain}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">{candidate.privateMemoryMb} MB</span>
                    <span>•</span>
                    <span>{candidate.idleTimeMinutes}m idle</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onHibernateTab(candidate.tabId)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[10px] font-medium transition-colors shrink-0 cursor-pointer"
                  title={t('frc.hibernateTabTooltip')}
                >
                  <Moon className="w-3 h-3" />
                  <span>{t('frc.hibernate')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation to freedom://memory */}
      <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onClose();
            onNavigate('freedom://memory');
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-[11px] font-medium">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('frc.openDiagnostics')} (freedom://memory)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    </div>
  );
};
