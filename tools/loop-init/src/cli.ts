#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printContributorCta } from './contributor-cta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const MONOREPO_STARTERS = path.resolve(PACKAGE_ROOT, '../../starters');
const MONOREPO_TEMPLATES = path.resolve(PACKAGE_ROOT, '../../templates');

type Pattern =
  | 'daily-triage'
  | 'pr-babysitter'
  | 'ci-sweeper'
  | 'dependency-sweeper'
  | 'post-merge-cleanup'
  | 'changelog-drafter'
  | 'issue-triage';

type Tool = 'grok' | 'claude' | 'codex' | 'opencode';

const PATTERN_STARTERS: Record<Pattern, string> = {
  'daily-triage': 'minimal-loop',
  'pr-babysitter': 'pr-babysitter',
  'ci-sweeper': 'ci-sweeper',
  'dependency-sweeper': 'dependency-sweeper',
  'post-merge-cleanup': 'post-merge-cleanup',
  'changelog-drafter': 'changelog-drafter',
  'issue-triage': 'issue-triage',
};

const TOOL_SUFFIX: Record<Tool, string> = {
  grok: '',
  claude: '-claude',
  codex: '-codex',
  opencode: '-opencode',
};

const L2_PATTERNS = new Set<Pattern>(['ci-sweeper', 'dependency-sweeper']);

const PATTERNS_NEEDING_FIX: Set<Pattern> = new Set([
  'pr-babysitter',
  'ci-sweeper',
  'dependency-sweeper',
  'post-merge-cleanup',
]);

/**
 * Patterns that act on human-authored, often underspecified input (issues).
 * They get the loop-intake skill so the loop clarifies a vague item or escalates
 * it instead of guessing and burning fix attempts.
 */
const PATTERNS_NEEDING_INTAKE: Set<Pattern> = new Set(['issue-triage']);

const STATE_FILES: Record<Pattern, string> = {
  'daily-triage': 'STATE.md',
  'pr-babysitter': 'pr-babysitter-state.md',
  'ci-sweeper': 'ci-sweeper-state.md',
  'dependency-sweeper': 'dependency-sweeper-state.md',
  'post-merge-cleanup': 'post-merge-state.md',
  'changelog-drafter': 'changelog-drafter-state.md',
  'issue-triage': 'issue-triage-state.md',
};

/** Mirrors patterns/registry.yaml cost caps — used when scaffolding observability files. */
const PATTERN_BUDGET: Record<
  Pattern,
  { name: string; maxRunsPerDay: number; dailyCap: number; maxSpawnsL1: number; maxSpawnsL2: number }
> = {
  'daily-triage': { name: 'Daily Triage', maxRunsPerDay: 2, dailyCap: 100_000, maxSpawnsL1: 0, maxSpawnsL2: 2 },
  'pr-babysitter': { name: 'PR Babysitter', maxRunsPerDay: 288, dailyCap: 2_000_000, maxSpawnsL1: 0, maxSpawnsL2: 3 },
  'ci-sweeper': { name: 'CI Sweeper', maxRunsPerDay: 96, dailyCap: 1_000_000, maxSpawnsL1: 0, maxSpawnsL2: 3 },
  'dependency-sweeper': { name: 'Dependency Sweeper', maxRunsPerDay: 4, dailyCap: 500_000, maxSpawnsL1: 0, maxSpawnsL2: 3 },
  'post-merge-cleanup': { name: 'Post-Merge Cleanup', maxRunsPerDay: 1, dailyCap: 200_000, maxSpawnsL1: 0, maxSpawnsL2: 2 },
  'changelog-drafter': { name: 'Changelog Drafter', maxRunsPerDay: 1, dailyCap: 100_000, maxSpawnsL1: 0, maxSpawnsL2: 2 },
  'issue-triage': { name: 'Issue Triage', maxRunsPerDay: 12, dailyCap: 80_000, maxSpawnsL1: 0, maxSpawnsL2: 1 },
};

type FoundryPreset = 'minimal' | 'implementer';

/** Map LE patterns → harness-foundry stack presets (report-only → minimal, fix → implementer). */
const PATTERN_FOUNDRY_PRESET: Record<Pattern, FoundryPreset> = {
  'daily-triage': 'minimal',
  'issue-triage': 'minimal',
  'changelog-drafter': 'minimal',
  'pr-babysitter': 'implementer',
  'ci-sweeper': 'implementer',
  'dependency-sweeper': 'implementer',
  'post-merge-cleanup': 'implementer',
};

const FOUNDRY_SHOWCASE =
  'https://github.com/cobusgreyling/harness-foundry/blob/main/docs/showcase.md';

/**
 * Model providers selectable for the implementer preset's `interface` layer.
 * The implementer stack defaults to the existing primitive; `minimax` emits a
 * `model/minimax` provider primitive with regional endpoints and model options.
 */
type ModelProvider = 'anthropic' | 'minimax';

type MiniMaxRegion = 'global_en' | 'cn_zh';

interface MiniMaxModel {
  id: string;
  contextWindow: number;
  inputModalities: string[];
  thinking: string[];
  pricing: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number | null;
  };
}

interface MiniMaxRegionEndpoint {
  region: MiniMaxRegion;
  openaiBaseUrl: string;
  anthropicBaseUrl: string;
  docsRoot: string;
}

