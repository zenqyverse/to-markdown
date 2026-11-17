import { MAX_EDITOR_BYTES, wrapSelection, prefixLines, makeTable, findMatches, replaceMatches, EditHistory } from './editor-core.js';
import { downloadText } from './markdown.js';
import { renderEditorMarkdown } from './editor-renderer.js';

const $ = id => document.getElementById(id);
const input = $('editor-text');
const filename = $('editor-filename');
const DRAFT_KEY = 'to-markdown.editor.draft.v1';
const SETTINGS_KEY = 'to-markdown.editor.settings.v1';
const PREVIEW_LIMIT = 200000;
let history = new EditHistory({ text: '', start: 0, end: 0 });
let historyTimer, saveTimer, previewTimer;
let generation = 0;
let lastAccepted = { text: '', start: 0, end: 0 };
let persisted = '';
let downloaded = '';
let currentMatch = -1;
let scrollLock = false;
let activeRead = false;
let dialogAction;
let nativeSaved = '';

function snapshot() { return { text: input.value, start: input.selectionStart, end: input.selectionEnd }; }
function identity() { return JSON.stringify([filename.value, input.value]); }
function notice(message = '') { $('editor-notice').textContent = message; $('editor-notice').hidden = !message; }
function announce(message) { $('announcement').textContent = message; }
function updateHistoryButtons() { $('editor-undo').disabled = history.index <= 0 && history.entries[history.index].text === input.value; $('editor-redo').disabled = history.index >= history.entries.length - 1; }
function checkpoint() { clearTimeout(historyTimer); history.push(snapshot()); updateHistoryButtons(); }
function updateCursor() {
  const before = input.value.slice(0, input.selectionStart);
  $('editor-cursor').textContent = `Baris ${before.split('\n').length}, kolom ${before.length - before.lastIndexOf('\n')}`;
}
function updateStats() {
  const words = input.value.trim() ? input.value.trim().split(/\s+/u).length : 0;
  $('editor-stats').textContent = `${words.toLocaleString('id-ID')} kata · ${input.value.length.toLocaleString('id-ID')} karakter · ${Math.ceil(words / 200)} menit baca`;
  updateCursor();
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autosave: $('editor-autosave').checked, wrap: $('editor-wrap').checked, spellcheck: $('editor-spellcheck').checked, fontSize: $('editor-font-size').value, theme: $('editor-theme').value, sync: $('editor-sync').checked })); }
  catch { notice('Pengaturan tidak dapat disimpan oleh browser. Unduh dokumen untuk menyimpan salinan.'); }
}
function saveDraft() {
  clearTimeout(saveTimer);
  if (!$('editor-autosave').checked) { $('editor-save-status').textContent = 'Autosave nonaktif · unduh untuk menyimpan'; return; }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, text: input.value, filename: filename.value, savedAt: Date.now() }));
    persisted = identity();
    $('editor-save-status').textContent = 'Tersimpan lokal · ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    persisted = '';
    $('editor-save-status').textContent = 'Gagal menyimpan · unduh salinan';
    notice('Penyimpanan browser penuh atau tidak diizinkan. Tulisan tetap ada di editor; unduh .md sebelum menutup halaman.');
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  $('editor-save-status').textContent = $('editor-autosave').checked ? 'Menyimpan…' : 'Autosave nonaktif · unduh untuk menyimpan';
  saveTimer = setTimeout(saveDraft, 600);
}

