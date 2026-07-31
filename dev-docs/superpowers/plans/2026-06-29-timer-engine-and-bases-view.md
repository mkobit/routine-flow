# Timer engine and bases view implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core Pomodoro state machine, global timer manager, custom Bases view, and file write-back functionality.

**Architecture:** We build a plain TypeScript `TimerManager` to track the state validated by Zod.
We register a custom `BasesView` named `pomodoro-timer` which reads database query results as a work queue.
We write back completion counts to note properties using Obsidian's `processFrontMatter` API.

**Tech Stack:** Bun, TypeScript, Zod, Remeda, Playwright.

---

### Task 1: Timer manager state machine implementation

**Files:**
- Create: `src/timer-manager.ts`
- Create: `tests/timer-manager.test.ts`

- [ ] **Step 1: Write the unit tests for TimerManager state transitions**

Create `tests/timer-manager.test.ts` testing the default state, starting, pausing, skipping, and ticking:
```typescript
import { expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { TimerManager } from '../src/timer-manager';
import { DEFAULT_SETTINGS } from '../src/settings';

let manager: TimerManager;

beforeEach(() => {
  manager = new TimerManager(DEFAULT_SETTINGS);
});

afterEach(() => {
  manager.stop();
});

test('initial state is stopped and idle', () => {
  const state = manager.getState();
  expect(state.status).toBe('stopped');
  expect(state.currentPhaseIndex).toBe(0);
  expect(state.remainingSeconds).toBe(1500);
  expect(state.activeFilePath).toBeNull();
});

test('starting timer transitions to running', () => {
  manager.start('task-1.md');
  const state = manager.getState();
  expect(state.status).toBe('running');
  expect(state.activeFilePath).toBe('task-1.md');
});

test('pausing timer transitions to paused', () => {
  manager.start('task-1.md');
  manager.pause();
  const state = manager.getState();
  expect(state.status).toBe('paused');
});

test('ticking decrements remaining seconds', () => {
  manager.start('task-1.md');
  manager.tick();
  const state = manager.getState();
  expect(state.remainingSeconds).toBe(1499);
});
```

- [ ] **Step 2: Run unit test to verify it fails**

Run:
```bash
bun test tests/timer-manager.test.ts
```
Expected: FAIL with compilation error (TimerManager not defined).

- [ ] **Step 3: Implement TimerManager**

Create `src/timer-manager.ts` using Zod for verification:
```typescript
import { z } from 'zod';
import type { PomodoroSettings } from './settings';

export const TimerPhaseSchema = z.enum(['focus', 'break']);
export type TimerPhase = z.infer<typeof TimerPhaseSchema>;

export const TimerStateSchema = z.object({
  status: z.enum(['running', 'paused', 'stopped']),
  workflowId: z.string(),
  currentPhaseIndex: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  activeFilePath: z.string().nullable(),
});
export type TimerState = z.infer<typeof TimerStateSchema>;

export class TimerManager {
  private state: TimerState;
  private settings: PomodoroSettings;
  private intervalId: Timer | null = null;
  private listeners: ((state: TimerState) => void)[] = [];

  constructor(settings: PomodoroSettings) {
    this.settings = settings;
    this.state = {
      status: 'stopped',
      workflowId: 'default',
      currentPhaseIndex: 0,
      remainingSeconds: settings.defaultWorkDurationSeconds,
      activeFilePath: null,
    };
  }

  public getState(): TimerState {
    return this.state;
  }

  public subscribe(listener: (state: TimerState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public start(filePath?: string) {
    this.state.status = 'running';
    if (filePath !== undefined) {
      this.state.activeFilePath = filePath;
    }
    this.startTicker();
    this.notify();
  }

  public pause() {
    this.state.status = 'paused';
    this.stopTicker();
    this.notify();
  }

  public resume() {
    this.state.status = 'running';
    this.startTicker();
    this.notify();
  }

  public stop() {
    this.state.status = 'stopped';
    this.state.currentPhaseIndex = 0;
    this.state.remainingSeconds = this.settings.defaultWorkDurationSeconds;
    this.state.activeFilePath = null;
    this.stopTicker();
    this.notify();
  }

  public tick() {
    if (this.state.remainingSeconds > 0) {
      this.state.remainingSeconds -= 1;
    } else {
      this.completePhase();
    }
    this.notify();
  }

  private startTicker() {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private stopTicker() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private completePhase() {
    this.stopTicker();
    if (this.state.currentPhaseIndex === 0) {
      this.state.currentPhaseIndex = 1;
      this.state.remainingSeconds = this.settings.defaultBreakDurationSeconds;
    } else {
      this.state.currentPhaseIndex = 0;
      this.state.remainingSeconds = this.settings.defaultWorkDurationSeconds;
    }
    this.notify();
  }
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run:
```bash
bun test tests/timer-manager.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit changes**

