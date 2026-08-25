import { expect, test } from '@playwright/test';

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
    await page.goto('/');

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
    await expect(page.getByText('Saving', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saving Library…' })).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByText('.openfilm/library.json', { exact: false })).toBeVisible();

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

    await page.getByRole('button', { name: 'Recent Libraries' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
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
    await page.getByRole('button', { name: 'Recent Libraries' }).click();
    await expect(page.getByText('Unsaved recovery', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open Library' }).click();
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();

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
    await page.getByRole('button', { name: 'Recent Libraries' }).click();
    await expect(page.getByText('Read-only', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open Library' }).click();
    await expect(page.getByText('Read-only', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Read-only Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reauthorize folder' })).toBeVisible();
  });
});
