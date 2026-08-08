## Context

`RoutineFlowSettingTab` (src/settings.ts) currently implements `display()`, the deprecated imperative rendering hook for `PluginSettingTab`. It renders two things:

1. A single `Setting` text field bound to `plugin.settings.writeBackProperty`, saved via a per-control `onChange` closure.
2. A "Custom predicates" section: existing `plugin.settings.formulaPredicates` entries rendered as `Setting` rows (name/formula/delete button), followed by an always-visible "Add predicate" row with two text inputs and an Add button that validates via `PredicateNameSchema.safeParse` + `compileFormula` and shows an inline error on failure.

Obsidian 1.13.0 added a declarative alternative: `SettingTab.getSettingDefinitions()` returns a tree of `SettingDefinitionItem`s (controls, lists, groups, pages, and an imperative `render` escape hatch), plus `getControlValue(key)`/`setControlValue(key, value)` overrides for binding simple controls to storage. When `getSettingDefinitions()` returns a non-empty array, `display()` is never called — and only 1.13.0+ Obsidian even knows to call `getSettingDefinitions()` at all. The plugin is unreleased (pre-0.1.0, release-please PR #88 still open), so there is no installed base to preserve compatibility for.

## Goals / Non-Goals

**Goals:**
- Make `RoutineFlowSettingTab`'s settings appear in Obsidian's in-app settings search (the actual user-facing win `getSettingDefinitions()` provides).
- Clear the `obsidianmd/settings-tab/prefer-setting-definitions` lint warning.
- Preserve the existing add-predicate UX (two live text fields + inline validation) exactly — it's already correct and tested by hand; don't risk it on an unfamiliar API surface.
- Add real test coverage for the settings tab (currently zero, unlike most of the domain layer).

**Non-Goals:**
- Do not build a `display()` fallback for Obsidian <1.13.0. This is a one-way migration; minAppVersion moves to 1.13.1 in lockstep.
- Do not adopt `SettingDefinitionList`'s native `addItem` affordance. Its interaction shape (a `+` button invoking `action(el)`) isn't clearly specified enough in the shipped type declarations to reproduce today's UX confidently within this task's scope.
- Do not change `FormulaPredicateSettingSchema`, `PredicateNameSchema`, or `compileFormula` — validation logic is reused unchanged, just re-wired into a different rendering shell.

## Decisions

**1. Three flat declarative items, not a nested group.**
`getSettingDefinitions()` returns `SettingDefinitionItem[]` directly — no need to wrap everything in an outer `SettingDefinitionGroup`, since the array itself can mix a control, a list, and a render item as siblings. This keeps the output close to a 1:1 map of "the three things this tab renders," matching today's `display()` body structure.

**2. `writeBackProperty` becomes a keyed `control`, not a `render` — and needs no override.**
It's a single scalar string with no custom validation today, which is exactly what `SettingTextControl` + `getControlValue`/`setControlValue` was built for. Discovered during implementation: `PluginSettingTab`'s *inherited* `getControlValue`/`setControlValue` already read/write `this.plugin.settings[key]` directly and persist through the plugin's own save path — documented on the type as "Reads from `this.plugin.settings`" / "Mutates and persists `this.plugin.settings`". Since our settings object's key (`writeBackProperty`) matches the control's `key` exactly and our `saveSettings()` is just `saveData(this.settings)` (no extra side effects), the inherited default is behaviorally identical to what a hand-written override would do. No override needed — this simplifies the original plan, which assumed an explicit override.

**3. Predicate rows become a `SettingDefinitionList`; the add-row stays a `render` escape hatch.**
- List `items` are computed fresh on each `getSettingDefinitions()` call: `formulaPredicates.map(p => ({ name: p.name, desc: p.formula }))` — plain display-only entries (no `control`/`action`/`render`), matching `SettingDefinitionEmpty`.
- The list's `onDelete(index)` removes `formulaPredicates[index]`, calls `saveSettings()`, refreshes `formulaPredicateRegistry`, then calls `this.update()` (not `this.display()` — `update()` is the 1.13.0 API's structural-change hook, documented as the correct call after `items` changes shape; `refreshDomState()` is for `visible`/`disabled` predicate changes only, not structural ones).
- The add-row is a `SettingDefinitionRender` (`render: (setting, group) => void`). Its body is close to a straight port of today's `renderAddFormulaPredicateRow`: build the row via the injected `setting` (a real `Setting` instance) instead of `new Setting(containerEl)`, keep the same two text inputs, Add button, and inline error `<div>`. On success, push into `formulaPredicates`, refresh the registry, save, and call `this.update()`.

