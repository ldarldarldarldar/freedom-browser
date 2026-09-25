import React, { useState, useRef } from 'react';
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('performance');
  const [dataCleared, setDataCleared] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [showDetailedColors, setShowDetailedColors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        className="w-full max-w-3xl bg-neutral-900 border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[82vh] text-neutral-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white tracking-wide">
              Freedom Settings
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
          <div className="w-56 bg-neutral-950/80 border-r border-white/5 p-3 space-y-1 text-xs">
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
              <span>Browser Mode & RAM</span>
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
              <span>Themes & Appearance</span>
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
              <span>Main & Engine</span>
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
              <span>Privacy & Security</span>
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
              <span>Zero-Telemetry</span>
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-6">
            {/* 1. BROWSER MODE & PERFORMANCE */}
            {activeTab === 'performance' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Browser Performance Mode
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Select the operational mode for Freedom Browser. This dynamically adjusts rendering pipelines, memory reclamation, and background tasks.
                  </p>
                </div>

                {/* Two Distinct Modes Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Performance Mode Card */}
                  <div
                    onClick={() => handleModeChange('performance')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      settings.browserMode === 'performance'
                        ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/50'
                        : 'bg-neutral-950/60 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-emerald-400" />
                        <span className="font-semibold text-white text-sm">
                          PERFORMANCE
                        </span>
                      </div>
                      {settings.browserMode === 'performance' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500 text-black font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                      Maximum speed and lowest RAM usage. Disables animated starfield, heavy transitions, and blur. Suspends inactive tabs aggressively.
                    </p>
                    <ul className="text-[10px] font-mono text-neutral-300 space-y-1">
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3" /> Target ~300 MB idle baseline
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3" /> Zero background canvas loops
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3" /> Inactive tabs hibernated after 5m
                      </li>
                    </ul>
                  </div>

                  {/* Quality Mode Card */}
                  <div
                    onClick={() => handleModeChange('quality')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      settings.browserMode === 'quality'
                        ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/50'
                        : 'bg-neutral-950/60 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        <span className="font-semibold text-white text-sm">
                          QUALITY
                        </span>
                      </div>
                      {settings.browserMode === 'quality' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500 text-black font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                      Visually polished experience with GPU-accelerated starscape, smooth transitions, custom background image, and optimized memory management.
                    </p>
                    <ul className="text-[10px] font-mono text-neutral-300 space-y-1">
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3" /> Animated moving starscape
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3" /> Custom local wallpaper support
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3 h-3" /> Smooth UI animations & blurs
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Tab Suspension & Memory Reclamation Controls */}
                <div className="p-4 rounded-xl bg-neutral-950/60 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Automatic Inactive Tab Suspension
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Unmounts WebViews of inactive tabs to immediately reclaim 50–150 MB RAM per tab.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoSuspendInactiveTabs}
                      onChange={(e) =>
                        onUpdateSettings({ autoSuspendInactiveTabs: e.target.checked })
                      }
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </div>

                  {settings.autoSuspendInactiveTabs && (
                    <div className="pl-4 border-l-2 border-emerald-500/40">
                      <label className="text-xs text-neutral-300 block mb-1.5">
                        Inactivity Timeout Before Hibernation
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
                        <option value={3}>3 minutes (Ultra aggressive)</option>
                        <option value={5}>5 minutes (Performance Mode Default)</option>
                        <option value={15}>15 minutes (Standard Balanced)</option>
                        <option value={30}>30 minutes</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Background Tab Throttling
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Pauses non-visible timers and animations in hidden WebViews.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.backgroundTabThrottling}
                      onChange={(e) =>
                        onUpdateSettings({ backgroundTabThrottling: e.target.checked })
                      }
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
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
                    Themes & Color Customization
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Choose from 8 curated theme presets or fine-tune individual interface elements.
                  </p>
                </div>

                {/* 8 Curated Theme Presets */}
                <div>
                  <div className="text-xs font-semibold text-neutral-200 mb-2.5">
                    Theme Presets
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
                      const p = THEME_PRESETS[presetKey as keyof typeof THEME_PRESETS];
                      const isSelected = settings.themePreset === presetKey;

                      return (
                        <button
                          key={presetKey}
                          type="button"
                          onClick={() => handlePresetSelect(presetKey)}
                          className={`flex flex-col p-2.5 rounded-xl border text-left text-xs transition-all relative overflow-hidden ${
                            isSelected
                              ? 'border-emerald-400 bg-neutral-900/90 shadow-md ring-1 ring-emerald-400/40'
                              : 'border-white/10 bg-neutral-950/60 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: p.accentColor }}
                            />
                            <span className="font-semibold text-white capitalize">
                              {presetKey}
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
                      Custom Background Image
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Stored strictly on your local device. Automatically optimized to prevent RAM bloating.
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
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{settings.customBackgroundImage ? 'Replace Image' : 'Select Local Image'}</span>
                    </button>

                    {settings.customBackgroundImage && (
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ customBackgroundImage: null })}
                        className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/30 text-xs font-medium text-red-300 transition-colors"
                      >
                        Remove Background
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
                    Individual Visual Effect Toggles
                  </div>

                  {[
                    {
                      key: 'starAnimationEnabled',
                      label: 'Animated Star Background',
                      desc: 'Subtle moving particle stars on Black Space theme',
                    },
                    {
                      key: 'uiAnimationsEnabled',
                      label: 'UI Transitions & Animations',
                      desc: 'Smooth CSS transitions on hover, tab switching, and dialogs',
                    },
                    {
                      key: 'blurEffectsEnabled',
                      label: 'Backdrop Blur & Glassmorphism',
                      desc: 'Translucent background blurs behind modal dialogs and address bar',
                    },
                    {
                      key: 'glowEffectsEnabled',
                      label: 'Neon Accent Glows',
                      desc: 'Subtle neon box-shadow glows on focused inputs and active tabs',
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
                    Main Settings
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Search engine, startup behaviors, and download destinations.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    Default Search Engine
                  </label>
                  <select
                    value={settings.defaultSearchEngine}
                    onChange={(e) =>
                      onUpdateSettings({
                        defaultSearchEngine: e.target.value as BrowserSettings['defaultSearchEngine'],
                      })
                    }
                    className="w-full max-w-xs bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                    Downloads Directory
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
                      className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 hover:text-white transition-colors shrink-0"
                      title="Open in System File Manager"
                    >
                      Open
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Files downloaded by Freedom will be saved here natively.
                  </p>
                </div>
              </div>
            )}

            {/* 4. PRIVACY & SECURITY */}
            {activeTab === 'privacy' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Privacy & Sandboxing
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Standard strict isolation with zero tracking.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'doNotTrack', label: 'Send Do Not Track header' },
                    { key: 'blockThirdPartyCookies', label: 'Block third-party tracking cookies' },
                    { key: 'popupsBlocked', label: 'Block unsolicited popup windows' },
                    { key: 'clearBrowsingDataOnExit', label: 'Clear all session cookies on browser exit' },
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
                    className="px-4 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/30 text-xs text-red-300 font-medium transition-colors"
                  >
                    {dataCleared ? 'Cleared Successfully!' : 'Clear All Browsing Data & Local Storage'}
                  </button>
                </div>
              </div>
            )}

            {/* 5. ZERO TELEMETRY */}
            {activeTab === 'telemetry' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Zero-Telemetry Guarantee
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Freedom Browser strictly contains 0 analytics SDKs, 0 tracking beacons, and 0 remote reporting endpoints.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-950/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Local Diagnostic Logs
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1 max-w-md">
                        Stored strictly locally on your filesystem. Never transmitted externally.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !settings.localDiagnosticLogs;
                        onUpdateSettings({ localDiagnosticLogs: nextVal });
                        logger.setLoggingEnabled(nextVal);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                        settings.localDiagnosticLogs
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      [{settings.localDiagnosticLogs ? ' ON ' : ' OFF '}]
                    </button>
                  </div>
                </div>

                {settings.localDiagnosticLogs && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-300">
                        Local Diagnostic Events ({logs.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => logger.clearLogs()}
                        className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300"
                      >
                        Clear Events
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
                        <div className="text-neutral-500 italic">No events recorded.</div>
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
