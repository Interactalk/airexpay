import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command:
      'pnpm --filter @airexpay/web build && pnpm --filter @airexpay/web preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /onboarding-camera/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: /onboarding-camera/,
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'camera-allow',
      testMatch: /onboarding-camera/,
      grep: /allows the camera/,
      use: {
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
    {
      name: 'camera-deny',
      testMatch: /onboarding-camera/,
      grep: /denies the camera/,
      use: {
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts'],
        },
      },
    },
  ],
});
