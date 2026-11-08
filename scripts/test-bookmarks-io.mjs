// node --test scripts/test-bookmarks-io.mjs — bookmark import/export (electron/bookmarks-io.cjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const io = require('../electron/bookmarks-io.cjs');

const CHROME_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="0" PERSONAL_TOOLBAR_FOLDER="true">Панель закладок</H3>
    <DL><p>
        <DT><A HREF="https://example.com/" ADD_DATE="1700000001" ICON="data:image/png;base64,iVBORw0KGgo=">Example &amp; Co</A>
        <DT><H3 ADD_DATE="1700000002">Работа</H3>
        <DL><p>
            <DT><A HREF="https://work.example/a?b=1&amp;c=2">Задачи</A>
            <DT><H3>Пустая</H3>
            <DL><p>
            </DL><p>
        </DL><p>
        <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
    </DL><p>
    <DT><A HREF="https://other.example/">Other one</A>
    <DT><A HREF="chrome://settings">Settings</A>
</DL><p>
`;

const FIREFOX_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Bookmarks</title>
<h1>Bookmarks Menu</h1>
<dl><p>
  <dt><h3 add_date="1" last_modified="2">Mozilla Firefox</h3>
  <dl><p>
    <dt><a href="https://support.mozilla.org/" add_date="1700000000">Get Help</a>
  </dl><p>
  <dt><a href="place:sort=8&maxResults=10">Recent</a>
  <dt><h3 personal_toolbar_folder="true">Bookmarks Toolbar</h3>
  <dl><p>
    <dt><a href="https://toolbar.example/">On toolbar</a>
  </dl><p>
  <dt><h3 unfiled_bookmarks_folder="true">Other Bookmarks</h3>
  <dl><p>
    <dt><a href="http://unfiled.example/">Unfiled &#1055;&#x440;</a>
  </dl><p>
</dl>
`;

test('Chrome HTML: toolbar folder goes to the bar, rest to other, unsafe links dropped', () => {
  const tree = io.parseNetscapeHtml(CHROME_HTML);
  assert.equal(tree.bar.length, 2);
  assert.deepEqual(tree.bar[0], {
    type: 'url', title: 'Example & Co', url: 'https://example.com/', addedAt: 1700000001000, favicon: 'data:image/png;base64,iVBORw0KGgo=',
  });
  assert.equal(tree.bar[1].type, 'folder');
  assert.equal(tree.bar[1].title, 'Работа');
  assert.deepEqual(tree.bar[1].children, [{ type: 'url', title: 'Задачи', url: 'https://work.example/a?b=1&c=2' }]);
  assert.deepEqual(tree.other.map((n) => n.url), ['https://other.example/']);
  assert.deepEqual(io.countTree(tree), { urls: 3, folders: 1 });
});

test('Firefox HTML: menu items and unfiled go to other, toolbar to bar, place: dropped', () => {
  const tree = io.parseNetscapeHtml(FIREFOX_HTML);
  assert.deepEqual(tree.bar.map((n) => n.url), ['https://toolbar.example/']);
  assert.equal(tree.other[0].title, 'Mozilla Firefox');
  assert.equal(tree.other[0].children[0].url, 'https://support.mozilla.org/');
  assert.equal(tree.other[1].title, 'Unfiled Пр');
  assert.equal(tree.other.length, 2);
});

test('something that is not a bookmarks file is refused', () => {
  assert.throws(() => io.parseNetscapeHtml('<html><body>hello</body></html>'));
  assert.throws(() => io.parseChromiumBookmarks('{"a":1}'));
});

test('Chromium Bookmarks JSON', () => {
  const json = JSON.stringify({
    version: 1,
    roots: {
      bookmark_bar: { type: 'folder', name: 'Bookmarks bar', children: [
        { type: 'url', name: 'Site', url: 'https://site.example/', date_added: '13340000000000000' },
        { type: 'folder', name: 'Dev', children: [{ type: 'url', name: '', url: 'https://dev.example/' }] },
      ] },
      other: { type: 'folder', name: 'Other', children: [{ type: 'url', name: 'Bad', url: 'javascript:void 0' }, { type: 'url', name: 'Ok', url: 'http://ok.example/' }] },
      synced: { type: 'folder', name: 'Mobile bookmarks', children: [{ type: 'url', name: 'Phone', url: 'https://m.example/' }] },
    },
  });
  const tree = io.parseChromiumBookmarks(json);
  assert.equal(tree.bar[0].addedAt, 13340000000000000 / 1000 - 11644473600000);
  assert.deepEqual(tree.bar[1], { type: 'folder', title: 'Dev', children: [{ type: 'url', title: 'https://dev.example/', url: 'https://dev.example/' }] });
  assert.deepEqual(tree.other.map((n) => n.title), ['Ok', 'Mobile bookmarks']);
});