const MINIMAX_DEFAULT_MODEL = 'MiniMax-M3';
const MINIMAX_DEFAULT_REGION: MiniMaxRegion = 'global_en';

const MINIMAX_MODELS: MiniMaxModel[] = [
  {
    id: 'MiniMax-M3',
    contextWindow: 1_000_000,
    inputModalities: ['text', 'image', 'video'],
    thinking: ['adaptive', 'disabled'],
    pricing: { input: 0.6, output: 2.4, cacheRead: 0.12, cacheWrite: null },
  },
  {
    id: 'MiniMax-M2.7',
    contextWindow: 204_800,
    inputModalities: ['text'],
    thinking: ['always_on'],
    pricing: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
  },
];

const MINIMAX_REGIONS: MiniMaxRegionEndpoint[] = [
  {
    region: 'global_en',
    openaiBaseUrl: 'https://api.minimax.io/v1',
    anthropicBaseUrl: 'https://api.minimax.io/anthropic',
    docsRoot: 'https://platform.minimax.io/docs',
  },
  {
    region: 'cn_zh',
    openaiBaseUrl: 'https://api.minimaxi.com/v1',
    anthropicBaseUrl: 'https://api.minimaxi.com/anthropic',
    docsRoot: 'https://platform.minimaxi.com/docs',
  },
];

const MINIMAX_MODEL_IDS = MINIMAX_MODELS.map((m) => m.id);
const MINIMAX_REGION_IDS = MINIMAX_REGIONS.map((r) => r.region);

/** Render the `model/minimax` interface primitive for the implementer stack. */
function minimaxInterfaceYaml(model: string, region: MiniMaxRegion): string {
  const models = MINIMAX_MODELS.map((m) =>
    [
      `          - id: ${m.id}`,
      `            context_window: ${m.contextWindow}`,
      `            input_modalities: [${m.inputModalities.join(', ')}]`,
      `            thinking: [${m.thinking.join(', ')}]`,
      `            pricing_usd_per_million_tokens:`,
      `              input: ${m.pricing.input}`,
      `              output: ${m.pricing.output}`,
      `              cache_read: ${m.pricing.cacheRead}`,
      `              cache_write: ${m.pricing.cacheWrite === null ? 'null' : m.pricing.cacheWrite}`,
    ].join('\n'),
  ).join('\n');

  const endpoints = MINIMAX_REGIONS.map((r) =>
    [
      `          ${r.region}:`,
      `            openai_base_url: ${r.openaiBaseUrl}`,
      `            anthropic_base_url: ${r.anthropicBaseUrl}`,
      `            docs_root: ${r.docsRoot}`,
    ].join('\n'),
  ).join('\n');

  return `    - primitive: model/minimax
      config:
        model: ${model}
        region: ${region}
        models:
${models}
        endpoints:
${endpoints}`;
}

function parseArgs(argv: string[]) {
  let pattern: Pattern = 'daily-triage';
  let tool: Tool = 'grok';
  let target = '.';
  let dryRun = false;
  let withFoundry = false;
  let withMemory = false;
  let withFleet = false;
  let modelProvider: ModelProvider = 'anthropic';
  let region: MiniMaxRegion = MINIMAX_DEFAULT_REGION;
  let model = MINIMAX_DEFAULT_MODEL;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pattern' || a === '-p') pattern = argv[++i] as Pattern;
    else if (a === '--tool' || a === '-t') tool = argv[++i] as Tool;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--with-foundry') withFoundry = true;
    else if (a === '--with-memory') withMemory = true;
    else if (a === '--with-fleet') withFleet = true;
    else if (a === '--model-provider') modelProvider = argv[++i] as ModelProvider;
    else if (a === '--region') region = argv[++i] as MiniMaxRegion;
    else if (a === '--model') model = argv[++i];
    else if (a === '--help' || a === '-h')
      return { help: true as const, pattern, tool, target, dryRun, withFoundry, withMemory, withFleet, modelProvider, region, model };
    else if (!a.startsWith('-')) target = a;
  }

  return { help: false as const, pattern, tool, target, dryRun, withFoundry, withMemory, withFleet, modelProvider, region, model };
}

function foundryStackYaml(
  stackName: string,
  pattern: Pattern,
  preset: FoundryPreset,
  provider: ModelProvider = 'anthropic',
  region: MiniMaxRegion = MINIMAX_DEFAULT_REGION,
  model: string = MINIMAX_DEFAULT_MODEL,
): string {
  if (preset === 'implementer') {
    const interfaceLayer =
      provider === 'minimax'
        ? minimaxInterfaceYaml(model, region)
        : `    - primitive: model/anthropic
      config:
        model: claude-sonnet-4-6`;
    return `name: ${stackName}
version: 1.0.0
description: "loop-engineering ${pattern} → implementer harness (loop-init --with-foundry)"
layers:
  interface:
${interfaceLayer}
  composition:
    - primitive: context/state-file
    - primitive: tools/git-worktree-write
  execution:
    - primitive: sandbox/worktree-isolated
    - primitive: control/token-budget-100k
  reliability:
    - primitive: observability/span-per-turn
    - primitive: recovery/revert-on-test-fail
    - primitive: emit/outerloop-evidence
`;
  }

  return `name: ${stackName}
version: 1.0.0
description: "loop-engineering ${pattern} → minimal harness (loop-init --with-foundry)"
layers:
  interface:
    - primitive: model/mock
  composition:
    - primitive: context/state-file
  execution:
    - primitive: control/token-budget-100k
    - primitive: sandbox/worktree-isolated
  reliability:
    - primitive: observability/span-per-turn
    - primitive: emit/outerloop-evidence
`;
}

