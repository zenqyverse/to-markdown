(() => {
  const key = 'to-markdown.theme.v1';
  let initial = 'dark';
  try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark') initial = saved; } catch {}
  function setTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch {}
    const button = document.getElementById('theme-toggle');
    if (button) {
      const next = theme === 'dark' ? 'terang' : 'gelap';
      button.replaceChildren(document.createTextNode(theme === 'dark' ? '☀ ' : '☾ '));
      const label = document.createElement('span'); label.textContent = 'Mode ' + next; button.append(label);
      button.setAttribute('aria-label', 'Aktifkan mode ' + next);
      button.title = 'Aktifkan mode ' + next + ' untuk seluruh aplikasi';
    }
    const editor = document.getElementById('editor-theme');
    if (editor) editor.value = theme;
    document.querySelector('.editor-shell')?.setAttribute('data-theme', theme);
  }
  document.documentElement.dataset.theme = initial;
  window.appTheme = { set: setTheme };
  document.addEventListener('DOMContentLoaded', () => {
    setTheme(document.documentElement.dataset.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  });
})();
