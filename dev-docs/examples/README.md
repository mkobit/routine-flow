# Living examples: routines mapped onto the domain model

Six real-world routines, each walked from a plain description through to a concrete mapping onto `Phase`/`PhaseGraph`/`CompletionPolicy`/`TransitionCondition`/`Hook`/`TaskSource`.
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
- [Standup per-person turns](standup.md) — a queue with no completion semantics (`noOp`).
- [Workout warm-up/set/rest](workout.md) — a branching graph with a rep-based, duration-less phase.
- [Spaced repetition](spaced-repetition.md) — future-dating a queue item on completion.
- [Stretch break](stretch-break.md) — a phase with no queue at all.
- [Habit tracking](habit-tracking.md) — a conditionally-skipped phase (`TransitionCondition` `'custom'`) plus `onEnter`/`onExit` hooks.

## Known gaps this doc surfaces repeatedly

`completePhase` in `src/timer/reducer.ts` only implements `manualClear` and `noOp`/`null` — `queueCycle` and `futureDate` completion policies throw (`CompletionPolicy`'s `'custom'` variant was removed as redundant with `onComplete`, see `habit-tracking.md`).
`resolveNextPhaseId` in `src/timer/phase-graph.ts` now resolves a `custom` transition condition via a `PredicateRegistry` instead of throwing (flow-b74) — but no real predicate is registered anywhere yet, and a predicate's context is deliberately too narrow to check vault content, so `habit-tracking.md`'s `isRestDay` still can't be built end to end (see flow-gu1.10).

`HookRegistry` and `LogTargetResolverRegistry` are both wired up in `src/main.ts`, but populated with no entries (`resolve: () => undefined`).
Every `onEnter`/`onComplete`/`onSkip`/`onExit` hook and every `callback` log target currently resolves to nothing and silently no-ops.

A duration-less (manual/rep-based) phase never reaches `completePhase` at all — `engineReducer`'s `tick` case returns early when `remaining` is `null`, so the phase only ever ends via `advance-phase`, which is derived as `onSkip` whenever the phase was `running`.
There is no event for "a manual phase finished on purpose," distinct from "a manual phase was abandoned."
See `workout.md` and `spaced-repetition.md`.
