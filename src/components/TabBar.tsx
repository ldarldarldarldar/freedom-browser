import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  VenetianMask,
  Plus,
  X,
  Globe,
  Moon,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowUpDown,
  Cpu,
  Copy,
  ArrowDownAZ,
  Check,
  Columns2,
} from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { tauriBridge } from '../services/tauriBridge';
import { WindowControls } from './WindowControls';
import { TabSortService, TabSortMode } from '../services/tabSortService';
import { SplitViewState } from '../services/splitViewService';
import { useTranslation } from '../i18n';
import { FreedomMark } from './FreedomLogo';
import { FaviconService } from '../services/faviconService';

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDuplicateTab?: (id: string) => void;
  onToggleMuteTab?: (id: string) => void;
  headerColorClass?: string;
  onRestoreClosedTab?: () => void;
  closedTabsCount?: number;
  onSortTabs?: (mode: TabSortMode) => void;
  activeSortMode?: TabSortMode | 'none';
  onReloadTab?: (id: string) => void;
  onSuspendTab?: (id: string) => void;
  onSuspendTabs?: (tabIds: string[]) => void;
  onCloseTabsFromSite?: (hostname: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  splitViewState?: SplitViewState;
  onOpenInSplitView?: (tabId: string) => void;
  onCloseWindow?: () => void;
}

