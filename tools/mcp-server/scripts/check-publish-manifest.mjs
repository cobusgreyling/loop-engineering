// `npm publish` in this directory would ship the development manifest, whose
// internal dependencies are `file:` links into the repo: the tarball then either
// fails to build a tree or silently drops the packages it cannot resolve, and
// every consumer following the README breaks (1.1.0 shipped exactly that way).
// Publishing goes through `npm run pack:publish`, which rewrites those links to
// published versions; this guard stops the other path before it reaches the
// registry.
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const local = Object.entries(manifest.dependencies ?? {})
  .filter(([, spec]) => typeof spec === 'string' && spec.startsWith('file:'))
  .map(([name, spec]) => `  ${name}: ${spec}`);

if (local.length > 0) {
  console.error('Refusing to publish a manifest that still links the repo:');
  console.error(local.join('\n'));
  console.error('Publish with `npm run pack:publish -- --pack-destination <dir>` and publish the tarball it writes.');
  process.exit(1);
}
