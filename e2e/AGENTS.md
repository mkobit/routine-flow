# End-to-end testing guidelines

These instructions apply when editing or running end-to-end tests for the Routine Flow plugin.

## Playwright interactions

Always interact with the internal Obsidian API using `evaluateObsidian`.
Avoid scraping browser elements or parsing UI layers unless checking raw HTML rendering.
Variables must be passed explicitly into the helper callbacks because closures are not preserved during serialization.
Refer to `e2e/obsidian-internal.d.ts` when adding new API properties.
