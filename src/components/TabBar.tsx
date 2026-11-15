import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
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
  PictureInPicture2,
  FolderPlus,
  FolderInput,
  FolderMinus,
  Ungroup,
  ChevronRight,
} from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { tauriBridge } from '../services/tauriBridge';
import { WindowControls } from './WindowControls';
import { TabSortService, TabSortMode } from '../services/tabSortService';
import { SplitViewState } from '../services/splitViewService';
import { useTranslation } from '../i18n';
import { FreedomMark } from './FreedomLogo';
import { FaviconService } from '../services/faviconService';
import { SearchEngineService } from '../services/searchEngineService';
import { usePanel } from '../hooks/usePanel';
import { TabGroup, GROUP_COLORS, GROUP_COLOR_HEX } from '../services/tabGroupService';

const TAB_DRAG_TYPE = 'application/x-freedom-tab';
const GROUP_DRAG_TYPE = 'application/x-freedom-group';
type DropSide = 'before' | 'after';

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDuplicateTab?: (id: string) => void;
  onToggleMuteTab?: (id: string) => void;
  /** Picture in picture for the tab's playing (or largest) video */
  onPictureInPicture?: (id: string) => void;
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
  /** Link or text dragged from a page onto the tab strip: open it in a new tab (returns false if unusable) */
  onDropData?: (data: DataTransfer) => boolean;
  /** Tab groups (src/services/tabGroupService.ts) */
  groups?: TabGroup[];
  onCreateGroup?: (tabIds: string[]) => void;
  onAddToGroup?: (tabIds: string[], groupId: string) => void;
  onRemoveFromGroup?: (tabIds: string[]) => void;
  onUngroup?: (groupId: string) => void;
  onUpdateGroup?: (groupId: string, patch: Partial<Pick<TabGroup, 'title' | 'color'>>) => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onCloseGroup?: (groupId: string) => void;
  onNewTabInGroup?: (groupId: string) => void;
  onMoveTab?: (tabId: string, targetId: string, side: DropSide) => void;
  onMoveTabToGroup?: (tabId: string, groupId: string) => void;
  onMoveTabToEnd?: (tabId: string) => void;
  onMoveGroup?: (groupId: string, targetId: string, side: DropSide) => void;
}

interface ContextMenuState {
  tab: BrowserTab;
  /** The tabs the menu acts on: the selection when the clicked tab is part of it */
  targets: string[];
  x: number;
  y: number;
}

interface GroupMenuState {
  groupId: string;
  x: number;
  y: number;
  confirmClose?: boolean;
}