async function preview() {
  clearTimeout(previewTimer);
  const version = ++generation;
  if ($('editor-view').hidden) return;
  $('editor-render-status').textContent = 'Memperbarui…';
  try {
    const { headings, errors } = await renderEditorMarkdown(input.value.slice(0, PREVIEW_LIMIT), $('editor-preview'), () => version === generation);
    if (version !== generation) return;
    $('editor-render-status').textContent = input.value.length > PREVIEW_LIMIT ? 'Pratinjau 200.000 karakter pertama' : errors.length ? 'Periksa sintaks' : 'Diperbarui';
    if (errors.length) notice(errors.join(' '));
    const outline = $('editor-outline-items');
    outline.replaceChildren();
    if (!headings.length) { const message = document.createElement('p'); message.textContent = 'Tambahkan heading (#) untuk menyusun outline.'; outline.append(message); }
    for (const heading of headings) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${'· '.repeat(heading.level - 1)}${heading.text || 'Tanpa judul'}`;
      button.addEventListener('click', () => {
        if ($('editor-body').dataset.layout === 'write') setLayout('split');
        const element = document.getElementById(heading.id);
        if (element) $('editor-preview').scrollTop = element.offsetTop - $('editor-preview').offsetTop - 16;
      });
      outline.append(button);
    }
  } catch { if (version === generation) { $('editor-render-status').textContent = 'Gagal merender'; notice('Pratinjau gagal diperbarui. Teks asli tetap aman di editor dan dapat diunduh.'); } }
}

function changed({ immediate = false } = {}) {
  lastAccepted = snapshot();
  updateStats();
  updateMatches();
  updateHistoryButtons();
  scheduleSave();
  generation++;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, immediate ? 0 : 250);
}
function applyEdit(edit) {
  if (new Blob([edit.text]).size > MAX_EDITOR_BYTES) return notice('Dokumen editor maksimal 5 MB. Perubahan ini tidak diterapkan.');
  checkpoint();
  input.value = edit.text;
  input.focus();
  input.setSelectionRange(edit.start, edit.end);
  checkpoint();
  changed();
}
function insertText(text, block = false) {
  const start = input.selectionStart, end = input.selectionEnd;
  const before = input.value.slice(0, start), after = input.value.slice(end);
  const prefix = block && before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = block && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  applyEdit({ text: before + prefix + text + suffix + after, start: start + prefix.length, end: start + prefix.length + text.length });
}
function undo(redo = false) {
  checkpoint();
  const state = redo ? history.redo() : history.undo();
  if (!state) return;
  input.value = state.text;
  input.focus(); input.setSelectionRange(state.start, state.end);
  changed({ immediate: true });
  updateHistoryButtons();
}

function confirmAction(title, message, label = 'Lanjutkan') {
  return new Promise(resolve => {
    const dialog = $('editor-confirm');
    if (dialog.open) return resolve(false);
    $('editor-confirm-title').textContent = title;
    $('editor-confirm-message').textContent = message;
    $('editor-confirm-ok').textContent = label;
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    dialog.showModal();
  });
}
$('editor-confirm-ok').addEventListener('click', () => $('editor-confirm').close('yes'));
$('editor-confirm-cancel').addEventListener('click', () => $('editor-confirm').close('no'));
async function replaceDocument(text, name, preserveNative = false) {
  if (new Blob([text]).size > MAX_EDITOR_BYTES) { notice('Dokumen editor maksimal 5 MB.'); return false; }
  if (input.value && (input.value !== text || filename.value !== name)) {
    if (!await confirmAction('Ganti dokumen di editor?', 'Dokumen aktif dan draf autosave akan diganti. Unduh .md terlebih dahulu jika ingin menyimpan salinan dokumen lama.', 'Ganti dokumen')) return false;
  }
  clearTimeout(historyTimer);
  if (window.desktop && !preserveNative) await window.desktop.release();
  input.value = text;
  filename.value = name || 'tanpa-judul.md';
  input.setSelectionRange(0, 0);
  history = new EditHistory(snapshot());
  persisted = ''; downloaded = '';
  nativeSaved = preserveNative ? identity() : '';
  notice();
  changed({ immediate: true });
  return true;
}
export async function openEditor(data) {
  if (data && !await replaceDocument(data.markdown, data.filename)) return;
  location.hash = 'editor';
  showWorkspace();
}
function showWorkspace() {
  const editor = location.hash === '#editor';
  $('converter-view').hidden = editor;
  $('editor-view').hidden = !editor;
  document.body.classList.toggle('editor-open', editor);
  for (const name of ['converter', 'editor']) {
    if ((name === 'editor') === editor) $('nav-' + name).setAttribute('aria-current', 'page');
    else $('nav-' + name).removeAttribute('aria-current');
  }
  if (!editor) setFocus(false);
  else preview();
}
window.addEventListener('hashchange', showWorkspace);

function dialog({ title, fields = [], hint = '', submit = 'Sisipkan', action }) {
  const body = $('editor-dialog-fields');
  body.replaceChildren();
  $('editor-dialog-title').textContent = title;
  $('editor-dialog-hint').textContent = hint;
  $('editor-dialog-submit').textContent = submit;
  for (const field of fields) {
    const label = document.createElement('label');
    label.textContent = field.label;
    const control = document.createElement(field.type === 'textarea' ? 'textarea' : field.options ? 'select' : 'input');
    control.name = field.name;
    if (control.tagName === 'INPUT') control.type = field.type || 'text';
    if (field.options) for (const [value, text] of field.options) { const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option); }
    control.value = field.value ?? '';
    control.required = Boolean(field.required);
    if (field.min != null) control.min = field.min;
    if (field.max != null) control.max = field.max;
    if (field.maxLength) control.maxLength = field.maxLength;
    label.append(control); body.append(label);
  }
  dialogAction = action;
  $('editor-dialog').showModal();
}
$('editor-dialog-form').addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  const action = dialogAction;
  $('editor-dialog').close();
  action?.(values);
});
for (const id of ['editor-dialog-close', 'editor-dialog-cancel']) $(id).addEventListener('click', () => $('editor-dialog').close());

function command(name) {
  const start = input.selectionStart, end = input.selectionEnd;
  const wrappers = { bold: '**', italic: '*', strike: '~~', 'inline-code': '`' };
  if (wrappers[name]) applyEdit(wrapSelection(input.value, start, end, wrappers[name]));
  else if (name === 'rule') insertText('---', true);
  else applyEdit(prefixLines(input.value, start, end, name));
}
function insertDialog(kind) {
  const selected = input.value.slice(input.selectionStart, input.selectionEnd);
  const action = values => {
    if (kind === 'table') insertText(makeTable(values.rows, values.columns), true);
    if (kind === 'link' || kind === 'image') {
      const url = values.url.trim();
      if (!/^(https?:\/\/|mailto:|#|\.?\.?\/)/i.test(url)) return notice('Gunakan URL https://, http://, mailto:, anchor #, atau path relatif ./ dan /.');
      const label = values.label.replace(/([\[\]\\])/g, '\\$1');
      insertText(`${kind === 'image' ? '!' : ''}[${label}](${url.replace(/[\s()<>]/g, c => encodeURIComponent(c))})`);
    }
    if (kind === 'code' || kind === 'mermaid') {
      const longest = Math.max(2, ...(values.code.match(/`+/g) || []).map(run => run.length));
      const fence = '`'.repeat(longest + 1);
      insertText(`${fence}${kind === 'mermaid' ? 'mermaid' : values.language}\n${values.code}\n${fence}`, true);
    }
    if (kind === 'math') insertText(values.mode === 'inline' ? `$${values.expression}$` : `$$\n${values.expression}\n$$`, values.mode !== 'inline');
  };
  if (kind === 'table') dialog({ title: 'Sisipkan tabel', fields: [{ name: 'columns', label: 'Jumlah kolom (1–12)', type: 'number', value: 3, min: 1, max: 12, required: true }, { name: 'rows', label: 'Baris data (1–30, di luar header)', type: 'number', value: 3, min: 1, max: 30, required: true }], hint: 'Header dan pembatas GFM dibuat otomatis. Isi sel dapat diedit langsung dalam Markdown.', action });
  if (kind === 'link' || kind === 'image') dialog({ title: kind === 'link' ? 'Sisipkan tautan' : 'Sisipkan referensi gambar', fields: [{ name: 'label', label: kind === 'link' ? 'Teks tautan' : 'Deskripsi gambar (alt text)', value: selected || (kind === 'link' ? 'Tautan' : 'Deskripsi gambar'), required: true }, { name: 'url', label: 'Alamat URL atau path relatif', value: 'https://', required: true }], hint: kind === 'image' ? 'Referensi gambar disimpan dalam Markdown. Demi privasi, gambar eksternal tidak dimuat di pratinjau.' : 'Tautan pratinjau dibuka di tab baru.', action });
  if (kind === 'code') dialog({ title: 'Sisipkan blok kode', fields: [{ name: 'language', label: 'Bahasa pemrograman', value: 'javascript', options: [['javascript','JavaScript'],['typescript','TypeScript'],['python','Python'],['json','JSON'],['html','HTML'],['css','CSS'],['bash','Shell / Bash'],['sql','SQL'],['yaml','YAML'],['java','Java'],['cpp','C++'],['go','Go'],['rust','Rust'],['plaintext','Teks biasa']] }, { name: 'code', label: 'Kode', type: 'textarea', value: selected || 'console.log("Halo, Markdown!");', required: true }], action });
  if (kind === 'mermaid') dialog({ title: 'Sisipkan diagram Mermaid', fields: [{ name: 'code', label: 'Definisi diagram', type: 'textarea', value: selected || 'flowchart LR\n  A[Ide] --> B[Tulis]\n  B --> C[Bagikan]', required: true, maxLength: 20000 }], hint: 'Mendukung flowchart, sequence, class, state, ER, Gantt, dan jenis Mermaid lainnya. Konfigurasi keamanan dikelola aplikasi.', action });
  if (kind === 'math') dialog({ title: 'Sisipkan rumus matematika', fields: [{ name: 'mode', label: 'Tampilan', value: 'block', options: [['block','Blok terpisah ($$)'],['inline','Di dalam kalimat ($)']] }, { name: 'expression', label: 'Ekspresi LaTeX', type: 'textarea', value: selected || 'E = mc^2', required: true }], hint: 'Dirender menggunakan KaTeX. Contoh: \\frac{a}{b}, \\sum_{i=1}^{n} i, \\sqrt{x}.', action });
}
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => command(button.dataset.command)));
document.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => insertDialog(button.dataset.insert)));
$('editor-heading-level').addEventListener('change', event => { if (event.target.value) command(event.target.value); event.target.value = ''; });
$('editor-undo').addEventListener('click', () => undo());
$('editor-redo').addEventListener('click', () => undo(true));

function matches() { return findMatches(input.value, $('editor-find').value, $('editor-case').checked); }
function updateMatches() { const count = matches().length; $('editor-match-count').textContent = `${count.toLocaleString('id-ID')} hasil`; }
function navigateMatch(direction = 1) {
  const results = matches();
  if (!results.length) { currentMatch = -1; return updateMatches(); }
  const position = input.selectionStart;
  const exactIndex = results.findIndex(match => match.start === position && match.end === input.selectionEnd);
  currentMatch = exactIndex < 0 ? (direction > 0 ? results.findIndex(match => match.start >= position) : results.findLastIndex(match => match.start <= position)) : exactIndex + direction;
  if (currentMatch < 0) currentMatch = direction > 0 ? 0 : results.length - 1;
  if (currentMatch >= results.length) currentMatch = 0;
  const match = results[currentMatch];
  input.focus(); input.setSelectionRange(match.start, match.end);
  // Textarea selection doesn't scroll reliably in all browsers; position by line.
  input.scrollTop = Math.max(0, (input.value.slice(0, match.start).split('\n').length - 3) * parseFloat(getComputedStyle(input).lineHeight));
  $('editor-match-count').textContent = `${currentMatch + 1} / ${results.length} hasil`;
  updateCursor();
}
function toggleSearch(force) {
  const open = force ?? $('editor-search').hidden;
  $('editor-search').hidden = !open;
  $('editor-search-toggle').setAttribute('aria-expanded', String(open));
  if (open) { $('editor-find').focus(); updateMatches(); } else input.focus();
}
$('editor-search-toggle').addEventListener('click', () => toggleSearch());
$('editor-search-close').addEventListener('click', () => toggleSearch(false));
$('editor-find').addEventListener('input', () => { currentMatch = -1; updateMatches(); });
$('editor-case').addEventListener('change', updateMatches);
$('editor-find').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); navigateMatch(event.shiftKey ? -1 : 1); } if (event.key === 'Escape') toggleSearch(false); });
$('editor-find-next').addEventListener('click', () => navigateMatch());
$('editor-find-prev').addEventListener('click', () => navigateMatch(-1));
$('editor-replace').addEventListener('click', () => {
  const match = matches().find(item => item.start === input.selectionStart && item.end === input.selectionEnd);
  if (!match) return navigateMatch();
  const replacement = $('editor-replacement').value;
  applyEdit({ text: input.value.slice(0, match.start) + replacement + input.value.slice(match.end), start: match.start + replacement.length, end: match.start + replacement.length });
  navigateMatch();
});
$('editor-replace-all').addEventListener('click', () => {
  const results = matches();
  if (!results.length) return;
  applyEdit({ text: replaceMatches(input.value, results, $('editor-replacement').value), start: 0, end: 0 });
  announce(`${results.length} teks diganti.`);
});

