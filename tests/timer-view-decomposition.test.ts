import { beforeAll, describe, expect, test, mock } from 'bun:test'
import type { App as AppType, BasesOptions, TFile as TFileType } from 'obsidian'
import type { Temporal as TemporalType } from 'temporal-polyfill'
import type { Phase, PhaseId, PhaseKind } from '../src/domain/phase/phase'
import type { TaskQueueItem, TaskQueueItemId, TaskSourceId } from '../src/domain/queue/task-source'

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

  addEventListener(): void {}
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
      constructor(_controller: unknown) {}
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
      constructor(_app: unknown) {}
    },
    App: MockApp,
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
let renderQueuePanelFn: (queueEl: HTMLElement, options: {
  phase: Phase
  activeFilePath: string | null
  queueItems: readonly TaskQueueItem[]
  app: AppType
  onSelectTask: (path: string) => void
}) => void
let FOCUS_PHASE_KIND_VAL: PhaseKind
let BREAK_PHASE_KIND_VAL: PhaseKind
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

    const phaseMod = await import('../src/domain/phase/phase')
    PhaseIdSchemaParse = val => phaseMod.PhaseIdSchema.parse(val)

    const queueMod = await import('../src/domain/queue/task-source')
    TaskSourceIdSchemaParse = val => queueMod.TaskSourceIdSchema.parse(val)
    TaskQueueItemIdSchemaParse = val => queueMod.TaskQueueItemIdSchema.parse(val)
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

      const ul = queueEl.children.find(c => c.children.length > 0)
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
  })
})
