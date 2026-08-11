## Purpose

Provides a declarative schema and derivation mechanism for interactive actions on queue items, mapping user button triggers directly to executable file mutations.

## ADDED Requirements

### Requirement: Declarative Queue Item Action Definition
The system SHALL support defining declarative interactive actions (`QueueItemAction`) for queue items with an action identifier (`id`), human-readable label (`label`), optional visual style (`style`), and action payload specification (`payload`).

#### Scenario: Queue item action defined with label and payload
- **WHEN** a `QueueItemAction` object with `id: "mark-done"`, `label: "Done"`, `style: "primary"`, and a `markDone` payload is constructed
- **THEN** it validates against `QueueItemActionSchema` and exposes all specified properties

### Requirement: Preset Action Derivation
The system SHALL derive concrete `FileMutation`s when a preset action is executed against an active queue item path:
- A `queueCycle` preset SHALL derive a `queueReorder` mutation setting `position` to `'back'` for the active item.
- A `markDone` preset SHALL derive a `queueStatusChange` mutation setting `status` to `'done'` for the active item.
- A `deferDuration` preset SHALL derive a `queueStatusChange` mutation setting `status` to `'deferred'` and a `frontmatter` mutation setting `routine-due` to the target ISO instant string calculated from the current instant plus the duration.

#### Scenario: Deriving file mutations for markDone preset action
- **WHEN** `deriveActionMutations` is invoked with a `markDone` preset action and active item path `"tasks/item-1.md"`
- **THEN** the system returns `[{ kind: 'queueStatusChange', itemId: 'tasks/item-1.md', status: 'done' }]`

#### Scenario: Deriving file mutations for deferDuration preset action
- **WHEN** `deriveActionMutations` is invoked with a `deferDuration` preset action for `P1D` at instant `now` and active item path `"tasks/item-1.md"`
- **THEN** the system returns a `queueStatusChange` mutation to `'deferred'` and a `frontmatter` mutation setting `routine-due` to `now + P1D`

### Requirement: Custom Frontmatter Mutation Action Derivation
The system SHALL support custom actions (`setFrontmatter`) that specify a frontmatter property name and target value, deriving a `{ kind: 'frontmatter', filePath, property, value }` `FileMutation` when executed against an active item path.

#### Scenario: Deriving file mutations for custom setFrontmatter action
- **WHEN** `deriveActionMutations` is invoked with a `setFrontmatter` action targeting property `"priority"` with value `1` and active item path `"tasks/item-1.md"`
- **THEN** the system returns `[{ kind: 'frontmatter', filePath: 'tasks/item-1.md', property: 'priority', value: 1 }]`

### Requirement: Action Execution via FileMutationPort
When a queue item action is triggered, the system SHALL derive its `FileMutation`s and apply them directly via `FileMutationPort.applyMutations`.

#### Scenario: Triggering an action applies mutations to vault
- **WHEN** a user triggers a valid queue item action for active item `"tasks/item-1.md"`
- **THEN** derived mutations are dispatched to `FileMutationPort`, writing the vault changes without launching a confirmation modal

### Requirement: Phase Actions Parsing and Schema Validation
The `Phase` domain model and routine file parser SHALL support an optional `actions` list containing `QueueItemAction` definitions, validating them during routine file parsing.

#### Scenario: Parsing a phase with custom actions
- **WHEN** a routine definition containing a phase with an `actions` array of `QueueItemAction` objects is parsed
- **THEN** the parsed `Phase` object contains the validated `actions` array
