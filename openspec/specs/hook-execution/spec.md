# hook-execution Specification

## Purpose
TBD - created by archiving change hook-execution. Update Purpose after archive.
## Requirements
### Requirement: onExit and onEnter fire together whenever the current phase changes
Whenever a dispatched action changes `EngineState.currentPhaseId`, `EngineStore` SHALL fire `onExit` for the phase being left and `onEnter` for the phase being entered, regardless of which action caused the change.

#### Scenario: advance-phase from stopped fires onExit then onEnter
- **WHEN** `advance-phase` is dispatched against a `'stopped'` state
- **THEN** `EngineStore` fires `onExit` for the previous phase followed by `onEnter` for the graph-resolved next phase, and fires no `onComplete` or `onSkip` event

### Requirement: onComplete fires when a phase concludes naturally
`EngineStore` SHALL fire `onComplete` for the current phase when it concludes on its own terms: a `tick` that brings a `manualClear`-policy phase's `remaining` to zero (status becomes `'completed'`), or a `tick` that brings a `null`/`noOp`-policy phase's `remaining` to zero (which auto-advances). In the auto-advance case, `onComplete` fires before `onExit`/`onEnter` for that same dispatch.

#### Scenario: manualClear halt fires onComplete only, no onExit/onEnter
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }` and `remaining` is zero
- **THEN** `EngineStore` fires `onComplete` for the current phase, and fires no `onExit` or `onEnter` event (the phase hasn't been left yet)

#### Scenario: null/noOp auto-advance fires onComplete, then onExit, then onEnter
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `null` and `remaining` is zero
- **THEN** `EngineStore` fires, in order, `onComplete` for the previous phase, `onExit` for the previous phase, and `onEnter` for the graph-resolved next phase

### Requirement: Clearing a completed phase does not re-fire onComplete or fire onSkip
When `advance-phase` is dispatched against a `'completed'` state (clearing a `manualClear` phase whose `onComplete` already fired at the halt), `EngineStore` SHALL fire only `onExit` and `onEnter` — no `onComplete`, no `onSkip`.

#### Scenario: Clearing a completed manualClear phase fires onExit/onEnter, not onComplete or onSkip
- **WHEN** `advance-phase` is dispatched against a state with `status: 'completed'`
- **THEN** `EngineStore` fires `onExit` for the completed phase followed by `onEnter` for the graph-resolved next phase, and fires no `onComplete` or `onSkip` event

### Requirement: onSkip fires when a running or paused phase is abandoned via advance-phase
When `advance-phase` is dispatched against a `'running'` or `'paused'` state (a phase abandoned before it naturally concluded), `EngineStore` SHALL fire, in order, `onSkip` for the abandoned phase, `onExit` for the abandoned phase, and `onEnter` for the graph-resolved next phase.

#### Scenario: advance-phase from running fires onSkip, then onExit, then onEnter
- **WHEN** `advance-phase` is dispatched against a state with `status: 'running'`
- **THEN** `EngineStore` fires, in order, `onSkip` for the current phase, `onExit` for the current phase, and `onEnter` for the graph-resolved next phase

#### Scenario: advance-phase from paused fires onSkip, then onExit, then onEnter
- **WHEN** `advance-phase` is dispatched against a state with `status: 'paused'`
- **THEN** `EngineStore` fires, in order, `onSkip` for the current phase, `onExit` for the current phase, and `onEnter` for the graph-resolved next phase

### Requirement: Actions that don't change phase or reach completion fire no hook events
`EngineStore` SHALL fire no hook events for `start`, `pause`, `resume`, `stop`, or a `tick` that neither reaches zero remaining nor changes `currentPhaseId`.

#### Scenario: pause fires no hook events
- **WHEN** `pause` is dispatched against a `'running'` state
- **THEN** `EngineStore` fires no `onEnter`, `onComplete`, `onSkip`, or `onExit` event

#### Scenario: A tick with remaining time left fires no hook events
- **WHEN** `tick` is dispatched against a `'running'` state whose `remaining` is greater than zero after the tick
- **THEN** `EngineStore` fires no `onEnter`, `onComplete`, `onSkip`, or `onExit` event

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

### Requirement: An unresolved hook name is silently skipped
When a fired event's phase declares a `HookReference` whose `name` does not resolve via the configured `HookRegistry` (`resolve` returns `undefined`), `EngineStore` SHALL skip invoking a hook for that event without throwing and without blocking any other fired event in the same dispatch.

#### Scenario: An unregistered hook name does not throw or block other events
- **WHEN** an `onEnter` event fires for a phase whose `onEnter` field names a hook not present in the configured `HookRegistry`, and the same dispatch also fires an `onExit` event for a phase with a resolvable hook
- **THEN** `EngineStore.dispatch` does not throw, and the `onExit` event's hook is still invoked

### Requirement: Hook-produced FileMutations are applied via the configured FileMutationPort
`Hook` SHALL be invoked as a function returning `Promise<readonly FileMutation[]>`. `EngineStore` SHALL `await` that promise before applying the resolved `FileMutation[]`; when the awaited result is non-empty, `EngineStore` SHALL apply them via `applyMutations` against the configured `FileMutationPort`.

#### Scenario: A hook's returned mutations are applied
- **WHEN** a resolved hook is invoked and its returned promise resolves with one or more `FileMutation`s
- **THEN** `EngineStore` calls `applyMutations` with the configured `FileMutationPort` and that mutation list

#### Scenario: EngineStore awaits an interactive hook before proceeding
- **WHEN** a resolved hook's body awaits a user-facing prompt before its returned promise resolves
- **THEN** `EngineStore` does not call `applyMutations` for that event until the hook's promise resolves, and does not skip or reorder later events ahead of it in the same dispatch

### Requirement: A failed mutation application does not stop remaining hook events from firing
When `applyMutations` resolves with `{ success: false }` for one fired event's hook, `EngineStore` SHALL continue resolving and invoking hooks for any other events fired in the same dispatch.

#### Scenario: A failing onExit mutation does not suppress the paired onEnter hook
- **WHEN** an `onExit` event's hook returns a mutation that `applyMutations` reports as failed, and the same dispatch also fires an `onEnter` event for a phase with a resolvable hook
- **THEN** the `onEnter` event's hook is still invoked and its mutations are still applied

### Requirement: EngineStore without a configured HookRegistry or FileMutationPort fires no hooks
When `EngineStore` is constructed without a `HookRegistry` and `FileMutationPort`, dispatching any action SHALL behave exactly as it does today (state transitions per `engineReducer`, subscribers notified) with no hook resolution, invocation, or mutation application attempted.

#### Scenario: Dispatch without hook configuration transitions state without touching hooks
- **WHEN** `advance-phase` is dispatched on an `EngineStore` constructed with only a `PhaseGraph`
- **THEN** the resulting `EngineState` matches what `engineReducer` alone would produce, and no `HookRegistry`/`FileMutationPort` method is called

### Requirement: dispatch resolves with a per-event hook-application summary
`EngineStore.dispatch` SHALL return a `Promise` that resolves (never rejects on a hook or mutation failure) with a list of `{ event, phase, result }` entries, one per fired event that had a resolvable hook, where `result` is the `ApplyMutationsResult` from applying that hook's mutations.

#### Scenario: dispatch resolves with results for each resolvable fired event
- **WHEN** a dispatch fires two events, both with resolvable hooks, one of whose mutations fail to apply
- **THEN** the promise returned by `dispatch` resolves with two entries, one with `result.success: true` and one with `result.success: false`, and does not reject

