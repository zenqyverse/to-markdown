import { ConversionError } from './errors.js';
import { decodeText, validateOffice } from './validate-content.js';

const MAX_OUTPUT = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_CELLS = 100000;

async function htmlToMarkdown(html) {
  const [{ default: TurndownService }, { gfm }, { default: sanitizeHtml }] = await Promise.all([
    import('turndown'), import('turndown-plugin-gfm'), import('sanitize-html'),
  ]);
  const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['del', 's']),
    allowedAttributes: { a: ['href', 'title'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  turndown.use(gfm);
  return turndown.turndown(clean);
}

function escapeCell(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\').replace(/([|`*_\[\]])/g, '\\$1').replace(/\r\n?|\n/g, '<br>');
}

function toTable(rows) {
  if (!rows.length) return '';
  const width = Math.max(...rows.map(row => row.length));
  if (rows.length > MAX_ROWS || width > 200 || width * rows.length > MAX_CELLS) {
    throw new ConversionError('Tabel terlalu besar. Batas: 10.000 baris, 200 kolom, dan 100.000 sel.');
  }
  const line = row => '| ' + Array.from({ length: width }, (_, i) => escapeCell(row[i])).join(' | ') + ' |';
  return [line(rows[0]), '| ' + Array(width).fill('---').join(' | ') + ' |', ...rows.slice(1).map(line)].join('\n');
}

async function pdfToMarkdown(buffer) {
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new ConversionError('Isi file bukan PDF yang valid.');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
  try {
    const document = await task.promise;
    if (document.numPages > 200) throw new ConversionError('PDF terlalu panjang. Maksimum 200 halaman per file.');
    const pages = [];
    let textSize = 0;
    let emptyPages = 0;
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      let text = '';
      let previousY;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (previousY !== undefined && Math.abs(y - previousY) > 3 && !text.endsWith('\n')) text += '\n';
        text += item.str + (item.hasEOL ? '\n' : ' ');
        previousY = y;
      }
      text = text.trim();
      textSize += Buffer.byteLength(text);
      if (textSize > MAX_OUTPUT) throw new ConversionError('Hasil konversi melebihi batas 5 MB.');
      if (!text) emptyPages++;
      pages.push('## Halaman ' + index + '\n\n' + (text || '_Tidak ada teks yang dapat diekstrak._'));
      page.cleanup();
    }
    if (emptyPages === document.numPages) throw new ConversionError('PDF tidak memiliki teks yang dapat diekstrak. PDF hasil scan memerlukan OCR, yang belum tersedia.');
    return { markdown: pages.join('\n\n---\n\n'), warnings: [
      'PDF diekstrak sebagai teks per halaman. Tata letak, tabel, dan gambar mungkin tidak terpelihara.',
      ...(emptyPages ? [`${emptyPages} halaman tidak memiliki teks. Konten scan memerlukan OCR.`] : []),
    ] };
  } catch (error) {
    if (error.name === 'PasswordException') throw new ConversionError('PDF dilindungi kata sandi. Buka proteksinya terlebih dahulu.');
    throw error;
  } finally {
    await task.destroy();
  }
}

export async function convert(buffer, extension) {
  let markdown = '';
  let warnings = [];
  switch (extension) {
    case 'docx': {
      await validateOffice(buffer, extension);
      const { default: mammoth } = await import('mammoth');
      let hasImages = false;
      const result = await mammoth.convertToHtml({ buffer }, {
        includeEmbeddedStyleMap: false,
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(() => { hasImages = true; return { src: '', alt: 'Gambar dihilangkan' }; }),
      });
      markdown = await htmlToMarkdown(result.value);
      if (hasImages) warnings.push('Gambar DOCX tidak disertakan dalam hasil Markdown.');
      if (result.messages.length) warnings.push('Sebagian format DOCX tidak dikenali dan telah disederhanakan.');
      break;
    }
    case 'pdf': ({ markdown, warnings } = await pdfToMarkdown(buffer)); break;
    case 'txt': markdown = decodeText(buffer); break;
    case 'html': {
      const text = decodeText(buffer);
      if (!/<(?:!doctype\s+html|[a-z][\w:-]*(?:\s[^<>]*|\s*)\/?>)/i.test(text)) {
        throw new ConversionError('Isi file HTML tidak memiliki tag HTML yang valid.');
      }
      markdown = await htmlToMarkdown(text);
      warnings.push('Skrip, gaya, formulir, iframe, dan gambar HTML dihilangkan.');
      break;
    }
    case 'csv': {
      const { parse } = await import('csv-parse/sync');
      const text = decodeText(buffer);
      // Detect common separators by parsing complete quoted records. Do not
      // split on a delimiter inside a quoted value.
      const candidates = [',', ';', '\t'].map(delimiter => {
        try {
          const sample = parse(text, { delimiter, bom: true, skip_empty_lines: true, relax_column_count: true, to: 10, max_record_size: 1024 * 1024 });
          return { delimiter, width: sample[0]?.length || 0 };
        } catch { return { delimiter, width: -1 }; }
      }).sort((a, b) => b.width - a.width);
      const rows = parse(text, { delimiter: candidates[0].delimiter, bom: true, skip_empty_lines: true, max_record_size: 1024 * 1024, to: MAX_ROWS + 1 });
      markdown = toTable(rows);
      warnings.push('Baris pertama digunakan sebagai header tabel.');
      break;
    }
    case 'xlsx': {
      await validateOffice(buffer, extension);
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheets = [];
      let cellCount = 0;
      let rowCount = 0;
      for (const sheet of workbook.worksheets) {
        if (sheet.rowCount > MAX_ROWS || sheet.columnCount > 200) throw new ConversionError('Sheet terlalu besar. Maksimum 10.000 baris dan 200 kolom.');
        const rows = [];
        sheet.eachRow(row => {
          const values = Array.from({ length: sheet.columnCount }, (_, i) => row.getCell(i + 1).text);
          rows.push(values);
          rowCount++;
          cellCount += values.length;
          if (cellCount > MAX_CELLS || rowCount > MAX_ROWS) throw new ConversionError('Workbook terlalu besar. Maksimum 10.000 baris dan 100.000 sel secara keseluruhan.');
        });
        if (rows.length) sheets.push('## ' + escapeCell(sheet.name) + '\n\n' + toTable(rows));
      }
      markdown = sheets.join('\n\n');
      warnings.push('Setiap sheet menjadi tabel; baris pertama menjadi header. Rumus memakai nilai tersimpan dan tidak dihitung ulang. Gaya, grafik, dan sel gabungan disederhanakan.');
      break;
    }
    default: throw new ConversionError('Format tidak didukung.', 415);
  }
  if (!markdown.trim()) throw new ConversionError('Dokumen tidak memiliki konten yang dapat dikonversi.');
  if (Buffer.byteLength(markdown) > MAX_OUTPUT) throw new ConversionError('Hasil konversi melebihi batas 5 MB. Coba dokumen yang lebih kecil.');
  return { markdown: markdown.trimEnd() + '\n', warnings };
}
