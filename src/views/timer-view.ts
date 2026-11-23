import { BasesView, Notice } from 'obsidian'
import type { QueryController, BasesPropertyId } from 'obsidian'
import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase, PhaseId } from '../domain/phase/phase'
import type { TaskSource, TaskSourceId } from '../domain/queue/task-source'
import type { FallbackTaskSourceSnapshot } from '../timer/fallback-task-sources'
import { deriveStageProgress } from '../domain/phase/stage-progress'
import { findNextPhase, findPhaseById, DEFAULT_PHASE_GRAPH, SELECTOR_PHASE_KIND } from '../timer/phase-graph-query'
import { handleSelectorWinner } from '../timer/selector-winner'
import { formatCountdown } from '../timer/format'
import { decideStartAction, resolveRoutineGraph } from '../timer/routine-selection'
import type { RoutineResolution } from '../timer/routine-selection'
import { RoutineReplaceModal } from './routine-replace-modal'
import { ResetConfirmModal } from './reset-confirm-modal'
import { resolveActiveFilePath } from '../timer/queue-advance'
import { createBaseQuerySource } from '../adapters/obsidian/bases/query-task-source'
import { filterQueueCandidates } from '../adapters/obsidian/bases/queue-filter'
import { renderStateIcon } from './timer/state-icon'
import { renderProgressMeter } from './timer/progress-meter'
import { computeProgressFraction } from '../timer/progress'
import type { ProgressMeterStyle } from '../timer/progress-meter-style'
import { renderConfigBar, renderConfigPanel } from './timer/config-panel'
import { renderQueuePanel } from './timer/queue-panel'
import { renderOrderedEntryProperties } from './timer/queue-entry-properties'
import { getViewOptions } from './timer/view-options'
import { renderStageProgress, renderGuidanceChecklist } from './timer/stage-progress-panel'
import { deriveStarJarState, resolveGraphTrackerFilePath } from '../domain/reward/star-jar'
import { renderStarJarMeter } from './timer/star-jar-meter'

interface TimerRenderSnapshot {
  readonly viewGraphId: string
  readonly activeGraphId: string
  readonly status: EngineState['status']
  readonly currentPhaseId: PhaseId
  readonly hasRemaining: boolean
  readonly activeFilePath: string | null
  readonly queueExhausted: boolean
  readonly isConfigOpen: boolean
  readonly progressMeterStyle: ProgressMeterStyle
  readonly trackerFrontmatter: EngineState['trackerFrontmatter']
  readonly itemsTouchedCount: number
  readonly phaseVisitCount: number
  readonly nextPhaseId: PhaseId | undefined
}

function timerSnapshotsMatch(a: TimerRenderSnapshot, b: TimerRenderSnapshot): boolean {
  return a.viewGraphId === b.viewGraphId
    && a.activeGraphId === b.activeGraphId
    && a.status === b.status
    && a.currentPhaseId === b.currentPhaseId
    && a.hasRemaining === b.hasRemaining
    && a.activeFilePath === b.activeFilePath
    && a.queueExhausted === b.queueExhausted
    && a.isConfigOpen === b.isConfigOpen
    && a.progressMeterStyle === b.progressMeterStyle
    && a.trackerFrontmatter === b.trackerFrontmatter
    && a.itemsTouchedCount === b.itemsTouchedCount
    && a.phaseVisitCount === b.phaseVisitCount
    && a.nextPhaseId === b.nextPhaseId
}

export class RoutineTimerView extends BasesView {
  readonly type = 'routine-timer'
  containerEl: HTMLElement
  private plugin: RoutineFlowPlugin
  private unsubscribe: (() => void) | null = null
  private routineFilePath: string | null = null
  private routineResolution: RoutineResolution = { kind: 'default', graph: DEFAULT_PHASE_GRAPH }
  private isConfigOpen = false
  private timerSectionEl: HTMLElement | null = null
  private controlsSectionEl: HTMLElement | null = null
  private queueEl: HTMLElement | null = null
  private dialEl: HTMLElement | null = null
  private countdownTimeEl: HTMLElement | null = null
  private lastRenderSnapshot: TimerRenderSnapshot | null = null
  private checkedGuidanceItems = new Set<string>()
  private lastGuidancePhaseId: PhaseId | null = null
  private registeredSnapshots = new Map<TaskSourceId, FallbackTaskSourceSnapshot>()

