import { BasesView } from 'obsidian'
import type { QueryController, BasesPropertyId, BasesEntry } from 'obsidian'
import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase } from '../domain/phase/phase'
import { findNextPhase, findPhaseById, DEFAULT_PHASE_GRAPH } from '../timer/phase-graph'
import { formatCountdown } from '../timer/format'
import { decideStartAction, resolveRoutineGraph } from '../timer/routine-selection'
import type { RoutineResolution } from '../timer/routine-selection'
import { RoutineReplaceModal } from './routine-replace-modal'
import { ResetConfirmModal } from './reset-confirm-modal'
import { resolveActiveFilePath } from '../timer/queue-advance'
import { createBaseQuerySource } from '../timer/base-query-task-source'
import { filterQueueCandidates } from '../timer/queue-filter'
import { renderStateIcon } from './timer/state-icon'
import { renderProgressMeter } from './timer/progress-meter'
import { renderConfigBar, renderConfigPanel } from './timer/config-panel'
import { renderQueuePanel } from './timer/queue-panel'
import { getViewOptions } from './timer/view-options'

export class RoutineTimerView extends BasesView {
  readonly type = 'routine-timer'
  containerEl: HTMLElement
  private plugin: RoutineFlowPlugin
  private unsubscribe: (() => void) | null = null
  private routineFilePath: string | null = null
  private routineResolution: RoutineResolution = { kind: 'default', graph: DEFAULT_PHASE_GRAPH }
  private isConfigOpen = false
  private queueEl: HTMLElement | null = null

  constructor(controller: QueryController, containerEl: HTMLElement, plugin: RoutineFlowPlugin) {
    super(controller)
    this.containerEl = containerEl
    this.plugin = plugin
  }

  onload() {
    this.containerEl.addClass('routine-timer-view')
    this.unsubscribe = this.plugin.store.subscribe((state) => {
      this.render(state)
    })
    this.render(this.plugin.store.getState())
  }

  onunload() {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  }

  onDataUpdated() {
    this.applyAutoAdvance()
    this.render(this.plugin.store.getState())
  }

  private applyAutoAdvance(): void {
    const state = this.plugin.store.getState()
    const allPaths = (this.data?.data ?? []).map(entry => entry.file.path)
    const resolved = resolveActiveFilePath(state.activeFilePath, allPaths)
    if (resolved !== state.activeFilePath) {
      void this.plugin.store.dispatch({ type: 'set-active-file', filePath: resolved })
    }
  }

  private render(state: EngineState) {
    this.containerEl.empty()
    this.containerEl.className = 'routine-timer-view'

    const configuredPath = this.getConfiguredRoutineFilePath()
    if (configuredPath !== this.routineFilePath) {
      this.routineFilePath = configuredPath
      this.routineResolution = configuredPath === null ? { kind: 'default', graph: DEFAULT_PHASE_GRAPH } : { kind: 'loading' }
      if (configuredPath !== null) {
        void this.loadRoutineFile(configuredPath)
      }
    }

    // Test-observable marker: routineResolution settles asynchronously (loadRoutineFile reads the
    // routine file), one or more renders after a Bases sub-view switch. Without this, an e2e click
    // on "Start" can race ahead of the load and land on the previous sub-view's still-attached
    // button (flow-6v7).
    this.containerEl.dataset.routineState = this.routineResolution.kind
    if (this.routineResolution.kind === 'default' || this.routineResolution.kind === 'loaded') {
      this.containerEl.dataset.viewGraphId = this.routineResolution.graph.id
    }
    else {
      delete this.containerEl.dataset.viewGraphId
    }

    if (this.routineResolution.kind === 'error') {
      const errorEl = this.containerEl.createDiv({ cls: 'routine-error' })
      renderStateIcon(errorEl, ['circle-alert', 'alert-circle'])
      errorEl.createEl('p', { text: `Routine error: ${this.routineResolution.error.message}` })
      this.renderConfigBar(this.containerEl)
      if (this.isConfigOpen) {
        this.renderConfigPanel(this.containerEl)
      }
      return
    }

    if (this.routineResolution.kind === 'loading') {
      const loadingEl = this.containerEl.createDiv({ cls: 'routine-loading' })
      renderStateIcon(loadingEl, ['loader-circle', 'loader-2'])
      loadingEl.createEl('p', { text: 'Loading routine…' })
      return
    }

    const viewGraph = this.routineResolution.graph

    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase) {
      return
    }

    const isViewRoutineActive = graph.id === viewGraph.id

