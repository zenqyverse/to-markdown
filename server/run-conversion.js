import { Worker } from 'node:worker_threads';
import { ConversionError } from './errors.js';

export async function runConversion(buffer, extension, signal, { timeout = 30000, workerUrl = new URL('./conversion-worker.js', import.meta.url) } = {}) {
  if (signal?.aborted) throw new ConversionError('Konversi dibatalkan.', 499);
  const worker = new Worker(workerUrl, {
    workerData: { buffer, extension },
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  let timer;
  let abort;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new ConversionError('Konversi melewati batas 30 detik. Coba file yang lebih kecil atau lebih sederhana.', 408)), timeout);
      abort = () => reject(new ConversionError('Konversi dibatalkan.', 499));
      signal?.addEventListener('abort', abort, { once: true });
      worker.once('message', message => {
        if (message.error) reject(new ConversionError(message.error.message, message.error.status));
        else resolve(message.result);
      });
      worker.once('error', () => reject(new ConversionError('Dokumen terlalu kompleks atau proses konversi gagal. Coba file yang lebih sederhana.')));
      worker.once('exit', () => reject(new ConversionError('Proses konversi berhenti sebelum selesai.')));
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    await worker.terminate();
  }
}
