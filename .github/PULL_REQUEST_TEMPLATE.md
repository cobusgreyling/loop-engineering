## Summary
<!-- One sentence: what this does and why -->

## Related issue
<!-- Fixes #123 or Relates to #456 — link if there is one -->

## Changes
- [ ] New pattern or starter (followed `templates/pattern-template.md` + updated `registry.yaml`)
- [ ] Doc / example / story improvement
- [ ] Tool / CLI change under `tools/`
- [ ] Test only
- [ ] Other

## Checklist (from CONTRIBUTING)
- [ ] Links work from README or the relevant index
- [ ] No secrets, tokens, or internal company URLs
- [ ] `STATE.md*` examples use `.example` suffix
- [ ] Safety-related content references `docs/safety.md`
- [ ] If you touched a package under `tools/<pkg>`: `cd tools/<pkg> && npm ci && npm test`
- [ ] If you touched the registry: root `npm ci && npm run validate:registry`

## Testing / Dogfood
- [ ] `npx @cobusgreyling/loop audit .` (or package-local tests) on affected paths
- [ ] Manual review of generated state / skill output if scaffolding changed

---

Docs, stories, adopters, and small tests: **maintainers aim to review within 48 hours** (same-day when possible).
