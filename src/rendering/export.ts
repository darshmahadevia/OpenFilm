import {
  getGeometryOutputDimensions,
  type GeometryDimensions,
  type GeometryValues,
} from '../editor/geometry';

export const exportFormats = ['jpeg', 'png', 'webp'] as const;

/** The largest export edge OpenFilm will ask a browser canvas to allocate. */
export const MAX_EXPORT_DIMENSION = 16_384;
/** The largest export pixel count OpenFilm will ask a browser canvas to allocate. */
export const MAX_EXPORT_PIXELS = 80_000_000;
/** Exports at or above this size can consume enough pixel memory to fail on ordinary devices. */
export const EXPORT_ALLOCATION_WARNING_PIXELS = 24_000_000;
/** A long edge at this size is worth warning about even when the other edge is narrow. */
export const EXPORT_ALLOCATION_WARNING_LONG_EDGE = 8_192;

export type ExportFormat = (typeof exportFormats)[number];

export interface ExportFormatOption {
  readonly extension: string;
  readonly label: string;
  readonly lossy: boolean;
  readonly mimeType: `image/${string}`;
  readonly value: ExportFormat;
}

export const exportFormatOptions: readonly ExportFormatOption[] = [
  {
    extension: 'jpg',
    label: 'JPEG',
    lossy: true,
    mimeType: 'image/jpeg',
    value: 'jpeg',
  },
  {
    extension: 'png',
    label: 'PNG',
    lossy: false,
    mimeType: 'image/png',
    value: 'png',
  },
  {
    extension: 'webp',
    label: 'WebP',
    lossy: true,
    mimeType: 'image/webp',
    value: 'webp',
  },
];

export interface ExportOptions {
  format: ExportFormat;
  maximumLongEdge: number | null;
  quality: number;
}

export const defaultExportOptions: Readonly<ExportOptions> = Object.freeze({
  format: 'jpeg',
  maximumLongEdge: null,
  quality: 92,
});

export type ExportDimensions = GeometryDimensions;

export type ExportDimensionIssueCode =
  'invalid-dimensions' | 'pixels-too-large' | 'dimension-too-large';

export interface ExportDimensionIssue {
  code: ExportDimensionIssueCode;
  dimensions: ExportDimensions;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return exportFormats.includes(value as ExportFormat);
}

export function getExportFormatOption(format: ExportFormat): ExportFormatOption {
  return exportFormatOptions.find((option) => option.value === format) ?? exportFormatOptions[0];
}

export function getExportDimensionIssue(dimensions: ExportDimensions): ExportDimensionIssue | null {
  if (
    !Number.isSafeInteger(dimensions.width) ||
    !Number.isSafeInteger(dimensions.height) ||
    dimensions.width < 1 ||
    dimensions.height < 1
  ) {
    return { code: 'invalid-dimensions', dimensions };
  }

  if (dimensions.width > MAX_EXPORT_DIMENSION || dimensions.height > MAX_EXPORT_DIMENSION) {
    return { code: 'dimension-too-large', dimensions };
  }

  if (dimensions.width * dimensions.height > MAX_EXPORT_PIXELS) {
    return { code: 'pixels-too-large', dimensions };
  }

  return null;
}

export function describeExportDimensionIssue(issue: ExportDimensionIssue): string {
  const dimensions = `${issue.dimensions.width.toLocaleString()} × ${issue.dimensions.height.toLocaleString()}`;

  switch (issue.code) {
    case 'invalid-dimensions':
      return `OpenFilm could not determine safe export dimensions for ${dimensions} pixels. Choose a smaller crop or maximum long edge.`;
    case 'dimension-too-large':
      return `The ${dimensions}-pixel export exceeds the ${MAX_EXPORT_DIMENSION.toLocaleString()}-pixel edge limit. Choose a smaller maximum long edge or crop the Edit.`;
    case 'pixels-too-large':
      return `The ${dimensions}-pixel export exceeds the ${MAX_EXPORT_PIXELS.toLocaleString()}-pixel allocation limit. Choose a smaller maximum long edge or crop the Edit.`;
  }
}

export function isLikelyOversizedExport(dimensions: ExportDimensions): boolean {
  if (getExportDimensionIssue(dimensions)) {
    return false;
  }

  return (
    dimensions.width * dimensions.height >= EXPORT_ALLOCATION_WARNING_PIXELS ||
    Math.max(dimensions.width, dimensions.height) >= EXPORT_ALLOCATION_WARNING_LONG_EDGE
  );
}

export function describeExportAllocationWarning(dimensions: ExportDimensions): string {
  const pixelBytes = dimensions.width * dimensions.height * 4;
  const pixelMiB = Math.max(1, Math.round(pixelBytes / (1024 * 1024)));

  return `This ${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} export may need about ${pixelMiB.toLocaleString()} MiB of browser pixel memory. If allocation fails, choose a smaller maximum long edge.`;
}

export function isLossyExportFormat(format: ExportFormat): boolean {
  return getExportFormatOption(format).lossy;
}

export function normalizeMaximumLongEdge(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Math.floor(Number(value));

  if (!Number.isFinite(normalized) || normalized < 1) {
    return null;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, normalized);
}

export function normalizeExportOptions(options: Partial<ExportOptions> = {}): ExportOptions {
  const quality =
    typeof options.quality === 'number' && Number.isFinite(options.quality)
      ? options.quality
      : defaultExportOptions.quality;

  return {
    format: isExportFormat(options.format) ? options.format : defaultExportOptions.format,
    maximumLongEdge: normalizeMaximumLongEdge(options.maximumLongEdge),
    quality: clamp(quality, 1, 100),
  };
}

export function getExportDimensions(
  source: GeometryDimensions,
  geometry: GeometryValues,
  maximumLongEdge: number | null = null,
): ExportDimensions {
  const sourceDimensions = getGeometryOutputDimensions(source, geometry);
  const normalizedMaximumLongEdge = normalizeMaximumLongEdge(maximumLongEdge);

  if (
    normalizedMaximumLongEdge === null ||
    Math.max(sourceDimensions.width, sourceDimensions.height) <= normalizedMaximumLongEdge
  ) {
    return sourceDimensions;
  }

  const scale =
    normalizedMaximumLongEdge / Math.max(sourceDimensions.width, sourceDimensions.height);

  return {
    height: Math.max(1, Math.round(sourceDimensions.height * scale)),
    width: Math.max(1, Math.round(sourceDimensions.width * scale)),
  };
}

export function getExportSourceDimensions(
  source: GeometryDimensions,
  geometry: GeometryValues,
  maximumLongEdge: number | null = null,
): GeometryDimensions {
  const sourceDimensions = getGeometryOutputDimensions(source, geometry);
  const outputDimensions = getExportDimensions(source, geometry, maximumLongEdge);
  const scale = Math.min(
    1,
    outputDimensions.width / sourceDimensions.width,
    outputDimensions.height / sourceDimensions.height,
  );

  return {
    height: Math.max(1, Math.round(source.height * scale)),
    width: Math.max(1, Math.round(source.width * scale)),
  };
}

export function getExportFileName(fileName: string, format: ExportFormat): string {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'openfilm';
  return `${baseName}-openfilm.${getExportFormatOption(format).extension}`;
}
