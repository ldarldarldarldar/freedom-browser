// node --test scripts/test-download-names.mjs — download file names (electron/download-names.cjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { sanitizeFilename, getUniqueFilePath, MAX_NAME_CHARS } = require('../electron/download-names.cjs');

test('plain names stay as they are', () => {
  assert.equal(sanitizeFilename('report.pdf'), 'report.pdf');
  assert.equal(sanitizeFilename('Отчёт 2026.docx'), 'Отчёт 2026.docx');
  assert.equal(sanitizeFilename('archive.tar.gz'), 'archive.tar.gz');
});

test('empty and dot-only names become "download"', () => {
  for (const name of ['', '   ', '.', '..', '...', ' . ', null, undefined, '\u0000\u0001']) {
    assert.equal(sanitizeFilename(name), 'download', JSON.stringify(name));
  }
});

test('path separators and characters Windows forbids are replaced', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), '_.._etc_passwd');
  assert.equal(sanitizeFilename('a\\b/c:d*e?f"g<h>i|j.txt'), 'a_b_c_d_e_f_g_h_i_j.txt');
});

test('control characters and bidi overrides are removed', () => {
  assert.equal(sanitizeFilename('bad\u0000na\u0007me\u001f.txt'), 'badname.txt');
  assert.equal(sanitizeFilename('line\nbreak\r.txt'), 'linebreak.txt');
  assert.equal(sanitizeFilename('del\u007f\u0085.txt'), 'del.txt');
  // "photo‮gpj.exe" displays as "photoexe.jpg"
  assert.equal(sanitizeFilename('photo‮gpj.exe'), 'photogpj.exe');
});

test('trailing dots and spaces are removed, leading dots too', () => {
  assert.equal(sanitizeFilename('setup.exe.'), 'setup.exe');
  assert.equal(sanitizeFilename('setup.exe . . '), 'setup.exe');
  assert.equal(sanitizeFilename('  name.txt  '), 'name.txt');
  assert.equal(sanitizeFilename('.bashrc'), 'bashrc');
});

test('Windows reserved device names, with and without extension, in any case', () => {
  for (const [input, expected] of [
    ['CON', '_CON'], ['con', '_con'], ['PRN.txt', '_PRN.txt'], ['aux.tar.gz', '_aux.tar.gz'],
    ['NUL', '_NUL'], ['nul.', '_nul'], ['COM1', '_COM1'], ['com9.log', '_com9.log'], ['LPT1.doc', '_LPT1.doc'],
    ['lpt9', '_lpt9'], ['COM¹.txt', '_COM¹.txt'], ['CON .txt', '_CON .txt'],
  ]) {
    assert.equal(sanitizeFilename(input), expected, input);
  }
  // Only whole stems are reserved
  for (const name of ['console.txt', 'CONTACT', 'com10.txt', 'lpt.txt', 'auxiliary', 'my con.txt']) {
    assert.equal(sanitizeFilename(name), name);
  }
});

test('long names are cut to 200 characters keeping the extension', () => {
  const long = 'a'.repeat(500) + '.pdf';
  const out = sanitizeFilename(long);
  assert.equal(out.length, MAX_NAME_CHARS);
  assert.ok(out.endsWith('.pdf'));
  // Multibyte names also stay within the 255-byte limit of Linux file systems
  const cyr = sanitizeFilename('я'.repeat(300) + '.txt');
  assert.ok(cyr.endsWith('.txt'));
  assert.ok(Buffer.byteLength(cyr) <= 230, String(Buffer.byteLength(cyr)));
  // Emoji are never split in half
  const emoji = sanitizeFilename('😀'.repeat(150) + '.png');
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(emoji));
  assert.ok(emoji.endsWith('.png'));
  // An absurd "extension" is not kept as one
  const weird = sanitizeFilename('x.' + 'b'.repeat(400));
  assert.equal(weird.length, MAX_NAME_CHARS);
});

test('unique path skips existing files, their .pending twins and reserved paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-dl-'));
  try {
    const at = (n) => path.join(dir, n);
    assert.equal(getUniqueFilePath(dir, 'file.zip'), at('file.zip'));
    fs.writeFileSync(at('file.zip'), '');
    assert.equal(getUniqueFilePath(dir, 'file.zip'), at('file (1).zip'));
    fs.writeFileSync(at('file (1).zip.pending'), '');
    assert.equal(getUniqueFilePath(dir, 'file.zip'), at('file (2).zip'));
    const reserved = new Set([at('file (2).zip')]);
    assert.equal(getUniqueFilePath(dir, 'file.zip', { reserved }), at('file (3).zip'));
    // A reserved .pending path blocks its final name as well
    reserved.add(at('file (3).zip.pending'));
    assert.equal(getUniqueFilePath(dir, 'file.zip', { reserved }), at('file (4).zip'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('two downloads of the same name started together get different paths', () => {
  const reserved = new Set();
  const exists = () => false; // nothing on disk yet: both start before either file is created
  const a = getUniqueFilePath('/dl', 'video.mp4', { reserved, exists });
  reserved.add(a);
  const b = getUniqueFilePath('/dl', 'video.mp4', { reserved, exists });
  reserved.add(b);
  assert.equal(a, path.join('/dl', 'video.mp4'));
  assert.equal(b, path.join('/dl', 'video (1).mp4'));
  // After the first one ends its name is free again
  reserved.delete(a);
  assert.equal(getUniqueFilePath('/dl', 'video.mp4', { reserved, exists }), a);
});

test('case-insensitive file systems: reserved paths compare without case', () => {
  const reserved = new Set([path.join('/dl', 'Video.MP4')]);
  const exists = () => false;
  assert.equal(getUniqueFilePath('/dl', 'video.mp4', { reserved, exists, caseInsensitive: true }), path.join('/dl', 'video (1).mp4'));
  assert.equal(getUniqueFilePath('/dl', 'video.mp4', { reserved, exists, caseInsensitive: false }), path.join('/dl', 'video.mp4'));
});

test('counter suffix keeps long names within the limit', () => {
  const name = 'b'.repeat(198) + '.7z';
  const exists = (p) => path.basename(p) === sanitizeFilename(name);
  const out = path.basename(getUniqueFilePath('/dl', name, { exists }));
  assert.ok(out.endsWith(' (1).7z'), out);
  assert.ok(out.length <= MAX_NAME_CHARS, String(out.length));
});

test('dangerous names stay recognisable after cleaning (no hidden .exe)', () => {
  assert.equal(path.extname(sanitizeFilename('invoice.pdf.exe...')), '.exe');
  assert.equal(path.extname(sanitizeFilename('run.sh   ')), '.sh');
});
