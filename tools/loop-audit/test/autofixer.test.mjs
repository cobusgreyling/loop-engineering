import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { autoFixProject } from '../dist/autofixer.js';

/** Signals with every fixable gap closed except gate.yaml, so autoFixProject
 *  writes only that file (and never shells out to loop-init). */
function signalsMissingOnlyGateYaml() {
  return {
    stateFile: { present: true, paths: ['STATE.md'] },
    loopConfig: { present: true },
    skills: { count: 0, loopSkills: [] },
    verifier: { present: false },
    triage: { present: false },
    agentsMd: { present: true },
    patterns: { documented: false },
    safety: { loopMdMentionsSafety: false, safetyDocPresent: true },
    starters: { used: false },
    github: { present: false, workflows: false },
    mcp: { present: false },
    worktreeEvidence: { present: false },
    registry: { present: false },
    constraints: { present: true, hasConstraintsSkill: false },
    cost: { budgetDoc: true, runLog: true, loopMdBudget: false, budgetSkill: false },
    governance: { toolScope: false, stallDetection: false, escalation: false, gateYaml: false },
    loopActivity: { present: false, evidence: [] },
    harness: { stack: true, lock: false, sessions: false, emit: false, host: false },
    memory: { tiers: true, budget: false },
    fleet: { registry: false, inbox: false },
  };
}

test('autoFixProject writes a gate.yaml that loop-gate can actually load', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'loop-audit-autofix-'));
  try {
    await autoFixProject(root, { score: 0, level: 'L0', signals: signalsMissingOnlyGateYaml() });

    const written = await readFile(path.join(root, 'gate.yaml'), 'utf8');

    // This is the schema tools/loop-gate/src/gate.ts's loadGateConfig actually
    // requires -- { version: 1, denylist: string[], ... } -- not the
    // { gates: [...] } shape this template used to emit, which loop-gate
    // rejects outright.
    assert.match(written, /version:\s*1/);
    assert.match(written, /denylist:/);
    assert.doesNotMatch(written, /^gates:/m);

    // A bare pattern like ".env" only matches a path exactly equal to
    // ".env" under minimatch -- it silently misses "services/api/.env".
    // Every denylist entry here must be **/-anchored (or already contain
    // its own ** segment) so it also catches the nested case, which is
    // what "never auto-edit these" in docs/safety.md actually means.
    const denylistBlock = written.match(/denylist:\n((?:\s+-\s+.+\n)+)/)?.[1] ?? '';
    const entries = [...denylistBlock.matchAll(/-\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(entries.length > 0, 'expected at least one denylist entry to check');
    for (const entry of entries) {
      assert.ok(
        entry.startsWith('**/') || entry.includes('**'),
        `denylist entry "${entry}" is not anchored and would miss a nested match`,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('the docs/safety.md it scaffolds lists the same denylist as its gate.yaml', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'loop-audit-autofix-'));
  try {
    const signals = signalsMissingOnlyGateYaml();
    // Both files in one run, the way an empty project is scaffolded.
    signals.safety = { ...signals.safety, safetyDocPresent: false };
    await autoFixProject(root, { score: 0, level: 'L0', signals });

    const gate = await readFile(path.join(root, 'gate.yaml'), 'utf8');
    const safety = await readFile(path.join(root, 'docs/safety.md'), 'utf8');

    const gateBlock = gate.match(/denylist:\n((?:\s+-\s+.+\n)+)/)?.[1] ?? '';
    const fromGate = [...gateBlock.matchAll(/-\s+"([^"]+)"/g)].map((m) => m[1]);

    // loop-sync's extractSafetyDenylist takes the first fenced block after the
    // "Path Denylist" heading. A bullet list there is invisible to it, so the
    // drift check has nothing to compare and the two twins silently diverge.
    const afterHeading = safety.slice(safety.search(/^#{1,6}\s+Path Denylist/im));
    const fenced = afterHeading.match(/```[^\n]*\n([\s\S]*?)```/)?.[1] ?? null;
    assert.ok(fenced !== null, 'docs/safety.md must document the denylist in a fenced block');
    const fromDoc = fenced
      .split('\n')
      .map((line) => line.split('#')[0].trim())
      .filter(Boolean);

    assert.deepEqual(fromDoc, fromGate);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
