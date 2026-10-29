import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Settings,
  Shield,
  Palette,
  Zap,
  Sparkles,
  Image as ImageIcon,
  Sliders,
  RotateCcw,
  Check,
  Upload,
  Layers,
  Activity,
  Flame,
  Cpu,
  AlertTriangle,
  Info,
  ChevronRight,
  Puzzle,
} from 'lucide-react';
import { BrowserSettings, BrowserMode, ThemePresetId, ThemePalette, BackgroundImageScale } from '../settings/types';
import { SEARCH_ENGINES } from '../settings/defaults';
import { THEME_PRESETS } from '../settings/themePresets';
import { logger } from '../services/loggerService';
import { tauriBridge } from '../services/tauriBridge';
import freenImg from '../assets/freen-mascot.png';
import { useTranslation, TranslationKey } from '../i18n';
import { FreedomMark } from '../components/FreedomLogo';
import { APP_VERSION } from '../version';
import { RESET_LAYOUT_EVENT } from '../hooks/useDragOffset';
import { ExtensionsSettings } from '../components/ExtensionsSettings';
import { DataLocationSettings } from '../components/DataLocationSettings';
import { DeveloperLink } from '../components/DeveloperLink';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BrowserSettings;
  onUpdateSettings: (newSettings: Partial<BrowserSettings>) => void;
  onClearBrowsingData: () => void;
  /** Section to open first (e.g. 'extensions' from the toolbar puzzle menu) */
  initialTab?: string;
  /** Closes Settings and turns on the layout edit mode */
  onEditLayout?: () => void;
}

