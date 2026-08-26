import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('browser landing page', () => {
  test('states the product boundary and opens the browser workstation', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Review the whole shoot. Keep every photograph local.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open OpenFilm' }).first()).toHaveAttribute(
      'href',
      '/app.html',
    );
    await expect(
      page.getByText(/no account system, application backend, analytics, or upload path/i),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('marks the workstation as coming soon on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByText('Coming soon', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open OpenFilm' }).first()).toBeHidden();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
