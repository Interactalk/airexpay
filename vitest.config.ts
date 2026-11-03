import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'apps/web/src/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@airexpay/shared': path.resolve('packages/shared/src/index.ts'),
      '@airexpay/validation': path.resolve('packages/validation/src/index.ts'),
      '@airexpay/payment-core': path.resolve('packages/payment-core/src/index.ts'),
      '@airexpay/configuration': path.resolve('packages/configuration/src/index.ts'),
      '@airexpay/config': path.resolve('packages/config/src/index.ts'),
    },
  },
});
