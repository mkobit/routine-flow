# completion-policy-execution Specification

## Purpose
TBD - created by archiving change completion-policy-execution. Update Purpose after archive.
## Requirements
### Requirement: manualClear halts at completion instead of auto-advancing
When the current phase's `completionPolicy.kind` is `manualClear` and a `tick` or `finish-phase` action brings `remaining` to zero (or below) or otherwise reaches `completePhase`, `engineReducer` SHALL set `EngineState.status` to `'completed'` and SHALL NOT change `currentPhaseId` or `remaining`, and SHALL NOT call `advancePhase`.

#### Scenario: A manualClear phase reaching zero stops instead of advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }` and `remaining` is zero
- **THEN** the resulting state has `status: 'completed'`, the same `currentPhaseId`, and the same (zero) `remaining`

#### Scenario: A manualClear phase halts via finish-phase, same as reaching zero via tick
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }`
- **THEN** the resulting state has `status: 'completed'`, the same `currentPhaseId`, and the same `remaining` it had before the dispatch

### Requirement: advance-phase clears a completed manualClear phase
Dispatching `advance-phase` against an `EngineState` with `status: 'completed'` SHALL behave identically to dispatching it from `'running'` — resolving the next phase via the graph's transitions and returning to `status: 'stopped'` at that phase.

#### Scenario: advance-phase moves on from a completed phase
- **WHEN** `advance-phase` is dispatched against a state with `status: 'completed'`
- **THEN** the resulting state's `currentPhaseId` is the graph-resolved next phase, `remaining` is that phase's duration, and `status` is `'stopped'`

### Requirement: null and noOp completion policies preserve today's auto-advance
When the current phase's `completionPolicy` is `null` or `{ kind: 'noOp' }` and a `tick` or `finish-phase` action brings `remaining` to zero (or below) or otherwise reaches `completePhase`, `engineReducer` SHALL call `advancePhase` exactly as it does today — unconditional immediate advance to the next phase, with no `'completed'` intermediate status.

#### Scenario: A null-policy phase reaching zero still auto-advances
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `null` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, matching pre-existing behavior

#### Scenario: A noOp-policy phase reaching zero still auto-advances
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'noOp' }` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, identically to the `null` case

#### Scenario: A null-policy duration-less phase auto-advances via finish-phase
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `null` and `remaining` is `null`
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, the same shape as a timed phase's zero-remaining `tick`

### Requirement: Unimplemented completion policies throw at tick- or finish-phase-driven completion
`queueCycle` and `futureDate` completion policies SHALL auto-advance the phase upon completion (via `tick` reaching zero or `finish-phase`) identically to `null`/`noOp` policies, and SHALL NOT throw an unimplemented error. When `onComplete` fires for a phase with a `queueCycle` or `futureDate` policy and an active item (`activeFilePath`) exists:
- A `queueCycle` policy SHALL emit a `queueReorder` mutation moving the active item to `'back'`.
- A `futureDate` policy SHALL emit a `queueStatusChange` mutation setting the active item's status to `'deferred'`, and a `frontmatter` mutation setting `routine-due` to `now.add(policy.after).toString()`.

#### Scenario: queueCycle throws instead of silently advancing
- **WHEN** a phase with `{ kind: 'queueCycle' }` completes with active item "task-1.md"
- **THEN** `engineReducer` advances to the next phase with `status: 'stopped'` without throwing, and a `{ kind: 'queueReorder', itemId: 'task-1.md', position: 'back' }` mutation is derived for execution

#### Scenario: futureDate throws instead of silently advancing
- **WHEN** a phase with `{ kind: 'futureDate', after: P3D }` completes with active item "card-1.md" at instant `now`
- **THEN** `engineReducer` advances to the next phase with `status: 'stopped'` without throwing, and `{ kind: 'queueStatusChange', itemId: 'card-1.md', status: 'deferred' }` and `{ kind: 'frontmatter', filePath: 'card-1.md', property: 'routine-due', value: now.add(P3D).toString() }` mutations are derived for execution

#### Scenario: queueCycle throws via finish-phase on a duration-less phase
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'queueCycle' }`
- **THEN** `engineReducer` advances to the next phase without throwing

