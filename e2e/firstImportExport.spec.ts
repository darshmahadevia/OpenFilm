import { readFile } from 'node:fs/promises';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { validPresetFixture } from '../src/editor/presets.fixtures';
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

async function openEditHistory(page: Page) {
  await page.getByRole('button', { name: 'Edit history' }).click();
}

async function openExport(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click();
}

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();

  expect(
    results.violations.map(({ id, impact, help, nodes }) => ({
      help,
      id,
      impact,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test('has no automated accessibility violations on the landing state', async ({ page }) => {
  await page.goto('/');
  await expectNoAccessibilityViolations(page);
});

test('has no automated accessibility violations in the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test('operates tabs and crop handles from the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();

  const adjustTab = page.getByRole('tab', { name: 'Adjust' });
  await adjustTab.focus();
  await adjustTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Geometry' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Geometry' })).toBeFocused();

  const topLeftHandle = page.getByRole('button', { name: 'Resize crop top left' });
  await topLeftHandle.focus();
  await topLeftHandle.press('ArrowRight');
  await expect(page.getByRole('spinbutton', { name: 'Crop left value' })).toHaveValue('1');
});

test('keeps dialog focus contained and restores it after Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  const helpButton = page.getByRole('button', { name: 'Open editor help' });
  await helpButton.click();
  const dialog = page.getByRole('dialog', { name: 'A quiet place to edit' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(helpButton).toBeFocused();
});

test('introduces the product before revealing editor controls', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'A quieter room for your photographs.' }),
  ).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Geometry' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Preview before and after' })).toBeVisible();

  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await page.getByRole('tab', { name: 'Adjust' }).click();
  await expect(page.getByRole('slider', { name: 'Exposure' })).toBeVisible();
});

test('keeps useful state changes while removing nonessential motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const motionStyles = await page
    .getByRole('button', { name: 'Choose a photograph' })
    .first()
    .evaluate((button) => {
      const styles = getComputedStyle(button);
      return {
        animationDuration: styles.animationDuration,
        transition: styles.transition,
      };
    });

  expect(motionStyles).toEqual({ animationDuration: '0s', transition: 'none' });
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
});

test('reports an unsupported file with one recovery action', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Choose source photograph').setInputFiles({
    buffer: Buffer.from('not an image'),
    mimeType: 'image/gif',
    name: 'notes.gif',
  });

  await expect(page.getByText('That file could not be opened.')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('not supported');
  await expect(page.getByRole('button', { name: 'Try another file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start with the sample' })).toBeVisible();
});

