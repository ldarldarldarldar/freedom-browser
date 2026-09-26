const ZOOM_STORAGE_KEY = 'freedom_browser_site_zoom_v1';

/**
 * Standard Chromium Zoom Levels (percentages)
 * 25% -> 500%, with 100% as default
 */
export const CHROMIUM_ZOOM_LEVELS = [
  25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500
];

export class ZoomService {
  private static cachedMap: Record<string, number> | null = null;

  /**
   * Extract clean origin hostname from URL
   */
  public static getHostname(url: string): string | null {
    try {
      if (!url) return null;
      if (url === 'freedom://newtab' || url.startsWith('freedom://newtab') || url === 'about:blank') {
        return 'freedom://newtab';
      }
      if (url.startsWith('freedom://') || url.startsWith('about:')) {
        return url;
      }
      const parsed = new URL(url);
      return parsed.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private static getStoredMap(): Record<string, number> {
    if (this.cachedMap) return this.cachedMap;
    try {
      const data = localStorage.getItem(ZOOM_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          this.cachedMap = parsed;
          return this.cachedMap;
        }
      }
    } catch (e) {
      console.warn('Failed to parse zoom map:', e);
    }
    this.cachedMap = {};
    return {};
  }

  private static saveMap(map: Record<string, number>): void {
    try {
      this.cachedMap = map;
      localStorage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Failed to save zoom map:', e);
    }
  }

  /**
   * Get remembered zoom level for a given website URL (default: 100)
   */
  public static getZoomForUrl(url: string): number {
    const host = this.getHostname(url);
    if (!host) return 100;
    const map = this.getStoredMap();
    return map[host] || 100;
  }

  /**
   * Save zoom level for a given website URL
   */
  public static setZoomForUrl(url: string, zoomLevel: number): number {
    const clamped = Math.max(25, Math.min(500, Math.round(zoomLevel)));
    const host = this.getHostname(url);
    if (host) {
      const map = { ...this.getStoredMap() };
      if (clamped === 100) {
        delete map[host];
      } else {
        map[host] = clamped;
      }
      this.saveMap(map);
    }
    return clamped;
  }

  /**
   * Increase zoom to next Chromium-style level
   */
  public static zoomIn(currentZoom: number, url?: string): number {
    const next = CHROMIUM_ZOOM_LEVELS.find((lvl) => lvl > currentZoom) ?? 500;
    if (url) this.setZoomForUrl(url, next);
    return next;
  }

  /**
   * Decrease zoom to previous Chromium-style level
   */
  public static zoomOut(currentZoom: number, url?: string): number {
    const reversed = [...CHROMIUM_ZOOM_LEVELS].reverse();
    const prev = reversed.find((lvl) => lvl < currentZoom) ?? 25;
    if (url) this.setZoomForUrl(url, prev);
    return prev;
  }

  /**
   * Reset zoom back to standard 100%
   */
  public static resetZoom(url?: string): number {
    if (url) this.setZoomForUrl(url, 100);
    return 100;
  }
}
