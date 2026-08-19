## MODIFIED Requirements

### Requirement: Lifecycle events execute lists of Handler objects
When a phase lifecycle stage (`onEnter`, `onComplete`, `onSkip`, `onExit`) fires, the handler engine SHALL execute every `Handler` specified in `phase.handlers[stage]` in array order.

#### Scenario: Multiple handlers execute on phase entry
- **WHEN** a phase node with `handlers.onEnter` containing two `Handler` entries enters
- **THEN** both handlers SHALL execute sequentially in array order

#### Scenario: Preset and script handlers execute in unified engine
- **WHEN** a phase node's lifecycle event fires containing both `preset` and `script` handlers
- **THEN** the `preset` handler SHALL emit its corresponding `Effect` and the `script` handler SHALL execute its registered script
