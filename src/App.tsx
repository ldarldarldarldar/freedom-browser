import React, { useState, useEffect, useCallback } from 'react';
import { TabBar } from './components/TabBar';
import { Navigation } from './components/Navigation';
import { StarCanvas } from './components/StarCanvas';
import { WebviewContainer } from './browser/WebviewContainer';
import { TaskManagerModal } from './pages/TaskManagerModal';
import { SettingsModal } from './pages/SettingsModal';
import { AboutModal } from './pages/AboutModal';
import { DownloadDrawer } from './components/DownloadDrawer';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { FreenMascot } from './components/FreenMascot';
import { BrowserTab, DownloadItem } from './browser/types';
import { BrowserSettings } from './settings/types';
import { DEFAULT_SETTINGS } from './settings/defaults';
import { SearchEngineService } from './services/searchEngineService';
import { logger } from './services/loggerService';
import { tauriBridge } from './services/tauriBridge';

const SETTINGS_KEY = 'freedom_browser_settings';
const TABS_KEY = 'freedom_browser_tabs';
const DOWNLOADS_KEY = 'freedom_browser_downloads_v2';

export default function App() {
  // Settings State
  const [settings, setSettings] = useState<BrowserSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Tabs State
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    return [
      {
        id: 'tab-1',
        title: 'New Tab',
        url: 'freedom://newtab',
        displayUrl: 'freedom://newtab',
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        isSuspended: false,
        lastActive: Date.now(),
        isCrashed: false,
        history: ['freedom://newtab'],
        historyIndex: 0,
        zoomLevel: 100,
        security: 'internal',
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // Modals and Drawers
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  // Downloads state: initialized from local history without fake preloaded entries
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    try {
      const saved = localStorage.getItem(DOWNLOADS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((d: any) => d && d.id !== 'dl-1');
        }
      }
    } catch (e) {
      console.warn('Failed to parse downloads history:', e);
    }
    return [];
  });

  // Persist completed downloads
  useEffect(() => {
    try {
      const toSave = downloads.filter((d) => d.id !== 'dl-1' && d.state === 'completed');
      localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn('Failed to save downloads:', err);
    }
  }, [downloads]);

  // Disk verification: Ensure items shown in downloads actually exist on disk
  useEffect(() => {
    let isMounted = true;
    const verifyDiskFiles = async () => {
      if (downloads.length === 0) return;
      const verified = await tauriBridge.verifyDownloads(downloads);
      if (isMounted && verified.length !== downloads.length) {
        setDownloads(verified);
      }
    };
    verifyDiskFiles();
    return () => {
      isMounted = false;
    };
  }, [downloads.length]);

  // Query platform native default Downloads path on mount
  useEffect(() => {
    const initDefaultDir = async () => {
      const nativeDir = await tauriBridge.getDefaultDownloadDir();
      if (nativeDir && (settings.downloadsLocation === '~/Downloads' || !settings.downloadsLocation)) {
        setSettings((prev) => ({ ...prev, downloadsLocation: nativeDir }));
      }
    };
    initDefaultDir();
  }, []);

  // Persist Settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }
  }, [settings]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Inactive Tab Suspension (Memory Optimization)
  useEffect(() => {
    if (!settings.autoSuspendInactiveTabs) return;

    const timeoutMs = settings.tabSuspensionTimeoutMinutes * 60 * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      setTabs((prev) =>
        prev.map((t) => {
          if (
            t.id !== activeTabId &&
            !t.isSuspended &&
            !t.url.startsWith('freedom://') &&
            now - t.lastActive > timeoutMs
          ) {
            logger.log('INFO', 'MEMORY', `Suspending inactive tab '${t.title}' to free RAM.`);
            return { ...t, isSuspended: true };
          }
          return t;
        })
      );
    }, 30000);

    return () => clearInterval(interval);
  }, [settings.autoSuspendInactiveTabs, settings.tabSuspensionTimeoutMinutes, activeTabId]);

  // Tab operations
  const handleSelectTab = useCallback((id: string) => {
    setActiveTabId(id);
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, lastActive: Date.now(), isSuspended: false } : t))
    );
  }, []);

  const handleNewTab = useCallback((targetUrl: string = 'freedom://newtab') => {
    const newId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newId,
      title: targetUrl === 'freedom://newtab' ? 'New Tab' : SearchEngineService.extractDomain(targetUrl),
      url: targetUrl,
      displayUrl: targetUrl,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isSuspended: false,
      lastActive: Date.now(),
      isCrashed: false,
      history: [targetUrl],
      historyIndex: 0,
      zoomLevel: 100,
      security: targetUrl.startsWith('https://') ? 'secure' : 'internal',
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    logger.log('INFO', 'RENDERER', `Created tab ${newId} with URL ${targetUrl}`);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      // Destroy native WebKitGTK / WebView2 child webview if active
      tauriBridge.closeNativeTab(id);

      if (tabs.length === 1) {
        // If last tab is closed, reset it to new tab
        setTabs([
          {
            id: `tab-${Date.now()}`,
            title: 'New Tab',
            url: 'freedom://newtab',
            displayUrl: 'freedom://newtab',
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            isSuspended: false,
            lastActive: Date.now(),
            isCrashed: false,
            history: ['freedom://newtab'],
            historyIndex: 0,
            zoomLevel: 100,
            security: 'internal',
          },
        ]);
        return;
      }

      const index = tabs.findIndex((t) => t.id === id);
      const remaining = tabs.filter((t) => t.id !== id);
      setTabs(remaining);

      if (id === activeTabId) {
        const nextIndex = Math.max(0, index - 1);
        setActiveTabId(remaining[nextIndex].id);
      }
      logger.log('INFO', 'RENDERER', `Closed tab ${id}`);
    },
    [tabs, activeTabId]
  );

  const handleNavigate = useCallback(
    (url: string) => {
      if (!activeTab) return;

      const domain = SearchEngineService.extractDomain(url);
      const isInternal = url.startsWith('freedom://');

      if (url === 'freedom://settings') {
        tauriBridge.hideNativeWebviews();
        setIsSettingsOpen(true);
        return;
      }
      if (url === 'freedom://taskmanager') {
        tauriBridge.hideNativeWebviews();
        setIsTaskManagerOpen(true);
        return;
      }
      if (url === 'freedom://downloads') {
        setIsDownloadsOpen(true);
        return;
      }
      if (url === 'freedom://about') {
        tauriBridge.hideNativeWebviews();
        setIsAboutOpen(true);
        return;
      }

      if (isInternal) {
        tauriBridge.hideNativeWebviews();
      } else {
        tauriBridge.navigateNative(activeTab.id, url);
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === activeTab.id) {
            const nextHistory = [...t.history.slice(0, t.historyIndex + 1), url];
            return {
              ...t,
              url,
              displayUrl: url,
              title: isInternal ? 'Freedom Tab' : domain,
              isLoading: !isInternal,
              isSuspended: false,
              isCrashed: false,
              history: nextHistory,
              historyIndex: nextHistory.length - 1,
              canGoBack: nextHistory.length > 1,
              canGoForward: false,
              lastActive: Date.now(),
              security: isInternal ? 'internal' : url.startsWith('https://') ? 'secure' : 'insecure',
            };
          }
          return t;
        })
      );
      logger.log('INFO', 'NETWORK', `Navigated to ${url}`);
    },
    [activeTab]
  );

  const handleBack = useCallback(() => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const nextIndex = activeTab.historyIndex - 1;
    const targetUrl = activeTab.history[nextIndex];

    if (!targetUrl.startsWith('freedom://')) {
      tauriBridge.goBackNative(activeTab.id);
    } else {
      tauriBridge.hideNativeWebviews();
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: targetUrl,
              displayUrl: targetUrl,
              historyIndex: nextIndex,
              canGoBack: nextIndex > 0,
              canGoForward: true,
              lastActive: Date.now(),
            }
          : t
      )
    );
  }, [activeTab]);

  const handleForward = useCallback(() => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    const nextIndex = activeTab.historyIndex + 1;
    const targetUrl = activeTab.history[nextIndex];

    if (!targetUrl.startsWith('freedom://')) {
      tauriBridge.goForwardNative(activeTab.id);
    } else {
      tauriBridge.hideNativeWebviews();
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: targetUrl,
              displayUrl: targetUrl,
              historyIndex: nextIndex,
              canGoBack: true,
              canGoForward: nextIndex < t.history.length - 1,
              lastActive: Date.now(),
            }
          : t
      )
    );
  }, [activeTab]);

  const handleReload = useCallback(() => {
    if (!activeTab) return;
    if (!activeTab.url.startsWith('freedom://')) {
      tauriBridge.reloadNative(activeTab.id);
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, isLoading: true, isCrashed: false, isSuspended: false } : t
      )
    );
    setTimeout(() => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false } : t))
      );
    }, 600);
  }, [activeTab]);

  const handleWakeTab = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isSuspended: false, lastActive: Date.now() } : t))
    );
  }, []);

  const handleTerminateTab = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, isCrashed: true, crashReason: 'Manually terminated via Freedom Task Manager' }
          : t
      )
    );
    logger.log('WARN', 'RENDERER', `Process for tab ${tabId} was terminated by user.`);
  }, []);

  const handleSuspendTab = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isSuspended: true } : t))
    );
    logger.log('INFO', 'MEMORY', `Tab ${tabId} suspended manually.`);
  }, []);

  // Webview lifecycle synchronization
  const handleTabNavigationChange = useCallback(
    (tabId: string, url: string, canGoBack: boolean, canGoForward: boolean) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === tabId) {
            const isInternal = url.startsWith('freedom://');
            return {
              ...t,
              url,
              displayUrl: url,
              canGoBack,
              canGoForward,
              security: isInternal ? 'internal' : url.startsWith('https://') ? 'secure' : 'insecure',
              lastActive: Date.now(),
            };
          }
          return t;
        })
      );
    },
    []
  );

  const handleTabTitleChange = useCallback((tabId: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, title } : t))
    );
  }, []);

  const handleTabFaviconChange = useCallback((tabId: string, favicon: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, favicon } : t))
    );
  }, []);

  const handleTabLoadingChange = useCallback((tabId: string, isLoading: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isLoading } : t))
    );
  }, []);

  // Electron IPC download & new window events
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.on) {
      const unsubNewWindow = (window as any).electronAPI.on('webview-new-window', ({ url }: { url: string }) => {
        handleNewTab(url);
      });
      const unsubDlStart = (window as any).electronAPI.on('download-start', (item: DownloadItem) => {
        setDownloads((prev) => [item, ...prev.filter((d) => d.id !== item.id)]);
        setIsDownloadsOpen(true);
      });
      const unsubDlProgress = (window as any).electronAPI.on('download-progress', (item: DownloadItem) => {
        setDownloads((prev) => {
          const idx = prev.findIndex((d) => d.id === item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...item };
            return next;
          }
          return [item, ...prev];
        });
      });
      const unsubDlDone = (window as any).electronAPI.on('download-completed', (item: DownloadItem) => {
        setDownloads((prev) => {
          const idx = prev.findIndex((d) => d.id === item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...item };
            return next;
          }
          return [item, ...prev];
        });
      });

      return () => {
        unsubNewWindow?.();
        unsubDlStart?.();
        unsubDlProgress?.();
        unsubDlDone?.();
      };
    }
  }, [handleNewTab]);

  // Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+R, Shift+Esc, F12, Ctrl+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) handleCloseTab(activeTabId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReload();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsDownloadsOpen((prev) => !prev);
      } else if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        setIsTaskManagerOpen((prev) => !prev);
      } else if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        setIsDevToolsOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewTab, handleCloseTab, handleReload, activeTabId]);

  const isPerformanceMode = settings.browserMode === 'performance';

  // Color theme classes & palette resolution
  const getBackgroundColor = () => {
    if (settings.palette?.mainBg) {
      return settings.palette.mainBg;
    }
    switch (settings.backgroundColor) {
      case 'dark-green':
        return '#042017';
      case 'dark-blue':
        return '#091326';
      case 'custom':
        return settings.customBackgroundColor;
      case 'black':
      default:
        return '#06080b';
    }
  };

  const getHeaderColorClass = () => {
    if (settings.palette?.headerBg) {
      return 'bg-[var(--theme-header)]';
    }
    switch (settings.headerColor) {
      case 'dark-green':
        return 'bg-[#052e16]';
      case 'dark-blue':
        return 'bg-[#0c1a30]';
      case 'crimson':
        return 'bg-[#3f1212]';
      case 'light':
        return 'bg-[#1e293b]';
      case 'black':
      default:
        return 'bg-[#090b10]';
    }
  };

  return (
    <div
      id="freedom-browser-app"
      className={`relative flex flex-col h-screen w-screen overflow-hidden text-white font-sans select-none ${
        isPerformanceMode || !settings.uiAnimationsEnabled ? 'performance-mode' : ''
      }`}
      style={{
        backgroundColor: getBackgroundColor(),
        '--theme-accent': settings.palette?.accentColor || '#10b981',
        '--theme-bg': settings.palette?.mainBg || '#06080b',
        '--theme-header': settings.palette?.headerBg || '#090b10',
        '--theme-surface': settings.palette?.cardBg || '#12161f',
        '--theme-border': settings.palette?.borderColor || '#232b3b',
        '--theme-text': settings.palette?.textColor || '#f8fafc',
      } as React.CSSProperties}
    >
      {/* Moving Subtle Stars Canvas Background (Disabled in Performance Mode or when toggled off) */}
      <StarCanvas
        enabled={
          !isPerformanceMode &&
          settings.starAnimationEnabled &&
          settings.backgroundParticlesEnabled
        }
        density={settings.starDensity}
        intensity={settings.animationIntensity}
        particleColor={settings.palette?.particleColor || settings.palette?.accentColor}
      />

      {/* Custom Background Image Layer */}
      {settings.customBackgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${settings.customBackgroundImage})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize:
              settings.backgroundImageScale === 'stretch'
                ? '100% 100%'
                : settings.backgroundImageScale === 'contain'
                ? 'contain'
                : settings.backgroundImageScale === 'center'
                ? 'auto'
                : 'cover',
            opacity: (settings.backgroundImageOpacity ?? 100) / 100,
            filter:
              settings.blurEffectsEnabled && (settings.backgroundImageBlur ?? 0) > 0
                ? `blur(${settings.backgroundImageBlur}px)`
                : 'none',
          }}
        />
      )}

      {/* Top Chrome: Tabs Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={() => handleNewTab('freedom://newtab')}
        headerColorClass={getHeaderColorClass()}
      />

      {/* Navigation & Controls Bar */}
      <Navigation
        currentTab={activeTab}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onStop={() => {
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false } : t))
          );
        }}
        onHome={() => handleNavigate('freedom://newtab')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTaskManager={() => setIsTaskManagerOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(!isDownloadsOpen)}
        onToggleDevTools={() => setIsDevToolsOpen(!isDevToolsOpen)}
        onOpenAbout={() => setIsAboutOpen(true)}
        defaultSearchEngine={settings.defaultSearchEngine}
        downloadsCount={downloads.filter((d) => d.state === 'progressing').length}
        headerColorClass={getHeaderColorClass()}
        isDevToolsOpen={isDevToolsOpen}
      />

      {/* Primary Browser Content Viewport */}
      <div className="relative flex-1 w-full overflow-hidden z-10">
        <WebviewContainer
          activeTab={activeTab}
          tabs={tabs}
          onNavigate={handleNavigate}
          onReload={handleReload}
          onWakeTab={handleWakeTab}
          onTabTitleChange={handleTabTitleChange}
          onTabFaviconChange={handleTabFaviconChange}
          onTabLoadingChange={handleTabLoadingChange}
          onTabNavigationChange={handleTabNavigationChange}
          onNewTabRequested={handleNewTab}
          defaultSearchEngine={settings.defaultSearchEngine}
          palette={settings.palette}
          isPerformanceMode={isPerformanceMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Developer Tools Drawer */}
      <DevToolsDrawer
        isOpen={isDevToolsOpen}
        onClose={() => setIsDevToolsOpen(false)}
        activeTab={activeTab}
      />

      {/* Downloads Popover Drawer */}
      <DownloadDrawer
        isOpen={isDownloadsOpen}
        onClose={() => setIsDownloadsOpen(false)}
        downloads={downloads}
        onCancelDownload={async (id) => {
          await tauriBridge.cancelDownload(id);
          setDownloads((prev) =>
            prev.map((d) => (d.id === id ? { ...d, state: 'cancelled' } : d))
          );
        }}
        onClearHistory={() => setDownloads([])}
        onOpenFile={async (item) => {
          const success = await tauriBridge.openDownloadFile(item.filepath);
          if (!success) {
            // File no longer on disk - prune from list
            setDownloads((prev) => prev.filter((d) => d.id !== item.id));
          }
        }}
        onShowInFolder={async (item) => {
          await tauriBridge.showItemInFolder(item.filepath);
        }}
        onOpenFolder={async () => {
          await tauriBridge.openDownloadFolder(settings.downloadsLocation);
        }}
      />

      {/* Task Manager Modal */}
      <TaskManagerModal
        isOpen={isTaskManagerOpen}
        onClose={() => setIsTaskManagerOpen(false)}
        tabs={tabs}
        onTerminateTab={handleTerminateTab}
        onReloadTab={handleReload}
        onSuspendTab={handleSuspendTab}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) =>
          setSettings((prev) => ({ ...prev, ...newSettings }))
        }
        onClearBrowsingData={() => {
          logger.clearLogs();
          localStorage.removeItem(TABS_KEY);
        }}
      />

      {/* About Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* Freedom Mascot: Freen in bottom-right corner */}
      <FreenMascot enabled={settings.showFreenMascot} />
    </div>
  );
}
