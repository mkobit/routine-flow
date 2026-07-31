# Auto-advance active item on query list change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `EngineState.activeFilePath` valid as the Base's live query result set changes, so a task that leaves the query (marked done, deleted, moved out of scope) doesn't leave a stale, never-highlighted active file behind.

**Architecture:** A pure resolution function decides what the active file path should become given the current one and the full list of query result paths. A new `EngineAction` applies that decision to `EngineState` without touching timer status. `PomodoroTimerView.onDataUpdated()` (the Bases lifecycle hook that fires on query-result changes) calls the resolver against the full unfiltered query result set and dispatches the action when it disagrees with the current state.

**Tech Stack:** TypeScript, Zod, `bun:test`, Obsidian `BasesView` API.

**Full design:** `docs/superpowers/specs/2026-07-07-auto-advance-active-item-design.md`

---

### Task 1: Pure `resolveActiveFilePath` helper

**Files:**
- Create: `src/timer/queue-advance.ts`
- Test: `tests/queue-advance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/queue-advance.test.ts`:

```typescript
import { test, expect, describe } from 'bun:test'
import { resolveActiveFilePath } from '../src/timer/queue-advance'

describe('resolveActiveFilePath', () => {
  test('a null activeFilePath stays null', () => {
    expect(resolveActiveFilePath(null, ['a.md', 'b.md'])).toBeNull()
  })

  test('a path still present in the queue is unchanged', () => {
    expect(resolveActiveFilePath('b.md', ['a.md', 'b.md'])).toBe('b.md')
  })

  test('a path absent from the queue resolves to the first remaining entry', () => {
    expect(resolveActiveFilePath('gone.md', ['a.md', 'b.md'])).toBe('a.md')
  })

  test('a path absent from an empty queue resolves to null', () => {
    expect(resolveActiveFilePath('gone.md', [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test ./tests/queue-advance.test.ts`
