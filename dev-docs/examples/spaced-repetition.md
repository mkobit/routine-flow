# Spaced repetition

## Description

Review a card or note.
Mark how well it went, and the item disappears from the queue until a future date, then reappears.

## Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Review | `review` | `review` | `null` (self-paced) | `cards` (`baseQuery`) | `{ kind: 'futureDate', after: 3d }` | `activeItem` | none |

Single-phase graph: `review` → `review` (`always`), looping to the next due card.

## Walk-through

1. `review` starts for the active card. `duration` is `null`, so — same as the workout's `set` phase — `tick` never auto-completes it.
2. The user marks the review done and taps "next," dispatching `advance-phase`.
3. Same as the workout example: `abandoned` is `true` (status was `running`), so `onSkip(review)` fires, not `onComplete` — `futureDate`'s intended trigger (a deliberate, successful review) is never reached through this path.
4. Even supposing `completionPolicy` were consulted here: `completePhase` throws for `futureDate` — only `manualClear` and `noOp`/`null` are implemented.

## Where it strains

- Same duration-less-phase gap as `workout.md`: `futureDate` needs a deliberate "I reviewed this" signal distinct from `advance-phase`/skip, and today there isn't one.
- `futureDate` is fully specified in `CompletionPolicySchema` (`{ kind: 'futureDate', after: PositiveDuration }`) but has no execution path — `completePhase` throws on it.
- Even once executed, it's unclear what's supposed to write the future date.
  `TaskQueueItemCycleStatus` has a `'deferred'` status and `TaskQueueItem` has `lastCycledAt` for exactly this, and `FileMutation`'s `queueStatusChange` kind can set an item to `'deferred'` — but nothing computes "3 days from now" and turns it into that mutation.
  Is that the engine executing `CompletionPolicy` directly (parallel to how it already executes `manualClear`), or is it more Hook-shaped (an `onComplete` hook that happens to be built in)?
  `CompletionPolicy` and `Hook` are separate types today, but both ultimately need to produce `FileMutation[]` for anything beyond `manualClear`/`noOp` — worth asking whether `CompletionPolicy`'s non-trivial variants (`queueCycle`, `futureDate`) are really just built-in Hooks wearing a different schema.
- No `PositiveDuration` → calendar-date conversion exists anywhere in the domain layer yet (`Temporal.Instant.add(duration)` would do it, but nothing calls it).
