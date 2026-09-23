import type { App, BasesOptions, TFile } from 'obsidian'

/**
 * Declares the Bases view options schema for RoutineTimerView.
 */
export function getViewOptions(app: App): BasesOptions[] {
  return [
    {
      key: 'focusProperty',
      type: 'property',
      displayName: 'Focus task property',
      default: 'note.type',
    },
    {
      key: 'focusValue',
      type: 'text',
      displayName: 'Focus task value',
      default: 'work',
    },
    {
      key: 'breakProperty',
      type: 'property',
      displayName: 'Break task property',
      default: 'note.type',
    },
    {
      key: 'breakValue',
      type: 'text',
      displayName: 'Break task value',
      default: 'break',
    },
    {
      key: 'routineFile',
      type: 'file',
      displayName: 'Routine file',
      filter: (file: TFile) => app.metadataCache.getFileCache(file)?.frontmatter?.['is-routine'] === true,
    },
  ]
}
