import { beforeAll, describe, expect, test, mock } from 'bun:test'
import type { App as AppType, BasesOptions, TFile as TFileType, WorkspaceLeaf, QueryController } from 'obsidian'
import type { Temporal as TemporalType } from 'temporal-polyfill'
import type RoutineFlowPlugin from '../src/main'
import type { Phase, PhaseId, PhaseKind } from '../src/domain/phase/phase'
import type { TaskQueueItem, TaskQueueItemId, TaskSourceId } from '../src/domain/queue/task-source'
import type { QueuePanelOptions } from '../src/views/timer/queue-panel'
import type { handleSelectorWinner, RoutineTimerView } from '../src/views/timer-view'
import type { RoutineSidePanelView } from '../src/views/side-panel-view'
import type { renderStageProgress, renderGuidanceChecklist } from '../src/views/timer/stage-progress-panel'

class MockElement {
  className = ''
  children: MockElement[] = []
  dataset: Record<string, string> = {}
  private readonly styleProps: Record<string, string> = {}

  readonly style = {
    setProperty: (prop: string, val: string): void => {
      this.styleProps[prop] = val
    },
    getPropertyValue: (prop: string): string => this.styleProps[prop] ?? '',
  }

  childElementCount = 0
  tagName = ''

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

  getElementsByClassName(cls: string): MockElement[] {
    return this.children.filter(c => c.hasClass(cls))
  }

  parentElement: MockElement | null = null

