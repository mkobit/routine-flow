# Proposal

## Why

Users who execute multi-phase review routines need visual awareness of current stage position and checklist guidance.
Current timer views display only the active countdown and immediate next phase, without displaying routine progress or phase-specific checklist instructions.

## What changes

- Add optional `guidance` checklist items to `PhaseNode` schema and parser.
- Add pure `deriveStageProgress` helper to compute completed, active, and upcoming stages from `PhaseGraph` and `EngineState`.
- Add a stage progress stepper component displaying phase progression and progress bar.
- Add an interactive checklist guidance component in `RoutineTimerView` and `RoutineSidePanelView`.
- Add CSS styling using `DESIGN.md` CSS variables and state classes (`.is-active`, `.is-completed`, `.is-upcoming`).

## Capabilities

### New capabilities

- `stage-progress-and-guidance`: Render multi-stage progression and interactive checklist guidance in timer views.

### Modified capabilities

- `routine-file-format`: Support optional checklist guidance items in phase definitions.

## Impact

- `src/domain/phase/phase.ts`: Add optional `guidance` field to `PhaseNodeSchema`.
- `src/domain/routine/routine-file.ts`: Pass through `guidance` and `checklist` fields during parsing.
- `src/domain/phase/stage-progress.ts`: Add pure `deriveStageProgress` stage resolution.
- `src/views/timer/stage-progress-panel.ts`: Create stage stepper and guidance checklist components.
- `src/views/timer-view.ts`: Render stage stepper and guidance checklist in timer view.
- `src/views/side-panel-view.ts`: Render stage stepper and guidance checklist in side panel view.
- `styles.css`: Add styles for stage progress bar, stepper steps, and checklist items.
- `tests/stage-progress.test.ts`: Test stage sequence and status derivation.
- `tests/timer-view-decomposition.test.ts`: Test component DOM rendering.
