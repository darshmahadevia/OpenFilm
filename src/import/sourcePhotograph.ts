export const SOURCE_PHOTOGRAPH_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type SourcePhotographMimeType = (typeof SOURCE_PHOTOGRAPH_MIME_TYPES)[number];

export const MAX_SOURCE_PHOTOGRAPH_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_SOURCE_PHOTOGRAPH_DIMENSION = 16_384;
export const MAX_SOURCE_PHOTOGRAPH_PIXELS = 80_000_000;
export const SOURCE_PHOTOGRAPH_IMAGE_ORIENTATION = 'from-image';

export type SourcePhotographImportErrorCode =
  | 'browser-unavailable'
  | 'decode-failed'
  | 'dimensions-too-large'
  | 'invalid-dimensions'
  | 'unsupported-type'
  | 'file-too-large';

export class SourcePhotographImportError extends Error {
  readonly code: SourcePhotographImportErrorCode;

  constructor(code: SourcePhotographImportErrorCode, message: string) {
    super(message);
    this.name = 'SourcePhotographImportError';
    this.code = code;
  }
}

export interface ImportedSourcePhotograph {
  file: File;
  fileName: string;
  mimeType: SourcePhotographMimeType;
  objectUrl: string;
  width: number;
  height: number;
}

export interface SourcePhotographImportDependencies {
  createImage?: () => HTMLImageElement;
  createObjectUrl?: (file: File) => string;
  revokeObjectUrl?: (objectUrl: string) => void;
}

interface DecodedSourcePhotograph {
  height: number;
  width: number;
}

function createBrowserObjectUrl(file: File): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new SourcePhotographImportError(
      'browser-unavailable',
      'This browser cannot create a local preview for the source photograph.',
    );
  }

  return URL.createObjectURL(file);
}

function revokeBrowserObjectUrl(objectUrl: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(objectUrl);
  }
}

function createBrowserImage(): HTMLImageElement {
  if (typeof Image === 'undefined') {
    throw new SourcePhotographImportError(
      'browser-unavailable',
      'This browser cannot decode a source photograph.',
    );
  }

  return new Image();
}

function isSourcePhotographMimeType(value: string): value is SourcePhotographMimeType {
  return SOURCE_PHOTOGRAPH_MIME_TYPES.includes(value as SourcePhotographMimeType);
}

function validateDimensions({ height, width }: DecodedSourcePhotograph): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new SourcePhotographImportError(
      'invalid-dimensions',
      'The source photograph has no usable dimensions.',
    );
  }

  if (
    width > MAX_SOURCE_PHOTOGRAPH_DIMENSION ||
    height > MAX_SOURCE_PHOTOGRAPH_DIMENSION ||
    width * height > MAX_SOURCE_PHOTOGRAPH_PIXELS
  ) {
    throw new SourcePhotographImportError(
      'dimensions-too-large',
      'The source photograph dimensions are too large for a reliable browser preview.',
    );
  }
}

async function decodeSourcePhotograph(
  image: HTMLImageElement,
  objectUrl: string,
): Promise<DecodedSourcePhotograph> {
  image.decoding = 'async';
  image.style.setProperty('image-orientation', SOURCE_PHOTOGRAPH_IMAGE_ORIENTATION);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('The browser could not decode the source photograph.'));
      image.src = objectUrl;
    });

    if (typeof image.decode === 'function') {
      await image.decode();
    }

    return {
      height: image.naturalHeight,
      width: image.naturalWidth,
    };
  } finally {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute('src');
  }
}

export function formatSourcePhotographFileSizeLimit(): string {
  return `${MAX_SOURCE_PHOTOGRAPH_FILE_SIZE / (1024 * 1024)} MiB`;
}

export function describeSourcePhotographImportError(error: unknown, fileName: string): string {
  const name = `“${fileName}”`;

  if (!(error instanceof SourcePhotographImportError)) {
    return `OpenFilm could not read ${name}. The file may be damaged or not a real JPEG, PNG, or WebP.`;
  }

  switch (error.code) {
    case 'unsupported-type':
      return `${name} is not a supported source photograph. Choose a JPEG, PNG, or WebP file.`;
    case 'file-too-large':
      return `${name} is too large. Choose a source photograph at most ${formatSourcePhotographFileSizeLimit()}.`;
    case 'invalid-dimensions':
      return `${name} does not have usable dimensions. Choose a non-empty source photograph.`;
    case 'dimensions-too-large':
      return `${name} is too large to preview reliably. Choose a source photograph no larger than ${MAX_SOURCE_PHOTOGRAPH_DIMENSION.toLocaleString()} pixels on either side and ${MAX_SOURCE_PHOTOGRAPH_PIXELS.toLocaleString()} total pixels.`;
    case 'browser-unavailable':
      return `This browser could not create a local preview for ${name}. Try a current browser with image support.`;
    case 'decode-failed':
      return `OpenFilm could not read ${name}. The file may be damaged or not a real JPEG, PNG, or WebP.`;
  }
}

export async function importSourcePhotograph(
  file: File,
  dependencies: SourcePhotographImportDependencies = {},
): Promise<ImportedSourcePhotograph> {
  const mimeType = file.type.toLowerCase();

  if (!isSourcePhotographMimeType(mimeType)) {
    throw new SourcePhotographImportError(
      'unsupported-type',
      'The selected file type is not supported.',
    );
  }

  if (file.size > MAX_SOURCE_PHOTOGRAPH_FILE_SIZE) {
    throw new SourcePhotographImportError(
      'file-too-large',
      'The selected source photograph is larger than the supported file-size limit.',
    );
  }

  const createObjectUrl = dependencies.createObjectUrl ?? createBrowserObjectUrl;
  const revokeObjectUrl = dependencies.revokeObjectUrl ?? revokeBrowserObjectUrl;
  let objectUrl: string | null = null;
  let ownershipTransferred = false;

  try {
    try {
      objectUrl = createObjectUrl(file);
    } catch (error) {
      if (error instanceof SourcePhotographImportError) {
        throw error;
      }

      throw new SourcePhotographImportError(
        'browser-unavailable',
        'This browser cannot create a local preview for the source photograph.',
      );
    }

    if (!objectUrl) {
      throw new SourcePhotographImportError(
        'browser-unavailable',
        'This browser cannot create a local preview for the source photograph.',
      );
    }

    let image: HTMLImageElement;

    try {
      image = (dependencies.createImage ?? createBrowserImage)();
    } catch (error) {
      if (error instanceof SourcePhotographImportError) {
        throw error;
      }

      throw new SourcePhotographImportError(
        'browser-unavailable',
        'This browser cannot decode a source photograph.',
      );
    }

    let dimensions: DecodedSourcePhotograph;

    try {
      dimensions = await decodeSourcePhotograph(image, objectUrl);
    } catch (error) {
      if (error instanceof SourcePhotographImportError) {
        throw error;
      }

      throw new SourcePhotographImportError(
        'decode-failed',
        'The browser could not decode the selected source photograph.',
      );
    }

    validateDimensions(dimensions);
    ownershipTransferred = true;

    return {
      file,
      fileName: file.name,
      height: dimensions.height,
      mimeType,
      objectUrl,
      width: dimensions.width,
    };
  } catch (error) {
    if (!ownershipTransferred && objectUrl) {
      revokeObjectUrl(objectUrl);
    }

    throw error;
  }
}

export function releaseSourcePhotographObjectUrl(objectUrl: string): void {
  revokeBrowserObjectUrl(objectUrl);
}
