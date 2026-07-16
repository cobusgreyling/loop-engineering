import { readFile, writeFile, mkdir, readdir, unlink, access, open } from 'node:fs/promises';
import path from 'node:path';
import { MANIFEST_DIR, parseDurationMs } from './worktree.js';

export const LOCKS_DIR = path.posix.join(MANIFEST_DIR, 'locks');
const MUTEX_FILE = path.posix.join(LOCKS_DIR, '.mutex');

export interface LockEntry {
  owner: string;
  paths: string[];
  lockedAt: string;
  /** Absent means the lock never expires automatically; must be explicitly unlocked. */
  expiresAt?: string;
}

export interface WaitEntry {
  owner: string;
  paths: string[];
  waitingOn: string[];
  requestedAt: string;
  expiresAt?: string;
}

function waitFile(root: string, owner: string): string {
  return path.join(root, LOCKS_DIR, `${owner}.wait.json`);
}

async function readWait(root: string, owner: string): Promise<WaitEntry | null> {
  const file = waitFile(root, owner);
  if (!(await exists(file))) return null;
  const raw = await readFile(file, 'utf8');
  try {
    return JSON.parse(raw) as WaitEntry;
  } catch {
    throw new Error(
      `Corrupt wait file ${file}: not valid JSON. Inspect it and delete it manually if it's stale.`,
    );
  }
}

export async function listWaits(root: string): Promise<WaitEntry[]> {
  const files = await readdirSafely(path.join(root, LOCKS_DIR));
  const waits: WaitEntry[] = [];
  for (const file of files) {
    if (!file.endsWith('.wait.json')) continue;
    const wait = await readWait(root, file.slice(0, -'.wait.json'.length));
    if (wait) waits.push(wait);
  }
  return waits;
}

export function isWaitExpired(wait: WaitEntry, now: number = Date.now()): boolean {
  return wait.expiresAt !== undefined && Date.parse(wait.expiresAt) <= now;
}

