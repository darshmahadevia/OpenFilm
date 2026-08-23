import {
  clampAdjustment,
  neutralAdjustments,
  normalizeAdjustments,
  type AdjustmentValues,
} from '../editor/adjustments';
import {
  DEFAULT_GRAIN_SEED,
  grainSeedToUniform,
  normalizeGrainSeed,
  type GrainSeed,
} from '../editor/grain';
import {
  getGeometryOutputDimensions,
  normalizeGeometry,
  neutralGeometry,
  type GeometryValues,
} from '../editor/geometry';
import { createToneCurveLookup, neutralToneCurve } from '../editor/toneCurve';
import {
  describeExportDimensionIssue,
  getExportDimensions,
  getExportDimensionIssue,
  getExportSourceDimensions,
  getExportFormatOption,
  normalizeExportOptions,
  type ExportOptions,
} from './export';

export type RendererStatus = 'available' | 'context-lost' | 'unsupported';

export type RendererAdjustments = AdjustmentValues;
export type RendererGeometry = GeometryValues;

export const neutralRendererAdjustments: RendererAdjustments = Object.freeze({
  ...neutralAdjustments,
});

export interface RendererSourcePhotograph {
  height: number;
  objectUrl: string;
  width: number;
}

export const MAX_PREVIEW_DIMENSION = 4096;

export interface PreviewDimensions {
  height: number;
  width: number;
}

export const LUMINANCE_HISTOGRAM_BINS = 32;
const HISTOGRAM_SAMPLE_DIMENSION = 64;

export interface LuminanceHistogram {
  bins: number[];
  max: number;
  sampleCount: number;
}

export function createLuminanceHistogram(
  pixels: ArrayLike<number>,
  binCount = LUMINANCE_HISTOGRAM_BINS,
): LuminanceHistogram {
  if (!Number.isInteger(binCount) || binCount < 2) {
    throw new RendererError('OpenFilm could not create a luminance histogram of that size.');
  }

  const bins = Array.from({ length: binCount }, () => 0);
  let sampleCount = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const luminance =
      (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255;
    const bucket = Math.min(binCount - 1, Math.floor(Math.max(0, luminance) * binCount));
    bins[bucket] += 1;
    sampleCount += 1;
  }

  return {
    bins,
    max: Math.max(...bins, 0),
    sampleCount,
  };
}

export interface RendererDependencies {
  createCanvas?: () => HTMLCanvasElement;
  createImage?: () => HTMLImageElement;
  createImageBitmap?: (
    image: ImageBitmapSource,
    options?: ImageBitmapOptions,
  ) => Promise<ImageBitmap>;
}

export interface RendererOptions extends RendererDependencies {
  onError?: (error: RendererError) => void;
  onStatusChange?: (status: RendererStatus) => void;
}

export interface PreviewRenderer {
  dispose(): void;
  exportImage(options?: Partial<ExportOptions>): Promise<Blob>;
  exportJpeg(): Promise<Blob>;
  getHistogram(): LuminanceHistogram | null;
  redraw(): void;
  replaceImage(source: RendererSourcePhotograph): Promise<void>;
  resize(displayWidth?: number, displayHeight?: number, devicePixelRatio?: number): void;
  setAdjustments(adjustments: RendererAdjustments): void;
  setGeometry(geometry: RendererGeometry): void;
  setGrainSeed(seed: GrainSeed): void;
}

export class RendererError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RendererError';
  }
}

export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_tex_coord;

uniform vec2 u_image_scale;

out vec2 v_tex_coord;

