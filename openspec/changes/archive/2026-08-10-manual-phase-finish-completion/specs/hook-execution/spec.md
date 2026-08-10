## ADDED Requirements

### Requirement: onComplete fires when a duration-less phase is finished via finish-phase
`EngineStore` SHALL fire `onComplete` for the current phase when `finish-phase` is dispatched: a `manualClear`-policy phase halts with status `'completed'` (mirroring the zero-remaining `tick` case), and a `null`/`noOp`-policy phase auto-advances, firing `onComplete` before `onExit`/`onEnter` for that same dispatch — the same derivation `tick` already has for reaching zero remaining.

#### Scenario: manualClear finish-phase fires onComplete only, no onExit/onEnter
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }`
- **THEN** `EngineStore` fires `onComplete` for the current phase, and fires no `onExit` or `onEnter` event

#### Scenario: null/noOp finish-phase fires onComplete, then onExit, then onEnter
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `completionPolicy` is `null`
- **THEN** `EngineStore` fires, in order, `onComplete` for the previous phase, `onExit` for the previous phase, and `onEnter` for the graph-resolved next phase

#### Scenario: finish-phase completes the current phase regardless of remaining duration
- **WHEN** `finish-phase` is dispatched against a `'running'` phase whose `remaining` is non-null (a timed phase)
- **THEN** `EngineStore` fires the same `onComplete`-based event sequence as it would for that phase's `completionPolicy` on a zero-remaining `tick` — `finish-phase` is not restricted to duration-less phases