test('Firefox places.sqlite: copy is read, roots mapped, tags and separators skipped', () => {
  const { DatabaseSync } = require('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-places-test-'));
  try {
    const file = path.join(dir, 'places.sqlite');
    const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT);
      CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, position INTEGER, title TEXT, dateAdded INTEGER, guid TEXT);
      INSERT INTO moz_places VALUES (1,'https://a.example/'),(2,'https://b.example/'),(3,'place:tag=x'),(4,'https://c.example/');
      INSERT INTO moz_bookmarks VALUES
        (1,2,NULL,0,0,'','0','root________'),
        (2,2,NULL,1,0,'menu','0','menu________'),
        (3,2,NULL,1,1,'toolbar','0','toolbar_____'),
        (4,2,NULL,1,2,'tags','0','tags________'),
        (5,2,NULL,1,3,'unfiled','0','unfiled_____'),
        (10,1,1,3,0,'A',1700000000000000,'aaaaaaaaaaaa'),
        (11,3,NULL,3,1,NULL,0,'sepsepsepsep'),
        (12,2,NULL,3,2,'Folder',0,'ffffffffffff'),
        (13,1,2,12,0,'B',0,'bbbbbbbbbbbb'),
        (14,1,3,2,0,'Recent',0,'pppppppppppp'),
        (15,2,NULL,4,0,'x',0,'tttttttttttt'),
        (16,1,4,15,0,'Tagged',0,'tgtgtgtgtgtg'),
        (17,1,4,5,0,'C',0,'cccccccccccc');`);
    db.close();
    const tree = io.readBookmarkFile(file);
    assert.deepEqual(tree.bar, [
      { type: 'url', title: 'A', url: 'https://a.example/', addedAt: 1700000000000 },
      { type: 'folder', title: 'Folder', children: [{ type: 'url', title: 'B', url: 'https://b.example/' }] },
    ]);
    assert.deepEqual(tree.other, [{ type: 'url', title: 'C', url: 'https://c.example/' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('browser profiles are found in a fake home (Chromium Local State names, Firefox profiles.ini)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-home-test-'));
  try {
    const chrome = path.join(home, '.config', 'google-chrome');
    fs.mkdirSync(path.join(chrome, 'Default'), { recursive: true });
    fs.mkdirSync(path.join(chrome, 'Profile 2'), { recursive: true });
    fs.mkdirSync(path.join(chrome, 'Profile 3'), { recursive: true }); // no Bookmarks file
    fs.writeFileSync(path.join(chrome, 'Default', 'Bookmarks'), '{"roots":{}}');
    fs.writeFileSync(path.join(chrome, 'Profile 2', 'Bookmarks'), '{"roots":{}}');
    fs.writeFileSync(path.join(chrome, 'Local State'), JSON.stringify({ profile: { info_cache: { Default: { name: 'Личный' }, 'Profile 2': { name: 'Work' } } } }));
    const ff = path.join(home, '.config', 'mozilla', 'firefox');
    fs.mkdirSync(path.join(ff, 'abc.default-release'), { recursive: true });
    fs.writeFileSync(path.join(ff, 'abc.default-release', 'places.sqlite'), '');
    fs.writeFileSync(path.join(ff, 'profiles.ini'), '[General]\nStartWithLastProfile=1\n\n[Profile0]\nName=default-release\nIsRelative=1\nPath=abc.default-release\n\n[Profile1]\nName=gone\nIsRelative=1\nPath=missing\n');
    const sources = io.listBrowserSources({ platform: 'linux', home, env: {} });
    assert.deepEqual(sources.map((s) => [s.browser, s.profile, s.kind]), [
      ['Google Chrome', 'Личный', 'chromium'],
      ['Google Chrome', 'Work', 'chromium'],
      ['Firefox', 'default-release', 'firefox'],
    ]);
    assert.equal(new Set(sources.map((s) => s.id)).size, 3);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('export is valid Netscape HTML that imports back the same tree', () => {
  const folders = [
    { id: 'bar', name: 'Bookmarks Bar', createdAt: 0 },
    { id: 'other', name: 'Other Bookmarks', createdAt: 0 },
    { id: 'f1', name: 'Dev <tools>', parentId: 'bar', createdAt: 1 },
    { id: 'f2', name: 'Deep', parentId: 'f1', createdAt: 2 },
    { id: 'f3', name: 'Reading', createdAt: 3 },
  ];
  const bookmarks = [
    { id: '1', title: 'A "quoted" & <b>', url: 'https://a.example/?x=1&y=2', folderId: 'bar', addedAt: 1700000000000 },
    { id: '2', title: 'In dev', url: 'https://dev.example/', folderId: 'f1', addedAt: 1 },
    { id: '3', title: 'Deeper', url: 'https://deep.example/', folderId: 'f2', addedAt: 1 },
    { id: '4', title: 'Read', url: 'https://read.example/', folderId: 'f3', addedAt: 1 },
    { id: '5', title: 'Other', url: 'https://other.example/', folderId: 'other', addedAt: 1 },
    { id: '6', title: 'Lost folder', url: 'https://lost.example/', folderId: 'nope', addedAt: 1 },
  ];
  const html = io.buildNetscapeHtml({ bookmarks, folders });
  assert.ok(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>'));
  const tree = io.parseNetscapeHtml(html);
  assert.deepEqual(tree.bar.map((n) => n.title ?? n.url), ['A "quoted" & <b>', 'Dev <tools>']);
  assert.equal(tree.bar[0].url, 'https://a.example/?x=1&y=2');
  assert.equal(tree.bar[0].addedAt, 1700000000000);
  assert.equal(tree.bar[1].children[0].url, 'https://dev.example/');
  assert.equal(tree.bar[1].children[1].title, 'Deep');
  assert.equal(tree.bar[1].children[1].children[0].url, 'https://deep.example/');
  assert.deepEqual(tree.other.map((n) => n.title), ['Other', 'Lost folder', 'Reading']);
});
