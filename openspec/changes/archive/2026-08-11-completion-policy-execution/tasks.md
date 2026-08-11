## 1. Domain and Reducer Implementation

- [x] 1.1 Implement `deriveCompletionMutations` in `src/timer/completion-policy-executor.ts` (pure function for deriving `FileMutation`s for `queueCycle` and `futureDate` completion policies)
- [x] 1.2 Update `completePhase` in `src/timer/reducer.ts` to auto-advance `queueCycle` and `futureDate` phases rather than throwing
- [x] 1.3 Remove `unimplementedPolicyKindOf` and `rejectUnimplementedPolicies` from `src/domain/routine/routine-file.ts`

## 2. EngineStore Integration

- [x] 2.1 Integrate `deriveCompletionMutations` into `EngineStore.dispatch` in `src/timer/store.ts` to apply derived policy mutations when `onComplete` fires

## 3. Testing and Quality Gates

- [x] 3.1 Add unit tests for `deriveCompletionMutations` in `tests/completion-policy-executor.test.ts`
- [x] 3.2 Update `tests/timer.test.ts` to assert `queueCycle` and `futureDate` auto-advance on `tick` / `finish-phase`
- [x] 3.3 Update `tests/routine-file.test.ts` to assert `queueCycle` and `futureDate` policies parse successfully
- [x] 3.4 Verify all quality gates (`bun run lint`, `bun test`, `bun run typecheck`, `bun run build`)
