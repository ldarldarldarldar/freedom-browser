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
import { HistoryDrawer } from './components/HistoryDrawer';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { BookmarksBar } from './components/BookmarksBar';
import { FindInPageBar } from './components/FindInPageBar';
import { BrowserTab, DownloadItem, Bookmark, FindInPageState } from './browser/types';
import { BrowserSettings } from './settings/types';
import { DEFAULT_SETTINGS } from './settings/defaults';
import { SearchEngineService } from './services/searchEngineService';
import { logger } from './services/loggerService';
import { tauriBridge } from './services/tauriBridge';
import { HistoryService } from './services/historyService';
import { BookmarkService } from './services/bookmarkService';
import { SessionService } from './services/sessionService';
import { ZoomService } from './services/zoomService';
import { TabSortService, TabSortMode } from './services/tabSortService';

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
    try {
      const params = new URLSearchParams(window.location.search);
      const openUrl = params.get('openUrl');
      const tabCount = parseInt(params.get('tabCount') || '1', 10);

      if (openUrl) {
        return [
          {
            id: 'tab-1',
            title: SearchEngineService.extractDomain(openUrl),
            url: openUrl,
            displayUrl: openUrl,
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            isSuspended: false,
            lastActive: Date.now(),
            isCrashed: false,
            history: [openUrl],
            historyIndex: 0,
            zoomLevel: ZoomService.getZoomForUrl(openUrl),
            security: openUrl.startsWith('https://') ? 'secure' : 'insecure',
          },
        ];
      }

      if (tabCount > 1) {
        const demoUrls = [
          'https://duckduckgo.com',
          'https://github.com',
          'https://wikipedia.org',
          'https://reddit.com',
          'https://news.ycombinator.com',
          'https://developer.mozilla.org',
          'https://archlinux.org',
          'https://kernel.org',
          'https://electronjs.org',
        ];
        const initialTabs: BrowserTab[] = [
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
        for (let i = 2; i <= tabCount; i++) {
          const u = demoUrls[(i - 2) % demoUrls.length];
          initialTabs.push({
            id: `tab-${i}`,
            title: SearchEngineService.extractDomain(u),
            url: u,
            displayUrl: u,
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            isSuspended: false,
            lastActive: Date.now(),
            isCrashed: false,
            history: [u],
            historyIndex: 0,
            zoomLevel: 100,
            security: 'secure',
          });
        }
        return initialTabs;
      }
    } catch {}

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
        zoomLevel: ZoomService.getZoomForUrl('freedom://newtab'),
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => BookmarkService.getBookmarks());

  // Closed tabs count for TabBar restoration indicator
  const [closedTabsCount, setClosedTabsCount] = useState<number>(
    () => SessionService.getRecentlyClosed().length
  );

  // Tab sorting mode state
  const [activeSortMode, setActiveSortMode] = useState<TabSortMode | 'none'>('none');

  // Find in page state
  const [findState, setFindState] = useState<FindInPageState>({
    isOpen: false,
    text: '',
    activeMatchOrdinal: 0,
    numberOfMatches: 0,
  });

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
      setTabs((prev) => {
        let hasChanges = false;
        const next = prev.map((t) => {
          if (
            t.id !== activeTabId &&
            !t.isSuspended &&
            !t.url.startsWith('freedom://') &&
            now - t.lastActive > timeoutMs
          ) {
            hasChanges = true;
            logger.log('INFO', 'MEMORY', `Suspending inactive tab '${t.title}' to free RAM.`);
            return { ...t, isSuspended: true };
          }
          return t;
        });
        return hasChanges ? next : prev;
      });
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
      zoomLevel: ZoomService.getZoomForUrl(targetUrl),
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
            zoomLevel: ZoomService.getZoomForUrl('freedom://newtab'),
            security: 'internal',
          },
        ]);
        return;
      }

      const tabToClose = tabs.find((t) => t.id === id);
      if (tabToClose) {
        SessionService.recordClosedTab(tabToClose, false);
        setClosedTabsCount(SessionService.getRecentlyClosed().length);
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

  const handleRestoreClosedTab = useCallback(() => {
    const restored = SessionService.popRecentlyClosed();
    if (!restored) return;
    setClosedTabsCount(SessionService.getRecentlyClosed().length);
    const newTab: BrowserTab = {
      id: `tab-${Date.now()}`,
      title: restored.title,
      url: restored.url,
      displayUrl: restored.url,
      favicon: restored.favicon,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isSuspended: false,
      lastActive: Date.now(),
      isCrashed: false,
      history: [restored.url],
      historyIndex: 0,
      zoomLevel: restored.zoomLevel || 100,
      security: restored.url.startsWith('https://') ? 'secure' : 'insecure',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const isCurrentBookmarked = activeTab ? BookmarkService.isBookmarked(activeTab.url) : false;

  const handleToggleBookmark = useCallback(() => {
    if (!activeTab || activeTab.url.startsWith('freedom://newtab')) return;
    BookmarkService.toggleBookmark(activeTab.title, activeTab.url, activeTab.favicon);
    setBookmarks(BookmarkService.getBookmarks());
  }, [activeTab]);

  const handleZoomIn = useCallback(() => {
    if (!activeTab) return;
    const next = ZoomService.zoomIn(activeTab.zoomLevel, activeTab.url);
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, zoomLevel: next } : t)));
    tauriBridge.setWebviewZoom(activeTab.id, next / 100);
  }, [activeTab]);

  const handleZoomOut = useCallback(() => {
    if (!activeTab) return;
    const next = ZoomService.zoomOut(activeTab.zoomLevel, activeTab.url);
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, zoomLevel: next } : t)));
    tauriBridge.setWebviewZoom(activeTab.id, next / 100);
  }, [activeTab]);

  const handleResetZoom = useCallback(() => {
    if (!activeTab) return;
    ZoomService.resetZoom(activeTab.url);
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, zoomLevel: 100 } : t)));
    tauriBridge.setWebviewZoom(activeTab.id, 1.0);
  }, [activeTab]);

  const handleFind = useCallback(
    (text: string, forward: boolean = true, findNext: boolean = false) => {
      if (!activeTab) return;
      setFindState((prev) => ({ ...prev, text }));
      if (!text.trim()) {
        tauriBridge.stopFindInPage(activeTab.id, 'clearSelection');
        setFindState((prev) => ({ ...prev, activeMatchOrdinal: 0, numberOfMatches: 0 }));
        return;
      }
      tauriBridge.findInPage(activeTab.id, text, { forward, findNext });
    },
    [activeTab]
  );

  const handleCloseFind = useCallback(() => {
    if (activeTab) {
      tauriBridge.stopFindInPage(activeTab.id, 'clearSelection');
    }
    setFindState({
      isOpen: false,
      text: '',
      activeMatchOrdinal: 0,
      numberOfMatches: 0,
    });
  }, [activeTab]);

  const handleFoundInPage = useCallback(
    (result: { activeMatchOrdinal: number; numberOfMatches: number }) => {
      setFindState((prev) => ({
        ...prev,
        activeMatchOrdinal: result.activeMatchOrdinal,
        numberOfMatches: result.numberOfMatches,
      }));
    },
    []
  );

  const handleRemoveDownloadItem = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  }, []);

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
            const siteZoom = ZoomService.getZoomForUrl(url);
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
              zoomLevel: siteZoom,
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

  const handleSuspendTabs = useCallback((tabIds: string[]) => {
    const idSet = new Set(tabIds);
    setTabs((prev) =>
      prev.map((t) =>
        idSet.has(t.id) && !t.url.startsWith('freedom://') ? { ...t, isSuspended: true } : t
      )
    );
    logger.log('INFO', 'MEMORY', `Suspended ${tabIds.length} tabs to reclaim RAM.`);
  }, []);

  const handleDuplicateTab = useCallback(
    (tabId: string) => {
      const sourceTab = tabs.find((t) => t.id === tabId);
      if (!sourceTab) return;
      const newId = `tab-${Date.now()}`;
      const newTab: BrowserTab = {
        ...sourceTab,
        id: newId,
        isLoading: false,
        isSuspended: false,
        lastActive: Date.now(),
        history: [...sourceTab.history],
      };
      const index = tabs.findIndex((t) => t.id === tabId);
      const updated = [...tabs];
      updated.splice(index + 1, 0, newTab);
      setTabs(updated);
      setActiveTabId(newId);
      logger.log('INFO', 'RENDERER', `Duplicated tab ${tabId} as ${newId}`);
    },
    [tabs]
  );

  const handleCloseTabsFromSite = useCallback(
    (hostname: string) => {
      const target = TabSortService.extractHostname(hostname).toLowerCase();
      const matchingTabs = tabs.filter(
        (t) => TabSortService.extractHostname(t.url).toLowerCase() === target
      );
      const remaining = tabs.filter(
        (t) => TabSortService.extractHostname(t.url).toLowerCase() !== target
      );

      if (remaining.length === 0) {
        // All tabs belong to this site: keep exactly 1 New Tab, never close the last tab
        const [keepTab, ...closeTabs] = matchingTabs;
        closeTabs.forEach((t) => {
          tauriBridge.closeNativeTab(t.id);
          SessionService.recordClosedTab(t, false);
        });
        setClosedTabsCount(SessionService.getRecentlyClosed().length);

        const singleTab: BrowserTab = {
          ...keepTab,
          title: 'New Tab',
          url: 'freedom://newtab',
          displayUrl: 'freedom://newtab',
          isLoading: false,
          isSuspended: false,
          isCrashed: false,
          history: ['freedom://newtab'],
          historyIndex: 0,
        };

        setTabs([singleTab]);
        setActiveTabId(singleTab.id);
        logger.log('INFO', 'RENDERER', `Closed tabs from site ${hostname}, left exactly 1 New Tab`);
        return;
      }

      matchingTabs.forEach((t) => {
        tauriBridge.closeNativeTab(t.id);
        SessionService.recordClosedTab(t, false);
      });
      setClosedTabsCount(SessionService.getRecentlyClosed().length);

      setTabs(remaining);
      if (!remaining.some((t) => t.id === activeTabId)) {
        setActiveTabId(remaining[0].id);
      }
      logger.log('INFO', 'RENDERER', `Closed all tabs from site: ${hostname}`);
    },
    [tabs, activeTabId]
  );

  const handleCloseOtherTabs = useCallback(
    (tabId: string) => {
      const toClose = tabs.filter((t) => t.id !== tabId);
      toClose.forEach((t) => {
        tauriBridge.closeNativeTab(t.id);
        SessionService.recordClosedTab(t, false);
      });
      setClosedTabsCount(SessionService.getRecentlyClosed().length);

      const remaining = tabs.filter((t) => t.id === tabId);
      if (remaining.length > 0) {
        setTabs(remaining);
        setActiveTabId(remaining[0].id);
        logger.log('INFO', 'RENDERER', `Closed other tabs, kept ${tabId}`);
      }
    },
    [tabs]
  );

  const handleCloseTabsToRight = useCallback(
    (tabId: string) => {
      const index = tabs.findIndex((t) => t.id === tabId);
      if (index === -1) return;
      const toClose = tabs.slice(index + 1);
      toClose.forEach((t) => {
        tauriBridge.closeNativeTab(t.id);
        SessionService.recordClosedTab(t, false);
      });
      setClosedTabsCount(SessionService.getRecentlyClosed().length);

      const remaining = tabs.slice(0, index + 1);
      setTabs(remaining);
      if (!remaining.some((t) => t.id === activeTabId)) {
        setActiveTabId(tabId);
      }
      logger.log('INFO', 'RENDERER', `Closed tabs to the right of ${tabId}`);
    },
    [tabs, activeTabId]
  );

  const handleReloadTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) {
        handleReload();
      } else {
        const wv = tauriBridge.getWebview(tabId);
        if (wv && typeof wv.reload === 'function') {
          try {
            wv.reload();
          } catch {}
        }
      }
    },
    [activeTabId, handleReload]
  );

  const handleSortTabs = useCallback(
    async (mode: TabSortMode) => {
      setActiveSortMode(mode);
      if (mode === 'site') {
        setTabs((prev) => TabSortService.groupBySite(prev));
        logger.log('INFO', 'RENDERER', 'Tabs organized by site');
      } else if (mode === 'ram') {
        try {
          const ramMap = await tauriBridge.getWebviewsMemory(tabs);
          setTabs((prev) => TabSortService.sortByRam(prev, ramMap));
          logger.log('INFO', 'MEMORY', 'Tabs sorted by actual RAM usage');
        } catch (err) {
          console.warn('Failed to sort tabs by RAM:', err);
        }
      } else if (mode === 'duplicates') {
        setTabs((prev) => {
          const { sortedTabs } = TabSortService.groupDuplicates(prev);
          return sortedTabs;
        });
        logger.log('INFO', 'RENDERER', 'Duplicate tabs grouped together');
      } else if (mode === 'title') {
        setTabs((prev) => TabSortService.sortByTitle(prev));
        logger.log('INFO', 'RENDERER', 'Tabs sorted alphabetically by title');
      }
    },
    [tabs]
  );

  // Webview lifecycle synchronization
  const handleTabNavigationChange = useCallback(
    (tabId: string, url: string, canGoBack: boolean, canGoForward: boolean) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === tabId) {
            const isInternal = url.startsWith('freedom://');
            // Record history for external pages
            if (!isInternal && url) {
              HistoryService.addEntry(t.title, url, t.favicon, false);
            }
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
      prev.map((t) => {
        if (t.id === tabId) {
          HistoryService.updateEntryTitleAndFavicon(t.url, title, undefined);
          return { ...t, title };
        }
        return t;
      })
    );
  }, []);

  const handleTabFaviconChange = useCallback((tabId: string, favicon: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          HistoryService.updateEntryTitleAndFavicon(t.url, undefined, favicon);
          return { ...t, favicon };
        }
        return t;
      })
    );
  }, []);

  const handleTabLoadingChange = useCallback((tabId: string, isLoading: boolean) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          if (!isLoading && t.url && !t.url.startsWith('freedom://')) {
            HistoryService.addEntry(t.title, t.url, t.favicon, false);
          }
          return { ...t, isLoading };
        }
        return t;
      })
    );
  }, []);

  const handleTabZoomChange = useCallback((tabId: string, zoomLevel: number) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, zoomLevel } : t))
    );
  }, []);

  // Per-site Zoom synchronization when active tab changes
  useEffect(() => {
    if (activeTab) {
      const storedZoom = ZoomService.getZoomForUrl(activeTab.url);
      if (storedZoom !== activeTab.zoomLevel) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, zoomLevel: storedZoom } : t))
        );
      }
      if (!activeTab.url.startsWith('freedom://')) {
        tauriBridge.setWebviewZoom(activeTab.id, (storedZoom || 100) / 100);
      }
    }
  }, [activeTab?.id, activeTab?.url]);

  // Electron IPC events (downloads, new-window, context menu open-tab, search-text)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.on) {
      const unsubNewWindow = (window as any).electronAPI.on('webview-new-window', ({ url }: { url: string }) => {
        handleNewTab(url);
      });
      const unsubOpenTab = (window as any).electronAPI.on('webview-open-tab', ({ url }: { url: string }) => {
        handleNewTab(url);
      });
      const unsubSearchText = (window as any).electronAPI.on('webview-search-text', ({ text }: { text: string }) => {
        const targetUrl = SearchEngineService.resolveInputToUrl(text, settings.defaultSearchEngine);
        handleNewTab(targetUrl);
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

      // Guest webview keyboard events forwarding
      const unsubZoomIn = (window as any).electronAPI.on('webview-zoom-in', () => {
        handleZoomIn();
      });
      const unsubZoomOut = (window as any).electronAPI.on('webview-zoom-out', () => {
        handleZoomOut();
      });
      const unsubZoomReset = (window as any).electronAPI.on('webview-zoom-reset', () => {
        handleResetZoom();
      });
      const unsubShortcut = (window as any).electronAPI.on('webview-shortcut', (action: string) => {
        switch (action) {
          case 'new-tab':
            handleNewTab('freedom://newtab');
            break;
          case 'close-tab':
            if (activeTabId) handleCloseTab(activeTabId);
            break;
          case 'restore-tab':
            handleRestoreClosedTab();
            break;
          case 'focus-url': {
            const omnibar = document.getElementById('browser-omnibar-input');
            omnibar?.focus();
            (omnibar as HTMLInputElement)?.select?.();
            break;
          }
          case 'find-in-page':
            setFindState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
            break;
          case 'open-history':
            setIsHistoryOpen((prev) => !prev);
            break;
          case 'toggle-bookmark':
            handleToggleBookmark();
            break;
          case 'open-downloads':
            setIsDownloadsOpen((prev) => !prev);
            break;
          case 'reload':
            handleReload();
            break;
          case 'hard-reload':
            if (activeTab) tauriBridge.reloadTab(activeTab.id, true);
            break;
        }
      });

      return () => {
        unsubNewWindow?.();
        unsubOpenTab?.();
        unsubSearchText?.();
        unsubDlStart?.();
        unsubDlProgress?.();
        unsubDlDone?.();
        unsubZoomIn?.();
        unsubZoomOut?.();
        unsubZoomReset?.();
        unsubShortcut?.();
      };
    }
  }, [
    handleNewTab,
    handleCloseTab,
    handleRestoreClosedTab,
    handleToggleBookmark,
    handleReload,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    settings.defaultSearchEngine,
    activeTabId,
    activeTab,
  ]);

  // Full suite of Standard Browser Shortcuts (Requirement 8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl+L: Focus address bar
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const omnibar = document.getElementById('browser-omnibar-input');
        omnibar?.focus();
        (omnibar as HTMLInputElement)?.select?.();
        return;
      }

      // Ctrl+T: New tab
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab('freedom://newtab');
        return;
      }

      // Ctrl+Shift+T: Restore recently closed tab
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleRestoreClosedTab();
        return;
      }

      // Ctrl+W: Close current tab
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) handleCloseTab(activeTabId);
        return;
      }

      // Ctrl+Tab: Next tab
      if (isCtrlOrCmd && !e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTabId(tabs[nextIndex].id);
        return;
      }

      // Ctrl+Shift+Tab: Previous tab
      if (isCtrlOrCmd && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTabId(tabs[prevIndex].id);
        return;
      }

      // Ctrl+F: Find in page
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
        return;
      }

      // Ctrl+D: Toggle Bookmark
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleToggleBookmark();
        return;
      }

      // Ctrl+H: History
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsHistoryOpen((prev) => !prev);
        return;
      }

      // Ctrl+J: Downloads
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsDownloadsOpen((prev) => !prev);
        return;
      }

      // Ctrl+R: Reload active tab
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReload();
        return;
      }

      // Ctrl+Shift+R: Hard reload
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (activeTab) tauriBridge.reloadTab(activeTab.id, true);
        return;
      }

      // Ctrl+0 or Numpad0: Reset zoom
      if (isCtrlOrCmd && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        handleResetZoom();
        return;
      }

      // Ctrl++ or Ctrl+=: Zoom in
      if (
        isCtrlOrCmd &&
        (e.key === '=' ||
          e.key === '+' ||
          e.key === 'Add' ||
          e.code === 'Equal' ||
          e.code === 'NumpadAdd')
      ) {
        e.preventDefault();
        handleZoomIn();
        return;
      }

      // Ctrl+- or Ctrl+_: Zoom out
      if (
        isCtrlOrCmd &&
        (e.key === '-' ||
          e.key === '_' ||
          e.key === 'Subtract' ||
          e.code === 'Minus' ||
          e.code === 'NumpadSubtract')
      ) {
        e.preventDefault();
        handleZoomOut();
        return;
      }

      // Shift+Esc: Task Manager
      if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        setIsTaskManagerOpen((prev) => !prev);
        return;
      }

      // F12 or Ctrl+Shift+I: DevTools
      if (e.key === 'F12' || (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        setIsDevToolsOpen((prev) => !prev);
        return;
      }

      // Ctrl+,: Settings
      if (isCtrlOrCmd && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Escape: Close transient UI
      if (e.key === 'Escape') {
        if (findState.isOpen) {
          handleCloseFind();
        } else if (isHistoryOpen) {
          setIsHistoryOpen(false);
        } else if (isBookmarksOpen) {
          setIsBookmarksOpen(false);
        } else if (isDownloadsOpen) {
          setIsDownloadsOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isAboutOpen) {
          setIsAboutOpen(false);
        } else if (isTaskManagerOpen) {
          setIsTaskManagerOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    tabs,
    activeTabId,
    activeTab,
    findState.isOpen,
    isHistoryOpen,
    isBookmarksOpen,
    isDownloadsOpen,
    isSettingsOpen,
    isAboutOpen,
    isTaskManagerOpen,
    handleNewTab,
    handleRestoreClosedTab,
    handleCloseTab,
    handleToggleBookmark,
    handleReload,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleCloseFind,
  ]);

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
          settings.backgroundParticlesEnabled &&
          activeTab?.url === 'freedom://newtab'
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

      {/* Top Chrome: Tabs Bar (with Window Drag Region & Window Controls) */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={() => handleNewTab('freedom://newtab')}
        headerColorClass={getHeaderColorClass()}
        onRestoreClosedTab={handleRestoreClosedTab}
        closedTabsCount={closedTabsCount}
        onSortTabs={handleSortTabs}
        activeSortMode={activeSortMode}
        onDuplicateTab={handleDuplicateTab}
        onReloadTab={handleReloadTab}
        onSuspendTab={handleSuspendTab}
        onSuspendTabs={handleSuspendTabs}
        onCloseTabsFromSite={handleCloseTabsFromSite}
        onCloseOtherTabs={handleCloseOtherTabs}
        onCloseTabsToRight={handleCloseTabsToRight}
      />

      {/* Navigation & Controls Bar (Below the Tab Bar) */}
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
        isBookmarked={isCurrentBookmarked}
        onToggleBookmark={handleToggleBookmark}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onToggleFind={() => setFindState((prev) => ({ ...prev, isOpen: !prev.isOpen }))}
        zoomLevel={activeTab?.zoomLevel || 100}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onSortTabs={handleSortTabs}
      />

      {/* Bookmarks Bar */}
      <BookmarksBar
        bookmarks={bookmarks}
        onNavigate={handleNavigate}
        onOpenBookmarksManager={() => setIsBookmarksOpen(true)}
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
          onFoundInPage={handleFoundInPage}
          onTabZoomChange={handleTabZoomChange}
        />

        {/* Find In Page Overlay */}
        <FindInPageBar
          isOpen={findState.isOpen}
          onClose={handleCloseFind}
          onFind={handleFind}
          activeMatchOrdinal={findState.activeMatchOrdinal}
          numberOfMatches={findState.numberOfMatches}
          searchText={findState.text}
          setSearchText={(text) => setFindState((prev) => ({ ...prev, text }))}
        />
      </div>

      {/* Developer Tools Drawer */}
      {isDevToolsOpen && (
        <DevToolsDrawer
          isOpen={isDevToolsOpen}
          onClose={() => setIsDevToolsOpen(false)}
          activeTab={activeTab}
        />
      )}

      {/* Downloads Popover Drawer */}
      {isDownloadsOpen && (
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
          onRemoveItem={handleRemoveDownloadItem}
        />
      )}

      {/* History Drawer */}
      {isHistoryOpen && (
        <HistoryDrawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      {/* Bookmarks Drawer */}
      {isBookmarksOpen && (
        <BookmarksDrawer
          isOpen={isBookmarksOpen}
          onClose={() => setIsBookmarksOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      {/* Task Manager Modal */}
      {isTaskManagerOpen && (
        <TaskManagerModal
          isOpen={isTaskManagerOpen}
          onClose={() => setIsTaskManagerOpen(false)}
          tabs={tabs}
          onTerminateTab={handleTerminateTab}
          onReloadTab={handleReload}
          onSuspendTab={handleSuspendTab}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
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
      )}

      {/* About Modal */}
      {isAboutOpen && (
        <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      )}

      {/* Freedom Mascot: Freen in bottom-right corner */}
      <FreenMascot enabled={settings.showFreenMascot} />
    </div>
  );
}
