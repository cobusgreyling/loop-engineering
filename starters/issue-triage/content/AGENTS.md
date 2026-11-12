# AGENTS.md — Issue Triage (Opencode)

## Loop Mode
- Start in L1 propose-only mode.
- Read `issue-triage-state.md` before every run.
- Never auto-label, auto-close, or auto-comment in week one.

## Safety
- P0/P1 on auth, payments, security, or public API: always escalate.
- L2 auto-labels limited to curated allowlist.
- Verifier gate required before applying any label.

## Verification
- L1: human reviews proposed labels before application.
- L2: verifier confirms labels are in the allowlist.
- Duplicates: propose as "possible duplicate of #NNN" — never auto-close.
