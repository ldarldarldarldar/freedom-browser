// What the address bar does with what people type: run with `npm run test:address`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SearchEngineService as S } from '../src/services/searchEngineService.ts';

const go = (input: string) => S.resolveInputToUrl(input, 'startpage');
const searched = (input: string) => go(input).startsWith('https://www.startpage.com/sp/search?query=');
const invalid = (input: string) => S.invalidPageUrl(input);

test('public hosts open over https', () => {
  assert.equal(go('example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(go('example.com?x=1'), 'https://example.com?x=1');
  assert.equal(go('https://example.com'), 'https://example.com');
  assert.equal(go('http://example.com'), 'http://example.com');
});

test('Cyrillic domains are addresses', () => {
  assert.equal(go('мир.рф'), 'https://мир.рф');
  assert.equal(go('МИР.РФ/путь'), 'https://МИР.РФ/путь');
  assert.equal(go('президент.рф'), 'https://президент.рф');
  assert.equal(go('кафе.com'), 'https://кафе.com');
  assert.equal(go('сайт.москва'), 'https://сайт.москва');
});

test('local addresses open over http', () => {
  assert.equal(go('localhost:3000'), 'http://localhost:3000');
  assert.equal(go('localhost'), 'http://localhost');
  assert.equal(go('192.168.0.1'), 'http://192.168.0.1');
  assert.equal(go('127.0.0.1:9500/x'), 'http://127.0.0.1:9500/x');
  assert.equal(go('[::1]:8080'), 'http://[::1]:8080');
  assert.equal(go('printer.local/status'), 'http://printer.local/status');
  assert.equal(go('myserver:8080'), 'http://myserver:8080');
});

test('text stays a search', () => {
  for (const text of ['c++ #1 & 100%', 'what is node.js', '1.5', 'v1.2.3', '10 + 5', 'привет', 'привет.как дела', 'да.нет', 'user@example.com', '999.1.1.1', 'http://', 'https://a b']) {
    assert.equal(searched(text), true, text);
  }
});

test('script and data addresses never run from the address bar', () => {
  for (const text of ['javascript:alert(1)', 'data:text/html,x', 'view-source:https://a.b', 'mailto:a@b.c']) {
    assert.equal(searched(text), true, text);
  }
});

test('about:blank stays itself, other addresses that do not open get the error page', () => {
  assert.equal(go('about:blank'), 'about:blank');
  assert.equal(go('ABOUT:BLANK'), 'about:blank');
  for (const text of ['about:gpu', 'chrome://gpu', 'ftp://example.com/', 'foo://bar']) {
    assert.equal(go(text), invalid(text), text);
    assert.equal(S.addressOf(go(text)), text);
    assert.equal(S.isUnknownInternalPage(go(text)), true, text);
  }
  assert.equal(S.isUnknownInternalPage(go('freedom://nope')), true);
  assert.equal(S.isUnknownInternalPage('freedom://newtab'), false);
  assert.equal(S.isUnknownInternalPage('freedom://memory'), false);
});

test('home folder paths use the real home folder', () => {
  const world = globalThis as { window?: unknown };
  world.window = { electronAPI: { homeDir: '/home/me' } };
  assert.equal(go('~/docs/a.txt'), 'file:///home/me/docs/a.txt');
  world.window = { electronAPI: { homeDir: 'C:\\Users\\me' } };
  assert.equal(go('~\\docs\\a.txt'), 'file:///C:/Users/me/docs/a.txt');
  delete world.window;
  assert.equal(go('/etc/hosts'), 'file:///etc/hosts');
});
