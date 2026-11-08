// Freedom Browser - Word (.docx) documents open in the tab, like PDF.
// A .docx the tab would download (no "attachment" header) is saved to a private temp file instead and the tab
// moves to freedom-docx://view/?src=<original address>&t=<token>, where mammoth turns it into plain HTML.
// The viewer page runs no scripts (CSP script-src 'none') and cannot be framed; links keep only web addresses.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DOCX_SCHEME = 'freedom-docx';
const DOCX_SCHEME_PRIVILEGES = { scheme: DOCX_SCHEME, privileges: { standard: true, secure: true } };
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 100 * 1024 * 1024;

const STRINGS = {
  en: {
    download: 'Download',
    failed: 'This document could not be opened',
    gone: 'The document is no longer available. Open the original address again.',
    original: 'Original',
    notes: 'Some formatting is not shown.',
  },
  ru: {
    download: 'Скачать',
    failed: 'Не удалось открыть документ',
    gone: 'Документ больше недоступен. Откройте исходный адрес ещё раз.',
    original: 'Источник',
    notes: 'Часть оформления не показана.',
  },
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isDocxName = (name) => /\.docx$/i.test(String(name || ''));

function viewerUrl(src, token) {
  const params = new URLSearchParams({ src });
  if (token) params.set('t', token);
  return `${DOCX_SCHEME}://view/?${params}`;
}

/** The original address shown for a viewer URL, or null when it is not one */
function sourceOfViewerUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== `${DOCX_SCHEME}:` || u.host !== 'view') return null;
    return u.searchParams.get('src');
  } catch {
    return null;
  }
}

// Links in the document: web, mail and in-document anchors only
function sanitizeLinks(html) {
  return html.replace(/<a\b([^>]*?)\shref="([^"]*)"/gi, (whole, before, href) => {
    const decoded = href.replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|#)/i.test(decoded)) return `<a${before} href="${href}" rel="noreferrer noopener"`;
    return `<a${before}`;
  });
}

