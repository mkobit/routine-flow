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

- This is the one concrete, already-shipped example of `logTarget: { kind: 'callback' }` (`src/timer/phase-graph.ts:88`), and it demonstrates the mechanism is inert today: `src/main.ts` wires `logTargetResolverRegistry: { resolve: () => undefined }`, so `resolveTargetFilePath` always gets back `undefined` and every completion is silently skipped (`{ kind: 'skipped' }`) — no error, no visible feedback that write-back didn't happen.
- Nothing distinguishes "this phase has no queue" (`taskSourceId: null`) from "this phase has a queue but write-back should go elsewhere anyway" — both use a `callback` logTarget identically.
  Not a problem by itself, just worth noting the field doesn't encode *why* the write-back target is a callback.
