# Living examples: routines mapped onto the domain model

Eleven real-world routines, each walked from a plain description through to a concrete mapping onto `Phase`/`PhaseGraph`/`CompletionPolicy`/`TransitionCondition`/`Hook`/`TaskSource`.
The goal is to surface where current primitives strain using concrete referents, instead of debating abstractions with nothing to point at.
Tracked by flow-gu1.21.
Feeds flow-gu1.10 (transition hook script runner), which depends on this doc.

## How to read each file

Every file follows the same four sections.

- **Description** — the routine in plain English, no domain vocabulary.
- **Domain mapping** — a table of phases (`id`/`kind`/`duration`/`taskSourceId`/`completionPolicy`/`logTarget`/`hooks`) plus the transitions between them.
  Durations are shown as human shorthand (`25m`, `90s`, `3d`) for `Temporal.Duration` values.
- **Walk-through** — one full cycle narrated event by event, traced against the actual reducer (`src/timer/reducer.ts`) and store (`src/timer/store.ts`), including which `Hook` events fire and in what order.
- **Where it strains** — friction, gaps, or open questions this example surfaces in the current domain model or its implementation.

## Use cases

- [Pomodoro](pomodoro.md) — the shipped default graph; alternating focus/break with a long break every 4th cycle.
- [Variable break durations](break-duration-variants.md) — break *length* chosen by stacked `everyNth` transitions; generalises the shipped default's single long-break-every-4th selector into a short/medium/long ladder.
- [Standup per-person turns](standup.md) — a queue with no completion semantics (`noOp`).
- [Workout warm-up/set/rest](workout.md) — a branching graph with a rep-based, duration-less phase.
- [Spaced repetition](spaced-repetition.md) — future-dating a queue item on completion.
- [Stretch break](stretch-break.md) — a phase with no queue at all.
- [Habit tracking](habit-tracking.md) — a conditionally-skipped phase (`TransitionCondition` `'custom'`) plus `onEnter`/`onExit` hooks.
- [Chore list](chore-list.md) — duration-less phases cleared manually (`manualClear`), firing `onComplete` via `finish-phase`.
- [Sprint retrospective](sprint-retrospective.md) — a fixed, facilitator-paced sequence of `manualClear` segments that terminates rather than loops; the wrap-back edge exists only to pass `checkPhaseGraphIntegrity`.
- [Frontmatter write-back](write-back.md) — the `write-back` `Hook` as a configuration surface: per-phase opt-in, `activeItem` vs `callback` targets, and the confirm-before-write modal.
- [Shared routine definitions](shared-routines.md) — the same routine file, defined once, referenced from more than one Base view in more than one folder via the `routineFile` view option; reuse is by `PhaseGraph.id`, not file or object identity.
- [Bases Chartkit routine analytics and focus dashboard](bases-chartkit-dashboard.md) — dashboard combining Routine Flow timer views with Bases Chartkit charts visualizing session metrics and focus duration from frontmatter write-backs.

## Known gaps this doc surfaces repeatedly

`completePhase` in `src/timer/reducer.ts` only implements `manualClear` and `noOp`/`null` — `queueCycle` and `futureDate` completion policies throw (`CompletionPolicy`'s `'custom'` variant was removed as redundant with `onComplete`, see `habit-tracking.md`).
`resolveNextPhaseId` in `src/timer/phase-graph.ts` now resolves a `custom` transition condition via a `PredicateRegistry` instead of throwing (flow-b74) — but no real predicate is registered anywhere yet, and a predicate's context is deliberately too narrow to check vault content, so `habit-tracking.md`'s `isRestDay` still can't be built end to end (see flow-gu1.10).

`src/main.ts` now registers the built-in `write-back` hook (plus settings-bound script hooks) in its `HookRegistry`, so a phase's `onComplete: write-back` fires for real — see [write-back.md](write-back.md).
`LogTargetResolverRegistry` is still wired to `resolve: () => undefined`, so every `callback` log target resolves to nothing and silently no-ops.
Some older examples (`pomodoro.md`, `stretch-break.md`, `chore-list.md`) still describe the pre-registration state where every hook no-ops; that write-back claim is now stale (tracked separately).

A duration-less (manual/rep-based) phase never reaches `completePhase` at all — `engineReducer`'s `tick` case returns early when `remaining` is `null`, so the phase only ever ends via `advance-phase`, which is derived as `onSkip` whenever the phase was `running`.
There is no event for "a manual phase finished on purpose," distinct from "a manual phase was abandoned."
See `workout.md` and `spaced-repetition.md`.