function setLayout(layout) {
  $('editor-body').dataset.layout = layout;
  document.querySelectorAll('[data-layout]').forEach(button => { if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.layout === layout)); });
}
document.querySelectorAll('button[data-layout]').forEach(button => button.addEventListener('click', () => setLayout(button.dataset.layout)));
for (const name of ['outline', 'settings']) {
  const id = name === 'settings' ? 'editor-settings-panel' : 'editor-outline';
  $('editor-' + name + '-toggle').addEventListener('click', () => { $(id).hidden = !$(id).hidden; $('editor-' + name + '-toggle').setAttribute('aria-expanded', String(!$(id).hidden)); });
}
function setFocus(focus) {
  document.body.classList.toggle('focus-mode', focus);
  $('editor-focus').setAttribute('aria-pressed', String(focus));
  document.getElementById('editor-exit-focus')?.remove();
  if (focus) { const button = document.createElement('button'); button.id = 'editor-exit-focus'; button.type = 'button'; button.className = 'button button-save focus-exit'; button.textContent = 'Keluar fokus · Esc'; button.addEventListener('click', () => setFocus(false)); document.body.append(button); }
}
$('editor-focus').addEventListener('click', () => setFocus(!document.body.classList.contains('focus-mode')));
function settingsChanged() {
  input.wrap = $('editor-wrap').checked ? 'soft' : 'off';
  input.spellcheck = $('editor-spellcheck').checked;
  input.style.fontSize = $('editor-font-size').value + 'px';
  window.appTheme.set($('editor-theme').value);
  saveSettings();
}
for (const name of ['wrap','spellcheck','font-size','theme','sync']) $('editor-' + name).addEventListener('change', settingsChanged);
$('editor-autosave').addEventListener('change', () => { saveSettings(); saveDraft(); });
$('editor-forget').addEventListener('click', async () => {
  if (!await confirmAction('Hapus draf yang tersimpan?', 'Draf lokal akan dihapus dan autosave dinonaktifkan. Tulisan saat ini tetap di editor sampai Anda menutup halaman; unduh .md untuk menyimpannya.', 'Hapus draf lokal')) return;
  clearTimeout(saveTimer);
  try { localStorage.removeItem(DRAFT_KEY); $('editor-autosave').checked = false; persisted = ''; saveSettings(); saveDraft(); notice('Draf lokal dihapus. Autosave nonaktif; tulisan saat ini masih dapat diunduh.'); }
  catch { notice('Browser tidak mengizinkan penghapusan draf lokal.'); }
});
for (const [source, target] of [[input, $('editor-preview')], [$('editor-preview'), input]]) source.addEventListener('scroll', () => {
  if (!$('editor-sync').checked || scrollLock || $('editor-body').dataset.layout !== 'split') return;
  scrollLock = true;
  target.scrollTop = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight) * (target.scrollHeight - target.clientHeight);
  requestAnimationFrame(() => { scrollLock = false; });
});

