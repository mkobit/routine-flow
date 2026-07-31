# Habit tracking

## Description

A daily routine that includes a weights session — except on rest days, when that phase is skipped entirely.
Opens the day's habit note when the weights phase starts, and logs elapsed time when it ends, however it ends.

## Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Weights | `weights` | `exercise` | 20m | `null` | `null` | `activeItem` | `onEnter: openHabitNote`, `onExit: logElapsed` |
| Cardio | `cardio` | `exercise` | 20m | `null` | `null` | `activeItem` | none |

Transitions from `weights` (declared in this order — order matters, see "Where it strains"):

1. `weights` → `cardio` under `{ kind: 'custom', predicate: isRestDay }`
2. `weights` → `cardio` under `always` (fallback)

The routine ends after `cardio`; the user stops the session rather than the graph auto-advancing further.

## Walk-through

1. Session starts at `weights`. `onEnter(weights)` fires — intended to open the day's habit note as a side effect (a `FileMutation`, e.g. `append`, not literally "open a file in the editor," since Hooks return `FileMutation[]`, not UI commands).
2. `weights` runs its 20m timer and completes normally. Because `completionPolicy` is `null`, `completePhase` advances directly to `cardio` within the same `tick` — `onComplete(weights)`, `onExit(weights)`, `onEnter(cardio)` all fire together, same derivation as the pomodoro example.
   `onExit`'s hook is intended to log elapsed time regardless of whether the phase completed or was skipped.
3. On a rest day, the graph should instead resolve `weights` → `cardio` directly via the `custom` transition, without ever entering `weights` — so `onEnter(weights)`/`onExit(weights)` should never fire that day. This now depends on `isRestDay` actually being registered (see "Where it strains") — as shipped today, `main.ts`'s `PredicateRegistry` is empty, so the `custom` condition resolves to unsatisfied and every exit from `weights` falls through to the `always` fallback, rest day or not. The mechanism works; nothing populates it yet.

## Where it strains

- `resolveNextPhaseId` no longer throws on a `'custom'` condition (flow-b74) — it resolves the predicate via a `PredicateRegistry` and treats an unresolved name as "not satisfied," falling through to the next candidate. But `isRestDay` itself is not registered anywhere: it would need to check a note for a rest-day marker, which is I/O the predicate's context can't do — `Predicate` is deliberately `(fromPhaseId, visitCounts) => boolean`, not something that can read vault content. This example's actual skip logic is still not implementable end to end; see flow-gu1.10.
- Declaring the custom transition first is still necessary — `resolveNextPhaseId` takes the first candidate whose condition is satisfied. Reordering to put `always` first would make the loop always match `always` before ever reaching the `custom` condition, silently defeating the skip logic (not a throw now, just dead configuration).
- The type mismatch flagged before is fixed: `TransitionCondition.custom.predicate` is now its own branded `PredicateName`, not `HookName` — a predicate registered under a name isn't accidentally resolvable via `HookRegistry` or vice versa.
- `onEnter`/`onExit` firing "regardless of how the phase ends" (per `phase.ts`'s own doc comment on `onExit`) is exactly what's wanted for "log elapsed time either way" — this part of the model already fits.
  The friction here is entirely in the transition condition, not the phase-level hook events.
- Skipping a phase you never entered (rest day) is different from skipping a phase you did enter and abandoned partway (see `workout.md`).
  The domain model has only one `onSkip` event, fired only when a phase you were *in* gets abandoned via `advance-phase`.
  A phase skipped by never being entered at all (this use case) doesn't fire `onSkip` — it just never fires `onEnter` either.
  Whether that asymmetry matters depends on whether a hook ever needs to react to "a phase was bypassed today" as its own event, distinct from both "entered and finished" and "entered and abandoned."
