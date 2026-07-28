## Context

`EngineState.remaining` is `Temporal.Duration | null` — `null` marks a duration-less phase (`Phase.duration: null`). `engineReducer`'s `tick` case:

```ts
case 'tick':
  if (state.remaining === null) {
    return state
  }
  return state.remaining.sign > 0
    ? { ...state, remaining: state.remaining.subtract({ seconds: 1 }) }
    : completePhase(state, graph, predicateRegistry)
```

`completePhase` is the only path that can fire `onComplete` (via `deriveHookEvents`' `tick` branch) and the only path that consults `Phase.completionPolicy`. A duration-less phase never reaches it, so it never fires `onComplete` and its `completionPolicy` is unreachable dead config. The only exit for such a phase today is `advance-phase`, which `deriveHookEvents` unconditionally treats as an abandonment (`onSkip`) whenever the phase was `'running'`/`'paused'`.

`RoutineTimerView.render` (`src/views/timer-view.ts`) also has:

```ts
const phase = findPhaseById(graph, state.currentPhaseId)
if (!phase || state.remaining === null) {
  return
}
```

which returns before drawing the timer panel, controls, or queue panel at all when the current phase is duration-less — there is no way today to see or interact with such a phase in the UI, let alone finish it.

## Goals / Non-Goals

**Goals:**
- Give a duration-less phase a way to reach `completePhase` on a deliberate user action, so `onComplete` and `completionPolicy` become reachable for `manualClear`/`null`/`noOp` policies.
- Keep the derivation rule reusing the existing `tick`-completion shape rather than inventing a parallel one.
- Make a duration-less phase visible and operable in `RoutineTimerView` (currently renders nothing).

**Non-Goals:**
- Executing `queueCycle`/`futureDate` `CompletionPolicy` — `completePhase` keeps throwing for those (flow-gu1.25).
- Adding a general "skip" control to the UI. None exists today (`timer-view.ts` never dispatches `advance-phase`), so "distinct from skip" is about not foreclosing a future control, not resolving an existing conflict.
- Tracking real elapsed time or `PhaseInstance`/`Session` history for a finished manual phase (flow-c08).
- Changing `tick`'s behavior for timed phases.

## Decisions

**1. New `EngineAction` variant: `{ type: 'finish-phase' }`, not a parameter on `advance-phase`.**
`advance-phase` is an explicit, always-advances override used both for skipping and for clearing an already-`'completed'` `manualClear` halt (see `deriveHookEvents`' "Clearing a completed phase" case, which fires neither `onComplete` nor `onSkip`). Overloading it with a "did this conclude naturally?" flag would make every call site reason about two independently-varying booleans (`abandoned` vs. some new `deliberate` flag) for one action. A separate action keeps `advance-phase`'s existing semantics (and its three already-specified/tested behaviors) untouched, and reads clearly at each dispatch call site.

**2. `finish-phase` routes through `completePhase`, the same function `tick` calls on reaching zero.**
This is the natural-completion path already defined for a phase reaching its end on its own terms — `completePhase` already branches on `completionPolicy` (`null`/`noOp` → advance; `manualClear` → halt at `'completed'`; anything else → throw). A duration-less phase reaching "the user says they're done" is the same kind of event as a timed phase reaching zero; reusing `completePhase` means `finish-phase` gets `completionPolicy` handling for free and doesn't duplicate `advancePhase`'s bookkeeping (visit counts, transition resolution).

**3. No reducer-level guard restricting `finish-phase` to duration-less/`'running'` phases.**
`tick` itself has no `status` precondition (it's fine to tick a `'paused'`... though in practice only dispatched while running) and no restriction requiring `remaining` to already be `null` before reaching `completePhase` via the zero-crossing branch. Mirroring that, `engineReducer`'s `finish-phase` case is unconditional: `completePhase(state, graph, predicateRegistry)`. The reducer stays a pure function of state+action+graph with no cross-cutting validity rules; the UI is responsible for only presenting the control when it's meaningful (duration-less, `'running'` phase) — consistent with how `advance-phase` is dispatchable from any state today and nothing in the reducer stops it.

**4. `deriveHookEvents` merges `finish-phase` into the existing `tick` branch** (`action.type === 'tick' || action.type === 'finish-phase'`) rather than adding a parallel branch.
The branch's logic is a pure function of the state diff (did `status` become `'completed'`? did `currentPhaseId` change? neither?) — it doesn't depend on *why* `completePhase` was reached, only on what it produced. `finish-phase` always changes something (it's only meaningfully dispatched against a live phase, and `completePhase` always either halts or advances), so the branch's third case (`return []`, reached today when a timed `tick` doesn't cross zero) is simply unreachable for `finish-phase` — harmless to share.

**5. `RoutineTimerView`: replace the blanket early-return with a duration-aware render, add a "Done" button.**
Split the existing `if (!phase || state.remaining === null) { return }` into `if (!phase) { return }` (defensive, phase should always resolve) and a duration-aware header (`${phase.label}: ${mm}:${ss} (${status})` when `remaining` isn't `null`, `${phase.label} (${status})` when it is). Add a "Done" button next to the existing Pause/Start/Reset controls, shown when `isViewRoutineActive && state.status === 'running' && state.remaining === null`, dispatching `finish-phase` — gated the same way the existing Pause button is gated on `status === 'running'`.

## Risks / Trade-offs

- [`finish-phase` dispatched against a timed (non-`null`-remaining) phase would still complete it early, bypassing the countdown] → Acceptable: nothing in the UI will dispatch it outside the duration-less+running gate, and the reducer intentionally stays permissive (see Decision 3) rather than adding a check that every other action lacks. If a future call site needs a stricter guard, it can add one without touching this change's shape.
- [Sharing the `tick`/`finish-phase` branch in `deriveHookEvents` slightly obscures that the branch now covers two different actions] → Mitigated by the updated `hook-execution` spec documenting `finish-phase` explicitly with its own requirement/scenarios, and a code comment at the merged branch.
- [`queueCycle`/`futureDate` phases dispatching `finish-phase` still hit `completePhase`'s `throw`] → Intentional and unchanged from `tick`'s existing behavior; not this change's scope (flow-gu1.25 tracks implementing those policies).

## Open Questions

None — flagged during proposal drafting and resolved above; proceeding to specs/tasks.
