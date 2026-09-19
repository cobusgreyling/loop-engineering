import { readFile } from 'node:fs/promises';
export async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}
export async function readTextArg(value) {
    if (value === undefined || value === '') {
        throw new Error('Missing text. Pass --text, a positional string, or "-" for stdin.');
    }
    if (value === '-')
        return (await readStdin()).trim();
    return value;
}
export async function loadPassages(file) {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`${file} must be a JSON array of {id, text} passages.`);
    }
    return parsed.map((item, i) => {
        if (typeof item === 'string')
            return { id: `p${i}`, text: item };
        if (item && typeof item === 'object') {
            const rec = item;
            return {
                id: String(rec.id ?? rec.path ?? `p${i}`),
                text: String(rec.text ?? rec.content ?? rec.body ?? ''),
            };
        }
        throw new Error(`Passage ${i} in ${file} is not an object or string.`);
    });
}
function parseJsonl(trimmed) {
    const events = [];
    for (const line of trimmed.split('\n')) {
        if (!line.trim())
            continue;
        events.push(JSON.parse(line));
    }
    return events;
}
export async function loadClassifyInput(file) {
    const raw = await readFile(file, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed)
        return { events: [] };
    if (trimmed.startsWith('[')) {
        return { events: JSON.parse(trimmed) };
    }
    try {
        const obj = JSON.parse(trimmed);
        if (Array.isArray(obj.events)) {
            return {
                goal: typeof obj.goal === 'string' ? obj.goal : undefined,
                events: obj.events,
                ledger: obj.ledger,
                runLogExcerpt: typeof obj.runLogExcerpt === 'string' ? obj.runLogExcerpt : undefined,
            };
        }
        if (Array.isArray(obj.attempts)) {
            return {
                goal: typeof obj.goal === 'string' ? obj.goal : undefined,
                ledger: { goal: typeof obj.goal === 'string' ? obj.goal : undefined, attempts: obj.attempts },
            };
        }
        return { events: [obj] };
    }
    catch {
        return { events: parseJsonl(trimmed) };
    }
}
