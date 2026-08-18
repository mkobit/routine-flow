## MODIFIED Requirements

### Requirement: manualClear halts at completion instead of auto-advancing
When the current phase's `completionPolicy.kind` is `manualClear` and a `tick` or `finish-phase` action brings `remaining` to zero (or below) or otherwise reaches `completePhase`, `engineReducer` SHALL set `EngineState.status` to `'completed'` and SHALL NOT change `currentPhaseId` or `remaining`, and SHALL NOT call `advancePhase`.

#### Scenario: A manualClear phase reaching zero stops instead of advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }` and `remaining` is zero
- **THEN** the resulting state has `status: 'completed'`, the same `currentPhaseId`, and the same (zero) `remaining`

#### Scenario: A manualClear phase halts via finish-phase, same as reaching zero via tick
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }`
- **THEN** the resulting state has `status: 'completed'`, the same `currentPhaseId`, and the same `remaining` it had before the dispatch

### Requirement: null and autoAdvance completion policies preserve today's auto-advance
When the current phase's `completionPolicy` is `null` or `{ kind: 'autoAdvance', actions }` (for any `actions`, including an empty list) and a `tick` or `finish-phase` action brings `remaining` to zero (or below) or otherwise reaches `completePhase`, `engineReducer` SHALL call `advancePhase` exactly as it does today — unconditional immediate advance to the next phase, with no `'completed'` intermediate status. `null` is equivalent to `{ kind: 'autoAdvance', actions: [] }` for every purpose in this requirement.

#### Scenario: A null-policy phase reaching zero still auto-advances
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `null` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, matching pre-existing behavior

#### Scenario: An autoAdvance policy with no actions reaching zero still auto-advances
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'autoAdvance', actions: [] }` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, identically to the `null` case

#### Scenario: A null-policy duration-less phase auto-advances via finish-phase
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `null` and `remaining` is `null`
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, the same shape as a timed phase's zero-remaining `tick`

### Requirement: autoAdvance completion policies derive mutations from their QueueItemActionPayload list
When `onComplete` fires for a phase with `completionPolicy: { kind: 'autoAdvance', actions }` and an active item (`activeFilePath`) exists, the engine SHALL derive the same `FileMutation`s for each entry in `actions` that manually triggering an equivalent `QueueItemAction` against that active item would derive (see `queue-item-actions`'s "Preset Action Derivation" requirement), applied in list order.

#### Scenario: A queueCycle action in an autoAdvance policy derives a queueReorder mutation
- **WHEN** a phase with `completionPolicy: { kind: 'autoAdvance', actions: [{ kind: 'queueCycle' }] }` completes with active item "task-1.md"
- **THEN** `engineReducer` advances to the next phase with `status: 'stopped'` without throwing, and a `{ kind: 'queueReorder', itemId: 'task-1.md', position: 'back' }` mutation is derived for execution

#### Scenario: A deferDuration action in an autoAdvance policy derives status-change and frontmatter mutations
- **WHEN** a phase with `completionPolicy: { kind: 'autoAdvance', actions: [{ kind: 'deferDuration', after: P3D }] }` completes with active item "card-1.md" at instant `now`
- **THEN** `engineReducer` advances to the next phase with `status: 'stopped'` without throwing, and `{ kind: 'queueStatusChange', itemId: 'card-1.md', status: 'deferred' }` and `{ kind: 'frontmatter', filePath: 'card-1.md', property: 'routine-due', value: now.add(P3D).toString() }` mutations are derived for execution

#### Scenario: autoAdvance with a markDone action derives via finish-phase on a duration-less phase
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'autoAdvance', actions: [{ kind: 'markDone' }] }`
- **THEN** `engineReducer` advances to the next phase without throwing, and a `{ kind: 'queueStatusChange', itemId, status: 'done' }` mutation is derived for the active item

## REMOVED Requirements

### Requirement: Unimplemented completion policies throw at tick- or finish-phase-driven completion
**Reason**: `CompletionPolicy.queueCycle` and `CompletionPolicy.futureDate` are removed as distinct variants — both derived `FileMutation`s that were byte-identical to `QueueItemAction`'s `queueCycle`/`deferDuration` payloads, duplicated across `completion-policy-executor.ts` and `derive-action-mutations.ts`. The behavior is retained under the new "autoAdvance completion policies derive mutations from their QueueItemActionPayload list" requirement.
**Migration**: `{ kind: 'queueCycle' }` becomes `{ kind: 'autoAdvance', actions: [{ kind: 'queueCycle' }] }`. `{ kind: 'futureDate', after }` becomes `{ kind: 'autoAdvance', actions: [{ kind: 'deferDuration', after }] }`.
