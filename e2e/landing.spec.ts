import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('desktop download landing page', () => {
  test('states the product boundary and links to both desktop releases', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Review the whole shoot. Keep every photograph local.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download for macOS' }).first()).toHaveAttribute(
      'href',
      /releases\/latest\/download\/OpenFilm\.dmg$/,
    );
    await expect(page.getByRole('link', { name: 'Download for Windows' }).first()).toHaveAttribute(
      'href',
      /releases\/latest\/download\/OpenFilm-Setup\.exe$/,
    );
    await expect(
      page.getByText(/contacts GitHub Releases only to check for updates/i),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('shows the coming-soon view inside phone and tablet viewports', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
      await expect(page.getByRole('heading', { name: 'Coming soon.' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Follow the project' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Download OpenFilm for macOS' })).toBeHidden();
      await expect(page.getByRole('link', { name: 'Download OpenFilm for Windows' })).toBeHidden();

      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    }
  });
});
