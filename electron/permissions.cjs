// Freedom Browser - site permissions (camera, microphone, location, notifications, external apps...).
// Electron grants everything by default, so every session used for browsing goes through this manager.
// Decisions: "allow"/"block" per origin. "Always" and "block" are saved for the normal profile only;
// session decisions and everything from incognito tabs live in memory.
const fs = require('fs');
const path = require('path');

// No prompt in Chrome either: they need a user action or only affect the page itself
const SAFE_PERMISSIONS = new Set([
  'fullscreen',
  'pointerLock',
  'keyboardLock',
  'clipboard-sanitized-write',
  'mediaKeySystem',
  'fileSystem',
]);

// Handlers that are abused to run code or leak credentials: never opened from a web page
const BLOCKED_SCHEMES = new Set([
  'file', 'smb', 'nfs', 'ftp', 'javascript', 'vbscript', 'data', 'jar', 'shell',
  'ms-msdt', 'search-ms', 'search', 'ms-officecmd', 'ms-word', 'ms-excel', 'ms-powerpoint',
  'ms-excel-macro', 'ms-appinstaller', 'ms-cxh', 'ms-cxh-full', 'hcp', 'res', 'mhtml', 'telnet', 'ldap',
]);

const TEXT = {
  en: {
    title: 'Site permission',
    media: 'use your camera and microphone',
    video: 'use your camera',
    audio: 'use your microphone',
    geolocation: 'know your location',
    notifications: 'show notifications',
    'clipboard-read': 'read your clipboard',
    midi: 'use MIDI devices',
    midiSysex: 'use MIDI devices',
    'storage-access': 'use its cookies on this page',
    'top-level-storage-access': 'use its cookies on this page',
    'idle-detection': 'know when you are idle',
    hid: 'access HID devices',
    serial: 'access serial ports',
    usb: 'access USB devices',
    other: 'use "%s"',
    asks: '%o wants to %p',
    block: 'Block',
    session: 'Allow until restart',
    always: 'Allow always',
    externalTitle: 'Open another application?',
    externalAsks: '%o wants to open an external application with this link:',
    open: 'Open',
    cancel: 'Cancel',
  },
  ru: {
    title: 'Разрешение для сайта',
    media: 'использовать камеру и микрофон',
    video: 'использовать камеру',
    audio: 'использовать микрофон',
    geolocation: 'узнать ваше местоположение',
    notifications: 'показывать уведомления',
    'clipboard-read': 'читать буфер обмена',
    midi: 'использовать MIDI-устройства',
    midiSysex: 'использовать MIDI-устройства',
    'storage-access': 'использовать свои cookie на этой странице',
    'top-level-storage-access': 'использовать свои cookie на этой странице',
    'idle-detection': 'узнавать, когда вы неактивны',
    hid: 'получить доступ к HID-устройствам',
    serial: 'получить доступ к последовательным портам',
    usb: 'получить доступ к USB-устройствам',
    other: 'использовать «%s»',
    asks: '%o запрашивает разрешение %p',
    block: 'Заблокировать',
    session: 'Разрешить до перезапуска',
    always: 'Разрешать всегда',
    externalTitle: 'Открыть другое приложение?',
    externalAsks: '%o хочет открыть внешнее приложение по этой ссылке:',
    open: 'Открыть',
    cancel: 'Отмена',
  },
};

function originOf(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'file:' ? 'file://' : u.origin === 'null' ? `${u.protocol}//${u.host}` : u.origin;
  } catch {
    return '';
  }
}

