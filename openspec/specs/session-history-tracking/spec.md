# session-history-tracking Specification

## Purpose
TBD - created by archiving change session-phase-instance-history. Update Purpose after archive.
## Requirements
### Requirement: EngineState tracks an explicit session lifecycle
`EngineState` SHALL carry a `session: Session | null` field that is `null` whenever no `PhaseGraph` traversal is currently open, and non-`null` while one is in progress.

#### Scenario: A freshly initialized EngineState has no session
- **WHEN** `initialEngineState` is called for a `PhaseGraph`
- **THEN** the resulting `EngineState`'s `session` is `null`

#### Scenario: start opens a new session when none is open
- **WHEN** `start` is dispatched against a state whose `session` is `null`
- **THEN** the resulting state's `session` is a new `Session` whose `history` is empty and whose `currentInstance` is a freshly opened instance for the current phase

#### Scenario: start leaves an already-open session's identity untouched
- **WHEN** `start` is dispatched (e.g. to re-target the active file via its `filePath` argument) against a state whose `session` is already non-`null`
- **THEN** the resulting state's `session.id` is unchanged from before the dispatch

### Requirement: stop closes the current session
`EngineState.session` SHALL return to `null` when `stop` is dispatched, matching `initialEngineState`'s existing full reset.

#### Scenario: stop mid-session resets session to null
- **WHEN** `stop` is dispatched against a state with a non-null `session`
- **THEN** the resulting state's `session` is `null`

### Requirement: Session separates the in-progress instance from closed history
`Session.currentInstance` SHALL hold the in-progress `PhaseInstance` (`endedAt: null`) when one exists; `Session.history` SHALL contain only closed instances (non-null `endedAt`).

#### Scenario: An open instance never appears in history
- **WHEN** a phase is currently active (`status` is `'running'` or `'paused'`) within an open session
- **THEN** `session.history` contains no entry whose `endedAt` is `null`, and `session.currentInstance` is non-null with `endedAt: null`

### Requirement: engineReducer opens and closes PhaseInstances as part of its own transitions
`engineReducer` SHALL mint a new `PhaseInstance` (with a fresh `PhaseInstanceId`) as `session.currentInstance` whenever a phase becomes active, and SHALL close the outgoing instance (setting `endedAt`, `endReason`, `actualDuration`) and append it to `session.history` whenever that phase stops being active — as part of the same pure transition that already changes `currentPhaseId`/`status`, at the same points `deriveHookEvents` fires `onEnter`/`onComplete`/`onSkip`/`onExit`.

#### Scenario: Natural completion closes the outgoing instance with endReason 'completed'
- **WHEN** a `tick` brings a `null`/`noOp`-policy phase's `remaining` to zero, auto-advancing to the next phase
- **THEN** the closed instance appended to `history` has `endReason: 'completed'` and a non-null `endedAt`, and the newly opened `currentInstance` is for the next phase

#### Scenario: advance-phase from running closes the outgoing instance with endReason 'skipped'
- **WHEN** `advance-phase` is dispatched against a `'running'` state
- **THEN** the closed instance appended to `history` has `endReason: 'skipped'`

#### Scenario: stop mid-phase closes the outgoing instance with endReason 'abandoned'
- **WHEN** `stop` is dispatched against a `'running'` or `'paused'` state
- **THEN** the instance being left closes with `endReason: 'abandoned'` before `session` itself resets to `null`

### Requirement: now enters engineReducer only via the dispatched action, never a global read
`engineReducer` SHALL NOT call `Temporal.Now` itself. Any `EngineAction` that can open or close a `PhaseInstance` (`start`, `tick`, `finish-phase`, `advance-phase`, `stop`) SHALL carry a `now: Temporal.Instant` supplied by the caller, which the reducer uses for that instance's timestamps.

#### Scenario: Reducer output is a deterministic function of its now input
- **WHEN** `engineReducer` is called twice with identical `state`/`graph`/`deps` but an action differing only in its `now` value
- **THEN** the two resulting states' opened/closed instance timestamps differ only by that `now` difference, with no other divergence between the two results besides freshly-minted `PhaseInstanceId`/`SessionId` values, which are expected to differ per call regardless of `now`

### Requirement: PhaseInstance snapshots phase identity, surviving later config edits
A closed `PhaseInstance` SHALL carry `phaseDisplayName`/`phaseKind` reflecting the firing `Phase`'s `label`/`kind` as of when the instance was created for it, alongside the existing `plannedDuration` snapshot — unaffected by the `Phase` being renamed, re-kinded, or deleted afterward.

#### Scenario: A later phase rename doesn't change a previously closed instance's recorded name
- **WHEN** a `PhaseInstance` closes while its `Phase.label` is `"Focus"`, and the graph is later reconfigured so the same `phaseId` has `label` `"Deep Work"`
- **THEN** the closed instance already in `history` still has `phaseDisplayName: "Focus"`

### Requirement: itemsTouched records lightweight per-touch item snapshots, not bare ids
Whenever `activeFilePath` resolves to a `TaskQueueItem` not already the current instance's active item, `PhaseInstance.itemsTouched` SHALL gain a record capturing that item's `id`, `sourcePath`, and `displayName` as of that moment — not its mutable `cycleStatus`/`timeSpent`/`lastCycledAt`. The current active item is the last such record.

#### Scenario: Activating a queue item appends a snapshot, not just an id
- **WHEN** a dispatched action resolves `activeFilePath` to a `TaskQueueItem` different from the current instance's active item
- **THEN** `currentInstance.itemsTouched` gains a new entry with that item's `id`, `sourcePath`, and `displayName` as they were at that moment

#### Scenario: A later change to that item's mutable fields doesn't alter the recorded snapshot
- **WHEN** a `TaskQueueItem`'s `cycleStatus` or `timeSpent` changes after it was recorded in `itemsTouched`
- **THEN** the existing `itemsTouched` entry for that item is unchanged

### Requirement: HookEventOccurrence identifies the exact PhaseInstance a firing belongs to
`deriveHookEvents` SHALL include a `phaseInstanceId` on every `HookEventOccurrence`, distinguishing repeated visits to the same `phaseId` within one session.

#### Scenario: Two visits to the same phase produce distinct phaseInstanceIds
- **WHEN** a cyclic `PhaseGraph` enters the same phase twice across two cycles within the same session
- **THEN** the `onEnter` `HookEventOccurrence` for each visit carries a different `phaseInstanceId`
