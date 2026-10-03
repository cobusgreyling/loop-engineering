/**
 * Strip credentials from anything that might be sent to TypeSafe or printed.
 * The API key itself must never appear in state, logs, or CLI output.
 */
const SECRET_PATTERNS = [
    /apikey_[0-9a-f]+_[0-9a-f]+/gi,
    /\bsk-[A-Za-z0-9_-]{10,}\b/g,
    /\bghp_[A-Za-z0-9]{20,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    /\bxai-[A-Za-z0-9_-]{20,}\b/g,
    /\bBearer\s+[A-Za-z0-9._\-+/=]+\b/gi,
    /\b(TYPESAFE_API_KEY|JEV_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|XAI_API_KEY)\s*[=:]\s*\S+/gi,
    /\b(api[_-]?key|secret|token|password)\s*[=:]\s*[^\s'"]{8,}/gi,
];
const SECRET_KEY = /key|token|secret|password|authorization|credential/i;
export const REDACTED = '[REDACTED]';
export function redactString(value) {
    let out = value;
    for (const re of SECRET_PATTERNS) {
        out = out.replace(re, REDACTED);
    }
    return out;
}
export function redactSecrets(value) {
    if (typeof value === 'string')
        return redactString(value);
    if (Array.isArray(value))
        return value.map(redactSecrets);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (SECRET_KEY.test(k) && typeof v === 'string') {
                out[k] = REDACTED;
            }
            else {
                out[k] = redactSecrets(v);
            }
        }
        return out;
    }
    return value;
}
/** True if `haystack` still contains a secret-shaped value after redaction should have run. */
export function containsSecret(haystack) {
    return SECRET_PATTERNS.some((re) => {
        re.lastIndex = 0;
        return re.test(haystack);
    });
}
