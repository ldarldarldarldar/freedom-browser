// Freedom Browser - bookmark import and export (Bookmarks panel → Import / Export).
// Sources: Netscape bookmark HTML (what Chrome, Firefox, Edge, ... export), the Bookmarks JSON of
// Chromium-based browsers and Firefox's places.sqlite. Everything comes out as one plain tree:
//   { bar: Node[], other: Node[] }   Node = { type: 'url', title, url, addedAt? } | { type: 'folder', title, children }
// The UI merges that tree into its own store (src/services/bookmarkService.ts).

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_ITEMS = 100000;
const MAX_DEPTH = 64;

// Only addresses a tab can open; javascript:, data:, place: and browser-internal pages are dropped
function isImportableUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'file:' || protocol === 'ftp:';
  } catch {
    return false;
  }
}

const cleanTitle = (value, fallback) => {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (text || fallback || '').slice(0, 1024);
};

// ---- Netscape bookmark HTML ----

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+[0-9]*);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    const value = NAMED_ENTITIES[name.toLowerCase()];
    return value === undefined ? whole : value;
  });
}

function parseAttributes(source) {
  const attrs = {};
  const re = /([a-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let m;
  while ((m = re.exec(source))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

const stripTags = (html) => decodeEntities(String(html).replace(/<[^>]*>/g, ''));

// Seconds since 1970 (ADD_DATE) → ms
function netscapeDate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : undefined;
}

function parseNetscapeHtml(html) {
  const text = String(html);
  if (!/<dl/i.test(text) || !/<(a|h3)\b/i.test(text)) throw new Error('not a bookmarks file');
  const root = { type: 'folder', title: '', children: [], special: null };
  const stack = [root];
  let pending = null; // folder whose <DL> has not opened yet
  let count = 0;
  const re = /<(\/?)(dl|h3|a)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(text))) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const top = stack[stack.length - 1];
    if (tag === 'dl') {
      if (closing) {
        if (stack.length > 1) stack.pop();
        pending = null;
      } else if (pending) {
        if (stack.length < MAX_DEPTH) stack.push(pending);
        pending = null;
      }
      continue;
    }
    if (closing) continue;
    const end = text.toLowerCase().indexOf(`</${tag}>`, re.lastIndex);
    const inner = end === -1 ? '' : text.slice(re.lastIndex, end);
    if (end !== -1) re.lastIndex = end + tag.length + 3;
    const attrs = parseAttributes(m[3]);
    if (++count > MAX_ITEMS) break;
    if (tag === 'h3') {
      const folder = { type: 'folder', title: cleanTitle(stripTags(inner), 'Folder'), children: [], special: null };
      if (attrs.personal_toolbar_folder === 'true') folder.special = 'bar';
      else if (attrs.unfiled_bookmarks_folder === 'true') folder.special = 'other';
      top.children.push(folder);
      pending = folder;
    } else {
      pending = null;
      const href = (attrs.href || '').trim();
      if (!isImportableUrl(href)) continue;
      const item = { type: 'url', title: cleanTitle(stripTags(inner), href), url: href };
      const addedAt = netscapeDate(attrs.add_date);
      if (addedAt) item.addedAt = addedAt;
      if (typeof attrs.icon === 'string' && /^data:image\/(png|x-icon|vnd\.microsoft\.icon|gif|jpeg|svg\+xml|webp);base64,[a-z0-9+/=]+$/i.test(attrs.icon) && attrs.icon.length < 64 * 1024) {
        item.favicon = attrs.icon;
      }
      top.children.push(item);
    }
  }
  // Chrome puts everything in one top folder only for some exporters ("Bookmarks" wrapper): unwrap it
  let topLevel = root.children;
  if (topLevel.length === 1 && topLevel[0].type === 'folder' && !topLevel[0].special && topLevel[0].children.some((c) => c.special)) {
    topLevel = topLevel[0].children;
  }
  const result = { bar: [], other: [] };
  for (const node of topLevel) {
    if (node.type === 'folder' && node.special) result[node.special].push(...node.children);
    else result.other.push(node);
  }
  return finishTree(result);
}

// Drops empty folders and internal markers
function finishTree(tree) {
  const clean = (nodes) => {
    const out = [];
    for (const node of nodes) {
      if (node.type === 'url') out.push(node);
      else {
        const children = clean(node.children || []);
        if (children.length) out.push({ type: 'folder', title: node.title, children });
      }
    }
    return out;
  };
  return { bar: clean(tree.bar), other: clean(tree.other) };
}

function countTree(tree) {
  let urls = 0;
  let folders = 0;
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'url') urls++;
      else { folders++; walk(n.children); }
    }
  };
  walk(tree.bar);
  walk(tree.other);
  return { urls, folders };
}

