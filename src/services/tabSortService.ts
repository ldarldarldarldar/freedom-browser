import { BrowserTab } from '../browser/types';

export type TabSortMode = 'site' | 'ram' | 'duplicates' | 'title';

// Common tracking query parameters to strip when normalizing URLs
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'ref',
  'source',
  '_ga',
  '_gl',
  'mc_eid',
  'yclid',
  'ref_src',
  'igshid',
]);

export class TabSortService {
  /**
   * Extract clean hostname from a URL.
   * Strips 'www.', handles internal 'freedom://' protocols and malformed URLs.
   */
  public static extractHostname(url: string): string {
    if (!url) return 'Empty';
    if (url.startsWith('freedom://')) {
      return 'freedom';
    }
    if (url.startsWith('about:')) {
      return 'about';
    }
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      let hostname = parsed.hostname.toLowerCase();
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }
      return hostname || 'Other';
    } catch {
      return url.split('/')[0] || 'Other';
    }
  }

  /**
   * Normalize URL for duplicate detection:
   * - Lowercase protocol and host
   * - Remove URL fragment/hash (#...)
   * - Remove common tracking parameters (utm_*, fbclid, ref, etc.)
   * - Remove trailing slashes (except root)
   * - Alphabetically sort remaining query parameters
   */
  public static normalizeUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('freedom://')) {
      return url.toLowerCase().trim();
    }
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      parsed.hash = ''; // Remove fragments

      // Filter query parameters
      const searchParams = new URLSearchParams(parsed.search);
      const cleanedParams = new URLSearchParams();

      const keys = Array.from(searchParams.keys()).sort();
      for (const key of keys) {
        if (!TRACKING_PARAMS.has(key.toLowerCase()) && !key.toLowerCase().startsWith('utm_')) {
          const vals = searchParams.getAll(key);
          for (const v of vals) {
            cleanedParams.append(key, v);
          }
        }
      }

      parsed.search = cleanedParams.toString();

      // Normalize pathname trailing slash
      let pathname = parsed.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      parsed.pathname = pathname;

      return parsed.toString();
    } catch {
      // Fallback: strip hash and lowercase
      return url.split('#')[0].toLowerCase().trim();
    }
  }

  /**
   * Group tabs by Site (hostname).
   * Identical hostnames are grouped together in order of first appearance.
   * Inside each group, tabs preserve their relative original order.
   * Example: [YouTube, GitHub, YouTube, Google] -> [YouTube, YouTube, GitHub, Google]
   */
  public static groupBySite(tabs: BrowserTab[]): BrowserTab[] {
    if (tabs.length <= 1) return [...tabs];

    // Group tabs by domain preserving first-seen domain order
    const groups = new Map<string, BrowserTab[]>();
    for (const tab of tabs) {
      const domain = this.extractHostname(tab.url);
      if (!groups.has(domain)) {
        groups.set(domain, []);
      }
      groups.get(domain)!.push(tab);
    }

    const result: BrowserTab[] = [];
    for (const [, groupTabs] of groups.entries()) {
      result.push(...groupTabs);
    }

    return result;
  }

  /**
   * Sort tabs by RAM usage (highest -> lowest).
   * Tabs with equal or unknown RAM preserve their stable order.
   */
  public static sortByRam(tabs: BrowserTab[], ramMap: Record<string, number>): BrowserTab[] {
    if (tabs.length <= 1) return [...tabs];

    return [...tabs].sort((a, b) => {
      const ramA = ramMap[a.id] || 0;
      const ramB = ramMap[b.id] || 0;
      if (ramB !== ramA) {
        return ramB - ramA; // Highest RAM first
      }
      return 0; // Stable
    });
  }

  /**
   * Group duplicate tabs:
   * Identifies tabs with identical normalized URLs.
   * Clusters duplicates at the beginning of the tabs array.
   * Non-duplicates follow in their original order.
   * Returns sorted tabs and the set of duplicate tab IDs.
   */
  public static groupDuplicates(tabs: BrowserTab[]): {
    sortedTabs: BrowserTab[];
    duplicateTabIds: Set<string>;
  } {
    if (tabs.length <= 1) {
      return { sortedTabs: [...tabs], duplicateTabIds: new Set() };
    }

    // Count occurrences of each normalized URL
    const urlMap = new Map<string, BrowserTab[]>();
    for (const tab of tabs) {
      const norm = this.normalizeUrl(tab.url);
      if (!urlMap.has(norm)) {
        urlMap.set(norm, []);
      }
      urlMap.get(norm)!.push(tab);
    }

    const duplicates: BrowserTab[] = [];
    const nonDuplicates: BrowserTab[] = [];
    const duplicateTabIds = new Set<string>();

    for (const [, group] of urlMap.entries()) {
      if (group.length > 1) {
        // These are duplicates
        for (const tab of group) {
          duplicates.push(tab);
          duplicateTabIds.add(tab.id);
        }
      } else {
        nonDuplicates.push(group[0]);
      }
    }

    // Preserve relative order of non-duplicates according to original tabs array
    const originalTabOrder = new Map(tabs.map((t, idx) => [t.id, idx]));
    nonDuplicates.sort((a, b) => (originalTabOrder.get(a.id) || 0) - (originalTabOrder.get(b.id) || 0));

    return {
      sortedTabs: [...duplicates, ...nonDuplicates],
      duplicateTabIds,
    };
  }

  /**
   * Sort tabs by Title (A-Z).
   * Case-insensitive, safely handles empty titles or fallback.
   */
  public static sortByTitle(tabs: BrowserTab[]): BrowserTab[] {
    if (tabs.length <= 1) return [...tabs];

    return [...tabs].sort((a, b) => {
      const titleA = (a.title || a.url || '').trim();
      const titleB = (b.title || b.url || '').trim();
      return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
    });
  }

  /**
   * Find duplicate tab IDs from a list of tabs
   */
  public static getDuplicateTabIds(tabs: BrowserTab[]): Set<string> {
    const urlMap = new Map<string, string[]>();
    for (const tab of tabs) {
      const norm = this.normalizeUrl(tab.url);
      if (!urlMap.has(norm)) {
        urlMap.set(norm, []);
      }
      urlMap.get(norm)!.push(tab.id);
    }

    const dupIds = new Set<string>();
    for (const [, ids] of urlMap.entries()) {
      if (ids.length > 1) {
        for (const id of ids) {
          dupIds.add(id);
        }
      }
    }
    return dupIds;
  }

  /**
   * Get a deterministic pleasant accent color for a domain
   */
  public static getDomainColor(hostname: string): string {
    if (!hostname || hostname === 'freedom' || hostname.startsWith('freedom')) {
      return '#10b981'; // Freedom emerald
    }
    const colors = [
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#f59e0b', // amber
      '#06b6d4', // cyan
      '#10b981', // emerald
      '#6366f1', // indigo
      '#14b8a6', // teal
      '#f97316', // orange
    ];
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      hash = (hash << 5) - hash + hostname.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
