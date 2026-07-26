#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runSwarm } from './swarm.js';
async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            count: { type: 'string', short: 'n', default: '3' },
            shell: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
        strict: false, // Allow extra args after --
        allowPositionals: true
    });
    if (positionals.length === 0 || positionals[0] !== 'run' || values.help) {
        const isHelp = values.help;
        const msg = `
Usage: loop-swarm run [options] -- <command>

Options:
  --count, -n   Number of parallel agents to spawn (default: 3)
  --shell       Execute the command inside a shell
  --help, -h    Show this help message
`;
        if (!isHelp) {
            console.error('❌ Missing or invalid subcommand. Must use "run".');
            console.error(msg);
            process.exit(1);
        }
        else {
            console.log(msg);
            process.exit(0);
        }
    }
    // Find the -- separator manually if parseArgs doesn't handle it easily
    const args = process.argv.slice(2);
    const separatorIndex = args.indexOf('--');
    if (separatorIndex === -1 || separatorIndex === args.length - 1) {
        console.error('❌ Missing command. Use -- to separate options from the command.');
        console.error('Example: loop-swarm run --count 3 -- echo "hello"');
        process.exit(1);
    }
    const agentCommandParts = args.slice(separatorIndex + 1);
    const command = agentCommandParts[0];
    const commandArgs = agentCommandParts.slice(1);
    const count = parseInt(values.count, 10);
    if (isNaN(count) || count < 1) {
        console.error('❌ --count must be a positive integer.');
        process.exit(1);
    }
    try {
        const result = await runSwarm(process.cwd(), command, commandArgs, {
            count,
            shell: values.shell
        });
        if (result.reached) {
            process.exit(0);
        }
        else {
            process.exit(1);
        }
    }
    catch (err) {
        console.error('❌ loop-swarm failed:', err);
        process.exit(1);
    }
}
main();