type SettingsTab = 'main' | 'privacy' | 'telemetry' | 'visual' | 'performance' | 'extensions' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearBrowsingData,
  initialTab,
  onEditLayout,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>((initialTab as SettingsTab) || 'main');
  const [dataCleared, setDataCleared] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [showDetailedColors, setShowDetailedColors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hardwareAcc, setHardwareAcc] = useState<boolean>(settings.hardwareAcceleration ?? true);
  const [showRestartBanner, setShowRestartBanner] = useState<boolean>(false);

  useEffect(() => {
    if ((window as any).electronAPI?.getHardwareAcceleration) {
      (window as any).electronAPI.getHardwareAcceleration().then((enabled: boolean) => {
        if (typeof enabled === 'boolean') {
          setHardwareAcc(enabled);
        }
      });
    }
  }, []);

  const handleToggleHardwareAcc = async (enabled: boolean) => {
    setHardwareAcc(enabled);
    if ((window as any).electronAPI?.setHardwareAcceleration) {
      await (window as any).electronAPI.setHardwareAcceleration(enabled);
    }
    onUpdateSettings({ hardwareAcceleration: enabled });
    setShowRestartBanner(true);
  };

  const handleBrowseDownloads = async () => {
    try {
      const chosen = await tauriBridge.chooseDownloadDir();
      if (chosen) {
        onUpdateSettings({ downloadsLocation: chosen });
        await tauriBridge.setDownloadDir(chosen);
      }
    } catch (err) {
      console.warn('Failed to choose download dir:', err);
    }
  };

  if (!isOpen) return null;

  const logs = logger.getLogs();

  // Mode change handler: switches performance parameters immediately
  const handleModeChange = (mode: BrowserMode) => {
    if (mode === 'performance') {
      onUpdateSettings({
        browserMode: 'performance',
        starAnimationEnabled: false,
        backgroundParticlesEnabled: false,
        uiAnimationsEnabled: false,
        blurEffectsEnabled: false,
        glowEffectsEnabled: false,
        autoSuspendInactiveTabs: true,
        tabSuspensionTimeoutMinutes: 5,
        backgroundTabThrottling: true,
      });
      tauriBridge.setBrowserMode('performance');
    } else {
      onUpdateSettings({
        browserMode: 'quality',
        starAnimationEnabled: true,
        backgroundParticlesEnabled: true,
        uiAnimationsEnabled: true,
        blurEffectsEnabled: true,
        glowEffectsEnabled: true,
        autoSuspendInactiveTabs: true,
        tabSuspensionTimeoutMinutes: 15,
        backgroundTabThrottling: true,
      });
      tauriBridge.setBrowserMode('quality');
    }
  };

  // Preset theme handler
  const handlePresetSelect = (presetId: ThemePresetId) => {
    if (presetId === 'custom') return;
    const presetPalette = THEME_PRESETS[presetId];
    onUpdateSettings({
      themePreset: presetId,
      palette: { ...presetPalette },
      customBackgroundColor: presetPalette.mainBg,
      customHeaderColor: presetPalette.headerBg,
    });
  };

  // Color palette single field updater
  const handleColorChange = (key: keyof ThemePalette, value: string | number) => {
    onUpdateSettings({
      themePreset: 'custom',
      palette: {
        ...settings.palette,
        [key]: value,
      },
    });
  };

  // Image Upload with local downscaling optimization (max 1080p, quality 85%)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Enforce maximum dimensions to protect RAM (max 1920x1080)
        const maxW = 1920;
        const maxH = 1080;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onUpdateSettings({ customBackgroundImage: optimizedDataUrl });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div
        id="freedom-settings-dialog"
        className="w-full max-w-4xl border border-white/10 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col h-[84vh] max-h-[680px] text-neutral-200 transition-colors"
        style={{
          backgroundColor:
            settings.applyThemeToBackground && settings.palette?.secondaryBg
              ? settings.palette.secondaryBg
              : settings.applyThemeToBackground && settings.palette?.cardBg
              ? settings.palette.cardBg
              : '#12141c',
          borderColor: settings.palette?.borderColor || 'rgba(255,255,255,0.1)',
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] transition-colors"
          style={{
            backgroundColor:
              settings.applyThemeToBackground && settings.palette?.headerBg
                ? settings.palette.headerBg
                : '#0d0f15',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4.5 h-4.5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {t('settings.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Sidebar + Content */}
        <div className="flex flex-1 min-h-0">
          {/* Navigation Sidebar */}
          <div
            className="w-64 border-r border-[var(--fb-border)] p-3 space-y-0.5 text-xs shrink-0 bg-[var(--fb-sidebar)]"
          >
            <div className="flex flex-col items-center gap-1 pt-3 pb-4">
              <FreedomMark size={34} className="text-[var(--fb-text)]" />
              <span className="mt-1 text-[13px] text-[var(--fb-text)]">Freedom Browser</span>
              <span className="text-[10px] text-[var(--fb-text-3)]">v{APP_VERSION}</span>
            </div>

            {(
              [
                { id: 'main', icon: Settings, label: t('settings.tabMain') },
                { id: 'visual', icon: Palette, label: t('settings.tabVisual') },
                { id: 'privacy', icon: Shield, label: t('settings.tabPrivacy') },
                { id: 'extensions', icon: Puzzle, label: t('ext.title') },
                { id: 'performance', icon: Zap, label: t('settings.tabPerformance') },
                { id: 'telemetry', icon: Activity, label: t('settings.tabTelemetry') },
                { id: 'about', icon: Info, label: t('nav.about') },
              ] as { id: SettingsTab; icon: React.ElementType; label: string }[]
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--fb-radius-md)] transition-colors text-left text-xs ${
                  activeTab === id
                    ? 'bg-[var(--fb-surface-hover)] text-[var(--fb-text)] font-medium'
                    : 'text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="flex-1 truncate">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--fb-text-3)]" />
              </button>
            ))}
          </div>

          {/* Tab Content Panes */}
          <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-6">
            {/* 1. BROWSER MODE & PERFORMANCE */}
            {activeTab === 'performance' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5 tracking-tight">
                    {t('settings.perfTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {t('settings.perfDesc')}
                  </p>
                </div>

                {/* Two Distinct Modes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Performance Mode Card */}
                  <div
                    onClick={() => handleModeChange('performance')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all overflow-hidden flex flex-col justify-between ${
                      settings.browserMode === 'performance'
                        ? 'bg-emerald-500/[0.06] border-emerald-500/35 ring-1 ring-emerald-500/20 shadow-xs'
                        : 'bg-white/[0.02] border-white/[0.08] hover:border-white/15'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2 min-h-[26px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-white text-xs sm:text-sm tracking-tight truncate" title={t('settings.modePerformance')}>
                            {t('settings.modePerformance')}
                          </span>
                        </div>
                        {settings.browserMode === 'performance' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0 uppercase tracking-wider">
                            {t('settings.activeBadge')}
                          </span>
                        ) : (
                          <span className="w-1 h-5" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                        {t('settings.modePerformanceDesc')}
                      </p>
                    </div>
                    <ul className="text-[10px] font-mono text-neutral-300 space-y-1">
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3 shrink-0" /> <span>{t('settings.modePerfItem1')}</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3 shrink-0" /> <span>{t('settings.modePerfItem2')}</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3 shrink-0" /> <span>{t('settings.modePerfItem3')}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Quality Mode Card */}
                  <div
                    onClick={() => handleModeChange('quality')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all overflow-hidden flex flex-col justify-between ${
                      settings.browserMode === 'quality'
                        ? 'bg-emerald-500/[0.06] border-emerald-500/35 ring-1 ring-emerald-500/20 shadow-xs'
                        : 'bg-white/[0.02] border-white/[0.08] hover:border-white/15'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2 min-h-[26px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-white text-xs sm:text-sm tracking-tight truncate" title={t('settings.modeQuality')}>
                            {t('settings.modeQuality')}
                          </span>
                        </div>
                        {settings.browserMode === 'quality' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0 uppercase tracking-wider">
                            {t('settings.activeBadge')}
                          </span>
                        ) : (
                          <span className="w-1 h-5" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                        {t('settings.modeQualityDesc')}
                      </p>
                    </div>
                    <ul className="text-[10px] font-mono text-neutral-300 space-y-1">
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3 shrink-0" /> <span>{t('settings.modePerfItem1')}</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3 shrink-0" /> <span>{t('settings.modeQualityItem2')}</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3 shrink-0" /> <span>{t('settings.modeQualityItem3')}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Tab Suspension & Memory Reclamation Controls */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {t('settings.autoSuspendTitle')}
                      </div>
                      <div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                        {t('settings.autoSuspendDesc')}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoSuspendInactiveTabs}
                      onChange={(e) =>
                        onUpdateSettings({ autoSuspendInactiveTabs: e.target.checked })
                      }
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {settings.autoSuspendInactiveTabs && (
                    <div className="pl-3 border-l-2 border-emerald-500/40">
                      <label className="text-xs text-neutral-300 block mb-1.5">
                        {t('settings.autoSuspendTimeout')}
                      </label>
                      <select
                        value={settings.tabSuspensionTimeoutMinutes}
                        onChange={(e) =>
                          onUpdateSettings({
                            tabSuspensionTimeoutMinutes: Number(e.target.value),
                          })
                        }
                        className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value={3}>{t('settings.timeout3m')}</option>
                        <option value={5}>{t('settings.timeout5m')}</option>
                        <option value={15}>{t('settings.timeout15m')}</option>
                        <option value={30}>{t('settings.timeout30m')}</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {t('settings.throttlingTitle')}
                      </div>
                      <div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                        {t('settings.throttlingDesc')}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.backgroundTabThrottling}
                      onChange={(e) =>
                        onUpdateSettings({ backgroundTabThrottling: e.target.checked })
                      }
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Hardware Acceleration (GPU) Toggle & Restart Notification */}
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{t('settings.hardwareAccTitle')}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                          {t('settings.hardwareAccDesc')}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hardwareAcc}
                        onChange={(e) => handleToggleHardwareAcc(e.target.checked)}
                        className="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                    </div>

                    {showRestartBanner && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-fade-in">
                        <div className="flex items-center gap-2 text-[11px] text-amber-300">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>{t('settings.restartToApply')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if ((window as any).electronAPI?.relaunchApp) {
                              (window as any).electronAPI.relaunchApp();
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
                        >
                          {t('settings.restartNow')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. THEMES, COLORS & CUSTOM BACKGROUND */}
            {activeTab === 'visual' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5 tracking-tight">
                    {t('settings.themesTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t('settings.themesDesc')}
                  </p>
                </div>

                {/* 10 Curated Theme Presets */}
                <div>
                  <div className="text-xs font-medium text-neutral-300 mb-2">
                    {t('settings.themePresets')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
                      const p = THEME_PRESETS[presetKey as keyof typeof THEME_PRESETS];
                      const isSelected = settings.themePreset === presetKey;
                      const themeName =
                        presetKey === 'graphite'
                          ? t('settings.theme.graphite')
                          : presetKey === 'midnight'
                          ? t('settings.theme.midnight')
                          : presetKey === 'forest'
                          ? t('settings.theme.forest')
                          : presetKey === 'ocean'
                          ? t('settings.theme.ocean')
                          : presetKey === 'violet'
                          ? t('settings.theme.violet')
                          : presetKey === 'crimson'
                          ? t('settings.theme.crimson')
                          : presetKey === 'amber'
                          ? t('settings.theme.amber')
                          : presetKey === 'monochrome'
                          ? t('settings.theme.monochrome')
                          : presetKey === 'mint'
                          ? t('settings.theme.mint')
                          : presetKey === 'midnight-amber'
                          ? t('settings.theme.midnightAmber')
                          : presetKey === 'arctic-blue'
                          ? t('settings.theme.arcticBlue')
                          : presetKey;

                      return (
                        <button
                          key={presetKey}
                          type="button"
                          onClick={() => handlePresetSelect(presetKey)}
                          className={`flex flex-col p-2 rounded-xl border text-left text-xs transition-all relative overflow-hidden cursor-pointer ${
                            isSelected
                              ? 'border-emerald-500/40 bg-white/[0.06] shadow-xs ring-1 ring-emerald-500/20'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: p.accentColor }}
                            />
                            <span className="font-medium text-neutral-200 truncate" title={themeName}>
                              {themeName}
                            </span>
                          </div>
                          <div className="flex gap-1 h-2 rounded overflow-hidden">
                            <div className="flex-1" style={{ backgroundColor: p.mainBg }} />
                            <div className="flex-1" style={{ backgroundColor: p.headerBg }} />
                            <div className="flex-1" style={{ backgroundColor: p.cardBg }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Apply Theme to Background Toggle */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {t('settings.applyThemeToBg')}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {t('settings.applyThemeToBgDesc')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.applyThemeToBackground)}
                    onChange={(e) =>
                      onUpdateSettings({ applyThemeToBackground: e.target.checked })
                    }
                    className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                  />
                </div>

                {/* Detailed Palette Toggle */}
                <div className="border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDetailedColors(!showDetailedColors)}
                    className="flex items-center justify-between w-full py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    <span>{showDetailedColors ? '▾ Hide Fine-Grained Palette Colors' : '▸ Expand Fine-Grained Palette Colors'}</span>
                    <Sliders className="w-3.5 h-3.5" />
                  </button>

                  {showDetailedColors && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                      {[
                        { key: 'accentColor', label: 'Accent Color' },
                        { key: 'mainBg', label: 'Main Background' },
                        { key: 'headerBg', label: 'Header Background' },
                        { key: 'cardBg', label: 'Card Background' },
                        { key: 'textColor', label: 'Text Color' },
                        { key: 'borderColor', label: 'Border Color' },
                        { key: 'inputBg', label: 'Input Background' },
                        { key: 'buttonBg', label: 'Button Background' },
                        { key: 'glowColor', label: 'Glow Hue' },
                      ].map(({ key, label }) => (
                        <div key={key} className="p-2 rounded-lg bg-neutral-950/80 border border-white/5">
                          <label className="text-[11px] text-neutral-400 block mb-1">
                            {label}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={String(settings.palette[key as keyof ThemePalette] || '#10b981')}
                              onChange={(e) => handleColorChange(key as keyof ThemePalette, e.target.value)}
                              className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                            />
                            <span className="font-mono text-[11px] text-neutral-300 uppercase">
                              {String(settings.palette[key as keyof ThemePalette] || '')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reset drag & drop layout */}
                <div className="border-t border-white/10 pt-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-white mb-0.5">{t('layout.edit')}</div>
                    <div className="text-[11px] text-neutral-400">{t('layout.editDesc')}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                  {onEditLayout && (
                    <button
                      id="settings-edit-layout"
                      type="button"
                      onClick={onEditLayout}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-medium text-emerald-300 shrink-0"
                    >
                      {t('layout.edit')}
                    </button>
                  )}
                  <button
                    id="reset-layout"
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ sidebarDock: 'left', toolbarDock: 'top' });
                      window.dispatchEvent(new Event(RESET_LAYOUT_EVENT));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white shrink-0"
                  >
                    {t('layout.reset')}
                  </button>
                  </div>
                </div>

                {/* Custom Background Image (Strictly Local) */}
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-white mb-0.5">
                      {t('settings.customBgImage')}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {t('settings.customBgImageDesc')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{settings.customBackgroundImage ? t('settings.uploadImage') : t('settings.uploadImage')}</span>
                    </button>

                    {settings.customBackgroundImage && (
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ customBackgroundImage: null })}
                        className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/30 text-xs font-medium text-red-300 transition-colors cursor-pointer"
                      >
                        {t('settings.removeImage')}
                      </button>
                    )}
                  </div>

                  {settings.customBackgroundImage && (
                    <div className="p-3 rounded-xl bg-neutral-950/80 border border-white/10 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-1">
                            Opacity ({settings.backgroundImageOpacity}%)
                          </label>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={settings.backgroundImageOpacity}
                            onChange={(e) =>
                              onUpdateSettings({ backgroundImageOpacity: Number(e.target.value) })
                            }
                            className="w-full accent-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-1">
                            Blur ({settings.backgroundImageBlur}px)
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={20}
                            value={settings.backgroundImageBlur}
                            onChange={(e) =>
                              onUpdateSettings({ backgroundImageBlur: Number(e.target.value) })
                            }
                            className="w-full accent-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-1">
                            Scaling Mode
                          </label>
                          <select
                            value={settings.backgroundImageScale}
                            onChange={(e) =>
                              onUpdateSettings({
                                backgroundImageScale: e.target.value as BackgroundImageScale,
                              })
                            }
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          >
                            <option value="cover">Cover (Fill screen)</option>
                            <option value="contain">Contain (Fit aspect)</option>
                            <option value="stretch">Stretch (Fit exact)</option>
                            <option value="center">Center (Original size)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Freedom Mascot (Freen) Option */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                      <img
                        src={freenImg}
                        alt="Freen Mascot"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Freen Browser Mascot</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/15 text-emerald-400 font-mono">
                          Native
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        Displays the subtle Freedom skeleton character in the bottom-right corner.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.showFreenMascot)}
                    onChange={(e) =>
                      onUpdateSettings({ showFreenMascot: e.target.checked })
                    }
                    className="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0"
                  />
                </div>

                {/* Individual Visual Feature Toggles */}
                <div className="border-t border-white/[0.06] pt-3.5 space-y-2.5">
                  <div className="text-xs font-medium text-neutral-300 mb-1">
                    {t('settings.visualTogglesTitle')}
                  </div>

                  {[
                    {
                      key: 'starAnimationEnabled',
                      label: t('settings.toggleStars'),
                      desc: t('settings.toggleStarsDesc'),
                    },
                    {
                      key: 'uiAnimationsEnabled',
                      label: t('settings.toggleTransitions'),
                      desc: t('settings.toggleTransitionsDesc'),
                    },
                    {
                      key: 'blurEffectsEnabled',
                      label: t('settings.toggleBlur'),
                      desc: t('settings.toggleBlurDesc'),
                    },
                    {
                      key: 'glowEffectsEnabled',
                      label: t('settings.toggleGlow'),
                      desc: t('settings.toggleGlowDesc'),
                    },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <div>
                        <div className="text-xs font-medium text-neutral-200">
                          {label}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {desc}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings[key as keyof BrowserSettings])}
                        onChange={(e) =>
                          onUpdateSettings({ [key]: e.target.checked })
                        }
                        className="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. MAIN & ENGINE SETTINGS */}
            {activeTab === 'main' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5 tracking-tight">
                    {t('settings.mainTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t('settings.mainDesc')}
                  </p>
                </div>

                {/* Interface Language Selection */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      {t('settings.language')}
                    </label>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {t('settings.languageDesc')}
                    </div>
                  </div>
                  <select
                    value={language}
                    onChange={(e) => {
                      const newLang = e.target.value as 'en' | 'ru';
                      setLanguage(newLang);
                      onUpdateSettings({ language: newLang });
                    }}
                    className="w-full max-w-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="en">{t('settings.langEnglish')}</option>
                    <option value="ru">{t('settings.langRussian')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    {t('settings.defaultSearchEngine')}
                  </label>
                  <select
                    value={settings.defaultSearchEngine}
                    onChange={(e) =>
                      onUpdateSettings({
                        defaultSearchEngine: e.target.value as BrowserSettings['defaultSearchEngine'],
                      })
                    }
                    className="w-full max-w-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    {SEARCH_ENGINES.map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.name} ({engine.searchUrl})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    {t('settings.downloadsDirectory')}
                  </label>
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      value={settings.downloadsLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateSettings({ downloadsLocation: val });
                        tauriBridge.setDownloadDir(val);
                      }}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleBrowseDownloads}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                    >
                      {t('settings.downloadsBrowse')}
                    </button>
                    <button
                      type="button"
                      onClick={() => tauriBridge.openDownloadFolder(settings.downloadsLocation)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title={t('settings.openInFileManager')}
                    >
                      {t('settings.open')}
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {t('settings.downloadsDirectoryDesc')}
                  </p>
                </div>

                <div>
                  <label htmlFor="download-speed-limit" className="text-xs font-medium text-neutral-300 block mb-1.5">
                    {t('settings.downloadSpeedLimit')}
                  </label>
                  <select
                    id="download-speed-limit"
                    value={settings.downloadSpeedLimitKBps ?? 0}
                    onChange={(e) => onUpdateSettings({ downloadSpeedLimitKBps: Number(e.target.value) })}
                    className="w-full max-w-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    {[0, 256, 512, 1024, 2048, 5120, 10240, 25600].map((kbps) => (
                      <option key={kbps} value={kbps}>
                        {kbps === 0
                          ? t('settings.downloadSpeedUnlimited')
                          : kbps >= 1024
                          ? `${kbps / 1024} ${t('settings.mbps')}`
                          : `${kbps} ${t('settings.kbps')}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-500 mt-1">{t('settings.downloadSpeedLimitDesc')}</p>
                </div>

              </div>
            )}

            {/* 4. PRIVACY & SECURITY */}
            {activeTab === 'privacy' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5 tracking-tight">
                    {t('settings.privacyTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t('settings.privacyDesc')}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {[
                    { key: 'adBlockEnabled', label: t('settings.adBlock') },
                    { key: 'doNotTrack', label: t('settings.doNotTrack') },
                    { key: 'blockThirdPartyCookies', label: t('settings.blockThirdParty') },
                    { key: 'popupsBlocked', label: t('settings.blockPopups') },
                    { key: 'clearBrowsingDataOnExit', label: t('settings.clearOnExit') },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <span className="text-xs text-neutral-200 font-medium">{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(settings[key as keyof BrowserSettings])}
                        onChange={(e) =>
                          onUpdateSettings({ [key]: e.target.checked })
                        }
                        className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-3.5 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      onClearBrowsingData();
                      setDataCleared(true);
                      setTimeout(() => setDataCleared(false), 2500);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs text-rose-300 font-medium transition-colors cursor-pointer"
                  >
                    {dataCleared ? t('settings.clearedSuccess') : t('settings.clearAllData')}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="flex flex-col items-center text-center gap-3 pt-6 animate-fade-in">
                <FreedomMark size={56} className="text-[var(--fb-text)]" />
                <h3 className="text-lg font-medium text-white tracking-tight">Freedom Browser</h3>
                <p className="text-xs text-neutral-400">{t('about.version', { version: APP_VERSION })}</p>
                <p className="max-w-md text-xs text-neutral-300 leading-relaxed">{t('about.description')}</p>
                <DeveloperLink onOpen={onClose} />
                <div className="flex flex-wrap justify-center gap-2 pt-2 text-[11px] text-neutral-400">
                  <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">{t('about.engine')}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">{t('about.runtime')}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">{t('about.backend')}</span>
                </div>
                <p className="pt-4 text-[11px] text-neutral-500">{t('about.license')}</p>
              </div>
            )}

            {activeTab === 'extensions' && <ExtensionsSettings />}

            {/* 5. ZERO TELEMETRY */}
            {activeTab === 'telemetry' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5 tracking-tight">
                    {t('settings.telemetryTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {t('settings.telemetryDesc')}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {t('settings.diagnosticLogs')}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                        {t('settings.diagnosticLogsDesc')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !settings.localDiagnosticLogs;
                        onUpdateSettings({ localDiagnosticLogs: nextVal });
                        logger.setLoggingEnabled(nextVal);
                      }}
                      className={`shrink-0 whitespace-nowrap min-w-[64px] text-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                        settings.localDiagnosticLogs
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.06] text-neutral-400 border border-white/10'
                      }`}
                    >
                      [{settings.localDiagnosticLogs ? 'ON' : 'OFF'}]
                    </button>
                  </div>
                </div>

                <DataLocationSettings />

                {settings.localDiagnosticLogs && (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-300">
                        {t('settings.diagnosticEvents', { count: logs.length })}
                      </span>
                      <button
                        type="button"
                        onClick={() => logger.clearLogs()}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] text-neutral-300 transition-colors cursor-pointer"
                      >
                        {t('settings.clearEvents')}
                      </button>
                    </div>

                    <div className="p-3 bg-black/60 rounded-xl font-mono text-[10px] text-emerald-400/90 h-36 overflow-y-auto border border-white/[0.06] space-y-1">
                      {logs.length > 0 ? (
                        logs.map((log) => (
                          <div key={log.id} className="leading-tight">
                            <span className="text-neutral-500">[{log.timestamp.substring(11, 19)}]</span>{' '}
                            <span className="text-neutral-400">[{log.category}]</span> {log.message}
                          </div>
                        ))
                      ) : (
                        <div className="text-neutral-500 italic">{t('settings.noEvents')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