Expected: FAIL — `Export named 'resolveActiveFilePath' not found in module '../src/timer/queue-advance'` (the module doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/timer/queue-advance.ts`:

```typescript
/**
 * Resolves what EngineState.activeFilePath should be after a task queue's
 * entries change. Unchanged if still present in the queue (or already
 * null); otherwise the first remaining entry, or null if the queue is
 * empty. Operates on plain file paths, not BasesEntry/TaskSource, so it
 * needs no Obsidian types and no mocking to test.
 */
export function resolveActiveFilePath(
  activeFilePath: string | null,
  queueFilePaths: readonly string[],
): string | null {
  if (activeFilePath === null || queueFilePaths.includes(activeFilePath)) {
    return activeFilePath
  }
  return queueFilePaths[0] ?? null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test ./tests/queue-advance.test.ts`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/timer/queue-advance.ts tests/queue-advance.test.ts
git commit -m "feat: add resolveActiveFilePath helper for query-list auto-advance (flow-gu1.9)"
```

---

### Task 2: `set-active-file` reducer action

**Files:**
- Modify: `src/timer/reducer.ts:10-17` (the `EngineAction` union), `src/timer/reducer.ts:44-68` (the `engineReducer` switch)
- Test: `tests/timer.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/timer.test.ts`, insert these three tests immediately after the existing `'start transitions to running and records file path'` test (after line 69, before the `'pause transitions running to paused'` test):

```typescript
  test('set-active-file updates activeFilePath without touching status', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running', activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: 'other.md' }, testGraph)
    expect(next.activeFilePath).toBe('other.md')
    expect(next.status).toBe('running')
  })

  test('set-active-file is a no-op when the file path is unchanged', () => {
    const state: EngineState = { ...initialEngineState(testGraph), activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: 'task.md' }, testGraph)
    expect(next).toBe(state)
  })

  test('set-active-file can clear activeFilePath back to null', () => {
    const state: EngineState = { ...initialEngineState(testGraph), activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: null }, testGraph)
    expect(next.activeFilePath).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test ./tests/timer.test.ts`
Expected: FAIL — TypeScript error / runtime failure, since `EngineAction` has no `'set-active-file'` member yet (the object literal `{ type: 'set-active-file', ... }` doesn't satisfy `EngineAction`).

- [ ] **Step 3: Write the minimal implementation**

In `src/timer/reducer.ts`, change the `EngineAction` union (currently lines 10-16):

```typescript
export type EngineAction
  = | { type: 'start', filePath?: string }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'tick' }
    | { type: 'advance-phase' }
```

to:

```typescript
export type EngineAction
  = | { type: 'start', filePath?: string }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'tick' }
    | { type: 'advance-phase' }
    | { type: 'set-active-file', filePath: string | null }
```

Then in the `engineReducer` switch (currently ending at line 66-67 with the `'advance-phase'` case), add a new case right after it:

```typescript
    case 'advance-phase':
      return advancePhase(state, graph)
    case 'set-active-file':
      return action.filePath === state.activeFilePath
        ? state
        : { ...state, activeFilePath: action.filePath }
```

No change is needed to `deriveHookEvents` — it already returns `[]` for any action type it doesn't explicitly handle (falls through past its `'tick'` and `'advance-phase'` checks to the final `return []`), and `'set-active-file'` should fire no phase lifecycle hooks.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test ./tests/timer.test.ts`
Expected: PASS — all tests in the file, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/timer/reducer.ts tests/timer.test.ts
git commit -m "feat: add set-active-file EngineAction (flow-gu1.9)"
```

---

### Task 3: Wire auto-advance into `PomodoroTimerView`

**Files:**
- Modify: `src/views/timer-view.ts:1-40` (imports and `onDataUpdated`)

- [ ] **Step 1: Add the import**

In `src/views/timer-view.ts`, add this import alongside the existing ones near the top of the file (after the `RoutineReplaceModal` import on line 9):

```typescript
import { resolveActiveFilePath } from '../timer/queue-advance'
```

- [ ] **Step 2: Update `onDataUpdated` and add `applyAutoAdvance`**

Replace the existing `onDataUpdated` method:

```typescript
  onDataUpdated() {
    this.render(this.plugin.store.getState())
  }
```

with:

```typescript
  onDataUpdated() {
    this.applyAutoAdvance()
    this.render(this.plugin.store.getState())
  }

  private applyAutoAdvance(): void {
    const state = this.plugin.store.getState()
    const allPaths = (this.data?.data ?? []).map(entry => entry.file.path)
    const resolved = resolveActiveFilePath(state.activeFilePath, allPaths)
    if (resolved !== state.activeFilePath) {
      void this.plugin.store.dispatch({ type: 'set-active-file', filePath: resolved })
    }
  }
```

`onload()` (a few lines above) is unchanged — it calls `render()` directly, before the Base's first query result has arrived, and a freshly opened view always starts with `activeFilePath: null` regardless.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `bun run lint`
Expected: no errors (this file is under the relaxed `src/views/**` path, but this change introduces no classes/throw/loops beyond what already exists).

- [ ] **Step 5: Run the full test suite**

Run: `bun run test`
Expected: all tests pass (no `PomodoroTimerView`-level test exists or is added — the repo has no harness for `BasesView` subclasses; this is called out as out of scope in the design doc).

- [ ] **Step 6: Commit**

```bash
git add src/views/timer-view.ts
git commit -m "feat: auto-advance active item when it leaves the Base query (flow-gu1.9)"
```

---

### Task 4: Close out

- [ ] **Step 1: Run full quality gates**

```bash
bun run typecheck
bun run lint
bun run test
```

Expected: all three clean.

- [ ] **Step 2: Close the beads issue**

```bash
bd close flow-gu1.9 --reason="Active file auto-advances via onDataUpdated against the full unfiltered query result set; set-active-file EngineAction added, resolveActiveFilePath pure helper covers the resolution rule. See docs/superpowers/specs/2026-07-07-auto-advance-active-item-design.md."
```

- [ ] **Step 3: Push**

```bash
git push
```
