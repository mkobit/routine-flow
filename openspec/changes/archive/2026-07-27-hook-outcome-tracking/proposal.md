## Why

`PhaseInstance.mutationsApplied` (`src/domain/session/session.ts`) has been on the type since flow-c08 landed real `Session`/`PhaseInstance` history tracking, but nothing populates it — `openPhaseInstance` initializes it to `[]` and it stays that way forever. flow-c08's own design.md (Decision 7) cut this deliberately, flagging four unresolved questions: reentrancy (a hook can settle after its target instance has moved into `history` or `session` has gone `null`), append-not-replace (`onComplete` and `onExit` both fire for the same closing instance and must not clobber each other's outcome), sealing (does a closed `history` entry keep mutating after close, visibly to subscribers?), and failure modeling (`PhaseInstance` has no field for a hook that threw or whose mutations failed to apply). flow-dez has since landed `EngineStore.dispatch` serialization, which removes the cross-dispatch race that made "reentrancy" look scarier than it now is — this change resolves the remaining three questions and implements the feature.

## What Changes

- `EngineStore.dispatch`'s hook-invocation loop (`src/timer/store.ts`) folds each hook's `HookInvocationOutcome` back onto the `PhaseInstance` (current or already-closed) that fired it, immediately after that hook settles — via a new store-internal-only `record-hook-outcome` reducer action, mirroring the existing `record-item-touch`/`set-queue-exhausted` "store resolves state, reducer folds it in" pattern. **BREAKING**: `PhaseInstance` gains a `hookFailures` field.
- `HookInvocationOutcome`'s `'applied'` stage (`src/domain/hook/hook.ts`, moved from `src/timer/store.ts`) gains a `mutations: readonly FileMutation[]` field — the hook's raw returned intents — since `ApplyMutationsResult`'s `{success: true}` case carries no mutations of its own, and folding real data onto `mutationsApplied` needs to know what was attempted, not just whether the whole batch succeeded. **BREAKING**: `HookInvocationOutcome`'s `'applied'` variant shape changes.
- `ApplyMutationsResult`'s failure case (`src/domain/mutation/apply-mutations.ts`) gains `appliedCount: number`, so the successfully-applied prefix of a hook's mutations can be computed positionally rather than by searching for the failing mutation's object reference (which silently mis-attributes results if a hook ever returns the same `FileMutation` object twice). **BREAKING**: `ApplyMutationsResult`'s failure variant shape changes.
- `HookEvent` moves from `src/domain/hook/hook.ts` to `src/domain/hook/hook-reference.ts` (re-exported from `hook.ts` for existing importers), so `PhaseInstanceHookFailure` (which names the firing `HookEvent`) can live in `session.ts` without introducing a `session.ts` ↔ `hook.ts` type-only import cycle.
- `PhaseInstance.mutationsApplied` accumulates only the mutations that actually wrote (the successful prefix, up to but excluding a batch's first failure) across every hook event fired for that instance, in firing order.
- `PhaseInstance` gains `hookFailures: readonly PhaseInstanceHookFailure[]`, recording each hook invocation that threw/rejected (`invocationFailed`) or whose `FileMutation` batch stopped partway through (`mutationFailed`, naming the mutation and cause), keyed by which event (`onEnter`/`onComplete`/`onSkip`/`onExit`) produced it.
- The fold is a no-op when its target `phaseInstanceId` is no longer resolvable in `EngineState` (e.g. an intervening `stop` reset the session before the hook settled) — same "unresolved state ⇒ no-op" precedent as `syncQueueExhausted`/`syncItemTouch`.

## Capabilities

### Modified Capabilities
- `session-history-tracking`: `PhaseInstance.mutationsApplied` goes from permanently-empty to real, accumulated data; `PhaseInstance` gains `hookFailures`.
- `hook-execution`: adds a requirement that `EngineStore` folds each fired event's hook outcome onto its `PhaseInstance` after invocation, accumulating rather than replacing, and no-ops when the target instance is no longer resolvable.

## Impact

- `src/domain/hook/hook-reference.ts`: gains `HookEvent` (moved from `hook.ts`).
- `src/domain/hook/hook.ts`: re-exports `HookEvent`; gains `HookInvocationOutcome` (moved from `src/timer/store.ts`), widened with `mutations`.
- `src/domain/mutation/apply-mutations.ts`: `ApplyMutationsResult`'s failure case gains `appliedCount`; `applyMutations`'s internal recursion threads a count.
- `src/domain/session/session.ts`: `PhaseInstance` gains `hookFailures`, typed with a new `PhaseInstanceHookFailure`; `openPhaseInstance` initializes it to `[]`; doc comments on `mutationsApplied`/`hookFailures` describe the accumulation.
- `src/timer/reducer.ts`: new `record-hook-outcome` `EngineAction`/`StampedEngineAction` variant, `engineReducer` switch case, and a pure `recordHookOutcome` fold function that checks `currentInstance` then `history` (not an event-type branch — see design.md Decision 3's `manualClear`-`onComplete` case).
- `src/timer/store.ts`: `invokeHook` returns the widened `HookInvocationOutcome`; `runDispatch`'s hook loop dispatches `record-hook-outcome` after each `invokeHook` settles; `HookInvocationOutcome`'s definition moves out, re-imported from `../domain/hook/hook`.
- `tests/store.test.ts`: two existing assertions on `{ stage: 'applied', result: {...} }` need a `mutations: [...]` field added; new tests for accumulation/no-op/failure-recording/`manualClear`-`onComplete`-targets-currentInstance behavior.
- `tests/write-back.test.ts`: one `PhaseInstance` literal needs a `hookFailures: []` field added.
