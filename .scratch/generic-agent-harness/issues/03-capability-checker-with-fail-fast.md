# 03: Capability checker with fail-fast

**What to build:** Given a Harness and a PatternManifest, the checker verifies that required_capabilities is a subset of harness.capabilities. When unsatisfied, it returns a structured error naming each missing capability and the pattern that requires it. No side effects; pure function.

**Blocked by:** 01 (Harness manifest schema and loader), 02 (Pattern manifest schema and loader)

**Status:** done

- [ ] Checker function accepts Harness + PatternManifest, returns success or structured error
- [ ] Error message names each missing capability and the requiring pattern
- [ ] No files written or read; pure validation logic
- [ ] Unit tests cover: all capabilities satisfied, one missing, multiple missing, empty required list
