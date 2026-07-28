# Pomodoro

## Description

25 minutes of focused work, then a 5 minute break.
Every 4th cycle, the break extends to 15 minutes.
Repeats until the user stops the session.

## Domain mapping

This is the plugin's actual shipped default graph — `DEFAULT_PHASE_GRAPH` in `src/timer/phase-graph.ts:127`.
Every phase has a `taskSourceId` (`focus-queue`/`break-queue`), resolved by `RoutineTimerView` to a real `BaseQuerySource` built from whichever Bases entries match `focusProperty`/`focusValue` (or `breakProperty`/`breakValue`) — see `openspec/specs/base-query-task-source/spec.md`.
`completionPolicy` is still `null` on every phase, though: nothing in the shipped graph triggers `queueCycle` yet (see "Where it strains").

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Focus | `focus` | `focus` | 25m | `focus-queue` | `null` | `activeItem` | none |
| Short break | `break` | `break` | 5m | `break-queue` | `null` | `callback: dailyNote` | none |
| Long break | `long-break` | `break` | 15m | `break-queue` | `null` | `callback: dailyNote` | none |

Transitions (declared in this order — `resolveNextPhaseId` takes the first match):

1. `focus` → `long-break` when `everyNth(n=4)`
2. `focus` → `break` when `always`
3. `break` → `focus` when `always`
4. `long-break` → `focus` when `always`

Pairing `focus`'s `taskSourceId` with `completionPolicy: { kind: 'queueCycle' }` is expressible in the schema today, but isn't part of the shipped default — see "Where it strains."

## Walk-through

One full 4-cycle loop, traced against `src/timer/reducer.ts` and `src/timer/store.ts`.

1. User dispatches `start`. Status becomes `running` at `focus`, `remaining` is 25m.
2. `tick` fires once per second, decrementing `remaining`.
3. `remaining` reaches zero. `completePhase` reads `focus.completionPolicy` (`null`), so it calls `advancePhase` directly — no pause at a `completed` status.
4. `advancePhase` increments `focus`'s visit count, resolves the next phase (`break`, unless the visit count is a multiple of 4, in which case `long-break`), and sets `remaining` to that phase's duration.
5. Because `currentPhaseId` changed within the same `tick`, `deriveHookEvents` reports `onComplete(focus)`, `onExit(focus)`, `onEnter(break)` — all three, in that order, from one dispatch.
6. Steps 2-5 repeat for `break` (or `long-break`), returning to `focus`.

Each `onComplete`/`onExit`/`onEnter` is resolved through `HookRegistry` and applied through a `FileMutationPort` if both are supplied to `EngineStore` — see "Where it strains."

## Where it strains

- `focus.completionPolicy` is `null` today, not `queueCycle` — the shipped graph's queue is real (see the domain mapping above), but nothing yet ends a focus phase by cycling it, so this example doesn't exercise `queueCycle` as configured.
- Attaching a task queue (`completionPolicy: { kind: 'queueCycle' }`) is valid per the Zod schema, but `completePhase` only implements `manualClear` and `noOp`/`null` — a `queueCycle` phase throws the moment its duration reaches zero.
  `queueCycle` is defined but unexecuted.
- `break`/`long-break` use `logTarget: { kind: 'callback', name: 'dailyNote' }`, but `src/main.ts` wires `logTargetResolverRegistry: { resolve: () => undefined }`.
  No `'dailyNote'` resolver is registered anywhere, so break-phase write-back silently no-ops today.
- No phase here sets `onEnter`/`onComplete`/`onSkip`/`onExit`.
  Even if one did, `main.ts` wires `hookRegistry = { resolve: () => undefined }`, so it would resolve to nothing and no-op, same as the log target.
