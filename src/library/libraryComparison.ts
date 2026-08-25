import type { GeometryValues } from '../editor/geometry';

export interface SourceFocalPoint {
  x: number;
  y: number;
}

export interface ComparisonPaneState {
  linked: boolean;
  photographId: string;
  resolutionLimited: boolean;
  zoomScale: number;
}

export interface LibraryComparisonState {
  fit: boolean;
  focalPoint: SourceFocalPoint;
  panes: ComparisonPaneState[];
  sourceView: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function createComparisonState(photographIds: readonly string[]): LibraryComparisonState {
  if (photographIds.length < 2 || photographIds.length > 4) {
    throw new Error('Comparison needs an explicit Selection of two to four photographs.');
  }
  return {
    fit: true,
    focalPoint: { x: 0.5, y: 0.5 },
    panes: photographIds.map((photographId) => ({
      linked: true,
      photographId,
      resolutionLimited: false,
      zoomScale: 1,
    })),
    sourceView: false,
  };
}

export function toggleComparisonPaneLink(
  state: LibraryComparisonState,
  photographId: string,
): LibraryComparisonState {
  return {
    ...state,
    panes: state.panes.map((pane) =>
      pane.photographId === photographId ? { ...pane, linked: !pane.linked } : pane,
    ),
  };
}

export function removeComparisonPane(
  state: LibraryComparisonState,
  photographId: string,
): LibraryComparisonState {
  const panes = state.panes.filter((pane) => pane.photographId !== photographId);
  if (panes.length === state.panes.length) return state;
  if (panes.length < 2) throw new Error('Comparison needs at least two photographs.');
  return { ...state, panes };
}

export function setComparisonZoom(
  state: LibraryComparisonState,
  photographId: string,
  zoomScale: number,
  focalPoint: SourceFocalPoint,
): LibraryComparisonState {
  const sourcePane = state.panes.find((pane) => pane.photographId === photographId);
  if (!sourcePane) return state;
  const scale = Math.max(0.01, zoomScale);
  return {
    ...state,
    fit: false,
    focalPoint: { x: clamp01(focalPoint.x), y: clamp01(focalPoint.y) },
    panes: state.panes.map((pane) =>
      pane.photographId === photographId || (sourcePane.linked && pane.linked)
        ? { ...pane, zoomScale: scale }
        : pane,
    ),
  };
}

export function mapSourceFocalPointToPane(
  point: SourceFocalPoint,
  geometry: GeometryValues,
): SourceFocalPoint {
  const cropX = clamp01((point.x - geometry.crop.x) / geometry.crop.width);
  const cropY = clamp01((point.y - geometry.crop.y) / geometry.crop.height);
  let x = cropX;
  let y = cropY;
  if (geometry.rotation === 90) {
    x = 1 - cropY;
    y = cropX;
  } else if (geometry.rotation === 180) {
    x = 1 - cropX;
    y = 1 - cropY;
  } else if (geometry.rotation === 270) {
    x = cropY;
    y = 1 - cropX;
  }
  if (geometry.flipHorizontal) x = 1 - x;
  if (geometry.flipVertical) y = 1 - y;
  return { x: clamp01(x), y: clamp01(y) };
}

interface AdmittedResource {
  bytes: number;
  dispose: () => void;
}

export class BoundedComparisonResources {
  private readonly resources = new Map<string, AdmittedResource>();
  private readonly limited = new Set<string>();
  private bytes = 0;

  constructor(private readonly byteBudget: number) {
    if (!Number.isSafeInteger(byteBudget) || byteBudget < 1) {
      throw new Error('Comparison needs a positive byte budget.');
    }
  }

  admit(key: string, bytes: number, dispose: () => void): { resolutionLimited: boolean } {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.byteBudget) {
      this.limited.add(key);
      dispose();
      return { resolutionLimited: true };
    }
    this.remove(key);
    while (this.bytes + bytes > this.byteBudget && this.resources.size > 0) {
      this.remove(this.resources.keys().next().value as string);
    }
    this.resources.set(key, { bytes, dispose });
    this.bytes += bytes;
    this.limited.delete(key);
    return { resolutionLimited: false };
  }

  touch(key: string): void {
    const resource = this.resources.get(key);
    if (!resource) return;
    this.resources.delete(key);
    this.resources.set(key, resource);
  }

  remove(key: string): void {
    const resource = this.resources.get(key);
    if (!resource) return;
    resource.dispose();
    this.bytes -= resource.bytes;
    this.resources.delete(key);
  }

  dispose(): void {
    for (const key of [...this.resources.keys()]) this.remove(key);
    this.limited.clear();
  }

  labelFor(key: string, requested: '100%' | 'Fit'): string {
    return this.limited.has(key) && requested === '100%' ? 'Resolution limited · Fit' : requested;
  }

  snapshot(): { budget: number; bytes: number; count: number } {
    return { budget: this.byteBudget, bytes: this.bytes, count: this.resources.size };
  }
}
