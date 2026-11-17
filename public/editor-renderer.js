let diagramSequence = 0;
let mermaidPromise;

export function mathExtension(display) {
  return {
    name: display ? 'blockMath' : 'inlineMath', level: display ? 'block' : 'inline',
    start(source) {
      if (display) { const match = /^(?:\$\$|\\\[)/m.exec(source); return match?.index; }
      const indexes = [source.indexOf('$'), source.indexOf('\\(')].filter(i => i >= 0);
      return indexes.length ? Math.min(...indexes) : undefined;
    },
    tokenizer(source) {
      const match = display
        ? /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])(?:[ \t]*\n|$)/.exec(source)
        : /^(?:\$(?!\$)([^$\n]+?)\$(?!\$)|\\\(([^\n]+?)\\\))/.exec(source);
      if (match) return { type: display ? 'blockMath' : 'inlineMath', raw: match[0], math: match[1] ?? match[2], display };
    },
  };
}

export async function renderEditorMarkdown(text, target, isCurrent) {
  const math = [];
  const parser = new marked.Marked({ gfm: true, extensions: [true, false].map(display => ({
    ...mathExtension(display),
    renderer(token) {
      const index = math.push(token) - 1;
      return `<${display ? 'div' : 'span'} data-editor-math="${index}"></${display ? 'div' : 'span'}>`;
    },
  })) });
  const previousScroll = target.scrollTop;
  target.innerHTML = DOMPurify.sanitize(parser.parse(text), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'audio', 'video', 'source', 'iframe', 'form', 'style'], FORBID_ATTR: ['style'],
  });
  for (const input of target.querySelectorAll('input')) { if (input.type !== 'checkbox') input.remove(); else input.disabled = true; }
  for (const link of target.querySelectorAll('a')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  target.scrollTop = previousScroll;
  const headings = [...target.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading, index) => {
    heading.id = `editor-section-${index}`;
    return { id: heading.id, level: Number(heading.tagName[1]), text: heading.textContent };
  });
  const errors = [];
  if (math.length) {
    try {
      const { default: katex } = await import('/vendor/katex/katex.mjs');
      if (!isCurrent()) return { headings, errors };
      for (const element of target.querySelectorAll('[data-editor-math]')) {
        const token = math[Number(element.dataset.editorMath)];
        if (!token) continue;
        try { katex.render(token.math, element, { displayMode: token.display, throwOnError: true, trust: false, maxExpand: 100, maxSize: 20, strict: 'ignore' }); }
        catch { element.textContent = token.math; element.className = 'render-error'; errors.push('Rumus tidak valid; periksa sintaks LaTeX.'); }
      }
    } catch { errors.push('Library rumus belum dapat dimuat. Muat ulang halaman setelah server siap.'); }
  }
  const codeBlocks = [...target.querySelectorAll('pre > code')];
  if (codeBlocks.some(block => !block.classList.contains('language-mermaid'))) {
    try {
      const { default: hljs } = await import('/vendor/highlight/es/highlight.min.js');
      if (!isCurrent()) return { headings, errors };
      for (const block of codeBlocks) {
        const language = [...block.classList].find(name => name.startsWith('language-'))?.slice(9);
        if (language && language !== 'mermaid' && hljs.getLanguage(language)) hljs.highlightElement(block);
      }
    } catch { errors.push('Penyorotan sintaks belum dapat dimuat. Kode tetap ditampilkan.'); }
  }
  const diagrams = codeBlocks.filter(block => block.classList.contains('language-mermaid'));
  if (diagrams.length) {
    try {
      mermaidPromise ||= import('/vendor/mermaid/mermaid.esm.min.mjs').then(({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, maxTextSize: 20000, maxEdges: 250, htmlLabels: false, flowchart: { htmlLabels: false }, theme: 'neutral' });
        return mermaid;
      }).catch(error => { mermaidPromise = null; throw error; });
      const mermaid = await mermaidPromise;
      for (const [index, block] of diagrams.entries()) {
        if (!isCurrent()) return { headings, errors };
        if (index >= 10 || block.textContent.length > 20000) { errors.push('Pratinjau dibatasi 10 diagram dan 20.000 karakter per diagram. Kode lengkap tetap tersimpan.'); break; }
        try {
          // Ignore per-document config. Keep the application's security and styling settings.
          const source = block.textContent.replace(/^\s*---[\s\S]*?\n---\s*\n/, '').replace(/%%\{[\s\S]*?\}%%/g, '');
          const { svg } = await mermaid.render(`editor-mermaid-${++diagramSequence}`, source);
          if (!isCurrent()) return { headings, errors };
          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-output';
          wrapper.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'image', 'script'] });
          block.parentElement.replaceWith(wrapper);
        } catch {
          if (!isCurrent()) return { headings, errors };
          const message = document.createElement('p');
          message.className = 'render-error';
          message.textContent = 'Diagram belum valid. Periksa sintaks Mermaid; kode tetap ditampilkan di bawah.';
          block.parentElement.before(message);
          errors.push('Ada diagram yang belum valid.');
        }
      }
    } catch { errors.push('Library diagram belum dapat dimuat. Kode diagram tetap tersedia.'); }
  }
  return { headings, errors: [...new Set(errors)] };
}
