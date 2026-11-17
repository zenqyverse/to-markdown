import { extensionOf, validateFile } from '/shared/formats.js';
import { renderMarkdown, downloadText } from './markdown.js';
import { openEditor } from './editor.js';

const $ = id => document.getElementById(id);
let selectedFile = null;
let result = null;
let request = null;
let activeTab = 'preview';
let dragDepth = 0;
const resultPanel = document.querySelector('.result-panel');
const resultDialog = $('result-dialog');
const resultPosition = document.createComment('Result panel position');
resultPanel.before(resultPosition);
function restoreResult() { if (resultDialog.open) resultDialog.close(); }
resultDialog.addEventListener('close', () => {
  resultPosition.after(resultPanel);
  document.body.classList.remove('result-expanded');
  updateMaximizeLabel();
  if (!$('converter-view').hidden && !document.querySelector('dialog[open]')) $('maximize-result').focus({ preventScroll: true });
});
function updateMaximizeLabel() {
  const expanded = resultDialog.open;
  $('maximize-result').innerHTML = expanded ? '↙ <span>Kembalikan · Esc</span>' : '⛶ <span>Maximize</span>';
  $('maximize-result').setAttribute('aria-label', expanded ? 'Kembalikan ukuran hasil' : `Perbesar ${activeTab === 'preview' ? 'pratinjau' : 'kode Markdown'}`);
  $('maximize-result').title = expanded ? 'Kembalikan ukuran (Esc)' : 'Perbesar hasil';
}
$('maximize-result').addEventListener('click', () => {
  if (resultDialog.open) return restoreResult();
  resultDialog.append(resultPanel);
  document.body.classList.add('result-expanded');
  resultDialog.showModal();
  updateMaximizeLabel();
  $('maximize-result').focus();
});
window.addEventListener('hashchange', () => { if (location.hash === '#editor') restoreResult(); });

function showError(message) {
  $('error-message').textContent = message || '';
  $('error-message').hidden = !message;
}

function setBusy(busy) {
  $('choose-file').disabled = busy;
  $('remove-file').disabled = busy;
  $('sample-button').disabled = busy;
  $('file-input').disabled = busy;
  $('convert-button').disabled = busy || !selectedFile;
  $('progress-region').hidden = !busy;
  $('drop-zone').classList.toggle('busy', busy);
  $('result-status').textContent = busy ? 'Memproses…' : result ? 'Selesai' : 'Menunggu file';
  $('result-status').classList.toggle('ready', Boolean(result) && !busy);
}

function clearResult() {
  result = null;
  $('preview-panel').replaceChildren();
  $('markdown-source').textContent = '';
  $('warnings').replaceChildren();
  $('warnings').hidden = true;
  $('download-button').disabled = true;
  $('copy-button').disabled = true;
  $('edit-result-button').disabled = true;
  $('maximize-result').disabled = true;
  $('result-meta').textContent = 'Hasil dalam format .md';
  $('empty-state').hidden = false;
  switchTab(activeTab);
}

function selectFile(file) {
  if (request) return;
  showError(null);
  clearResult();
  selectedFile = null;
  $('file-card').hidden = true;
  if (file) {
    const error = validateFile(file);
    if (error) showError(error);
    else {
      selectedFile = file;
      $('file-name').textContent = file.name;
      $('file-name').title = file.name;
      $('file-size').textContent = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
      $('file-badge').textContent = extensionOf(file.name).toUpperCase();
      $('file-card').hidden = false;
    }
  }
  $('file-input').value = '';
  setBusy(false);
}

function switchTab(tab) {
  activeTab = tab;
  updateMaximizeLabel();
  for (const name of ['preview', 'source']) {
    const active = name === tab;
    $(name + '-tab').classList.toggle('active', active);
    $(name + '-tab').setAttribute('aria-selected', String(active));
    $(name + '-tab').tabIndex = active ? 0 : -1;
    $(name + '-panel').hidden = !result || !active;
  }
}

function showResult(data) {
  if (typeof data.markdown !== 'string' || !data.filename) throw new Error('Respons server tidak valid. Coba lagi.');
  // DOMPurify removes active HTML. Forbid remote media so previewing a file
  // cannot silently make third-party requests. Raw Markdown stays downloadable.
  result = data;
  renderMarkdown(data.markdown, $('preview-panel'));
  $('markdown-source').textContent = data.markdown;
  $('empty-state').hidden = true;
  $('copy-button').disabled = false;
  $('download-button').disabled = false;
  $('edit-result-button').disabled = false;
  $('maximize-result').disabled = false;
  $('warnings').replaceChildren();
  for (const message of data.warnings || []) {
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    $('warnings').append(paragraph);
  }
  $('warnings').hidden = !data.warnings?.length;
  const kb = (new Blob([data.markdown]).size / 1024).toFixed(1);
  $('result-meta').textContent = `${kb} KB · ${(data.durationMs / 1000).toFixed(1)} detik`;
  $('announcement').textContent = 'Konversi selesai. Markdown siap diperiksa dan diunduh.';
  switchTab(activeTab);
}

