## Goal

Add a **loop-gate** subsection to QUICKSTART so the denylist / auto-merge allowlist is discoverable next to `gate.yaml`.

## Files

- `docs/QUICKSTART.md` — short subsection
- Cross-link `tools/loop-gate/` and `templates/gate.yaml.template` (or repo `gate.yaml`)

## Acceptance criteria

- [ ] Shows `npx @cobusgreyling/loop-gate check --action auto-merge --paths …`
- [ ] Explains `version: 1` + `denylist` + `autoMergeAllowlist` schema (not a free-form gates list)
- [ ] Notes that `loop-audit --auto-fix` should emit a loadable `gate.yaml`
- [ ] Links `docs/safety.md`

**Estimated time:** ~25 minutes

Comment **"I'll take this"** to get assigned.
