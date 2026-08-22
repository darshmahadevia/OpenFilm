import {
  cropForAspectRatio,
  createGeometryHistory,
  CROP_MIN_SIZE,
  deserializeGeometry,
  geometryReducer,
  getGeometryOutputDimensions,
  hasNonNeutralGeometry,
  mapOutputUvToSourceUv,
  neutralGeometry,
  resizeCrop,
  serializeGeometry,
} from './geometry';

describe('normalized Edit geometry', () => {
  it('starts neutral and clamps crop values to the image', () => {
    const history = createGeometryHistory({
      crop: { height: 2, width: 2, x: 0.9, y: -1 },
      rotation: 90,
    });

    expect(history.present.crop.height).toBe(1);
    expect(history.present.crop.width).toBeCloseTo(0.1);
    expect(history.present.crop.x).toBe(0.9);
    expect(history.present.crop.y).toBe(0);
    expect(history.present.rotation).toBe(90);
    expect(createGeometryHistory().present).toEqual(neutralGeometry);
    expect(hasNonNeutralGeometry(history.present)).toBe(true);
  });

  it('fits common aspect ratios inside the current crop in normalized coordinates', () => {
    expect(cropForAspectRatio(neutralGeometry.crop, '1:1', 1200, 800)).toEqual({
      height: 1,
      width: 0.6666666666666666,
      x: 0.16666666666666669,
      y: 0,
    });
    expect(cropForAspectRatio(neutralGeometry.crop, 'original', 1200, 800)).toEqual(
      neutralGeometry.crop,
    );
  });

  it('keeps free crop handles inside the source and above the minimum size', () => {
    expect(resizeCrop({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, 'top-left', -1, -1)).toEqual({
      height: 0.7,
      width: 0.7,
      x: 0,
      y: 0,
    });
    const minimumCrop = resizeCrop(
      { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      'bottom-right',
      -1,
      -1,
    );
    expect(minimumCrop.x).toBe(0.2);
    expect(minimumCrop.y).toBe(0.2);
    expect(minimumCrop.width).toBeCloseTo(CROP_MIN_SIZE);
    expect(minimumCrop.height).toBeCloseTo(CROP_MIN_SIZE);
  });

  it('uses the rotated crop dimensions for preview and export buffers', () => {
    expect(
      getGeometryOutputDimensions(
        { height: 800, width: 1200 },
        { ...neutralGeometry, crop: { height: 0.5, width: 0.5, x: 0.25, y: 0.25 }, rotation: 90 },
      ),
    ).toEqual({ height: 600, width: 400 });
  });

  it('maps output corners through crop, rotation, and flips', () => {
    const geometry = {
      ...neutralGeometry,
      crop: { height: 0.5, width: 0.5, x: 0.25, y: 0.1 },
      flipHorizontal: true,
      rotation: 90 as const,
    };

    expect(mapOutputUvToSourceUv({ x: 0, y: 0 }, geometry)).toEqual({ x: 0.25, y: 0.1 });
    expect(mapOutputUvToSourceUv({ x: 1, y: 1 }, geometry)).toEqual({ x: 0.75, y: 0.6 });
  });

  it('round trips geometry and keeps it outside adjustment-shaped data', () => {
    const values = {
      ...neutralGeometry,
      crop: { height: 0.72, width: 0.64, x: 0.18, y: 0.09 },
      flipVertical: true,
      rotation: 270 as const,
    };

    expect(deserializeGeometry(serializeGeometry(values))).toEqual(values);
    expect(serializeGeometry(values)).not.toContain('exposure');
    expect(() => deserializeGeometry('{"rotation":"90"}')).toThrow('geometry state');
  });
});

describe('geometry history', () => {
  it('makes crop, rotation, flips, reset, undo, and redo explicit history steps', () => {
    let state = createGeometryHistory();

    state = geometryReducer(state, {
      type: 'set-crop',
      crop: { height: 0.8, width: 0.8, x: 0.1, y: 0.1 },
    });
    state = geometryReducer(state, { type: 'set-rotation', rotation: 180 });
    state = geometryReducer(state, { type: 'toggle-flip-horizontal' });
    state = geometryReducer(state, { type: 'reset' });

    expect(state.present).toEqual(neutralGeometry);
    expect(state.past).toHaveLength(4);

    state = geometryReducer(state, { type: 'undo' });
    expect(state.present.flipHorizontal).toBe(true);
    state = geometryReducer(state, { type: 'redo' });
    expect(state.present).toEqual(neutralGeometry);

    state = geometryReducer(state, { type: 'replace-source' });
    expect(state).toEqual(createGeometryHistory());
  });
});
