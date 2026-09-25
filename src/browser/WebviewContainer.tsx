import React, { useRef, useEffect } from 'react';
import { BrowserTab } from './types';
import { NewTabPage } from '../pages/NewTabPage';
import { ErrorPage } from '../pages/ErrorPage';
import { SearchEngineId, ThemePalette } from '../settings/types';
import { Moon, ExternalLink, Globe, ShieldCheck } from 'lucide-react';
import { tauriBridge, isTauriEnvironment, isElectronEnvironment } from '../services/tauriBridge';

interface WebviewContainerProps {
  activeTab: BrowserTab | undefined;
  tabs?: BrowserTab[];
  onNavigate: (url: string) => void;
  onReload: () => void;
  onWakeTab: (tabId: string) => void;
  onTabTitleChange?: (tabId: string, title: string) => void;
  onTabFaviconChange?: (tabId: string, favicon: string) => void;
  onTabLoadingChange?: (tabId: string, isLoading: boolean) => void;
  onTabNavigationChange?: (tabId: string, url: string, canGoBack: boolean, canGoForward: boolean) => void;
  onNewTabRequested?: (url: string) => void;
  defaultSearchEngine: SearchEngineId;
  palette?: ThemePalette;
  isPerformanceMode?: boolean;
  onOpenSettings?: () => void;
}

