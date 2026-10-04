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
})();
