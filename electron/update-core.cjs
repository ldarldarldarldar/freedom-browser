// Freedom Browser - the parts of the updater that need no Electron, so plain Node can test them
// (scripts/test-update-core.mjs, and the Windows installer test in CI runs windowsInstallerCommand for real).
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

const VERSION_RE = /^\d+\.\d+\.\d+(-\d+)?$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const MAX_NOTES_LENGTH = 4000;

// "0.6.4-5" is newer than "0.6.4-4" and "0.6.4" in this project's numbering (semver would say the opposite)
function isNewerVersion(candidate, current) {
  const parts = (v) => String(v).replace(/^v/, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

// https only. Plain http just for this machine: the test feed of a test build, whose files are still signed.
function isAllowedUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function isValidFile(file) {
  return Boolean(file)
    && isAllowedUrl(file.url)
    && typeof file.sha256 === 'string' && SHA256_RE.test(file.sha256)
    && Number.isSafeInteger(file.size) && file.size > 0;
}

/**
 * update.json is { manifest: "<JSON text>", signature: "<base64 ed25519 over that text>" }.
 * Returns the manifest only if the signature is good and its contents are well formed; throws otherwise.
 * The version is inside what is signed, so an old signed manifest cannot be replayed as a new version.
 */
function verifyUpdateFile(text, publicKeyBase64) {
  const outer = JSON.parse(text);
  if (typeof outer?.manifest !== 'string' || typeof outer?.signature !== 'string') throw new Error('malformed update file');
  const key = crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
  if (!crypto.verify(null, Buffer.from(outer.manifest, 'utf8'), key, Buffer.from(outer.signature, 'base64'))) {
    throw new Error('bad signature');
  }
  const manifest = JSON.parse(outer.manifest);
  if (!VERSION_RE.test(manifest?.version ?? '')) throw new Error('bad version');
  if (!isAllowedUrl(manifest.releaseUrl)) throw new Error('bad release url');
  for (const file of Object.values(manifest.files ?? {})) {
    if (!isValidFile(file)) throw new Error('bad file entry');
  }
  const notes = manifest.notes ?? {};
  return {
    version: manifest.version,
    releaseUrl: manifest.releaseUrl,
    notes: {
      ru: String(notes.ru ?? '').slice(0, MAX_NOTES_LENGTH),
      en: String(notes.en ?? '').slice(0, MAX_NOTES_LENGTH),
    },
    files: manifest.files ?? {},
  };
}

/** Where the new AppImage goes: a name with the old version in it gets the new one, any other name is kept. */
function nextAppImagePath(currentPath, currentVersion, newVersion) {
  const name = path.basename(currentPath);
  return name.includes(currentVersion)
    ? path.join(path.dirname(currentPath), name.replace(currentVersion, newVersion))
    : currentPath;
}

/**
 * The per-machine installer needs elevation, which only ShellExecute (Start-Process -Verb RunAs) can ask for.
 * --updated keeps the user's shortcuts and folder; --force-run starts the new version as the normal user.
 * The path travels in the environment, so nothing in it is parsed as PowerShell. Exit code 1 = UAC declined.
 */
function windowsInstallerCommand(setupPath) {
  return {
    file: 'powershell.exe',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      "try { Start-Process -FilePath $env:FREEDOM_UPDATE_SETUP -ArgumentList '/S','--updated','--force-run' -Verb RunAs -ErrorAction Stop } catch { exit 1 }",
    ],
    env: { ...process.env, FREEDOM_UPDATE_SETUP: setupPath },
  };
}

// AppRun points these at the mount of the AppImage that is about to exit
const APPIMAGE_ENV = ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD', 'LD_LIBRARY_PATH', 'CHROME_DESKTOP'];

/** Starts `target` once process `pid` is gone: the new version would otherwise lose the single-instance lock to it. */
function startAfterExit(target, pid, cwd) {
  const env = { ...process.env };
  for (const name of APPIMAGE_ENV) delete env[name];
  const script = 'i=0; while kill -0 "$1" 2>/dev/null && [ "$i" -lt 150 ]; do sleep 0.2; i=$((i+1)); done; exec "$2"';
  const child = spawn('/bin/sh', ['-c', script, 'sh', String(pid), target], { detached: true, stdio: 'ignore', env, cwd });
  child.unref();
}

module.exports = { isNewerVersion, verifyUpdateFile, nextAppImagePath, windowsInstallerCommand, startAfterExit };