/** Keeps a fixed menu inside the window once its real size is known */
function useKeepInWindow(ref: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    const dx = Math.min(0, window.innerWidth - 8 - r.right);
    const dy = Math.min(0, window.innerHeight - 8 - r.bottom);
    if (dx || dy) el.style.transform = `translate(${Math.max(dx, 8 - r.left)}px, ${Math.max(dy, 8 - r.top)}px)`;
  }, deps);
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onDuplicateTab,
  onToggleMuteTab,
  onPictureInPicture,
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
  onDropData,
  groups = [],
  onCreateGroup,
  onAddToGroup,
  onRemoveFromGroup,
  onUngroup,
  onUpdateGroup,
  onToggleGroupCollapsed,
  onCloseGroup,
  onNewTabInGroup,
  onMoveTab,
  onMoveTabToGroup,
  onMoveTabToEnd,
  onMoveGroup,
}) => {
  const { t } = useTranslation();
  // Menus go through the panel manager: one menu or panel at a time, Esc and a click outside close it
  const [showSortMenu, setShowSortMenu] = usePanel('tabSortMenu');
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [contextMenuOpen, setContextMenuOpen] = usePanel('tabContextMenu');
  const [contextMenuData, setContextMenuData] = useState<ContextMenuState | null>(null);
  const contextMenu = contextMenuOpen ? contextMenuData : null;
  const setContextMenu = (menu: ContextMenuState | null) => {
    if (menu) setContextMenuData(menu);
    setContextMenuOpen(Boolean(menu));
  };
  const [groupMenuOpen, setGroupMenuOpen] = usePanel('groupContextMenu');
  const [groupMenuData, setGroupMenuData] = useState<GroupMenuState | null>(null);
  const groupMenu = groupMenuOpen ? groupMenuData : null;
  const openGroupMenu = (menu: GroupMenuState) => {
    setGroupMenuData(menu);
    setGroupMenuOpen(true);
  };
  const [showGroupList, setShowGroupList] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  useKeepInWindow(contextMenuRef, [contextMenu, showGroupList]);
  useKeepInWindow(groupMenuRef, [groupMenu]);

  // Several tabs chosen with Ctrl/Shift+click go to a group together
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionAnchor = useRef<string | null>(null);
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => tabs.some((tab) => tab.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [tabs]);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // A new group opens its menu so it can be named right away
  const knownGroupIds = useRef<Set<string>>(new Set(groups.map((g) => g.id)));
  const nameNewGroup = useRef(false);
  useEffect(() => {
    const fresh = groups.find((g) => !knownGroupIds.current.has(g.id));
    knownGroupIds.current = new Set(groups.map((g) => g.id));
    if (!fresh || !nameNewGroup.current) return;
    nameNewGroup.current = false;
    const header = document.getElementById(`tab-group-${fresh.id}`);
    const r = header?.getBoundingClientRect();
    openGroupMenu({ groupId: fresh.id, x: r ? r.left : 80, y: r ? r.bottom + 4 : 40 });
  }, [groups]);

  // Drag and drop of tabs and group headers inside the strip
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | { groupId: string } | { end: true } | null>(null);
  const isInternalDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(TAB_DRAG_TYPE) || e.dataTransfer.types.includes(GROUP_DRAG_TYPE);
  const dropSide = (e: React.DragEvent): DropSide => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? 'before' : 'after';
  };
  const handleTabDragOver = (e: React.DragEvent, tab: BrowserTab) => {
    if (!isInternalDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const side = dropSide(e);
    setDropTarget((prev) => (prev && 'id' in prev && prev.id === tab.id && prev.side === side ? prev : { id: tab.id, side }));
  };
  const handleTabDrop = (e: React.DragEvent, tab: BrowserTab) => {
    if (!isInternalDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const side = dropSide(e);
    const tabId = e.dataTransfer.getData(TAB_DRAG_TYPE);
    const groupId = e.dataTransfer.getData(GROUP_DRAG_TYPE);
    if (tabId) onMoveTab?.(tabId, tab.id, side);
    else if (groupId) onMoveGroup?.(groupId, tab.id, side);
    setDropTarget(null);
  };
  const handleHeaderDrop = (e: React.DragEvent, group: TabGroup) => {
    if (!isInternalDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const tabId = e.dataTransfer.getData(TAB_DRAG_TYPE);
    const groupId = e.dataTransfer.getData(GROUP_DRAG_TYPE);
    if (tabId) onMoveTabToGroup?.(tabId, group.id);
    else if (groupId && groupId !== group.id) {
      const first = tabs.find((tab) => tab.groupId === group.id);
      if (first) onMoveGroup?.(groupId, first.id, 'before');
    }
    setDropTarget(null);
  };
  const handleEndDrop = (e: React.DragEvent) => {
    if (!isInternalDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const tabId = e.dataTransfer.getData(TAB_DRAG_TYPE);
    const groupId = e.dataTransfer.getData(GROUP_DRAG_TYPE);
    const last = tabs[tabs.length - 1];
    if (tabId) onMoveTabToEnd?.(tabId);
    else if (groupId && last) onMoveGroup?.(groupId, last.id, 'after');
    setDropTarget(null);
  };

  const handleTabClick = (e: React.MouseEvent, tab: BrowserTab) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: add to or take out of the selection; the active tab counts as chosen
      setSelectedIds((prev) => {
        const base = prev.length ? prev : [activeTabId];
        return base.includes(tab.id) ? base.filter((id) => id !== tab.id) : [...base, tab.id];
      });
      selectionAnchor.current = tab.id;
      return;
    }
    if (e.shiftKey) {
      // Shift+click: everything from the last chosen (or active) tab to this one
      const visible = tabs.filter((x) => !(x.groupId && groupById.get(x.groupId)?.collapsed));
      const anchorId = selectionAnchor.current && visible.some((x) => x.id === selectionAnchor.current) ? selectionAnchor.current : activeTabId;
      const a = visible.findIndex((x) => x.id === anchorId);
      const b = visible.findIndex((x) => x.id === tab.id);
      if (a !== -1 && b !== -1) {
        setSelectedIds(visible.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id));
        return;
      }
    }
    setSelectedIds([]);
    selectionAnchor.current = tab.id;
    onSelectTab(tab.id);
  };

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
      onDragOver={(e) => {
        if (!onDropData || !SearchEngineService.isDroppableData(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'link';
      }}
      onDrop={(e) => {
        if (onDropData?.(e.dataTransfer)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
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
      <div className="flex items-center flex-1 min-w-0 max-w-full h-full space-x-1">
        {tabs.map((tab, index) => {
          const group = tab.groupId ? groupById.get(tab.groupId) : undefined;
          const groupColor = group ? GROUP_COLOR_HEX[group.color] : undefined;
          const startsGroup = Boolean(group) && (index === 0 || tabs[index - 1].groupId !== tab.groupId);
          const groupSize = startsGroup ? tabs.filter((x) => x.groupId === tab.groupId).length : 0;
          const groupHeader = group && startsGroup ? (
            <div
              id={`tab-group-${group.id}`}
              data-group-id={group.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(GROUP_DRAG_TYPE, group.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDropTarget(null)}
              onDragOver={(e) => {
                if (!isInternalDrag(e)) return;
                e.preventDefault();
                e.stopPropagation();
                setDropTarget((prev) => (prev && 'groupId' in prev && prev.groupId === group.id ? prev : { groupId: group.id }));
              }}
              onDrop={(e) => handleHeaderDrop(e, group)}
              onClick={() => onToggleGroupCollapsed?.(group.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openGroupMenu({ groupId: group.id, x: e.clientX, y: e.clientY });
              }}
              title={`${group.title || t('group.unnamed')} · ${t('group.tabsCount', { count: groupSize })}\n${t('group.collapseHint')}`}
              className="flex items-center h-full shrink-0 cursor-pointer app-no-drag select-none"
            >
              <span
                className={`flex items-center gap-1 h-5 max-w-[140px] rounded-full text-[11px] font-semibold transition-shadow ${group.title ? 'px-2' : 'px-1.5'} ${
                  dropTarget && 'groupId' in dropTarget && dropTarget.groupId === group.id ? 'ring-2 ring-white/60' : ''
                }`}
                style={{ backgroundColor: groupColor, color: '#0b0d12' }}
              >
                {group.title ? <span className="truncate">{group.title}</span> : <span className="w-2 h-2 rounded-full bg-[#0b0d12]/40" />}
                {group.collapsed && (
                  <span className="ml-0.5 px-1 rounded-full bg-black/20 text-[10px] font-mono">{groupSize}</span>
                )}
              </span>
            </div>
          ) : null;
          if (group?.collapsed) {
            return <React.Fragment key={tab.id}>{groupHeader}</React.Fragment>;
          }
          const isSelected = selectedIds.length > 1 && selectedIds.includes(tab.id);
          const dropHere = dropTarget && 'id' in dropTarget && dropTarget.id === tab.id ? dropTarget.side : null;
          const splitPaneIndex = splitViewState?.enabled
            ? splitViewState.panes.findIndex((p) => p.tabId === tab.id)
            : -1;
          const isInSplit = splitPaneIndex !== -1;
          const isActive = tab.id === activeTabId;
          const domain = TabSortService.extractHostname(tab.url);
          const prevDomain = index > 0 ? TabSortService.extractHostname(tabs[index - 1].url) : null;
          const isDomainBoundary = index > 0 && prevDomain !== domain && !tab.groupId && !tabs[index - 1].groupId;
          const domainColor = TabSortService.getDomainColor(domain);
          const isNewTab = tab.url === 'freedom://newtab';
          const displayTitle = isNewTab ? t('tab.newTab') : (tab.title || (tab.url.startsWith('freedom://') ? 'Freedom Tab' : tab.url));

          return (
            <React.Fragment key={tab.id}>
              {groupHeader}
              {/* Vertical Separator between distinct domain groups */}
              {isDomainBoundary && (
                <div
                  className="w-[1px] h-4 mx-1 bg-white/15 shrink-0 self-center rounded-full pointer-events-none"
                  title={`Group: ${domain}`}
                />
              )}

              <div
                id={`tab-${tab.id}`}
                data-group-id={tab.groupId}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TAB_DRAG_TYPE, tab.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDropTarget(null)}
                onDragOver={(e) => handleTabDragOver(e, tab)}
                onDrop={(e) => handleTabDrop(e, tab)}
                onClick={(e) => handleTabClick(e, tab)}
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
                  const targets = selectedIds.length > 1 && selectedIds.includes(tab.id)
                    ? tabs.filter((x) => selectedIds.includes(x.id)).map((x) => x.id)
                    : [tab.id];
                  if (targets.length === 1) setSelectedIds([]);
                  setShowGroupList(false);
                  setContextMenu({ tab, targets, x, y });
                }}
                title={`${tab.isPrivate ? `[${t('incognito.badge')}] ` : ''}${displayTitle} (${tab.url})${tab.isSuspended ? ' - Suspended to save RAM' : ''}${isInSplit ? ` [Split: Pane ${splitPaneIndex + 1}]` : ''}`}
                // The clickable area fills the strip's height: throw the pointer at the top edge of the screen and click
                className="group relative flex items-center h-full min-w-[110px] max-w-[210px] flex-1 cursor-pointer app-no-drag select-none"
              >
                {dropHere && (
                  <div
                    className={`absolute top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-400 pointer-events-none ${dropHere === 'before' ? '-left-[3px]' : '-right-[3px]'}`}
                  />
                )}
                <div
                  style={groupColor ? { boxShadow: `inset 0 -2px 0 ${groupColor}` } : undefined}
                  className={`relative flex items-center w-full h-7 px-2.5 rounded-[var(--fb-radius-md)] text-xs transition-colors duration-150 overflow-hidden ${isSelected ? 'ring-1 ring-emerald-400/60 bg-white/[0.06] ' : ''}${tab.isPrivate ? 'outline outline-1 outline-dashed outline-[var(--fb-border-strong)] -outline-offset-1 ' : ''}${
                    isActive
                      ? 'bg-[var(--fb-surface-hover)] text-[var(--fb-text)] border border-[var(--fb-border)] font-medium'
                      : 'bg-transparent text-neutral-400 group-hover:text-neutral-200 group-hover:bg-white/[0.05] border border-transparent'
                  }`}
                >
                {/* Active Tab Accent Bar */}
                {isActive && tab.isLoading && (
                  <div className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-emerald-400/70 rounded-full" />
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
                {(tab.isAudioPlaying || tab.isMuted) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMuteTab?.(tab.id);
                    }}
                    className={`mr-1 p-0.5 rounded app-no-drag transition-colors hover:text-white ${tab.isMuted ? 'text-neutral-500' : 'text-emerald-400'}`}
                    title={tab.isMuted ? t('tab.unmute') : t('tab.mute')}
                    aria-label={tab.isMuted ? t('tab.unmute') : t('tab.mute')}
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
              </div>
            </React.Fragment>
          );
        })}

        {/* New Tab "+" Button */}
        <button
          id="btn-new-tab"
          type="button"
          onClick={onNewTab}
          className="group flex items-center justify-center w-7 h-full ml-1 app-no-drag shrink-0 cursor-pointer"
          title={t('tab.addNewTab')}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-[var(--fb-radius-sm)] text-neutral-400 group-hover:text-white group-hover:bg-white/[0.08] group-active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
          </span>
        </button>

        {/* Restore Recently Closed Tab Button */}
        {onRestoreClosedTab && closedTabsCount > 0 && (
          <button
            id="btn-restore-closed-tab"
            type="button"
            onClick={onRestoreClosedTab}
            className="group flex items-center justify-center w-7 h-full ml-1 app-no-drag shrink-0 cursor-pointer"
            title={t('tab.restoreClosed', { count: closedTabsCount })}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-[var(--fb-radius-sm)] text-neutral-400 group-hover:text-emerald-400 group-hover:bg-white/[0.08] group-active:scale-95 transition-all">
              <RotateCcw className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {/* Tab Sort & Group Button */}
        {onSortTabs && (
          <div className="relative shrink-0 h-full app-no-drag">
            <button
              ref={sortButtonRef}
              id="btn-tab-sort"
              data-panel-toggle="tabSortMenu"
              type="button"
              onClick={handleSortButtonClick}
              className="group flex items-center justify-center w-7 h-full ml-1 app-no-drag cursor-pointer"
              title={t('sort.buttonTooltip')}
            >
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-[var(--fb-radius-sm)] transition-all border ${
                  showSortMenu || activeSortMode !== 'none'
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                    : 'text-neutral-400 group-hover:text-white group-hover:bg-white/[0.08] border-transparent group-active:scale-95'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        )}

        {/* Empty space for dragging / double clicking; a tab dropped here goes last, without a group */}
        <div
          id="tab-bar-empty-area"
          className={`flex-1 h-full cursor-default app-drag-region ${dropTarget && 'end' in dropTarget ? 'shadow-[inset_2px_0_0_rgb(52,211,153)]' : ''}`}
          onDragOver={(e) => {
            if (!isInternalDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            setDropTarget((prev) => (prev && 'end' in prev ? prev : { end: true }));
          }}
          onDrop={handleEndDrop}
        />
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
              data-panel="tabSortMenu"
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
              ref={contextMenuRef}
              id="tab-context-menu"
              data-panel="tabContextMenu"
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

              {!contextMenu.tab.url.startsWith('freedom://') && onToggleMuteTab && (
                <button
                  type="button"
                  id="tab-menu-mute"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetTab = contextMenu.tab;
                    setContextMenu(null);
                    onToggleMuteTab(targetTab.id);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  {contextMenu.tab.isMuted ? <Volume2 className="w-3.5 h-3.5 text-neutral-400" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>{contextMenu.tab.isMuted ? t('tabMenu.unmute') : t('tabMenu.mute')}</span>
                </button>
              )}

              {!contextMenu.tab.url.startsWith('freedom://') && !contextMenu.tab.isSuspended && onPictureInPicture && (
                <button
                  type="button"
                  id="tab-menu-pip"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetTab = contextMenu.tab;
                    setContextMenu(null);
                    onPictureInPicture(targetTab.id);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                >
                  <PictureInPicture2 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t('tabMenu.pictureInPicture')}</span>
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

              {/* Tab groups */}
              {onCreateGroup && (() => {
                const targets = contextMenu.targets;
                const targetTabs = tabs.filter((x) => targets.includes(x.id));
                const otherGroups = groups.filter((g) => !targetTabs.every((x) => x.groupId === g.id));
                const anyGrouped = targetTabs.some((x) => x.groupId);
                return (
                  <>
                    <div className="my-1 border-t border-white/[0.06]" />
                    <button
                      type="button"
                      id="tab-menu-new-group"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu(null);
                        setSelectedIds([]);
                        nameNewGroup.current = true;
                        onCreateGroup(targets);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{targets.length > 1 ? t('group.addToNewMany', { count: targets.length }) : t('group.addToNew')}</span>
                    </button>
                    {onAddToGroup && otherGroups.length > 0 && (
                      <>
                        <button
                          type="button"
                          id="tab-menu-add-to-group"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowGroupList((v) => !v);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                        >
                          <FolderInput className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="flex-1">{t('group.addTo')}</span>
                          <ChevronRight className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${showGroupList ? 'rotate-90' : ''}`} />
                        </button>
                        {showGroupList &&
                          otherGroups.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              data-add-to-group={g.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu(null);
                                setSelectedIds([]);
                                onAddToGroup(targets, g.id);
                              }}
                              className="w-full pl-7 pr-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLOR_HEX[g.color] }} />
                              <span className="truncate">{g.title || t('group.unnamed')}</span>
                            </button>
                          ))}
                      </>
                    )}
                    {onRemoveFromGroup && anyGrouped && (
                      <button
                        type="button"
                        id="tab-menu-remove-from-group"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu(null);
                          setSelectedIds([]);
                          onRemoveFromGroup(targets);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
                      >
                        <FolderMinus className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{t('group.removeFrom')}</span>
                      </button>
                    )}
                  </>
                );
              })()}

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

      {/* Group header menu: name, colour, new tab in the group, ungroup, close */}
      {groupMenu && (() => {
        const group = groupById.get(groupMenu.groupId);
        if (!group) return null;
        const count = tabs.filter((x) => x.groupId === group.id).length;
        return createPortal(
          <div
            ref={groupMenuRef}
            id="tab-group-menu"
            data-panel="groupContextMenu"
            style={{ top: groupMenu.y, left: groupMenu.x }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[99999] w-60 bg-neutral-900/95 border border-white/10 rounded-xl shadow-2xl p-1.5 text-xs text-neutral-200 backdrop-blur-xl animate-fade-in app-no-drag select-none"
          >
            <input
              id="tab-group-name"
              autoFocus
              value={group.title}
              placeholder={t('group.namePlaceholder')}
              maxLength={200}
              onChange={(e) => onUpdateGroup?.(group.id, { title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setGroupMenuOpen(false);
              }}
              className="w-full px-2.5 py-1.5 mb-1.5 rounded-lg bg-white/[0.04] border border-white/10 focus:border-emerald-500/50 outline-none text-neutral-100 placeholder:text-neutral-500"
            />
            <div className="flex flex-wrap gap-1.5 px-1 pb-1.5" role="radiogroup">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={group.color === c}
                  data-group-color={c}
                  title={t(`group.color.${c}` as 'group.color.grey')}
                  onClick={() => onUpdateGroup?.(group.id, { color: c })}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${group.color === c ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-neutral-900' : ''}`}
                  style={{ backgroundColor: GROUP_COLOR_HEX[c] }}
                >
                  {group.color === c && <Check className="w-3 h-3 text-[#0b0d12]" />}
                </button>
              ))}
            </div>
            <div className="my-1 border-t border-white/[0.06]" />
            {onNewTabInGroup && (
              <button
                type="button"
                id="group-menu-new-tab"
                onClick={() => {
                  setGroupMenuOpen(false);
                  onNewTabInGroup(group.id);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('group.newTab')}</span>
              </button>
            )}
            {onUngroup && (
              <button
                type="button"
                id="group-menu-ungroup"
                onClick={() => {
                  setGroupMenuOpen(false);
                  onUngroup(group.id);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.08] flex items-center gap-2 text-neutral-300 hover:text-white app-no-drag cursor-pointer transition-colors"
              >
                <Ungroup className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('group.ungroup')}</span>
              </button>
            )}
            {onCloseGroup && (
              <button
                type="button"
                id="group-menu-close"
                onClick={() => {
                  if (count > 1 && !groupMenu.confirmClose) {
                    setGroupMenuData({ ...groupMenu, confirmClose: true });
                    return;
                  }
                  setGroupMenuOpen(false);
                  onCloseGroup(group.id);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-rose-500/15 text-rose-300 hover:text-rose-200 flex items-center gap-2 app-no-drag cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>{groupMenu.confirmClose ? t('group.closeConfirm', { count }) : t('group.close')}</span>
              </button>
            )}
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
