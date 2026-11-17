const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

module.exports = function createUpdater(window, canInstall, log) {
  let busy = false;
  let downloaded = false;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
  autoUpdater.on('error', error => log('Update: ' + error.message));
  autoUpdater.on('download-progress', progress => {
    if (window.isDestroyed()) return;
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
    window.setProgressBar(percent / 100);
    window.setTitle(`To Markdown — Mengunduh pembaruan ${percent}%`);
  });
  autoUpdater.on('update-downloaded', () => { downloaded = true; });

  async function install() {
    if (!await canInstall()) {
      await dialog.showMessageBox(window, { type: 'info', message: 'Simpan dokumen terlebih dahulu.', detail: 'Gunakan Ctrl+S, lalu pilih Bantuan → Periksa pembaruan untuk melanjutkan pemasangan.' });
      return;
    }
    const answer = await dialog.showMessageBox(window, { type: 'question', message: 'Pembaruan siap dipasang.', detail: 'To Markdown akan ditutup dan dibuka kembali setelah pemasangan. Windows mungkin meminta izin administrator.', buttons: ['Nanti', 'Pasang dan mulai ulang'], defaultId: 0, cancelId: 0 });
    if (answer.response === 1 && await canInstall()) autoUpdater.quitAndInstall(false, true);
  }

  async function check(manual = true) {
    if (busy) {
      if (manual) await dialog.showMessageBox(window, { message: 'Pemeriksaan atau unduhan pembaruan sedang berjalan.' });
      return;
    }
    if (!app.isPackaged) {
      if (manual) await dialog.showMessageBox(window, { message: 'Pembaruan online tersedia pada aplikasi yang sudah diinstal.' });
      return;
    }
    busy = true;
    try {
      if (downloaded) { await install(); return; }
      const result = await autoUpdater.checkForUpdates();
      if (!result || !result.isUpdateAvailable) {
        if (manual) await dialog.showMessageBox(window, { message: `To Markdown ${app.getVersion()} sudah menggunakan versi terbaru.` });
        return;
      }
      const choice = await dialog.showMessageBox(window, { type: 'info', message: `To Markdown ${result.updateInfo.version} tersedia.`, detail: 'Unduh pembaruan dari GitHub Releases zenqyverse/to-markdown? Anda dapat tetap mengedit selama unduhan. Rilis ini belum menggunakan sertifikat penerbit.', buttons: ['Nanti', 'Unduh'], defaultId: 1, cancelId: 0 });
      if (choice.response !== 1) return;
      await autoUpdater.downloadUpdate();
      window.setProgressBar(-1);
      window.setTitle('To Markdown');
      await install();
    } catch (error) {
      log('Update gagal: ' + error.message);
      if (!window.isDestroyed()) await dialog.showMessageBox(window, { type: 'warning', message: 'Pembaruan belum dapat diselesaikan.', detail: 'Periksa koneksi internet atau coba lagi nanti melalui menu Bantuan. Editor tetap dapat digunakan.\n\n' + String(error.message).slice(0, 300) });
    } finally {
      busy = false;
      if (!window.isDestroyed()) { window.setProgressBar(-1); window.setTitle('To Markdown'); }
    }
  }
  return { check };
};