    // Only the view backing the currently active graph writes to the shared registry — otherwise
    // two simultaneously open Bases leaves showing different (inactive) sub-views would stomp each
    // other's registration for a taskSourceId they happen to share (flow-gu1.29).
    if (isViewRoutineActive) {
      this.registerTaskSources(viewGraph)
    }

    // This leaf is a bystander to a routine running elsewhere -- the header/queue below belong to
    // that *other* routine, not this view's own (see design.md surface #4).
    const isInert = !isViewRoutineActive && state.status !== 'stopped'

    // Timer Panel
    const timerPanel = this.containerEl.createDiv({ cls: 'routine-timer-panel' })
    timerPanel.addClass(`is-${state.status}`)

    this.renderConfigBar(timerPanel)
    if (this.isConfigOpen) {
      this.renderConfigPanel(timerPanel)
    }

    // Stopwatch header: a single <h2> (what e2e queries) whose child spans read as a watch face --
    // the phase label above the dial, the mm:ss digits inside/over the progress ring, the status
    // below. The concatenated text stays byte-identical to formatPhaseHeader() output ("Focus: 25:00
    // (running)" / "Set (stopped)"), so every existing header assertion still holds -- see format.ts.
    const countdownTime = formatCountdown(state.remaining, phase.timeFormat ?? 'mm:ss')
    const header = timerPanel.createEl('h2', { cls: 'routine-countdown' })
    header.createSpan({
      cls: 'routine-countdown-label',
      text: countdownTime === null ? phase.label : `${phase.label}: `,
    })
    if (countdownTime !== null) {
      const dial = header.createSpan({ cls: 'routine-countdown-dial' })
      renderProgressMeter(dial, {
        style: this.plugin.settings.progressMeterStyle,
        isInert,
        duration: phase.duration,
        remaining: state.remaining,
      })
      dial.createSpan({ cls: 'routine-countdown-time', text: countdownTime })
    }
    header.createSpan({ cls: 'routine-countdown-status', text: ` (${state.status})` })

    const nextPhase = findNextPhase(graph, state, this.plugin.formulaPredicateRegistry)
    if (nextPhase !== undefined) {
      const nextPhaseEl = timerPanel.createDiv({ cls: 'routine-next-phase' })
      nextPhaseEl.createSpan({ text: `Next: ${nextPhase.label}` })
    }

    if (isInert) {
      const inertEl = timerPanel.createEl('p', { cls: 'routine-inert' })
      renderStateIcon(inertEl, ['info'])
      inertEl.createSpan({ text: `"${graph.name}" is currently active instead of this view's routine ("${viewGraph.name}").` })
    }

    // Controls
    const controls = this.containerEl.createDiv({ cls: 'routine-controls' })

