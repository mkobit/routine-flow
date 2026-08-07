Resumed 2026-08-07 (see proposal.md "Status"). All tasks below were completed once during a 2026-07-27 implementation pass, then reverted when Obsidian 1.13.x turned out to be Insiders-beta-only. Re-implemented on resumption, extended to also cover the script-hooks settings added by #121 after this proposal was first written (design.md's "Third discovery"), and targeting `1.13.4` instead of `1.13.1` (design.md Decision 4 — `1.13.1`–`1.13.3` are still Insiders-only; only `1.13.4` is public-stable).

## 1. Manifest and e2e version floor

- [x] 1.1 Bump `manifest.json` `minAppVersion` from `1.12.7` to `1.13.4` (the actual public-stable floor — see design.md Decision 4)
- [x] 1.2 Bump `e2e/obsidian-version.json` `appVersion` to match; leave `installerVersion` as `"latest"` (obsidian-launcher resolves the compatible installer automatically — do not hardcode it to match `appVersion`, they're separate version tracks)

## 2. Rewrite RoutineFlowSettingTab

- [x] 2.1 ~~Add `getControlValue`/`setControlValue` overrides~~ — not needed: `PluginSettingTab`'s inherited defaults already read/write `this.plugin.settings[key]` and persist identically to `saveSettings()` (discovered during the 2026-07-27 pass; see design.md Decision 2 revision). `writeBackProperty` control just declares `key: 'writeBackProperty'` and relies on the inherited binding.
- [x] 2.2 Implement `getSettingDefinitions()` returning: the `writeBackProperty` text control, a `SettingDefinitionList` (heading "Custom rules") built from `formulaPredicates`, and the add-rule `render` row -- plus, extending the same pattern to the script-hooks settings added by #121 (see design.md's third discovery): a `scriptsFolder` text control (in a `type: 'group'` heading "Script hooks"), a second `SettingDefinitionList` built from `scriptHookBindings`, and the add-script-hook `render` row
- [x] 2.3 Port `renderFormulaPredicateRow`'s delete behavior into the list's `onDelete(index)`: remove from `formulaPredicates`, save, refresh `formulaPredicateRegistry`, call `this.update()`. Same for `scriptHookBindings`/`scriptHookRegistry`.
- [x] 2.4 Port `renderAddFormulaPredicateRow` into the `render`-type definition, using the `Setting` instance the framework provides instead of `new Setting(containerEl)`; keep existing `PredicateNameSchema`/`compileFormula` validation, using `Setting.setErrorMessage()` (new in 1.13.0) instead of a hand-rolled error `<div>`; on success call `this.update()` instead of `this.display()`. Same port for `renderAddScriptHookBindingRow`.
- [x] 2.5 Delete `display()` and any now-unused imperative-rendering helpers it exclusively depended on
- [x] 2.6 `bun run typecheck` and `bun run lint` clean on `src/settings.ts`

## 3. Unit tests

- [x] 3.1 Add `tests/settings-predicate-list.test.ts` covering `formulaPredicatesToListItems`: `formulaPredicates` → list-`items` mapping (name/desc shape), and `tests/settings-script-hook-list.test.ts` covering the analogous `scriptHookBindingsToListItems`. (Key-dispatch unit test dropped — no longer applicable, see 2.1. Pure logic goes in its own file per list, `src/settings-predicate-list.ts` / `src/settings-script-hook-list.ts`, since `src/settings.ts` pulls in a runtime `obsidian` import bun:test can't resolve — see design.md.)

## 4. E2E coverage

- [ ] 4.1 Add `e2e/settings-tab.e2e.ts` following the `e2e/routine-replace-modal.e2e.ts` pattern: open Obsidian's settings modal and navigate to the plugin's tab via `evaluateObsidian`/`page.locator`. `app.setting.open()`/`openTabById(id)` were already present in `e2e/obsidian-internal.d.ts`'s `SettingManager` augmentation (added earlier for `capture-screenshots.manual.ts`); no `close()` was needed.
- [ ] 4.2 E2E: editing the write-back property field persists the new value (verify via `evaluateObsidian` reading `plugin.settings.writeBackProperty`, or by reopening the tab)
- [ ] 4.3 E2E: adding a valid rule shows it in the list; adding an invalid name or non-compiling formula shows the inline error and does not add a row
- [ ] 4.4 E2E: deleting a rule removes its row

## 5. Verification and ship

- [x] 5.1 `bun run build` succeeds
- [x] 5.2 `bun run test` (unit) passes
- [ ] 5.3 `bun run test:e2e:headless` passes locally under Xvfb, including the new `settings-tab.e2e.ts`, against the freshly-pinned Obsidian binary
- [ ] 5.4 Open PR, get CI green (`gh pr checks --watch --fail-fast`), merge per AGENTS.md session-completion workflow
- [ ] 5.5 Archive this OpenSpec change (`bun x openspec archive declarative-settings-api` or equivalent) after merge
