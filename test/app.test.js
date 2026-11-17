import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import JSZip from 'jszip';
import { createApp } from '../server/app.js';
import { runConversion } from '../server/run-conversion.js';
import { MAX_FILE_SIZE, validateFile } from '../shared/formats.js';
import { docxFixture, pdfFixture, xlsxFixture } from './fixtures.js';

const app = createApp();
const upload = (buffer, filename, contentType) => request(app).post('/api/convert').attach('file', buffer, { filename, contentType });

test('serves the application, local preview libraries, and health endpoint', async () => {
  const page = await request(app).get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /Dokumen masuk/);
  assert.match(page.headers['content-security-policy'], /script-src 'self'/);
  for (const path of ['/vendor/marked.js', '/vendor/purify.js', '/shared/formats.js', '/styles.css', '/app.js', '/editor.js', '/editor.css', '/editor-core.js', '/editor-renderer.js', '/markdown.js', '/vendor/mermaid/mermaid.esm.min.mjs', '/vendor/katex/katex.mjs', '/vendor/highlight/es/highlight.min.js']) {
    assert.equal((await request(app).get(path)).status, 200, path);
  }
  assert.equal((await request(app).get('/api/health')).body.status, 'ok');
});

test('converts UTF-8 TXT and returns download metadata without caching', async () => {
  const response = await upload(Buffer.from('# Halo\r\n\r\nDunia 🌏'), 'catatan.txt', 'text/plain');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.markdown, '# Halo\n\nDunia 🌏\n');
  assert.equal(response.body.filename, 'catatan.md');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('converts UTF-16 with BOM', async () => {
  const bytes = Buffer.concat([Buffer.from([255, 254]), Buffer.from('Halo dunia', 'utf16le')]);
  const response = await upload(bytes, 'utf16.txt', 'text/plain');
  assert.equal(response.status, 200);
  assert.match(response.body.markdown, /Halo dunia/);
});

test('converts HTML headings, lists, tables and strips active content', async () => {
  const response = await upload(Buffer.from('<h1>Halo</h1><ul><li>Satu</li></ul><script>alert(1)</script><img src="https://example.com/track"><p><a href="javascript:alert(1)">tautan</a></p><table><thead><tr><th>Nama</th></tr></thead><tbody><tr><td>Ayu</td></tr></tbody></table>'), 'web.html', 'text/html');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body.markdown, /# Halo/);
  assert.match(response.body.markdown, /-\s+Satu/);
  assert.match(response.body.markdown, /\| Nama \|/);
  assert.doesNotMatch(response.body.markdown, /alert|javascript|example.com/);
});

test('converts DOCX with structure and formatting', async () => {
  const response = await upload(await docxFixture(), 'catatan.docx');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body.markdown, /# Catatan Proyek/);
  assert.match(response.body.markdown, /\*\*Halo Markdown\*\*/);
});

test('converts PDF text and reports format limitations', async () => {
  const response = await upload(pdfFixture(), 'teks.pdf', 'application/pdf');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body.markdown, /## Halaman 1\n\nHalo Markdown/);
  assert.ok(response.body.warnings.length);
});

test('explains when PDF has no extractable text', async () => {
  const response = await upload(pdfFixture(''), 'scan.pdf', 'application/pdf');
  assert.equal(response.status, 422);
  assert.match(response.body.error, /OCR/);
});

test('converts XLSX multiple sheets, cached formulas and escapes pipes', async () => {
  const response = await upload(await xlsxFixture(), 'rencana.xlsx');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body.markdown, /## Rencana/);
  assert.match(response.body.markdown, /## Lanjutan/);
  assert.ok(response.body.markdown.includes('Pena \\| biru | 2'));
});

test('converts CSV with quoted commas and multiline cells', async () => {
  const response = await upload(Buffer.from('Nama,Catatan\n"Ayu, Budi","Baris 1\nBaris 2"'), 'tabel.csv', 'text/csv');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body.markdown, /Ayu, Budi/);
  assert.match(response.body.markdown, /Baris 1<br>Baris 2/);
});

test('detects semicolon-separated CSV', async () => {
  const response = await upload(Buffer.from('Nama;Jumlah\nBuku;2'), 'tabel.csv', 'text/csv');
  assert.equal(response.status, 200);
  assert.match(response.body.markdown, /\| Buku \| 2 \|/);
});

test('rejects inconsistent CSV records instead of guessing a different delimiter', async () => {
  const response = await upload(Buffer.from('Nama,Jumlah\nBuku,2\nPena'), 'rusak.csv', 'text/csv');
  assert.equal(response.status, 422);
});

test('rejects unsupported extensions, mismatched MIME, empty or binary text', async () => {
  for (const [bytes, name, mime, status] of [
    [Buffer.from('test'), 'program.exe', 'application/octet-stream', 415],
    [Buffer.from('test'), 'file.txt', 'image/png', 415],
    [Buffer.alloc(0), 'kosong.txt', 'text/plain', 400],
    [Buffer.from([0, 1, 2, 255]), 'biner.txt', 'text/plain', 422],
    [Buffer.from('bukan html'), 'file.html', 'text/html', 422],
  ]) {
    const response = await upload(bytes, name, mime);
    assert.equal(response.status, status, `${name}: ${JSON.stringify(response.body)}`);
    assert.ok(response.body.error);
  }
});

test('rejects missing file, multiple files, and wrong multipart field', async () => {
  assert.equal((await request(app).post('/api/convert')).status, 400);
  assert.equal((await request(app).post('/api/convert').attach('wrong', Buffer.from('hi'), 'hi.txt')).status, 400);
  const response = await request(app).post('/api/convert').attach('file', Buffer.from('a'), 'a.txt').attach('file', Buffer.from('b'), 'b.txt');
  assert.equal(response.status, 400);
});

test('rejects files above 10 MB on the server and shared client validator', async () => {
  const response = await upload(Buffer.alloc(MAX_FILE_SIZE + 1, 65), 'large.txt', 'text/plain');
  assert.equal(response.status, 413);
  assert.match(response.body.error, /10 MB/);
  assert.match(validateFile({ name: 'large.txt', size: MAX_FILE_SIZE + 1, type: 'text/plain' }), /10 MB/);
});

test('rejects corrupt PDF and Office documents', async () => {
  for (const extension of ['pdf', 'docx', 'xlsx']) {
    const response = await upload(Buffer.from('bukan dokumen'), `rusak.${extension}`);
    assert.equal(response.status, 422, extension);
  }
  const response = await upload(await xlsxFixture(), 'palsu.docx');
  assert.equal(response.status, 422);
  assert.match(response.body.error, /tidak sesuai/);
});

test('rejects ZIP expansion above the document limit', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', Buffer.alloc(51 * 1024 * 1024, 65));
  const response = await upload(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), 'besar.docx');
  assert.equal(response.status, 422);
  assert.match(response.body.error, /50 MB/);
});

