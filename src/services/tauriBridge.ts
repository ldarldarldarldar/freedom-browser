import { SystemStats, ProcessMetric } from '../taskmanager/types';
import { DownloadItem } from '../browser/types';

export interface WebviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Check if running inside Electron desktop environment
export const isElectronEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (
    !!(window as any).electronAPI ||
    navigator.userAgent.toLowerCase().includes('electron')
  );
};

// Check if running inside real Tauri 2 desktop window
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Check if running in any native desktop environment (Electron or Tauri)
export const isDesktopEnvironment = (): boolean => {
  return isElectronEnvironment() || isTauriEnvironment();
};

export class TauriBridge {
  private static instance: TauriBridge;
  private webviews: Map<string, any> = new Map();

  public static getInstance(): TauriBridge {
    if (!TauriBridge.instance) {
      TauriBridge.instance = new TauriBridge();
    }
    return TauriBridge.instance;
  }

  /**
   * Register a mounted webview element for a tab
   */
  public registerWebview(tabId: string, webviewEl: any): void {
    this.webviews.set(tabId, webviewEl);
  }

  /**
   * Unregister webview when tab is destroyed
   */
  public unregisterWebview(tabId: string): void {
    this.webviews.delete(tabId);
  }

  /**
   * Get registered webview element
   */
  public getWebview(tabId: string): any {
    return this.webviews.get(tabId);
  }

