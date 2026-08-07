import type { SettingDefinition } from 'obsidian'
import type { FormulaPredicateSetting } from './timer/formula-predicate-registry'

/**
 * Maps settings-authored formula predicates to declarative SettingDefinitionList
 * items -- name/formula become name/desc, both display-only (no
 * control/action/render), matching SettingDefinitionEmpty. Kept in its own
 * module, whose only 'obsidian' import is this type (erased at compile time):
 * src/settings.ts pulls in PluginSettingTab as a runtime value, which bun:test
 * can't resolve outside the real Obsidian process, so this pure mapping logic
 * lives here instead, where it's unit-testable.
 */
// Obsidian's own SettingDefinitionList['items'] type is a mutable array (not
// readonly), so this return type matches it exactly rather than fighting the
// external interface with a readonly wrapper the caller would just have to
// unwrap again.
export function formulaPredicatesToListItems(formulaPredicates: readonly FormulaPredicateSetting[]): SettingDefinition[] {
  return formulaPredicates.map(predicate => ({
    name: predicate.name,
    desc: predicate.formula,
  }))
}
