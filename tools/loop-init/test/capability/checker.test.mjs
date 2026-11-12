import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import the checker module (will be implemented after tests)
let checkCapabilities, CapabilityError;

test('capability checker module exports required functions', async () => {
  const mod = await import('../../dist/capability/checker.js');
  checkCapabilities = mod.checkCapabilities;
  CapabilityError = mod.CapabilityError;

  assert.equal(typeof checkCapabilities, 'function');
  assert.equal(typeof CapabilityError, 'function');
});

// --- Helper to create minimal Harness fixtures ---

function makeHarness(capabilities) {
  return {
    id: 'test-harness',
    display_name: 'Test Harness',
    version: '1.0',
    layout: {
      skills_dir: '.test/skills',
      skill_filename: 'SKILL.md',
      agents_dir: null,
      config_file: null,
    },
    capabilities: {
      shell: false,
      file_write: false,
      skill_read: false,
      worktree: false,
      sub_agent: false,
      scheduling: 'none',
      mcp: false,
      ...capabilities,
    },
    aliases: ['test-harness'],
  };
}

function makePattern(id, required_capabilities) {
  return {
    id,
    required_capabilities,
  };
}

// --- All capabilities satisfied ---

test('checkCapabilities returns success when all required capabilities are satisfied', async () => {
  const harness = makeHarness({
    shell: true,
    file_write: true,
    skill_read: true,
  });
  const pattern = makePattern('daily-triage', ['shell', 'file_write', 'skill_read']);

  const result = checkCapabilities(harness, pattern);

  assert.equal(result.satisfied, true);
  assert.equal(result.missing.length, 0);
});

test('checkCapabilities returns success for minimum viable contract', async () => {
  const harness = makeHarness({
    shell: true,
    file_write: true,
    skill_read: true,
  });
  const pattern = makePattern('minimal', ['shell', 'file_write', 'skill_read']);

  const result = checkCapabilities(harness, pattern);

  assert.equal(result.satisfied, true);
});

// --- Empty required list ---

test('checkCapabilities returns success when required_capabilities is empty', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('no-requirements', []);

  const result = checkCapabilities(harness, pattern);

  assert.equal(result.satisfied, true);
  assert.equal(result.missing.length, 0);
});

// --- One missing capability ---

test('checkCapabilities reports one missing capability', async () => {
  const harness = makeHarness({
    shell: true,
    file_write: true,
    // skill_read missing
  });
  const pattern = makePattern('daily-triage', ['shell', 'file_write', 'skill_read']);

  const result = checkCapabilities(harness, pattern, { throw: false });

  assert.equal(result.satisfied, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0], 'skill_read');
});

test('error message names the missing capability and the requiring pattern', async () => {
  const harness = makeHarness({
    shell: true,
    file_write: true,
  });
  const pattern = makePattern('daily-triage', ['shell', 'file_write', 'skill_read']);

  try {
    checkCapabilities(harness, pattern, { throw: true });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof CapabilityError);
    assert.ok(
      err.message.includes('skill_read'),
      `Error should name missing capability "skill_read", got: ${err.message}`,
    );
    assert.ok(
      err.message.includes('daily-triage'),
      `Error should name requiring pattern "daily-triage", got: ${err.message}`,
    );
  }
});

// --- Multiple missing capabilities ---

test('checkCapabilities reports multiple missing capabilities', async () => {
  const harness = makeHarness({
    shell: true,
    // file_write and skill_read missing
  });
  const pattern = makePattern('full-pattern', ['shell', 'file_write', 'skill_read']);

  const result = checkCapabilities(harness, pattern, { throw: false });

  assert.equal(result.satisfied, false);
  assert.equal(result.missing.length, 2);
  assert.ok(result.missing.includes('file_write'));
  assert.ok(result.missing.includes('skill_read'));
});

test('error message lists all missing capabilities', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('complex-pattern', ['shell', 'file_write', 'skill_read', 'worktree']);

  try {
    checkCapabilities(harness, pattern, { throw: true });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof CapabilityError);
    assert.ok(err.message.includes('shell'), `Should mention "shell": ${err.message}`);
    assert.ok(err.message.includes('file_write'), `Should mention "file_write": ${err.message}`);
    assert.ok(err.message.includes('skill_read'), `Should mention "skill_read": ${err.message}`);
    assert.ok(err.message.includes('worktree'), `Should mention "worktree": ${err.message}`);
    assert.ok(err.message.includes('complex-pattern'), `Should mention pattern id: ${err.message}`);
  }
});

