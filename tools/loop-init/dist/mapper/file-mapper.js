/**
 * Content-to-layout file mapper.
 *
 * Translates tool-agnostic content paths to harness-specific target paths.
 * Pure function: no IO, no side effects. Accepts a Harness layout and a
 * content descriptor, returns an array of {source, target} mappings that
 * tell the scaffold pipeline where each content file should be written.
 *
 * @see .scratch/generic-agent-harness/issues/04-content-to-layout-file-mapper.md
 */
/**
 * Join path segments with forward slashes, avoiding double slashes.
 * Works for both absolute and relative paths without importing node:path
 * (keeps this module platform-neutral and trivially testable).
 */
function joinPath(...segments) {
    return segments
        .filter((s) => s != null && s.length > 0)
        .join('/')
        .replace(/\/+/g, '/');
}
/**
 * Map tool-agnostic content to harness-specific target paths.
 *
 * Rules:
 * - Skills: `<basePath>/skills/<name>/SKILL.md` → `<layout.skills_dir>/<name>/<layout.skill_filename>`
 * - Agents: `<basePath>/agents/<name>.md` → `<layout.agents_dir>/<name>.md` (skipped when agents_dir is null)
 * - Config: `<basePath>/<configFile>` → `<layout.config_file>` (skipped when either side is null)
 *
 * @param layout - The harness layout conventions (from a parsed Harness manifest)
 * @param content - The tool-agnostic content descriptor
 * @returns Array of source→target mappings
 */
export function mapContentToLayout(layout, content) {
    const mappings = [];
    // Map skills
    for (const skillName of content.skills) {
        mappings.push({
            source: joinPath(content.basePath, 'skills', skillName, 'SKILL.md'),
            target: joinPath(layout.skills_dir, skillName, layout.skill_filename),
        });
    }
    // Map agents (skip when harness has no agents_dir)
    if (layout.agents_dir !== null) {
        for (const agentName of content.agents) {
            mappings.push({
                source: joinPath(content.basePath, 'agents', `${agentName}.md`),
                target: joinPath(layout.agents_dir, `${agentName}.md`),
            });
        }
    }
    // Map config file (only when both sides are non-null)
    if (layout.config_file !== null && content.configFile !== null) {
        mappings.push({
            source: joinPath(content.basePath, content.configFile),
            target: layout.config_file,
        });
    }
    return mappings;
}
