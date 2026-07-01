# AGENTS.md — PR Babysitter (Opencode)

## Loop Mode
- Start in L1 report-only mode.
- Read `pr-babysitter-state.md` before any triage.
- Do not edit source code until the human explicitly enables L2.

## Safety
- Never force-push without explicit human opt-in.
- Draft PRs by default; humans mark ready for review.
- Do not resolve review threads without approval.
- Security, auth, payments, infra, or public API changes always escalate.
- Max 3 fix attempts per PR before handoff.

## Verification
- For L2+ changes, dispatch verifier sub-agent after implementation.
- Run the project's documented tests before proposing a fix.
- Check for existing PR on the same intent before pushing.
