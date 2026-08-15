import { Modal, Setting } from 'obsidian'
import type { App } from 'obsidian'

export type ResetConfirmResult = 'confirmed' | 'cancelled'

/**
 * Confirms resetting the active routine before Reset discards its progress.
 * Same "Modal as an awaitable" pattern as RoutineReplaceModal: `waitForResult`
 * both opens the modal and returns the one promise it will ever resolve,
 * regardless of which path (button, Escape, click-outside) closes it.
 */
export class ResetConfirmModal extends Modal {
  private confirmed = false
  private resolveResult: (result: ResetConfirmResult) => void = () => {}

  constructor(app: App, private readonly routineName: string) {
    super(app)
  }

  waitForResult(): Promise<ResetConfirmResult> {
    return new Promise((resolve) => {
      this.resolveResult = resolve
      this.open()
    })
  }

  onOpen(): void {
    this.modalEl.addClass('routine-reset-confirm-modal')
    this.setTitle('Reset routine?')
    this.contentEl.createEl('p', {
      text: `"${this.routineName}" will restart from the beginning and its current progress will be lost.`,
    })

    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Reset').setWarning().onClick(() => this.confirm()))
  }

  onClose(): void {
    this.contentEl.empty()
    if (!this.confirmed) {
      this.resolveResult('cancelled')
    }
  }

  private confirm(): void {
    this.confirmed = true
    this.resolveResult('confirmed')
    this.close()
  }
}
