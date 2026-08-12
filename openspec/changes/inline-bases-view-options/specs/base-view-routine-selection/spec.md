## ADDED Requirements

### Requirement: Inline configuration UI in the timer panel updates view options programmatically
The timer panel view SHALL render an inline configuration toggle and panel allowing users to inspect and programmatically update view options (`routineFile`, `focusProperty`, `focusValue`, `breakProperty`, `breakValue`) without opening Bases' native toolbar menu.

#### Scenario: Toggling inline configuration panel
- **WHEN** the user clicks the inline configuration toggle (gear icon) in the timer panel
- **THEN** the view SHALL toggle visibility of the inline configuration panel containing controls for routine file selection and queue filters

#### Scenario: Programmatically updating routine file from inline control
- **WHEN** the user selects a different routine file in the inline routine file control
- **THEN** the view SHALL update its `routineFile` view option via `BasesViewConfig.set` and immediately reload the selected routine

#### Scenario: Programmatically updating queue filters from inline controls
- **WHEN** the user updates focus or break property/value fields in the inline configuration panel
- **THEN** the view SHALL update the corresponding view option (`focusProperty`, `focusValue`, `breakProperty`, `breakValue`) via `BasesViewConfig.set` and immediately re-filter the task queue
