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
} from 'lucide-react';
import { BrowserSettings, BrowserMode, ThemePresetId, ThemePalette, BackgroundImageScale } from '../settings/types';
import { SEARCH_ENGINES } from '../settings/defaults';
import { THEME_PRESETS } from '../settings/themePresets';
import { logger } from '../services/loggerService';
import { tauriBridge } from '../services/tauriBridge';
import freenImg from '../assets/freen-mascot.png';
import { useTranslation, TranslationKey } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BrowserSettings;
  onUpdateSettings: (newSettings: Partial<BrowserSettings>) => void;
  onClearBrowsingData: () => void;
}

type SettingsTab = 'main' | 'privacy' | 'telemetry' | 'visual' | 'performance';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearBrowsingData,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('performance');
  const [dataCleared, setDataCleared] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [showDetailedColors, setShowDetailedColors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userDataPath, setUserDataPath] = useState<string>('');
  const [isMigratingStorage, setIsMigratingStorage] = useState(false);
  const [storageStatusMsg, setStorageStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'main' && (window as any).electronAPI?.getUserDataPath) {
      (window as any).electronAPI.getUserDataPath().then((p: string) => {
        if (p) setUserDataPath(p);
      });
    }
  }, [activeTab]);

  const handleChangeUserDataPath = async () => {
    if (!(window as any).electronAPI?.chooseUserDataPath) return;
    const chosen = await (window as any).electronAPI.chooseUserDataPath();
    if (!chosen || chosen === userDataPath) return;

    const shouldMigrate = window.confirm(
      language === 'ru'
        ? `Скопировать текущие данные браузера в новую папку?\n\n${chosen}`
        : `Copy current browser data to new location?\n\n${chosen}`
    );

    setIsMigratingStorage(true);
    setStorageStatusMsg(t('settings.storageMigrate'));
    try {
      const res = await (window as any).electronAPI.migrateUserDataPath({
        targetPath: chosen,
        migrateExisting: shouldMigrate,
      });
      if (res?.success) {
        setUserDataPath(res.newPath);
        setStorageStatusMsg(t('settings.storageRestart'));
      }
    } catch (err) {
      console.error('Storage migration failed:', err);
    } finally {
      setIsMigratingStorage(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div
        id="freedom-settings-dialog"
        className="w-full max-w-3xl border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[82vh] text-neutral-200 transition-colors"
        style={{
          backgroundColor:
            settings.applyThemeToBackground && settings.palette?.secondaryBg
              ? settings.palette.secondaryBg
              : settings.applyThemeToBackground && settings.palette?.cardBg
              ? settings.palette.cardBg
              : '#171717',
          borderColor: settings.palette?.borderColor || 'rgba(16,185,129,0.3)',
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 transition-colors"
          style={{
            backgroundColor:
              settings.applyThemeToBackground && settings.palette?.headerBg
                ? settings.palette.headerBg
                : '#0a0a0a',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white tracking-wide">
              {t('settings.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Sidebar + Content */}
        <div className="flex flex-1 min-h-0">
          {/* Navigation Sidebar */}
          <div
            className="w-56 border-r border-white/5 p-3 space-y-1 text-xs transition-colors"
            style={{
              backgroundColor:
                settings.applyThemeToBackground && settings.palette?.sidebarBg
                  ? settings.palette.sidebarBg
                  : 'rgba(10, 10, 10, 0.8)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left font-medium ${
                activeTab === 'performance'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>{t('settings.tabPerformance')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left font-medium ${
                activeTab === 'visual'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>{t('settings.tabVisual')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('main')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left font-medium ${
                activeTab === 'main'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>{t('settings.tabMain')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left font-medium ${
                activeTab === 'privacy'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>{t('settings.tabPrivacy')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left font-medium ${
                activeTab === 'telemetry'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>{t('settings.tabTelemetry')}</span>
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-6">
            {/* 1. BROWSER MODE & PERFORMANCE */}
            {activeTab === 'performance' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {t('settings.perfTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {t('settings.perfDesc')}
                  </p>
                </div>

                {/* Two Distinct Modes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Performance Mode Card */}
                  <div
                    onClick={() => handleModeChange('performance')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all overflow-hidden flex flex-col justify-between ${
                      settings.browserMode === 'performance'
                        ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/50'
                        : 'bg-neutral-950/60 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2 min-h-[26px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Zap className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-white text-xs sm:text-sm tracking-tight truncate" title={t('settings.modePerformance')}>
                            {t('settings.modePerformance')}
                          </span>
                        </div>
                        {settings.browserMode === 'performance' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500 text-black font-bold shrink-0 uppercase tracking-wider">
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
                        ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/50'
                        : 'bg-neutral-950/60 border-white/10 hover:border-white/20'
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
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500 text-black font-bold shrink-0 uppercase tracking-wider">
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
                <div className="p-4 rounded-xl bg-neutral-950/60 border border-white/10 space-y-4">
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
                    <div className="pl-4 border-l-2 border-emerald-500/40">
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
                        className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                </div>
              </div>
            )}

            {/* 2. THEMES, COLORS & CUSTOM BACKGROUND */}
            {activeTab === 'visual' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {t('settings.themesTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t('settings.themesDesc')}
                  </p>
                </div>

                {/* 10 Curated Theme Presets */}
                <div>
                  <div className="text-xs font-semibold text-neutral-200 mb-2.5">
                    {t('settings.themePresets')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
                      const p = THEME_PRESETS[presetKey as keyof typeof THEME_PRESETS];
                      const isSelected = settings.themePreset === presetKey;
                      const themeName =
                        presetKey === 'midnight'
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
                          className={`flex flex-col p-2.5 rounded-xl border text-left text-xs transition-all relative overflow-hidden cursor-pointer ${
                            isSelected
                              ? 'border-emerald-400 bg-neutral-900/90 shadow-md ring-1 ring-emerald-400/40'
                              : 'border-white/10 bg-neutral-950/60 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: p.accentColor }}
                            />
                            <span className="font-semibold text-white truncate" title={themeName}>
                              {themeName}
                            </span>
                          </div>
                          <div className="flex gap-1 h-3 rounded overflow-hidden">
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
                <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/10 flex items-center justify-between">
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
                <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-inner">
                      <img
                        src={freenImg}
                        alt="Freen Mascot"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Freen Browser Mascot</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">
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
                    className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                  />
                </div>

                {/* Individual Visual Feature Toggles */}
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="text-xs font-semibold text-white mb-2">
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
                        className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. MAIN & ENGINE SETTINGS */}
            {activeTab === 'main' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {t('settings.mainTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t('settings.mainDesc')}
                  </p>
                </div>

                {/* Interface Language Selection */}
                <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/10 space-y-2">
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
                    className="w-full max-w-xs bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="en">{t('settings.langEnglish')}</option>
                    <option value="ru">{t('settings.langRussian')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    {t('settings.defaultSearchEngine')}
                  </label>
                  <select
                    value={settings.defaultSearchEngine}
                    onChange={(e) =>
                      onUpdateSettings({
                        defaultSearchEngine: e.target.value as BrowserSettings['defaultSearchEngine'],
                      })
                    }
                    className="w-full max-w-xs bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {SEARCH_ENGINES.map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.name} ({engine.searchUrl})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    {t('settings.downloadsDirectory')}
                  </label>
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      value={settings.downloadsLocation}
                      onChange={(e) =>
                        onUpdateSettings({ downloadsLocation: e.target.value })
                      }
                      className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => tauriBridge.openDownloadFolder(settings.downloadsLocation)}
                      className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 hover:text-white transition-colors shrink-0 cursor-pointer"
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
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    {t('settings.storageTitle')}
                  </label>
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      readOnly
                      value={userDataPath || (language === 'ru' ? 'По умолчанию (папка пользователя)' : 'Default (User Profile Directory)')}
                      className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleChangeUserDataPath}
                      disabled={isMigratingStorage}
                      className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 hover:text-white transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {t('settings.storageChange')}
                    </button>
                  </div>
                  {storageStatusMsg && (
                    <div className="text-[11px] text-emerald-400 mt-1 font-mono">
                      {storageStatusMsg}
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {t('settings.storageDesc')}
                  </p>
                </div>
              </div>
            )}

            {/* 4. PRIVACY & SECURITY */}
            {activeTab === 'privacy' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {t('settings.privacyTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t('settings.privacyDesc')}
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'doNotTrack', label: t('settings.doNotTrack') },
                    { key: 'blockThirdPartyCookies', label: t('settings.blockThirdParty') },
                    { key: 'popupsBlocked', label: t('settings.blockPopups') },
                    { key: 'clearBrowsingDataOnExit', label: t('settings.clearOnExit') },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1.5">
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

                <div className="pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      onClearBrowsingData();
                      setDataCleared(true);
                      setTimeout(() => setDataCleared(false), 2500);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/30 text-xs text-red-300 font-medium transition-colors cursor-pointer"
                  >
                    {dataCleared ? t('settings.clearedSuccess') : t('settings.clearAllData')}
                  </button>
                </div>
              </div>
            )}

            {/* 5. ZERO TELEMETRY */}
            {activeTab === 'telemetry' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {t('settings.telemetryTitle')}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {t('settings.telemetryDesc')}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-950/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {t('settings.diagnosticLogs')}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
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
                      className={`shrink-0 whitespace-nowrap min-w-[72px] text-center px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                        settings.localDiagnosticLogs
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      [{settings.localDiagnosticLogs ? 'ON' : 'OFF'}]
                    </button>
                  </div>
                </div>

                {settings.localDiagnosticLogs && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-300">
                        {t('settings.diagnosticEvents', { count: logs.length })}
                      </span>
                      <button
                        type="button"
                        onClick={() => logger.clearLogs()}
                        className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 cursor-pointer"
                      >
                        {t('settings.clearEvents')}
                      </button>
                    </div>

                    <div className="p-3 bg-black rounded-lg font-mono text-[10px] text-emerald-400/90 h-36 overflow-y-auto border border-white/5 space-y-1">
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
