// node --test scripts/test-docx-viewer.mjs — Word documents in tabs (electron/docx-viewer.cjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { viewerUrl, sourceOfViewerUrl, sanitizeLinks, isDocxName } = require('../electron/docx-viewer.cjs');
const JSZip = require('jszip');
const mammoth = require('mammoth');

/** A small .docx: heading, paragraph with bold text, a web link, a javascript: link and a table */
export async function makeDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/?a=1&amp;b=2" TargetMode="External"/>
  <Relationship Id="rBad" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>
</Relationships>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Тестовый документ</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Обычный текст и </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>жирный &lt;script&gt;</w:t></w:r></w:p>
    <w:p><w:hyperlink r:id="rLink"><w:r><w:t>web link</w:t></w:r></w:hyperlink></w:p>
    <w:p><w:hyperlink r:id="rBad"><w:r><w:t>bad link</w:t></w:r></w:hyperlink></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  </w:body>
</w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('viewer URL keeps the original address', () => {
  const src = 'https://example.com/files/отчёт.docx?x=1&y=2';
  const view = viewerUrl(src, 'abc');
  assert.ok(view.startsWith('freedom-docx://view/?'));
  assert.equal(sourceOfViewerUrl(view), src);
  assert.equal(new URL(view).searchParams.get('t'), 'abc');
  assert.equal(sourceOfViewerUrl('https://example.com/'), null);
  assert.equal(sourceOfViewerUrl('freedom-docx://download/?t=1'), null);
});

test('.docx names', () => {
  assert.ok(isDocxName('a.docx'));
  assert.ok(isDocxName('/x/Отчёт.DOCX'));
  assert.ok(!isDocxName('a.doc'));
  assert.ok(!isDocxName('a.docx.exe'));
});

test('only web, mail and anchor links survive', () => {
  const html = '<p><a href="https://a.example/?q=1&amp;r=2">a</a><a href="javascript:alert(1)">b</a><a href="file:///etc/passwd">c</a><a href="#_Toc1">d</a><a id="x" href="mailto:me@example.com">e</a><a id="bm"></a></p>';
  assert.equal(
    sanitizeLinks(html),
    '<p><a href="https://a.example/?q=1&amp;r=2" rel="noreferrer noopener">a</a><a>b</a><a>c</a><a href="#_Toc1" rel="noreferrer noopener">d</a><a id="x" href="mailto:me@example.com" rel="noreferrer noopener">e</a><a id="bm"></a></p>'
  );
});

test('a generated document converts to safe HTML', async () => {
  const { value } = await mammoth.convertToHtml({ buffer: await makeDocx() });
  const html = sanitizeLinks(value);
  assert.match(html, /<h1>Тестовый документ<\/h1>/);
  assert.match(html, /<strong>жирный &lt;script&gt;<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com\/\?a=1&amp;b=2" rel="noreferrer noopener">web link<\/a>/);
  assert.match(html, /<a>bad link<\/a>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<table>.*A1.*B1.*<\/table>/s);
});
