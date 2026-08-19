## MODIFIED Requirements

### Requirement: waitForManual onCompletion halts at phase completion
When the current phase node's `onCompletion` property is `'waitForManual'` and a `tick` or `finish-phase` action brings `remaining` to zero (or completes the phase), `engineReducer` SHALL set `EngineState.status` to `'completed'` and SHALL NOT change `currentPhaseId` or `remaining`.

#### Scenario: A waitForManual phase reaching zero halts instead of advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `onCompletion` is `'waitForManual'` and `remaining` is zero
- **THEN** the resulting state has `status: 'completed'`, preserving `currentPhaseId` and `remaining`

### Requirement: autoAdvance onCompletion advances immediately
When the current phase node's `onCompletion` property is `'autoAdvance'` and a `tick` or `finish-phase` action brings `remaining` to zero (or completes the phase), `engineReducer` SHALL resolve the next phase via `resolveNextPhaseId` and advance immediately to that phase.

#### Scenario: An autoAdvance phase reaching zero advances to next phase
- **WHEN** `tick` is dispatched against a `'running'` phase whose `onCompletion` is `'autoAdvance'` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`

## REMOVED Requirements

### Requirement: CompletionPolicy schema
**Reason**: `CompletionPolicy` is retired as a standalone type union. Auto-advance gating is controlled by `PhaseNode.onCompletion` (`'autoAdvance' | 'waitForManual'`), and completion actions are handled via `onComplete` lifecycle `Handler`s.
