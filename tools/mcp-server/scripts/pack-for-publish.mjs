import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const original = readFileSync('package.json', 'utf8');
const manifest = JSON.parse(original);
Object.assign(manifest.dependencies, {
  '@cobusgreyling/loop-audit': '^1.9.0',
  '@cobusgreyling/loop-context': '^1.5.0',
  '@cobusgreyling/loop-cost': '^1.2.0',
  '@cobusgreyling/loop-gate': '^1.0.0',
});

try {
  writeFileSync('package.json', JSON.stringify(manifest, null, 2) + '\n');
  const result = spawnSync('npm', ['pack', '--json', ...process.argv.slice(2)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  writeFileSync('package.json', original);
}
