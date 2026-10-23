# Spec Delta

## ADDED Requirements

### Requirement: Rapid action transition and immediate active item advancement
When a `markDone` action is triggered for the active queue item, the system SHALL immediately advance active selection to the next candidate item in the queue.
The system SHALL display the next candidate item as active without waiting for file mutation I/O completion or layout shifts.

#### Scenario: Clicking markDone immediately advances selection to next candidate
- **WHEN** the user triggers Done on an active item and other candidates remain in the queue
- **THEN** the system immediately marks the next candidate as active and renders its action controls

#### Scenario: Rapid check-offs execute without user interface lag
- **WHEN** the user triggers Done repeatedly in rapid succession
- **THEN** each action advances sequentially to subsequent tasks without visual freeze or scroll jumps

### Requirement: Dynamic completed chore counter
The queue panel header SHALL display a dynamic counter of chores completed during the active phase instance.
The counter SHALL update immediately upon each completion action.

#### Scenario: Completed counter increments on markDone execution
- **WHEN** a task is marked done during an active phase run
- **THEN** the counter in the queue panel header increments immediately by one

#### Scenario: Fresh phase starts with zero completed count
- **WHEN** a new phase instance starts
- **THEN** the counter displays zero completed chores