  constructor(controller: QueryController, containerEl: HTMLElement, plugin: RoutineFlowPlugin) {
    super(controller)
    this.containerEl = containerEl
    this.plugin = plugin
  }

  onload() {
    this.containerEl.addClass('routine-timer-view')
    this.routineFilePath = this.getConfiguredRoutineFilePath()
    if (this.routineFilePath === null) {
      this.routineResolution = { kind: 'default', graph: DEFAULT_PHASE_GRAPH }
      this.syncTaskSourcesIfActive()
    }
    else {
      this.routineResolution = { kind: 'loading' }
      void this.loadRoutineFile(this.routineFilePath)
    }
    this.unsubscribe = this.plugin.store.subscribe((state) => {
      this.render(state)
    })
    this.render(this.plugin.store.getState())
  }

  onunload() {
    this.plugin.taskSourceRegistry.unregisterScope?.(this)
    if (
      this.plugin.store.getState().status !== 'stopped'
      && (this.routineResolution.kind === 'default' || this.routineResolution.kind === 'loaded')
      && this.routineResolution.graph.id === this.plugin.store.getGraph().id
    ) {
      for (const [id, snapshot] of this.registeredSnapshots) {
        this.plugin.fallbackTaskSources?.retainIfUnprovided(id, snapshot)
      }
    }
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  }

  onDataUpdated() {
    this.applyAutoAdvance()
    this.syncTaskSourcesIfActive()
    void this.plugin.store.syncQueueExhausted()
    this.lastRenderSnapshot = null
    this.render(this.plugin.store.getState())
  }

  private applyAutoAdvance(): void {
    const state = this.plugin.store.getState()
    const phase = findPhaseById(this.plugin.store.getGraph(), state.currentPhaseId)
    const queuePaths = phase?.taskSourceId
      ? this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue().map(i => i.sourcePath)
      : undefined
    const allPaths = queuePaths ?? (this.data?.data ?? []).map(entry => entry.file.path)
    const resolved = resolveActiveFilePath(state.activeFilePath, allPaths)
    if (resolved !== state.activeFilePath) {
      void this.plugin.store.dispatch({ type: 'set-active-file', filePath: resolved })
    }
  }

  private resetPersistentContainers(): void {
    this.timerSectionEl = null
    this.controlsSectionEl = null
    this.queueEl = null
    this.dialEl = null
    this.countdownTimeEl = null
    this.lastRenderSnapshot = null
  }

  private syncTaskSourcesIfActive(): void {
    if (this.routineResolution.kind === 'default' || this.routineResolution.kind === 'loaded') {
      const viewGraph = this.routineResolution.graph
      if (this.plugin.store.getGraph().id === viewGraph.id) {
        const owner = this.plugin.getActiveViewStatusConfigOwner?.() ?? null
        if (this.plugin.store.getState().status !== 'stopped' && (owner === null || owner === this)) {
          this.syncActiveViewStatusConfig()
        }
        this.registerTaskSources(viewGraph)
      }
    }
  }

  private updateCountdownTick(phase: Phase, state: EngineState, isInert: boolean): void {
    const countdownTime = formatCountdown(state.remaining, phase.timeFormat ?? 'mm:ss')
    if (countdownTime !== null && this.countdownTimeEl !== null) {
      this.countdownTimeEl.setText(countdownTime)
    }
    if (this.dialEl !== null && !isInert && phase.duration !== null && state.remaining !== null) {
      const fraction = state.queueExhausted ? 1 : computeProgressFraction(phase.duration, state.remaining)
      this.dialEl.style.setProperty('--routine-flow-progress', String(fraction))
    }
  }

