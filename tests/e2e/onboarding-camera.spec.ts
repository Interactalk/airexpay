import { expect, test } from '@playwright/test';

test('allows the camera and shows the guide frame', async ({ page }) => {
  await page.goto('/onboarding/preview/identity');
  await page.getByTestId('camera-start').first().click();
  await expect(page.getByTestId('camera-video').first()).toBeVisible();
  await expect(page.getByTestId('camera-error')).toHaveCount(0);
  await expect(page.locator('.guide-frame').first()).toBeVisible();
});

test('denies the camera and offers a file instead', async ({ page }) => {
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    if (!devices) return;
    devices.getUserMedia = () =>
      Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  await page.goto('/onboarding/preview/identity');
  await page.getByTestId('camera-start').first().click();
  await expect(page.getByTestId('camera-error').first()).toContainText('Camera access was denied');
  await expect(page.getByText('You can upload a file instead.').first()).toBeVisible();
});
