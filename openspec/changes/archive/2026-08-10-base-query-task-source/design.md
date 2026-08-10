## Context

`TaskSource`/`TaskQueueItem` (`src/domain/queue/task-source.ts`) exist as pure domain types but nothing implements or resolves them. The actual "which vault notes are in this phase's queue" logic already exists — inline in `RoutineTimerView` (`src/views/timer-view.ts:121-158`), filtering the view's own live Bases entries (`this.data.data`) by a configured property/value pair (`focusProperty`/`focusValue` or `breakProperty`/`breakValue` View Options). `queueReorder`/`queueStatusChange` `FileMutation`s exist in the schema but `ObsidianFileMutationPort` rejects both unconditionally (`notYetSupported`), since there's no way to resolve a `TaskQueueItemId` back to a vault file.

The established resolution pattern in this codebase is `XRegistry.resolve(name) -> X | undefined`, populated once at plugin load (`HookRegistry`, `PredicateRegistry` in `src/main.ts`). `TaskSource` breaks that pattern in one way: a `baseQuery`-kind source's contents change on every Bases live-query refresh (`onDataUpdated()`), and `TaskSource.getQueue()` is synchronous — so whatever holds the current entries must be kept fresh by the view, not wired once at load.

## Goals / Non-Goals

**Goals:**
- A real `TaskSource` implementation (`BaseQuerySource`) backed by a Bases view's live-filtered entries.
- A registry (`TaskSourceRegistry`) `Phase.taskSourceId` can resolve against, kept fresh by `RoutineTimerView`.
- Real `queueReorder`/`queueStatusChange` mutations: resolve the target file, write frontmatter.
- Remove `TaskSourceConfig` (dead scaffolding — never wired to anything, doesn't match how `Phase.taskSourceId` is actually shaped).

**Non-Goals:**
- Engine/reducer autonomously reading `taskSourceId` to populate `PhaseInstance.activeItem`/`itemsTouched` — that's flow-c08.
- Real `queueCycle`/`futureDate` `CompletionPolicy` execution — that's flow-gu1.25; this proposal only makes it possible.
- Generalizing beyond the existing two fixed queues (focus/break, via the existing `focusProperty`/`breakProperty` View Options) to arbitrary per-phase Bases filters. See Open Questions.
- Writing `routine-time-spent`/`routine-last-cycled` — those are read-only inputs here; actual time-tracking write-back is a separate concern (likely the existing generic `frontmatter`-kind `FileMutation` + hook mechanism, pointed at these field names later).
- `staticList`/`fixedSequence` `TaskSource` kinds — `BaseQuerySource` is the only implementation this proposal adds.

## Decisions

**1. `TaskSourceConfig` is deleted, not extended into a discriminated union.**
`Phase.taskSourceId` is a bare branded id with no `params` slot — structurally identical to `LogTargetResolverName`, not to `HookReference` (`{ name, params }`) or `CompletionPolicy` (an inline discriminated union interpreted structurally). A `TaskSourceConfig` discriminated union was never wired to anything and doesn't match the pattern the domain actually uses elsewhere. Resolution follows the registry pattern; the "kind" a `TaskSource` was built from is a construction-site concern (`src/timer/`), not a serialized domain concept.

**2. `TaskSourceRegistry` interface stays resolve-only in domain; mutability lives in a wider `src/timer/`-local type.**
Domain (`src/domain/queue/task-source.ts`):
```ts
export interface TaskSourceRegistry {
  readonly resolve: (id: TaskSourceId) => TaskSource | undefined
}
```
`src/timer/task-source-registry.ts` adds a `MutableTaskSourceRegistry extends TaskSourceRegistry` with `register`/`unregister`, backed by a `Map`. `RoutineTimerView` gets the wide type (it's the producer); `ObsidianFileMutationPort` and anything domain-adjacent only ever see the narrow one. This keeps the domain-facing contract symmetric with `HookRegistry`/`PredicateRegistry` (both resolve-only) instead of growing every registry to the union of all callers' needs.

**3. `BaseQuerySource` lives in `src/timer/`, not `src/domain/`, and reads frontmatter directly — not through Bases' typed property system.**
Same rationale as `ObsidianFileMutationPort`/`VaultFile`: it touches Obsidian-shaped data, so it belongs in the integration layer even though it implements a domain interface. It takes a minimal adapter, not a real `BasesEntry`:
```ts
export interface BaseQueryEntry {
  readonly path: string
  readonly basename: string
  readonly frontmatter: Record<string, unknown> | undefined
}
```
`RoutineTimerView` constructs these from its already-filtered entries plus `app.metadataCache.getFileCache(file)?.frontmatter` — the same mechanism `getViewOptions`'s `routineFile` filter already uses, sidestepping Bases' `BasesPropertyId`/`getValue()` machinery entirely (that system is for user-configurable properties like `focusProperty`; our four fields are fixed names, so raw frontmatter is simpler and requires no property-id resolution).

**4. `TaskQueueItem.id` equals its `sourcePath` (branded).**
Makes `TaskQueueItemId` → vault file resolution reuse the existing `resolveFile()` helper directly, with no separate reverse-index or registry lookup needed in `ObsidianFileMutationPort`.

**5. Fixed frontmatter properties, not configurable View Options: `routine-status`, `routine-time-spent`, `routine-last-cycled`, `routine-priority`.**
All optional. Defaults when absent: `routine-status` → `'pending'`; `routine-time-spent` → `Temporal.Duration` zero (`PT0S`); `routine-last-cycled` → `null`; `routine-priority` → treated as `0` for sorting (see decision 6). Matches the `is-routine` fixed-marker convention already established in `routine-file-format`. Adding configurability later is additive/non-breaking if ever needed.

**6. `routine-priority` is an epoch-milliseconds sort key, computed locally — no sibling-queue lookup needed.**
`reorderQueueItem`'s `FileMutation` only carries `{ itemId, position }`, no source id — so there's no way to look up "this item's queue" to compute a value relative to current min/max without also changing the mutation's schema or adding registry-enumeration. Instead: `'back'` writes `Date.now()`; `'front'` writes `-Date.now()`. Sort ascending by `routine-priority ?? 0`, tiebreak by the entries' original Bases-returned order. This is self-consistent without coordination: later "back" cycles always sort after earlier ones (larger epoch millis); later "front" cycles always sort ahead of earlier ones (more negative); untouched items (no property) sort at `0`, between any front-cycled and back-cycled item. `ObsidianFileMutationPort.reorderQueueItem` needs no `TaskSourceRegistry` dependency at all under this scheme.

**7. `changeQueueItemStatus` writes `routine-status` directly** — the mutation's `status` field is already one of `TaskQueueItemCycleStatusSchema`'s values, no translation needed.

## Risks / Trade-offs

- [Epoch-millis priority values are opaque/large numbers if a user inspects frontmatter directly] → Acceptable; it's a sort key, not a user-facing field. Could format as ISO instant instead for readability in a follow-up if it becomes a complaint.
- [`BaseQuerySource` only ever backs the existing two fixed focus/break queues, not arbitrary per-phase filters] → Documented as a Non-Goal; a non-default routine phase wanting its own distinct queue (e.g. Workout's "Set") stays `taskSourceId: null` until a follow-up generalizes View Options. Doesn't block flow-6ed/flow-gu1.25, which only need focus/break queues to work.
- [View closing mid-session leaves its `TaskSourceRegistry` entry stale rather than removed] → Deliberate: `RoutineTimerView.onunload()` does *not* unregister. Losing the queue mid-session because the tab was switched/closed would be worse than serving a stale-but-present snapshot. Re-opening the view re-registers and refreshes it.

## Migration Plan

No data migration — this is new capability, no existing persisted state changes shape. `queueReorder`/`queueStatusChange` going from "always rejects" to "writes frontmatter" is the only behavior change to existing (currently unused) code paths.

## Open Questions

- Should a future proposal generalize beyond the two fixed focus/break queues to let any phase declare its own Bases filter (property/value pair), rather than being limited to `focusProperty`/`breakProperty`? Not needed to unblock flow-6ed/flow-gu1.25, but the Workout/standup example routines will want it eventually.
