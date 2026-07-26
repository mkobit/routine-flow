## Why

`EngineState` has no real `Session`/`PhaseInstance` history — `src/timer/reducer.ts`'s `synthesizeHookContext` fabricates a throwaway `PhaseInstance`/`Session` on every hook invocation (fresh random ids, `Temporal.Now.instant()` read inline, `activeItem`/`itemsTouched`/`mutationsApplied` all hardcoded empty). Every field is commented "superseded once flow-c08 lands." flow-gu1.17 deliberately deferred this when the reducer migrated to `PhaseGraph`; flow-xn3 (CompletionPolicy execution) and flow-qx9 (Hook execution) have since landed, so the placeholder can now be replaced with real, engine-tracked history — without which every `Hook` invocation still receives fabricated, not-actually-historical data.

## What Changes

- `EngineState` gains an explicit `session: Session | null` field. A session opens on `start` only when none is currently open, and closes (`session` returns to `null`) on `stop` — matching `initialEngineState`'s existing full-reset semantics. **BREAKING**: `EngineState`'s shape changes (new required field).
- `Session` gains a `currentInstance: PhaseInstance | null` field; `history` is redefined to hold only CLOSED instances (real `endedAt`/`endReason`), not the in-progress one. **BREAKING**: `Session`'s shape changes.
- `PhaseInstance` gains snapshotted `phaseDisplayName`/`phaseKind` fields (alongside the existing `plannedDuration` snapshot), so a closed instance survives the firing phase later being renamed, re-kinded, or deleted. **BREAKING**: `PhaseInstance`'s shape changes.
- `PhaseInstance.itemsTouched` changes from bare `TaskQueueItemId[]` to an array of lightweight per-touch snapshots (`id`/`sourcePath`/`displayName`, captured at the moment an item becomes active) — bare ids from a live, mutable Bases-query-backed queue are not guaranteed re-resolvable later. `activeItem` is derived (the tail of `itemsTouched`) rather than separately tracked. **BREAKING**: `PhaseInstance.itemsTouched`'s element type changes; `activeItem` is removed as a stored field.
- `engineReducer` mints a real `PhaseInstanceId` when a phase instance opens and closes the outgoing instance (`endedAt`, `endReason`, `actualDuration`) as part of the same pure transition that changes `currentPhaseId`/`status` — no wall-clock read inside the reducer itself; `EngineStore.dispatch` reads `Temporal.Now.instant()` once and stamps it onto the dispatched action for any action that can open/close an instance.
- `HookEventOccurrence` gains a `phaseInstanceId: PhaseInstanceId` field, so a fired hook event can be attributed to the exact instance it belongs to (a cyclic `PhaseGraph` revisits the same `phaseId` repeatedly, so `phaseId` alone can't disambiguate which visit's instance a firing belongs to).
- `synthesizeHookContext` is deleted. `HookContext.instance`/`.session` are built by reading the real `currentInstance` or closed instance directly off `EngineState`, keyed by `phaseInstanceId` — no longer freshly fabricated per hook call.
- `mutationsApplied` (recording what a hook's returned `FileMutation[]` actually applied) is explicitly out of scope for this change — see Non-Goals. It remains present on `PhaseInstance` but nothing populates it yet.

### Non-Goals
- Populating `PhaseInstance.mutationsApplied` with real hook-outcome data. A hook's own return value is only known after the transition that closes its instance already happened — feeding it back safely (reentrancy, append-not-replace across multiple hooks per instance, a "sealed instance" answer, a home for hook-invocation failures) is its own design surface, deferred to a follow-up issue.
- Capping or windowing `Session.history`'s length. `EngineState` isn't persisted anywhere today, so unbounded in-memory growth for one session's lifetime is an accepted, revisitable cost — not designed here.
- Widening `PhaseInstanceEndReason` beyond its current `completed`/`skipped`/`abandoned` split. No current UI produces a finer-grained "why" signal, so there's nothing to capture yet.
- Recording a `FileMutation`'s prior value (only the newly-written value is ever recorded). Noted as a known gap, not built speculatively.
- Fixing `EngineStore.dispatch`'s lack of serialization (every dispatch call site in this codebase fires `void store.dispatch(...)`, so once a real async hook is registered, a second dispatch can start mid-`await` and race the first). This is a pre-existing, independently-valuable correctness fix unrelated to the shape of `Session`/`PhaseInstance` — tracked as a separate, external bd issue this change depends on, not implemented here.

## Capabilities

### New Capabilities
- `session-history-tracking`: `EngineState`/`Session`/`PhaseInstance`'s real, engine-maintained history of a `PhaseGraph` traversal — session open/close semantics, per-instance open/close lifecycle (ids, timestamps, snapshotted phase/item data), and how `now` enters the otherwise wall-clock-free `engineReducer`.

### Modified Capabilities
- `hook-execution`: the "Resolved hooks are invoked with a synthesized HookContext" requirement changes — `instance`/`session` are no longer "freshly constructed for that call," they're read from real `EngineState`-tracked history via a `phaseInstanceId` carried on the fired event.

## Impact

- `src/domain/session/engine-state.ts`: `EngineState` gains `session`.
- `src/domain/session/session.ts`: `Session` gains `currentInstance`, redefines `history`; `PhaseInstance` gains `phaseDisplayName`/`phaseKind`, changes `itemsTouched`'s element type, drops `activeItem` as a stored field.
- `src/timer/reducer.ts`: `engineReducer` takes an additional `now` input for instance-boundary actions; instance open/close logic moves into `completePhase`/`advancePhase`/the `stop` case; `deriveHookEvents` reads `endReason` off closed instances instead of re-deriving it and gains `phaseInstanceId` per occurrence; `synthesizeHookContext` is deleted.
- `src/timer/store.ts`: `EngineStore.dispatch` stamps `now` onto instance-boundary actions before calling `engineReducer`; snapshots the active item's lightweight data (via `taskSourceRegistry`) at activation time, mirroring the existing `syncQueueExhausted` pattern; builds `HookContext` from real state instead of calling `synthesizeHookContext`.
- Existing reducer/store unit tests that construct `EngineState`/`EngineAction`/`HookContext` literals need updating for the new required fields.
