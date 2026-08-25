export interface LibraryResourceObservation {
  cacheBytes: number;
  heapBytes: number | null;
  liveBitmaps: number;
  liveTextures: number;
  queueDepth: number;
}

export interface LibraryPerformanceReport {
  deviceProfile: string;
  metrics: LibraryResourceObservation & {
    firstUsableGridMs: number | null;
    frameTimeP95Ms: number | null;
    fullResolutionReads: number;
    generalLatencyP95Ms: number | null;
    selectionLatencyP95Ms: number | null;
    thumbnailReads: number;
  };
  targets: {
    firstUsableGridMs: 5000;
    frameTimeFloorMs: 33.34;
    generalLatencyP95Ms: 100;
    selectionLatencyP95Ms: 50;
  };
  verdict: 'fail' | 'pass';
}

export function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

export class LibraryPerformanceRecorder {
  private readonly selectionLatencies: number[] = [];
  private readonly generalLatencies: number[] = [];
  private readonly frameTimes: number[] = [];
  private firstUsableGridMs: number | null = null;
  private fullResolutionReads = 0;
  private thumbnailReads = 0;
  private resources: LibraryResourceObservation = {
    cacheBytes: 0,
    heapBytes: null,
    liveBitmaps: 0,
    liveTextures: 0,
    queueDepth: 0,
  };

  constructor(private readonly deviceProfile: string) {}

  recordInteraction(kind: 'general' | 'selection', durationMs: number): void {
    (kind === 'selection' ? this.selectionLatencies : this.generalLatencies).push(
      Math.max(0, durationMs),
    );
  }

  recordFrame(durationMs: number): void {
    this.frameTimes.push(Math.max(0, durationMs));
  }

  recordFirstUsableGrid(durationMs: number): void {
    if (this.firstUsableGridMs === null) this.firstUsableGridMs = Math.max(0, durationMs);
  }

  recordResources(observation: LibraryResourceObservation): void {
    this.resources = { ...observation };
  }

  recordSourceRead(tier: 'full-resolution' | 'thumbnail'): void {
    if (tier === 'full-resolution') this.fullResolutionReads += 1;
    else this.thumbnailReads += 1;
  }

  report(): LibraryPerformanceReport {
    const selectionLatencyP95Ms = percentile95(this.selectionLatencies);
    const generalLatencyP95Ms = percentile95(this.generalLatencies);
    const frameTimeP95Ms = percentile95(this.frameTimes);
    const pass =
      (selectionLatencyP95Ms === null || selectionLatencyP95Ms < 50) &&
      (generalLatencyP95Ms === null || generalLatencyP95Ms < 100) &&
      (this.firstUsableGridMs === null || this.firstUsableGridMs <= 5_000) &&
      (frameTimeP95Ms === null || frameTimeP95Ms <= 33.34) &&
      this.fullResolutionReads === 0;
    return {
      deviceProfile: this.deviceProfile,
      metrics: {
        ...this.resources,
        firstUsableGridMs: this.firstUsableGridMs,
        frameTimeP95Ms,
        fullResolutionReads: this.fullResolutionReads,
        generalLatencyP95Ms,
        selectionLatencyP95Ms,
        thumbnailReads: this.thumbnailReads,
      },
      targets: {
        firstUsableGridMs: 5_000,
        frameTimeFloorMs: 33.34,
        generalLatencyP95Ms: 100,
        selectionLatencyP95Ms: 50,
      },
      verdict: pass ? 'pass' : 'fail',
    };
  }
}
