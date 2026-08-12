import { z } from 'zod'
import type { App, Setting, SettingDefinitionItem, TFile } from 'obsidian'
import { AbstractInputSuggest, Notice, PluginSettingTab } from 'obsidian'
import type RoutineFlowPlugin from './main'
import { PredicateNameSchema } from './domain/hook/predicate'
import { compileFormula } from './domain/hook/formula/evaluator'
import { formulaPredicatesToListItems } from './settings-predicate-list'
import { HookNameSchema } from './domain/hook/hook-reference'
import { scriptHookBindingsToListItems } from './settings-script-hook-list'
import { ScriptHookConfirmModal } from './views/script-hook-confirm-modal'
import { PROGRESS_METER_STYLE_LABELS, ProgressMeterStyleSchema } from './timer/progress-meter-style'

/** A settings-authored name+formula pair for a 'custom' TransitionCondition predicate — see FormulaPredicateSetting (src/timer/formula-predicate-registry.ts), which this schema's parsed shape matches structurally. */
export const FormulaPredicateSettingSchema = z.object({
  name: PredicateNameSchema,
  formula: z.string().min(1),
})

/** A settings-authored name+script pair — see ScriptHookBindingSetting (src/timer/script-hook-registry.ts), which this schema's parsed shape matches structurally. */
export const ScriptHookBindingSettingSchema = z.object({
  name: HookNameSchema,
  scriptPath: z.string().min(1),
  scriptSource: z.string(),
})

export const RoutineFlowSettingsSchema = z.object({
  /** Frontmatter property to increment when a focus phase completes. */
  writeBackProperty: z.string().default('sessions'),
  /** Active built-in progress-meter visualization for the timer panel's dial (see flow-gu1.19.15 family). */
  progressMeterStyle: ProgressMeterStyleSchema.default('radial'),
  /** Named formula-authored 'custom' TransitionCondition predicates, evaluated via MutableFormulaPredicateRegistry. */
  formulaPredicates: z.array(FormulaPredicateSettingSchema).default([]),
  /** Vault folder .js script hooks are selected from — see script-hook-source. */
  scriptsFolder: z.string().default(''),
  /** Named, bind-time-confirmed script-hook bindings, resolved via MutableScriptHookRegistry. */
  scriptHookBindings: z.array(ScriptHookBindingSettingSchema).default([]),
})

export type RoutineFlowSettings = z.infer<typeof RoutineFlowSettingsSchema>

export const DEFAULT_SETTINGS: RoutineFlowSettings = {
  writeBackProperty: 'sessions',
  progressMeterStyle: 'radial',
  formulaPredicates: [],
  scriptsFolder: '',
  scriptHookBindings: [],
}

/** Suggests `.js` files directly inside the configured scripts folder — not vault-wide, and not nested subfolders (see script-hook-source's "directly inside" requirement). */
class ScriptFileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, inputEl: HTMLInputElement, private readonly getFolder: () => string) {
    super(app, inputEl)
  }

  getSuggestions(query: string): TFile[] {
    const folder = this.getFolder().trim()
    const q = query.trim().toLowerCase()
    return this.app.vault.getFiles().filter(file =>
      file.extension === 'js'
      && file.parent?.path === folder
      && file.path.toLowerCase().includes(q))
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path)
  }
}

export class RoutineFlowSettingTab extends PluginSettingTab {
  private plugin: RoutineFlowPlugin

  constructor(app: App, plugin: RoutineFlowPlugin) {
    super(app, plugin)
    this.plugin = plugin
    this.containerEl.addClass('routine-setting-tab')
  }

  /**
   * Declarative replacement for the deprecated imperative display() — see
   * openspec/changes/declarative-settings-api/design.md. writeBackProperty/
   * progressMeterStyle/scriptsFolder bind through PluginSettingTab's
   * inherited getControlValue/setControlValue (no override needed: both
   * already read/write this.plugin.settings[key]). The two add-rows stay
   * imperative `render` escape hatches so their existing two-field-plus-
   * validation UX carries over unchanged.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'Write-back property',
        desc: 'Frontmatter property incremented when a focus phase completes.',
        control: {
          type: 'text',
          key: 'writeBackProperty',
          placeholder: 'Property name',
        },
      },
      {
        name: 'Progress meter style',
        desc: 'Visual style for the timer panel\'s progress meter.',
        control: {
          type: 'dropdown',
          key: 'progressMeterStyle',
          options: PROGRESS_METER_STYLE_LABELS,
        },
      },
      {
        type: 'list',
        heading: 'Custom predicates',
        items: formulaPredicatesToListItems(this.plugin.settings.formulaPredicates),
        onDelete: (index: number): void => {
          void this.deleteFormulaPredicate(index)
        },
      },
      {
        name: 'Add custom predicate',
        desc: 'Name and condition (e.g. visitCounts.focus >= 4) for a new transition condition predicate.',
        render: (setting): void => {
          this.renderAddFormulaPredicateRow(setting)
        },
      },
      {
        type: 'group',
        heading: 'Script hooks',
        items: [
          {
            name: 'Scripts folder',
            desc: 'Vault folder to select .js script hooks from. A script becomes usable once bound below.',
            control: {
              type: 'text',
              key: 'scriptsFolder',
              placeholder: 'Scripts',
            },
          },
        ],
      },
      {
        type: 'list',
        items: scriptHookBindingsToListItems(this.plugin.settings.scriptHookBindings, (index: number) => {
          void this.reconfirmScriptHookBinding(index)
        }),
        onDelete: (index: number): void => {
          void this.deleteScriptHookBinding(index)
        },
      },
      {
        name: 'Add script hook',
        desc: 'Name it, then pick a .js file from the scripts folder above -- referenced from a routine\'s onEnter/onComplete/onSkip/onExit by this name, the same way the built-in write-back hook is.',
        render: (setting): void => {
          this.renderAddScriptHookBindingRow(setting)
        },
      },
    ]
  }

  /** Refreshes the plugin's live MutableFormulaPredicateRegistry from the current settings list, then re-renders this tab's declarative definitions. */
  private async saveAndRefreshFormulaPredicates(): Promise<void> {
    await this.plugin.saveSettings()
    this.plugin.formulaPredicateRegistry.setFormulas(this.plugin.settings.formulaPredicates)
    this.update()
  }

