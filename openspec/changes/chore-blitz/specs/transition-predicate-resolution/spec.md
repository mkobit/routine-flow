# Spec Delta

## ADDED Requirements

### Requirement: EdgeGuard evaluates queueExhausted condition
`resolveNextPhaseId` SHALL evaluate `queueExhausted` transition conditions against the current queue exhaustion state.
When `queueExhausted` is `true`, an edge guarded by `{ kind: 'queueExhausted' }` SHALL be satisfied.
When `queueExhausted` is `false`, that edge SHALL NOT be satisfied.

#### Scenario: Queue exhausted condition satisfies transition
- **WHEN** `resolveNextPhaseId` evaluates a transition guarded by `{ kind: 'queueExhausted' }` with `queueExhausted` set to `true`
- **THEN** `resolveNextPhaseId` returns that transition target phase identifier

#### Scenario: Non-exhausted queue rejects queueExhausted transition
- **WHEN** `resolveNextPhaseId` evaluates a transition guarded by `{ kind: 'queueExhausted' }` with `queueExhausted` set to `false`
- **THEN** `resolveNextPhaseId` rejects that transition and evaluates subsequent candidate edges

### Requirement: Early phase termination on queue exhaustion for running timed phases
When `set-queue-exhausted` is dispatched with `exhausted: true` against a running phase, `engineReducer` SHALL evaluate outgoing transitions from `currentPhaseId`.
If an outgoing transition is guarded by `{ kind: 'queueExhausted' }`, `engineReducer` SHALL advance immediately to that target phase.
If no outgoing transition is guarded by `{ kind: 'queueExhausted' }`, `engineReducer` SHALL preserve the active phase countdown without advancing.

#### Scenario: Running timed phase advances early when queue is exhausted
- **WHEN** `set-queue-exhausted` with `exhausted: true` is dispatched against a running phase that has an outgoing `queueExhausted` transition
- **THEN** `engineReducer` closes the current phase instance with `endReason: 'completed'` and advances to the target phase

#### Scenario: Normal countdown preserved when no queueExhausted transition exists
- **WHEN** `set-queue-exhausted` with `exhausted: true` is dispatched against a running phase that lacks an outgoing `queueExhausted` transition
- **THEN** `engineReducer` updates `queueExhausted` to `true` and preserves the active running state and remaining duration
