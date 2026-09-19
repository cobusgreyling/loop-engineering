/**
 * Resolve and run sibling loop-* CLIs without deprecating them.
 * Prefer monorepo dist/, then node_modules package bin, then npx.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** tools/loop/dist → tools/loop → tools */
const TOOLS_ROOT = path.resolve(__dirname, '../..');
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const TOOLS = {
    init: {
        pkg: '@cobusgreyling/loop-init',
        dir: 'loop-init',
        bin: 'dist/cli.js',
        command: 'loop-init',
    },
    audit: {
        pkg: '@cobusgreyling/loop-audit',
        dir: 'loop-audit',
        bin: 'dist/cli.js',
        command: 'loop-audit',
    },
    cost: {
        pkg: '@cobusgreyling/loop-cost',
        dir: 'loop-cost',
        bin: 'dist/cli.js',
        command: 'loop-cost',
    },
    sync: {
        pkg: '@cobusgreyling/loop-sync',
        dir: 'loop-sync',
        bin: 'dist/cli.js',
        command: 'loop-sync',
    },
    context: {
        pkg: '@cobusgreyling/loop-context',
        dir: 'loop-context',
        bin: 'dist/cli.js',
        command: 'loop-context',
    },
    worktree: {
        pkg: '@cobusgreyling/loop-worktree',
        dir: 'loop-worktree',
        bin: 'dist/cli.js',
        command: 'loop-worktree',
    },
    gate: {
        pkg: '@cobusgreyling/loop-gate',
        dir: 'loop-gate',
        bin: 'dist/cli.js',
        command: 'loop-gate',
    },
    mcp: {
        pkg: '@cobusgreyling/loop-mcp-server',
        dir: 'mcp-server',
        bin: 'dist/index.js',
        command: 'loop-mcp-server',
    },
    sandbox: {
        pkg: '@cobusgreyling/loop-sandbox',
        dir: 'loop-sandbox',
        bin: 'dist/cli.js',
        command: 'loop-sandbox',
    },
    jev: {
        pkg: '@cobusgreyling/loop-jev',
        dir: 'loop-jev',
        bin: 'dist/cli.js',
        command: 'loop-jev',
    },
};
async function exists(p) {
    try {
        await access(p);
        return true;
    }
    catch {
        return false;
    }
}
/** Resolve absolute path to a tool CLI script, or null if only npx remains. */
export async function resolveToolScript(id) {
    const spec = TOOLS[id];
    const monorepo = path.join(TOOLS_ROOT, spec.dir, spec.bin);
    if (await exists(monorepo))
        return monorepo;
    // nested under this package's node_modules (if ever installed as dep)
    const nested = path.join(PACKAGE_ROOT, 'node_modules', spec.pkg, spec.bin);
    if (await exists(nested))
        return nested;
    // hoisted from repo root
    const hoisted = path.join(TOOLS_ROOT, '..', 'node_modules', spec.pkg, spec.bin);
    if (await exists(hoisted))
        return hoisted;
    return null;
}
function spawnNode(script, args, capture) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...args], {
            stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
            env: process.env,
        });
        let stdout = '';
        let stderr = '';
        if (capture) {
            child.stdout?.on('data', (d) => {
                stdout += d.toString();
            });
            child.stderr?.on('data', (d) => {
                stderr += d.toString();
            });
        }
        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });
}
function spawnNpx(pkg, args, capture) {
    return new Promise((resolve, reject) => {
        const child = spawn('npx', ['--yes', pkg, ...args], {
            stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
            env: process.env,
            shell: process.platform === 'win32',
        });
        let stdout = '';
        let stderr = '';
        if (capture) {
            child.stdout?.on('data', (d) => {
                stdout += d.toString();
            });
            child.stderr?.on('data', (d) => {
                stderr += d.toString();
            });
        }
        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });
}
/** Run a sibling tool; inherit stdio for interactive pass-through. */
export async function runTool(id, args) {
    const script = await resolveToolScript(id);
    if (script) {
        const r = await spawnNode(script, args, false);
        return r.code;
    }
    const r = await spawnNpx(TOOLS[id].pkg, args, false);
    return r.code;
}
/** Run a sibling tool and capture stdout (for doctor/status). */
export async function runToolCapture(id, args) {
    const script = await resolveToolScript(id);
    if (script)
        return spawnNode(script, args, true);
    return spawnNpx(TOOLS[id].pkg, args, true);
}
export function toolPackageName(id) {
    return TOOLS[id].pkg;
}
export function listToolIds() {
    return Object.keys(TOOLS);
}
