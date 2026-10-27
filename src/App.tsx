import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { FRCPopover } from './components/FRCPopover';
import { BrowserTab, DownloadItem, Bookmark, FindInPageState } from './browser/types';
import { SystemStats } from './taskmanager/types';
import { BrowserSettings } from './settings/types';
import { DEFAULT_SETTINGS } from './settings/defaults';
import { Sidebar, SidebarSection } from './components/Sidebar';
import { TabsOverview } from './components/TabsOverview';
import { SearchEngineService } from './services/searchEngineService';
import { logger } from './services/loggerService';
import { tauriBridge } from './services/tauriBridge';
import { frcService } from './services/frcService';
import { HistoryService } from './services/historyService';
import { BookmarkService } from './services/bookmarkService';
import { SessionService } from './services/sessionService';
import { ZoomService } from './services/zoomService';
import { TabSortService, TabSortMode } from './services/tabSortService';
import { FaviconService } from './services/faviconService';
import { SplitViewService, SplitViewState, SplitLayoutType } from './services/splitViewService';
import { SessionRestoreService } from './services/sessionRestoreService';
import { CloseConfirmationModal } from './components/CloseConfirmationModal';
import { I18nProvider } from './i18n';
import { FileCode, AppWindow, ShieldCheck, EyeOff } from 'lucide-react';
import { translate, normalizeLanguage } from './i18n';

const SETTINGS_KEY = 'freedom_browser_settings';
const TABS_KEY = 'freedom_browser_tabs';
const DOWNLOADS_KEY = 'freedom_browser_downloads_v2';

