## ADDED Requirements

### Requirement: A hook invocation that throws or rejects does not stop remaining hook events from firing
When a resolved hook's invocation throws synchronously or its returned promise rejects, `EngineStore` SHALL catch that failure, continue resolving and invoking hooks for any other events fired in the same dispatch, and include an entry for the failing event in `dispatch`'s resolved result reflecting the failure without re-throwing it out of `dispatch`.

#### Scenario: A throwing onExit hook does not suppress the paired onEnter hook
- **WHEN** an `onExit` event's resolved hook throws synchronously, and the same dispatch also fires an `onEnter` event for a phase with a resolvable hook
- **THEN** `EngineStore.dispatch` does not reject or throw, and the `onEnter` event's hook is still invoked and its mutations still applied

#### Scenario: A rejecting hook promise does not suppress a later event's hook in the same dispatch
- **WHEN** an event's resolved hook returns a promise that rejects, and a later event fired in the same dispatch has a resolvable hook
- **THEN** `EngineStore.dispatch` does not reject, and the later event's hook is still invoked

#### Scenario: dispatch's resolved result reflects a hook invocation failure without throwing
- **WHEN** a dispatch fires one event whose resolved hook's invocation throws
- **THEN** the promise returned by `dispatch` still resolves (not rejects), with an entry for that event distinguishable as a failed invocation rather than a successful empty-mutation result
