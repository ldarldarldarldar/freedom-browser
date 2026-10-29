// Freedom Browser — Chrome extension manager (main process).
// Extensions live unpacked in <userData>/extensions/<folder>/ and are loaded into the default
// session on every start (Electron does not persist them). Incognito partitions get none,
// matching Chrome's default. Sources: an unpacked folder, a .crx/.zip file, or a Chrome Web
// Store ID/URL (the CRX is fetched from Google's update endpoint).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const STATE_FILE = 'extensions-state.json';

function createExtensionManager({ app, session, net }) {
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
    if (version === 2) return buf.slice(16 + buf.readUInt32LE(8) + buf.readUInt32LE(12));
    throw new Error(`Unsupported CRX version ${version}`);
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
      else if (method === 8) fs.writeFileSync(target, zlib.inflateRawSync(data));
      else throw new Error(`Unsupported compression method ${method} for ${name}`);
    }
  }

  // ---------- helpers ----------
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
      const data = fs.readFileSync(path.join(dir, file));
      const mime = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async function loadFolder(folder) {
    const ext = await api().loadExtension(path.join(root, folder), { allowFileAccess: true });
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

  async function installFromDir(srcDir, folderHint) {
    const manifest = readManifest(srcDir); // throws if not an extension
    const folder = (folderHint || manifest.name || 'extension').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 64) + '-' + Date.now().toString(36);
    const dest = path.join(root, folder);
    fs.cpSync(srcDir, dest, { recursive: true });
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

  async function installFromArchive(buf, folderHint) {
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
      return await installFromDir(dir, folderHint);
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
    return installFromArchive(buf, id);
  }

  async function setEnabled(folder, enabled) {
    const state = readState();
    const dir = path.join(root, folder);
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
    const dir = path.join(root, folder);
    if (!path.resolve(dir).startsWith(root + path.sep)) throw new Error('Invalid extension folder');
    const ext = api().getAllExtensions().find((e) => e.path === dir);
    if (ext) api().removeExtension(ext.id);
    fs.rmSync(dir, { recursive: true, force: true });
    const state = readState();
    delete state[folder];
    writeState(state);
  }

  function pageUrl(folder, page) {
    const dir = path.join(root, folder);
    const ext = api().getAllExtensions().find((e) => e.path === dir);
    if (!ext || !page) return null;
    return `chrome-extension://${ext.id}/${page.replace(/^\//, '')}`;
  }

  return { root, loadAllOnStartup, list, installFromDir, installFromArchive, installFromWebStore, setEnabled, remove, pageUrl };
}

module.exports = { createExtensionManager };
