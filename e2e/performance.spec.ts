import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

function p95(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

async function measureInteractions(page: Page) {
  return await page.evaluate(async () => {
    const metrics = (
      window as Window & {
        __openfilmLibraryMetrics?: () => {
          fullResolutionReads: number;
          scheduler: { queued: number; running: number };
          thumbnailCache: { bytes: number; budget: number; count: number };
        } | null;
      }
    ).__openfilmLibraryMetrics?.();
    const workstation = document.querySelector<HTMLElement>('.library-workstation')!;
    const grid = document.querySelector<HTMLElement>('.library-grid')!;
    const selection: number[] = [];
    const general: number[] = [];
    const frames: number[] = [];
    const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

    for (let index = 0; index < 80; index += 1) {
      const started = performance.now();
      workstation.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
      await nextFrame();
      selection.push(performance.now() - started);
    }
    for (const density of ['overview', 'standard', 'detail', 'standard']) {
      const started = performance.now();
      Array.from(document.querySelectorAll<HTMLButtonElement>('.library-grid-density button'))
        .find((button) => button.textContent === density)
        ?.click();
      await nextFrame();
      general.push(performance.now() - started);
    }
    let previous = await nextFrame();
    for (let index = 0; index < 40; index += 1) {
      grid.scrollTop = index * 600;
      const current = await nextFrame();
      frames.push(current - previous);
      previous = current;
    }
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return {
      frames,
      general,
      heapBytes: memory.memory?.usedJSHeapSize ?? null,
      liveBitmaps: document.querySelectorAll('.library-grid__image').length,
      liveDomCells: document.querySelectorAll('[role="gridcell"]').length,
      selection,
      metrics,
    };
  });
}

test.describe('large Library performance gate', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'The performance gate uses an OPFS fixture.');
  test.setTimeout(120_000);

  test('keeps a virtualized 2,000-record Library within interaction targets', async ({ page }) => {
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
      } catch {
        /* Empty fixture. */
      }
      const [{ createBrowserLibraryFileStore }, fileModule, modelModule] = await Promise.all([
        import('/src/library/libraryFileStore.ts'),
        import('/src/library/libraryFile.ts'),
        import('/src/library/libraryModel.ts'),
      ]);
      const library = modelModule.createEmptyLibraryDocument('Performance Library', {
        libraryId: 'performance-library',
        now: 1,
      });
      const shoot = await root.getDirectoryHandle('shoot', { create: true });
      const fixture = new Uint8Array(
        await (await fetch('/src/assets/openfilm-sample-alpine-lake.webp')).arrayBuffer(),
      );
      const available = new Map<number, { byteSize: number; lastModified: number }>();
      for (let index = 0; index < 4; index += 1) {
        const handle = await shoot.getFileHandle(`frame-${String(index).padStart(4, '0')}.webp`, {
          create: true,
        });
        const writable = await handle.createWritable();
        await writable.write(fixture);
        await writable.close();
        const file = await handle.getFile();
        available.set(index, { byteSize: file.size, lastModified: file.lastModified });
      }
      library.photographs = Array.from({ length: 2_000 }, (_, index) => ({
        cameraSerial: 'perf-camera',
        captureTime: new Date(1_700_000_000_000 + index * 1_000).toISOString(),
        disposition: 'unmarked',
        fileName: `frame-${String(index).padStart(4, '0')}.${available.has(index) ? 'webp' : 'jpg'}`,
        fingerprint: available.get(index) ?? { byteSize: 24_000_000, lastModified: 1 },
        id: `photo-${String(index).padStart(4, '0')}`,
        mimeType: available.has(index) ? 'image/webp' : 'image/jpeg',
        orientation: 1,
        rating: null,
        relativePath: `shoot/frame-${String(index).padStart(4, '0')}.${available.has(index) ? 'webp' : 'jpg'}`,
        sourceState: available.has(index) ? 'available' : 'missing',
      }));
      const envelope = await fileModule.createLibraryFileEnvelope(library, 1, null, {
        writtenAt: 1,
      });
      await createBrowserLibraryFileStore(root).write(
        'library.json',
        fileModule.serializeLibraryFile(envelope),
      );
    });
    await page.reload();

    const started = performance.now();
    await page.getByRole('button', { name: 'Open folder' }).click();
    await expect(page.getByRole('grid', { name: 'Library Grid' })).toBeVisible();
    await expect(page.getByLabel(/Library save state:/)).toBeVisible();
    const firstUsableGridMs = performance.now() - started;
    const openingMetrics = await page.evaluate(() =>
      (
        window as Window & {
          __openfilmLibraryMetrics?: () => { fullResolutionReads: number } | null;
        }
      ).__openfilmLibraryMetrics?.(),
    );

    const first = page.getByRole('button', { name: /frame-0000\.webp/ });
    await first.click();
    let modeStarted = performance.now();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel(/frame-0000\.webp Rendered Edit/)).toBeVisible();
    const loupeReadyMs = performance.now() - modeStarted;
    await page.keyboard.press('Escape');
    await expect(page.getByRole('grid', { name: 'Library Grid' })).toBeVisible();
    await page.getByRole('button', { name: /frame-0000\.webp/ }).click();
    await page.keyboard.press('Shift+ArrowRight');
    modeStarted = performance.now();
    await page.keyboard.press('c');
    await expect(page.locator('.comparison-pane')).toHaveCount(2);
    const comparisonReadyMs = performance.now() - modeStarted;
    const liveComparisonTextures = await page.locator('.comparison-pane canvas').count();
    await page.getByRole('button', { name: 'Grid' }).click();
    const baseline = await measureInteractions(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const throttled = await measureInteractions(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const report = {
      corpus: {
        count: 2_000,
        logicalBytesPerSource: 24_000_000,
        sourceDimensions: { height: 5_625, width: 8_000 },
      },
      cacheBytes: baseline.metrics?.thumbnailCache.bytes ?? null,
      cacheBudgetBytes: baseline.metrics?.thumbnailCache.budget ?? null,
      comparisonReadyMs,
      firstUsableGridMs,
      fullResolutionReadsDuringOpen: openingMetrics?.fullResolutionReads ?? null,
      loupeReadyMs,
      profiles: [
        {
          frameTimeP95Ms: p95(baseline.frames),
          generalLatencyP95Ms: p95(baseline.general),
          heapBytes: baseline.heapBytes,
          liveBitmaps: baseline.liveBitmaps,
          liveDomCells: baseline.liveDomCells,
          liveTextures: liveComparisonTextures,
          name: 'Chromium baseline',
          queueDepth:
            (baseline.metrics?.scheduler.queued ?? 0) + (baseline.metrics?.scheduler.running ?? 0),
          selectionLatencyP95Ms: p95(baseline.selection),
        },
        {
          frameTimeP95Ms: p95(throttled.frames),
          generalLatencyP95Ms: p95(throttled.general),
          heapBytes: throttled.heapBytes,
          liveBitmaps: throttled.liveBitmaps,
          liveDomCells: throttled.liveDomCells,
          liveTextures: liveComparisonTextures,
          name: 'Chromium 4x CPU throttling',
          queueDepth:
            (throttled.metrics?.scheduler.queued ?? 0) +
            (throttled.metrics?.scheduler.running ?? 0),
          selectionLatencyP95Ms: p95(throttled.selection),
        },
      ],
    };
    await mkdir(resolve('.artifacts'), { recursive: true });
    await writeFile(
      resolve('.artifacts/browser-performance-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );

    expect(firstUsableGridMs).toBeLessThanOrEqual(5_000);
    for (const profile of report.profiles) {
      expect(profile.selectionLatencyP95Ms).toBeLessThan(50);
      expect(profile.generalLatencyP95Ms).toBeLessThan(100);
      expect(profile.liveDomCells).toBeLessThan(100);
    }
    expect(report.profiles[0].frameTimeP95Ms).toBeLessThanOrEqual(33.34);
    expect(report.fullResolutionReadsDuringOpen).toBe(0);
  });
});
