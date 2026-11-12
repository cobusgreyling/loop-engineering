# 06: Dynamic test matrix generation

**What to build:** `npm test` in tools/loop-init generates test cases dynamically from harnesses/*.yaml × starters/*/manifest.yaml. Capability-satisfied pairs produce positive assertions (files exist). Unsatisfied pairs produce negative assertions (fail-fast error). Adding a new harness requires zero test code changes. Test names prefixed with [scaffold] for CI aggregation.

**Blocked by:** 05 (Scaffold pipeline integration)

**Status:** done

- [ ] Test runner discovers all harness manifests and pattern manifests at runtime
- [ ] Positive test generated for each satisfied capability pair
- [ ] Negative test generated for each unsatisfied capability pair
- [ ] Test names follow [scaffold] <pattern> × <harness> convention
- [ ] Adding a new harness YAML file automatically produces new test cases without editing test code
- [ ] All existing tests continue to pass
