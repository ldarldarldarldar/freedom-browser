// Freedom Browser - serves the browser UI from freedom-app://ui/ in a session of its own.
// The UI holds the privileged preload, so it must not share an origin with local files opened in tabs
// (file://) or a session with extensions and web pages.
const fs = require('fs');
const path = require('path');
const { readLocalStorageOrigin } = require('./leveldb-reader.cjs');

const UI_SCHEME = 'freedom-app';
const UI_ORIGIN = `${UI_SCHEME}://ui`;
const UI_PARTITION = 'persist:freedom-ui';
const MIGRATION_FLAG = 'ui-storage-migrated.json';
const BLANK_PATH = '/__blank';

// connect-src: favicons and search suggestions. img-src: favicons of visited sites (web and data only,
// so a page cannot make the UI load file:// or \\server\share paths as an icon).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  'img-src \'self\' https: http: data: blob:',
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https: http:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function registerUiScheme(protocol) {
  protocol.registerSchemesAsPrivileged([
    { scheme: UI_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
  ]);
}

function serveUi(uiSession, distDir) {
  const root = path.resolve(distDir);
  const headers = (type) => ({
    'content-type': type,
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-cache',
  });
  uiSession.protocol.handle(UI_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'ui') return new Response('Not found', { status: 404 });
    if (url.pathname === BLANK_PATH) return new Response('<!doctype html><title>blank</title>', { headers: headers(MIME['.html']) });
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, `.${relative}`);
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const body = await fs.promises.readFile(file);
      return new Response(body, { headers: headers(MIME[path.extname(file).toLowerCase()] || 'application/octet-stream') });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/**
 * Earlier versions kept settings, history and bookmarks in the localStorage of the file:// origin, which every
 * local HTML file opened in a tab could read. Copies it to the UI origin once, then wipes the file:// copy.
 */
async function migrateUiStorage({ app, BrowserWindow, session, uiSession }) {
  const flag = path.join(app.getPath('userData'), MIGRATION_FLAG);
  if (fs.existsSync(flag)) return;
  const target = new BrowserWindow({
    show: false,
    webPreferences: { session: uiSession, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    // Pages on file:// have no localStorage access any more (fuse GrantFileProtocolExtraPrivileges is off), so the
    // old values are read from disk. Nothing in the default session has opened this database yet.
    const database = path.join(session.defaultSession.getStoragePath(), 'Local Storage', 'leveldb');
    const entries = readLocalStorageOrigin(database, 'file://');
    await target.loadURL(UI_ORIGIN + BLANK_PATH);
    const copied = await target.webContents.executeJavaScript(`(() => {
      const entries = ${JSON.stringify(entries)};
      for (const [key, value] of entries) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      }
      return entries.every(([key]) => localStorage.getItem(key) !== null);
    })()`);
    if (!copied) throw new Error('localStorage copy is incomplete');
    uiSession.flushStorageData();
    await session.defaultSession.clearStorageData({ origin: 'file://', storages: ['localstorage'] });
    session.defaultSession.flushStorageData();
    fs.writeFileSync(flag, JSON.stringify({ migratedAt: Date.now(), items: entries.length }));
  } catch (err) {
    // The flag stays unset: next start tries again and never overwrites newer values
    console.warn('[ui] localStorage migration failed:', err);
  } finally {
    target.destroy();
  }
}

module.exports = { UI_ORIGIN, UI_PARTITION, registerUiScheme, serveUi, migrateUiStorage };