// ---- Chromium "Bookmarks" JSON ----

// Microseconds since 1601-01-01 → ms since 1970
function chromiumDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const ms = Math.round(n / 1000 - 11644473600000);
  return ms > 0 ? ms : undefined;
}

function parseChromiumBookmarks(jsonText) {
  const data = JSON.parse(jsonText);
  if (!data || typeof data.roots !== 'object') throw new Error('not a Chromium bookmarks file');
  let count = 0;
  const convert = (nodes, depth) => {
    const out = [];
    if (!Array.isArray(nodes) || depth > MAX_DEPTH) return out;
    for (const node of nodes) {
      if (!node || ++count > MAX_ITEMS) break;
      if (node.type === 'url' && isImportableUrl(node.url)) {
        const item = { type: 'url', title: cleanTitle(node.name, node.url), url: node.url };
        const addedAt = chromiumDate(node.date_added);
        if (addedAt) item.addedAt = addedAt;
        out.push(item);
      } else if (node.type === 'folder') {
        out.push({ type: 'folder', title: cleanTitle(node.name, 'Folder'), children: convert(node.children, depth + 1) });
      }
    }
    return out;
  };
  const roots = data.roots;
  const other = [...convert(roots.other?.children, 1)];
  const synced = convert(roots.synced?.children, 1);
  if (synced.length) other.push({ type: 'folder', title: cleanTitle(roots.synced.name, 'Mobile bookmarks'), children: synced });
  return finishTree({ bar: convert(roots.bookmark_bar?.children, 1), other });
}

// ---- Firefox places.sqlite ----

