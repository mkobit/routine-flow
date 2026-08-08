import type { SettingDefinition } from 'obsidian'
import type { ScriptHookBindingSetting } from './timer/script-hook-registry'

/**
 * Maps settings-authored script-hook bindings to declarative
 * SettingDefinitionList items -- name/scriptPath become name/desc, both
 * display-only (no control/action/render), matching SettingDefinitionEmpty.
 * Same rationale and file split as settings-predicate-list.ts's
 * formulaPredicatesToListItems -- script-hook bindings (flow-gu1.10) were
 * added to the settings tab after this file's sibling was designed, but
 * follow the identical settings-driven-list shape, so get the same treatment.
 */
// See settings-predicate-list.ts's formulaPredicatesToListItems for why this
// returns a mutable array: it matches Obsidian's own SettingDefinitionList['items'] type.
export function scriptHookBindingsToListItems(bindings: readonly ScriptHookBindingSetting[]): SettingDefinition[] {
  return bindings.map(binding => ({
    name: binding.name,
    desc: binding.scriptPath,
  }))
}
