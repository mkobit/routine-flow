## MODIFIED Requirements

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
