/**
 * Harness manifest loader.
 *
 * Parses YAML manifest files from `harnesses/<id>.yaml` into typed
 * Harness objects with validation. Supports alias resolution for
 * backward-compatible --tool values.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_DIR = path.resolve(PACKAGE_ROOT, '..', '..', 'harnesses');
/** Structured error for harness loading failures. */
export class HarnessLoadError extends Error {
    harnessId;
    constructor(harnessId, reason) {
        super(`Harness "${harnessId}": ${reason}`);
        this.name = 'HarnessLoadError';
        this.harnessId = harnessId;
    }
}
const VALID_SCHEDULING = new Set(['none', 'native', 'external']);
/** Required fields in the manifest root. */
const REQUIRED_ROOT_FIELDS = ['id', 'display_name', 'version', 'layout', 'capabilities', 'aliases'];
/** Required fields under layout. */
const REQUIRED_LAYOUT_FIELDS = ['skills_dir', 'skill_filename', 'agents_dir', 'config_file'];
/** Required fields under capabilities. */
const REQUIRED_CAPABILITY_FIELDS = [
    'shell',
    'file_write',
    'skill_read',
    'worktree',
    'sub_agent',
    'scheduling',
    'mcp',
];
function validateLayout(raw, harnessId) {
    if (raw === null || typeof raw !== 'object') {
        throw new HarnessLoadError(harnessId, 'missing or invalid "layout" section');
    }
    const obj = raw;
    for (const field of REQUIRED_LAYOUT_FIELDS) {
        if (!(field in obj)) {
            throw new HarnessLoadError(harnessId, `layout missing required field "${field}"`);
        }
    }
    const result = {
        skills_dir: String(obj.skills_dir),
        skill_filename: String(obj.skill_filename),
        agents_dir: obj.agents_dir === null ? null : String(obj.agents_dir),
        config_file: obj.config_file === null ? null : String(obj.config_file),
    };
    // Pass through optional custom extension point (Spec §36)
    if ('custom' in obj && obj.custom !== null && typeof obj.custom === 'object') {
        result.custom = obj.custom;
    }
    return result;
}
function validateCapabilities(raw, harnessId) {
    if (raw === null || typeof raw !== 'object') {
        throw new HarnessLoadError(harnessId, 'missing or invalid "capabilities" section');
    }
    const obj = raw;
    for (const field of REQUIRED_CAPABILITY_FIELDS) {
        if (!(field in obj)) {
            throw new HarnessLoadError(harnessId, `capabilities missing required field "${field}"`);
        }
    }
    const scheduling = String(obj.scheduling);
    if (!VALID_SCHEDULING.has(scheduling)) {
        throw new HarnessLoadError(harnessId, `capabilities.scheduling must be one of none/native/external, got "${scheduling}"`);
    }
    return {
        shell: Boolean(obj.shell),
        file_write: Boolean(obj.file_write),
        skill_read: Boolean(obj.skill_read),
        worktree: Boolean(obj.worktree),
        sub_agent: Boolean(obj.sub_agent),
        scheduling: scheduling,
        mcp: Boolean(obj.mcp),
    };
}
function validateManifest(raw, harnessId) {
    if (raw === null || typeof raw !== 'object') {
        throw new HarnessLoadError(harnessId, 'manifest is not a valid YAML object');
    }
    const obj = raw;
    for (const field of REQUIRED_ROOT_FIELDS) {
        if (!(field in obj)) {
            throw new HarnessLoadError(harnessId, `missing required field "${field}"`);
        }
    }
    const id = String(obj.id);
    if (!Array.isArray(obj.aliases)) {
        throw new HarnessLoadError(harnessId, '"aliases" must be an array');
    }
    return {
        id,
        display_name: String(obj.display_name),
        version: String(obj.version),
        layout: validateLayout(obj.layout, harnessId),
        capabilities: validateCapabilities(obj.capabilities, harnessId),
        aliases: obj.aliases.map(String),
    };
}
// Cache loaded manifests and the alias index.
const cache = new Map();
let aliasIndex = null;
async function buildAliasIndex() {
    if (aliasIndex !== null)
        return aliasIndex;
    const index = new Map();
    const entries = await readdir(HARNESS_DIR).catch(() => []);
    const yamlFiles = entries.filter((f) => f.endsWith('.yaml'));
    for (const file of yamlFiles) {
        const id = file.replace(/\.yaml$/, '');
        try {
            const harness = await loadHarnessById(id);
            for (const alias of harness.aliases) {
                index.set(alias, id);
            }
        }
        catch {
            // Skip invalid manifests during index building; loadHarness will report errors.
        }
    }
    aliasIndex = index;
    return index;
}
async function loadHarnessById(id) {
    const cached = cache.get(id);
    if (cached)
        return cached;
    const filePath = path.join(HARNESS_DIR, `${id}.yaml`);
    let content;
    try {
        content = await readFile(filePath, 'utf-8');
    }
    catch {
        throw new HarnessLoadError(id, `manifest file not found at harnesses/${id}.yaml`);
    }
    let parsed;
    try {
        parsed = YAML.parse(content);
    }
    catch (err) {
        throw new HarnessLoadError(id, `invalid YAML: ${err.message}`);
    }
    const harness = validateManifest(parsed, id);
    // Verify id matches filename
    if (harness.id !== id) {
        throw new HarnessLoadError(id, `manifest id "${harness.id}" does not match filename "${id}"`);
    }
    cache.set(id, harness);
    return harness;
}
/**
 * Load a harness manifest by its canonical ID.
 *
 * @param id - The harness identifier (must match a file at harnesses/<id>.yaml)
 * @returns Parsed and validated Harness object
 * @throws HarnessLoadError if the manifest is missing or invalid
 */
export async function loadHarness(id) {
    return loadHarnessById(id);
}
/**
 * Resolve a tool value (which may be an alias) to a canonical harness ID.
 *
 * @param toolValue - The --tool flag value or alias
 * @returns The canonical harness ID
 * @throws HarnessLoadError if no harness matches the given value
 */
export async function resolveHarnessId(toolValue) {
    const index = await buildAliasIndex();
    const resolved = index.get(toolValue);
    if (resolved === undefined) {
        throw new HarnessLoadError(toolValue, `no harness found for "${toolValue}". Available harnesses can be listed with listHarnesses()`);
    }
    return resolved;
}
/**
 * List all available harness manifests.
 *
 * @returns Array of parsed Harness objects for every valid manifest in harnesses/
 */
export async function listHarnesses() {
    const entries = await readdir(HARNESS_DIR).catch(() => []);
    const yamlFiles = entries.filter((f) => f.endsWith('.yaml'));
    const results = [];
    for (const file of yamlFiles) {
        const id = file.replace(/\.yaml$/, '');
        try {
            const harness = await loadHarnessById(id);
            results.push(harness);
        }
        catch {
            // Skip invalid manifests
        }
    }
    return results;
}
