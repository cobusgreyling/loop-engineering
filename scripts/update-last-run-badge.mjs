#!/usr/bin/env node
/**
 * Read STATE.md "Last run:" and write docs/last-run.json for a Shields endpoint badge.
 * Daily triage commits this file next to STATE.md.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'STATE.md');
const OUT = path.join(ROOT, 'docs', 'last-run.json');
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function parseLastRun(text) {
  const m = text.match(/Last run:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[T ][0-9:.]+(?:Z|[+-][0-9:]+)?)?)/i);
  if (!m) return null;
  const raw = m[1].includes('T') || m[1].includes(' ') ? m[1].replace(' ', 'T') : `${m[1]}T00:00:00Z`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const text = await readFile(STATE, 'utf8');
const when = parseLastRun(text);
const now = Date.now();

let message = 'unknown';
let color = '6e7681';
if (when) {
  message = when.toISOString().slice(0, 10);
  const age = now - when.getTime();
  if (age <= MAX_AGE_MS) color = '3ee8c5';
  else if (age <= 30 * 24 * 60 * 60 * 1000) color = 'd29922';
  else color = 'e5534b';
}

await mkdir(path.dirname(OUT), { recursive: true });
const payload = {
  schemaVersion: 1,
  label: 'last triage',
  message,
  color,
};
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`last-run badge → ${message} (${color})`);
