# Shared routine definitions

## Description

A routine's timer shape — its phases, durations, and transitions — lives in one file.
More than one Bases view can point at that same file instead of each getting its own copy: define the routine once, then reuse it from as many views, in as many folders, as needed.
Edit the shared file and every view that points at it picks up the change; there is nothing to keep in sync by hand.

Two files already do this: `routine-flow-example-vault/routines/standup-routine.md` and `routines/workout-routine.md` back the "Standup" and "Workout" sub-views in `Tasks.base` (see [standup.md](standup.md) and [workout.md](workout.md) for their graphs — this example introduces no new one).
To make the reuse itself visible, rather than incidental, this example adds a second `.base` file in a different folder pointing at the exact same two files: the hand-authored `routine-flow-example-vault/shared-routines/Shared-routines.base`.

## Domain mapping

This example introduces no new `PhaseGraph` shape — the `standup` and `workout` graphs are exactly [standup.md](standup.md)'s and [workout.md](workout.md)'s, unchanged.
What's mapped here is the reference mechanism that lets more than one view resolve to the same graph.

`RoutineTimerView.getViewOptions()` (`src/views/timer-view.ts`) declares `routineFile`, a `file`-kind `BasesOptions` entry filtered to files whose frontmatter sets `is-routine: true`.
Each Bases view reads its own configured value via `this.config?.get('routineFile')` (`getConfiguredRoutineFilePath`) and resolves it with `vault.getFileByPath(path)` — an absolute, vault-root path, not one relative to the `.base` file that names it, so the identical string resolves to the identical file no matter which folder holds the referencing `.base`.

| Base file | View name | `routineFile` | Resolved graph id |
|---|---|---|---|
| `Tasks.base` | Standup | `routines/standup-routine.md` | `standup` |
| `shared-routines/Shared-routines.base` | Standup | `routines/standup-routine.md` | `standup` |
| `Tasks.base` | Workout | `routines/workout-routine.md` | `workout` |
| `shared-routines/Shared-routines.base` | Workout | `routines/workout-routine.md` | `workout` |

Each row is a separate `RoutineTimerView` instance with its own `routineFilePath`/`routineResolution` fields (`timer-view.ts`) — nothing about the view is shared.
Only the file on disk, and the `PhaseGraph.id` baked into it, is.

## Walk-through

Traced against `src/views/timer-view.ts`, `src/timer/routine-selection.ts`, and `src/domain/routine/routine-file.ts`.

1. Two leaves are open side by side: `Tasks.base`'s "Standup" view, and `shared-routines/Shared-routines.base`'s "Standup" view.
   Both call `getConfiguredRoutineFilePath()` and get back the identical string `routines/standup-routine.md`.
2. Each leaf's `loadRoutineFile` runs independently: `vault.getFileByPath` resolves the same `TFile`, `vault.cachedRead` reads the same bytes, and `resolveRoutineGraph` → `parseRoutineFile` (`src/domain/routine/routine-file.ts`) parses them into a `PhaseGraph`.
   Two distinct object instances, one per view, but structurally identical, both carrying `id: 'standup'` from the file's JSON.
3. The user clicks Start on `Tasks.base`'s Standup view.
   `handleStart` reads the currently active graph (`'default'`, the built-in fallback — nothing set yet) and calls `decideStartAction` (`src/timer/routine-selection.ts`); no session is in progress (`status: 'stopped'`), so it returns `'start'` with no confirmation regardless of id.
   `handleStart` then calls `plugin.store.setGraph(graph)` with its own freshly-parsed object (`'default' !== 'standup'`) and dispatches `start`.
   The single global `EngineStore` now holds that exact object as `this.graph`.
4. `shared-routines/Shared-routines.base`'s Standup view re-renders on the next store tick.
   It never received that object — its own `viewGraph` is still the separate copy it parsed itself in step 2.
   But `render()`'s `isViewRoutineActive = graph.id === viewGraph.id` compares `'standup' === 'standup'` → `true`, so this independently-parsed, never-shared view renders the running countdown as its own active routine, not the inert "a different routine is running" state — the engine only ever compares `PhaseGraphId` strings, never object identity.
5. Both leaves' Pause and Reset controls now act on the one shared `EngineState`; clicking either from either leaf updates both, via the shared `store.subscribe`.
6. Edit `routines/standup-routine.md` directly — say, retitling Alice's phase `label` to "Carol's turn" — then reconfigure either view's `routineFile` option (or reopen the leaf) to force a fresh `loadRoutineFile`.
   Both leaves' next read comes from the one file, so both show "Carol's turn" without either `.base` file itself changing: the routine was defined once, and both reused it by reference, not by copy.

## Where it strains

- No reverse lookup.
  Nothing in the plugin tracks which `.base` files reference a given routine file — knowing that `routines/standup-routine.md` is used by both `Tasks.base` and `shared-routines/Shared-routines.base` means grepping every `.base` file's `routineFile` line by hand, the way this doc's table does.
  Rename or delete the shared file and every reference breaks independently and silently: each view's next `loadRoutineFile` just renders `Routine file not found: <path>` (`timer-view.ts`), one leaf at a time, with nothing pointing back at the other views that reference it.
- Reuse is recognized by id, not by file identity, and nothing keeps the two in sync.
  Every "is this the same routine" check — `render()`'s `isViewRoutineActive`, `decideStartAction`'s `sameRoutine` (`routine-selection.ts`) — compares `PhaseGraphId` strings, and `PhaseGraphIdSchema` is just `z.string().min(1).brand<'PhaseGraphId'>()` (`src/domain/phase/phase-graph.ts`) with no vault-wide uniqueness check.
  Two unrelated routine files that happen to share an `id` (a copy-pasted file whose `id` field was never changed) would be treated as the same routine by every view referencing either, even after their phases have since diverged — neither `parseRoutineFile` nor `checkPhaseGraphIntegrity` (which only validates one graph's own internal references) would catch it.
- Reuse is all-or-nothing.
  `routineFile` names one exact file, so every view referencing it gets byte-identical phases, durations, and hooks — there is no per-view override layer.
  Wanting the same shape with different specifics per view (a 5-minute standup on one Base, a 10-minute one on another) means either forking the file, which loses the "define once" property this example exercises, or accepting that one file's values govern every view naming it — the same tension [break-duration-variants.md](break-duration-variants.md) raises about a single `Phase.duration` being baked into the graph rather than read as a live parameter.
