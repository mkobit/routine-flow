# Chore list

## Description

A rotating list of household chores you work through one at a time — dishes, then laundry, then tidying.
Nothing is on a clock: each chore is done when you say it's done, not when a timer runs out.
Mark the current chore done, move to the next, and wrap back to the top for the next run.

## Domain mapping

One `Phase` per chore, each duration-less (`duration: null`) with `completionPolicy: { kind: 'manualClear' }`.
Same fixed-phase-per-item shape as `standup.md`, but every phase is manually cleared instead of timed.

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Dishes | `dishes` | `chore` | `null` (manual) | `null` | `{ kind: 'manualClear' }` | `activeItem` | none |
| Laundry | `laundry` | `chore` | `null` (manual) | `null` | `{ kind: 'manualClear' }` | `activeItem` | none |
| Tidy up | `tidy` | `chore` | `null` (manual) | `null` | `{ kind: 'manualClear' }` | `activeItem` | none |

Transitions: `dishes` → `laundry` (`always`), `laundry` → `tidy` (`always`), `tidy` → `dishes` (`always`, wrapping back to the start).

`logTarget` is `activeItem` only because the field is mandatory on every `Phase`.
There's no queue and no hook attached, so nothing writes back — same inert `activeItem` as `standup.md`.

## Walk-through

One chore, traced against `src/timer/reducer.ts`, `src/timer/store.ts`, and `src/timer/phase-graph.ts`.

1. User dispatches `start`. Status becomes `running` at `dishes`; `remaining` is `null` (duration-less), and `openSession` opens a `PhaseInstance` for `dishes` as `session.currentInstance`.
2. `tick` dispatches do nothing: `engineReducer`'s `tick` case returns early on `state.remaining === null`, so the phase never counts down and never auto-completes.
3. The user finishes the dishes and taps "Done," dispatching `finish-phase` (the Done button in `src/views/timer-view.ts` / `src/views/side-panel-view.ts`).
   `completePhase` reads `dishes.completionPolicy.kind === 'manualClear'` and returns `{ ...state, status: 'completed' }` — the instance stays open, `currentPhaseId` unchanged.
4. `deriveHookEvents` sees `finish-phase` with `nextState.status === 'completed' && prevState.status !== 'completed'`, so it fires `onComplete(dishes)` against the still-open `currentInstance`.
   The timer now sits at `completed`, still on `dishes`, not advancing on its own.
5. The user taps "Clear" (the advance control added in flow-039), dispatching `advance-phase`.
   In `engineReducer`, `state.status === 'completed'`, so the end reason is `'completed'` (not `'skipped'`).
   `advancePhase` closes the `dishes` instance with `'completed'`, resolves `laundry` via `resolveNextPhaseId` (`always`), opens the `laundry` instance, and sets `remaining` to `laundry.duration` (`null` again), status `stopped`.
6. `deriveHookEvents` for `advance-phase` computes `abandoned = prevState.status === 'running' || 'paused'`; `prevState` is `completed`, so `abandoned` is `false`.
   It fires `onExit(dishes)` then `onEnter(laundry)` — no `onSkip`.
7. Steps 2–6 repeat for `laundry` and `tidy`, wrapping back to `dishes`.

Contrast the skip path: if the user taps "Clear" while a chore is still `running` (never tapped Done), `advance-phase` runs from `running`, so the end reason is `'skipped'` and `abandoned` is `true` — `onSkip` fires instead of `onComplete`.
The same two controls express both "did this chore" and "skipping this one today," depending on whether Done was tapped first.

## Where it strains

- This is the positive counterpart to `workout.md`'s central gap.
  A duration-less phase with `completionPolicy: null` (workout's `set`) can only leave via `advance-phase` while `running`, so it always fires `onSkip` and can never fire `onComplete` — "finished on purpose" and "abandoned" collapse into one event.
  A `manualClear` chore phase splits them: `finish-phase` reaches `completePhase` (the same path a zero-remaining `tick` takes) and fires `onComplete`, then `advance-phase` from `completed` fires `onExit`/`onEnter` with end reason `'completed'`; `advance-phase` from `running` still fires `onSkip` with `'skipped'`.
  The distinct "deliberate, successful end" `workout.md` wanted an `onFinish` event for is expressible today, as a two-step `manualClear` lifecycle.
- The cost of that split is two user actions to leave a phase — Done, then Clear — where a timed phase both completes and advances in a single tick-to-zero.
  A chore list of N chores is 2N taps, and the intermediate `completed`-status pause (the phase sitting done-but-not-advanced) is the price of firing `onComplete` distinctly from the advance.
- Hand-authoring one phase per chore doesn't scale and doesn't vary the content between runs — same limitation as `standup.md`'s per-person phases.
  A real chore list wants a queue of chore notes (a `taskSourceId` plus `completionPolicy: { kind: 'queueCycle' }`) cycling one item at a time, not a fixed phase per chore.
  But `completePhase` only implements `manualClear` and `noOp`/`null` — a `queueCycle` phase throws the moment it completes (see `pomodoro.md`), so the version that works end to end today is the fixed per-chore graph above.
- Write-back is inert here for the same reasons as `standup.md` and `stretch-break.md`: no queue, no active item, no hook attached, and `main.ts` wires both `HookRegistry` and `LogTargetResolverRegistry` to `resolve: () => undefined`.
  A chore list that wanted to check items off in a note would need a resolvable `onComplete` hook and a registered `LogTargetResolverRegistry` entry, neither of which exists yet.
