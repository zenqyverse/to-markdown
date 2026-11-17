import express from 'express';
import multer from 'multer';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_FILE_SIZE, extensionOf, validateFile } from '../shared/formats.js';
import { ConversionError } from './errors.js';
import { runConversion } from './run-conversion.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 1 },
  fileFilter(req, file, done) {
    const message = validateFile({ name: file.originalname, type: file.mimetype });
    done(message ? new ConversionError(message, 415) : null, !message);
  },
}).single('file');

export function createApp({ converter = runConversion, maxActive = 2 } = {}) {
  const app = express();
  let active = 0;
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'"],
    connectSrc: ["'self'"], objectSrc: ["'none'"], frameSrc: ["'none'"],
    upgradeInsecureRequests: null,
  } } }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/api/convert', (req, res, next) => {
    if (active >= maxActive) return res.status(503).set('Retry-After', '3').json({ error: 'Server sedang memproses dokumen lain. Coba lagi beberapa saat.' });
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      if (!res.headersSent) res.status(408).json({ error: 'Upload terlalu lama. Periksa koneksi dan coba lagi.' });
    }, 60000);
    const close = () => controller.abort();
    res.once('close', close);
    upload(req, res, async error => {
      try {
        if (error) throw error;
        if (!req.file) throw new ConversionError('Pilih satu file untuk dikonversi.', 400);
        const message = validateFile({ name: req.file.originalname, size: req.file.size, type: req.file.mimetype });
        if (message) throw new ConversionError(message, 400);
        const started = performance.now();
        const result = await converter(req.file.buffer, extensionOf(req.file.originalname), controller.signal);
        const basename = path.basename(req.file.originalname.replaceAll('\\', '/')).replace(/\.[^.]+$/, '')
          .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 120) || 'dokumen';
        if (!res.destroyed && !res.headersSent) res.json({ ...result, filename: basename + '.md', durationMs: Math.round(performance.now() - started) });
      } catch (failure) {
        if (!res.destroyed && !res.headersSent) next(failure);
      } finally {
        clearTimeout(timer);
        res.removeListener('close', close);
        req.file?.buffer?.fill(0);
        delete req.file;
        active--;
      }
    });
  });
  const vendorFiles = {
    'marked.js': 'marked/lib/marked.umd.js',
    'purify.js': 'dompurify/dist/purify.min.js',
  };
  // Self-host technical editor assets. KaTeX and Mermaid generate inline styles;
  // scripts remain restricted to this origin and user HTML is sanitized.
  app.use('/vendor/katex', express.static(path.join(root, 'node_modules/katex/dist')));
  app.use('/vendor/mermaid', express.static(path.join(root, 'node_modules/mermaid/dist')));
  app.use('/vendor/highlight', express.static(path.join(root, 'node_modules/@highlightjs/cdn-assets')));
  app.get('/vendor/:file', (req, res) => {
    const file = vendorFiles[req.params.file];
    if (!file) return res.sendStatus(404);
    res.sendFile(path.join(root, 'node_modules', file));
  });
  app.use('/shared', express.static(path.join(root, 'shared')));
  app.use(express.static(path.join(root, 'public')));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) {
      const large = error.code === 'LIMIT_FILE_SIZE';
      return res.status(large ? 413 : 400).json({ error: large ? 'File terlalu besar. Ukuran maksimum adalah 10 MB.' : 'Unggah tepat satu file pada field “file”, tanpa field tambahan.' });
    }
    res.status(error.status || 500).json({ error: error instanceof ConversionError ? error.message : 'Permintaan tidak dapat diproses. Periksa file dan coba lagi.' });
  });
  return app;
}
