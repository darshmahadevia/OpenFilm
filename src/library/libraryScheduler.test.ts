import { LibraryWorkScheduler } from './libraryScheduler';

describe('Library work scheduler', () => {
  it('runs visible-thumbnail work before queued scan work', async () => {
    const scheduler = new LibraryWorkScheduler(1);
    const order: string[] = [];
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const scan = scheduler.enqueue('scan', async () => {
      order.push('scan:first');
      await first;
      order.push('scan:first:done');
    });
    const queuedScan = scheduler.enqueue('scan', async () => {
      order.push('scan:queued');
    });
    const thumbnail = scheduler.enqueue('visible-thumbnail', async () => {
      order.push('thumbnail');
    });

    releaseFirst();
    await Promise.all([scan, queuedScan, thumbnail]);

    expect(order).toEqual(['scan:first', 'scan:first:done', 'thumbnail', 'scan:queued']);
    scheduler.dispose();
  });

  it('rejects work cancelled before it enters a worker slot', async () => {
    const scheduler = new LibraryWorkScheduler(1);
    const controller = new AbortController();
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const running = scheduler.enqueue('scan', async () => await first);
    const queued = scheduler.enqueue('scan', async () => undefined, controller.signal);

    controller.abort();
    releaseFirst();

    await running;
    await expect(queued).rejects.toThrow('cancelled');
    scheduler.dispose();
  });

  it('retries within a bound, rejects stale generations, and reports queue depth', async () => {
    const scheduler = new LibraryWorkScheduler(1);
    const generation = scheduler.beginGeneration();
    let attempts = 0;
    const retried = scheduler.enqueue(
      'background',
      async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('temporary');
        return 'done';
      },
      undefined,
      { generation, retryLimit: 1 },
    );
    expect(scheduler.snapshot()).toMatchObject({ running: 1 });
    await expect(retried).resolves.toBe('done');
    expect(attempts).toBe(2);

    const staleGeneration = scheduler.beginGeneration();
    scheduler.beginGeneration();
    await expect(
      scheduler.enqueue('scan', async () => 'stale', undefined, { generation: staleGeneration }),
    ).rejects.toThrow(/stale/);
    scheduler.dispose();
  });
});