const ElectronWebviewTab: React.FC<{
  tab: BrowserTab;
  isActive: boolean;
  onTabTitleChange?: (tabId: string, title: string) => void;
  onTabFaviconChange?: (tabId: string, favicon: string) => void;
  onTabLoadingChange?: (tabId: string, isLoading: boolean) => void;
  onTabNavigationChange?: (tabId: string, url: string, canGoBack: boolean, canGoForward: boolean) => void;
  onNewTabRequested?: (url: string) => void;
}> = ({
  tab,
  isActive,
  onTabTitleChange,
  onTabFaviconChange,
  onTabLoadingChange,
  onTabNavigationChange,
  onNewTabRequested,
}) => {
  const wvRef = useRef<any>(null);

  useEffect(() => {
    const el = wvRef.current;
    if (!el) return;

    tauriBridge.registerWebview(tab.id, el);

    const handleDidNavigate = (e: any) => {
      const url = e.url || (el.getURL ? el.getURL() : tab.url);
      const canBack = typeof el.canGoBack === 'function' ? el.canGoBack() : false;
      const canFwd = typeof el.canGoForward === 'function' ? el.canGoForward() : false;
      onTabNavigationChange?.(tab.id, url, canBack, canFwd);
    };

    const handleTitleUpdated = (e: any) => {
      if (e.title) onTabTitleChange?.(tab.id, e.title);
    };

    const handleFaviconUpdated = (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        onTabFaviconChange?.(tab.id, e.favicons[0]);
      }
    };

    const handleStartLoading = () => {
      onTabLoadingChange?.(tab.id, true);
    };

    const handleStopLoading = () => {
      onTabLoadingChange?.(tab.id, false);
      if (typeof el.getURL === 'function') {
        const url = el.getURL();
        const canBack = typeof el.canGoBack === 'function' ? el.canGoBack() : false;
        const canFwd = typeof el.canGoForward === 'function' ? el.canGoForward() : false;
        onTabNavigationChange?.(tab.id, url, canBack, canFwd);
      }
    };

    const handleNewWindow = (e: any) => {
      if (e.url) {
        onNewTabRequested?.(e.url);
      }
    };

    el.addEventListener('did-navigate', handleDidNavigate);
    el.addEventListener('did-navigate-in-page', handleDidNavigate);
    el.addEventListener('page-title-updated', handleTitleUpdated);
    el.addEventListener('page-favicon-updated', handleFaviconUpdated);
    el.addEventListener('did-start-loading', handleStartLoading);
    el.addEventListener('did-stop-loading', handleStopLoading);
    el.addEventListener('new-window', handleNewWindow);

    return () => {
      tauriBridge.unregisterWebview(tab.id);
      el.removeEventListener('did-navigate', handleDidNavigate);
      el.removeEventListener('did-navigate-in-page', handleDidNavigate);
      el.removeEventListener('page-title-updated', handleTitleUpdated);
      el.removeEventListener('page-favicon-updated', handleFaviconUpdated);
      el.removeEventListener('did-start-loading', handleStartLoading);
      el.removeEventListener('did-stop-loading', handleStopLoading);
      el.removeEventListener('new-window', handleNewWindow);
    };
  }, [tab.id, onTabTitleChange, onTabFaviconChange, onTabLoadingChange, onTabNavigationChange, onNewTabRequested, tab.url]);

  return (
    <div
      style={{ display: isActive ? 'block' : 'none' }}
      className="w-full h-full relative"
    >
      <webview
        ref={wvRef}
        id={`webview-${tab.id}`}
        src={tab.url}
        className="w-full h-full border-none outline-none bg-neutral-950"
        allowpopups="true"
        webpreferences="contextIsolation=yes"
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
  onTabTitleChange,
  onTabFaviconChange,
  onTabLoadingChange,
  onTabNavigationChange,
  onNewTabRequested,
  defaultSearchEngine,
  palette,
  isPerformanceMode = false,
  onOpenSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isElectron = isElectronEnvironment();
  const isTauri = isTauriEnvironment();

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

  // 1. Tab is suspended / hibernated (Process memory optimization)
  if (activeTab.isSuspended) {
    return (
      <div
        onClick={() => onWakeTab(activeTab.id)}
        className="flex flex-col items-center justify-center h-full text-center px-4 cursor-pointer select-none bg-neutral-950/90 text-neutral-300 hover:bg-neutral-900/90 transition-colors"
      >
        <div className="p-4 rounded-2xl bg-neutral-900 border border-emerald-500/30 mb-4">
          <Moon className="w-10 h-10 text-emerald-400 animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Tab Memory Hibernated
        </h3>
        <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">
          This tab was suspended by Freedom&apos;s memory optimizer to reclaim RAM.
          Its state and URL ({activeTab.url}) are preserved.
        </p>
        <button
          type="button"
          onClick={() => onWakeTab(activeTab.id)}
          className="px-4 py-2 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors"
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

  // 3. New Tab Page (internal Freedom document)
  if (activeTab.url === 'freedom://newtab') {
    return (
      <NewTabPage
        onNavigate={onNavigate}
        defaultSearchEngine={defaultSearchEngine}
        palette={palette}
        isPerformanceMode={isPerformanceMode}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  // 4. Electron Desktop Mode: Native Chromium Webviews with true top-level multi-tab rendering
  if (isElectron) {
    // Collect all open external tabs that are not suspended
    const externalTabs = tabs.length > 0
      ? tabs.filter((t) => !t.url.startsWith('freedom://') && !t.isSuspended)
      : [activeTab];

    return (
      <div className="relative w-full h-full bg-neutral-950 overflow-hidden">
        {externalTabs.map((t) => (
          <ElectronWebviewTab
            key={t.id}
            tab={t}
            isActive={t.id === activeTab.id}
            onTabTitleChange={onTabTitleChange}
            onTabFaviconChange={onTabFaviconChange}
            onTabLoadingChange={onTabLoadingChange}
            onTabNavigationChange={onTabNavigationChange}
            onNewTabRequested={onNewTabRequested}
          />
        ))}
      </div>
    );
  }

  // 5. Native Tauri Desktop Mode
  if (isTauri) {
    return (
      <div
        ref={containerRef}
        id={`native-webview-container-${activeTab.id}`}
        className="relative w-full h-full bg-neutral-950 overflow-hidden"
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
      className="relative w-full h-full bg-neutral-950 overflow-hidden flex flex-col items-center justify-center"
    >
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg text-neutral-300">
        <div className="p-4 rounded-2xl bg-neutral-900 border border-emerald-500/30 mb-5 shadow-lg">
          <Globe className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2 tracking-tight">
          Native WebView Surface
        </h2>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono text-xs mb-4">
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open in Window</span>
          </a>
          <button
            type="button"
            onClick={onReload}
            className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
          >
            Reload Tab
          </button>
        </div>
      </div>
    </div>
  );
};
