## 1. Domain type changes

- [x] 1.1 Move `HookEvent` from `src/domain/hook/hook.ts` to `src/domain/hook/hook-reference.ts`; re-export it from `hook.ts` so existing importers are unaffected (design.md Decision 1 — avoids a `session.ts` ↔ `hook.ts` cycle from task 1.2).
- [x] 1.2 Move `HookInvocationOutcome` from `src/timer/store.ts` to `src/domain/hook/hook.ts`; widen its `'applied'` stage with `mutations: readonly FileMutation[]`.
- [x] 1.3 Widen `ApplyMutationsResult`'s failure case (`src/domain/mutation/apply-mutations.ts`) with `appliedCount: number`; thread a count through `applyMutations`'s recursion (design.md Decision 6 — positional, not reference/`indexOf`-based, so a hook returning the same `FileMutation` object twice can't mis-attribute results).
- [x] 1.4 Add `PhaseInstanceHookFailure` (discriminated on `kind: 'invocationFailed' | 'mutationFailed'`, both carrying `event: HookEvent` imported from `hook-reference.ts`) to `src/domain/session/session.ts`.
- [x] 1.5 Add `hookFailures: readonly PhaseInstanceHookFailure[]` to `PhaseInstance`; update `openPhaseInstance` to initialize it to `[]`; update `mutationsApplied`'s doc comment to describe real accumulation instead of "always empty."

## 2. engineReducer: fold hook outcomes

- [x] 2.1 Add `record-hook-outcome` to `EngineAction`/`StampedEngineAction` (`phaseInstanceId`, `event`, `outcome`), passed through unchanged by `stampNow` (no `now` needed).
- [x] 2.2 Implement `recordHookOutcome(state, phaseInstanceId, event, outcome)`: derive the applied-mutations prefix (`outcome.mutations.slice(0, outcome.result.appliedCount)` on failure, all of `outcome.mutations` on success) and optional `PhaseInstanceHookFailure` from `outcome`; look up the target instance in `session.currentInstance` then `session.history`, checking both unconditionally rather than branching on `event` (design.md Decision 3 — a `manualClear`-policy phase's `onComplete` targets `currentInstance`, not `history`); no-op if neither matches or if the resulting delta is empty; otherwise append (never replace) onto the matched instance's `mutationsApplied`/`hookFailures`.
- [x] 2.3 Wire `record-hook-outcome` into `engineReducer`'s switch.

## 3. EngineStore: fold after each hook settles

- [x] 3.1 Update `invokeHook` to return the widened `HookInvocationOutcome` (include `mutations` in the `'applied'` case).
- [x] 3.2 In `runDispatch`'s hook-firing loop, after each `invokeHook` call settles, dispatch `record-hook-outcome` through `engineReducer` and `applyState` the result, before moving to the next fired event.
- [x] 3.3 Update `store.ts`'s import of `HookInvocationOutcome` to come from `../domain/hook/hook` instead of a local definition.

## 4. Tests

- [x] 4.1 Update `tests/store.test.ts`'s two existing `{ stage: 'applied', result: {...} }` assertions to include `mutations: [...]`.
- [x] 4.2 Add `hookFailures: []` to the `PhaseInstance` literal in `tests/write-back.test.ts`.
- [x] 4.3 Add tests covering each scenario in `specs/session-history-tracking/spec.md` and `specs/hook-execution/spec.md`'s new/modified requirements: successful accumulation across `onComplete`+`onExit` on the same instance, `onEnter`'s outcome landing on the newly-opened `currentInstance`, a `manualClear`-policy phase's `onComplete` outcome landing on `currentInstance` (not `history`) in a dispatch prior to and separate from that instance's eventual close, an `invocationFailed` outcome recorded in `hookFailures` with `mutationsApplied` unchanged, a partial-failure `applied` outcome recording both the successful prefix in `mutationsApplied` and a `mutationFailed` entry in `hookFailures`, and the `stop`-mid-phase no-op case (no throw, `dispatch()`'s return value still reports the outcome).
- [x] 4.4 Add a test to `tests/apply-mutations.test.ts` confirming `appliedCount` on a partial-failure result matches the number of mutations before the failing one.

## 5. Verification

- [x] 5.1 `bun run typecheck`, `bun run lint`, `bun test` all pass.
- [x] 5.2 `bun x openspec validate hook-outcome-tracking --strict` passes.
