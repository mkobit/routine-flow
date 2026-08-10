## 1. Reducer tests (write first, red)

- [x] 1.1 In `tests/timer.test.ts`, add `engineReducer` cases for `{ type: 'finish-phase' }`: `manualClear` policy halts at `status: 'completed'` with `currentPhaseId`/`remaining` unchanged (mirroring the existing zero-remaining `tick` test); `null`/`noOp` policy auto-advances to the graph-resolved next phase; `queueCycle`/`futureDate` policy throws — same three shapes as the existing zero-remaining `tick` tests, dispatched via `finish-phase` instead
- [x] 1.2 Add a case confirming `finish-phase` also completes a phase whose `remaining` is non-null (a timed phase) — it is not gated on duration-less state

## 2. Reducer implementation (green)

- [x] 2.1 Add `{ type: 'finish-phase' }` to the `EngineAction` union in `src/timer/reducer.ts`
- [x] 2.2 Add an `engineReducer` case for `'finish-phase'` that calls `completePhase(state, graph, predicateRegistry)`, the same function the zero-remaining branch of `'tick'` calls
- [x] 2.3 Run `bun test ./tests/timer.test.ts`, confirm the 1.1/1.2 cases pass

## 3. Hook-derivation tests (write first, red)

- [x] 3.1 In `tests/hook-execution.test.ts`, add `EngineStore` dispatch cases for `finish-phase`: `manualClear` halt fires `onComplete` only (mirroring the existing "manualClear halt fires onComplete only" tick test); `null`-policy fires `onComplete`, then `onExit`, then `onEnter` (mirroring the existing "null-policy auto-advance" tick test)

## 4. Hook-derivation implementation (green)

- [x] 4.1 In `deriveHookEvents` (`src/timer/reducer.ts`), change the `tick` branch's condition to `action.type === 'tick' || action.type === 'finish-phase'` so both actions share the existing status/phaseId-diff derivation logic; add a one-line comment noting the branch now covers two actions with identical transition shapes
- [x] 4.2 Run `bun test ./tests/hook-execution.test.ts`, confirm the 3.1 cases pass and no existing case regresses

## 5. Timer view UI

- [x] 5.1 In `src/views/timer-view.ts`'s `render`, replace `if (!phase || state.remaining === null) { return }` with `if (!phase) { return }`, and make the timer-panel header duration-aware: `${phase.label}: ${mm}:${ss} (${status})` when `state.remaining` is non-null, `${phase.label} (${status})` when it is `null`
- [x] 5.2 Add a "Done" button to the controls panel, shown when `isViewRoutineActive && state.status === 'running' && state.remaining === null`, dispatching `{ type: 'finish-phase' }` — placed alongside the existing Pause/Start/Reset controls, gated the same way the Pause button is gated on `status === 'running'`

## 6. Spec sync

- [x] 6.1 Confirm `openspec/changes/manual-phase-finish-completion/specs/hook-execution/spec.md` and `specs/completion-policy-execution/spec.md` match the implemented behavior (no changes expected, but verify scenario wording against the actual test assertions from steps 1/3)
- [x] 6.2 `bunx openspec validate manual-phase-finish-completion --strict`

## 7. Manual verification

- [x] 7.1 Added `routines/workout-routine.md` (mirrors `docs/examples/workout.md`, short durations) plus a "Workout" view entry in `Tasks.base`, and a permanent e2e test (`e2e/timer.e2e.ts`) driving it via `bunx playwright test`/`xvfb-run` — confirmed live in real Obsidian that the duration-less "Set" phase renders (`Set (running)`, not blank) with a "Done" button, and clicking it advances to "Rest" per its `null` completionPolicy

## 8. Quality gates

- [x] 8.1 `bun test ./tests` passes
- [x] 8.2 `bun run typecheck` passes
- [x] 8.3 `bun run lint` passes
- [x] 8.4 Close flow-gu1.24 in beads, referencing this change