test('explains missing WebGL2 and offers reload', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function (contextId, ...args) {
      if (contextId === 'webgl2') {
        return null;
      }

      return originalGetContext.call(this, contextId, ...args);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();

  await expect(page.getByText(/OpenFilm needs WebGL2 to show a preview/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
});

test('shows a recoverable state when the WebGL2 context is lost', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();

  await page.locator('canvas.render-canvas').dispatchEvent('webglcontextlost');

  await expect(page.getByRole('heading', { name: 'Preview stopped.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
});

test('imports, previews, resets, replaces, and downloads a JPEG', async ({ page }) => {
  await page.goto('/');

  const sourceInput = page.getByLabel('Choose source photograph');
  await sourceInput.setInputFiles(fixtureFile(previewFixture));

  await expect(page.getByRole('heading', { name: previewFixture.fileName })).toBeVisible();
  await expect(page.getByText('WebGL2 ready').first()).toBeVisible();
  const importArea = page.getByRole('group', { name: 'Source photograph import area' });
  await expect(importArea.getByText(previewFixture.fileName)).toHaveCount(0);
  await expect(importArea.getByText(/Ready to edit/)).toHaveCount(0);
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
  await openExport(page);

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
  expect(dialog.message()).toContain('current Edit will be reset');
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

test('selects PNG, reports bounded dimensions, and downloads a fresh export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
  await openExport(page);

  const format = page.getByRole('combobox', { name: 'Format' });
  const quality = page.getByRole('slider', { name: 'Quality' });
  const outputSize = page.getByRole('combobox', { name: 'Output size' });
  const downloadButton = page.getByRole('button', { name: 'Download JPEG' });

  await expect(quality).toBeVisible();
  await format.selectOption('png');
  await expect(quality).toBeHidden();
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();

  await outputSize.selectOption('maximum');
  const maximumLongEdge = page.getByRole('spinbutton', { name: 'Maximum long edge' });
  await maximumLongEdge.fill('200');
  await expect(page.getByText('200 × 150 pixels')).toBeVisible();

  await expect(downloadButton).toBeHidden();
  const pngDownloadButton = page.getByRole('button', { name: 'Download PNG' });
  const downloadPromise = page.waitForEvent('download');
  await pngDownloadButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('openfilm-sample-openfilm.png');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const bytes = await readFile(downloadPath as string);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.readUInt32BE(16)).toBe(200);
  expect(bytes.readUInt32BE(20)).toBe(150);
});

test('keeps a large source preview bounded and warns before a large export', async ({ page }) => {
  await page.addInitScript(() => {
    const naturalWidth = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'naturalWidth',
    );
    const naturalHeight = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'naturalHeight',
    );

    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      configurable: true,
      get() {
        return (naturalWidth?.get?.call(this) ?? 0) > 0 ? 6_000 : 0;
      },
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      configurable: true,
      get() {
        return (naturalHeight?.get?.call(this) ?? 0) > 0 ? 4_000 : 0;
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Choose source photograph').setInputFiles(fixtureFile(previewFixture));

  await expect(page.getByRole('heading', { name: previewFixture.fileName })).toBeVisible();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
  await openExport(page);
  await expect(page.getByText(/browser pixel memory/)).toBeVisible();
  await expect(page.locator('.export-estimate strong')).toHaveText('6,000 × 4,000 pixels');
});

test('shows a recovery action when export encoding fails', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
  await openExport(page);

  await page.getByRole('button', { name: 'Download JPEG' }).click();
  await expect(page.getByRole('alert')).toContainText('could not encode the JPEG export');
  await expect(page.getByRole('button', { name: 'Try export again' })).toBeVisible();
});

test('prevents duplicate exports without blocking tool navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const state = window as typeof window & {
      openFilmExportCalls: number;
      releaseOpenFilmExport: () => void;
    };
    let releaseExport: (() => void) | null = null;

    state.openFilmExportCalls = 0;
    state.releaseOpenFilmExport = () => {
      releaseExport?.();
    };

    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      state.openFilmExportCalls += 1;
      releaseExport = () => originalToBlob.call(this, callback, type, quality);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
  await openExport(page);

  const downloadButton = page.locator('.export-controls__actions .button');
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.dispatchEvent('click');
  await expect(downloadButton).toBeDisabled();
  await page.getByRole('tab', { name: 'Geometry' }).click();
  await expect(page.getByRole('heading', { name: 'Geometry' })).toBeVisible();
  await downloadButton.evaluate((element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );

  await page.evaluate(() => {
    const state = window as typeof window & { releaseOpenFilmExport: () => void };
    state.releaseOpenFilmExport();
  });
  await downloadPromise;
  expect(
    await page.evaluate(
      () => (window as typeof window & { openFilmExportCalls: number }).openFilmExportCalls,
    ),
  ).toBe(1);
});

test('tries the bundled sample and edits the core adjustments', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await openEditHistory(page);
  await expect(page.locator('.canvas-column__footer .renderer-status')).toBeVisible();

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

  await page.setViewportSize({ height: 844, width: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await openEditHistory(page);
  await expect(page.locator('.canvas-column__footer .renderer-status')).toBeVisible();

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
  await page.getByRole('button', { name: 'Start with the sample' }).click();
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
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await openEditHistory(page);

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

test('crops, rotates, flips, and resets geometry with accessible alternatives to dragging', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await openEditHistory(page);

  await page.getByRole('tab', { name: 'Geometry' }).click();
  const cropPreview = page.getByRole('group', { name: 'Crop preview' });
  await expect(cropPreview).toBeVisible();
  await expect(cropPreview.locator('img')).toBeVisible();
  await expect(cropPreview.locator('img')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('button', { name: 'Resize crop top left' })).toBeVisible();

  const cropWidth = page.getByRole('spinbutton', { name: 'Crop width value' });
  const cropHeight = page.getByRole('spinbutton', { name: 'Crop height value' });
  await cropWidth.fill('60');
  await expect(cropWidth).toHaveValue('60');

  await page.getByRole('combobox', { name: 'Aspect ratio' }).selectOption('1:1');
  await expect(cropWidth).toHaveValue('60');
  await expect(cropHeight).toHaveValue('80');

  const cropSelection = page.locator('.crop-control__selection');
  const cropBox = await cropSelection.boundingBox();
  expect(cropBox).not.toBeNull();
  await page.mouse.move(cropBox!.x + cropBox!.width / 2, cropBox!.y + cropBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(cropBox!.x + cropBox!.width / 2 + 18, cropBox!.y + cropBox!.height / 2);
  await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: 'Crop left value' })).not.toHaveValue('0');

  const rotation = page.getByRole('combobox', { name: 'Rotation' });
  await rotation.selectOption('90');
  await expect(rotation).toHaveValue('90');

  const horizontalFlip = page.getByRole('button', { name: 'Horizontal' });
  const verticalFlip = page.getByRole('button', { name: 'Vertical' });
  await horizontalFlip.click();
  await verticalFlip.click();
  await expect(horizontalFlip).toHaveAttribute('aria-pressed', 'true');
  await expect(verticalFlip).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(verticalFlip).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(verticalFlip).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Reset geometry' }).click();
  await expect(cropWidth).toHaveValue('100');
  await expect(cropHeight).toHaveValue('100');
  await expect(rotation).toHaveValue('0');
  await expect(horizontalFlip).toHaveAttribute('aria-pressed', 'false');
  await expect(verticalFlip).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('canvas.render-canvas--visible')).toBeVisible();
});

test('keeps geometry controls named and usable at a phone width', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.setViewportSize({ height: 844, width: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await openEditHistory(page);
  await page.getByRole('tab', { name: 'Geometry' }).click();

  for (const label of [
    'Crop left value',
    'Crop top value',
    'Crop width value',
    'Crop height value',
  ]) {
    await expect(page.getByRole('spinbutton', { name: label })).toBeVisible();
  }

  await expect(page.getByRole('combobox', { name: 'Aspect ratio' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Rotation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Horizontal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vertical' })).toBeVisible();

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

test('shares Edit history across tools, compares before and after, and updates the histogram', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await openEditHistory(page);

  const histogram = page.getByRole('img', { name: /Luminance histogram/ });
  await expect(histogram).toBeVisible();
  const barsBefore = await page
    .locator('.histogram-panel__plot rect')
    .evaluateAll((bars) => bars.map((bar) => bar.getAttribute('height')));

  const exposure = page.getByRole('spinbutton', { name: 'Exposure value' });
  await exposure.fill('1');
  await expect(exposure).toHaveValue('1');
  await expect
    .poll(() =>
      page
        .locator('.histogram-panel__plot rect')
        .evaluateAll((bars) => bars.map((bar) => bar.getAttribute('height'))),
    )
    .not.toEqual(barsBefore);

  await page.getByRole('tab', { name: 'Geometry' }).click();
  const rotation = page.getByRole('combobox', { name: 'Rotation' });
  await rotation.selectOption('90');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(rotation).toHaveValue('0');

  await page.getByRole('tab', { name: 'Adjust' }).click();
  await page.keyboard.press('Control+z');
  await expect(exposure).toHaveValue('0');
  await page.keyboard.press('Control+Shift+z');
  await expect(exposure).toHaveValue('1');

  const beforeButton = page.getByRole('button', { name: 'Show before' });
  await beforeButton.click();
  await expect(page.getByRole('button', { name: 'Show edited result' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Show before' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('applies bundled Looks and supports custom Look CRUD', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  await page.getByRole('tab', { name: 'Looks' }).click();
  await expect(page.getByRole('heading', { name: 'Bundled Looks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Quiet Morning' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Street Dust' })).toBeVisible();

  await page.getByRole('button', { name: 'Apply Quiet Morning' }).click();
  await page.getByRole('tab', { name: 'Adjust' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Exposure value' })).toHaveValue('0.35');

  const exposure = page.getByRole('spinbutton', { name: 'Exposure value' });
  await exposure.fill('1.5');
  await page.getByRole('tab', { name: 'Looks' }).click();
  await page.getByRole('button', { name: 'Save current Look' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('My saved Look');
  await page.getByRole('textbox', { name: 'Description' }).fill('A look I want to use again.');
  await page.getByRole('button', { name: 'Save Look' }).click();
  await expect(page.getByRole('heading', { name: 'My saved Look' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string[]>((resolve, reject) => {
            const openRequest = indexedDB.open('openfilm');
            openRequest.onerror = () => reject(openRequest.error);
            openRequest.onsuccess = () => {
              const request = openRequest.result
                .transaction('custom-looks', 'readonly')
                .objectStore('custom-looks')
                .getAll();
              request.onerror = () => reject(request.error);
              request.onsuccess = () =>
                resolve((request.result as Array<{ title: string }>).map((look) => look.title));
            };
          }),
      ),
    )
    .toContain('My saved Look');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await page.getByRole('tab', { name: 'Looks' }).click();
  await expect(page.getByRole('heading', { name: 'My saved Look' })).toBeVisible();

  await page.getByRole('button', { name: 'Apply My saved Look' }).click();
  await page.getByRole('tab', { name: 'Adjust' }).click();
  await expect(exposure).toHaveValue('1.5');
  await page.getByRole('tab', { name: 'Looks' }).click();

  await page.getByRole('button', { name: 'Rename My saved Look' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Renamed Look');
  await page.getByRole('button', { name: 'Rename Look' }).click();
  await expect(page.getByRole('heading', { name: 'Renamed Look' })).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate Renamed Look' }).click();
  await expect(page.getByRole('heading', { name: 'Renamed Look copy' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Renamed Look', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renamed Look', exact: true })).toHaveCount(0);
});

test('previews, applies, saves, and exports a versioned Look preset', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await page.getByRole('tab', { name: 'Looks' }).click();

  const presetInput = page.getByLabel('Choose Look preset');
  await presetInput.setInputFiles({
    buffer: Buffer.from(validPresetFixture),
    mimeType: 'application/json',
    name: 'fixture-look.json',
  });

  const preview = page.getByRole('dialog', { name: 'Review Look preset' });
  await expect(preview).toContainText('Fixture Look');
  await expect(preview).toContainText('OpenFilm preset 1.1');
  await preview.getByRole('button', { name: 'Apply preset' }).click();

  await page.getByRole('tab', { name: 'Adjust' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Exposure value' })).toHaveValue('0.75');

  await page.getByRole('tab', { name: 'Looks' }).click();
  await presetInput.setInputFiles({
    buffer: Buffer.from(validPresetFixture),
    mimeType: 'application/json',
    name: 'fixture-look.json',
  });
  await page
    .getByRole('dialog', { name: 'Review Look preset' })
    .getByRole('button', { name: 'Save as custom Look' })
    .click();
  await expect(page.getByRole('heading', { name: 'Fixture Look copy' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Fixture Look copy preset' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('openfilm-fixture-look-copy.json');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const exported = JSON.parse(await readFile(downloadPath as string, 'utf8')) as Record<
    string,
    unknown
  >;
  expect(exported).toMatchObject({
    formatVersion: '1.1',
    title: 'Fixture Look copy',
  });
  expect(exported).not.toHaveProperty('geometry');
  expect(exported).not.toHaveProperty('source');
  expect(exported).not.toHaveProperty('history');
  expect(exported).not.toHaveProperty('grainSeed');
  expect((exported.adjustments as { exposure: number }).exposure).toBe(0.75);
});

test('rejects an invalid Look preset without opening the preview dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await page.getByRole('tab', { name: 'Looks' }).click();

  await page.getByLabel('Choose Look preset').setInputFiles({
    buffer: Buffer.from('{"formatVersion":"2.0","title":"Wrong","adjustments":{}}'),
    mimeType: 'application/json',
    name: 'invalid-look.json',
  });

  await expect(page.getByRole('alert')).toContainText('could not read this preset');
  await expect(page.getByRole('dialog', { name: 'Review Look preset' })).toHaveCount(0);
});

test('recovers the latest Edit and its source after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await expect(page.getByText('Browser recovery available')).toBeVisible();

  const exposure = page.getByRole('spinbutton', { name: 'Exposure value' });
  await exposure.fill('1.25');
  await expect(exposure).toHaveValue('1.25');
  await page.getByRole('tab', { name: 'Geometry' }).click();
  await page.getByRole('combobox', { name: 'Rotation' }).selectOption('90');
  await page.getByRole('tab', { name: 'Adjust' }).click();
  await page.reload();

  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Exposure value' })).toHaveValue('1.25');
  await expect(page.getByText(/Recovered openfilm-sample\.png/)).toBeVisible();
  await page.getByRole('tab', { name: 'Geometry' }).click();
  await expect(page.getByRole('combobox', { name: 'Rotation' })).toHaveValue('90');
});

test('restores settings and requests the source again when source bytes are unavailable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  const exposure = page.getByRole('spinbutton', { name: 'Exposure value' });
  await exposure.fill('0.75');
  await expect(exposure).toHaveValue('0.75');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const openRequest = indexedDB.open('openfilm');
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        const transaction = database.transaction('source-photograph', 'readwrite');
        const deleteRequest = transaction.objectStore('source-photograph').delete('current');

        deleteRequest.onerror = () => reject(deleteRequest.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await page.reload();

  await expect(page.getByText('Your latest Edit is ready.')).toBeVisible();
  await expect(page.getByText(/Recovered settings for openfilm-sample\.png/)).toBeVisible();
  await expect(
    page.locator('.landing-alert').getByRole('button', { name: 'Choose source photograph' }),
  ).toBeVisible();

  await page.getByLabel('Choose source photograph').setInputFiles(fixtureFile(previewFixture));
  await expect(page.getByRole('heading', { name: previewFixture.fileName })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Exposure value' })).toHaveValue('0.75');
});

test('keeps bundled and custom Look controls reachable at a phone width', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();
  await page.getByRole('tab', { name: 'Looks' }).click();

  await expect(page.getByRole('heading', { name: 'Bundled Looks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Blue Hour' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save current Look' })).toBeVisible();

  const accessibilitySnapshot = await page.evaluate(() => ({
    controlsWithoutNames: Array.from(
      document.querySelectorAll('button, input, select, textarea'),
    ).filter((element) => {
      const label = element.getAttribute('aria-label');
      const labelledBy = element.getAttribute('aria-labelledby');
      const text = element.textContent?.trim();
      const associatedLabel = element.id
        ? document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim()
        : undefined;

      return !label && !labelledBy && !text && !associatedLabel;
    }).length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));

  expect(accessibilitySnapshot.controlsWithoutNames).toBe(0);
  expect(accessibilitySnapshot.horizontalOverflow).toBe(false);
});

test('keeps one canvas-first control area across desktop, phone, and landscape', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with the sample' }).click();
  await expect(page.getByRole('heading', { name: 'openfilm-sample.png' })).toBeVisible();

  const desktopColumns = await page
    .locator('.workspace')
    .evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    );
  expect(desktopColumns).toBe(2);
  await expect(page.getByRole('button', { name: 'Edit history' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Format' })).toBeHidden();

  await page.setViewportSize({ height: 800, width: 360 });

  const phoneColumns = await page
    .locator('.workspace')
    .evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    );
  expect(phoneColumns).toBe(1);

  const exposure = page.getByRole('spinbutton', { name: 'Exposure value' });
  await exposure.fill('0.75');
  await page.getByRole('tab', { name: 'Geometry' }).click();
  await expect(page.getByRole('group', { name: 'Crop preview' })).toBeVisible();
  await page.getByRole('tab', { name: 'Looks' }).click();
  await expect(page.getByRole('heading', { name: 'Bundled Looks' })).toBeVisible();
  await page.getByRole('tab', { name: 'Adjust' }).click();
  await openExport(page);
  await expect(page.getByRole('combobox', { name: 'Format' })).toBeVisible();

  const visibleControlSizes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, input[type="range"], select'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const { height, width } = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && height > 0 && width > 0;
      })
      .map((element) => {
        const { height, width } = element.getBoundingClientRect();
        return Math.min(height, width);
      }),
  );
  expect(Math.min(...visibleControlSizes)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.setViewportSize({ height: 390, width: 844 });
  await expect(exposure).toHaveValue('0.75');
  await expect(page.getByRole('combobox', { name: 'Format' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