function convertFile() {
  if (!selectedFile || request) return;
  showError(null);
  clearResult();
  const xhr = new XMLHttpRequest();
  request = xhr;
  xhr.open('POST', '/api/convert');
  xhr.responseType = 'json';
  xhr.timeout = 90000;
  setBusy(true);
  $('progress').value = 0;
  $('progress').setAttribute('aria-label', 'Progres upload');
  $('progress-text').textContent = 'Mengunggah dokumen… 0%';
  xhr.upload.onprogress = event => {
    if (!event.lengthComputable) return;
    const percent = Math.round(event.loaded / event.total * 100);
    $('progress').value = percent;
    $('progress-text').textContent = `Mengunggah dokumen… ${percent}%`;
  };
  xhr.upload.onload = () => {
    $('progress').removeAttribute('value');
    $('progress').setAttribute('aria-label', 'Konversi sedang berjalan');
    $('progress-text').textContent = 'Mengonversi dokumen…';
  };
  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) return showError(xhr.response?.error || 'Server gagal memproses dokumen. Silakan coba lagi.');
    try { showResult(xhr.response); } catch (error) { clearResult(); showError(error.message); }
  };
  xhr.onerror = () => showError('Tidak dapat menghubungi server. Periksa koneksi dan pastikan server berjalan.');
  xhr.ontimeout = () => showError('Permintaan terlalu lama. Coba lagi dengan file yang lebih kecil.');
  xhr.onabort = () => { $('announcement').textContent = 'Konversi dibatalkan.'; showError('Konversi dibatalkan. File dapat dicoba kembali.'); };
  xhr.onloadend = () => { request = null; setBusy(false); };
  const form = new FormData();
  form.append('file', selectedFile);
  xhr.send(form);
}

$('choose-file').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => selectFile(event.target.files[0]));
$('remove-file').addEventListener('click', () => selectFile(null));
$('convert-button').addEventListener('click', convertFile);
$('cancel-button').addEventListener('click', () => request?.abort());
// Prevent the browser from navigating away if a document is dropped outside the box.
for (const type of ['dragover', 'drop']) window.addEventListener(type, event => event.preventDefault());
$('drop-zone').addEventListener('dragenter', event => { event.preventDefault(); if (!request) { dragDepth++; $('drop-zone').classList.add('dragging'); } });
$('drop-zone').addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop-zone').classList.remove('dragging'); });
$('drop-zone').addEventListener('drop', event => {
  dragDepth = 0;
  $('drop-zone').classList.remove('dragging');
  if (request) return;
  if (event.dataTransfer.files.length !== 1) { selectFile(null); return showError('Pilih satu file setiap kali konversi.'); }
  selectFile(event.dataTransfer.files[0]);
});
for (const name of ['preview', 'source']) {
  $(name + '-tab').addEventListener('click', () => switchTab(name));
  $(name + '-tab').addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 'preview' : event.key === 'End' ? 'source' : name === 'preview' ? 'source' : 'preview';
      switchTab(next);
      $(next + '-tab').focus();
    }
  });
}
$('download-button').addEventListener('click', () => {
  if (!result) return;
  downloadText(result.markdown, result.filename);
});
$('edit-result-button').addEventListener('click', () => { if (result) { restoreResult(); openEditor(result); } });
$('copy-button').addEventListener('click', async () => {
  if (!result) return;
  try {
    await navigator.clipboard.writeText(result.markdown);
    $('copy-button').textContent = 'Tersalin ✓';
    $('announcement').textContent = 'Markdown disalin ke clipboard.';
    setTimeout(() => { $('copy-button').textContent = 'Salin'; }, 2000);
  } catch { showError('Browser tidak mengizinkan akses clipboard. Salin teks dari tab Kode Markdown atau unduh file.'); }
});
$('sample-button').addEventListener('click', () => {
  const sample = '<h1>Ruang untuk ide Anda</h1><p>Dokumen yang rapi dimulai dari <strong>format yang sederhana</strong>.</p><h2>Daftar kecil, langkah besar</h2><ul><li>Kumpulkan ide yang berarti</li><li>Susun menjadi cerita</li><li>Bagikan dengan dunia</li></ul><blockquote>Lebih sedikit format. Lebih banyak fokus.</blockquote><h2>Rencana minggu ini</h2><table><thead><tr><th>Pekerjaan</th><th>Status</th></tr></thead><tbody><tr><td>Catatan proyek</td><td>Siap</td></tr><tr><td>Dokumentasi</td><td>Dalam proses</td></tr></tbody></table>';
  selectFile(new File([sample], 'contoh-dokumen.html', { type: 'text/html' }));
  convertFile();
});
