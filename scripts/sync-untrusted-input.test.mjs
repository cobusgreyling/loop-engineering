#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, BLOCK, GUIDANCE, START, END, ROLES, targetFiles } from './sync-untrusted-input.mjs';

const SKILL = '---\nname: loop-triage\n---\n\n# Loop Triage\n\n## Rules\n\n- Be concise.\n';
const TOML = 'name = "verifier"\ninstructions = """\nYou are the checker.\n"""\nreasoning_effort = "high"\n';

test('apply: appends the block to a Markdown skill', () => {
  const out = apply(SKILL, 'skills/loop-triage/SKILL.md');
  assert.ok(out.startsWith(SKILL.trimEnd()), 'existing content is untouched');
  assert.ok(out.endsWith(`${BLOCK}\n`));
});

test('apply: is idempotent', () => {
  const once = apply(SKILL, 'skills/loop-triage/SKILL.md');
  assert.equal(apply(once, 'skills/loop-triage/SKILL.md'), once);
  const tomlOnce = apply(TOML, 'starters/x/.codex/agents/verifier.toml');
  assert.equal(apply(tomlOnce, 'starters/x/.codex/agents/verifier.toml'), tomlOnce);
});

test('apply: puts the block inside the TOML instructions string, not after it', () => {
  const out = apply(TOML, 'starters/x/.codex/agents/verifier.toml');
  const inside = out.slice(out.indexOf('"""') + 3, out.lastIndexOf('"""'));
  assert.ok(inside.includes(GUIDANCE));
  assert.ok(out.endsWith('"""\nreasoning_effort = "high"\n'), 'keys after the string survive');
});

test('apply: replaces an out-of-date block in place', () => {
  const stale = `${SKILL}\n${START}\n## Untrusted input\n\nold wording\n${END}\n`;
  const out = apply(stale, 'skills/loop-triage/SKILL.md');
  assert.doesNotMatch(out, /old wording/);
  assert.equal(out.split(START).length - 1, 1, 'exactly one block');
});

test('apply: keeps content a maintainer added after the block', () => {
  const withTail = `${apply(SKILL, 'skills/loop-triage/SKILL.md')}\n## Notes\n\nkeep me\n`;
  assert.match(apply(withTail, 'skills/loop-triage/SKILL.md'), /keep me/);
});

test('apply: refuses a TOML file without a multi-line string', () => {
  assert.throws(() => apply('name = "x"\n', 'a/agents/verifier.toml'), /instructions/);
});

test('guidance is safe inside a TOML basic string', () => {
  // TOML multi-line basic strings interpret backslash escapes and end at """.
  assert.doesNotMatch(GUIDANCE, /\\|"""/);
});

test('targets cover every role in skills/, starters/ and templates/', () => {
  const files = targetFiles();
  assert.ok(files.length >= 55, `expected at least 55 targets, got ${files.length}`);
  for (const root of ['skills/', 'starters/', 'templates/']) {
    assert.ok(files.some((f) => f.startsWith(root)), `no targets under ${root}`);
  }
  // Roles that only read the loop's own files are deliberately excluded.
  assert.ok(!files.some((f) => /loop-budget|loop-constraints|loop-guard|budget-negotiator|install-loop/.test(f)));
  assert.ok(!files.some((f) => /goal-verifier/.test(f)), 'goal-verifier is not the loop verifier');
  assert.ok(ROLES.includes('loop-verifier'));
});
