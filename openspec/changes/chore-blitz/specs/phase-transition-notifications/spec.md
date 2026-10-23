# Spec Delta

## ADDED Requirements

### Requirement: Early exit notification on queue exhaustion
When a phase transitions early due to a satisfied `queueExhausted` transition, the system SHALL display an in-app Notice toast informing the user that all tasks are finished early.
The timer view SHALL render visual feedback indicating successful queue exhaustion.

#### Scenario: Notice toast alerts user on early queue exhaustion exit
- **WHEN** a phase transitions early because the task queue is exhausted
- **THEN** the system displays an in-app Notice toast stating that the blitz completed early

#### Scenario: Visual state indicates successful queue exhaustion
- **WHEN** a blitz phase completes early upon queue exhaustion
- **THEN** the timer view renders visual completion feedback and transitions smoothly to the next phase
