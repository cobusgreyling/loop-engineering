# 08: Contract old routing path (delete)

**What to build:** Delete the old tool-enum branching logic from cli.ts and remove legacy starters/*-<tool> directories. All traffic flows through manifest routing. CI is fully green. This is the contract phase of expand-contract.

**Blocked by:** 06 (Dynamic test matrix generation), 07 (Legacy starter deprecation notices)

**Status:** done

- [ ] Old tool-enum switch/case logic removed from cli.ts
- [ ] Legacy starters/*-claude, *-codex, *-opencode directories deleted
- [ ] All --tool values resolve exclusively through harness manifests and aliases
- [ ] npm test passes with no references to deleted paths
- [ ] No regression in scaffold output for any built-in harness × pattern combination
