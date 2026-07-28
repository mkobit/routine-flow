import { z } from 'zod'
import type { App } from 'obsidian'
import { PluginSettingTab, Setting } from 'obsidian'
import type PomodoroPlugin from './main'
import { PredicateNameSchema } from './domain/hook/predicate'
import { compileFormula } from './domain/hook/formula/evaluator'
import type { FormulaPredicateSetting } from './timer/formula-predicate-registry'

/** A settings-authored name+formula pair for a 'custom' TransitionCondition predicate — see FormulaPredicateSetting (src/timer/formula-predicate-registry.ts), which this schema's parsed shape matches structurally. */
export const FormulaPredicateSettingSchema = z.object({
  name: PredicateNameSchema,
  formula: z.string().min(1),
})

export const PomodoroSettingsSchema = z.object({
  /** Frontmatter property to increment when a focus phase completes. */
  writeBackProperty: z.string().default('pomodoros'),
  /** Named formula-authored 'custom' TransitionCondition predicates, evaluated via MutableFormulaPredicateRegistry. */
  formulaPredicates: z.array(FormulaPredicateSettingSchema).default([]),
})

export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>

export const DEFAULT_SETTINGS: PomodoroSettings = {
  writeBackProperty: 'pomodoros',
  formulaPredicates: [],
}

export class PomodoroSettingTab extends PluginSettingTab {
  private plugin: PomodoroPlugin

  constructor(app: App, plugin: PomodoroPlugin) {
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
    const errorEl = containerEl.createDiv({ cls: 'pomodoro-formula-predicate-error' })
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
}