void main() {
  gl_Position = vec4(a_position * u_image_scale, 0.0, 1.0);
  v_tex_coord = a_tex_coord;
}`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D u_source;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_temperature;
uniform float u_tint;
uniform float u_saturation;
uniform float u_fade;
uniform float u_vignette_amount;
uniform float u_vignette_softness;
uniform float u_grain_amount;
uniform float u_grain_size;
uniform float u_grain_seed;
uniform float u_image_aspect;
uniform vec4 u_crop;
uniform bool u_flip_horizontal;
uniform bool u_flip_vertical;
uniform int u_rotation;
uniform sampler2D u_tone_curve;

in vec2 v_tex_coord;

out vec4 out_color;

float grainNoise(vec2 cell) {
  return fract(sin(dot(cell, vec2(12.9898, 78.233)) + u_grain_seed * 91.17) * 43758.5453);
}

void main() {
  vec2 output_uv = v_tex_coord;

  if (u_flip_horizontal) {
    output_uv.x = 1.0 - output_uv.x;
  }

  if (u_flip_vertical) {
    output_uv.y = 1.0 - output_uv.y;
  }

  vec2 crop_uv = output_uv;

  if (u_rotation == 90) {
    crop_uv = vec2(output_uv.y, 1.0 - output_uv.x);
  } else if (u_rotation == 180) {
    crop_uv = vec2(1.0 - output_uv.x, 1.0 - output_uv.y);
  } else if (u_rotation == 270) {
    crop_uv = vec2(1.0 - output_uv.y, output_uv.x);
  }

  vec2 source_uv = u_crop.xy + crop_uv * u_crop.zw;
  vec4 source = texture(u_source, source_uv);
  vec3 color = source.rgb * exp2(u_exposure);
  color = (color - 0.5) * (1.0 + u_contrast) + 0.5;
  color += vec3(0.10, 0.04, -0.10) * u_temperature;
  color += vec3(0.08, -0.08, 0.08) * u_tint;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luminance), color, 1.0 + u_saturation);
  color = mix(color, vec3(0.5), u_fade * 0.32);
  color = vec3(
    texture(u_tone_curve, vec2(clamp(color.r, 0.0, 1.0), 0.5)).r,
    texture(u_tone_curve, vec2(clamp(color.g, 0.0, 1.0), 0.5)).r,
    texture(u_tone_curve, vec2(clamp(color.b, 0.0, 1.0), 0.5)).r
  );

  vec2 centered = v_tex_coord - vec2(0.5);
  float aspect = max(u_image_aspect, 0.0001);
  float cornerDistance = length(centered * vec2(1.0, aspect)) / length(vec2(0.5, 0.5 * aspect));
  float vignetteSoftness = clamp(u_vignette_softness, 0.0, 1.0);
  float vignetteStart = mix(0.35, 0.9, vignetteSoftness);
  float vignetteMask = smoothstep(vignetteStart, 1.0, cornerDistance);
  color *= 1.0 - clamp(u_vignette_amount, 0.0, 1.0) * vignetteMask;

  float grainFrequency = mix(160.0, 12.0, clamp(u_grain_size, 0.0, 1.0));
  float grain = grainNoise(floor(v_tex_coord * grainFrequency)) - 0.5;
  color += grain * clamp(u_grain_amount, 0.0, 1.0) * 0.24;

  out_color = vec4(clamp(color, 0.0, 1.0), source.a);
}`;

export const TONE_CURVE_LUT_SIZE = 256;
const TONE_CURVE_TEXTURE_UNIT = 1;

interface GpuResources {
  crop: WebGLUniformLocation;
  flipHorizontal: WebGLUniformLocation;
  flipVertical: WebGLUniformLocation;
  imageAspect: WebGLUniformLocation;
  imageScale: WebGLUniformLocation;
  positionAttribute: number;
  program: WebGLProgram;
  source: WebGLUniformLocation;
  texture: WebGLTexture | null;
  toneCurve: WebGLUniformLocation;
  toneCurveTexture: WebGLTexture;
  texCoordAttribute: number;
  uniformContrast: WebGLUniformLocation;
  uniformExposure: WebGLUniformLocation;
  uniformFade: WebGLUniformLocation;
  uniformGrainAmount: WebGLUniformLocation;
  uniformGrainSeed: WebGLUniformLocation;
  uniformGrainSize: WebGLUniformLocation;
  uniformSaturation: WebGLUniformLocation;
  uniformTemperature: WebGLUniformLocation;
  uniformTint: WebGLUniformLocation;
  uniformVignetteAmount: WebGLUniformLocation;
  uniformVignetteSoftness: WebGLUniformLocation;
  vertexArray: WebGLVertexArrayObject;
  vertexBuffer: WebGLBuffer;
  rotation: WebGLUniformLocation;
}

interface PreparedImageSource {
  dimensions: PreviewDimensions;
  release: () => void;
  source: ImageBitmap | HTMLCanvasElement;
}

const QUAD_VERTICES = new Float32Array([
  -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1,
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function requireShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new RendererError('OpenFilm could not create a WebGL2 shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const details = gl.getShaderInfoLog(shader)?.trim();
    gl.deleteShader(shader);
    throw new RendererError(
      details
        ? `OpenFilm could not compile its WebGL2 shader: ${details}`
        : 'OpenFilm could not compile its WebGL2 shader.',
    );
  }

  return shader;
}

function requireAttribute(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): number {
  const location = gl.getAttribLocation(program, name);

  if (location < 0) {
    throw new RendererError(`OpenFilm could not find the WebGL2 attribute ${name}.`);
  }

  return location;
}

function requireUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);

  if (!location) {
    throw new RendererError(`OpenFilm could not find the WebGL2 uniform ${name}.`);
  }

  return location;
}