function detectDeadlock(owner: string, waitingOn: string[], allWaits: WaitEntry[]): void {
  const graph = new Map<string, string[]>();
  graph.set(owner, waitingOn);
  for (const w of allWaits) {
    if (w.owner !== owner) {
      graph.set(w.owner, w.waitingOn);
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    if (stack.has(node)) {
      path.push(node);
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    stack.delete(node);
    path.pop();
    return false;
  }

  if (dfs(owner)) {
    const cycle = path.slice(path.indexOf(path[path.length - 1])).join(' -> ');
    throw new Error(`Deadlock detected: ${cycle}`);
  }
}

const OWNER_PATTERN = /^[A-Za-z0-9._-]+$/;

function assertValidOwner(owner: string): void {
  if (!OWNER_PATTERN.test(owner)) {
    throw new Error(
      `Invalid --owner "${owner}". Use only letters, digits, ".", "_", "-" (no path separators).`,
    );
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readdirSafely(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

function lockFile(root: string, owner: string): string {
  return path.join(root, LOCKS_DIR, `${owner}.json`);
}

async function readLock(root: string, owner: string): Promise<LockEntry | null> {
  const file = lockFile(root, owner);
  if (!(await exists(file))) return null;
  const raw = await readFile(file, 'utf8');
  try {
    return JSON.parse(raw) as LockEntry;
  } catch {
    throw new Error(
      `Corrupt lock file ${file}: not valid JSON. Inspect it and delete it manually if it's stale.`,
    );
  }
}

export function isExpired(lock: LockEntry, now: number = Date.now()): boolean {
  return lock.expiresAt !== undefined && Date.parse(lock.expiresAt) <= now;
}

function isWildcardSegment(segment: string): boolean {
  return /[*?]/.test(segment);
}

/**
 * Two path globs "overlap" if, segment by segment, every position where both
 * have a literal (non-wildcard) segment agrees -- a wildcard segment (`*` or
 * `**`) is treated as compatible with anything at that position. If one glob
 * has fewer segments, it only "covers" the longer, more specific path when
 * its last segment is itself a wildcard (e.g. "src/**" covers
 * "src/nested/foo.ts"); otherwise a shorter path is a distinct, shallower
 * file and does not overlap. Deliberately simple -- an advisory lock, not a
 * full glob engine.
 */
export function pathsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const segA = a.split('/').filter(Boolean);
  const segB = b.split('/').filter(Boolean);
  const len = Math.min(segA.length, segB.length);
  for (let i = 0; i < len; i++) {
    const sa = segA[i];
    const sb = segB[i];
    if (sa === sb) continue;
    if (isWildcardSegment(sa) || isWildcardSegment(sb)) continue;
    return false;
  }
  if (segA.length === segB.length) return true;
  const shorter = segA.length < segB.length ? segA : segB;
  return isWildcardSegment(shorter[shorter.length - 1]);
}

export async function listLocks(root: string): Promise<LockEntry[]> {
  const files = await readdirSafely(path.join(root, LOCKS_DIR));
  const locks: LockEntry[] = [];
  for (const file of files) {
    if (!file.endsWith('.json') || file.endsWith('.wait.json')) continue;
    const lock = await readLock(root, file.slice(0, -'.json'.length));
    if (lock) locks.push(lock);
  }
  return locks;
}

/**
 * Serialize the check-then-write critical section across processes using an
 * exclusive-create mutex file (atomic on POSIX and Windows). Without this,
 * two `lock` calls racing close together could both pass the overlap check
 * before either writes -- exactly the collision this feature exists to
 * prevent.
 */
async function withLocksMutex<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const dir = path.join(root, LOCKS_DIR);
  await mkdir(dir, { recursive: true });
  const mutexPath = path.join(root, MUTEX_FILE);
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      const handle = await open(mutexPath, 'wx');
      await handle.close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for the lock mutex (${MUTEX_FILE}). If no other loop-worktree ` +
            'process is running, delete it manually.',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
    }
  }
  try {
    return await fn();
  } finally {
    await unlink(mutexPath).catch(() => {});
  }
}

export interface LockPathsInput {
  root: string;
  owner: string;
  paths: string[];
  /** e.g. "6h" -- if omitted, the lock never expires automatically. */
  ttl?: string;
  /** e.g. "15m" -- wait duration if paths are locked. */
  wait?: string;
}

/**
 * Acquire an advisory lock on `paths` for `owner`. Fails if any *other*,
 * non-expired owner already holds an overlapping path. Re-locking as the
 * same owner replaces that owner's own previous lock (paths and TTL both).
 */
export async function lockPaths(input: LockPathsInput): Promise<LockEntry> {
  const { root, owner, paths, wait, ttl } = input;
  assertValidOwner(owner);
  if (paths.length === 0) {
    throw new Error('--paths requires at least one path or glob.');
  }

  const waitUntil = wait ? Date.now() + parseDurationMs(wait, '--wait') : undefined;

  for (;;) {
    const success = await withLocksMutex(root, async () => {
      const now = Date.now();
      const locks = await listLocks(root);
      const blockingOwners = new Set<string>();
      const blockingErrors: string[] = [];

      for (const other of locks) {
        if (other.owner === owner || isExpired(other, now)) continue;
        for (const p of paths) {
          const clash = other.paths.find((op) => pathsOverlap(p, op));
          if (clash) {
            blockingOwners.add(other.owner);
            blockingErrors.push(
              `Path "${p}" is locked by owner "${other.owner}" (locked at ${other.lockedAt}` +
                (other.expiresAt ? `, expires at ${other.expiresAt}` : '') +
                `).`,
            );
          }
        }
      }

      if (blockingOwners.size > 0) {
        if (!waitUntil) {
          throw new Error(
            `${blockingErrors.join('\n')}\nUse --paths that don't overlap, or wait for the lock to clear.`,
          );
        }
        if (Date.now() > waitUntil) {
          await unlink(waitFile(root, owner)).catch(() => {});
          throw new Error(`Timed out waiting for lock on paths: ${paths.join(', ')}`);
        }

        const allWaits = (await listWaits(root)).filter((w) => !isWaitExpired(w, now));
        detectDeadlock(owner, Array.from(blockingOwners), allWaits);

        const waitEntry: WaitEntry = {
          owner,
          paths,
          waitingOn: Array.from(blockingOwners),
          requestedAt: new Date(now).toISOString(),
          expiresAt: new Date(waitUntil).toISOString(),
        };
        await writeFile(waitFile(root, owner), `${JSON.stringify(waitEntry, null, 2)}\n`);

        return false;
      }

      await unlink(waitFile(root, owner)).catch(() => {});

      const entry: LockEntry = { owner, paths, lockedAt: new Date(now).toISOString() };
      if (ttl) {
        entry.expiresAt = new Date(now + parseDurationMs(ttl, '--ttl')).toISOString();
      }

      await writeFile(lockFile(root, owner), `${JSON.stringify(entry, null, 2)}\n`);
      return entry;
    });

    if (success) {
      return success;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));
  }
}

/** Release `owner`'s lock. Returns false (no-op) if it didn't hold one. */
export async function unlockOwner(root: string, owner: string): Promise<boolean> {
  assertValidOwner(owner);
  const lFile = lockFile(root, owner);
  const wFile = waitFile(root, owner);
  let released = false;
  if (await exists(lFile)) {
    await unlink(lFile);
    released = true;
  }
  if (await exists(wFile)) {
    await unlink(wFile);
  }
  return released;
}

export interface SweepExpiredLocksResult {
  expired: LockEntry[];
  removed: string[];
  expiredWaits?: WaitEntry[];
  removedWaits?: string[];
}

/** Report (and, with force, delete) locks past their own TTL. Never touches an active lock. */
export async function sweepExpiredLocks(
  root: string,
  opts: { force?: boolean } = {},
): Promise<SweepExpiredLocksResult> {
  return withLocksMutex(root, async () => {
    const now = Date.now();
    const expired = (await listLocks(root)).filter((l) => isExpired(l, now));
    const expiredWaits = (await listWaits(root)).filter((w) => isWaitExpired(w, now));
    const removed: string[] = [];
    const removedWaits: string[] = [];
    if (opts.force) {
      for (const l of expired) {
        try {
          await unlink(lockFile(root, l.owner));
          removed.push(l.owner);
        } catch {
          // Already gone; nothing to report.
        }
      }
      for (const w of expiredWaits) {
        try {
          await unlink(waitFile(root, w.owner));
          removedWaits.push(w.owner);
        } catch {
          // Already gone
        }
      }
    }
    return { expired, removed, expiredWaits, removedWaits };
  });
}
