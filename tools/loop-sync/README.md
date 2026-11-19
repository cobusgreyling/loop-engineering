# loop-sync

Detect and sync drift between Loop configuration files in your repository.

## Why loop-sync?

When working in teams, Loop configurations can drift over time:

- STATE.md and LOOP.md get out of sync
- Skills are updated but not reflected in configuration
- Required files are missing
- Configuration drifts from starters

`loop-sync` detects these issues and provides actionable suggestions.

## Installation

```bash
npm install -g @cobusgreyling/loop-sync
# or
npx @cobusgreyling/loop-sync .
```

## Usage

```bash
loop-sync [target-dir] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-a, --auto-fix` | Scaffold missing STATE.md, gate.yaml, loop-budget.md, and loop-run-log.md with minimal defaults, and add a missing STATE.md reference to LOOP.md. LOOP.md and AGENTS.md are never fabricated — run `loop-init` for those. |
| `-d, --dry-run` | With `--auto-fix`, report what would be scaffolded/changed without writing anything |
| `-v, --verbose` | Show detailed information |
| `--json` | Output JSON format |
| `-h, --help` | Show help |

### Examples

```bash
# Basic sync check
loop-sync .

# Verbose output
loop-sync ./my-project -v

# JSON output for scripting
loop-sync ./my-project --json

# Preview what --auto-fix would scaffold/change, without writing anything
loop-sync ./my-project --auto-fix --dry-run

# Scaffold the safely-fixable files and fix the LOOP.md/STATE.md reference
loop-sync ./my-project --auto-fix
```

## What it checks

1. **Required files**
   - STATE.md (required)
   - LOOP.md (required)
   - AGENTS.md (recommended)

2. **STATE.md ↔ LOOP.md consistency**
   - Structural similarity
   - State file references
   - Pattern consistency

3. **`gate.yaml` ↔ `docs/safety.md` policy parity**
   - Denylist paths documented in `docs/safety.md` but **not enforced** by `gate.yaml` (error —
     readers trust the doc while `loop-gate` silently allows the path)
   - Denylist paths enforced by `gate.yaml` but **undocumented** in `docs/safety.md` (warning)
   - `gate.yaml` limits such as `maxFiles` that the prose policy never states (info)

   `gate.yaml` calls itself "the machine-readable twin of `docs/safety.md`" and asks you to keep
   the two in sync by hand. This check makes that invariant mechanical. It is **read-only even
   under `--auto-fix`**: which side is correct is a human decision, so loop-sync reports the
   divergence rather than silently rewriting a safety policy.

   Skipped when either file is absent — a project with no `docs/safety.md` has no prose policy
   to drift from.

4. **Skills directory**
   - Existence of `.claude/skills/`
   - Version information in SKILL.md files

5. **Configuration drift**
   - Missing references
   - Orphaned files
   - Inconsistencies

## Score Interpretation

| Score | Level | Meaning |
|-------|-------|---------|
| 90-100 | Healthy | No issues detected |
| 70-89 | Warning | Minor inconsistencies |
| 0-69 | Critical | Major issues need attention |

## Output Example

```
Loop Sync Report
══════════════════════════════════════════════════
Score: 95/100 (healthy)

✅ No issues detected. Configuration is consistent.

💡 Suggestions:
   - Run loop-init to scaffold missing files
```

## Integration with CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Run loop-sync
  run: npx @cobusgreyling/loop-sync .
```

## Development

```bash
cd tools/loop-sync
npm install
npm run build
npm test
```

## License

MIT