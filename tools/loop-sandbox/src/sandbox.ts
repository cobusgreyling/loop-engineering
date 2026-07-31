import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createWorktree, isGitRepo, gc } from '@cobusgreyling/loop-worktree';
// loop-worktree's package.json has no "exports" map restricting subpaths, so
// this resolves cleanly; a re-export from the package's main entry was tried
// first but creates a module-load cycle (lock.js reads MANIFEST_DIR from
// worktree.js, which would need lock.js's own export to finish first).
//
// This reaches into loop-worktree's compiled internals rather than a public
// subpath export, since none exists yet -- a supported `loop-worktree/lock`
// entry point would be a better long-term home for this, tracked as a
// follow-up rather than done here to keep this change scoped to sandbox.ts.
import { lockPaths, unlockOwner } from '@cobusgreyling/loop-worktree/dist/lock.js';

const runExec = promisify(execFile);

export interface SandboxOptions {
  shell?: boolean;
  base?: string;
  /**
   * Glob(s) to hold an advisory loop-worktree lock on for the run's duration,
   * so a scheduled loop can't touch the same paths concurrently. Unset by
   * default -- sandbox runs are unprotected unless the caller opts in.
   */
  lockPaths?: string[];
  /** Lock owner name; defaults to the run's generated id. */
  lockOwner?: string;
  /** e.g. "30m" -- passed straight through to loop-worktree's --ttl. */
  lockTtl?: string;
  /** e.g. "5m" -- passed straight through to loop-worktree's --wait. */
  lockWait?: string;
}

export interface SandboxResult {
  runId: string;
  patchFile: string | null;
  exitCode: number | null;
  hasChanges: boolean;
}

/** Run a git command in cwd, returning stdout trimmed. Throws on error. */
async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await runExec('git', args, { cwd, maxBuffer: 50 * 1024 * 1024 });
  return stdout.trim();
}

