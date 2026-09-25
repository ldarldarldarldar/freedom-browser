const ZOOM_STORAGE_KEY = 'freedom_browser_site_zoom_v1';
const MIN_ZOOM = 30;
const MAX_ZOOM = 300;
const STEP_ZOOM = 10;

export class ZoomService {
  private static cachedMap: Record<string, number> | null = null;

  private static getHostname(url: string): string | null {
    try {
      if (!url || url.startsWith('freedom://') || url.startsWith('about:')) return null;
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

  public static getZoomForUrl(url: string): number {
    const host = this.getHostname(url);
    if (!host) return 100;
    const map = this.getStoredMap();
    return map[host] || 100;
  }

  public static setZoomForUrl(url: string, zoomLevel: number): number {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoomLevel)));
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

  public static zoomIn(currentZoom: number, url?: string): number {
    const next = Math.min(MAX_ZOOM, currentZoom + STEP_ZOOM);
    if (url) this.setZoomForUrl(url, next);
    return next;
  }

  public static zoomOut(currentZoom: number, url?: string): number {
    const next = Math.max(MIN_ZOOM, currentZoom - STEP_ZOOM);
    if (url) this.setZoomForUrl(url, next);
    return next;
  }

  public static resetZoom(url?: string): number {
    if (url) this.setZoomForUrl(url, 100);
    return 100;
  }
}
