// Checks the update logic that protects users: run with `npm run test:update`.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { isNewerVersion, verifyUpdateFile, isInstalledCopy, nextAppImagePath } = require('../electron/update-core.cjs');

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