/** Run a git command in cwd, returning raw untrimmed Buffer (for binary patches). Throws on error. */
async function gitRaw(args: string[], cwd: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** 
 * Wraps an agent command in a temporary git worktree sandbox.
 * Returns the patch file path if changes were made.
 */
export async function runInSandbox(root: string, command: string, args: string[], options: SandboxOptions = {}): Promise<SandboxResult> {
  if (!(await isGitRepo(root))) {
    throw new Error('loop-sandbox must be run inside a git repository.');
  }

  const runId = `sandbox-${crypto.randomBytes(4).toString('hex')}`;

  // 1. Setup paths
  const sandboxDir = path.join(root, '.loop-sandbox');
  const patchesDir = path.join(sandboxDir, 'patches');
  await mkdir(patchesDir, { recursive: true });

  const baseBranch = options.base || await git(['rev-parse', '--abbrev-ref', 'HEAD'], root).catch(() => 'main');

  const lockOwner = options.lockOwner ?? runId;
  // Whether a lock was *requested*, not whether it was confirmed acquired --
  // lockPaths() can be interrupted mid-wait (e.g. by a signal during
  // --lock-wait), leaving only a `<owner>.wait.json` file with no matching
  // lock. unlockOwner() removes either or both and is a safe no-op if
  // neither exists, so gating cleanup on the original request (rather than
  // on successful acquisition) also sweeps up that stray wait file.
  const lockRequested = Boolean(options.lockPaths && options.lockPaths.length > 0);
  let worktreeAbsPath: string | null = null;
  let extractionFailed = false;
  let activeChild: ReturnType<typeof spawn> | null = null;

  // Cleanup must run on every exit path, including Ctrl+C mid-run, and
  // exactly once even if a signal lands twice: the previous shape re-invoked
  // cleanup() on every signal and let it no-op past a boolean guard while
  // still calling process.exit(1) right after -- a second Ctrl+C during a
  // slow `git worktree remove` would exit before the *first* cleanup's lock
  // release ever ran, stranding a no-TTL lock. Sharing one promise across
  // every caller means every signal (first or repeated) waits on the same
  // in-flight cleanup before exiting.
  let cleanupPromise: Promise<void> | null = null;
  const cleanup = (): Promise<void> => {
    if (!cleanupPromise) {
      cleanupPromise = (async () => {
        // Stop the sandboxed command first so it can't keep writing into the
        // worktree (or racing the lock's protected paths) after cleanup has
        // started tearing things down around it.
        activeChild?.kill();

        // Release the lock before worktree teardown: it's the resource other
        // loops are blocked on, and a slow worktree removal shouldn't delay
        // it. Logged only once we know a lock (or stray wait file) actually
        // existed -- lockRequested only means a lock was asked for, so
        // logging unconditionally here would print "Releasing lock held by
        // X" even when lockPaths() itself failed (e.g. blocked by another
        // owner with no --wait) and no lock was ever acquired.
        if (lockRequested) {
          try {
            const released = await unlockOwner(root, lockOwner);
            if (released) {
              console.log(`🔓 Released lock held by "${lockOwner}".`);
            }
          } catch (err) {
            console.error(`❌ Failed to release lock for "${lockOwner}". Run \`loop-worktree unlock --owner ${lockOwner}\` manually:`, err);
          }
        }

        if (worktreeAbsPath) {
          if (extractionFailed) {
            console.log(`⚠️ Patch extraction failed. The worktree at ${worktreeAbsPath} and branch loop/${runId} were left on disk for manual recovery.`);
          } else {
            console.log(`🧹 Cleaning up sandbox worktree...`);
            try {
              await git(['worktree', 'remove', '--force', worktreeAbsPath], root);
              await git(['branch', '-D', `loop/${runId}`], root).catch(() => {});
              await gc({ root, force: false });
            } catch (err) {
              console.error(`❌ Failed to cleanup sandbox worktree. It may need manual removal:`, err);
              process.exitCode = 1;
            }
          }
        }
      })();
    }
    return cleanupPromise;
  };

  const sigHandler = () => {
    cleanup().finally(() => process.exit(1));
  };

  process.on('SIGINT', sigHandler);
  process.on('SIGTERM', sigHandler);

  try {
    if (lockRequested) {
      console.log(`\n🔒 Locking ${options.lockPaths!.join(', ')} as "${lockOwner}"...`);
      await lockPaths({ root, owner: lockOwner, paths: options.lockPaths!, ttl: options.lockTtl, wait: options.lockWait });
    }

    console.log(`\n📦 Creating ephemeral worktree isolation: ${runId}`);

    // 2. Create the worktree
    const entry = await createWorktree({
      root,
      runId,
      pattern: 'sandbox', // dummy pattern
      base: baseBranch
    });

    worktreeAbsPath = path.resolve(root, entry.path);

    console.log(`🚀 Executing inside sandbox: ${command} ${args.join(' ')}`);

    let exitCode: number | null = null;
    let hasChanges = false;
    let patchFilePath: string | null = null;

    // 3. Execute the user's command
    try {
      exitCode = await new Promise<number | null>((resolve) => {
        // On Windows, a failed spawn (ENOENT) still emits a 'close' event a
        // few ms after 'error' with a synthetic exit code. Once the ENOENT
        // retry below fires, this flag makes the first (non-shell) attempt's
        // now-stale 'close'/'error' events no-ops instead of letting them win
        // the resolve() race against the retry's real, later result.
        let supersededByRetry = false;

        const attempt = (useShell: boolean) => {
          const child = spawn(command, args, {
            cwd: worktreeAbsPath!,
            stdio: 'inherit',
            shell: useShell
          });
          activeChild = child;

          child.on('close', (code) => {
            if (!useShell && supersededByRetry) return;
            activeChild = null;
            resolve(code);
          });
          child.on('error', (err: NodeJS.ErrnoException) => {
            if (!useShell && supersededByRetry) return;
            // On Windows, npm-installed CLIs (npx, tsc, ...) are .cmd/.bat
            // shims that spawn can't exec directly, and fail with ENOENT --
            // retry once through a shell. Forcing shell: true unconditionally
            // instead would break commands whose args rely on exact argv
            // quoting (e.g. `node -e "..."`), so only fall back on the
            // specific error this class of command actually produces.
            if (!useShell && !options.shell && process.platform === 'win32' && err.code === 'ENOENT') {
              supersededByRetry = true;
              attempt(true);
              return;
            }
            activeChild = null;
            resolve(1);
          });
        };
        attempt(options.shell ?? false);
      });
    } catch (err) {
      console.error(`❌ Execution failed inside sandbox:`, err);
      exitCode = 1;
    }

    console.log(`\n🔍 Scanning sandbox for changes...`);

    // 4. Extract diff as a patch
    try {
      await git(['add', '-A'], worktreeAbsPath);
      const diffStat = await git(['diff', '--cached', '--stat'], worktreeAbsPath);

      if (diffStat) {
        hasChanges = true;
        patchFilePath = path.join(patchesDir, `${runId}.patch`);
        const diffOutput = await gitRaw(['diff', '--cached', '--binary'], worktreeAbsPath);
        await writeFile(patchFilePath, diffOutput);
        console.log(`✅ Sandbox changes captured to patch: ${patchFilePath}`);
      } else {
        console.log(`ℹ️ No changes were made in the sandbox.`);
      }
    } catch (err) {
      console.error(`❌ Failed to extract patch from sandbox:`, err);
      extractionFailed = true;
    }

    return {
      runId,
      patchFile: patchFilePath,
      exitCode,
      hasChanges
    };
  } finally {
    process.removeListener('SIGINT', sigHandler);
    process.removeListener('SIGTERM', sigHandler);
    await cleanup();
  }
}

export interface ReviewItem {
  patchName: string;
  patchPath: string;
  size: number;
}

/** Lists all available patches in the .loop-sandbox/patches/ directory. */
export async function listPatches(root: string): Promise<ReviewItem[]> {
  const patchesDir = path.join(root, '.loop-sandbox', 'patches');
  try {
    const files = await readdir(patchesDir, { withFileTypes: true });
    const patches: ReviewItem[] = [];
    
    for (const f of files) {
      if (f.isFile() && f.name.endsWith('.patch')) {
        const patchPath = path.join(patchesDir, f.name);
        const s = await stat(patchPath);
        patches.push({
          patchName: f.name,
          patchPath,
          size: s.size
        });
      }
    }
    return patches;
  } catch {
    return [];
  }
}
