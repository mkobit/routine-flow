import { Setting } from 'obsidian'
import type { App, BasesViewConfig } from 'obsidian'
import { renderStateIcon } from './state-icon'

export interface ConfigBarOptions {
  readonly isConfigOpen: boolean
  readonly onToggle: () => void
}

export interface ConfigPanelOptions {
  readonly app: App
  readonly config?: BasesViewConfig
  readonly configuredRoutinePath: string | null
  readonly onRoutineFileChange: (path: string | null) => Promise<void> | void
  readonly onFilterConfigChange: () => void
}

/**
 * Renders the toggle bar for the routine view configuration panel.
 */
export function renderConfigBar(parent: HTMLElement, options: ConfigBarOptions): HTMLElement {
  const configBar = parent.createDiv({ cls: 'routine-config-bar' })
  const configToggleBtn = configBar.createEl('button', {
    cls: `clickable-icon routine-config-toggle-btn${options.isConfigOpen ? ' is-active' : ''}`,
    attr: {
      'aria-label': 'Configure view options',
      'title': 'Configure view options',
    },
  })
  renderStateIcon(configToggleBtn, ['settings', 'gear', 'sliders-horizontal'])
  configToggleBtn.addEventListener('click', () => {
    options.onToggle()
  })
  return configBar
}

/**
 * Renders the configuration panel with routine file dropdown and filter property inputs.
 */
export function renderConfigPanel(parent: HTMLElement, options: ConfigPanelOptions): HTMLElement {
  const panel = parent.createDiv({ cls: 'routine-config-panel' })

  const routineFiles = options.app.vault.getMarkdownFiles().filter((file) => {
    return options.app.metadataCache.getFileCache(file)?.frontmatter?.['is-routine'] === true
  })
  const configuredPath = options.configuredRoutinePath

  new Setting(panel)
    .setClass('routine-config-routine-file')
    .setName('Routine file')
    .setDesc('Select routine definition file')
    .addDropdown((dropdown) => {
      dropdown.addOption('', '(Default routine)')
      for (const file of routineFiles) {
        dropdown.addOption(file.path, file.basename)
      }
      if (configuredPath !== null && !routineFiles.some(f => f.path === configuredPath)) {
        dropdown.addOption(configuredPath, configuredPath)
      }
      dropdown.setValue(configuredPath ?? '')
      dropdown.onChange((value) => {
        const newPath = value.trim().length > 0 ? value.trim() : null
        options.config?.set('routineFile', newPath)
        void options.onRoutineFileChange(newPath)
      })
    })

  new Setting(panel)
    .setClass('routine-config-focus-prop')
    .setName('Focus task property')
    .setDesc('Frontmatter property used to filter focus queue')
    .addText((text) => {
      text.setPlaceholder('note.type')
      const raw = options.config?.get('focusProperty')
      text.setValue(typeof raw === 'string' ? raw : '')
      text.onChange((value) => {
        const val = value.trim()
        options.config?.set('focusProperty', val.length > 0 ? val : null)
        options.onFilterConfigChange()
      })
    })

  new Setting(panel)
    .setClass('routine-config-focus-val')
    .setName('Focus task value')
    .setDesc('Matching property value for focus queue')
    .addText((text) => {
      text.setPlaceholder('Work')
      const raw = options.config?.get('focusValue')
      text.setValue(typeof raw === 'string' ? raw : '')
      text.onChange((value) => {
        const val = value.trim()
        options.config?.set('focusValue', val.length > 0 ? val : null)
        options.onFilterConfigChange()
      })
    })

  new Setting(panel)
    .setClass('routine-config-break-prop')
    .setName('Break task property')
    .setDesc('Frontmatter property used to filter break queue')
    .addText((text) => {
      text.setPlaceholder('note.type')
      const raw = options.config?.get('breakProperty')
      text.setValue(typeof raw === 'string' ? raw : '')
      text.onChange((value) => {
        const val = value.trim()
        options.config?.set('breakProperty', val.length > 0 ? val : null)
        options.onFilterConfigChange()
      })
    })

  new Setting(panel)
    .setClass('routine-config-break-val')
    .setName('Break task value')
    .setDesc('Matching property value for break queue')
    .addText((text) => {
      text.setPlaceholder('Break')
      const raw = options.config?.get('breakValue')
      text.setValue(typeof raw === 'string' ? raw : '')
      text.onChange((value) => {
        const val = value.trim()
        options.config?.set('breakValue', val.length > 0 ? val : null)
        options.onFilterConfigChange()
      })
    })

  return panel
}
