import { neutralGeometry } from '../editor/geometry';
import {
  defaultExportOptions,
  exportFormatOptions,
  getExportDimensions,
  getExportFileName,
  getExportSourceDimensions,
  isLossyExportFormat,
  normalizeExportOptions,
} from './export';

describe('image export options', () => {
  it('describes the supported formats and their lossless behavior', () => {
    expect(exportFormatOptions.map((option) => option.mimeType)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(isLossyExportFormat('jpeg')).toBe(true);
    expect(isLossyExportFormat('webp')).toBe(true);
    expect(isLossyExportFormat('png')).toBe(false);
  });

  it('normalizes quality and maximum dimensions without changing the format default', () => {
    expect(normalizeExportOptions({ quality: 140, maximumLongEdge: 2048 })).toEqual({
      format: defaultExportOptions.format,
      maximumLongEdge: 2048,
      quality: 100,
    });
    expect(normalizeExportOptions({ quality: -1, maximumLongEdge: Number.NaN })).toEqual({
      format: defaultExportOptions.format,
      maximumLongEdge: null,
      quality: 1,
    });
  });

  it('calculates cropped and rotated output dimensions without upscaling', () => {
    const geometry = {
      ...neutralGeometry,
      crop: { height: 0.5, width: 0.75, x: 0.1, y: 0.2 },
      rotation: 90 as const,
    };
    const source = { height: 800, width: 1200 };

    expect(getExportDimensions(source, geometry)).toEqual({ height: 900, width: 400 });
    expect(getExportDimensions(source, geometry, 600)).toEqual({ height: 600, width: 267 });
    expect(getExportDimensions(source, geometry, 2_000)).toEqual({ height: 900, width: 400 });
    expect(getExportSourceDimensions(source, geometry, 600)).toEqual({ height: 533, width: 800 });
  });

  it('creates format-specific filenames from the source name', () => {
    expect(getExportFileName('portrait.source.jpg', 'jpeg')).toBe('portrait.source-openfilm.jpg');
    expect(getExportFileName('portrait.source.jpg', 'png')).toBe('portrait.source-openfilm.png');
    expect(getExportFileName('portrait.source.jpg', 'webp')).toBe('portrait.source-openfilm.webp');
    expect(getExportFileName('.jpg', 'jpeg')).toBe('openfilm-openfilm.jpg');
  });
});
