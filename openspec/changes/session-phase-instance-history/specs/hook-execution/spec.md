## MODIFIED Requirements

### Requirement: Resolved hooks are invoked with a synthesized HookContext
For each fired event whose phase declares a non-null `HookReference` for that event, `EngineStore` SHALL resolve the hook via the configured `HookRegistry` and, if resolution succeeds, invoke it with a `HookContext` whose `phase` is the firing phase, whose `activeFilePath` is the engine state's current `activeFilePath` at the moment the event fired, and whose `instance`/`session` are read from `EngineState`'s tracked `session`/`currentInstance`/`history` — keyed by the event's `phaseInstanceId` — not freshly constructed for that call.

#### Scenario: A declared and resolvable hook is invoked
- **WHEN** an `onEnter` event fires for a phase whose `onEnter` field is a `HookReference` naming a hook registered in the configured `HookRegistry`
- **THEN** `EngineStore` calls that hook exactly once, with a `HookContext.phase` equal to the firing phase

#### Scenario: A phase with no hook declared for the firing event invokes nothing
- **WHEN** an `onExit` event fires for a phase whose `onExit` field is `null`
- **THEN** `EngineStore` does not call `HookRegistry.resolve` or any hook for that event

#### Scenario: HookContext carries the engine's current active file path
- **WHEN** a hook is invoked for an event fired while `EngineState.activeFilePath` is a non-null file path
- **THEN** the `HookContext` passed to that hook has `activeFilePath` equal to that same file path

#### Scenario: onEnter's HookContext reflects the just-opened currentInstance
- **WHEN** an `onEnter` event fires
- **THEN** the `HookContext.instance` passed to its hook is the same `PhaseInstance` value stored at `nextState.session.currentInstance`, not a newly constructed value

#### Scenario: onComplete/onSkip/onExit's HookContext reflects the just-closed history entry
- **WHEN** an `onComplete`, `onSkip`, or `onExit` event fires
- **THEN** the `HookContext.instance` passed to its hook is the entry in `nextState.session.history` matching the event's `phaseInstanceId`
