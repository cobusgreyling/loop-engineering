/**
 * TypeSafe System One HTTP client.
 *
 * Auth: TYPESAFE_API_KEY, JEV_API_KEY, or ~/.config/typesafe/api_key
 * (override path with TYPESAFE_KEY_FILE). The key is never logged or returned.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { containsSecret, redactSecrets, redactString } from './redact.js';
export const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const DEFAULT_MODEL = 'jev-latest';
export function keyFilePath() {
    return process.env.TYPESAFE_KEY_FILE || path.join(homedir(), '.config', 'typesafe', 'api_key');
}
function candidateKeyFiles() {
    if (process.env.TYPESAFE_KEY_FILE)
        return [process.env.TYPESAFE_KEY_FILE];
    return [
        path.join(homedir(), '.config', 'typesafe', 'api_key'),
        path.join(homedir(), '.typesafe', 'api_key'),
    ];
}
async function readKeyFile(file) {
    try {
        const raw = await readFile(file, 'utf8');
        const line = raw.split('\n').find((l) => l.trim() && !l.trim().startsWith('#'));
        return line?.trim() || undefined;
    }
    catch {
        return undefined;
    }
}
export async function resolveApiKey(explicit) {
    if (explicit?.trim())
        return explicit.trim();
    const env = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY;
    if (env?.trim())
        return env.trim();
    for (const file of candidateKeyFiles()) {
        const value = await readKeyFile(file);
        if (value)
            return value;
    }
    return undefined;
}
export function keyIsConfigured(key) {
    return Boolean(key && key.length >= 8);
}
export function describeKeySource() {
    if (process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY)
        return 'env';
    return 'file';
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
export class TypeSafeError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = 'TypeSafeError';
        this.status = status;
    }
}
export async function systemOne(req, opts = {}) {
    const apiKey = await resolveApiKey(opts.apiKey);
    if (!keyIsConfigured(apiKey)) {
        throw new TypeSafeError(401, 'No TypeSafe API key. Set TYPESAFE_API_KEY or write ~/.config/typesafe/api_key (mode 600).');
    }
    const endpoint = opts.endpoint || process.env.TYPESAFE_ENDPOINT || DEFAULT_ENDPOINT;
    const model = req.model || opts.model || process.env.TYPESAFE_MODEL || DEFAULT_MODEL;
    const fetchFn = opts.fetch ?? fetch;
    const retries = opts.retries ?? 3;
    const payload = {
        state: redactSecrets(req.state),
        model,
        questions: req.questions,
    };
    const body = JSON.stringify(payload);
    if (containsSecret(body)) {
        throw new TypeSafeError(400, 'Refusing to send state that still looks like it contains a secret.');
    }
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const res = await fetchFn(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body,
        });
        if (res.status === 429 || res.status === 529) {
            const retryAfter = res.headers.get('retry-after');
            const wait = retryAfter && Number(retryAfter) > 0 ? Number(retryAfter) * 1000 : 250 * 2 ** attempt;
            await sleep(wait);
            continue;
        }
        const text = await res.text();
        const safeText = redactString(text);
        if (!res.ok) {
            lastError = new TypeSafeError(res.status, `TypeSafe API ${res.status}: ${safeText.slice(0, 400)}`);
            if (res.status >= 500 && attempt < retries) {
                await sleep(250 * 2 ** attempt);
                continue;
            }
            throw lastError;
        }
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new TypeSafeError(res.status, `TypeSafe API returned non-JSON: ${safeText.slice(0, 200)}`);
        }
        if (!parsed.answers || typeof parsed.answers !== 'object') {
            throw new TypeSafeError(res.status, 'TypeSafe API response missing answers.');
        }
        return parsed;
    }
    throw lastError ?? new TypeSafeError(429, 'TypeSafe API rate limited after retries.');
}
export function createClient(opts = {}) {
    return (req) => systemOne(req, opts);
}
