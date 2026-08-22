import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { sourcePhotographFixtures } from '../src/import/sourcePhotographFixtures';

const previewFixture = sourcePhotographFixtures[1];
const replacementFixture = sourcePhotographFixtures[2];

function fixtureFile(fixture: (typeof sourcePhotographFixtures)[number]) {
  return {
    buffer: Buffer.from(fixture.encodedBase64, 'base64'),
    mimeType: fixture.mimeType,
    name: fixture.fileName,
  };
}

test('imports, previews, resets, replaces, and downloads a JPEG', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('WebGL2 ready').first()).toBeVisible();

  const sourceInput = page.getByLabel('Choose source photograph');
  await sourceInput.setInputFiles(fixtureFile(previewFixture));

  await expect(page.getByRole('heading', { name: previewFixture.fileName })).toBeVisible();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();

  const exposure = page.getByRole('slider', { name: 'Exposure' });
  await expect(exposure).toBeEnabled();
  await expect(exposure).toHaveValue('0');
  await exposure.fill('0.5');
  await expect(exposure).toHaveValue('0.5');

  await page.getByRole('button', { name: 'Reset adjustments' }).click();
  await expect(exposure).toHaveValue('0');

  await exposure.fill('0.5');
  const dialogPromise = page.waitForEvent('dialog');
  const replacementPromise = sourceInput.setInputFiles(fixtureFile(replacementFixture));
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toContain('adjustment state will be reset');
  await dialog.accept();
  await replacementPromise;

  await expect(page.getByRole('heading', { name: replacementFixture.fileName })).toBeVisible();
  await expect(exposure).toHaveValue('0');

  const downloadButton = page.getByRole('button', { name: 'Download JPEG' });
  await expect(downloadButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('square-openfilm.jpg');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const bytes = await readFile(downloadPath as string);
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(bytes.length).toBeGreaterThan(100);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('tries the bundled sample and edits the core adjustments', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Try bundled sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  const values = {
    Contrast: '30',
    Exposure: '1.25',
    Fade: '25',
    Saturation: '40',
    Temperature: '20',
    Tint: '-15',
  } as const;

  for (const [label, value] of Object.entries(values)) {
    const slider = page.getByRole('slider', { name: label });
    const numericInput = page.getByRole('spinbutton', { name: `${label} value` });

    await expect(slider).toBeEnabled();
    await expect(numericInput).toBeEnabled();
    await numericInput.fill(value);
    await expect(slider).toHaveValue(value);
  }

  const fade = page.getByRole('slider', { name: 'Fade' });
  await fade.press('ArrowRight');
  await expect(page.getByRole('spinbutton', { name: 'Fade value' })).toHaveValue('26');

  await page.getByRole('button', { name: 'Reset Temperature' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Temperature value' })).toHaveValue('0');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Temperature value' })).toHaveValue('20');

  await page.getByRole('button', { name: 'Reset adjustments' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Exposure value' })).toHaveValue('0');
  await expect(page.getByRole('spinbutton', { name: 'Fade value' })).toHaveValue('0');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Exposure value' })).toHaveValue('1.25');
  await expect(page.getByRole('spinbutton', { name: 'Fade value' })).toHaveValue('26');
});

test('keeps the adjustment controls labeled and usable at a phone width', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try bundled sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  for (const label of [
    'Exposure',
    'Contrast',
    'Temperature',
    'Tint',
    'Saturation',
    'Fade',
    'Vignette amount',
    'Vignette softness',
    'Grain amount',
    'Grain size',
  ]) {
    await expect(page.getByRole('slider', { name: label })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: `${label} value` })).toBeVisible();
  }

  await expect(page.getByRole('group', { name: 'RGB tone curve plot' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add tone curve point' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Input (x)' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Output (y)' })).toBeVisible();

  const accessibilitySnapshot = await page.evaluate(() => ({
    controlsWithoutNames: Array.from(document.querySelectorAll('button, input, select')).filter(
      (element) => {
        const label = element.getAttribute('aria-label');
        const labelledBy = element.getAttribute('aria-labelledby');
        const text = element.textContent?.trim();
        const associatedLabel = element.id
          ? document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim()
          : undefined;

        return !label && !labelledBy && !text && !associatedLabel;
      },
    ).length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));

  expect(accessibilitySnapshot.controlsWithoutNames).toBe(0);
  expect(accessibilitySnapshot.horizontalOverflow).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test('edits the bounded RGB tone curve with numeric and keyboard controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try bundled sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  await expect(page.getByText('2 / 8 points')).toBeVisible();
  await page.getByRole('button', { name: 'Add tone curve point' }).click();
  await expect(page.getByText('3 / 8 points')).toBeVisible();

  const input = page.getByRole('spinbutton', { name: 'Input (x)' });
  const output = page.getByRole('spinbutton', { name: 'Output (y)' });
  await expect(input).toHaveValue('0.50');
  await expect(output).toHaveValue('0.50');

  const plot = page.getByRole('group', { name: 'RGB tone curve plot' });
  const plotBox = await plot.boundingBox();
  const pointBox = await page
    .getByRole('button', { name: /Tone curve point 2, input 0\.50, output 0\.50/ })
    .boundingBox();
  expect(plotBox).not.toBeNull();
  expect(pointBox).not.toBeNull();
  await page.mouse.move(pointBox!.x + pointBox!.width / 2, pointBox!.y + pointBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(plotBox!.x + plotBox!.width * 0.35, plotBox!.y + plotBox!.height * 0.25);
  await page.mouse.up();
  await expect(input).toHaveValue('0.35');
  await expect(output).toHaveValue('0.75');

  await input.fill('0.25');
  await expect(input).toHaveValue('0.25');
  const selectedPoint = page.getByRole('button', {
    name: /Tone curve point 2, input 0\.25, output 0\.75/,
  });
  await selectedPoint.press('ArrowUp');
  await expect(output).toHaveValue('0.76');

  await page.getByRole('button', { name: 'Remove selected tone curve point' }).click();
  await expect(page.getByText('2 / 8 points')).toBeVisible();
});

test('edits deterministic vignette and grain effects with group reset history', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try bundled sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  const values = {
    'Vignette amount': '65',
    'Vignette softness': '80',
    'Grain amount': '35',
    'Grain size': '22',
  } as const;

  for (const [label, value] of Object.entries(values)) {
    const numericInput = page.getByRole('spinbutton', { name: `${label} value` });
    await numericInput.fill(value);
    await expect(page.getByRole('slider', { name: label })).toHaveValue(value);
  }

  await page.getByRole('button', { name: 'Reset Vignette', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Vignette amount value' })).toHaveValue('0');
  await expect(page.getByRole('spinbutton', { name: 'Vignette softness value' })).toHaveValue('50');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Vignette amount value' })).toHaveValue('65');

  await page.getByRole('button', { name: 'Reset Grain', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Grain amount value' })).toHaveValue('0');
  await expect(page.getByRole('spinbutton', { name: 'Grain size value' })).toHaveValue('50');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Grain amount value' })).toHaveValue('35');
  await expect(page.getByRole('spinbutton', { name: 'Grain size value' })).toHaveValue('22');
});
