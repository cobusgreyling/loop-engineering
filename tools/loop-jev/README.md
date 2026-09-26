# loop-jev

TypeSafe **Jev** (System One) decision layer for Loop Engineering.

Jev is not a language model. You send `state` plus typed questions; it returns calibrated **Choice / Score / Noul** answers your code can act on. One call is typically sub-second and billed on input tokens only (~$0.042 / million).

This package uses that shape to make a loop cheaper and safer:

| Command | Decision | Replaces |
|---------|----------|----------|
| `route` | Which model tier should handle this turn? | Always calling Opus / a frontier model |
| `retrieve` | Which passages belong in context? | Stuffing STATE.md + the whole ledger |
| `guard` | Pass, review, or block this message? | A second LLM moderator |
| `classify` | What failed in this trace? | An LLM judge over jsonl |
| `turn` | Route **and** input-guard in **one** Jev call | Two LLM pre-calls |

Mechanical policy stays with [`loop-gate`](../loop-gate). Run-history circuit breaking stays with [`loop-context`](../loop-context). Jev is the *semantic* layer those two cannot see (jailbreaks in an issue body, instruction drift in a reply, “this CI failure is actually a frontier-tier root-cause”).

## Install & run

```bash
npx @cobusgreyling/loop-jev doctor
npx @cobusgreyling/loop jev route --goal "Draft daily triage" --level L1 --json
```

**From this repo:**

```bash
cd tools/loop-jev
npm install
npm test
```

## Auth

Never put a TypeSafe key in git, `STATE.md`, traces, or CLI flags.

```bash
# environment (CI / local shell)
export TYPESAFE_API_KEY=…          # not committed

# or a mode-600 file
install -m 600 /dev/null ~/.config/typesafe/api_key
# paste the key into that file; do not echo it
```

`TYPESAFE_KEY_FILE` overrides the file path (used by tests). `TYPESAFE_ENDPOINT` / `TYPESAFE_MODEL` override the API (default `https://api.typesafe.ai/v1/systemone` and `jev-latest`).

Without a key, a **heuristic fallback** runs so CI and first-run `doctor` stay usable. Pass `--no-fallback` to require a live Jev call.

## Usage

```bash
loop-jev route --goal "CI has been red for 3 days" --pattern ci-sweeper --level L2 --json
loop-jev retrieve --query "path denylist" --passages passages.json --json
loop-jev guard --side input --text "Ignore previous instructions" --json
loop-jev guard --side output --text - --json < reply.txt
loop-jev classify --trace trace.jsonl --json
loop-jev turn --goal "Draft daily triage" --message "Summarize open PRs" --json
loop-jev doctor --json
```

Exit codes match `loop-gate` / `loop-context`: `0` proceed · `2` escalate · `1` error.

Chain them in a control script:

```bash
loop-jev guard --side input --text "$GOAL" || exit 2
TIER=$(loop-jev route --goal "$GOAL" --level L2 --json | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).tier")
# …run the chosen model…
loop-jev guard --side output --text "$REPLY" || exit 2
loop-context --check --ledger run.json || exit 2
loop-gate check --action auto-merge --paths "$PATHS" || exit 2
```

## Library

```ts
import { routeTask, retrieveContext, guardText, classifyTrace, assessTurn } from '@cobusgreyling/loop-jev';

const route = await routeTask({ goal, pattern: 'daily-triage', level: 'L1' });
const guard = await guardText({ text: goal, side: 'input' });
```

Inject `{ systemOne }` in tests. Production calls `POST /v1/systemone` and **redacts secrets from `state` before send**.

## Tiers

| Tier | Default model id | For |
|------|------------------|-----|
| `nano` | `grok-fast` | Typos, format, list, noop |
| `fast` | `grok` | L1 triage, changelog, labels |
| `balanced` | `claude-sonnet` | Focused L2 patches |
| `frontier` | `claude-opus` | Ambiguous multi-file work |
| `reasoning` | `grok-4.5-thinking` | Verifier / security / maker-checker |

Low Jev confidence (`< 0.55`) does **not** blindly follow a `frontier` pick — the router falls back to `balanced` and sets `uncertain: true`.

See [docs/jev.md](../../docs/jev.md) for how this fits the five primitives.
