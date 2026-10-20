import React, { useRef, useEffect, useState } from 'react';
import { BrowserTab } from './types';
import { NewTabPage } from '../pages/NewTabPage';
import { ErrorPage } from '../pages/ErrorPage';
import { SearchEngineId, ThemePalette } from '../settings/types';
import { Moon, ExternalLink, Globe, ShieldCheck, GripVertical, GripHorizontal } from 'lucide-react';
import { tauriBridge, isTauriEnvironment, isElectronEnvironment } from '../services/tauriBridge';
import { ZoomService } from '../services/zoomService';
import { SearchEngineService } from '../services/searchEngineService';
import { FaviconService } from '../services/faviconService';
import { SplitViewState, SplitViewService, SplitLayoutType } from '../services/splitViewService';
import { SplitPaneHeader } from '../components/SplitPaneHeader';
import { SplitViewControlBar } from '../components/SplitViewControlBar';
import { FRCMemoryDiagnosticsPage } from '../pages/FRCMemoryDiagnosticsPage';

interface WebviewContainerProps {
  activeTab: BrowserTab | undefined;
  tabs?: BrowserTab[];
  onNavigate: (url: string) => void;
  onReload: () => void;
  onWakeTab: (tabId: string) => void;
  onHibernateTab?: (tabId: string) => void;
  onTerminateTab?: (tabId: string) => void;
  onTabTitleChange?: (tabId: string, title: string) => void;
  onTabFaviconChange?: (tabId: string, favicon: string) => void;
  onTabLoadingChange?: (tabId: string, isLoading: boolean) => void;
  onTabNavigationChange?: (
    tabId: string,
    data: {
      url: string;
      title?: string;
      favicon?: string;
      canGoBack: boolean;
      canGoForward: boolean;
    }
  ) => void;
  onNewTabRequested?: (url: string) => void;
  defaultSearchEngine: SearchEngineId;
  palette?: ThemePalette;
  isPerformanceMode?: boolean;
  onOpenSettings?: () => void;
  showNewTabSettingsIcon?: boolean;
  showFreedomIcon?: boolean;
  onFoundInPage?: (result: { activeMatchOrdinal: number; numberOfMatches: number }) => void;
  onTabZoomChange?: (tabId: string, zoomLevel: number) => void;
  splitViewState?: SplitViewState;
  onSelectPane?: (paneId: string) => void;
  onClosePane?: (paneId: string) => void;
  onDividerChange?: (positions: number[]) => void;
  onPaneNavigate?: (tabId: string, url: string) => void;
  onPaneBack?: (tabId: string) => void;
  onPaneForward?: (tabId: string) => void;
  onPaneReload?: (tabId: string) => void;
  onSwitchPaneTab?: (paneId: string, targetTabId: string) => void;
  onNewTabInPane?: (paneId: string) => void;
  onSelectLayout?: (layout: SplitLayoutType) => void;
  onAddPane?: () => void;
  onResetDividers?: () => void;
  onExitSplitView?: () => void;
}

