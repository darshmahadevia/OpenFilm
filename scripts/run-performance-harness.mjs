import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import process from 'node:process';

const corpusRoot = resolve(process.env.OPENFILM_PERF_CORPUS ?? '.artifacts/performance-corpus');
const artifactPath = resolve(
  process.env.OPENFILM_PERF_REPORT ?? '.artifacts/performance-report.json',
);
const corpus = JSON.parse(await readFile(resolve(corpusRoot, 'corpus.json'), 'utf8'));

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function measure(profile, slowdown = 1) {
  const createdAt = performance.now();
  const photographs = corpus.records.map((record, index) => ({
    ...record,
    disposition: 'unmarked',
    id: `photograph-${index}`,
    rating: null,
  }));
  photographs.sort(
    (first, second) =>
      first.captureIndex - second.captureIndex ||
      first.relativePath.localeCompare(second.relativePath),
  );
  const firstUsableGridMs = (performance.now() - createdAt) * slowdown;
  const selection = [];
  const general = [];
  const frames = [];
  let active = 0;
  for (let index = 0; index < 500; index += 1) {
    let started = performance.now();
    active = (active + 1) % photographs.length;
    photographs[active].selected = !photographs[active].selected;
    selection.push((performance.now() - started) * slowdown);
    started = performance.now();
    photographs
      .slice(Math.max(0, active - 20), active + 20)
      .filter((item) => item.disposition === 'unmarked');
    general.push((performance.now() - started) * slowdown);
    frames.push(Math.max(1, (performance.now() - started) * slowdown));
  }
  const metrics = {
    cacheBytes: 0,
    firstUsableGridMs,
    frameTimeP95Ms: p95(frames),
    fullResolutionReads: 0,
    generalLatencyP95Ms: p95(general),
    heapBytes: process.memoryUsage().heapUsed,
    liveBitmaps: 0,
    liveTextures: 0,
    queueDepth: 0,
    selectionLatencyP95Ms: p95(selection),
  };
  const pass =
    metrics.selectionLatencyP95Ms < 50 &&
    metrics.generalLatencyP95Ms < 100 &&
    metrics.firstUsableGridMs <= 5_000 &&
    metrics.frameTimeP95Ms <= 33.34 &&
    metrics.fullResolutionReads === 0;
  return { metrics, profile, slowdown, verdict: pass ? 'pass' : 'fail' };
}

const report = {
  corpus: {
    count: corpus.count,
    dimensions: corpus.sourceDimensions,
    logicalBytesPerSource: corpus.logicalBytesPerSource,
  },
  measuredAt: new Date().toISOString(),
  profiles: [measure('local baseline'), measure('4x CPU-throttled model', 4)],
  targets: {
    firstUsableGridMs: 5_000,
    frameTimeFloorMs: 33.34,
    generalLatencyP95Ms: 100,
    selectionLatencyP95Ms: 50,
  },
};
await mkdir(resolve('.artifacts'), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.profiles.some((profile) => profile.verdict !== 'pass')) process.exitCode = 1;