/**
 * Scaffold a harness-foundry stack next to loop files so LE graduates land in
 * a versioned harness in one command (no foundry package dependency).
 */
async function scaffoldFoundry(
  pattern: Pattern,
  targetDir: string,
  dryRun: boolean,
  model: { provider: ModelProvider; region: MiniMaxRegion; model: string } = {
    provider: 'anthropic',
    region: MINIMAX_DEFAULT_REGION,
    model: MINIMAX_DEFAULT_MODEL,
  },
): Promise<{ preset: FoundryPreset; stackFile: string } | null> {
  const preset = PATTERN_FOUNDRY_PRESET[pattern];
  const foundryRoot = path.join(targetDir, '.foundry');
  const stackFile = path.join(foundryRoot, 'stack.yaml');
  const stackName = path.basename(targetDir) || 'project';

  if (await exists(stackFile)) {
    console.log(`  skip: ${stackFile} already exists`);
    return { preset, stackFile };
  }

  const files: Array<{ path: string; content: string }> = [
    { path: stackFile, content: foundryStackYaml(stackName, pattern, preset, model.provider, model.region, model.model) },
    {
      path: path.join(foundryRoot, 'hooks', 'outerloop.yaml'),
      content: `enabled: false
adapter: outerloop
emitOn:
  - session.end
`,
    },
    {
      path: path.join(foundryRoot, 'README.md'),
      content: `# Harness stack (from loop-engineering)

Scaffolded by \`loop-init --with-foundry\` for pattern **${pattern}** (preset: **${preset}**).

\`\`\`
loop-engineering  →  harness-foundry  →  outerloop
   (patterns)         (runtime)          (governance)
\`\`\`

## Next

\`\`\`bash
npx @cobusgreyling/harness-foundry validate
npx @cobusgreyling/harness-foundry run --goal "Verify harness wiring"
npx @cobusgreyling/harness-foundry evolve report --session <id>
\`\`\`

Showcase: ${FOUNDRY_SHOWCASE}
`,
    },
    {
      path: path.join(foundryRoot, 'sessions', '.gitkeep'),
      content: '',
    },
  ];

  for (const f of files) {
    if (dryRun) {
      console.log(`  would write: ${f.path}`);
      continue;
    }
    await mkdir(path.dirname(f.path), { recursive: true });
    await writeFile(f.path, f.content);
    console.log(`  created: ${path.relative(targetDir, f.path)}`);
  }

  return { preset, stackFile };
}

async function scaffoldFleet(
  targetDir: string,
  templatesRoot: string,
  dryRun: boolean,
) {
  const registryTemplate = path.join(templatesRoot, 'fleet-registry.md');
  if (await exists(registryTemplate)) {
    await copyFile(registryTemplate, path.join(targetDir, 'fleet-registry.md'), dryRun);
  }
  const inboxTemplate = path.join(templatesRoot, 'fleet-inbox.md');
  if (await exists(inboxTemplate)) {
    await copyFile(inboxTemplate, path.join(targetDir, 'fleet-inbox.md'), dryRun);
  }
}

async function scaffoldMemory(
  targetDir: string,
  templatesRoot: string,
  dryRun: boolean,
) {
  const tiersTemplate = path.join(templatesRoot, 'memory-tiers.md');
  const tiersDest = path.join(targetDir, 'memory-tiers.md');
  if (!(await exists(tiersDest))) {
    await copyFile(tiersTemplate, tiersDest, dryRun);
  }

  const budgetTemplate = path.join(templatesRoot, 'memory-budget.md');
  const budgetDest = path.join(targetDir, 'memory-budget.md');
  if (!(await exists(budgetDest))) {
    await copyFile(budgetTemplate, budgetDest, dryRun);
  }
}

function printFoundryCta(opts: {
  pattern: Pattern;
  tool: Tool;
  withFoundry: boolean;
  score: number | null;
  preset?: FoundryPreset;
}) {
  const { pattern, tool, withFoundry, score, preset } = opts;
  const mapped = preset ?? PATTERN_FOUNDRY_PRESET[pattern];
  console.log('');
  if (withFoundry) {
    console.log(`Harness stack ready (.foundry/, preset: ${mapped} for ${pattern})`);
    console.log('  npx @cobusgreyling/harness-foundry validate');
    console.log('  npx @cobusgreyling/harness-foundry run --goal "Verify harness wiring"');
    console.log(`  Showcase: ${FOUNDRY_SHOWCASE}`);
    return;
  }

  const highReady = score !== null && score >= 80;
  console.log(
    highReady
      ? 'Next after Loop Ready 80+: version this loop as a harness'
      : 'Optional: make this loop a versioned harness (harness-foundry)',
  );
  console.log(
    `  npx @cobusgreyling/loop-init . --pattern ${pattern} --tool ${tool} --with-foundry`,
  );
  console.log(
    `  # or: npx @cobusgreyling/harness-foundry init --from loop-engineering:${pattern}`,
  );
  if (highReady) {
    console.log(`  Showcase: ${FOUNDRY_SHOWCASE}`);
  }
}

