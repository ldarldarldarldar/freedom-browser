export type LoadErrorType =
  | 'http'
  | 'dns'
  | 'offline'
  | 'refused'
  | 'timeout'
  | 'reset'
  | 'certificate'
  | 'blocked'
  | 'invalid_url'
  | 'crashed'
  | 'generic';

export interface LoadError {
  type: LoadErrorType;
  url: string;
  /** Shown under the text: Chromium's error name or the HTTP status line */
  code: string;
  httpStatus?: number;
}

/** Why a certificate was refused, as shown on the "connection is not private" page */
export type CertErrorReason = 'expired' | 'notYetValid' | 'name' | 'authority' | 'revoked' | 'weak' | 'invalid';

const CERT_REASONS: Record<string, CertErrorReason> = {
  ERR_CERT_COMMON_NAME_INVALID: 'name',
  ERR_CERT_NON_UNIQUE_NAME: 'name',
  ERR_CERT_NAME_CONSTRAINT_VIOLATION: 'name',
  ERR_CERT_DATE_INVALID: 'expired',
  ERR_CERT_AUTHORITY_INVALID: 'authority',
  ERR_CERT_SYMANTEC_LEGACY: 'authority',
  ERR_CERT_KNOWN_INTERCEPTION_BLOCKED: 'authority',
  ERR_CERT_REVOKED: 'revoked',
  ERR_CERT_WEAK_SIGNATURE_ALGORITHM: 'weak',
  ERR_CERT_WEAK_KEY: 'weak',
};

/**
 * Reason for a certificate error from Chromium's error name ("ERR_CERT_DATE_INVALID" or
 * "net::ERR_CERT_DATE_INVALID"). A date error is "expired" unless the certificate is not valid yet.
 */
export function certErrorReason(code: string, validStartSec = 0, nowMs = Date.now()): CertErrorReason {
  const name = String(code || '').replace(/^net::/, '').trim().toUpperCase();
  const reason = CERT_REASONS[name] ?? 'invalid';
  if (reason === 'expired' && validStartSec > 0 && validStartSec * 1000 > nowMs) return 'notYetValid';
  return reason;
}

// Chromium net error codes (net/base/net_error_list.h)
const NET_ERROR_TYPES: Record<number, LoadErrorType> = {
  [-105]: 'dns',
  [-137]: 'dns', // NAME_RESOLUTION_FAILED
  [-106]: 'offline',
  [-21]: 'offline', // NETWORK_CHANGED
  [-109]: 'offline', // ADDRESS_UNREACHABLE
  [-102]: 'refused',
  [-7]: 'timeout',
  [-118]: 'timeout',
  [-100]: 'reset',
  [-101]: 'reset',
  [-103]: 'reset',
  [-324]: 'reset', // EMPTY_RESPONSE
  [-20]: 'blocked',
  [-300]: 'invalid_url',
};

// Not failures the user should see: a navigation replaced by another one / a download (-3),
// a link handed over to another app (-301, -302).
const IGNORED_NET_ERRORS = new Set([-3, -301, -302]);

/** What to show for a failed main-frame load (webview did-fail-load), or null when nothing should be shown. */
export function loadErrorFromNetError(errorCode: number, errorDescription: string, url: string): LoadError | null {
  if (errorCode === 0 || IGNORED_NET_ERRORS.has(errorCode)) return null;
  // -200..-299: certificate errors
  const type = errorCode <= -200 && errorCode > -300 ? 'certificate' : NET_ERROR_TYPES[errorCode] ?? 'generic';
  return { type, url, code: errorDescription || `ERR_${Math.abs(errorCode)}` };
}

export function loadErrorFromHttpStatus(status: number, statusText: string | undefined, url: string): LoadError {
  return { type: 'http', url, httpStatus: status, code: `HTTP ${status}${statusText ? ` ${statusText}` : ''}` };
}

/**
 * Like other browsers, Freedom keeps the error page a site made itself and only steps in when the
 * server sent next to nothing ("404 Not Found"). Evaluated inside the page once it has loaded.
 */
export const PAGE_IS_BARE_SCRIPT = `(() => {
  if (!document.body) return true;
  if (document.querySelector('img, svg, canvas, video, iframe')) return false;
  return document.body.innerText.trim().length < 300;
})()`;
