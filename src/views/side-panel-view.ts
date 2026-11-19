import { ItemView, Notice } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseId } from '../domain/phase/phase'
import type { TaskQueueItem } from '../domain/queue/task-source'
import { deriveStageProgress } from '../domain/phase/stage-progress'
import { findNextPhase, findPhaseById, SELECTOR_PHASE_KIND } from '../timer/phase-graph-query'
import { formatPhaseHeader } from '../timer/format'
import { handleSelectorWinner } from '../timer/selector-winner'
import { ResetConfirmModal } from './reset-confirm-modal'
import { renderStageProgress, renderGuidanceChecklist } from './timer/stage-progress-panel'
import { renderQueuePanel } from './timer/queue-panel'

export const SIDE_PANEL_VIEW_TYPE = 'routine-side-panel'

interface SidePanelRenderSnapshot {
  readonly graphId: string
  readonly status: EngineState['status']
  readonly currentPhaseId: PhaseId
  readonly hasRemaining: boolean
  readonly activeFilePath: string | null
  readonly queueExhausted: boolean
  readonly itemsTouchedCount: number
  readonly completedCount: number
  readonly phaseVisitCount: number
  readonly nextPhaseId: PhaseId | undefined
  readonly queueSignature: string
}

function computeQueueSignature(queueItems: readonly TaskQueueItem[]): string {
  return queueItems
    .map(item => JSON.stringify({
      id: item.id,
      sourcePath: item.sourcePath,
      displayName: item.displayName,
      cycleStatus: item.cycleStatus,
      timeSpent: item.timeSpent?.toString() ?? null,
      lastCycledAt: item.lastCycledAt?.toString() ?? null,
      extraProperties: item.extraProperties ?? null,
    }))
    .join('\n')
}

function sidePanelSnapshotsMatch(a: SidePanelRenderSnapshot, b: SidePanelRenderSnapshot): boolean {
  return a.graphId === b.graphId
    && a.status === b.status
    && a.currentPhaseId === b.currentPhaseId
    && a.hasRemaining === b.hasRemaining
    && a.activeFilePath === b.activeFilePath
    && a.queueExhausted === b.queueExhausted
    && a.itemsTouchedCount === b.itemsTouchedCount
    && a.completedCount === b.completedCount
    && a.phaseVisitCount === b.phaseVisitCount
    && a.nextPhaseId === b.nextPhaseId
    && a.queueSignature === b.queueSignature
}

/**
 * Workspace-wide side panel mirroring the shared EngineStore, closer to
 * RoutineTimerView's fidelity (phase + controls + queue) than the status
 * bar item, but not bound to any leaf's routineFile -- no viewGraph, no
 * Start button, no routine-selection UI (see design.md's Decisions).
 */
