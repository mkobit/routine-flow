# Spec Delta

## MODIFIED Requirements

### Requirement: Phase.logTarget represents where completion write-back goes
`Phase.logTarget` SHALL be one of three variants: `{ kind: 'activeItem' }` targeting the active task file, `{ kind: 'completedItems' }` targeting all completed items in the current phase instance, or `{ kind: 'callback', name: LogTargetResolverName }` resolved via `LogTargetResolverRegistry`.

#### Scenario: A phase with an activeItem log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'activeItem' }`
- **THEN** the schema validates it without requiring any additional parameters

#### Scenario: A phase with a completedItems log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'completedItems' }`
- **THEN** the schema validates it without requiring any additional parameters

#### Scenario: A phase with a callback log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'callback', name: 'dailyNote' }`
- **THEN** the schema validates it, carrying `name` for later resolution

## ADDED Requirements

### Requirement: Batch write-back resolution across completed items
When a phase with `logTarget: { kind: 'completedItems' }` completes, the write-back hook SHALL resolve all item paths in `PhaseInstance.itemsTouched` that have `status: 'completed'`.
For each resolved item path, the hook SHALL read the current frontmatter value, compute the next log value, and generate a `frontmatter` `FileMutation`.
When `activeFilePath` is null upon queue depletion, the hook SHALL resolve completed items from `itemsTouched`.
If zero items have `status: 'completed'`, the hook SHALL return an empty array without prompting or failing.

#### Scenario: Completed items target generates batch mutations across finished tasks
- **WHEN** a phase with `logTarget: { kind: 'completedItems' }` completes and two touched items have `status: 'completed'`
- **THEN** the write-back hook returns a `frontmatter` mutation for each completed note

#### Scenario: Batch write-back succeeds when activeFilePath is null upon queue depletion
- **WHEN** the last task is completed, `activeFilePath` is null, and the phase completes
- **THEN** the write-back hook resolves all completed items from `itemsTouched` and generates their frontmatter mutations

#### Scenario: Zero completed items produces empty mutation list
- **WHEN** a phase with `logTarget: { kind: 'completedItems' }` completes with no items marked completed in `itemsTouched`
- **THEN** the write-back hook returns an empty array
