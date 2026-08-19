## 1. Schema & Type Unification

- [ ] 1.1 Define `PhaseNodeSchema`, `TransitionEdgeSchema`, `EdgeGuardSchema`, and `HandlerSchema` in `src/domain/phase/` and `src/domain/handler/`.
- [ ] 1.2 Remove `CompletionPolicySchema` from `src/domain/policy/` and delete `src/domain/policy/completion-policy.ts`.
- [ ] 1.3 Update `PhaseGraphSchema` to use `PhaseNode` and `TransitionEdge` with `EdgeGuard`.

## 2. Terminal Node & Traversal Engine

- [ ] 2.1 Update `checkPhaseGraphIntegrity` to accept terminal nodes (nodes with zero outgoing edges) as valid graph structures.
- [ ] 2.2 Update `resolveNextPhaseId` to return `null` when no outgoing edge exists or no guard matches.
- [ ] 2.3 Update `engineReducer` (`completePhase` and `advancePhase`) to transition `EngineState.status` to `'ended'` when `resolveNextPhaseId` returns `null`.

## 3. Handler & Effect Execution Engine

- [ ] 3.1 Implement `Handler` runner for `preset` and `script` handler kinds in `src/timer/handler-executor.ts`.
- [ ] 3.2 Update lifecycle event dispatching in `src/timer/store.ts` to execute `readonly Handler[]` lists for `onEnter`, `onComplete`, `onSkip`, and `onExit`.

## 4. Routine Parser & Presets

- [ ] 4.1 Update `parseRoutineFile` in `src/domain/routine-file-format.ts` to parse the unified JSON schema.
- [ ] 4.2 Update `scaffoldExampleRoutine` in `src/onboarding/scaffold-example.ts` to use the unified `PhaseNode` and `Handler` shape.

## 5. Verification

- [ ] 5.1 Update unit tests for `PhaseGraph`, `engineReducer`, terminal node completion, and `Handler` execution.
- [ ] 5.2 Run `bun run typecheck`, `bun run lint`, `bun test`.
- [ ] 5.3 Run `bun run openspec:validate` to verify all OpenSpec change deltas.
