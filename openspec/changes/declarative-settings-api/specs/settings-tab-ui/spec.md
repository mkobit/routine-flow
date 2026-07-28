## ADDED Requirements

### Requirement: Write-back property is a bound, searchable control
`RoutineFlowSettingTab` SHALL expose `writeBackProperty` as a declarative text control (via `getSettingDefinitions()`), bound to `plugin.settings.writeBackProperty` through `getControlValue`/`setControlValue`, so it is indexed by Obsidian's in-app settings search.

#### Scenario: Editing the write-back property persists it
- **WHEN** a user changes the "Write-back property" field's value in the settings tab
- **THEN** `plugin.settings.writeBackProperty` is updated to the new value and `plugin.saveSettings()` is called

### Requirement: Custom predicates render as a declarative, deletable list
`RoutineFlowSettingTab` SHALL render `plugin.settings.formulaPredicates` as a `SettingDefinitionList`, with each entry showing the predicate's name and formula, and a delete affordance that removes the entry.

#### Scenario: Deleting a predicate removes it and refreshes the registry
- **WHEN** a user deletes a custom-predicate row for predicate `P`
- **THEN** `P` is removed from `plugin.settings.formulaPredicates`, `plugin.saveSettings()` is called, `plugin.formulaPredicateRegistry` is refreshed with the remaining predicates, and the settings tab re-renders to reflect the removal

### Requirement: Adding a custom predicate validates name and formula before persisting
`RoutineFlowSettingTab` SHALL provide an always-visible add-predicate row (name field, formula field, Add button) that validates the name against `PredicateNameSchema` and the formula via `compileFormula` before appending to `plugin.settings.formulaPredicates`, showing an inline error and not persisting anything on validation failure.

#### Scenario: Adding a valid predicate
- **WHEN** a user enters a valid name and a formula that compiles, then clicks Add
- **THEN** the predicate is appended to `plugin.settings.formulaPredicates`, `plugin.saveSettings()` is called, `plugin.formulaPredicateRegistry` is refreshed, the new predicate appears in the list, and no error message is shown

#### Scenario: Rejecting an invalid predicate name
- **WHEN** a user leaves the name field empty (or otherwise fails `PredicateNameSchema`) and clicks Add
- **THEN** no predicate is added, `plugin.saveSettings()` is not called, and an inline error message is shown

#### Scenario: Rejecting a formula that fails to compile
- **WHEN** a user enters a valid name but a formula that `compileFormula` rejects, and clicks Add
- **THEN** no predicate is added, `plugin.saveSettings()` is not called, and an inline error message describing the compile failure is shown

### Requirement: Settings tab requires the declarative settings API, with no legacy fallback
`RoutineFlowSettingTab` SHALL implement `getSettingDefinitions()` as its only rendering path and SHALL NOT implement `display()`. `manifest.json`'s `minAppVersion` SHALL be set to at least the Obsidian version required by `getSettingDefinitions()`.

#### Scenario: Settings tab is not rendered on pre-1.13.0 Obsidian
- **WHEN** the plugin is loaded on an Obsidian version older than `manifest.json`'s `minAppVersion`
- **THEN** Obsidian itself refuses to load the plugin (per its own `minAppVersion` enforcement), so `RoutineFlowSettingTab` is never instantiated
