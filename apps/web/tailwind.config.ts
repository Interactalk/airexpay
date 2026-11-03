import type { Config } from 'tailwindcss';
import airexpay from '../../design/tailwind.theme.ts';

export default {
  presets: [airexpay],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        desk: '761px',
        checkout: '900px',
      },
    },
  },
} satisfies Config;