function download() {
  const name = (filename.value.trim() || 'tanpa-judul').replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/\.(?:md|markdown)$/i, '') + '.md';
  filename.value = name;
  downloadText(input.value, name);
  downloaded = identity();
  saveDraft();
  announce('File Markdown diunduh.');
}
$('editor-download').addEventListener('click', download);
$('editor-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(input.value); $('editor-copy').textContent = 'Tersalin ✓'; setTimeout(() => { $('editor-copy').textContent = 'Salin'; }, 1800); }
  catch { notice('Akses clipboard tidak tersedia. Pilih teks di editor atau unduh file .md.'); }
});
$('editor-new').addEventListener('click', () => replaceDocument('', 'tanpa-judul.md'));
$('editor-open').addEventListener('click', async () => {
  if (!window.desktop) return $('editor-file').click();
  const data = await window.desktop.open();
  if (!data) return;
  if (data.error) return notice(data.error);
  await window.desktop.adopt(data.token, await replaceDocument(data.markdown, data.filename, true));
});
$('editor-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file || activeRead) return;
  if (!/\.(md|markdown|txt)$/i.test(file.name)) return notice('Pilih file .md, .markdown, atau .txt.');
  if (file.size > MAX_EDITOR_BYTES) return notice('File editor maksimal 5 MB.');
  activeRead = true; $('editor-open').disabled = true;
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
    const text = new TextDecoder(encoding, { fatal: true }).decode(buffer).replace(/\r\n?/g, '\n');
    if (/[\u0000-\u0008\u000b\u000e-\u001f]/u.test(text)) throw new Error('binary');
    await replaceDocument(text, file.name.replace(/\.(?:txt|markdown)$/i, '.md'));
  } catch { notice('File tidak dapat dibaca. Gunakan teks UTF-8 atau UTF-16 dengan BOM.'); }
  finally { activeRead = false; $('editor-open').disabled = false; }
});
input.addEventListener('input', event => {
  if (event.isComposing) return;
  if (new Blob([input.value]).size > MAX_EDITOR_BYTES) { input.value = lastAccepted.text; input.setSelectionRange(lastAccepted.start, lastAccepted.end); notice('Ukuran maksimum editor 5 MB; perubahan terakhir dibatalkan.'); return; }
  changed();
  clearTimeout(historyTimer); historyTimer = setTimeout(checkpoint, 450);
});
input.addEventListener('compositionend', () => input.dispatchEvent(new Event('input')));
input.addEventListener('click', updateCursor);
input.addEventListener('keyup', updateCursor);
input.addEventListener('select', updateCursor);
filename.addEventListener('input', scheduleSave);
input.addEventListener('keydown', event => {
  if (event.key === 'Tab') { event.preventDefault(); command(event.shiftKey ? 'outdent' : 'indent'); }
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && input.selectionStart === input.selectionEnd) {
    const start = input.selectionStart;
    const lineStart = start === 0 ? 0 : input.value.lastIndexOf('\n', start - 1) + 1;
    const line = input.value.slice(lineStart, start);
    const match = /^(\s*)(?:([-*+]) (\[[ xX]\] )?|(\d+)\. |> )(.*)$/.exec(line);
    if (match) {
      event.preventDefault();
      if (!match[5].trim()) applyEdit({ text: input.value.slice(0, lineStart) + input.value.slice(start), start: lineStart, end: lineStart });
      else { const prefix = match[1] + (match[2] ? match[2] + ' ' + (match[3] ? '[ ] ' : '') : match[4] ? `${Number(match[4]) + 1}. ` : '> '); const insertion = '\n' + prefix; applyEdit({ text: input.value.slice(0, start) + insertion + input.value.slice(start), start: start + insertion.length, end: start + insertion.length }); }
    }
  }
});
document.addEventListener('keydown', event => {
  if ($('editor-view').hidden || $('editor-dialog').open || $('editor-confirm').open) return;
  if (event.key === 'Escape') { if (!$('editor-search').hidden) toggleSearch(false); else setFocus(false); return; }
  if (!event.ctrlKey && !event.metaKey) return;
  const key = event.key.toLowerCase();
  const inDocument = event.target === input;
  if (key === 's') { event.preventDefault(); if (window.desktop) nativeSave(event.shiftKey); else download(); }
  if (key === 'f' || key === 'h') { event.preventDefault(); toggleSearch(true); }
  if (inDocument && ['b','i','k','z','y'].includes(key)) {
    event.preventDefault();
    if (key === 'b' || key === 'i') command(key === 'b' ? 'bold' : 'italic');
    if (key === 'k') insertDialog('link');
    if (key === 'z' || key === 'y') undo(key === 'y' || event.shiftKey);
  }
});

