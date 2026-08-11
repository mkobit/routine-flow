## Why

Users currently have a fixed, hardcoded set of completion policies and prompt options when interacting with active tasks. Declarative queue item actions allow routines and phases to define custom, one-click interactive action buttons (such as "Mark Done", "Defer 1 Day", or custom frontmatter property mutations) on queue items without requiring a full modal confirmation workflow.

## What Changes

- Define the `QueueItemAction` domain concept representing a declarative, one-click interactive action that maps to one or more `FileMutation`s targeting a queue item.
- Support declaring `actions` on `Phase` definitions or task queue item contexts.
- Define standard action presets (`queueCycle`, `markDone`, `deferDuration`, `setFrontmatter`) and custom `FileMutation` action mappings.
- Provide domain derivation functions for mapping an action trigger on a target item path to concrete `FileMutation`s for immediate application via `FileMutationPort`.

## Capabilities

### New Capabilities
- `queue-item-actions`: Declarative one-click interactive action definitions and derivation rules for queue items.

### Modified Capabilities
*(None)*

## Impact

- `src/domain/action/`: New domain module for action schemas, presets, and mutation derivation.
- `src/domain/phase/`: Addition of optional `actions` field to `PhaseSchema`.
- `src/domain/routine/`: Support parsing `actions` array in routine configuration files.
- `src/timer/`: Execution / dispatch integration for trigger action handlers against `FileMutationPort`.
- `src/views/`: Timer panel UI components rendering interactive action buttons for the active queue item.