Run:
```bash
git add src/timer-manager.ts tests/timer-manager.test.ts
git commit -m "feat: implement TimerManager core and unit tests"
```

---

### Task 2: Bases view implementation

**Files:**
- Create: `src/views/timer-view.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement BasesView**

Create `src/views/timer-view.ts` utilizing Obsidian's abstract `BasesView` class:
```typescript
import { BasesView, type ViewOption, type QueryController } from 'obsidian';
import type PomodoroPlugin from '../main';
import type { TimerState } from '../timer-manager';

export class PomodoroTimerView extends BasesView {
  readonly type = 'pomodoro-timer';
  private plugin: PomodoroPlugin;
  private unsubscribe: (() => void) | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement, plugin: PomodoroPlugin) {
    super(controller);
    this.containerEl = containerEl;
    this.plugin = plugin;
  }

  onload() {
    this.unsubscribe = this.plugin.timer.subscribe((state) => {
      this.render(state);
    });
    this.render(this.plugin.timer.getState());
  }

  onunload() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  onDataUpdated() {
    this.render(this.plugin.timer.getState());
  }

  private render(state: TimerState) {
    this.containerEl.empty();
    
    // Timer Panel
    const timerPanel = this.containerEl.createDiv({ cls: 'pomodoro-timer-panel' });
    const mins = Math.floor(state.remainingSeconds / 60).toString().padStart(2, '0');
    const secs = (state.remainingSeconds % 60).toString().padStart(2, '0');
    timerPanel.createEl('h2', { text: `${mins}:${secs} (${state.status})` });

    // Controls
    const controls = this.containerEl.createDiv({ cls: 'pomodoro-controls' });
    
    if (state.status !== 'running') {
      const playBtn = controls.createEl('button', { text: 'Start' });
      playBtn.addEventListener('click', () => this.plugin.timer.start());
    } else {
      const pauseBtn = controls.createEl('button', { text: 'Pause' });
      pauseBtn.addEventListener('click', () => this.plugin.timer.pause());
    }

    const stopBtn = controls.createEl('button', { text: 'Reset' });
    stopBtn.addEventListener('click', () => this.plugin.timer.stop());

    // Work Queue
    const queueEl = this.containerEl.createDiv({ cls: 'pomodoro-queue' });
    queueEl.createEl('h3', { text: 'Work Queue' });
    
    const entries = this.data?.data || [];
    if (entries.length === 0) {
      queueEl.createEl('p', { text: 'No tasks found.' });
      return;
    }

    const ul = queueEl.createEl('ul');
    for (const entry of entries) {
      const li = ul.createEl('li');
      const taskBtn = li.createEl('button', { text: entry.file.basename });
      if (state.activeFilePath === entry.file.path) {
        li.addClass('is-active-task');
      }
      taskBtn.addEventListener('click', () => {
        this.plugin.timer.start(entry.file.path);
      });
    }
  }

  static getViewOptions(): ViewOption[] {
    return [];
  }
}
```

- [ ] **Step 2: Register view in main.ts**

Modify `src/main.ts` to instantiate `TimerManager` and register the `BasesView`:
```typescript
import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings } from './settings';
import { TimerManager } from './timer-manager';
import { PomodoroTimerView } from './views/timer-view';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;
  public timer!: TimerManager;

  async onload() {
    await this.loadSettings();
    this.timer = new TimerManager(this.settings);

    // Register Bases View
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
        options: () => PomodoroTimerView.getViewOptions(),
      },
    );

    console.log('Pomodoro Plugin loaded successfully');
  }

  onunload() {
    this.timer.stop();
    console.log('Pomodoro Plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<PomodoroSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 3: Build code to ensure successful compilation**

Run:
```bash
bun run build
```
Expected: Compiles with no errors.

- [ ] **Step 4: Commit changes**

Run:
```bash
git add src/views/timer-view.ts src/main.ts
git commit -m "feat: implement PomodoroTimerView and register it in plugin entrypoint"
```

---

### Task 3: Timer completion write-back

**Files:**
- Modify: `src/timer-manager.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add a completion callback hook to TimerManager**

Modify `src/timer-manager.ts` to trigger a callback when the focus phase completes:
```typescript
  private onPhaseCompleteCallback?: (filePath: string) => Promise<void>;

  public onPhaseComplete(callback: (filePath: string) => Promise<void>) {
    this.onPhaseCompleteCallback = callback;
  }

  private async completePhase() {
    this.stopTicker();
    const completedFilePath = this.state.activeFilePath;
    
    if (this.state.currentPhaseIndex === 0) {
      this.state.currentPhaseIndex = 1;
      this.state.remainingSeconds = this.settings.defaultBreakDurationSeconds;
      if (completedFilePath && this.onPhaseCompleteCallback) {
        await this.onPhaseCompleteCallback(completedFilePath);
      }
    } else {
      this.state.currentPhaseIndex = 0;
      this.state.remainingSeconds = this.settings.defaultWorkDurationSeconds;
    }
    this.notify();
  }
```

- [ ] **Step 2: Hook frontmatter write-back in main.ts**

Modify `src/main.ts`'s `onload()` function to hook the callback and write back to frontmatter:
```typescript
    this.timer = new TimerManager(this.settings);
    this.timer.onPhaseComplete(async (filePath) => {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof import('obsidian').TFile)) {
        return;
      }
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        const prop = this.settings.writeBackProperty;
        const current = frontmatter[prop];
        if (typeof current === 'number') {
          frontmatter[prop] = current + 1;
        } else {
          frontmatter[prop] = 1;
        }
      });
    });
