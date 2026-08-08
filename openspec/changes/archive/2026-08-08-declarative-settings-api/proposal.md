## Status: Implemented (bd flow-a7r)

Implemented once (2026-07-27), then reverted the same week: Obsidian 1.13.0 (needed for `getSettingDefinitions()`) turned out to be Insiders-beta-only — `obsidian-launcher download app -v latest` resolved to `1.12.7`, and requesting `1.13.1` failed with "Obsidian Insiders account is required to download Obsidian beta versions." Resumed 2026-08-07 once `obsidian-launcher download app -v latest` started resolving to a public-stable `1.13.x`. Discovered on resumption: that public-stable version is `1.13.4`, not `1.13.1` — `1.13.1` through `1.13.3` are still Insiders-only (Obsidian's release process jumped straight from Insiders betas to `1.13.4`), so `minAppVersion` and `e2e/obsidian-version.json`'s `appVersion` both target `1.13.4` instead of `1.13.1` (see design.md Decision 4). Also folded in: two design simplifications discovered during the 2026-07-27 pass (`getControlValue`/`setControlValue` need no override; the pure list-mapping logic needs its own file, `src/settings-predicate-list.ts`, since `src/settings.ts` pulls in a runtime `obsidian` import `bun:test` can't resolve), and a scope extension discovered on resumption: `feat: script-hook execution (#121)` added a second settings-driven list (`scriptsFolder`/`scriptHookBindings`) to `RoutineFlowSettingTab` after this proposal was originally written; it gets the identical declarative treatment as `writeBackProperty`/`formulaPredicates` (see design.md's third discovery).

Resumed again 2026-08-08 to finish the deferred e2e coverage (tasks.md section 4) and rebase onto `main`, which had picked up an unrelated `progressMeterStyle` settings dropdown (`flow-gu1.19.15.4`, `#157`) on the old imperative `display()` while this branch sat deferred — folded into the declarative rewrite as a third bound scalar control (design.md's fourth discovery). `e2e/settings-tab.e2e.ts` was written (design.md's fifth discovery: deletion is driven via the keyboard shortcut `SettingDefinitionList.onDelete` documents, not the delete button, since the button's DOM isn't pinned down in the type declarations) and pushed to CI, which revealed the real blocker: `app.setting.open()` deterministically FATALs Obsidian's GPU process under Xvfb in CI too, not just local WSL as previously assumed (design.md's sixth discovery corrects the earlier claim in this doc that CI was unaffected — that claim was based on `#157`'s e2e run, which never called `app.setting.open()`). `e2e/settings-tab.e2e.ts` is `test.describe.skip()`'d referencing flow-1la (now updated with this sharper finding) rather than blocking this migration on an unrelated, already-tracked P2 investigation.

## Why

`eslint-plugin-obsidianmd` 0.4.x flags `RoutineFlowSettingTab` for still using the deprecated imperative `display()` pattern instead of Obsidian 1.13.0's declarative `getSettingDefinitions()` API. Practically, this means the plugin's settings never appear in Obsidian's in-app settings search on 1.13.0+. The plugin is still unreleased (pre-0.1.0), so there's no backwards-compatibility cost to adopting the new API outright rather than carrying both.

## What Changes

- **BREAKING**: `manifest.json`'s `minAppVersion` moves to `1.13.4` (the actual public-stable floor as of 2026-08-07 resumption — see design.md Decision 4 for why not `1.13.1`) from `1.12.7`, since `getSettingDefinitions()` requires 1.13.0+. Acceptable pre-release; no users depend on the current floor.
- `RoutineFlowSettingTab.display()` is removed entirely — no dual-path fallback.
- `RoutineFlowSettingTab` implements `getSettingDefinitions()` returning a declarative array: bound text controls for `writeBackProperty` and `scriptsFolder`, a bound dropdown control for `progressMeterStyle`, `SettingDefinitionList`s for the custom-predicate rows and script-hook-binding rows (each with `onDelete`), and imperative `render`-type rows (escape hatch) for the existing add-predicate and add-script-hook forms, preserving their current validation UX unchanged.
- `RoutineFlowSettingTab` relies on `PluginSettingTab`'s inherited `getControlValue`/`setControlValue` (no override needed — see design.md Decision 2) to bind the declarative text/dropdown controls to `plugin.settings`.
- `e2e/obsidian-version.json`'s pinned `appVersion` moves to `1.13.4` — required so e2e actually exercises the new API path (a pre-1.13 Obsidian binary never calls `getSettingDefinitions()`, and there's no `display()` fallback to fall back to after this change). `installerVersion` stays `"latest"` (a separate version track from `appVersion` — obsidian-launcher resolves the compatible installer automatically; hardcoding it to match `appVersion` fails with an incompatibility error).
- Adds first-ever test coverage for the settings tab: unit tests for the pure list-mapping/key-routing logic, and Playwright e2e coverage for the settings UI itself (opening the tab, editing the write-back field, adding/deleting a predicate).

## Capabilities

### New Capabilities
- `settings-tab-ui`: Declarative-API-driven behavior of `RoutineFlowSettingTab` — what settings are exposed, how values bind and persist, and how the custom-predicate list is added to/removed from.

### Modified Capabilities
(none — no existing spec covers the settings tab)

## Impact

- `src/settings.ts` — full rewrite of `RoutineFlowSettingTab`'s rendering approach; `RoutineFlowSettingsSchema`/`DEFAULT_SETTINGS` unchanged.
- New: `src/settings-predicate-list.ts` (`formulaPredicatesToListItems`), `src/settings-script-hook-list.ts` (`scriptHookBindingsToListItems`) — pure list-mapping logic, split out for unit-testability (see design.md).
- `manifest.json` — `minAppVersion` bump.
- `e2e/obsidian-version.json` — pinned Obsidian version bump (CI's Obsidian binary cache key in `.github/workflows/ci.yml` picks this up automatically via `hashFiles`).
- New: `tests/settings-predicate-list.test.ts`, `tests/settings-script-hook-list.test.ts` (unit), `e2e/settings-tab.e2e.ts` (e2e).
- No change to `src/main.ts` (`RoutineFlowSettingTab` registration is unaffected) or to `FormulaPredicateSettingSchema`/predicate validation logic (`PredicateNameSchema`, `compileFormula`), which is reused as-is.
