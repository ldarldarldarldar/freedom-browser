// Site rules (electron/site-settings.cjs): run with `npm run test:sites`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../electron/site-settings.cjs');
const { shieldScript } = require('../electron/fingerprint-shield.cjs');

test('a site is the registrable domain', () => {
  assert.equal(lib.siteOf('https://www.example.com/a'), 'example.com');
  assert.equal(lib.siteOf('http://a.b.example.co.uk/'), 'example.co.uk');
  assert.equal(lib.siteOf('https://127.0.0.1:8080/'), '127.0.0.1');
  assert.equal(lib.siteOf('file:///etc/passwd'), '');
  assert.equal(lib.siteOf('freedom://newtab'), '');
  assert.equal(lib.siteOfHost('.accounts.google.com'), 'google.com');
});

test('the store keeps only known, non-default rules for valid sites', () => {
  assert.deepEqual(
    lib.cleanStore({
      'example.com': { cookies: 'block', javascript: 'allow', bogus: 'x' },
      'bad site': { cookies: 'block' },
      'x.org': { fingerprinting: 'maybe' },
      'y.org': { fingerprinting: 'off', cookies: 'session' },
    }),
    { 'example.com': { cookies: 'block' }, 'y.org': { fingerprinting: 'off', cookies: 'session' } }
  );
  assert.deepEqual(lib.cleanStore(null), {});
});

test('blocked scripts add a policy and keep the site one', () => {
  const h = lib.withScriptsBlocked({ 'content-security-policy': ["default-src 'self'"], 'x-a': ['1'] });
  assert.deepEqual(h['content-security-policy'], ["default-src 'self'", "script-src 'none'"]);
  assert.deepEqual(lib.withScriptsBlocked({})['Content-Security-Policy'], ["script-src 'none'"]);
});

test('set-cookie is removed whatever its case', () => {
  assert.deepEqual(lib.withoutHeader({ 'Set-Cookie': ['a=1'], 'set-cookie': ['b=2'], Other: ['x'] }, 'set-cookie'), { Other: ['x'] });
});

test('cookie removal address', () => {
  assert.equal(lib.cookieUrl({ domain: '.example.com', path: '/p', secure: true }), 'https://example.com/p');
  assert.equal(lib.cookieUrl({ domain: 'example.com', secure: false }), 'http://example.com/');
});

test('fingerprint seeds: stable per site, different across sites and runs', () => {
  const a = Buffer.alloc(32, 1);
  const b = Buffer.alloc(32, 2);
  assert.equal(lib.fingerprintSeed(a, 'example.com'), lib.fingerprintSeed(a, 'example.com'));
  assert.notEqual(lib.fingerprintSeed(a, 'example.com'), lib.fingerprintSeed(a, 'other.com'));
  assert.notEqual(lib.fingerprintSeed(a, 'example.com'), lib.fingerprintSeed(b, 'example.com'));
});

test('rules: saved for the profile, in memory for incognito', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-sites-'));
  const defaultSession = {};
  const incognito = {};
  const app = { getPath: () => dir };
  const s = lib.createSiteSettings({ app, session: { defaultSession } });
  assert.deepEqual(s.get(defaultSession, 'example.com'), { cookies: 'allow', javascript: 'allow', fingerprinting: 'on', popups: 'default' });
  assert.equal(s.set(defaultSession, 'example.com', 'popups', 'allow'), true);
  assert.equal(s.get(defaultSession, 'example.com').popups, 'allow');
  s.remove('example.com', 'popups');
  assert.equal(s.set(defaultSession, 'example.com', 'cookies', 'session'), true);
  assert.equal(s.set(defaultSession, 'example.com', 'cookies', 'nope'), false);
  assert.equal(s.set(defaultSession, 'bad site', 'cookies', 'block'), false);
  assert.equal(s.set(incognito, 'secret.org', 'javascript', 'block'), true);
  // Incognito sees the profile rules and its own; the profile does not see incognito ones
  assert.equal(s.get(incognito, 'example.com').cookies, 'session');
  assert.equal(s.get(incognito, 'secret.org').javascript, 'block');
  assert.equal(s.get(defaultSession, 'secret.org').javascript, 'allow');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'site-settings.json'), 'utf8'));
  assert.deepEqual(saved, { 'example.com': { cookies: 'session' } });
  assert.deepEqual(s.sessionOnlySites(), ['example.com']);
  // Back to the default: nothing stored
  s.set(defaultSession, 'example.com', 'cookies', 'allow');
  assert.deepEqual(s.list(), []);
  s.set(defaultSession, 'example.com', 'javascript', 'block');
  assert.deepEqual(s.list(), [{ site: 'example.com', key: 'javascript', value: 'block' }]);
  s.remove('example.com', 'javascript');
  assert.deepEqual(s.list(), []);
  // A new instance reads the file
  s.set(defaultSession, 'kept.net', 'fingerprinting', 'off');
  const again = lib.createSiteSettings({ app, session: { defaultSession } });
  assert.equal(again.get(defaultSession, 'kept.net').fingerprinting, 'off');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the protection script is valid JavaScript with the seed inside', () => {
  const code = shieldScript(123456789);
  assert.ok(code.includes('const SEED = 123456789;'));
  assert.doesNotThrow(() => new Function(code));
  assert.ok(shieldScript(-1).includes('const SEED = 4294967295;'));
});
