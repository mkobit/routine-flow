import { Modal, AbstractInputSuggest } from 'obsidian'
import type { App, TFile } from 'obsidian'
import type { WriteBackFormValues, WriteBackPromptPort, WriteBackPromptResult } from '../domain/mutation/write-back-prompt'
import { coerceWriteBackValue } from '../domain/mutation/write-back-prompt'

/** Vault-wide file suggest, not limited to LogTargetResolverRegistry-resolvable paths (see design.md decision 3). */
class VaultFileSuggest extends AbstractInputSuggest<TFile> {
  getSuggestions(query: string): TFile[] {
    const q = query.trim().toLowerCase()
    return this.app.vault.getFiles().filter(file => file.path.toLowerCase().includes(q))
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path)
  }
}

/**
 * Prompts the user to confirm or edit a write-back's resolved defaults
 * before anything is applied. A `Modal` instance is single-use (can't be
 * reopened after `close()`), so `waitForResult` both opens it and returns
 * the one promise it will ever resolve — see design.md decision 2.
 */
export class WriteBackModal extends Modal {
  private submitted = false
  private resolveResult: (result: WriteBackPromptResult) => void = () => {}
  private filePath: string
  private property: string
  private rawValue: string

  constructor(app: App, defaults: WriteBackFormValues) {
    super(app)
    this.filePath = defaults.filePath
    this.property = defaults.property
    this.rawValue = String(defaults.value)
  }

  waitForResult(): Promise<WriteBackPromptResult> {
    return new Promise((resolve) => {
      this.resolveResult = resolve
      this.open()
    })
  }

  onOpen(): void {
    this.setTitle('Confirm write-back')
    this.modalEl.addClass('routine-write-back-modal')

    const sentence = this.contentEl.createEl('p', { cls: 'routine-write-back-sentence' })

    sentence.createSpan({ text: 'Write ' })
    const valueInput = sentence.createEl('input', {
      type: 'text',
      cls: 'routine-write-back-chip',
      value: this.rawValue,
      attr: { 'aria-label': 'Value' },
    })
    valueInput.addEventListener('input', () => {
      this.rawValue = valueInput.value
    })

    sentence.createSpan({ text: ' to ' })
    const propertyInput = sentence.createEl('input', {
      type: 'text',
      cls: 'routine-write-back-chip',
      value: this.property,
      attr: { 'aria-label': 'Property' },
    })
    propertyInput.addEventListener('input', () => {
      this.property = propertyInput.value
    })

    sentence.createSpan({ text: ' on ' })
    const fileInput = sentence.createEl('input', {
      type: 'text',
      cls: 'routine-write-back-chip routine-write-back-chip-file',
      value: this.filePath,
      attr: { 'aria-label': 'File' },
    })
    fileInput.addEventListener('input', () => {
      this.filePath = fileInput.value
    })
    const suggest = new VaultFileSuggest(this.app, fileInput)
    suggest.onSelect((file) => {
      fileInput.value = file.path
      this.filePath = file.path
      suggest.close()
    })

    sentence.createSpan({ text: '?' })

    const actions = this.contentEl.createDiv({ cls: 'routine-write-back-actions' })
    actions.createEl('button', { type: 'button', text: 'Cancel' })
      .addEventListener('click', () => this.close())
    actions.createEl('button', { type: 'button', cls: 'mod-cta', text: 'Submit' })
      .addEventListener('click', () => this.submit())

    // File is the highest-stakes field (design.md #6: wrong file = wrong note edited), so it
    // keeps initial focus regardless of its position in the sentence's reading order.
    fileInput.focus()
  }

  onClose(): void {
    this.contentEl.empty()
    if (!this.submitted) {
      this.resolveResult({ kind: 'cancelled' })
    }
  }

  private submit(): void {
    this.submitted = true
    this.resolveResult({
      kind: 'submitted',
      values: {
        filePath: this.filePath,
        property: this.property,
        value: coerceWriteBackValue(this.rawValue),
      },
    })
    this.close()
  }
}

/** Real, Obsidian-backed WriteBackPromptPort. Constructs a fresh WriteBackModal per call since a Modal is single-use. */
export class ObsidianWriteBackPromptPort implements WriteBackPromptPort {
  constructor(private readonly app: App) {}

  prompt(defaults: WriteBackFormValues): Promise<WriteBackPromptResult> {
    return new WriteBackModal(this.app, defaults).waitForResult()
  }
}
