import { FuzzySuggestModal } from 'obsidian'
import type { App, TFile } from 'obsidian'

export type RoutinePickerChoice =
  | { readonly kind: 'default', readonly label: string }
  | { readonly kind: 'file', readonly label: string, readonly file: TFile }

/**
 * Prompts the user to pick a routine definition (or the built-in default)
 * when starting a routine from a task note's file menu.
 */
export class RoutinePickerModal extends FuzzySuggestModal<RoutinePickerChoice> {
  private readonly choices: readonly RoutinePickerChoice[]
  private readonly onPick: (choice: RoutinePickerChoice) => void

  constructor(app: App, routineFiles: readonly TFile[], onPick: (choice: RoutinePickerChoice) => void) {
    super(app)
    this.setPlaceholder('Choose a routine to start…')
    this.choices = [
      { kind: 'default', label: 'Default routine' },
      ...routineFiles.map(file => ({ kind: 'file' as const, label: file.basename, file })),
    ]
    this.onPick = onPick
  }

  getItems(): RoutinePickerChoice[] {
    return [...this.choices]
  }

  getItemText(item: RoutinePickerChoice): string {
    return item.label
  }

  onChooseItem(item: RoutinePickerChoice): void {
    this.onPick(item)
  }
}
