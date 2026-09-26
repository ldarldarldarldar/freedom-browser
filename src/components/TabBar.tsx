import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  Globe,
  Moon,
  Volume2,
  VolumeX,
  ShieldCheck,
  RotateCcw,
  ArrowUpDown,
  Cpu,
  Copy,
  ArrowDownAZ,
  Check,
} from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { tauriBridge } from '../services/tauriBridge';
import { WindowControls } from './WindowControls';
import { TabSortService, TabSortMode } from '../services/tabSortService';

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
  headerColorClass = 'bg-[#090b10]',
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
}) => {
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
      className={`flex items-center h-10 px-2 select-none border-b border-white/5 relative z-40 ${headerColorClass} overflow-x-auto no-scrollbar app-drag-region`}
      onDoubleClick={(e) => {
        if (
          (e.target as HTMLElement).id === 'browser-tab-bar' ||
          (e.target as HTMLElement).id === 'tab-bar-empty-area'
        ) {
          tauriBridge.maximizeWindow();
        }
      }}
    >
      <div className="flex items-center flex-1 min-w-0 max-w-full space-x-1">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const domain = TabSortService.extractHostname(tab.url);
          const prevDomain = index > 0 ? TabSortService.extractHostname(tabs[index - 1].url) : null;
          const isDomainBoundary = index > 0 && prevDomain !== domain;
          const domainColor = TabSortService.getDomainColor(domain);

          return (
            <React.Fragment key={tab.id}>
              {/* Vertical Separator between distinct domain groups */}
              {isDomainBoundary && (
                <div
                  className="w-[1px] h-4 mx-0.5 bg-white/15 shrink-0 self-center rounded-full pointer-events-none"
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
                title={`${tab.title} (${tab.url})${tab.isSuspended ? ' - Suspended to save RAM' : ''}`}
                className={`group relative flex items-center h-8 px-3 rounded-lg text-xs transition-all duration-150 cursor-pointer min-w-[120px] max-w-[220px] flex-1 border app-no-drag ${
                  isActive
                    ? 'bg-neutral-900/90 text-white border-white/10 shadow-sm'
                    : 'bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-transparent'
                }`}
              >
                {/* Active Tab Accent Line */}
                {isActive && (
                  <div className="absolute top-0 left-2 right-2 h-[2px] bg-emerald-400 rounded-full" />
                )}

                {/* Subtle Domain Tint Accent at Bottom */}
                <div
                  className={`absolute bottom-0 left-2 right-2 h-[1.5px] rounded-full transition-opacity ${
                    isActive ? 'opacity-80' : 'opacity-30 group-hover:opacity-60'
                  }`}
                  style={{ backgroundColor: domainColor }}
                />

                {/* Favicon or Loading Spinner */}
                <div className="mr-2 shrink-0 flex items-center">
                  {tab.isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  ) : tab.isSuspended ? (
                    <Moon className="w-3.5 h-3.5 text-neutral-500" title="Tab Suspended (RAM Freed)" />
                  ) : tab.favicon ? (
                    <img
                      src={tab.favicon}
                      alt=""
                      className="w-3.5 h-3.5 rounded-sm object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : tab.url.startsWith('freedom://') ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </div>

                {/* Title (No visible dup badge) */}
                <span className={`truncate flex-1 font-medium ${tab.isSuspended ? 'opacity-60 italic' : ''}`}>
                  {tab.title || (tab.url.startsWith('freedom://') ? 'Freedom Tab' : tab.url)}
                </span>

                {/* Audio Indicator if active */}
                {tab.isAudioPlaying && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMuteTab?.(tab.id);
                    }}
                    className="mr-1 p-0.5 text-emerald-400 hover:text-white rounded app-no-drag"
                    title={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
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
                  className={`p-1 rounded-md ml-1 transition-all app-no-drag ${
                    isActive
                      ? 'opacity-70 hover:opacity-100 hover:bg-white/10 text-neutral-300 hover:text-white'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-400 hover:text-white'
                  }`}
                  title="Close tab (Ctrl+W)"
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
          className="flex items-center justify-center w-7 h-7 ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all app-no-drag shrink-0"
          title="New tab (Ctrl+T)"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Restore Recently Closed Tab Button */}
        {onRestoreClosedTab && closedTabsCount > 0 && (
          <button
            id="btn-restore-closed-tab"
            type="button"
            onClick={onRestoreClosedTab}
            className="flex items-center justify-center w-7 h-7 ml-0.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-white/5 active:scale-95 transition-all app-no-drag shrink-0"
            title={`Restore closed tab (Ctrl+Shift+T) - ${closedTabsCount} available`}
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
              className={`flex items-center justify-center w-7 h-7 ml-0.5 rounded-lg transition-all app-no-drag cursor-pointer ${
                showSortMenu || activeSortMode !== 'none'
                  ? 'text-emerald-400 bg-white/10'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95'
              }`}
              title="Group by Site (Click to sort / choose mode)"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Empty space for dragging / double clicking */}
        <div id="tab-bar-empty-area" className="flex-1 h-full cursor-default app-drag-region" />
      </div>

      {/* Top-Right Frameless Window Controls */}
      <WindowControls />

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
              className="fixed z-[99999] w-56 bg-neutral-900/98 border border-white/15 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] py-1.5 text-xs text-neutral-200 backdrop-blur-xl animate-fade-in app-no-drag pointer-events-auto select-none"
            >
              <div className="px-3 py-1 font-semibold text-[10px] uppercase tracking-wider text-neutral-500">
                Tab Organization
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSortMenu(false);
                  onSortTabs?.('site');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between text-neutral-200 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-medium">Group by Site (Default)</span>
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
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between text-neutral-200 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sort by RAM Usage</span>
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
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between text-neutral-200 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Group Duplicates</span>
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
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between text-neutral-200 hover:text-white cursor-pointer app-no-drag transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sort by Title (A-Z)</span>
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
              className="fixed z-[99999] w-60 bg-neutral-900/98 border border-white/15 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] py-1.5 text-xs text-neutral-200 backdrop-blur-xl animate-fade-in app-no-drag pointer-events-auto select-none"
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
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 app-no-drag cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Reload Tab</span>
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
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 app-no-drag cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Duplicate Tab</span>
              </button>

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
                  className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <Moon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sleep Tab (Free RAM)</span>
                </button>
              )}

              {/* Group Actions if multiple tabs from this site */}
              {domainTabs.length > 1 && (
                <>
                  <div className="my-1 border-t border-white/10" />
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                    Group ({contextDomain} &bull; {domainTabs.length})
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
                    className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                  >
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sleep all tabs from this site ({domainTabs.length})</span>
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
                    className="w-full px-3 py-1.5 text-left hover:bg-rose-500/20 text-rose-300 flex items-center gap-2 app-no-drag cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>Close all tabs from this site ({domainTabs.length})</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-white/10" />

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
                  className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <span>Close Other Tabs</span>
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
                  className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <span>Close Tabs to the Right</span>
                </button>
              )}

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetId = contextMenu.tab.id;
                  setContextMenu(null);
                  onCloseTab(targetId);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-rose-500/20 text-rose-300 flex items-center justify-between app-no-drag cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>Close Tab</span>
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
