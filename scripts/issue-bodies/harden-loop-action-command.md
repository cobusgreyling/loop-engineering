## Goal

Harden `tools/loop-action/action.yml` so `inputs.command` is not expanded unquoted into the shell (fragile for multi-arg / multi-line agent invocations).

## Files

- `tools/loop-action/action.yml`
- `tools/loop-action/README.md` (document the safe usage)

## Acceptance criteria

- [ ] Sandbox and direct paths pass the command safely (e.g. write to a temp script, or use `bash -lc` with a properly quoted string / env var)
- [ ] Multi-line `command: |` examples in `examples/github-actions/*.yml` still work
- [ ] README warns against embedding untrusted input in `command`
- [ ] No behavior change for the simple placeholder `echo` examples beyond safer invocation

**Estimated time:** ~45–60 minutes (tooling; still scoped)

Comment **"I'll take this"** to get assigned.
