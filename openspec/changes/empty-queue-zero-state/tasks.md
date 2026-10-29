# Tasks

## 1. Engine transition evaluation on phase entry and start (flow-1t1.4)

- [ ] 1.1 Update `EngineStore` in `src/timer/store.ts` to synchronize `queueExhausted` state on phase transition and evaluate `queueExhausted` edge guards on phase entry and start.
- [ ] 1.2 Add unit and store tests in `tests/store.test.ts` verifying automatic transitions when starting or entering a phase whose queue is already empty.

## 2. Queue panel zero-state and advance action UI (flow-1t1.4)

- [ ] 2.1 Update `renderQueuePanel` in `src/views/timer/queue-panel.ts` to display celebratory Inbox zero messaging and icon for review phases.
- [ ] 2.2 Add explicit Skip/Advance button in `src/views/timer/queue-panel.ts` to advance or bypass empty review stages when queue length is zero.
- [ ] 2.3 Add unit tests in `tests/timer-view-decomposition.test.ts` verifying empty review zero-state rendering and advance button click dispatch.

## 3. Visual styling and quality verification (flow-1t1.4)

- [ ] 3.1 Add CSS styling in `styles.css` for empty queue celebratory state, icon container, and advance action button using `DESIGN.md` CSS variables.
- [ ] 3.2 Run quality gates (`bun run typecheck`, `bun run lint`, `bun test`, `bun run build`, and `bun x openspec validate empty-queue-zero-state`) in sandbox and verify all pass.
