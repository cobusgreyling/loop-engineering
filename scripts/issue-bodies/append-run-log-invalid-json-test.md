## Goal

Add a test (or small smoke script check) that `scripts/append-run-log.mjs` exits cleanly on invalid JSON.

**Pain source:** Community PR #474 replaced a stacktrace with a Usage message + exit 1. Lock that behaviour in.

## Files

- Prefer a tiny test under `scripts/` or document a one-liner in an existing script test if present
- Or add `scripts/append-run-log.test.mjs` if that matches repo style

## Acceptance criteria

- [ ] Invalid second arg (not JSON) → exit code 1 and message mentions Usage / valid JSON
- [ ] Valid minimal JSON entry does not throw on parse (can mock/skip file write if needed)
- [ ] No secrets; keeps change small

**Estimated time:** ~20–30 minutes · label: tooling

Comment **"I'll take this"** to get assigned.
