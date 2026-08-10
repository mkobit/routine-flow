import type { Setting, SettingDefinition } from 'obsidian'
import type { ScriptHookBindingSetting } from './timer/script-hook-registry'

/**
 * Maps settings-authored script-hook bindings to declarative
 * SettingDefinitionList items -- name/scriptPath become name/desc.
 * When onReconfirm is provided, a re-confirm extra button is attached to the setting item.
 */
export function scriptHookBindingsToListItems(
  bindings: readonly ScriptHookBindingSetting[],
  onReconfirm?: (index: number) => void,
): SettingDefinition[] {
  return bindings.map((binding, index) => {
    if (!onReconfirm) {
      return {
        name: binding.name,
        desc: binding.scriptPath,
      }
    }
    return {
      name: binding.name,
      desc: binding.scriptPath,
      render: (setting: Setting): void => {
        setting.addExtraButton(button =>
          button
            .setIcon('refresh-cw')
            .setTooltip('Re-confirm script content')
            .onClick(() => {
              onReconfirm(index)
            }),
        )
      },
    }
  })
}
