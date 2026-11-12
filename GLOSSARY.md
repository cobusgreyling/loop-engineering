# Glossary

Domain terms for loop-engineering. Implementation-free definitions only.

## Harness

A specific agent product's file layout conventions and capability declaration, described by a manifest file at `harnesses/<id>.yaml`. A harness defines *where* artifacts go and *what* the agent can do; it does not define *what* gets written (that is the pattern's responsibility).

## Tool

The value passed to the `--tool` CLI flag. Resolved to a harness manifest key via built-in aliases. Backward-compatible: legacy values (`claude`, `grok`, `codex`, `opencode`) continue to work through alias resolution.

## Foundry

The harness-foundry runtime stack, an optional component orthogonal to harness selection. Triggered by `--with-foundry`. Provides a higher-level execution layer but does not replace or subsume the harness abstraction.

## Pattern

A reusable loop engineering workflow template (e.g., `daily-triage`, `pr-babysitter`). Patterns declare required capabilities and provide tool-agnostic content; they are instantiated into a project by combining with a harness manifest.

## Capability

A discrete ability that a harness may or may not support (e.g., `shell`, `file_write`, `skill_read`, `worktree`, `sub_agent`, `scheduling`, `mcp`). Patterns declare required capabilities; scaffold fails fast when a harness lacks a required capability.
