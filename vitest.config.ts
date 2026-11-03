import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@airexpay/shared': path.resolve('packages/shared/src/index.ts'),
      '@airexpay/validation': path.resolve('packages/validation/src/index.ts'),
      '@airexpay/payment-core': path.resolve('packages/payment-core/src/index.ts'),
      '@airexpay/configuration': path.resolve('packages/configuration/src/index.ts'),
    },
  },
});
