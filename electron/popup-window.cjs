// Freedom Browser - pop-up windows of sites (window.open with a size, Shift+click), as Chromium/Brave show them:
// a small window with a read-only address bar (lock + address) above the page and the page title in the title bar.
// The page is the webContents Chromium created for window.open, so window.opener keeps working (sign-in, payments).
const { BaseWindow, WebContentsView } = require('electron');

const BAR_HEIGHT = 32;

const BAR_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  html,body{margin:0;height:100%;background:#16191c;color:#c9ced6;font:12px system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
  #bar{display:flex;align-items:center;gap:8px;height:100%;padding:0 10px;box-sizing:border-box;border-bottom:1px solid #2a2f36}
  #icon{flex:none;width:14px;height:14px}
  #url{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:text;cursor:text}
  #url b{color:#f1f3f5;font-weight:600}
  .warn{color:#f5b041}
</style></head><body><div id="bar"><span id="icon"></span><span id="url"></span></div>
<script>
  const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const WARN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f5b041" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  window.render = ({ scheme, host, rest, secure, label }) => {
    document.getElementById('icon').innerHTML = secure ? LOCK : WARN;
    document.getElementById('icon').title = label;
    const url = document.getElementById('url');
    url.textContent = '';
    const a = document.createElement('span'); a.textContent = scheme; if (!secure) a.className = 'warn';
    const b = document.createElement('b'); b.textContent = host;
    const c = document.createElement('span'); c.textContent = rest;
    url.append(a, b, c);
    url.title = scheme + host + rest;
  };
</script></body></html>`;

/** Parts of an address for the bar: scheme, host (bold), the rest; secure only for https without certificate trouble */
function addressParts(rawUrl, language = 'en') {
  const ru = language === 'ru';
  try {
    const u = new URL(rawUrl);
    // about:blank while a sign-in window waits for its address, and the like: shown as they are
    if (!/^https?:$/.test(u.protocol)) return { scheme: '', host: '', rest: u.href, secure: false, label: '' };
    const secure = u.protocol === 'https:';
    return {
      scheme: `${u.protocol}//`,
      host: u.host,
      rest: `${u.pathname}${u.search}${u.hash}`.replace(/^\/$/, ''),
      secure,
      label: secure ? (ru ? 'Защищённое соединение' : 'Connection is secure') : (ru ? 'Соединение не защищено' : 'Connection is not secure'),
    };
  } catch {
    return { scheme: '', host: String(rawUrl || ''), rest: '', secure: false, label: '' };
  }
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(n)));

/**
 * Builds the window around the page Chromium created. Returns the page's webContents for setWindowOpenHandler's
 * createWindow. onPage(webContents) sets up the page like any popup (link routing, popup blocker).
 */
function createPopupWindow({ options, icon, language, onPage }) {
  const width = clamp(options.width || 520, 240, 4000);
  const height = clamp(options.height || 640, 160, 4000);
  const win = new BaseWindow({
    width,
    height: height + BAR_HEIGHT,
    ...(Number.isFinite(options.x) && Number.isFinite(options.y) ? { x: Math.round(options.x), y: Math.round(options.y) } : {}),
    useContentSize: true,
    minWidth: 240,
    minHeight: 160,
    backgroundColor: '#16191c',
    autoHideMenuBar: true,
    title: 'Freedom Browser',
    icon,
  });

  const bar = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  bar.setBackgroundColor('#16191c');
  const page = new WebContentsView({ webContents: options.webContents, webPreferences: options.webPreferences });
  win.contentView.addChildView(page);
  win.contentView.addChildView(bar);

  const layout = () => {
    const { width: w, height: h } = win.getContentBounds();
    bar.setBounds({ x: 0, y: 0, width: w, height: BAR_HEIGHT });
    page.setBounds({ x: 0, y: BAR_HEIGHT, width: w, height: Math.max(0, h - BAR_HEIGHT) });
  };
  layout();
  win.on('resize', layout);

  const pageContents = page.webContents;
  let barReady = false;
  const showAddress = () => {
    if (!barReady || bar.webContents.isDestroyed() || pageContents.isDestroyed()) return;
    const parts = addressParts(pageContents.getURL(), language());
    bar.webContents.executeJavaScript(`render(${JSON.stringify(parts)})`).catch(() => {});
  };
  bar.webContents.on('did-finish-load', () => {
    barReady = true;
    showAddress();
  });
  bar.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(BAR_HTML)}`);
  // The bar is not a page: nothing may navigate it away
  bar.webContents.on('will-navigate', (e) => e.preventDefault());
  bar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const showTitle = () => {
    if (win.isDestroyed() || pageContents.isDestroyed()) return;
    const host = addressParts(pageContents.getURL()).host;
    win.setTitle(pageContents.getTitle() || host || 'Freedom Browser');
  };
  pageContents.on('page-title-updated', showTitle);
  pageContents.on('did-navigate', () => { showAddress(); showTitle(); });
  pageContents.on('did-navigate-in-page', showAddress);
  pageContents.on('did-start-navigation', (details) => { if (details.isMainFrame && !details.isSameDocument) showAddress(); });

  // window.close() from the page, or the page going away, closes the window; closing the window ends the page
  pageContents.on('destroyed', () => { if (!win.isDestroyed()) win.close(); });
  win.on('closed', () => {
    if (!pageContents.isDestroyed()) pageContents.close();
    if (!bar.webContents.isDestroyed()) bar.webContents.close();
  });

  onPage?.(pageContents, win);
  win.show();
  return pageContents;
}

module.exports = { createPopupWindow, addressParts, BAR_HEIGHT };
