# Refactoring and agentic setup implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the codebase to eliminate the monolithic `TimerManager` class, add the Settings UI tab, and write agent instruction files.

**Architecture:** We decompose the timer logic into a pure reducer function, a state container store, and an isolated interval ticker class.
We implement the `SettingTab` in [src/settings.ts](file:///home/mkobit/workspace/mkobit/obsidian-pomodoro-plugin/src/settings.ts) using the Obsidian Settings API.
We write the agent documentation files to guide future agent development.

**Tech Stack:** Bun, TypeScript, Zod.

---

### Task 1: Decompose TimerManager into pure state machine and ticker

**Files:**
- Create: `src/timer/reducer.ts`
- Create: `src/timer/store.ts`
- Create: `src/timer/ticker.ts`
- Create: `tests/timer.test.ts`
- Modify: `src/main.ts`
- Modify: `src/views/timer-view.ts`
- Delete: `src/timer-manager.ts`
- Delete: `tests/timer-manager.test.ts`

- [ ] **Step 1: Write pure reducer unit tests**

Create `tests/timer.test.ts` to assert transitions in the pure reducer:
```typescript
import { expect, test } from 'bun:test';
import { timerReducer, type TimerState, type TimerAction } from '../src/timer/reducer';
import { DEFAULT_SETTINGS } from '../src/settings';

test('reducer start transitions status to running', () => {
  const initial: TimerState = {
    status: 'stopped',
    workflowId: 'default',
    currentPhaseIndex: 0,
    remainingSeconds: 1500,
    activeFilePath: null,
  };
  const action: TimerAction = { type: 'start', filePath: 'task.md' };
  const next = timerReducer(initial, action, DEFAULT_SETTINGS);
  
  expect(next.status).toBe('running');
  expect(next.activeFilePath).toBe('task.md');
});

test('reducer tick decrements remaining seconds', () => {
  const initial: TimerState = {
    status: 'running',
    workflowId: 'default',
    currentPhaseIndex: 0,
    remainingSeconds: 10,
    activeFilePath: 'task.md',
  };
  const action: TimerAction = { type: 'tick' };
  const next = timerReducer(initial, action, DEFAULT_SETTINGS);

  expect(next.remainingSeconds).toBe(9);
});
```

- [ ] **Step 2: Implement pure reducer**

Create `src/timer/reducer.ts` using Zod:
```typescript
import { z } from 'zod';
import type { PomodoroSettings } from '../settings';

export const TimerStateSchema = z.object({
  status: z.enum(['running', 'paused', 'stopped']),
  workflowId: z.string(),
  currentPhaseIndex: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  activeFilePath: z.string().nullable(),
});
export type TimerState = z.infer<typeof TimerStateSchema>;

export type TimerAction =
  | { type: 'start'; filePath?: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'tick' }
  | { type: 'complete-phase' };

export function timerReducer(state: TimerState, action: TimerAction, settings: PomodoroSettings): TimerState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        status: 'running',
        activeFilePath: action.filePath !== undefined ? action.filePath : state.activeFilePath,
      };
    case 'pause':
      return { ...state, status: 'paused' };
    case 'resume':
      return { ...state, status: 'running' };
    case 'stop':
      return {
        status: 'stopped',
        workflowId: 'default',
        currentPhaseIndex: 0,
        remainingSeconds: settings.defaultWorkDurationSeconds,
        activeFilePath: null,
      };
    case 'tick':
      if (state.remainingSeconds > 0) {
        return { ...state, remainingSeconds: state.remainingSeconds - 1 };
      }
      return completePhase(state, settings);
    case 'complete-phase':
      return completePhase(state, settings);
  }
}

function completePhase(state: TimerState, settings: PomodoroSettings): TimerState {
  if (state.currentPhaseIndex === 0) {
    return {
      ...state,
      status: 'stopped',
      currentPhaseIndex: 1,
      remainingSeconds: settings.defaultBreakDurationSeconds,
    };
  }
  return {
    ...state,
    status: 'stopped',
    currentPhaseIndex: 0,
    remainingSeconds: settings.defaultWorkDurationSeconds,
  };
}
```

- [ ] **Step 3: Implement store container**

Create `src/timer/store.ts` to manage state subscriptions and dispatching:
```typescript
import type { TimerState, TimerAction } from './reducer';
import { timerReducer } from './reducer';
import type { PomodoroSettings } from '../settings';

export class TimerStore {
  private state: TimerState;
  private settings: PomodoroSettings;
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

  public dispatch(action: TimerAction) {
    const next = timerReducer(this.state, action, this.settings);
    if (next !== this.state) {
      this.state = next;
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }

  public updateSettings(settings: PomodoroSettings) {
    this.settings = settings;
  }
}
```

- [ ] **Step 4: Implement isolated interval ticker**

Create `src/timer/ticker.ts` depending exclusively on dispatch action interface:
```typescript
export class TimerTicker {
  private dispatch: (action: { type: 'tick' }) => void;
  private intervalId: Timer | null = null;

  constructor(dispatch: (action: { type: 'tick' }) => void) {
    this.dispatch = dispatch;
  }

  public start() {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.dispatch({ type: 'tick' });
    }, 1000);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

- [ ] **Step 5: Adjust views and main entries**

Modify `src/main.ts` to hook up the store and ticker:
```typescript
import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings } from './settings';
import { TimerStore } from './timer/store';
import { TimerTicker } from './timer/ticker';
import { PomodoroTimerView } from './views/timer-view';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;
  public store!: TimerStore;
  public ticker!: TimerTicker;

  async onload() {
    await this.loadSettings();
    this.store = new TimerStore(this.settings);
    this.ticker = new TimerTicker((action) => this.store.dispatch(action));

    // Handle background ticker transitions
    let lastState = this.store.getState();
    this.store.subscribe(async (state) => {
      if (state.status === 'running') {
        this.ticker.start();
      } else {
        this.ticker.stop();
      }

      // Check phase completion write-back transition
      if (lastState.currentPhaseIndex === 0 && state.currentPhaseIndex === 1 && state.activeFilePath) {
        await this.handlePhaseComplete(state.activeFilePath);
      }
      lastState = state;
    });

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
  }

  private async handlePhaseComplete(filePath: string) {
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
  }

  onunload() {
    this.ticker.stop();
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<PomodoroSettings>,
    );
    if (this.store) {
      this.store.updateSettings(this.settings);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.store) {
      this.store.updateSettings(this.settings);
    }
  }
}
```

- [ ] **Step 6: Update Bases View**

Modify `src/views/timer-view.ts` to dispatch events to the store:
```typescript
import { BasesView, type ViewOption, type QueryController } from 'obsidian';
import type PomodoroPlugin from '../main';
import type { TimerState } from '../timer/reducer';

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
    this.unsubscribe = this.plugin.store.subscribe((state) => {
      this.render(state);
    });
    this.render(this.plugin.store.getState());
  }

  onunload() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  onDataUpdated() {
    this.render(this.plugin.store.getState());
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
      playBtn.addEventListener('click', () => this.plugin.store.dispatch({ type: 'start' }));
    } else {
      const pauseBtn = controls.createEl('button', { text: 'Pause' });
      pauseBtn.addEventListener('click', () => this.plugin.store.dispatch({ type: 'pause' }));
    }

    const stopBtn = controls.createEl('button', { text: 'Reset' });
    stopBtn.addEventListener('click', () => this.plugin.store.dispatch({ type: 'stop' }));

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
        this.plugin.store.dispatch({ type: 'start', filePath: entry.file.path });
      });
    }
  }

  static getViewOptions(): ViewOption[] {
    return [];
  }
}
```

- [ ] **Step 7: Delete deprecated files and run tests**

Run:
```bash
rm src/timer-manager.ts tests/timer-manager.test.ts
bun test
bun run build
```
Expected: Tests pass and project compiles cleanly.

- [ ] **Step 8: Commit refactoring**

Run:
```bash
git add src/tests/ tests/timer.test.ts src/timer/ src/main.ts src/views/timer-view.ts
git rm src/timer-manager.ts tests/timer-manager.test.ts
git commit -m "refactor: decompose monolithic TimerManager into pure reducer, store and ticker"
```

---

### Task 2: Settings UI implementation

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write SettingTab class in settings.ts**

Modify `src/settings.ts` to implement the `SettingTab` interface using Obsidian's API:
```typescript
import { PluginSettingTab, App, Setting } from 'obsidian';
import type PomodoroPlugin from './main';