function createGpuResources(
  gl: WebGL2RenderingContext,
  initialToneCurve = neutralToneCurve,
): GpuResources {
  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  let vertexBuffer: WebGLBuffer | null = null;
  let toneCurveTexture: WebGLTexture | null = null;

  try {
    vertexShader = requireShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    fragmentShader = requireShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    program = gl.createProgram();

    if (!program) {
      throw new RendererError('OpenFilm could not create its WebGL2 program.');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const details = gl.getProgramInfoLog(program)?.trim();
      throw new RendererError(
        details
          ? `OpenFilm could not link its WebGL2 program: ${details}`
          : 'OpenFilm could not link its WebGL2 program.',
      );
    }

    vertexArray = gl.createVertexArray();
    vertexBuffer = gl.createBuffer();

    if (!vertexArray || !vertexBuffer) {
      throw new RendererError('OpenFilm could not create its WebGL2 geometry.');
    }

    const positionAttribute = requireAttribute(gl, program, 'a_position');
    const texCoordAttribute = requireAttribute(gl, program, 'a_tex_coord');

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordAttribute);
    gl.vertexAttribPointer(texCoordAttribute, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    gl.useProgram(program);

    const source = requireUniform(gl, program, 'u_source');
    gl.uniform1i(source, 0);
    const toneCurve = requireUniform(gl, program, 'u_tone_curve');
    gl.uniform1i(toneCurve, TONE_CURVE_TEXTURE_UNIT);
    toneCurveTexture = gl.createTexture();

    if (!toneCurveTexture) {
      throw new RendererError('OpenFilm could not create its tone curve lookup texture.');
    }

    gl.activeTexture(gl.TEXTURE0 + TONE_CURVE_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, toneCurveTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      TONE_CURVE_LUT_SIZE,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      createToneCurveLookup(initialToneCurve, TONE_CURVE_LUT_SIZE),
    );
    gl.activeTexture(gl.TEXTURE0);

    return {
      crop: requireUniform(gl, program, 'u_crop'),
      flipHorizontal: requireUniform(gl, program, 'u_flip_horizontal'),
      flipVertical: requireUniform(gl, program, 'u_flip_vertical'),
      imageAspect: requireUniform(gl, program, 'u_image_aspect'),
      imageScale: requireUniform(gl, program, 'u_image_scale'),
      positionAttribute,
      program,
      source,
      texture: null,
      toneCurve,
      toneCurveTexture,
      texCoordAttribute,
      uniformContrast: requireUniform(gl, program, 'u_contrast'),
      uniformExposure: requireUniform(gl, program, 'u_exposure'),
      uniformFade: requireUniform(gl, program, 'u_fade'),
      uniformGrainAmount: requireUniform(gl, program, 'u_grain_amount'),
      uniformGrainSeed: requireUniform(gl, program, 'u_grain_seed'),
      uniformGrainSize: requireUniform(gl, program, 'u_grain_size'),
      uniformSaturation: requireUniform(gl, program, 'u_saturation'),
      uniformTemperature: requireUniform(gl, program, 'u_temperature'),
      uniformTint: requireUniform(gl, program, 'u_tint'),
      uniformVignetteAmount: requireUniform(gl, program, 'u_vignette_amount'),
      uniformVignetteSoftness: requireUniform(gl, program, 'u_vignette_softness'),
      vertexArray,
      vertexBuffer,
      rotation: requireUniform(gl, program, 'u_rotation'),
    };
  } catch (error) {
    if (vertexArray) {
      gl.deleteVertexArray(vertexArray);
    }
    if (vertexBuffer) {
      gl.deleteBuffer(vertexBuffer);
    }
    if (toneCurveTexture) {
      gl.deleteTexture(toneCurveTexture);
    }
    if (program) {
      gl.deleteProgram(program);
    }

    throw error;
  } finally {
    if (vertexShader) {
      gl.deleteShader(vertexShader);
    }
    if (fragmentShader) {
      gl.deleteShader(fragmentShader);
    }
  }
}

function deleteTexture(gl: WebGL2RenderingContext, resources: GpuResources): void {
  if (resources.texture) {
    gl.deleteTexture(resources.texture);
    resources.texture = null;
  }
}

function deleteGpuResources(gl: WebGL2RenderingContext, resources: GpuResources): void {
  deleteTexture(gl, resources);
  gl.deleteTexture(resources.toneCurveTexture);
  gl.deleteBuffer(resources.vertexBuffer);
  gl.deleteVertexArray(resources.vertexArray);
  gl.deleteProgram(resources.program);
}

function updateToneCurveTexture(
  gl: WebGL2RenderingContext,
  resources: GpuResources,
  points: RendererAdjustments['toneCurve'],
): void {
  gl.activeTexture(gl.TEXTURE0 + TONE_CURVE_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, resources.toneCurveTexture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    TONE_CURVE_LUT_SIZE,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    createToneCurveLookup(points, TONE_CURVE_LUT_SIZE),
  );
  gl.activeTexture(gl.TEXTURE0);
}

function createBrowserImage(): HTMLImageElement {
  if (typeof Image === 'undefined') {
    throw new RendererError('This browser cannot decode a source photograph for WebGL2.');
  }

  return new Image();
}

function getBrowserImageBitmap(): RendererDependencies['createImageBitmap'] | undefined {
  if (typeof globalThis.createImageBitmap !== 'function') {
    return undefined;
  }

  return globalThis.createImageBitmap.bind(globalThis);
}