function printFleetCta(opts: {
  pattern: Pattern;
  tool: Tool;
  withFleet: boolean;
  score: number | null;
}) {
  const { pattern, tool, withFleet, score } = opts;
  console.log('');
  if (withFleet) {
    console.log('Fleet engineering stack ready (fleet-registry.md, fleet-inbox.md)');
    return;
  }

  const highReady = score !== null && score >= 80;
  console.log(
    highReady
      ? 'Next after Loop Ready 80+: version this loop for a fleet (fleet-engineering)'
      : 'Optional: add fleet-engineering for multi-agent populations',
  );
  console.log(
    `  npx @cobusgreyling/loop-init . --pattern ${pattern} --tool ${tool} --with-fleet`,
  );
}

function printMemoryCta(opts: {
  pattern: Pattern;
  tool: Tool;
  withMemory: boolean;
  score: number | null;
}) {
  const { pattern, tool, withMemory, score } = opts;
  console.log('');
  if (withMemory) {
    console.log('Memory engineering stack ready (memory-tiers.md, memory-budget.md)');
    return;
  }

  const highReady = score !== null && score >= 80;
  console.log(
    highReady
      ? "Next after Loop Ready 80+: version this loop's memory (memory-engineering)"
      : 'Optional: add memory-engineering for cross-session knowledge',
  );
  console.log(
    `  npx @cobusgreyling/loop-init . --pattern ${pattern} --tool ${tool} --with-memory`,
  );
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src: string, dest: string, dryRun: boolean) {
  if (!(await exists(src))) return false;
  if (dryRun) {
    console.log(`  would copy: ${src} → ${dest}`);
    return true;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log(`  copied: ${src} → ${dest}`);
  return true;
}

async function resolveBundledOrMonorepo(name: 'starters' | 'templates'): Promise<string> {
  const bundled = path.join(PACKAGE_ROOT, name);
  if (await exists(bundled)) return bundled;
  return name === 'starters' ? MONOREPO_STARTERS : MONOREPO_TEMPLATES;
}

async function copyTemplateSkill(
  templatesRoot: string,
  templateFile: string,
  targetDir: string,
  tool: Tool,
  skillName: string,
  dryRun: boolean,
) {
  const src = path.join(templatesRoot, templateFile);
  const destByTool: Record<Tool, string> = {
    grok: path.join(targetDir, '.grok', 'skills', skillName, 'SKILL.md'),
    claude: path.join(targetDir, '.claude', 'skills', skillName, 'SKILL.md'),
    codex: path.join(targetDir, '.codex', 'skills', skillName, 'SKILL.md'),
    opencode: path.join(targetDir, 'skills', skillName, 'SKILL.md'),
  };
  const dest = destByTool[tool];
  if (await exists(dest)) return;
  await copyFile(src, dest, dryRun);
}

async function copyTemplateVerifier(
  templatesRoot: string,
  targetDir: string,
  tool: Tool,
  dryRun: boolean,
) {
  const verifierPaths: Record<Tool, string> = {
    grok: path.join(targetDir, '.grok', 'skills', 'loop-verifier', 'SKILL.md'),
    claude: path.join(targetDir, '.claude', 'agents', 'loop-verifier.md'),
    codex: path.join(targetDir, '.codex', 'agents', 'verifier.toml'),
    opencode: path.join(targetDir, 'skills', 'loop-verifier', 'SKILL.md'),
  };
  const dest = verifierPaths[tool];
  if (await exists(dest)) return;

  if (tool === 'codex') {
    const src = path.join(templatesRoot, 'SKILL.md.verifier');
    const body = await readFile(src, 'utf8');
    const toml = `name = "loop-verifier"\ndescription = "Independent verification agent for loop-produced changes."\n\n[system_prompt]\ncontent = """\n${body}\n"""\n`;
    if (dryRun) {
      console.log(`  would write verifier: ${dest}`);
      return;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, toml);
    console.log(`  created: ${dest} (from verifier template)`);
    return;
  }

  const src = path.join(templatesRoot, 'SKILL.md.verifier');
  await copyFile(src, dest, dryRun);
}

async function copyL2Templates(
  pattern: Pattern,
  tool: Tool,
  targetDir: string,
  templatesRoot: string,
  dryRun: boolean,
) {
  if (!PATTERNS_NEEDING_FIX.has(pattern) && !L2_PATTERNS.has(pattern)) return;

  await copyTemplateSkill(templatesRoot, 'SKILL.md.minimal-fix', targetDir, tool, 'minimal-fix', dryRun);

  if (L2_PATTERNS.has(pattern) || pattern === 'dependency-sweeper') {
    await copyTemplateVerifier(templatesRoot, targetDir, tool, dryRun);
  }
}

/** Per-pattern goal seeded into loop-ledger.json for the circuit breaker. */
const LEDGER_GOAL: Record<Pattern, string> = {
  'daily-triage': 'Keep the repo healthy and STATE.md current',
  'pr-babysitter': 'Get the watched PR review-ready and green',
  'ci-sweeper': 'Get failing CI back to green',
  'dependency-sweeper': 'Land safe dependency updates',
  'post-merge-cleanup': 'Clean up regressions from recent merges',
  'changelog-drafter': 'Draft accurate release notes',
  'issue-triage': 'Triage the open issue queue',
};

/**
 * Readiness level seeded into loop-ledger.json so the loop-guard skill can
 * resolve a realistic per-run token budget from `loop-cost --json` instead of a
 * hand-typed number. Fix-capable loops draft changes with a verifier (a human
 * still merges), so L2 is the right default; tune it in the ledger if a loop
 * runs unattended (L3) or report-only (L1).
 */
const LEDGER_LEVEL: Record<Pattern, string> = {
  'daily-triage': 'L1',
  'pr-babysitter': 'L2',
  'ci-sweeper': 'L2',
  'dependency-sweeper': 'L2',
  'post-merge-cleanup': 'L2',
  'changelog-drafter': 'L1',
  'issue-triage': 'L1',
};

/**
 * Fix-capable loops retry actions, so they need a circuit breaker: scaffold the
 * loop-guard skill plus a seeded loop-ledger.json wired to `loop-context`.
 * Report-only patterns (daily-triage, issue-triage, changelog-drafter) don't
 * retry fixes, so they skip this to keep the scaffold minimal.
 */
async function scaffoldCircuitBreaker(
  pattern: Pattern,
  tool: Tool,
  targetDir: string,
  templatesRoot: string,
  dryRun: boolean,
) {
  if (!PATTERNS_NEEDING_FIX.has(pattern)) return;

  await copyTemplateSkill(templatesRoot, 'SKILL.md.loop-guard', targetDir, tool, 'loop-guard', dryRun);

  const ledgerPath = path.join(targetDir, 'loop-ledger.json');
  if (await exists(ledgerPath)) return;
  const seed = `${JSON.stringify(
    { goal: LEDGER_GOAL[pattern], pattern, level: LEDGER_LEVEL[pattern], attempts: [] },
    null,
    2,
  )}\n`;
  if (dryRun) {
    console.log(`  would write: ${ledgerPath}`);
    return;
  }
  await writeFile(ledgerPath, seed);
  console.log('  created: loop-ledger.json (circuit breaker)');
}

/**
 * Scaffold the loop-intake skill for patterns that receive ambiguous human
 * input, so the loop sharpens the goal (or escalates) before acting on it.
 */
async function scaffoldIntake(
  pattern: Pattern,
  tool: Tool,
  targetDir: string,
  templatesRoot: string,
  dryRun: boolean,
) {
  if (!PATTERNS_NEEDING_INTAKE.has(pattern)) return;
  await copyTemplateSkill(templatesRoot, 'SKILL.md.loop-intake', targetDir, tool, 'loop-intake', dryRun);
}

function formatTokenCap(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}

function buildLoopBudgetMd(pattern: Pattern): string {
  const b = PATTERN_BUDGET[pattern];
  return `# Loop Budget — YOUR_PROJECT

> Primary loop: **${b.name}** (scaffolded by loop-init)

## Daily limits

| Loop | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
|------|--------------|----------------|--------------------------|
| ${b.name} | ${b.maxRunsPerDay} | ${formatTokenCap(b.dailyCap)} | ${b.maxSpawnsL1} (L1) / ${b.maxSpawnsL2} (L2) |

## On budget exceed

1. Pause schedulers (\`scheduler_delete\` or disable automations)
2. Append event to \`loop-run-log.md\`
3. Notify human (Slack / issue / STATE.md High Priority)

## Kill switch

- Command or issue label: \`loop-pause-all\`
- Resume only after human clears the flag in STATE.md

## Estimate spend

\`\`\`bash
npx @cobusgreyling/loop-cost --pattern ${pattern}
\`\`\`
`;
}

async function scaffoldObservability(
  pattern: Pattern,
  tool: Tool,
  targetDir: string,
  templatesRoot: string,
  dryRun: boolean,
) {
  const budgetPath = path.join(targetDir, 'loop-budget.md');
  const runLogTemplate = path.join(templatesRoot, 'loop-run-log.md.template');
  const runLogPath = path.join(targetDir, 'loop-run-log.md');

  if (!(await exists(budgetPath))) {
    const content = buildLoopBudgetMd(pattern);
    if (dryRun) {
      console.log(`  would write: ${budgetPath}`);
    } else {
      await writeFile(budgetPath, content);
      console.log(`  created: loop-budget.md`);
    }
  }

  if (!(await exists(runLogPath))) {
    await copyFile(runLogTemplate, runLogPath, dryRun);
  }

  await copyTemplateSkill(templatesRoot, 'SKILL.md.loop-budget', targetDir, tool, 'loop-budget', dryRun);
}

async function scaffoldConstraints(
  targetDir: string,
  templatesRoot: string,
  tool: Tool,
  dryRun: boolean,
) {
  const constraintsPath = path.join(targetDir, 'loop-constraints.md');
  const constraintsTemplate = path.join(templatesRoot, 'loop-constraints.md');

  if (!(await exists(constraintsPath)) && (await exists(constraintsTemplate))) {
    await copyFile(constraintsTemplate, constraintsPath, dryRun);
  }

  await copyTemplateSkill(templatesRoot, 'SKILL.md.loop-constraints', targetDir, tool, 'loop-constraints', dryRun);
}

async function copyFile(src: string, dest: string, dryRun: boolean) {
  if (!(await exists(src))) return false;
  if (dryRun) {
    console.log(`  would copy: ${src} → ${dest}`);
    return true;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
  console.log(`  copied: ${src} → ${dest}`);
  return true;
}

const OPENCODE_RUN = 'opencode run';

function firstLoopCommand(pattern: Pattern, tool: Tool): string {
  const cmds: Record<Pattern, Record<Tool, string>> = {
    'daily-triage': {
      grok: '/loop 1d Run loop-triage. Update STATE.md. No auto-fix in week one.',
      claude: '/loop 1d $loop-triage — update STATE.md. Report-only week one.',
      codex: 'Automation daily: $loop-triage → update STATE.md. Report-only.',
      opencode: `${OPENCODE_RUN} "Run loop-triage. Read STATE.md first. Update High Priority and Watch List. No auto-fix in week one." --agent loop-triage`,
    },
    'pr-babysitter': {
      grok: '/loop 10m Run pr-review-triage. Update pr-babysitter-state.md. Worktree + minimal-fix + verifier for allowlisted PRs only. Escalate after 3 attempts.',
      claude: '/loop 10m $pr-review-triage — update pr-babysitter-state.md. No auto-merge.',
      codex: 'Automation 10m: pr-review-triage → pr-babysitter-state.md. No auto-merge.',
      opencode: `${OPENCODE_RUN} "Run PR babysitter triage. Read pr-babysitter-state.md first. Report only — no code edits." --title "PR babysitter"`,
    },
    'ci-sweeper': {
      grok: '/loop 15m Run ci-triage on failing CI. Update ci-sweeper-state.md. Fix only regressions in worktree. Max 3 attempts.',
      claude: '/loop 15m $ci-triage — update ci-sweeper-state.md. Max 3 fix attempts.',
      codex: 'Automation 15m: ci-triage on CI failures. Max 3 attempts.',
      opencode: `${OPENCODE_RUN} "Run ci-triage on failing CI. Update ci-sweeper-state.md. Report only in week one."`,
    },
    'dependency-sweeper': {
      grok: '/loop 6h Run dependency-triage. Patch-only auto-fix in worktree + verifier. Escalate majors and denylist.',
      claude: '/loop 6h $dependency-triage — patch-only with verifier. Escalate risky bumps.',
      codex: 'Automation 6h: dependency-triage. Patch-only with verifier.',
      opencode: `${OPENCODE_RUN} "Run dependency-triage. Update dependency-sweeper-state.md. Report only — escalate majors."`,
    },
    'post-merge-cleanup': {
      grok: '/loop 1d Run post-merge-scan on recent merges. Update post-merge-state.md. Small fixes only in worktree.',
      claude: '/loop 1d $post-merge-scan — update post-merge-state.md. Small fixes only.',
      codex: 'Automation daily: post-merge-scan → post-merge-state.md.',
      opencode: `${OPENCODE_RUN} "Run post-merge-scan. Update post-merge-state.md. Report only in week one."`,
    },
    'changelog-drafter': {
      grok: '/loop 1d Run changelog-scan on merges since last tag. Produce categorized draft in RELEASE_NOTES_DRAFT.md using draft-release-notes. Update changelog-drafter-state.md. Human review only.',
      claude: '/loop 1d $changelog-scan + draft-release-notes — write RELEASE_NOTES_DRAFT.md and update state. Human approves before publish.',
      codex: 'Automation daily: changelog-scan + draft-release-notes → RELEASE_NOTES_DRAFT.md. Human review.',
      opencode: `${OPENCODE_RUN} "Run changelog-scan. Draft RELEASE_NOTES_DRAFT.md. Human review only — no publish."`,
    },
    'issue-triage': {
      grok: '/loop 2h Run issue-triage. Update issue-triage-state.md. Propose labels and priority only. No auto-apply. Human reviews the needs-human slice.',
      claude: '/loop 2h $issue-triage — update issue-triage-state.md. Suggest labels on allowlisted areas only. Report mode week one.',
      codex: 'Automation 2h: issue-triage → issue-triage-state.md. Propose only.',
      opencode: `${OPENCODE_RUN} "Run issue-triage. Update issue-triage-state.md. Propose labels only — no auto-apply."`,
    },
  };
  return cmds[pattern][tool];
}

async function resolveAuditCli(): Promise<string | null> {
  const monorepo = path.resolve(PACKAGE_ROOT, '../loop-audit/dist/cli.js');
  if (await exists(monorepo)) return monorepo;
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const pkg = require.resolve('@cobusgreyling/loop-audit/package.json');
    return path.join(path.dirname(pkg), 'dist/cli.js');
  } catch {
    return null;
  }
}

async function runAuditJson(cli: string, targetDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cli, targetDir, '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      if (stdout.trim()) resolve(stdout);
      else reject(new Error('loop-audit produced no output'));
    });
  });
}