Considered and rejected: driving the add-row through `SettingDefinitionList.addItem`. Rejected because the framework's exact expectations inside `action(el)` (persistent inline form vs. transient popover vs. caller-owned modal) aren't pinned down by the type declarations, and getting it wrong risks a worse UX than what exists today for a P3 task. Revisit if a future task wants the more idiomatic list-native flow.

**4. `minAppVersion` → `1.13.4`, the actual public-stable floor, not `1.13.1`.**
Originally planned as `1.13.1` to match the pinned `obsidian@1.13.1` devDependency's type declarations (which include 1.13.1-only fields like `SettingDefinitionGroup.search`, unused here but present in the surface coded against). Discovered during resumption (2026-08-07): `1.13.1` itself is still Insiders-beta-gated — `bun x obsidian-launcher download app -v 1.13.1` (and `-v 1.13.0`/`-v 1.13.2`/`-v 1.13.3`) all fail with "Obsidian Insiders account is required," while `-v latest` resolves to `1.13.4` and downloads cleanly. Obsidian's release process evidently jumped from Insiders-only `1.13.0`–`1.13.3` betas straight to public-stable `1.13.4`. Using `minAppVersion: 1.13.1` would claim compatibility with three versions nobody can actually run outside Insiders and that this plugin has never been tested against — `1.13.4` is both the real floor and the exact version e2e now verifies against. The `obsidian@1.13.1` npm devDependency (types only) is unaffected by this — its declarations are a valid subset of `1.13.4`'s runtime API.

**5. `e2e/obsidian-version.json` bumps to `1.13.4` alongside `minAppVersion`.**
This is a hard prerequisite, not a nice-to-have: e2e drives a real, downloaded Obsidian binary (`obsidian-launcher`) at the pinned `appVersion`. At `1.12.7`, that binary predates `getSettingDefinitions()` entirely — it would keep calling (nonexistent, now-deleted) `display()`, so the new settings-tab e2e test would test nothing real. `1.13.1`–`1.13.3` are Insiders-only (see Decision 4) and can't be downloaded without credentials Mike doesn't want to set up — `1.13.4` is the actual public-stable version that both satisfies `getSettingDefinitions()` and downloads without Insiders auth. `.github/workflows/ci.yml` already keys its Obsidian binary cache on `hashFiles('bun.lock', 'e2e/obsidian-version.json')`, so bumping this file is self-contained — CI just downloads and caches a new binary.

**6. Test split: unit tests for pure logic, e2e for the actual UI.**
Per explicit user direction. Unit-testable in isolation without any Obsidian API mocking:
- `formulaPredicates` → list-`items` mapping (pure data transform).
- The `getControlValue`/`setControlValue` key-dispatch (exercised against a minimal fake settings object, not a real `Plugin`/`App`).

Not unit-testable meaningfully: whether Obsidian actually renders the declarative tree correctly, whether the settings tab shows up in search, whether clicking Add/Delete does the right thing end-to-end. That needs `e2e/settings-tab.e2e.ts`, following the existing pattern in `e2e/routine-replace-modal.e2e.ts` (`test.describe`, `evaluateObsidian()` to drive `app.setting.open()`/`openTabById()`, `page.locator()` for DOM assertions).