  private async deleteFormulaPredicate(index: number): Promise<void> {
    this.plugin.settings.formulaPredicates = this.plugin.settings.formulaPredicates.filter((_, i) => i !== index)
    await this.saveAndRefreshFormulaPredicates()
  }

  private renderAddFormulaPredicateRow(setting: Setting): void {
    setting.settingEl.addClass('routine-setting-add-row')
    let name = ''
    let formula = ''

    setting
      .addText(text =>
        text
          .setPlaceholder('Name')
          .onChange((value) => {
            name = value
          }),
      )
      .addText(text =>
        text
          .setPlaceholder('Condition')
          .onChange((value) => {
            formula = value
          }),
      )
      .addButton(button =>
        button
          .setButtonText('Add')
          .setCta()
          .onClick(async () => {
            setting.setErrorMessage(null)
            const parsedName = PredicateNameSchema.safeParse(name)
            if (!parsedName.success) {
              setting.setErrorMessage('Enter a predicate name.')
              return
            }
            const compiled = compileFormula(formula)
            if (!compiled.ok) {
              setting.setErrorMessage(compiled.error)
              return
            }
            this.plugin.settings.formulaPredicates = [
              ...this.plugin.settings.formulaPredicates.filter(p => p.name !== parsedName.data),
              { name: parsedName.data, formula },
            ]
            await this.saveAndRefreshFormulaPredicates()
          }),
      )
  }

  /** Refreshes the plugin's live MutableScriptHookRegistry from the current settings list, then re-renders this tab's declarative definitions. */
  private async saveAndRefreshScriptHookBindings(): Promise<void> {
    await this.plugin.saveSettings()
    this.plugin.scriptHookRegistry.setBindings(this.plugin.settings.scriptHookBindings)
    this.update()
  }

  private async deleteScriptHookBinding(index: number): Promise<void> {
    this.plugin.settings.scriptHookBindings = this.plugin.settings.scriptHookBindings.filter((_, i) => i !== index)
    await this.saveAndRefreshScriptHookBindings()
  }

  private async reconfirmScriptHookBinding(index: number): Promise<void> {
    const binding = this.plugin.settings.scriptHookBindings[index]
    if (!binding) {
      return
    }
    const file = this.app.vault.getFileByPath(binding.scriptPath)
    if (file === null || file.extension !== 'js' || file.parent?.path !== this.plugin.settings.scriptsFolder.trim()) {
      new Notice(`Routine Flow: script file "${binding.scriptPath}" not found in scripts folder.`)
      return
    }
    const latestScriptSource = await this.app.vault.cachedRead(file)
    const result = await new ScriptHookConfirmModal(this.app, binding.scriptPath, latestScriptSource).waitForResult()
    if (result === 'cancelled') {
      return
    }
    this.plugin.settings.scriptHookBindings = this.plugin.settings.scriptHookBindings.map((b, i) =>
      i === index ? { name: b.name, scriptPath: b.scriptPath, scriptSource: latestScriptSource } : b,
    )
    await this.saveAndRefreshScriptHookBindings()
  }

  private renderAddScriptHookBindingRow(setting: Setting): void {
    setting.settingEl.addClass('routine-setting-add-row')
    let name = ''
    let scriptPath = ''

    setting
      .addText(text =>
        text
          .setPlaceholder('Name')
          .onChange((value) => {
            name = value
          }),
      )
      .addText((text) => {
        text
          .setPlaceholder('Script path')
          .onChange((value) => {
            scriptPath = value
          })
        const suggest = new ScriptFileSuggest(this.app, text.inputEl, () => this.plugin.settings.scriptsFolder)
        suggest.onSelect((file) => {
          text.setValue(file.path)
          scriptPath = file.path
          suggest.close()
        })
      })
      .addButton(button =>
        button
          .setButtonText('Add')
          .setCta()
          .onClick(async () => {
            setting.setErrorMessage(null)
            const parsedName = HookNameSchema.safeParse(name)
            if (!parsedName.success) {
              setting.setErrorMessage('Enter a hook name.')
              return
            }
            const file = this.app.vault.getFileByPath(scriptPath)
            if (file === null || file.extension !== 'js' || file.parent?.path !== this.plugin.settings.scriptsFolder.trim()) {
              setting.setErrorMessage('Pick a .js file from the scripts folder above.')
              return
            }
            const scriptSource = await this.app.vault.cachedRead(file)
            const result = await new ScriptHookConfirmModal(this.app, scriptPath, scriptSource).waitForResult()
            if (result === 'cancelled') {
              return
            }
            this.plugin.settings.scriptHookBindings = [
              ...this.plugin.settings.scriptHookBindings.filter(b => b.name !== parsedName.data),
              { name: parsedName.data, scriptPath, scriptSource },
            ]
            await this.saveAndRefreshScriptHookBindings()
          }),
      )
  }
}
