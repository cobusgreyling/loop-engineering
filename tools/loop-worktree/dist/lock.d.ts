export declare const LOCKS_DIR: string;
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
export declare function listWaits(root: string): Promise<WaitEntry[]>;
export declare function isWaitExpired(wait: WaitEntry, now?: number): boolean;
export declare function isExpired(lock: LockEntry, now?: number): boolean;
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
export declare function pathsOverlap(a: string, b: string): boolean;
export declare function listLocks(root: string): Promise<LockEntry[]>;
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
export declare function lockPaths(input: LockPathsInput): Promise<LockEntry>;
/** Release `owner`'s lock. Returns false (no-op) if it didn't hold one. */
export declare function unlockOwner(root: string, owner: string): Promise<boolean>;
export interface SweepExpiredLocksResult {
    expired: LockEntry[];
    removed: string[];
    expiredWaits?: WaitEntry[];
    removedWaits?: string[];
}
/** Report (and, with force, delete) locks past their own TTL. Never touches an active lock. */
export declare function sweepExpiredLocks(root: string, opts?: {
    force?: boolean;
}): Promise<SweepExpiredLocksResult>;