function createPermissionManager({ app, session, dialog, windowFor, language }) {
  const storePath = path.join(app.getPath('userData'), 'site-permissions.json');
  const memory = new WeakMap(); // session -> Map("origin|key" -> decision)
  let queue = Promise.resolve(); // one dialog at a time

  const readStore = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };
  const writeStore = (store) => {
    try {
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2), { mode: 0o600 });
    } catch (err) {
      console.warn('[permissions] failed to save:', err.message);
    }
  };
  const isPersistent = (ses) => ses === session.defaultSession;
  const sessionMap = (ses) => {
    if (!memory.has(ses)) memory.set(ses, new Map());
    return memory.get(ses);
  };

  function decisionFor(ses, origin, key) {
    const inMemory = sessionMap(ses).get(`${origin}|${key}`);
    if (inMemory) return inMemory;
    return isPersistent(ses) ? readStore()[origin]?.[key] : undefined;
  }

  function remember(ses, origin, keys, decision, persist) {
    for (const key of keys) sessionMap(ses).set(`${origin}|${key}`, decision);
    if (!persist || !isPersistent(ses)) return;
    const store = readStore();
    store[origin] = { ...(store[origin] || {}) };
    for (const key of keys) store[origin][key] = decision;
    writeStore(store);
  }

  const texts = () => TEXT[language()] || TEXT.en;

  function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  function showDialog(contents, options) {
    const win = windowFor(contents);
    return win && !win.isDestroyed() ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
  }

  async function askPermission(ses, contents, origin, permission, keys, isPrivate) {
    // The answer to an earlier dialog in the queue may already cover this request
    const known = keys.map((key) => decisionFor(ses, origin, key));
    if (known.includes('block')) return false;
    if (known.every((d) => d === 'allow')) return true;
    if (contents.isDestroyed()) return false;

    const t = texts();
    const what = permission === 'media'
      ? t[keys.length === 2 ? 'media' : keys[0] === 'media:video' ? 'video' : 'audio']
      : t[permission] || t.other.replace('%s', permission);
    const buttons = isPrivate ? [t.block, t.session] : [t.block, t.session, t.always];
    const { response } = await showDialog(contents, {
      type: 'question',
      title: t.title,
      message: t.asks.replace('%o', origin).replace('%p', what),
      buttons,
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (response === 0) {
      remember(ses, origin, keys, 'block', !isPrivate);
      return false;
    }
    remember(ses, origin, keys, 'allow', response === 2);
    return true;
  }

  async function askExternal(ses, contents, origin, externalUrl) {
    let scheme = '';
    try { scheme = new URL(externalUrl).protocol.replace(':', '').toLowerCase(); } catch {}
    if (!scheme || BLOCKED_SCHEMES.has(scheme)) return false;
    const key = `openExternal:${scheme}`;
    if (decisionFor(ses, origin, key) === 'block') return false;
    if (contents.isDestroyed()) return false;

    const t = texts();
    const { response } = await showDialog(contents, {
      type: 'warning',
      title: t.externalTitle,
      message: t.externalAsks.replace('%o', origin),
      detail: externalUrl.length > 300 ? `${externalUrl.slice(0, 300)}…` : externalUrl,
      buttons: [t.cancel, t.open],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    // Refusals last for the session so a page cannot loop the dialog; every launch is asked again
    if (response !== 1) remember(ses, origin, [key], 'block', false);
    return response === 1;
  }

  function keysFor(permission, details) {
    if (permission !== 'media') return [permission];
    const types = details?.mediaTypes?.length ? details.mediaTypes : ['audio', 'video'];
    return types.map((type) => `media:${type}`);
  }

  function attach(ses) {
    ses.setPermissionRequestHandler((contents, permission, callback, details) => {
      if (SAFE_PERMISSIONS.has(permission)) return callback(true);
      const origin = originOf(details?.requestingUrl || contents?.getURL?.() || '');
      if (!origin || !contents) return callback(false);
      const task = permission === 'openExternal'
        ? () => askExternal(ses, contents, origin, details?.externalURL || '')
        : () => askPermission(ses, contents, origin, permission, keysFor(permission, details), !isPersistent(ses));
      enqueue(task).then((granted) => callback(Boolean(granted)), () => callback(false));
    });

    ses.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
      if (SAFE_PERMISSIONS.has(permission)) return true;
      const origin = originOf(requestingOrigin || details?.requestingUrl || contents?.getURL?.() || '');
      if (!origin) return false;
      if (permission === 'media') {
        const types = details?.mediaType === 'audio' || details?.mediaType === 'video' ? [details.mediaType] : ['audio', 'video'];
        return types.some((type) => decisionFor(ses, origin, `media:${type}`) === 'allow');
      }
      return decisionFor(ses, origin, permission) === 'allow';
    });
  }

  /** The browser's own UI needs no device or site permissions at all */
  function attachDenyAll(ses) {
    ses.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'fullscreen'));
    ses.setPermissionCheckHandler((contents, permission) => permission === 'fullscreen');
  }

  function list() {
    const store = readStore();
    return Object.keys(store).sort().flatMap((origin) =>
      Object.entries(store[origin]).map(([permission, decision]) => ({ origin, permission, decision })));
  }

  function remove(origin, permission) {
    if (typeof origin !== 'string' || typeof permission !== 'string') return false;
    const store = readStore();
    if (store[origin]) {
      delete store[origin][permission];
      if (Object.keys(store[origin]).length === 0) delete store[origin];
      writeStore(store);
    }
    sessionMap(session.defaultSession).delete(`${origin}|${permission}`);
    return true;
  }

  return { attach, attachDenyAll, list, remove };
}

module.exports = { createPermissionManager, originOf };
