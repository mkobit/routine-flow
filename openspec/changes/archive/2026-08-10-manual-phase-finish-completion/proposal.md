## Why

A duration-less (manual/rep-based) `Phase` — e.g. `docs/examples/workout.md`'s rep-based `set` phase, or `spaced-repetition.md`'s self-paced `review` phase — has `remaining: null` from `initialEngineState` onward.
`engineReducer`'s `tick` case no-ops whenever `remaining` is `null`, so `completePhase` (and therefore `onComplete`) is never reached by any path.
The only way out of such a phase today is the `advance-phase` action, which `deriveHookEvents` always derives as `onSkip` when the phase was `'running'`/`'paused'` — so a deliberately finished manual phase and an abandoned one look identical, and `completionPolicy` on a duration-less phase is dead configuration.
This blocks flow-gu1.25 (`queueCycle`/`futureDate` `CompletionPolicy` execution), since both routines that need those policies are duration-less and can never reach `completePhase` at all.

Separately, `RoutineTimerView`'s render function currently returns before drawing anything (`if (!phase || state.remaining === null) { return }`) whenever the current phase is duration-less — there is no header, no controls, no queue panel. A duration-less phase is a complete UI dead end today, not just a mis-derived hook event.

## What Changes

- Add a `finish-phase` `EngineAction`, dispatched when the user deliberately concludes a phase that has no timer to reach zero on its own. `engineReducer` routes it through the same `completePhase` function `tick` already uses on reaching zero remaining, so it honors `completionPolicy` (`manualClear` halts at `'completed'`; `null`/`noOp` auto-advances; `queueCycle`/`futureDate` still throw — executing those policies is flow-gu1.25's scope, not this change's).
- `deriveHookEvents` derives `onComplete` (and, for the auto-advance case, `onComplete`+`onExit`+`onEnter`) for `finish-phase`, the same shape it already derives for a zero-remaining `tick`.
- `RoutineTimerView` renders duration-less phases instead of returning early: the header omits the countdown, and a "Done" button (dispatching `finish-phase`) appears whenever the active phase is running and duration-less.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hook-execution`: adds `onComplete` (and downstream `onExit`/`onEnter`) derivation for a new `finish-phase` action, applying the same completion-shaped rules `tick` already has for zero remaining.
- `completion-policy-execution`: its requirements are currently worded entirely in terms of "a `tick` action" reaching `completePhase`. `completePhase` is now also reachable via `finish-phase`, so each requirement's trigger broadens to "a `tick` or `finish-phase` action" — the branching behavior itself (`manualClear` halts, `null`/`noOp` auto-advance, `queueCycle`/`futureDate` throw) is unchanged.

## Impact

- `src/timer/reducer.ts`: new `EngineAction` variant, `engineReducer` case, `deriveHookEvents` branch.
- `src/views/timer-view.ts`: render path for duration-less phases, new "Done" control.
- `openspec/specs/hook-execution/spec.md`: new requirement/scenarios for `finish-phase`.
- No change to `CompletionPolicy` execution itself — `queueCycle`/`futureDate` remain unimplemented in `completePhase` (flow-gu1.25).
