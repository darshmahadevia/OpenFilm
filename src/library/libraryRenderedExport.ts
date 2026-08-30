import type { ExportFormat } from '../rendering/export';
import { createRenderer } from '../rendering/renderer';
import type { LibraryPhotographRecord } from './libraryModel';
import { getLibraryEdit } from './libraryReview';

function imageDimensions(objectUrl: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () =>
      reject(new Error('OpenFilm could not decode a Source photograph for Export.'));
    image.src = objectUrl;
  });
}

export async function renderLibraryPhotograph(
  file: File,
  photograph: LibraryPhotographRecord,
  options: { format: ExportFormat; quality: number },
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted();
  const objectUrl = URL.createObjectURL(file);
  const canvas = document.createElement('canvas');
  const renderer = createRenderer(canvas);
  if (!renderer) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('This browser does not provide the WebGL2 renderer OpenFilm needs for Export.');
  }
  try {
    const dimensions = await imageDimensions(objectUrl);
    signal?.throwIfAborted();
    const edit = getLibraryEdit(photograph);
    await renderer.replaceImage({ ...dimensions, objectUrl });
    signal?.throwIfAborted();
    renderer.setAdjustments(edit.adjustments);
    renderer.setGeometry(edit.geometry);
    renderer.setGrainSeed(edit.grainSeed);
    const rendered = await renderer.exportImage(options);
    signal?.throwIfAborted();
    return rendered;
  } finally {
    renderer.dispose();
    URL.revokeObjectURL(objectUrl);
  }
}
