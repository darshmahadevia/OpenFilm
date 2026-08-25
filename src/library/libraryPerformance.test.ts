import { LibraryPerformanceRecorder, percentile95 } from './libraryPerformance';

describe('large-Library performance evidence', () => {
  it('records the required observable metrics and evaluates the release targets', () => {
    expect(percentile95([5, 10, 20, 40, 60])).toBe(60);
    const recorder = new LibraryPerformanceRecorder('M4 16 GB baseline');
    recorder.recordInteraction('selection', 20);
    recorder.recordInteraction('general', 70);
    recorder.recordFrame(16);
    recorder.recordFirstUsableGrid(1_200);
    recorder.recordResources({
      cacheBytes: 1_000,
      heapBytes: 2_000,
      liveBitmaps: 2,
      liveTextures: 1,
      queueDepth: 3,
    });
    recorder.recordSourceRead('thumbnail');
    const report = recorder.report();
    expect(report.metrics).toMatchObject({
      cacheBytes: 1_000,
      firstUsableGridMs: 1_200,
      fullResolutionReads: 0,
      generalLatencyP95Ms: 70,
      selectionLatencyP95Ms: 20,
    });
    expect(report.verdict).toBe('pass');
  });
});
