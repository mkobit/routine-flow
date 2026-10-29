# Spec Delta

## Purpose

Provides celebratory zero-state feedback and explicit stage advance controls for empty task queues in review routines.

## ADDED Requirements

### Requirement: Celebratory zero-state rendering for empty review queues
When a phase's task queue contains zero items, the queue panel SHALL render context-sensitive zero-state messaging and iconography.
For phases with `kind: 'review'`, the system SHALL render celebratory Inbox zero copy and iconography.

#### Scenario: Review phase with empty queue renders Inbox zero celebration
- **WHEN** a phase with `kind: 'review'` has zero queue items
- **THEN** the queue panel renders celebratory text `Inbox zero reached — nothing to review.` and icon `check-check`

#### Scenario: Non-review phase with prior completed items renders completion celebration
- **WHEN** a phase with prior completed items finishes its queue
- **THEN** the queue panel renders celebratory text `All tasks completed early — queue exhausted.` and icon `check-check`

### Requirement: Explicit Skip/Advance button on empty queues
When a phase's task queue is empty and an action executor dispatch handler is available, the queue panel SHALL render an explicit advance button.
Triggering this button SHALL dispatch `advance-phase` to bypass or advance past the empty stage.

#### Scenario: User clicks advance button on empty queue
- **WHEN** a user clicks the advance button rendered in an empty queue panel
- **THEN** the system dispatches an `advance-phase` action to advance to the next routine phase

### Requirement: Phase entry queue exhaustion evaluation
The engine SHALL evaluate task source exhaustion and `queueExhausted` transition conditions when entering a phase and when starting a phase.
When a phase's queue is empty and an outgoing transition is guarded by `queueExhausted`, the engine SHALL trigger the transition if the routine is running.

#### Scenario: Starting a phase with an empty queue advances immediately along queueExhausted transition
- **WHEN** a stopped phase starts and its queue has zero items with an outgoing `queueExhausted` transition
- **THEN** the engine immediately transitions along the `queueExhausted` edge to the next phase

#### Scenario: Transitioning into a running phase with an empty queue advances immediately
- **WHEN** a running routine advances into a phase whose queue has zero items with an outgoing `queueExhausted` transition
- **THEN** the engine evaluates the queue exhaustion and transitions immediately along the `queueExhausted` edge