    if (isViewRoutineActive && state.status === 'running') {
      const pauseBtn = controls.createEl('button', { text: 'Pause' })
      pauseBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'pause' }))
    }
    else {
      const playBtn = controls.createEl('button', { text: 'Start' })
      playBtn.addEventListener('click', () => void this.handleStart(viewGraph))
    }

    if (isViewRoutineActive && state.status === 'running' && state.remaining === null) {
      const doneBtn = controls.createEl('button', { text: 'Done' })
      doneBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'finish-phase' }))
    }

    // status is only ever 'completed' for a manualClear-policy phase (every other policy advances
    // immediately) -- without this, such a phase has no reachable UI path past it (flow-039).
    if (isViewRoutineActive && state.status === 'completed') {
      const clearBtn = controls.createEl('button', { text: 'Clear' })
      clearBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'advance-phase' }))
    }

    const stopBtn = controls.createEl('button', { text: 'Reset' })
    stopBtn.addEventListener('click', () => void this.handleReset(graph.name))

    // A phase with no taskSourceId has no queue at all (e.g. a rep-based workout phase) — nothing to render.
    if (phase.taskSourceId === null) {
      this.queueEl = null
      return
    }

    // Queue Panel
    this.queueEl = this.containerEl.createDiv({ cls: 'routine-queue' })
    this.renderQueueContent(this.queueEl, phase, state)
  }

  private renderConfigBar(parent: HTMLElement): void {
    renderConfigBar(parent, {
      isConfigOpen: this.isConfigOpen,
      onToggle: () => {
        this.isConfigOpen = !this.isConfigOpen
        this.render(this.plugin.store.getState())
      },
    })
  }

  private renderConfigPanel(parent: HTMLElement): void {
    renderConfigPanel(parent, {
      app: this.plugin.app,
      config: this.config,
      configuredRoutinePath: this.getConfiguredRoutineFilePath(),
      onRoutineFileChange: async () => {
        this.routineFilePath = this.getConfiguredRoutineFilePath()
        this.routineResolution = this.routineFilePath === null
          ? { kind: 'default', graph: DEFAULT_PHASE_GRAPH }
          : { kind: 'loading' }
        if (this.routineFilePath !== null) {
          await this.loadRoutineFile(this.routineFilePath)
        }
        this.render(this.plugin.store.getState())
      },
      onFilterConfigChange: () => this.refreshQueueView(),
    })
  }

  private refreshQueueView(): void {
    if (this.routineResolution.kind === 'default' || this.routineResolution.kind === 'loaded') {
      const viewGraph = this.routineResolution.graph
      const graph = this.plugin.store.getGraph()
      if (graph.id === viewGraph.id) {
        this.registerTaskSources(viewGraph)
      }
    }
    const state = this.plugin.store.getState()
    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase || !this.queueEl) {
      return
    }
    this.renderQueueContent(this.queueEl, phase, state)
  }

  private renderQueueContent(queueEl: HTMLElement, phase: Phase, state: EngineState): void {
    const queueItems = phase.taskSourceId !== null
      ? (this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? [])
      : []

    renderQueuePanel(queueEl, {
      phase,
      activeFilePath: state.activeFilePath,
      queueItems,
      app: this.plugin.app,
      actionExecutor: this.plugin.store,
      onSelectTask: (filePath) => {
        void this.plugin.store.dispatch({ type: 'start', filePath })
        void this.plugin.activateView()
      },
    })
  }

  /**
   * Registers a TaskSource for every phase in `viewGraph` that has a taskSourceId, not just
   * whichever phase happens to be currently active — otherwise a not-currently-rendered phase's
   * source is stale or missing entirely (flow-gu1.29; needed by e.g. flow-6ed's proposed
   * queueExhausted TransitionCondition, which can ask about a phase other than the active one).
   */
  private registerTaskSources(viewGraph: PhaseGraph): void {
    const entries = this.data?.data ?? []
    for (const phase of viewGraph.phases) {
      if (phase.taskSourceId !== null) {
        this.plugin.taskSourceRegistry.register(phase.taskSourceId, this.buildTaskSource(phase, entries))
      }
    }
  }

  private buildTaskSource(phase: Phase, entries: readonly BasesEntry[]) {
    const candidates = entries.map(entry => ({
      path: entry.file.path,
      basename: entry.file.basename,
      frontmatter: this.plugin.app.metadataCache.getFileCache(entry.file)?.frontmatter,
      getValue: (propId: BasesPropertyId) => entry.getValue(propId),
    }))
    return createBaseQuerySource(filterQueueCandidates(phase, this.config, candidates))
  }

  private getConfiguredRoutineFilePath(): string | null {
    const raw = this.config?.get('routineFile')
    return typeof raw === 'string' && raw.length > 0 ? raw : null
  }

  private async loadRoutineFile(path: string): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(path)
    const resolution: RoutineResolution = file === null
      ? { kind: 'error', error: { message: `Routine file not found: ${path}` } }
      : resolveRoutineGraph(await this.plugin.app.vault.cachedRead(file))

    // Only apply if still the current selection — the user may have picked a different file mid-load.
    if (this.routineFilePath === path) {
      this.routineResolution = resolution
      this.render(this.plugin.store.getState())
    }
  }

  private async handleStart(graph: PhaseGraph): Promise<void> {
    const activeGraph = this.plugin.store.getGraph()
    const action = decideStartAction(
      { graphId: activeGraph.id, status: this.plugin.store.getState().status },
      graph.id,
    )

    if (action === 'confirm') {
      const result = await new RoutineReplaceModal(this.plugin.app, activeGraph.name, graph.name).waitForResult()
      if (result !== 'confirmed') {
        return
      }
    }

    if (activeGraph.id !== graph.id) {
      this.plugin.store.setGraph(graph)
    }
    void this.plugin.store.dispatch({ type: 'start' })
    void this.plugin.activateView()
  }

  private async handleReset(routineName: string): Promise<void> {
    const result = await new ResetConfirmModal(this.plugin.app, routineName).waitForResult()
    if (result !== 'confirmed') {
      return
    }
    void this.plugin.store.dispatch({ type: 'stop' })
  }

  static getViewOptions = getViewOptions
}
