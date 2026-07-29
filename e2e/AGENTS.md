# End-to-end testing guidelines

These instructions apply when editing or running end-to-end tests for the Routine Flow plugin.

## Playwright interactions

Always interact with the internal Obsidian API using `evaluateObsidian`.
Avoid scraping browser elements or parsing UI layers unless checking raw HTML rendering.
Variables must be passed explicitly into the helper callbacks because closures are not preserved during serialization.
Refer to `e2e/obsidian-internal.d.ts` when adding new API properties.

## Known gotchas

- **Bases leaf duplication**: reuse an existing leaf instead of always opening a new tab — `app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')`. A freshly opened leaf can transiently sit alongside a pre-existing one, and both may match `.mod-active` at once, causing flaky wrong-view clicks. Scope Playwright locators to `.workspace-leaf-content[data-type="bases"]` rather than `.mod-active` wherever only one such leaf is expected.
- **Sub-view tab switching doesn't reset state**: switching a Bases view's sub-view tab (e.g. Table → Workout) does not re-trigger the underlying `EngineStore` — the header keeps showing whatever routine graph/phase is currently active until the user clicks Start. Don't assert on a newly-selected tab's own routine content before clicking Start.
- **Dotted frontmatter keys**: a Bases property id is `<source>.<name>`. A frontmatter key that itself contains a dot (e.g. a key literally named `note.type`) needs `note.<full-key>` (i.e. `note.note.type`) to resolve — the plain form parses as source=note/name=type and silently misses.
- **`getViewOptions()` defaults aren't applied**: the declared `default:` field only pre-fills Obsidian's settings UI. `config.get(key)`/`config.getAsPropertyId(key)` return undefined until a user explicitly sets the option in the `.base` file — plugin code must supply its own fallback or it silently breaks for any unconfigured view.
- **`.obsidian/workspace.json` is gitignored**: the example vault has no persisted leaf on a fresh checkout/CI, unlike a dev machine with leftover state from prior interactive sessions. Tests must explicitly open and select the target sub-view in `beforeEach` rather than assuming a view is already open.
- **Skipping a timed phase**: dispatch `{ type: 'advance-phase' }` directly via `evaluateObsidian` rather than looping tick dispatches or using `page.waitForTimeout`. It always lands at status `stopped`, so the UI's Start button (not Pause) must be clicked again to begin running the newly-current phase.
- **Build before testing**: `bunx playwright test` runs Obsidian against whatever `main.js` already sits at repo root — it does not rebuild from `src/` first. Run `bun run build` immediately before any e2e verification pass, or a stale bundle will silently pass against old code.
- **Driving Obsidian for one-off verification**: use `bunx playwright test <file>` (the real, Node-based test runner). A raw `bun -e`/`bun script.ts` calling `playwright-core`'s `connectOverCDP` directly hangs forever at the websocket handshake — a Bun-runtime incompatibility, not a CDP problem.
- **Regenerating the generated vault**: always use `rebuildGeneratedVault` (from `e2e/vault/generator.ts`), never `generateVault`+`writeVault` directly. It deletes `GENERATED_VAULT_FOLDERS` before writing; the overlay-only combo leaves stale notes behind whenever a routine's generated note count shrinks between runs.
