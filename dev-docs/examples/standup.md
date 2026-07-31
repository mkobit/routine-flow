# Standup per-person turns

## Description

A fixed time box per team member to give their update.
When a person's time is up, or they finish early, move to the next person.
No write-back, no queue — just a rotation through phases.

## Domain mapping

One `PhaseGraph` with one `Phase` per person.
The domain model doesn't prescribe whether these are hand-authored per person or generated from a roster — either produces the same shape.

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Alice's turn | `alice` | `turn` | 2m | `null` | `{ kind: 'noOp' }` | `activeItem` | none |
| Bob's turn | `bob` | `turn` | 2m | `null` | `{ kind: 'noOp' }` | `activeItem` | none |

Transitions: `alice` → `bob` (`always`), `bob` → `alice` (`always`, wrapping back to the start).

`logTarget` is set to `activeItem` only because the field is mandatory on every `Phase`.
Nothing ever writes back — no hook is attached, and there's no queue item to target.

## Walk-through

1. `alice`'s phase starts, counts down from 2m.
2. `remaining` reaches zero. `completePhase` reads `completionPolicy.kind === 'noOp'` — the same branch as `null` — and calls `advancePhase` directly.
3. `onComplete(alice)`, `onExit(alice)`, `onEnter(bob)` fire in one `tick` dispatch, same derivation as the pomodoro example.
4. If Alice finishes early and the user manually advances instead of waiting out the countdown, `advance-phase` fires while status is `running`.
   `deriveHookEvents` treats this as abandoned: `onSkip(alice)`, `onExit(alice)`, `onEnter(bob)` fire instead of `onComplete`.

## Where it strains

- `completePhase`'s branch is `policy === null || policy.kind === 'noOp'` — `noOp` and `null` are handled identically everywhere in the current implementation.
  It's not clear what distinguishes them, or whether `noOp` is meant to carry a different meaning once completion policies gain real execution (e.g. for logging or serialization).
- Ending a turn early ("Alice's done, move on") and skipping a turn ("skip Alice, she's out today") are the same action (`advance-phase` while running) and fire the same event (`onSkip`).
  A hook that wants to distinguish "this person spoke" from "this person was skipped" can't, from the event alone.
- No motivating need here for `TransitionCondition: 'custom'` or `CompletionPolicy: 'custom'` — a plain round-robin needs neither.
