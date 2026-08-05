import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, type RoutineFlowSettings, RoutineFlowSettingTab } from './settings'
import { EngineStore } from './timer/store'
import type { HookEventApplication } from './timer/store'
import { TimerTicker } from './timer/ticker'
import { DEFAULT_PHASE_GRAPH } from './timer/phase-graph'
import { ObsidianFileMutationPort } from './timer/obsidian-file-mutation-port'
import { ObsidianFrontmatterReader } from './timer/obsidian-frontmatter-reader'
import { createWriteBackHook, WRITE_BACK_HOOK_NAME } from './timer/write-back'
import type { HookRegistry } from './domain/hook/hook'
import { createTaskSourceRegistry } from './timer/task-source-registry'
import type { MutableTaskSourceRegistry } from './timer/task-source-registry'
import { createFormulaPredicateRegistry } from './timer/formula-predicate-registry'
import type { MutableFormulaPredicateRegistry } from './timer/formula-predicate-registry'
import { createScriptHookRegistry } from './timer/script-hook-registry'
import type { MutableScriptHookRegistry } from './timer/script-hook-registry'
import { RoutineTimerView } from './views/timer-view'
import { ObsidianWriteBackPromptPort } from './views/write-back-modal'
import { RoutineStatusBarItem } from './views/status-bar'
import { RoutineSidePanelView, SIDE_PANEL_VIEW_TYPE } from './views/side-panel-view'

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

export default class RoutineFlowPlugin extends Plugin {
  public settings: RoutineFlowSettings = DEFAULT_SETTINGS
  public store!: EngineStore
  public ticker!: TimerTicker
  public taskSourceRegistry: MutableTaskSourceRegistry = createTaskSourceRegistry()
  public formulaPredicateRegistry: MutableFormulaPredicateRegistry = createFormulaPredicateRegistry()
  public scriptHookRegistry!: MutableScriptHookRegistry
  public hookRegistry!: HookRegistry
  private statusBarItem!: RoutineStatusBarItem

  async onload() {
    await this.loadSettings()
    this.formulaPredicateRegistry.setFormulas(this.settings.formulaPredicates)
    const frontmatterReader = new ObsidianFrontmatterReader(this.app)
    this.scriptHookRegistry = createScriptHookRegistry({ frontmatterReader })
    this.scriptHookRegistry.setBindings(this.settings.scriptHookBindings)
    const port = new ObsidianFileMutationPort(this.app)

    const writeBackHook = createWriteBackHook({
      // No built-in named log-target resolver ships — DEFAULT_PHASE_GRAPH only uses
      // 'activeItem'. This registry exists for a routine author to register their own
      // named resolver (e.g. via a script hook reading Obsidian's daily-notes internals)
      // for phases with no active queue item to write back to.
      logTargetResolverRegistry: { resolve: () => undefined },
      frontmatterReader,
      writeBackPrompt: new ObsidianWriteBackPromptPort(this.app),
      getWriteBackProperty: () => this.settings.writeBackProperty,
    })
    this.hookRegistry = {
      resolve: name => name === WRITE_BACK_HOOK_NAME ? writeBackHook : this.scriptHookRegistry.resolve(name),
    }
    this.store = new EngineStore(DEFAULT_PHASE_GRAPH, {
      hookRegistry: this.hookRegistry,
      port,
      predicateRegistry: this.formulaPredicateRegistry,
      taskSourceRegistry: this.taskSourceRegistry,
    })
    this.ticker = new TimerTicker((action) => {
      void this.store.dispatch(action).then(reportFailedHookApplications, (cause: unknown) => {
        new Notice(`Routine Flow: hook dispatch failed — ${describeCause(cause)}`)
      })
    })

    // Handle background ticker transitions
    this.store.subscribe((state) => {
      if (state.status === 'running') {
        this.ticker.start()
      }
      else {
        this.ticker.stop()
      }
    })

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

    this.addSettingTab(new RoutineFlowSettingTab(this.app, this))

    this.statusBarItem = new RoutineStatusBarItem(this)
    this.statusBarItem.load()
  }

  onunload() {
    this.ticker.stop()
    this.statusBarItem.unload()
  }

  private async activateView(): Promise<void> {
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
