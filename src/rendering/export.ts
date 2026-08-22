import {
  getGeometryOutputDimensions,
  type GeometryDimensions,
  type GeometryValues,
} from '../editor/geometry';

export const exportFormats = ['jpeg', 'png', 'webp'] as const;

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return exportFormats.includes(value as ExportFormat);
}

export function getExportFormatOption(format: ExportFormat): ExportFormatOption {
  return exportFormatOptions.find((option) => option.value === format) ?? exportFormatOptions[0];
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
