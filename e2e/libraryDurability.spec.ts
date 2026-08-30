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
    await page.goto('/app.html');

    const report = await page.evaluate(async () => {
      const harness = await import('/src/library/durabilityHarness.ts');
      return harness.runDurabilityBrowserHarness();
    });

    expect(report.passed, report.failure ?? 'The durability harness failed.').toBe(true);
    expect(report.phaseCount).toBeGreaterThan(0);
    expect(report.cases.every((testCase) => testCase.passed)).toBe(true);
  });

  test('reconciles unchanged, restored, changed, moved, missing, new, and ambiguous Sources', async ({
    page,
  }) => {
    await page.goto('/app.html');
    const report = await page.evaluate(async () => {
      const harness = await import('/src/library/reconciliationHarness.ts');
      return harness.runReconciliationBrowserHarness();
    });
    expect(report.ambiguousBeforeChoice).toBe(1);
    expect(report.chosenStatePreserved).toBe(true);
    expect(report.summary).toMatchObject({
      changed: 1,
      moved: 1,
      new: 2,
      restored: 1,
      unchanged: 1,
    });
  });

  test('renders two to four bounded derivatives from a controlled high-resolution Source', async ({
    page,
  }) => {
    await page.goto('/app.html');
    const report = await page.evaluate(async () => {
      const harness = await import('/src/library/comparisonHarness.ts');
      return await harness.runComparisonBrowserHarness();
    });
    expect(report.sourceDimensions).toEqual({ height: 5_625, width: 8_000 });
    expect(report.paneCounts).toEqual([2, 3, 4]);
    expect(report.admittedDerivativeBytes).toBe(4_608_000);
    expect(report.resolutionLimited).toBe(true);
    expect(report.fallbackLabel).toBe('Resolution limited · Fit');
    expect(report.disposed).toBeGreaterThan(1);
    expect(report.focalPoint).toEqual({ x: 0.82, y: 0.21 });
    expect(report.mapped.x).toBeGreaterThanOrEqual(0);
    expect(report.mapped.x).toBeLessThanOrEqual(1);
  });
});
