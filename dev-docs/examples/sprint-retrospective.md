# Sprint retrospective

## Description

A team retro walked segment by segment: what went well, what didn't, then action items.
Nothing is on a clock — the facilitator moves the group on when a segment's discussion is done, not when a timer runs out.
The retro runs once per sprint, top to bottom, and ends when the last segment wraps up.

## Domain mapping

One `Phase` per segment, each duration-less (`duration: null`) with `completionPolicy: { kind: 'manualClear' }`.
Same fixed-phase-per-item, facilitator-paced shape as [chore-list.md](chore-list.md), applied to a meeting's agenda instead of a task list.

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| What went well | `what-went-well` | `discussion` | `null` (manual) | `null` | `{ kind: 'manualClear' }` | `activeItem` | none |
| What didn't | `what-didnt` | `discussion` | `null` (manual) | `null` | `{ kind: 'manualClear' }` | `activeItem` | none |
| Action items | `action-items` | `discussion` | `null` (manual) | `null` | `{ kind: 'manualClear' }` | `activeItem` | none |

Transitions: `what-went-well` → `what-didnt` (`always`), `what-didnt` → `action-items` (`always`), `action-items` → `what-went-well` (`always`, wrapping back to the start).

The `action-items` → `what-went-well` edge exists only to satisfy graph integrity, not because a retro loops — see "Where it strains."
`logTarget` is `activeItem` only because the field is mandatory on every `Phase`.
There's no queue and no hook attached, so nothing writes back — same inert `activeItem` as [chore-list.md](chore-list.md).

## Walk-through

One segment, traced against `src/timer/reducer.ts`, `src/timer/store.ts`, and `src/timer/phase-graph.ts`.

1. The facilitator dispatches `start`.
   Status becomes `running` at `what-went-well`; `remaining` is `null` (duration-less), and `openSession` opens a `PhaseInstance` for `what-went-well` as `session.currentInstance`.
2. `tick` dispatches do nothing: `engineReducer`'s `tick` case returns early on `state.remaining === null`, so the segment never counts down and never auto-completes.
3. The discussion wraps up and the facilitator taps "Done," dispatching `finish-phase` (the Done button in `src/views/timer-view.ts` / `src/views/side-panel-view.ts`).
   `completePhase` reads `what-went-well.completionPolicy.kind === 'manualClear'` and returns `{ ...state, status: 'completed' }` — the instance stays open, `currentPhaseId` unchanged.
4. `deriveHookEvents` sees `finish-phase` with `nextState.status === 'completed' && prevState.status !== 'completed'`, so it fires `onComplete(what-went-well)` against the still-open `currentInstance`.
   The timer now sits at `completed`, still on `what-went-well`, not advancing on its own.
5. The facilitator taps "Clear," dispatching `advance-phase`.
   In `engineReducer`, `state.status === 'completed'`, so the end reason is `'completed'` (not `'skipped'`).
   `advancePhase` closes the `what-went-well` instance with `'completed'`, resolves `what-didnt` via `resolveNextPhaseId` (`always`), opens the `what-didnt` instance, and sets `remaining` to `what-didnt.duration` (`null` again), status `stopped`.
6. `deriveHookEvents` for `advance-phase` computes `abandoned = prevState.status === 'running' || 'paused'`; `prevState` is `completed`, so `abandoned` is `false`.
   It fires `onExit(what-went-well)` then `onEnter(what-didnt)` — no `onSkip`.
7. Steps 2–6 repeat for `what-didnt` and `action-items`.
   After the last segment, the facilitator dispatches `stop` rather than clearing forward — `stop` resets to `initialEngineState`, ending the retro.

The Done-then-Clear pair is the flow-gu1.24 path: a facilitator-paced segment reaches `completePhase` through `finish-phase` (the same branch a zero-remaining `tick` takes) and fires `onComplete`, which a duration-less phase with `completionPolicy: null` never can — see [chore-list.md](chore-list.md) and [workout.md](workout.md).
Clearing a segment while it's still `running` (never tapped Done) runs `advance-phase` from `running`, so the end reason is `'skipped'` and `abandoned` is `true` — `onSkip` fires instead of `onComplete`, the "we skipped this segment today" path.

## Where it strains

- A retro terminates, but the graph model assumes a routine continues.
  `checkPhaseGraphIntegrity` (`src/domain/phase/phase-graph.ts`) flags any reachable phase with no outgoing transition (`noOutgoingTransitionIssues`), and `parseRoutineFile` runs that check at load time (flow-gu1.31), so a routine file whose `action-items` phase had no way out is rejected before it ever runs.
  The wrap-back `action-items` → `what-went-well` edge above exists only to pass that check — it doesn't mean a second discussion segment follows.
  There is no terminal-phase concept, so ending a one-pass retro means a manual `stop`, and the graph must still declare a transition the facilitator is never expected to take.
- The `manualClear` split costs two taps per segment — Done, then Clear — with an intermediate `completed`-status pause where the segment sits done-but-not-advanced.
  That pause is the price of firing `onComplete` distinctly from the advance; a timed phase both completes and advances in a single tick-to-zero.
  Same two-action lifecycle as [chore-list.md](chore-list.md).
- Hand-authoring one phase per segment fixes the agenda in the graph and doesn't vary the content between sprints — same limitation as [standup.md](standup.md)'s per-person phases.
  A retro's "what went well" segment often wants a queue of sticky-note items cycled one at a time (a `taskSourceId` plus `completionPolicy: { kind: 'queueCycle' }`), not a single manually-cleared phase.
  But `completePhase` only implements `manualClear` and `noOp`/`null` — a `queueCycle` phase throws the moment it completes (see [pomodoro.md](pomodoro.md)), so the version that works end to end today is the fixed per-segment graph above.
- Write-back is inert here for the same reasons as [chore-list.md](chore-list.md) and [standup.md](standup.md): no queue, no active item, no hook attached, and `main.ts` wires `LogTargetResolverRegistry` to `resolve: () => undefined`.
  Capturing a segment's discussion into a retro note would need a resolvable `onComplete` hook and a registered `LogTargetResolverRegistry` entry, neither of which exists yet.