function createBrowserCanvas(): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new RendererError('This browser cannot prepare a bounded WebGL2 preview.');
  }

  return document.createElement('canvas');
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // Temporary canvases are otherwise released by garbage collection.
  }
}

function releaseImageBitmap(bitmap: ImageBitmap): void {
  try {
    bitmap.close();
  } catch {
    // A bitmap may already be closed by the browser after context loss.
  }
}

function loadSourceImage(
  source: RendererSourcePhotograph,
  createImage: () => HTMLImageElement,
): Promise<HTMLImageElement> {
  let image: HTMLImageElement;

  try {
    image = createImage();
  } catch (error) {
    throw error instanceof RendererError
      ? error
      : new RendererError('This browser could not create a source photograph decoder.');
  }

  if (!image) {
    throw new RendererError('This browser could not create a source photograph decoder.');
  }

  image.decoding = 'async';
  image.style.setProperty('image-orientation', 'from-image');
  let loaded = false;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();

      void decoded
        .then(() => {
          loaded = true;
          resolve(image);
        })
        .catch(() => {
          reject(
            new RendererError('The browser could not decode the source photograph for WebGL2.'),
          );
        });
    };
    image.onerror = () => {
      reject(new RendererError('The browser could not decode the source photograph for WebGL2.'));
    };
    image.src = source.objectUrl;
  }).finally(() => {
    image.onload = null;
    image.onerror = null;
    if (!loaded) {
      image.removeAttribute('src');
    }
  });
}

export function getPreviewDimensions(
  width: number,
  height: number,
  maximumDimension = MAX_PREVIEW_DIMENSION,
): PreviewDimensions {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isFinite(maximumDimension) ||
    maximumDimension < 1
  ) {
    throw new RendererError('The source photograph does not have usable preview dimensions.');
  }

  const scale = Math.min(1, maximumDimension / Math.max(width, height));

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export function calculateImageScale(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);
  const safeImageWidth = Math.max(1, imageWidth);
  const safeImageHeight = Math.max(1, imageHeight);
  const canvasAspect = safeCanvasWidth / safeCanvasHeight;
  const imageAspect = safeImageWidth / safeImageHeight;

  if (imageAspect >= canvasAspect) {
    return { x: 1, y: canvasAspect / imageAspect };
  }

  return { x: imageAspect / canvasAspect, y: 1 };
}

async function prepareImageSource(
  image: HTMLImageElement,
  source: RendererSourcePhotograph,
  dependencies: RendererDependencies,
  requestedDimensions = getPreviewDimensions(source.width, source.height),
): Promise<PreparedImageSource> {
  const dimensions = requestedDimensions;
  const createImageBitmap = dependencies.createImageBitmap ?? getBrowserImageBitmap();

  if (createImageBitmap) {
    try {
      const bitmap = await createImageBitmap(image, {
        imageOrientation: 'from-image',
        resizeHeight: dimensions.height,
        resizeQuality: 'high',
        resizeWidth: dimensions.width,
      });

      return {
        dimensions,
        release: () => releaseImageBitmap(bitmap),
        source: bitmap,
      };
    } catch {
      // The 2D canvas path only prepares the source texture. The adjustment pass remains WebGL2.
    }
  }

  const canvas = dependencies.createCanvas?.() ?? createBrowserCanvas();

  try {
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
      throw new RendererError('This browser could not allocate the bounded WebGL2 preview.');
    }

    const context = canvas.getContext('2d');

    if (!context) {
      throw new RendererError('This browser could not prepare a bounded WebGL2 preview.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    return {
      dimensions,
      release: () => releaseCanvas(canvas),
      source: canvas,
    };
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  }
}

function getCanvasDisplaySize(canvas: HTMLCanvasElement): { height: number; width: number } {
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width || canvas.clientWidth || canvas.width || 300;
  const height = bounds.height || canvas.clientHeight || canvas.height || 150;

  return {
    height: Math.max(1, height),
    width: Math.max(1, width),
  };
}

function describeRendererFailure(error: unknown): RendererError {
  if (error instanceof RendererError) {
    return error;
  }

  return new RendererError('OpenFilm could not prepare the source photograph for WebGL2.');
}

function getShaderAdjustmentValues(adjustments: RendererAdjustments) {
  return {
    contrast: clampAdjustment('contrast', adjustments.contrast) / 100,
    exposure: clampAdjustment('exposure', adjustments.exposure),
    fade: clampAdjustment('fade', adjustments.fade) / 100,
    grainAmount: clampAdjustment('grainAmount', adjustments.grainAmount) / 100,
    grainSize: clampAdjustment('grainSize', adjustments.grainSize) / 100,
    saturation: clampAdjustment('saturation', adjustments.saturation) / 100,
    temperature: clampAdjustment('temperature', adjustments.temperature) / 100,
    tint: clampAdjustment('tint', adjustments.tint) / 100,
    vignetteAmount: clampAdjustment('vignetteAmount', adjustments.vignetteAmount) / 100,
    vignetteSoftness: clampAdjustment('vignetteSoftness', adjustments.vignetteSoftness) / 100,
  };
}

