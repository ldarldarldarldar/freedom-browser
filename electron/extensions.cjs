// Freedom Browser — Chrome extension manager (main process).
// Extensions live unpacked in <userData>/extensions/<folder>/ and are loaded into the default
// session on every start (Electron does not persist them). Incognito partitions get none,
// matching Chrome's default. Sources: an unpacked folder, a .crx/.zip file, or a Chrome Web
// Store ID/URL (the CRX is fetched from Google's update endpoint).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const STATE_FILE = 'extensions-state.json';

const MAX_UNPACKED_FILE_BYTES = 512 * 1024 * 1024;

// ---------- CRX3 signature check ----------
function readVarint(buf, start) {
  let value = 0;
  let factor = 1;
  let pos = start;
  while (pos < buf.length) {
    const byte = buf[pos++];
    value += (byte & 0x7f) * factor;
    if (!(byte & 0x80)) return [value, pos];
    factor *= 128;
    if (factor > 2 ** 49) break;
  }
  throw new Error('Corrupt CRX header');
}

// Minimal protobuf reader: { fieldNumber: [Buffer, ...] } for the length-delimited fields a CRX3 header uses
function parseProto(buf) {
  const fields = {};
  let pos = 0;
  while (pos < buf.length) {
    const [tag, afterTag] = readVarint(buf, pos);
    pos = afterTag;
    const wire = tag % 8;
    const number = Math.floor(tag / 8);
    if (wire === 0) {
      pos = readVarint(buf, pos)[1];
    } else if (wire === 2) {
      const [length, start] = readVarint(buf, pos);
      if (start + length > buf.length) throw new Error('Corrupt CRX header');
      (fields[number] = fields[number] || []).push(buf.subarray(start, start + length));
      pos = start + length;
    } else {
      throw new Error('Corrupt CRX header');
    }
  }
  return fields;
}

const extensionIdFromBytes = (bytes) => [...bytes].map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15))).join('');

/** Verifies a CRX3 package against the key its ID is derived from. Returns the extension ID, throws if forged. */
function verifyCrx3(buf) {
  const headerSize = buf.readUInt32LE(8);
  if (12 + headerSize > buf.length) throw new Error('Corrupt CRX header');
  const header = parseProto(buf.subarray(12, 12 + headerSize));
  const signedHeader = header[10000]?.[0];
  const crxId = signedHeader && parseProto(signedHeader)[1]?.[0];
  if (!crxId || crxId.length !== 16) throw new Error('CRX package has no signed ID');
  const sizeLE = Buffer.alloc(4);
  sizeLE.writeUInt32LE(signedHeader.length);
  const signedData = Buffer.concat([Buffer.from('CRX3 SignedData\0'), sizeLE, signedHeader, buf.subarray(12 + headerSize)]);
  for (const [field, algorithm] of [[2, 'RSA-SHA256'], [3, 'SHA256']]) {
    for (const proofBytes of header[field] || []) {
      const proof = parseProto(proofBytes);
      const publicKey = proof[1]?.[0];
      const signature = proof[2]?.[0];
      if (!publicKey || !signature) continue;
      if (!crypto.createHash('sha256').update(publicKey).digest().subarray(0, 16).equals(crxId)) continue;
      const key = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
      if (crypto.createVerify(algorithm).update(signedData).verify(key, signature)) return extensionIdFromBytes(crxId);
    }
  }
  throw new Error('CRX signature is invalid');
}

