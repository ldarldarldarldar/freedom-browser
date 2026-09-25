/**
 * Zero-Telemetry Local Favicon Service for Freedom Browser
 * 
 * Retrieves real website favicons directly from site origins with local caching.
 * No external tracking APIs, no third-party proxies, no telemetry.
 */

// Embedded official vector brand icons for instant zero-latency offline display
const OFFICIAL_BRAND_ICONS: Record<string, string> = {
  'duckduckgo.com': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="%23de5833"/><ellipse cx="24" cy="23" rx="14" ry="13" fill="%23ffffff"/><circle cx="20" cy="20" r="2.5" fill="%23222222"/><path d="M22 23 C26 23 32 25 31 29 C28 32 21 31 19 28 Z" fill="%23e89c31"/><path d="M19 33 C23 31 27 34 29 36 C25 38 20 37 19 33 Z" fill="%235b9e38"/></svg>`,
  'github.com': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
  'youtube.com': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="%23ff0000"/><polygon points="9.5,7.5 16.5,12 9.5,16.5" fill="%23ffffff"/></svg>`,
  'chatgpt.com': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310a37f"><path d="M22.28 10.1a5.6 5.6 0 00-.47-4.48 5.72 5.72 0 00-5.74-2.83 5.66 5.66 0 00-4.22-1.89 5.72 5.72 0 00-5.46 3.96 5.65 5.65 0 00-3.8 2.76 5.73 5.73 0 00.74 6.36 5.6 5.6 0 00.47 4.48 5.72 5.72 0 005.74 2.83 5.66 5.66 0 004.22 1.89 5.72 5.72 0 005.46-3.96 5.65 5.65 0 003.8-2.76 5.73 5.73 0 00-.74-6.36zm-8.86 10.98a4.34 4.34 0 01-2.48-.77l.13-.07 4.14-2.39a.7.7 0 00.35-.61v-5.85l1.76 1.02a.1.1 0 01.05.08v4.75a4.37 4.37 0 01-3.95 3.84zm-7.6-3.3a4.33 4.33 0 01-.6-2.52c0-.3.04-.6.1-.88l.14.08 4.14 2.39a.7.7 0 00.7 0l5.07-2.93v2.03a.1.1 0 01-.04.09l-4.11 2.37a4.37 4.37 0 01-5.4-0.61zm-1.85-8.2a4.33 4.33 0 011.88-1.74l-.01.15v4.78a.7.7 0 00.35.61l5.07 2.93-1.76 1.01a.1.1 0 01-.1 0l-4.12-2.38a4.37 4.37 0 01-1.31-5.36zm14.34 2.38l-5.07-2.93 1.76-1.02a.1.1 0 01.1 0l4.12 2.38a4.37 4.37 0 01-1.26 7.74v-5.56a.7.7 0 00-.65-.61zm2.34-3.04a4.33 4.33 0 01.6 2.52c0 .3-.04.6-.1.89l-.14-.08-4.14-2.39a.7.7 0 00-.7 0l-5.07 2.93v-2.03a.1.1 0 01.04-.09l4.11-2.38a4.37 4.37 0 015.4.63zm-9.36 4.33l-2.03-1.17 2.03-1.17 2.03 1.17-2.03 1.17z"/></svg>`,
  'wikipedia.org': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffffff"><path d="M12.09 13.52l1.9-5.18h1.83l-3.3 8.32h-1.63L8.14 8.34h1.85l2.1 5.18zm-6.26-5.18l2.9 7.6h-1.6l-.7-1.92H3.77L3.06 16H1.5l2.9-7.66h1.43zm-1.84 4.5h2.12L5.05 10.1l-1.06 2.74zm15.17-4.5l2.9 7.6h-1.6l-.7-1.92h-2.66L17 16h-1.56l2.9-7.66h1.82zm-1.84 4.5h2.12l-1.06-2.74-1.06 2.74z"/></svg>`,
  'reddit.com': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="%23ff4500"/><path fill="%23ffffff" d="M12 4.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm5.8 4.2a1.8 1.8 0 00-2.6-.2 8.4 8.4 0 00-3.2-.6l.6-2.6 1.8.4a1.2 1.2 0 10.2-.6l-2.2-.5a.3.3 0 00-.3.2l-.7 3.3a8.3 8.3 0 00-3.3.6 1.8 1.8 0 00-2.6 2.3c-.1.3-.1.6-.1.9 0 2.4 2.4 4.4 5.3 4.4s5.3-2 5.3-4.4c0-.3 0-.6-.1-.9a1.8 1.8 0 001.4-2zm-8.8 3.5a1.1 1.1 0 110-2.2 1.1 1.1 0 010 2.2zm6 2.6c-.6.6-1.8.8-3 .8s-2.4-.2-3-.8a.3.3 0 01.4-.4c.5.5 1.5.7 2.6.7s2.1-.2 2.6-.7a.3.3 0 01.4.4zm-.2-1.5a1.1 1.1 0 110-2.2 1.1 1.1 0 010 2.2z"/></svg>`,
  'rust-lang.org': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="%23ffffff"><path d="M16 2.5a13.5 13.5 0 100 27 13.5 13.5 0 000-27zm0 2.2a11.3 11.3 0 0110.8 8.1l-1.9.7a9.4 9.4 0 00-2.3-2.9l1 1.8a11.3 11.3 0 01-15.2 0l1-1.8a9.4 9.4 0 00-2.3 2.9l-1.9-.7A11.3 11.3 0 0116 4.7zm-4.5 7.1h4.8c2.1 0 3.7.8 3.7 2.7 0 1.4-.9 2.2-2.1 2.5l2.6 4.7h-2.5l-2.2-4.2h-2.2v4.2h-2.1v-9.9zm2.1 1.8v2.3h2.6c1.1 0 1.8-.4 1.8-1.2 0-.7-.7-1.1-1.8-1.1h-2.6z"/></svg>`,
  'discord.com': `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="%235865f2"/><path fill="%23ffffff" d="M19.3 5.3a14.8 14.8 0 00-3.6-1.1.2.2 0 00-.2.1 10.3 10.3 0 00-.5 1 13.7 13.7 0 00-6 0 10.3 10.3 0 00-.5-1 .2.2 0 00-.2-.1A14.8 14.8 0 004.7 5.3a.2.2 0 00-.1.1C2.3 8.8 1.7 12.2 2 15.6a.2.2 0 00.1.1 14.9 14.9 0 004.5 2.3.2.2 0 00.2-.1c.4-.5.7-1 1-1.6a.2.2 0 00-.1-.2 9.8 9.8 0 01-1.4-.7.2.2 0 010-.3c.1-.1.2-.2.3-.2a10.6 10.6 0 009.8 0 .2.2 0 01.3.2.2.2 0 010 .3c-.5.3-1 .5-1.4.7a.2.2 0 00-.1.2c.3.6.7 1.1 1 1.6a.2.2 0 00.2.1 14.9 14.9 0 004.5-2.3.2.2 0 00.1-.1c.4-3.9-.7-7.3-2.6-10.3a.2.2 0 00-.1-.1zM8.5 13.7c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6c.9 0 1.6.7 1.5 1.6 0 .9-.7 1.6-1.5 1.6zm7 0c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6c.9 0 1.6.7 1.5 1.6 0 .9-.7 1.6-1.5 1.6z"/></svg>`,
};

