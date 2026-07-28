## ADDED Requirements

### Requirement: Side panel mirrors shared engine state
The system SHALL provide a workspace-wide side panel view that subscribes to the shared `EngineStore` and renders the currently active phase's label, remaining time, and status, without holding any timer state of its own.

#### Scenario: Routine started from a Bases timer view appears in the panel
- **WHEN** a routine is started from a `RoutineTimerView` leaf while the side panel is open
- **THEN** the side panel updates to show that routine's active phase, remaining time, and status without requiring the user to interact with the panel

#### Scenario: Panel shows idle placeholder when nothing is active
- **WHEN** `EngineState.status` is `stopped`
- **THEN** the panel renders placeholder text indicating no routine is running, with no transport controls and no queue list

### Requirement: Side panel offers transport controls without routine selection
The system SHALL let the user pause, resume, mark done, and reset the globally active routine from the side panel, without offering any way to start a routine that isn't already active.

#### Scenario: Pause a running routine
- **WHEN** `EngineState.status` is `running` and the user clicks the panel's Pause control
- **THEN** the system dispatches a `pause` action

#### Scenario: Resume a paused or completed routine
- **WHEN** `EngineState.status` is `paused` or `completed` and the user clicks the panel's Resume control
- **THEN** the system dispatches a `resume` action

#### Scenario: Mark a duration-less phase done
- **WHEN** `EngineState.status` is `running` and `EngineState.remaining` is `null`
- **THEN** the panel shows a Done control that dispatches a `finish-phase` action when clicked

#### Scenario: Reset the active routine
- **WHEN** `EngineState.status` is `running`, `paused`, or `completed` and the user clicks the panel's Reset control
- **THEN** the system dispatches a `stop` action

#### Scenario: No start-from-scratch affordance
- **WHEN** `EngineState.status` is `stopped`
- **THEN** the panel offers no control that can start a routine, and no routine-selection UI

### Requirement: Side panel shows the active phase's queue
The system SHALL render the active phase's task queue in the side panel when the routine is not stopped, using the same active-item highlighting and click-to-select behavior as the Bases timer view's queue.

#### Scenario: Queue items are listed with the active item highlighted
- **WHEN** the active phase has a non-null `taskSourceId` and its queue is non-empty
- **THEN** the panel lists each queue item, marking the one matching `EngineState.activeFilePath` as active

#### Scenario: Selecting a queue item switches the active file
- **WHEN** the user clicks a queue item in the panel
- **THEN** the system dispatches a `start` action with that item's source path as `filePath`

#### Scenario: No queue rendered for a phase without a task source
- **WHEN** the active phase's `taskSourceId` is `null`
- **THEN** the panel renders no queue section

### Requirement: Side panel is discoverable via ribbon icon and command
The system SHALL let the user open or reveal the side panel via a ribbon icon and a command palette entry, both resolving to the same leaf if one already exists.

#### Scenario: Opening via ribbon icon when no leaf exists
- **WHEN** the user clicks the ribbon icon and no `routine-side-panel` leaf currently exists in the workspace
- **THEN** the system creates one in the right sidebar and reveals it

#### Scenario: Opening via command reuses an existing leaf
- **WHEN** the user runs the "Open routine panel" command and a `routine-side-panel` leaf already exists
- **THEN** the system reveals the existing leaf instead of creating a second one
