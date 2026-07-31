# Auto-advance active item on query list change (flow-gu1.9)

## Problem

`EngineState.activeFilePath` (`src/domain/session/engine-state.ts`) tracks which task note is "active" once a user clicks it in `PomodoroTimerView`'s queue (`src/views/timer-view.ts`).
Nothing currently keeps that pointer valid.
If the active file's frontmatter changes so it no longer matches the Base's query (e.g. the user marks it done elsewhere), or the file is deleted or moved out of the Base's scope, `activeFilePath` keeps pointing at a file that's effectively gone from the query.
The UI has no way to notice or recover — no queue row is ever highlighted as active again until the user manually clicks something.

## Trigger

`PomodoroTimerView.onDataUpdated()` — the `BasesView` lifecycle hook that fires whenever the Base's live query result set changes.
This is the correct signal for "the query list changed," as opposed to `render()`, which also runs on every store tick and phase transition for unrelated reasons.

## Membership scope

The check compares `activeFilePath` against the Base's full, unfiltered query result set (`this.data.data`), not the phase-kind-filtered subset (`filteredEntries`, scoped to focus or break via the `focusProperty`/`breakProperty` view options).
Filtering by phase kind is a per-render display concern, not a signal that the file left the query.
Checking against the filtered subset would make every focus↔break phase transition look like the active task disappeared, clearing or reassigning it for no reason tied to the actual query data.

## Resolution rule

When `activeFilePath` is absent from the full entries list:
- if the list is non-empty, the new active file is the first entry in query order
- if the list is empty, `activeFilePath` becomes `null`

When `activeFilePath` is present (or already `null`), it is left unchanged.

This never touches `EngineState.status` — a running or paused phase keeps ticking; only which file is marked active changes.

## Changes

### `src/timer/reducer.ts`

New `EngineAction` variant:

```typescript
| { type: 'set-active-file', filePath: string | null }
```

Reducer case, following the existing no-op-returns-same-reference pattern already used by the `tick` case:

```typescript
case 'set-active-file':
  return action.filePath === state.activeFilePath
    ? state
    : { ...state, activeFilePath: action.filePath }
```

`deriveHookEvents` needs no change — the action falls through its existing unhandled-action-type path (`return []`).
Task-level active/inactive transitions are not phase lifecycle events; no `onEnter`/`onComplete`/`onSkip`/`onExit` hook fires from this action.

### `src/timer/queue-advance.ts` (new)

A pure helper, isolated from any Obsidian type so it's unit-testable without mocking `BasesEntry`:

```typescript
/**
 * Resolves what activeFilePath should be after a task queue's entries
 * change. Unchanged if still present (or already null); otherwise the
 * first remaining entry, or null if the queue is empty.
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

### `src/views/timer-view.ts`

```typescript
onDataUpdated() {
  this.applyAutoAdvance()
  this.render(this.plugin.store.getState())
}

private applyAutoAdvance(): void {
  const state = this.plugin.store.getState()
  const allPaths = (this.data?.data ?? []).map((entry) => entry.file.path)
  const resolved = resolveActiveFilePath(state.activeFilePath, allPaths)
  if (resolved !== state.activeFilePath) {
    void this.plugin.store.dispatch({ type: 'set-active-file', filePath: resolved })
  }
}
```

`onload()` is unchanged — its initial `render()` call runs before the Base's first query result arrives, and a freshly opened view always starts with `activeFilePath: null` anyway (no session started yet), so there's nothing for the initial paint to auto-advance.

## Testing

- `tests/timer.test.ts`: reducer case for `set-active-file` — sets a new file path, no-ops when the path is unchanged (same object reference), leaves `status`/`remaining`/other fields untouched.
- `tests/queue-advance.test.ts` (new): `resolveActiveFilePath`'s four cases — `null` in stays `null`; present path is unchanged; absent path resolves to the first remaining entry; empty list resolves to `null`.
- No `PomodoroTimerView`-level test — the repo has no existing test harness for `BasesView` subclasses, and adding one is out of scope for this change (tracked separately by flow-i43/flow-3tj's e2e work).

## Out of scope

- Wiring the `TaskSource`/`TaskQueueItem` domain types (`src/domain/queue/task-source.ts`) into the engine. This change works directly against `BasesEntry` file paths from the view, matching how `filteredEntries` already works today. A real `BaseQuerySource` `TaskSource` implementation is a larger, separate lift.
- `Workflow.taskAdvanceMode` / manual-vs-auto toggle. That field does not exist in the current domain model (it was part of an earlier, superseded design referenced in flow-gu1.12's close notes). Auto-advance as scoped here is unconditional — there is no manual mode to opt out of.