const templates = {
  notes: '# Catatan\n\n## Ringkasan\n\nTulis gagasan utama di sini.\n\n## Tindak lanjut\n\n- [ ] Langkah pertama\n- [ ] Langkah berikutnya\n',
  meeting: '# Catatan rapat\n\n**Tanggal:** ' + new Date().toLocaleDateString('id-ID') + '\n\n**Peserta:**\n\n## Agenda\n\n1. Pembahasan utama\n2. Keputusan\n\n## Tindak lanjut\n\n| Pekerjaan | Penanggung jawab | Tenggat |\n| --- | --- | --- |\n| Tindak lanjut | Nama | Tanggal |\n',
  readme: '# Nama Proyek\n\nDeskripsi singkat proyek.\n\n## Instalasi\n\n```bash\nnpm install\nnpm start\n```\n\n## Fitur\n\n- Fitur utama\n- Fitur tambahan\n\n## Kontribusi\n\nJelaskan cara berkontribusi.\n\n## Lisensi\n\nTuliskan lisensi proyek.\n',
  technical: '# Catatan teknis\n\n## Arsitektur\n\n```mermaid\nflowchart LR\n  A[Browser] --> B[API]\n  B --> C[Worker]\n  C --> D[Markdown]\n```\n\n## Contoh implementasi\n\n```javascript\nasync function convert(file) {\n  const form = new FormData();\n  form.append("file", file);\n  const response = await fetch("/api/convert", { method: "POST", body: form });\n  return response.json();\n}\n```\n\n## Rumus\n\nEnergi ditulis sebagai $E = mc^2$.\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n\n## Validasi\n\n- [x] Implementasi\n- [ ] Pengujian\n\n| Komponen | Status |\n| --- | --- |\n| Editor | Siap |\n| Dokumentasi | Dalam proses |\n',
};
$('editor-template').addEventListener('click', () => dialog({ title: 'Mulai dengan template', fields: [{ name: 'template', label: 'Pilih template', value: 'notes', options: [['notes','Catatan pribadi'],['meeting','Catatan rapat'],['readme','README proyek'],['technical','Dokumen teknis: kode, diagram & rumus']] }], submit: 'Gunakan template', hint: 'Template menggantikan dokumen aktif setelah konfirmasi. Unduh dokumen lama jika masih diperlukan.', action: values => replaceDocument(templates[values.template], values.template + '.md') }));
$('editor-help').addEventListener('click', () => {
  dialog({ title: 'Panduan & pintasan', submit: 'Mengerti', hint: 'GFM: heading, tabel, checklist, kutipan, tautan, dan kode. Rumus memakai $…$ atau $$…$$; diagram memakai blok kode mermaid. Gambar hanya disimpan sebagai referensi. Autosave berlaku untuk satu draf di browser ini.', action() {} });
  const table = document.createElement('table'); table.className = 'shortcut-table';
  for (const [key, description] of [['Ctrl / ⌘ + B','Tebal'],['Ctrl / ⌘ + I','Miring'],['Ctrl / ⌘ + K','Sisipkan tautan'],['Ctrl / ⌘ + Z','Urungkan'],['Ctrl / ⌘ + Shift + Z','Ulangi'],['Ctrl / ⌘ + F atau H','Cari & ganti'],['Ctrl / ⌘ + S','Unduh Markdown'],['Tab / Shift + Tab','Indentasi / kurangi indentasi'],['Enter dalam daftar','Lanjutkan daftar; Enter pada item kosong untuk selesai'],['Escape','Tutup pencarian atau keluar mode fokus']]) { const row = table.insertRow(); const label = document.createElement('kbd'); label.textContent = key; row.insertCell().append(label); row.insertCell().textContent = description; }
  $('editor-dialog-fields').append(table);
});

