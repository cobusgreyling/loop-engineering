import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditProject, hasContent, hasSkillFrontmatter, looksLikeGatePolicy } from '../dist/auditor.js';
import { fingerprint, readProof, PROOF_MAX_AGE_MS } from '../dist/proof.js';

const today = () => new Date().toISOString().slice(0, 10);
const DAY = 24 * 60 * 60 * 1000;

async function withDir(prefix, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function put(dir, rel, text) {
  await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
  await writeFile(path.join(dir, rel), text);
}

const skill = (name) => `---\nname: ${name}\ndescription: ${name} for this loop\n---\n\n# ${name}\n\nDo the ${name} job.\n`;

const GATE = 'version: 1\ndenylist:\n  - "**/.env"\n  - "**/secrets/**"\nmaxFiles: 10\n';

/** Passing gate + breaker results in both directions, as loop-drill records them. */
function goodGroups(gateText = GATE, recordedAt = new Date().toISOString()) {
  return {
    breaker: {
      recordedAt,
      results: [
        { id: 'breaker.stagnation', failureMode: 'Infinite Fix Loop', direction: 'sensitivity', outcome: 'passed' },
        { id: 'breaker.healthy', failureMode: 'Infinite Fix Loop', direction: 'specificity', outcome: 'passed' },
      ],
    },
    gate: {
      recordedAt,
      input: { file: 'gate.yaml', sha256: fingerprint(gateText) },
      results: [
        { id: 'gate.denylist[**/.env]', failureMode: 'Over-Reach (Wrong Scope)', direction: 'sensitivity', outcome: 'passed' },
        { id: 'gate.benign', failureMode: 'Over-Reach (Wrong Scope)', direction: 'specificity', outcome: 'passed' },
      ],
    },
  };
}

const record = (guardrails) => `${JSON.stringify({ schema: 1, tool: '@cobusgreyling/loop-drill', guardrails }, null, 2)}\n`;

/** Everything L3 asks for, with real content. Only the proof is left to each test. */
async function buildLoopRepo(dir) {
  await put(dir, 'STATE.md', `# Loop State\n\nLast run: ${today()}\n\n## High Priority\n\n- none\n`);
  await put(
    dir,
    'LOOP.md',
    '# Loop\n\nDaily triage, report-only. Gates: denylist in gate.yaml, no auto-merge.\n' +
      'Budget: 100k tokens/day, kill switch loop-pause-all. Worktree per run.\n' +
      'Escalate to a human when stuck; loop-context circuit breaker. MCP: github read-only (least privilege).\n',
  );
  await put(dir, 'AGENTS.md', '# Agents\n\nRun `npm test` before proposing a change.\n');
  for (const s of ['loop-triage', 'loop-verifier', 'minimal-fix', 'loop-budget', 'loop-constraints']) {
    await put(dir, `.claude/skills/${s}/SKILL.md`, skill(s));
  }
  await put(dir, 'docs/safety.md', '# Safety\n\nNever touch secrets. Human review for every merge.\n');
  await put(dir, '.github/workflows/ci.yml', 'name: ci\non: [push]\njobs: {}\n');
  await put(dir, '.mcp.json', '{ "mcpServers": { "github": { "command": "gh-mcp" } } }\n');
  await put(dir, 'gate.yaml', GATE);
  await put(dir, 'loop-budget.md', '# Budget\n\n100k tokens/day.\n');
  await put(dir, 'loop-constraints.md', '# Constraints\n\nDenylist: secrets/.\n');
  await put(dir, 'loop-run-log.md', `# Run log\n\n{"run_id":"${new Date().toISOString()}"}\n`);
}

describe('placeholders do not score', () => {
  test('the 142-byte repo of empty files no longer reaches L3', async () => {
    // Byte-for-byte the repo that used to score 100/L3.
    await withDir('loop-audit-potemkin-', async (dir) => {
      await put(dir, 'STATE.md', `Last run: ${today()}\n`);
      await put(dir, 'LOOP.md', 'gate denylist safety budget kill switch worktree MCP escalate stuck circuit breaker allowlist\n');
      for (const s of ['loop-triage', 'loop-verifier', 'minimal-fix', 'loop-constraints', 'loop-budget']) {
        await put(dir, `skills/${s}/SKILL.md`, '');
      }
      await put(dir, 'docs/safety.md', '');
      await put(dir, '.github/workflows/x.yml', '');
      for (const f of ['AGENTS.md', 'gate.yaml', 'loop-budget.md', 'loop-constraints.md', 'memory-tiers.md', 'memory-budget.md', 'fleet-registry.md', 'fleet-inbox.md']) {
        await put(dir, f, '');
      }
      await put(dir, '.mcp.json', '{}\n');
      await put(dir, 'loop-run-log.md', `{"run_id":"${today()}"}\n`);

      const r = await auditProject(dir);
      assert.notEqual(r.level, 'L3');
      assert.notEqual(r.level, 'L2');
      assert.ok(r.score < 78, `score ${r.score}`);
      const s = r.signals;
      assert.equal(s.triage.present, false, 'empty SKILL.md is not a triage skill');
      assert.equal(s.verifier.present, false, 'empty SKILL.md is not a verifier');
      assert.equal(s.skills.count, 0);
      assert.equal(s.agentsMd.present, false);
      assert.equal(s.safety.safetyDocPresent, false);
      assert.equal(s.github.present, false, '.github/ of empty files');
      assert.equal(s.github.workflows, false);
      assert.equal(s.governance.gateYaml, false);
      assert.equal(s.cost.budgetDoc, false);
      assert.equal(s.cost.budgetSkill, false);
      assert.equal(s.constraints.present, false);
      assert.equal(s.memory.tiers, false);
      assert.equal(s.fleet.registry, false);
      const note = r.findings.find((f) => /^Not counted/.test(f.message));
      assert.ok(note, 'placeholders are reported, not silently dropped');
      for (const rel of ['AGENTS.md', 'gate.yaml', '.mcp.json', 'skills/loop-triage/SKILL.md']) {
        assert.ok(note.message.includes(rel), rel);
      }
      assert.ok(!r.findings.some((f) => /not a gate policy/.test(f.message)), 'an empty gate.yaml is reported once, as a placeholder');
    });
  });

  test('a skill directory without SKILL.md, or without frontmatter, does not count', async () => {
    await withDir('loop-audit-hollow-skill-', async (dir) => {
      await put(dir, 'STATE.md', '# State\n');
      await mkdir(path.join(dir, '.claude/skills/loop-triage'), { recursive: true });
      await put(dir, '.grok/skills/ci-triage/SKILL.md', '# CI triage\n\nNo frontmatter, so no host loads it.\n');
      await put(dir, '.claude/agents/verifier.md', 'You are the verifier.\n');
      const r = await auditProject(dir);
      assert.equal(r.signals.triage.present, false);
      assert.equal(r.signals.verifier.present, false);
      const note = r.findings.find((f) => /^Not counted/.test(f.message)).message;
      assert.ok(note.includes('.claude/skills/loop-triage/SKILL.md'));
      assert.ok(note.includes('.grok/skills/ci-triage/SKILL.md'));
      assert.ok(note.includes('.claude/agents/verifier.md'));
    });
  });

  test('a gate.yaml that is not a policy is a failure, not a signal', async () => {
    await withDir('loop-audit-bad-gate-', async (dir) => {
      await put(dir, 'gate.yaml', 'gates: yes please\n');
      const r = await auditProject(dir);
      assert.equal(r.signals.governance.gateYaml, false);
      assert.ok(r.findings.some((f) => f.level === 'fail' && /not a gate policy/.test(f.message)));
    });
  });

  test('hasContent rejects empty, whitespace and {} / [] JSON, accepts real content', async () => {
    await withDir('loop-audit-content-', async (dir) => {
      const cases = { 'a.md': '', 'b.md': ' \n\t\n', 'c.json': '{}', 'd.json': ' [ ] ', 'e.md': '﻿\n', 'f.md': 'x', 'g.json': '{"a":1}', 'h.json': 'not json' };
      for (const [name, text] of Object.entries(cases)) await put(dir, name, text);
      const got = {};
      for (const name of Object.keys(cases)) got[name] = await hasContent(path.join(dir, name));
      assert.deepEqual(got, { 'a.md': false, 'b.md': false, 'c.json': false, 'd.json': false, 'e.md': false, 'f.md': true, 'g.json': true, 'h.json': true });
      assert.equal(await hasContent(path.join(dir, 'missing.md')), false);
      assert.equal(await hasContent(dir), false, 'a directory is not a file signal');
    });
  });

  test('hasSkillFrontmatter needs a name and a description', () => {
    assert.ok(hasSkillFrontmatter('---\nname: a\ndescription: b\n---\nbody'));
    assert.ok(hasSkillFrontmatter('---\r\nname: a\r\ndescription: b\r\n---\r\n'), 'CRLF checkout');
    assert.ok(hasSkillFrontmatter('﻿---\nname: a\ndescription: >\n  folded\n---\n'), 'BOM, folded description');
    assert.ok(hasSkillFrontmatter('---\nname: a\ndescription: b\nallowed-tools: Read\n---'), 'frontmatter at EOF');
    assert.ok(!hasSkillFrontmatter(''));
    assert.ok(!hasSkillFrontmatter('# Skill\nname: a\ndescription: b\n'), 'not frontmatter');
    assert.ok(!hasSkillFrontmatter('---\nname: a\n---\n'), 'no description');
    assert.ok(!hasSkillFrontmatter('---\nname:\ndescription: b\n---\n'), 'empty name');
    assert.ok(!hasSkillFrontmatter('---\nname: a\ndescription: b\n'), 'unterminated');
  });

  test('looksLikeGatePolicy wants version 1 and a denylist', () => {
    assert.ok(looksLikeGatePolicy(GATE));
    assert.ok(looksLikeGatePolicy('# policy\nversion: 1 # schema\ndenylist: []\n'));
    assert.ok(!looksLikeGatePolicy('version: 2\ndenylist: []\n'));
    assert.ok(!looksLikeGatePolicy('version: 1\n'));
    assert.ok(!looksLikeGatePolicy('denylist:\n  - x\n'));
  });
});

describe('readProof', () => {
  test('fingerprint is sha256 of the LF-normalised file (vector shared with loop-drill)', () => {
    const vector = 'a79338c9d44fec8fe07da24a3766aaf4e32281bd5c73628e0798d59944d1040e';
    assert.equal(fingerprint('version: 1\ndenylist:\n  - "**/.env"\n'), vector);
    assert.equal(fingerprint('version: 1\r\ndenylist:\r\n  - "**/.env"\r\n'), vector);
  });

  test('no record, unreadable record, unsupported schema', async () => {
    await withDir('loop-audit-proof-none-', async (dir) => {
      assert.deepEqual((await readProof(dir)).present, false);
      await put(dir, 'loop-drill.json', '{ nope');
      assert.match((await readProof(dir)).error, /not valid JSON/);
      await put(dir, 'loop-drill.json', JSON.stringify({ schema: 2, guardrails: {} }));
      assert.match((await readProof(dir)).error, /unsupported schema 2/);
      await put(dir, 'loop-drill.json', record({ gate: { recordedAt: 'yesterday-ish', results: [] } }));
      assert.match((await readProof(dir)).error, /no valid recordedAt/);
      await put(dir, 'loop-drill.json', record({ gate: { recordedAt: new Date().toISOString(), results: [{ id: 'x', outcome: 'great' }] } }));
      assert.match((await readProof(dir)).error, /malformed results/);
    });
  });

  test('passing in both directions against the current gate.yaml is proven', async () => {
    await withDir('loop-audit-proof-ok-', async (dir) => {
      await put(dir, 'gate.yaml', GATE);
      await put(dir, 'loop-drill.json', record(goodGroups()));
      const p = await readProof(dir);
      assert.deepEqual(p.proven, ['breaker', 'gate']);
      assert.deepEqual([p.failed, p.stale, p.untested], [[], [], []]);
    });
  });

  test('a CRLF checkout of gate.yaml matches a record made on LF', async () => {
    await withDir('loop-audit-proof-crlf-', async (dir) => {
      await put(dir, 'gate.yaml', GATE.replace(/\n/g, '\r\n'));
      await put(dir, 'loop-drill.json', record(goodGroups(GATE)));
      assert.ok((await readProof(dir)).proven.includes('gate'));
    });
  });

  test('editing gate.yaml after recording makes the gate proof stale', async () => {
    await withDir('loop-audit-proof-edited-', async (dir) => {
      await put(dir, 'gate.yaml', `${GATE}  - "**/billing/**"\n`);
      await put(dir, 'loop-drill.json', record(goodGroups(GATE)));
      const p = await readProof(dir);
      assert.deepEqual(p.stale, ['gate']);
      assert.ok(!p.proven.includes('gate'));
      assert.ok(p.proven.includes('breaker'), 'breaker drills do not depend on gate.yaml');
    });
  });

  test('a gate proof recorded against another file, or with gate.yaml deleted, is stale', async () => {
    await withDir('loop-audit-proof-otherfile-', async (dir) => {
      const groups = goodGroups();
      groups.gate.input.file = 'policy/other.yaml';
      await put(dir, 'gate.yaml', GATE);
      await put(dir, 'loop-drill.json', record(groups));
      assert.deepEqual((await readProof(dir)).stale, ['gate']);
      await rm(path.join(dir, 'gate.yaml'));
      await put(dir, 'loop-drill.json', record(goodGroups()));
      assert.deepEqual((await readProof(dir)).stale, ['gate']);
    });
  });

  test('passing in one direction only is untested, not proven', async () => {
    // A denylist of "**" catches every seeded fault; only the benign drill exposes it.
    await withDir('loop-audit-proof-onedir-', async (dir) => {
      await put(dir, 'gate.yaml', GATE);
      const groups = goodGroups();
      groups.gate.results = groups.gate.results.filter((r) => r.direction === 'sensitivity');
      await put(dir, 'loop-drill.json', record(groups));
      const p = await readProof(dir);
      assert.deepEqual(p.untested, ['gate']);
      assert.ok(!p.proven.includes('gate'));
    });
  });

  test('a failed drill marks its guardrail failed and names the drill', async () => {
    await withDir('loop-audit-proof-failed-', async (dir) => {
      await put(dir, 'gate.yaml', GATE);
      const groups = goodGroups();
      groups.gate.results.push({ id: 'gate.file-count', failureMode: 'Over-Reach (Wrong Scope)', direction: 'sensitivity', outcome: 'failed' });
      await put(dir, 'loop-drill.json', record(groups));
      const p = await readProof(dir);
      assert.deepEqual(p.failed, ['gate']);
      assert.deepEqual(p.failures, ['gate.file-count']);
    });
  });

  test('canaries expire; gate and breaker proofs do not', async () => {
    await withDir('loop-audit-proof-age-', async (dir) => {
      await put(dir, 'gate.yaml', GATE);
      const old = new Date(Date.now() - PROOF_MAX_AGE_MS - DAY).toISOString();
      const groups = goodGroups(GATE, old);
      groups.verifier = {
        recordedAt: old,
        input: { command: 'npm test' },
        results: [
          { id: 'verifier.control', failureMode: 'Verifier Theater', direction: 'specificity', outcome: 'passed' },
          { id: 'verifier.mutant[strict-equality-flip]', failureMode: 'Verifier Theater', direction: 'sensitivity', outcome: 'passed' },
        ],
      };
      await put(dir, 'loop-drill.json', record(groups));
      const p = await readProof(dir);
      assert.deepEqual(p.proven, ['breaker', 'gate']);
      assert.deepEqual(p.stale, ['verifier']);
    });
  });
});

describe('auditProject scores what is proven', () => {
  test('a complete loop reaches L3 only with a current record', async () => {
    await withDir('loop-audit-l3-', async (dir) => {
      await buildLoopRepo(dir);
      const before = await auditProject(dir);
      assert.equal(before.level, 'L2');
      assert.ok(before.score >= 78, `score ${before.score}`);
      assert.ok(before.findings.some((f) => /No loop-drill\.json/.test(f.message)));
      assert.ok(before.findings.some((f) => /guardrails are unproven — capped at L2/.test(f.message)));

      await put(dir, 'loop-drill.json', record(goodGroups()));
      const after = await auditProject(dir);
      assert.equal(after.level, 'L3');
      assert.ok(after.findings.some((f) => f.level === 'ok' && /Guardrails proven by loop-drill: breaker, gate/.test(f.message)));

      await put(dir, 'gate.yaml', GATE.replace('maxFiles: 10', 'maxFiles: 500'));
      const edited = await auditProject(dir);
      assert.equal(edited.level, 'L2', 'weakening gate.yaml after recording loses L3');
      assert.ok(edited.findings.some((f) => /out of date for: gate/.test(f.message)));
    });
  });

  test('a verifier the canary caught approving defects earns nothing', async () => {
    await withDir('loop-audit-theater-', async (dir) => {
      await buildLoopRepo(dir);
      const groups = goodGroups();
      groups.verifier = {
        recordedAt: new Date().toISOString(),
        input: { command: 'true' },
        results: [
          { id: 'verifier.control', failureMode: 'Verifier Theater', direction: 'specificity', outcome: 'passed' },
          { id: 'verifier.mutant[strict-equality-flip]', failureMode: 'Verifier Theater', direction: 'sensitivity', outcome: 'failed' },
        ],
      };
      await put(dir, 'loop-drill.json', record(groups));
      const r = await auditProject(dir);
      assert.equal(r.signals.verifier.present, false);
      assert.notEqual(r.level, 'L3');
      assert.ok(r.findings.some((f) => f.level === 'fail' && /Verifier Theater/.test(f.message) && f.message.includes('verifier.mutant[strict-equality-flip]')));
    });
  });

  test('a gate loop-drill could not load, or saw fail, earns nothing', async () => {
    await withDir('loop-audit-gate-broken-', async (dir) => {
      await buildLoopRepo(dir);
      const groups = goodGroups();
      groups.gate.results = [
        { id: 'gate', failureMode: 'Over-Reach (Wrong Scope)', direction: 'sensitivity', outcome: 'skipped', detail: 'Invalid gate config at gate.yaml: "denylist" must be an array of strings.' },
      ];
      await put(dir, 'loop-drill.json', record(groups));
      let r = await auditProject(dir);
      assert.equal(r.signals.governance.gateYaml, false);
      assert.ok(r.findings.some((f) => f.level === 'fail' && /could not drill it/.test(f.message) && /must be an array/.test(f.message)));

      groups.gate.results = [
        { id: 'gate.denylist[**/.env]', failureMode: 'Over-Reach (Wrong Scope)', direction: 'sensitivity', outcome: 'passed' },
        { id: 'gate.benign', failureMode: 'Over-Reach (Wrong Scope)', direction: 'specificity', outcome: 'failed' },
      ];
      await put(dir, 'loop-drill.json', record(groups));
      r = await auditProject(dir);
      assert.equal(r.signals.governance.gateYaml, false);
      assert.ok(r.findings.some((f) => f.level === 'fail' && /does not hold/.test(f.message) && f.message.includes('gate.benign')));
      assert.notEqual(r.level, 'L3');
    });
  });

  test('a failing breaker withdraws stall detection', async () => {
    await withDir('loop-audit-breaker-', async (dir) => {
      await buildLoopRepo(dir);
      const groups = goodGroups();
      groups.breaker.results[0].outcome = 'failed';
      await put(dir, 'loop-drill.json', record(groups));
      const r = await auditProject(dir);
      assert.equal(r.signals.governance.stallDetection, false);
      assert.ok(r.findings.some((f) => f.level === 'fail' && /failing to fire: breaker/.test(f.message)));
    });
  });
});
