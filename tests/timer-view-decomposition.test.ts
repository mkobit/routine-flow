import { beforeAll, describe, expect, test, mock } from 'bun:test'
import type { App as AppType, BasesOptions, TFile as TFileType } from 'obsidian'
import type { Temporal as TemporalType } from 'temporal-polyfill'
import type { Phase, PhaseId, PhaseKind } from '../src/domain/phase/phase'
import type { TaskQueueItem, TaskQueueItemId, TaskSourceId } from '../src/domain/queue/task-source'
import type { QueuePanelOptions } from '../src/views/timer/queue-panel'
import type { handleSelectorWinner } from '../src/views/timer-view'

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

  empty(): void {
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
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createDiv(o?: { cls?: string, attr?: Record<string, string> }): MockElement {
    const child = new MockElement()
    child.tagName = 'DIV'
    if (o?.cls) {
      child.addClass(o.cls)
    }
    if (o?.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        child.setAttribute(k, v)
      }
    }
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  createSpan(o?: { text?: string, cls?: string }): MockElement {
    const child = new MockElement()
    child.tagName = 'SPAN'
    if (o?.cls) {
      child.addClass(o.cls)
    }
    if (o?.text) {
      child.setText(o.text)
    }
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
    this.children.push(child)
    this.childElementCount = this.children.length
    return child
  }

  addEventListener(event: string, handler: (e: unknown) => void): void {
    const list = this.listeners[event] ?? []
    list.push(handler)
    this.listeners[event] = list
  }

  click(): void {
    const handlers = this.listeners.click ?? []
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
let RoutineTimerViewClass: { getViewOptions: (app: AppType) => BasesOptions[] }
let renderStateIconFn: (parent: HTMLElement, names: readonly string[]) => HTMLElement
let renderProgressMeterFn: (dial: HTMLElement, options: {
  style: 'radial' | 'fill-bar' | 'battery-drain' | 'tick-marks'
  isInert: boolean
  duration: TemporalType.Duration | null
  remaining: TemporalType.Duration | null
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

    const stateIconMod = await import('../src/views/timer/state-icon')
    renderStateIconFn = stateIconMod.renderStateIcon

    const progressMeterMod = await import('../src/views/timer/progress-meter')
    renderProgressMeterFn = progressMeterMod.renderProgressMeter

    const configPanelMod = await import('../src/views/timer/config-panel')
    renderConfigBarFn = configPanelMod.renderConfigBar
    renderConfigPanelFn = configPanelMod.renderConfigPanel

    const queuePanelMod = await import('../src/views/timer/queue-panel')
    renderQueuePanelFn = queuePanelMod.renderQueuePanel

    const phaseGraphMod = await import('../src/timer/phase-graph')
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
})
