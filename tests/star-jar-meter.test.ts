import { beforeAll, describe, expect, mock, test } from 'bun:test'
import type { renderStarJarMeter as renderStarJarMeterType } from '../src/views/timer/star-jar-meter'

class MockDomElement {
  className = ''
  children: MockDomElement[] = []
  textContent = ''
  readonly attrs: Record<string, string> = {}
  readonly styleProps: Record<string, string> = {}

  readonly style = {
    setProperty: (prop: string, val: string): void => {
      this.styleProps[prop] = val
    },
    getPropertyValue: (prop: string): string => this.styleProps[prop] ?? '',
  }

  addClass(cls: string): void {
    const tokens = this.className.split(' ').filter(Boolean)
    if (!tokens.includes(cls)) {
      tokens.push(cls)
    }
    this.className = tokens.join(' ')
  }

  hasClass(cls: string): boolean {
    return this.className.split(' ').filter(Boolean).includes(cls)
  }

  setAttribute(name: string, val: string): void {
    this.attrs[name] = val
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null
  }

  createDiv(options?: { cls?: string, text?: string }): MockDomElement {
    const el = new MockDomElement()
    if (options?.cls) {
      el.addClass(options.cls)
    }
    if (options?.text) {
      el.textContent = options.text
    }
    this.children.push(el)
    return el
  }

  createSpan(options?: { cls?: string, text?: string }): MockDomElement {
    const el = new MockDomElement()
    if (options?.cls) {
      el.addClass(options.cls)
    }
    if (options?.text) {
      el.textContent = options.text
    }
    this.children.push(el)
    return el
  }
}

void mock.module('obsidian', () => ({
  BasesView: class {
    containerEl = new MockDomElement()
    constructor(_controller: unknown) {}
  },
  PluginSettingTab: class {
    containerEl = new MockDomElement()
  },
  Setting: class {
    settingEl = new MockDomElement()
    constructor(_container: MockDomElement) {}
    setClass(): this {
      return this
    }

    setName(): this {
      return this
    }

    setDesc(): this {
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

    addText(): this {
      return this
    }

    addDropdown(): this {
      return this
    }
  },
  Modal: class {
    contentEl = new MockDomElement()
    titleEl = new MockDomElement()
    containerEl = new MockDomElement()
    open(): void {}
    close(): void {}
  },
  ItemView: class {
    containerEl = new MockDomElement()
  },
  WorkspaceLeaf: class {
    view = { containerEl: new MockDomElement() }
  },
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
  Plugin: class {},
  TFile: class {},
  setIcon: (el: MockDomElement, _name: string) => {
    el.createDiv({ cls: 'lucide-icon' })
  },
}))

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element helper
const asElement = (el: MockDomElement): HTMLElement => el as unknown as HTMLElement

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock element helper
const asMock = (el: HTMLElement): MockDomElement => el as unknown as MockDomElement

let renderStarJarMeter: typeof renderStarJarMeterType

beforeAll(async () => {
  const mod = await import('../src/views/timer/star-jar-meter')
  renderStarJarMeter = mod.renderStarJarMeter
})

describe('renderStarJarMeter', () => {
  test('renders container with header, star jar title, and point count', () => {
    const container = new MockDomElement()
    const meter = asMock(renderStarJarMeter(asElement(container), {
      current: 5,
      target: 15,
      progressFraction: 5 / 15,
      isFull: false,
    }))

    expect(meter.hasClass('routine-star-jar-meter')).toBe(true)
    expect(meter.hasClass('is-full')).toBe(false)

    const header = meter.children.find(c => c.hasClass('routine-star-jar-header'))
    expect(header).toBeDefined()

    const title = header?.children.find(c => c.hasClass('routine-star-jar-title-container'))
    const titleSpan = title?.children.find(c => c.hasClass('routine-star-jar-title'))
    expect(titleSpan?.textContent).toBe('Star jar')

    const countContainer = header?.children.find(c => c.hasClass('routine-star-jar-count'))
    const currentSpan = countContainer?.children.find(c => c.hasClass('routine-star-jar-current'))
    const targetSpan = countContainer?.children.find(c => c.hasClass('routine-star-jar-target'))
    expect(currentSpan?.textContent).toBe('5')
    expect(targetSpan?.textContent).toBe('15 stars')
  })

  test('renders progress bar with proper aria attributes and width indicator', () => {
    const container = new MockDomElement()
    const meter = asMock(renderStarJarMeter(asElement(container), {
      current: 9,
      target: 15,
      progressFraction: 0.6,
      isFull: false,
    }))

    const progressBar = meter.children.find(c => c.hasClass('routine-star-jar-progress-bar'))
    expect(progressBar).toBeDefined()
    expect(progressBar?.getAttribute('role')).toBe('progressbar')
    expect(progressBar?.getAttribute('aria-valuenow')).toBe('9')
    expect(progressBar?.getAttribute('aria-valuemax')).toBe('15')
    expect(progressBar?.getAttribute('aria-label')).toBe('Star jar: 9 of 15 stars')
    expect(progressBar?.style.getPropertyValue('--routine-star-jar-progress')).toBe('0.6')

    const indicator = progressBar?.children.find(c => c.hasClass('routine-star-jar-indicator'))
    expect(indicator?.style.getPropertyValue('width')).toBe('60%')
  })

  test('renders celebratory state when milestone threshold is reached (isFull: true)', () => {
    const container = new MockDomElement()
    const meter = asMock(renderStarJarMeter(asElement(container), {
      current: 15,
      target: 15,
      progressFraction: 1.0,
      isFull: true,
    }))

    expect(meter.hasClass('is-full')).toBe(true)
    expect(meter.hasClass('is-celebrating')).toBe(true)

    const celebration = meter.children.find(c => c.hasClass('routine-star-jar-celebration'))
    expect(celebration).toBeDefined()
    const celebrationText = celebration?.children.find(c => c.hasClass('routine-star-jar-celebration-text'))
    expect(celebrationText?.textContent).toBe('Goal reached! Reward unlocked')
  })
})