  remove(): void {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(c => c !== this)
      this.parentElement.childElementCount = this.parentElement.children.length
    }
  }

  empty(): void {
    for (const c of this.children) {
      c.parentElement = null
    }
    this.children = []
    this.childElementCount = 0
  }

  private readonly attrs: Record<string, string> = {}
  private readonly listeners: Record<string, ((e: unknown) => void)[]> = {}
  text = ''

  setAttribute(name: string, val: string): void {
    this.attrs[name] = val
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs
  }

  removeAttribute(name: string): void {
    delete this.attrs[name]
  }

  setText(txt: string): void {
    this.text = txt
  }

  getText(): string {
    return this.text
  }

  createEl(tag: string, o?: { text?: string, cls?: string, attr?: Record<string, string> }): MockElement {
    const child = new MockElement()
    child.tagName = tag.toUpperCase()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    if (o?.text) {
      child.setText(o.text)
    }
    if (o?.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        child.setAttribute(k, v)
      }
    }
    child.parentElement = this
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createDiv(o?: { text?: string, cls?: string, attr?: Record<string, string> }): MockElement {
    const child = new MockElement()
    child.tagName = 'DIV'
    if (o?.cls) {
      child.addClass(o.cls)
    }
    if (o?.text) {
      child.setText(o.text)
    }
    if (o?.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        child.setAttribute(k, v)
      }
    }
    child.parentElement = this
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createSpan(o?: { text?: string, cls?: string, attr?: Record<string, string> }): MockElement {
    const child = new MockElement()
    child.tagName = 'SPAN'
    if (o?.cls) {
      child.addClass(o.cls)
    }
    if (o?.text) {
      child.setText(o.text)
    }
    if (o?.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        child.setAttribute(k, v)
      }
    }
    child.parentElement = this
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createSvg(tag: string, o?: { cls?: string }): MockElement {
    const child = new MockElement()
    child.tagName = tag.toUpperCase()
    if (o?.cls) {
      child.addClass(o.cls)
    }
    child.parentElement = this
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  checked = false

  addEventListener(event: string, handler: (e: unknown) => void): void {
    const list = this.listeners[event] ?? []
    list.push(handler)
    this.listeners[event] = list
  }

  click(): void {
    if (this.tagName === 'INPUT' && (this.attrs.type === 'checkbox' || this.getAttribute('type') === 'checkbox')) {
      this.checked = !this.checked
    }
    const handlers = [...(this.listeners.click ?? []), ...(this.listeners.change ?? [])]
    for (const h of handlers) {
      h({
        stopPropagation: () => {},
        preventDefault: () => {},
      })
    }
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element helper
const asElement = (el: MockElement): HTMLElement => el as unknown as HTMLElement

class MockTFile {
  constructor(readonly path: string = '') {}
}

class MockApp {
  constructor(readonly routinePaths: readonly string[] = []) {}

  readonly vault = {
    getFiles: () => [],
    getMarkdownFiles: () => [],
    getFileByPath: () => null,
  }

  readonly metadataCache = {
    getFileCache: (file: { readonly path: string }) => {
      return this.routinePaths.includes(file.path) ? { frontmatter: { 'is-routine': true } } : null
    },
  }
}

void mock.module('obsidian', () => {
  return {
    BasesView: class {
      containerEl = new MockElement()
      constructor(_controller: unknown) {}
    },
    PluginSettingTab: class {
      containerEl = new MockElement()
    },
    Setting: class {
      settingEl = new MockElement()

      constructor(_container: MockElement) {}

      setClass(_cls: string): this {
        return this
      }

      setName(_name: string): this {
        return this
      }

      setDesc(_desc: string): this {
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

      addDropdown(fn?: (d: unknown) => void): this {
        if (fn) {
          const dd = {
            addOption: () => dd,
            setValue: () => dd,
            onChange: () => dd,
          }
          fn(dd)
        }
        return this
      }

      addText(fn?: (t: unknown) => void): this {
        if (fn) {
          const txt = {
            setPlaceholder: () => txt,
            setValue: () => txt,
            onChange: () => txt,
          }
          fn(txt)
        }
        return this
      }
    },
    Notice: class {},
    Modal: class {
      containerEl = new MockElement()
      modalEl = new MockElement()
      contentEl = new MockElement()
      titleEl = new MockElement()

      setTitle(_t: string): void {}
      open(): void {}
      close(): void {}
      constructor(_app: unknown) {}
    },
    ItemView: class {
      containerEl = new MockElement()
      contentEl = new MockElement()
    },
    WorkspaceLeaf: class {
      containerEl = new MockElement()
    },
    AbstractInputSuggest: class {
      onSelect(): void {}
      close(): void {}
    },
    App: MockApp,
    Plugin: class {
      constructor(public app: unknown = {}, public manifest: unknown = {}) {}
    },
    TFile: MockTFile,
    setIcon: (el: MockElement, _name: string) => {
      el.createSpan()
    },
  }
})

let Temporal: typeof TemporalType
let getViewOptionsFn: (app: AppType) => BasesOptions[]
let RoutineTimerViewClass: typeof RoutineTimerView
let RoutineSidePanelViewClass: typeof RoutineSidePanelView
let renderStateIconFn: (parent: HTMLElement, names: readonly string[]) => HTMLElement
let renderProgressMeterFn: (dial: HTMLElement, options: {
  style: 'radial' | 'fill-bar' | 'battery-drain' | 'tick-marks'
  isInert: boolean
  duration: TemporalType.Duration | null
  remaining: TemporalType.Duration | null
  isExhausted?: boolean
}) => void
let renderConfigBarFn: (parent: HTMLElement, options: { isConfigOpen: boolean, onToggle: () => void }) => HTMLElement
let renderConfigPanelFn: (parent: HTMLElement, options: {
  app: AppType
  config: undefined
  configuredRoutinePath: string | null
  onRoutineFileChange: () => void
  onFilterConfigChange: () => void
}) => HTMLElement
let renderQueuePanelFn: (queueEl: HTMLElement, options: QueuePanelOptions) => void
let renderStageProgressFn: typeof renderStageProgress
let renderGuidanceChecklistFn: typeof renderGuidanceChecklist
let handleSelectorWinnerFn: typeof handleSelectorWinner
let FOCUS_PHASE_KIND_VAL: PhaseKind
let BREAK_PHASE_KIND_VAL: PhaseKind
let SELECTOR_PHASE_KIND_VAL: PhaseKind
let PhaseIdSchemaParse: (val: string) => PhaseId
let TaskSourceIdSchemaParse: (val: string) => TaskSourceId
let TaskQueueItemIdSchemaParse: (val: string) => TaskQueueItemId

describe('Timer view decomposition', () => {
  beforeAll(async () => {
    const polyfill = await import('temporal-polyfill')
    Temporal = polyfill.Temporal

    const viewOptionsMod = await import('../src/views/timer/view-options')
    getViewOptionsFn = viewOptionsMod.getViewOptions

    const timerViewMod = await import('../src/views/timer-view')
    RoutineTimerViewClass = timerViewMod.RoutineTimerView
    handleSelectorWinnerFn = timerViewMod.handleSelectorWinner

    const sidePanelMod = await import('../src/views/side-panel-view')
    RoutineSidePanelViewClass = sidePanelMod.RoutineSidePanelView

    const stateIconMod = await import('../src/views/timer/state-icon')
    renderStateIconFn = stateIconMod.renderStateIcon

    const progressMeterMod = await import('../src/views/timer/progress-meter')
    renderProgressMeterFn = progressMeterMod.renderProgressMeter

    const configPanelMod = await import('../src/views/timer/config-panel')
    renderConfigBarFn = configPanelMod.renderConfigBar
    renderConfigPanelFn = configPanelMod.renderConfigPanel

    const queuePanelMod = await import('../src/views/timer/queue-panel')
    renderQueuePanelFn = queuePanelMod.renderQueuePanel

    const stageProgressMod = await import('../src/views/timer/stage-progress-panel')
    renderStageProgressFn = stageProgressMod.renderStageProgress
    renderGuidanceChecklistFn = stageProgressMod.renderGuidanceChecklist

    const phaseGraphMod = await import('../src/timer/phase-graph-query')
    FOCUS_PHASE_KIND_VAL = phaseGraphMod.FOCUS_PHASE_KIND
    BREAK_PHASE_KIND_VAL = phaseGraphMod.BREAK_PHASE_KIND
    SELECTOR_PHASE_KIND_VAL = phaseGraphMod.SELECTOR_PHASE_KIND

    const phaseMod = await import('../src/domain/phase/phase')
    PhaseIdSchemaParse = val => phaseMod.PhaseIdSchema.parse(val)

    const queueMod = await import('../src/domain/queue/task-source')
    TaskSourceIdSchemaParse = val => queueMod.TaskSourceIdSchema.parse(val)
    TaskQueueItemIdSchemaParse = val => queueMod.TaskQueueItemIdSchema.parse(val)
  })

  const createDummyPhase = (): Phase => ({
    id: PhaseIdSchemaParse('focus-phase'),
    name: 'Focus',
    label: 'Focus',
    kind: FOCUS_PHASE_KIND_VAL,
    duration: Temporal.Duration.from({ minutes: 25 }),
    onCompletion: 'autoAdvance',
    timeFormat: 'mm:ss',
    taskSourceId: TaskSourceIdSchemaParse('focus-queue'),
    actions: [],
    badges: [],
    logTarget: { kind: 'activeItem' },
    notification: null,
    handlers: {
      onEnter: [],
      onComplete: [],
      onSkip: [],
      onExit: [],
    },
  })

  describe('view-options', () => {
    test('defines all required Bases options and routineFile filter', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp(['valid-routine.md']) as unknown as AppType
      const options = getViewOptionsFn(app)
      const keys = options.map(opt => opt.key)

      expect(keys).toEqual([
        'focusProperty',
        'focusValue',
        'breakProperty',
        'breakValue',
        'routineFile',
      ])

      const routineFileOption = options.find(opt => opt.key === 'routineFile')
      expect(routineFileOption).toBeDefined()
      expect(routineFileOption?.type).toBe('file')

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock TFile
      const validFile = new MockTFile('valid-routine.md') as unknown as TFileType
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock TFile
      const otherFile = new MockTFile('other.md') as unknown as TFileType

      if (routineFileOption?.type === 'file' && routineFileOption.filter) {
        const filter = routineFileOption.filter
        expect(filter(validFile)).toBe(true)
        expect(filter(otherFile)).toBe(false)
      }
    })

    test('RoutineTimerView.getViewOptions is getViewOptions', () => {
      expect(RoutineTimerViewClass.getViewOptions).toBe(getViewOptionsFn)
    })
  })

  describe('state-icon', () => {
    test('renders first resolving icon in list', () => {
      const parent = new MockElement()
      const iconEl = renderStateIconFn(asElement(parent), ['settings', 'gear'])
      expect(iconEl.hasClass('routine-state-icon')).toBe(true)
      expect(parent.children.length).toBe(1)
    })
  })

  describe('progress-meter', () => {
    test('applies progress property and creates indicator elements for timed phase', () => {
      const dial = new MockElement()
      renderProgressMeterFn(asElement(dial), {
        style: 'radial',
        isInert: false,
        duration: Temporal.Duration.from({ minutes: 25 }),
        remaining: Temporal.Duration.from({ minutes: 12, seconds: 30 }),
      })

      expect(dial.style.getPropertyValue('--routine-flow-progress')).toBe('0.5')
      expect(dial.children.some(c => c.hasClass('routine-progress-ring'))).toBe(true)
      expect(dial.children.some(c => c.hasClass('routine-progress-fill-bar'))).toBe(true)
      expect(dial.children.some(c => c.hasClass('routine-progress-battery-drain'))).toBe(true)
      expect(dial.children.some(c => c.hasClass('routine-progress-tick-marks'))).toBe(true)
    })

    test('skips progress rendering when inert', () => {
      const dial = new MockElement()
      renderProgressMeterFn(asElement(dial), {
        style: 'radial',
        isInert: true,
        duration: Temporal.Duration.from({ minutes: 25 }),
        remaining: Temporal.Duration.from({ minutes: 12, seconds: 30 }),
      })

      expect(dial.style.getPropertyValue('--routine-flow-progress')).toBe('')
      expect(dial.children.some(c => c.hasClass('routine-progress-ring'))).toBe(false)
    })

    test('renders celebratory and exhaustion state with 100% progress when isExhausted is true', () => {
      const dial = new MockElement()
      renderProgressMeterFn(asElement(dial), {
        style: 'radial',
        isInert: false,
        duration: Temporal.Duration.from({ minutes: 25 }),
        remaining: Temporal.Duration.from({ minutes: 12, seconds: 30 }),
        isExhausted: true,
      })

      expect(dial.hasClass('is-exhausted')).toBe(true)
      expect(dial.hasClass('is-celebrating')).toBe(true)
      expect(dial.style.getPropertyValue('--routine-flow-progress')).toBe('1')
    })
  })

  describe('config-panel', () => {
    test('renderConfigBar creates button', () => {
      const parent = new MockElement()
      renderConfigBarFn(asElement(parent), {
        isConfigOpen: false,
        onToggle: () => {},
      })

      expect(parent.children.some(c => c.hasClass('routine-config-bar'))).toBe(true)
    })

    test('renderConfigPanel builds panel element', () => {
      const parent = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const panel = renderConfigPanelFn(asElement(parent), {
        app,
        config: undefined,
        configuredRoutinePath: null,
        onRoutineFileChange: () => {},
        onFilterConfigChange: () => {},
      })

      expect(panel.hasClass('routine-config-panel')).toBe(true)
    })
  })

  describe('queue-panel', () => {
    test('renders empty state when queue items is empty', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      renderQueuePanelFn(asElement(queueEl), {
        phase: createDummyPhase(),
        activeFilePath: null,
        queueItems: [],
        app,
        onSelectTask: () => {},
      })

      expect(queueEl.children.some(c => c.hasClass('routine-queue-empty'))).toBe(true)
    })

    test('renders celebratory queue-exhausted empty state when queue items is empty and completedCount > 0', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      renderQueuePanelFn(asElement(queueEl), {
        phase: createDummyPhase(),
        activeFilePath: null,
        queueItems: [],
        completedCount: 4,
        app,
        onSelectTask: () => {},
      })

      const emptyEl = queueEl.children.find(c => c.hasClass('routine-queue-empty'))
      expect(emptyEl).toBeDefined()
      expect(emptyEl?.hasClass('is-queue-exhausted')).toBe(true)
      expect(emptyEl?.children.some(c => c.getText().includes('All chores completed early — queue exhausted.'))).toBe(true)
      expect(emptyEl?.children.some(c => c.hasClass('routine-state-icon'))).toBe(true)
    })

    test('renders items and handles item list', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const item: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/test-task.md',
        displayName: 'Test task',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      renderQueuePanelFn(asElement(queueEl), {
        phase: createDummyPhase(),
        activeFilePath: 'tasks/test-task.md',
        queueItems: [item],
        app,
        onSelectTask: () => {},
      })

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      expect(ul).toBeDefined()
      expect(ul?.children.some(li => li.hasClass('is-active-task'))).toBe(true)
    })

    test('renders break queue title for break phase', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const breakPhase: Phase = {
        ...createDummyPhase(),
        kind: BREAK_PHASE_KIND_VAL,
        label: 'Break',
      }

      renderQueuePanelFn(asElement(queueEl), {
        phase: breakPhase,
        activeFilePath: null,
        queueItems: [],
        app,
        onSelectTask: () => {},
      })

      expect(queueEl.children.length).toBeGreaterThan(0)
    })

    test('selector phase renders spin button disabled when queue has fewer than 2 items', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const singleItem: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: null,
        queueItems: [singleItem],
        app,
        onSelectTask: () => {},
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      expect(header).toBeDefined()
      const toolbar = header?.children.find(c => c.hasClass('routine-queue-header-toolbar'))
      expect(toolbar).toBeDefined()
      const spinBtn = toolbar?.children.find(c => c.hasClass('routine-queue-spin-btn'))
      expect(spinBtn).toBeDefined()
      expect(spinBtn?.hasAttribute('disabled')).toBe(true)
    })

    test('selector phase renders spin button enabled with 2 or more items and live announcer', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: null,
        queueItems: [item1, item2],
        app,
        onSelectTask: () => {},
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      expect(header).toBeDefined()
      const toolbar = header?.children.find(c => c.hasClass('routine-queue-header-toolbar'))
      expect(toolbar).toBeDefined()
      const spinBtn = toolbar?.children.find(c => c.hasClass('routine-queue-spin-btn'))
      expect(spinBtn).toBeDefined()
      expect(spinBtn?.hasAttribute('disabled')).toBe(false)

      const liveRegion = queueEl.children.find(c => c.hasClass('routine-queue-announcer'))
      expect(liveRegion).toBeDefined()
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite')
    })

    test('spin button click with prefersReducedMotion selects immediately without animation', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      let selectedPath = ''
      let spunWinnerPath = ''

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: null,
        queueItems: [item1, item2],
        app,
        prefersReducedMotion: true,
        rng: () => 0.8, // selects item2
        onSelectTask: (path) => {
          selectedPath = path
        },
        onSpinEnd: (winner) => {
          spunWinnerPath = winner.sourcePath
        },
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const toolbar = header?.children.find(c => c.hasClass('routine-queue-header-toolbar'))
      const spinBtn = toolbar?.children.find(c => c.hasClass('routine-queue-spin-btn'))
      expect(spinBtn).toBeDefined()

      spinBtn?.click()

      expect(selectedPath).toBe('tasks/task-2.md')
      expect(spunWinnerPath).toBe('tasks/task-2.md')

      const liveRegion = queueEl.children.find(c => c.hasClass('routine-queue-announcer'))
      expect(liveRegion?.getText()).toBe('Selected task: Task 2')

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      const winnerLi = ul?.children[1]
      expect(winnerLi?.hasClass('is-roulette-winner')).toBe(true)
    })

    test('spin button click with animation steps through highlights to winner', async () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      let selectedPath = ''
      let spunWinnerPath = ''

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: null,
        queueItems: [item1, item2],
        app,
        prefersReducedMotion: false,
        scheduleTotalSteps: 3,
        rng: () => 0.1, // selects item1
        onSelectTask: (path) => {
          selectedPath = path
        },
        onSpinEnd: (winner) => {
          spunWinnerPath = winner.sourcePath
        },
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const toolbar = header?.children.find(c => c.hasClass('routine-queue-header-toolbar'))
      const spinBtn = toolbar?.children.find(c => c.hasClass('routine-queue-spin-btn'))
      expect(spinBtn).toBeDefined()

      spinBtn?.click()

      // During spinning, button is disabled
      expect(spinBtn?.hasAttribute('disabled')).toBe(true)

      // Wait for 3-step animation to complete (steps + deceleration intervals)
      await new Promise(resolve => setTimeout(resolve, 800))

      expect(selectedPath).toBe('tasks/task-1.md')
      expect(spunWinnerPath).toBe('tasks/task-1.md')
      expect(spinBtn?.hasAttribute('disabled')).toBe(false)

      const liveRegion = queueEl.children.find(c => c.hasClass('routine-queue-announcer'))
      expect(liveRegion?.getText()).toBe('Selected task: Task 1')

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      const winnerLi = ul?.children[0]
      expect(winnerLi?.hasClass('is-roulette-winner')).toBe(true)
    })

    test('manual task click in selector phase sets roulette winner highlight and live announcer', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      let selectedPath = ''

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: null,
        queueItems: [item1, item2],
        app,
        onSelectTask: (path) => {
          selectedPath = path
        },
      })

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      expect(ul).toBeDefined()
      const item2Row = ul?.children[1]?.children.find(c => c.hasClass('routine-queue-item-row'))
      const task2Btn = item2Row?.children.find(c => c.hasClass('routine-task-name'))
      expect(task2Btn).toBeDefined()

      task2Btn?.click()

      expect(selectedPath).toBe('tasks/task-2.md')
      const liveRegion = queueEl.children.find(c => c.hasClass('routine-queue-announcer'))
      expect(liveRegion?.getText()).toBe('Selected task: Task 2')

      const item1Li = ul?.children[0]
      const item2Li = ul?.children[1]
      expect(item1Li?.hasClass('is-roulette-winner')).toBe(false)
      expect(item2Li?.hasClass('is-roulette-winner')).toBe(true)
    })

    test('manual task click while spinning is ignored', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      let selectedPath = ''

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: null,
        queueItems: [item1, item2],
        app,
        prefersReducedMotion: false,
        scheduleTotalSteps: 10,
        setTimeout: () => 123, // stall animation so isSpinning remains true
        onSelectTask: (path) => {
          selectedPath = path
        },
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const toolbar = header?.children.find(c => c.hasClass('routine-queue-header-toolbar'))
      const spinBtn = toolbar?.children.find(c => c.hasClass('routine-queue-spin-btn'))
      spinBtn?.click()

      // Attempt to click item2 while spin is running
      const ul = queueEl.children.find(c => c.tagName === 'UL')
      const item2Row = ul?.children[1]?.children.find(c => c.hasClass('routine-queue-item-row'))
      const task2Btn = item2Row?.children.find(c => c.hasClass('routine-task-name'))
      task2Btn?.click()

      expect(selectedPath).toBe('')
    })

    test('selector phase preserves roulette winner highlight and live region when rendered with activeFilePath', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      renderQueuePanelFn(asElement(queueEl), {
        phase: selectorPhase,
        activeFilePath: 'tasks/task-2.md',
        queueItems: [item1, item2],
        app,
        onSelectTask: () => {},
      })

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      expect(ul?.children[0]?.hasClass('is-roulette-winner')).toBe(false)
      expect(ul?.children[1]?.hasClass('is-roulette-winner')).toBe(true)
      expect(ul?.children[1]?.hasClass('is-active-task')).toBe(true)

      const liveRegion = queueEl.children.find(c => c.hasClass('routine-queue-announcer'))
      expect(liveRegion?.getText()).toBe('Selected task: Task 2')
    })

    test('renders queue item property badges when extraProperties and phase badges are configured', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const phase: Phase = {
        ...createDummyPhase(),
        badges: [
          { property: 'stars', icon: 'star', suffix: '★', variant: 'accent', label: 'Star count' },
          { property: 'estimate', prefix: '~', variant: 'muted' },
        ],
      }
      const itemWithBadges: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task with badges',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
        extraProperties: {
          stars: 3,
          estimate: '15m',
        },
      }
      const itemWithoutBadges: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Plain task',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      renderQueuePanelFn(asElement(queueEl), {
        phase,
        activeFilePath: null,
        queueItems: [itemWithBadges, itemWithoutBadges],
        app,
        onSelectTask: () => {},
      })

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      const row1 = ul?.children[0]?.children.find(c => c.hasClass('routine-queue-item-row'))
      const row2 = ul?.children[1]?.children.find(c => c.hasClass('routine-queue-item-row'))

      const badgesContainer1 = row1?.children.find(c => c.hasClass('routine-queue-badges'))
      expect(badgesContainer1).toBeDefined()
      expect(badgesContainer1?.children.length).toBe(2)

      const badge1 = badgesContainer1?.children[0]
      expect(badge1?.hasClass('routine-queue-badge')).toBe(true)
      expect(badge1?.hasClass('mod-accent')).toBe(true)
      expect(badge1?.getAttribute('aria-label')).toBe('Star count')
      expect(badge1?.getAttribute('title')).toBe('Star count')
      const badge1Text = badge1?.children.find(c => c.hasClass('routine-queue-badge-text'))
      expect(badge1Text?.getText()).toBe('3★')

      const badge2 = badgesContainer1?.children[1]
      expect(badge2?.hasClass('routine-queue-badge')).toBe(true)
      expect(badge2?.hasClass('mod-muted')).toBe(true)
      const badge2Text = badge2?.children.find(c => c.hasClass('routine-queue-badge-text'))
      expect(badge2Text?.getText()).toBe('~15m')

      // Plain task without extraProperties should NOT have routine-queue-badges container
      const badgesContainer2 = row2?.children.find(c => c.hasClass('routine-queue-badges'))
      expect(badgesContainer2).toBeUndefined()
    })

    test('renders dynamic completed chore counter badge in queue panel header', () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const item: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      // 0 chores completed
      renderQueuePanelFn(asElement(queueEl), {
        phase: createDummyPhase(),
        activeFilePath: 'tasks/task-1.md',
        queueItems: [item],
        completedCount: 0,
        app,
        onSelectTask: () => {},
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const badge0 = header?.children.find(c => c.hasClass('routine-queue-completed-badge'))
      expect(badge0).toBeDefined()
      expect(badge0?.getText()).toBe('0 chores completed')

      // 1 chore completed (singular)
      renderQueuePanelFn(asElement(queueEl), {
        phase: createDummyPhase(),
        activeFilePath: 'tasks/task-1.md',
        queueItems: [item],
        completedCount: 1,
        app,
        onSelectTask: () => {},
      })
      const header1 = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const badge1 = header1?.children.find(c => c.hasClass('routine-queue-completed-badge'))
      expect(badge1?.getText()).toBe('1 chore completed')

      // 3 chores completed (plural)
      renderQueuePanelFn(asElement(queueEl), {
        phase: createDummyPhase(),
        activeFilePath: 'tasks/task-1.md',
        queueItems: [item],
        completedCount: 3,
        app,
        onSelectTask: () => {},
      })
      const header3 = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const badge3 = header3?.children.find(c => c.hasClass('routine-queue-completed-badge'))
      expect(badge3?.getText()).toBe('3 chores completed')
    })

    test('clicking markDone immediately increments counter and advances active task selection to next candidate', async () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const blitzPhase: Phase = {
        ...createDummyPhase(),
        actions: [
          {
            id: 'done',
            label: 'Done',
            style: 'primary',
            payload: { kind: 'markDone' },
          },
        ],
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      let selectedPath = ''
      let executedAction: unknown = null
      let executedPath = ''
      let dispatchedAction: unknown = null

      renderQueuePanelFn(asElement(queueEl), {
        phase: blitzPhase,
        activeFilePath: 'tasks/task-1.md',
        queueItems: [item1, item2],
        completedCount: 0,
        app,
        actionExecutor: {
          executeAction: async (action, targetPath) => {
            executedAction = action
            executedPath = targetPath ?? ''
            return { success: true }
          },
          dispatch: async (action) => {
            dispatchedAction = action
            return []
          },
        },
        onSelectTask: (path) => {
          selectedPath = path
        },
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const counterBadge = header?.children.find(c => c.hasClass('routine-queue-completed-badge'))
      expect(counterBadge?.getText()).toBe('0 chores completed')

      const ul = queueEl.children.find(c => c.tagName === 'UL')
      const li1 = ul?.children[0]
      const li2 = ul?.children[1]
      expect(li1?.hasClass('is-active-task')).toBe(true)
      expect(li2?.hasClass('is-active-task')).toBe(false)

      const actionsEl = li1?.children.find(c => c.hasClass('routine-queue-actions'))
      const doneBtn = actionsEl?.children.find(c => c.getText() === 'Done')
      expect(doneBtn).toBeDefined()

      // Click Done on item 1
      doneBtn?.click()

      // 1. Dispatches record-item-completion
      expect(dispatchedAction).toEqual({ type: 'record-item-completion', itemId: TaskQueueItemIdSchemaParse('item-1') })

      // 2. Counter updates immediately
      expect(counterBadge?.getText()).toBe('1 chore completed')

      // 3. Selection advances immediately to next candidate
      expect(li1?.hasClass('is-active-task')).toBe(false)
      expect(li2?.hasClass('is-active-task')).toBe(true)
      expect(selectedPath).toBe('tasks/task-2.md')

      // 4. Next candidate has action controls ready
      const actionsEl2 = li2?.children.find(c => c.hasClass('routine-queue-actions'))
      expect(actionsEl2).toBeDefined()
      const doneBtn2 = actionsEl2?.children.find(c => c.getText() === 'Done')
      expect(doneBtn2).toBeDefined()

      // 5. File mutation executed asynchronously
      expect(executedAction).toEqual(blitzPhase.actions[0])
      expect(executedPath).toBe('tasks/task-1.md')
    })

    test('rapid sequential markDone check-offs advance across tasks without lag', async () => {
      const queueEl = new MockElement()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock App
      const app = new MockApp() as unknown as AppType
      const blitzPhase: Phase = {
        ...createDummyPhase(),
        actions: [
          {
            id: 'done',
            label: 'Done',
            style: 'primary',
            payload: { kind: 'markDone' },
          },
        ],
      }
      const item1: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-1'),
        sourcePath: 'tasks/task-1.md',
        displayName: 'Task 1',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item2: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-2'),
        sourcePath: 'tasks/task-2.md',
        displayName: 'Task 2',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }
      const item3: TaskQueueItem = {
        id: TaskQueueItemIdSchemaParse('item-3'),
        sourcePath: 'tasks/task-3.md',
        displayName: 'Task 3',
        cycleStatus: 'pending',
        timeSpent: Temporal.Duration.from({ minutes: 0 }),
        lastCycledAt: null,
      }

      let executedPaths: readonly string[] = []
      let dispatchedCompletions: readonly string[] = []
      let selectedPaths: readonly string[] = []

      renderQueuePanelFn(asElement(queueEl), {
        phase: blitzPhase,
        activeFilePath: 'tasks/task-1.md',
        queueItems: [item1, item2, item3],
        completedCount: 0,
        app,
        actionExecutor: {
          executeAction: async (_action, targetPath) => {
            if (targetPath) {
              executedPaths = [...executedPaths, targetPath]
            }
            return { success: true }
          },
          dispatch: async (action) => {
            if (typeof action === 'object' && action !== null && 'itemId' in action) {
              dispatchedCompletions = [...dispatchedCompletions, String(action.itemId)]
            }
            return []
          },
        },
        onSelectTask: (path) => {
          selectedPaths = [...selectedPaths, path]
        },
      })

      const header = queueEl.children.find(c => c.hasClass('routine-queue-header'))
      const counterBadge = header?.children.find(c => c.hasClass('routine-queue-completed-badge'))
      const ul = queueEl.children.find(c => c.tagName === 'UL')

      // Click Done on item 1
      const doneBtn1 = ul?.children[0]?.children.find(c => c.hasClass('routine-queue-actions'))?.children.find(c => c.getText() === 'Done')
      doneBtn1?.click()

      expect(counterBadge?.getText()).toBe('1 chore completed')
      expect(ul?.children[1]?.hasClass('is-active-task')).toBe(true)

      // Click Done on item 2 immediately
      const doneBtn2 = ul?.children[1]?.children.find(c => c.hasClass('routine-queue-actions'))?.children.find(c => c.getText() === 'Done')
      expect(doneBtn2).toBeDefined()
      doneBtn2?.click()

      expect(counterBadge?.getText()).toBe('2 chores completed')
      expect(ul?.children[2]?.hasClass('is-active-task')).toBe(true)

      // Click Done on item 3 immediately
      const doneBtn3 = ul?.children[2]?.children.find(c => c.hasClass('routine-queue-actions'))?.children.find(c => c.getText() === 'Done')
      expect(doneBtn3).toBeDefined()
      doneBtn3?.click()

      expect(counterBadge?.getText()).toBe('3 chores completed')
      expect(ul?.children.some(li => li.hasClass('is-active-task'))).toBe(false)

      const celebrationNotice = queueEl.children.find(c => c.hasClass('routine-blitz-celebration'))
      expect(celebrationNotice).toBeDefined()
      const textEl = celebrationNotice?.children.find(c => c.hasClass('routine-blitz-celebration-text'))
      expect(textEl?.getText()).toBe('All chores completed early!')

      expect(dispatchedCompletions).toEqual(['item-1', 'item-2', 'item-3'])
      expect(executedPaths).toEqual(['tasks/task-1.md', 'tasks/task-2.md', 'tasks/task-3.md'])
      expect(selectedPaths).toEqual(['tasks/task-2.md', 'tasks/task-3.md'])
    })
  })

  describe('handleSelectorWinner', () => {
    test('dispatches set-active-file and reorders when promoteToFront is enabled', async () => {
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
        onCompletion: 'waitForManual',
        selector: { autoSpin: false, promoteToFront: true },
      }

      let dispatchedActions: readonly unknown[] = []
      let reorderedItemId = ''
      let reorderedPosition = ''

      const mockStore = {
        dispatch: async (action: unknown) => {
          dispatchedActions = [...dispatchedActions, action]
          return []
        },
        reorderQueueItem: async (itemId: string, position: 'front' | 'back') => {
          reorderedItemId = itemId
          reorderedPosition = position
          return { success: true as const }
        },
      }

      const result = await handleSelectorWinnerFn(mockStore, selectorPhase, 'tasks/task-1.md')

      expect(result).toEqual({ success: true })
      expect(dispatchedActions).toEqual([{ type: 'set-active-file', filePath: 'tasks/task-1.md' }])
      expect(reorderedItemId).toBe('tasks/task-1.md')
      expect(reorderedPosition).toBe('front')
    })

    test('dispatches finish-phase when onCompletion is autoAdvance', async () => {
      const selectorPhase: Phase = {
        ...createDummyPhase(),
        kind: SELECTOR_PHASE_KIND_VAL,
        label: 'Wheel of tasks',
        onCompletion: 'autoAdvance',
        selector: { autoSpin: false, promoteToFront: false },
      }

      let dispatchedActions: readonly unknown[] = []
      let reorderCalled = false

      const mockStore = {
        dispatch: async (action: unknown) => {
          dispatchedActions = [...dispatchedActions, action]
          return []
        },
        reorderQueueItem: async () => {
          reorderCalled = true
          return { success: true as const }
        },
      }

      const result = await handleSelectorWinnerFn(mockStore, selectorPhase, 'tasks/task-2.md')

      expect(result).toBeNull()
      expect(reorderCalled).toBe(false)
      expect(dispatchedActions).toEqual([
        { type: 'set-active-file', filePath: 'tasks/task-2.md' },
        { type: 'finish-phase' },
      ])
    })
  })

  describe('stage-progress-panel', () => {
    test('renderStageProgress creates progress bar and stepper items with status classes', () => {
      const container = new MockElement()
      const progress = {
        stages: [
          { phaseId: PhaseIdSchemaParse('p1'), label: 'Inbox', status: 'completed' as const, isCurrent: false },
          { phaseId: PhaseIdSchemaParse('p2'), label: 'Review', status: 'active' as const, isCurrent: true },
          { phaseId: PhaseIdSchemaParse('p3'), label: 'Wrap-up', status: 'upcoming' as const, isCurrent: false },
        ],
        completedCount: 1,
        totalCount: 3,
        progressFraction: 1 / 3,
      }

      const panel = renderStageProgressFn(asElement(container), progress)
      expect(panel).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element access
      const mockPanel = panel as unknown as MockElement
      expect(mockPanel.hasClass('routine-stage-progress')).toBe(true)

      const progressBar = mockPanel.children.find(c => c.hasClass('routine-stage-progress-bar'))
      expect(progressBar).toBeDefined()
      expect(progressBar?.style.getPropertyValue('--routine-stage-progress')).toBe(String(1 / 3))

      const indicator = progressBar?.children.find(c => c.hasClass('routine-stage-progress-indicator'))
      expect(indicator).toBeDefined()
      expect(indicator?.style.getPropertyValue('width')).toBe('33%')

      const stepper = mockPanel.children.find(c => c.hasClass('routine-stage-stepper'))
      expect(stepper).toBeDefined()
      expect(stepper?.children.length).toBe(3)

      const [step1, step2, step3] = stepper?.children ?? []
      expect(step1?.hasClass('is-completed')).toBe(true)
      expect(step1?.children.find(c => c.hasClass('routine-stage-step-label'))?.getText()).toBe('Inbox')

      expect(step2?.hasClass('is-active')).toBe(true)
      expect(step2?.hasClass('is-current')).toBe(true)
      expect(step2?.children.find(c => c.hasClass('routine-stage-step-label'))?.getText()).toBe('Review')

      expect(step3?.hasClass('is-upcoming')).toBe(true)
      expect(step3?.children.find(c => c.hasClass('routine-stage-step-label'))?.getText()).toBe('Wrap-up')
    })

    test('renderGuidanceChecklist renders toggleable checkboxes and triggers callback', () => {
      const container = new MockElement()
      const items = ['Empty inbox', 'Review flagged items', 'Plan tomorrow']
      const checkedSet = new Set(['Review flagged items'])
      let toggledEvents: readonly { readonly item: string, readonly checked: boolean }[] = []

      const panel = renderGuidanceChecklistFn(asElement(container), items, {
        checkedItems: checkedSet,
        onToggle: (item, checked) => {
          toggledEvents = [...toggledEvents, { item, checked }]
        },
      })

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element access
      const mockPanel = panel as unknown as MockElement
      expect(mockPanel.hasClass('routine-guidance-checklist')).toBe(true)

      const title = mockPanel.children.find(c => c.hasClass('routine-guidance-title'))
      expect(title?.getText()).toBe('Guidance')

      const list = mockPanel.children.find(c => c.hasClass('routine-guidance-list'))
      expect(list).toBeDefined()
      expect(list?.children.length).toBe(3)

      const [item1, item2, item3] = list?.children ?? []
      expect(item1?.hasClass('is-checked')).toBe(false)
      expect(item2?.hasClass('is-checked')).toBe(true)
      expect(item3?.hasClass('is-checked')).toBe(false)

      const label1 = item1?.children.find(c => c.hasClass('routine-guidance-label'))
      const checkbox1 = label1?.children.find(c => c.hasClass('routine-guidance-checkbox'))
      expect(checkbox1).toBeDefined()

      // Toggle item1 on
      checkbox1?.click()
      expect(item1?.hasClass('is-checked')).toBe(true)
      expect(toggledEvents).toEqual([{ item: 'Empty inbox', checked: true }])

      // Toggle item1 off
      checkbox1?.click()
      expect(item1?.hasClass('is-checked')).toBe(false)
      expect(toggledEvents).toEqual([
        { item: 'Empty inbox', checked: true },
        { item: 'Empty inbox', checked: false },
      ])
    })
  })

  describe('view integration with stage progress and checklist guidance', () => {
    function findDescendant(root: MockElement, cls: string): MockElement | undefined {
      if (root.hasClass(cls)) {
        return root
      }
      for (const child of root.children) {
        const found = findDescendant(child, cls)
        if (found) {
          return found
        }
      }
      return undefined
    }

    function findAllDescendants(root: MockElement, cls: string): readonly MockElement[] {
      const selfList = root.hasClass(cls) ? [root] : []
      const childLists = root.children.flatMap(child => findAllDescendants(child, cls))
      return [...selfList, ...childLists]
    }

    test('RoutineSidePanelView renders stage progress and interactive guidance checklist', async () => {
      const { EngineStore: StoreClass } = await import('../src/timer/store')
      const { PhaseGraphSchema: GraphSchema } = await import('../src/domain/phase/phase-graph')
      const { PhaseSchema: PhaseSchemaClass } = await import('../src/domain/phase/phase')

      const phaseDefaults = {
        logTarget: { kind: 'activeItem' as const },
        taskSourceId: null,
        completionPolicy: null,
        notification: null,
        onEnter: null,
        onComplete: null,
        onSkip: null,
        onExit: null,
      }

      const p1 = PhaseSchemaClass.parse({
        ...phaseDefaults,
        id: PhaseIdSchemaParse('phase-1'),
        label: 'Step 1: Inbox',
        kind: FOCUS_PHASE_KIND_VAL,
        duration: Temporal.Duration.from({ minutes: 10 }),
        guidance: ['Review new items', 'Flag urgent items'],
      })
      const p2 = PhaseSchemaClass.parse({
        ...phaseDefaults,
        id: PhaseIdSchemaParse('phase-2'),
        label: 'Step 2: Processing',
        kind: FOCUS_PHASE_KIND_VAL,
        duration: Temporal.Duration.from({ minutes: 15 }),
      })

      const graph = GraphSchema.parse({
        id: 'review-routine',
        name: 'Weekly Review',
        phases: [p1, p2],
        transitions: [
          { fromPhaseId: p1.id, toPhaseId: p2.id, condition: { kind: 'always' } },
        ],
      })

      const store = new StoreClass(graph)
      const mockPlugin = {
        app: new MockApp(),
        store,
        settings: { clockSpeedMultiplier: 1 },
        ticker: { restart: () => {} },
        formulaPredicateRegistry: { get: () => undefined },
        saveSettings: async () => {},
      }
      const leaf = { containerEl: new MockElement() }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock view creation
      const sidePanel = new RoutineSidePanelViewClass(leaf as unknown as WorkspaceLeaf, mockPlugin as unknown as RoutineFlowPlugin)
      await sidePanel.onOpen()

      // When stopped, prompt indicates starting a routine
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element access
      const contentEl = sidePanel.contentEl as unknown as MockElement

      // Start routine -> phase-1 active
      await store.dispatch({ type: 'start' })

      const stageProgress = findDescendant(contentEl, 'routine-stage-progress')
      expect(stageProgress).toBeDefined()
      const steps = findAllDescendants(stageProgress!, 'routine-stage-step')
      expect(steps.length).toBe(2)
      expect(steps[0]?.hasClass('is-active')).toBe(true)
      expect(steps[1]?.hasClass('is-upcoming')).toBe(true)

      const checklist = findDescendant(contentEl, 'routine-guidance-checklist')
      expect(checklist).toBeDefined()
      const items = findAllDescendants(checklist!, 'routine-guidance-item')
      expect(items.length).toBe(2)
      expect(items[0]?.hasClass('is-checked')).toBe(false)

      // Interactive check item 0
      const item0 = items[0]
      expect(item0).toBeDefined()
      const checkbox0 = findDescendant(item0!, 'routine-guidance-checkbox')
      checkbox0?.click()
      expect(items[0]?.hasClass('is-checked')).toBe(true)

      // Advance to phase-2 -> guidance cleared, stage progress shows step 1 completed and step 2 active
      await store.dispatch({ type: 'advance-phase' })
      await store.dispatch({ type: 'start' })
      const stageProgressP2 = findDescendant(contentEl, 'routine-stage-progress')
      const stepsP2 = findAllDescendants(stageProgressP2!, 'routine-stage-step')
      expect(stepsP2[0]?.hasClass('is-completed')).toBe(true)
      expect(stepsP2[1]?.hasClass('is-active')).toBe(true)

      // Phase 2 has no guidance
      const checklistP2 = findDescendant(contentEl, 'routine-guidance-checklist')
      expect(checklistP2).toBeUndefined()
    })

    test('RoutineTimerView renders stage progress and checklist in timer panel', async () => {
      const { EngineStore: StoreClass } = await import('../src/timer/store')
      const { PhaseGraphSchema: GraphSchema } = await import('../src/domain/phase/phase-graph')
      const { PhaseSchema: PhaseSchemaClass } = await import('../src/domain/phase/phase')

      const phaseDefaults = {
        logTarget: { kind: 'activeItem' as const },
        taskSourceId: null,
        completionPolicy: null,
        notification: null,
        onEnter: null,
        onComplete: null,
        onSkip: null,
        onExit: null,
      }

      const p1 = PhaseSchemaClass.parse({
        ...phaseDefaults,
        id: PhaseIdSchemaParse('phase-1'),
        label: 'Step 1: Review',
        kind: FOCUS_PHASE_KIND_VAL,
        duration: Temporal.Duration.from({ minutes: 10 }),
        guidance: ['Review daily notes', 'Check action items'],
      })
      const p2 = PhaseSchemaClass.parse({
        ...phaseDefaults,
        id: PhaseIdSchemaParse('phase-2'),
        label: 'Step 2: Wrap-up',
        kind: FOCUS_PHASE_KIND_VAL,
        duration: Temporal.Duration.from({ minutes: 5 }),
      })

      const graph = GraphSchema.parse({
        id: 'review-timer-routine',
        name: 'Daily Review',
        phases: [p1, p2],
        transitions: [
          { fromPhaseId: p1.id, toPhaseId: p2.id, condition: { kind: 'always' } },
        ],
      })

      const store = new StoreClass(graph)
      const mockPlugin = {
        app: new MockApp(),
        store,
        settings: { progressMeterStyle: 'radial' as const },
        taskSourceRegistry: { resolve: () => undefined },
        formulaPredicateRegistry: { get: () => undefined },
        activateView: async () => {},
      }

      const containerEl = new MockElement()
      const controller = {}

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock view creation
      const timerView = new RoutineTimerViewClass(controller as unknown as QueryController, asElement(containerEl), mockPlugin as unknown as RoutineFlowPlugin)
      timerView.onload()

      const timerPanel = findDescendant(containerEl, 'routine-timer-panel')
      expect(timerPanel).toBeDefined()

      const stageProgress = findDescendant(timerPanel!, 'routine-stage-progress')
      expect(stageProgress).toBeDefined()
      const steps = findAllDescendants(stageProgress!, 'routine-stage-step')
      expect(steps.length).toBe(2)
      expect(steps[0]?.hasClass('is-active')).toBe(true)
      expect(steps[1]?.hasClass('is-upcoming')).toBe(true)

      const checklist = findDescendant(timerPanel!, 'routine-guidance-checklist')
      expect(checklist).toBeDefined()
      const items = findAllDescendants(checklist!, 'routine-guidance-item')
      expect(items.length).toBe(2)

      // Interactive check item 1
      const item1 = items[1]
      expect(item1).toBeDefined()
      const checkbox1 = findDescendant(item1!, 'routine-guidance-checkbox')
      checkbox1?.click()
      expect(items[1]?.hasClass('is-checked')).toBe(true)

      // Simulate a timer tick (state remaining changes) -> re-render preserves checked item
      await store.dispatch({ type: 'start' })
      const timerPanelAfterTick = findDescendant(containerEl, 'routine-timer-panel')
      const checklistAfterTick = findDescendant(timerPanelAfterTick!, 'routine-guidance-checklist')
      const itemsAfterTick = findAllDescendants(checklistAfterTick!, 'routine-guidance-item')
      expect(itemsAfterTick[1]?.hasClass('is-checked')).toBe(true)
    })

    test('single-phase routine without guidance omits stage progress and checklist in views', async () => {
      const { EngineStore: StoreClass } = await import('../src/timer/store')
      const { PhaseGraphSchema: GraphSchema } = await import('../src/domain/phase/phase-graph')
      const { PhaseSchema: PhaseSchemaClass } = await import('../src/domain/phase/phase')

      const phaseDefaults = {
        logTarget: { kind: 'activeItem' as const },
        taskSourceId: null,
        completionPolicy: null,
        notification: null,
        onEnter: null,
        onComplete: null,
        onSkip: null,
        onExit: null,
      }

      const p1 = PhaseSchemaClass.parse({
        ...phaseDefaults,
        id: PhaseIdSchemaParse('single-phase'),
        label: 'Only Phase',
        kind: FOCUS_PHASE_KIND_VAL,
        duration: Temporal.Duration.from({ minutes: 25 }),
      })

      const graph = GraphSchema.parse({
        id: 'single-phase-routine',
        name: 'Single Phase Routine',
        phases: [p1],
        transitions: [],
      })

      const store = new StoreClass(graph)
      const mockPlugin = {
        app: new MockApp(),
        store,
        settings: { clockSpeedMultiplier: 1, progressMeterStyle: 'radial' as const },
        ticker: { restart: () => {} },
        taskSourceRegistry: { resolve: () => undefined },
        formulaPredicateRegistry: { get: () => undefined },
        activateView: async () => {},
        saveSettings: async () => {},
      }

      // Check RoutineSidePanelView
      const leaf = { containerEl: new MockElement() }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock view
      const sidePanel = new RoutineSidePanelViewClass(leaf as unknown as WorkspaceLeaf, mockPlugin as unknown as RoutineFlowPlugin)
      await sidePanel.onOpen()
      await store.dispatch({ type: 'start' })
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element
      const sidePanelContent = sidePanel.contentEl as unknown as MockElement
      expect(findDescendant(sidePanelContent, 'routine-stage-progress')).toBeUndefined()
      expect(findDescendant(sidePanelContent, 'routine-guidance-checklist')).toBeUndefined()

      // Check RoutineTimerView
      const containerEl = new MockElement()
      const controller = {}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock view
      const timerView = new RoutineTimerViewClass(controller as unknown as QueryController, asElement(containerEl), mockPlugin as unknown as RoutineFlowPlugin)
      timerView.onload()
      const timerPanel = findDescendant(containerEl, 'routine-timer-panel')
      expect(findDescendant(timerPanel!, 'routine-stage-progress')).toBeUndefined()
      expect(findDescendant(timerPanel!, 'routine-guidance-checklist')).toBeUndefined()
    })
  })
})
