/**
 * The verifier canary — the drill that gave this package its reason to exist.
 *
 * loop-audit awards its joint-largest signal (14 points) for a verifier, and
 * gates L3 on it, by checking whether a file whose name contains "verifier"
 * exists. An empty file passes. docs/failure-modes.md calls the resulting
 * failure "Verifier Theater" and rates it S2; docs/primitives.md calls
 * maker/checker "the single most important structural pattern for reliable
 * loops". Nothing tested whether the verifier verifies.
 *
 * This runs the real verifier command against real seeded defects in an
 * isolated worktree, and scores it on what it caught:
 *
 *   control  — clean tree      -> the verifier must ACCEPT (exit 0)
 *   mutants  — one seeded bug  -> the verifier must REJECT (non-zero exit)
 *
 * Both directions are required. A verifier that rejects everything catches
 * every mutant while being worthless, and the control run is what exposes it.
 */

import { exec as execShellCb, execFile as execFileCb } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { isMutationCandidate, mutate, type Mutant } from './mutations.js';
import { skip, type DrillResult } from './drill.js';

/**
 * Two spawn helpers, kept honest about their signatures.
 *
 * `execShell` runs a caller-supplied command string (--verifier-cmd, --setup)
 * through a shell, which is what those flags mean. `execFile` runs git with an
 * argv array and no shell, so repo paths never reach a shell for re-parsing.
 *
 * Earlier this file called promisify(execFile) with an options object in the
 * `args` position behind an `as never` cast -- it happened to work because Node
 * detects a non-array second argument, but it hid the real signature from tsc
 * and made timeout/killed handling harder to reason about.
 */
const execShell = promisify(execShellCb);
const exec = promisify(execFileCb);

export interface CanaryOptions {
  /** Repo root to drill. */
  root: string;
  /** The verifier command. Non-zero exit is read as "rejected". */
  command: string;
  /** How many mutants to seed. More is slower but a sharper score. */
  count: number;
  /** Per-run timeout in ms. A verifier that hangs is a failed verifier. */
  timeoutMs: number;
  /** Restrict mutation to files under this repo-relative path. */
  scope?: string;
  /** Command run inside each worktree before verifying (e.g. "npm ci"). */
  setup?: string;
}

export interface VerifierRun {
  accepted: boolean;
  exitCode: number | null;
  timedOut: boolean;
  output: string;
}

/**
 * Run the verifier in `cwd`. Exit 0 means "accepted this change"; anything
 * else — including a timeout — means "rejected". A verifier that cannot be
 * launched at all is a distinct failure, surfaced by the caller.
 */
