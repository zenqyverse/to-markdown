const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
app.disableHardwareAcceleration();
app.setName('To Markdown');
if (process.platform === 'win32') app.setAppUserModelId('id.tomarkdown.desktop');
let window, server, origin, activePath, activeHash, ready = false;
const log = message => { try { require('node:fs').appendFileSync(path.join(app.getPath('userData'), 'desktop.log'), new Date().toISOString() + ' ' + message + '\n'); } catch {} };
log('Starting ' + app.getVersion());
const staged = new Map();
function stage(file, data) { const token = crypto.randomUUID(); staged.set(token, { file, hash: data.hash }); return { markdown: data.text, filename: data.filename, token }; }
let pending = process.argv.find(arg => /\.(md|markdown)$/i.test(arg) && !arg.startsWith('--'));
const MAX = 5 * 1024 * 1024;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function readDocument(file) {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX) throw new Error('File harus berupa dokumen teks dengan ukuran maksimal 5 MB.');
  const bytes = await fs.readFile(file);
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
  if (/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text)) throw new Error('File bukan teks Unicode yang valid.');
  return { text, filename: path.basename(file), hash: digest(bytes) };
}
function trusted(event) {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || new URL(event.senderFrame.url).origin !== origin) throw new Error('Permintaan tidak diizinkan.');
}
async function deliver(file) {
  if (!ready) { pending = file; return; }
  try { const data = await readDocument(file); window.webContents.send('document:file', stage(file, data)); }
  catch (error) { dialog.showErrorBox('Tidak dapat membuka dokumen', error.message); }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    // A separate window process is unnecessary: let the editor confirm replacement.
    const file = argv.find(arg => /\.(md|markdown)$/i.test(arg) && !arg.startsWith('--'));
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
    if (file) deliver(file);
  });
  app.whenReady().then(async () => {
    log('Electron ready');
    const { createApp } = await import('../server/app.js');
    // Persist the first available port so browser autosave retains its origin.
    const portFile = path.join(app.getPath('userData'), 'desktop-port.json');
    let preferredPort = 0;
    try { const value = JSON.parse(await fs.readFile(portFile, 'utf8')); if (Number.isInteger(value) && value > 1024 && value < 65536) preferredPort = value; } catch {}
    server = createApp().listen(preferredPort, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    origin = `http://127.0.0.1:${server.address().port}`;
    await fs.writeFile(portFile, JSON.stringify(server.address().port));
    log('Server ready');
    window = new BrowserWindow({ width: 1280, height: 900, minWidth: 650, minHeight: 600, title: 'To Markdown', icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#1C1D21', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    const updater = require('./updater.cjs')(window, () => new Promise(resolve => {
      const token = crypto.randomUUID();
      const done = value => { clearTimeout(timer); ipcMain.removeListener('update:safety-result', receive); resolve(value); };
      const receive = (event, reply, safe) => { if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && reply === token) done(safe === true); };
      const timer = setTimeout(() => done(false), 3000);
      ipcMain.on('update:safety-result', receive);
      window.webContents.send('update:safety', token);
    }), log);
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Bantuan', submenu: [
      { label: 'Periksa pembaruan…', click: () => updater.check() },
      { label: 'Pasang installer manual…', click: async () => {
        try {
          const choice = await dialog.showMessageBox(window, { type: 'info', title: 'Pembaruan To Markdown', message: `To Markdown ${app.getVersion()}`, detail: 'Pembaruan manual: unduh installer To Markdown versi terbaru, simpan dokumen Anda, lalu pilih installer tersebut di sini. Pasang ke lokasi instalasi yang sama. Pemeriksaan versi online belum tersedia.', buttons: ['Pilih installer…', 'Tutup'], defaultId: 1, cancelId: 1 });
          if (choice.response !== 0) return;
          const file = await dialog.showOpenDialog(window, { title: 'Pilih installer To Markdown yang Anda percaya', properties: ['openFile'], filters: [{ name: 'Installer To Markdown', extensions: ['exe'] }] });
          if (file.canceled) return;
          const installer = file.filePaths[0];
          if (!/^To-Markdown-Setup-[\d.]+-x64\.exe$/i.test(path.basename(installer))) throw new Error('Pilih file To-Markdown-Setup-VERSI-x64.exe.');
          const confirm = await dialog.showMessageBox(window, { type: 'question', message: 'Jalankan installer pembaruan?', detail: `${installer}\n\nPastikan dokumen telah disimpan dan installer berasal dari sumber yang Anda percaya.`, buttons: ['Batal', 'Jalankan installer'], defaultId: 0, cancelId: 0 });
          if (confirm.response !== 1) return;
          const error = await shell.openPath(installer);
          if (error) throw new Error(error);
        } catch (error) { dialog.showErrorBox('Pembaruan tidak dapat dijalankan', error.message); }
      } },
      { label: 'Tentang To Markdown', click: () => dialog.showMessageBox(window, { type: 'info', title: 'To Markdown', message: `To Markdown ${app.getVersion()}`, detail: 'Konversi, edit, dan unduh dalam satu tempat.' }) }
    ] }]));
    window.webContents.on('render-process-gone', (_event, details) => log('Renderer exited: ' + details.reason));
    window.webContents.on('did-fail-load', (_event, code, description) => log('Load failed: ' + code + ' ' + description));
    window.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.on('will-prevent-unload', async event => {
      const response = dialog.showMessageBoxSync(window, { type: 'warning', buttons: ['Tetap mengedit', 'Tutup tanpa menyimpan'], defaultId: 0, cancelId: 0, message: 'Perubahan belum disimpan ke file. Tetap mengedit untuk menyimpannya?' });
      if (response === 1) event.preventDefault();
    });
    ipcMain.handle('document:ready', event => { trusted(event); ready = true; if (pending) { const file = pending; pending = null; deliver(file); } });
    ipcMain.handle('document:release', event => { trusted(event); activePath = null; activeHash = null; });
    ipcMain.handle('document:adopt', (event, token, accept) => { trusted(event); const data = staged.get(token); staged.delete(token); if (accept && data) { activePath = data.file; activeHash = data.hash; } });
    ipcMain.handle('document:open', async event => {
      trusted(event);
      const choice = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }] });
      if (choice.canceled) return null;
      try { const data = await readDocument(choice.filePaths[0]); return stage(choice.filePaths[0], data); }
      catch (error) { return { error: error.message }; }
    });
    ipcMain.handle('document:save', async (event, data) => {
      trusted(event);
      try {
        if (typeof data?.text !== 'string' || Buffer.byteLength(data.text) > MAX) throw new Error('Ukuran dokumen maksimal 5 MB.');
        let destination = activePath;
        if (data.saveAs || !destination) {
          const choice = await dialog.showSaveDialog(window, { defaultPath: path.basename(String(data.name || 'dokumen.md')), filters: [{ name: 'Markdown', extensions: ['md'] }] });
          if (choice.canceled) return null;
          destination = choice.filePath;
        } else {
          let hash; try { hash = digest(await fs.readFile(destination)); } catch { hash = null; }
          if (hash !== activeHash) {
            const result = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Batal', 'Timpa file'], defaultId: 0, cancelId: 0, message: 'File asli berubah atau dihapus di luar aplikasi. Timpa dengan isi editor?' });
            if (result.response !== 1) return null;
          }
        }
        const temporary = destination + '.' + crypto.randomUUID() + '.tmp';
        try { await fs.writeFile(temporary, data.text, { encoding: 'utf8', flag: 'wx' }); await fs.rename(temporary, destination); }
        finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
        activePath = destination; activeHash = digest(Buffer.from(data.text));
        return { filename: path.basename(destination) };
      } catch (error) { return { error: 'Tidak dapat menyimpan: ' + error.message }; }
    });
    await window.loadURL(origin + '/#editor');
    log('Window loaded');
    const updateTimer = setTimeout(() => { if (!window.isDestroyed()) updater.check(false); }, 8000);
    updateTimer.unref();
  }).catch(error => { log(error.stack); dialog.showErrorBox('Aplikasi gagal dimulai', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => server?.close());
}
