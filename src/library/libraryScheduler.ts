export const LIBRARY_WORK_PRIORITIES = [
  'visible-thumbnail',
  'active-comparison',
  'scan',
  'background',
] as const;

export type LibraryWorkPriority = (typeof LIBRARY_WORK_PRIORITIES)[number];

const PRIORITY_RANK: Record<LibraryWorkPriority, number> = {
  'active-comparison': 0,
  background: 3,
  scan: 2,
  'visible-thumbnail': 1,
};

function createCancellationError(): Error {
  return new Error('The Library work was cancelled.');
}

interface LibraryWorkJob<T> {
  generation?: number;
  order: number;
  priority: LibraryWorkPriority;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
  run: () => Promise<T>;
  signal?: AbortSignal;
  retryLimit: number;
}

export interface LibraryWorkOptions {
  generation?: number;
  retryLimit?: number;
}

export class LibraryWorkScheduler {
  private readonly queue: LibraryWorkJob<unknown>[] = [];
  private nextOrder = 0;
  private running = 0;
  private disposed = false;
  private generation = 0;

  constructor(private readonly concurrency = 2) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new Error('The Library work scheduler needs at least one worker slot.');
    }
  }

  enqueue<T>(
    priority: LibraryWorkPriority,
    run: () => Promise<T>,
    signal?: AbortSignal,
    options: LibraryWorkOptions = {},
  ): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('The Library work scheduler was released.'));
    }

    if (signal?.aborted) {
      return Promise.reject(createCancellationError());
    }

    if (options.generation !== undefined && options.generation !== this.generation) {
      return Promise.reject(new Error('The Library work result is stale.'));
    }

    return new Promise<T>((resolve, reject) => {
      const job: LibraryWorkJob<T> = {
        order: this.nextOrder,
        priority,
        reject,
        resolve,
        run,
        signal,
        generation: options.generation,
        retryLimit: Math.max(0, Math.min(3, Math.floor(options.retryLimit ?? 0))),
      };
      this.nextOrder += 1;

      this.queue.push(job as LibraryWorkJob<unknown>);
      this.pump();
    });
  }

  beginGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  snapshot(): { generation: number; queued: number; running: number; workerLimit: number } {
    return {
      generation: this.generation,
      queued: this.queue.length,
      running: this.running,
      workerLimit: this.concurrency,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const job of this.queue.splice(0)) {
      job.reject(new Error('The Library work scheduler was released.'));
    }
  }

  private pump(): void {
    while (!this.disposed && this.running < this.concurrency && this.queue.length > 0) {
      this.queue.sort((first, second) => {
        const priority = PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority];
        return priority === 0 ? first.order - second.order : priority;
      });

      const job = this.queue.shift();

      if (!job) {
        return;
      }

      if (job.signal?.aborted) {
        job.reject(createCancellationError());
        continue;
      }

      if (job.generation !== undefined && job.generation !== this.generation) {
        job.reject(new Error('The Library work result is stale.'));
        continue;
      }

      this.running += 1;
      void Promise.resolve()
        .then(async () => {
          let attempt = 0;
          while (true) {
            try {
              const value = await job.run();
              if (job.generation !== undefined && job.generation !== this.generation) {
                throw new Error('The Library work result is stale.');
              }
              return value;
            } catch (error) {
              if (job.signal?.aborted) throw createCancellationError();
              if (attempt >= job.retryLimit) throw error;
              attempt += 1;
            }
          }
        })
        .then(job.resolve, job.reject)
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }
}

export function createLibraryWorkScheduler(): LibraryWorkScheduler {
  return new LibraryWorkScheduler(2);
}