// Firefox keeps the database open (and locked, with a write-ahead log): read a private copy
function readFirefoxPlaces(placesPath) {
  const { DatabaseSync } = require('node:sqlite');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freedom-places-'));
  try {
    const copy = path.join(tmp, 'places.sqlite');
    fs.copyFileSync(placesPath, copy);
    for (const suffix of ['-wal']) {
      if (fs.existsSync(placesPath + suffix)) fs.copyFileSync(placesPath + suffix, copy + suffix);
    }
    const db = new DatabaseSync(copy);
    let rows;
    try {
      rows = db.prepare(`SELECT b.id, b.type, b.parent, b.position, b.title, b.dateAdded, b.guid, p.url
        FROM moz_bookmarks b LEFT JOIN moz_places p ON b.fk = p.id
        ORDER BY b.parent, b.position`).all();
    } finally {
      db.close();
    }
    return placesRowsToTree(rows);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function placesRowsToTree(rows) {
  const children = new Map();
  const byGuid = new Map();
  for (const row of rows) {
    byGuid.set(row.guid, row);
    if (!children.has(row.parent)) children.set(row.parent, []);
    children.get(row.parent).push(row);
  }
  let count = 0;
  const convert = (parentId, depth) => {
    const out = [];
    if (depth > MAX_DEPTH) return out;
    for (const row of children.get(parentId) || []) {
      if (++count > MAX_ITEMS) break;
      const type = Number(row.type);
      if (type === 1 && isImportableUrl(row.url)) {
        const item = { type: 'url', title: cleanTitle(row.title, row.url), url: row.url };
        const added = Number(row.dateAdded);
        if (Number.isFinite(added) && added > 0) item.addedAt = Math.round(added / 1000);
        out.push(item);
      } else if (type === 2) {
        out.push({ type: 'folder', title: cleanTitle(row.title, 'Folder'), children: convert(row.id, depth + 1) });
      }
    }
    return out;
  };
  const rootItems = (guid) => (byGuid.has(guid) ? convert(byGuid.get(guid).id, 1) : []);
  const other = [...rootItems('menu________'), ...rootItems('unfiled_____')];
  const mobile = rootItems('mobile______');
  if (mobile.length) other.push({ type: 'folder', title: 'Mobile bookmarks', children: mobile });
  return finishTree({ bar: rootItems('toolbar_____'), other });
}

// ---- Installed browsers ----

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };

function chromiumRoots({ platform, home, env }) {
  const config = env.XDG_CONFIG_HOME || path.join(home, '.config');
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const roaming = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [
      ['Google Chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
      ['Chromium', path.join(local, 'Chromium', 'User Data')],
      ['Microsoft Edge', path.join(local, 'Microsoft', 'Edge', 'User Data')],
      ['Brave', path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
      ['Vivaldi', path.join(local, 'Vivaldi', 'User Data')],
      ['Yandex Browser', path.join(local, 'Yandex', 'YandexBrowser', 'User Data')],
      ['Opera', path.join(roaming, 'Opera Software', 'Opera Stable'), true],
      ['Opera GX', path.join(roaming, 'Opera Software', 'Opera GX Stable'), true],
    ];
  }
  if (platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support');
    return [
      ['Google Chrome', path.join(support, 'Google', 'Chrome')],
      ['Chromium', path.join(support, 'Chromium')],
      ['Microsoft Edge', path.join(support, 'Microsoft Edge')],
      ['Brave', path.join(support, 'BraveSoftware', 'Brave-Browser')],
      ['Vivaldi', path.join(support, 'Vivaldi')],
      ['Yandex Browser', path.join(support, 'Yandex', 'YandexBrowser')],
      ['Opera', path.join(support, 'com.operasoftware.Opera'), true],
    ];
  }
  const flatpak = (id, ...rest) => path.join(home, '.var', 'app', id, 'config', ...rest);
  return [
    ['Google Chrome', path.join(config, 'google-chrome')],
    ['Google Chrome Beta', path.join(config, 'google-chrome-beta')],
    ['Google Chrome Dev', path.join(config, 'google-chrome-unstable')],
    ['Chromium', path.join(config, 'chromium')],
    ['Chromium (Snap)', path.join(home, 'snap', 'chromium', 'common', 'chromium')],
    ['Microsoft Edge', path.join(config, 'microsoft-edge')],
    ['Brave', path.join(config, 'BraveSoftware', 'Brave-Browser')],
    ['Vivaldi', path.join(config, 'vivaldi')],
    ['Yandex Browser', path.join(config, 'yandex-browser')],
    ['Opera', path.join(config, 'opera'), true],
    ['Google Chrome (Flatpak)', flatpak('com.google.Chrome', 'google-chrome')],
    ['Chromium (Flatpak)', flatpak('org.chromium.Chromium', 'chromium')],
    ['Brave (Flatpak)', flatpak('com.brave.Browser', 'BraveSoftware', 'Brave-Browser')],
    ['Microsoft Edge (Flatpak)', flatpak('com.microsoft.Edge', 'microsoft-edge')],
  ];
}

function firefoxRoots({ platform, home, env }) {
  if (platform === 'win32') {
    const roaming = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [
      ['Firefox', path.join(roaming, 'Mozilla', 'Firefox')],
      ['LibreWolf', path.join(roaming, 'librewolf')],
      ['Waterfox', path.join(roaming, 'Waterfox')],
      ['Floorp', path.join(roaming, 'Floorp')],
    ];
  }
  if (platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support');
    return [['Firefox', path.join(support, 'Firefox')], ['LibreWolf', path.join(support, 'librewolf')]];
  }
  const config = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [
    ['Firefox', path.join(home, '.mozilla', 'firefox')],
    ['Firefox', path.join(config, 'mozilla', 'firefox')],
    ['Firefox (Snap)', path.join(home, 'snap', 'firefox', 'common', '.mozilla', 'firefox')],
    ['Firefox (Flatpak)', path.join(home, '.var', 'app', 'org.mozilla.firefox', '.mozilla', 'firefox')],
    ['Firefox (Flatpak)', path.join(home, '.var', 'app', 'org.mozilla.firefox', 'config', 'mozilla', 'firefox')],
    ['LibreWolf', path.join(home, '.librewolf')],
    ['LibreWolf', path.join(config, 'librewolf', 'librewolf')],
    ['Waterfox', path.join(home, '.waterfox')],
    ['Floorp', path.join(home, '.floorp')],
  ];
}

function parseIni(text) {
  const sections = [];
  let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) { current = { name: header[1], values: {} }; sections.push(current); continue; }
    const eq = line.indexOf('=');
    if (current && eq > 0) current.values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return sections;
}

/** Browser profiles on this machine that hold bookmarks: [{ id, browser, profile, kind, path }] */
function listBrowserSources({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  const sources = [];
  const seen = new Set();
  const add = (browser, profile, kind, file) => {
    const real = (() => { try { return fs.realpathSync(file); } catch { return file; } })();
    if (seen.has(real)) return;
    seen.add(real);
    sources.push({ id: `src-${sources.length + 1}`, browser, profile, kind, path: file });
  };
  for (const [browser, dir, single] of chromiumRoots({ platform, home, env })) {
    if (single) {
      if (isFile(path.join(dir, 'Bookmarks'))) add(browser, '', 'chromium', path.join(dir, 'Bookmarks'));
      continue;
    }
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const names = readJson(path.join(dir, 'Local State'))?.profile?.info_cache || {};
    const dirs = entries.filter((e) => e.isDirectory() && (e.name === 'Default' || /^Profile \d+$/.test(e.name) || names[e.name]))
      .map((e) => e.name)
      .sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b, undefined, { numeric: true })));
    for (const name of dirs) {
      const file = path.join(dir, name, 'Bookmarks');
      if (isFile(file)) add(browser, cleanTitle(names[name]?.name, name), 'chromium', file);
    }
  }
  for (const [browser, dir] of firefoxRoots({ platform, home, env })) {
    let ini;
    try { ini = fs.readFileSync(path.join(dir, 'profiles.ini'), 'utf8'); } catch { continue; }
    for (const section of parseIni(ini)) {
      if (!/^Profile\d+$/i.test(section.name) || !section.values.Path) continue;
      const rel = section.values.IsRelative !== '0';
      const profileDir = rel ? path.join(dir, ...section.values.Path.split('/')) : section.values.Path;
      const file = path.join(profileDir, 'places.sqlite');
      if (isFile(file)) add(browser, cleanTitle(section.values.Name, path.basename(profileDir)), 'firefox', file);
    }
  }
  return sources;
}

