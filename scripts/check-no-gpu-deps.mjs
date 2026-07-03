import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const forbiddenStrings = ['@paper-design/shaders'];
// Deliberately lists only CORE entry points — future GPU subpath bundles (e.g. dist/liquid-metal.js) must NOT be added.
const distFiles = ['dist/index.js', 'dist/index.cjs'];
const rootDir = fileURLToPath(new URL('..', import.meta.url));

// tsup's ESM output splits code shared across entries into `./chunk-*.js`
// files and imports them by relative specifier — the core entry
// (dist/index.js) pulls in shared-utility chunks the same way the GPU
// subpath entry (dist/liquid-metal.js) does. Scanning
// dist/index.js alone would miss forbidden strings that leaked into a
// chunk it imports, so any `./chunk-*` specifier reachable from an entry
// listed in distFiles above is scanned too. One level deep is sufficient:
// tsup's chunks don't import other chunks (verified: no `./chunk-*`
// specifier appears inside any chunk file), and CJS output has no chunks
// at all (tsup inlines everything per-entry for CJS), so this only ever
// adds work for the ESM entry.
const chunkSpecifierPattern = /(?:from|require\()\s*["']\.\/(chunk-[\w.-]+)["']/g;

function findChunkFiles(entryDir, content) {
  const chunks = new Set();
  for (const match of content.matchAll(chunkSpecifierPattern)) {
    chunks.add(path.join(entryDir, match[1]));
  }
  return [...chunks];
}

let hasErrors = false;

for (const file of distFiles) {
  const filePath = path.join(rootDir, file);

  if (!fs.existsSync(filePath)) {
    console.error(`✗ ${file} not found. Run npm run build first.`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const chunkFiles = findChunkFiles(path.dirname(filePath), content);
  const filesToScan = [{ label: file, filePath }].concat(
    chunkFiles.map((chunkPath) => ({
      label: `${file} -> ${path.relative(rootDir, chunkPath)}`,
      filePath: chunkPath,
    }))
  );

  for (const { label, filePath: scanPath } of filesToScan) {
    if (!fs.existsSync(scanPath)) {
      console.error(`✗ ${label} not found. Run npm run build first.`);
      process.exit(1);
    }

    const scanContent = fs.readFileSync(scanPath, 'utf8');

    for (const forbidden of forbiddenStrings) {
      if (scanContent.includes(forbidden)) {
        console.error(`✗ Found forbidden dependency "${forbidden}" in ${label}`);
        hasErrors = true;
      }
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log('✓ No GPU dependencies found in core bundle');
process.exit(0);
