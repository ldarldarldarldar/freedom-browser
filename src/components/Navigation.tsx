import React, { useState, useEffect, useRef } from 'react';
import {
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
  headerColorClass = 'bg-[#0b0e14]',
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
}) => {
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
      className={`flex items-center h-11 px-3 space-x-2 border-b border-white/5 select-none relative z-30 ${headerColorClass} app-drag-region`}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'browser-nav-toolbar') {
          tauriBridge.maximizeWindow();
        }
      }}
    >
      {/* Navigation History Controls */}
      <div className="flex items-center space-x-1 app-no-drag">
        <button
          id="nav-btn-back"
          type="button"
          onClick={onBack}
          disabled={!currentTab?.canGoBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent active:scale-95 transition-all"
          title={t('nav.back')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          id="nav-btn-forward"
          type="button"
          onClick={onForward}
          disabled={!currentTab?.canGoForward}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent active:scale-95 transition-all"
          title={t('nav.forward')}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          id="nav-btn-reload"
          type="button"
          onClick={currentTab?.isLoading ? onStop : onReload}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
          title={currentTab?.isLoading ? t('nav.stop') : t('nav.reload')}
        >
          {currentTab?.isLoading ? <X className="w-4 h-4 text-emerald-400" /> : <RotateCcw className="w-4 h-4" />}
        </button>
        <button
          id="nav-btn-home"
          type="button"
          onClick={onHome}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
          title={t('nav.home')}
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* Omni Address & Search Bar */}
      <div className="flex-1 relative app-no-drag">
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className={`flex items-center w-full h-8 px-3 rounded-xl border transition-all duration-150 ${
              isFocused
                ? 'bg-neutral-900 border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.18)]'
                : 'bg-neutral-950/60 hover:bg-neutral-900/60 border-white/10'
            }`}
          >
            {/* Security Indicator */}
            <button
              type="button"
              onClick={() => setShowSecurityDetails(!showSecurityDetails)}
              className="mr-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
              title={
                currentTab?.url.startsWith('freedom://')
                  ? t('nav.securityInternal')
                  : isSecure
                  ? t('nav.securitySecure')
                  : t('nav.securityInsecure')
              }
            >
              {currentTab?.url.startsWith('freedom://') ? (
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
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
              placeholder={
                activeEngine?.name
                  ? t('nav.searchPlaceholder', { engine: activeEngine.name })
                  : t('nav.searchPlaceholderEmpty')
              }
              className="w-full bg-transparent text-xs text-neutral-200 focus:outline-none placeholder-neutral-500"
              spellCheck={false}
              autoComplete="off"
            />

            {/* Zoom Indicator Badge (shown when not 100%) */}
            {zoomLevel !== 100 && onResetZoom && (
              <button
                type="button"
                onClick={onResetZoom}
                title={t('nav.zoomBadge', { zoom: zoomLevel })}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-neutral-800 hover:bg-neutral-700 transition-colors shrink-0"
              >
                {zoomLevel}%
              </button>
            )}

            {/* Quick action button inside omnibar */}
            {inputValue && (
              <button
                type="button"
                onClick={() => setInputValue('')}
                className="p-0.5 text-neutral-500 hover:text-neutral-200 transition-colors"
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
                    : 'text-neutral-500 hover:text-neutral-200'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                    isBookmarked ? 'fill-emerald-400 text-emerald-400' : ''
                  }`}
                />
              </button>
            )}

            <div className="ml-2 pl-2 border-l border-white/10 flex items-center text-[11px] text-neutral-400 shrink-0">
              <span className="opacity-70 mr-1">{activeEngine.icon}</span>
              <span className="hidden md:inline text-[10px] text-neutral-500 font-mono">
                {activeEngine.name}
              </span>
            </div>
          </div>
        </form>

        {/* Security / Privacy details popup */}
        {showSecurityDetails && (
          <div className="absolute top-10 left-0 w-80 p-3 rounded-xl bg-neutral-900 border border-emerald-500/30 shadow-2xl z-50 text-xs text-neutral-200">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">{t('nav.guardTitle')}</span>
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
      <div className="flex items-center space-x-1 shrink-0 app-no-drag" ref={menuRef}>
        {/* Split View Toggle Button */}
        {onToggleSplitView && (
          <button
            id="btn-toggle-split-view"
            type="button"
            onClick={onToggleSplitView}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all ${
              isSplitView
                ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
            title={t('nav.historyTooltip')}
          >
            <HistoryIcon className="w-4 h-4" />
          </button>
        )}

        {/* Task Manager Button */}
        <button
          id="btn-open-task-manager"
          type="button"
          onClick={onOpenTaskManager}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/10 active:scale-95 transition-all"
          title={t('nav.taskManagerTooltip')}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline text-[11px] font-medium">{t('nav.taskManagerShort')}</span>
        </button>

        {/* Downloads Button */}
        <button
          id="btn-open-downloads"
          type="button"
          onClick={onOpenDownloads}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
          title={t('nav.downloadsTooltip')}
        >
          <Download className="w-4 h-4" />
          {downloadsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow">
              {downloadsCount}
            </span>
          )}
        </button>

        {/* Developer Tools Toggle */}
        <button
          id="btn-toggle-devtools"
          type="button"
          onClick={onToggleDevTools}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 ${
            isDevToolsOpen
              ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
            title={t('nav.mainMenu')}
          >
            <Menu className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-64 py-1.5 rounded-xl bg-neutral-900/98 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-50 text-xs text-neutral-200 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onHome();
                }}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
              >
                <span>{t('nav.newTab')}</span>
                <span className="text-[10px] font-mono text-neutral-500">Ctrl+T</span>
              </button>

              {/* History Item */}
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenHistory();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('nav.history')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">Ctrl+H</span>
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
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <BookmarkIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('nav.bookmarksManager')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">Ctrl+D</span>
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
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('nav.findInPage')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">Ctrl+F</span>
                </button>
              )}

              {/* Zoom Controls inside Menu */}
              <div className="my-1 border-t border-white/5" />
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-neutral-300">{t('nav.zoom')}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onZoomOut}
                    title={t('nav.zoomOut')}
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={onResetZoom}
                    title={t('nav.resetZoom')}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 font-mono text-[11px] text-emerald-400 min-w-10 text-center transition-colors"
                  >
                    {zoomLevel}%
                  </button>
                  <button
                    type="button"
                    onClick={onZoomIn}
                    title={t('nav.zoomIn')}
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Tab Sorting Options */}
              {onSortTabs && (
                <>
                  <div className="my-1 border-t border-white/5" />
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {t('sort.title')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onSortTabs('site');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-200 hover:text-white"
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t('sort.groupBySite')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onSortTabs('ram');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-200 hover:text-white"
                  >
                    <Cpu className="w-3.5 h-3.5 text-rose-400" />
                    <span>{t('sort.byRam')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onSortTabs('duplicates');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-200 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('sort.groupDuplicates')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onSortTabs('title');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-200 hover:text-white"
                  >
                    <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('sort.byTitle')}</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-white/5" />

              {onToggleSplitView && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onToggleSplitView();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Columns2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('nav.splitView')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">{isSplitView ? t('nav.splitViewActive') : t('nav.splitViewOff')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenTaskManager();
                }}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('nav.taskManager')}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Shift+Esc</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenDownloads();
                }}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('nav.downloads')}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Ctrl+J</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onToggleDevTools();
                }}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('nav.devTools')}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">F12</span>
              </button>

              <div className="my-1 border-t border-white/5" />

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2"
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
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-emerald-400"
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
