# Domain Docs

## Layout

Single-context. One glossary and one ADR directory for the whole repo.

- Glossary: `GLOSSARY.md` (repo root)
- ADRs: `docs/adr/`

## Consumer rules

- When an agent needs domain terminology, read `GLOSSARY.md` first.
- When evaluating or recording an architecture decision, check `docs/adr/` for existing ADRs before creating a new one.
- Do not duplicate glossary entries across subdirectories; link back to the root file.
