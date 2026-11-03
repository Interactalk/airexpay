import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';

export type ColorScheme = 'light' | 'dark';

interface ThemeValue {
  theme: ColorScheme;
  setTheme: (theme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemTheme(): ColorScheme {
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [fallback, setFallback] = useState<ColorScheme>(systemTheme);
  const requested = params.get('theme');
  const theme: ColorScheme = requested === 'dark' || requested === 'light' ? requested : fallback;

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme(next) {
        setFallback(next);
        if (requested === 'dark' || requested === 'light') {
          const nextParams = new URLSearchParams(params);
          nextParams.set('theme', next);
          setParams(nextParams, { replace: true });
        }
      },
    }),
    [params, requested, setParams, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('ThemeProvider is missing');
  }
  return value;
}

export function ThemeToggle({ className = 'btn btn-outline btn-sm' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={className}
      aria-pressed={theme === 'dark'}
      data-testid="theme-toggle"
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
