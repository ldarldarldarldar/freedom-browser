// HTTPS-only mode and secure DNS: pure logic (no Electron), tested by scripts/test-net-privacy.mjs.
const net = require('net');

// Names that never have a public certificate: the machine itself, the local network, Tor
const LOCAL_SUFFIXES = ['.localhost', '.local', '.lan', '.home', '.home.arpa', '.internal', '.intranet', '.corp', '.test', '.example', '.invalid', '.onion', '.i2p'];

function isLocalHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  // IP literals (also [::1]): LAN devices and servers addressed by number rarely have certificates for it
  if (net.isIP(host.replace(/^\[|\]$/g, ''))) return true;
  // Single-label names ("router", "nas") only resolve on the local network
  if (!host.includes('.')) return true;
  if (host === 'localhost') return true;
  return LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * The https:// address a top-level http:// navigation is upgraded to, or null when it stays as it is:
 * not http, a local or IP address, an explicit port (http://host:8080 says nothing about https on 8080),
 * or a host the user chose to open over http.
 */
function httpsUpgradeTarget(rawUrl, allowedHttpHosts = new Set()) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== 'http:' || u.port || u.username || u.password) return null;
  if (isLocalHostname(u.hostname)) return null;
  if (allowedHttpHosts.has(u.hostname.toLowerCase())) return null;
  u.protocol = 'https:';
  return u.toString();
}

// DoH providers offered in Settings. Every template is https and has no {?dns} variable (POST is used then).
const SECURE_DNS_PROVIDERS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  quad9: 'https://dns.quad9.net/dns-query',
  adguard: 'https://dns.adguard-dns.com/dns-query',
  mullvad: 'https://dns.mullvad.net/dns-query',
};

/** A user's DoH template, or null when it is not a plain https URL with a host */
function validDohTemplate(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 512 || /\s/.test(text)) return null;
  let u;
  try { u = new URL(text.replace(/\{\?dns\}$/, '')); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
  return text;
}

/**
 * Options for app.configureHostResolver. "off" leaves name resolution to the system.
 * Any provider is used in strict ("secure") mode: falling back to the system resolver would quietly
 * send every name in the clear, which is what the user turned this on to avoid.
 */
function secureDnsOptions(provider, customUrl, platform = process.platform) {
  const template = provider === 'custom' ? validDohTemplate(customUrl) : SECURE_DNS_PROVIDERS[provider];
  if (!template) {
    // Chromium's own resolver is the default on macOS only
    return { enableBuiltInResolver: platform === 'darwin', secureDnsMode: 'off', secureDnsServers: [] };
  }
  return { enableBuiltInResolver: true, secureDnsMode: 'secure', secureDnsServers: [template] };
}

const SECURE_DNS_CHOICES = ['off', ...Object.keys(SECURE_DNS_PROVIDERS), 'custom'];

module.exports = { isLocalHostname, httpsUpgradeTarget, SECURE_DNS_PROVIDERS, SECURE_DNS_CHOICES, validDohTemplate, secureDnsOptions };
