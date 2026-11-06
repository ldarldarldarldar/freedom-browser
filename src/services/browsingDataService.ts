// "Clear all data" (Settings → Privacy) and "Clear browsing data on exit": the part kept in the UI's storage.
// Cookies, site storage and cache of the tabs are cleared by the main process (clear_browsing_data).
// Kept: bookmarks, New Tab favorites, settings, site permissions, per-site zoom, extensions and the
// tabs the user chose to keep when closing.
import { HistoryService } from './historyService';
import { SessionService } from './sessionService';
import { logger } from './loggerService';

export const DOWNLOADS_KEY = 'freedom_browser_downloads_v2';
const LEGACY_TABS_KEY = 'freedom_browser_tabs';
const FAVICON_CACHE_PREFIX = 'freedom_favicons_v2_';

export function clearLocalBrowsingData(): void {
  HistoryService.clearAll();
  SessionService.clearClosedTabs();
  logger.clearLogs();
  try {
    localStorage.removeItem(DOWNLOADS_KEY);
    localStorage.removeItem(LEGACY_TABS_KEY);
    // Cached site icons show which sites were visited
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FAVICON_CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {}
}

/** Everything: the UI's records and, through the main process, the tabs' cookies, site data and cache */
export async function clearAllBrowsingData(): Promise<void> {
  clearLocalBrowsingData();
  await window.electronAPI?.clearBrowsingData?.();
}
