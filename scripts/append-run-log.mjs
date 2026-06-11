#!/usr/bin/env node
/**
 * Append one JSON run entry to loop-run-log.md and prune entries older than 30 days.
 * Usage: node scripts/append-run-log.mjs '<json-object>' [path-to-log]
 */
import { readFile, writeFile } from 'node:fs/promises';

const MARKER = '<!-- Loop appends below this line -->';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const entryJson = process.argv[2];
const logPath = process.argv[3] || 'loop-run-log.md';

if (!entryJson) {
  console.error('Usage: node scripts/append-run-log.mjs \'<json>\' [loop-run-log.md]');
  process.exit(1);
}

const entry = JSON.parse(entryJson);
const content = await readFile(logPath, 'utf8');
const markerAt = content.indexOf(MARKER);
if (markerAt === -1) {
  console.error(`Marker not found in ${logPath}`);
  process.exit(1);
}

const before = content.slice(0, markerAt + MARKER.length);
const after = content.slice(markerAt + MARKER.length);
const now = Date.now();

const kept = [];
for (const line of after.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) continue;
  try {
    const obj = JSON.parse(trimmed);
    const t = new Date(obj.run_id).getTime();
    if (!Number.isNaN(t) && now - t <= MAX_AGE_MS) {
      kept.push(trimmed);
    }
  } catch {
    // skip malformed lines
  }
}

kept.push(JSON.stringify(entry));
await writeFile(logPath, `${before}\n\n${kept.join('\n')}\n`);
console.log(`Appended run ${entry.run_id} (${kept.length} entries within 30d window)`);