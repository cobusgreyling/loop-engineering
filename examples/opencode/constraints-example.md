# Opencode Constraints Example

This example shows how to define simple guardrails for a CLI-first workflow using Opencode.

It pairs with:

```bash
loop-init --tool opencode
```

After initialization, you can customize the generated skill with project-specific constraints.

## Example

```text
skills/
└── loop-triage/
    └── SKILL.md
```

```markdown
# Loop Triage

## Constraints

- Read-only during the first week of onboarding.
- Never force-push to any branch.
- Only modify files directly related to the assigned issue.
- Request confirmation before deleting or renaming files.
- Do not expose secrets, tokens, or internal URLs.
```

## Why use constraints?

Constraints help make automated workflows predictable and reduce the chance of accidental or unsafe actions.

They are especially useful for new contributors or shared repositories.

## Related documentation

- See `docs/safety.md` for general safety guidance.
- Compare this with the Cursor constraints example for an editor-focused workflow.