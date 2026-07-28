## Status: Deferred (bd flow-a7r)

Implemented once, then reverted (2026-07-27): Obsidian 1.13.0 (needed for `getSettingDefinitions()`) turned out to be Insiders-beta-only — `obsidian-launcher download app -v latest` resolves to `1.12.7`, and requesting `1.13.1` fails with "Obsidian Insiders account is required to download Obsidian beta versions." Shipping `minAppVersion: 1.13.1` now would make the plugin uninstallable on any non-Insiders Obsidian client, and there's no way to run the e2e coverage below without Insiders credentials. Deferred until Obsidian 1.13.x ships publicly stable. This proposal, design, specs, and tasks are otherwise complete and implementation-ready — resume from here rather than re-deriving the design. Notably, two design simplifications were discovered during the (reverted) implementation pass and are already folded into design.md: `getControlValue`/`setControlValue` need no override (inherited `PluginSettingTab` defaults already do the right thing), and the pure list-mapping logic needs its own file (`src/settings-predicate-list.ts`) since `src/settings.ts` pulls in a runtime `obsidian` import `bun:test` can't resolve.

## Why

`eslint-plugin-obsidianmd` 0.4.x flags `PomodoroSettingTab` for still using the deprecated imperative `display()` pattern instead of Obsidian 1.13.0's declarative `getSettingDefinitions()` API. Practically, this means the plugin's settings never appear in Obsidian's in-app settings search on 1.13.0+. The plugin is still unreleased (pre-0.1.0), so there's no backwards-compatibility cost to adopting the new API outright rather than carrying both.

## What Changes

- **BREAKING**: `manifest.json`'s `minAppVersion` moves to `1.13.1` (matching the `obsidian` package already pinned in this repo) from whatever the public-stable floor is at resumption time (`1.12.7` as of 2026-07-27), since `getSettingDefinitions()` requires 1.13.0+. Acceptable pre-release; no users depend on the current floor. **Do not attempt this until Obsidian 1.13.x is public-stable** — see proposal Status above.
- `PomodoroSettingTab.display()` is removed entirely — no dual-path fallback.
- `PomodoroSettingTab` implements `getSettingDefinitions()` returning a declarative array: a bound text control for `writeBackProperty`, a `SettingDefinitionList` for the custom-predicate rows (with `onDelete`), and an imperative `render`-type row (escape hatch) for the existing add-predicate form, preserving its current validation UX unchanged.
- `PomodoroSettingTab` overrides `getControlValue`/`setControlValue` to bind the declarative text control to `plugin.settings.writeBackProperty`.
- `e2e/obsidian-version.json`'s pinned `appVersion` moves to `1.13.1` — required so e2e actually exercises the new API path (a pre-1.13 Obsidian binary never calls `getSettingDefinitions()`, and there's no `display()` fallback to fall back to after this change). `installerVersion` stays `"latest"` (a separate version track from `appVersion` — obsidian-launcher resolves the compatible installer automatically; hardcoding it to match `appVersion` fails with an incompatibility error).
- Adds first-ever test coverage for the settings tab: unit tests for the pure list-mapping/key-routing logic, and Playwright e2e coverage for the settings UI itself (opening the tab, editing the write-back field, adding/deleting a predicate).

## Capabilities

### New Capabilities
- `settings-tab-ui`: Declarative-API-driven behavior of `PomodoroSettingTab` — what settings are exposed, how values bind and persist, and how the custom-predicate list is added to/removed from.

### Modified Capabilities
(none — no existing spec covers the settings tab)

## Impact

- `src/settings.ts` — full rewrite of `PomodoroSettingTab`'s rendering approach; `PomodoroSettingsSchema`/`DEFAULT_SETTINGS` unchanged.
- `manifest.json` — `minAppVersion` bump.
- `e2e/obsidian-version.json` — pinned Obsidian version bump (CI's Obsidian binary cache key in `.github/workflows/ci.yml` picks this up automatically via `hashFiles`).
- New: `tests/settings-*.test.ts` (unit), `e2e/settings-tab.e2e.ts` (e2e).
- No change to `src/main.ts` (`PomodoroSettingTab` registration is unaffected) or to `FormulaPredicateSettingSchema`/predicate validation logic (`PredicateNameSchema`, `compileFormula`), which is reused as-is.
