import { Modal, Setting } from 'obsidian'
import type { App } from 'obsidian'

export type ScriptHookConfirmResult = 'confirmed' | 'cancelled'

/**
 * Reviews a script's current source before it becomes a resolvable,
 * ambiently-firing Hook -- the one-time bind-time trust gate design.md
 * requires (script-hook-source's confirmation requirement). Same
 * "Modal as an awaitable" pattern as WriteBackModal/ResetConfirmModal:
 * `waitForResult` both opens the modal and returns the one promise it will
 * ever resolve, regardless of which path (button, Escape, click-outside)
 * closes it.
 */
export class ScriptHookConfirmModal extends Modal {
  private confirmed = false
  private resolveResult: (result: ScriptHookConfirmResult) => void = () => {}

  constructor(app: App, private readonly scriptPath: string, private readonly scriptSource: string) {
    super(app)
  }

  waitForResult(): Promise<ScriptHookConfirmResult> {
    return new Promise((resolve) => {
      this.resolveResult = resolve
      this.open()
    })
  }

  onOpen(): void {
    this.setTitle(`Trust "${this.scriptPath}"?`)
    this.contentEl.createEl('p', {
      text: 'This script will run automatically on whichever phase transitions you point at it, with the same access to your device as the rest of Obsidian. Review it before confirming -- it won\'t be reviewed again unless you remove and re-add this binding.',
    })
    this.contentEl.createEl('pre', { text: this.scriptSource })

    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Trust and add').setCta().onClick(() => this.confirm()))
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
