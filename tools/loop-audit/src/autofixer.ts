import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileExists } from '@cobusgreyling/readiness-core';
import { AuditResult } from './auditor.js';

const STATE_MD_TEMPLATE = `# Loop State — YOUR_PROJECT

Last run: (set by loop on each run)

## High Priority (loop is acting or waiting on human)

<!-- Format:
- [ ] ID — one-line description
  Loop action: what the loop did last
  Human decision: (if any)
-->

## Watch List

<!-- Items to monitor but not act on yet -->

## Recent Noise (ignored this run)

<!-- Brief list — helps tune triage skill -->

---
Run log: (timestamp) | findings | actions | escalations
`;

const LOOP_BUDGET_TEMPLATE = `# Loop Budget — YOUR_PROJECT

## Daily limits

| Loop | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
|------|--------------|----------------|--------------------------|
| Daily Triage | 2 | 100k | 0 (L1) / 2 (L2) |
| PR Babysitter | 288 | 2M | 3 |
| CI Sweeper | 96 | 1M | 3 |
| Dependency Sweeper | 4 | 500k | 3 |
| Post-Merge Cleanup | 1 | 200k | 2 |

## On budget exceed

1. Pause all schedulers (\`scheduler_delete\` or disable automations)
2. Append event to \`loop-run-log.md\`
3. Notify human (Slack / issue / STATE.md High Priority)

## Kill switch

- Command or issue label: \`loop-pause-all\`
- Resume only after human clears the flag in STATE.md
`;

const LOOP_RUN_LOG_TEMPLATE = `# Loop Run Log — YOUR_PROJECT

Append one entry per run. Prune entries older than 30 days.

## Format

\`\`\`json
{
  "run_id": "2026-06-09T08:15:00Z",
  "pattern": "daily-triage",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "report-only | fix-proposed | escalated | no-op"
}
\`\`\`

## Recent Runs

<!-- Loop appends below this line -->
`;

const LOOP_CONSTRAINTS_TEMPLATE = `# Loop Constraints

> Add rules below with \`/constraints <rule>\` in your agent.
> The \`loop-constraints\` skill reads this file at the start of every run.
> Constraints here are **binding** — the agent MUST follow them.

## Push & Merge
- Don't push before telling me
- Never auto-merge to main without human approval
- Always create a draft PR first; let me review before marking ready

## Paths
- Never edit .env, .env.*, auth/, payments/, secrets/, credentials/
- Never edit infrastructure configs without human approval

## Code
- Always run tests before proposing a fix
- Never disable tests to make CI green
- Never refactor unrelated code — one fix per run
- Max 3 fix attempts per item; escalate after
- Enforce the attempt limit mechanically: log each try to \`loop-ledger.json\` and run \`loop-context --check\` before retrying (see the \`loop-guard\` skill)

## Communication
- Always tell me what you're about to do before doing it
- Never close an issue or PR without my approval

## Budget
- If token spend hits 80% of daily cap, switch to report-only
- If loop-pause-all is active, exit immediately

---
<!-- Add your own rules below. Use plain English. The loop reads this verbatim. -->
`;

const LOOP_MD_TEMPLATE = `# Loop Configuration — Minimal Triage

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Daily Triage | 1d | L1 report-only | See README |

## Human Gates

- No auto-fix until L2 checklist complete
- All high-risk paths: human review required

## Budget

- Max sub-agent spawns per run: 0 (L1) / 2 (L2)
- Max tokens/day: 100k (see \`loop-budget.md\`)
- Append each run to \`loop-run-log.md\`; use \`loop-budget\` skill at start/end
- Kill switch: \`loop-pause-all\` — pause schedulers and notify human
- Estimate: \`npx @cobusgreyling/loop-cost --pattern daily-triage\`
`;

// The Path Denylist block below is read by loop-sync's
// extractSafetyDenylist, which takes the first fenced block after the heading
// and compares it entry-for-entry with gate.yaml's denylist. It has to stay a
// fence with bare globs -- a bullet list is invisible to that parser, and any
// glob that gate.yaml does not carry is reported as drift the moment both
// files are scaffolded.
const SAFETY_MD_TEMPLATE = `# Loop Safety Policy

## Auto-merge policy
- Never auto-merge to main. All code changes require human review.

## Path Denylist

The loop must **never** auto-edit these without human approval:

\`\`\`
**/.env
**/.env.*
**/secrets/**
**/credentials/**
**/*_key*
**/*_secret*
\`\`\`

## MCP Scopes
- Read-only unless explicitly allowed.
`;

