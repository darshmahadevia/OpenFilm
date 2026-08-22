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

  const exposure = page.getByLabel('Exposure');
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
