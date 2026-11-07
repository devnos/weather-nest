(() => {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('weather-nest-theme'); } catch {}
  if (!['light', 'dark'].includes(preference)) preference = null;
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#151e1a' : '#f5f4ef';
    const button = document.getElementById('theme-toggle');
    if (button) {
      const label = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    }
  }
  apply(preference || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', event => { if (!preference) apply(event.matches ? 'dark' : 'light'); });
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(preference);
      try { localStorage.setItem('weather-nest-theme', preference); } catch {}
    });
  });
})();
