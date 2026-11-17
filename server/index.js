import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = createApp().listen(port, host, () => {
  console.log(`To Markdown berjalan di http://${host}:${port}`);
});
server.requestTimeout = 60000;
server.headersTimeout = 15000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} sudah dipakai. Atur PORT ke port lain.` : 'Server gagal dijalankan: ' + error.message);
  process.exitCode = 1;
});
