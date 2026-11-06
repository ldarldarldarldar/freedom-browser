// Every setting the Settings window shows must change something: run with `npm run test:settings`.
// A setting counts as used when code outside the settings definitions and the Settings window reads it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_SETTINGS } from '../src/settings/defaults.ts';
import { parseHomepage, homepageUrl, newTabUrl, startupUrl, closeAction, NEW_TAB_URL } from '../src/settings/startup.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rel, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(rel);
  }
  return out;
}

const SETTINGS_UI = path.join('src', 'pages', 'SettingsModal.tsx');
const DEFINITIONS = new Set([path.join('src', 'settings', 'defaults.ts'), path.join('src', 'settings', 'types.ts'), SETTINGS_UI]);
const consumers = [...listFiles('src', ['.ts', '.tsx']), ...listFiles('electron', ['.cjs'])].filter((f) => !DEFINITIONS.has(f));
// Comments do not count: a setting only mentioned in one is still dead
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const consumerText = consumers.map((f) => stripComments(read(f))).join('\n');

// Keys the Settings window shows or changes
function settingsShownInUi(): Set<string> {
  const ui = read(SETTINGS_UI);
  const keys = new Set<string>();
  // Not translation keys like t('settings.title')
  for (const m of ui.matchAll(/(?<![\w'".])settings\.(\w+)/g)) keys.add(m[1]);
  for (const m of ui.matchAll(/\bkey:\s*'(\w+)'/g)) keys.add(m[1]);
  for (const m of ui.matchAll(/onUpdateSettings\(\{\s*([\s\S]*?)\}\)/g)) {
    for (const k of m[1].matchAll(/(?:^|[\s,{])(\w+)\s*:/g)) keys.add(k[1]);
  }
  return keys;
}

// The palette is a nested object: its fields are read as palette.X, not as settings keys
const isSettingKey = (key: string) => Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
const isReadOutside = (key: string) => new RegExp(`\\b${key}\\b`).test(consumerText);

test('every setting shown in the Settings window exists in the defaults', () => {
  const unknown = [...settingsShownInUi()].filter((k) => !isSettingKey(k) && !(k in DEFAULT_SETTINGS.palette));
  assert.deepEqual(unknown, [], 'the Settings window uses keys that DEFAULT_SETTINGS does not have (the loader would drop them)');
});

test('every setting shown in the Settings window is read somewhere else', () => {
  const dead = [...settingsShownInUi()].filter((k) => isSettingKey(k) && !isReadOutside(k));
  assert.deepEqual(dead, [], 'these settings can be changed in the Settings window, but nothing applies them');
});

test('every stored setting is read somewhere', () => {
  const dead = Object.keys(DEFAULT_SETTINGS).filter((k) => !isReadOutside(k));
  assert.deepEqual(dead, [], 'these settings are stored, but nothing reads them');
});

// ---- What opens at startup, in new tabs and behind Home (src/settings/startup.ts) ----

test('home page: addresses are accepted, searches and internal pages are not', () => {
  assert.equal(parseHomepage(''), NEW_TAB_URL);
  assert.equal(parseHomepage('  '), NEW_TAB_URL);
  assert.equal(parseHomepage(NEW_TAB_URL), NEW_TAB_URL);
  assert.equal(parseHomepage('example.com'), 'https://example.com');
  assert.equal(parseHomepage('https://example.com/start?x=1'), 'https://example.com/start?x=1');
  assert.equal(parseHomepage('http://192.168.0.1'), 'http://192.168.0.1');
  assert.equal(parseHomepage('about:blank'), 'about:blank');
  assert.equal(parseHomepage('cats and dogs'), null);
  assert.equal(parseHomepage('freedom://memory'), null);
  assert.equal(parseHomepage('javascript:alert(1)'), null);
  assert.equal(parseHomepage('ftp://example.com'), null);
  // A bad stored value never reaches a tab
  assert.equal(homepageUrl({ homepage: 'javascript:alert(1)' }), NEW_TAB_URL);
});

test('new tab, startup tab and close action follow the settings', () => {
  const s = { ...DEFAULT_SETTINGS, homepage: 'https://example.com' };
  assert.equal(newTabUrl(s), NEW_TAB_URL);
  assert.equal(newTabUrl({ ...s, newTabBehavior: 'homepage' }), 'https://example.com');
  assert.equal(newTabUrl({ ...s, newTabBehavior: 'blank' }), 'about:blank');
  assert.equal(startupUrl(s), NEW_TAB_URL);
  assert.equal(startupUrl({ ...s, startupBehavior: 'homepage' }), 'https://example.com');
  assert.equal(startupUrl({ ...s, startupBehavior: 'restore-session' }), NEW_TAB_URL);
  assert.equal(closeAction({ ...s, onCloseWithTabs: 'ask' }), 'ask');
  assert.equal(closeAction({ ...s, onCloseWithTabs: 'discard', startupBehavior: 'restore-session' }), 'save');
});
