# Spec Delta

## Purpose

Enables multi-phase routine visualization through a stage progress stepper, progress bar, and interactive checklist guidance.

## ADDED Requirements

### Requirement: Stage progression derivation from routine graph DAG
The system SHALL provide a pure function `deriveStageProgress(graph: PhaseGraph, state: EngineState)` that derives an ordered sequence of stages.
Each stage in the sequence SHALL indicate its phase identifier, label, and progression status: `completed`, `active`, or `upcoming`.

#### Scenario: Derives stage statuses during routine execution
- **WHEN** a routine with multiple phases is executing at an intermediate phase
- **THEN** visited phases are marked `completed`, the current phase is marked `active`, and unvisited remaining phases are marked `upcoming`

#### Scenario: Single-phase routines evaluate gracefully
- **WHEN** a routine contains only a single phase
- **THEN** the stage sequence contains exactly one stage reflecting the active state

### Requirement: Stage stepper and progress bar rendering in timer views
`RoutineTimerView` and `RoutineSidePanelView` SHALL render a stage stepper and linear progress bar when the active routine defines multiple phases.
The stepper SHALL visually differentiate completed, active, and upcoming steps using CSS classes `.is-completed`, `.is-active`, and `.is-upcoming`.

#### Scenario: Stage stepper displays multi-phase routine progression
- **WHEN** a multi-phase routine is active in the timer view
- **THEN** the stage stepper renders all stages in sequence with their corresponding status classes

#### Scenario: Progress bar reflects completed stage fraction
- **WHEN** stages are marked completed
- **THEN** the progress bar fill width reflects the proportional completion percentage across the stage sequence

### Requirement: Interactive checklist guidance rendering
`RoutineTimerView` and `RoutineSidePanelView` SHALL render an interactive guidance checklist when the current phase defines guidance items.
Each checklist item SHALL contain a toggleable checkbox allowing users to check off instructions during phase execution.

#### Scenario: Phase with guidance renders interactive checklist
- **WHEN** the active phase contains guidance items
- **THEN** each item renders with an interactive checkbox and label text

#### Scenario: Phase without guidance omits checklist
- **WHEN** the active phase does not define guidance items
- **THEN** the guidance checklist container is not rendered