  private render(state: EngineState) {
    if (state.currentPhaseId !== this.lastGuidancePhaseId) {
      this.lastGuidancePhaseId = state.currentPhaseId
      this.checkedGuidanceItems.clear()
    }

    const configuredPath = this.getConfiguredRoutineFilePath()
    if (configuredPath !== this.routineFilePath) {
      this.routineFilePath = configuredPath
      this.routineResolution = configuredPath === null ? { kind: 'default', graph: DEFAULT_PHASE_GRAPH } : { kind: 'loading' }
      this.lastRenderSnapshot = null
      if (configuredPath !== null) {
        void this.loadRoutineFile(configuredPath)
      }
      else {
        this.syncTaskSourcesIfActive()
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
      this.resetPersistentContainers()
      this.containerEl.empty()
      this.containerEl.className = 'routine-timer-view'
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
      this.resetPersistentContainers()
      this.containerEl.empty()
      this.containerEl.className = 'routine-timer-view'
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

    // This leaf is a bystander to a routine running elsewhere -- the header/queue below belong to
    // that *other* routine, not this view's own (see design.md surface #4).
    const isInert = !isViewRoutineActive && state.status !== 'stopped'
    const nextPhase = findNextPhase(graph, state, this.plugin.formulaPredicateRegistry)

    const snapshot: TimerRenderSnapshot = {
      viewGraphId: viewGraph.id,
      activeGraphId: graph.id,
      status: state.status,
      currentPhaseId: state.currentPhaseId,
      hasRemaining: state.remaining !== null,
      activeFilePath: state.activeFilePath,
      queueExhausted: state.queueExhausted,
      isConfigOpen: this.isConfigOpen,
      progressMeterStyle: this.plugin.settings.progressMeterStyle,
      trackerFrontmatter: state.trackerFrontmatter,
      itemsTouchedCount: state.session?.currentInstance?.itemsTouched.length ?? 0,
      phaseVisitCount: state.phaseVisitCounts[state.currentPhaseId] ?? 0,
      nextPhaseId: nextPhase?.id,
    }

    if (
      this.lastRenderSnapshot !== null
      && this.timerSectionEl !== null
      && this.controlsSectionEl !== null
      && timerSnapshotsMatch(this.lastRenderSnapshot, snapshot)
    ) {
      this.updateCountdownTick(phase, state, isInert)
      return
    }

    if (this.timerSectionEl === null || this.controlsSectionEl === null) {
      this.containerEl.empty()
      this.containerEl.className = 'routine-timer-view'
      this.timerSectionEl = this.containerEl.createDiv({ cls: 'routine-timer-panel' })
      this.controlsSectionEl = this.containerEl.createDiv({ cls: 'routine-controls' })
      this.queueEl = null
    }

    // Timer Panel
    const timerPanel = this.timerSectionEl
    timerPanel.empty()
    timerPanel.className = 'routine-timer-panel'
    timerPanel.addClass(`is-${state.status}`)
    if (state.queueExhausted) {
      timerPanel.addClass('is-queue-exhausted')
      timerPanel.addClass('routine-blitz-exhausted')
      timerPanel.addClass('rf-blitz-exhausted')
    }

    this.renderConfigBar(timerPanel)
    if (this.isConfigOpen) {
      this.renderConfigPanel(timerPanel)
    }

    if (state.queueExhausted) {
      const celebrationEl = timerPanel.createDiv({ cls: 'routine-blitz-celebration' })
      renderStateIcon(celebrationEl, ['check-check', 'check'])
      celebrationEl.createSpan({
        cls: 'routine-blitz-celebration-text',
        text: 'All chores completed early!',
      })
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
      this.dialEl = header.createSpan({ cls: 'routine-countdown-dial' })
      if (state.queueExhausted) {
        this.dialEl.addClass('is-exhausted')
        this.dialEl.addClass('is-celebrating')
      }
      renderProgressMeter(this.dialEl, {
        style: this.plugin.settings.progressMeterStyle,
        isInert,
        duration: phase.duration,
        remaining: state.remaining,
        isExhausted: state.queueExhausted,
      })
      this.countdownTimeEl = this.dialEl.createSpan({ cls: 'routine-countdown-time', text: countdownTime })
    }
    else {
      this.dialEl = null
      this.countdownTimeEl = null
    }
    header.createSpan({ cls: 'routine-countdown-status', text: ` (${state.status})` })

    if (nextPhase !== undefined) {
      const nextPhaseEl = timerPanel.createDiv({ cls: 'routine-next-phase' })
      nextPhaseEl.createSpan({ text: `Next: ${nextPhase.label}` })
    }

    if (isInert) {
      const inertEl = timerPanel.createEl('p', { cls: 'routine-inert' })
      renderStateIcon(inertEl, ['info'])
      inertEl.createSpan({ text: `"${graph.name}" is currently active instead of this view's routine ("${viewGraph.name}").` })
    }

    const stageProgress = deriveStageProgress(graph, state)
    if (stageProgress.totalCount > 1) {
      renderStageProgress(timerPanel, stageProgress)
    }

    const activeGraph = isViewRoutineActive ? graph : (viewGraph ?? graph)
    const trackerFilePath = resolveGraphTrackerFilePath(activeGraph)
    if (trackerFilePath !== null || state.trackerFrontmatter !== undefined) {
      let trackerFrontmatter = state.trackerFrontmatter
      if (trackerFrontmatter === undefined && trackerFilePath !== null) {
        try {
          const file = this.plugin.app.vault.getFileByPath(trackerFilePath)
          if (file !== null) {
            trackerFrontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter
          }
        }
        catch {
          // Ignore cache lookup failure
        }
      }
      const starJarState = deriveStarJarState(trackerFrontmatter)
      renderStarJarMeter(timerPanel, {
        current: starJarState.current,
        target: starJarState.target,
        progressFraction: starJarState.progressFraction,
        isFull: starJarState.isFull,
        trackerFilePath,
      })
    }

    if (phase.guidance && phase.guidance.length > 0) {
      renderGuidanceChecklist(timerPanel, phase.guidance, {
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

    // Controls
    const controls = this.controlsSectionEl
    controls.empty()

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
      if (this.queueEl !== null) {
        this.queueEl.remove()
        this.queueEl = null
      }
    }
    else {
      // Queue Panel
      if (this.queueEl === null) {
        this.queueEl = this.containerEl.createDiv({ cls: 'routine-queue' })
      }
      else {
        this.queueEl.empty()
      }
      this.renderQueueContent(this.queueEl, phase, state)
    }

    this.lastRenderSnapshot = snapshot
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
        this.lastRenderSnapshot = null
        if (this.routineFilePath !== null) {
          await this.loadRoutineFile(this.routineFilePath)
        }
        else {
          this.syncTaskSourcesIfActive()
        }
        this.render(this.plugin.store.getState())
      },
      onFilterConfigChange: () => this.refreshQueueView(),
    })
  }

  private refreshQueueView(): void {
    const viewGraphId = this.routineResolution.kind === 'default' || this.routineResolution.kind === 'loaded'
      ? this.routineResolution.graph.id
      : null
    const owner = this.plugin.getActiveViewStatusConfigOwner?.() ?? null
    if (owner === this || (viewGraphId !== null && this.plugin.store.getGraph().id === viewGraphId && this.plugin.store.getState().status !== 'stopped')) {
      this.syncActiveViewStatusConfig()
    }
    this.syncTaskSourcesIfActive()
    const state = this.plugin.store.getState()
    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase || !this.queueEl) {
      return
    }
    this.queueEl.empty()
    this.renderQueueContent(this.queueEl, phase, state)
  }

