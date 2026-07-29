## ADDED Requirements

### Requirement: A bound script executes in-process, gated only by the bind-time confirmation
Invoking a script-backed `Hook` SHALL execute the script's code in-process (the main renderer thread), with no runtime sandbox or isolation mechanism. The sole trust boundary is the bind-time confirmation gate (see `script-hook-source`) — a script that has been confirmed as a binding has the same host/Node access as any other code running in the plugin's process.

#### Scenario: A confirmed script can reach Node built-ins and the Obsidian app
- **WHEN** a bound, confirmed script's code calls `require` or references `app`/`window`/`document`
- **THEN** the call succeeds, same as any other in-process code — no isolation prevents it

### Requirement: Each invocation is subject to a soft timeout via Promise.race, treated as a failure if exceeded
Every invocation of a script-backed `Hook` SHALL race the script's returned `Promise` against a bounded timeout. If the timeout elapses first, the invocation SHALL be treated as a failed hook invocation (per `hook-execution`'s per-invocation error isolation). This catches a script whose returned promise never settles; it does NOT catch a synchronous hang (e.g. an infinite loop before the script's first `await`), which has no in-process remedy.

#### Scenario: A script whose promise never settles is treated as a failed invocation
- **WHEN** a bound script's code returns a `Promise` that never resolves or rejects
- **THEN** the invocation is treated as a failure once the timeout elapses, without blocking `EngineStore.dispatch` indefinitely

#### Scenario: A second invocation of the same binding is independent
- **WHEN** the same script-backed `Hook` is invoked twice in separate dispatches
- **THEN** each invocation runs and times out independently of the other

### Requirement: HookContext is enriched with pre-resolved frontmatter for the active file's note only
Before invoking the script, the invocation path SHALL resolve the current frontmatter of `EngineState.activeFilePath`'s note, when non-null, and include it in the `HookContext` passed to the script. `Phase` has no note/file-path field of its own, so no second, phase-associated path is resolved. The script SHALL NOT be given a mechanism to request the frontmatter or content of any other vault path at invocation time.

#### Scenario: A script receives the active file's current frontmatter
- **WHEN** a script-backed `Hook` fires an event while `EngineState.activeFilePath` is a non-null path with existing frontmatter
- **THEN** the `HookContext` the script receives includes that file's current frontmatter

#### Scenario: A script has no way to read an arbitrary vault path
- **WHEN** a bound script's code attempts to read the frontmatter or content of a vault path other than the active file's note
- **THEN** no API provided by the invocation path (as opposed to ambient host access, which this capability does not prevent — see the first requirement above) satisfies that read

### Requirement: A script's result is applied through the existing declarative FileMutation contract only
A script-backed `Hook`'s execution SHALL resolve to `readonly FileMutation[]`, applied via the same `applyMutations`/`FileMutationPort` path as any other `Hook`. Scripts are expected to describe vault changes through this contract even though nothing prevents them from mutating the vault by other means (see the first requirement above) — `script-hook-source`'s bind-time review is what a user relies on to confirm a script behaves as described.

#### Scenario: A script's returned mutations are applied the same way as a hand-typed hook's
- **WHEN** a script-backed `Hook` resolves with one or more `FileMutation`s
- **THEN** `EngineStore` applies them via `applyMutations` against the configured `FileMutationPort`, indistinguishably from a hand-typed `Hook`'s mutations
