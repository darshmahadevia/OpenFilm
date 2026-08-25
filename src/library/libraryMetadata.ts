export const LIBRARY_METADATA_READ_LIMIT = 512 * 1024;

export interface PhotographMetadata {
  cameraSerial: string | null;
  captureTime: string | null;
  orientation: number | null;
}

export interface LibraryMetadataExtractor {
  dispose(): void;
  extract(file: File, signal?: AbortSignal): Promise<PhotographMetadata>;
}

interface MetadataWorkerMessage {
  bytes: ArrayBuffer;
  id: number;
}

interface MetadataWorkerResponse {
  error?: string;
  id: number;
  metadata?: PhotographMetadata;
  ok: boolean;
}

interface MetadataWorkerLike {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<MetadataWorkerResponse>) => void) | null;
  postMessage(message: MetadataWorkerMessage, transfer: Transferable[]): void;
  terminate(): void;
}

const EMPTY_METADATA: PhotographMetadata = {
  cameraSerial: null,
  captureTime: null,
  orientation: null,
};

function cloneEmptyMetadata(): PhotographMetadata {
  return { ...EMPTY_METADATA };
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  const end = Math.min(bytes.length, start + length);
  let value = '';

  for (let index = start; index < end; index += 1) {
    const byte = bytes[index];

    if (byte === 0) {
      break;
    }

    if (byte >= 32 && byte <= 126) {
      value += String.fromCharCode(byte);
    }
  }

  return value.trim();
}

function normalizeCaptureTime(value: string): string | null {
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const numeric = [year, month, day, hour, minute, second].map(Number);

  if (
    numeric[1] < 1 ||
    numeric[1] > 12 ||
    numeric[2] < 1 ||
    numeric[2] > 31 ||
    numeric[3] > 23 ||
    numeric[4] > 59 ||
    numeric[5] > 59
  ) {
    return null;
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function parseTiffMetadata(
  bytes: Uint8Array,
  tiffStart: number,
  tiffLength: number,
): PhotographMetadata {
  const metadata = cloneEmptyMetadata();
  const end = Math.min(bytes.length, tiffStart + tiffLength);

  if (tiffStart < 0 || tiffStart + 8 > end) {
    return metadata;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteOrder = readAscii(bytes, tiffStart, 2);

  if (byteOrder !== 'II' && byteOrder !== 'MM') {
    return metadata;
  }

  const littleEndian = byteOrder === 'II';

  try {
    if (view.getUint16(tiffStart + 2, littleEndian) !== 42) {
      return metadata;
    }

    const typeSizes: Record<number, number> = {
      1: 1,
      2: 1,
      3: 2,
      4: 4,
      5: 8,
      7: 1,
      9: 4,
      10: 8,
    };

    const readEntryValue = (entry: number, type: number, count: number): Uint8Array => {
      const size = typeSizes[type];

      if (!size || count < 1) {
        return new Uint8Array();
      }

      const length = size * count;
      const valueOffset =
        length <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, littleEndian);

      if (valueOffset < tiffStart || valueOffset + length > end) {
        return new Uint8Array();
      }

      return bytes.slice(valueOffset, valueOffset + length);
    };

    const readIfd = (relativeOffset: number, depth: number): void => {
      if (depth > 2) {
        return;
      }

      const ifd = tiffStart + relativeOffset;

      if (ifd < tiffStart || ifd + 2 > end) {
        return;
      }

      const entryCount = view.getUint16(ifd, littleEndian);

      if (ifd + 2 + entryCount * 12 > end) {
        return;
      }

      for (let index = 0; index < entryCount; index += 1) {
        const entry = ifd + 2 + index * 12;
        const tag = view.getUint16(entry, littleEndian);
        const type = view.getUint16(entry + 2, littleEndian);
        const count = view.getUint32(entry + 4, littleEndian);
        const value = readEntryValue(entry, type, count);

        if (tag === 0x8769 && type === 4 && value.length >= 4) {
          readIfd(
            new DataView(value.buffer, value.byteOffset, value.byteLength).getUint32(
              0,
              littleEndian,
            ),
            depth + 1,
          );
          continue;
        }

        if (tag === 0x0112 && type === 3 && value.length >= 2) {
          metadata.orientation = new DataView(
            value.buffer,
            value.byteOffset,
            value.byteLength,
          ).getUint16(0, littleEndian);
          continue;
        }

        if (type !== 2 || value.length === 0) {
          if (tag === 0xa431 && type === 2) {
            metadata.cameraSerial = readAscii(value, 0, value.length) || null;
          }
          continue;
        }

        const text = readAscii(value, 0, value.length);

        if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
          metadata.captureTime ??= normalizeCaptureTime(text);
        } else if (tag === 0xa431) {
          metadata.cameraSerial = text || null;
        }
      }
    };

    const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
    readIfd(firstIfdOffset, 0);
  } catch {
    return cloneEmptyMetadata();
  }

  return metadata;
}

function mergeMetadata(first: PhotographMetadata, second: PhotographMetadata): PhotographMetadata {
  return {
    cameraSerial: first.cameraSerial ?? second.cameraSerial,
    captureTime: first.captureTime ?? second.captureTime,
    orientation: first.orientation ?? second.orientation,
  };
}

function parseExifPayload(bytes: Uint8Array, start: number, length: number): PhotographMetadata {
  if (length < 8) {
    return cloneEmptyMetadata();
  }

  const hasExifHeader = readAscii(bytes, start, 6) === 'Exif';
  const tiffStart = hasExifHeader ? start + 6 : start;

  return parseTiffMetadata(bytes, tiffStart, start + length - tiffStart);
}

function parseJpegMetadata(bytes: Uint8Array): PhotographMetadata {
  let offset = 2;
  let metadata = cloneEmptyMetadata();

  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];

    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];

    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      break;
    }

    if (marker === 0xe1) {
      metadata = mergeMetadata(metadata, parseExifPayload(bytes, offset + 4, segmentLength - 2));
    }

    offset += 2 + segmentLength;
  }

  return metadata;
}

