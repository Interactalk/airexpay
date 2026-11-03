// AirExpay Tailwind preset. Usage in apps/web/tailwind.config.ts:
//   import airexpay from './tailwind.theme'; export default { presets: [airexpay], content: [...] }
// Requires tokens.css to be imported (defines :root and .dark variables).
import type { Config } from 'tailwindcss';

const hsl = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;
const statuses = ['waiting', 'confirming', 'paid', 'underpaid', 'expired', 'failed', 'refunded'] as const;

const statusColors = Object.fromEntries(
  statuses.map((s) => [s, { DEFAULT: hsl(`status-${s}`), foreground: hsl(`status-${s}-fg`), border: hsl(`status-${s}-border`) }]),
);

const preset = {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        background: hsl('background'),
        foreground: hsl('foreground'),
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        popover: { DEFAULT: hsl('popover'), foreground: hsl('popover-foreground') },
        status: statusColors,
        sim: { DEFAULT: hsl('sim'), foreground: hsl('sim-fg'), border: hsl('sim-border') },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }],
        '4xl': ['2.5rem', { lineHeight: '2.875rem', letterSpacing: '-0.02em' }],
        '5xl': ['3.5rem', { lineHeight: '3.85rem', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        xl: 'var(--radius-xl)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      spacing: { sidebar: 'var(--sidebar-width)' },
      maxWidth: { content: 'var(--content-max)' },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default preset;
