# Tasks

## 1. Domain model guidance support and stage progression derivation (flow-1t1.3)

- [x] 1.1 Add optional `guidance` string array schema and preprocessing to `PhaseNodeSchema` in `src/domain/phase/phase.ts` and `src/domain/routine/routine-file.ts`, and verify schema tests pass in `tests/phase-guidance.test.ts`.
- [x] 1.2 Implement pure `deriveStageProgress(graph: PhaseGraph, state: EngineState)` in `src/domain/phase/stage-progress.ts` computing completed, active, and upcoming statuses and progress fractions, and verify unit tests in `tests/stage-progress.test.ts` pass.

## 2. Stage progress and checklist guidance UI components (flow-1t1.3)

- [ ] 2.1 Implement `renderStageProgress` and `renderGuidanceChecklist` in `src/views/timer/stage-progress-panel.ts`, and verify DOM rendering tests in `tests/timer-view-decomposition.test.ts` pass.
- [ ] 2.2 Wire stage stepper and guidance checklist into `RoutineTimerView` in `src/views/timer-view.ts`, and verify view integration tests pass.
- [ ] 2.3 Wire stage stepper and guidance checklist into `RoutineSidePanelView` in `src/views/side-panel-view.ts`, and verify view integration tests pass.

## 3. Visual styling and quality verification (flow-1t1.3)

- [ ] 3.1 Add stage progress bar, stepper indicators, and checklist styles in `styles.css` using `DESIGN.md` CSS variables and state classes (`.is-active`, `.is-completed`, `.is-upcoming`, `.is-checked`), and verify styling in tests.
- [ ] 3.2 Run quality gates (`bun run typecheck`, `bun run lint`, `bun test`, `bun run build`, and `bun x openspec validate stage-progress-and-guidance`) and verify all pass.