function parsePngMetadata(bytes: Uint8Array): PhotographMetadata {
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
    const type = readAscii(bytes, offset + 4, 4);

    if (length > bytes.length - offset - 12) {
      break;
    }

    if (type === 'eXIf') {
      return parseExifPayload(bytes, offset + 8, length);
    }

    offset += length + 12;
  }

  return cloneEmptyMetadata();
}

function parseWebpMetadata(bytes: Uint8Array): PhotographMetadata {
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') {
    return cloneEmptyMetadata();
  }

  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const type = readAscii(bytes, offset, 4);
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      offset + 4,
      true,
    );

    if (length > bytes.length - offset - 8) {
      break;
    }

    if (type === 'EXIF') {
      return parseExifPayload(bytes, offset + 8, length);
    }

    offset += 8 + length + (length % 2);
  }

  return cloneEmptyMetadata();
}

export function parsePhotographMetadata(bytes: Uint8Array): PhotographMetadata {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return parseJpegMetadata(bytes);
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return parsePngMetadata(bytes);
  }

  if (bytes.length >= 12) {
    return parseWebpMetadata(bytes);
  }

  return cloneEmptyMetadata();
}

function createAbortError(): Error {
  return new Error('The Library scan was cancelled.');
}

function createFallbackExtractor(): LibraryMetadataExtractor {
  return {
    dispose() {},
    async extract(file, signal) {
      if (signal?.aborted) {
        throw createAbortError();
      }

      const bytes = new Uint8Array(await file.slice(0, LIBRARY_METADATA_READ_LIMIT).arrayBuffer());

      if (signal?.aborted) {
        throw createAbortError();
      }

      return parsePhotographMetadata(bytes);
    },
  };
}

function createBrowserWorker(): MetadataWorkerLike | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  try {
    return new Worker(new URL('./libraryMetadataWorker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return null;
  }
}

export function createLibraryMetadataExtractor(
  options: { createWorker?: () => MetadataWorkerLike | null } = {},
): LibraryMetadataExtractor {
  const worker = options.createWorker?.() ?? createBrowserWorker();

  if (!worker) {
    return createFallbackExtractor();
  }

  let nextRequestId = 1;
  let disposed = false;
  const pending = new Map<
    number,
    { reject: (error: unknown) => void; resolve: (metadata: PhotographMetadata) => void }
  >();

  worker.onmessage = (event) => {
    const request = pending.get(event.data.id);

    if (!request) {
      return;
    }

    pending.delete(event.data.id);

    if (event.data.ok && event.data.metadata) {
      request.resolve(event.data.metadata);
    } else {
      request.reject(new Error(event.data.error ?? 'The EXIF worker could not read metadata.'));
    }
  };

  worker.onerror = () => {
    const error = new Error('The EXIF worker stopped while reading photograph metadata.');

    for (const request of pending.values()) {
      request.reject(error);
    }

    pending.clear();
  };

  return {
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      worker.terminate();

      for (const request of pending.values()) {
        request.reject(new Error('The EXIF worker was released.'));
      }

      pending.clear();
    },
    async extract(file, signal) {
      if (disposed) {
        throw new Error('The EXIF worker was released.');
      }

      if (signal?.aborted) {
        throw createAbortError();
      }

      const bytes = await file.slice(0, LIBRARY_METADATA_READ_LIMIT).arrayBuffer();

      if (signal?.aborted) {
        throw createAbortError();
      }

      const id = nextRequestId;
      nextRequestId += 1;

      return await new Promise<PhotographMetadata>((resolve, reject) => {
        let settled = false;
        const settleReject = (error: unknown) => {
          if (settled) {
            return;
          }

          settled = true;
          signal?.removeEventListener('abort', abort);
          reject(error);
        };
        const settleResolve = (metadata: PhotographMetadata) => {
          if (settled) {
            return;
          }

          settled = true;
          signal?.removeEventListener('abort', abort);
          resolve(metadata);
        };
        const abort = () => {
          pending.delete(id);
          settleReject(createAbortError());
        };

        pending.set(id, { reject: settleReject, resolve: settleResolve });
        signal?.addEventListener('abort', abort, { once: true });

        try {
          worker.postMessage({ bytes, id }, [bytes]);
        } catch (error) {
          pending.delete(id);
          settleReject(error);
        }
      });
    },
  };
}
