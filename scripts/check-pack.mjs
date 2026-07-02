import { execFileSync } from 'node:child_process';
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
  'dist/liquid-metal.js',
  'dist/liquid-metal.js.map',
  'dist/liquid-metal.cjs',
  'dist/liquid-metal.cjs.map',
  'dist/liquid-metal.d.ts',
  'dist/liquid-metal.d.cts',
  'dist/water-field.js',
  'dist/water-field.js.map',
  'dist/water-field.cjs',
  'dist/water-field.cjs.map',
  'dist/water-field.d.ts',
  'dist/water-field.d.cts',
];
const allowedRootFiles = requiredFiles.filter((file) => !file.startsWith('dist/'));

let hasErrors = false;

try {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  // Slice from the first "[" to guard against lifecycle script output preceding the JSON
  const data = JSON.parse(output.slice(output.indexOf('[')));
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
    const isRoot = allowedRootFiles.includes(packed);
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
  if (error.stderr) {
    console.error(String(error.stderr));
  }
  process.exit(1);
}
