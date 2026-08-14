import { ItemView, Notice } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import { findNextPhase, findPhaseById, FOCUS_PHASE_KIND } from '../timer/phase-graph'
import { formatPhaseHeader } from '../timer/format'
import { ResetConfirmModal } from './reset-confirm-modal'

export const SIDE_PANEL_VIEW_TYPE = 'routine-side-panel'

/**
 * Workspace-wide side panel mirroring the shared EngineStore, closer to
 * RoutineTimerView's fidelity (phase + controls + queue) than the status
 * bar item, but not bound to any leaf's routineFile -- no viewGraph, no
 * Start button, no routine-selection UI (see design.md's Decisions).
 */
export class RoutineSidePanelView extends ItemView {
  private unsubscribe: (() => void) | null = null

  constructor(leaf: WorkspaceLeaf, private readonly plugin: RoutineFlowPlugin) {
    super(leaf)
  }

  getViewType(): string {
    return SIDE_PANEL_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Routine panel'
  }

  getIcon(): string {
    return 'timer'
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('routine-side-panel')
    this.unsubscribe = this.plugin.store.subscribe(state => this.render(state))
    this.render(this.plugin.store.getState())
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private render(state: EngineState): void {
    this.contentEl.empty()

    if (state.status === 'stopped') {
      this.contentEl.createEl('p', { text: 'No routine is running. Start one from a Bases timer view.' })
      return
    }

    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase) {
      return
    }

    if (graph.cssClass) {
      this.contentEl.addClass(graph.cssClass)
    }
    if (phase.cssClass) {
      this.contentEl.addClass(phase.cssClass)
    }

    this.contentEl.createEl('h2', { text: formatPhaseHeader(phase, state.remaining, state.status) })

    const nextPhase = findNextPhase(graph, state, this.plugin.formulaPredicateRegistry)
    if (nextPhase !== undefined) {
      const nextPhaseEl = this.contentEl.createDiv({ cls: 'routine-next-phase' })
      nextPhaseEl.createSpan({ text: `Next: ${nextPhase.label}` })
    }

    const controls = this.contentEl.createDiv({ cls: 'routine-controls' })

    if (state.status === 'running') {
      const pauseBtn = controls.createEl('button', { text: 'Pause' })
      pauseBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'pause' }))
    }
    else {
      const resumeBtn = controls.createEl('button', { text: 'Resume' })
      resumeBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'resume' }))
    }

    if (state.status === 'running' && state.remaining === null) {
      const doneBtn = controls.createEl('button', { text: 'Done' })
      doneBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'finish-phase' }))
    }

    // status is only ever 'completed' for a manualClear-policy phase (every other policy advances
    // immediately) -- without this, such a phase has no reachable UI path past it (flow-039).
    if (state.status === 'completed') {
      const clearBtn = controls.createEl('button', { text: 'Clear' })
      clearBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'advance-phase' }))
    }

    const resetBtn = controls.createEl('button', { text: 'Reset' })
    resetBtn.addEventListener('click', () => void this.handleReset(graph.name))

    const speedEl = controls.createEl('select', { cls: 'routine-speed-select' })
    const speedOptions = [
      { value: '1', label: '1x' },
      { value: '2', label: '2x' },
      { value: '5', label: '5x' },
      { value: '10', label: '10x' },
      { value: '60', label: '60x' },
    ]
    for (const opt of speedOptions) {
      const option = speedEl.createEl('option', { value: opt.value, text: opt.label })
      if (Number(opt.value) === this.plugin.settings.clockSpeedMultiplier) {
        option.selected = true
      }
    }
    speedEl.addEventListener('change', () => {
      const mult = Number(speedEl.value) || 1
      this.plugin.settings.clockSpeedMultiplier = mult
      this.plugin.ticker.restart()
      void this.plugin.saveSettings()
    })

    // A phase with no taskSourceId has no queue at all (e.g. a rep-based workout phase).
    if (phase.taskSourceId === null) {
      return
    }

    const queueTitle = phase.kind === FOCUS_PHASE_KIND ? 'Work queue' : 'Break queue'
    const queueItems = this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? []

    const queueEl = this.contentEl.createDiv({ cls: 'routine-queue' })
    queueEl.createEl('h3', { text: queueTitle })

    if (queueItems.length === 0) {
      queueEl.createEl('p', { text: 'No tasks found.' })
      return
    }

    const ul = queueEl.createEl('ul')
    for (const item of queueItems) {
      const li = ul.createEl('li')
      const taskBtn = li.createEl('button', { text: item.displayName })
      if (state.activeFilePath === item.sourcePath) {
        li.addClass('is-active-task')
        if (phase.actions.length > 0) {
          const actionsEl = li.createDiv({ cls: 'routine-queue-actions' })
          for (const action of phase.actions) {
            const actionBtn = actionsEl.createEl('button', {
              cls: `routine-action-btn${action.style ? ` mod-${action.style === 'primary' ? 'cta' : action.style === 'destructive' ? 'warning' : action.style}` : ''}`,
              text: action.label,
            })
            actionBtn.addEventListener('click', (e) => {
              e.stopPropagation()
              void (async () => {
                try {
                  const result = await this.plugin.store.executeAction(action)
                  if (result !== null && !result.success) {
                    const causeMsg = result.cause instanceof Error ? result.cause.message : String(result.cause)
                    new Notice(`Routine Flow: action failed (${action.label}) — ${causeMsg}`)
                  }
                }
                catch (cause: unknown) {
                  const causeMsg = cause instanceof Error ? cause.message : String(cause)
                  new Notice(`Routine Flow: action failed (${action.label}) — ${causeMsg}`)
                }
              })()
            })
          }
        }
      }
      taskBtn.addEventListener('click', () => {
        void this.plugin.store.dispatch({ type: 'start', filePath: item.sourcePath })
      })
    }
  }

  private async handleReset(routineName: string): Promise<void> {
    const result = await new ResetConfirmModal(this.plugin.app, routineName).waitForResult()
    if (result !== 'confirmed') {
      return
    }
    void this.plugin.store.dispatch({ type: 'stop' })
  }
}
