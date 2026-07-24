import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, type PomodoroSettings, PomodoroSettingTab } from './settings'
import { EngineStore } from './timer/store'
import type { HookEventApplication } from './timer/store'
import { TimerTicker } from './timer/ticker'
import { POMODORO_PHASE_GRAPH } from './timer/phase-graph'
import { ObsidianFileMutationPort } from './timer/obsidian-file-mutation-port'
import { ObsidianFrontmatterReader } from './timer/obsidian-frontmatter-reader'
import { createWriteBackHook, WRITE_BACK_HOOK_NAME } from './timer/write-back'
import type { HookRegistry } from './domain/hook/hook'
import type { PredicateRegistry } from './domain/hook/predicate'
import { createTaskSourceRegistry } from './timer/task-source-registry'
import type { MutableTaskSourceRegistry } from './timer/task-source-registry'
import { PomodoroTimerView } from './views/timer-view'
import { ObsidianWriteBackPromptPort } from './views/write-back-modal'
import { PomodoroStatusBarItem } from './views/status-bar'
import { PomodoroSidePanelView, SIDE_PANEL_VIEW_TYPE } from './views/side-panel-view'

/** Surfaces a dispatched hook's failed FileMutation applications — mirrors the reporting main.ts's old write-back subscriber did inline. */
function reportFailedHookApplications(applications: readonly HookEventApplication[]): void {
  for (const application of applications) {
    if (!application.result.success) {
      const { mutation, cause } = application.result
      new Notice(`Pomodoro: write-back failed (${mutation.kind}) — ${describeCause(cause)}`)
    }
  }
}

const describeCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS
  public store!: EngineStore
  public ticker!: TimerTicker
  public taskSourceRegistry: MutableTaskSourceRegistry = createTaskSourceRegistry()
  private statusBarItem!: PomodoroStatusBarItem

  async onload() {
    await this.loadSettings()
    const port = new ObsidianFileMutationPort(this.app)

    const writeBackHook = createWriteBackHook({
      // No named log-target resolver (e.g. 'dailyNote') is registered yet — see design.md decision 2.
      logTargetResolverRegistry: { resolve: () => undefined },
      frontmatterReader: new ObsidianFrontmatterReader(this.app),
      writeBackPrompt: new ObsidianWriteBackPromptPort(this.app),
      getWriteBackProperty: () => this.settings.writeBackProperty,
    })
    const hookRegistry: HookRegistry = {
      resolve: name => name === WRITE_BACK_HOOK_NAME ? writeBackHook : undefined,
    }
    // No custom TransitionCondition predicate registered anywhere yet — see flow-b74/flow-gu1.10.
    const predicateRegistry: PredicateRegistry = { resolve: () => undefined }
    this.store = new EngineStore(POMODORO_PHASE_GRAPH, { hookRegistry, port, predicateRegistry, taskSourceRegistry: this.taskSourceRegistry })
    this.ticker = new TimerTicker((action) => {
      void this.store.dispatch(action).then(reportFailedHookApplications, (cause: unknown) => {
        new Notice(`Pomodoro: hook dispatch failed — ${describeCause(cause)}`)
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
      'pomodoro-timer',
      {
        name: 'Pomodoro Timer',
        icon: 'timer',
        factory: (controller, containerEl) => new PomodoroTimerView(
          controller,
          containerEl,
          this,
        ),
        options: () => PomodoroTimerView.getViewOptions(this.app),
      },
    )

    this.registerView(SIDE_PANEL_VIEW_TYPE, leaf => new PomodoroSidePanelView(leaf, this))
    this.addRibbonIcon('timer', 'Open routine panel', () => void this.activateView())
    this.addCommand({
      id: 'open-routine-panel',
      name: 'Open routine panel',
      callback: () => void this.activateView(),
    })

    this.addSettingTab(new PomodoroSettingTab(this.app, this))

    this.statusBarItem = new PomodoroStatusBarItem(this)
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
    const loaded: Partial<PomodoroSettings> = await this.loadData()
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded)
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
