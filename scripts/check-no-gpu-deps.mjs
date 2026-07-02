import fs from 'node:fs';
import path from 'node:path';

const forbiddenStrings = ['@paper-design/shaders', 'webgl-fluid-enhanced'];
const distFiles = ['dist/index.js', 'dist/index.cjs'];
const rootDir = new URL('..', import.meta.url).pathname;

let hasErrors = false;

for (const file of distFiles) {
  const filePath = path.join(rootDir, file);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${file} not found. Run npm run build first.`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const forbidden of forbiddenStrings) {
    if (content.includes(forbidden)) {
      console.error(`❌ Found forbidden dependency "${forbidden}" in ${file}`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log('✓ No GPU dependencies found in core bundle');
process.exit(0);
