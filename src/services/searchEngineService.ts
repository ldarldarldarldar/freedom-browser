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

    // Check local filesystem paths (Unix, Windows, Home directory)
    if (/^(\/|[a-zA-Z]:[/\\]|~[/\\])/.test(trimmed)) {
      return true;
    }

    // Check common local document extensions (e.g. page.html, index.htm)
    if (/\.(html?|xhtml|shtml|xml|svg|pdf|txt)$/i.test(trimmed) && !/\s/.test(trimmed)) {
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

    // Direct file:// URLs
    if (trimmed.startsWith('file://')) {
      return trimmed;
    }

    // Local filesystem paths (Unix or Windows drive letter)
    if (/^(\/|[a-zA-Z]:[/\\])/.test(trimmed)) {
      const normalized = trimmed.replace(/\\/g, '/');
      return `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
    }

    // Home directory path (~/...)
    if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
      const normalized = trimmed.slice(1).replace(/\\/g, '/');
      return `file://${normalized}`;
    }

    // Relative filesystem path (./... or ../...)
    if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
      const normalized = trimmed.replace(/\\/g, '/');
      return `file://${normalized}`;
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
   * Link, image or selected text dragged from a page onto the address bar, tab strip or New Tab search.
   * Only web URLs open directly; anything else is searched, so a page can never make a drop open
   * file://, javascript: or freedom:// URLs. Returns null when there is nothing usable (or files,
   * which the window-level drop handler opens).
   */
  public static resolveDroppedData(data: DataTransfer | null, engineId: SearchEngineId, customUrl?: string): string | null {
    if (!data || data.types.includes('Files')) return null;
    const uri = (data.getData('text/uri-list') || '').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
    const text = (uri || data.getData('text/plain') || '').trim().slice(0, 2048);
    if (!text) return null;
    const asWebUrl = (value: string) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
      } catch {
        return null;
      }
    };
    // Bare host names ("example.com/page", "localhost:3000") open as https; local paths are searched
    const bareHost = /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(text);
    const direct = asWebUrl(text) || (bareHost && this.isLikelyUrl(text) ? asWebUrl(`https://${text}`) : null);
    if (direct) return direct;
    const encoded = encodeURIComponent(text);
    if (engineId === 'custom' && customUrl) return customUrl.replace('%s', encoded);
    const engine = SEARCH_ENGINES.find((e) => e.id === engineId) || SEARCH_ENGINES[0];
    return engine.searchUrl.replace('%s', encoded);
  }

  /** Drag-over check for drop zones that accept links/text from pages (not files, not internal drags) */
  public static isDroppableData(data: DataTransfer | null): boolean {
    if (!data) return false;
    const types = Array.from(data.types);
    return !types.includes('Files') && (types.includes('text/uri-list') || types.includes('text/plain'));
  }

  /**
   * Format display URL (clean view without https:// for cleaner address bar)
   */
  public static formatDisplayUrl(url: string): string {
    if (url.startsWith('freedom://')) return url;
    if (url.startsWith('file://')) {
      try {
        return decodeURI(url);
      } catch {
        return url;
      }
    }
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }

  /**
   * Extract domain or filename from URL
   */
  public static extractDomain(url: string): string {
    if (url.startsWith('freedom://')) return 'Freedom Browser';
    if (url.startsWith('file://')) {
      try {
        const decoded = decodeURI(url);
        const parts = decoded.split(/[/\\]/);
        const filename = parts.pop() || parts.pop() || 'Local File';
        return filename || 'Local File';
      } catch {
        return 'Local File';
      }
    }
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
