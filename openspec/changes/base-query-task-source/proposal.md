## Why

`Phase.taskSourceId` can't resolve to anything real today — no code reads it — and `FileMutation` kinds `queueReorder`/`queueStatusChange` unconditionally reject (`ObsidianFileMutationPort`'s `notYetSupported`). Meanwhile the actual "which tasks belong to this phase" logic already exists, but only as ad-hoc filtering baked into `RoutineTimerView` (Obsidian integration layer) — there's no domain-level `TaskSource` a phase can query, and no way to write queue-state changes back to a vault note. This blocks flow-6ed (queue-exhausted transition condition) and flow-gu1.25 (real `queueCycle`/`futureDate` `CompletionPolicy` execution), and leaves several "deferred to flow-gu1.9" comments pointing at a closed issue that never actually did this work.

## What Changes

- Add `TaskSourceRegistry` (domain interface: `resolve(id) -> TaskSource | undefined`, plus a `register`/`unregister` pair — unlike `HookRegistry`/`PredicateRegistry`, entries here change on every Bases live-query update, so this registry is mutable at runtime, not populated once at plugin load).
- Add `BaseQuerySource`, a `TaskSource` implementation that projects already-filtered Bases entries (the same focus/break filtering `RoutineTimerView` already does) into `TaskQueueItem[]`, reading fixed frontmatter properties for per-item state: `routine-status`, `routine-time-spent`, `routine-last-cycled`, `routine-priority` (all optional, with defined defaults when absent).
- Fix `TaskQueueItem.id` to equal its `sourcePath` (branded) for Bases-sourced items, so a `TaskQueueItemId` resolves back to a vault file via the existing `resolveFile()` helper with no new reverse-index.
- Implement `ObsidianFileMutationPort.reorderQueueItem`/`changeQueueItemStatus` for real: resolve the file via `resolveFile()`, write `routine-priority` (computed relative to the current queue's min/max, via the resolved `TaskSource`) or `routine-status` frontmatter respectively. **BREAKING**: these methods currently always reject; callers relying on that rejection (if any) will see them succeed instead.
- Delete `TaskSourceConfig` (`src/domain/queue/task-source.ts`) — dead scaffolding that was never wired to anything and doesn't match how `Phase.taskSourceId` (a bare id, no params) is actually shaped; resolution follows the same bare-id-via-registry pattern as `LogTargetResolverName`, not a config discriminated union.
- Migrate `RoutineTimerView`'s inline entry-filtering (`src/views/timer-view.ts:121-158`) to construct/register a `BaseQuerySource` per render instead, so there's a single source of truth for "what's in this phase's queue."
- Update stale `flow-gu1.9` references now that this is the real successor: `src/timer/reducer.ts:160`, `src/timer/obsidian-file-mutation-port.ts:48`, `src/domain/queue/task-source.ts:52`, `docs/examples/workout.md:42`, `docs/examples/pomodoro.md:12`.

Out of scope (deferred to the issues that actually consume this): the engine/reducer autonomously reading `taskSourceId` to populate `PhaseInstance.activeItem`/`itemsTouched` (flow-c08), and real `queueCycle`/`futureDate` `CompletionPolicy` execution (flow-gu1.25). This proposal makes both possible without doing either.

## Capabilities

### New Capabilities
- `base-query-task-source`: `TaskSourceRegistry`, `BaseQuerySource`, and the `TaskQueueItemId`-to-vault-file resolution convention that both the read (`getQueue`) and write (`queueReorder`/`queueStatusChange`) paths rely on.

### Modified Capabilities
- `obsidian-file-mutation-port`: `reorderQueueItem`/`changeQueueItemStatus` currently must reject unconditionally (spec-codified); this changes to real frontmatter writes once a `TaskSource` can resolve the target.

## Impact

- `src/domain/queue/task-source.ts` — drop `TaskSourceConfig`, add `TaskSourceRegistry`.
- `src/timer/obsidian-file-mutation-port.ts` — real `reorderQueueItem`/`changeQueueItemStatus`, remove `notYetSupported`.
- `src/views/timer-view.ts` — replace inline entry filtering with `BaseQuerySource` construction/registration.
- `src/main.ts` — wire the `TaskSourceRegistry` singleton.
- `src/timer/reducer.ts`, `docs/examples/workout.md`, `docs/examples/pomodoro.md` — update stale `flow-gu1.9` references.
- e2e fixtures (`e2e/vault/generator.ts`, `routines/workout-routine.md`) — likely need `routine-status`/`routine-priority` frontmatter added to a fixture note to exercise the new read/write paths end-to-end.
