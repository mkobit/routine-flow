import { z } from 'zod'
import type { App, TFile } from 'obsidian'
import { AbstractInputSuggest, PluginSettingTab, Setting } from 'obsidian'
import type RoutineFlowPlugin from './main'
import { PredicateNameSchema } from './domain/hook/predicate'
import { compileFormula } from './domain/hook/formula/evaluator'
import type { FormulaPredicateSetting } from './timer/formula-predicate-registry'
import { HookNameSchema } from './domain/hook/hook-reference'
import type { ScriptHookBindingSetting } from './timer/script-hook-registry'
import { ScriptHookConfirmModal } from './views/script-hook-confirm-modal'

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
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Write-back property')
      .setDesc('Frontmatter property incremented when a focus phase completes.')
      .addText(text =>
        text
          .setPlaceholder('Property name')
          .setValue(this.plugin.settings.writeBackProperty)
          .onChange(async (value) => {
            this.plugin.settings.writeBackProperty = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl).setName('Custom rules').setHeading()

    for (const predicate of this.plugin.settings.formulaPredicates) {
      this.renderFormulaPredicateRow(containerEl, predicate)
    }

    this.renderAddFormulaPredicateRow(containerEl)

    new Setting(containerEl).setName('Script hooks').setHeading()

    new Setting(containerEl)
      .setName('Scripts folder')
      .setDesc('Vault folder to select .js script hooks from. A script becomes usable once bound below.')
      .addText(text =>
        text
          .setPlaceholder('Scripts')
          .setValue(this.plugin.settings.scriptsFolder)
          .onChange(async (value) => {
            this.plugin.settings.scriptsFolder = value
            await this.plugin.saveSettings()
          }),
      )

    for (const binding of this.plugin.settings.scriptHookBindings) {
      this.renderScriptHookBindingRow(containerEl, binding)
    }

    this.renderAddScriptHookBindingRow(containerEl)
  }

  /** Refreshes the plugin's live MutableFormulaPredicateRegistry from the current settings list, then re-renders this tab. */
  private async saveAndRefreshFormulaPredicates(): Promise<void> {
    await this.plugin.saveSettings()
    this.plugin.formulaPredicateRegistry.setFormulas(this.plugin.settings.formulaPredicates)
    this.display()
  }

  private renderFormulaPredicateRow(containerEl: HTMLElement, predicate: FormulaPredicateSetting): void {
    new Setting(containerEl)
      .setName(predicate.name)
      .setDesc(predicate.formula)
      .addExtraButton(button =>
        button
          .setIcon('trash')
          .setTooltip('Remove rule')
          .onClick(async () => {
            this.plugin.settings.formulaPredicates = this.plugin.settings.formulaPredicates.filter(p => p.name !== predicate.name)
            await this.saveAndRefreshFormulaPredicates()
          }),
      )
  }

  private renderAddFormulaPredicateRow(containerEl: HTMLElement): void {
    let name = ''
    let formula = ''
    const errorEl = containerEl.createDiv({ cls: 'routine-formula-predicate-error' })
    errorEl.hide()

    new Setting(containerEl)
      .setName('Add rule')
      .setDesc('Name and condition (e.g. visitCounts.focus >= 4) for a new custom rule.')
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
            errorEl.hide()
            const parsedName = PredicateNameSchema.safeParse(name)
            if (!parsedName.success) {
              errorEl.setText('Enter a rule name.')
              errorEl.show()
              return
            }
            const compiled = compileFormula(formula)
            if (!compiled.ok) {
              errorEl.setText(compiled.error)
              errorEl.show()
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

  /** Refreshes the plugin's live MutableScriptHookRegistry from the current settings list, then re-renders this tab. */
  private async saveAndRefreshScriptHookBindings(): Promise<void> {
    await this.plugin.saveSettings()
    this.plugin.scriptHookRegistry.setBindings(this.plugin.settings.scriptHookBindings)
    this.display()
  }

  private renderScriptHookBindingRow(containerEl: HTMLElement, binding: ScriptHookBindingSetting): void {
    new Setting(containerEl)
      .setName(binding.name)
      .setDesc(binding.scriptPath)
      .addExtraButton(button =>
        button
          .setIcon('trash')
          .setTooltip('Remove binding')
          .onClick(async () => {
            this.plugin.settings.scriptHookBindings = this.plugin.settings.scriptHookBindings.filter(b => b.name !== binding.name)
            await this.saveAndRefreshScriptHookBindings()
          }),
      )
  }

  private renderAddScriptHookBindingRow(containerEl: HTMLElement): void {
    let name = ''
    let scriptPath = ''
    const errorEl = containerEl.createDiv({ cls: 'routine-script-hook-error' })
    errorEl.hide()

    new Setting(containerEl)
      .setName('Add script hook')
      .setDesc('Name it, then pick a .js file from the scripts folder above -- referenced from a routine\'s onEnter/onComplete/onSkip/onExit by this name, the same way the built-in write-back hook is.')
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
            errorEl.hide()
            const parsedName = HookNameSchema.safeParse(name)
            if (!parsedName.success) {
              errorEl.setText('Enter a hook name.')
              errorEl.show()
              return
            }
            const file = this.app.vault.getFileByPath(scriptPath)
            if (file === null || file.extension !== 'js' || file.parent?.path !== this.plugin.settings.scriptsFolder.trim()) {
              errorEl.setText('Pick a .js file from the scripts folder above.')
              errorEl.show()
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
