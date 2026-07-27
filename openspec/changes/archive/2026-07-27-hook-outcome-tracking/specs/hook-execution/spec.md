## ADDED Requirements

### Requirement: EngineStore folds each fired hook's outcome onto its PhaseInstance after invocation
Immediately after a resolved hook's invocation settles, `EngineStore` SHALL fold its `HookInvocationOutcome` onto the `PhaseInstance` identified by that firing's `phaseInstanceId` (`session.currentInstance` if it matches, otherwise the matching entry in `session.history`), before proceeding to the next fired event in the same dispatch. This fold SHALL be a no-op when neither location holds a matching instance.

#### Scenario: onEnter's outcome lands on the newly-opened currentInstance
- **WHEN** an `onEnter` event's hook settles
- **THEN** its outcome is folded onto `session.currentInstance`, whose id matches that event's `phaseInstanceId`

#### Scenario: onSkip/onExit's outcome lands on the just-closed history entry
- **WHEN** an `onSkip` or `onExit` event's hook settles
- **THEN** its outcome is folded onto the entry in `session.history` whose id matches that event's `phaseInstanceId`

#### Scenario: A null/noOp-policy phase's onComplete outcome lands on the just-closed history entry
- **WHEN** an `onComplete` event fires because a `null`/`noOp`-policy phase concluded naturally and auto-advanced, and its hook settles
- **THEN** its outcome is folded onto the entry in `session.history` whose id matches that event's `phaseInstanceId`

#### Scenario: A manualClear-policy phase's onComplete outcome lands on the still-open currentInstance
- **WHEN** an `onComplete` event fires because a `manualClear`-policy phase's `remaining` reached zero (the instance stays open, `status` becomes `'completed'`), and its hook settles
- **THEN** its outcome is folded onto `session.currentInstance`, whose id matches that event's `phaseInstanceId` — not onto `session.history`, since the instance hasn't closed yet

#### Scenario: A stop mid-phase's onExit outcome is dropped without error
- **WHEN** `stop` is dispatched against a `'running'` or `'paused'` state, and the resulting `onExit` event's hook settles after `EngineState.session` has already reset to `null`
- **THEN** `EngineStore.dispatch`'s resolved return value still reports that hook's outcome, but no `PhaseInstance` anywhere in `EngineState` is updated
