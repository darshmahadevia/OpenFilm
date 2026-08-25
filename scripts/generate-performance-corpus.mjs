import { link, mkdir, rm, truncate, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const count = 2_000;
const logicalBytes = 24_000_000;
const outputRoot = resolve(process.env.OPENFILM_PERF_CORPUS ?? '.artifacts/performance-corpus');
const sourceFixture = resolve('src/assets/openfilm-sample-alpine-lake.webp');
const template = join(outputRoot, '.openfilm-45mp-fixture.jpg');
const records = [];
const run = promisify(execFile);

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
try {
  await run('/usr/bin/sips', [
    '-s',
    'format',
    'jpeg',
    '-z',
    '5625',
    '8000',
    sourceFixture,
    '--out',
    template,
  ]);
} catch (error) {
  throw new Error(
    `The verified macOS performance generator needs /usr/bin/sips: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}
await truncate(template, logicalBytes);
for (let index = 0; index < count; index += 1) {
  const folder = join(outputRoot, String(Math.floor(index / 100)).padStart(2, '0'));
  const fileName = `frame-${String(index + 1).padStart(4, '0')}.jpg`;
  const filePath = join(folder, fileName);
  await mkdir(dirname(filePath), { recursive: true });
  await link(template, filePath);
  records.push({
    byteSize: logicalBytes,
    captureIndex: index,
    height: 5_625,
    mimeType: 'image/jpeg',
    relativePath: `${String(Math.floor(index / 100)).padStart(2, '0')}/${fileName}`,
    width: 8_000,
  });
}

const manifest = {
  count,
  fixture:
    'OpenAI-generated OpenFilm sample, resized to a decodable 8,000 × 5,625 JPEG and repeated through hard links',
  logicalBytesPerSource: logicalBytes,
  note: 'Every path resolves to a decodable 45 MP, 24 MB logical Source fixture. Hard-linked repeated content is suitable for directory scale, scheduling, decode, and resource-bound tests, not storage-throughput or photographic-quality evaluation.',
  records,
  sourceDimensions: { height: 5_625, megapixels: 45, width: 8_000 },
};
await writeFile(join(outputRoot, 'corpus.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Generated ${count} sparse Source fixtures at ${outputRoot}\n`);
