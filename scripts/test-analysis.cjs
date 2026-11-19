const { spawnSync } = require('node:child_process');
const { rmSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const out = join(root, '.analysis-test-build');
mkdirSync(out, { recursive: true });

writeFileSync(
  join(out, 'package.json'),
  JSON.stringify({ type: 'commonjs' })
);
let tsc;
try {
  tsc = require.resolve('typescript/bin/tsc', { paths: [root] });
} catch {
  console.error('TypeScript is missing. Run npm install in the project directory first.');
  process.exit(1);
}
const sources = ['explainEngine.ts', 'instructionGuide.ts', 'numeric.ts', 'valueFlow.ts']
  .map(name => join(root, 'src', 'analysis', name));
try {
  
const compile = spawnSync(
  process.execPath,
  [
    tsc,
    '--ignoreConfig',
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--ignoreDeprecations', '6.0',
    '--strict',
    '--skipLibCheck',
    '--outDir', out,
    ...sources,
  ],
  { cwd: root, stdio: 'inherit' }
);

  if (compile.status !== 0) process.exit(compile.status ?? 1);
  const run = spawnSync(process.execPath, ['--test', join(root, 'tests', 'regression.cjs')], { cwd: root, stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
