import { test } from 'node:test';
import assert from 'node:assert/strict';

const { mapContentToLayout } = await import('../../dist/mapper/file-mapper.js');

// --- Helpers ---

/** Build a minimal Harness layout for testing. */
function makeLayout(overrides = {}) {
  return {
    skills_dir: '.claude/skills',
    skill_filename: 'SKILL.md',
    agents_dir: '.claude/agents',
    config_file: null,
    ...overrides,
  };
}

/** Build a content descriptor with sensible defaults. */
function makeContent(overrides = {}) {
  return {
    basePath: '/content',
    skills: ['daily-triage', 'loop-verifier'],
    agents: ['verifier'],
    configFile: null,
    ...overrides,
  };
}

// --- Basic mapping tests ---

test('maps skills to harness skills_dir with skill_filename convention', () => {
  const layout = makeLayout();
  const content = makeContent();
  const mappings = mapContentToLayout(layout, content);

  const skillMappings = mappings.filter((m) => m.source.includes('skills'));
  assert.equal(skillMappings.length, 2, 'should have two skill mappings');

  // First skill
  assert.equal(skillMappings[0].source, '/content/skills/daily-triage/SKILL.md');
  assert.equal(skillMappings[0].target, '.claude/skills/daily-triage/SKILL.md');

  // Second skill
  assert.equal(skillMappings[1].source, '/content/skills/loop-verifier/SKILL.md');
  assert.equal(skillMappings[1].target, '.claude/skills/loop-verifier/SKILL.md');
});

test('maps agents to harness agents_dir', () => {
  const layout = makeLayout();
  const content = makeContent({ agents: ['verifier', 'reviewer'] });
  const mappings = mapContentToLayout(layout, content);

  const agentMappings = mappings.filter((m) => m.source.includes('agents'));
  assert.equal(agentMappings.length, 2, 'should have two agent mappings');
  assert.equal(agentMappings[0].source, '/content/agents/verifier.md');
  assert.equal(agentMappings[0].target, '.claude/agents/verifier.md');
  assert.equal(agentMappings[1].source, '/content/agents/reviewer.md');
  assert.equal(agentMappings[1].target, '.claude/agents/reviewer.md');
});

test('returns empty array when content has no skills, agents, or config', () => {
  const layout = makeLayout();
  const content = makeContent({ skills: [], agents: [], configFile: null });
  const mappings = mapContentToLayout(layout, content);

  assert.equal(mappings.length, 0, 'should produce no mappings for empty content');
});

// --- Null config_file handling ---

test('skips config file mapping when layout.config_file is null', () => {
  const layout = makeLayout({ config_file: null });
  const content = makeContent({ configFile: 'config.yaml' });
  const mappings = mapContentToLayout(layout, content);

  const configMappings = mappings.filter((m) => m.target === 'config.yaml' || m.source.endsWith('config.yaml'));
  assert.equal(configMappings.length, 0, 'should not map config when layout says null');
});

test('maps config file when layout.config_file is set', () => {
  const layout = makeLayout({ config_file: 'opencode.json' });
  const content = makeContent({ configFile: 'config.json' });
  const mappings = mapContentToLayout(layout, content);

  const configMapping = mappings.find((m) => m.target === 'opencode.json');
  assert.ok(configMapping, 'should have a mapping targeting opencode.json');
  assert.equal(configMapping.source, '/content/config.json');
});

test('skips config mapping when content has no configFile even if layout allows it', () => {
  const layout = makeLayout({ config_file: 'opencode.json' });
  const content = makeContent({ configFile: null });
  const mappings = mapContentToLayout(layout, content);

  const configMappings = mappings.filter((m) => m.target === 'opencode.json');
  assert.equal(configMappings.length, 0, 'no config mapping when content has no configFile');
});

// --- Different harness layouts ---

test('maps correctly for opencode-style layout (flat skills, no agents)', () => {
  const layout = makeLayout({
    skills_dir: 'skills',
    agents_dir: null,
    config_file: 'opencode.json',
  });
  const content = makeContent({
    skills: ['ci-triage'],
    agents: ['verifier'],
    configFile: 'settings.json',
  });
  const mappings = mapContentToLayout(layout, content);

  // Skill should go to flat skills dir
  const skillMapping = mappings.find((m) => m.source.includes('ci-triage'));
  assert.ok(skillMapping);
  assert.equal(skillMapping.target, 'skills/ci-triage/SKILL.md');

  // Agent should be skipped since agents_dir is null
  const agentMappings = mappings.filter((m) => m.source.includes('agents'));
  assert.equal(agentMappings.length, 0, 'agents should be skipped when agents_dir is null');

  // Config should map
  const configMapping = mappings.find((m) => m.target === 'opencode.json');
  assert.ok(configMapping);
  assert.equal(configMapping.source, '/content/settings.json');
});

test('maps correctly for grok-style layout (no agents, no config)', () => {
  const layout = makeLayout({
    skills_dir: '.grok/skills',
    agents_dir: null,
    config_file: null,
  });
  const content = makeContent({
    skills: ['loop-triage'],
    agents: ['verifier'],
    configFile: 'config.yaml',
  });
  const mappings = mapContentToLayout(layout, content);

  // Only skill should be mapped
  assert.equal(mappings.length, 1, 'only skill should be mapped for grok layout');
  assert.equal(mappings[0].target, '.grok/skills/loop-triage/SKILL.md');
});

// --- Nested content directories ---

test('handles nested base path correctly', () => {
  const layout = makeLayout();
  const content = makeContent({
    basePath: '/project/starters/minimal-loop/content',
    skills: ['loop-triage'],
    agents: [],
  });
  const mappings = mapContentToLayout(layout, content);

  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].source, '/project/starters/minimal-loop/content/skills/loop-triage/SKILL.md');
  assert.equal(mappings[0].target, '.claude/skills/loop-triage/SKILL.md');
});

test('handles relative base path', () => {
  const layout = makeLayout();
  const content = makeContent({
    basePath: 'starters/minimal-loop/content',
    skills: ['loop-triage'],
    agents: [],
  });
  const mappings = mapContentToLayout(layout, content);

  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].source, 'starters/minimal-loop/content/skills/loop-triage/SKILL.md');
});

// --- Return type structure ---

test('each mapping has source and target string properties', () => {
  const layout = makeLayout();
  const content = makeContent();
  const mappings = mapContentToLayout(layout, content);

  for (const mapping of mappings) {
    assert.equal(typeof mapping.source, 'string', 'source must be a string');
    assert.equal(typeof mapping.target, 'string', 'target must be a string');
    assert.ok(mapping.source.length > 0, 'source must not be empty');
    assert.ok(mapping.target.length > 0, 'target must not be empty');
  }
});

test('is a pure function — same inputs produce same outputs', () => {
  const layout = makeLayout();
  const content = makeContent();

  const first = mapContentToLayout(layout, content);
  const second = mapContentToLayout(layout, content);

  assert.deepEqual(first, second, 'pure function should return identical results');
});

// --- Edge cases ---

test('handles empty skills array but non-empty agents', () => {
  const layout = makeLayout();
  const content = makeContent({ skills: [], agents: ['verifier'] });
  const mappings = mapContentToLayout(layout, content);

  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].target, '.claude/agents/verifier.md');
});

test('uses custom skill_filename from layout', () => {
  const layout = makeLayout({ skill_filename: 'skill.md' });
  const content = makeContent({ skills: ['my-skill'], agents: [] });
  const mappings = mapContentToLayout(layout, content);

  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].source, '/content/skills/my-skill/SKILL.md');
  assert.equal(mappings[0].target, '.claude/skills/my-skill/skill.md');
});
