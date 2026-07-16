import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, access, realpath } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);

export const MANIFEST_DIR = '.loop-worktrees';
export const MANIFEST_FILE = path.posix.join(MANIFEST_DIR, 'manifest.json');

export type WorktreeStatus = 'active' | 'rejected' | 'escalated' | 'merged' | 'stale';

export const VALID_STATUSES: WorktreeStatus[] = [
  'active',
  'rejected',
  'escalated',
  'merged',
  'stale',
];

/** Terminal states cleanup discards by default; "active" is never swept automatically. */
export const CLEANUP_DEFAULT_STATUSES: WorktreeStatus[] = ['rejected', 'escalated'];

export interface WorktreeEntry {
  id: string;
  /** Repo-relative, posix-style path to the worktree. */
  path: string;
  branch: string;
  baseBranch: string;
  pattern: string;
  createdAt: string;
  status: WorktreeStatus;
}

export interface Manifest {
  version: 1;
  worktrees: WorktreeEntry[];
}

function emptyManifest(): Manifest {
  return { version: 1, worktrees: [] };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Run git in `cwd`, returning trimmed stdout. Throws a clean Error on failure. */
async function git(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const detail = (e.stderr || e.message || '').trim();
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const out = await git(['rev-parse', '--is-inside-work-tree'], cwd);
    return out === 'true';
  } catch {
    return false;
  }
}

async function assertGitRepo(root: string): Promise<void> {
  if (!(await isGitRepo(root))) {
    throw new Error(
      `Not a git repository: ${root}. loop-worktree manages git worktrees and must run inside a repo.`,
    );
  }
}

export async function readManifest(root: string): Promise<Manifest> {
  const file = path.join(root, MANIFEST_FILE);
  if (!(await exists(file))) return emptyManifest();
  const raw = await readFile(file, 'utf8');
  const parsed = JSON.parse(raw) as Manifest;
  if (parsed.version !== 1 || !Array.isArray(parsed.worktrees)) {
    throw new Error(`Invalid manifest at ${MANIFEST_FILE}: expected { version: 1, worktrees: [] }.`);
  }
  return parsed;
}