export class RoutineSidePanelView extends ItemView {
  private unsubscribe: (() => void) | null = null
  private unsubscribeRegistry: (() => void) | null = null
  private timerSectionEl: HTMLElement | null = null
  private controlsSectionEl: HTMLElement | null = null
  private queueSectionEl: HTMLElement | null = null
  private headerEl: HTMLElement | null = null
  private lastRenderSnapshot: SidePanelRenderSnapshot | null = null
  private checkedGuidanceItems = new Set<string>()
  private lastGuidancePhaseId: PhaseId | null = null

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
    this.unsubscribeRegistry = this.plugin.taskSourceRegistry?.subscribe?.(() => this.render(this.plugin.store.getState())) ?? null
    this.render(this.plugin.store.getState())
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.unsubscribeRegistry?.()
    this.unsubscribeRegistry = null
  }

  private resetPersistentContainers(): void {
    this.timerSectionEl = null
    this.controlsSectionEl = null
    this.queueSectionEl = null
    this.headerEl = null
    this.lastRenderSnapshot = null
  }

  private render(state: EngineState): void {
    if (state.status === 'stopped') {
      this.resetPersistentContainers()
      this.contentEl.empty()
      this.contentEl.className = 'routine-side-panel'
      this.contentEl.createEl('p', { text: 'No routine is running. Start one from a Bases timer view.' })
      return
    }

    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase) {
      return
    }

    if (state.currentPhaseId !== this.lastGuidancePhaseId) {
      this.lastGuidancePhaseId = state.currentPhaseId
      this.checkedGuidanceItems.clear()
    }

    const completedItems = state.session?.currentInstance?.itemsTouched.filter((touch) => {
      return touch.status === 'completed'
    }) ?? []
    const completedCount = completedItems.length
    const completedPaths = completedItems.map(touch => touch.sourcePath)

    const queueItems = phase.taskSourceId !== null
      ? (this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? [])
      : []
    const queueSignature = phase.taskSourceId !== null ? computeQueueSignature(queueItems) : ''

    const nextPhase = findNextPhase(graph, state, this.plugin.formulaPredicateRegistry)
    const snapshot: SidePanelRenderSnapshot = {
      graphId: graph.id,
      status: state.status,
      currentPhaseId: state.currentPhaseId,
      hasRemaining: state.remaining !== null,
      activeFilePath: state.activeFilePath,
      queueExhausted: state.queueExhausted,
      itemsTouchedCount: state.session?.currentInstance?.itemsTouched.length ?? 0,
      completedCount,
      phaseVisitCount: state.phaseVisitCounts[state.currentPhaseId] ?? 0,
      nextPhaseId: nextPhase?.id,
      queueSignature,
    }

    if (
      this.lastRenderSnapshot !== null
      && this.headerEl !== null
      && this.timerSectionEl !== null
      && this.controlsSectionEl !== null
      && sidePanelSnapshotsMatch(this.lastRenderSnapshot, snapshot)
    ) {
      this.headerEl.setText(formatPhaseHeader(phase, state.remaining, state.status))
      return
    }

    this.contentEl.className = 'routine-side-panel'
    this.contentEl.addClass(`is-${state.status}`)

    if (this.timerSectionEl === null || this.controlsSectionEl === null) {
      this.contentEl.empty()
      this.timerSectionEl = this.contentEl.createDiv({ cls: 'routine-side-panel-timer' })
      this.controlsSectionEl = this.contentEl.createDiv({ cls: 'routine-controls' })
      this.queueSectionEl = null
    }

    const timerSection = this.timerSectionEl
    timerSection.empty()

    this.headerEl = timerSection.createEl('h2', { text: formatPhaseHeader(phase, state.remaining, state.status) })

    if (nextPhase !== undefined) {
      const nextPhaseEl = timerSection.createDiv({ cls: 'routine-next-phase' })
      nextPhaseEl.createSpan({ text: `Next: ${nextPhase.label}` })
    }

    const stageProgress = deriveStageProgress(graph, state)
    if (stageProgress.totalCount > 1) {
      renderStageProgress(timerSection, stageProgress)
    }

    if (phase.guidance && phase.guidance.length > 0) {
      renderGuidanceChecklist(timerSection, phase.guidance, {
        checkedItems: this.checkedGuidanceItems,
        onToggle: (item, checked) => {
          if (checked) {
            this.checkedGuidanceItems.add(item)
          }
          else {
            this.checkedGuidanceItems.delete(item)
          }
        },
      })
    }

    const controls = this.controlsSectionEl
    controls.empty()

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
      if (this.queueSectionEl !== null) {
        this.queueSectionEl.remove()
        this.queueSectionEl = null
      }
      this.lastRenderSnapshot = snapshot
      return
    }

    const isSelector = phase.kind === SELECTOR_PHASE_KIND

    if (this.queueSectionEl === null) {
      this.queueSectionEl = this.contentEl.createDiv({ cls: 'routine-queue' })
    }

    renderQueuePanel(this.queueSectionEl, {
      phase,
      activeFilePath: state.activeFilePath,
      queueItems,
      app: this.plugin.app,
      actionExecutor: this.plugin.store,
      completedCount,
      completedPaths,
      onSelectTask: (filePath) => {
        if (isSelector) {
          void handleSelectorWinner(this.plugin.store, phase, filePath, msg => new Notice(msg))
        }
        else {
          void this.plugin.store.dispatch({ type: 'start', filePath })
        }
      },
    })

    this.lastRenderSnapshot = snapshot
  }

  private async handleReset(routineName: string): Promise<void> {
    const result = await new ResetConfirmModal(this.plugin.app, routineName).waitForResult()
    if (result !== 'confirmed') {
      return
    }
    this.checkedGuidanceItems.clear()
    void this.plugin.store.dispatch({ type: 'stop' })
  }
}