const CSP = [
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  "script-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

const PAGE_STYLE = `
:root { color-scheme: light dark; --bg: #e8eaed; --paper: #fff; --ink: #1f1f1f; --muted: #5f6368; --bar: #f8f9fa; --line: #dadce0; --accent: #0b57d0; }
@media (prefers-color-scheme: dark) { :root { --bg: #1b1c1e; --bar: #232427; --line: #3c4043; --muted: #9aa0a6; --accent: #8ab4f8; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); }
body { font: 15px/1.55 "Segoe UI", system-ui, -apple-system, Roboto, "Noto Sans", sans-serif; }
.bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: var(--bar); border-bottom: 1px solid var(--line); color: var(--muted); font-size: 13px; }
.bar .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; font-weight: 600; }
.bar a.btn { color: var(--accent); text-decoration: none; padding: 4px 12px; border: 1px solid var(--line); border-radius: 6px; white-space: nowrap; }
.bar a.btn:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.page { max-width: 816px; margin: 24px auto 48px; padding: 72px 80px; background: var(--paper); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.2), 0 4px 16px rgba(0,0,0,.08); border-radius: 2px; overflow-wrap: anywhere; }
@media (max-width: 860px) { .page { margin: 0; padding: 32px 20px; border-radius: 0; } }
.page h1 { font-size: 2em; margin: .4em 0 .5em; } .page h2 { font-size: 1.5em; margin: 1em 0 .4em; } .page h3 { font-size: 1.2em; margin: 1em 0 .3em; }
.page p { margin: 0 0 .7em; } .page img { max-width: 100%; height: auto; }
.page table { border-collapse: collapse; margin: .8em 0; max-width: 100%; } .page td, .page th { border: 1px solid #c4c7c5; padding: 4px 8px; vertical-align: top; }
.page a[href] { color: #0b57d0; } .page a:not([href]) { color: inherit; text-decoration: none; } .page ul, .page ol { margin: 0 0 .7em; padding-left: 2em; }
.page blockquote { margin: .7em 0; padding-left: 1em; border-left: 3px solid #c4c7c5; color: #444; }
.note { max-width: 816px; margin: -36px auto 24px; color: var(--muted); font-size: 12px; padding: 0 4px; }
.error { max-width: 560px; margin: 15vh auto; padding: 24px; color: var(--ink); background: var(--paper); border-radius: 8px; }
@media (prefers-color-scheme: dark) { .error { color: #e8eaed; background: #2a2b2e; } }
.error h1 { font-size: 18px; margin: 0 0 8px; } .error p { margin: 0 0 8px; color: var(--muted); word-break: break-all; }
@media print { .bar, .note { display: none; } body, html { background: #fff; } .page { box-shadow: none; margin: 0; padding: 0; max-width: none; } }
`;

function page({ title, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head><body>${body}</body></html>`;
}

function createDocxViewer({ app, getLanguage = () => 'en' }) {
  let tempDir = null;
  const docs = new Map(); // token -> { file, name, src, temp, ownerId }
  const servedSessions = new WeakSet();
  const t = () => STRINGS[getLanguage()] || STRINGS.en;

  function ensureTempDir() {
    if (!tempDir) tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'freedom-docx-'));
    return tempDir;
  }

  function remember({ file, name, src, temp, ownerId }) {
    const token = crypto.randomBytes(16).toString('hex');
    docs.set(token, { file, name, src, temp, ownerId });
    return token;
  }

  function forget(token) {
    const doc = docs.get(token);
    docs.delete(token);
    if (doc?.temp) fs.rm(doc.file, { force: true }, () => {});
  }

  // Temp copies of an incognito tab's documents go with the tab
  function forgetOwner(ownerId) {
    for (const [token, doc] of docs) if (doc.ownerId === ownerId && doc.private) forget(token);
  }

  /**
   * Called first in will-download. Returns true when the item became a document view
   * (the caller must not treat it as a download).
   */
  function interceptDownload(item, contents) {
    if (!contents || contents.isDestroyed() || contents.getType() !== 'webview') return false;
    const itemUrl = item.getURL();
    if (!/^(https?|file):/i.test(itemUrl)) return false;
    const name = item.getFilename() || '';
    if (item.getMimeType() !== DOCX_MIME && !isDocxName(name)) return false;
    // Sites that ask for a download get one, as Chrome does with PDF
    if (/^\s*attachment/i.test(item.getContentDisposition() || '')) return false;
    if (item.getTotalBytes() > MAX_BYTES) return false;
    let file;
    try {
      file = path.join(ensureTempDir(), `${crypto.randomBytes(8).toString('hex')}.docx`);
    } catch {
      return false;
    }
    item.setSavePath(file);
    const isPrivate = contents.session !== require('electron').session.defaultSession;
    item.once('done', (event, state) => {
      if (state !== 'completed' || contents.isDestroyed()) {
        fs.rm(file, { force: true }, () => {});
        return;
      }
      const token = remember({ file, name: name || path.basename(new URL(itemUrl).pathname), src: itemUrl, temp: true, ownerId: contents.id });
      if (isPrivate) docs.get(token).private = true;
      contents.loadURL(viewerUrl(itemUrl, token)).catch(() => {});
    });
    return true;
  }

  /** Downloads panel → "Open in browser" for a finished .docx download */
  function urlForLocalFile(file) {
    const src = url.pathToFileURL(file).toString();
    return viewerUrl(src, remember({ file, name: path.basename(file), src, temp: false }));
  }

  async function loadBytes(doc, src, ses) {
    if (doc) {
      const stat = await fs.promises.stat(doc.file);
      if (stat.size > MAX_BYTES) throw new Error('too large');
      return fs.promises.readFile(doc.file);
    }
    // The token is gone (browser restarted, tab restored): read the original again
    const u = new URL(src);
    if (u.protocol === 'file:') {
      const file = url.fileURLToPath(u);
      if (!isDocxName(file)) throw new Error('not a .docx file');
      const stat = await fs.promises.stat(file);
      if (stat.size > MAX_BYTES) throw new Error('too large');
      return fs.promises.readFile(file);
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('unsupported address');
    const response = await ses.fetch(src, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_BYTES) throw new Error('too large');
    return body;
  }

  async function render(bytes) {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ buffer: bytes });
    const lossy = (result.messages || []).some((m) => m.type === 'warning');
    return { html: sanitizeLinks(result.value || ''), lossy };
  }

  const htmlHeaders = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
  };

  function errorPage(title, detail, src) {
    const s = t();
    const link = src && /^(https?|file):/i.test(src) ? `<p>${s.original}: <a href="${escapeHtml(src)}">${escapeHtml(src)}</a></p>` : '';
    return new Response(page({ title, body: `<div class="error"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p>${link}</div>` }), {
      status: 200,
      headers: htmlHeaders,
    });
  }

  function serve(ses) {
    if (servedSessions.has(ses)) return;
    servedSessions.add(ses);
    ses.protocol.handle(DOCX_SCHEME, async (request) => {
      const u = new URL(request.url);
      const token = u.searchParams.get('t') || '';
      const s = t();
      if (u.host === 'download') {
        const doc = docs.get(token);
        if (!doc) return new Response('Not found', { status: 404 });
        try {
          const body = await fs.promises.readFile(doc.file);
          return new Response(body, {
            headers: {
              'content-type': DOCX_MIME,
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.name || 'document.docx')}`,
              'x-content-type-options': 'nosniff',
            },
          });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      }
      if (u.host !== 'view') return new Response('Not found', { status: 404 });
      const src = u.searchParams.get('src') || '';
      let doc = docs.get(token);
      if (doc && doc.src !== src) doc = null;
      let name = doc?.name;
      if (!name) {
        try { name = decodeURIComponent(path.basename(new URL(src).pathname)) || 'document.docx'; } catch { name = 'document.docx'; }
      }
      let bytes;
      try {
        bytes = await loadBytes(doc, src, ses);
      } catch (err) {
        return errorPage(s.failed, doc ? String(err.message || err) : s.gone, src);
      }
      let downloadToken = doc ? token : null;
      if (!downloadToken) {
        // Restored view: keep the bytes for the Download button
        try {
          const file = path.join(ensureTempDir(), `${crypto.randomBytes(8).toString('hex')}.docx`);
          await fs.promises.writeFile(file, bytes);
          downloadToken = remember({ file, name, src, temp: true });
        } catch {}
      }
      try {
        const { html, lossy } = await render(bytes);
        const download = downloadToken
          ? `<a class="btn" href="${DOCX_SCHEME}://download/?t=${downloadToken}">${escapeHtml(s.download)}</a>`
          : '';
        const body = `<div class="bar"><span class="name" title="${escapeHtml(src)}">${escapeHtml(name)}</span>${download}</div>
<main class="page">${html}</main>${lossy ? `<div class="note">${escapeHtml(s.notes)}</div>` : ''}`;
        return new Response(page({ title: name, body }), { headers: htmlHeaders });
      } catch (err) {
        return errorPage(s.failed, String(err.message || err), src);
      }
    });
  }

  function cleanup() {
    docs.clear();
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      tempDir = null;
    }
  }

  return { serve, interceptDownload, urlForLocalFile, forgetOwner, cleanup };
}

module.exports = {
  DOCX_SCHEME,
  DOCX_SCHEME_PRIVILEGES,
  createDocxViewer,
  viewerUrl,
  sourceOfViewerUrl,
  sanitizeLinks,
  isDocxName,
};
