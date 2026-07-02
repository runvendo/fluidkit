import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const forbiddenStrings = ['@paper-design/shaders', 'webgl-fluid-enhanced'];
// Deliberately lists only CORE entry points — future GPU subpath bundles (e.g. dist/liquid-metal.js) must NOT be added.
const distFiles = ['dist/index.js', 'dist/index.cjs'];
const rootDir = fileURLToPath(new URL('..', import.meta.url));

let hasErrors = false;

for (const file of distFiles) {
  const filePath = path.join(rootDir, file);

  if (!fs.existsSync(filePath)) {
    console.error(`✗ ${file} not found. Run npm run build first.`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const forbidden of forbiddenStrings) {
    if (content.includes(forbidden)) {
      console.error(`✗ Found forbidden dependency "${forbidden}" in ${file}`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log('✓ No GPU dependencies found in core bundle');
process.exit(0);
