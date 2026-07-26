# Loop Engineering Action

An official GitHub Composite Action to safely execute autonomous agents in your CI/CD pipelines.

Instead of writing complex bash scripts to enforce circuit breakers, run readiness audits, and isolate agent execution in worktrees, this action wraps the entire [Loop Engineering](https://github.com/cobusgreyling/loop-engineering) safety suite into a single, elegant step.

## Usage

```yaml
- uses: cobusgreyling/loop-engineering/tools/loop-action@main
  with:
    pattern: 'ci-sweeper'
    command: 'npx grok-cli run --skill .grok/skills/ci-sweeper/SKILL.md'
    level: 'L2'
    sandbox: 'true'
    sandbox-shell: 'false'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `pattern` | **Yes** | | The loop pattern you are running (e.g., `ci-sweeper`, `daily-triage`). Must match a pattern in `loop-budget.md`. |
| `command` | **Yes** | | The actual terminal command to invoke your agent (e.g., `claude`, `grok`, `aider`). |
| `level` | No | `L1` | The autonomy level for budget constraint verification (`L1`, `L2`, `L3`). |
| `sandbox` | No | `false` | If `'true'`, routes the execution through `loop-sandbox` to provide ephemeral worktree isolation, capturing changes securely without destroying the main working tree. |
| `sandbox-shell` | No | `false` | Compatibility option for `loop-sandbox`: if `'true'`, passes `--shell` so `loop-sandbox` itself invokes the command through its own shell. `command` is always executed as a Bash script regardless of this setting (see below) — `sandbox-shell` does not gate shell syntax and can be left at its default in normal use. |

## What it does under the hood

When this action runs, it sequentially executes:
1. **`loop-audit`**: Checks the repository against the Loop Readiness rubric (ensuring `STATE.md`, `gate.yaml`, and constraints are in place).
2. **`loop-context`**: Acts as a circuit breaker. It halts the workflow immediately if the loop is stuck in a failure cycle or has exhausted its daily token budget.
3. **Write command script**: `command` is passed through the step's `env:` map (not spliced into the `run:` script text) and written verbatim to a temp file under `$RUNNER_TEMP`. This keeps multi-line commands, quotes, and shell metacharacters intact as a single script instead of being re-parsed by the surrounding workflow YAML.
4. **Execution (`loop-sandbox`)**: If `sandbox: 'true'`, that script is invoked as `bash -eo pipefail <script>` inside an ephemeral git worktree via `loop-sandbox`, which tracks all modifications into a patch file and cleans up. Otherwise, it executes `bash -eo pipefail <script>` directly in the main tree.

## Safe usage of `command`

`command` is always executed as a Bash script via the temporary script file
written in step 3 above — this is true whether `sandbox` is `'true'` or
`'false'`, and regardless of `sandbox-shell`. The script runs with `bash -eo
pipefail`, so:
- any command that exits non-zero stops the script immediately (`set -e`)
- a failing command anywhere in a pipeline fails the whole pipeline
  (`pipefail`), not just its last stage

`sandbox-shell` only controls whether `loop-sandbox` additionally routes the
`bash <script>` invocation through its own internal shell (`--shell`) before
running it — it is a `loop-sandbox` compatibility knob, not something you
need to set to get shell syntax (pipes, `&&`, multi-line scripts, etc.) in
`command`. Those already work through the temporary script regardless of
`sandbox-shell`.

Treat `command` the same as any other `run:` step in a workflow:

```yaml
- uses: cobusgreyling/loop-engineering/tools/loop-action@main
  with:
    pattern: 'ci-sweeper'
    level: 'L2'
    sandbox: 'true'
    command: |
      npx grok-cli run --skill .grok/skills/ci-sweeper/SKILL.md
      echo "done"
```

Multi-line `command: |` blocks are supported and run as a single atomic
script — every line executes inside the chosen path (sandbox or direct), not
just the first.

> **Warning — never embed untrusted input directly in `command`.**
> Do not interpolate values from issue titles/bodies, PR titles/bodies, commit
> messages, branch names, or any other content an external, untrusted actor
> can influence (e.g. `command: 'echo ${{ github.event.issue.title }}'`).
> `command` runs as an arbitrary shell script with the permissions of the
> job, so untrusted text placed in it is a shell/command injection
> vulnerability regardless of how the action passes the string internally.
> If you need data from the triggering event, pass it through an
> intermediate step that validates/escapes it (or write it to a file and
> have your agent read the file) instead of splicing it into `command`.
