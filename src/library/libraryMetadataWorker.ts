import { parsePhotographMetadata } from './libraryMetadata';

interface MetadataWorkerRequest {
  bytes: ArrayBuffer;
  id: number;
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<MetadataWorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

workerScope.onmessage = (event) => {
  try {
    const metadata = parsePhotographMetadata(new Uint8Array(event.data.bytes));
    workerScope.postMessage({ id: event.data.id, metadata, ok: true });
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : 'The EXIF worker failed.',
      id: event.data.id,
      ok: false,
    });
  }
};

export {};
