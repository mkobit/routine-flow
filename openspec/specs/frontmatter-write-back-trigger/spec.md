# frontmatter-write-back-trigger Specification

## Purpose
TBD - created by archiving change frontmatter-write-back-trigger. Update Purpose after archive.
## Requirements
### Requirement: Phase.logTarget represents where completion write-back goes
`Phase.logTarget` SHALL be one of two variants: `{ kind: 'activeItem' }`, meaning the write-back targets the engine's currently active task file, or `{ kind: 'callback', name: LogTargetResolverName }`, meaning the write-back target is resolved by looking up `name` in a `LogTargetResolverRegistry`.

#### Scenario: A phase with an activeItem log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'activeItem' }`
- **THEN** the schema validates it without requiring any additional parameters

#### Scenario: A phase with a callback log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'callback', name: 'dailyNote' }`
- **THEN** the schema validates it, carrying `name` for later resolution

### Requirement: LogTargetResolverRegistry resolves callback targets by name, never by eval
A `LogTargetResolverRegistry` SHALL expose `resolve(name: LogTargetResolverName): ((phase: Phase) => string | null) | undefined`. Resolution SHALL be a plain lookup against resolvers the registry was constructed with — never evaluating a name as code.

#### Scenario: An unregistered callback name resolves to nothing
- **WHEN** `resolve` is called with a name the registry has no resolver for
- **THEN** it returns `undefined`

#### Scenario: A registered callback name resolves to its function
- **WHEN** `resolve` is called with a name the registry was constructed with
- **THEN** it returns the corresponding `(phase: Phase) => string | null` function

### Requirement: nextLogEntry computes the next single-field write-back value
`nextLogEntry(currentValue: unknown, property: string, recordedAt: Temporal.Instant)` SHALL return a `LogEntry` whose `value` is `currentValue + 1` when `currentValue` is a `number`, and `1` otherwise (including when `currentValue` is `undefined`, a string, a boolean, or any other non-number). The returned `LogEntry`'s `property` and `recordedAt` SHALL echo the given arguments unchanged.

#### Scenario: Current value is a number
- **WHEN** `nextLogEntry(3, 'sessions', now)` is called
- **THEN** it returns `{ property: 'sessions', value: 4, recordedAt: now }`

#### Scenario: Current value is missing or non-numeric
- **WHEN** `nextLogEntry(undefined, 'sessions', now)` or `nextLogEntry('not-a-number', 'sessions', now)` is called
- **THEN** it returns a `LogEntry` with `value: 1`

### Requirement: Write-back orchestration resolves a target, then reads, computes, and applies a single frontmatter mutation
On a phase completion, the write-back `Hook` SHALL resolve the completed phase's write-back target from its `logTarget`: for `{ kind: 'activeItem' }`, the target is the `HookContext`'s `activeFilePath` (or no target if it is `null`); for `{ kind: 'callback', name }`, the target is whatever the resolved function (if any) returns for that `name`, given the phase. When a target file path is resolved, the hook SHALL read the file's current value at the configured write-back property, compute the next `LogEntry` via `nextLogEntry`, and prompt the user (via `WriteBackPromptPort`) with those computed values as defaults. If the user submits the prompt, the hook SHALL return a `FileMutation` of kind `frontmatter` built from the (possibly user-edited) submitted values, for `EngineStore` to apply via the configured `FileMutationPort`. The hook SHALL return `[]` (no mutations) when no target resolves or the user cancels the prompt.

#### Scenario: activeItem target with an active file prompts and writes back on submit
- **WHEN** a completed phase has `logTarget: { kind: 'activeItem' }`, the `HookContext`'s `activeFilePath` is set, and the user submits the prompt without changing any field
- **THEN** the hook reads the current frontmatter value at that file, prompts with defaults computed via `nextLogEntry`, and returns a `frontmatter` `FileMutation` matching those defaults

#### Scenario: activeItem target with no active file is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'activeItem' }` and the `HookContext`'s `activeFilePath` is `null`
- **THEN** the hook returns `[]` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: callback target with an unregistered resolver is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'callback', name: 'dailyNote' }` and the `LogTargetResolverRegistry` has no resolver registered for `'dailyNote'`
- **THEN** the hook returns `[]` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: callback target with a registered resolver prompts and writes back on submit
- **WHEN** a completed phase has `logTarget: { kind: 'callback', name }`, the registry's resolver for `name` returns a file path for that phase, and the user submits the prompt
- **THEN** the hook reads that file's current frontmatter value, prompts with defaults computed via `nextLogEntry`, and returns a `frontmatter` `FileMutation` from the submitted values

#### Scenario: callback target with a registered resolver that returns null is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'callback', name }` and the registry's resolver for `name` is registered but returns `null` for that phase
- **THEN** the hook returns `[]` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: User cancels the prompt
- **WHEN** a target resolves and the user cancels the prompt (e.g. presses Escape) instead of submitting
- **THEN** the hook returns `[]` without the `FileMutationPort` being called

#### Scenario: User edits a field before submitting
- **WHEN** a target resolves and the user changes the file, property, and/or value in the prompt before submitting
- **THEN** the hook returns a `FileMutation` built from the edited values, not the originally computed defaults

### Requirement: Write-back triggers on every phase completion, not only focus-kind phases
Every phase in the plugin's shipped `PhaseGraph` SHALL declare `onComplete` as a `HookReference` naming the write-back hook, regardless of the phase's `kind`. Whether a write actually occurs SHALL be determined solely by the completed phase's `logTarget` resolution, not by a phase-kind check or by which phases declare the hook.

#### Scenario: A non-focus phase with a resolvable target still writes back
- **WHEN** a break phase (kind `break`) completes, its `onComplete` names the write-back hook, and its `logTarget` resolves to a file path
- **THEN** `EngineStore` invokes the write-back hook and applies the resulting write-back the same as it would for a focus phase

#### Scenario: A phase without the hook declared never triggers write-back
- **WHEN** a phase's `onComplete` is `null` or names a hook other than the write-back hook
- **THEN** completing that phase does not read any file, show a prompt, or call the `FileMutationPort` for write-back purposes