// --- CapabilityError structured properties ---

test('CapabilityError includes missingCapabilities array', async () => {
  const harness = makeHarness({ shell: true });
  const pattern = makePattern('test', ['shell', 'file_write', 'worktree']);

  try {
    checkCapabilities(harness, pattern, { throw: true });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof CapabilityError);
    assert.ok(Array.isArray(err.missingCapabilities));
    assert.equal(err.missingCapabilities.length, 2);
    assert.ok(err.missingCapabilities.includes('file_write'));
    assert.ok(err.missingCapabilities.includes('worktree'));
  }
});

test('CapabilityError includes patternId property', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('my-pattern', ['shell']);

  try {
    checkCapabilities(harness, pattern, { throw: true });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof CapabilityError);
    assert.equal(err.patternId, 'my-pattern');
  }
});

test('CapabilityError includes harnessId property', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('my-pattern', ['shell']);

  try {
    checkCapabilities(harness, pattern, { throw: true });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof CapabilityError);
    assert.equal(err.harnessId, 'test-harness');
  }
});

// --- Boolean vs non-boolean capabilities ---

test('boolean capability set to false counts as missing', async () => {
  const harness = makeHarness({ worktree: false });
  const pattern = makePattern('worktree-pattern', ['worktree']);

  const result = checkCapabilities(harness, pattern, { throw: false });

  assert.equal(result.satisfied, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0], 'worktree');
});

test('scheduling capability with "none" counts as missing when required', async () => {
  const harness = makeHarness({ scheduling: 'none' });
  const pattern = makePattern('scheduled-pattern', ['scheduling']);

  const result = checkCapabilities(harness, pattern, { throw: false });

  assert.equal(result.satisfied, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0], 'scheduling');
});

test('scheduling capability with "native" satisfies requirement', async () => {
  const harness = makeHarness({ scheduling: 'native' });
  const pattern = makePattern('scheduled-pattern', ['scheduling']);

  const result = checkCapabilities(harness, pattern);

  assert.equal(result.satisfied, true);
});

test('scheduling capability with "external" satisfies requirement', async () => {
  const harness = makeHarness({ scheduling: 'external' });
  const pattern = makePattern('scheduled-pattern', ['scheduling']);

  const result = checkCapabilities(harness, pattern);

  assert.equal(result.satisfied, true);
});

// --- Fail-fast behavior (default throw) ---

test('checkCapabilities throws by default when capabilities are insufficient', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('test', ['shell']);

  assert.throws(
    () => checkCapabilities(harness, pattern),
    (err) => err instanceof CapabilityError,
  );
});

test('checkCapabilities does not throw when throw option is false', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('test', ['shell']);

  const result = checkCapabilities(harness, pattern, { throw: false });

  assert.equal(result.satisfied, false);
  assert.equal(result.missing.length, 1);
});

// --- Pure function: no side effects ---

test('checkCapabilities does not modify the harness object', async () => {
  const harness = makeHarness({ shell: true, file_write: true });
  const pattern = makePattern('test', ['shell', 'file_write', 'skill_read']);
  const originalCaps = { ...harness.capabilities };

  checkCapabilities(harness, pattern, { throw: false });

  assert.deepEqual(harness.capabilities, originalCaps);
});

test('checkCapabilities does not modify the pattern object', async () => {
  const harness = makeHarness({});
  const pattern = makePattern('test', ['shell', 'file_write']);
  const originalReqs = [...pattern.required_capabilities];

  checkCapabilities(harness, pattern, { throw: false });

  assert.deepEqual(pattern.required_capabilities, originalReqs);
});

// --- Edge cases ---

test('unknown capability name in required_capabilities is reported as missing', async () => {
  const harness = makeHarness({ shell: true });
  const pattern = makePattern('test', ['shell', 'teleportation']);

  const result = checkCapabilities(harness, pattern, { throw: false });

  assert.equal(result.satisfied, false);
  assert.ok(result.missing.includes('teleportation'));
});

test('all seven known capabilities can be checked', async () => {
  const harness = makeHarness({
    shell: true,
    file_write: true,
    skill_read: true,
    worktree: true,
    sub_agent: true,
    scheduling: 'native',
    mcp: true,
  });
  const pattern = makePattern('maximal', [
    'shell', 'file_write', 'skill_read', 'worktree', 'sub_agent', 'scheduling', 'mcp',
  ]);

  const result = checkCapabilities(harness, pattern);

  assert.equal(result.satisfied, true);
  assert.equal(result.missing.length, 0);
});
