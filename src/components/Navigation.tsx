import React, { useState, useEffect, useRef } from 'react';
import { DockEdge } from '../settings/types';
import {
  GripVertical,
  VenetianMask,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  Home,
  Shield,
  ShieldAlert,
  Search,
  Lock,
  Menu,
  Activity,
  Download,
  Terminal,
  Settings as SettingsIcon,
  Star,
  ExternalLink,
  Zap,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  ZoomIn,
  ZoomOut,
  ArrowUpDown,
  Cpu,
  Copy,
  ArrowDownAZ,
  Globe,
  Columns2,
} from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { SearchEngineId } from '../settings/types';
import { SearchEngineService } from '../services/searchEngineService';
import { SEARCH_ENGINES } from '../settings/defaults';
import { tauriBridge } from '../services/tauriBridge';
import { TabSortMode } from '../services/tabSortService';
import { useTranslation } from '../i18n';

interface NavigationProps {
  currentTab: BrowserTab | undefined;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onHome: () => void;
  onOpenSettings: () => void;
  onOpenTaskManager: () => void;
  onOpenDownloads: () => void;
  onToggleDevTools: () => void;
  onOpenAbout: () => void;
  defaultSearchEngine: SearchEngineId;
  downloadsCount: number;
  headerColorClass?: string;
  isDevToolsOpen: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onOpenBookmarks?: () => void;
  onOpenHistory?: () => void;
  onToggleFind?: () => void;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onSortTabs?: (mode: TabSortMode) => void;
  isSplitView?: boolean;
  onToggleSplitView?: () => void;
  onToggleFRCPopover?: () => void;
  isFRCPopoverOpen?: boolean;
  browserRamMb?: number;
  systemRamMb?: number;
  memoryPressureLevel?: 'normal' | 'moderate' | 'critical';
  onNewPrivateTab?: () => void;
  /** Window edge the toolbar is docked to; left/right render it as a vertical panel */
  dock?: DockEdge;
  onDockDragStart?: (e: React.PointerEvent) => void;
  privacyToggles?: { key: string; label: string; value: boolean; icon: React.ElementType }[];
  onTogglePrivacy?: (key: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onStop,
  onHome,
  onOpenSettings,
  onOpenTaskManager,
  onOpenDownloads,
  onToggleDevTools,
  onOpenAbout,
  defaultSearchEngine,
  downloadsCount,
  headerColorClass = 'bg-[var(--fb-bg)]',
  isDevToolsOpen,
  isBookmarked = false,
  onToggleBookmark,
  onOpenBookmarks,
  onOpenHistory,
  onToggleFind,
  zoomLevel = 100,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSortTabs,
  isSplitView = false,
  onToggleSplitView,
  onToggleFRCPopover,
  isFRCPopoverOpen = false,
  browserRamMb,
  systemRamMb,
  memoryPressureLevel = 'normal',
  privacyToggles,
  onTogglePrivacy,
  onNewPrivateTab,
  dock = 'top',
  onDockDragStart,
}) => {
  const vertical = dock === 'left' || dock === 'right';
  // Popups open upward when the toolbar sits at the bottom of the window
  const popUp = dock === 'bottom';
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync address input when current tab changes
  useEffect(() => {
    if (currentTab) {
      if (currentTab.url === 'freedom://newtab') {
        setInputValue('');
      } else {
        setInputValue(currentTab.url);
      }
    }
  }, [currentTab?.id, currentTab?.url]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowSecurityDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const resolved = SearchEngineService.resolveInputToUrl(inputValue, defaultSearchEngine);
    onNavigate(resolved);
    inputRef.current?.blur();
  };

  const isSecure = currentTab?.url.startsWith('https://') || currentTab?.url.startsWith('freedom://');
  const activeEngine = SEARCH_ENGINES.find((e) => e.id === defaultSearchEngine) || SEARCH_ENGINES[0];

  return (
    <header
      id="browser-nav-toolbar"
      data-dock={dock}
      className={`flex select-none relative z-30 bg-[var(--fb-chrome)] border-[var(--fb-border)] app-drag-region ${
        vertical
          ? `flex-col items-stretch w-[264px] shrink-0 p-2 gap-2 ${dock === 'left' ? 'border-r' : 'border-l'}`
          : `items-center h-[var(--fb-toolbar-h)] px-2 gap-1.5 ${dock === 'bottom' ? 'border-t' : 'border-b'}`
      }`}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'browser-nav-toolbar') {
          tauriBridge.maximizeWindow();
        }
      }}
    >
      {/* Navigation History Controls (+ dock grip) */}
      <div className="flex items-center gap-0.5 app-no-drag">
        {onDockDragStart && (
          <button
            id="toolbar-dock-grip"
            type="button"
            onPointerDown={onDockDragStart}
            title={t('layout.dockHint')}
            aria-label={t('layout.dockHint')}
            className="w-5 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-500 hover:text-white hover:bg-white/[0.08] cursor-grab touch-none"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          id="nav-btn-back"
          type="button"
          onClick={onBack}
          disabled={!currentTab?.canGoBack}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
          title={t('nav.back')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          id="nav-btn-forward"
          type="button"
          onClick={onForward}
          disabled={!currentTab?.canGoForward}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
          title={t('nav.forward')}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          id="nav-btn-reload"
          type="button"
          onClick={currentTab?.isLoading ? onStop : onReload}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
          title={currentTab?.isLoading ? t('nav.stop') : t('nav.reload')}
        >
          {currentTab?.isLoading ? <X className="w-4 h-4 text-emerald-400" /> : <RotateCcw className="w-4 h-4" />}
        </button>
        <button
          id="nav-btn-home"
          type="button"
          onClick={onHome}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
          title={t('nav.home')}
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* Omni Address & Search Bar */}
      <div className={`${vertical ? 'flex-none' : 'flex-1 min-w-0'} relative app-no-drag`}>
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className={`flex items-center w-full h-7 px-2 rounded-[var(--fb-radius-md)] border transition-colors duration-150 ${
              isFocused
                ? 'bg-[var(--fb-input)] border-emerald-500/50 ring-2 ring-emerald-500/15 text-white'
                : 'bg-[var(--fb-input)] hover:bg-[var(--fb-surface-hover)] border-[var(--fb-border)] hover:border-[var(--fb-border-strong)] text-neutral-200'
            }`}
          >
            {/* Security Indicator */}
            <button
              type="button"
              onClick={() => setShowSecurityDetails(!showSecurityDetails)}
              className="mr-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-white/10 text-xs text-neutral-400 hover:text-white transition-colors"
              title={
                currentTab?.url.startsWith('freedom://')
                  ? t('nav.securityInternal')
                  : isSecure
                  ? t('nav.securitySecure')
                  : t('nav.securityInsecure')
              }
            >
              {currentTab?.url.startsWith('freedom://') ? (
                <Search className="w-3.5 h-3.5 text-neutral-500" />
              ) : isSecure ? (
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {/* URL / Search Input */}
            <input
              ref={inputRef}
              id="browser-omnibar-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('nav.searchPlaceholderEmpty')}
              className="w-full bg-transparent text-xs text-neutral-100 focus:outline-none placeholder-neutral-500 font-normal"
              spellCheck={false}
              autoComplete="off"
            />

            {/* Zoom Indicator Badge (shown when not 100%) */}
            {zoomLevel !== 100 && onResetZoom && (
              <button
                type="button"
                onClick={onResetZoom}
                title={t('nav.zoomBadge', { zoom: zoomLevel })}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shrink-0 mr-1"
              >
                {zoomLevel}%
              </button>
            )}

            {/* Quick action button inside omnibar */}
            {inputValue && (
              <button
                type="button"
                onClick={() => setInputValue('')}
                className="p-1 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/10 transition-colors"
                title={t('nav.clearAddress')}
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Bookmark Current Page Star Button */}
            {onToggleBookmark && currentTab && !currentTab.url.startsWith('freedom://newtab') && (
              <button
                type="button"
                onClick={onToggleBookmark}
                title={isBookmarked ? t('nav.editBookmarkTab') : t('nav.bookmarkTab')}
                className={`p-1 rounded-md transition-colors shrink-0 ${
                  isBookmarked
                    ? 'text-emerald-400 hover:text-emerald-300'
                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/10'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                    isBookmarked ? 'fill-emerald-400 text-emerald-400' : ''
                  }`}
                />
              </button>
            )}
          </div>
        </form>

        {/* Security / Privacy details popup */}
        {showSecurityDetails && (
          <div className={`absolute ${popUp ? 'bottom-9' : 'top-9'} left-0 w-80 max-w-[calc(100vw-24px)] p-3.5 rounded-[var(--fb-radius-lg)] bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-[var(--fb-shadow-pop)] z-50 text-xs text-neutral-200 animate-fade-in`}>
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-white/[0.08]">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white tracking-tight">{t('nav.guardTitle')}</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-neutral-300">
              <p className="flex justify-between">
                <span>{t('nav.encryption')}</span>
                <span className="text-emerald-400 font-mono">
                  {isSecure ? t('nav.tlsVerified') : t('nav.unencrypted')}
                </span>
              </p>
              <p className="flex justify-between">
                <span>{t('nav.telemetry')}</span>
                <span className="text-emerald-400 font-mono">{t('nav.strictlyDisabled')}</span>
              </p>
              <p className="flex justify-between">
                <span>{t('nav.cookies')}</span>
                <span className="text-emerald-400 font-mono">{t('nav.blocked')}</span>
              </p>
              <p className="flex justify-between">
                <span>{t('nav.sandbox')}</span>
                <span className="text-emerald-400 font-mono">{t('nav.isolated')}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Split View, Find, History, Bookmarks, Task Manager, Downloads, DevTools, Menu */}
      <div className={`flex items-center gap-0.5 shrink-0 app-no-drag ${vertical ? 'flex-wrap' : ''}`} ref={menuRef}>
        {/* Split View Toggle Button */}
        {onToggleSplitView && (
          <button
            id="btn-toggle-split-view"
            type="button"
            onClick={onToggleSplitView}
            className={`w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] active:scale-95 transition-all ${
              isSplitView
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title={isSplitView ? t('nav.exitSplitView') : t('nav.splitView')}
          >
            <Columns2 className="w-4 h-4" />
          </button>
        )}

        {/* Find in page toggle button */}
        {onToggleFind && (
          <button
            id="btn-toggle-find"
            type="button"
            onClick={onToggleFind}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
            title={t('nav.findInPage')}
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {/* Bookmarks Manager button */}
        {onOpenBookmarks && (
          <button
            id="btn-open-bookmarks"
            type="button"
            onClick={onOpenBookmarks}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
            title={t('nav.bookmarks')}
          >
            <BookmarkIcon className="w-4 h-4" />
          </button>
        )}

        {/* History button */}
        {onOpenHistory && (
          <button
            id="btn-open-history"
            type="button"
            onClick={onOpenHistory}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
            title={t('nav.historyTooltip')}
          >
            <HistoryIcon className="w-4 h-4" />
          </button>
        )}

        {/* Freedom RAM Control (FRC) HUD Button */}
        <button
          id="btn-frc-hud"
          type="button"
          onClick={onToggleFRCPopover || onOpenTaskManager}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border active:scale-95 transition-all cursor-pointer ${
            isFRCPopoverOpen
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
              : 'text-neutral-300 hover:text-white hover:bg-white/[0.08] border-white/[0.06]'
          }`}
          title={t('frc.hudTooltip')}
        >
          <Zap className={`w-3.5 h-3.5 ${
            memoryPressureLevel === 'critical'
              ? 'text-rose-400'
              : memoryPressureLevel === 'moderate'
              ? 'text-amber-400'
              : 'text-emerald-400'
          }`} />
          <span className="font-mono text-[11px] font-normal text-neutral-200">
            {browserRamMb !== undefined && browserRamMb > 0 ? browserRamMb : '...'} MB
          </span>
          <span className="hidden xl:inline text-[10px] text-neutral-400 font-mono">
            / {systemRamMb && systemRamMb > 0 ? Math.round(systemRamMb / 1024) : 16}GB
          </span>
        </button>

        {/* Downloads Button */}
        <button
          id="btn-open-downloads"
          type="button"
          onClick={onOpenDownloads}
          className="relative w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
          title={t('nav.downloadsTooltip')}
        >
          <Download className="w-4 h-4" />
          {downloadsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
              {downloadsCount}
            </span>
          )}
        </button>

        {/* Developer Tools Toggle */}
        <button
          id="btn-toggle-devtools"
          type="button"
          onClick={onToggleDevTools}
          className={`w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] transition-all active:scale-95 ${
            isDevToolsOpen
              ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
          }`}
          title={t('nav.devToolsTooltip')}
        >
          <Terminal className="w-4 h-4" />
        </button>

        {/* Browser Main Menu */}
        <div className="relative">
          <button
            id="btn-main-menu"
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all border border-white/[0.06]"
            title={t('nav.mainMenu')}
          >
            <Menu className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className={`absolute ${dock === 'left' ? 'left-0' : 'right-0'} ${popUp ? 'bottom-9' : 'top-9'} w-72 max-h-[calc(100vh-80px)] overflow-y-auto p-1.5 rounded-[var(--fb-radius-lg)] bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-[var(--fb-shadow-pop)] z-50 text-xs text-neutral-200 animate-fade-in`}>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onHome();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
              >
                <span>{t('nav.newTab')}</span>
                <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Ctrl+T</span>
              </button>

              {onNewPrivateTab && (
                <button
                  id="menu-new-private-tab"
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onNewPrivateTab();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <VenetianMask className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{t('incognito.newTab')}</span>
                  </span>
                  <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Ctrl+Shift+N</span>
                </button>
              )}

              {/* History Item */}
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenHistory();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{t('nav.history')}</span>
                  </div>
                  <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Ctrl+H</span>
                </button>
              )}

              {/* Bookmarks Item */}
              {onOpenBookmarks && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenBookmarks();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookmarkIcon className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{t('nav.bookmarksManager')}</span>
                  </div>
                  <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Ctrl+D</span>
                </button>
              )}

              {/* Find in Page Item */}
              {onToggleFind && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onToggleFind();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{t('nav.findInPage')}</span>
                  </div>
                  <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Ctrl+F</span>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.06]" />

              {onToggleSplitView && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onToggleSplitView();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Columns2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{t('nav.splitView')}</span>
                  </div>
                  <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">{isSplitView ? t('nav.splitViewActive') : t('nav.splitViewOff')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onNavigate('freedom://memory');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t('frc.menuItem')}</span>
                </div>
                <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">RAM Control</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenTaskManager();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t('nav.taskManager')}</span>
                </div>
                <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Shift+Esc</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenDownloads();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t('nav.downloads')}</span>
                </div>
                <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">Ctrl+J</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onToggleDevTools();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t('nav.devTools')}</span>
                </div>
                <span className="ml-3 shrink-0 whitespace-nowrap text-[10px] font-mono text-neutral-500">F12</span>
              </button>

              {privacyToggles && privacyToggles.length > 0 && (
                <>
                  <div className="my-1 border-t border-white/[0.06]" />
                  {privacyToggles.map((toggle) => (
                    <label
                      key={toggle.key}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] flex items-center justify-between gap-3 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <toggle.icon className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{toggle.label}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={toggle.value}
                        onChange={() => onTogglePrivacy?.(toggle.key)}
                      />
                    </label>
                  ))}
                </>
              )}

              <div className="my-1 border-t border-white/[0.06]" />

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenSettings();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white transition-colors"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('nav.settings')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenAbout();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-200 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{t('nav.about')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
