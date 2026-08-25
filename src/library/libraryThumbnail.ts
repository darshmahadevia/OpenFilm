export const LIBRARY_GRID_THUMBNAIL_MAX_WIDTH = 640;

export interface LibraryThumbnail {
  bytes: number;
  dispose: () => void;
  url: string;
}

function createCancellationError(): Error {
  return new Error('The Grid thumbnail was cancelled.');
}

function ensureObjectUrlSupport(): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('This browser cannot create a local Grid thumbnail.');
  }
}

export async function createLibraryGridThumbnail(
  file: File,
  options: { maxWidth?: number; signal?: AbortSignal } = {},
): Promise<LibraryThumbnail> {
  const signal = options.signal;

  if (signal?.aborted) {
    throw createCancellationError();
  }

  ensureObjectUrlSupport();
  const maxWidth = Math.max(
    160,
    Math.min(options.maxWidth ?? LIBRARY_GRID_THUMBNAIL_MAX_WIDTH, 640),
  );
  const createBitmap = globalThis.createImageBitmap;
  const Canvas = globalThis.OffscreenCanvas;

  if (typeof createBitmap !== 'function' || typeof Canvas !== 'function') {
    const url = URL.createObjectURL(file);

    return {
      bytes: Math.min(file.size, maxWidth * maxWidth * 4),
      dispose: () => URL.revokeObjectURL(url),
      url,
    };
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createBitmap(file, {
      resizeQuality: 'high',
      resizeWidth: maxWidth,
    });

    if (signal?.aborted) {
      throw createCancellationError();
    }

    const canvas = new Canvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('This browser cannot prepare a local Grid thumbnail.');
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    bitmap = null;
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });

    if (signal?.aborted) {
      throw createCancellationError();
    }

    const url = URL.createObjectURL(blob);

    return {
      bytes: blob.size,
      dispose: () => URL.revokeObjectURL(url),
      url,
    };
  } catch (error) {
    bitmap?.close();
    throw error;
  }
}