const ElectronWebviewTab: React.FC<{
  tab: BrowserTab;
  isActive: boolean;
  style?: React.CSSProperties;
  onFocused?: (tabId: string) => void;
  onTabTitleChange?: (tabId: string, title: string) => void;
  onTabFaviconChange?: (tabId: string, favicon: string) => void;
  onTabLoadingChange?: (tabId: string, isLoading: boolean) => void;
  onTabNavigationChange?: (
    tabId: string,
    data: {
      url: string;
      title?: string;
      favicon?: string;
      canGoBack: boolean;
      canGoForward: boolean;
    }
  ) => void;
  onNewTabRequested?: (url: string) => void;
  onFoundInPage?: (result: { activeMatchOrdinal: number; numberOfMatches: number }) => void;
  onTabZoomChange?: (tabId: string, zoomLevel: number) => void;
}> = ({
  tab,
  isActive,
  style,
  onFocused,
  onTabTitleChange,
  onTabFaviconChange,
  onTabLoadingChange,
  onTabNavigationChange,
  onNewTabRequested,
  onFoundInPage,
  onTabZoomChange,
}) => {
  const wvRef = useRef<any>(null);
  const currentTabRef = useRef(tab);
  currentTabRef.current = tab;

  // Stable callback refs prevent listener thrashing across re-renders
  const callbacksRef = useRef({
    onFocused,
    onTabTitleChange,
    onTabFaviconChange,
    onTabLoadingChange,
    onTabNavigationChange,
    onNewTabRequested,
    onFoundInPage,
    onTabZoomChange,
  });
  callbacksRef.current = {
    onFocused,
    onTabTitleChange,
    onTabFaviconChange,
    onTabLoadingChange,
    onTabNavigationChange,
    onNewTabRequested,
    onFoundInPage,
    onTabZoomChange,
  };

  useEffect(() => {
    const el = wvRef.current;
    if (!el) return;

    tauriBridge.registerWebview(tab.id, el);

    const applySiteZoom = (targetUrl: string) => {
      if (!targetUrl || targetUrl.startsWith('freedom://')) return;
      const rememberedZoom = ZoomService.getZoomForUrl(targetUrl);
      const factor = rememberedZoom / 100;
      try {
        if (typeof el.setZoomFactor === 'function') {
          el.setZoomFactor(factor);
        }
        if (typeof el.getWebContentsId === 'function' && (window as any).electronAPI?.setZoomFactor) {
          const wcId = el.getWebContentsId();
          if (wcId) (window as any).electronAPI.setZoomFactor(wcId, factor);
        }
      } catch (err) {
        console.warn('Failed to apply site zoom:', err);
      }
      if (rememberedZoom !== currentTabRef.current.zoomLevel) {
        callbacksRef.current.onTabZoomChange?.(tab.id, rememberedZoom);
      }
    };

    // Central synchronizer: queries actual Chromium webContents properties on any navigation event
    const syncState = (navUrl?: string, navTitle?: string, navFavicons?: string[]) => {
      try {
        const rawUrl = navUrl || (typeof el.getURL === 'function' ? el.getURL() : '') || currentTabRef.current.url;
        if (!rawUrl || rawUrl === 'about:blank') return;

        let rawTitle = navTitle !== undefined ? navTitle : (typeof el.getTitle === 'function' ? el.getTitle() : '');
        if (!rawTitle || rawTitle === rawUrl) {
          rawTitle = SearchEngineService.extractDomain(rawUrl);
        }

        let favicon: string | undefined = undefined;
        if (rawUrl.startsWith('freedom://')) {
          favicon = undefined;
          if (rawUrl === 'freedom://newtab') rawTitle = 'New Tab';
        } else if (navFavicons && navFavicons.length > 0) {
          favicon = navFavicons[0];
        } else {
          favicon = FaviconService.getFaviconSync(rawUrl);
        }

        const canBack = typeof el.canGoBack === 'function' ? el.canGoBack() : false;
        const canFwd = typeof el.canGoForward === 'function' ? el.canGoForward() : false;

        callbacksRef.current.onTabNavigationChange?.(tab.id, {
          url: rawUrl,
          title: rawTitle,
          favicon,
          canGoBack: canBack,
          canGoForward: canFwd,
        });

        applySiteZoom(rawUrl);
      } catch (err) {
        console.warn('syncState error:', err);
      }
    };

    const handleDomReady = () => {
      syncState();
    };

    const handleDidNavigate = (e: any) => {
      syncState(e.url);
    };

    const handleDidNavigateInPage = (e: any) => {
      syncState(e.url);
    };

    const handleTitleUpdated = (e: any) => {
      if (e.title) {
        callbacksRef.current.onTabTitleChange?.(tab.id, e.title);
        syncState(undefined, e.title);
      }
    };

    const handleFaviconUpdated = (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        callbacksRef.current.onTabFaviconChange?.(tab.id, e.favicons[0]);
        syncState(undefined, undefined, e.favicons);
      }
    };

    const handleStartLoading = () => {
      callbacksRef.current.onTabLoadingChange?.(tab.id, true);
    };

    const handleStopLoading = () => {
      callbacksRef.current.onTabLoadingChange?.(tab.id, false);
      syncState();
    };

    const handleFailLoading = () => {
      callbacksRef.current.onTabLoadingChange?.(tab.id, false);
      syncState();
    };

    const handleNewWindow = (e: any) => {
      if (e.url) {
        callbacksRef.current.onNewTabRequested?.(e.url);
      }
    };

    const handleFoundInPage = (e: any) => {
      if (e.result) {
        callbacksRef.current.onFoundInPage?.({
          activeMatchOrdinal: e.result.activeMatchOrdinal || 0,
          numberOfMatches: e.result.matches || 0,
        });
      }
    };

    const handleFocus = () => {
      callbacksRef.current.onFocused?.(tab.id);
    };

    el.addEventListener('dom-ready', handleDomReady);
    el.addEventListener('did-navigate', handleDidNavigate);
    el.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
    el.addEventListener('page-title-updated', handleTitleUpdated);
    el.addEventListener('page-favicon-updated', handleFaviconUpdated);
    el.addEventListener('did-start-loading', handleStartLoading);
    el.addEventListener('did-stop-loading', handleStopLoading);
    el.addEventListener('did-fail-load', handleFailLoading);
    el.addEventListener('crashed', handleFailLoading);
    el.addEventListener('gpu-crashed', handleFailLoading);
    el.addEventListener('plugin-crashed', handleFailLoading);
    el.addEventListener('new-window', handleNewWindow);
    el.addEventListener('found-in-page', handleFoundInPage);
    el.addEventListener('focus', handleFocus);

    // Initial zoom application
    const initialZoom = ZoomService.getZoomForUrl(tab.url);
    const factor = initialZoom / 100;
    try {
      if (typeof el.setZoomFactor === 'function') {
        el.setZoomFactor(factor);
      }
    } catch {}

    return () => {
      tauriBridge.unregisterWebview(tab.id);
      el.removeEventListener('dom-ready', handleDomReady);
      el.removeEventListener('did-navigate', handleDidNavigate);
      el.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
      el.removeEventListener('page-title-updated', handleTitleUpdated);
      el.removeEventListener('page-favicon-updated', handleFaviconUpdated);
      el.removeEventListener('did-start-loading', handleStartLoading);
      el.removeEventListener('did-stop-loading', handleStopLoading);
      el.removeEventListener('did-fail-load', handleFailLoading);
      el.removeEventListener('crashed', handleFailLoading);
      el.removeEventListener('gpu-crashed', handleFailLoading);
      el.removeEventListener('plugin-crashed', handleFailLoading);
      el.removeEventListener('new-window', handleNewWindow);
      el.removeEventListener('found-in-page', handleFoundInPage);
      el.removeEventListener('focus', handleFocus);
    };
  }, [tab.id]);

  // Sync zoom changes dynamically when tab.zoomLevel updates
  useEffect(() => {
    const el = wvRef.current;
    if (!el) return;
    const factor = (tab.zoomLevel || 100) / 100;
    try {
      if (typeof el.setZoomFactor === 'function') {
        el.setZoomFactor(factor);
      }
      if (typeof el.getWebContentsId === 'function' && (window as any).electronAPI?.setZoomFactor) {
        const wcId = el.getWebContentsId();
        if (wcId) (window as any).electronAPI.setZoomFactor(wcId, factor);
      }
    } catch {}
  }, [tab.zoomLevel]);

  return (
    <div
      style={style ?? { display: isActive ? 'block' : 'none' }}
      className="w-full h-full relative"
    >
      <webview
        ref={wvRef}
        id={`webview-${tab.id}`}
        src={tab.url}
        className="w-full h-full border-none outline-none bg-neutral-950"
        allowpopups="true"
        webpreferences="contextIsolation=yes, javascript=yes, allowRunningInsecureContent=no"
        preload={(window as any).electronAPI?.webviewPreload || undefined}
      />
    </div>
  );
};