  private renderQueueContent(queueEl: HTMLElement, phase: Phase, state: EngineState): void {
    const queueItems = phase.taskSourceId !== null
      ? (this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? [])
      : []

    const isSelector = phase.kind === SELECTOR_PHASE_KIND

    const completedItems = state.session?.currentInstance?.itemsTouched.filter((touch) => {
      return touch.status === 'completed'
    }) ?? []
    const completedCount = completedItems.length
    const completedPaths = completedItems.map(touch => touch.sourcePath)
    const entriesByPath = new Map((this.data?.data ?? []).map(entry => [entry.file.path, entry] as const))

    renderQueuePanel(queueEl, {
      phase,
      activeFilePath: state.activeFilePath,
      queueItems,
      app: this.plugin.app,
      actionExecutor: {
        executeAction: (action, targetPath) => {
          this.syncActiveViewStatusConfig()
          return this.plugin.store.executeAction(action, targetPath)
        },
        reorderQueueItem: (itemId, position) => this.plugin.store.reorderQueueItem(itemId, position),
        dispatch: action => this.plugin.store.dispatch(action),
      },
      completedCount,
      completedPaths,
      renderItemProperties: (item, li) => {
        const entry = entriesByPath.get(item.sourcePath)
        if (entry && typeof this.config?.getOrder === 'function') {
          renderOrderedEntryProperties(li, entry, this.config, this.plugin.app.renderContext)
        }
      },
      onSelectTask: (filePath) => {
        this.syncActiveViewStatusConfig()
        if (isSelector) {
          void handleSelectorWinner(this.plugin.store, phase, filePath, msg => new Notice(msg))
        }
        else {
          void this.plugin.store.dispatch({ type: 'start', filePath })
          void this.plugin.activateView()
        }
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
    const candidates = entries.map(entry => ({
      path: entry.file.path,
      basename: entry.file.basename,
      frontmatter: this.plugin.app.metadataCache.getFileCache(entry.file)?.frontmatter,
      getValue: (propId: BasesPropertyId) => entry.getValue(propId),
    }))
    const nextSources = new Map<TaskSourceId, TaskSource>()
    const preserveInputOrder = (typeof this.config?.getSort === 'function' ? this.config.getSort() : []).length > 0
    const statusProperty = this.getConfiguredStatusProperty()
    const doneStatusValue = this.getConfiguredDoneStatusValue()
    this.registeredSnapshots.clear()
    for (const phase of viewGraph.phases) {
      if (phase.taskSourceId !== null) {
        this.plugin.fallbackTaskSources?.clearForSource(phase.taskSourceId)
        const badgeProps = phase.badges?.map(b => b.property) ?? []
        const extraPropertiesLens = badgeProps.length > 0 ? badgeProps : undefined
        const filteredEntries = filterQueueCandidates(phase, this.config, candidates, undefined, { statusProperty })
        this.registeredSnapshots.set(phase.taskSourceId, {
          entries: filteredEntries,
          extraPropertiesLens,
          preserveInputOrder,
          statusProperty,
          doneStatusValue,
        })
        nextSources.set(
          phase.taskSourceId,
          createBaseQuerySource(filteredEntries, {
            extraPropertiesLens,
            preserveInputOrder,
            statusProperty,
            doneStatusValue,
          }),
        )
      }
    }
    if (this.plugin.taskSourceRegistry.replaceScope !== undefined) {
      this.plugin.taskSourceRegistry.replaceScope(this, nextSources)
    }
    else {
      this.plugin.taskSourceRegistry.unregisterScope?.(this)
      for (const [id, source] of nextSources.entries()) {
        this.plugin.taskSourceRegistry.register(id, source, this)
      }
    }
  }

  private getViewStatusOverride(key: 'statusProperty' | 'doneStatusValue'): string | undefined {
    const raw = this.config?.get(key)
    if (typeof raw !== 'string') {
      return undefined
    }
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  private getConfiguredStatusProperty(): string {
    const viewOverride = this.getViewStatusOverride('statusProperty')
    if (viewOverride !== undefined) {
      return viewOverride
    }
    const setting = this.plugin.settings?.statusProperty
    return typeof setting === 'string' && setting.trim().length > 0 ? setting.trim() : 'routine-status'
  }

  private getConfiguredDoneStatusValue(): string {
    const viewOverride = this.getViewStatusOverride('doneStatusValue')
    if (viewOverride !== undefined) {
      return viewOverride
    }
    const setting = this.plugin.settings?.doneStatusValue
    return typeof setting === 'string' && setting.trim().length > 0 ? setting.trim() : 'done'
  }

  private syncActiveViewStatusConfig(): void {
    this.plugin.setActiveViewStatusConfig?.({
      owner: this,
      statusProperty: this.getViewStatusOverride('statusProperty'),
      doneStatusValue: this.getViewStatusOverride('doneStatusValue'),
    })
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
      this.lastRenderSnapshot = null
      this.syncTaskSourcesIfActive()
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
    this.syncActiveViewStatusConfig()
    this.registerTaskSources(graph)
    void this.plugin.store.dispatch({ type: 'start' })
    void this.plugin.activateView()
  }

  private async handleReset(routineName: string): Promise<void> {
    const result = await new ResetConfirmModal(this.plugin.app, routineName).waitForResult()
    if (result !== 'confirmed') {
      return
    }
    this.checkedGuidanceItems.clear()
    void this.plugin.store.dispatch({ type: 'stop' })
  }

  static getViewOptions = getViewOptions
}

export { handleSelectorWinner } from '../timer/selector-winner'
