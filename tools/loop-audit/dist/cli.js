#!/usr/bin/env node
import { auditProject } from './auditor.js';
import { printContributorCta } from './contributor-cta.js';
import { formatBadge, formatHuman, formatJson, formatMarkdown } from './reporter.js';
import { autoFixProject } from './autofixer.js';
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('-')) || '.';
const json = args.includes('--json');
const md = args.includes('--md');
const suggest = args.includes('--suggest') || args.includes('--fix');
const autoFix = args.includes('--auto-fix');
const badge = args.includes('--badge');
const help = args.includes('--help') || args.includes('-h');
if (help) {
    console.log(`loop-audit — Loop Readiness Score CLI (v1.7+)

Usage:
  loop-audit [path] [options]

Options:
  --json      JSON output (for CI / scripting)
  --md        Markdown report
  --suggest   Show copy-from-template commands for missing pieces (recommended on first runs)
  --auto-fix  Auto-heal missing repository structure (STATE, LOOP, budgets, etc.)
  --badge     Markdown README badge (Loop Ready level + score)
  --help, -h  This help

New in v1.7:
  • Harness Runtime signals: .foundry/stack.yaml, stack.lock, sessions/traces, outerloop emit, host integrate
  • Loop Ready 80+ funnel CTA → harness-foundry (loop-init --with-foundry)

New in v1.6:
  • Governance signals: least-privilege tool scope, stall / no-progress detection, human-escalation path

New in v1.4:
  • Dynamic "loop activity" detection (git history, "Last run" in STATE, scheduled workflows)
  • Higher L3 bar requires proven usage, not just files
  • Stronger recommendations when structure exists but no runs yet

Exit codes:
  0  score >= 40
  2  score < 40 (early stage or gate)

Examples:
  loop-audit .
  loop-audit . --suggest
  loop-audit . --badge >> README.md
  npx @cobusgreyling/loop-audit . --json
  npx @cobusgreyling/loop-audit starters/minimal-loop --suggest
  bash scripts/before-after-demo.sh
`);
    process.exit(0);
}
try {
    const result = await auditProject(target);
    if (badge)
        console.log(formatBadge(result));
    else if (json)
        console.log(formatJson(result));
    else if (md)
        console.log(formatMarkdown(result));
    else
        console.log(formatHuman(result));
    if (autoFix) {
        await autoFixProject(target, result);
    }
    else if (suggest) {
        console.log('\n=== Suggested actions (copy & customize) ===');
        console.log('From the root of this repo (or after cloning the reference):');
        console.log('');
        console.log('  # Minimal L1 daily triage — pick your tool');
        console.log('  # Grok:');
        console.log('  cp -r starters/minimal-loop/.grok/skills/loop-triage .grok/skills/');
        console.log('  # Claude Code:');
        console.log('  cp -r starters/minimal-loop-claude/.claude/skills/loop-triage .claude/skills/');
        console.log('  cp starters/minimal-loop-claude/.claude/agents/loop-verifier.md .claude/agents/');
        console.log('  # Codex:');
        console.log('  cp -r starters/minimal-loop-codex/.codex/skills/loop-triage .codex/skills/');
        console.log('  cp starters/minimal-loop-codex/.codex/agents/verifier.toml .codex/agents/');
        console.log('  # Opencode:');
        console.log('  npx @cobusgreyling/loop-init . --pattern daily-triage --tool opencode');
        console.log('  # or: cp starters/minimal-loop-opencode/opencode.json.example opencode.json');
        console.log('  # All tools:');
        console.log('  cp starters/minimal-loop/STATE.md.example STATE.md   # or -claude / -codex variant');
        console.log('  cp starters/minimal-loop/LOOP.md .');
        console.log('  cp templates/loop-budget.md.template loop-budget.md');
        console.log('  cp templates/loop-run-log.md.template loop-run-log.md');
        console.log('');
        console.log('  # Maker/checker verifier (Grok / generic skills dir)');
        console.log('  mkdir -p .grok/skills/loop-verifier');
        console.log('  cp templates/SKILL.md.verifier .grok/skills/loop-verifier/SKILL.md');
        console.log('');
        console.log('  # Common minimal fix action');
        console.log('  mkdir -p .grok/skills/minimal-fix');
        console.log('  cp templates/SKILL.md.minimal-fix .grok/skills/minimal-fix/SKILL.md');
        console.log('');
        console.log('  # For PR babysitter / CI sweeper patterns, copy the corresponding starter');
        console.log('  # Then run:  loop-audit . --suggest   (again after changes)');
        console.log('');
        console.log('  # Or scaffold automatically:');
        console.log('  npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude');
        console.log('  npx @cobusgreyling/loop-cost --pattern daily-triage --level L1');
        console.log('');
        console.log('  # Optional companions (not required for week one):');
        console.log('  npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude --with-foundry');
        console.log('  # or: npx @cobusgreyling/harness-foundry init --from loop-engineering:daily-triage');
        console.log('  npx @cobusgreyling/harness-foundry validate && npx @cobusgreyling/harness-foundry run --goal "Verify wiring"');
        console.log('');
        console.log('  # IMPORTANT (v1.4): After scaffolding, actually RUN a loop (report-only) and commit the updated STATE.md.');
        console.log('  # This creates the "loopActivity" evidence that pushes you toward real L2/L3 scores.');
        console.log('');
        console.log('See docs/loop-design-checklist.md and patterns/ for full guidance.');
    }
    if (!json && !badge && !md)
        printContributorCta();
    if (result.score < 40)
        process.exitCode = 2;
}
catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Audit failed:', msg);
    process.exitCode = 1;
}
