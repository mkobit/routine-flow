# Spec Delta

## MODIFIED Requirements

### Requirement: itemsTouched records lightweight per-touch item snapshots, not bare ids
Whenever `activeFilePath` resolves to a `TaskQueueItem` not already the current instance's active item, `PhaseInstance.itemsTouched` SHALL gain a record capturing that item's `id`, `sourcePath`, `displayName`, and an initial `status: 'viewed'`.
The current active item is the last such record.
A later change to that item's mutable queue status or time metrics SHALL NOT alter the recorded snapshot.

#### Scenario: Activating a queue item appends a snapshot, not just an id
- **WHEN** a dispatched action resolves `activeFilePath` to a `TaskQueueItem` different from the current instance's active item
- **THEN** `currentInstance.itemsTouched` gains a new entry with that item's `id`, `sourcePath`, and `displayName` as they were at that moment, carrying initial `status: 'viewed'`

#### Scenario: A later change to that item's mutable fields doesn't alter the recorded snapshot
- **WHEN** a `TaskQueueItem`'s `cycleStatus` or `timeSpent` changes after it was recorded in `itemsTouched`
- **THEN** the existing `itemsTouched` entry for that item is unchanged

## ADDED Requirements

### Requirement: PhaseInstance tracks item completion status across touches
When a task is marked done during an active phase instance, `engineReducer` SHALL update the matching entry in `PhaseInstance.itemsTouched` to `status: 'completed'` and record `completedAt`.
`PhaseInstance` SHALL preserve all completion records across multiple finished tasks in a single phase.

#### Scenario: Completing an active item marks touch record as completed
- **WHEN** a task is marked done during an active phase instance
- **THEN** the matching item in `currentInstance.itemsTouched` updates to `status: 'completed'` with a timestamp

#### Scenario: Viewed item without completion remains viewed
- **WHEN** an item is activated and subsequently replaced without a completion action
- **THEN** that item's record in `currentInstance.itemsTouched` retains `status: 'viewed'`

#### Scenario: Multiple completed items accumulate in itemsTouched
- **WHEN** three distinct items are sequentially activated and marked done during a single phase
- **THEN** `currentInstance.itemsTouched` contains three distinct records with `status: 'completed'`
