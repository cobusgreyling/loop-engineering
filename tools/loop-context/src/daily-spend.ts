import path from 'node:path';
import { mkdir, readFile, writeFile, open, unlink, stat } from 'node:fs/promises';

export interface DailySpendState {
  date: string;
  tokensUsedToday: number;
}

/** Today's date in UTC, as YYYY-MM-DD — the daily-spend rollover boundary. */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function statePath(dir: string, pattern: string): string {
  return path.join(dir, `daily-spend.${pattern}.json`);
}

function lockPath(dir: string, pattern: string): string {
  return path.join(dir, `.daily-spend.${pattern}.lock`);
}

const LOCK_STALE_MS = 30000;
const LOCK_TIMEOUT_MS = 30000;

/**
 * Serializes read-modify-write access to one pattern's state file, the same
 * lock-file-plus-poll shape loop-worktree's manifest mutex uses. Without
 * this, two overlapping invocations (e.g. two scheduled loops hitting the
 * same pattern) both read the same stale total and the second write clobbers
 * the first, silently losing a delta from the daily-budget circuit breaker.
 */
async function withLock<T>(dir: string, pattern: string, fn: () => Promise<T>): Promise<T> {
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir, pattern);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      const handle = await open(lock, 'wx');
      await handle.close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;

      try {
        const st = await stat(lock);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          await unlink(lock).catch(() => {});
          continue;
        }
      } catch {
        continue;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for daily-spend lock on "${pattern}". If no other loop-context process is running, delete ${lock} manually.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 35));
    }
  }
  try {
    return await fn();
  } finally {
    await unlink(lock).catch(() => {});
  }
}

async function readState(dir: string, pattern: string): Promise<DailySpendState | null> {
  const file = statePath(dir, pattern);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(
      `Cannot read daily spend state at ${file}: ${(err as Error).message}. Refusing to reset accumulated spend.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid daily spend state at ${file}: not valid JSON. Inspect or restore the file before retrying.`);
  }

  const state = parsed as Partial<DailySpendState> | null;
  if (!state || Array.isArray(state) || !isUTCDate(state.date) || !isTokenCount(state.tokensUsedToday)) {
    throw new Error(
      `Invalid daily spend state at ${file}: expected a YYYY-MM-DD UTC date and a finite, non-negative tokensUsedToday. Inspect or restore the file before retrying.`,
    );
  }
  return state as DailySpendState;
}

function isTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isUTCDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Add `tokensDelta` to a pattern's running daily total and persist it. Rolls
 * over to a fresh total when the stored date isn't today (UTC) — a stale
 * file from a previous day is treated as if it didn't exist.
 */
export async function recordDailySpend(
  dir: string,
  pattern: string,
  tokensDelta: number,
): Promise<DailySpendState> {
  if (!isTokenCount(tokensDelta)) {
    throw new Error('Token increment (tokensUsed) must be a finite, non-negative number.');
  }
  return withLock(dir, pattern, async () => {
    const today = todayUTC();
    const existing = await readState(dir, pattern);
    const carryOver = existing && existing.date === today ? existing.tokensUsedToday : 0;
    const tokensUsedToday = carryOver + tokensDelta;
    if (!isTokenCount(tokensUsedToday)) {
      throw new Error('Daily token total must be finite; accumulated spend was not changed.');
    }
    const state: DailySpendState = { date: today, tokensUsedToday };

    await mkdir(dir, { recursive: true });
    await writeFile(statePath(dir, pattern), JSON.stringify(state, null, 2));
    return state;
  });
}
