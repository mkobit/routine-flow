# base-view-routine-selection Specification

## Purpose
TBD - created by archiving change per-base-routine-selection. Update Purpose after archive.
## Requirements
### Requirement: A Base view selects its routine via a routineFile ViewOption
`RoutineTimerView.getViewOptions()` SHALL include a `routineFile` option of Obsidian Bases' `FileOption` kind, letting the view reference a vault routine file.

#### Scenario: Unset routineFile falls back to the built-in default
- **WHEN** a view's `routineFile` option is unset
- **THEN** the view SHALL use `DEFAULT_PHASE_GRAPH` as its routine

#### Scenario: Set routineFile is parsed and used
- **WHEN** a view's `routineFile` option references a valid routine file
- **THEN** starting that view SHALL load the parsed `PhaseGraph` rather than the built-in default

### Requirement: Starting a view's routine loads it into the single global engine
Clicking Start on a view SHALL load that view's resolved routine (parsed file or built-in default) into the plugin's single `EngineStore` via `setGraph`, immediately becoming the active routine. There SHALL be no separate promotion step.

#### Scenario: Starting with no routine currently running
- **WHEN** no session is currently running and the user clicks Start on a view
- **THEN** that view's routine SHALL be loaded and started immediately, without any confirmation prompt

### Requirement: Starting a different routine while one is running requires confirmation
If a session is already running under a routine different from the one being started, clicking Start SHALL prompt the user to confirm before replacing it. The running session's state SHALL only be reset if the user confirms.

#### Scenario: Confirming replaces the running routine
- **WHEN** a different routine is already running and the user clicks Start on a view, then confirms the replacement prompt
- **THEN** the running session SHALL be reset and the newly started routine SHALL become active

#### Scenario: Cancelling leaves the running routine untouched
- **WHEN** a different routine is already running and the user clicks Start on a view, then cancels the replacement prompt
- **THEN** the currently running session SHALL continue unaffected, and the newly clicked routine SHALL NOT be loaded

### Requirement: An invalid routine file renders an inline error instead of throwing
When a view's selected `routineFile` fails to parse (via `parseRoutineFile`), the view SHALL render an inline error state describing the failure, and SHALL NOT throw or crash the view.

#### Scenario: Malformed routine file shows an error in the view
- **WHEN** a view's `routineFile` points at a file that fails to parse
- **THEN** the view SHALL render the parse error's message inline instead of the normal timer panel