export async function runVerifier(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<VerifierRun> {
  try {
    const { stdout, stderr } = await execShell(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { accepted: true, exitCode: 0, timedOut: false, output: `${stdout}${stderr}`.trim() };
  } catch (err) {
    const e = err as { code?: number | string; killed?: boolean; stdout?: string; stderr?: string };
    const timedOut = e.killed === true || e.code === 'ETIMEDOUT';
    return {
      accepted: false,
      exitCode: typeof e.code === 'number' ? e.code : null,
      timedOut,
      output: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim(),
    };
  }
}

/** Files git tracks, filtered to plausible mutation targets. */
export async function candidateFiles(root: string, scope?: string): Promise<string[]> {
  const args = ['-C', root, 'ls-files'];
  if (scope) args.push('--', scope);
  const { stdout } = await exec('git', args, { maxBuffer: 32 * 1024 * 1024 });
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && isMutationCandidate(l));
}

/**
 * Build up to `count` mutants from distinct files. Distinct files matter:
 * seeding three mutants into one module mostly measures whether the verifier
 * reads that module.
 */
export async function collectMutants(
  root: string,
  files: string[],
  count: number,
): Promise<Mutant[]> {
  const mutants: Mutant[] = [];
  for (const file of files) {
    if (mutants.length >= count) break;
    let content: string;
    try {
      content = await readFile(path.join(root, file), 'utf8');
    } catch {
      continue;
    }
    const mutant = mutate(content, file);
    if (mutant) mutants.push(mutant);
  }
  return mutants;
}

/**
 * Run the verifier inside an ephemeral git worktree, so a verifier that writes,
 * builds, or fixes cannot touch the real checkout. `mutant` is null for the
 * worktree control run. The worktree is always removed, including on throw.
 */
/**
 * Run `fn` inside an ephemeral git worktree of `root`, so whatever it runs
 * cannot touch the real checkout. The worktree is always removed, including
 * when `fn` throws. Shared by the verifier canary and the injection canary.
 */
export async function withWorktree<T>(root: string, fn: (worktree: string) => Promise<T>): Promise<T> {
  const worktree = path.join(root, `.loop-drill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await exec('git', ['-C', root, 'worktree', 'add', '--detach', '--quiet', worktree], {
    maxBuffer: 8 * 1024 * 1024,
  });
  try {
    return await fn(worktree);
  } finally {
    // --force because the command may have left build output behind.
    await exec('git', ['-C', root, 'worktree', 'remove', '--force', worktree]).catch(() => {});
    await rm(worktree, { recursive: true, force: true }).catch(() => {});
  }
}

/** Run `setup` (if any) in `worktree`. Returns a failed run, or null on success. */
export async function prepareWorktree(
  worktree: string,
  timeoutMs: number,
  setup?: string,
): Promise<VerifierRun | null> {
  if (!setup) return null;
  // Setup failure is not a verdict on the thing under test — surface it as such.
  const setupRun = await runVerifier(setup, worktree, timeoutMs);
  return setupRun.accepted ? null : { ...setupRun, output: `[setup failed] ${setupRun.output}` };
}

async function runInWorktree(
  root: string,
  mutant: Mutant | null,
  command: string,
  timeoutMs: number,
  setup?: string,
): Promise<VerifierRun> {
  return withWorktree(root, async (worktree) => {
    const setupFailure = await prepareWorktree(worktree, timeoutMs, setup);
    if (setupFailure) return setupFailure;
    if (mutant) await writeFile(path.join(worktree, mutant.file), mutant.mutated, 'utf8');
    return runVerifier(command, worktree, timeoutMs);
  });
}

export interface CanaryReport {
  results: DrillResult[];
  /** Mutants rejected / mutants run. Null when no mutant could be built. */
  mutationScore: number | null;
  caught: number;
  escaped: number;
}

export async function runCanary(options: CanaryOptions): Promise<CanaryReport> {
  const { root, command, count, timeoutMs, scope, setup } = options;
  const results: DrillResult[] = [];
  const mode = 'Verifier Theater' as const;

  // Control first, and bail if it fails: every mutant result is meaningless
  // when the verifier rejects a clean tree, and running them would report a
  // reject-everything verifier as a perfect score.
  const control = await runVerifier(command, root, timeoutMs);
  if (control.accepted) {
    results.push({
      id: 'verifier.control',
      name: 'verifier accepts an unmodified tree',
      failureMode: mode,
      direction: 'specificity',
      outcome: 'passed',
      expected: 'exit 0 on clean tree',
      actual: 'exit 0',
    });
  } else {
    results.push({
      id: 'verifier.control',
      name: 'verifier accepts an unmodified tree',
      failureMode: mode,
      direction: 'specificity',
      outcome: 'failed',
      expected: 'exit 0 on clean tree',
      actual: control.timedOut ? `timed out after ${timeoutMs}ms` : `exit ${control.exitCode}`,
      detail:
        'The verifier rejects code with no seeded defect, so it cannot distinguish good from bad. Mutant drills were skipped — their results would be meaningless. Fix the verifier command (or the tree it runs against) first.',
    });
    return { results, mutationScore: null, caught: 0, escaped: 0 };
  }

  // Second control, in a clean worktree. A fresh checkout has no node_modules
  // and no build output, so a verifier like "npm test" fails there for reasons
  // that have nothing to do with code quality. Without this run, every mutant
  // would be scored as "caught" and a completely broken setup would report a
  // perfect mutation score — the precise false confidence this tool exists to
  // prevent.
  const worktreeControl = await runInWorktree(root, null, command, timeoutMs, setup);
  if (!worktreeControl.accepted) {
    results.push({
      id: 'verifier.worktree-control',
      name: 'verifier accepts a clean worktree',
      failureMode: mode,
      direction: 'specificity',
      outcome: 'skipped',
      expected: 'exit 0 in a clean worktree',
      actual: worktreeControl.timedOut ? `timed out after ${timeoutMs}ms` : `exit ${worktreeControl.exitCode}`,
      detail:
        'The verifier passes in your checkout but fails in a fresh worktree, so mutant results would measure the environment rather than the verifier. Pass --setup to prepare the worktree first (e.g. --setup "npm ci"). ' +
        (worktreeControl.output ? `Output: ${truncate(worktreeControl.output)}` : ''),
    });
    return { results, mutationScore: null, caught: 0, escaped: 0 };
  }

  results.push({
    id: 'verifier.worktree-control',
    name: 'verifier accepts a clean worktree',
    failureMode: mode,
    direction: 'specificity',
    outcome: 'passed',
    expected: 'exit 0 in a clean worktree',
    actual: 'exit 0',
  });

  const files = await candidateFiles(root, scope);
  const mutants = await collectMutants(root, files, count);

  if (mutants.length === 0) {
    results.push(
      skip(
        'verifier.mutants',
        'verifier rejects seeded defects',
        mode,
        'sensitivity',
        `No mutable source found${scope ? ` under ${scope}` : ''}. loop-drill mutates tracked, non-test, non-generated source in common languages — pass --scope to point it at yours.`,
      ),
    );
    return { results, mutationScore: null, caught: 0, escaped: 0 };
  }

  let caught = 0;
  for (const mutant of mutants) {
    const run = await runInWorktree(root, mutant, command, timeoutMs, setup);
    const where = `${mutant.file}:${mutant.line}`;
    const edit = `${mutant.operator.description} (${mutant.before} -> ${mutant.after})`;

    if (!run.accepted) {
      caught++;
      results.push({
        id: `verifier.mutant[${mutant.operator.id}]`,
        name: `verifier rejects ${mutant.operator.id} in ${where}`,
        failureMode: mode,
        direction: 'sensitivity',
        outcome: 'passed',
        expected: 'non-zero exit (rejected)',
        actual: run.timedOut ? 'timed out (treated as rejected)' : `exit ${run.exitCode}`,
        detail: edit,
      });
    } else {
      results.push({
        id: `verifier.mutant[${mutant.operator.id}]`,
        name: `verifier rejects ${mutant.operator.id} in ${where}`,
        failureMode: mode,
        direction: 'sensitivity',
        outcome: 'failed',
        expected: 'non-zero exit (rejected)',
        actual: 'exit 0 (approved a seeded defect)',
        detail: `${edit}. The verifier approved this change. That is Verifier Theater — see docs/failure-modes.md.`,
      });
    }
  }

  return {
    results,
    mutationScore: caught / mutants.length,
    caught,
    escaped: mutants.length - caught,
  };
}

function truncate(text: string, max = 400): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
