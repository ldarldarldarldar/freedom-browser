import { BrowserTab } from '../browser/types';

export interface SavedTabSession {
  id: string;
  title: string;
  url: string;
  displayUrl?: string;
  favicon?: string;
  zoomLevel?: number;
  history: string[];
  historyIndex: number;
  isPinned?: boolean;
}

export interface SavedBrowserSession {
  tabs: SavedTabSession[];
  activeTabId: string;
  savedAt: number;
}

const SAVED_SESSION_KEY = 'freedom_saved_session_v1';

export class SessionRestoreService {
  /**
   * Check if there are active tabs worth preserving (non-empty tabs or >1 tabs)
   */
  public static hasRestorableTabs(tabs: BrowserTab[]): boolean {
    if (!tabs || tabs.length === 0) return false;
    // If more than 1 tab, always restorable
    if (tabs.length > 1) return true;
    // If 1 tab, check if it's not a plain empty new tab
    const tab = tabs[0];
    return Boolean(tab && tab.url && !tab.url.startsWith('freedom://newtab') && tab.url !== 'about:blank');
  }

  /**
   * Save session to persistent storage
   */
  public static saveSession(tabs: BrowserTab[], activeTabId: string): void {
    try {
      const restorableTabs: SavedTabSession[] = tabs.map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        displayUrl: t.displayUrl || t.url,
        favicon: t.favicon,
        zoomLevel: t.zoomLevel || 100,
        history: t.history && t.history.length > 0 ? t.history : [t.url],
        historyIndex: typeof t.historyIndex === 'number' ? t.historyIndex : 0,
        isPinned: Boolean(t.isPinned),
      }));

      const payload: SavedBrowserSession = {
        tabs: restorableTabs,
        activeTabId: activeTabId || (restorableTabs[0]?.id ?? 'tab-1'),
        savedAt: Date.now(),
      };

      localStorage.setItem(SAVED_SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to save browser session:', err);
    }
  }

  /**
   * Retrieve saved session for startup restoration
   */
  public static getSavedSession(): SavedBrowserSession | null {
    try {
      const raw = localStorage.getItem(SAVED_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
          return parsed as SavedBrowserSession;
        }
      }
    } catch (err) {
      console.warn('Failed to retrieve saved browser session:', err);
    }
    return null;
  }

  /**
   * Clear saved session (called when user explicitly closes tabs without saving)
   */
  public static clearSavedSession(): void {
    try {
      localStorage.removeItem(SAVED_SESSION_KEY);
    } catch (err) {
      console.warn('Failed to clear saved session:', err);
    }
  }
}
