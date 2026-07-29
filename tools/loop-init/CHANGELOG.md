# Changelog

All notable changes to `@cobusgreyling/loop-init` are documented here.

## [Unreleased]

## [1.6.0] - 2026-07-29

### Added
- `--model-provider minimax` for `--with-foundry` implementer stacks — emits a `model/minimax` provider primitive instead of the default interface primitive
  - Global (`global_en`) and China (`cn_zh`) endpoint configuration in every generated stack
  - `MiniMax-M3` (default) and `MiniMax-M2.7` model options with context window, input modalities, thinking modes, and pricing
- `--region` (`global_en`, `cn_zh`) and `--model` (`MiniMax-M3`, `MiniMax-M2.7`) flags to select the active MiniMax region and model
- Help text and examples for the new flags
- `--with-memory` memory-engineering bridge scaffold (tiers + budget signals)

## [1.5.0] - 2026-07-20

### Added
- `--with-foundry` — one-command LE → harness-foundry funnel
  - Scaffolds `.foundry/stack.yaml`, hooks, sessions dir, and README
  - Pattern mapping: report-only → `minimal`, fix-capable → `implementer`
- Post-scaffold Foundry CTA on every run (stronger when Loop Ready ≥ 80)
- Help text for Foundry presets and examples

## [1.4.0]

- Prior release (starters, circuit breaker, intake, observability scaffolds)
