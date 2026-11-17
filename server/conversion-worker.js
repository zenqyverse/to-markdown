import { parentPort, workerData } from 'node:worker_threads';
import { convert } from './converters.js';

const buffer = Buffer.from(workerData.buffer);
try {
  parentPort.postMessage({ result: await convert(buffer, workerData.extension) });
} catch (error) {
  parentPort.postMessage({ error: {
    message: error.name === 'ConversionError' ? error.message : 'File rusak atau tidak dapat dibaca. Coba buka dan ekspor ulang dokumen asli.',
    status: error.name === 'ConversionError' ? error.status : 422,
  } });
} finally {
  buffer.fill(0);
  workerData.buffer.fill(0);
}