window.addEventListener('pagehide', saveDraft);
window.addEventListener('beforeunload', event => {
  if (window.desktop && identity() !== nativeSaved && (nativeSaved || input.value)) { saveDraft(); event.preventDefault(); event.returnValue = ''; return; }
  if (!input.value) return;
  if ($('editor-autosave').checked) saveDraft();
  if (identity() !== persisted && identity() !== downloaded) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('storage', event => {
  if (event.key === DRAFT_KEY) { clearTimeout(saveTimer); $('editor-autosave').checked = false; persisted = ''; $('editor-save-status').textContent = 'Autosave dijeda · draf berubah di tab lain'; notice('Draf lokal berubah di tab lain. Autosave tab ini dijeda agar tidak menimpa tulisan di tab tersebut. Unduh salinan atau aktifkan kembali autosave secara manual.'); }
});

try {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  for (const name of ['autosave','wrap','spellcheck','sync']) if (typeof settings[name] === 'boolean') $('editor-' + name).checked = settings[name];
  if (['13','15','18','21'].includes(settings.fontSize)) $('editor-font-size').value = settings.fontSize;
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (draft?.version === 1 && typeof draft.text === 'string' && new Blob([draft.text]).size <= MAX_EDITOR_BYTES) {
    input.value = draft.text; filename.value = String(draft.filename || 'tanpa-judul.md').slice(0, 120);
    history = new EditHistory(snapshot()); lastAccepted = snapshot(); persisted = identity();
    $('editor-save-status').textContent = 'Draf lokal dipulihkan';
  }
} catch { notice('Draf lokal tidak dapat dipulihkan. Penyimpanan browser mungkin dibatasi.'); }
// Apply settings without writing storage during page initialization.
input.wrap = $('editor-wrap').checked ? 'soft' : 'off';
input.spellcheck = $('editor-spellcheck').checked;
input.style.fontSize = $('editor-font-size').value + 'px';
window.appTheme.set(document.documentElement.dataset.theme);
if (!$('editor-autosave').checked) $('editor-save-status').textContent = 'Autosave nonaktif · unduh untuk menyimpan';
updateStats();
showWorkspace();

async function nativeSave(saveAs = false) {
  const savedText = input.value;
  const saved = await window.desktop.save(savedText, saveAs, filename.value);
  if (!saved) return;
  if (saved.error) return notice(saved.error);
  filename.value = saved.filename;
  nativeSaved = JSON.stringify([saved.filename, savedText]);
  saveDraft();
  notice('Dokumen tersimpan ke file ' + saved.filename + '.');
}
if (window.desktop) {
  for (const [label, saveAs] of [['Simpan', false], ['Simpan sebagai', true]]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-save'; button.textContent = label;
    button.addEventListener('click', () => nativeSave(saveAs));
    $('editor-download').before(button);
  }
  window.desktop.onFile(async data => {
    const accepted = await replaceDocument(data.markdown, data.filename, true);
    await window.desktop.adopt(data.token, accepted);
    if (accepted) { location.hash = 'editor'; showWorkspace(); }
  });
  window.desktop.ready();
}