(Revised per Decision 2 above: since `writeBackProperty` binding needs no override, there's no custom key-dispatch logic left to unit test — only the `formulaPredicates` → list-`items` mapping remains as a pure, exported, unit-tested function.)

Second implementation discovery: `src/settings.ts` imports `PluginSettingTab` as a runtime value from `'obsidian'`, which `bun:test` cannot resolve outside the real Obsidian process — the same reason `src/views/*.ts` and `src/main.ts` have zero existing unit tests in this repo. `formulaPredicatesToListItems` was therefore extracted to a new file, `src/settings-predicate-list.ts`, whose only `obsidian` import is a type-only `SettingDefinition` (erased at compile time, so it never needs runtime resolution). `src/settings.ts` imports the function from there. This is the same pattern already used for `src/timer/formula-predicate-registry.ts` (pure logic, zero runtime `obsidian` imports, directly unit-tested) versus the Obsidian-API-bound files that consume it.

Third discovery, on 2026-08-07 resumption: this proposal/design predates `feat: script-hook execution, in-process (flow-gu1.10) (#121)` (merged 2026-07-29, two days after this change was deferred), which added a second settings-driven list to `RoutineFlowSettingTab` — `scriptsFolder` (a text field) and `scriptHookBindings` (an add/delete list under a "Script hooks" heading), structurally identical to `writeBackProperty`/`formulaPredicates` above. Removing `display()` without also converting these would silently drop that UI from the settings tab, a real regression outside this task's intent. They get the exact same treatment, no new design decisions: `scriptsFolder` is a bound text control (wrapped in a `type: 'group'` with `heading: 'Script hooks'`, since a plain control can't carry a heading on its own and a `SettingDefinitionList`'s `items` can't nest inside a `SettingDefinitionGroup`'s `items` — the two are siblings, not parent/child, in the returned array); `scriptHookBindings` is a second `SettingDefinitionList` with `onDelete`, fed by a new sibling pure-mapping file `src/settings-script-hook-list.ts` (`scriptHookBindingsToListItems`, same rationale as `formulaPredicatesToListItems`); the add-script-hook-binding row (name field, script-path field with `ScriptFileSuggest`, Add button, `ScriptHookConfirmModal` gate) stays a `render` escape hatch, same as the add-rule row.

Fourth discovery, rebasing onto `main` on 2026-08-08: `flow-gu1.19.15.4` (`#157`) merged a `progressMeterStyle` dropdown onto the still-imperative `display()` while this branch sat deferred. It's a third bound scalar control, same shape as `writeBackProperty`/`scriptsFolder`: `{ type: 'dropdown', key: 'progressMeterStyle', options: PROGRESS_METER_STYLE_LABELS }`, where `PROGRESS_METER_STYLE_LABELS` (`src/timer/progress-meter-style.ts`, already a `Record<ProgressMeterStyle, string>`) satisfies `SettingDropdownControl['options']: Record<string, string>` structurally — no new type needed. No design decision here beyond Decision 2's: the inherited `getControlValue`/`setControlValue` bind it exactly like the other two scalar controls.

Fifth discovery, writing `e2e/settings-tab.e2e.ts`: `SettingDefinitionList.onDelete`'s doc comment says it "enables Delete/Backspace keyboard shortcut" in addition to rendering a delete button per row. The button's class/aria-label isn't given in the type declarations, and this task's e2e coverage was written without a local Obsidian instance to inspect the rendered DOM against — the keyboard shortcut is the one delete affordance specified precisely enough to target without guessing.

Sixth discovery, and a correction to the above: pushing `e2e/settings-tab.e2e.ts` to CI (not a local run) revealed the real blocker, and it has nothing to do with selector accuracy. All 5 tests failed identically, 10/10 launches (initial + Playwright's built-in retry), each dying with `FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc:416` roughly two minutes after Obsidian launched — while the 5 tests immediately before and 15 immediately after (every other e2e spec) passed in 3-5s each, in the same CI run. This falsifies the assumption stated earlier in this doc's history (and in `#157`'s own e2e run, which never called `app.setting.open()`) that flow-1la's crash was WSL/local-only and wouldn't reproduce in GitHub Actions CI — it does, deterministically, specifically when `app.setting.open()` is called. Whether it's Obsidian's settings modal *in general* or specifically `RoutineFlowSettingTab`'s new `getSettingDefinitions()` render path is still unknown (see the note added to flow-1la 2026-08-08) — not investigated further here, since isolating a Chromium GPU crash under Xvfb is flow-1la's scope, not this migration's. `e2e/settings-tab.e2e.ts` is `test.describe.skip()`'d, referencing flow-1la, rather than deleted — the tests themselves are believed correct; they simply can't run in this environment yet.

## Risks / Trade-offs

- **[Risk]** The `render`-type add-row is an imperative escape hatch inside an otherwise-declarative tree — if a future Obsidian version changes how `render` interacts with `update()`/search indexing, this row won't get the declarative benefits (e.g., it won't be search-indexed, same as it isn't today). → **Mitigation**: acceptable; the add-row is an action affordance, not a piece of persisted state worth surfacing in search. The two *values it produces* (predicate name/formula) already show up in the list items above it, which are declarative and thus searchable.
- **[Risk]** Bumping `e2e/obsidian-version.json` invalidates CI's Obsidian binary cache for this PR (cold download). → **Mitigation**: one-time cost, same as the historical `1.12.7` pin bump (flow-53); no ongoing effect.
- **[Risk]** `minAppVersion` bump is technically a breaking manifest change. → **Mitigation**: plugin is unreleased; no installed base exists to break. Confirmed with the user this is acceptable pre-0.1.0.

## Migration Plan

Single PR, no staged rollout (unreleased plugin, no users):
1. Rewrite `src/settings.ts` per Decisions 1-3.
2. Bump `manifest.json` `minAppVersion` and `e2e/obsidian-version.json`.
3. Add unit tests (list-mapping, control key-dispatch) and `e2e/settings-tab.e2e.ts`.
4. `bun run typecheck && bun run lint && bun run test && bun run build`, then `bun run test:e2e` locally under Xvfb to confirm the new e2e passes against the freshly-pinned Obsidian binary before pushing.
5. Open PR, get CI green, merge.

No rollback concerns beyond a normal revert — no data migration, no persisted-settings shape change.

## Open Questions

None outstanding — all decisions above were confirmed with the user during brainstorming.
