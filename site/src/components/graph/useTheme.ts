import { useEffect, useState } from 'react';

/** Tracks the document theme ('light' | 'dark'), set on <html data-theme> by the
 *  layout's pre-paint init + the ThemeToggle. Canvas colours (background, label
 *  ink, dim nodes) aren't CSS — they have to be recomputed on every theme flip,
 *  so we watch the attribute and re-render. */
export function useTheme(): 'light' | 'dark' {
  const read = (): 'light' | 'dark' =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light';

  const [theme, setTheme] = useState<'light' | 'dark'>(read);

  useEffect(() => {
    const el = document.documentElement;
    setTheme(read());
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return theme;
}