test('rejects a spreadsheet beyond the row limit', async () => {
  const csv = 'Nama\n' + Array(10001).fill('Ayu').join('\n');
  const response = await upload(Buffer.from(csv), 'besar.csv', 'text/csv');
  assert.equal(response.status, 422);
  assert.match(response.body.error, /10.000 baris/);
});

test('releases the upload buffer after conversion', async () => {
  let observed;
  const isolated = createApp({ converter: async buffer => { observed = buffer; return { markdown: 'ok\n', warnings: [] }; } });
  const response = await request(isolated).post('/api/convert').attach('file', Buffer.from('pribadi'), 'secret.txt');
  assert.equal(response.status, 200);
  assert.ok(observed.every(byte => byte === 0));
});

test('limits concurrent work and recovers after completion', async () => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const isolated = createApp({ maxActive: 1, converter: async () => { entered(); await new Promise(resolve => { release = resolve; }); return { markdown: 'ok\n', warnings: [] }; } });
  const first = request(isolated).post('/api/convert').attach('file', Buffer.from('test'), 'a.txt').then(value => value);
  await started;
  try {
    const second = await request(isolated).post('/api/convert').attach('file', Buffer.from('test'), 'b.txt');
    assert.equal(second.status, 503);
    assert.equal(second.headers['retry-after'], '3');
  } finally { release(); }
  assert.equal((await first).status, 200);
  assert.equal((await request(isolated).post('/api/convert')).status, 400);
});

test('terminates conversion workers on timeout or cancellation', async () => {
  const workerUrl = new URL('data:text/javascript,while(true){}');
  await assert.rejects(runConversion(Buffer.from('x'), 'txt', null, { timeout: 40, workerUrl }), /30 detik/);
  const controller = new AbortController();
  const pending = runConversion(Buffer.from('x'), 'txt', controller.signal, { workerUrl });
  controller.abort();
  await assert.rejects(pending, /dibatalkan/);
});
