// Freedom Browser - Isolated Webview Preload
// WebAuthn Passkey & Security Key Protection:
// Prevents unprompted / passive conditional WebAuthn requests (such as Twitch background checks)
// from displaying unexpected modal Windows Security dialogs,
// while preserving 100% of legitimate user-initiated passkey authentication.

(function () {
  try {
    if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isConditionalMediationAvailable === 'function') {
      window.PublicKeyCredential.isConditionalMediationAvailable = async function () {
        return false;
      };
    }

    if (navigator.credentials && typeof navigator.credentials.get === 'function') {
      const origGet = navigator.credentials.get.bind(navigator.credentials);
      navigator.credentials.get = function (options) {
        // If the request is conditional (passive passkey autofill) and there is no active user gesture:
        if (
          options &&
          options.mediation === 'conditional' &&
          (!navigator.userActivation || !navigator.userActivation.isActive)
        ) {
          // Reject gracefully according to W3C WebAuthn Level 3 specification
          return Promise.reject(
            new DOMException('Conditional mediation is not supported in this context.', 'NotSupportedError')
          );
        }
        // Legitimate user-initiated passkey/security key authentication proceeds normally
        return origGet(options);
      };
    }
  } catch (err) {
    // Fail-safe: do not disrupt normal page execution
  }

  // Freedom RAM Control (FRC-GUARD) Telemetry Sensors:
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
