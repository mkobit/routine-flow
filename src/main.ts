import 'temporal-polyfill/global'
import { Notice, Plugin, TFile } from 'obsidian'
import { RoutineFlowSettingTab } from './settings/settings-tab'
import { DEFAULT_SETTINGS, type RoutineFlowSettings } from './settings/settings-types'
import { EngineStore } from './timer/store'
import type { HookEventApplication } from './timer/store'
import { TimerTicker } from './timer/ticker'
import { DEFAULT_PHASE_GRAPH, findPhaseById } from './timer/phase-graph-query'
import { resolveActiveFilePath } from './timer/queue-advance'
import { ObsidianFileMutationPort } from './adapters/obsidian/mutation/file-mutation-port'
import { ObsidianFrontmatterReader } from './adapters/obsidian/mutation/frontmatter-reader'
import { ACCUMULATOR_HOOK_NAME, createAccumulatorHook } from './timer/accumulator'
import { createWriteBackHook, WRITE_BACK_HOOK_NAME } from './timer/write-back'
import type { HookRegistry } from './domain/hook/hook'
import { createTaskSourceRegistry } from './timer/task-source-registry'
import type { MutableTaskSourceRegistry } from './timer/task-source-registry'
import { FallbackTaskSourceManager } from './timer/fallback-task-sources'
import { createFormulaPredicateRegistry } from './timer/formula-predicate-registry'
import type { MutableFormulaPredicateRegistry } from './timer/formula-predicate-registry'
import { createScriptHookRegistry } from './timer/script-hook-registry'
import type { MutableScriptHookRegistry } from './timer/script-hook-registry'
import { ObsidianNotificationPort } from './adapters/obsidian/notification/notification-port'
import { playFanfareChord } from './timer/fanfare'
import { RoutineTimerView } from './views/timer-view'
import { ObsidianWriteBackPromptPort } from './views/write-back-modal'
import { RoutineStatusBarItem } from './views/status-bar'
import { RoutineSidePanelView, SIDE_PANEL_VIEW_TYPE } from './views/side-panel-view'
import { RoutineGalleryModal } from './views/routine-gallery-modal'
import { EXAMPLE_FOLDER_PATH, scaffoldExampleRoutine } from './onboarding/scaffold-example'
import { RoutineReplaceModal } from './views/routine-replace-modal'
import { RoutinePickerModal } from './views/routine-picker-modal'
import { runCadenceRoutine } from './timer/routine-selection'
import { decideFileMenuAction, focusTaskInActiveRoutine, startRoutineForTask } from './timer/file-menu-action'
import type { PhaseGraph } from './domain/phase/phase-graph'

/** Surfaces a dispatched hook's invocation failures and failed FileMutation applications — mirrors the reporting main.ts's old write-back subscriber did inline. */
function reportFailedHookApplications(applications: readonly HookEventApplication[]): void {
  for (const application of applications) {
    const { outcome } = application
    if (outcome.stage === 'invocationFailed') {
      new Notice(`Routine Flow: hook invocation failed (${application.event}) — ${describeCause(outcome.cause)}`)
    }
    else if (!outcome.result.success) {
      const { mutation, cause } = outcome.result
      new Notice(`Routine Flow: write-back failed (${mutation.kind}) — ${describeCause(cause)}`)
    }
  }
}

const describeCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export interface ActiveViewStatusConfig {
  readonly owner: unknown
  readonly statusProperty?: string
  readonly doneStatusValue?: string
}

export default class RoutineFlowPlugin extends Plugin {
  public settings: RoutineFlowSettings = DEFAULT_SETTINGS
  public store!: EngineStore
  public ticker!: TimerTicker
  public taskSourceRegistry: MutableTaskSourceRegistry = createTaskSourceRegistry()
  public fallbackTaskSources: FallbackTaskSourceManager = new FallbackTaskSourceManager(this.taskSourceRegistry)
  public formulaPredicateRegistry: MutableFormulaPredicateRegistry = createFormulaPredicateRegistry()
  public scriptHookRegistry!: MutableScriptHookRegistry
  public hookRegistry!: HookRegistry
  private statusBarItem!: RoutineStatusBarItem
  private activeViewStatusConfig: ActiveViewStatusConfig | null = null

  public setActiveViewStatusConfig(config: ActiveViewStatusConfig | null): void {
    this.activeViewStatusConfig = config
  }

  public getActiveViewStatusConfigOwner(): unknown {
    return this.activeViewStatusConfig?.owner ?? null
  }

  public getEffectiveStatusProperty(): string {
    return nonEmpty(this.activeViewStatusConfig?.statusProperty)
      ?? nonEmpty(this.settings.statusProperty)
      ?? 'routine-status'
  }

  public getEffectiveDoneStatusValue(): string {
    return nonEmpty(this.activeViewStatusConfig?.doneStatusValue)
      ?? nonEmpty(this.settings.doneStatusValue)
      ?? 'done'
  }

