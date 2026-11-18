// Freedom Browser - settings for one site: cookies, JavaScript, fingerprint protection.
// A "site" is the registrable domain (sub.example.com -> example.com), so a rule covers all its subdomains.
// Rules of the normal profile are saved in site-settings.json; incognito tabs read them, but what is changed
// from an incognito tab stays in memory until the browser closes.
// Pure helpers are exported for scripts/test-site-settings.mjs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHOICES = {
  cookies: ['allow', 'session', 'block'],
  javascript: ['allow', 'block'],
  fingerprinting: ['on', 'off'],
  // default: as Settings → Privacy says
  popups: ['default', 'allow', 'block'],
};
// The first choice of each list is the default and is not stored
const DEFAULTS = Object.fromEntries(Object.entries(CHOICES).map(([key, list]) => [key, list[0]]));

// Approximate registrable domain ("sub.example.co.uk" -> "example.co.uk"); '' for anything but http(s)
function siteOf(rawUrl) {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (!/^https?:$/.test(protocol) || !hostname) return '';
    return siteOfHost(hostname);
  } catch {
    return '';
  }
}

function siteOfHost(rawHost) {
  const hostname = String(rawHost || '').toLowerCase().replace(/^\./, '').replace(/\.$/, '');
  if (!hostname) return '';
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':') || hostname.startsWith('[')) return hostname;
  const parts = hostname.split('.');
  const twoLevelSuffix = parts.length > 2 && /^(co|com|net|org|gov|edu|ac)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2;
  return parts.slice(twoLevelSuffix ? -3 : -2).join('.');
}

function validSite(site) {
  return typeof site === 'string' && site.length > 0 && site.length <= 253 && /^[a-z0-9.\-[\]:]+$/.test(site);
}

/** Store entries with unknown keys/values or default values dropped */
function cleanStore(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [site, rules] of Object.entries(raw)) {
    if (!validSite(site) || !rules || typeof rules !== 'object') continue;
    const kept = {};
    for (const [key, value] of Object.entries(rules)) {
      if (CHOICES[key]?.includes(value) && value !== DEFAULTS[key]) kept[key] = value;
    }
    if (Object.keys(kept).length) out[site] = kept;
  }
  return out;
}

/** The Content-Security-Policy added to the documents of a site whose JavaScript is blocked */
const NO_SCRIPT_CSP = "script-src 'none'";

/** Response headers of a document with scripts forbidden: the policy is added, the site's own ones still apply */
function withScriptsBlocked(headers) {
  const out = { ...(headers || {}) };
  const name = Object.keys(out).find((h) => h.toLowerCase() === 'content-security-policy') || 'Content-Security-Policy';
  const current = Array.isArray(out[name]) ? out[name] : out[name] ? [out[name]] : [];
  out[name] = [...current, NO_SCRIPT_CSP];
  return out;
}

function withoutHeader(headers, headerName) {
  const out = { ...(headers || {}) };
  for (const name of Object.keys(out)) if (name.toLowerCase() === headerName) delete out[name];
  return out;
}

/** Address to remove a cookie with session.cookies.remove */
function cookieUrl(cookie) {
  const host = String(cookie.domain || '').replace(/^\./, '');
  return `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path || '/'}`;
}

/** Fingerprint noise seed for one site in one session: stable while the browser runs, different per site */
function fingerprintSeed(secret, site) {
  return crypto.createHmac('sha256', secret).update(site || 'none').digest().readUInt32LE(0);
}

function createSiteSettings({ app, session }) {
  const storePath = path.join(app.getPath('userData'), 'site-settings.json');
  const memory = new WeakMap(); // incognito session -> { site: rules }
  const secrets = new WeakMap(); // session -> fingerprint secret for this run
  let cache = null;

  const readStore = () => {
    if (cache) return cache;
    try {
      cache = cleanStore(JSON.parse(fs.readFileSync(storePath, 'utf8')));
    } catch {
      cache = {};
    }
    return cache;
  };
  const writeStore = (store) => {
    cache = cleanStore(store);
    try {
      fs.writeFileSync(storePath, JSON.stringify(cache, null, 2), { mode: 0o600 });
    } catch (err) {
      console.warn('[site-settings] failed to save:', err.message);
    }
  };
  const isPersistent = (ses) => ses === session.defaultSession;

  /** Rules in force for a site in a session (defaults filled in) */
  function get(ses, site) {
    const saved = readStore()[site] || {};
    const overlay = isPersistent(ses) ? {} : memory.get(ses)?.[site] || {};
    return { ...DEFAULTS, ...saved, ...overlay };
  }

  function set(ses, site, key, value) {
    if (!validSite(site) || !CHOICES[key]?.includes(value)) return false;
    if (isPersistent(ses)) {
      const store = { ...readStore() };
      store[site] = { ...(store[site] || {}), [key]: value };
      writeStore(store);
    } else {
      const map = memory.get(ses) || {};
      map[site] = { ...(map[site] || {}), [key]: value };
      memory.set(ses, map);
    }
    return true;
  }

  function list() {
    const store = readStore();
    return Object.keys(store).sort().flatMap((site) => Object.entries(store[site]).map(([key, value]) => ({ site, key, value })));
  }

  function remove(site, key) {
    if (!validSite(site) || !CHOICES[key]) return false;
    const store = { ...readStore() };
    if (store[site]) {
      store[site] = { ...store[site] };
      delete store[site][key];
      writeStore(store);
    }
    return true;
  }

  /** Sites of the normal profile whose cookies and data go when the browser closes */
  const sessionOnlySites = () => Object.keys(readStore()).filter((site) => readStore()[site].cookies === 'session');

  function secretFor(ses) {
    if (!secrets.has(ses)) secrets.set(ses, crypto.randomBytes(32));
    return secrets.get(ses);
  }

  return { get, set, list, remove, sessionOnlySites, seedFor: (ses, site) => fingerprintSeed(secretFor(ses), site) };
}

module.exports = {
  CHOICES,
  DEFAULTS,
  NO_SCRIPT_CSP,
  siteOf,
  siteOfHost,
  cleanStore,
  withScriptsBlocked,
  withoutHeader,
  cookieUrl,
  fingerprintSeed,
  createSiteSettings,
};
