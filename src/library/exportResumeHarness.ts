import {
  createExportPlan,
  markExportComplete,
  markExportFailed,
  reconcileExportManifest,
} from './libraryExportSet';
import type { LibraryPhotographRecord } from './libraryModel';

function photograph(id: string, fileName: string): LibraryPhotographRecord {
  return {
    cameraSerial: null,
    captureTime: null,
    disposition: 'pick',
    fileName,
    fingerprint: { byteSize: 10, lastModified: 1 },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: null,
    relativePath: fileName,
    sourceState: 'available',
    edit: { revision: 1 },
  };
}

export function runExportResumeBrowserHarness() {
  const photographs = [
    photograph('one', 'frame.jpg'),
    photograph('two', 'frame.jpg'),
    photograph('three', 'third.jpg'),
  ];
  const planned = createExportPlan(photographs, {
    existingDestinationPaths: new Set(['frame.jpg']),
    format: 'jpeg',
    preserveSourceFolders: false,
    quality: 0.92,
  });
  let interrupted = markExportComplete(planned, 'one', 'checksum-one');
  interrupted = markExportFailed(interrupted, 'two', 'Injected permission loss.');
  const resumed = reconcileExportManifest(
    interrupted,
    photographs,
    new Map([[interrupted.entries[0].destinationPath, 'checksum-one']]),
  );
  return {
    collisionPaths: planned.entries.map((entry) => entry.destinationPath),
    completedSkipped: resumed.entries[0].state === 'complete',
    failedRetried: resumed.entries[1].state === 'pending',
    pendingRetried: resumed.entries[2].state === 'pending',
  };
}
