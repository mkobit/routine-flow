# phase-transition-notifications Specification

## Purpose
Provides in-app Notice toasts and system (OS-level) notifications to inform users of routine phase transitions across active and background states.
## Requirements
### Requirement: In-App Notice on Phase Transition

The system SHALL display an in-app Obsidian Notice toast whenever a phase transition occurs in an active routine session.

#### Scenario: Phase transition displays Notice
- **WHEN** a routine phase transitions from one phase to another
- **THEN** an Obsidian Notice toast is displayed with the name and status of the new phase without legacy hardcoded prefixes

### Requirement: System Notification on Phase Transition

The system SHALL emit a native OS system notification on phase transitions when `systemNotification` is enabled in the current phase's notification policy.

#### Scenario: Phase transition displays system notification when enabled
- **WHEN** a phase transitions and the phase's notification policy has `systemNotification` set to true
- **THEN** a native OS notification is emitted using the system notification API

#### Scenario: Phase transition suppresses system notification when disabled
- **WHEN** a phase transitions and the phase's notification policy has `systemNotification` set to false or null
- **THEN** no native OS notification is emitted

### Requirement: Notification Policy Wiring

The system SHALL read and respect the `Phase.notification` (`NotificationPolicy`) configuration attached to each phase in the active phase graph.

#### Scenario: Per-phase notification policy is respected
- **WHEN** different phases in a routine specify distinct notification policies
- **THEN** the system applies the specific notification policy defined on the newly active phase

