#!/usr/bin/env node
import { createWorktree, markWorktree, cleanupWorktrees, gc, listWorktrees, VALID_STATUSES, } from './worktree.js';
import { lockPaths, unlockOwner, listLocks, sweepExpiredLocks, isExpired, listWaits, isWaitExpired } from './lock.js';
function parseFlags(argv) {
    const flags = { root: process.cwd(), force: false, json: false, sweep: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--run-id')
            flags.runId = argv[++i];
        else if (a === '--pattern')
            flags.pattern = argv[++i];
        else if (a === '--base')
            flags.base = argv[++i];
        else if (a === '--status')
            flags.status = argv[++i];
        else if (a === '--older-than')
            flags.olderThan = argv[++i];
        else if (a === '--root')
            flags.root = argv[++i];
        else if (a === '--force')
            flags.force = true;
        else if (a === '--json')
            flags.json = true;
        else if (a === '--paths')
            flags.paths = argv[++i];
        else if (a === '--owner')
            flags.owner = argv[++i];
        else if (a === '--ttl')
            flags.ttl = argv[++i];
        else if (a === '--wait')
            flags.wait = argv[++i];
        else if (a === '--sweep')
            flags.sweep = true;
    }
    return flags;
}
function parseStatuses(csv) {
    return csv.split(',').map((s) => {
        const t = s.trim();
        if (!VALID_STATUSES.includes(t)) {
            throw new Error(`Invalid status "${t}". Use: ${VALID_STATUSES.join(', ')}.`);
        }
        return t;
    });
}
const HELP = `loop-worktree - manage isolated git worktrees for loop attempts

Usage:
  loop-worktree create --run-id <id> --pattern <p> [--base main]
  loop-worktree mark   --run-id <id> --status <${VALID_STATUSES.join('|')}>
  loop-worktree cleanup [--status rejected,escalated] [--older-than 24h] [--force]
  loop-worktree gc [--force] [--json]
  loop-worktree list [--status <s>] [--json]
  loop-worktree lock   --paths <glob1,glob2,...> --owner <name> [--ttl 6h] [--wait 15m]
  loop-worktree unlock --owner <name>
  loop-worktree locks [--sweep] [--force] [--json]

Common flags:
  --root <dir>   Repo root to operate in (default: cwd)
  --json         Machine-readable output (list, gc, locks)
  --force        Allow removing worktrees with uncommitted changes / orphans,
                 or (with locks --sweep) deleting expired lock files

Locking (advisory, not enforced by create -- pair it in your control script):
  --paths <csv>  Comma-separated path globs this owner is about to touch
  --owner <name> Lock/unlock identity, typically the pattern name
  --ttl <dur>    Optional expiry (e.g. 30m, 6h, 1d); omit for no auto-expiry
  --wait <dur>   Wait up to this long for locks to clear instead of failing immediately (detects deadlocks)
  locks --sweep  Report expired locks (report-only; --force deletes them)

Worktrees live under .loop-worktrees/, tracked in .loop-worktrees/manifest.json.
Locks live under .loop-worktrees/locks/<owner>.json. Add .loop-worktrees/ to
.gitignore.`;
async function main() {
    const argv = process.argv.slice(2);
    const command = argv[0];
    if (!command || command === '--help' || command === '-h') {
        console.log(HELP);
        return command ? 0 : 1;
    }
    const flags = parseFlags(argv.slice(1));
    switch (command) {
        case 'create': {
            if (!flags.runId || !flags.pattern) {
                throw new Error('create requires --run-id and --pattern.');
            }
            const entry = await createWorktree({
                root: flags.root,
                runId: flags.runId,
                pattern: flags.pattern,
                base: flags.base,
            });
            console.log(`created worktree ${entry.path} on branch ${entry.branch} (base ${entry.baseBranch})`);
            return 0;
        }
        case 'mark': {
            if (!flags.runId || !flags.status) {
                throw new Error('mark requires --run-id and --status.');
            }
            const entry = await markWorktree({
                root: flags.root,
                runId: flags.runId,
                status: flags.status,
            });
            console.log(`marked ${entry.id} as ${entry.status}`);
            return 0;
        }
        case 'cleanup': {
            const result = await cleanupWorktrees({
                root: flags.root,
                statuses: flags.status ? parseStatuses(flags.status) : undefined,
                olderThan: flags.olderThan,
                force: flags.force,
            });
            for (const e of result.removed)
                console.log(`removed ${e.path} (${e.status})`);
            for (const s of result.skipped)
                console.log(`skipped ${s.entry.path}: ${s.reason}`);
            console.log(`cleanup: ${result.removed.length} removed, ${result.skipped.length} skipped`);
            return 0;
        }
        case 'gc': {
            const result = await gc({ root: flags.root, force: flags.force });
            if (flags.json) {
                console.log(JSON.stringify(result, null, 2));
                return 0;
            }
            for (const o of result.orphans) {
                console.log(result.removedOrphans.includes(o) ? `removed orphan ${o}` : `orphan ${o}`);
            }
            for (const d of result.dropped)
                console.log(`dropped stale manifest entry ${d.id}`);
            console.log(`gc: ${result.orphans.length} orphan(s), ${result.dropped.length} dropped` +
                (flags.force ? `, ${result.removedOrphans.length} removed` : ' (report-only; use --force to remove orphans)'));
            return 0;
        }
        case 'list': {
            const entries = await listWorktrees({
                root: flags.root,
                status: flags.status,
            });
            if (flags.json) {
                console.log(JSON.stringify(entries, null, 2));
                return 0;
            }
            if (entries.length === 0) {
                console.log('no worktrees tracked');
                return 0;
            }
            for (const e of entries) {
                console.log(`${e.status.padEnd(9)} ${e.id}  ${e.branch}  (${e.pattern})`);
            }
            return 0;
        }
        case 'lock': {
            if (!flags.paths || !flags.owner) {
                throw new Error('lock requires --paths and --owner.');
            }
            const paths = flags.paths.split(',').map((p) => p.trim()).filter(Boolean);
            const entry = await lockPaths({ root: flags.root, owner: flags.owner, paths, ttl: flags.ttl, wait: flags.wait });
            console.log(`locked ${entry.paths.join(', ')} for ${entry.owner}` + (entry.expiresAt ? ` (expires ${entry.expiresAt})` : ''));
            return 0;
        }
        case 'unlock': {
            if (!flags.owner) {
                throw new Error('unlock requires --owner.');
            }
            const released = await unlockOwner(flags.root, flags.owner);
            console.log(released ? `unlocked ${flags.owner}` : `${flags.owner} held no lock`);
            return 0;
        }
        case 'locks': {
            if (flags.sweep) {
                const result = await sweepExpiredLocks(flags.root, { force: flags.force });
                if (flags.json) {
                    console.log(JSON.stringify(result, null, 2));
                    return 0;
                }
                for (const l of result.expired) {
                    console.log(result.removed.includes(l.owner) ? `removed expired lock ${l.owner}` : `expired lock ${l.owner}`);
                }
                const expiredWaits = result.expiredWaits || [];
                const removedWaits = result.removedWaits || [];
                for (const w of expiredWaits) {
                    console.log(removedWaits.includes(w.owner) ? `removed expired wait ${w.owner}` : `expired wait ${w.owner}`);
                }
                console.log(`locks --sweep: ${result.expired.length} lock(s), ${expiredWaits.length} wait(s) expired` +
                    (flags.force ? `, ${result.removed.length + removedWaits.length} removed` : ' (report-only; use --force to remove)'));
                return 0;
            }
            const locks = await listLocks(flags.root);
            const waits = await listWaits(flags.root);
            if (flags.json) {
                console.log(JSON.stringify({
                    locks: locks.map((l) => ({ ...l, expired: isExpired(l) })),
                    waits: waits.map((w) => ({ ...w, expired: isWaitExpired(w) }))
                }, null, 2));
                return 0;
            }
            if (locks.length === 0 && waits.length === 0) {
                console.log('no active locks or waits');
                return 0;
            }
            for (const l of locks) {
                const expiryNote = l.expiresAt ? `, expires ${l.expiresAt}${isExpired(l) ? ' (expired)' : ''}` : '';
                console.log(`${l.owner}  ${l.paths.join(', ')}  (locked ${l.lockedAt}${expiryNote})`);
            }
            for (const w of waits) {
                const expiryNote = w.expiresAt ? `, wait expires ${w.expiresAt}${isWaitExpired(w) ? ' (expired)' : ''}` : '';
                console.log(`${w.owner}  [WAITING ON: ${w.waitingOn.join(', ')}]  ${w.paths.join(', ')}  (requested ${w.requestedAt}${expiryNote})`);
            }
            return 0;
        }
        default:
            console.error(`Unknown command "${command}".\n\n${HELP}`);
            return 1;
    }
}
main()
    .then((code) => process.exit(code))
    .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