async function runAuditSummary(
  targetDir: string,
): Promise<{ score: number; level: string; assessment: string } | null> {
  const cli = await resolveAuditCli();
  if (!cli) return null;
  try {
    const stdout = await runAuditJson(cli, targetDir);
    return JSON.parse(stdout) as { score: number; level: string; assessment: string };
  } catch {
    return null;
  }
}

function formatScoreBar(score: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}  ${score}/100`;
}

function auditTargetArg(target: string, targetDir: string): string {
  return target === '.' ? '.' : targetDir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`loop-init — scaffold loop engineering starters

Usage:
  loop-init [target-dir] --pattern <name> --tool <grok|claude|codex|opencode> [--with-foundry]

Patterns:
  daily-triage (default)
  pr-babysitter
  ci-sweeper
  dependency-sweeper
  post-merge-cleanup
  changelog-drafter (new low-risk release notes pattern)
  issue-triage (new low-risk issue queue health companion to daily triage)

Options:
  -p, --pattern     Pattern to scaffold
  -t, --tool        Tool target (default: grok)
  --with-foundry    Also scaffold .foundry/ stack (harness-foundry runtime)
  --with-memory     Also scaffold memory-engineering tiers and budget
  --with-fleet      Also scaffold fleet-engineering registry and inbox
  --model-provider  Implementer interface provider (default: anthropic; minimax)
  --region          MiniMax region when --model-provider minimax (global_en, cn_zh)
  --model           MiniMax model when --model-provider minimax (MiniMax-M3, MiniMax-M2.7)
  --dry-run         Print actions without copying
  -h, --help        This help

