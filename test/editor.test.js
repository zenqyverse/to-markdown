import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapSelection, prefixLines, findMatches, replaceMatches, makeTable, EditHistory } from '../public/editor-core.js';
import { mathExtension } from '../public/editor-renderer.js';
import { Marked } from 'marked';

test('format and toggle selected text without losing surrounding content', () => {
  assert.deepEqual(wrapSelection('Halo dunia!', 5, 10, '**'), { text: 'Halo **dunia**!', start: 7, end: 12 });
  assert.deepEqual(wrapSelection('Halo **dunia**!', 7, 12, '**'), { text: 'Halo dunia!', start: 5, end: 10 });
  assert.deepEqual(wrapSelection('', 0, 0, '*'), { text: '*teks*', start: 1, end: 5 });
});
test('line formatting preserves unselected lines and handles trailing newlines', () => {
  assert.equal(prefixLines('Satu\nDua\nTiga', 0, 9, 'ordered').text, '1. Satu\n2. Dua\nTiga');
  assert.equal(prefixLines('## Judul\nTeks', 0, 8, '1').text, '# Judul\nTeks');
  assert.equal(prefixLines('- [x] Selesai', 0, 13, 'bullet').text, '- Selesai');
  assert.equal(prefixLines('  kode\n\tbaris', 0, 13, 'outdent').text, 'kode\nbaris');
});
test('search treats regex punctuation literally and preserves Unicode indices', () => {
  assert.deepEqual(findMatches('A.b a.b axb', 'a.b'), [{ start: 0, end: 3 }, { start: 4, end: 7 }]);
  assert.deepEqual(findMatches('A a', 'a', true), [{ start: 2, end: 3 }]);
  assert.deepEqual(findMatches('İ X', 'X'), [{ start: 2, end: 3 }]);
  assert.deepEqual(findMatches('any', ''), []);
  assert.deepEqual(findMatches('[x] \\', '[x]'), [{ start: 0, end: 3 }]);
});
test('replace-all uses literal replacements and can be undone in one snapshot', () => {
  const text = 'kata dan kata';
  const replaced = replaceMatches(text, findMatches(text, 'kata'), '$&');
  assert.equal(replaced, '$& dan $&');
  const history = new EditHistory({ text, start: 0, end: 0 });
  history.push({ text: replaced, start: 0, end: 0 });
  assert.equal(history.undo().text, text);
  assert.equal(history.redo().text, replaced);
  history.undo(); history.push({ text: 'baru', start: 0, end: 0 });
  assert.equal(history.redo(), undefined);
});
test('table builder includes a header and caps requested dimensions', () => {
  assert.equal(makeTable(2, 2), '| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Isi | Isi |\n| Isi | Isi |');
  assert.equal(makeTable(500, 100).split('\n').length, 32);
  assert.equal(makeTable(1, 100).split('\n')[0].split('|').length, 14);
});
test('history is bounded and unchanged checkpoints preserve redo', () => {
  const history = new EditHistory({ text: '', start: 0, end: 0 });
  for (let i = 0; i < 120; i++) history.push({ text: String(i), start: 0, end: 0 });
  assert.equal(history.entries.length, 100);
  const before = history.undo();
  history.push(before);
  assert.equal(history.redo().text, '119');
});

test('math tokens preserve inline paragraphs and do not interpret fenced code as formulas', () => {
  const tokens = [];
  const parser = new Marked({ extensions: [true, false].map(display => ({ ...mathExtension(display), renderer(token) { tokens.push(token); return display ? '<div>MATH</div>' : '<span>MATH</span>'; } })) });
  const output = parser.parse('Energi $E = mc^2$ dalam kalimat.\n\n$$\n\\frac{1}{2}\n$$\n\n```text\n$not_math$\n```');
  assert.match(output, /<p>Energi <span>MATH<\/span> dalam kalimat\.<\/p>/);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].math, 'E = mc^2');
  assert.match(output, /\$not_math\$/);
});
