## Context

See `proposal.md` for motivation. Prior to this change, `completePhase` in `src/timer/reducer.ts` threw when reaching a phase with `completionPolicy: { kind: 'queueCycle' }` or `{ kind: 'futureDate' }`, and `parseRoutineFile` in `src/domain/routine/routine-file.ts` rejected them at load time. With `base-query-task-source` (flow-djx) and `manual-phase-finish-completion` (flow-gu1.24) landed, `activeFilePath` tracks the current task and `finish-phase` can trigger completion for duration-less phases.

## Goals / Non-Goals

**Goals:**
- Execute `queueCycle` and `futureDate` completion policies upon phase completion (`onComplete`).
- Derive policy mutations as a pure domain function, keeping `engineReducer` pure.
- Apply derived policy mutations in `EngineStore.dispatch` via `FileMutationPort`.
- Unblock routine files containing `queueCycle` and `futureDate` policies in `parseRoutineFile`.

**Non-Goals:**
- Redesigning `Hook` or `CompletionPolicy` union types.
- Modifying `FileMutationPort` interface (existing `queueReorder`, `queueStatusChange`, and `frontmatter` ports cover all required mutations).

## Decisions

### Decision 1: Auto-advance in `completePhase` for `queueCycle` and `futureDate`
`completePhase` in `src/timer/reducer.ts` will treat `queueCycle` and `futureDate` identically to `null`/`noOp` by returning `advancePhase(state, graph, predicateRegistry, now, 'completed')`.
*Rationale:* Completing a phase with queue cycling or future-dating advances to the next phase in the routine graph; side effects are handled via derived mutations during event dispatch.
*Alternatives considered:* Setting `status: 'completed'` like `manualClear` — rejected because queue cycling and spaced repetition move to the next item/phase automatically.

### Decision 2: Pure `deriveCompletionMutations` function
Implement `deriveCompletionMutations(phase: Phase, activeFilePath: string | null, now: Temporal.Instant): readonly FileMutation[]` in `src/timer/completion-policy-executor.ts`.
- `queueCycle`: returns `[{ kind: 'queueReorder', itemId: TaskQueueItemIdSchema.parse(activeFilePath), position: 'back' }]`.
- `futureDate`: returns `[{ kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse(activeFilePath), status: 'deferred' }, { kind: 'frontmatter', filePath: activeFilePath, property: 'routine-due', value: now.add(policy.after).toString() }]`.
- Returns `[]` if `activeFilePath` is `null` or policy is `null`/`noOp`/`manualClear`.
*Rationale:* Extends the `deriveHookEvents` pattern of keeping state reducers pure and effect-unaware while keeping side-effect derivation isolated and unit-testable.

### Decision 3: Execute policy mutations in `EngineStore.dispatch`
In `EngineStore.dispatch`, whenever `deriveHookEvents` produces `{ event: 'onComplete', phase }`, `deriveCompletionMutations` derives mutations using `prevState.activeFilePath` and `now`. If `port` is provided in `EngineDeps`, `applyMutations(port, completionMutations)` applies them.
*Rationale:* `EngineStore` already manages async side-effect application for hooks via `FileMutationPort`; routing completion mutations through the same channel maintains consistency.

### Decision 4: Remove `rejectUnimplementedPolicies` from routine parser
Remove `unimplementedPolicyKindOf` and `rejectUnimplementedPolicies` from `src/domain/routine/routine-file.ts`.
*Rationale:* The engine now executes `queueCycle` and `futureDate` policies, so rejecting them at routine load time is no longer needed.

## Risks / Trade-offs

- [No active item when queueCycle/futureDate completes] → `deriveCompletionMutations` returns `[]` when `activeFilePath` is `null`, resulting in a clean auto-advance without side-effects.
- [Obsidian FileMutationPort fails during mutation application] → `applyMutations` handles errors gracefully and returns an outcome structure, matching hook mutation behavior.
