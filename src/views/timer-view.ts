import { BasesView } from 'obsidian'
import type { BasesOptions, QueryController, App, TFile, BasesPropertyId, BasesEntry } from 'obsidian'
import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase } from '../domain/phase/phase'
import { findPhaseById, FOCUS_PHASE_KIND, DEFAULT_PHASE_GRAPH } from '../timer/phase-graph'
import { formatPhaseHeader } from '../timer/format'
import { decideStartAction, resolveRoutineGraph } from '../timer/routine-selection'
import type { RoutineResolution } from '../timer/routine-selection'
import { RoutineReplaceModal } from './routine-replace-modal'
import { ResetConfirmModal } from './reset-confirm-modal'
import { resolveActiveFilePath } from '../timer/queue-advance'
import { createBaseQuerySource } from '../timer/base-query-task-source'
import { filterQueueCandidates } from '../timer/queue-filter'

export class RoutineTimerView extends BasesView {
  readonly type = 'routine-timer'
  containerEl: HTMLElement
  private plugin: RoutineFlowPlugin
  private unsubscribe: (() => void) | null = null
  private routineFilePath: string | null = null
  private routineResolution: RoutineResolution = { kind: 'default', graph: DEFAULT_PHASE_GRAPH }

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
      this.containerEl.createEl('p', { text: `Routine error: ${this.routineResolution.error.message}`, cls: 'routine-error' })
      return
    }

    if (this.routineResolution.kind === 'loading') {
      this.containerEl.createEl('p', { text: 'Loading routine…', cls: 'routine-loading' })
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

    // Timer Panel
    const timerPanel = this.containerEl.createDiv({ cls: 'routine-timer-panel' })
    timerPanel.createEl('h2', { text: formatPhaseHeader(phase, state.remaining, state.status) })

    if (!isViewRoutineActive && state.status !== 'stopped') {
      timerPanel.createEl('p', { text: `"${graph.name}" is currently active instead of this view's routine ("${viewGraph.name}").`, cls: 'routine-inert' })
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

    const stopBtn = controls.createEl('button', { text: 'Reset' })
    stopBtn.addEventListener('click', () => void this.handleReset(graph.name))

    // A phase with no taskSourceId has no queue at all (e.g. a rep-based workout phase) — nothing to render.
    if (phase.taskSourceId === null) {
      return
    }

    const queueTitle = phase.kind === FOCUS_PHASE_KIND ? 'Work queue' : 'Break queue'
    const queueItems = this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? []

    // Queue Panel
    const queueEl = this.containerEl.createDiv({ cls: 'routine-queue' })
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
  }

  private async handleReset(routineName: string): Promise<void> {
    const result = await new ResetConfirmModal(this.plugin.app, routineName).waitForResult()
    if (result !== 'confirmed') {
      return
    }
    void this.plugin.store.dispatch({ type: 'stop' })
  }

  static getViewOptions(app: App): BasesOptions[] {
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
}
