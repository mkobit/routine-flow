# Variable break durations

## Description

Most breaks are short.
Every so often you earn a longer one, and once in a while a long one.
The rest of the routine is unchanged: focus, break, focus, break, repeating until you stop.
The only thing that varies is how long the break is, and that choice is made automatically from how many focus phases you have finished.

This example is break selection as a configuration surface, not a new routine shape.
It complements [pomodoro.md](pomodoro.md), which shows the shipped default graph picking between one short and one long break with a single `everyNth(n=4)`.
Here a third break tier and a second `everyNth` generalise that into a ladder, so the mechanism — not just its one hardcoded instance — is visible.
The hand-authored `routine-flow-example-vault/routines/break-duration-variants-routine.md` runs it with durations compressed to seconds for manual verification.

## Domain mapping

Break duration is not a parameter read at runtime — it is baked into each `Phase.duration` (`src/domain/phase/phase.ts`).
Varying it therefore means declaring one break phase per length and letting a `TransitionCondition` pick between them.

The `break-duration-variants` graph, one focus phase feeding three break phases:

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Focus | `focus` | `focus` | 5s | `null` | `null` | `{ kind: 'activeItem' }` | none |
| Short break | `short-break` | `break` | 3s | `null` | `null` | `{ kind: 'activeItem' }` | none |
| Medium break | `medium-break` | `break` | 6s | `null` | `null` | `{ kind: 'activeItem' }` | none |
| Long break | `long-break` | `break` | 12s | `null` | `null` | `{ kind: 'activeItem' }` | none |

Transitions (declared in this order — `resolveNextPhaseId` takes the first match):

1. `focus` → `long-break` when `everyNth(n=8)`
2. `focus` → `medium-break` when `everyNth(n=4)`
3. `focus` → `short-break` when `always`
4. `short-break` → `focus` when `always`
5. `medium-break` → `focus` when `always`
6. `long-break` → `focus` when `always`

Declared order is load-bearing.
`everyNth` matches when `visitCounts[fromPhaseId] % n === 0` (`src/timer/phase-graph.ts`), and `advancePhase` increments the count before resolving, so the first focus completion evaluates against a count of 1.
At focus visit 8 both `everyNth(n=8)` (`8 % 8 === 0`) and `everyNth(n=4)` (`8 % 4 === 0`) are satisfied; declaring the `n=8` edge first is the only reason the long break wins there instead of the medium one.
Hooks are all `null` here to keep the example about transitions alone — unlike the shipped default, which also fires `onComplete: write-back` on every phase (see [write-back.md](write-back.md)).

## Walk-through

One full 8-focus super-cycle, traced against `src/timer/reducer.ts` and `src/timer/store.ts`.

1. User dispatches `start`.
   Status becomes `running` at `focus`, `remaining` is 5s.
2. `tick` fires once per second, decrementing `remaining`.
3. `remaining` reaches zero.
   `completePhase` reads `focus.completionPolicy` (`null`), so it calls `advancePhase` directly — no pause at a `completed` status.
4. `advancePhase` increments `focus`'s visit count to 1, then `resolveNextPhaseId` walks the three `focus` transitions in order: `1 % 8 !== 0`, `1 % 4 !== 0`, then `always` matches, so the next phase is `short-break`.
5. Because `currentPhaseId` changed within the same `tick`, `deriveHookEvents` reports `onComplete(focus)`, `onExit(focus)`, `onEnter(short-break)` — all three, in that order, from one dispatch, though every hook slot is `null` so each resolves to nothing.
6. `short-break` ticks down and returns to `focus` on its `always` transition.
7. Focus visits 2 and 3 resolve to `short-break` the same way (`2 % 4 !== 0`, `3 % 4 !== 0`).
8. Focus visit 4: `4 % 8 !== 0` skips the long break, `4 % 4 === 0` matches, so `resolveNextPhaseId` returns `medium-break`.
9. Focus visits 5–7 return to `short-break`.
10. Focus visit 8: `8 % 8 === 0` matches the first transition, so `resolveNextPhaseId` returns `long-break` and never evaluates the `n=4` edge below it.
11. The pattern over eight focuses is `short, short, short, medium, short, short, short, long`, then repeats — every fourth break is medium, every eighth is long.

The whole ladder rides on `phaseVisitCounts` and transition order; the reducer needs no break-specific logic, and no phase here exercises `completePhase`'s `manualClear` branch or any completion policy beyond `null`.

## Where it strains

- Break duration is baked per phase, not a live parameter.
  `Phase.duration` is a static field of the graph; there is no setting, routine argument, or frontmatter value read at completion time to retune it.
  Making a break longer means editing that phase's `duration` (or adding another break phase and a transition), not changing a value in settings — so "user-configurable" today means editing the routine file's graph, not adjusting a knob while it runs.
- `everyNth` is the only conditional selector wired end to end, and its ordering is a sharp edge.
  The cadence is just the modulus `n`, and stacking tiers depends entirely on declaring the longest cadence first, because `resolveNextPhaseId` returns on the first match.
  Declare `n=4` before `n=8` and the long break never fires — visit 8 satisfies `8 % 4 === 0` first, so the medium branch always wins.
  `checkPhaseGraphIntegrity` (`src/domain/phase/phase-graph.ts`) catches a missing `always` fallback, but not a mis-ordered `everyNth` stack that silently starves a tier.
- A genuinely dynamic rule isn't reachable yet.
  Choosing a long break in the afternoon, a short one in the morning, or skipping it entirely on a rest day needs `TransitionCondition` `'custom'`.
  `resolveNextPhaseId` resolves `custom` through a `PredicateRegistry`, but no predicate is registered anywhere yet, and a `Predicate` sees only `(fromPhaseId, visitCounts)` (`src/domain/hook/predicate.ts`) — not the wall-clock date or vault content — so anything past visit-count arithmetic can't be expressed here.
  An unresolved `custom` condition is treated as not satisfied and falls through to the next transition, the same "unresolved name ⇒ no-op" precedent as an unresolved hook.
  This is the same wall [habit-tracking.md](habit-tracking.md)'s `isRestDay` hits; richer predicate context is tracked by flow-gu1.10.
