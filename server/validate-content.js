import yauzl from 'yauzl';
import { ConversionError } from './errors.js';

const MAX_EXPANDED_SIZE = 50 * 1024 * 1024;

// Read every ZIP stream with yauzl's size validation before handing Office files
// to a parser. No archive entries are extracted to disk.
export function validateOffice(buffer, extension) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(new ConversionError('File Office rusak atau bukan arsip DOCX/XLSX yang valid.'));
      const names = new Set();
      let declaredBytes = 0;
      let actualBytes = 0;
      let entryCount = 0;
      let failed = false;
      const fail = (message) => {
        if (failed) return;
        failed = true;
        zip.close();
        reject(new ConversionError(message));
      };
      zip.on('error', () => fail('Arsip Office rusak dan tidak dapat dibaca.'));
      zip.on('entry', (entry) => {
        names.add(entry.fileName);
        entryCount++;
        declaredBytes += entry.uncompressedSize;
        if (entryCount > 3000 || declaredBytes > MAX_EXPANDED_SIZE) {
          return fail('Dokumen terlalu kompleks: maksimum 3.000 entri dan 50 MB isi setelah dekompresi.');
        }
        if (entry.generalPurposeBitFlag & 1) return fail('Dokumen terenkripsi tidak didukung. Hapus kata sandinya terlebih dahulu.');
        if (entry.fileName.endsWith('/')) return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail('Isi arsip Office rusak.');
          stream.on('error', () => fail('Isi arsip Office rusak.'));
          stream.on('data', (chunk) => {
            actualBytes += chunk.length;
            if (actualBytes > MAX_EXPANDED_SIZE) {
              stream.destroy();
              fail('Isi dokumen setelah dekompresi melebihi 50 MB.');
            }
          });
          stream.on('end', () => { if (!failed) zip.readEntry(); });
        });
      });
      zip.on('end', () => {
        const required = extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
        if (!names.has('[Content_Types].xml') || !names.has(required)) {
          return fail('Isi file tidak sesuai dengan format ' + extension.toUpperCase() + '.');
        }
        if (!failed) resolve();
      });
      zip.readEntry();
    });
  });
}

export function decodeText(buffer) {
  let encoding = 'utf-8';
  if (buffer[0] === 0xff && buffer[1] === 0xfe) encoding = 'utf-16le';
  if (buffer[0] === 0xfe && buffer[1] === 0xff) encoding = 'utf-16be';
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    throw new ConversionError('Encoding teks tidak didukung atau file berisi data biner. Simpan sebagai UTF-8 atau UTF-16 dengan BOM.');
  }
  if (/[\u0000-\u0008\u000b\u000e-\u001f]/u.test(text)) {
    throw new ConversionError('Isi file bukan dokumen teks yang valid.');
  }
  return text.replace(/\r\n?/g, '\n');
}
