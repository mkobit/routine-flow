Deferred (see proposal.md "Status"). All tasks below were completed once during a 2026-07-27 implementation pass, then reverted when Obsidian 1.13.x turned out to be Insiders-beta-only. Checkboxes reset to unchecked for the eventual resumption; the inline notes on 2.1 and 3.1 capture design simplifications discovered during that pass and still apply.

## 1. Manifest and e2e version floor

- [ ] 1.1 Bump `manifest.json` `minAppVersion` from `1.12.7` to `1.13.1` (or whatever the current stable floor is once 1.13.x ships)
- [ ] 1.2 Bump `e2e/obsidian-version.json` `appVersion` to match; leave `installerVersion` as `"latest"` (obsidian-launcher resolves the compatible installer automatically — do not hardcode it to match `appVersion`, they're separate version tracks)

## 2. Rewrite PomodoroSettingTab

- [ ] 2.1 ~~Add `getControlValue`/`setControlValue` overrides~~ — not needed: `PluginSettingTab`'s inherited defaults already read/write `this.plugin.settings[key]` and persist identically to `saveSettings()` (discovered during the 2026-07-27 pass; see design.md Decision 2 revision). `writeBackProperty` control just declares `key: 'writeBackProperty'` and relies on the inherited binding.
- [ ] 2.2 Implement `getSettingDefinitions()` returning: the `writeBackProperty` text control, a `SettingDefinitionList` (heading "Custom predicates") built from `formulaPredicates`, and the add-predicate `render` row
- [ ] 2.3 Port `renderFormulaPredicateRow`'s delete behavior into the list's `onDelete(index)`: remove from `formulaPredicates`, save, refresh `formulaPredicateRegistry`, call `this.update()`
- [ ] 2.4 Port `renderAddFormulaPredicateRow` into the `render`-type definition, using the `Setting` instance the framework provides instead of `new Setting(containerEl)`; keep existing `PredicateNameSchema`/`compileFormula` validation and inline error display; on success call `this.update()` instead of `this.display()`
- [ ] 2.5 Delete `display()` and any now-unused imperative-rendering helpers it exclusively depended on
- [ ] 2.6 `bun run typecheck` and `bun run lint` clean on `src/settings.ts`

## 3. Unit tests

- [ ] 3.1 Add `tests/settings-predicate-list.test.ts` covering `formulaPredicatesToListItems`: `formulaPredicates` → list-`items` mapping (name/desc shape). (Key-dispatch unit test dropped — no longer applicable, see 2.1. Pure logic goes in its own file, `src/settings-predicate-list.ts`, since `src/settings.ts` pulls in a runtime `obsidian` import bun:test can't resolve — see design.md.)

## 4. E2E coverage

- [ ] 4.1 Add `e2e/settings-tab.e2e.ts` following the `e2e/routine-replace-modal.e2e.ts` pattern: open Obsidian's settings modal and navigate to the plugin's tab via `evaluateObsidian`/`page.locator`. Note: `app.setting.open()`/`openTabById(id)`/`close()` aren't in `obsidian.d.ts` (undocumented internal API) — add them to `e2e/obsidian-internal.d.ts`'s `SettingManager` augmentation as property-signature (not method-signature) fields to satisfy `functional/prefer-property-signatures`.
- [ ] 4.2 E2E: editing the write-back property field persists the new value (verify via `evaluateObsidian` reading `plugin.settings.writeBackProperty`, or by reopening the tab)
- [ ] 4.3 E2E: adding a valid predicate shows it in the list; adding an invalid name or non-compiling formula shows the inline error and does not add a row
- [ ] 4.4 E2E: deleting a predicate removes its row

## 5. Verification and ship

- [ ] 5.1 `bun run build` succeeds
- [ ] 5.2 `bun run test` (unit) passes
- [ ] 5.3 `bun run test:e2e` passes locally under Xvfb, including the new `settings-tab.e2e.ts`, against the freshly-pinned Obsidian binary
- [ ] 5.4 Open PR, get CI green (`gh pr checks --watch --fail-fast`), merge per AGENTS.md session-completion workflow
- [ ] 5.5 Archive this OpenSpec change (`bun x openspec archive declarative-settings-api` or equivalent) after merge