Foundry presets (with --with-foundry):
  report-only patterns → minimal
  fix-capable patterns → implementer

Examples:
  npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
  npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok --with-foundry
  npx @cobusgreyling/loop-init . -p pr-babysitter -t claude --with-foundry
  npx @cobusgreyling/loop-init . -p ci-sweeper -t grok --with-foundry --model-provider minimax
  npx @cobusgreyling/loop-init . -p ci-sweeper -t grok --with-foundry --model-provider minimax --region cn_zh --model MiniMax-M2.7
  npx @cobusgreyling/loop-init . -p daily-triage -t opencode
  npx @cobusgreyling/loop-init . --with-memory
  npx @cobusgreyling/loop-init . --with-fleet
`);
    process.exit(0);
  }

  const { pattern, tool, target, dryRun, withFoundry, withMemory, withFleet, modelProvider, region, model } = args;

  const validPatterns = Object.keys(PATTERN_STARTERS) as Pattern[];
  const validTools = Object.keys(TOOL_SUFFIX) as Tool[];
  if (!validPatterns.includes(pattern)) {
    console.error(`Unknown pattern: ${pattern}. Valid: ${validPatterns.join(', ')}`);
    process.exit(1);
  }
  if (!validTools.includes(tool)) {
    console.error(`Unknown tool: ${tool}. Valid: ${validTools.join(', ')}`);
    process.exit(1);
  }
  const validProviders: ModelProvider[] = ['anthropic', 'minimax'];
  if (!validProviders.includes(modelProvider)) {
    console.error(`Unknown model provider: ${modelProvider}. Valid: ${validProviders.join(', ')}`);
    process.exit(1);
  }
  if (modelProvider === 'minimax') {
    if (!MINIMAX_REGION_IDS.includes(region)) {
      console.error(`Unknown region: ${region}. Valid: ${MINIMAX_REGION_IDS.join(', ')}`);
      process.exit(1);
    }
    if (!MINIMAX_MODEL_IDS.includes(model)) {
      console.error(`Unknown model: ${model}. Valid: ${MINIMAX_MODEL_IDS.join(', ')}`);
      process.exit(1);
    }
  }

  const targetDir = path.resolve(target);
  const baseStarter = PATTERN_STARTERS[pattern];
  const suffix = TOOL_SUFFIX[tool];
  const starterName = `${baseStarter}${suffix}`;
  const startersRoot = await resolveBundledOrMonorepo('starters');
  const templatesRoot = await resolveBundledOrMonorepo('templates');
  const starterRoot = path.join(startersRoot, starterName);

  if (!(await exists(starterRoot))) {
    const fallback = path.join(startersRoot, baseStarter);
    if (!(await exists(fallback))) {
      console.error(`Starter not found: ${starterRoot}`);
      process.exit(1);
    }
    console.log(`Note: no ${tool} variant for ${pattern} — using ${baseStarter} (Grok paths)`);
  }

  const effectiveStarter = (await exists(starterRoot))
    ? starterRoot
    : path.join(startersRoot, baseStarter);

  console.log(`\nloop-init: ${pattern} → ${targetDir} (${tool})${dryRun ? ' [dry-run]' : ''}\n`);

  if (tool === 'opencode') {
    const skillsDir = path.join(effectiveStarter, 'skills');
    if (await exists(skillsDir)) {
      const entries = await readDirNames(skillsDir);
      for (const entry of entries) {
        await copyDir(
          path.join(skillsDir, entry),
          path.join(targetDir, 'skills', entry),
          dryRun,
        );
      }
    }

    const agentsMd = path.join(effectiveStarter, 'AGENTS.md');
    if (await exists(agentsMd)) {
      await copyFile(agentsMd, path.join(targetDir, 'AGENTS.md'), dryRun);
    }

    const opencodeJson = path.join(effectiveStarter, 'opencode.json.example');
    if (await exists(opencodeJson)) {
      await copyFile(opencodeJson, path.join(targetDir, 'opencode.json'), dryRun);
    }
  } else {
    const skillRoots = [
      path.join(effectiveStarter, '.grok', 'skills'),
      path.join(effectiveStarter, '.claude', 'skills'),
      path.join(effectiveStarter, '.codex', 'skills'),
    ];

    for (const skillsDir of skillRoots) {
      if (!(await exists(skillsDir))) continue;
      const toolPrefix = skillsDir.includes('.grok')
        ? '.grok/skills'
        : skillsDir.includes('.claude')
          ? '.claude/skills'
          : '.codex/skills';
      const entries = await readDirNames(skillsDir);
      for (const entry of entries) {
        await copyDir(
          path.join(skillsDir, entry),
          path.join(targetDir, toolPrefix, entry),
          dryRun,
        );
      }
    }

    const agentFiles = [
      { src: path.join(effectiveStarter, '.claude', 'agents'), dest: path.join(targetDir, '.claude', 'agents') },
      { src: path.join(effectiveStarter, '.codex', 'agents'), dest: path.join(targetDir, '.codex', 'agents') },
    ];
    for (const { src, dest } of agentFiles) {
      if (await exists(src)) {
        const entries = await readDirNames(src);
        for (const entry of entries) {
          await copyFile(path.join(src, entry), path.join(dest, entry), dryRun);
        }
      }
    }
  }

  const stateFile = STATE_FILES[pattern];
  const stateExample = path.join(effectiveStarter, `${stateFile}.example`);
  if (await exists(stateExample)) {
    await copyFile(stateExample, path.join(targetDir, stateFile), dryRun);
  } else {
    const alt = path.join(effectiveStarter, 'STATE.md.example');
    if (await exists(alt)) {
      await copyFile(alt, path.join(targetDir, stateFile), dryRun);
    }
  }

  const loopMd = path.join(effectiveStarter, 'LOOP.md');
  if (await exists(loopMd)) {
    await copyFile(loopMd, path.join(targetDir, 'LOOP.md'), dryRun);
  }

  await copyL2Templates(pattern, tool, targetDir, templatesRoot, dryRun);
  await scaffoldCircuitBreaker(pattern, tool, targetDir, templatesRoot, dryRun);
  await scaffoldObservability(pattern, tool, targetDir, templatesRoot, dryRun);
  await scaffoldIntake(pattern, tool, targetDir, templatesRoot, dryRun);

  await scaffoldConstraints(targetDir, templatesRoot, tool, dryRun);
  if (tool !== 'opencode' && !dryRun && !(await exists(path.join(targetDir, 'AGENTS.md')))) {
    const agentsTemplate = `# AGENTS.md

