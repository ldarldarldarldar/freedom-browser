// Freedom Browser - Isolated Webview Preload
// WebAuthn Passkey & Security Key Protection & Stealth Fingerprint Shims
// Ensures full JavaScript compatibility and seamless Google / Gemini authentication

(function () {
  'use strict';

  const { webFrame } = require('electron');

  // 1. Compatibility with Chrome, in the page's own world and in every frame (this preload runs in an isolated
  // world, where changes to window and navigator are invisible to the page). The User-Agent and Sec-CH-UA headers
  // already say Chrome: sites that compare them with these values, such as Twitch login, otherwise refuse the browser.
  const COMPAT = `(() => {
    try {
      if (!window.chrome || !window.chrome.app) {
        const start = Date.now() / 1000;
        const chrome = window.chrome || {};
        chrome.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails() { return null; },
          getIsInstalled() { return false; },
          installState() { return 'not_installed'; },
          runningState() { return 'cannot_run'; },
        };
        chrome.runtime = chrome.runtime || {};
        chrome.csi = () => ({ startE: Date.now(), onloadT: Date.now(), pageT: performance.now(), tran: 15 });
        chrome.loadTimes = () => ({
          requestTime: start, startLoadTime: start, commitLoadTime: start, finishDocumentLoadTime: start,
          finishLoadTime: start, firstPaintTime: start, firstPaintAfterLoadTime: 0, navigationType: 'Other',
          wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false, connectionInfo: 'h2',
        });
        window.chrome = chrome;
      }
    } catch {}

    try {
      const proto = window.NavigatorUAData && NavigatorUAData.prototype;
      const brandsOf = Object.getOwnPropertyDescriptor(proto, 'brands').get;
      const realValues = proto.getHighEntropyValues;
      const withChrome = (list) => {
        const engine = list.find((item) => item.brand === 'Chromium');
        if (!engine || list.some((item) => item.brand === 'Google Chrome')) return list;
        return [engine, { brand: 'Google Chrome', version: engine.version }, ...list.filter((item) => item !== engine)];
      };
      Object.defineProperty(proto, 'brands', { configurable: true, enumerable: true, get() { return withChrome(brandsOf.call(this)); } });
      proto.getHighEntropyValues = function (hints) {
        return realValues.call(this, hints).then((values) => {
          if (values.brands) values.brands = withChrome(values.brands);
          if (values.fullVersionList) values.fullVersionList = withChrome(values.fullVersionList);
          return values;
        });
      };
    } catch {}
  })();`;
  if (/^https?:$/.test(location.protocol)) webFrame.executeJavaScript(COMPAT).catch(() => {});

  // Everything below belongs to the tab's top page
  if (window.top !== window) return;

  // 4b. Built-in ad blocker (electron/adblock.cjs): cosmetic filters for http(s) pages.
  // Network requests are filtered in the main process; this part hides leftover ad slots.
  try {
    if (/^https?:$/.test(location.protocol)) {
      const { ipcRenderer } = require('electron');
      const pageUrl = location.href;
      // Hostname CSS is inserted by the main process; scriptlets must run in the page world before its scripts
      const start = ipcRenderer.sendSync('freedom-adblock-start', pageUrl);
      if (start) {
        for (const script of start.scripts || []) {
          // Each in its own function: at global scope their top-level declarations collide (class JSONPath),
          // and on YouTube that left the page blank
          webFrame.executeJavaScript(`(function(){\n${script}\n})();`).catch(() => {});
        }

        // Generic hiding rules depend on the classes/ids/links present in the DOM
        const seen = { classes: new Set(), ids: new Set(), hrefs: new Set() };
        const collect = (root) => {
          const fresh = { classes: [], ids: [], hrefs: [] };
          const add = (kind, value) => {
            if (value && !seen[kind].has(value)) {
              seen[kind].add(value);
              fresh[kind].push(value);
            }
          };
          const nodes = root.querySelectorAll ? root.querySelectorAll('[id],[class],a[href]') : [];
          for (const el of [root, ...nodes]) {
            if (!el || el.nodeType !== 1) continue;
            if (el.id) add('ids', el.id);
            for (const c of el.classList || []) add('classes', c);
            if (el.tagName === 'A' && el.href) add('hrefs', el.href);
          }
          if (fresh.classes.length || fresh.ids.length || fresh.hrefs.length) {
            ipcRenderer.send('freedom-adblock-dom', pageUrl, fresh);
          }
        };

        let pending = [];
        let timer = 0;
        const flush = () => {
          timer = 0;
          const roots = pending;
          pending = [];
          for (const root of roots) collect(root);
        };
        window.addEventListener('DOMContentLoaded', () => {
          collect(document.documentElement);
          new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.type === 'attributes') pending.push(m.target);
              else for (const n of m.addedNodes) if (n.nodeType === 1) pending.push(n);
            }
            if (!timer && pending.length) timer = setTimeout(flush, 250);
          }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
        }, { once: true });
      }
    }
  } catch {}

  // 5. Freedom RAM Control (FRC-GUARD) Telemetry Sensors:
  // Detect active media playback, WebRTC streams, and unsaved form states
  try {
    const { ipcRenderer } = require('electron');

    const checkMediaState = () => {
      try {
        const mediaElements = Array.from(document.querySelectorAll('audio, video'));
        const isPlaying = mediaElements.some((el) => !el.paused && !el.ended && el.readyState > 2);
        ipcRenderer.sendToHost('frc-media-state', { isPlaying });
      } catch {}
    };

    // Ctrl + mouse wheel: the page must not zoom itself; the browser applies per-site zoom
    let lastWheelZoom = 0;
    window.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.deltaY === 0) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelZoom < 60) return;
      lastWheelZoom = now;
      ipcRenderer.sendToHost('freedom-ctrl-wheel', e.deltaY < 0 ? 'in' : 'out');
    }, { capture: true, passive: false });

    document.addEventListener('play', checkMediaState, true);
    document.addEventListener('pause', checkMediaState, true);
    document.addEventListener('ended', checkMediaState, true);

    document.addEventListener('input', (e) => {
      try {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          if (target.value && target.value.trim().length > 0) {
            ipcRenderer.sendToHost('frc-form-dirty', { hasDirty: true });
          }
        }
      } catch {}
    }, true);
  } catch {}
})();
