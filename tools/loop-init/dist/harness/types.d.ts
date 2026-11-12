/**
 * Harness manifest types for the generic agent harness abstraction.
 *
 * A Harness describes *where* artifacts go (layout) and *what* the agent
 * can do (capabilities). It does not define *what* gets written — that is
 * the pattern's responsibility.
 *
 * @see docs/adr/0001-generic-agent-harness.md
 */
/** Scheduling support level. */
export type SchedulingLevel = 'none' | 'native' | 'external';
/** File layout conventions for a harness. */
export interface HarnessLayout {
    /** Directory where skill files are placed (e.g. ".claude/skills"). */
    skills_dir: string;
    /** Naming convention for individual skill files (e.g. "SKILL.md"). */
    skill_filename: string;
    /** Directory where agent/verifier prompts are placed, or null if none. */
    agents_dir: string | null;
    /** Harness main config file path, or null if none. */
    config_file: string | null;
    /** Optional extension point for non-standard conventions (Spec §36). */
    custom?: Record<string, unknown>;
}
/** Capability declarations for a harness. */
export interface HarnessCapabilities {
    /** Can execute shell commands. */
    shell: boolean;
    /** Can write files to disk. */
    file_write: boolean;
    /** Can read markdown skill files. */
    skill_read: boolean;
    /** Optional: native worktree support. */
    worktree: boolean;
    /** Optional: native sub-agent spawning. */
    sub_agent: boolean;
    /** Scheduling support level. */
    scheduling: SchedulingLevel;
    /** Optional: MCP connector support. */
    mcp: boolean;
}
/** A parsed and validated harness manifest. */
export interface Harness {
    /** Manifest key, matches filename (e.g. "claude"). */
    id: string;
    /** Human-readable display name. */
    display_name: string;
    /** Schema version for future evolution. */
    version: string;
    /** File layout conventions. */
    layout: HarnessLayout;
    /** Agent capability declarations. */
    capabilities: HarnessCapabilities;
    /** Backward-compatible --tool values that resolve to this harness. */
    aliases: string[];
}
