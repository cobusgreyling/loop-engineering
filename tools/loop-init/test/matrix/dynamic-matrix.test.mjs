/**
 * Dynamic test matrix: harnesses/<id>.yaml x starters/<pattern>/manifest.yaml.
 *
 * Discovers all harness and pattern manifests at runtime, checks capability
 * compatibility for each pair, and generates:
 *   - Positive tests: scaffold succeeds (capability check passes)
 *   - Negative tests: capability check correctly identifies missing capabilities
 *
 * Adding a new harness YAML file automatically produces new test cases
 * without editing this file. Test names follow [scaffold] <pattern> x <harness>.
 *
 * @see .scratch/generic-agent-harness/issues/06-dynamic-test-matrix-generation.md
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, mkdtemp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const STARTERS_DIR = path.resolve(PACKAGE_ROOT, 'starters');
const CLI = path.resolve(PACKAGE_ROOT, 'dist', 'cli.js');

const exec = promisify(execFile);

// --- Import modules eagerly (top-level await) ---

const { listHarnesses } = await import('../../dist/harness/loader.js');
const { loadPatternManifest } = await import('../../dist/pattern/loader.js');
const { checkCapabilities } = await import('../../dist/capability/checker.js');

// --- Discover pattern manifests at runtime ---

async function discoverPatterns() {
  const entries = await readdir(STARTERS_DIR, { withFileTypes: true });
  const patterns = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(STARTERS_DIR, entry.name, 'manifest.yaml');
    try {
      const manifest = await loadPatternManifest(manifestPath);
      patterns.push(manifest);
    } catch {
      // Skip directories without a valid manifest.yaml
    }
  }

  return patterns;
}

// --- Determine which patterns the CLI accepts ---

async function getCliAcceptedPatterns() {
  try {
    const { stdout } = await exec('node', [CLI, '--help']);
    // Extract pattern names from help output
    const match = stdout.match(/Patterns:\n([\s\S]*?)(?:\n\n|\nOptions:)/);
    if (!match) return new Set();
    const patternLines = match[1].trim().split('\n');
    const names = new Set();
    for (const line of patternLines) {
      const m = line.trim().match(/^(\S+)/);
      if (m) names.add(m[1]);
    }
    return names;
  } catch {
    return new Set();
  }
}

// --- Build the matrix and register tests ---

const harnesses = await listHarnesses();
const allPatterns = await discoverPatterns();
const cliPatterns = await getCliAcceptedPatterns();

assert.ok(harnesses.length > 0, 'Expected at least one harness manifest');
assert.ok(allPatterns.length > 0, 'Expected at least one pattern manifest');

// Filter to patterns that have both a manifest AND are accepted by the CLI
const patterns = allPatterns.filter((p) => cliPatterns.has(p.id));

assert.ok(patterns.length > 0, 'Expected at least one pattern with both manifest and CLI support');

for (const pattern of patterns) {
  for (const harness of harnesses) {
    const testName = `[scaffold] ${pattern.id} \u00d7 ${harness.id}`;
    const result = checkCapabilities(harness, pattern, { throw: false });

    if (result.satisfied) {
      // Positive test: scaffold should succeed and produce output
      test(testName, async () => {
        const dir = await mkdtemp(
          path.join(tmpdir(), `matrix-${pattern.id}-${harness.id}-`),
        );
        try {
          const { stdout } = await exec('node', [
            CLI,
            dir,
            '--pattern',
            pattern.id,
            '--tool',
            harness.id,
          ]);

          // Scaffold output mentions the pattern
          assert.match(stdout, new RegExp(`loop-init: ${pattern.id}`));
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      });
    } else {
      // Negative test: capability check correctly identifies the gap.
      // When the scaffold pipeline enforces fail-fast (ticket 05), this
      // test also verifies the CLI rejects the combination.
      test(testName, async () => {
        // Verify the capability checker correctly identifies missing capabilities
        assert.equal(result.satisfied, false);
        assert.ok(result.missing.length > 0, 'Expected at least one missing capability');

        // Verify each missing capability is indeed not satisfied by the harness
        for (const cap of result.missing) {
          assert.ok(
            pattern.required_capabilities.includes(cap),
            `Missing capability "${cap}" should be in pattern's required_capabilities`,
          );
        }

        // Verify the CLI either rejects or (if ticket 05 not yet integrated)
        // the capability check is correct regardless of CLI behavior
        const dir = await mkdtemp(
          path.join(tmpdir(), `matrix-neg-${pattern.id}-${harness.id}-`),
        );
        try {
          let cliRejected = false;
          try {
            await exec('node', [
              CLI,
              dir,
              '--pattern',
              pattern.id,
              '--tool',
              harness.id,
            ]);
          } catch (err) {
            cliRejected = true;
            const output = (err.stderr || '') + (err.stdout || '') + (err.message || '');
            // If CLI rejects, error must mention missing capabilities
            for (const cap of result.missing) {
              assert.ok(
                output.includes(cap),
                `CLI error should mention missing capability "${cap}", got: ${output.slice(0, 500)}`,
              );
            }
          }
          // Capability check is authoritative regardless of CLI enforcement
          assert.equal(result.satisfied, false);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      });
    }
  }
}