interface ContextMenuState {
  tab: BrowserTab;
  x: number;
  y: number;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onDuplicateTab,
  onToggleMuteTab,
  headerColorClass = 'bg-[var(--fb-bg)]',
  onRestoreClosedTab,
  closedTabsCount = 0,
  onSortTabs,
  activeSortMode = 'none',
  onReloadTab,
  onSuspendTab,
  onSuspendTabs,
  onCloseTabsFromSite,
  onCloseOtherTabs,
  onCloseTabsToRight,
  splitViewState,
  onOpenInSplitView,
  onCloseWindow,
}) => {
  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close menus on Escape or window blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSortMenu(false);
        setContextMenu(null);
      }
    };

    const handleWindowBlur = () => {
      setShowSortMenu(false);
      setContextMenu(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Tab context menu actions helper
  const contextDomain = contextMenu ? TabSortService.extractHostname(contextMenu.tab.url) : '';
  const domainTabs = useMemo(() => {
    if (!contextDomain) return [];
    return tabs.filter(
      (t) => TabSortService.extractHostname(t.url).toLowerCase() === contextDomain.toLowerCase()
    );
  }, [tabs, contextDomain]);

  const handleSortButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Immediately execute "Group by Site" (the initial/default sorting mode) so the operation is visibly performed
    onSortTabs?.('site');

    // Toggle the full sort options menu positioned right under the button via portal
    if (showSortMenu) {
      setShowSortMenu(false);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 230;
      setSortMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      });
      setShowSortMenu(true);
    }
  };

  return (
    <div
      id="browser-tab-bar"
      className={`flex items-center h-[var(--fb-tabbar-h)] pl-3 select-none relative z-40 bg-[var(--fb-chrome)] overflow-x-auto no-scrollbar app-drag-region`}
      onDoubleClick={(e) => {
        if (
          (e.target as HTMLElement).id === 'browser-tab-bar' ||
          (e.target as HTMLElement).id === 'tab-bar-empty-area'
        ) {
          tauriBridge.maximizeWindow();
        }
      }}
    >
      <FreedomMark size={18} className="mr-3 text-[var(--fb-text)]" />
      <div className="flex items-center flex-1 min-w-0 max-w-full space-x-1 py-1">
        {tabs.map((tab, index) => {
          const splitPaneIndex = splitViewState?.enabled
            ? splitViewState.panes.findIndex((p) => p.tabId === tab.id)
            : -1;
          const isInSplit = splitPaneIndex !== -1;
          const isActive = tab.id === activeTabId;
          const domain = TabSortService.extractHostname(tab.url);
          const prevDomain = index > 0 ? TabSortService.extractHostname(tabs[index - 1].url) : null;
          const isDomainBoundary = index > 0 && prevDomain !== domain;
          const domainColor = TabSortService.getDomainColor(domain);
          const isNewTab = tab.url === 'freedom://newtab';
          const displayTitle = isNewTab ? t('tab.newTab') : (tab.title || (tab.url.startsWith('freedom://') ? 'Freedom Tab' : tab.url));

          return (
            <React.Fragment key={tab.id}>
              {/* Vertical Separator between distinct domain groups */}
              {isDomainBoundary && (
                <div
                  className="w-[1px] h-4 mx-1 bg-white/15 shrink-0 self-center rounded-full pointer-events-none"
                  title={`Group: ${domain}`}
                />
              )}

              <div
                id={`tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                onAuxClick={(e) => {
                  // Middle click to close tab
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Clamp menu coordinate within window boundaries
                  const menuWidth = 240;
                  const menuHeight = 320;
                  const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8));
                  const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8));
                  setContextMenu({ tab, x, y });
                }}
                title={`${tab.isPrivate ? `[${t('incognito.badge')}] ` : ''}${displayTitle} (${tab.url})${tab.isSuspended ? ' - Suspended to save RAM' : ''}${isInSplit ? ` [Split: Pane ${splitPaneIndex + 1}]` : ''}`}
                className={`group relative flex items-center h-7 px-2.5 rounded-[var(--fb-radius-md)] text-xs transition-colors duration-150 cursor-pointer min-w-[110px] max-w-[210px] flex-1 overflow-hidden app-no-drag select-none ${tab.isPrivate ? 'outline outline-1 outline-dashed outline-[var(--fb-border-strong)] -outline-offset-1 ' : ''}${
                  isActive
                    ? 'bg-[var(--fb-surface-hover)] text-[var(--fb-text)] border border-[var(--fb-border)] font-medium'
                    : isInSplit
                    ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/50'
                    : 'bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                {/* Active Tab Accent Bar */}
                {isActive && tab.isLoading && (
                  <div className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-emerald-400/70 rounded-full" />
                )}

                {/* Split Indicator Badge */}
                {isInSplit && (
                  <span
                    className="mr-1.5 px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0"
                    title={t('split.pane', { index: splitPaneIndex + 1 })}
                  >
                    P{splitPaneIndex + 1}
                  </span>
                )}

                {/* Favicon Container with FRC Status Dot */}
                <div className="relative mr-2 shrink-0 flex items-center justify-center w-4 h-4">
                  {tab.isPrivate && !tab.isLoading ? (
                    <VenetianMask className="w-3.5 h-3.5 text-[var(--fb-text)]" aria-label={t('incognito.badge')} />
                  ) : tab.isLoading ? (
                    <div className="tab-loading-spinner shrink-0" title={t('tab.loading')} />
                  ) : tab.url.startsWith('freedom://') ? (
                    <FreedomMark size={13} className="text-[var(--fb-text-2)]" />
                  ) : tab.favicon ? (
                    <img
                      src={tab.favicon}
                      alt=""
                      className={`w-3.5 h-3.5 rounded-sm object-contain transition-opacity ${
                        tab.isSuspended || tab.lifecycleState === 'hibernated' || tab.lifecycleState === 'frozen'
                          ? 'opacity-60'
                          : 'opacity-100'
                      }`}
                      onError={(e) => {
                        // Missing/broken favicon: fall back to a monogram instead of an empty gap
                        const img = e.currentTarget;
                        if (img.dataset.fallback) return;
                        img.dataset.fallback = '1';
                        img.src = FaviconService.generateMonogramSvg(tab.title || domain);
                      }}
                    />
                  ) : (
                    <Globe
                      className={`w-3.5 h-3.5 text-neutral-500 ${
                        tab.isSuspended || tab.lifecycleState === 'hibernated' || tab.lifecycleState === 'frozen'
                          ? 'opacity-60'
                          : ''
                      }`}
                    />
                  )}

                  {/* FRC Subtle Status Dot Cue */}
                  {(tab.isSuspended || tab.lifecycleState === 'hibernated' || tab.lifecycleState === 'frozen') ? (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400 ring-1 ring-[var(--fb-chrome)] shadow-[0_0_5px_rgba(56,189,248,0.9)]"
                      title={tab.lifecycleState === 'frozen' ? t('frc.frozenTabTooltip') : t('frc.hibernatedTabTooltip')}
                    />
                  ) : tab.lifecycleState === 'throttled' ? (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-[var(--fb-chrome)]"
                      title={t('frc.throttledTabTooltip')}
                    />
                  ) : null}
                </div>

                {/* Title */}
                <span
                  className={`truncate flex-1 font-normal tracking-tight text-xs ${
                    isActive ? 'text-white font-medium' : 'text-neutral-300'
                  } ${
                    tab.isSuspended || tab.lifecycleState === 'hibernated' || tab.lifecycleState === 'frozen'
                      ? 'opacity-60 italic'
                      : ''
                  }`}
                >
                  {displayTitle}
                </span>

                {/* Audio Indicator if active */}
                {tab.isAudioPlaying && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMuteTab?.(tab.id);
                    }}
                    className="mr-1 p-0.5 text-emerald-400 hover:text-white rounded app-no-drag transition-colors"
                    title={tab.isMuted ? t('tab.unmute') : t('tab.mute')}
                  >
                    {tab.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                )}

                {/* Close Tab Button */}
                <button
                  id={`tab-close-${tab.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={`w-4.5 h-4.5 rounded flex items-center justify-center ml-1 transition-all app-no-drag ${
                    isActive
                      ? 'text-neutral-400 hover:text-white hover:bg-white/15'
                      : 'opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-white hover:bg-white/15'
                  }`}
                  title={t('tab.close')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </React.Fragment>
          );
        })}

        {/* New Tab "+" Button */}
        <button
          id="btn-new-tab"
          type="button"
          onClick={onNewTab}
          className="flex items-center justify-center w-7 h-7 ml-1 rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all app-no-drag shrink-0"
          title={t('tab.addNewTab')}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Restore Recently Closed Tab Button */}
        {onRestoreClosedTab && closedTabsCount > 0 && (
          <button
            id="btn-restore-closed-tab"
            type="button"
            onClick={onRestoreClosedTab}
            className="flex items-center justify-center w-7 h-7 ml-1 rounded-[var(--fb-radius-sm)] text-neutral-400 hover:text-emerald-400 hover:bg-white/[0.08] active:scale-95 transition-all app-no-drag shrink-0"
            title={t('tab.restoreClosed', { count: closedTabsCount })}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Tab Sort & Group Button */}
        {onSortTabs && (
          <div className="relative shrink-0 app-no-drag">
            <button
              ref={sortButtonRef}
              id="btn-tab-sort"
              type="button"
              onClick={handleSortButtonClick}
              className={`flex items-center justify-center w-7 h-7 ml-1 rounded-[var(--fb-radius-sm)] transition-all app-no-drag cursor-pointer border ${
                showSortMenu || activeSortMode !== 'none'
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.08] border-transparent active:scale-95'
              }`}
              title={t('sort.buttonTooltip')}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Empty space for dragging / double clicking */}
        <div id="tab-bar-empty-area" className="flex-1 h-full cursor-default app-drag-region" />
      </div>

      {/* Top-Right Frameless Window Controls */}
      <WindowControls onClose={onCloseWindow} />

      {/* Top-Level Tab Sort Menu Portal (Rendered into document.body to avoid overflow clipping) */}
      {showSortMenu &&
        createPortal(
          <div
            id="tab-sort-menu-backdrop"
            className="fixed inset-0 z-[99998] bg-transparent app-no-drag pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSortMenu(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSortMenu(false);
            }}
          >
            <div
              style={{ top: sortMenuPos.top, left: sortMenuPos.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="fixed z-[99999] w-52 bg-neutral-900/95 border border-white/10 rounded-xl shadow-2xl p-1 text-xs text-neutral-200 backdrop-blur-xl animate-fade-in app-no-drag pointer-events-auto select-none"
            >
              <div className="px-2.5 py-1 font-medium text-[10px] uppercase tracking-wider text-neutral-500">
                {t('tabBar.organization')}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSortMenu(false);
                  onSortTabs?.('site');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-medium text-xs">{t('sort.groupBySiteDefault')}</span>
                </div>
                {activeSortMode === 'site' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSortMenu(false);
                  onSortTabs?.('ram');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs">{t('sort.byRam')}</span>
                </div>
                {activeSortMode === 'ram' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSortMenu(false);
                  onSortTabs?.('duplicates');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs">{t('sort.groupDuplicates')}</span>
                </div>
                {activeSortMode === 'duplicates' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSortMenu(false);
                  onSortTabs?.('title');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center justify-between text-neutral-300 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs">{t('sort.byTitle')}</span>
                </div>
                {activeSortMode === 'title' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Top-Level Context Menu Portal (Direct in document.body to break free from all parent stacking contexts & drag regions) */}
      {contextMenu &&
        createPortal(
          <div
            id="tab-context-menu-backdrop"
            className="fixed inset-0 z-[99998] bg-transparent app-no-drag pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
          >
            <div
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="fixed z-[99999] w-56 bg-neutral-900/95 border border-white/10 rounded-xl shadow-2xl p-1 text-xs text-neutral-200 backdrop-blur-xl animate-fade-in app-no-drag pointer-events-auto select-none"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetTab = contextMenu.tab;
                  setContextMenu(null);
                  onReloadTab?.(targetTab.id);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 app-no-drag cursor-pointer transition-colors text-neutral-300 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('tabMenu.reload')}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetTab = contextMenu.tab;
                  setContextMenu(null);
                  onDuplicateTab?.(targetTab.id);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 app-no-drag cursor-pointer transition-colors text-neutral-300 hover:text-white"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('tabMenu.duplicate')}</span>
              </button>

              {onOpenInSplitView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetTab = contextMenu.tab;
                    setContextMenu(null);
                    onOpenInSplitView(targetTab.id);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 app-no-drag cursor-pointer transition-colors text-emerald-400 hover:text-emerald-300"
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span>{t('tabMenu.openInSplit')}</span>
                </button>
              )}

              {!contextMenu.tab.url.startsWith('freedom://') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetTab = contextMenu.tab;
                    setContextMenu(null);
                    onSuspendTab?.(targetTab.id);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <Moon className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('tabBar.sleepTab')}</span>
                </button>
              )}

              {/* Group Actions if multiple tabs from this site */}
              {domainTabs.length > 1 && (
                <>
                  <div className="my-1 border-t border-white/[0.06]" />
                  <div className="px-2.5 py-0.5 text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                    {t('tabBar.groupSite', { domain: contextDomain, count: domainTabs.length })}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const ids = domainTabs.map((t) => t.id);
                      setContextMenu(null);
                      onSuspendTabs?.(ids);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                  >
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('tabBar.sleepSite', { count: domainTabs.length })}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const domainToClose = contextDomain;
                      setContextMenu(null);
                      onCloseTabsFromSite?.(domainToClose);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-rose-500/15 text-rose-300 hover:text-rose-200 flex items-center gap-2 app-no-drag cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>{t('tabBar.closeSite', { count: domainTabs.length })}</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-white/[0.06]" />

              {onCloseOtherTabs && tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = contextMenu.tab.id;
                    setContextMenu(null);
                    onCloseOtherTabs(targetId);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <span>{t('tabMenu.closeOthers')}</span>
                </button>
              )}

              {onCloseTabsToRight && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = contextMenu.tab.id;
                    setContextMenu(null);
                    onCloseTabsToRight(targetId);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <span>{t('tabMenu.closeRight')}</span>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.06]" />

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetId = contextMenu.tab.id;
                  setContextMenu(null);
                  onCloseTab(targetId);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-rose-500/15 text-rose-300 hover:text-rose-200 flex items-center justify-between app-no-drag cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('tabMenu.closeTab')}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Ctrl+W</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