export class PomodoroSettingTab extends PluginSettingTab {
  private plugin: PomodoroPlugin;

  constructor(app: App, plugin: PomodoroPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Write-back property')
      .setDesc('Frontmatter property updated when a focus block completes.')
      .addText((text) =>
        text
          .setPlaceholder('pomodoros')
          .setValue(this.plugin.settings.writeBackProperty)
          .onChange(async (value) => {
            this.plugin.settings.writeBackProperty = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Focus duration (minutes)')
      .setDesc('Duration of the work/focus phase.')
      .addText((text) =>
        text
          .setValue((this.plugin.settings.defaultWorkDurationSeconds / 60).toString())
          .onChange(async (value) => {
            const mins = parseInt(value, 10);
            if (!isNaN(mins) && mins > 0) {
              this.plugin.settings.defaultWorkDurationSeconds = mins * 60;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Break duration (minutes)')
      .setDesc('Duration of the break phase.')
      .addText((text) =>
        text
          .setValue((this.plugin.settings.defaultBreakDurationSeconds / 60).toString())
          .onChange(async (value) => {
            const mins = parseInt(value, 10);
            if (!isNaN(mins) && mins > 0) {
              this.plugin.settings.defaultBreakDurationSeconds = mins * 60;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
```

- [ ] **Step 2: Add setting tab registration to main.ts**

Modify `src/main.ts`'s `onload()` function:
```typescript
    // Under registerBasesView:
    this.addSettingTab(new PomodoroSettingTab(this.app, this));
```
Remember to import `PomodoroSettingTab` from `./settings`.

- [ ] **Step 3: Build and test**

Run:
```bash
bun run build
bun run test:e2e
```
Expected: Clean compilation, smoke tests pass.

- [ ] **Step 4: Commit settings UI**

Run:
```bash
git add src/settings.ts src/main.ts
git commit -m "feat: add setting tab UI implementation"
```

---

### Task 3: Write agent configuration files

**Files:**
- Create: `AGENTS.md`
- Create: `e2e/AGENTS.md`

- [ ] **Step 1: Write root AGENTS.md**

Create `AGENTS.md`:
```markdown
# Obsidian Pomodoro Plugin

This repository contains a customizable Pomodoro timer plugin integrated with Obsidian Bases.
It is built with strict TypeScript enforcement.

## Code style and rules

The project enforces strict Functional Programming principles via `eslint`.
- **No mutations**: Use pure reducer functions for state transformations.
- **Dependency separation**: State reducer, state store, and execution tickers live in isolated modules.
- **Dependency Injection**: Inject dispatch handlers and settings instead of binding to global managers.
- **Date/Time**: Use the `Temporal` API for logic instead of the native `Date`.

## Commands

| Command | Description |
| :--- | :--- |
| `bun run build` | Compiles the plugin using esbuild. |
| `bun test` | Executes unit tests via bun test. |
| `bun run test:e2e` | Runs E2E tests using Playwright. |
| `bun run vault:dev` | Launches sandboxed Obsidian against the testing vault. |
```

- [ ] **Step 2: Write e2e/AGENTS.md**

Create `e2e/AGENTS.md`:
```markdown
# End-to-end testing guidelines

These instructions apply when editing or running end-to-end tests for the Pomodoro plugin.

## Playwright interactions

Always interact with the internal Obsidian API using `evaluateObsidian`.
Avoid scraping browser elements or parsing UI layers unless checking raw HTML rendering.
Variables must be passed explicitly into the helper callbacks because closures are not preserved during serialization.
Refer to `e2e/obsidian-internal.d.ts` when adding new API properties.
```

- [ ] **Step 3: Commit agent guides**

Run:
```bash
git add AGENTS.md e2e/AGENTS.md
git commit -m "docs: add AGENTS.md instruction files for development guides"
```
