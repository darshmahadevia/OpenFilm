import { expect, test } from '@playwright/test';

test.describe('Library-file durability gate', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'The durability harness runs from Vite source modules.',
  );
  test.setTimeout(120_000);

  test('recovers a verified revision after interruption at every Chromium commit phase', async ({
    page,
  }) => {
    await page.goto('/');

    const report = await page.evaluate(async () => {
      const harness = await import('/src/library/durabilityHarness.ts');
      return harness.runDurabilityBrowserHarness();
    });

    expect(report.passed, report.failure ?? 'The durability harness failed.').toBe(true);
    expect(report.phaseCount).toBeGreaterThan(0);
    expect(report.cases.every((testCase) => testCase.passed)).toBe(true);
  });
});
