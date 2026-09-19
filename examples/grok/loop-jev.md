# Grok + loop-jev

Use Jev as the cheap decision layer in front of a Grok `/loop` run.

```bash
# Once per machine (never commit the key)
# TYPESAFE_API_KEY in the environment, or ~/.config/typesafe/api_key mode 600

npx @cobusgreyling/loop-jev doctor
```

In the loop skill / control script, before the implementer:

```bash
npx @cobusgreyling/loop-jev turn --goal "$GOAL" --json > /tmp/jev-turn.json || exit 2
# read .route.tier and .action — if action != pass, escalate
```

After the session:

```bash
npx @cobusgreyling/loop-jev classify --trace .foundry/sessions/*/trace.jsonl --json
```

See [docs/jev.md](../../docs/jev.md) and [skills/loop-jev/SKILL.md](../../skills/loop-jev/SKILL.md).
