import { expect, test } from '@playwright/test';

test.describe('release visual evidence', () => {
  test.skip(
    !process.env.OPENFILM_CAPTURE_EVIDENCE,
    'Set OPENFILM_CAPTURE_EVIDENCE=1 to update tracked release screenshots.',
  );

  test('captures wide, medium, and 200 percent zoom workstation layouts', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => navigator.storage.getDirectory(),
      });
    });
    await page.goto('/');
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      try {
        await root.removeEntry('.openfilm', { recursive: true });
      } catch {
        /* Empty fixture. */
      }
      const paths = [
        '/src/assets/openfilm-sample-alpine-lake.webp',
        '/src/assets/openfilm-comparison-street.webp',
        '/src/assets/openfilm-closing-coast.webp',
        '/src/assets/openfilm-landing-coastal-valley.webp',
      ];
      for (let index = 0; index < paths.length; index += 1) {
        const response = await fetch(paths[index]);
        const handle = await root.getFileHandle(`release-${index + 1}.webp`, { create: true });
        const writable = await handle.createWritable();
        await writable.write(await response.arrayBuffer());
        await writable.close();
      }
    });
    await page.getByRole('button', { name: 'Open folder' }).click();
    await expect(page.getByLabel('Background jobs: complete')).toBeVisible();
    await expect(page.locator('.library-grid__image').first()).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'docs/screenshots/openfilm-workstation-wide.png' });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: 'docs/screenshots/openfilm-workstation-medium.png' });
    await page.setViewportSize({ width: 720, height: 800 });
    await page.screenshot({ path: 'docs/screenshots/openfilm-workstation-200-percent-zoom.png' });
  });
});
