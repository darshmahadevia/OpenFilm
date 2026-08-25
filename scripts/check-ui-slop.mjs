import console from 'node:console';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const files = [
  'src/App.tsx',
  'src/app.css',
  'src/library/AdaptiveLibraryWorkspace.tsx',
  'src/library/LibraryGrid.tsx',
];

const rules = [
  ['gradient decoration', /(?:linear|radial|conic)-gradient\s*\(/gi],
  ['glass effect', /backdrop-filter\s*:|\bglassmorphism\b/gi],
  ['promotional social proof', /\b(?:trusted by|customers love|five-star reviews?)\b/gi],
  [
    'generic marketing slogan',
    /\b(?:reimagine your|unlock the power|next-generation platform)\b/gi,
  ],
];

const findings = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const [label, pattern] of rules) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      findings.push(`${file}:${line}: ${label}: ${match[0]}`);
    }
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`UI anti-slop check passed (${files.length} files, ${rules.length} rules).`);
}