function readSource(source) {
  if (source.kind === 'chromium') {
    if (fs.statSync(source.path).size > MAX_FILE_BYTES) throw new Error('file is too large');
    return parseChromiumBookmarks(fs.readFileSync(source.path, 'utf8'));
  }
  if (source.kind === 'firefox') return readFirefoxPlaces(source.path);
  throw new Error('unknown source');
}

// A file the user picked: bookmark HTML, a Chromium Bookmarks JSON or places.sqlite
function readBookmarkFile(file) {
  const size = fs.statSync(file).size;
  if (size > MAX_FILE_BYTES * 4) throw new Error('file is too large');
  const head = Buffer.alloc(16);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
  if (head.toString('latin1').startsWith('SQLite format 3')) return readFirefoxPlaces(file);
  if (size > MAX_FILE_BYTES) throw new Error('file is too large');
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  if (/^\s*\{/.test(text)) return parseChromiumBookmarks(text);
  return parseNetscapeHtml(text);
}

// ---- Export ----

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Netscape bookmark HTML that Chrome, Firefox, Edge and others import.
 * bookmarks: [{ title, url, folderId, addedAt, favicon }], folders: [{ id, name, parentId }]
 */
function buildNetscapeHtml({ bookmarks = [], folders = [], barTitle = 'Bookmarks bar', otherTitle = 'Other bookmarks' }) {
  const now = Math.floor(Date.now() / 1000);
  const known = new Set(folders.map((f) => f.id));
  const folderOf = (b) => (b.folderId && known.has(b.folderId) ? b.folderId : (b.folderId === 'bar' || !b.folderId ? 'bar' : 'other'));
  const parentOf = (f) => (f.parentId && known.has(f.parentId) && f.parentId !== f.id ? f.parentId : 'other');
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  const visited = new Set();
  const writeFolder = (id, indent) => {
    if (visited.has(id)) return;
    visited.add(id);
    const pad = '    '.repeat(indent);
    for (const b of bookmarks.filter((x) => folderOf(x) === id)) {
      if (!isImportableUrl(b.url)) continue;
      const added = Math.floor((Number(b.addedAt) || now * 1000) / 1000);
      const icon = typeof b.favicon === 'string' && b.favicon.startsWith('data:image/') ? ` ICON="${escapeHtml(b.favicon)}"` : '';
      lines.push(`${pad}<DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${added}"${icon}>${escapeHtml(b.title || b.url)}</A>`);
    }
    for (const f of folders.filter((x) => x.id !== 'bar' && x.id !== 'other' && parentOf(x) === id)) {
      lines.push(`${pad}<DT><H3 ADD_DATE="${Math.floor((Number(f.createdAt) || now * 1000) / 1000)}">${escapeHtml(f.name)}</H3>`);
      lines.push(`${pad}<DL><p>`);
      writeFolder(f.id, indent + 1);
      lines.push(`${pad}</DL><p>`);
    }
  };
  lines.push(`    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}" PERSONAL_TOOLBAR_FOLDER="true">${escapeHtml(barTitle)}</H3>`);
  lines.push('    <DL><p>');
  writeFolder('bar', 2);
  lines.push('    </DL><p>');
  lines.push(`    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}" UNFILED_BOOKMARKS_FOLDER="true">${escapeHtml(otherTitle)}</H3>`);
  lines.push('    <DL><p>');
  writeFolder('other', 2);
  lines.push('    </DL><p>');
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

module.exports = {
  parseNetscapeHtml,
  parseChromiumBookmarks,
  placesRowsToTree,
  readFirefoxPlaces,
  listBrowserSources,
  readSource,
  readBookmarkFile,
  buildNetscapeHtml,
  countTree,
  isImportableUrl,
};
