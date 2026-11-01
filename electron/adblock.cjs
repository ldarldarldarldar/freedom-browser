// Freedom Browser - built-in ad & tracker blocker (Settings → Privacy → Block ads and trackers)
// Network filtering via webRequest + cosmetic filtering (CSS hiding, scriptlets) for webview pages.
// Filter lists: Ghostery's prebuilt EasyList/EasyPrivacy-based engine, cached on disk and refreshed weekly.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
const ENGINE_VERSION = require('@ghostery/adblocker/package.json').version;

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

// Harmless stand-ins for blocked scripts ($redirect rules), so pages that call e.g. ga() keep working.
// They travel over a scheme of their own: Chromium refuses a redirect from the network to a data: URL.
const STUB_SCHEME = 'freedom-adblock';
const STUB_SCHEME_PRIVILEGES = {
  scheme: STUB_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
};

function createAdBlocker({ app, net }) {
  const cacheDir = path.join(app.getPath('userData'), 'adblock');
  // Serialized engines are tied to the library version
  const cacheFile = path.join(cacheDir, `engine-${ENGINE_VERSION}.bin`);

  let enabled = true;
  let engine = null;
  let loading = null;
  let blockedCount = 0;
  const stubs = new Map(); // id -> { body, contentType }
  const stubSessions = new WeakSet();

  // The engine hands stubs out as data: URLs
  function stubUrl(dataUrl) {
    const id = crypto.createHash('sha256').update(dataUrl).digest('hex').slice(0, 32);
    if (!stubs.has(id)) {
      const comma = dataUrl.indexOf(',');
      const meta = dataUrl.slice('data:'.length, comma);
      const isBase64 = meta.endsWith(';base64');
      const payload = dataUrl.slice(comma + 1);
      stubs.set(id, {
        contentType: (isBase64 ? meta.slice(0, -';base64'.length) : meta) || 'text/plain',
        body: isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload)),
      });
    }
    return `${STUB_SCHEME}://stub/${id}`;
  }

  function serveStubs(ses) {
    if (stubSessions.has(ses)) return;
    stubSessions.add(ses);
    ses.protocol.handle(STUB_SCHEME, (request) => {
      const stub = stubs.get(new URL(request.url).pathname.slice(1));
      if (!stub) return new Response('', { status: 404 });
      return new Response(stub.body, {
        headers: {
          'content-type': stub.contentType,
          'access-control-allow-origin': '*',
          'x-content-type-options': 'nosniff',
        },
      });
    });
  }

  const fetchLists = (...args) => net.fetch(...args);

  async function download() {
    const fresh = await FiltersEngine.fromPrebuiltAdsAndTracking(fetchLists);
    fs.mkdirSync(cacheDir, { recursive: true });
    // Drop engines cached by older library versions
    for (const name of fs.readdirSync(cacheDir)) {
      if (name !== path.basename(cacheFile)) fs.rmSync(path.join(cacheDir, name), { force: true });
    }
    fs.writeFileSync(cacheFile, fresh.serialize());
    return fresh;
  }

  async function load() {
    let stale = true;
    try {
      const stat = fs.statSync(cacheFile);
      engine = FiltersEngine.deserialize(fs.readFileSync(cacheFile));
      stale = Date.now() - stat.mtimeMs > REFRESH_MS;
    } catch {
      engine = null;
    }
    if (!engine) {
      engine = await download();
    } else if (stale) {
      // Keep blocking with the cached lists while the update downloads
      download().then((fresh) => { if (enabled) engine = fresh; }).catch((err) => console.warn('[adblock] update failed:', err.message));
    }
  }

  function ensureLoaded() {
    if (engine || loading) return loading;
    loading = load()
      .catch((err) => console.warn('[adblock] filter lists unavailable:', err.message))
      .finally(() => { loading = null; });
    return loading;
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    if (enabled) ensureLoaded();
    else engine = null; // free the engine's memory while blocking is off
  }

  // Only pages inside browser tabs are filtered, never the browser UI or extension pages
  function pageUrlOf(webContents) {
    try {
      if (!webContents || webContents.isDestroyed() || webContents.getType() !== 'webview') return '';
      return webContents.getURL();
    } catch {
      return '';
    }
  }

  /** webRequest.onBeforeRequest result for a request, or null to let it through */
  function matchRequest(details) {
    if (!enabled || !engine || details.resourceType === 'mainFrame') return null;
    if (!/^(https?|wss?):/.test(details.url)) return null;
    const sourceUrl = pageUrlOf(details.webContents);
    if (!/^https?:/.test(sourceUrl)) return null;
    const { match, redirect } = engine.match(Request.fromRawDetails({
      url: details.url,
      type: details.resourceType || 'other',
      sourceUrl,
    }));
    if (redirect) {
      blockedCount++;
      return { redirectURL: stubUrl(redirect.dataUrl) };
    }
    if (match) {
      blockedCount++;
      return { cancel: true };
    }
    return null;
  }

  function parsedPage(url) {
    const parsed = Request.fromRawDetails({ url, type: 'main_frame' });
    return { url, hostname: parsed.hostname, domain: parsed.domain || '' };
  }

  /** Called synchronously from the webview preload at document start: hostname CSS + scriptlets */
  function pageStart(webContents, url) {
    if (!enabled || !engine || !/^https?:/.test(url || '')) return null;
    const page = parsedPage(url);
    const { active, styles, scripts } = engine.getCosmeticsFilters({
      ...page,
      getBaseRules: true,
      getInjectionRules: true,
      getExtendedRules: false,
      getRulesFromHostname: true,
      getRulesFromDOM: false,
    });
    if (active === false) return null;
    if (styles) webContents.insertCSS(styles, { cssOrigin: 'user' }).catch(() => {});
    return { scripts };
  }

  /** Generic hiding rules for the class/id/href values seen in the page DOM */
  function pageDom(webContents, url, { classes = [], ids = [], hrefs = [] } = {}) {
    if (!enabled || !engine || !/^https?:/.test(url || '')) return;
    const { active, styles } = engine.getCosmeticsFilters({
      ...parsedPage(url),
      classes,
      ids,
      hrefs,
      getBaseRules: false,
      getInjectionRules: false,
      getExtendedRules: false,
      getRulesFromHostname: false,
      getRulesFromDOM: true,
    });
    if (active !== false && styles) webContents.insertCSS(styles, { cssOrigin: 'user' }).catch(() => {});
  }

  return {
    setEnabled,
    ensureLoaded,
    matchRequest,
    pageStart,
    pageDom,
    serveStubs,
    stats: () => ({ enabled, ready: Boolean(engine), blockedCount }),
  };
}

module.exports = { createAdBlocker, STUB_SCHEME_PRIVILEGES };
