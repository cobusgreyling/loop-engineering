# deed.page: short-lived preview links for drafted release notes

Use [deed.page](https://deed.page/docs) to turn a loop's drafted HTML (for example,
the release notes from the [Changelog Drafter](../../patterns/changelog-drafter.md))
into a link a human reviewer can open in a browser. The hosted MCP endpoint
publishes files to `https://{slug}.deed.page/` without an account or API key.

This is a **write** connector: anything it publishes is public on the internet.
Treat it like any other mutating action in the [safe write pattern](./safe-write-pattern.md).
The loop proposes a preview. A human decides what, if anything, is published for real.

## Setup (stdio MCP clients)

Install Node.js 22 or newer, including `npx`. The
[configuration](./deed-page.mcp.json) declares the same pinned `mcp-remote`
bridge as the Parallel Search example. It connects local stdio to the remote
endpoint over Streamable HTTP, with a project User-Agent and no authentication
header.

For Claude Desktop, open **Settings → Developer → Edit Config**, then merge the
`deed-page` entry from `deed-page.mcp.json` into the existing `mcpServers`
object. Keep your other servers. Restart the client and confirm that
`publish_site`, `get_site` and `delete_site` appear under `deed-page`. Clients
that use a native HTTP format need their own schema; do not copy this JSON into it.

## Verify the connection manually

Try these calls from your MCP client before adding the connector to a loop.

1. Call `publish_site` with a throwaway page and an expiry:

   ```json
   {
     "files": { "index.html": "<!doctype html><h1>Release notes preview</h1>" },
     "ttl_seconds": 3600
   }
   ```

   Expect `ok`, a `url`, a `slug` and, on the first publish, a `token`. Open the
   URL. The token is the only way to update or delete the page later. Store it
   like any other secret, never in `STATE.md`, a prompt, or a log.

2. Call `delete_site` with the returned `slug` and `token`. The URL should stop
   serving.

## Scope and failure handling

- Publish only content that is already public, such as release notes built from
  merged PRs in a public repository. Never publish private issue text, internal
  URLs, CI logs, or anything covered by the [human gates](../../docs/safety.md#human-gates-required).
- Always set `ttl_seconds` on loop-created previews so a forgotten link expires.
  Record the slug, URL and expiry in the pattern's state file, not the token.
- The loop posts the preview link for review (for example, in its PR comment) and
  stops there. Final release notes are published by a human, as the Changelog
  Drafter pattern already requires.
- Drafted content comes from [untrusted input](../../docs/safety.md#untrusted-input).
  Render titles and PR text as escaped text, not raw HTML, so a hostile PR title
  cannot add scripts or links to the preview page.
- On a `version_conflict`, rate-limit or connection error, record the failure for
  human review instead of retrying in a loop. Removing the `deed-page` entry
  disables the connector.
