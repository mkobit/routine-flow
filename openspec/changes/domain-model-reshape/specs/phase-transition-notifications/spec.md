## MODIFIED Requirements

### Requirement: Notification Policy Wiring

The system SHALL read and respect the notification policy configured for each phase in the active phase graph via a `PhaseId`-keyed mapping resolved at the integration layer, not via a field on the `Phase` domain type. A phase with no entry in that mapping SHALL be treated identically to a phase with `notification: null` today (no system notification, standard in-app Notice only).

#### Scenario: Per-phase notification policy is respected
- **WHEN** different phases in a routine have distinct entries in the notification mapping
- **THEN** the system applies the specific notification policy mapped to the newly active phase's id

#### Scenario: A phase with no mapping entry gets default (no system notification) behavior
- **WHEN** a phase transitions to a phase with no entry in the notification mapping
- **THEN** the in-app Notice toast still displays, and no system notification is emitted
