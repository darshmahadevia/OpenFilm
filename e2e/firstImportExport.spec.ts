import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has no automated accessibility violations on the Library start state', async ({ page }) => {
  await page.goto('/app.html');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('ships the workstation without legacy product paths', async ({ page }) => {
  await page.goto('/app.html');
  await expect(page.getByRole('heading', { name: 'Open a Library' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sample/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /choose a photo/i })).toHaveCount(0);
  await expect(page.getByText(/no account or upload/i)).toBeVisible();
});

test('keeps the multiline Library heading from overlapping', async ({ page }) => {
  await page.goto('/app.html');
  const heading = page.getByRole('heading', { name: 'Open a Library' });
  const metrics = await heading.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });

  expect(metrics.lineHeight / metrics.fontSize).toBeGreaterThanOrEqual(1.05);
});

test('stays within the viewport at wide, medium, and 200 percent zoom widths', async ({ page }) => {
  await page.goto('/app.html');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 720, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBe(dimensions.client);
    await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
  }
});

test('removes nonessential motion without hiding state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app.html');
  const style = await page.getByRole('button', { name: 'Open folder' }).evaluate((button) => {
    const computed = getComputedStyle(button);
    return {
      animationDuration: computed.animationDuration,
      transitionDuration: computed.transitionDuration,
    };
  });
  expect(Number.parseFloat(style.animationDuration)).toBeLessThanOrEqual(0.00001);
  expect(Number.parseFloat(style.transitionDuration)).toBeLessThanOrEqual(0.00001);
});
