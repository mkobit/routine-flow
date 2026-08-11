## Why

`completePhase` in `src/timer/reducer.ts` throws when reaching a phase configured with `completionPolicy: { kind: 'queueCycle' }` or `{ kind: 'futureDate' }`, and `parseRoutineFile` in `src/domain/routine/routine-file.ts` rejects them at load time. Now that `base-query-task-source` (flow-djx) and `manual-phase-finish-completion` (flow-gu1.24) have landed, the active queue item (`activeFilePath`) is tracked and `finish-phase` exists to complete duration-less phases. We need to implement real `queueCycle` and `futureDate` completion policy execution to support spaced repetition and cycling task queues.

## What Changes

- Update `completePhase` in `src/timer/reducer.ts` to auto-advance phases configured with `queueCycle` and `futureDate` completion policies (matching `noOp`/`null` advance semantics) instead of throwing.
- Implement `deriveCompletionMutations` to produce `FileMutation`s when a phase with a `queueCycle` or `futureDate` policy completes (`onComplete`):
  - `queueCycle`: emits `{ kind: 'queueReorder', itemId, position: 'back' }` for the active task item.
  - `futureDate`: emits `{ kind: 'queueStatusChange', itemId, status: 'deferred' }` and `{ kind: 'frontmatter', filePath: activeFilePath, property: 'routine-due', value: dueIsoString }` (where `dueIsoString` is `now.add(policy.after).toString()`).
- Apply derived completion mutations in `EngineStore.dispatch` when `onComplete` fires.
- Remove load-time rejection of `queueCycle` and `futureDate` in `src/domain/routine/routine-file.ts` (`unimplementedPolicyKindOf` / `rejectUnimplementedPolicies`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `completion-policy-execution`: Update `completion-policy-execution` to require `queueCycle` and `futureDate` policies to auto-advance and emit completion mutations rather than throwing.
- `routine-file-format`: Update `routine-file-format` to allow `queueCycle` and `futureDate` completion policies during routine parsing.

## Impact

- `src/timer/reducer.ts`: `completePhase` auto-advances `queueCycle` and `futureDate` phases.
- `src/timer/completion-policy-executor.ts` (or `src/timer/reducer.ts`): `deriveCompletionMutations` function for deriving policy mutations.
- `src/timer/store.ts`: `EngineStore.dispatch` applies derived completion mutations on `onComplete`.
- `src/domain/routine/routine-file.ts`: Removes load-time rejection of `queueCycle` / `futureDate`.
- `tests/timer.test.ts` & `tests/routine-file.test.ts`: Updates unit tests to assert execution and parsing rather than throwing/rejection.
