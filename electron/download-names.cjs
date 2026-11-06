// File names for downloads. Pure logic (no Electron), tested by scripts/test-download-names.mjs.
const path = require('path');
const fs = require('fs');

const MAX_NAME_CHARS = 200;
// Linux and macOS allow 255 bytes per name; leave room for " (99)" and ".pending"
const MAX_NAME_BYTES = 230;
const MAX_EXT_CHARS = 16;
const FALLBACK_NAME = 'download';
const PENDING_SUFFIX = '.pending';

// CON, PRN, AUX, NUL, COM1-9, LPT1-9 (also with superscript digits): Windows refuses them with any extension
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;

const byteLength = (s) => Buffer.byteLength(s, 'utf8');

// Cuts by code points, never in the middle of a surrogate pair, to fit both limits
function truncate(text, maxChars, maxBytes) {
  const chars = Array.from(text);
  let out = chars.slice(0, Math.max(0, maxChars)).join('');
  while (out && byteLength(out) > maxBytes) out = Array.from(out).slice(0, -1).join('');
  return out;
}

// Extension worth keeping: short, and not the whole name (".bashrc" has no extension)
function splitExtension(name) {
  const ext = path.extname(name);
  if (!ext || ext === name || Array.from(ext).length > MAX_EXT_CHARS) return { base: name, ext: '' };
  return { base: name.slice(0, -ext.length), ext };
}

/**
 * A name that is safe to create on Windows, Linux and macOS:
 * no path separators or characters Windows forbids, no control characters, no trailing dots or spaces,
 * no reserved device names, at most 200 characters (extension kept), never empty.
 */
function sanitizeFilename(input, { maxChars = MAX_NAME_CHARS, maxBytes = MAX_NAME_BYTES } = {}) {
  let name = String(input ?? '')
    // Control characters (C0, DEL, C1) and the bidi overrides used to fake extensions ("exe.txt" shown as "txt.exe")
    .replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  // Windows drops trailing dots and spaces, which would make "a.exe." become "a.exe"
  name = name.replace(/[. ]+$/, '');
  // Leading dots would make a hidden file on Linux
  name = name.replace(/^\.+/, '');
  if (!name) return FALLBACK_NAME;

  let { base, ext } = splitExtension(name);
  // "CON", "con.txt", "nul.tar.gz": the part before the first dot decides
  const stem = base.split('.')[0].trim();
  if (WINDOWS_RESERVED.test(stem)) base = `_${base}`;

  if (Array.from(base + ext).length > maxChars || byteLength(base + ext) > maxBytes) {
    const extChars = Array.from(ext).length;
    base = truncate(base, maxChars - extChars, maxBytes - byteLength(ext)).replace(/[. ]+$/, '');
    if (!base) base = FALLBACK_NAME;
  }
  return base + ext;
}

/**
 * First free path in dir for this name: "name.ext", "name (1).ext", ...
 * A path is taken when the file or its ".pending" twin exists, or when an active download reserved it.
 * The caller adds the result to `reserved` and removes it when that download ends.
 */
function getUniqueFilePath(dir, originalFilename, {
  reserved = new Set(),
  exists = fs.existsSync,
  caseInsensitive = process.platform === 'win32' || process.platform === 'darwin',
  maxChars = MAX_NAME_CHARS,
  maxBytes = MAX_NAME_BYTES,
} = {}) {
  const filename = sanitizeFilename(originalFilename, { maxChars, maxBytes });
  const { base, ext } = splitExtension(filename);
  const key = (p) => (caseInsensitive ? p.toLowerCase() : p);
  const reservedKeys = new Set([...reserved].map(key));
  const isTaken = (p) => exists(p) || exists(p + PENDING_SUFFIX) || reservedKeys.has(key(p)) || reservedKeys.has(key(p + PENDING_SUFFIX));

  let target = path.join(dir, filename);
  for (let counter = 1; isTaken(target); counter++) {
    if (counter > 10000) throw new Error('No free file name');
    const suffix = ` (${counter})`;
    const room = maxChars - Array.from(suffix + ext).length;
    const roomBytes = maxBytes - byteLength(suffix + ext);
    const shortBase = truncate(base, room, roomBytes).replace(/[. ]+$/, '') || FALLBACK_NAME;
    target = path.join(dir, `${shortBase}${suffix}${ext}`);
  }
  return target;
}

module.exports = { sanitizeFilename, getUniqueFilePath, PENDING_SUFFIX, MAX_NAME_CHARS, FALLBACK_NAME };