const AGENTS_MD_TEMPLATE = `# AGENTS.md — Project Conventions

## Build & Test
- Run \`npm test\` to verify changes.

## Review Norms
- Never auto-merge changes.
- Ensure all loops isolate their work in worktrees.
`;

const GATE_YAML_TEMPLATE = `# Machine-readable twin of docs/safety.md, enforced by \`loop-gate check\`.
# See templates/gate.yaml.template in loop-engineering for the full reference.
version: 1

denylist:
  - "**/.env"
  - "**/.env.*"
  - "**/secrets/**"
  - "**/credentials/**"
  - "**/*_key*"
  - "**/*_secret*"

# Escalate instead of auto-merging when a change touches more than this many files.
maxFiles: 10

# --action auto-merge only proceeds if every changed path matches one of these.
autoMergeAllowlist:
  - "docs/**"
  - "**/*.md"
`;

export async function autoFixProject(target: string, result: AuditResult): Promise<void> {
  const root = path.resolve(target);
  let fixesApplied = 0;

  console.log('\n=== Auto-Fixing Repository ===\n');

  const safeWriteFile = async (relPath: string, content: string, label: string) => {
    const fullPath = path.join(root, relPath);
    if (!(await fileExists(fullPath))) {
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf8');
      console.log(`✅ Generated ${relPath} (${label})`);
      fixesApplied++;
    } else {
      console.log(`⏭️  Skipped ${relPath} (already exists)`);
    }
  };

  if (!result.signals.stateFile.present) {
    await safeWriteFile('STATE.md', STATE_MD_TEMPLATE, 'Base state tracking');
  }

  if (!result.signals.loopConfig.present) {
    await safeWriteFile('LOOP.md', LOOP_MD_TEMPLATE, 'Loop configuration');
  }

  if (!result.signals.cost.budgetDoc) {
    await safeWriteFile('loop-budget.md', LOOP_BUDGET_TEMPLATE, 'Cost caps');
  }

  if (!result.signals.cost.runLog) {
    await safeWriteFile('loop-run-log.md', LOOP_RUN_LOG_TEMPLATE, 'Run history');
  }

  if (!result.signals.constraints.present) {
    await safeWriteFile('loop-constraints.md', LOOP_CONSTRAINTS_TEMPLATE, 'Agent rules');
  }

  if (!result.signals.safety.safetyDocPresent) {
    await safeWriteFile('docs/safety.md', SAFETY_MD_TEMPLATE, 'Safety policy');
  }

  if (!result.signals.agentsMd.present) {
    await safeWriteFile('AGENTS.md', AGENTS_MD_TEMPLATE, 'Project conventions');
  }

  if (!result.signals.governance.gateYaml) {
    await safeWriteFile('gate.yaml', GATE_YAML_TEMPLATE, 'Explicit human approval gates');
  }

  const shellFix = (cmd: string, label: string) => {
    console.log(`\n⚙️  Applying ${label}...`);
    try {
      execSync(cmd, { stdio: 'inherit', cwd: root });
      console.log(`✅ Applied ${label}`);
      fixesApplied++;
    } catch (err) {
      console.error(`❌ Failed to apply ${label}:`, err instanceof Error ? err.message : String(err));
    }
  };

  if (!result.signals.memory.tiers) {
    shellFix('npx @cobusgreyling/loop-init . --with-memory', 'Memory engineering');
  }

  if (!result.signals.harness.stack) {
    shellFix('npx @cobusgreyling/loop-init . --with-foundry', 'Harness foundry');
  }

  if (fixesApplied > 0) {
    console.log(`\n✨ Applied ${fixesApplied} automatic fixes. Run loop-audit again to see your new score!`);
  } else {
    console.log('\nNo safe automatic fixes could be applied. (Check the suggestions manually).');
  }
}
