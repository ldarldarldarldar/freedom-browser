// Freedom Browser - self-update from GitHub releases.
// A release is offered once its signed update.json is up (it is uploaded last, see scripts/update-manifest.mjs).
// The feed address and public key come from package.json ("freedomUpdate"), so a build cannot be pointed elsewhere at run time.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { isNewerVersion, verifyUpdateFile, isInstalledCopy, nextAppImagePath, windowsInstallerCommand, startAfterExit } = require('./update-core.cjs');
const { freedomUpdate } = require('../package.json');

const MAX_FEED_BYTES = 1024 * 1024;
const FIRST_CHECK_DELAY_MS = 30 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PROGRESS_INTERVAL_MS = 150;
const UPDATER_PARTITION = 'freedom-updater'; // in memory: no cookies or history of the user's browsing

class UpdateError extends Error {
  constructor(code, cause) {
    super(cause ? `${code}: ${cause.message ?? cause}` : code);
    this.code = code;
  }
}

function createUpdater({ app, session, onAvailable, onProgress, quitApp, getSkippedVersion, setSkippedVersion, isAutoCheckEnabled }) {
  let latest = null;
  let downloadedPath = null;
  let download = null;

  const updatesDir = () => path.join(app.getPath('userData'), 'updates');
  const updaterSession = () => session.fromPartition(UPDATER_PARTITION, { cache: false });

  // How this copy was installed decides what "update" can mean for it
  function installKind() {
    if (!app.isPackaged) return null;
    if (process.platform === 'linux' && process.env.APPIMAGE) return 'appimage';
    if (process.platform === 'win32' && isInstalledCopy(path.dirname(process.execPath))) return 'nsis';
    return null; // zip, tar.gz: the user chose where this folder lives, so only link to the release
  }

  function describe(manifest) {
    const file = manifest.files[installKind()];
    return {
      version: manifest.version,
      currentVersion: app.getVersion(),
      notes: manifest.notes,
      releaseUrl: manifest.releaseUrl,
      mode: file ? 'install' : 'link',
      size: file?.size ?? 0,
    };
  }

  async function readFeed() {
    const response = await updaterSession().fetch(freedomUpdate.feedUrl, { cache: 'no-store', credentials: 'omit' });
    // 404: the newest release has no update.json (yet), which simply means nothing to offer
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`feed answered ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_FEED_BYTES) throw new Error('feed too large');
    return verifyUpdateFile(text, freedomUpdate.publicKey);
  }

  /** Returns { status: 'none' } or { status: 'available', update }; 'error' when the check itself failed. */
  async function check() {
    if (!app.isPackaged) return { status: 'none', currentVersion: app.getVersion() };
    try {
      const manifest = await readFeed();
      if (!manifest || !isNewerVersion(manifest.version, app.getVersion())) {
        return { status: 'none', currentVersion: app.getVersion() };
      }
      if (latest?.version !== manifest.version) downloadedPath = null;
      latest = manifest;
      return { status: 'available', update: describe(manifest) };
    } catch (err) {
      console.warn('[update] check failed:', err.message);
      return { status: 'error', currentVersion: app.getVersion() };
    }
  }

  async function autoCheck() {
    if (!isAutoCheckEnabled() || download) return;
    const result = await check();
    if (result.status === 'available' && getSkippedVersion() !== result.update.version) onAvailable(result.update);
  }

  function destinationFor(kind) {
    if (kind === 'appimage') {
      // Same folder as the running AppImage, so the final rename cannot cross file systems
      const dir = path.dirname(process.env.APPIMAGE);
      fs.accessSync(dir, fs.constants.W_OK);
      return path.join(dir, `.freedom-update-${process.pid}.part`);
    }
    fs.mkdirSync(updatesDir(), { recursive: true });
    return path.join(updatesDir(), `Freedom-Browser-${latest.version}-Setup.exe`);
  }

  async function fetchFile(file, destination, signal) {
    const response = await updaterSession().fetch(file.url, { signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok || !response.body) throw new UpdateError('network', `server answered ${response.status}`);
    const hash = crypto.createHash('sha256');
    let received = 0;
    let lastReport = 0;
    await pipeline(
      Readable.fromWeb(response.body),
      async function* (source) {
        for await (const chunk of source) {
          received += chunk.length;
          if (received > file.size) throw new UpdateError('verify', 'file is larger than announced');
          hash.update(chunk);
          const now = Date.now();
          if (now - lastReport >= PROGRESS_INTERVAL_MS) {
            lastReport = now;
            onProgress({ received, total: file.size });
          }
          yield chunk;
        }
      },
      fs.createWriteStream(destination, { mode: 0o755 })
    );
    onProgress({ received, total: file.size });
    if (received !== file.size || hash.digest('hex') !== file.sha256) throw new UpdateError('verify', 'checksum mismatch');
  }

  /** Downloads and verifies the update for this install. Resolves to { ok: true } or { ok: false, error }. */
  async function startDownload() {
    const kind = installKind();
    const file = latest?.files[kind];
    if (!file) return { ok: false, error: 'unavailable' };
    if (download) return { ok: false, error: 'busy' };
    if (downloadedPath && fs.existsSync(downloadedPath)) return { ok: true };

    const controller = new AbortController();
    download = controller;
    let destination = null;
    try {
      try {
        destination = destinationFor(kind);
      } catch (err) {
        throw new UpdateError('write', err);
      }
      await fetchFile(file, destination, controller.signal);
      downloadedPath = destination;
      return { ok: true };
    } catch (err) {
      if (destination) fs.rmSync(destination, { force: true });
      if (controller.signal.aborted) return { ok: false, error: 'cancelled' };
      console.warn('[update] download failed:', err.message);
      const code = err instanceof UpdateError ? err.code : err.code === 'EACCES' || err.code === 'EROFS' || err.code === 'ENOSPC' ? 'write' : 'network';
      return { ok: false, error: code };
    } finally {
      download = null;
    }
  }

  function installAppImage() {
    const current = process.env.APPIMAGE;
    const target = nextAppImagePath(current, app.getVersion(), latest.version);
    fs.renameSync(downloadedPath, target);
    if (target !== current) fs.rmSync(current, { force: true });
    downloadedPath = null;
    startAfterExit(target, process.pid, os.homedir());
    quitApp();
  }

  // Resolves once the elevated installer has started (the UAC prompt was accepted)
  function runWindowsInstaller() {
    const { file, args, env } = windowsInstallerCommand(downloadedPath);
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, { env, stdio: 'ignore', windowsHide: true });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new UpdateError('declined'))));
    });
  }

  /** Replaces this version and restarts. Only comes back when that could not be done. */
  async function install() {
    if (!latest || !downloadedPath || !fs.existsSync(downloadedPath)) return { ok: false, error: 'unavailable' };
    try {
      if (installKind() === 'appimage') {
        installAppImage();
      } else {
        await runWindowsInstaller();
        quitApp();
      }
      return { ok: true };
    } catch (err) {
      console.warn('[update] install failed:', err.message);
      return { ok: false, error: err instanceof UpdateError ? err.code : 'write' };
    }
  }

  function start() {
    // Installers of past updates are not needed once a new start has happened
    fs.rm(updatesDir(), { recursive: true, force: true }, () => {});
    setTimeout(() => autoCheck().catch((err) => console.warn('[update]', err.message)), FIRST_CHECK_DELAY_MS);
    setInterval(() => autoCheck().catch((err) => console.warn('[update]', err.message)), CHECK_INTERVAL_MS);
  }

  return {
    start,
    check,
    download: startDownload,
    cancel: () => download?.abort(),
    install,
    skip: () => latest && setSkippedVersion(latest.version),
  };
}

module.exports = { createUpdater };
