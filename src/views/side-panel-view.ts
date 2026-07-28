import { ItemView } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import type PomodoroPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import { findPhaseById, FOCUS_PHASE_KIND } from '../timer/phase-graph'
import { formatPhaseHeader } from '../timer/format'
import { ResetConfirmModal } from './reset-confirm-modal'

export const SIDE_PANEL_VIEW_TYPE = 'pomodoro-side-panel'

/**
 * Workspace-wide side panel mirroring the shared EngineStore, closer to
 * PomodoroTimerView's fidelity (phase + controls + queue) than the status
 * bar item, but not bound to any leaf's routineFile -- no viewGraph, no
 * Start button, no routine-selection UI (see design.md's Decisions).
 */
export class PomodoroSidePanelView extends ItemView {
  private unsubscribe: (() => void) | null = null

  constructor(leaf: WorkspaceLeaf, private readonly plugin: PomodoroPlugin) {
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
    this.contentEl.addClass('pomodoro-side-panel')
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

    this.contentEl.createEl('h2', { text: formatPhaseHeader(phase, state.remaining, state.status) })

    const controls = this.contentEl.createDiv({ cls: 'pomodoro-controls' })

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

    const resetBtn = controls.createEl('button', { text: 'Reset' })
    resetBtn.addEventListener('click', () => void this.handleReset(graph.name))

    // A phase with no taskSourceId has no queue at all (e.g. a rep-based workout phase).
    if (phase.taskSourceId === null) {
      return
    }

    const queueTitle = phase.kind === FOCUS_PHASE_KIND ? 'Work queue' : 'Break queue'
    const queueItems = this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? []

    const queueEl = this.contentEl.createDiv({ cls: 'pomodoro-queue' })
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
