export const MAX_EDITOR_BYTES = 5 * 1024 * 1024;

export function wrapSelection(text, start, end, before, after = before, placeholder = 'teks') {
  const selection = text.slice(start, end) || placeholder;
  if (start >= before.length && text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after) {
    return { text: text.slice(0, start - before.length) + selection + text.slice(end + after.length), start: start - before.length, end: start - before.length + selection.length };
  }
  return { text: text.slice(0, start) + before + selection + after + text.slice(end), start: start + before.length, end: start + before.length + selection.length };
}

export function prefixLines(text, start, end, kind) {
  const from = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  let to = text.indexOf('\n', end);
  if (end > start && text[end - 1] === '\n') to = end - 1;
  if (to < 0) to = text.length;
  const rows = text.slice(from, to).split('\n');
  const transformed = rows.map((row, index) => {
    if (kind === 'indent') return '  ' + row;
    if (kind === 'outdent') return row.replace(/^( {1,2}|\t)/, '');
    if (kind === 'quote') return '> ' + row.replace(/^>\s?/, '');
    const clean = row.replace(/^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/, '');
    const prefix = kind === 'bullet' ? '- ' : kind === 'ordered' ? `${index + 1}. ` : kind === 'task' ? '- [ ] ' : kind === 'paragraph' ? '' : `${'#'.repeat(Number(kind))} `;
    return prefix + clean;
  }).join('\n');
  return { text: text.slice(0, from) + transformed + text.slice(to), start: from, end: from + transformed.length };
}

export function makeTable(rows, columns) {
  rows = Math.min(30, Math.max(1, Math.trunc(Number(rows)) || 3));
  columns = Math.min(12, Math.max(1, Math.trunc(Number(columns)) || 3));
  return '| ' + Array.from({ length: columns }, (_, i) => `Kolom ${i + 1}`).join(' | ') + ' |\n' +
    '| ' + Array(columns).fill('---').join(' | ') + ' |\n' +
    Array.from({ length: rows }, () => '| ' + Array(columns).fill('Isi').join(' | ') + ' |').join('\n');
}

export function findMatches(text, query, caseSensitive = false) {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
  return Array.from(text.matchAll(pattern), match => ({ start: match.index, end: match.index + match[0].length }));
}

export function replaceMatches(text, matches, replacement) {
  let cursor = 0;
  const parts = [];
  for (const match of matches) {
    parts.push(text.slice(cursor, match.start), replacement);
    cursor = match.end;
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}

export class EditHistory {
  constructor(initial) { this.entries = [initial]; this.index = 0; }
  push(snapshot) {
    if (this.entries[this.index].text === snapshot.text) { this.entries[this.index] = snapshot; return; }
    this.entries.splice(this.index + 1);
    this.entries.push(snapshot);
    let size = this.entries.reduce((total, entry) => total + entry.text.length * 2, 0);
    while (this.entries.length > 2 && (this.entries.length > 100 || size > 16 * 1024 * 1024)) size -= this.entries.shift().text.length * 2;
    this.index = this.entries.length - 1;
  }
  undo() { if (this.index > 0) return this.entries[--this.index]; }
  redo() { if (this.index < this.entries.length - 1) return this.entries[++this.index]; }
}
