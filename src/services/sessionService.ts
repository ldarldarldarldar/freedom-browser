import { ClosedTabEntry, BrowserTab } from '../browser/types';

const CLOSED_TABS_STORAGE_KEY = 'freedom_browser_closed_tabs_v1';
const MAX_CLOSED_TABS = 30;

export class SessionService {
  private static cachedClosedTabs: ClosedTabEntry[] | null = null;

  public static getRecentlyClosed(): ClosedTabEntry[] {
    if (this.cachedClosedTabs) return this.cachedClosedTabs;
    try {
      const data = sessionStorage.getItem(CLOSED_TABS_STORAGE_KEY) || localStorage.getItem(CLOSED_TABS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.cachedClosedTabs = parsed.filter(
            (t) => t && typeof t.url === 'string' && !t.url.startsWith('freedom://newtab')
          );
          return this.cachedClosedTabs;
        }
      }
    } catch (e) {
      console.warn('Failed to parse closed tabs:', e);
    }
    this.cachedClosedTabs = [];
    return [];
  }

  private static save(items: ClosedTabEntry[]): void {
    try {
      const trimmed = items.slice(0, MAX_CLOSED_TABS);
      this.cachedClosedTabs = trimmed;
      sessionStorage.setItem(CLOSED_TABS_STORAGE_KEY, JSON.stringify(trimmed));
      localStorage.setItem(CLOSED_TABS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to save closed tabs:', e);
    }
  }

  public static recordClosedTab(tab: BrowserTab, isPrivate: boolean = false): void {
    if (isPrivate) return;
    if (!tab.url || tab.url.startsWith('freedom://newtab') || tab.url === 'about:blank') return;

    const current = this.getRecentlyClosed();
    const entry: ClosedTabEntry = {
      id: 'closed-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: tab.title || tab.url,
      url: tab.url,
      favicon: tab.favicon,
      zoomLevel: tab.zoomLevel || 100,
      closedAt: Date.now(),
    };

    this.save([entry, ...current]);
  }

  public static popRecentlyClosed(): ClosedTabEntry | null {
    const current = this.getRecentlyClosed();
    if (current.length === 0) return null;
    const [restored, ...remaining] = current;
    this.save(remaining);
    return restored;
  }

  public static removeClosedTab(id: string): ClosedTabEntry[] {
    const remaining = this.getRecentlyClosed().filter((t) => t.id !== id);
    this.save(remaining);
    return remaining;
  }

  public static clearClosedTabs(): void {
    this.save([]);
  }
}