export const WebviewContainer: React.FC<WebviewContainerProps> = ({
  activeTab,
  tabs = [],
  onNavigate,
  onReload,
  onWakeTab,
  onHibernateTab,
  onTerminateTab,
  onTabTitleChange,
  onTabFaviconChange,
  onTabLoadingChange,
  onTabNavigationChange,
  onNewTabRequested,
  defaultSearchEngine,
  palette,
  isPerformanceMode = false,
  onOpenSettings,
  showNewTabSettingsIcon = true,
  showFreedomIcon = true,
  onFoundInPage,
  onTabZoomChange,
  splitViewState,
  onSelectPane,
  onClosePane,
  onDividerChange,
  onPaneNavigate,
  onPaneBack,
  onPaneForward,
  onPaneReload,
  onSwitchPaneTab,
  onNewTabInPane,
  onSelectLayout,
  onAddPane,
  onResetDividers,
  onExitSplitView,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const splitWorkspaceRef = useRef<HTMLDivElement>(null);
  const isElectron = isElectronEnvironment();
  const isTauri = isTauriEnvironment();
  const [activeDraggingDividerIndex, setActiveDraggingDividerIndex] = useState<number | null>(null);
  const [dragOrientation, setDragOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  // Multi-divider dragging with window listeners
  useEffect(() => {
    if (activeDraggingDividerIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitWorkspaceRef.current) return;
      const rect = splitWorkspaceRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const layout = splitViewState?.layout || '2-vertical';
      const prevPositions = splitViewState?.dividerPositions || [50];

      let percent = 50;
      if (dragOrientation === 'vertical') {
        percent = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        percent = ((e.clientY - rect.top) / rect.height) * 100;
      }

      const nextPositions = SplitViewService.updateDividerPosition(
        layout,
        prevPositions,
        activeDraggingDividerIndex,
        percent
      );

      onDividerChange?.(nextPositions);
    };

    const handleMouseUp = () => {
      setActiveDraggingDividerIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    activeDraggingDividerIndex,
    dragOrientation,
    splitViewState?.layout,
    splitViewState?.dividerPositions,
    onDividerChange,
  ]);

  // Synchronize Tauri child webview bounds if in Tauri environment
  useEffect(() => {
    if (!activeTab || !isTauri) return;

    if (activeTab.url.startsWith('freedom://') || activeTab.isSuspended) {
      tauriBridge.hideNativeWebviews();
      return;
    }

    const updateBoundsAndSwitch = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };

      if (bounds.width > 0 && bounds.height > 0) {
        tauriBridge.createOrSwitchNativeTab(activeTab.id, activeTab.url, bounds);
      }
    };

    updateBoundsAndSwitch();

    const observer = new ResizeObserver(() => {
      updateBoundsAndSwitch();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateBoundsAndSwitch);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBoundsAndSwitch);
    };
  }, [activeTab?.id, activeTab?.url, activeTab?.isSuspended, isTauri]);

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-xs">
        No active tab
      </div>
    );
  }

  // 0. Dedicated Process Diagnostics internal page (freedom://memory)
  if (activeTab.url === 'freedom://memory') {
    return (
      <div className="relative w-full h-full overflow-hidden z-10">
        <FRCMemoryDiagnosticsPage
          tabs={tabs}
          activeTabId={activeTab.id}
          onNavigate={onNavigate}
          onHibernateTab={onHibernateTab}
          onWakeTab={onWakeTab}
          onTerminateTab={onTerminateTab}
        />
      </div>
    );
  }

  // 1. Tab is suspended / hibernated (Process memory optimization)
  if (activeTab.isSuspended || activeTab.lifecycleState === 'hibernated') {
    return (
      <div
        onClick={() => onWakeTab(activeTab.id)}
        className="flex flex-col items-center justify-center h-full text-center px-4 cursor-pointer select-none bg-neutral-950/90 text-neutral-300 hover:bg-neutral-900/90 transition-colors"
      >
        <div className="p-4 rounded-2xl bg-neutral-900 border border-emerald-500/30 mb-4">
          <Moon className="w-10 h-10 text-emerald-400 animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {activeTab.title || 'Tab Memory Hibernated'}
        </h3>
        <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">
          This tab was hibernated by Freedom RAM Control to reclaim process memory (~0 MB).
          Its navigation history, form state, and URL ({activeTab.url}) are preserved.
        </p>
        <button
          type="button"
          onClick={() => onWakeTab(activeTab.id)}
          className="px-4 py-2 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors cursor-pointer"
        >
          Click Anywhere to Restore Tab
        </button>
      </div>
    );
  }

  // 2. Tab is crashed
  if (activeTab.isCrashed) {
    return (
      <ErrorPage
        errorType="crashed"
        url={activeTab.url}
        errorMessage={activeTab.crashReason || 'Isolated process exited unexpectedly'}
        onReload={onReload}
        onHome={() => onNavigate('freedom://newtab')}
      />
    );
  }

  // 3. Electron Desktop Mode: Native Chromium Webviews with true multi-tab & multi-pane workspace rendering
  if (isElectron) {
    const isSplit = Boolean(
      splitViewState?.enabled &&
      splitViewState.panes.length >= 2 &&
      splitViewState.panes.every((p) => tabs.some((t) => t.id === p.tabId))
    );

    const layoutBoxesAndDividers = isSplit
      ? SplitViewService.calculateLayout(
          splitViewState!.layout,
          splitViewState!.panes.length,
          splitViewState!.dividerPositions
        )
      : { boxes: [], dividers: [] };

    const { boxes, dividers } = layoutBoxesAndDividers;

    const isNewTab = activeTab.url === 'freedom://newtab';
    const isMemoryPage = activeTab.url === 'freedom://memory';
    // Collect all open external tabs that are not suspended or hibernated
    const externalTabs = tabs.length > 0
      ? tabs.filter((t) => !t.url.startsWith('freedom://') && !t.isSuspended && t.lifecycleState !== 'hibernated')
      : (!isNewTab && !isMemoryPage ? [activeTab] : []);

    return (
      <div ref={containerRef} className="relative w-full h-full bg-transparent overflow-hidden select-none flex flex-col">
        {/* Split View Control Bar */}
        {isSplit && (
          <SplitViewControlBar
            splitViewState={splitViewState!}
            onSelectLayout={(lay) => onSelectLayout?.(lay)}
            onAddPane={() => onAddPane?.()}
            onResetDividers={() => onResetDividers?.()}
            onExitSplitView={() => onExitSplitView?.()}
          />
        )}

        {/* Viewport Area */}
        <div ref={splitWorkspaceRef} className="relative flex-1 w-full h-full overflow-hidden">
          {/* Transparent mouse capture overlay during divider dragging to prevent webviews capturing pointer */}
          {activeDraggingDividerIndex !== null && (
            <div
              className={`fixed inset-0 z-50 select-none bg-transparent ${
                dragOrientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize'
              }`}
            />
          )}

          {/* 1. SPLIT VIEW MODE: PANES HEADERS, DIVIDERS & NEW TAB PAGES */}
          {isSplit && (
            <>
              {/* Pane Headers & New Tab Pages for each pane */}
              {splitViewState!.panes.map((pane, idx) => {
                const box = boxes[idx];
                const paneTab = tabs.find((t) => t.id === pane.tabId);
                if (!box || !paneTab) return null;
                const isThisPaneActive = splitViewState!.activePaneId === pane.id;

                return (
                  <React.Fragment key={pane.id}>
                    {/* Pane Header */}
                    <div
                      style={{
                        position: 'absolute',
                        top: box.top,
                        left: box.left,
                        width: box.width,
                        height: 36,
                      }}
                      className="z-20"
                    >
                      <SplitPaneHeader
                        paneIndex={idx + 1}
                        paneId={pane.id}
                        tab={paneTab}
                        allTabs={tabs}
                        allPanes={splitViewState!.panes}
                        isActive={isThisPaneActive}
                        canClose={splitViewState!.panes.length > 1}
                        onSelect={() => onSelectPane?.(pane.id)}
                        onClose={() => onClosePane?.(pane.id)}
                        onBack={(id) => onPaneBack?.(id)}
                        onForward={(id) => onPaneForward?.(id)}
                        onReload={(id) => onPaneReload?.(id)}
                        onNavigate={(id, u) => onPaneNavigate?.(id, u)}
                        onSwitchTab={(pId, tId) => onSwitchPaneTab?.(pId, tId)}
                        onNewTabInPane={(pId) => onNewTabInPane?.(pId)}
                        defaultSearchEngine={defaultSearchEngine}
                      />
                    </div>

                    {/* New Tab Page (if tab is freedom://newtab) */}
                    {paneTab.url === 'freedom://newtab' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: `calc(${box.top} + 36px)`,
                          left: box.left,
                          width: box.width,
                          height: `calc(${box.height} - 36px)`,
                        }}
                        className="overflow-y-auto no-scrollbar z-10"
                        onClick={() => onSelectPane?.(pane.id)}
                      >
                        <NewTabPage
                          onNavigate={(u) => onPaneNavigate?.(paneTab.id, u)}
                          defaultSearchEngine={defaultSearchEngine}
                          palette={palette}
                          isPerformanceMode={isPerformanceMode}
                          onOpenSettings={onOpenSettings}
                          showSettingsIcon={showNewTabSettingsIcon}
                          showFreedomIcon={showFreedomIcon}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Draggable Multi-Dividers */}
              {dividers.map((d) => (
                <div
                  key={d.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveDraggingDividerIndex(d.index);
                    setDragOrientation(d.orientation);
                  }}
                  style={d.style}
                  className={`group select-none flex items-center justify-center ${
                    d.orientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize'
                  }`}
                  title={
                    d.orientation === 'vertical'
                      ? 'Drag horizontally to resize'
                      : 'Drag vertically to resize'
                  }
                >
                  <div
                    className={`${
                      d.orientation === 'vertical' ? 'w-[2px] h-full' : 'h-[2px] w-full'
                    } transition-colors ${
                      activeDraggingDividerIndex === d.index
                        ? 'bg-emerald-400'
                        : 'bg-white/10 group-hover:bg-white/30'
                    }`}
                  />
                  <div
                    className={`absolute ${
                      d.orientation === 'vertical' ? 'w-3.5 h-7' : 'w-7 h-3.5'
                    } rounded-full bg-neutral-900/90 border border-white/20 group-hover:border-white/40 shadow-md flex items-center justify-center pointer-events-none transition-transform group-hover:scale-105`}
                  >
                    {d.orientation === 'vertical' ? (
                      <GripVertical className="w-2.5 h-2.5 text-neutral-400 group-hover:text-neutral-200" />
                    ) : (
                      <GripHorizontal className="w-2.5 h-2.5 text-neutral-400 group-hover:text-neutral-200" />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 2. SINGLE TAB VIEW: Full New Tab Page */}
          {!isSplit && isNewTab && (
            <div
              id="newtab-zoom-viewport"
              className="relative w-full h-full overflow-y-auto no-scrollbar z-10"
              style={{
                zoom: (activeTab.zoomLevel || 100) / 100,
              }}
            >
              <NewTabPage
                onNavigate={onNavigate}
                defaultSearchEngine={defaultSearchEngine}
                palette={palette}
                isPerformanceMode={isPerformanceMode}
                onOpenSettings={onOpenSettings}
                showSettingsIcon={showNewTabSettingsIcon}
                showFreedomIcon={showFreedomIcon}
              />
            </div>
          )}

          {/* 2b. SINGLE TAB VIEW: Process Diagnostics Page (freedom://memory) */}
          {!isSplit && isMemoryPage && (
            <div className="relative w-full h-full overflow-hidden z-10">
              <FRCMemoryDiagnosticsPage
                tabs={tabs}
                activeTabId={activeTab.id}
                onNavigate={onNavigate}
                onHibernateTab={onHibernateTab}
                onWakeTab={onWakeTab}
                onTerminateTab={onTerminateTab}
              />
            </div>
          )}

          {/* 3. ELECTRON WEBVIEW TABS (Persistently mounted with dynamic layout positioning) */}
          {externalTabs.map((t) => {
            let tabStyle: React.CSSProperties;
            let tabIsActive = false;

            if (isSplit) {
              const paneIndex = splitViewState!.panes.findIndex((p) => p.tabId === t.id);
              if (paneIndex !== -1 && t.url !== 'freedom://newtab') {
                const box = boxes[paneIndex];
                if (box) {
                  const isThisPaneActive =
                    splitViewState!.activePaneId === splitViewState!.panes[paneIndex].id;
                  tabIsActive = isThisPaneActive;
                  tabStyle = {
                    display: 'block',
                    position: 'absolute',
                    top: `calc(${box.top} + 36px)`,
                    left: box.left,
                    width: box.width,
                    height: `calc(${box.height} - 36px)`,
                    zIndex: isThisPaneActive ? 2 : 1,
                  };
                } else {
                  tabStyle = { display: 'none' };
                }
              } else {
                tabStyle = { display: 'none' };
              }
            } else {
              // Normal single view
              const isSingleActive = !isNewTab && t.id === activeTab.id;
              tabIsActive = isSingleActive;
              tabStyle = {
                display: isSingleActive ? 'block' : 'none',
                position: 'absolute',
                inset: 0,
              };
            }

            return (
              <ElectronWebviewTab
                key={t.id}
                tab={t}
                isActive={tabIsActive}
                style={tabStyle}
                onFocused={(id) => {
                  if (isSplit) {
                    const foundPane = splitViewState!.panes.find((p) => p.tabId === id);
                    if (foundPane) onSelectPane?.(foundPane.id);
                  }
                }}
                onTabTitleChange={onTabTitleChange}
                onTabFaviconChange={onTabFaviconChange}
                onTabLoadingChange={onTabLoadingChange}
                onTabNavigationChange={onTabNavigationChange}
                onNewTabRequested={onNewTabRequested}
                onFoundInPage={onFoundInPage}
                onTabZoomChange={onTabZoomChange}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Non-Electron New Tab Page (internal Freedom document)
  if (activeTab.url === 'freedom://newtab') {
    const zoomFactor = (activeTab.zoomLevel || 100) / 100;
    return (
      <div
        id="newtab-zoom-viewport"
        className="relative w-full h-full overflow-y-auto no-scrollbar"
        style={{
          zoom: zoomFactor,
        }}
      >
        <NewTabPage
          onNavigate={onNavigate}
          defaultSearchEngine={defaultSearchEngine}
          palette={palette}
          isPerformanceMode={isPerformanceMode}
          onOpenSettings={onOpenSettings}
          showSettingsIcon={showNewTabSettingsIcon}
          showFreedomIcon={showFreedomIcon}
        />
      </div>
    );
  }

  // 5. Native Tauri Desktop Mode
  if (isTauri) {
    return (
      <div
        ref={containerRef}
        id={`native-webview-container-${activeTab.id}`}
        className="relative w-full h-full bg-transparent overflow-hidden"
      >
        <div className="w-full h-full bg-transparent" />
      </div>
    );
  }

  // 6. Web Preview Mode (browser environment fallback)
  return (
    <div
      ref={containerRef}
      id={`native-webview-container-${activeTab.id}`}
      className="relative w-full h-full bg-transparent overflow-hidden flex flex-col items-center justify-center"
    >
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg text-neutral-300">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 mb-5 shadow-lg">
          <Globe className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2 tracking-tight">
          Native WebView Surface
        </h2>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 font-mono text-xs mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Top-Level Context: {activeTab.url}</span>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed mb-6">
          In accordance with Freedom Browser architecture, external websites are <strong>not rendered inside iframes</strong>.
          In the compiled native desktop builds (<code>Freedom.AppImage</code> on Linux, <code>Freedom.exe</code> on Windows),
          this tab is rendered directly by a native Chromium / WebKit surface at top level.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={activeTab.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open in Window</span>
          </a>
          <button
            type="button"
            onClick={onReload}
            className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/[0.06] text-neutral-200 text-xs font-medium transition-colors"
          >
            Reload Tab
          </button>
        </div>
      </div>
    </div>
  );
};
