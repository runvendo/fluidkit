import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/index.js',
  'dist/index.js.map',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.ts',
  'dist/index.d.cts',
];

let hasErrors = false;

try {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  const data = JSON.parse(output);
  const packedFiles = data[0].files.map((file) => file.path);
  const packedSet = new Set(packedFiles);

  // Check for missing required files
  for (const required of requiredFiles) {
    if (!packedSet.has(required)) {
      console.error(`✗ Missing required file: ${required}`);
      hasErrors = true;
    }
  }

  // Check for unexpected files
  for (const packed of packedFiles) {
    const isRoot = ['package.json', 'README.md', 'LICENSE'].includes(packed);
    const isDist = packed.startsWith('dist/');
    if (!isRoot && !isDist) {
      console.error(`✗ Unexpected file in pack: ${packed}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log('✓ npm pack contents verified');
  process.exit(0);
} catch (error) {
  console.error(`✗ Failed to check npm pack: ${error.message}`);
  process.exit(1);
}
