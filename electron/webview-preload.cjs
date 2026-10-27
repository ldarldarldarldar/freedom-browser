// Freedom Browser - Isolated Webview Preload
// WebAuthn Passkey & Security Key Protection & Stealth Fingerprint Shims
// Ensures full JavaScript compatibility and seamless Google / Gemini authentication

(function () {
  'use strict';

  // 1. Safe Anti-Bot / Anti-Fingerprint Shims:
  // Ensure navigator.webdriver is false (prevents automated browser blocks)
  try {
    if (Object.defineProperty) {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
      });
    }
  } catch {}

  // 2. Realistic Plugins Mock if empty
  try {
    if (navigator.plugins && navigator.plugins.length === 0) {
      const mockPlugins = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
        configurable: true,
      });
    }
  } catch {}

  // 3. Realistic window.chrome Object for Chromium compatibility across all webapps
  try {
    if (!window.chrome) {
      window.chrome = {};
    }
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function () {},
        getIsInstalled: function () { return false; },
        installState: function () { return 'not_installed'; },
        runningState: function () { return 'cannot_run'; }
      };
    }
    if (!window.chrome.csi) {
      window.chrome.csi = function () {
        return { startE: Date.now(), onloadT: Date.now(), pageT: 100, tran: 15 };
      };
    }
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function () {
        return {
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2'
        };
      };
    }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        OnInstalledReason: {},
        OnRestartRequiredReason: {},
        PlatformArch: {},
        PlatformNaclArch: {},
        PlatformOs: {},
        RequestUpdateCheckStatus: {},
        connect: function () {},
        sendMessage: function () {},
        id: undefined
      };
    }
  } catch {}

  // 4. WebAuthn Passkey & Security Key Protection:
  // For Twitch only: suppress unprompted passive/conditional passkey queries.
  // For all other domains (especially Google, Gemini, Microsoft, Apple, GitHub):
  // leave WebAuthn 100% native and untampered so passkeys, security keys, and security checkups succeed without any error.
  try {
    const isTwitch = () => {
      try {
        const host = window.location.hostname || '';
        return host.includes('twitch.tv');
      } catch {
        return false;
      }
    };

    if (isTwitch()) {
      if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isConditionalMediationAvailable === 'function') {
        window.PublicKeyCredential.isConditionalMediationAvailable = async function () {
          return false;
        };
      }

      if (navigator.credentials && typeof navigator.credentials.get === 'function') {
        const origGet = navigator.credentials.get.bind(navigator.credentials);
        navigator.credentials.get = function (options) {
          if (
            options &&
            options.mediation === 'conditional' &&
            (!navigator.userActivation || !navigator.userActivation.isActive)
          ) {
            return Promise.reject(
              new DOMException('Conditional mediation is not supported in this context.', 'NotSupportedError')
            );
          }
          return origGet(options);
        };
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
