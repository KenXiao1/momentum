// Applies the saved or system theme before first paint. It is a file rather
// than an inline script so the web and Tauri CSPs can keep script-src 'self'.
(() => {
  const root = document.documentElement;

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  let isDark = prefersDark;
  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') isDark = true;
    else if (storedTheme === 'light') isDark = false;
  } catch {
    // Ignore storage access errors and fallback to system preference.
  }

  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
})();