## Test commands
npm test
npm run lint

## Loop conventions
- Report-only week one (L1) before enabling auto-fix (L2)
- See LOOP.md for cadence and human gates
`;
    await writeFile(path.join(targetDir, 'AGENTS.md'), agentsTemplate);
    console.log('  created: AGENTS.md (template)');
  }

  let foundryPreset: FoundryPreset | undefined;
  if (withFoundry) {
    console.log('');
    console.log('Harness foundry:');
    const foundry = await scaffoldFoundry(pattern, targetDir, dryRun, {
      provider: modelProvider,
      region,
      model,
    });
    foundryPreset = foundry?.preset;
  }

  if (withMemory) {
    console.log('');
    console.log('Memory engineering:');
    await scaffoldMemory(targetDir, templatesRoot, dryRun);
  }

  if (withFleet) {
    console.log('');
    console.log('Fleet engineering:');
    await scaffoldFleet(targetDir, templatesRoot, dryRun);
  }

  const auditArg = auditTargetArg(target, targetDir);
  let auditScore: number | null = null;

  if (!dryRun) {
    const audit = await runAuditSummary(targetDir);
    if (audit) {
      auditScore = audit.score;
      console.log('');
      console.log(`✓ Loop Ready: ${audit.score}/100 (${audit.level})`);
      console.log(`  ${formatScoreBar(audit.score)}`);
      console.log(`  ${audit.assessment}`);
      console.log('');
      console.log('Paste badge in README:');
      console.log(`  npx @cobusgreyling/loop-audit ${auditArg} --badge`);
    } else {
      console.log('\n=== Loop Ready score ===');
      console.log(`  npx @cobusgreyling/loop-audit ${auditArg} --suggest`);
    }
  }

  if (PATTERNS_NEEDING_FIX.has(pattern)) {
    console.log('');
    console.log('Circuit breaker wired (loop-guard skill + loop-ledger.json):');
    console.log('  npx @cobusgreyling/loop-context --check --ledger loop-ledger.json');
  }

  if (PATTERNS_NEEDING_INTAKE.has(pattern)) {
    console.log('');
    console.log('Intake wired (loop-intake skill): clarify a vague item or escalate before acting.');
  }

  console.log('');
  console.log(`First loop (${tool}):`);
  console.log(`  ${firstLoopCommand(pattern, tool)}`);
  console.log('');
  console.log(`Estimate cost: npx @cobusgreyling/loop-cost --pattern ${pattern} --level L1`);
  printFoundryCta({
    pattern,
    tool,
    withFoundry,
    score: auditScore,
    preset: foundryPreset,
  });
  printMemoryCta({
    pattern,
    tool,
    withMemory,
    score: auditScore,
  });
  printFleetCta({
    pattern,
    tool,
    withFleet,
    score: auditScore,
  });
  printContributorCta();
}

async function readDirNames(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() || e.isFile()).map((e) => e.name);
}

main().catch((err) => {
  console.error('loop-init failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});