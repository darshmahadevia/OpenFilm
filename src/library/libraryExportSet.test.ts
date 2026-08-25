import type { LibraryPhotographRecord } from './libraryModel';
import {
  EXPORT_RENDERER_VERSION,
  createExportPlan,
  isFinalSetExportManifest,
  markExportComplete,
  reconcileExportManifest,
} from './libraryExportSet';

function photo(id: string, path: string): LibraryPhotographRecord {
  return {
    cameraSerial: null,
    captureTime: null,
    disposition: 'pick',
    fileName: path.split('/').at(-1)!,
    fingerprint: { byteSize: 10, lastModified: 1 },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: null,
    relativePath: path,
    sourceState: 'available',
    edit: { revision: 2 },
  };
}

describe('resumable final-set Export', () => {
  it('plans deterministic collision-safe names and records the complete fidelity binding', () => {
    const manifest = createExportPlan([photo('1', 'a/frame.jpg'), photo('2', 'b/frame.jpg')], {
      existingDestinationPaths: new Set(['FRAME.JPG']),
      format: 'jpeg',
      preserveSourceFolders: false,
      quality: 0.9,
    });
    expect(manifest.entries.map((entry) => entry.destinationPath)).toEqual([
      'frame-2.jpg',
      'frame-3.jpg',
    ]);
    expect(manifest.entries[0]).toMatchObject({
      editRevision: 2,
      rendererVersion: EXPORT_RENDERER_VERSION,
      sourceFingerprint: { byteSize: 10, lastModified: 1 },
      state: 'pending',
    });
    expect(manifest).toMatchObject({
      renderer: { name: 'OpenFilm WebGL2 renderer', version: EXPORT_RENDERER_VERSION },
      settings: { format: 'jpeg', preserveSourceFolders: false, quality: 0.9 },
    });
    expect(isFinalSetExportManifest(JSON.parse(JSON.stringify(manifest)))).toBe(true);
  });

  it('resumes only a checksum-valid output with the same source, Edit, renderer, and settings', () => {
    const photograph = photo('1', 'frame.jpg');
    const planned = createExportPlan([photograph], {
      existingDestinationPaths: new Set(),
      format: 'jpeg',
      preserveSourceFolders: false,
      quality: 0.9,
    });
    const completed = markExportComplete(planned, '1', 'abc123');
    expect(
      reconcileExportManifest(completed, [photograph], new Map([['frame.jpg', 'abc123']]))
        .entries[0].state,
    ).toBe('complete');
    expect(
      reconcileExportManifest(
        completed,
        [{ ...photograph, edit: { revision: 3 } }],
        new Map([['frame.jpg', 'abc123']]),
      ).entries[0].state,
    ).toBe('pending');
    expect(
      reconcileExportManifest(completed, [photograph], new Map([['frame.jpg', 'different']]))
        .entries[0].state,
    ).toBe('pending');
    expect(
      reconcileExportManifest(completed, [photograph], new Map([['frame.jpg', 'abc123']]), {
        format: 'jpeg',
        preserveSourceFolders: false,
        quality: 0.8,
      }).entries[0].state,
    ).toBe('pending');
  });
});