class WebGL2PreviewRenderer implements PreviewRenderer {
  private adjustments: RendererAdjustments = { ...neutralRendererAdjustments };
  private contextLost = false;
  private disposed = false;
  private geometry: RendererGeometry = normalizeGeometry(neutralGeometry);
  private grainSeed: GrainSeed = DEFAULT_GRAIN_SEED;
  private histogramCanvas: HTMLCanvasElement | null = null;
  private histogramContext: CanvasRenderingContext2D | null = null;
  private imageDimensions: PreviewDimensions | null = null;
  private resources: GpuResources;
  private scheduledRender: number | null = null;
  private sourceRequest = 0;
  private source: RendererSourcePhotograph | null = null;

  private cancelScheduledRender(): void {
    if (this.scheduledRender !== null) {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.scheduledRender);
      }

      this.scheduledRender = null;
    }
  }

  private scheduleRender(): void {
    if (this.disposed || this.contextLost || this.scheduledRender !== null) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      this.redraw();
      return;
    }

    this.scheduledRender = window.requestAnimationFrame(() => {
      this.scheduledRender = null;

      if (!this.disposed && !this.contextLost) {
        this.redraw();
      }
    });
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.cancelScheduledRender();
    this.contextLost = true;
    this.sourceRequest += 1;
    this.imageDimensions = null;
    this.resources.texture = null;
    this.options.onStatusChange?.('context-lost');
  };

  private readonly handleContextRestored = () => {
    if (this.disposed) {
      return;
    }

    try {
      this.resources = createGpuResources(this.gl, this.adjustments.toneCurve);
      this.contextLost = false;
      this.options.onStatusChange?.('available');
      this.resize();

      if (this.source) {
        void this.replaceImage(this.source).catch((error: unknown) => {
          this.options.onError?.(describeRendererFailure(error));
        });
      } else {
        this.cancelScheduledRender();
        this.redraw();
      }
    } catch (error) {
      this.options.onError?.(describeRendererFailure(error));
      this.options.onStatusChange?.('unsupported');
    }
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly options: RendererOptions,
  ) {
    this.resources = createGpuResources(gl, this.adjustments.toneCurve);
    gl.clearColor(0.87, 0.866, 0.831, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private createExportTexture(
    prepared: PreparedImageSource,
    dimensions: PreviewDimensions,
  ): WebGLTexture {
    const dimensionIssue = getExportDimensionIssue(dimensions);

    if (dimensionIssue) {
      throw new RendererError(describeExportDimensionIssue(dimensionIssue));
    }

    if (typeof this.gl.getParameter === 'function') {
      const maximumTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);

      if (
        typeof maximumTextureSize === 'number' &&
        Number.isFinite(maximumTextureSize) &&
        (dimensions.width > maximumTextureSize || dimensions.height > maximumTextureSize)
      ) {
        throw new RendererError(
          `This browser's WebGL2 texture limit is too small for a ${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} export. Choose a smaller maximum long edge.`,
        );
      }
    }

    const texture = this.gl.createTexture();

    if (!texture) {
      throw new RendererError(
        `OpenFilm could not allocate a ${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} export. Choose a smaller maximum long edge.`,
      );
    }

    try {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        prepared.source,
      );

      if (typeof this.gl.getError === 'function') {
        const error = this.gl.getError();

        if (error !== undefined && error !== this.gl.NO_ERROR) {
          throw new RendererError(
            `OpenFilm could not allocate a ${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} export in WebGL2. Choose a smaller maximum long edge.`,
          );
        }
      }

      return texture;
    } catch (error) {
      this.gl.deleteTexture(texture);

      if (error instanceof RendererError) {
        throw error;
      }

      throw new RendererError(
        `OpenFilm could not allocate a ${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} export. Choose a smaller maximum long edge.`,
      );
    }
  }

  private encodeExport(format: ExportOptions['format'], quality: number): Promise<Blob> {
    const formatOption = getExportFormatOption(format);
    const errorMessage = `OpenFilm could not encode the ${formatOption.label} export. Try a smaller maximum long edge or a different format.`;

    return new Promise<Blob>((resolve, reject) => {
      const handleBlob: BlobCallback = (blob) => {
        if (!blob) {
          reject(new RendererError(errorMessage));
          return;
        }

        resolve(blob);
      };

      try {
        if (formatOption.lossy) {
          this.canvas.toBlob(handleBlob, formatOption.mimeType, quality / 100);
        } else {
          this.canvas.toBlob(handleBlob, formatOption.mimeType);
        }
      } catch {
        reject(new RendererError(errorMessage));
      }
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.cancelScheduledRender();
    this.sourceRequest += 1;
    this.source = null;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    if (!this.contextLost) {
      deleteGpuResources(this.gl, this.resources);
    }

    if (this.histogramCanvas) {
      releaseCanvas(this.histogramCanvas);
    }
    this.histogramContext = null;
    this.histogramCanvas = null;
  }

  redraw(outputDimensionsOverride?: PreviewDimensions): void {
    if (this.disposed || this.contextLost) {
      return;
    }

    const { gl, resources } = this;
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!resources.texture || !this.imageDimensions) {
      return;
    }

    const outputDimensions =
      outputDimensionsOverride ?? getGeometryOutputDimensions(this.imageDimensions, this.geometry);
    const scale = calculateImageScale(
      this.canvas.width,
      this.canvas.height,
      outputDimensions.width,
      outputDimensions.height,
    );
    const crop = this.geometry.crop;

    gl.useProgram(resources.program);
    gl.bindVertexArray(resources.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    gl.activeTexture(gl.TEXTURE0 + TONE_CURVE_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, resources.toneCurveTexture);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(resources.imageScale, scale.x, scale.y);
    gl.uniform1f(resources.imageAspect, outputDimensions.height / outputDimensions.width);
    gl.uniform4f(resources.crop, crop.x, crop.y, crop.width, crop.height);
    gl.uniform1i(resources.flipHorizontal, this.geometry.flipHorizontal ? 1 : 0);
    gl.uniform1i(resources.flipVertical, this.geometry.flipVertical ? 1 : 0);
    gl.uniform1i(resources.rotation, this.geometry.rotation);
    const shaderAdjustments = getShaderAdjustmentValues(this.adjustments);
    gl.uniform1f(resources.uniformExposure, shaderAdjustments.exposure);
    gl.uniform1f(resources.uniformContrast, shaderAdjustments.contrast);
    gl.uniform1f(resources.uniformTemperature, shaderAdjustments.temperature);
    gl.uniform1f(resources.uniformTint, shaderAdjustments.tint);
    gl.uniform1f(resources.uniformSaturation, shaderAdjustments.saturation);
    gl.uniform1f(resources.uniformFade, shaderAdjustments.fade);
    gl.uniform1f(resources.uniformVignetteAmount, shaderAdjustments.vignetteAmount);
    gl.uniform1f(resources.uniformVignetteSoftness, shaderAdjustments.vignetteSoftness);
    gl.uniform1f(resources.uniformGrainAmount, shaderAdjustments.grainAmount);
    gl.uniform1f(resources.uniformGrainSize, shaderAdjustments.grainSize);
    gl.uniform1f(resources.uniformGrainSeed, grainSeedToUniform(this.grainSeed));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  async replaceImage(source: RendererSourcePhotograph): Promise<void> {
    if (this.disposed) {
      return;
    }

    const request = this.sourceRequest + 1;
    this.sourceRequest = request;
    this.source = source;
    this.imageDimensions = null;

    if (this.contextLost) {
      return;
    }

    this.cancelScheduledRender();
    deleteTexture(this.gl, this.resources);
    this.redraw();

    let image: HTMLImageElement | null = null;
    try {
      image = await loadSourceImage(source, this.options.createImage ?? createBrowserImage);
      const prepared = await prepareImageSource(image, source, this.options);

      try {
        if (this.disposed || this.contextLost || request !== this.sourceRequest) {
          return;
        }

        const texture = this.gl.createTexture();

        if (!texture) {
          throw new RendererError('OpenFilm could not create a WebGL2 source texture.');
        }

        try {
          this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
          this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            prepared.source,
          );

          if (typeof this.gl.getError === 'function') {
            const error = this.gl.getError();

            if (error !== undefined && error !== this.gl.NO_ERROR) {
              throw new RendererError(
                'OpenFilm could not allocate the bounded source texture. Choose another photograph or a smaller one.',
              );
            }
          }

          this.resources.texture = texture;
          this.imageDimensions = prepared.dimensions;
        } catch (error) {
          this.gl.deleteTexture(texture);
          throw error;
        }

        this.redraw();
      } finally {
        prepared.release();
      }
    } finally {
      image?.removeAttribute('src');
    }
  }

  async exportImage(options: Partial<ExportOptions> = {}): Promise<Blob> {
    const normalizedOptions = normalizeExportOptions(options);
    const formatOption = getExportFormatOption(normalizedOptions.format);

    if (this.disposed || this.contextLost || !this.resources.texture || !this.imageDimensions) {
      throw new RendererError(
        `Import a source photograph before downloading the ${formatOption.label} export.`,
      );
    }

    if (typeof this.canvas.toBlob !== 'function') {
      throw new RendererError(`This browser cannot encode the ${formatOption.label} export.`);
    }

    const source = this.source;

    if (!source) {
      throw new RendererError(
        `Import a source photograph before downloading the ${formatOption.label} export.`,
      );
    }

    this.cancelScheduledRender();
    const request = this.sourceRequest;
    const outputDimensions = getExportDimensions(
      source,
      this.geometry,
      normalizedOptions.maximumLongEdge,
    );
    const outputDimensionIssue = getExportDimensionIssue(outputDimensions);

    if (outputDimensionIssue) {
      throw new RendererError(describeExportDimensionIssue(outputDimensionIssue));
    }

    const sourceDimensions = getExportSourceDimensions(
      source,
      this.geometry,
      normalizedOptions.maximumLongEdge,
    );
    const previewWidth = this.canvas.width;
    const previewHeight = this.canvas.height;
    const previewTexture = this.resources.texture;
    const previewImageDimensions = this.imageDimensions;
    let image: HTMLImageElement | null = null;
    let prepared: PreparedImageSource | null = null;
    let exportTexture: WebGLTexture | null = null;
    let exportStateActive = false;

    try {
      image = await loadSourceImage(source, this.options.createImage ?? createBrowserImage);
      prepared = await prepareImageSource(image, source, this.options, sourceDimensions);

      if (
        this.disposed ||
        this.contextLost ||
        request !== this.sourceRequest ||
        this.source !== source
      ) {
        throw new RendererError('The source photograph changed before export finished. Try again.');
      }

      exportTexture = this.createExportTexture(prepared, sourceDimensions);
      this.resources.texture = exportTexture;
      this.imageDimensions = sourceDimensions;
      exportStateActive = true;

      try {
        this.canvas.width = outputDimensions.width;
        this.canvas.height = outputDimensions.height;

        if (
          this.canvas.width !== outputDimensions.width ||
          this.canvas.height !== outputDimensions.height
        ) {
          throw new Error('The browser returned a smaller export drawing buffer.');
        }

        this.gl.viewport(0, 0, outputDimensions.width, outputDimensions.height);
      } catch {
        throw new RendererError(
          `OpenFilm could not allocate a ${outputDimensions.width.toLocaleString()} × ${outputDimensions.height.toLocaleString()} export. Choose a smaller maximum long edge.`,
        );
      }

      this.redraw(outputDimensions);
      const blob = await this.encodeExport(normalizedOptions.format, normalizedOptions.quality);

      if (
        this.disposed ||
        this.contextLost ||
        request !== this.sourceRequest ||
        this.source !== source
      ) {
        throw new RendererError('The source photograph changed before export finished. Try again.');
      }

      return blob;
    } catch (error) {
      if (error instanceof RendererError) {
        throw error;
      }

      throw new RendererError(
        `OpenFilm could not create the ${formatOption.label} export. Try a smaller maximum long edge or a different format.`,
      );
    } finally {
      const ownsExportState =
        exportStateActive &&
        !this.contextLost &&
        request === this.sourceRequest &&
        this.source === source &&
        this.resources.texture === exportTexture;

      if (ownsExportState) {
        try {
          this.resources.texture = previewTexture;
          this.imageDimensions = previewImageDimensions;
          this.canvas.width = previewWidth;
          this.canvas.height = previewHeight;
          this.gl.viewport(0, 0, previewWidth, previewHeight);
          this.redraw();
        } catch {
          this.resources.texture = previewTexture;
          this.imageDimensions = previewImageDimensions;
        }
      }

      if (exportTexture && !this.contextLost) {
        this.gl.deleteTexture(exportTexture);
      }

      if (
        exportStateActive &&
        previewTexture &&
        !this.contextLost &&
        previewTexture !== this.resources.texture
      ) {
        this.gl.deleteTexture(previewTexture);
      }

      prepared?.release();
      image?.removeAttribute('src');
    }
  }

  exportJpeg(): Promise<Blob> {
    return this.exportImage({ format: 'jpeg', maximumLongEdge: null, quality: 92 });
  }

  getHistogram(): LuminanceHistogram | null {
    if (
      this.disposed ||
      this.contextLost ||
      !this.resources.texture ||
      !this.imageDimensions ||
      this.canvas.width < 1 ||
      this.canvas.height < 1
    ) {
      return null;
    }

    try {
      if (!this.histogramCanvas) {
        this.histogramCanvas = this.options.createCanvas?.() ?? createBrowserCanvas();
        this.histogramCanvas.width = HISTOGRAM_SAMPLE_DIMENSION;
        this.histogramCanvas.height = HISTOGRAM_SAMPLE_DIMENSION;
      }

      if (!this.histogramContext) {
        this.histogramContext = this.histogramCanvas.getContext('2d', {
          willReadFrequently: true,
        });
      }

      if (this.histogramContext) {
        this.histogramContext.clearRect(
          0,
          0,
          HISTOGRAM_SAMPLE_DIMENSION,
          HISTOGRAM_SAMPLE_DIMENSION,
        );
        this.histogramContext.drawImage(
          this.canvas,
          0,
          0,
          HISTOGRAM_SAMPLE_DIMENSION,
          HISTOGRAM_SAMPLE_DIMENSION,
        );
        const pixels = this.histogramContext.getImageData(
          0,
          0,
          HISTOGRAM_SAMPLE_DIMENSION,
          HISTOGRAM_SAMPLE_DIMENSION,
        ).data;

        return createLuminanceHistogram(pixels);
      }
    } catch {
      // Fall through to the small WebGL readback when a 2D context is unavailable.
    }

    if (typeof this.gl.readPixels !== 'function') {
      return null;
    }

    try {
      const width = Math.min(HISTOGRAM_SAMPLE_DIMENSION, this.canvas.width);
      const height = Math.min(HISTOGRAM_SAMPLE_DIMENSION, this.canvas.height);
      const pixels = new Uint8Array(width * height * 4);
      this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
      return createLuminanceHistogram(pixels);
    } catch {
      return null;
    }
  }

  resize(
    displayWidth?: number,
    displayHeight?: number,
    devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  ): void {
    const displaySize =
      displayWidth === undefined || displayHeight === undefined
        ? getCanvasDisplaySize(this.canvas)
        : { height: displayHeight, width: displayWidth };
    const ratio = clamp(finiteOrDefault(devicePixelRatio, 1), 1, 2);
    const requestedWidth = Math.max(1, Math.round(displaySize.width * ratio));
    const requestedHeight = Math.max(1, Math.round(displaySize.height * ratio));
    const scale = Math.min(1, MAX_PREVIEW_DIMENSION / Math.max(requestedWidth, requestedHeight));
    const width = Math.max(1, Math.round(requestedWidth * scale));
    const height = Math.max(1, Math.round(requestedHeight * scale));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (!this.contextLost && !this.disposed) {
      this.gl.viewport(0, 0, width, height);
      this.scheduleRender();
    }
  }

  setAdjustments(adjustments: RendererAdjustments): void {
    this.adjustments = normalizeAdjustments(adjustments);

    if (!this.contextLost && !this.disposed) {
      this.gl.useProgram(this.resources.program);
      updateToneCurveTexture(this.gl, this.resources, this.adjustments.toneCurve);
      const shaderAdjustments = getShaderAdjustmentValues(this.adjustments);
      this.gl.uniform1f(this.resources.uniformExposure, shaderAdjustments.exposure);
      this.gl.uniform1f(this.resources.uniformContrast, shaderAdjustments.contrast);
      this.gl.uniform1f(this.resources.uniformTemperature, shaderAdjustments.temperature);
      this.gl.uniform1f(this.resources.uniformTint, shaderAdjustments.tint);
      this.gl.uniform1f(this.resources.uniformSaturation, shaderAdjustments.saturation);
      this.gl.uniform1f(this.resources.uniformFade, shaderAdjustments.fade);
      this.gl.uniform1f(this.resources.uniformVignetteAmount, shaderAdjustments.vignetteAmount);
      this.gl.uniform1f(this.resources.uniformVignetteSoftness, shaderAdjustments.vignetteSoftness);
      this.gl.uniform1f(this.resources.uniformGrainAmount, shaderAdjustments.grainAmount);
      this.gl.uniform1f(this.resources.uniformGrainSize, shaderAdjustments.grainSize);
      this.scheduleRender();
    }
  }

  setGeometry(geometry: RendererGeometry): void {
    this.geometry = normalizeGeometry(geometry);

    if (!this.contextLost && !this.disposed) {
      this.scheduleRender();
    }
  }

  setGrainSeed(seed: GrainSeed): void {
    this.grainSeed = normalizeGrainSeed(seed);

    if (!this.contextLost && !this.disposed) {
      this.gl.useProgram(this.resources.program);
      this.gl.uniform1f(this.resources.uniformGrainSeed, grainSeedToUniform(this.grainSeed));
      this.scheduleRender();
    }
  }
}

export function createRenderer(
  canvas: HTMLCanvasElement | null,
  options: RendererOptions = {},
): PreviewRenderer | null {
  if (!canvas) {
    options.onStatusChange?.('unsupported');
    return null;
  }

  let gl: WebGL2RenderingContext | null;

  try {
    gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
  } catch {
    gl = null;
  }

  if (!gl) {
    options.onStatusChange?.('unsupported');
    return null;
  }

  try {
    const renderer = new WebGL2PreviewRenderer(canvas, gl, options);
    options.onStatusChange?.('available');
    return renderer;
  } catch (error) {
    options.onError?.(describeRendererFailure(error));
    options.onStatusChange?.('unsupported');
    return null;
  }
}

export function getRendererStatus(canvas: HTMLCanvasElement | null): RendererStatus {
  if (!canvas) {
    return 'unsupported';
  }

  try {
    return canvas.getContext('webgl2') ? 'available' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export function describeRendererStatus(status: RendererStatus): string | null {
  switch (status) {
    case 'context-lost':
      return 'The preview stopped. Reload this page to continue.';
    case 'unsupported':
      return 'OpenFilm needs WebGL2 to show a preview. Try a current browser with hardware acceleration enabled.';
    case 'available':
      return null;
  }
}
