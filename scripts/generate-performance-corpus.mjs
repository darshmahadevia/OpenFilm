import { mkdir, readFile, truncate, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const count = 2_000;
const logicalBytes = 24_000_000;
const outputRoot = resolve(process.env.OPENFILM_PERF_CORPUS ?? '.artifacts/performance-corpus');
const sourceFixture = resolve('src/assets/openfilm-sample-alpine-lake.webp');
const fixture = await readFile(sourceFixture);
const records = [];

await mkdir(outputRoot, { recursive: true });
for (let index = 0; index < count; index += 1) {
  const folder = join(outputRoot, String(Math.floor(index / 100)).padStart(2, '0'));
  const fileName = `frame-${String(index + 1).padStart(4, '0')}.webp`;
  const filePath = join(folder, fileName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, fixture);
  await truncate(filePath, logicalBytes);
  records.push({
    byteSize: logicalBytes,
    captureIndex: index,
    height: 5_625,
    mimeType: 'image/webp',
    relativePath: `${String(Math.floor(index / 100)).padStart(2, '0')}/${fileName}`,
    width: 8_000,
  });
}

const manifest = {
  count,
  fixture:
    'OpenAI-generated OpenFilm sample, repeated as sparse files for scheduling and filesystem scale only',
  logicalBytesPerSource: logicalBytes,
  note: 'The declared 45 MP dimensions model source workload. The repeated sparse WebP is not a fidelity corpus.',
  records,
  sourceDimensions: { height: 5_625, megapixels: 45, width: 8_000 },
};
await writeFile(join(outputRoot, 'corpus.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Generated ${count} sparse Source fixtures at ${outputRoot}\n`);
