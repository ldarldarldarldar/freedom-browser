// Checks the update logic that protects users: run with `npm run test:update`.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { isNewerVersion, verifyUpdateFile, isInstalledCopy, nextAppImagePath, relaunchCommand } = require('../electron/update-core.cjs');
import { spawnSync } from 'node:child_process';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const PUBLIC = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const FILE = { url: 'https://github.com/x/y/releases/download/v1/a.AppImage', sha256: 'a'.repeat(64), size: 10 };
const BASE = { version: '0.6.6', releaseUrl: 'https://github.com/x/y/releases/tag/v0.6.6', notes: { ru: 'р', en: 'e' }, files: { appimage: FILE } };

const signed = (manifest, key = privateKey) => {
  const text = JSON.stringify(manifest);
  return JSON.stringify({ manifest: text, signature: crypto.sign(null, Buffer.from(text), key).toString('base64') });
};

test('version order follows the project numbering', () => {
  assert.equal(isNewerVersion('0.6.5-1', '0.6.5'), true);
  assert.equal(isNewerVersion('0.6.5', '0.6.5-1'), false);
  // 0.6.5-1 clients must be offered 0.6.5-2 (semver would not order these as a release line)
  assert.equal(isNewerVersion('0.6.5-2', '0.6.5-1'), true);
  assert.equal(isNewerVersion('0.6.5-1', '0.6.5-2'), false);
  assert.equal(isNewerVersion('0.6.5-2', '0.6.5'), true);
  assert.equal(isNewerVersion('0.6.6', '0.6.5-9'), true);
  assert.equal(isNewerVersion('0.10.0', '0.9.9'), true);
  assert.equal(isNewerVersion('0.6.5', '0.6.5'), false);
});

test('a correctly signed manifest is accepted', () => {
  assert.equal(verifyUpdateFile(signed(BASE), PUBLIC).version, '0.6.6');
});

test('a manifest signed by another key is rejected', () => {
  const other = crypto.generateKeyPairSync('ed25519').privateKey;
  assert.throws(() => verifyUpdateFile(signed(BASE, other), PUBLIC), /bad signature/);
});

test('a changed manifest is rejected', () => {
  const outer = JSON.parse(signed(BASE));
  outer.manifest = outer.manifest.replace('0.6.6', '9.9.9');
  assert.throws(() => verifyUpdateFile(JSON.stringify(outer), PUBLIC), /bad signature/);
});

test('signed but malformed contents are rejected', () => {
  assert.throws(() => verifyUpdateFile(signed({ ...BASE, version: '1.0; rm' }), PUBLIC), /bad version/);
  assert.throws(() => verifyUpdateFile(signed({ ...BASE, releaseUrl: 'javascript:alert(1)' }), PUBLIC), /bad release url/);
  const http = { ...FILE, url: 'http://example.com/a' };
  assert.throws(() => verifyUpdateFile(signed({ ...BASE, files: { appimage: http } }), PUBLIC), /bad file entry/);
  assert.throws(() => verifyUpdateFile(signed({ ...BASE, files: { appimage: { ...FILE, sha256: 'x' } } }), PUBLIC), /bad file entry/);
  assert.throws(() => verifyUpdateFile('{}', PUBLIC), /malformed/);
});

test('an installed copy is told from an unpacked one by its uninstaller', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freedom-update-test-'));
  try {
    fs.writeFileSync(path.join(dir, 'freedom-browser.exe'), '');
    assert.equal(isInstalledCopy(dir), false);
    fs.writeFileSync(path.join(dir, 'Uninstall freedom-browser.exe'), '');
    assert.equal(isInstalledCopy(dir), true);
    assert.equal(isInstalledCopy(path.join(dir, 'missing')), false);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('the AppImage keeps a custom name and renews a versioned one', () => {
  const dir = path.join(path.sep, 'apps');
  assert.equal(nextAppImagePath(path.join(dir, 'Freedom-Browser-0.6.5-x86_64.AppImage'), '0.6.5', '0.6.6'), path.join(dir, 'Freedom-Browser-0.6.6-x86_64.AppImage'));
  assert.equal(nextAppImagePath(path.join(dir, 'Freedom.AppImage'), '0.6.5', '0.6.6'), path.join(dir, 'Freedom.AppImage'));
});

// The relaunched AppImage must not inherit the old one's open files, or its FUSE mount never goes away
test('the relaunch helper does not pass inherited descriptors to the new version', { skip: process.platform !== 'linux' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-relaunch-'));
  try {
    const report = path.join(dir, 'fds.txt');
    const target = path.join(dir, 'target.sh');
    fs.writeFileSync(target, `#!/bin/sh\nls /proc/$$/fd > "${report}"\n`, { mode: 0o755 });
    const held = fs.openSync(path.join(dir, 'held'), 'w');
    // The parent of the helper keeps descriptors 3, 12 and 20 open, as Electron does with its own files
    const stdio = Array.from({ length: 21 }, () => 'ignore');
    stdio[3] = held; stdio[12] = held; stdio[20] = held;
    const readReport = () => fs.readFileSync(report, 'utf8').split(/\s+/).filter(Boolean).map(Number);
    const run = (bash) => {
      const { file, args } = relaunchCommand(target, 999999999, { bash });
      const r = spawnSync(file, args, { stdio, timeout: 10000 });
      assert.equal(r.status, 0, String(r.stderr));
      return readReport();
    };
    // What the target opens by itself (dash keeps its script on 10 and up, ls reads /proc on one more)
    assert.equal(spawnSync(target, [], { stdio: 'ignore', timeout: 10000 }).status, 0);
    const baseline = readReport();
    const bash = ['/bin/bash', '/usr/bin/bash'].find((p) => fs.existsSync(p));
    if (bash) {
      const fds = run(bash);
      assert.ok(!fds.includes(3) && !fds.includes(12) && !fds.includes(20), fds.join(' '));
      // Nothing beyond what the target opens when started on its own
      assert.deepEqual(fds.filter((fd) => !baseline.includes(fd)), [], `${fds.join(' ')} vs ${baseline.join(' ')}`);
    }
    // Plain sh can only close 3-9
    assert.ok(!run(null).includes(3));
    fs.closeSync(held);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
