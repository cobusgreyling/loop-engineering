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
| `-a, --auto-fix` | Attempt to auto-fix issues (experimental) |
| `-d, --dry-run` | Show what would be done without making changes |
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

3. **Skills directory**
   - Existence of `.claude/skills/`
   - Version information in SKILL.md files

4. **Configuration drift**
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
Score: 85/100 (healthy)

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