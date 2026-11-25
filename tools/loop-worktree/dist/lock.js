import { readFile, writeFile, mkdir, readdir, unlink, access, open } from 'node:fs/promises';
import path from 'node:path';
import { MANIFEST_DIR, parseDurationMs } from './worktree.js';
export const LOCKS_DIR = path.posix.join(MANIFEST_DIR, 'locks');
const MUTEX_FILE = path.posix.join(LOCKS_DIR, '.mutex');
function waitFile(root, owner) {
    return path.join(root, LOCKS_DIR, `${owner}.wait.json`);
}
async function readWait(root, owner) {
    const file = waitFile(root, owner);
    if (!(await exists(file)))
        return null;
    const raw = await readFile(file, 'utf8');
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Corrupt wait file ${file}: not valid JSON. Inspect it and delete it manually if it's stale.`);
    }
}
export async function listWaits(root) {
    const files = await readdirSafely(path.join(root, LOCKS_DIR));
    const waits = [];
    for (const file of files) {
        if (!file.endsWith('.wait.json'))
            continue;
        const wait = await readWait(root, file.slice(0, -'.wait.json'.length));
        if (wait)
            waits.push(wait);
    }
    return waits;
}
export function isWaitExpired(wait, now = Date.now()) {
    return wait.expiresAt !== undefined && Date.parse(wait.expiresAt) <= now;
}
function detectDeadlock(owner, waitingOn, allWaits) {
    const graph = new Map();
    graph.set(owner, waitingOn);
    for (const w of allWaits) {
        if (w.owner !== owner) {
            graph.set(w.owner, w.waitingOn);
        }
    }
    const visited = new Set();
    const stack = new Set();
    const path = [];
    function dfs(node) {
        if (stack.has(node)) {
            path.push(node);
            return true;
        }
        if (visited.has(node))
            return false;
        visited.add(node);
        stack.add(node);
        path.push(node);
        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
            if (dfs(neighbor))
                return true;
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
function assertValidOwner(owner) {
    if (!OWNER_PATTERN.test(owner)) {
        throw new Error(`Invalid --owner "${owner}". Use only letters, digits, ".", "_", "-" (no path separators).`);
    }
}
async function exists(p) {
    try {
        await access(p);
        return true;
    }
    catch {
        return false;
    }
}
async function readdirSafely(dir) {
    try {
        return await readdir(dir);
    }
    catch {
        return [];
    }
}
function lockFile(root, owner) {
    return path.join(root, LOCKS_DIR, `${owner}.json`);
}
async function readLock(root, owner) {
    const file = lockFile(root, owner);
    if (!(await exists(file)))
        return null;
    const raw = await readFile(file, 'utf8');
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Corrupt lock file ${file}: not valid JSON. Inspect it and delete it manually if it's stale.`);
    }
}
export function isExpired(lock, now = Date.now()) {
    return lock.expiresAt !== undefined && Date.parse(lock.expiresAt) <= now;
}
function isWildcardSegment(segment) {
    return /[*?]/.test(segment);
}
/**
 * Two path globs "overlap" if some path could match both. Segment by segment, a
 * position where both sides have a literal (non-wildcard) segment has to agree,
 * and a wildcard segment (`*` or `**`) is compatible with anything at that
 * position. `**` matches zero or more segments, so a glob with `**` in the middle
 * also covers the same path with those segments absent. A pattern that runs out
 * while the other still has segments left only covers them when its own last
 * segment is a wildcard (`src/**` covers `src/nested/foo.ts`); otherwise a shorter
 * path is a distinct, shallower file and does not overlap. Deliberately simple --
 * an advisory lock, not a full glob engine.
 */
export function pathsOverlap(a, b) {
    if (a === b)
        return true;
    const segA = a.split('/').filter(Boolean);
    const segB = b.split('/').filter(Boolean);
    return segmentsOverlap(segA, 0, segB, 0);
}
const isDoubleStar = (segment) => segment === '**';
function segmentsOverlap(a, i, b, j) {
    if (i === a.length && j === b.length)
        return true;
    // One pattern is used up. It covers the rest only when it can match "nothing more",
    // which is what its own trailing wildcard means.
    if (i === a.length)
        return isWildcardSegment(a[a.length - 1]);
    if (j === b.length)
        return isWildcardSegment(b[b.length - 1]);
    const sa = a[i];
    const sb = b[j];
    // `**` matches zero or more segments, so it may swallow none of the other side: trying
    // only the consuming branch meant `src/**/foo.ts` and `src/foo.ts` read as unrelated,
    // and two owners could lock the same file at the same time.
    if (isDoubleStar(sa))
        return segmentsOverlap(a, i + 1, b, j) || segmentsOverlap(a, i, b, j + 1);
    if (isDoubleStar(sb))
        return segmentsOverlap(a, i, b, j + 1) || segmentsOverlap(a, i + 1, b, j);
    if (sa !== sb && !isWildcardSegment(sa) && !isWildcardSegment(sb))
        return false;
    return segmentsOverlap(a, i + 1, b, j + 1);
}
export async function listLocks(root) {
    const files = await readdirSafely(path.join(root, LOCKS_DIR));
    const locks = [];
    for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('.wait.json'))
            continue;
        const lock = await readLock(root, file.slice(0, -'.json'.length));
        if (lock)
            locks.push(lock);
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
async function withLocksMutex(root, fn) {
    const dir = path.join(root, LOCKS_DIR);
    await mkdir(dir, { recursive: true });
    const mutexPath = path.join(root, MUTEX_FILE);
    const deadline = Date.now() + 5000;
    for (;;) {
        try {
            const handle = await open(mutexPath, 'wx');
            await handle.close();
            break;
        }
        catch (err) {
            if (err.code !== 'EEXIST')
                throw err;
            if (Date.now() > deadline) {
                throw new Error(`Timed out waiting for the lock mutex (${MUTEX_FILE}). If no other loop-worktree ` +
                    'process is running, delete it manually.');
            }
            await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
        }
    }
    try {
        return await fn();
    }
    finally {
        await unlink(mutexPath).catch(() => { });
    }
}
/**
 * Acquire an advisory lock on `paths` for `owner`. Fails if any *other*,
 * non-expired owner already holds an overlapping path. Re-locking as the
 * same owner replaces that owner's own previous lock (paths and TTL both).
 */
export async function lockPaths(input) {
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
            const blockingOwners = new Set();
            const blockingErrors = [];
            for (const other of locks) {
                if (other.owner === owner || isExpired(other, now))
                    continue;
                for (const p of paths) {
                    const clash = other.paths.find((op) => pathsOverlap(p, op));
                    if (clash) {
                        blockingOwners.add(other.owner);
                        blockingErrors.push(`Path "${p}" is locked by owner "${other.owner}" (locked at ${other.lockedAt}` +
                            (other.expiresAt ? `, expires at ${other.expiresAt}` : '') +
                            `).`);
                    }
                }
            }
            if (blockingOwners.size > 0) {
                if (!waitUntil) {
                    throw new Error(`${blockingErrors.join('\n')}\nUse --paths that don't overlap, or wait for the lock to clear.`);
                }
                if (Date.now() > waitUntil) {
                    await unlink(waitFile(root, owner)).catch(() => { });
                    throw new Error(`Timed out waiting for lock on paths: ${paths.join(', ')}`);
                }
                const allWaits = (await listWaits(root)).filter((w) => !isWaitExpired(w, now));
                detectDeadlock(owner, Array.from(blockingOwners), allWaits);
                const waitEntry = {
                    owner,
                    paths,
                    waitingOn: Array.from(blockingOwners),
                    requestedAt: new Date(now).toISOString(),
                    expiresAt: new Date(waitUntil).toISOString(),
                };
                await writeFile(waitFile(root, owner), `${JSON.stringify(waitEntry, null, 2)}\n`);
                return false;
            }
            await unlink(waitFile(root, owner)).catch(() => { });
            const entry = { owner, paths, lockedAt: new Date(now).toISOString() };
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
export async function unlockOwner(root, owner) {
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
/** Report (and, with force, delete) locks past their own TTL. Never touches an active lock. */
export async function sweepExpiredLocks(root, opts = {}) {
    return withLocksMutex(root, async () => {
        const now = Date.now();
        const expired = (await listLocks(root)).filter((l) => isExpired(l, now));
        const expiredWaits = (await listWaits(root)).filter((w) => isWaitExpired(w, now));
        const removed = [];
        const removedWaits = [];
        if (opts.force) {
            for (const l of expired) {
                try {
                    await unlink(lockFile(root, l.owner));
                    removed.push(l.owner);
                }
                catch {
                    // Already gone; nothing to report.
                }
            }
            for (const w of expiredWaits) {
                try {
                    await unlink(waitFile(root, w.owner));
                    removedWaits.push(w.owner);
                }
                catch {
                    // Already gone
                }
            }
        }
        return { expired, removed, expiredWaits, removedWaits };
    });
}