  async onload() {
    await this.loadSettings()
    this.formulaPredicateRegistry.setFormulas(this.settings.formulaPredicates)
    const frontmatterReader = new ObsidianFrontmatterReader(this.app)
    this.scriptHookRegistry = createScriptHookRegistry({ frontmatterReader })
    this.scriptHookRegistry.setBindings(this.settings.scriptHookBindings)
    const port = new ObsidianFileMutationPort({
      vault: this.app.vault,
      fileManager: this.app.fileManager,
      getStatusProperty: () => this.getEffectiveStatusProperty(),
      getDoneStatusValue: () => this.getEffectiveDoneStatusValue(),
    })

    const writeBackHook = createWriteBackHook({
      // No built-in named log-target resolver ships — DEFAULT_PHASE_GRAPH only uses
      // 'activeItem'. This registry exists for a routine author to register their own
      // named resolver (e.g. via a script hook reading Obsidian's daily-notes internals)
      // for phases with no active queue item to write back to.
      logTargetResolverRegistry: { resolve: () => undefined },
      frontmatterReader,
      writeBackPrompt: new ObsidianWriteBackPromptPort(this.app),
      getWriteBackProperty: () => this.settings.writeBackProperty,
      getConfirmWriteBack: () => this.settings.confirmWriteBack,
    })
    const accumulatorHook = createAccumulatorHook({
      frontmatterReader,
      taskSourceRegistry: this.taskSourceRegistry,
      getTrackerFilePath: () => this.store.getGraph().trackerFilePath ?? null,
    })
    this.hookRegistry = {
      resolve: (name) => {
        if (name === WRITE_BACK_HOOK_NAME) {
          return writeBackHook
        }
        if (name === ACCUMULATOR_HOOK_NAME) {
          return accumulatorHook
        }
        return this.scriptHookRegistry.resolve(name)
      },
    }
    this.store = new EngineStore(DEFAULT_PHASE_GRAPH, {
      hookRegistry: this.hookRegistry,
      port,
      predicateRegistry: this.formulaPredicateRegistry,
      taskSourceRegistry: this.taskSourceRegistry,
      notificationPort: new ObsidianNotificationPort(),
      frontmatterReader,
      audioCuePort: {
        playFanfare: () => playFanfareChord(),
      },
    })
    this.ticker = new TimerTicker(
      (action) => {
        void this.store.dispatch(action).then(reportFailedHookApplications, (cause: unknown) => {
          new Notice(`Routine Flow: hook dispatch failed — ${describeCause(cause)}`)
        })
      },
      () => Math.max(10, Math.round(1000 / Math.max(1, this.settings.clockSpeedMultiplier))),
    )

    // Handle background ticker transitions
    this.store.subscribe((state) => {
      if (state.status === 'running') {
        this.ticker.start()
      }
      else {
        this.ticker.stop()
      }
      if (state.status === 'stopped') {
        this.fallbackTaskSources.clearAll()
        this.activeViewStatusConfig = null
      }
    })

    this.registerEvent(
      this.app.metadataCache.on('changed', (file, _data, cache) => {
        if (this.fallbackTaskSources.handleFileChanged(file.path, cache.frontmatter)) {
          this.syncAfterFallbackChange()
        }
      }),
    )
    this.registerEvent(
      this.app.metadataCache.on('deleted', (file) => {
        if (this.fallbackTaskSources.handleFileDeleted(file.path)) {
          this.syncAfterFallbackChange()
        }
      }),
    )
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        const basename = file instanceof TFile ? file.basename : file.name
        if (this.fallbackTaskSources.handleFileRenamed(oldPath, file.path, basename)) {
          this.syncAfterFallbackChange()
        }
      }),
    )

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') {
          return
        }
        if (this.app.metadataCache.getFileCache(file)?.frontmatter?.['is-routine'] === true) {
          return
        }
        const actionKind = decideFileMenuAction(this.store.getState().status)
        if (actionKind === 'focus') {
          menu.addItem((item) => {
            item
              .setTitle('Focus in active routine')
              .setIcon('timer')
              .onClick(() => {
                void focusTaskInActiveRoutine(file.path, {
                  dispatchStart: filePath => this.store.dispatch({ type: 'start', filePath }),
                  activateView: () => this.activateView(),
                })
              })
          })
          return
        }

        menu.addItem((item) => {
          item
            .setTitle('Start routine for task')
            .setIcon('timer')
            .onClick(() => {
              const routineFiles = this.app.vault.getMarkdownFiles().filter((candidate) => {
                return this.app.metadataCache.getFileCache(candidate)?.frontmatter?.['is-routine'] === true
              })
              const deps = {
                clearActiveViewStatusConfig: () => {
                  this.activeViewStatusConfig = null
                },
                setGraph: (graph: PhaseGraph) => {
                  this.store.setGraph(graph)
                },
                dispatchStart: (filePath: string) => this.store.dispatch({ type: 'start', filePath }),
                activateView: () => this.activateView(),
                readRoutineFile: async (path: string) => {
                  const target = this.app.vault.getFileByPath(path)
                  return target !== null ? this.app.vault.cachedRead(target) : ''
                },
                showNotice: (message: string) => {
                  new Notice(message)
                },
              }

              if (routineFiles.length === 0) {
                void startRoutineForTask(file.path, null, deps)
                return
              }

              new RoutinePickerModal(this.app, routineFiles, (choice) => {
                const candidate = choice.kind === 'file'
                  ? { path: choice.file.path, label: choice.file.basename }
                  : null
                void startRoutineForTask(file.path, candidate, deps)
              }).open()
            })
        })
      }),
    )

    this.registerBasesView(
      'routine-timer',
      {
        name: 'Routine Timer',
        icon: 'timer',
        factory: (controller, containerEl) => new RoutineTimerView(
          controller,
          containerEl,
          this,
        ),
        options: () => RoutineTimerView.getViewOptions(this.app),
      },
    )

    this.registerView(SIDE_PANEL_VIEW_TYPE, leaf => new RoutineSidePanelView(leaf, this))
    this.addRibbonIcon('timer', 'Open routine panel', () => void this.activateView())
    this.addCommand({
      id: 'open-routine-panel',
      name: 'Open routine panel',
      callback: () => void this.activateView(),
    })
    this.addCommand({
      id: 'open-routine-gallery',
      name: 'Browse routine templates',
      callback: () => {
        new RoutineGalleryModal(this.app).open()
      },
    })
    this.addCommand({
      id: 'seed-example-routine',
      name: 'Seed example routine',
      callback: async () => {
        const result = await scaffoldExampleRoutine(this.app.vault)
        if (result.createdPaths.length > 0) {
          new Notice(`Routine Flow: created ${String(result.createdPaths.length)} example file(s) in ${EXAMPLE_FOLDER_PATH}/`)
        }
        else {
          new Notice(`Routine Flow: example files already exist in ${EXAMPLE_FOLDER_PATH}/`)
        }
      },
    })
    this.addCommand({
      id: 'run-scheduled-cadence',
      name: 'Run scheduled cadence',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile()
        const tags = activeFile !== null
          ? this.app.metadataCache.getFileCache(activeFile)?.frontmatter?.tags
          : undefined
        const tagList = Array.isArray(tags)
          ? tags.filter((t): t is string => typeof t === 'string')
          : typeof tags === 'string'
            ? [tags]
            : undefined

        const result = await runCadenceRoutine(
          this.settings.cadenceRules,
          {
            now: Temporal.Now.instant(),
            tags: tagList,
          },
          {
            readRoutineFile: async (path: string) => {
              const file = this.app.vault.getFileByPath(path)
              return file !== null ? this.app.vault.cachedRead(file) : null
            },
            getActiveRoutine: () => {
              const graph = this.store.getGraph()
              return {
                graphId: graph.id,
                graphName: graph.name,
                status: this.store.getState().status,
              }
            },
            confirmReplace: async (currentRoutineName: string, nextRoutineName: string) => {
              return new RoutineReplaceModal(this.app, currentRoutineName, nextRoutineName).waitForResult()
            },
            setGraph: (graph) => {
              this.activeViewStatusConfig = null
              this.store.setGraph(graph)
            },
            dispatch: async (action) => {
              return this.store.dispatch(action)
            },
            activateView: async () => {
              await this.activateView()
            },
          },
        )

        if (result === 'no-match') {
          new Notice('Routine Flow: no matching cadence routine for current time and context')
        }
        else if (result === 'file-not-found') {
          new Notice('Routine Flow: scheduled cadence routine file not found')
        }
        else if (result === 'parse-error') {
          new Notice('Routine Flow: failed to parse scheduled cadence routine file')
        }
      },
    })

    this.addSettingTab(new RoutineFlowSettingTab(this.app, this))

    this.statusBarItem = new RoutineStatusBarItem(this)
    this.statusBarItem.load()
  }

  onunload() {
    this.ticker.stop()
    this.statusBarItem.unload()
  }

  private syncAfterFallbackChange(): void {
    const state = this.store.getState()
    const phase = findPhaseById(this.store.getGraph(), state.currentPhaseId)
    if (phase !== undefined && phase.taskSourceId !== null) {
      const queuePaths = this.taskSourceRegistry.resolve(phase.taskSourceId)?.getQueue().map(i => i.sourcePath)
      if (queuePaths !== undefined) {
        const resolved = resolveActiveFilePath(state.activeFilePath, queuePaths)
        if (resolved !== state.activeFilePath) {
          void this.store.dispatch({ type: 'set-active-file', filePath: resolved })
        }
      }
    }
    void this.store.syncQueueExhausted()
  }

  public async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE)[0]
    if (existing !== undefined) {
      await this.app.workspace.revealLeaf(existing)
      return
    }
    const leaf = this.app.workspace.getRightLeaf(false)
    if (leaf === null) {
      return
    }
    await leaf.setViewState({ type: SIDE_PANEL_VIEW_TYPE, active: true })
    await this.app.workspace.revealLeaf(leaf)
  }

  async loadSettings() {
    const loaded: Partial<RoutineFlowSettings> = await this.loadData()
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded)
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
