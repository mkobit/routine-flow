import { beforeAll, mock, test, expect, describe } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

class MockElement {
  className = ''
  children: MockElement[] = []
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  childElementCount = 0

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
    this.childElementCount = 0
  }

  createEl(tag: string, o?: { text?: string, cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createDiv(o?: { cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createSpan(o?: { text?: string, cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createSvg(tag: string, o?: { cls?: string }): MockElement {
    const child = new MockElement()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  setText(_txt: string): void {}

  hide(): void {}

  show(): void {}

  focus(): void {}

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

      setClass(_cls: string): this {
        return this
      }

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

      addText(fn?: (t: unknown) => void): this {
        if (fn) {
          const txt = {
            setPlaceholder: () => txt,
            onChange: () => txt,
          }
          fn(txt)
        }
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
    AbstractInputSuggest: class {
      onSelect(): void {}
      close(): void {}
    },
    App: class {
      vault = {
        getFiles: () => [],
        getFileByPath: () => null,
      }
    },
    Plugin: MockPlugin,
    TFile: class {},
    setIcon: (el: MockElement, _name: string) => {
      el.createSpan()
    },
  }
})

import type { Temporal as TemporalType } from 'temporal-polyfill'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import type { RoutineSidePanelView as RoutineSidePanelViewType } from '../src/views/side-panel-view'
import type { RoutineStatusBarItem as RoutineStatusBarItemType } from '../src/views/status-bar'
import type { ResetConfirmModal as ResetConfirmModalType } from '../src/views/reset-confirm-modal'
import type { ScriptHookConfirmModal as ScriptHookConfirmModalType } from '../src/views/script-hook-confirm-modal'
import type { WriteBackModal as WriteBackModalType } from '../src/views/write-back-modal'
import type { RoutineReplaceModal as RoutineReplaceModalType } from '../src/views/routine-replace-modal'
import type { RoutineGalleryModal as RoutineGalleryModalType } from '../src/views/routine-gallery-modal'
import type { RoutineFlowSettingTab as RoutineFlowSettingTabType } from '../src/settings'
import type { EngineStore as EngineStoreType } from '../src/timer/store'
import type { RoutineFlowSettings } from '../src/settings'
import type RoutineFlowPlugin from '../src/main'
import type { App as AppType, WorkspaceLeaf as WorkspaceLeafType } from 'obsidian'
import { progressMeterStyleClass } from '../src/timer/progress-meter-style'

let Temporal: typeof TemporalType
let RoutineSidePanelView: typeof RoutineSidePanelViewType
let RoutineStatusBarItem: typeof RoutineStatusBarItemType
let ResetConfirmModal: typeof ResetConfirmModalType
let ScriptHookConfirmModal: typeof ScriptHookConfirmModalType
let WriteBackModal: typeof WriteBackModalType
let RoutineReplaceModal: typeof RoutineReplaceModalType
let RoutineGalleryModal: typeof RoutineGalleryModalType
let RoutineFlowSettingTab: typeof RoutineFlowSettingTabType
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
    const writeBackModalModule = await import('../src/views/write-back-modal')
    const replaceModalModule = await import('../src/views/routine-replace-modal')
    const galleryModalModule = await import('../src/views/routine-gallery-modal')
    const storeModule = await import('../src/timer/store')
    const settingsModule = await import('../src/settings')

    RoutineSidePanelView = sidePanelModule.RoutineSidePanelView
    RoutineStatusBarItem = statusBarModule.RoutineStatusBarItem
    ResetConfirmModal = resetModalModule.ResetConfirmModal
    ScriptHookConfirmModal = scriptModalModule.ScriptHookConfirmModal
    WriteBackModal = writeBackModalModule.WriteBackModal
    RoutineReplaceModal = replaceModalModule.RoutineReplaceModal
    RoutineGalleryModal = galleryModalModule.RoutineGalleryModal
    RoutineFlowSettingTab = settingsModule.RoutineFlowSettingTab
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
      phases: [
        phaseModule.PhaseSchema.parse({
          ...phaseDefaults,
          id: focusId,
          label: 'Focus Phase',
          kind: phaseModule.PhaseKindSchema.parse('focus'),
          duration: Temporal.Duration.from({ minutes: 25 }),
        }),
        phaseModule.PhaseSchema.parse({
          ...phaseDefaults,
          id: breakId,
          label: 'Break Phase',
          kind: phaseModule.PhaseKindSchema.parse('break'),
          duration: Temporal.Duration.from({ minutes: 5 }),
        }),
      ],
      transitions: [
        { fromPhaseId: focusId, toPhaseId: breakId, condition: { kind: 'always' } },
      ],
    })
  })

  test('RoutineSidePanelView applies base and status CSS classes', async () => {
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

    // Advance to break phase
    await store.dispatch({ type: 'advance-phase' })
    await store.dispatch({ type: 'start' })
    expect(contentEl.hasClass('is-running')).toBe(true)
  })

  test('RoutineStatusBarItem applies base and status CSS classes', async () => {
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

    await store.dispatch({ type: 'pause' })
    expect(statusEl.hasClass('is-paused')).toBe(true)

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

  test('WriteBackModal sets routine-write-back-modal and internal chip classes', () => {
    const app = new AppConstructor()
    const modal = new WriteBackModal(app, {
      filePath: 'notes/task.md',
      property: 'sessions',
      value: 1,
    })
    modal.onOpen()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const modalEl = modal.modalEl as unknown as MockElement
    expect(modalEl.hasClass('routine-write-back-modal')).toBe(true)

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const contentEl = modal.contentEl as unknown as MockElement
    const sentence = contentEl.children.find(c => c.hasClass('routine-write-back-sentence'))
    expect(sentence).toBeDefined()

    const chips = sentence?.children.filter(c => c.hasClass('routine-write-back-chip'))
    expect(chips?.length).toBe(3)

    const actions = contentEl.children.find(c => c.hasClass('routine-write-back-actions'))
    expect(actions).toBeDefined()
  })

  test('RoutineReplaceModal sets routine-replace-modal and warning classes', () => {
    const app = new AppConstructor()
    const modal = new RoutineReplaceModal(app, 'Current Routine', 'Next Routine')
    modal.onOpen()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const modalEl = modal.modalEl as unknown as MockElement
    expect(modalEl.hasClass('routine-replace-modal')).toBe(true)

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const contentEl = modal.contentEl as unknown as MockElement
    const warning = contentEl.children.find(c => c.hasClass('routine-replace-warning'))
    expect(warning).toBeDefined()
  })

  test('RoutineGalleryModal sets routine-gallery-modal class and renders controls', () => {
    const app = new AppConstructor()
    const modal = new RoutineGalleryModal(app)
    modal.onOpen()

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const modalEl = modal.modalEl as unknown as MockElement
    expect(modalEl.hasClass('routine-gallery-modal')).toBe(true)

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const contentEl = modal.contentEl as unknown as MockElement
    const searchSection = contentEl.children.find(c => c.hasClass('routine-gallery-search-section'))
    expect(searchSection).toBeDefined()

    const listContainer = contentEl.children.find(c => c.hasClass('routine-gallery-list'))
    expect(listContainer).toBeDefined()
  })

  test('RoutineFlowSettingTab sets routine-setting-tab class on container', () => {
    const app = new AppConstructor()
    const store = new EngineStore(customCssGraph)
    const mockPlugin = new TestRoutinePlugin(store)

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock RoutineFlowPlugin for settings tab
    const tab = new RoutineFlowSettingTab(app, mockPlugin as unknown as RoutineFlowPlugin)

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock Element access
    const containerEl = tab.containerEl as unknown as MockElement
    expect(containerEl.hasClass('routine-setting-tab')).toBe(true)
  })

  test('progressMeterStyleClass maps style names to matching CSS class selectors', () => {
    expect(progressMeterStyleClass('radial')).toBeNull()
    expect(progressMeterStyleClass('fill-bar')).toBe('routine-progress-style-fill-bar')
    expect(progressMeterStyleClass('battery-drain')).toBe('routine-progress-style-battery-drain')
    expect(progressMeterStyleClass('tick-marks')).toBe('routine-progress-style-tick-marks')
  })

  test('styles.css adheres to theme-native and scoped CSS custom property rules', async () => {
    const stylesPath = path.resolve(import.meta.dirname, '../styles.css')
    const content = await fs.readFile(stylesPath, 'utf8')

    // Must define all expected plugin custom properties
    expect(content).toContain('--routine-flow-countdown-size:')
    expect(content).toContain('--routine-flow-accent-paused:')
    expect(content).toContain('--routine-flow-ring-size:')
    expect(content).toContain('--routine-flow-ring-stroke:')
    expect(content).toContain('--routine-flow-tick-count:')
    expect(content).toContain('--routine-flow-tick-mark-fraction:')

    // Must define fallback for paused accent
    expect(content).toContain('var(--color-orange, var(--text-warning))')

    // No hardcoded raw hex colors in styles.css (except comments)
    const linesWithoutComments = content
      .split('\n')
      .filter(line => !line.trim().startsWith('/*') && !line.trim().startsWith('*'))
      .join('\n')

    const hexColorMatches = linesWithoutComments.match(/#[0-9a-fA-F]{3,8}\b/g)
    expect(hexColorMatches).toBeNull()
  })
})