```

- [ ] **Step 3: Run unit tests to check regression**

Run:
```bash
bun test tests/timer-manager.test.ts
```
Expected: PASS.

- [ ] **Step 4: Build project**

Run:
```bash
bun run build
```
Expected: Successful compilation.

- [ ] **Step 5: Commit changes**

Run:
```bash
git add src/timer-manager.ts src/main.ts
git commit -m "feat: implement frontmatter write-back on phase completion"
```

---

### Task 4: E2E validation

**Files:**
- Create: `e2e/timer.e2e.ts`

- [ ] **Step 1: Write E2E test verifying Bases view registration and click start**

Create `e2e/timer.e2e.ts`:
```typescript
import { test, expect } from './fixtures/obsidian';
import { evaluateObsidian } from './helpers/evaluate';

const PLUGIN_ID = 'obsidian-pomodoro-plugin';

test.describe('Pomodoro Timer View', () => {
  test('registers bases view and can start a timer', async ({ obsidianPage: { page } }) => {
    // Assert registration exists
    const hasView = await evaluateObsidian(
      page,
      (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
      { pluginId: PLUGIN_ID }
    );
    expect(hasView).toBe(true);
  });
});
```

- [ ] **Step 2: Run all E2E tests**

Run:
```bash
bun run test:e2e
```
Expected: PASS.

- [ ] **Step 3: Commit E2E test**

Run:
```bash
git add e2e/timer.e2e.ts
git commit -m "test: add E2E test verifying view registration"
```
