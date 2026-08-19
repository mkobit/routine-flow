## Why

Following the initial domain model reshape (bead `flow-616`, `openspec/changes/domain-model-reshape/`, merged in PR #211), an architecture pass (`flow-16c`) pressure-tested a further Graph+Handler+Effect unification against 3 worked examples (Pomodoro, an exercise/stretch routine, and a morning checklist).
This analysis revealed that the existing domain model and initial reshape had two critical capability gaps:
1. Terminal-node support: Acyclic, naturally-ending routines (e.g. morning checklists, exercise cool-downs) were treated as configuration errors by `checkPhaseGraphIntegrity` and `resolveNextPhaseId`.
2. Over-complex event/hook/policy types: `CompletionPolicy`, `QueueItemAction`, `NotificationPolicy`, `Predicate`, `Hook`, and `TransitionCondition` remained separate unions despite representing two core concepts: routing guards on graph edges, and asynchronous lifecycle handlers reacting to state transitions.

This change completes the unification by retiring `CompletionPolicy` entirely as a type (replacing it with `onCompletion: 'autoAdvance' | 'waitForManual'` on phase nodes), establishing pure `EdgeGuard`s on `TransitionEdge`s, generalizing lifecycle hooks into arrays of declarative or script `Handler`s, supporting terminal nodes (where `resolveNextPhaseId` returns `null`), and explicitly clarifying cross-session scheduling as an outer `RoutineSchedule` wrapper rather than a graph cycle.

## What Changes

- Retire `CompletionPolicy` as a type entirely: move auto-advance gating to a scalar field on `PhaseNode` (`onCompletion: 'autoAdvance' | 'waitForManual'`), and fold auto-fired completion actions into `onComplete` lifecycle `Handler`s.
- Formalize `TerminalNode` support: phases with no outgoing edges (or whose edge guards evaluate to false) return `null` from `resolveNextPhaseId`, causing `engineReducer` / `Traversal` state to transition gracefully to `'ended'`.
- Unify lifecycle event handling: introduce `Handler` (`preset` or `script`) and `Effect` (pure data representations of file mutations, notifications, etc.). Replace `Phase.hooks` with `PhaseNode.handlers` (`onEnter`, `onComplete`, `onSkip`, `onExit`), allowing lists of `Handler`s per lifecycle event.
- Reframe routing conditions: rename/scope `Predicate` to `EdgeGuard` on `TransitionEdge` within `PhaseGraph` (`always`, `everyNth`, `queueExhausted`, `custom`), ensuring edge evaluation remains pure, synchronous, and safe for speculative execution (`findNextPhase`).
- Document cross-session scheduling boundary: explicitly establish `RoutineSchedule` (`manual`, `cron`, `interval`) as an outer wrapper around routine traversal, keeping `PhaseGraph` strictly focused on single-session state machine traversal.

## Capabilities

### New Capabilities
- `routine-file-format`: Support terminal nodes in `PhaseGraph` where `resolveNextPhaseId` returns `null` and `Traversal` transitions to `'ended'`. Support array of `Handler`s per phase node lifecycle event.
- `hook-execution`: Support declarative `preset` handlers alongside script handlers; support multiple handlers per lifecycle hook.

### Modified Capabilities
- `completion-policy-execution`: `CompletionPolicy` type is retired. Auto-advance gating is controlled by `PhaseNode.onCompletion`.
- `transition-predicate-resolution`: `Predicate` is reframed as `EdgeGuard` attached to `TransitionEdge` in `PhaseGraph`.

## Impact

- `src/domain/phase/phase.ts`, `src/domain/policy/completion-policy.ts`, `src/domain/hook/hook-reference.ts`: Replace with unified `PhaseNode`, `Handler`, `EdgeGuard`, and `TransitionEdge` schemas.
- `src/timer/reducer.ts`, `src/timer/completion-policy-executor.ts`: Update transition logic for `onCompletion` gate, `resolveNextPhaseId` terminal null checks, and `Handler` execution.
- Routine JSON schema and parser (`src/domain/routine-file-format.ts`).
