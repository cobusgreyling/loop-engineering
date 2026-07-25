## Goal

Document the new **`loop-action`** composite action in QUICKSTART so CI adopters discover it next to the other npm tools.

## Files

- `docs/QUICKSTART.md` — short subsection (inputs, one workflow snippet)
- `examples/github-actions/README.md` — point at `tools/loop-action` and the refactored workflow examples
- Optional: one-line mention in root `README.md` Quick Links if other tools are listed there

## Acceptance criteria

- [ ] Shows `uses: cobusgreyling/loop-engineering/tools/loop-action@…` with `pattern`, `command`, `level`, `sandbox`
- [ ] Notes week-one report-only / no auto-merge
- [ ] Links `tools/loop-action/README.md` and `docs/safety.md`
- [ ] Mentions that unquoted multi-arg `command` values are fragile (prefer a single script path)

**Estimated time:** ~30 minutes

Comment **"I'll take this"** to get assigned.
