import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { sourcePhotographFixtures } from '../src/import/sourcePhotographFixtures';

test.describe('Library start and recovery journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'The Library workflow uses a local Origin Private File System fixture.',
  );

  test('creates, reopens, recovers, and protects an empty Library', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => navigator.storage.getDirectory(),
      });
    });
    await page.goto('/app.html');

    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();

      try {
        await root.removeEntry('.openfilm', { recursive: true });
      } catch (error) {
        if (error instanceof DOMException && error.name !== 'NotFoundError') {
          throw error;
        }
      }

      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('openfilm', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const transaction = database.transaction(
        ['custom-looks', 'latest-edit', 'source-photograph', 'recent-libraries'],
        'readwrite',
      );
      transaction.objectStore('custom-looks').clear();
      transaction.objectStore('latest-edit').clear();
      transaction.objectStore('source-photograph').clear();
      transaction.objectStore('recent-libraries').clear();
      await new Promise<void>((resolve, reject) => {
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
    });
    await page.reload();

    const openFolder = page.getByRole('button', { name: 'Open folder' });
    await expect(openFolder).toBeEnabled();
    await openFolder.click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    const savedFile = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle('.openfilm');
      const file = await directory.getFileHandle('library.json');
      return JSON.parse(await (await file.getFile()).text()) as {
        library: { photographs: unknown[]; schemaVersion: number };
        revision: number;
      };
    });

    expect(savedFile.revision).toBe(1);
    expect(savedFile.library.schemaVersion).toBe(1);
    expect(savedFile.library.photographs).toEqual([]);

    await page.locator('.workstation-more summary').click();
    await page.getByRole('button', { name: 'Libraries' }).click();
    await expect(page.getByText('ready', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Library' })).toBeVisible();

    await page.getByRole('button', { name: 'Open Library' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('openfilm', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const transaction = database.transaction('recent-libraries', 'readwrite');
      const store = transaction.objectStore('recent-libraries');
      const request = store.getAll();
      const records = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as Array<Record<string, unknown>>);
      });
      const record = records[0];

      if (!record) {
        throw new Error('The Library recovery record was not written.');
      }

      record.status = 'unsaved';
      store.put(record);
      await new Promise<void>((resolve, reject) => {
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
    });
    await page.locator('.workstation-more summary').click();
    await page.getByRole('button', { name: 'Libraries' }).click();
    await expect(page.getByText('unsaved recovery', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open Library' }).click();
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    await page.getByRole('button', { name: 'Revert' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle('.openfilm');
      const file = await directory.getFileHandle('library.json');
      const writable = await file.createWritable();
      await writable.write(new TextEncoder().encode('{"not":"a Library"}'));
      await writable.close();
    });
    await page.locator('.workstation-more summary').click();
    await page.getByRole('button', { name: 'Libraries' }).click();
    await expect(page.getByText('read only', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open Library' }).click();
    await expect(page.getByText('Read-only', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Read-only Library');
  });

  test('shows a progressive fixed Grid, real Source decoding, EXIF work, and unsupported files', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);

      window.requestAnimationFrame = (callback) =>
        nativeRequestAnimationFrame((time) => {
          window.setTimeout(() => callback(time), 24);
        });
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => navigator.storage.getDirectory(),
      });
    });
    await page.goto('/app.html');

    await page.evaluate(
      async ({ fixtures }) => {
        const root = await navigator.storage.getDirectory();

        try {
          await root.removeEntry('.openfilm', { recursive: true });
        } catch (error) {
          if (error instanceof DOMException && error.name !== 'NotFoundError') {
            throw error;
          }
        }

        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('openfilm', 3);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        const transaction = database.transaction(
          ['custom-looks', 'latest-edit', 'source-photograph', 'recent-libraries'],
          'readwrite',
        );
        transaction.objectStore('custom-looks').clear();
        transaction.objectStore('latest-edit').clear();
        transaction.objectStore('source-photograph').clear();
        transaction.objectStore('recent-libraries').clear();
        await new Promise<void>((resolve, reject) => {
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => resolve();
        });
        database.close();

        async function writeFile(path: string, encoded: string) {
          const parts = path.split('/');
          const fileName = parts.pop();

          if (!fileName) {
            throw new Error(`Invalid fixture path: ${path}`);
          }

          let directory = root;

          for (const part of parts) {
            directory = await directory.getDirectoryHandle(part, { create: true });
          }

          const handle = await directory.getFileHandle(fileName, { create: true });
          const writable = await handle.createWritable();
          const binary = atob(encoded);
          await writable.write(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
          await writable.close();
        }

        const jpeg = fixtures[0].encodedBase64;
        const png = fixtures[1].encodedBase64;
        const webp = fixtures[2].encodedBase64;

        await writeFile('first.jpg', jpeg);
        await writeFile('nested/second.png', png);
        await writeFile('nested/third.webp', webp);
        await writeFile('fourth.jpg', jpeg);
        await writeFile('fifth.jpg', jpeg);
        await writeFile('sixth.jpg', jpeg);
        await writeFile('camera.cr3', btoa('unsupported raw companion'));
      },
      { fixtures: sourcePhotographFixtures },
    );

    await page.getByRole('button', { name: 'Open folder' }).click();
    await expect(page.getByLabel('Background jobs: scanning')).toBeVisible();
    await expect(page.getByRole('button', { name: /nested\/second\.png/ })).toBeVisible();
    await expect(page.getByLabel('Background jobs: scanning')).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Library Grid' })).toBeVisible();
    await expect(page.getByLabel('Background jobs: complete')).toBeVisible();
    await page.getByLabel('Background jobs: complete').click();
    await expect(page.getByText('camera.cr3', { exact: true })).toBeVisible();

    await expect(page.locator('.library-grid__image').first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.library-grid__image')
          .first()
          .evaluate((image) => {
            const element = image as HTMLImageElement;
            return element.complete && element.naturalWidth > 0;
          }),
      )
      .toBe(true);

    await page.locator('.workstation-view summary').click();
    for (const density of ['overview', 'standard', 'detail']) {
      await expect(page.getByRole('button', { name: density, exact: true })).toBeVisible();
    }
    await page.locator('.workstation-view summary').click();

    const cellHeights = await page
      .locator('.library-grid__cell:not(.library-grid__cell--empty)')
      .evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().height)));
    expect(new Set(cellHeights).size).toBe(1);

    const sidecar = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle('.openfilm');
      const file = await directory.getFileHandle('library.json');
      return JSON.parse(await (await file.getFile()).text()) as {
        library: { photographs: Array<Record<string, unknown>> };
      };
    });

    expect(sidecar.library.photographs).toHaveLength(6);
    expect(sidecar.library.photographs.every((record) => 'fingerprint' in record)).toBe(true);
    expect(
      sidecar.library.photographs.find((record) => record.relativePath === 'first.jpg'),
    ).toMatchObject({
      orientation: 6,
    });
    expect(sidecar.library.photographs.every((record) => !('source' in record))).toBe(true);
    expect(sidecar.library.photographs.every((record) => !('blob' in record))).toBe(true);
    expect(sidecar.library.photographs.map((record) => record.relativePath)).toEqual([
      'fifth.jpg',
      'first.jpg',
      'fourth.jpg',
      'nested/second.png',
      'nested/third.webp',
      'sixth.jpg',
    ]);

    const firstPhotograph = page.getByRole('button', { name: /fifth\.jpg/ });
    await firstPhotograph.click();
    await page.keyboard.press('p');
    await expect(page.getByText('fifth.jpg: Pick.')).toBeVisible();
    await page.keyboard.press('5');
    await expect(page.getByText('first.jpg: 5 stars.')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Nearby photographs')).toBeVisible();
    const sourceDimensions = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const file = await (await root.getFileHandle('fifth.jpg')).getFile();
      const bitmap = await createImageBitmap(file);
      const dimensions = { height: bitmap.height, width: bitmap.width };
      bitmap.close();
      return dimensions;
    });
    await page.getByRole('button', { name: '100%' }).click();
    await expect
      .poll(() =>
        page.getByLabel(/Rendered Edit/).evaluate((canvas) => ({
          height: (canvas as HTMLCanvasElement).clientHeight,
          width: (canvas as HTMLCanvasElement).clientWidth,
        })),
      )
      .toEqual(sourceDimensions);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('grid', { name: 'Library Grid' })).toBeVisible();

    const activeButton = page.getByRole('button', { name: /fifth\.jpg/ });
    await activeButton.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByLabel(/Selection count: 2/)).toBeVisible();
    await page.keyboard.press('c');
    await expect(page.locator('.comparison-pane')).toHaveCount(2);
    await expect(page.locator('.comparison-pane canvas')).toHaveCount(2);
    await page.locator('.comparison-pane canvas').first().dispatchEvent('webglcontextlost');
    await expect(page.getByText('Graphics context lost').first()).toBeVisible();
    await page.locator('.comparison-pane canvas').first().dispatchEvent('webglcontextrestored');
    await expect(page.getByText('Graphics context lost')).toHaveCount(0);
    await page.getByRole('button', { name: 'Source', pressed: false }).click();
    await expect(page.getByText(/Source derivative/).first()).toBeVisible();
    await page.keyboard.press('Escape');

    const editButton = page.getByRole('button', { name: 'Edit' });
    await editButton.click();
    const inspector = page.getByRole('dialog', { name: 'Edit inspector' });
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Close' })).toBeFocused();
    await inspector.getByRole('button', { name: 'Color' }).click();
    await expect(inspector.getByRole('slider', { name: 'Saturation' })).toBeVisible();
    await inspector.getByRole('button', { name: 'Close' }).click();
    await expect(editButton).toBeFocused();

    await page.locator('.workstation-more summary').click();
    const groupsButton = page.getByRole('button', { name: 'Review groups' });
    await groupsButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Review groups' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(groupsButton).toBeFocused();

    const exportButton = page.getByRole('button', { name: 'Export' });
    await exportButton.focus();
    await page.keyboard.press('Enter');
    const exportDialog = page.getByRole('dialog', { name: 'Export final set' });
    await expect(exportDialog).toBeVisible();
    const selectionOption = exportDialog.getByText(/Current Selection/).getByRole('radio');
    await selectionOption.focus();
    await page.keyboard.press('Space');
    const fallback = exportDialog.getByRole('button', { name: 'Prepare bounded downloads' });
    await fallback.focus();
    await page.keyboard.press('Enter');
    await expect(exportDialog.locator('.export-manifest-preview li')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(exportButton).toBeFocused();

    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry('fifth.jpg');
    });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByLabel('Background jobs: complete')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /fifth\.jpg.*Missing photograph/ }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
