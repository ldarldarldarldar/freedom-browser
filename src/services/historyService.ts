import { HistoryItem } from '../browser/types';

const HISTORY_STORAGE_KEY = 'freedom_browser_history_v1';
const MAX_HISTORY_ITEMS = 5000;

export interface HistoryGroup {
  label: string;
  items: HistoryItem[];
}

export class HistoryService {
  private static cachedHistory: HistoryItem[] | null = null;

  public static getHistory(): HistoryItem[] {
    if (this.cachedHistory) {
      return this.cachedHistory;
    }
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!data) {
        this.cachedHistory = [];
        return [];
      }
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Robust filtering against corrupted data
        this.cachedHistory = parsed.filter(
          (item) => item && typeof item.id === 'string' && typeof item.url === 'string'
        );
        return this.cachedHistory;
      }
    } catch (e) {
      console.warn('Failed to parse history from storage:', e);
    }
    this.cachedHistory = [];
    return [];
  }

  private static save(items: HistoryItem[]): void {
    try {
      // Keep within bound limit
      const trimmed = items.slice(0, MAX_HISTORY_ITEMS);
      this.cachedHistory = trimmed;
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to persist history to storage:', e);
    }
  }

  public static addEntry(title: string, url: string, favicon?: string, isPrivate: boolean = false): void {
    if (isPrivate) return;
    if (!url || typeof url !== 'string') return;
    // Don't record blank or newtab pages
    if (url.startsWith('freedom://newtab') || url === 'about:blank') return;

    const list = this.getHistory();
    const cleanTitle = (title && title.trim()) ? title.trim() : url;

    // Check if the most recent entry is the same URL to prevent spamming
    if (list.length > 0 && list[0].url === url) {
      list[0].visitedAt = Date.now();
      list[0].title = cleanTitle;
      if (favicon) list[0].favicon = favicon;
      list[0].visitCount = (list[0].visitCount || 1) + 1;
      this.save([...list]);
      return;
    }

    const newItem: HistoryItem = {
      id: 'h-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      title: cleanTitle,
      url,
      favicon,
      visitedAt: Date.now(),
      visitCount: 1,
    };

    this.save([newItem, ...list]);
  }

  public static updateEntryTitleAndFavicon(url: string, title?: string, favicon?: string): void {
    if (!url) return;
    const list = this.getHistory();
    let modified = false;
    for (let i = 0; i < Math.min(list.length, 5); i++) {
      if (list[i].url === url) {
        if (title && title !== list[i].title && !title.startsWith('http')) {
          list[i].title = title;
          modified = true;
        }
        if (favicon && !list[i].favicon) {
          list[i].favicon = favicon;
          modified = true;
        }
        break;
      }
    }
    if (modified) {
      this.save([...list]);
    }
  }

  public static deleteEntry(id: string): HistoryItem[] {
    const list = this.getHistory().filter((item) => item.id !== id);
    this.save(list);
    return list;
  }

  public static clearToday(): HistoryItem[] {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();

    const list = this.getHistory().filter((item) => item.visitedAt < startTimestamp);
    this.save(list);
    return list;
  }

  public static clearRecent(hours: number = 1): HistoryItem[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const list = this.getHistory().filter((item) => item.visitedAt < cutoff);
    this.save(list);
    return list;
  }

  public static clearAll(): HistoryItem[] {
    this.save([]);
    return [];
  }

  public static search(query: string): HistoryItem[] {
    const list = this.getHistory();
    if (!query || !query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(
      (item) => item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)
    );
  }

  public static groupByDate(items: HistoryItem[]): HistoryGroup[] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    const todayItems: HistoryItem[] = [];
    const yesterdayItems: HistoryItem[] = [];
    const thisWeekItems: HistoryItem[] = [];
    const olderItems: HistoryItem[] = [];

    for (const item of items) {
      if (item.visitedAt >= todayStart) {
        todayItems.push(item);
      } else if (item.visitedAt >= yesterdayStart) {
        yesterdayItems.push(item);
      } else if (item.visitedAt >= weekStart) {
        thisWeekItems.push(item);
      } else {
        olderItems.push(item);
      }
    }

    const groups: HistoryGroup[] = [];
    if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (thisWeekItems.length > 0) groups.push({ label: 'Past 7 Days', items: thisWeekItems });
    if (olderItems.length > 0) groups.push({ label: 'Older', items: olderItems });

    return groups;
  }
}
