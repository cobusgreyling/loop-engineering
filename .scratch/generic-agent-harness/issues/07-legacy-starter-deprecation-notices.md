# 07: Legacy starter deprecation notices

**What to build:** When the old starters/*-<tool> directories are used (via legacy tool-enum path), a deprecation warning is printed to stderr. Output remains identical; only a notice is added. This prepares users for the eventual removal in ticket 08.

**Blocked by:** 05 (Scaffold pipeline integration)

**Status:** done

- [ ] Deprecation warning printed to stderr when legacy starter directory is used
- [ ] Warning message names the deprecated path and points to the new manifest-based approach
- [ ] Scaffold output unchanged; only stderr affected
- [ ] Test verifies warning appears and output remains correct