export default function App() {
  // Settings State
  const [settings, setSettings] = useState<BrowserSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) return DEFAULT_SETTINGS;
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      // One-time switch to the redesigned default theme; later choices are respected
      if (!parsed.uiDesignVersion || parsed.uiDesignVersion < 2) {
        parsed.uiDesignVersion = 2;
        parsed.themePreset = DEFAULT_SETTINGS.themePreset;
        parsed.palette = DEFAULT_SETTINGS.palette;
      }
      return parsed;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Tabs State: initialized from CLI URL argument, or restored from previous session, or fresh New Tab
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const openUrl = params.get('openUrl');
      const tabCount = parseInt(params.get('tabCount') || '1', 10);

      // 1. Direct file/URL opening via CLI / Open With has highest priority
      if (openUrl) {
        return [
          {
            id: 'tab-1',
            title: SearchEngineService.extractDomain(openUrl),
            url: openUrl,
            displayUrl: SearchEngineService.formatDisplayUrl(openUrl),
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            isSuspended: false,
            lastActive: Date.now(),
            isCrashed: false,
            history: [openUrl],
            historyIndex: 0,
            zoomLevel: ZoomService.getZoomForUrl(openUrl),
            security: openUrl.startsWith('https://') || openUrl.startsWith('file://') ? 'secure' : 'insecure',
          },
        ];
      }

      // 2. Restore saved session from previous exit if available
      const savedSession = SessionRestoreService.getSavedSession();
      if (savedSession && Array.isArray(savedSession.tabs) && savedSession.tabs.length > 0) {
        return savedSession.tabs.map((t) => ({
          id: t.id,
          title: t.title || (t.url === 'freedom://newtab' ? 'New Tab' : SearchEngineService.extractDomain(t.url)),
          url: t.url,
          displayUrl: t.displayUrl || SearchEngineService.formatDisplayUrl(t.url),
          favicon: t.favicon,
          isLoading: false,
          canGoBack: (t.historyIndex || 0) > 0,
          canGoForward: (t.historyIndex || 0) < ((t.history?.length || 1) - 1),
          isSuspended: false,
          lastActive: Date.now(),
          isCrashed: false,
          history: t.history && t.history.length > 0 ? t.history : [t.url],
          historyIndex: typeof t.historyIndex === 'number' ? t.historyIndex : 0,
          zoomLevel: t.zoomLevel || ZoomService.getZoomForUrl(t.url),
          security: t.url.startsWith('https://') || t.url.startsWith('file://') ? 'secure' : (t.url.startsWith('freedom://') ? 'internal' : 'insecure'),
          isPinned: t.isPinned,
        }));
      }

      // 3. Demo tab count argument if specified
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

    // 4. Default fresh New Tab
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

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openUrl')) return 'tab-1';
      const saved = SessionRestoreService.getSavedSession();
      if (saved && saved.activeTabId && saved.tabs.some((t) => t.id === saved.activeTabId)) {
        return saved.activeTabId;
      }
      if (saved && saved.tabs && saved.tabs.length > 0) {
        return saved.tabs[0].id;
      }
    } catch {}
    return 'tab-1';
  });

  // Fullscreen state (F11 / HTML5 fullscreen for games/video)
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Close & Session Restore Confirmation Modal state
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);

  // Modals and Drawers
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTabsOverviewOpen, setIsTabsOverviewOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('freedom_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('freedom_sidebar_collapsed', isSidebarCollapsed ? '1' : '0');
    } catch {}
  }, [isSidebarCollapsed]);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isFRCPopoverOpen, setIsFRCPopoverOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [frcStats, setFrcStats] = useState<SystemStats | null>(() => frcService.getLatestStats());

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => BookmarkService.getBookmarks());

  // Closed tabs count for TabBar restoration indicator
  const [closedTabsCount, setClosedTabsCount] = useState<number>(
    () => SessionService.getRecentlyClosed().length
  );

  // Tab sorting mode state
  const [activeSortMode, setActiveSortMode] = useState<TabSortMode | 'none'>('none');

  // Split View state
  const [splitViewState, setSplitViewState] = useState<SplitViewState>(() => {
    const loaded = SplitViewService.loadState();
    return SplitViewService.validateState(loaded, tabs.map((t) => t.id));
  });

  // Persist Split View state changes
  useEffect(() => {
    SplitViewService.saveState(splitViewState);
  }, [splitViewState]);

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
        tauriBridge.setDownloadDir(nativeDir);
      } else if (settings.downloadsLocation) {
        tauriBridge.setDownloadDir(settings.downloadsLocation);
      }
    };
    initDefaultDir();
    if (settings.language) {
      tauriBridge.setLanguage(settings.language);
    }
  }, []);

  // Synchronize dynamic settings changes with native backend
  useEffect(() => {
    if (settings.downloadsLocation) {
      tauriBridge.setDownloadDir(settings.downloadsLocation);
    }
  }, [settings.downloadsLocation]);

  useEffect(() => {
    if (settings.language) {
      tauriBridge.setLanguage(settings.language);
    }
  }, [settings.language]);

  // Persist Settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }
  }, [settings]);

  const activeTab = useMemo(() => {
    if (splitViewState.enabled && splitViewState.panes.length > 0) {
      const activePane =
        splitViewState.panes.find((p) => p.id === splitViewState.activePaneId) ||
        splitViewState.panes[0];
      const found = tabs.find((t) => t.id === activePane?.tabId);
      if (found) return found;
    }
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId, splitViewState]);

  // Freedom RAM Control (FRC) - Integrated Lifecycle, Telemetry & Dynamic Eviction Engine
  useEffect(() => {
    let isMounted = true;

    const runFRCExecutionCycle = async () => {
      try {
        const metricsData = await tauriBridge.getSystemMetrics(tabs.length);
        if (!isMounted || !metricsData) return;

        // Fetch non-duplicated per-tab webview physical memory
        const webviewsMem = await tauriBridge.getWebviewsMemory(tabs);

        setFrcStats(metricsData.stats);
        frcService.updateLatestStats(metricsData.stats, metricsData.processes || []);

        const frcConfig = frcService.getSettings();
        const now = Date.now();
        const pressurePct = metricsData.stats.memoryPressurePercent || metricsData.stats.systemRamPercent || 0;
        const isCriticalPressure = pressurePct >= (100 - frcConfig.critMemoryPercent);

        setTabs((prevTabs) => {
          let hasChanges = false;
          const updatedTabs = prevTabs.map((tab) => {
            const privateBytes = webviewsMem[tab.id] || tab.privateMemoryBytes;
            const updatedTab = privateBytes !== tab.privateMemoryBytes
              ? { ...tab, privateMemoryBytes: privateBytes }
              : tab;

            if (updatedTab.id === activeTabId) {
              if (updatedTab.lifecycleState !== 'active' || updatedTab.isSuspended) {
                hasChanges = true;
                return { ...updatedTab, lifecycleState: 'active' as const, isSuspended: false };
              }
              return updatedTab;
            }

            // Tabs in split view active panes are considered active
            const isInSplitActive =
              splitViewState.enabled &&
              splitViewState.panes.some((p) => p.tabId === updatedTab.id);

            if (isInSplitActive) {
              if (updatedTab.lifecycleState !== 'active') {
                hasChanges = true;
                return { ...updatedTab, lifecycleState: 'active' as const, isSuspended: false };
              }
              return updatedTab;
            }

            if (frcConfig.mode === 'unrestricted' || !frcConfig.enableAutoHibernation) {
              return updatedTab;
            }

            const nextState = frcService.evaluateTabLifecycle(updatedTab, activeTabId, now);
            if (nextState !== updatedTab.lifecycleState) {
              hasChanges = true;
              if (nextState === 'hibernated' && !updatedTab.isSuspended) {
                frcService.serializeTabSession(updatedTab);
                logger.log('INFO', 'MEMORY', `FRC-LIFE: Auto-hibernated tab '${updatedTab.title}' (idle timeout exceeded).`);
                return { ...updatedTab, lifecycleState: nextState, isSuspended: true };
              }
              if (nextState === 'frozen') {
                frcService.serializeTabSession(updatedTab);
                logger.log('INFO', 'MEMORY', `FRC-LIFE: Auto-frozen tab '${updatedTab.title}' (idle timeout exceeded, unmounting webview).`);
                return { ...updatedTab, lifecycleState: nextState };
              }
              return { ...updatedTab, lifecycleState: nextState };
            }

            return updatedTab;
          });

          // Pressure-driven cascade eviction (FRC-TRIM-01)
          if (isCriticalPressure && frcConfig.enableDynamicTrimming) {
            const candidates = frcService.getEvictionCandidates(updatedTabs, activeTabId, now);
            const eligible = candidates.filter((c) => !c.isGuarded);
            if (eligible.length > 0) {
              const topCandidate = eligible[0];
              const idx = updatedTabs.findIndex((t) => t.id === topCandidate.tabId);
              if (idx !== -1 && !updatedTabs[idx].isSuspended) {
                frcService.serializeTabSession(updatedTabs[idx]);
                updatedTabs[idx] = {
                  ...updatedTabs[idx],
                  isSuspended: true,
                  lifecycleState: 'hibernated',
                };
                hasChanges = true;
                logger.log('WARN', 'MEMORY', `FRC-TRIM: Cascade eviction hibernated tab '${topCandidate.tabTitle}' (Score: ${topCandidate.score}) under critical pressure (${pressurePct}%).`);
              }
            }
          }

          return hasChanges ? updatedTabs : prevTabs;
        });
      } catch (err) {
        console.warn('FRC cycle error:', err);
      }
    };

    runFRCExecutionCycle();
    const interval = setInterval(runFRCExecutionCycle, frcService.getSettings().pollingIntervalMs || 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [tabs.length, activeTabId, splitViewState]);

  // Tab operations
  const handleSelectTab = useCallback((id: string) => {
    setSplitViewState((prev) => {
      if (!prev.enabled) return prev;
      if (id === prev.leftTabId) {
        return { ...prev, activePane: 'left' };
      }
      if (id === prev.rightTabId) {
        return { ...prev, activePane: 'right' };
      }
      return {
        ...prev,
        leftTabId: prev.activePane === 'left' ? id : prev.leftTabId,
        rightTabId: prev.activePane === 'right' ? id : prev.rightTabId,
      };
    });

    setActiveTabId(id);
    const session = frcService.getSerializedTabSession(id);
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            lastActive: Date.now(),
            isSuspended: false,
            lifecycleState: 'active' as const,
            accessCount: (t.accessCount || 0) + 1,
            url: session ? session.url : t.url,
            title: session ? session.title : t.title,
            favicon: session?.favicon || t.favicon,
          };
        }
        return t;
      })
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
      security: targetUrl.startsWith('https://') || targetUrl.startsWith('file://') ? 'secure' : 'internal',
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);

    // If Split View is active, route new tab into the active pane
    setSplitViewState((prev) => {
      if (!prev.enabled) return prev;
      return {
        ...prev,
        leftTabId: prev.activePane === 'left' ? newId : prev.leftTabId,
        rightTabId: prev.activePane === 'right' ? newId : prev.rightTabId,
      };
    });

    logger.log('INFO', 'RENDERER', `Created tab ${newId} with URL ${targetUrl}`);
  }, []);

  const handleOpenFile = useCallback(async () => {
    try {
      if ((window as any).electronAPI?.chooseFileToOpen) {
        const fileUrl = await (window as any).electronAPI.chooseFileToOpen();
        if (fileUrl) {
          handleNewTab(fileUrl);
        }
      }
    } catch (err) {
      console.warn('Failed to open file picker:', err);
    }
  }, [handleNewTab]);

  const handleCloseTab = useCallback(
    (id: string) => {
      // Destroy native WebKitGTK / WebView2 child webview if active
      tauriBridge.closeNativeTab(id);
      frcService.removeSerializedTabSession(id);

      // Handle Split View tab closing safely
      setSplitViewState((prev) => {
        if (!prev.enabled) return prev;
        if (id === prev.leftTabId || id === prev.rightTabId) {
          const remainingTabId = id === prev.leftTabId ? prev.rightTabId : prev.leftTabId;
          if (remainingTabId) {
            setActiveTabId(remainingTabId);
          }
          return {
            ...prev,
            enabled: false,
          };
        }
        return prev;
      });

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

  // Session Restore & Application Close Handlers
  const handleAttemptClose = useCallback(() => {
    if (SessionRestoreService.hasRestorableTabs(tabs)) {
      setShowCloseConfirmModal(true);
    } else {
      SessionRestoreService.clearSavedSession();
      tauriBridge.forceClose();
    }
  }, [tabs]);

  const handleConfirmCloseWithoutSaving = useCallback(() => {
    setShowCloseConfirmModal(false);
    SessionRestoreService.clearSavedSession();
    tauriBridge.forceClose();
  }, []);

  const handleConfirmSaveAndClose = useCallback(() => {
    setShowCloseConfirmModal(false);
    SessionRestoreService.saveSession(tabs, activeTabId);
    tauriBridge.forceClose();
  }, [tabs, activeTabId]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirmModal(false);
  }, []);

  // Listen for native window close interception from Electron
  useEffect(() => {
    if ((window as any).electronAPI?.on) {
      const unsub = (window as any).electronAPI.on('request-app-close', () => {
        handleAttemptClose();
      });
      return unsub;
    }
  }, [handleAttemptClose]);

  // Listen for native fullscreen state changes from Electron / HTML5 fullscreen API
  useEffect(() => {
    tauriBridge.isFullScreen().then(setIsFullScreen);

    if ((window as any).electronAPI?.on) {
      const unsubFs = (window as any).electronAPI.on('window-fullscreen-change', (fs: boolean) => {
        setIsFullScreen(fs);
      });
      return unsubFs;
    }
  }, []);

  // Clear saved session flag after startup so it's not reused unless deliberately saved upon next close
  useEffect(() => {
    SessionRestoreService.clearSavedSession();
  }, []);

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
    (url: string, targetId?: string) => {
      const destId = targetId || activeTab?.id;
      if (!destId) return;

      const domain = SearchEngineService.extractDomain(url);
      const isInternal = url.startsWith('freedom://');
      const isNewTab = url === 'freedom://newtab';

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

      // If tab is already on New Tab page, clicking Home keeps title as 'New Tab' without redundant reload
      const currentTab = tabs.find((t) => t.id === destId);
      if (isNewTab && currentTab && currentTab.url === 'freedom://newtab') {
        if (currentTab.title !== 'New Tab' || currentTab.favicon) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === destId ? { ...t, title: 'New Tab', displayUrl: 'freedom://newtab', favicon: undefined } : t
            )
          );
        }
        return;
      }

      if (isInternal) {
        tauriBridge.hideNativeWebviews();
      } else {
        tauriBridge.navigateNative(destId, url);
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === destId) {
            const nextHistory = [...t.history.slice(0, t.historyIndex + 1), url];
            const siteZoom = ZoomService.getZoomForUrl(url);
            return {
              ...t,
              url,
              displayUrl: url,
              title: isNewTab ? 'New Tab' : url === 'freedom://memory' ? 'Process Diagnostics (FRC)' : isInternal ? 'Freedom Tab' : domain,
              favicon: isInternal ? undefined : t.favicon,
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
      logger.log('INFO', 'NETWORK', `Navigated tab ${destId} to ${url}`);
    },
    [activeTab, tabs]
  );

  const handleBack = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.url.startsWith('freedom://')) return;
    const wentBack = await tauriBridge.goBackNative(activeTab.id);
    if (wentBack) return;
    // Webview has no earlier entry: return to the internal page (e.g. New Tab) the site was opened from
    const prevUrl = activeTab.history[activeTab.historyIndex - 1];
    if (!prevUrl || !prevUrl.startsWith('freedom://')) return;
    tauriBridge.hideNativeWebviews();
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: prevUrl,
              displayUrl: prevUrl,
              title: prevUrl === 'freedom://newtab' ? 'New Tab' : prevUrl === 'freedom://memory' ? 'Process Diagnostics (FRC)' : 'Freedom Tab',
              favicon: undefined,
              isLoading: false,
              historyIndex: t.historyIndex - 1,
              canGoBack: t.historyIndex - 1 > 0,
              canGoForward: false,
              security: 'internal',
            }
          : t
      )
    );
  }, [activeTab]);

  const handleForward = useCallback(() => {
    if (!activeTab) return;
    if (!activeTab.url.startsWith('freedom://')) {
      tauriBridge.goForwardNative(activeTab.id);
    }
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
    const session = frcService.getSerializedTabSession(tabId);
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          return {
            ...t,
            isSuspended: false,
            lifecycleState: 'active' as const,
            lastActive: Date.now(),
            accessCount: (t.accessCount || 0) + 1,
            url: session ? session.url : t.url,
            title: session ? session.title : t.title,
            favicon: session?.favicon || t.favicon,
          };
        }
        return t;
      })
    );
    logger.log('INFO', 'MEMORY', `FRC-LIFE: Restored hibernated tab ${tabId}.`);
  }, []);

  const handleHibernateTab = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          frcService.serializeTabSession(t);
          logger.log('INFO', 'MEMORY', `FRC-LIFE: Hibernated tab '${t.title}' (${t.id}).`);
          return {
            ...t,
            lifecycleState: 'hibernated' as const,
            isSuspended: true,
          };
        }
        return t;
      })
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
      prev.map((t) => {
        if (t.id === tabId) {
          frcService.serializeTabSession(t);
          return { ...t, isSuspended: true, lifecycleState: 'hibernated' as const };
        }
        return t;
      })
    );
    logger.log('INFO', 'MEMORY', `Tab ${tabId} suspended manually.`);
  }, []);

  const handleSuspendTabs = useCallback((tabIds: string[]) => {
    const idSet = new Set(tabIds);
    setTabs((prev) =>
      prev.map((t) => {
        if (idSet.has(t.id) && !t.url.startsWith('freedom://')) {
          frcService.serializeTabSession(t);
          return { ...t, isSuspended: true, lifecycleState: 'hibernated' as const };
        }
        return t;
      })
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

  // Split View Handlers
  const handleToggleSplitView = useCallback(() => {
    setSplitViewState((prev) => {
      if (prev.enabled) {
        return { ...prev, enabled: false };
      }
      const p1Id = activeTab?.id || tabs[0]?.id || `tab-${Date.now()}`;
      let p2Tab = tabs.find((t) => t.id !== p1Id);
      let p2Id = p2Tab?.id;
      if (!p2Id) {
        const newRightTabId = `tab-${Date.now()}`;
        const newTab: BrowserTab = {
          id: newRightTabId,
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
        };
        setTabs((tList) => [...tList, newTab]);
        p2Id = newRightTabId;
      }

      const panes = [
        { id: 'pane-1', tabId: p1Id },
        { id: 'pane-2', tabId: p2Id },
      ];

      return {
        enabled: true,
        panes,
        activePaneId: 'pane-2',
        layout: '2-vertical',
        dividerPositions: SplitViewService.getDefaultDividers('2-vertical'),
        leftTabId: p1Id,
        rightTabId: p2Id,
        activePane: 'right',
        dividerPosition: 50,
      };
    });
  }, [activeTab, tabs]);

  const handleOpenInSplitView = useCallback(
    (targetTabId: string) => {
      setSplitViewState((prev) => {
        if (!prev.enabled || prev.panes.length < 2) {
          const p1Id =
            activeTabId === targetTabId
              ? tabs.find((t) => t.id !== targetTabId)?.id || targetTabId
              : activeTabId;
          const panes = [
            { id: 'pane-1', tabId: p1Id },
            { id: 'pane-2', tabId: targetTabId },
          ];
          return {
            enabled: true,
            panes,
            activePaneId: 'pane-2',
            layout: '2-vertical',
            dividerPositions: SplitViewService.getDefaultDividers('2-vertical'),
            leftTabId: p1Id,
            rightTabId: targetTabId,
            activePane: 'right',
            dividerPosition: 50,
          };
        }

        const existingPaneIndex = prev.panes.findIndex((p) => p.tabId === targetTabId);
        if (existingPaneIndex !== -1) {
          return { ...prev, activePaneId: prev.panes[existingPaneIndex].id };
        }

        if (prev.panes.length < 4) {
          const newPaneId = `pane-${prev.panes.length + 1}`;
          const newPanes = [...prev.panes, { id: newPaneId, tabId: targetTabId }];
          const layout = SplitViewService.getDefaultLayoutForCount(newPanes.length);
          return {
            ...prev,
            panes: newPanes,
            activePaneId: newPaneId,
            layout,
            dividerPositions: SplitViewService.getDefaultDividers(layout),
          };
        }

        const updatedPanes = prev.panes.map((p) =>
          p.id === prev.activePaneId ? { ...p, tabId: targetTabId } : p
        );
        return {
          ...prev,
          panes: updatedPanes,
        };
      });
      setActiveTabId(targetTabId);
    },
    [activeTabId, tabs]
  );

  const handleSelectPane = useCallback((paneId: string) => {
    setSplitViewState((prev) => {
      const found = prev.panes.find((p) => p.id === paneId);
      if (found) {
        setActiveTabId(found.tabId);
      }
      return {
        ...prev,
        activePaneId: paneId,
        activePane: paneId === prev.panes[1]?.id ? 'right' : 'left',
      };
    });
  }, []);

  const handleClosePane = useCallback((paneId: string) => {
    setSplitViewState((prev) => {
      const remainingPanes = prev.panes.filter((p) => p.id !== paneId);
      if (remainingPanes.length < 2) {
        const remainingTabId = remainingPanes[0]?.tabId || prev.panes[0]?.tabId;
        if (remainingTabId) {
          setActiveTabId(remainingTabId);
        }
        return {
          ...prev,
          enabled: false,
          panes: remainingPanes,
        };
      }

      const layout = SplitViewService.getAvailableLayouts(remainingPanes.length).includes(prev.layout)
        ? prev.layout
        : SplitViewService.getDefaultLayoutForCount(remainingPanes.length);

      const activePaneId = remainingPanes.some((p) => p.id === prev.activePaneId)
        ? prev.activePaneId
        : remainingPanes[0].id;

      const activePane = remainingPanes.find((p) => p.id === activePaneId);
      if (activePane) {
        setActiveTabId(activePane.tabId);
      }

      return {
        ...prev,
        panes: remainingPanes,
        activePaneId,
        layout,
        dividerPositions: SplitViewService.getDefaultDividers(layout),
      };
    });
  }, []);

  const handleSelectLayout = useCallback((layout: SplitLayoutType) => {
    setSplitViewState((prev) => ({
      ...prev,
      layout,
      dividerPositions: SplitViewService.getDefaultDividers(layout),
    }));
  }, []);

  const handleAddPane = useCallback(() => {
    setSplitViewState((prev) => {
      if (prev.panes.length >= 4) return prev;

      const usedTabIds = new Set(prev.panes.map((p) => p.tabId));
      let targetTabId = tabs.find((t) => !usedTabIds.has(t.id))?.id;

      if (!targetTabId) {
        targetTabId = `tab-${Date.now()}`;
        const newTab: BrowserTab = {
          id: targetTabId,
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
        };
        setTabs((tList) => [...tList, newTab]);
      }

      const newPaneId = `pane-${prev.panes.length + 1}`;
      const newPanes = [...prev.panes, { id: newPaneId, tabId: targetTabId }];
      const layout = SplitViewService.getDefaultLayoutForCount(newPanes.length);

      setActiveTabId(targetTabId);

      return {
        ...prev,
        panes: newPanes,
        activePaneId: newPaneId,
        layout,
        dividerPositions: SplitViewService.getDefaultDividers(layout),
      };
    });
  }, [tabs]);

  const handleResetDividers = useCallback(() => {
    setSplitViewState((prev) => ({
      ...prev,
      dividerPositions: SplitViewService.getDefaultDividers(prev.layout),
    }));
  }, []);

  const handleSwitchPaneTab = useCallback((paneId: string, targetTabId: string) => {
    setSplitViewState((prev) => {
      const otherPane = prev.panes.find((p) => p.tabId === targetTabId && p.id !== paneId);
      const currentPane = prev.panes.find((p) => p.id === paneId);
      const currentTabId = currentPane?.tabId;

      const updatedPanes = prev.panes.map((p) => {
        if (p.id === paneId) {
          return { ...p, tabId: targetTabId };
        }
        if (otherPane && currentTabId && p.id === otherPane.id) {
          return { ...p, tabId: currentTabId };
        }
        return p;
      });

      return {
        ...prev,
        panes: updatedPanes,
        activePaneId: paneId,
      };
    });
    setActiveTabId(targetTabId);
  }, []);

  const handleNewTabInPane = useCallback((paneId: string) => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newTabId,
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
    };
    setTabs((tList) => [...tList, newTab]);

    setSplitViewState((prev) => {
      const updatedPanes = prev.panes.map((p) =>
        p.id === paneId ? { ...p, tabId: newTabId } : p
      );
      return {
        ...prev,
        panes: updatedPanes,
        activePaneId: paneId,
      };
    });
    setActiveTabId(newTabId);
  }, []);

  const handleDividerChange = useCallback((positions: number[]) => {
    setSplitViewState((prev) => ({ ...prev, dividerPositions: positions }));
  }, []);

  const handlePaneNavigate = useCallback(
    (tabId: string, url: string) => {
      handleNavigate(url, tabId);
    },
    [handleNavigate]
  );

  const handlePaneBack = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;
      if (!target.url.startsWith('freedom://')) {
        tauriBridge.goBackNative(tabId);
      }
    },
    [tabs]
  );

  const handlePaneForward = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;
      if (!target.url.startsWith('freedom://')) {
        tauriBridge.goForwardNative(tabId);
      }
    },
    [tabs]
  );

  const handlePaneReload = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;
      if (!target.url.startsWith('freedom://')) {
        tauriBridge.reloadNative(tabId);
      }
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, isLoading: true } : t))
      );
      setTimeout(() => {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t))
        );
      }, 600);
    },
    [tabs]
  );

  // Webview lifecycle synchronization
  const handleTabNavigationChange = useCallback(
    (
      tabId: string,
      data: {
        url: string;
        title?: string;
        favicon?: string;
        canGoBack: boolean;
        canGoForward: boolean;
      }
    ) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === tabId) {
            const url = data.url;
            const isInternal = url.startsWith('freedom://');
            const isNewTab = url === 'freedom://newtab';
            const title = isNewTab
              ? 'New Tab'
              : data.title || t.title || (isInternal ? 'Freedom Tab' : SearchEngineService.extractDomain(url));
            const favicon = isInternal
              ? undefined
              : (data.favicon || t.favicon || FaviconService.getFaviconSync(url));

            // Record history for external pages
            if (!isInternal && url) {
              HistoryService.addEntry(title, url, favicon, false);
            }

            return {
              ...t,
              url,
              displayUrl: url,
              title,
              favicon,
              // Also allow Back when the site was opened from an internal page (New Tab)
              canGoBack:
                data.canGoBack ||
                (!isInternal && (t.history[t.historyIndex - 1] || '').startsWith('freedom://')),
              canGoForward: data.canGoForward,
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
          const finalTitle = t.url === 'freedom://newtab' ? 'New Tab' : t.url.startsWith('freedom://') ? 'Freedom Tab' : title;
          if (!t.url.startsWith('freedom://')) {
            HistoryService.updateEntryTitleAndFavicon(t.url, finalTitle, undefined);
          }
          return { ...t, title: finalTitle };
        }
        return t;
      })
    );
  }, []);

  const handleTabFaviconChange = useCallback((tabId: string, favicon: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          if (t.url.startsWith('freedom://')) {
            return { ...t, favicon: undefined };
          }
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
      const unsubExternalUrl = (window as any).electronAPI.on('open-external-url', ({ url: incomingUrl }: { url: string }) => {
        if (!incomingUrl) return;
        setTabs((prev) => {
          if (prev.length === 1 && prev[0].url === 'freedom://newtab') {
            return [
              {
                ...prev[0],
                url: incomingUrl,
                displayUrl: SearchEngineService.formatDisplayUrl(incomingUrl),
                title: SearchEngineService.extractDomain(incomingUrl),
                isLoading: false,
                history: [incomingUrl],
                historyIndex: 0,
                zoomLevel: ZoomService.getZoomForUrl(incomingUrl),
                security: incomingUrl.startsWith('https://') || incomingUrl.startsWith('file://') ? 'secure' : 'insecure',
              },
            ];
          }
          const newId = `tab-${Date.now()}`;
          const newTab: BrowserTab = {
            id: newId,
            title: SearchEngineService.extractDomain(incomingUrl),
            url: incomingUrl,
            displayUrl: SearchEngineService.formatDisplayUrl(incomingUrl),
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            isSuspended: false,
            lastActive: Date.now(),
            isCrashed: false,
            history: [incomingUrl],
            historyIndex: 0,
            zoomLevel: ZoomService.getZoomForUrl(incomingUrl),
            security: incomingUrl.startsWith('https://') || incomingUrl.startsWith('file://') ? 'secure' : 'insecure',
          };
          setActiveTabId(newId);
          return [...prev, newTab];
        });
      });

      const unsubShortcut = (window as any).electronAPI.on('webview-shortcut', (action: string) => {
        switch (action) {
          case 'new-tab':
            handleNewTab('freedom://newtab');
            break;
          case 'open-file':
            handleOpenFile();
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
        unsubExternalUrl?.();
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
    handleOpenFile,
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

      // Ctrl+O: Open File
      if (isCtrlOrCmd && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFile();
        return;
      }

      // F11: Fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault();
        tauriBridge.toggleFullScreen().then((fs) => setIsFullScreen(fs));
        return;
      }

      // Escape: Close close-confirm modal, exit fullscreen, or close transient UI
      if (e.key === 'Escape') {
        if (showCloseConfirmModal) {
          setShowCloseConfirmModal(false);
          return;
        }
        if (isFullScreen) {
          tauriBridge.setFullScreen(false).then(() => setIsFullScreen(false));
          return;
        }
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
    isFullScreen,
    showCloseConfirmModal,
    findState.isOpen,
    isHistoryOpen,
    isBookmarksOpen,
    isDownloadsOpen,
    isSettingsOpen,
    isAboutOpen,
    isTaskManagerOpen,
    handleNewTab,
    handleOpenFile,
    handleRestoreClosedTab,
    handleCloseTab,
    handleToggleBookmark,
    handleReload,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleCloseFind,
  ]);

  // Global Drag & Drop: Drag any local HTML or file into the window to open in a new tab
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounter++;
        setIsDraggingFile(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDraggingFile(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingFile(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        let filePath = '';
        if ((window as any).electronAPI?.getPathForFile) {
          try {
            filePath = (window as any).electronAPI.getPathForFile(file);
          } catch {}
        }
        if (!filePath) {
          filePath = (file as any).path || '';
        }

        if (filePath) {
          const isWindows = /^[a-zA-Z]:[/\\]/.test(filePath);
          let fileUrl: string;
          if (filePath.startsWith('file://')) {
            fileUrl = filePath;
          } else if (isWindows) {
            fileUrl = 'file:///' + encodeURI(filePath.replace(/\\/g, '/'));
          } else {
            fileUrl = 'file://' + encodeURI(filePath);
          }
          handleNewTab(fileUrl);
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleNewTab]);

  const isPerformanceMode = settings.browserMode === 'performance';

  // Maps the active theme palette onto the design tokens declared in index.css
  const paletteToTokens = (p?: typeof settings.palette): Record<string, string> =>
    p
      ? {
          '--fb-accent': p.accentColor,
          '--fb-focus': p.focusColor,
          '--fb-bg': p.mainBg,
          '--fb-chrome': p.headerBg,
          '--fb-sidebar': p.sidebarBg,
          '--fb-surface': p.cardBg,
          '--fb-surface-hover': p.cardHoverBg,
          '--fb-surface-3': p.buttonHoverBg,
          '--fb-input': p.inputBg,
          '--fb-text': p.textColor,
          '--fb-text-2': p.secondaryTextColor,
          '--fb-border': p.borderColor,
          '--fb-scrollbar': p.scrollbarColor,
        }
      : {};

  // Keep the main process privacy filters (DNT/GPC, 3rd-party cookies, popups) in sync with Settings
  useEffect(() => {
    window.electronAPI?.setPrivacySettings?.({
      doNotTrack: settings.doNotTrack,
      blockThirdPartyCookies: settings.blockThirdPartyCookies,
      popupsBlocked: settings.popupsBlocked,
    });
  }, [settings.doNotTrack, settings.blockThirdPartyCookies, settings.popupsBlocked]);

  // Portals (menus, popovers) render into <body>, so tokens also live on <html>
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(paletteToTokens(settings.palette)).forEach(([k, v]) => v && root.style.setProperty(k, v));
  }, [settings.palette]);

  // Color theme classes & palette resolution
  const getBackgroundColor = () => {
    if (settings.applyThemeToBackground && settings.palette?.mainBg) {
      return settings.palette.mainBg;
    }
    if (!settings.applyThemeToBackground) {
      return '#06080b';
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
    <I18nProvider
      currentLanguage={settings.language}
      onLanguageChange={(newLang) =>
        setSettings((prev) => ({ ...prev, language: newLang }))
      }
    >
      <div
        id="freedom-browser-app"
      className={`relative flex flex-col h-screen w-screen overflow-hidden text-white font-sans select-none ${
        isPerformanceMode || !settings.uiAnimationsEnabled ? 'performance-mode' : ''
      }`}
      style={{
        backgroundColor: getBackgroundColor(),
        '--theme-accent': settings.palette?.accentColor || '#10b981',
        '--theme-bg': settings.applyThemeToBackground
          ? (settings.palette?.mainBg || '#06080b')
          : '#06080b',
        '--theme-header': settings.palette?.headerBg || '#090b10',
        '--theme-surface': settings.palette?.cardBg || '#12161f',
        '--theme-border': settings.palette?.borderColor || '#232b3b',
        '--theme-text': settings.palette?.textColor || '#f8fafc',
        ...paletteToTokens(settings.palette),
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

      {/* Top Chrome: Tabs Bar, Navigation, Bookmarks (Hidden completely in F11 Fullscreen mode) */}
      {!isFullScreen && (
        <>
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
            splitViewState={splitViewState}
            onOpenInSplitView={handleOpenInSplitView}
            onCloseWindow={handleAttemptClose}
          />

          {/* Navigation & Controls Bar (Below the Tab Bar) */}
          <Navigation
            currentTab={activeTab}
            onNavigate={handleNavigate}
            onBack={handleBack}
            onForward={handleForward}
            onReload={handleReload}
            onStop={() => {
              if (activeTab) {
                tauriBridge.stopLoading(activeTab.id);
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false } : t))
                );
              }
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
            isSplitView={splitViewState.enabled}
            onToggleSplitView={handleToggleSplitView}
            onToggleFRCPopover={() => setIsFRCPopoverOpen((prev) => !prev)}
            isFRCPopoverOpen={isFRCPopoverOpen}
            browserRamMb={frcStats ? (frcStats.totalBrowserRamMb ?? frcStats.browserRamMb ?? Math.round(frcStats.totalBrowserRamBytes / (1024 * 1024))) : 0}
            systemRamMb={frcStats ? (frcStats.totalSystemRamMb ?? Math.round(frcStats.totalSystemRamBytes / (1024 * 1024))) : 0}
            memoryPressureLevel={frcStats?.memoryPressureLevel || 'normal'}
            privacyToggles={[
              { key: 'popupsBlocked', label: translate(normalizeLanguage(settings.language), 'menu.blockPopups'), value: settings.popupsBlocked, icon: AppWindow },
              { key: 'blockThirdPartyCookies', label: translate(normalizeLanguage(settings.language), 'menu.trackerProtection'), value: settings.blockThirdPartyCookies, icon: ShieldCheck },
              { key: 'doNotTrack', label: translate(normalizeLanguage(settings.language), 'menu.doNotTrack'), value: settings.doNotTrack, icon: EyeOff },
            ]}
            onTogglePrivacy={(key) =>
              setSettings((prev) => ({ ...prev, [key]: !prev[key as 'doNotTrack' | 'blockThirdPartyCookies' | 'popupsBlocked'] }))
            }
          />

          {/* Freedom RAM Control Popover */}
          <FRCPopover
            isOpen={isFRCPopoverOpen}
            onClose={() => setIsFRCPopoverOpen(false)}
            tabs={tabs}
            activeTabId={activeTabId}
            onHibernateTab={handleHibernateTab}
            onNavigate={handleNavigate}
          />

          {/* Bookmarks Bar */}
          <BookmarksBar
            bookmarks={bookmarks}
            onNavigate={handleNavigate}
            onOpenBookmarksManager={() => setIsBookmarksOpen(true)}
          />
        </>
      )}

      {/* Sidebar + Primary Browser Content Viewport */}
      <div className="relative flex flex-1 min-h-0 w-full">
      {!isFullScreen && (
        <Sidebar
          active={
            isTabsOverviewOpen
              ? 'tabs'
              : isBookmarksOpen
              ? 'bookmarks'
              : isHistoryOpen
              ? 'history'
              : isDownloadsOpen
              ? 'downloads'
              : activeTab?.url === 'freedom://newtab'
              ? 'home'
              : (null as SidebarSection)
          }
          collapsed={isSidebarCollapsed}
          tabsCount={tabs.length}
          activeDownloads={downloads.filter((d) => d.state === 'progressing').length}
          onHome={() => {
            setIsTabsOverviewOpen(false);
            handleNavigate('freedom://newtab');
          }}
          onTabs={() => setIsTabsOverviewOpen((v) => !v)}
          onBookmarks={() => setIsBookmarksOpen((v) => !v)}
          onHistory={() => setIsHistoryOpen((v) => !v)}
          onDownloads={() => setIsDownloadsOpen((v) => !v)}
          onSettings={() => setIsSettingsOpen(true)}
          onToggleCollapsed={() => setIsSidebarCollapsed((v) => !v)}
        />
      )}
      <div className="relative flex-1 min-w-0 overflow-hidden z-10">
        <WebviewContainer
          activeTab={activeTab}
          tabs={tabs}
          onNavigate={handleNavigate}
          onReload={handleReload}
          onWakeTab={handleWakeTab}
          onHibernateTab={handleHibernateTab}
          onTerminateTab={handleTerminateTab}
          onTabTitleChange={handleTabTitleChange}
          onTabFaviconChange={handleTabFaviconChange}
          onTabLoadingChange={handleTabLoadingChange}
          onTabNavigationChange={handleTabNavigationChange}
          onNewTabRequested={handleNewTab}
          defaultSearchEngine={settings.defaultSearchEngine}
          palette={settings.palette}
          isPerformanceMode={isPerformanceMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          showNewTabSettingsIcon={settings.showNewTabSettingsIcon}
          showFreedomIcon={settings.showFreedomIcon}
          onFoundInPage={handleFoundInPage}
          onTabZoomChange={handleTabZoomChange}
          splitViewState={splitViewState}
          onSelectPane={handleSelectPane}
          onClosePane={handleClosePane}
          onDividerChange={handleDividerChange}
          onPaneNavigate={handlePaneNavigate}
          onPaneBack={handlePaneBack}
          onPaneForward={handlePaneForward}
          onPaneReload={handlePaneReload}
          onSwitchPaneTab={handleSwitchPaneTab}
          onNewTabInPane={handleNewTabInPane}
          onSelectLayout={handleSelectLayout}
          onAddPane={handleAddPane}
          onResetDividers={handleResetDividers}
          onExitSplitView={handleToggleSplitView}
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

        {isTabsOverviewOpen && (
          <TabsOverview
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onNewTab={() => handleNewTab('freedom://newtab')}
            onSort={() => handleSortTabs('site')}
            onClose={() => setIsTabsOverviewOpen(false)}
          />
        )}
      </div>
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

      {/* Drag & Drop Visual Overlay (covers window and webviews during dragging) */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-emerald-500/80 transition-all">
          <div className="p-8 rounded-3xl bg-neutral-900/95 border border-emerald-500/30 shadow-2xl flex flex-col items-center gap-4 text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <FileCode className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-neutral-100">
                {settings.language === 'ru' ? 'Отпустите файл здесь' : 'Drop File Here'}
              </h3>
              <p className="text-xs text-neutral-400">
                {settings.language === 'ru'
                  ? 'Документ сразу откроется в новой вкладке Freedom Browser'
                  : 'The document will open in a new tab in Freedom Browser'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Close & Session Restore Confirmation Modal */}
      <CloseConfirmationModal
        isOpen={showCloseConfirmModal}
        tabsCount={tabs.length}
        onConfirmCloseWithoutSaving={handleConfirmCloseWithoutSaving}
        onConfirmSaveAndClose={handleConfirmSaveAndClose}
        onCancel={handleCancelClose}
      />

      {/* Freedom Mascot: Freen in bottom-right corner */}
      <FreenMascot enabled={settings.showFreenMascot} />
    </div>
    </I18nProvider>
  );
}
