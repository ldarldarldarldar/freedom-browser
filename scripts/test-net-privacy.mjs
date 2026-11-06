// node --test scripts/test-net-privacy.mjs — HTTPS-only upgrades and secure DNS options (electron/net-privacy.cjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isLocalHostname, httpsUpgradeTarget, validDohTemplate, secureDnsOptions, SECURE_DNS_CHOICES } = require('../electron/net-privacy.cjs');

test('public http addresses are upgraded, path and query kept', () => {
  assert.equal(httpsUpgradeTarget('http://example.com/'), 'https://example.com/');
  assert.equal(httpsUpgradeTarget('http://www.example.org/a/b?q=1#x'), 'https://www.example.org/a/b?q=1#x');
  assert.equal(httpsUpgradeTarget('http://пример.рф/'), 'https://xn--e1afmkfd.xn--p1ai/');
});

test('everything that is not plain http stays as it is', () => {
  for (const url of ['https://example.com/', 'file:///tmp/a.html', 'about:blank', 'freedom://newtab', 'ftp://example.com/', 'not a url', '']) {
    assert.equal(httpsUpgradeTarget(url), null, url);
  }
});

test('local, LAN and IP addresses are never upgraded', () => {
  for (const url of [
    'http://localhost/', 'http://localhost:3000/', 'http://app.localhost/', 'http://127.0.0.1/', 'http://192.168.1.1/',
    'http://10.0.0.5/admin', 'http://[::1]/', 'http://router/', 'http://nas.local/', 'http://printer.lan/',
    'http://box.home.arpa/', 'http://svc.internal/', 'http://site.test/', 'http://abcdefghijklmnop.onion/', 'http://8.8.8.8/',
  ]) {
    assert.equal(httpsUpgradeTarget(url), null, url);
  }
  assert.ok(isLocalHostname(''));
  assert.ok(!isLocalHostname('example.com'));
  assert.ok(!isLocalHostname('local.example.com'));
});

test('an explicit port or credentials keep the address on http', () => {
  assert.equal(httpsUpgradeTarget('http://example.com:8080/'), null);
  assert.equal(httpsUpgradeTarget('http://user:pw@example.com/'), null);
  // :80 is the default port, URL drops it, so this is plain http://example.com/
  assert.equal(httpsUpgradeTarget('http://example.com:80/'), 'https://example.com/');
});

test('hosts the user chose to open over http are left alone', () => {
  const allowed = new Set(['http.badssl.com']);
  assert.equal(httpsUpgradeTarget('http://http.badssl.com/', allowed), null);
  assert.equal(httpsUpgradeTarget('http://HTTP.BADSSL.COM/x', allowed), null);
  assert.equal(httpsUpgradeTarget('http://other.badssl.com/', allowed), 'https://other.badssl.com/');
});

test('custom DoH templates must be https with a host', () => {
  assert.equal(validDohTemplate('https://dns.example/dns-query'), 'https://dns.example/dns-query');
  assert.equal(validDohTemplate(' https://dns.example/dns-query{?dns} '), 'https://dns.example/dns-query{?dns}');
  for (const bad of ['', 'http://dns.example/dns-query', 'dns.example', 'https://', 'https://u:p@dns.example/q', 'https://dns.example/a b', 'javascript:alert(1)', null]) {
    assert.equal(validDohTemplate(bad), null, String(bad));
  }
});

test('secure DNS options: providers are strict, off and invalid input give the system resolver', () => {
  assert.deepEqual(secureDnsOptions('cloudflare', '', 'linux'), { enableBuiltInResolver: true, secureDnsMode: 'secure', secureDnsServers: ['https://cloudflare-dns.com/dns-query'] });
  assert.deepEqual(secureDnsOptions('custom', 'https://dns.example/q', 'win32').secureDnsServers, ['https://dns.example/q']);
  assert.deepEqual(secureDnsOptions('off', '', 'linux'), { enableBuiltInResolver: false, secureDnsMode: 'off', secureDnsServers: [] });
  assert.equal(secureDnsOptions('off', '', 'darwin').enableBuiltInResolver, true);
  assert.equal(secureDnsOptions('custom', 'http://dns.example/q', 'linux').secureDnsMode, 'off');
  assert.equal(secureDnsOptions('nonsense', '', 'linux').secureDnsMode, 'off');
  for (const choice of SECURE_DNS_CHOICES) assert.equal(typeof secureDnsOptions(choice, 'https://dns.example/q').secureDnsMode, 'string');
});
