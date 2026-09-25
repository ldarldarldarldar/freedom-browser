import { SEARCH_ENGINES } from '../settings/defaults';
import { SearchEngineId } from '../settings/types';

export class SearchEngineService {
  /**
   * Determine if input is a valid URL or a search query
   */
  public static isLikelyUrl(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed) return false;

    // Check internal protocols
    if (trimmed.startsWith('freedom://') || trimmed.startsWith('about:') || trimmed.startsWith('file://')) {
      return true;
    }

    // Check standard protocol
    if (/^[a-zA-Z]+:\/\//.test(trimmed)) {
      return true;
    }

    // Contains spaces -> definitely a search query
    if (/\s/.test(trimmed)) {
      return false;
    }

    // Check for localhost or IP address
    if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return true;
    }
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(trimmed)) {
      return true;
    }

    // Check for domain with valid TLD (e.g. example.com, github.io, rust-lang.org/learn)
    const domainMatch = trimmed.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/);
    return !!domainMatch;
  }

  /**
   * Parse user input into a target URL (either formatted URL or search URL)
   */
  public static resolveInputToUrl(input: string, engineId: SearchEngineId, customUrl?: string): string {
    const trimmed = input.trim();
    if (!trimmed) return 'freedom://newtab';

    // Internal freedom URLs
    if (trimmed.startsWith('freedom://')) {
      return trimmed;
    }

    if (this.isLikelyUrl(trimmed)) {
      // Add https:// if protocol missing
      if (!/^[a-zA-Z]+:\/\//.test(trimmed)) {
        return `https://${trimmed}`;
      }
      return trimmed;
    }

    // Format as search query
    const encoded = encodeURIComponent(trimmed);
    if (engineId === 'custom' && customUrl) {
      return customUrl.replace('%s', encoded);
    }

    const engine = SEARCH_ENGINES.find((e) => e.id === engineId) || SEARCH_ENGINES[0];
    return engine.searchUrl.replace('%s', encoded);
  }

  /**
   * Format display URL (clean view without https:// for cleaner address bar)
   */
  public static formatDisplayUrl(url: string): string {
    if (url.startsWith('freedom://')) return url;
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }

  /**
   * Extract domain from URL
   */
  public static extractDomain(url: string): string {
    if (url.startsWith('freedom://')) return 'Freedom Browser';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
