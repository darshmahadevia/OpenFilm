import {
  calculateImageScale,
  createRenderer,
  describeRendererStatus,
  FRAGMENT_SHADER_SOURCE,
  getPreviewDimensions,
  getRendererStatus,
  MAX_PREVIEW_DIMENSION,
  neutralRendererAdjustments,
  TONE_CURVE_LUT_SIZE,
  type RendererStatus,
} from './renderer';
import { sourcePhotographFixtures } from '../import/sourcePhotographFixtures';

class RendererImage {
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  readonly removeAttribute = vi.fn();
  readonly style = { setProperty: vi.fn() };
  readonly decode = vi.fn(async () => undefined);

  set src(_objectUrl: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function createFakeWebGL2Context() {
  const uniformLocations = new Map<string, WebGLUniformLocation>();
  const gl = {
    ARRAY_BUFFER: 0x8892,
    CLAMP_TO_EDGE: 0x812f,
    COLOR_BUFFER_BIT: 0x4000,
    COMPILE_STATUS: 0x8b81,
    FLOAT: 0x1406,
    FRAGMENT_SHADER: 0x8b30,
    LINEAR: 0x2601,
    LINK_STATUS: 0x8b82,
    RGBA: 0x1908,
    STATIC_DRAW: 0x88e4,
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TRIANGLES: 0x0004,
    UNSIGNED_BYTE: 0x1401,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    VERTEX_SHADER: 0x8b31,
    activeTexture: vi.fn(),
    attachShader: vi.fn(),
    bindBuffer: vi.fn(),
    bindTexture: vi.fn(),
    bindVertexArray: vi.fn(),
    bufferData: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn(() => ({ kind: 'buffer' })),
    createProgram: vi.fn(() => ({ kind: 'program' })),
    createShader: vi.fn((type: number) => ({ kind: 'shader', type })),
    createTexture: vi.fn(() => ({ kind: 'texture' })),
    createVertexArray: vi.fn(() => ({ kind: 'vertex-array' })),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    deleteTexture: vi.fn(),
    deleteVertexArray: vi.fn(),
    drawArrays: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getAttribLocation: vi.fn((_, name: string) => (name === 'a_position' ? 0 : 1)),
    getProgramInfoLog: vi.fn(() => ''),
    getProgramParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    getShaderParameter: vi.fn(() => true),
    getUniformLocation: vi.fn((_, name: string) => {
      const location = uniformLocations.get(name) ?? ({ name } as unknown as WebGLUniformLocation);
      uniformLocations.set(name, location);
      return location;
    }),
    linkProgram: vi.fn(),
    pixelStorei: vi.fn(),
    shaderSource: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    texSubImage2D: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),
  } as unknown as WebGL2RenderingContext;

  return gl;
}

function createRendererFixture() {
  const canvas = document.createElement('canvas');
  const gl = createFakeWebGL2Context();
  const statuses: RendererStatus[] = [];
  const imageBitmaps: Array<{ close: ReturnType<typeof vi.fn> }> = [];
  const toBlob = vi.fn((callback: BlobCallback) => {
    callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });

  vi.spyOn(canvas, 'getContext').mockReturnValue(gl);
  Object.defineProperty(canvas, 'toBlob', {
    configurable: true,
    value: toBlob,
  });

  const renderer = createRenderer(canvas, {
    createImage: () => new RendererImage() as unknown as HTMLImageElement,
    createImageBitmap: vi.fn(async () => {
      const bitmap = {
        close: vi.fn(),
      } as unknown as ImageBitmap;
      imageBitmaps.push(bitmap as unknown as { close: ReturnType<typeof vi.fn> });
      return bitmap;
    }),
    onStatusChange: (status) => statuses.push(status),
  });

  if (!renderer) {
    throw new Error('The renderer fixture could not create a renderer.');
  }

  return { canvas, gl, imageBitmaps, renderer, statuses, toBlob };
}

describe('renderer capability and geometry helpers', () => {
  it('reports WebGL2 as unsupported when no canvas is available', () => {
    expect(getRendererStatus(null)).toBe('unsupported');
  });

  it('reports WebGL2 as available when the canvas exposes a WebGL2 context', () => {
    const canvas = {
      getContext: (contextId: string) => (contextId === 'webgl2' ? {} : null),
    } as unknown as HTMLCanvasElement;

    expect(getRendererStatus(canvas)).toBe('available');
  });

  it('treats a browser context failure as unsupported', () => {
    const canvas = {
      getContext: () => {
        throw new Error('context unavailable');
      },
    } as unknown as HTMLCanvasElement;

    expect(getRendererStatus(canvas)).toBe('unsupported');
  });

  it('bounds large sources without changing their aspect ratio', () => {
    expect(getPreviewDimensions(16_000, 8_000)).toEqual({
      height: 2048,
      width: MAX_PREVIEW_DIMENSION,
    });
    expect(getPreviewDimensions(1200, 800)).toEqual({ height: 800, width: 1200 });
  });

  it('fits a source inside the canvas without stretching it', () => {
    expect(calculateImageScale(1200, 800, 3, 4)).toEqual({ x: 0.5, y: 1 });
    expect(calculateImageScale(1200, 800, 9, 4)).toEqual({ x: 1, y: 0.6666666666666666 });
  });
});

describe('WebGL2 preview renderer', () => {
  it.each(sourcePhotographFixtures)(
    'uploads the stable $fileName source fixture to one texture',
    async (fixture) => {
      const { gl, imageBitmaps, renderer } = createRendererFixture();

      renderer.resize(1200, 800, 1);
      await renderer.replaceImage({
        height: fixture.height,
        objectUrl: `blob:${fixture.fileName}`,
        width: fixture.width,
      });

      expect(gl.texImage2D).toHaveBeenCalledTimes(2);
      expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 6);
      expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_exposure' }, 0);
      expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_contrast' }, 0);
      expect(imageBitmaps[0].close).toHaveBeenCalledTimes(1);
      renderer.dispose();
    },
  );

  it('passes a non-neutral adjustment through the fragment shader uniforms and redraws', async () => {
    const { gl, renderer } = createRendererFixture();

    await renderer.replaceImage({ height: 2, objectUrl: 'blob:landscape.png', width: 3 });
    const drawsBeforeAdjustment = (gl.drawArrays as ReturnType<typeof vi.fn>).mock.calls.length;

    renderer.setAdjustments({
      contrast: 25,
      exposure: 0.5,
      fade: 10,
      saturation: 40,
      temperature: 20,
      tint: -15,
      toneCurve: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.75 },
        { x: 1, y: 1 },
      ],
    });

    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_exposure' }, 0.5);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_contrast' }, 0.25);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_temperature' }, 0.2);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_tint' }, -0.15);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_saturation' }, 0.4);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_fade' }, 0.1);
    expect(gl.texSubImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      TONE_CURVE_LUT_SIZE,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      expect.any(Uint8Array),
    );
    expect((gl.drawArrays as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      drawsBeforeAdjustment,
    );
    expect(FRAGMENT_SHADER_SOURCE).toContain('exp2(u_exposure)');
    expect(FRAGMENT_SHADER_SOURCE).toContain('u_contrast');
    expect(FRAGMENT_SHADER_SOURCE).toContain('u_temperature');
    expect(FRAGMENT_SHADER_SOURCE).toContain('u_tint');
    expect(FRAGMENT_SHADER_SOURCE).toContain('u_saturation');
    expect(FRAGMENT_SHADER_SOURCE).toContain('u_fade');
    expect(FRAGMENT_SHADER_SOURCE).toContain('u_tone_curve');
    expect(FRAGMENT_SHADER_SOURCE).toContain('texture(u_tone_curve');
    expect(TONE_CURVE_LUT_SIZE).toBe(256);
    expect(neutralRendererAdjustments.toneCurve).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    renderer.dispose();
  });

  it('exports the visible source orientation as a JPEG and restores the preview buffer', async () => {
    const { canvas, renderer, toBlob } = createRendererFixture();

    renderer.resize(1200, 800, 1);
    await renderer.replaceImage({ height: 2, objectUrl: 'blob:landscape.png', width: 3 });

    const blob = await renderer.exportJpeg();

    expect(blob.type).toBe('image/jpeg');
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(800);
    renderer.dispose();
  });

  it('resizes the drawing buffer and reports a recoverable context loss', async () => {
    const { canvas, renderer, statuses } = createRendererFixture();

    renderer.resize(5000, 3000, 2);
    expect(canvas.width).toBe(MAX_PREVIEW_DIMENSION);
    expect(canvas.height).toBe(2458);

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(statuses).toContain('context-lost');
    expect(describeRendererStatus('context-lost')).toContain('Reload this page');
    renderer.dispose();
  });

  it('releases the GPU resources when disposed', () => {
    const { gl, renderer } = createRendererFixture();

    renderer.dispose();

    expect(gl.deleteBuffer).toHaveBeenCalled();
    expect(gl.deleteVertexArray).toHaveBeenCalled();
    expect(gl.deleteProgram).toHaveBeenCalled();
  });
});
