# End-to-end testing guidelines

These instructions apply when editing or running end-to-end tests for the Routine Flow plugin.

## Playwright interactions

Always interact with the internal Obsidian API using `evaluateObsidian`.
Avoid scraping browser elements or parsing UI layers unless checking raw HTML rendering.
Refer to `e2e/obsidian-internal.d.ts` when adding new API properties.

Variables must be passed explicitly into the helper callbacks because closures are not preserved during serialization -- the function is serialized via `.toString()` and re-evaluated in the renderer:

```typescript
const filename = 'note.md'
await evaluateObsidian(page, async (app, args: { filename: string }) => {
  // 'args.filename' is available here, 'filename' is NOT
  await app.vault.create(args.filename, '')
}, { filename })
```

## Known gotchas

- **Bases leaf duplication**: reuse an existing leaf instead of always opening a new tab — `app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')`. A freshly opened leaf can transiently sit alongside a pre-existing one, and both may match `.mod-active` at once, causing flaky wrong-view clicks. Scope Playwright locators to `.workspace-leaf-content[data-type="bases"]` rather than `.mod-active` wherever only one such leaf is expected.
- **Sub-view tab switching doesn't reset state**: switching a Bases view's sub-view tab (e.g. Table → Workout) does not re-trigger the underlying `EngineStore` — the header keeps showing whatever routine graph/phase is currently active until the user clicks Start. Don't assert on a newly-selected tab's own routine content before clicking Start.
- **Dotted frontmatter keys**: a Bases property id is `<source>.<name>`. A frontmatter key that itself contains a dot (e.g. a key literally named `note.type`) needs `note.<full-key>` (i.e. `note.note.type`) to resolve — the plain form parses as source=note/name=type and silently misses.
- **`getViewOptions()` defaults aren't applied**: the declared `default:` field only pre-fills Obsidian's settings UI. `config.get(key)`/`config.getAsPropertyId(key)` return undefined until a user explicitly sets the option in the `.base` file — plugin code must supply its own fallback or it silently breaks for any unconfigured view.
- **`.obsidian/workspace.json` is gitignored**: the example vault has no persisted leaf on a fresh checkout/CI, unlike a dev machine with leftover state from prior interactive sessions. Tests must explicitly open and select the target sub-view in `beforeEach` rather than assuming a view is already open.
- **Skipping a timed phase**: dispatch `{ type: 'advance-phase' }` directly via `evaluateObsidian` rather than looping tick dispatches or using `page.waitForTimeout`. It always lands at status `stopped`, so the UI's Start button (not Pause) must be clicked again to begin running the newly-current phase.
- **Build before testing**: `bunx playwright test` runs Obsidian against whatever `main.js` already sits at repo root — it does not rebuild from `src/` first. Run `bun run build` immediately before any e2e verification pass, or a stale bundle will silently pass against old code.
- **Driving Obsidian for one-off verification**: use `xvfb-run --auto-servernum --server-args="-screen 0 2560x1440x24" bun x playwright test <file>` or `bun run test:e2e:headless`. Never run Playwright commands directly without Xvfb or a window will appear on the real desktop. A raw `bun -e`/`bun script.ts` calling `playwright-core`'s `connectOverCDP` directly hangs forever at the websocket handshake — a Bun-runtime incompatibility, not a CDP problem.
- **Regenerating the generated vault**: always use `rebuildGeneratedVault` (from `e2e/vault/generator.ts`), never `generateVault`+`writeVault` directly. It deletes `GENERATED_VAULT_FOLDERS` before writing; the overlay-only combo leaves stale notes behind whenever a routine's generated note count shrinks between runs.
- **Obsidian process cleanup**: `e2e/fixtures/obsidian.ts` spawns Obsidian with `detached: true` and `e2e/fixtures/process-lifecycle.ts`'s `terminateProcess` signals the whole process group (`-pid`), not just the top-level PID -- required to reach Obsidian's GPU/renderer children, not only the Electron main process. It also removes the per-launch `configDir` and per-test vault-copy tmpdirs after every run/failed setup; `obsidian-launcher` itself leaks both into the OS tmpdir otherwise (confirmed: ~280MB across 100+ leaked dirs from before this fix).
- **WSL crash-dump growth**: running Obsidian under `xvfb-run` in this environment can FATAL its GPU process (`GPU process isn't usable. Goodbye.`) and trigger a ~1GB WSL crash-capture dump on the Windows host per occurrence, independent of any bug in this repo -- `--disable-gpu`, forcing Mesa software GL, and `ulimit -c 0` were all tried and none suppress it (flow-1la). Check `du -sh /mnt/c/Users/*/AppData/Local/Temp/wsl-crashes` before/after running the local e2e suite (especially the full suite, not just one spec) and stop to report if it grows by more than a crash or two.
- **Settings opens in a separate BrowserWindow**: on desktop, `app.setting.open()` does not render an in-page `.modal` over `obsidianPage.page` -- it opens a genuinely separate Electron window (`page.context()` grows from 1 `Page` to 2 the instant it's called). A locator scoped to `obsidianPage.page` for anything inside Settings just waits out the full test timeout, indistinguishable from a hang (flow-ac5 was misdiagnosed as GPU-compositing render latency for exactly this reason). Get the new page via `context.waitForEvent('page')` started *before* calling `app.setting.open()`, then drive UI locators against that page -- see `settings-tab.e2e.ts`'s `settingsPage` fixture. That window has no `window.app` of its own, so `evaluateObsidian` assertions must still target the original `obsidianPage.page`. Separately, `evaluateObsidian` (`e2e/helpers/evaluate.ts`) reads `window.app`, not `activeWindow.app` -- `activeWindow` on *either* window can end up pointing at the Settings window once it's open, which breaks the `activeWindow.app` lookup regardless of which page you evaluate on.
- **Mobile Obsidian emulation**: Obsidian supports mobile mode via `localStorage.setItem('EmulateMobile', '1')` followed by a page reload / initial load. This sets `app.isMobile` to `true` and adds `is-mobile` and `emulate-mobile` to `document.body`. Setting viewport width $\le 550$px (e.g. 390x844) activates phone mode (`is-phone`, `.mobile-navbar`, and hides `.status-bar`), while width $> 550$px activates tablet mode (`is-tablet`). Unlike desktop, `app.setting.open()` under mobile emulation opens an in-page modal (`.modal-container.mod-dim .modal.mod-settings`) on the main page rather than a separate BrowserWindow.

