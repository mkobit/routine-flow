import { beforeAll, mock, test, expect, describe } from 'bun:test'

class MockElement {
  className = ''
  children: MockElement[] = []
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}

  addClass(cls: string): void {
    const current = this.className.split(' ').filter(Boolean)
    if (!current.includes(cls)) {
      current.push(cls)
    }
    this.className = current.join(' ')
  }

  removeClass(cls: string): void {
    const current = this.className.split(' ').filter(Boolean)
    this.className = current.filter(c => c !== cls).join(' ')
  }

  hasClass(cls: string): boolean {
    return this.className.split(' ').filter(Boolean).includes(cls)
  }

  empty(): void {
    this.children = []
  }

  createEl(tag: string, o?: { text?: string, cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    return child
  }

  createDiv(o?: { cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    return child
  }

  createSpan(o?: { text?: string, cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    return child
  }

  setText(_txt: string): void {}

  hide(): void {}

  show(): void {}

  addEventListener(): void {}
}

class MockModal {
  containerEl = new MockElement()
  modalEl = new MockElement()
  contentEl = new MockElement()
  titleEl = new MockElement()

  setTitle(_t: string): void {}

  open(): void {}

  close(): void {}
}

class MockItemView {
  containerEl = new MockElement()
  contentEl = new MockElement()
}

class MockWorkspaceLeaf {
  containerEl = new MockElement()
}

class MockPlugin {
  constructor(public app: unknown = {}, public manifest: unknown = {}) {}
}

void mock.module('obsidian', () => {
  return {
    PluginSettingTab: class {
      containerEl = new MockElement()
    },
    Setting: class {
      settingEl = new MockElement()

      constructor(_container: MockElement) {}

      addButton(fn: (b: unknown) => void): this {
        const btn = {
          setButtonText: () => btn,
          setCta: () => btn,
          setWarning: () => btn,
          onClick: () => btn,
        }
        fn(btn)
        return this
      }

      addToggle(): this {
        return this
      }

      addText(): this {
        return this
      }

      addDropdown(): this {
        return this
      }
    },
    Modal: MockModal,
    ItemView: MockItemView,
    WorkspaceLeaf: MockWorkspaceLeaf,
    Notice: class {},
    AbstractInputSuggest: class {},
    App: class {},
    Plugin: MockPlugin,
    TFile: class {},
    setIcon: () => {},
  }
})

import type { Temporal as TemporalType } from 'temporal-polyfill'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import type { RoutineSidePanelView as RoutineSidePanelViewType } from '../src/views/side-panel-view'
import type { RoutineStatusBarItem as RoutineStatusBarItemType } from '../src/views/status-bar'
import type { ResetConfirmModal as ResetConfirmModalType } from '../src/views/reset-confirm-modal'
import type { ScriptHookConfirmModal as ScriptHookConfirmModalType } from '../src/views/script-hook-confirm-modal'
import type { EngineStore as EngineStoreType } from '../src/timer/store'
import type { RoutineFlowSettings } from '../src/settings'
import type RoutineFlowPlugin from '../src/main'
import type { App as AppType, WorkspaceLeaf as WorkspaceLeafType } from 'obsidian'

let Temporal: typeof TemporalType
let RoutineSidePanelView: typeof RoutineSidePanelViewType
let RoutineStatusBarItem: typeof RoutineStatusBarItemType
let ResetConfirmModal: typeof ResetConfirmModalType
let ScriptHookConfirmModal: typeof ScriptHookConfirmModalType
let EngineStore: typeof EngineStoreType
let DEFAULT_SETTINGS: RoutineFlowSettings
let customCssGraph: PhaseGraph
let AppConstructor: typeof AppType
let WorkspaceLeafConstructor: typeof WorkspaceLeafType

class TestRoutinePlugin extends MockPlugin {
  store: EngineStoreType
  settings: RoutineFlowSettings
  formulaPredicateRegistry = { setFormulas: () => {}, get: () => undefined }
  statusEl = new MockElement()

  constructor(store: EngineStoreType) {
    super(new AppConstructor(), { id: 'test', name: 'Test', version: '1.0', minAppVersion: '0.15', description: '' })
    this.store = store
    this.settings = DEFAULT_SETTINGS
  }

  addStatusBarItem(): HTMLElement {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock HTMLElement for status bar
    return this.statusEl as unknown as HTMLElement
  }
}

describe('CSS class scoping & theme customization', () => {
  beforeAll(async () => {
    const polyfill = await import('temporal-polyfill')
    Temporal = polyfill.Temporal

    const obsidianModule = await import('obsidian')
    AppConstructor = obsidianModule.App
    WorkspaceLeafConstructor = obsidianModule.WorkspaceLeaf

    const phaseGraphModule = await import('../src/domain/phase/phase-graph')
    const phaseModule = await import('../src/domain/phase/phase')
    const sidePanelModule = await import('../src/views/side-panel-view')
    const statusBarModule = await import('../src/views/status-bar')
    const resetModalModule = await import('../src/views/reset-confirm-modal')
    const scriptModalModule = await import('../src/views/script-hook-confirm-modal')
    const storeModule = await import('../src/timer/store')
    const settingsModule = await import('../src/settings')

    RoutineSidePanelView = sidePanelModule.RoutineSidePanelView
    RoutineStatusBarItem = statusBarModule.RoutineStatusBarItem
    ResetConfirmModal = resetModalModule.ResetConfirmModal
    ScriptHookConfirmModal = scriptModalModule.ScriptHookConfirmModal
    EngineStore = storeModule.EngineStore
    DEFAULT_SETTINGS = settingsModule.DEFAULT_SETTINGS

    const phaseDefaults = {
      logTarget: { kind: 'activeItem' as const },
      taskSourceId: null,
      completionPolicy: null,
      notification: null,
      onEnter: null,
      onComplete: null,
      onSkip: null,
      onExit: null,
    } as const

    const focusId = phaseModule.PhaseIdSchema.parse('focus-custom')
    const breakId = phaseModule.PhaseIdSchema.parse('break-custom')
    const graphId = phaseGraphModule.PhaseGraphIdSchema.parse('themed-routine')

    customCssGraph = phaseGraphModule.PhaseGraphSchema.parse({
      id: graphId,
      name: 'Themed Routine',
      cssClass: 'theme-custom-routine',
      phases: [
        phaseModule.PhaseSchema.parse({
          ...phaseDefaults,
          id: focusId,
          label: 'Focus Phase',
          kind: phaseModule.PhaseKindSchema.parse('focus'),
          duration: Temporal.Duration.from({ minutes: 25 }),
          cssClass: 'theme-focus-phase',
        }),
        phaseModule.PhaseSchema.parse({
          ...phaseDefaults,
          id: breakId,
          label: 'Break Phase',
          kind: phaseModule.PhaseKindSchema.parse('break'),
          duration: Temporal.Duration.from({ minutes: 5 }),
          cssClass: 'theme-break-phase',
        }),
      ],
      transitions: [
        { fromPhaseId: focusId, toPhaseId: breakId, condition: { kind: 'always' } },
      ],
    })
  })

  test('RoutineSidePanelView applies and cleanly updates graph and phase cssClasses', async () => {
    const store = new EngineStore(customCssGraph)
    const mockPlugin = new TestRoutinePlugin(store)
    const leaf = new WorkspaceLeafConstructor()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock RoutineFlowPlugin for view creation
    const sidePanel = new RoutineSidePanelView(leaf, mockPlugin as unknown as RoutineFlowPlugin)
    await sidePanel.onOpen()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const contentEl = sidePanel.contentEl as unknown as MockElement
    expect(contentEl.hasClass('routine-side-panel')).toBe(true)

    // Start routine -> focus phase
    await store.dispatch({ type: 'start' })
    expect(contentEl.hasClass('routine-side-panel')).toBe(true)
    expect(contentEl.hasClass('is-running')).toBe(true)
    expect(contentEl.hasClass('theme-custom-routine')).toBe(true)
    expect(contentEl.hasClass('theme-focus-phase')).toBe(true)

    // Advance to break phase
    await store.dispatch({ type: 'advance-phase' })
    await store.dispatch({ type: 'start' })
    expect(contentEl.hasClass('theme-custom-routine')).toBe(true)
    expect(contentEl.hasClass('theme-break-phase')).toBe(true)
    // Verify focus phase class is NOT retained
    expect(contentEl.hasClass('theme-focus-phase')).toBe(false)
  })

  test('RoutineStatusBarItem applies and updates graph/phase cssClasses', async () => {
    const store = new EngineStore(customCssGraph)
    const mockPlugin = new TestRoutinePlugin(store)
    const statusEl = mockPlugin.statusEl

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock RoutineFlowPlugin for status bar item
    const statusBarItem = new RoutineStatusBarItem(mockPlugin as unknown as RoutineFlowPlugin)
    statusBarItem.load()

    expect(statusEl.hasClass('routine-status-bar-item')).toBe(true)

    await store.dispatch({ type: 'start' })
    expect(statusEl.hasClass('routine-status-bar-item')).toBe(true)
    expect(statusEl.hasClass('is-running')).toBe(true)
    expect(statusEl.hasClass('theme-custom-routine')).toBe(true)
    expect(statusEl.hasClass('theme-focus-phase')).toBe(true)

    await store.dispatch({ type: 'pause' })
    expect(statusEl.hasClass('is-paused')).toBe(true)

    await store.dispatch({ type: 'advance-phase' })
    await store.dispatch({ type: 'start' })
    expect(statusEl.hasClass('theme-break-phase')).toBe(true)
    expect(statusEl.hasClass('theme-focus-phase')).toBe(false)

    statusBarItem.unload()
  })

  test('ResetConfirmModal sets routine-reset-confirm-modal class', () => {
    const app = new AppConstructor()
    const modal = new ResetConfirmModal(app, 'My Routine')
    modal.onOpen()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const modalEl = modal.modalEl as unknown as MockElement
    expect(modalEl.hasClass('routine-reset-confirm-modal')).toBe(true)
  })

  test('ScriptHookConfirmModal sets routine-script-hook-confirm-modal class', () => {
    const app = new AppConstructor()
    const modal = new ScriptHookConfirmModal(app, 'scripts/my-hook.js', 'console.log("hello")')
    modal.onOpen()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const modalEl = modal.modalEl as unknown as MockElement
    expect(modalEl.hasClass('routine-script-hook-confirm-modal')).toBe(true)
  })
})
