import { Notice, setIcon } from 'obsidian'
import type { App } from 'obsidian'
import type { Phase } from '../../domain/phase/phase'
import type { TaskQueueItem } from '../../domain/queue/task-source'
import type { QueueItemAction } from '../../domain/action/queue-item-action'
import type { ApplyMutationsResult } from '../../domain/mutation/apply-mutations'
import { FOCUS_PHASE_KIND } from '../../timer/phase-graph'
import { renderStateIcon } from './state-icon'

export interface QueueActionExecutor {
  readonly executeAction: (action: QueueItemAction, targetPath?: string) => Promise<ApplyMutationsResult | null>
}

export interface QueuePanelOptions {
  readonly phase: Phase
  readonly activeFilePath: string | null
  readonly queueItems: readonly TaskQueueItem[]
  readonly app: App
  readonly actionExecutor?: QueueActionExecutor
  readonly onSelectTask: (filePath: string) => void
  readonly onOpenFile?: (filePath: string) => void
}

/**
 * Renders the work/break queue panel, item list, and action buttons.
 */
export function renderQueuePanel(queueEl: HTMLElement, options: QueuePanelOptions): void {
  queueEl.empty()
  const queueTitle = options.phase.kind === FOCUS_PHASE_KIND ? 'Work queue' : 'Break queue'
  queueEl.createEl('h3', { text: queueTitle })

  if (options.queueItems.length === 0) {
    const emptyEl = queueEl.createDiv({ cls: 'routine-queue-empty' })
    renderStateIcon(emptyEl, ['inbox', 'list-x'])
    emptyEl.createEl('p', { text: 'No notes match — check this routine\'s queue filter.' })
    return
  }

  const ul = queueEl.createEl('ul')
  for (const item of options.queueItems) {
    const li = ul.createEl('li')
    const itemRow = li.createDiv({ cls: 'routine-queue-item-row' })
    const taskBtn = itemRow.createEl('button', { cls: 'routine-task-name', text: item.displayName })

    const openFileBtn = itemRow.createEl('button', {
      cls: 'routine-open-file-btn',
      attr: { 'aria-label': `Open ${item.displayName}`, 'title': `Open ${item.displayName}` },
    })
    setIcon(openFileBtn, 'file-text')
    openFileBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (options.onOpenFile) {
        options.onOpenFile(item.sourcePath)
      }
      else {
        const file = options.app.vault.getFileByPath(item.sourcePath)
        if (file) {
          const leaf = options.app.workspace.getLeaf('tab')
          void leaf.openFile(file)
          options.app.workspace.setActiveLeaf(leaf, { focus: true })
        }
      }
    })

    if (options.activeFilePath === item.sourcePath) {
      li.addClass('is-active-task')
      if (options.phase.actions.length > 0) {
        const actionsEl = li.createDiv({ cls: 'routine-queue-actions' })
        for (const action of options.phase.actions) {
          const actionBtn = actionsEl.createEl('button', {
            cls: `routine-action-btn${action.style ? ` mod-${action.style === 'primary' ? 'cta' : action.style === 'destructive' ? 'warning' : action.style}` : ''}`,
            text: action.label,
          })
          actionBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (options.actionExecutor) {
              void (async () => {
                try {
                  const result = await options.actionExecutor?.executeAction(action, item.sourcePath)
                  if (result !== null && result !== undefined && !result.success) {
                    const causeMsg = result.cause instanceof Error ? result.cause.message : String(result.cause)
                    new Notice(`Routine Flow: action failed (${action.label}) — ${causeMsg}`)
                  }
                }
                catch (cause: unknown) {
                  const causeMsg = cause instanceof Error ? cause.message : String(cause)
                  new Notice(`Routine Flow: action failed (${action.label}) — ${causeMsg}`)
                }
              })()
            }
          })
        }
      }
    }

    taskBtn.addEventListener('click', () => {
      options.onSelectTask(item.sourcePath)
    })
  }
}
