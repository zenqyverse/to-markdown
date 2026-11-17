export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const FORMATS = {
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  html: ['text/html'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  csv: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
};

export function extensionOf(name) {
  return name.toLowerCase().split('.').pop();
}

// Browser/OS MIME declarations are only an initial filter. Server checks content too.
export function validateFile({ name, size, type }) {
  const extension = extensionOf(name);
  if (!Object.hasOwn(FORMATS, extension)) return 'Format tidak didukung. Pilih DOCX, PDF, TXT, HTML, XLSX, atau CSV.';
  if (size > MAX_FILE_SIZE) return 'File terlalu besar. Ukuran maksimum adalah 10 MB (10.485.760 byte).';
  if (size === 0) return 'File kosong. Pilih file yang memiliki isi.';
  const mime = (type || '').split(';')[0].trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream' && !FORMATS[extension].includes(mime)) {
    return 'Tipe file tidak sesuai dengan ekstensinya. Ekspor ulang dokumen dengan format yang benar.';
  }
  return null;
}
