import { neutralGeometry } from '../editor/geometry';
import {
  BoundedComparisonResources,
  createComparisonState,
  mapSourceFocalPointToPane,
  setComparisonZoom,
} from './libraryComparison';

export async function runComparisonBrowserHarness() {
  const source = new OffscreenCanvas(8_000, 5_625);
  const context = source.getContext('2d');
  if (!context) throw new Error('The browser did not provide a controlled canvas fixture.');
  context.fillStyle = '#42637a';
  context.fillRect(0, 0, source.width, source.height);
  const bitmaps: ImageBitmap[] = [];
  for (let index = 0; index < 4; index += 1) {
    bitmaps.push(
      await createImageBitmap(source, 0, 0, source.width, source.height, {
        resizeHeight: 450,
        resizeQuality: 'high',
        resizeWidth: 640,
      }),
    );
  }
  source.width = 1;
  source.height = 1;

  const bytesPerDerivative = 640 * 450 * 4;
  const admitted = new BoundedComparisonResources(bytesPerDerivative * 4);
  const paneCounts: number[] = [];
  for (let index = 0; index < bitmaps.length; index += 1) {
    const bitmap = bitmaps[index];
    const pane = new OffscreenCanvas(640, 450);
    pane.getContext('2d')?.drawImage(bitmap, 0, 0);
    admitted.admit(`pane-${index}`, bytesPerDerivative, () => bitmap.close());
    if (index > 0) paneCounts.push(admitted.snapshot().count);
  }

  let comparison = createComparisonState(['one', 'two', 'three', 'four']);
  comparison = setComparisonZoom(comparison, 'one', 2, { x: 0.82, y: 0.21 });
  const mapped = mapSourceFocalPointToPane(comparison.focalPoint, {
    ...neutralGeometry,
    crop: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
    flipHorizontal: true,
    rotation: 90,
  });
  const pressure = new BoundedComparisonResources(bytesPerDerivative * 2);
  let disposed = 0;
  for (let index = 0; index < 3; index += 1) {
    pressure.admit(`pressure-${index}`, bytesPerDerivative, () => {
      disposed += 1;
    });
  }
  const fallback = pressure.admit('full-source', 8_000 * 5_625 * 4, () => {
    disposed += 1;
  });
  const fallbackLabel = pressure.labelFor('full-source', '100%');
  admitted.dispose();
  pressure.dispose();

  return {
    admittedDerivativeBytes: bytesPerDerivative * 4,
    disposed,
    fallbackLabel,
    focalPoint: comparison.focalPoint,
    mapped,
    paneCounts,
    resolutionLimited: fallback.resolutionLimited,
    sourceDimensions: { height: 5_625, width: 8_000 },
  };
}