function createExtensionManager({ app, session, net, confirmInstall }) {
  const root = path.join(app.getPath('userData'), 'extensions');
  const statePath = path.join(app.getPath('userData'), STATE_FILE);
  fs.mkdirSync(root, { recursive: true });

  // { [folder]: { enabled: boolean, id?: string } }
  const readState = () => {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8')) || {};
    } catch {
      return {};
    }
  };
  const writeState = (state) => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  const ses = () => session.defaultSession;
  const api = () => ses().extensions || ses(); // ses.extensions (Electron ≥ 35) or legacy

  // ---------- ZIP / CRX ----------
  function zipFromCrx(buf) {
    if (buf.slice(0, 4).toString() !== 'Cr24') return buf; // plain zip
    const version = buf.readUInt32LE(4);
    if (version === 3) return buf.slice(12 + buf.readUInt32LE(8));
    throw new Error(`Unsupported CRX version ${version}`); // CRX2 is unsigned by today's standards
  }

  function extractZip(buf, dest) {
    // End of central directory (scan back for signature 0x06054b50)
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a ZIP/CRX archive');
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const destRoot = path.resolve(dest);
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt central directory');
      const method = buf.readUInt16LE(p + 10);
      const compSize = buf.readUInt32LE(p + 20);
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      const localOff = buf.readUInt32LE(p + 42);
      const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
      p += 46 + nameLen + extraLen + commentLen;

      const target = path.resolve(destRoot, name);
      if (!target.startsWith(destRoot + path.sep) && target !== destRoot) {
        throw new Error(`Unsafe path in archive: ${name}`); // zip-slip guard
      }
      if (name.endsWith('/')) { fs.mkdirSync(target, { recursive: true }); continue; }

      const lnameLen = buf.readUInt16LE(localOff + 26);
      const lextraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lnameLen + lextraLen;
      const data = buf.slice(start, start + compSize);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (method === 0) fs.writeFileSync(target, data);
      else if (method === 8) fs.writeFileSync(target, zlib.inflateRawSync(data, { maxOutputLength: MAX_UNPACKED_FILE_BYTES }));
      else throw new Error(`Unsupported compression method ${method} for ${name}`);
    }
  }

  // ---------- helpers ----------
  // Folder names come from the UI: keep them inside the extensions directory
  function folderPath(folder) {
    if (typeof folder !== 'string' || !folder || folder === '.' || folder === '..' || /[\\/]/.test(folder)) {
      throw new Error('Invalid extension folder');
    }
    return path.join(root, folder);
  }

  // Everything the extension asks for, for the install dialog and the update check
  function requestedAccess(manifest) {
    const sites = new Set([...(manifest.host_permissions || []), ...(manifest.optional_host_permissions || [])]);
    for (const script of manifest.content_scripts || []) for (const match of script.matches || []) sites.add(match);
    const permissions = new Set();
    for (const permission of manifest.permissions || []) {
      if (typeof permission !== 'string') continue;
      if (/[:*/]/.test(permission) || permission === '<all_urls>') sites.add(permission);
      else permissions.add(permission);
    }
    return { sites: [...sites].map(String).sort(), permissions: [...permissions].sort() };
  }

  const readManifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

  // Resolves "__MSG_name__" placeholders from _locales (default_locale, then en)
  function localize(dir, manifest, value) {
    const m = typeof value === 'string' && value.match(/^__MSG_(.+)__$/);
    if (!m) return value;
    const locales = [app.getLocale().replace('-', '_'), app.getLocale().split('-')[0], manifest.default_locale, 'en'];
    for (const loc of locales.filter(Boolean)) {
      try {
        const msgs = JSON.parse(fs.readFileSync(path.join(dir, '_locales', loc, 'messages.json'), 'utf8'));
        const key = Object.keys(msgs).find((k) => k.toLowerCase() === m[1].toLowerCase());
        if (key) return msgs[key].message;
      } catch {}
    }
    return value;
  }

  function iconDataUrl(dir, manifest) {
    const icons = manifest.icons || manifest.action?.default_icon || manifest.browser_action?.default_icon || {};
    const file = typeof icons === 'string' ? icons : icons[Object.keys(icons).sort((a, b) => b - a)[0]];
    if (!file) return null;
    try {
      // A manifest must not be able to point the browser at files outside the extension
      const iconPath = fs.realpathSync(path.resolve(dir, file));
      if (!iconPath.startsWith(fs.realpathSync(dir) + path.sep)) return null;
      const data = fs.readFileSync(iconPath);
      const mime = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async function loadFolder(folder) {
    // No access to file:// pages, as in Chrome's default
    const ext = await api().loadExtension(folderPath(folder), { allowFileAccess: false });
    const state = readState();
    state[folder] = { ...(state[folder] || {}), enabled: true, id: ext.id };
    writeState(state);
    return ext;
  }

  // ---------- public ----------
  async function loadAllOnStartup() {
    const state = readState();
    for (const folder of fs.readdirSync(root)) {
      if (state[folder]?.enabled === false) continue;
      try {
        await loadFolder(folder);
      } catch (err) {
        console.warn(`[extensions] failed to load ${folder}:`, err.message);
      }
    }
  }

  function list() {
    const state = readState();
    const loaded = new Map(api().getAllExtensions().map((e) => [e.path, e]));
    return fs.readdirSync(root).flatMap((folder) => {
      const dir = path.join(root, folder);
      try {
        const manifest = readManifest(dir);
        const ext = loaded.get(dir);
        const action = manifest.action || manifest.browser_action || {};
        return [{
          folder,
          id: ext?.id || state[folder]?.id || folder,
          name: localize(dir, manifest, manifest.name),
          description: localize(dir, manifest, manifest.description || ''),
          version: manifest.version,
          manifestVersion: manifest.manifest_version,
          enabled: Boolean(ext),
          icon: iconDataUrl(dir, manifest),
          popup: action.default_popup || null,
          options: manifest.options_ui?.page || manifest.options_page || null,
          error: state[folder]?.error || null,
        }];
      } catch {
        return [];
      }
    });
  }

  async function installFromDir(srcDir, folderHint, { source = 'folder', skipConfirm = false } = {}) {
    const manifest = readManifest(srcDir); // throws if not an extension
    if (!skipConfirm) {
      await confirmInstall({
        name: localize(srcDir, manifest, manifest.name) || 'extension',
        version: manifest.version,
        source,
        ...requestedAccess(manifest),
      });
    }
    const folder = (folderHint || manifest.name || 'extension').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 64) + '-' + Date.now().toString(36);
    const dest = path.join(root, folder);
    // Links could point the extension at files outside its folder
    fs.cpSync(srcDir, dest, { recursive: true, filter: (item) => !fs.lstatSync(item).isSymbolicLink() });
    try {
      await loadFolder(folder);
    } catch (err) {
      const state = readState();
      state[folder] = { enabled: false, error: err.message };
      writeState(state);
      throw err;
    }
    return folder;
  }

  async function installFromArchive(buf, folderHint, { expectedId, source = 'file', skipConfirm = false } = {}) {
    const isCrx = buf.slice(0, 4).toString() === 'Cr24';
    const signedId = isCrx && buf.readUInt32LE(4) === 3 ? verifyCrx3(buf) : null;
    if (expectedId && signedId !== expectedId) throw new Error('The package does not match the requested extension ID');
    const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'freedom-ext-'));
    try {
      extractZip(zipFromCrx(buf), tmp);
      // some archives wrap everything in one top-level folder
      let dir = tmp;
      if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
        const entries = fs.readdirSync(dir);
        if (entries.length === 1 && fs.existsSync(path.join(dir, entries[0], 'manifest.json'))) dir = path.join(dir, entries[0]);
      }
      // Chrome Web Store metadata folder is not allowed in unpacked extensions
      fs.rmSync(path.join(dir, '_metadata'), { recursive: true, force: true });
      return await installFromDir(dir, folderHint, { source: signedId ? `${source} (ID ${signedId})` : `${source}, unsigned`, skipConfirm });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
      const req = net.request({ url, redirect: 'follow' });
      const chunks = [];
      req.on('response', (res) => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.end();
    });
  }

  async function installFromWebStore(idOrUrl) {
    const id = (String(idOrUrl).match(/[a-p]{32}/) || [])[0];
    if (!id) throw new Error('Chrome Web Store ID not found (32 letters a–p)');
    const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${process.versions.chrome}&acceptformat=crx2,crx3&x=id%3D${id}%26uc`;
    const buf = await downloadBuffer(url);
    if (buf.length < 100) throw new Error('Extension not available for download');
    return installFromArchive(buf, id, { expectedId: id, source: 'Chrome Web Store' });
  }

  const isNewerVersion = (candidate, current) => {
    const a = String(candidate).split('.').map(Number);
    const b = String(current).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return false;
  };

  /**
   * Keeps Web Store extensions patched, like Chrome. An update that asks for more access than the user
   * agreed to is skipped: the extension stays on its version until it is reinstalled.
   */
  async function updateFromStore() {
    for (const folder of fs.readdirSync(root)) {
      const id = (folder.match(/^([a-p]{32})-/) || [])[1];
      if (!id) continue;
      try {
        const dir = folderPath(folder);
        const current = readManifest(dir);
        const check = `https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=${process.versions.chrome}&acceptformat=crx3&x=id%3D${id}%26v%3D${encodeURIComponent(current.version)}%26uc`;
        const xml = (await downloadBuffer(check)).toString('utf8');
        const tag = (xml.match(/<updatecheck\b[^>]*>/) || [])[0] || '';
        const version = (tag.match(/\bversion="([^"]+)"/) || [])[1];
        const codebase = (tag.match(/\bcodebase="([^"]+)"/) || [])[1];
        if (!version || !codebase || !codebase.startsWith('https://') || !isNewerVersion(version, current.version)) continue;
        const buf = await downloadBuffer(codebase.replace(/&amp;/g, '&'));
        if (verifyCrx3(buf) !== id) throw new Error('package ID mismatch');
        await replaceWithUpdate(folder, current, buf, id);
      } catch (err) {
        console.warn(`[extensions] update of ${folder} failed:`, err.message);
      }
    }
  }

  async function replaceWithUpdate(folder, current, buf, id) {
    const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'freedom-ext-'));
    try {
      extractZip(zipFromCrx(buf), tmp);
      const before = requestedAccess(current);
      const after = requestedAccess(readManifest(tmp));
      const asksMore = after.sites.some((s) => !before.sites.includes(s)) || after.permissions.some((p) => !before.permissions.includes(p));
      if (asksMore) {
        console.warn(`[extensions] ${folder}: the update asks for more access, not installed automatically`);
        return;
      }
      const wasEnabled = readState()[folder]?.enabled !== false;
      fs.rmSync(path.join(tmp, '_metadata'), { recursive: true, force: true });
      const fresh = await installFromDir(tmp, id, { skipConfirm: true });
      remove(folder);
      if (!wasEnabled) await setEnabled(fresh, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  async function setEnabled(folder, enabled) {
    const state = readState();
    const dir = folderPath(folder);
    const ext = api().getAllExtensions().find((e) => e.path === dir);
    if (enabled && !ext) {
      await loadFolder(folder);
    } else if (!enabled && ext) {
      api().removeExtension(ext.id);
      state[folder] = { ...(state[folder] || {}), enabled: false };
      writeState(state);
    }
  }

  function remove(folder) {
    const dir = folderPath(folder);
    const ext = api().getAllExtensions().find((e) => e.path === dir);
    if (ext) api().removeExtension(ext.id);
    fs.rmSync(dir, { recursive: true, force: true });
    const state = readState();
    delete state[folder];
    writeState(state);
  }

  function pageUrl(folder, page) {
    const dir = folderPath(folder);
    const ext = api().getAllExtensions().find((e) => e.path === dir);
    if (!ext || !page) return null;
    return `chrome-extension://${ext.id}/${page.replace(/^\//, '')}`;
  }

  return { root, loadAllOnStartup, list, installFromDir, installFromArchive, installFromWebStore, updateFromStore, setEnabled, remove, pageUrl };
}

module.exports = { createExtensionManager, verifyCrx3 };
