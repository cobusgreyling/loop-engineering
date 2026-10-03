/**
 * `loop-drill --record`: write what the drills found to loop-drill.json, so
 * loop-audit can score guardrails that were shown to fire rather than files
 * that merely exist.
 *
 * The record is grouped by guardrail (gate, breaker, verifier, ...). Recording
 * a subset -- say `--only verifier` -- replaces that group and keeps the rest,
 * so a slow canary run does not have to be repeated to refresh the gate.
 *
 * Each group carries what it was drilled against. For the gate that is a
 * fingerprint of the policy file: edit gate.yaml and the old proof stops
 * counting until the drills are run again.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DrillResult } from './drill.js';

export const RECORD_FILE = 'loop-drill.json';
export const RECORD_SCHEMA = 1;

export interface RecordedResult {
  id: string;
  failureMode: string;
  direction: DrillResult['direction'];
  outcome: DrillResult['outcome'];
  /** Only kept for drills that did not pass, to say why. */
  detail?: string;
}

export interface RecordedGuardrail {
  recordedAt: string;
  input?: { file?: string; sha256?: string | null; command?: string };
  mutationScore?: number | null;
  results: RecordedResult[];
}

export interface DrillRecord {
  schema: number;
  tool: string;
  guardrails: Record<string, RecordedGuardrail>;
}

/**
 * sha256 of a policy file with line endings normalised, so a Windows checkout
 * with core.autocrlf fingerprints the same as the Linux runner that recorded
 * it. loop-audit computes the same value; both test suites pin one vector.
 */
export function fingerprint(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** 'gate.denylist[**\/.env]' -> 'gate'; a whole-drill skip like 'verifier' -> 'verifier'. */
export function guardrailOf(id: string): string {
  return id.split(/[.[]/, 1)[0];
}

export interface GroupInputs {
  recordedAt: string;
  /** Repo-relative, forward slashes. */
  gateFile?: string;
  gateSha256?: string | null;
  verifierCommand?: string;
  mutationScore?: number | null;
}

/** Group this run's results by the guardrails that were selected. */
export function buildGroups(
  results: DrillResult[],
  selected: Iterable<string>,
  inputs: GroupInputs,
): Record<string, RecordedGuardrail> {
  const groups: Record<string, RecordedGuardrail> = {};
  for (const name of selected) {
    const mine = results.filter((r) => guardrailOf(r.id) === name);
    if (mine.length === 0) continue;
    const group: RecordedGuardrail = {
      recordedAt: inputs.recordedAt,
      results: mine.map((r) => ({
        id: r.id,
        failureMode: r.failureMode,
        direction: r.direction,
        outcome: r.outcome,
        ...(r.outcome !== 'passed' && r.detail ? { detail: r.detail } : {}),
      })),
    };
    if (name === 'gate') group.input = { file: inputs.gateFile, sha256: inputs.gateSha256 ?? null };
    if (name === 'verifier' && inputs.verifierCommand) {
      group.input = { command: inputs.verifierCommand };
      group.mutationScore = inputs.mutationScore ?? null;
    }
    groups[name] = group;
  }
  return groups;
}

function isRecord(value: unknown): value is DrillRecord {
  const r = value as DrillRecord | null;
  return !!r && r.schema === RECORD_SCHEMA && !!r.guardrails && typeof r.guardrails === 'object';
}

/** Replace the groups this run drilled; keep the others from the existing record. */
export function mergeRecord(existing: unknown, groups: Record<string, RecordedGuardrail>): DrillRecord {
  const kept = isRecord(existing) ? existing.guardrails : {};
  const merged = { ...kept, ...groups };
  const sorted: Record<string, RecordedGuardrail> = {};
  for (const key of Object.keys(merged).sort()) sorted[key] = merged[key];
  return { schema: RECORD_SCHEMA, tool: '@cobusgreyling/loop-drill', guardrails: sorted };
}

export async function writeRecord(root: string, groups: Record<string, RecordedGuardrail>): Promise<string> {
  const file = path.join(root, RECORD_FILE);
  let existing: unknown;
  try {
    existing = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    existing = undefined; // missing or unreadable: start a fresh record
  }
  const record = mergeRecord(existing, groups);
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return file;
}
