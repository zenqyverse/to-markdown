export function renderMarkdown(text, target) {
  target.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true }), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'audio', 'video', 'source', 'iframe', 'form', 'style'],
    FORBID_ATTR: ['style'],
  });
  for (const input of target.querySelectorAll('input')) {
    if (input.type !== 'checkbox') input.remove();
    else input.disabled = true;
  }
  for (const link of target.querySelectorAll('a')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
}

export function downloadText(text, filename, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