export async function writeManifest(root: string, manifest: Manifest): Promise<void> {
  const dir = path.join(root, MANIFEST_DIR);
  await mkdir(dir, { recursive: true });
  const file = path.join(root, MANIFEST_FILE);
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

export interface CreateInput {
  root: string;
  runId: string;
  pattern: string;
  base?: string;
}

export async function createWorktree(input: CreateInput): Promise<WorktreeEntry> {
  const { root, runId, pattern } = input;
  const base = input.base ?? 'main';
  await assertGitRepo(root);

  const manifest = await readManifest(root);
  const existing = manifest.worktrees.find((w) => w.id === runId);
  if (existing && existing.status === 'active') {
    throw new Error(`Run id "${runId}" already has an active worktree at ${existing.path}.`);
  }

  const relPath = path.posix.join(MANIFEST_DIR, runId);
  const branch = `loop/${runId}`;
  // `git worktree add -b <branch> <path> <base>` creates the branch and checks it
  // out in an isolated worktree. Forward-slash paths are accepted on all platforms.
  await git(['worktree', 'add', '-b', branch, relPath, base], root);

  const entry: WorktreeEntry = {
    id: runId,
    path: relPath,
    branch,
    baseBranch: base,
    pattern,
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  manifest.worktrees = manifest.worktrees.filter((w) => w.id !== runId);
  manifest.worktrees.push(entry);
  await writeManifest(root, manifest);
  return entry;
}

export interface MarkInput {
  root: string;
  runId: string;
  status: WorktreeStatus;
}

export async function markWorktree(input: MarkInput): Promise<WorktreeEntry> {
  const { root, runId, status } = input;
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Use one of: ${VALID_STATUSES.join(', ')}.`);
  }
  const manifest = await readManifest(root);
  const entry = manifest.worktrees.find((w) => w.id === runId);
  if (!entry) {
    throw new Error(`No worktree with run id "${runId}" in ${MANIFEST_FILE}.`);
  }
  entry.status = status;
  await writeManifest(root, manifest);
  return entry;
}

/** Parse a duration like "30m", "24h", "7d" into milliseconds. Shared with lock.ts's --ttl. */
export function parseDurationMs(token: string, flag: string): number {
  const m = /^(\d+)([smhd])$/.exec(token.trim());
  if (!m) {
    throw new Error(`Invalid ${flag} "${token}". Use e.g. 30s, 30m, 24h, 7d.`);
  }
  const n = Number(m[1]);
  const unit = m[2];
  const ms = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * ms;
}

export interface CleanupInput {
  root: string;
  statuses?: WorktreeStatus[];
  olderThan?: string;
  force?: boolean;
}

export interface CleanupResult {
  removed: WorktreeEntry[];
  /** Entries git refused to remove (e.g. uncommitted changes) without --force. */
  skipped: { entry: WorktreeEntry; reason: string }[];
}

export async function cleanupWorktrees(input: CleanupInput): Promise<CleanupResult> {
  const { root } = input;
  await assertGitRepo(root);
  const statuses = input.statuses ?? CLEANUP_DEFAULT_STATUSES;
  const cutoff = input.olderThan ? Date.now() - parseDurationMs(input.olderThan, '--older-than') : undefined;

  const manifest = await readManifest(root);
  const removed: WorktreeEntry[] = [];
  const skipped: { entry: WorktreeEntry; reason: string }[] = [];

  for (const entry of manifest.worktrees) {
    if (!statuses.includes(entry.status)) continue;
    if (cutoff !== undefined && Date.parse(entry.createdAt) > cutoff) continue;

    const args = ['worktree', 'remove', entry.path];
    if (input.force) args.push('--force');
    try {
      // Without --force, git refuses to remove a worktree with uncommitted or
      // untracked changes. We surface that refusal instead of forcing data loss.
      await git(args, root);
      removed.push(entry);
    } catch (err) {
      skipped.push({ entry, reason: (err as Error).message });
    }
  }

  const removedIds = new Set(removed.map((e) => e.id));
  manifest.worktrees = manifest.worktrees.filter((w) => !removedIds.has(w.id));
  await writeManifest(root, manifest);
  return { removed, skipped };
}

/** Paths (repo-relative, posix) of every worktree git currently knows about. */
async function gitWorktreePaths(root: string): Promise<string[]> {
  const rootReal = await realpath(root);
  const out = await git(['worktree', 'list', '--porcelain'], root);
  const paths: string[] = [];
  for (const line of out.split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const abs = line.slice('worktree '.length).trim();
    const absReal = await realpath(abs);
    const rel = path.relative(rootReal, absReal).split(path.sep).join('/');
    paths.push(rel);
  }
  return paths;
}

export interface GcInput {
  root: string;
  force?: boolean;
}

export interface GcResult {
  /** On disk under .loop-worktrees but absent from the manifest. */
  orphans: string[];
  /** In the manifest but no longer on disk; dropped from the manifest. */
  dropped: WorktreeEntry[];
  /** Orphans actually removed (only when force is set). */
  removedOrphans: string[];
}

export async function gc(input: GcInput): Promise<GcResult> {
  const { root } = input;
  await assertGitRepo(root);
  const manifest = await readManifest(root);
  const onDisk = await gitWorktreePaths(root);
  const managedOnDisk = onDisk.filter((p) => p.startsWith(`${MANIFEST_DIR}/`));
  const manifestPaths = new Set(manifest.worktrees.map((w) => w.path));

  const orphans = managedOnDisk.filter((p) => !manifestPaths.has(p));
  const dropped = manifest.worktrees.filter((w) => !onDisk.includes(w.path));

  const removedOrphans: string[] = [];
  if (input.force) {
    for (const orphan of orphans) {
      try {
        await git(['worktree', 'remove', '--force', orphan], root);
        removedOrphans.push(orphan);
      } catch {
        // Leave it reported as an orphan if git still refuses.
      }
    }
  }

  if (dropped.length > 0) {
    const droppedIds = new Set(dropped.map((e) => e.id));
    manifest.worktrees = manifest.worktrees.filter((w) => !droppedIds.has(w.id));
    await writeManifest(root, manifest);
  }

  return { orphans, dropped, removedOrphans };
}

export interface ListInput {
  root: string;
  status?: WorktreeStatus;
}

export async function listWorktrees(input: ListInput): Promise<WorktreeEntry[]> {
  const manifest = await readManifest(input.root);
  if (!input.status) return manifest.worktrees;
  return manifest.worktrees.filter((w) => w.status === input.status);
}
