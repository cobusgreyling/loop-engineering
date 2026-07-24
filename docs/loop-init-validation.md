# loop-init Validation Checklist

Tracks whether `npx @cobusgreyling/loop-init` produces a working, sane scaffold
for each pattern × --tool combination. Fill in a row after actually running
the command in a fresh git repo — don't guess.

## How to validate a row

\`\`\`
mkdir <temp-folder> && cd <temp-folder>
git init
npx @cobusgreyling/loop-init . --pattern <pattern> --tool <tool>
\`\`\`

Record the printed Loop Ready score, list files created, and note anything
unexpected. Command used for validation below (Windows/PowerShell):

\`\`\`
mkdir C:\Temp\loop-init-test
cd C:\Temp\loop-init-test
git init
npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude
\`\`\`

## Automated contract

The scaffold matrix in `tools/loop-init/test/cli.test.mjs` runs every supported
pattern × tool combination in a fresh temporary directory. It verifies the
state, observability, constraints, primary skill, and tool-specific files, plus
the presence or absence of circuit-breaker and intake assets where required.

\`\`\`
cd tools/loop-init
npm test
\`\`\`

The automated matrix guards the scaffold contract on every PR. The table below
remains the place for manual UX checks such as the printed Loop Ready score,
platform-specific behavior, and unexpected output.

## Matrix

| Pattern | --tool | Loop Ready score | Files created | Notes |
|---|---|---|---|---|
| daily-triage | claude | 100/100 (L3) | `.claude/skills/loop-triage/`, `.claude/agents/loop-verifier.md`, `STATE.md`, `LOOP.md`, `loop-budget.md`, `loop-run-log.md`, `loop-constraints.md`, `.claude/skills/loop-budget/SKILL.md`, `.claude/skills/loop-constraints/SKILL.md`, `AGENTS.md` (template) | Clean scaffold, no errors. Immediately scored 100/100 with no manual edits. |
| daily-triage | grok | | | |
| daily-triage | codex | | | |
| daily-triage | opencode | | | |
| ci-sweeper | claude | | | |
| ci-sweeper | grok | | | |
| ci-sweeper | codex | | | |
| ci-sweeper | opencode | | | |
| pr-babysitter | claude | | | |
| pr-babysitter | grok | | | |
| pr-babysitter | codex | | | |
| pr-babysitter | opencode | | | |
| dependency-sweeper | claude | | | |
| dependency-sweeper | grok | | | |
| dependency-sweeper | codex | | | |
| dependency-sweeper | opencode | | | |
| post-merge-cleanup | claude | | | |
| post-merge-cleanup | grok | | | |
| post-merge-cleanup | codex | | | |
| post-merge-cleanup | opencode | | | |
| changelog-drafter | claude | | | |
| changelog-drafter | grok | | | |
| changelog-drafter | codex | | | |
| changelog-drafter | opencode | | | |
| issue-triage | claude | | | |
| issue-triage | grok | | | |
| issue-triage | codex | | | |
| issue-triage | opencode | | | |

Empty rows are open for other contributors — see #231.