const CACHE_KEY_PREFIX = 'freedom_favicons_v2_';

export class FaviconService {
  private static memoryCache: Map<string, string> = new Map();

  /**
   * Extract normalized hostname domain from URL
   */
  public static extractDomain(url: string): string {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Get favicon for URL synchronously if available in memory / preset
   */
  public static getFaviconSync(url: string): string | null {
    const domain = this.extractDomain(url);

    // 1. Check official embedded vector icons
    if (OFFICIAL_BRAND_ICONS[domain]) {
      return OFFICIAL_BRAND_ICONS[domain];
    }

    // 2. Check memory cache
    if (this.memoryCache.has(domain)) {
      return this.memoryCache.get(domain)!;
    }

    // 3. Check local storage cache
    try {
      const stored = localStorage.getItem(CACHE_KEY_PREFIX + domain);
      if (stored) {
        this.memoryCache.set(domain, stored);
        return stored;
      }
    } catch {
      // ignore storage errors
    }

    return null;
  }

  /**
   * Retrieve real website favicon directly from site origin with local caching
   */
  public static async getFavicon(url: string): Promise<string> {
    const domain = this.extractDomain(url);

    // Check synchronous cache first
    const cached = this.getFaviconSync(url);
    if (cached) {
      return cached;
    }

    // Fetch directly from site's root favicon (no third-party proxy)
    try {
      const origin = new URL(url.startsWith('http') ? url : `https://${url}`).origin;
      const faviconUrl = `${origin}/favicon.ico`;

      const response = await fetch(faviconUrl, {
        method: 'GET',
        mode: 'no-cors', // standard resource loading
        cache: 'force-cache',
      });

      if (response) {
        // Successful response - save direct URL in local storage
        this.memoryCache.set(domain, faviconUrl);
        try {
          localStorage.setItem(CACHE_KEY_PREFIX + domain, faviconUrl);
        } catch {
          // ignore storage quota
        }
        return faviconUrl;
      }
    } catch {
      // Network failed or offline: generate crisp local SVG monogram fallback
    }

    const fallback = this.generateMonogramSvg(domain);
    this.memoryCache.set(domain, fallback);
    return fallback;
  }

  /**
   * Generates a sleek, privacy-friendly branded monogram icon
   */
  public static generateMonogramSvg(domain: string): string {
    const firstLetter = (domain.charAt(0) || 'F').toUpperCase();
    
    // Hash domain string to consistent color palette
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const bg = `hsl(${hue}, 45%, 22%)`;
    const fg = `hsl(${hue}, 80%, 75%)`;

    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="${encodeURIComponent(bg)}"/><text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="20" fill="${encodeURIComponent(fg)}" dominant-baseline="middle" text-anchor="middle">${firstLetter}</text></svg>`;
  }
}
