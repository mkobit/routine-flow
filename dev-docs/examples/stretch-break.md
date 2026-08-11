# Stretch break

## Description

A short break with nothing behind it: no task, no queue, just "stand up and stretch," then back to whatever was running.

## Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Stretch | `stretch` | `break` | 5m | `null` | `null` | `{ kind: 'callback', name: 'dailyNote' }` | none |

Same shape as the pomodoro's `break`/`long-break` phases — this is that pattern in isolation, not embedded in a focus/break cycle.

## Walk-through

1. `stretch` runs its 5m timer like any timed phase; `completionPolicy: null` means `completePhase` advances directly on tick-to-zero.
2. `onComplete(stretch)` fires.
   If a hook were attached and resolvable, write-back logic would resolve `phase.logTarget` — `kind: 'callback'` — via `LogTargetResolverRegistry.resolve('dailyNote')`, not `activeFilePath` (there is no active item; `taskSourceId` is `null`).

## Where it strains

- This is the one concrete, already-shipped example of `logTarget: { kind: 'callback' }` (in `src/timer/phase-graph.ts`), and it demonstrates the mechanism is inert today: `src/main.ts` wires `logTargetResolverRegistry: { resolve: () => undefined }`, so `resolveTargetFilePath` always gets back `undefined` and every completion is silently skipped (`{ kind: 'skipped' }`) — no error, no visible feedback that write-back didn't happen.
- Nothing distinguishes "this phase has no queue" (`taskSourceId: null`) from "this phase has a queue but write-back should go elsewhere anyway" — both use a `callback` logTarget identically.
  Not a problem by itself, just worth noting the field doesn't encode *why* the write-back target is a callback.

## Repeating stretch routine variant

### Description

A multi-rep stretch routine that alternates between active stretch intervals (e.g. 45s) and short rest intervals (e.g. 15s) for N cycles (or continuously), without any attached task queue.

### Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Stretch | `stretch` | `break` | 45s | `null` | `null` | `null` | none |
| Rest | `rest` | `break` | 15s | `null` | `null` | `null` | none |
| Done | `done` | `break` | 0s | `null` | `null` | `null` | none |

Transitions (evaluated in array order):

1. `rest` → `done` when `everyNth(n=5)`
2. `stretch` → `rest` when `always`
3. `rest` → `stretch` when `always`

### Walk-through

1. User starts the session; `stretch` runs for 45s.
2. At 0s, `stretch` completes and advances to `rest`.
3. `rest` runs for 15s.
4. On completing `rest`, `resolveNextPhaseId` in [`phase-graph.ts`](file:///home/mkobit/workspace/mkobit/obsidian-pomodoro-plugin/src/timer/phase-graph.ts#L74-L88) evaluates `rest`'s outgoing transitions.
   For the 1st through 4th visits to `rest`, `everyNth(n=5)` is false, so it takes the `rest` → `stretch` fallback edge.
5. On the 5th completion of `rest`, `everyNth(n=5)` evaluates true, taking the `rest` → `done` transition to end the loop.

### Where it strains

- `everyNth` counts visits of the source (`fromPhaseId`) phase, so an N-rep repeating pair must attach `everyNth(n=N)` to the final phase in the loop (`rest`).
- Ending a routine on a terminal `done` phase requires defining an explicit zero-duration or manual phase, as `resolveNextPhaseId` requires an eligible outgoing transition unless the graph halts at a terminal phase.

