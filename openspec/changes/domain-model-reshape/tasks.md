## 1. Collapse CompletionPolicy into manualClear + autoAdvance

- [ ] 1.1 Update `CompletionPolicySchema` (`src/domain/policy/completion-policy.ts`) to `{ kind: 'manualClear' } | { kind: 'autoAdvance', actions: readonly QueueItemActionPayload[] } | null`, removing `queueCycle`, `futureDate`, and `noOp`.
- [ ] 1.2 Extract `derive-action-mutations.ts`'s per-payload derivation (`queueCycle`/`markDone`/`deferDuration`/`setFrontmatter`) into a function taking a target item path directly, callable from both the manual-trigger path and completion-policy auto-fire.
- [ ] 1.3 Update `src/timer/completion-policy-executor.ts`'s `deriveCompletionMutations` to iterate `completionPolicy.actions` through the shared derivation function from 1.2, replacing the old `queueCycle`/`futureDate` branches.
- [ ] 1.4 Update `src/timer/reducer.ts`'s `completePhase` to treat `null` and `{ kind: 'autoAdvance', ... }` identically (today's `null`/`noOp` branch), and keep `manualClear`'s halt behavior unchanged.
- [ ] 1.5 Delete `derive-action-mutations.ts` if nothing besides the shared function from 1.2 remains, or update it to re-export the shared function — avoid two derivation entry points existing side by side.

## 2. Remove LogTargetResolverRegistry and the callback log target

- [ ] 2.1 Update `PhaseLogTargetSchema` (`src/domain/phase/phase.ts`) to only accept `{ kind: 'activeItem' }`.
- [ ] 2.2 Delete `src/domain/log-target/log-target-resolver.ts`.
- [ ] 2.3 Update `src/timer/write-back.ts` — remove `LogTargetResolverRegistry` from `WriteBackHookDeps` and `resolveTargetFilePath`'s callback branch; it always resolves to `activeFilePath`.
- [ ] 2.4 Update `src/main.ts` — remove `logTargetResolverRegistry` wiring.

## 3. Remove LogEntry.recordedAt

- [ ] 3.1 Update `LogEntrySchema`/`nextLogEntry` (`src/domain/mutation/log-entry.ts`) to drop `recordedAt`.
- [ ] 3.2 Update `src/timer/write-back.ts`'s call site to stop passing `Temporal.Now.instant()` into `nextLogEntry`.

## 4. Move NotificationPolicy off Phase

- [ ] 4.1 Remove `notification: NotificationPolicySchema.nullable()` from `PhaseSchema` (`src/domain/phase/phase.ts`).
- [ ] 4.2 Define a `PhaseId`-keyed notification mapping at the integration layer — coordinate placement with `flow-ej1`'s `cssClass` mechanism (design.md Open Question: exact shape/location deliberately not finalized here to avoid designing the same "presentation-by-phase-id" pattern twice independently). If `flow-ej1` lands first, reuse its mechanism directly; if this change lands first, keep the mapping isolated enough that `flow-ej1` can fold `cssClass` into the same place without a second migration.
- [ ] 4.3 Update `src/timer/store.ts`'s notification-firing logic (`runDispatch`'s `notificationPort` block) to resolve the entering phase's `PhaseId` against the mapping from 4.2 instead of reading `newPhase.notification`.
- [ ] 4.4 Update `src/onboarding/scaffold-example.ts` and any other shipped routine content that set `phase.notification` inline.

## 5. Formalize TaskQueueItemId's identity with sourcePath

- [ ] 5.1 Update `TaskQueueItemId`'s doc comment (`src/domain/queue/task-source.ts`) to state it's the item's vault file path, matching `base-query-task-source`'s existing shipped requirement, removing the "independent of where it was sourced from" claim.

## 6. Migrate shipped routine content

- [ ] 6.1 Update `src/onboarding/scaffold-example.ts`'s `POMODORO_ROUTINE_CONTENT` — no `completionPolicy.queueCycle`/`futureDate` or `logTarget.kind: 'callback'` usage exists there today, but re-verify against the new schema and update if any phase needs an explicit `autoAdvance` action list.
- [ ] 6.2 Grep the repo (tests, docs, `openspec/specs/`) for any other routine JSON using the removed `CompletionPolicy` variants or `logTarget.kind: 'callback'`, and migrate per the spec deltas' Migration notes.

## 7. Bundled routine presets

- [ ] 7.1 Design (separately from this reshape's schema work, but tracked here since `routine-file-format`'s spec delta requires it) at least one additional bundled preset beyond Pomodoro, reusing `scaffoldExampleRoutine`'s file-creation pattern.
- [ ] 7.2 Extend the scaffold command/entry point to offer a choice of preset rather than only the single hardcoded Pomodoro example.

## 8. Verification

- [ ] 8.1 Update/add unit tests for the collapsed `CompletionPolicy` shape, the shared action-derivation function, and the removed `LogTargetResolverRegistry`/`recordedAt`/`Phase.notification` fields.
- [ ] 8.2 Run `bun run typecheck`, `bun run lint`, `bun test` — all schema/type changes are breaking by design (see proposal.md), so expect and fix every call site the type checker surfaces rather than suppressing.
- [ ] 8.3 Run `bun x openspec validate --all` to confirm every modified spec's deltas are well-formed before this change is archived.
- [ ] 8.4 Update flow-616/flow-6fd beads once implementation lands — this change is what those beads were blocked on drafting, not necessarily on shipping; confirm with Mike whether flow-616 closes at proposal-acceptance or only after this implementation merges.

## 9. Follow-up (not part of this change)

- [ ] 9.1 `flow-16c` — sanity-check review pass on `design.md`'s "Distilled direction" section (Graph+Handler+Effect), then draft the follow-up openspec change with real spec deltas for the unification, terminal-node support, and the node's `onCompletion` gate field.
- [ ] 9.2 `flow-jw3` — expand the example vault with the exercise/morning-routine presets used as worked examples, once the shape they'd be authored against (this change's, or the follow-up unification's) is settled.
