# Tasks

## 1. Domain model and multi-item completion tracking (flow-xne.2)

- [x] 1.1 Update `ItemTouch` in `src/domain/session/session.ts` to include `status: 'viewed' | 'completed'` and `completedAt: Temporal.Instant | null`, and verify unit tests in `tests/session.test.ts` pass.
- [x] 1.2 Add pure action `record-item-completion` to `src/timer/reducer.ts` to update `itemsTouched` immutably, and verify unit tests in `tests/timer.test.ts` pass.
- [x] 1.3 Update `PhaseLogTargetSchema` in `src/domain/phase/phase.ts` to support `{ kind: 'completedItems' }`, and verify schema validation tests in `tests/phase-graph-integrity.test.ts` pass.
- [x] 1.4 Implement batch log target resolution and mutation derivation in `src/timer/write-back.ts`, and verify unit tests in `tests/write-back.test.ts` pass.

## 2. Early phase termination on queue exhaustion (flow-xne.1)

- [x] 2.1 Update `StampedEngineAction` in `src/timer/reducer.ts` and `stampNow` in `src/timer/store.ts` to attach `now: Temporal.Instant` to `set-queue-exhausted`, and verify types compile via `bun run typecheck`.
- [x] 2.2 Implement early phase termination in `engineReducer` on queue exhaustion when an outgoing transition is guarded by `{ kind: 'queueExhausted' }`, preserving normal countdown when absent, and verify unit tests in `tests/timer.test.ts` pass.
- [x] 2.3 Wire queue change evaluation in `EngineStore.syncQueueExhausted`, and verify integration tests in `tests/store.test.ts` pass.

## 3. Queue panel rapid interactions and completion counter (flow-xne.3)

- [x] 3.1 Add dynamic completed chore counter to queue panel header in `src/views/timer/queue-panel.ts`, and verify rendered counter matches completed items in tests.
- [x] 3.2 Implement immediate active task selection advancement upon `markDone` execution in `src/views/timer/queue-panel.ts`, and verify sequential rapid check-offs in tests.
- [x] 3.3 Add styling for completed chore counter badge in `styles.css`, and verify appearance in vault.

## 4. Visual exhaustion transition and early exit feedback (flow-xne.4)

- [x] 4.1 Emit in-app Notice toast on early exit due to queue exhaustion in `src/timer/store.ts`, and verify notification port receives alert in unit tests.
- [x] 4.2 Render visual celebratory and exhaustion indicators in timer view and progress dial in `src/views/timer-view.ts`, and verify visual transition state.

## 5. Example routine, vault generator, and documentation (flow-xne.5)

- [x] 5.1 Author `chore-blitz-routine.md` and seed chore notes in `routine-flow-example-vault/`, and verify routine file parses cleanly.
- [x] 5.2 Implement fast-check generator in `e2e/vault/generators/chore-blitz.ts`, and verify generator produces valid test vault files.
- [x] 5.3 Author Docusaurus guide in `docs/docs/examples/chore-blitz.md` with Mermaid routine diagram and JSON configuration, and verify `bun run docs:build` passes cleanly.

## 6. End-to-end integration and verification suite (flow-xne.6)

- [ ] 6.1 Create Playwright E2E specification in `e2e/chore-blitz.e2e.ts` verifying rapid check-offs, dynamic counter updates, and early phase advancement, and verify headless execution passes under `bun run test:e2e:headless`.
- [ ] 6.2 Execute full quality gates (`bun run typecheck`, `bun run lint`, `bun test`, `bun run docs:build`, and `bun x openspec validate chore-blitz`) to confirm complete verification.