  /**
   * Invoke a Tauri Rust backend command safely
   */
  public async invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T | null> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<T>(command, args);
      } catch (err) {
        console.warn(`[TauriBridge] Native command '${command}' error:`, err);
        return null;
      }
    }
    return null;
  }

  /**
   * Native Multi-Webview Management:
   * Tell the native backend to attach or activate a native child Webview
   */
  public async createOrSwitchNativeTab(
    tabId: string,
    url: string,
    bounds: WebviewBounds
  ): Promise<boolean> {
    if (isElectronEnvironment()) {
      const wv = this.getWebview(tabId);
      if (wv && wv.src !== url && !url.startsWith('freedom://')) {
        wv.src = url;
      }
      return true;
    }
    if (isTauriEnvironment()) {
      const result = await this.invoke<boolean>('browser_create_or_switch_tab', {
        tabId,
        url,
        bounds,
      });
      return result === true;
    }
    return false;
  }

  /**
   * Hide all native webviews (used when internal pages like freedom://newtab, Settings, or Task Manager are active)
   */
  public async hideNativeWebviews(): Promise<void> {
    if (isTauriEnvironment()) {
      await this.invoke<void>('browser_hide_native_views');
    }
  }

  /**
   * Close a native webview when a tab is closed
   */
  public async closeNativeTab(tabId: string): Promise<boolean> {
    if (isElectronEnvironment()) {
      this.unregisterWebview(tabId);
      return true;
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('browser_close_tab', { tabId })) ?? false;
    }
    return false;
  }

  /**
   * Navigate active native webview to a new URL
   */
  public async navigateNative(tabId: string, url: string): Promise<boolean> {
    if (isElectronEnvironment()) {
      const wv = this.getWebview(tabId);
      if (wv) {
        try {
          if (wv.loadURL) {
            wv.loadURL(url);
          } else {
            wv.src = url;
          }
          return true;
        } catch {
          wv.src = url;
          return true;
        }
      }
      return false;
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('browser_navigate', { tabId, url })) ?? false;
    }
    return false;
  }

  /**
   * Navigate back in native history
   */
  public async goBackNative(tabId: string): Promise<boolean> {
    if (isElectronEnvironment()) {
      const wv = this.getWebview(tabId);
      if (wv && typeof wv.canGoBack === 'function' && wv.canGoBack()) {
        wv.goBack();
        return true;
      }
      return false;
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('browser_go_back', { tabId })) ?? false;
    }
    return false;
  }

  /**
   * Navigate forward in native history
   */
  public async goForwardNative(tabId: string): Promise<boolean> {
    if (isElectronEnvironment()) {
      const wv = this.getWebview(tabId);
      if (wv && typeof wv.canGoForward === 'function' && wv.canGoForward()) {
        wv.goForward();
        return true;
      }
      return false;
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('browser_go_forward', { tabId })) ?? false;
    }
    return false;
  }

  /**
   * Reload active native webview
   */
  public async reloadNative(tabId: string): Promise<boolean> {
    if (isElectronEnvironment()) {
      const wv = this.getWebview(tabId);
      if (wv && typeof wv.reload === 'function') {
        wv.reload();
        return true;
      }
      return false;
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('browser_reload', { tabId })) ?? false;
    }
    return false;
  }

  /**
   * Update bounds when window resizes
   */
  public async updateNativeBounds(tabId: string, bounds: WebviewBounds): Promise<boolean> {
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('browser_update_bounds', { tabId, bounds })) ?? false;
    }
    return false;
  }

  /**
   * Fetch real system stats and process metrics.
   * If running inside Electron: fetches real Chromium process table metrics and OS RAM/CPU.
   * If running inside Tauri: fetches real OS process table metrics from sysinfo.
   * If running in web runtime: queries real window.performance.memory.
   */
  public async getSystemMetrics(openTabsCount: number): Promise<{
    stats: SystemStats;
    processes: ProcessMetric[];
  }> {
    if (isElectronEnvironment() && (window as any).electronAPI?.getSystemMetrics) {
      try {
        const electronData = await (window as any).electronAPI.getSystemMetrics();
        if (electronData && electronData.processes) {
          return electronData;
        }
      } catch (err) {
        console.warn('[Bridge] Electron metrics error:', err);
      }
    }

    if (isTauriEnvironment()) {
      const nativeData = await this.invoke<{
        stats: SystemStats;
        processes: ProcessMetric[];
      }>('get_system_task_manager_stats');

      if (nativeData && nativeData.processes) {
        return nativeData;
      }
    }

    // Honest web runtime metrics: inspect performance.memory if available
    const perfMemory = (performance as unknown as {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }).memory;

    const usedBytes = perfMemory ? perfMemory.usedJSHeapSize : 48 * 1024 * 1024;
    const totalBytes = perfMemory ? perfMemory.totalJSHeapSize : 64 * 1024 * 1024;
    const limitBytes = perfMemory ? perfMemory.jsHeapSizeLimit : 2048 * 1024 * 1024;
    const usedMb = Math.round(usedBytes / (1024 * 1024));

    const processes: ProcessMetric[] = [
      {
        id: 'web-runtime-process',
        pid: 0,
        title: 'Web Runtime Host Process (performance.memory)',
        processType: 'browser-core',
        ramUsageBytes: usedBytes,
        ramUsageMb: usedMb,
        cpuUsagePercent: 0.5,
        networkSpeedKbps: 0.0,
        status: 'active',
        isForeground: true,
        canTerminate: false,
        canSuspend: false,
      },
    ];

    const stats: SystemStats = {
      totalBrowserRamBytes: usedBytes,
      totalBrowserRamMb: usedMb,
      totalSystemRamBytes: limitBytes,
      systemRamPercent: Math.min(100, Math.round((usedBytes / limitBytes) * 100)),
      totalBrowserCpuPercent: 0.5,
      totalSystemCpuPercent: 1,
      openTabsCount,
      activeProcessesCount: processes.length,
      networkUpKbps: 0,
      networkDownKbps: 0,
      platform: isElectronEnvironment()
        ? ((window as any).electronAPI?.platform === 'win32' ? 'windows' : 'linux')
        : 'web-runtime',
      engineName: isElectronEnvironment() ? 'Chromium' : 'WebEngine',
    };

    return { stats, processes };
  }

  /**
   * Open native Webview DevTools
   */
  public async openNativeDevTools(tabId?: string): Promise<boolean> {
    if (isElectronEnvironment()) {
      if (tabId) {
        const wv = this.getWebview(tabId);
        if (wv && typeof wv.openDevTools === 'function') {
          wv.openDevTools();
          return true;
        }
      }
      if ((window as any).electronAPI?.openDevTools) {
        return (await (window as any).electronAPI.openDevTools()) ?? false;
      }
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('open_devtools')) ?? false;
    }
    return false;
  }

  /**
   * Pick local custom background image
   */
  public async pickCustomBackground(): Promise<string | null> {
    if (isElectronEnvironment() && (window as any).electronAPI?.pickCustomBackground) {
      return (await (window as any).electronAPI.pickCustomBackground()) ?? null;
    }
    return null;
  }

  /**
   * Set Browser Performance Mode
   */
  public async setBrowserMode(mode: 'performance' | 'quality'): Promise<boolean> {
    if (isElectronEnvironment() && (window as any).electronAPI?.setBrowserMode) {
      return (await (window as any).electronAPI.setBrowserMode(mode)) ?? false;
    }
    return false;
  }

  /**
   * Open system Downloads folder (native Arch/Windows)
   */
  public async openDownloadFolder(folderPath?: string): Promise<boolean> {
    if (isElectronEnvironment() && (window as any).electronAPI?.openDownloadFolder) {
      return (await (window as any).electronAPI.openDownloadFolder(folderPath)) ?? false;
    }
    if (isTauriEnvironment()) {
      return (await this.invoke<boolean>('open_download_folder')) ?? false;
    }
    return false;
  }

  /**
   * Open downloaded file with system default handler
   */
  public async openDownloadFile(filepath: string): Promise<boolean> {
    if (isElectronEnvironment() && (window as any).electronAPI?.openFile) {
      return (await (window as any).electronAPI.openFile(filepath)) ?? false;
    }
    return false;
  }

  /**
   * Highlight/reveal downloaded file in file manager
   */
  public async showItemInFolder(filepath: string): Promise<boolean> {
    if (isElectronEnvironment() && (window as any).electronAPI?.showItemInFolder) {
      return (await (window as any).electronAPI.showItemInFolder(filepath)) ?? false;
    }
    return false;
  }

  /**
   * Cancel an in-progress download
   */
  public async cancelDownload(downloadId: string): Promise<boolean> {
    if (isElectronEnvironment() && (window as any).electronAPI?.cancelDownload) {
      return (await (window as any).electronAPI.cancelDownload(downloadId)) ?? false;
    }
    return false;
  }

  /**
   * Verify completed download items against actual files on disk
   */
  public async verifyDownloads(items: DownloadItem[]): Promise<DownloadItem[]> {
    if (isElectronEnvironment() && (window as any).electronAPI?.verifyDownloads) {
      return (await (window as any).electronAPI.verifyDownloads(items)) ?? items;
    }
    return items;
  }

  /**
   * Get native platform default Downloads directory path
   */
  public async getDefaultDownloadDir(): Promise<string> {
    if (isElectronEnvironment() && (window as any).electronAPI?.getDefaultDownloadDir) {
      return (await (window as any).electronAPI.getDefaultDownloadDir()) ?? '~/Downloads';
    }
    return '~/Downloads';
  }
  /**
   * Find in Page for active webview
   */
  public findInPage(
    tabId: string,
    text: string,
    options: { forward?: boolean; findNext?: boolean } = {}
  ): number | null {
    const wv = this.getWebview(tabId);
    if (wv && typeof wv.findInPage === 'function') {
      try {
        return wv.findInPage(text, options);
      } catch (e) {
        console.warn('findInPage failed:', e);
      }
    }
    return null;
  }

  /**
   * Stop Find in Page and optionally clear selection
   */
  public stopFindInPage(
    tabId: string,
    action: 'clearSelection' | 'keepSelection' | 'activateSelection' = 'clearSelection'
  ): void {
    const wv = this.getWebview(tabId);
    if (wv && typeof wv.stopFindInPage === 'function') {
      try {
        wv.stopFindInPage(action);
      } catch (e) {
        console.warn('stopFindInPage failed:', e);
      }
    }
  }

  /**
   * Set Zoom Factor for webview (1.0 = 100%)
   */
  public setWebviewZoom(tabId: string, factor: number): void {
    const wv = this.getWebview(tabId);
    if (wv && typeof wv.setZoomFactor === 'function') {
      try {
        wv.setZoomFactor(factor);
      } catch (e) {
        console.warn('setZoomFactor failed:', e);
      }
    }
  }

  /**
   * Reload tab, optionally ignoring cache (hard reload)
   */
  public reloadTab(tabId: string, ignoreCache: boolean = false): void {
    const wv = this.getWebview(tabId);
    if (wv) {
      if (ignoreCache && typeof wv.reloadIgnoringCache === 'function') {
        wv.reloadIgnoringCache();
      } else if (typeof wv.reload === 'function') {
        wv.reload();
      }
    }
  }
}

export const tauriBridge = TauriBridge.getInstance();

