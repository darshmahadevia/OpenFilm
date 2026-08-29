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
    await page.goto('/app.html');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: '.impeccable/review/start-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      )
      .toEqual({ documentWidth: 390, viewportWidth: 390 });
    await page.screenshot({ path: '.impeccable/review/start-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
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
    await expect(page.locator('.library-grid__image')).toHaveCount(4);
    await expect
      .poll(() =>
        page.locator('.library-grid__image').evaluateAll((images) =>
          images.every((image) => {
            const element = image as HTMLImageElement;
            return element.complete && element.naturalWidth > 0;
          }),
        ),
      )
      .toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'docs/screenshots/openfilm-workstation-wide.png' });
    await page.screenshot({ path: '.impeccable/review/desktop.png' });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      )
      .toEqual({ documentWidth: 1440, viewportWidth: 1440 });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: 'docs/screenshots/openfilm-workstation-medium.png' });
    await page.screenshot({ path: '.impeccable/review/user-1024.png' });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      )
      .toEqual({ documentWidth: 1024, viewportWidth: 1024 });
    await page.setViewportSize({ width: 720, height: 800 });
    await page.screenshot({ path: 'docs/screenshots/openfilm-workstation-200-percent-zoom.png' });
    await page.screenshot({ path: '.impeccable/review/user-720.png' });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      )
      .toEqual({ documentWidth: 720, viewportWidth: 720 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })),
      )
      .toEqual({ documentWidth: 390, viewportWidth: 390 });
    await page.screenshot({ path: '.impeccable/review/mobile.png' });

    await page.setViewportSize({ width: 1440, height: 900 });
    const gridPhotographs = page.locator('.library-grid__photograph');
    await gridPhotographs.nth(0).click();
    await page.keyboard.press('Space');
    await gridPhotographs.nth(1).click();
    await page.keyboard.press('Space');
    await page.locator('.workstation-context-tools > summary').click();
    await page.screenshot({ path: '.impeccable/review/final-tools.png' });
    await page.getByRole('button', { name: 'Compare 2' }).click();
    await page.screenshot({ path: '.impeccable/review/final-comparison.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Loupe' }).click();
    await expect(page.getByText('Reading Source photograph.')).toHaveCount(0);
    await page.screenshot({ path: '.impeccable/review/final-loupe.png' });
    await page.locator('.workstation-context-tools > summary').click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.screenshot({ path: '.impeccable/review/final-edit.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.screenshot({ path: '.impeccable/review/final-export.png' });
  });

  test('captures the landing page at its representative widths', async ({ page }) => {
    for (const viewport of [
      { height: 900, name: 'desktop', width: 1440 },
      { height: 768, name: 'tablet', width: 1024 },
      { height: 800, name: 'zoom', width: 720 },
      { height: 844, name: 'mobile', width: 390 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect
        .poll(() =>
          page.evaluate(() => ({
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
          })),
        )
        .toEqual({ documentWidth: viewport.width, viewportWidth: viewport.width });
      await page.screenshot({
        fullPage: true,
        path: `.impeccable/review/final-landing-${viewport.name}.png`,
      });
    }
  });
});
