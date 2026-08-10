import { BasesView, setIcon } from 'obsidian'
import type { BasesOptions, QueryController, App, TFile, BasesPropertyId, BasesEntry } from 'obsidian'
import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase } from '../domain/phase/phase'
import { findNextPhase, findPhaseById, FOCUS_PHASE_KIND, DEFAULT_PHASE_GRAPH } from '../timer/phase-graph'
import { formatCountdown } from '../timer/format'
import { computeProgressFraction } from '../timer/progress'
import { progressMeterStyleClass } from '../timer/progress-meter-style'
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
      const errorEl = this.containerEl.createDiv({ cls: 'routine-error' })
      this.renderStateIcon(errorEl, ['circle-alert', 'alert-circle'])
      errorEl.createEl('p', { text: `Routine error: ${this.routineResolution.error.message}` })
      return
    }

    if (this.routineResolution.kind === 'loading') {
      const loadingEl = this.containerEl.createDiv({ cls: 'routine-loading' })
      this.renderStateIcon(loadingEl, ['loader-circle', 'loader-2'])
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
    // Discrete transport state as a class (never inline style) so a CSS snippet can retheme each
    // state -- e.g. the paused accent (see styles.css / DESIGN.md color table).
    timerPanel.addClass(`is-${state.status}`)

    // Stopwatch header: a single <h2> (what e2e queries) whose child spans read as a watch face --
    // the phase label above the dial, the mm:ss digits inside/over the progress ring, the status
    // below. The concatenated text stays byte-identical to formatPhaseHeader() output ("Focus: 25:00
    // (running)" / "Set (stopped)"), so every existing header assertion still holds -- see format.ts.
    const countdownTime = formatCountdown(state.remaining)
    const header = timerPanel.createEl('h2', { cls: 'routine-countdown' })
    header.createSpan({
      cls: 'routine-countdown-label',
      text: countdownTime === null ? phase.label : `${phase.label}: `,
    })
    if (countdownTime !== null) {
      const dial = header.createSpan({ cls: 'routine-countdown-dial' })
      // Selects the active built-in style (flow-gu1.19.15.4 setting) via a class toggle on the
      // dial (DESIGN.md: "route all visual state through class toggles") -- 'radial' is the CSS
      // default and needs no class.
      const styleClass = progressMeterStyleClass(this.plugin.settings.progressMeterStyle)
      if (styleClass !== null) {
        dial.addClass(styleClass)
      }
      // Radial progress ring, sized to the dial so it frames just the mm:ss digits. Rendered for
      // this view's own timed phase; skipped for the inert state (the countdown isn't this view's
      // own). A stopped phase still shows the ring at 0 as a "ready" backdrop.
      if (!isInert && phase.duration !== null && state.remaining !== null) {
        const fraction = computeProgressFraction(phase.duration, state.remaining)
        // --routine-flow-progress is continuously-varying per-tick runtime data, not a discrete
        // visual state a snippet should override, so setting it inline is allowed (DESIGN.md). The
        // ring's appearance (stroke/color/width) stays entirely in styles.css, driven off this value
        // plus theme vars, so a snippet can still restyle the whole look via classes/vars.
        dial.style.setProperty('--routine-flow-progress', String(fraction))
        const ring = dial.createSvg('svg', { cls: 'routine-progress-ring', attr: { viewBox: '0 0 100 100' } })
        ring.createSvg('circle', { cls: 'routine-progress-track', attr: { cx: 50, cy: 50, r: 45, pathLength: 100 } })
        ring.createSvg('circle', { cls: 'routine-progress-indicator', attr: { cx: 50, cy: 50, r: 45, pathLength: 100 } })

        // Alternate built-in style (flow-gu1.19.15.1): a linear fill-bar, driven by the same
        // --routine-flow-progress set above -- no separate JS-side computation. Always rendered
        // alongside the ring; CSS hides it by default and shows it instead of the ring only when
        // the style-class toggle set above selects it (styles.css).
        const fillBar = dial.createDiv({ cls: 'routine-progress-fill-bar' })
        const fillBarTrack = fillBar.createDiv({ cls: 'routine-progress-fill-bar-track' })
        fillBarTrack.createDiv({ cls: 'routine-progress-fill-bar-indicator' })

        // Alternate built-in style (flow-gu1.19.15.2): a battery-drain meter, same
        // --routine-flow-progress contract and always-rendered/CSS-selected pattern as the
        // fill-bar above. The -cap div is the small terminal nub that reads the shape as a battery
        // rather than a plain bar.
        const batteryDrain = dial.createDiv({ cls: 'routine-progress-battery-drain' })
        const batteryDrainTrack = batteryDrain.createDiv({ cls: 'routine-progress-battery-drain-track' })
        batteryDrainTrack.createDiv({ cls: 'routine-progress-battery-drain-indicator' })
        batteryDrain.createDiv({ cls: 'routine-progress-battery-drain-cap' })

        // Alternate built-in style (flow-gu1.19.15.3): a tick-marks meter -- a row of discrete
        // segments that light up left-to-right as --routine-flow-progress advances, same contract
        // as the ring/fill-bar/battery-drain above. Last of the three alternate styles named in
        // flow-gu1.19.15.
        const tickMarks = dial.createDiv({ cls: 'routine-progress-tick-marks' })
        const tickMarksTrack = tickMarks.createDiv({ cls: 'routine-progress-tick-marks-track' })
        tickMarksTrack.createDiv({ cls: 'routine-progress-tick-marks-indicator' })
      }
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
      this.renderStateIcon(inertEl, ['info'])
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
      return
    }

    const queueTitle = phase.kind === FOCUS_PHASE_KIND ? 'Work queue' : 'Break queue'
    const queueItems = this.plugin.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue() ?? []

    // Queue Panel
    const queueEl = this.containerEl.createDiv({ cls: 'routine-queue' })
    queueEl.createEl('h3', { text: queueTitle })

    if (queueItems.length === 0) {
      const emptyEl = queueEl.createDiv({ cls: 'routine-queue-empty' })
      this.renderStateIcon(emptyEl, ['inbox', 'list-x'])
      emptyEl.createEl('p', { text: 'No notes match — check this routine\'s queue filter.' })
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
   * Renders the first Lucide icon name that resolves into a fresh child span. `setIcon` no-ops
   * (leaves the element empty) for an unknown name, so listing fallbacks absorbs Lucide's
   * cross-version renames (e.g. `loader-2` -> `loader-circle`) without pinning to one alias --
   * which alias the bundled Obsidian version ships is version-dependent (see DESIGN.md iconography).
   */
  private renderStateIcon(parent: HTMLElement, names: readonly string[]): void {
    const iconEl = parent.createSpan({ cls: 'routine-state-icon' })
    for (const name of names) {
      setIcon(iconEl, name)
      if (iconEl.childElementCount > 0) {
        return
      }
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
