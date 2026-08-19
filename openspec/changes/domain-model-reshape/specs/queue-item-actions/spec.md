## ADDED Requirements

### Requirement: Preset action derivation is shared between manual triggers and completion-policy auto-fire
The mutation-derivation logic used by "Preset Action Derivation" and "Custom Frontmatter Mutation Action Derivation" SHALL be the single implementation used both when a `QueueItemAction` is manually triggered (via `Action Execution via FileMutationPort`) and when a `QueueItemActionPayload` is auto-fired from a phase's `CompletionPolicy` (see `completion-policy-execution`'s "autoAdvance completion policies derive mutations from their QueueItemActionPayload list"). No second, separately-maintained derivation function SHALL exist for the completion-triggered case.

#### Scenario: Manual and completion-triggered queueCycle derive identically
- **WHEN** a `queueCycle` payload is derived for active item `"tasks/item-1.md"` once via a manually-triggered `QueueItemAction` and once via an `autoAdvance` `CompletionPolicy`
- **THEN** both derivations produce the same `{ kind: 'queueReorder', itemId: 'tasks/item-1.md', position: 'back' }` mutation, from the same underlying function

## MODIFIED Requirements

### Requirement: Preset Action Derivation
The system SHALL derive concrete `FileMutation`s from a `QueueItemActionPayload`, given a target item path, regardless of whether that payload comes from a manually-triggered `QueueItemAction` or an auto-fired `CompletionPolicy` action:
- A `queueCycle` preset SHALL derive a `queueReorder` mutation setting `position` to `'back'` for the target item.
- A `markDone` preset SHALL derive a `queueStatusChange` mutation setting `status` to `'done'` for the target item.
- A `deferDuration` preset SHALL derive a `queueStatusChange` mutation setting `status` to `'deferred'` and a `frontmatter` mutation setting `routine-due` to the target ISO instant string calculated from the current instant plus the duration.

#### Scenario: Deriving file mutations for markDone preset action
- **WHEN** `deriveActionMutations` is invoked with a `markDone` preset action and active item path `"tasks/item-1.md"`
- **THEN** the system returns `[{ kind: 'queueStatusChange', itemId: 'tasks/item-1.md', status: 'done' }]`

#### Scenario: Deriving file mutations for deferDuration preset action
- **WHEN** `deriveActionMutations` is invoked with a `deferDuration` preset action for `P1D` at instant `now` and active item path `"tasks/item-1.md"`
- **THEN** the system returns a `queueStatusChange` mutation to `'deferred'` and a `frontmatter` mutation setting `routine-due` to `now + P1D`
