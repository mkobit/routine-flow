## ADDED Requirements

### Requirement: A bound script executes inside a Web Worker with no Node integration
Invoking a script-backed `Hook` SHALL execute the script's code inside a Web Worker rather than the main renderer thread, such that the script has no access to Node built-ins (e.g. `require('fs')`, `child_process`) and no access to the Obsidian `app`/`window`/DOM objects.

#### Scenario: A script cannot reach Node built-ins
- **WHEN** a bound script's code attempts to call `require`
- **THEN** that call fails inside the Worker's execution context (no such binding is available)

#### Scenario: A script cannot reach the Obsidian app or DOM
- **WHEN** a bound script's code attempts to reference `window`, `document`, or an injected `app` object
- **THEN** no such binding is available inside the Worker's execution context

### Requirement: Each script invocation spawns a new Worker, terminated after completion or timeout
Every invocation of a script-backed `Hook` SHALL spawn its own Worker instance, which SHALL be terminated after the script's result is obtained or after a bounded timeout elapses, whichever comes first. A timed-out invocation SHALL be treated as a failed hook invocation.

#### Scenario: A hanging script is terminated after its timeout
- **WHEN** a bound script's code never returns (e.g. an infinite loop)
- **THEN** its Worker is terminated once the invocation timeout elapses, and the invocation is treated as a failure rather than blocking `EngineStore.dispatch` indefinitely

#### Scenario: A second invocation of the same binding does not reuse a prior Worker
- **WHEN** the same script-backed `Hook` is invoked twice in separate dispatches
- **THEN** each invocation spawns and terminates its own Worker instance

### Requirement: HookContext is serialized to a structured-clone-safe form before crossing into the Worker
Because `HookContext` carries `Temporal` values not supported by the structured clone algorithm, the invocation path SHALL serialize any such values to plain strings before passing `HookContext` into the Worker, and the Worker-side script execution SHALL receive the equivalent `Temporal` values rehydrated from that serialized form.

#### Scenario: A Temporal-carrying HookContext crosses into the Worker without error
- **WHEN** a script-backed `Hook` is invoked with a `HookContext` whose `session`/`instance` fields carry `Temporal.Instant`/`Duration` values
- **THEN** the invocation does not throw a structured-clone error, and the script receives equivalent `Temporal` values, not raw strings

### Requirement: HookContext is enriched with pre-resolved frontmatter for the active file's note only
Before spawning the Worker, the invocation path SHALL resolve the current frontmatter of `EngineState.activeFilePath`'s note, when non-null, and include it in the `HookContext` passed to the script. `Phase` has no note/file-path field of its own, so no second, phase-associated path is resolved. The script SHALL NOT be given a mechanism to request the frontmatter or content of any other vault path at invocation time.

#### Scenario: A script receives the active file's current frontmatter
- **WHEN** a script-backed `Hook` fires an event while `EngineState.activeFilePath` is a non-null path with existing frontmatter
- **THEN** the `HookContext` the script receives includes that file's current frontmatter

#### Scenario: A script has no way to read an arbitrary vault path
- **WHEN** a bound script's code attempts to read the frontmatter or content of a vault path other than the active file's note
- **THEN** no API available to the script's execution context can satisfy that read

### Requirement: A script's result is applied through the existing declarative FileMutation contract only
A script-backed `Hook`'s Worker execution SHALL resolve to `readonly FileMutation[]`, applied via the same `applyMutations`/`FileMutationPort` path as any other `Hook`. No other channel for the script to affect the vault SHALL exist.

#### Scenario: A script's returned mutations are applied the same way as a hand-typed hook's
- **WHEN** a script-backed `Hook` resolves with one or more `FileMutation`s
- **THEN** `EngineStore` applies them via `applyMutations` against the configured `FileMutationPort`, indistinguishably from a hand-typed `Hook`'s mutations
