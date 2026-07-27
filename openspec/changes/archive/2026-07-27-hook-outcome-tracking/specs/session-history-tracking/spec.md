## ADDED Requirements

### Requirement: PhaseInstance accumulates real hook-invocation outcomes
`PhaseInstance.mutationsApplied` SHALL accumulate the `FileMutation`s that actually wrote, in firing order, across every hook event fired for that instance. `PhaseInstance.hookFailures` SHALL accumulate a record for every hook invocation that threw/rejected, or whose `FileMutation` batch stopped partway through, in firing order — each record naming the `HookEvent` that produced it. Both fields SHALL only ever grow (append), never be overwritten or reordered, and SHALL start empty on a freshly opened instance.

#### Scenario: A successful hook's mutations accumulate into mutationsApplied
- **WHEN** a hook fires for an instance and its returned `FileMutation[]` all apply successfully
- **THEN** every one of those mutations is appended to that instance's `mutationsApplied`, and `hookFailures` is unchanged

#### Scenario: onComplete and onExit on the same closing instance both accumulate
- **WHEN** `onComplete` and `onExit` both fire for the same closing instance in one dispatch, and each hook's mutations apply successfully
- **THEN** the closed instance's `mutationsApplied` contains `onComplete`'s mutations followed by `onExit`'s mutations, not just the latter

#### Scenario: A manualClear phase's onComplete and its later onExit accumulate onto the same instance across separate dispatches
- **WHEN** a `manualClear`-policy phase's `onComplete` fires (the instance stays open) and, in a later, separate `advance-phase` dispatch, that same instance's `onExit` fires — each hook's mutations applying successfully
- **THEN** the now-closed instance's `mutationsApplied` contains `onComplete`'s mutations followed by `onExit`'s mutations, not just the latter

#### Scenario: A hook that throws is recorded in hookFailures, not mutationsApplied
- **WHEN** a hook fires for an instance and its invocation throws or its returned promise rejects
- **THEN** that instance's `hookFailures` gains an `invocationFailed` record naming the firing event and the cause, and `mutationsApplied` is unchanged

#### Scenario: A partial mutation-apply failure records both the successful prefix and the failure
- **WHEN** a hook fires for an instance and returns mutations where the first two apply successfully and the third fails
- **THEN** that instance's `mutationsApplied` gains the first two mutations, and `hookFailures` gains a `mutationFailed` record naming the third mutation and its cause

#### Scenario: An outcome for an instance no longer resolvable in EngineState is dropped, not thrown
- **WHEN** a hook's outcome settles for a `phaseInstanceId` that is no longer the current instance nor present in history (e.g. an intervening `stop` reset the session)
- **THEN** `EngineState` is unchanged and no error is thrown
