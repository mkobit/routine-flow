# Workout warm-up/set/rest

## Description

A few minutes of warm-up, then repeating sets: a rep-based exercise with no clock, followed by a timed rest.
The exercise phase ends when the user says they're done, not on a timer.

## Domain mapping

Uses `PhaseGraph` branching and a duration-less phase for the rep-based set.

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Warm-up | `warmup` | `warm-up` | 5m | `null` | `null` | `activeItem` | none |
| Set | `set` | `set` | `null` (rep-based) | `exercises` (`fixedSequence`) | `null` | `activeItem` | none |
| Rest | `rest` | `rest` | 90s | `null` | `null` | `activeItem` | none |

Transitions: `warmup` → `set` (`always`), `set` → `rest` (`always`), `rest` → `set` (`always`, looping — see "Where it strains" for how the loop is supposed to end).

`exercises` names a hypothetical `TaskSource` backed by a fixed, ordered list of exercises — no Bases query involved, unlike the `focus-queue`/`break-queue` `BaseQuerySource`s the shipped Pomodoro graph uses (see `docs/examples/pomodoro.md`). No such fixed-sequence implementation exists yet — see "Where it strains."

## Walk-through

1. `warmup` runs on its 5m timer like a pomodoro focus phase — ticks down, `completePhase` sees `completionPolicy: null`, advances directly to `set`.
2. `set` starts. Its `duration` is `null`, so `remaining` is `null` from `initialEngineState` onward.
3. Every `tick` dispatch for a duration-less phase hits `if (state.remaining === null) return state` first in `engineReducer` — the phase never auto-completes, no matter how long it runs.
4. The user finishes their reps and taps "next," dispatching `advance-phase`, not `tick`.
5. In `deriveHookEvents`, `advance-phase` checks `abandoned = prevState.status === 'running' || 'paused'`.
   `set` is `running` (started and never paused), so `abandoned` is `true` — `onSkip(set)` fires, then `onExit(set)`, then `onEnter(rest)`.
6. `rest` runs on its 90s timer, then loops back to `set` for the next exercise.

## Where it strains

- Finishing a rep-based phase intentionally and skipping it look identical to `deriveHookEvents`: both are `advance-phase` while `running`, both fire `onSkip`, never `onComplete`.
  There's no way for a duration-less phase to ever fire `onComplete` — the only path to `completePhase` is through `tick` reaching zero, which never happens when `duration` is `null`.
  `completionPolicy` on a duration-less phase is dead configuration: `engineReducer` never reads it.
- This is a concrete instance of the question this doc exists to ground: are `onEnter`/`onComplete`/`onSkip`/`onExit` the right phase-level events?
  A manual/rep-based phase seems to need something like `onFinish` (deliberate, successful end) distinct from `onSkip` (abandoned), but today they collapse to the same event.
- "Loop until the exercise sequence is exhausted" is now expressible as a `TransitionCondition`: `{ kind: 'queueExhausted' }` (flow-6ed) reads `EngineState.queueExhausted`, a snapshot `EngineStore.dispatch` refreshes from `EngineDeps.taskSourceRegistry` before evaluating each dispatched action — `resolveNextPhaseId`/`engineReducer` themselves stay pure, never touching a live registry.
  It reads the queue of whichever phase is being exited, so it only means something on an outgoing transition of `set` (the phase carrying `taskSourceId: exercises`) — e.g. a `set` → `cooldown` edge checked before `set` → `rest`, not on `rest`'s own transitions, since `rest` has no `taskSourceId` of its own and would read back `false` forever.
  This example doesn't declare that `cooldown` phase or edge yet — the table/transitions above are unchanged — so the loop still only ends via manual `stop`.
- A Bases-backed `TaskSource` (`BaseQuerySource`) is real now (see `docs/examples/pomodoro.md`), but a fixed, ordered, no-Bases-query `TaskSource` like `exercises` above has no implementation yet — nothing registers `Set`'s `taskSourceId` with anything, so `taskSourceRegistry.resolve('exercises')` would return `undefined` and `queueExhausted` would read back `false` regardless, same as any other unregistered source.
