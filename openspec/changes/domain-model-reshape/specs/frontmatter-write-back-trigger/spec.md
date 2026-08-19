## ADDED Requirements

### Requirement: Phase.logTarget is activeItem-only
`Phase.logTarget` SHALL be `{ kind: 'activeItem' }`, meaning the write-back targets the engine's currently active task file. No other variant SHALL be accepted.

#### Scenario: A phase with an activeItem log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'activeItem' }`
- **THEN** the schema validates it without requiring any additional parameters

### Requirement: Write-back orchestration resolves the active item as the write-back target
On a phase completion, the write-back `Hook` SHALL resolve the completed phase's write-back target as the `HookContext`'s `activeFilePath` (or no target if it is `null`). When a target file path is resolved, the hook SHALL read the file's current value at the configured write-back property, compute the next `LogEntry` via `nextLogEntry`, and prompt the user (via `WriteBackPromptPort`) with those computed values as defaults. If the user submits the prompt, the hook SHALL return a `FileMutation` of kind `frontmatter` built from the (possibly user-edited) submitted values, for `EngineStore` to apply via the configured `FileMutationPort`. The hook SHALL return `[]` (no mutations) when there is no active file or the user cancels the prompt.

#### Scenario: activeItem target with an active file prompts and writes back on submit
- **WHEN** a completed phase has `logTarget: { kind: 'activeItem' }`, the `HookContext`'s `activeFilePath` is set, and the user submits the prompt without changing any field
- **THEN** the hook reads the current frontmatter value at that file, prompts with defaults computed via `nextLogEntry`, and returns a `frontmatter` `FileMutation` matching those defaults

#### Scenario: activeItem target with no active file is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'activeItem' }` and the `HookContext`'s `activeFilePath` is `null`
- **THEN** the hook returns `[]` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: User cancels the prompt
- **WHEN** a target resolves and the user cancels the prompt (e.g. presses Escape) instead of submitting
- **THEN** the hook returns `[]` without the `FileMutationPort` being called

#### Scenario: User edits a field before submitting
- **WHEN** a target resolves and the user changes the file, property, and/or value in the prompt before submitting
- **THEN** the hook returns a `FileMutation` built from the edited values, not the originally computed defaults

## MODIFIED Requirements

### Requirement: nextLogEntry computes the next single-field write-back value
`nextLogEntry(currentValue: unknown, property: string)` SHALL return a `LogEntry` whose `value` is `currentValue + 1` when `currentValue` is a `number`, and `1` otherwise (including when `currentValue` is `undefined`, a string, a boolean, or any other non-number). The returned `LogEntry`'s `property` SHALL echo the given argument unchanged.

#### Scenario: Current value is a number
- **WHEN** `nextLogEntry(3, 'sessions')` is called
- **THEN** it returns `{ property: 'sessions', value: 4 }`

#### Scenario: Current value is missing or non-numeric
- **WHEN** `nextLogEntry(undefined, 'sessions')` or `nextLogEntry('not-a-number', 'sessions')` is called
- **THEN** it returns a `LogEntry` with `value: 1`

## REMOVED Requirements

### Requirement: Phase.logTarget represents where completion write-back goes
**Reason**: `Phase.logTarget`'s `'callback'` variant, resolved via `LogTargetResolverRegistry`, was schema-reachable but structurally dead. Replaced by "Phase.logTarget is activeItem-only" under ADDED Requirements.
**Migration**: no real routine ever used `logTarget: { kind: 'callback', ... }` (the shipped default and onboarding scaffold both already used `{ kind: 'activeItem' }` only). A hand-authored routine file using the removed variant fails schema validation with a standard `RoutineParseError`.

#### Scenario: A phase with an activeItem log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'activeItem' }`
- **THEN** the schema validates it without requiring any additional parameters

#### Scenario: A phase with a callback log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'callback', name: 'dailyNote' }`
- **THEN** the schema validates it, carrying `name` for later resolution

### Requirement: Write-back orchestration resolves a target, then reads, computes, and applies a single frontmatter mutation
**Reason**: the `callback` target-resolution branch is removed along with `LogTargetResolverRegistry`. Replaced by "Write-back orchestration resolves the active item as the write-back target" under ADDED Requirements, which retains every scenario here except the three `callback`-specific ones below.
**Migration**: see the `Phase.logTarget` removal above — no real routine used the `callback` branch.

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

### Requirement: LogTargetResolverRegistry resolves callback targets by name, never by eval
**Reason**: `LogTargetResolverRegistry` was permanently wired as `{ resolve: () => undefined }` (`main.ts`), with zero registrations anywhere and no settings UI or registration mechanism ever built to populate it. `Phase.logTarget`'s `'callback'` variant was schema-reachable but structurally dead in the shipped product.
**Migration**: no real routine ever used `logTarget: { kind: 'callback', ... }` (the shipped default and onboarding scaffold both already used `{ kind: 'activeItem' }` only). No migration path is needed; a hand-authored routine file using the removed variant fails schema validation with a standard `RoutineParseError`.

#### Scenario: An unregistered callback name resolves to nothing
- **WHEN** `resolve` is called with a name the registry has no resolver for
- **THEN** it returns `undefined`

#### Scenario: A registered callback name resolves to its function
- **WHEN** `resolve` is called with a name the registry was constructed with
- **THEN** it returns the corresponding `(phase: Phase) => string | null` function
