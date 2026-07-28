## 1. Domain: TaskSourceRegistry, drop TaskSourceConfig

- [x] 1.1 In `src/domain/queue/task-source.ts`, delete `TaskSourceConfig` and `TaskSourceKind` (dead, never consumed).
- [x] 1.2 Add the resolve-only `TaskSourceRegistry` interface to `src/domain/queue/task-source.ts` (decision 2).
- [x] 1.3 Update `src/domain/queue/task-source.ts:52`'s doc comment (currently points at flow-djx as a TODO) to describe the real `BaseQuerySource` implementation instead.

## 2. BaseQuerySource (TDD)

- [x] 2.1 Write failing tests for `BaseQuerySource.getQueue()`: identity fields (`id`/`sourcePath` = entry path, `displayName` = basename), frontmatter projection, defaults when frontmatter is absent, and priority-based sort (including the "missing priority sorts as 0" case) — per `specs/base-query-task-source/spec.md`.
- [x] 2.2 Implement `src/timer/base-query-task-source.ts`: `BaseQueryEntry` adapter interface + `createBaseQuerySource(entries): TaskSource` factory, until tests pass.

## 3. TaskSourceRegistry implementation (TDD)

- [x] 3.1 Write failing tests for the `Map`-backed `MutableTaskSourceRegistry`: register/resolve/unregister/re-register-overwrites.
- [x] 3.2 Implement `src/timer/task-source-registry.ts`'s `MutableTaskSourceRegistry` until tests pass. (A real `class`, not a closure factory — `eslint-plugin-functional`'s `ignoreClasses` exemption only covers mutation inside an actual class; a closure over a `Map` trips `functional/immutable-data`.)

## 4. ObsidianFileMutationPort: real queue mutations (TDD)

- [x] 4.1 Write failing tests for `reorderQueueItem`/`changeQueueItemStatus` per `specs/obsidian-file-mutation-port/spec.md`: back/front priority writes, status writes, and unresolvable-`itemId` rejection.
- [x] 4.2 Implement the real `reorderQueueItem`/`changeQueueItemStatus` in `src/timer/obsidian-file-mutation-port.ts`, removing `notYetSupported`, until tests pass. (Uses `Temporal.Now.instant().epochMilliseconds`, not `Date.now()` — `no-restricted-globals` bans `Date` repo-wide.)

## 5. Wire RoutineTimerView to BaseQuerySource

- [x] 5.1 In `src/views/timer-view.ts`, replace the inline `filteredEntries` computation (lines 121-158) with: build `BaseQueryEntry[]` from the current phase's focus/break-filtered entries (reading frontmatter via `app.metadataCache.getFileCache`), construct a `BaseQuerySource`, and `register` it under `phase.taskSourceId` (skip registration entirely when `taskSourceId` is `null`, same as today's "no queue" phases).
- [x] 5.2 Render the queue list from `taskSource.getQueue()` instead of raw entries, preserving existing behavior (active-item highlighting, click-to-start).
- [x] 5.3 (Discovered during implementation, not in the original plan) `DEFAULT_PHASE_GRAPH`'s phases all had `taskSourceId: null` — gating the queue panel on `taskSourceId !== null` would have silently dropped the shipped default routine's queue. Gave `focus`/`break`/`long-break` real `taskSourceId`s (`focus-queue`/`break-queue`, exported from `phase-graph.ts`) to preserve existing out-of-the-box behavior.

## 6. Wire main.ts

- [x] 6.1 Construct the `MutableTaskSourceRegistry` singleton in `RoutineFlowPlugin.onload()` (as a `public taskSourceRegistry` field, constructed at class-field-init time rather than inside `onload()` — no dependency on plugin lifecycle state).
- [x] 6.2 `RoutineTimerView` accesses it via `this.plugin.taskSourceRegistry`. No separate narrow-`TaskSourceRegistry` consumer exists yet in this proposal's scope (`ObsidianFileMutationPort`'s reorder/status-change don't need it — see design.md decision 6); the narrow/wide split still exists at the type level for whenever one does.

## 7. Clean up stale flow-gu1.9 references

- [x] 7.1 Update `src/timer/reducer.ts:160` and `src/domain/hook/hook.ts:20` (found during the sweep — same stale pointer, not in the original file list).
- [x] 7.2 Update `docs/examples/workout.md:42` and `docs/examples/pomodoro.md:12` (plus the domain-mapping table and "Where it strains" prose in both files, which referenced the now-null `taskSourceId`/nonexistent `TaskSourceKind`).

## 8. e2e coverage

- [x] 8.1 Add `routine-status`/`routine-priority` frontmatter to at least one fixture task note. Done in `e2e/vault/generator.ts`'s `generatePomodoroNotes` (deterministic per-seed via `fc.constantFrom`/`fc.option`), not Standup/Workout — those routines' phases stay `taskSourceId: null` (no queue), while the shipped `DEFAULT_PHASE_GRAPH`'s `focus`/`break-queue` phases are exactly what task 5.3 wired up.
- [x] 8.2 Added `e2e/timer.e2e.ts`'s "BaseQuerySource-backed queue" describe block: asserts the "Default" sub-view's Work queue renders the five generated fixture notes in ascending `routine-priority` order (including the no-priority-set case sorting as 0). Scoped to the read path only — no reorder/status-change UI control exists to click, and there's no dispatchable engine action that produces those `FileMutation`s yet (unlike `finish-phase`); the write path is covered by task 4's unit tests against real Obsidian-shaped fake `vault`/`fileManager` deps instead. Not a gap: `write-back-modal.e2e.ts` already establishes real e2e coverage of `processFrontMatter`-based writes for the identical underlying mechanism.
- [x] 8.3 (Discovered during this task, not in the original plan) Found and fixed a real bug while writing the above: `this.config?.get('focusProperty'/'breakProperty')` returns `undefined` for an unconfigured View Option (Bases does **not** auto-apply `getViewOptions()`'s declared `default`), and the existing filter's `if (!propId) return isFocus` fallback silently showed the *entire vault* as the Work queue instead of filtering. Fixed via a `DEFAULT_QUEUE_PROPERTY_ID` fallback in `timer-view.ts`. Separately discovered the e2e fixture's `note.type` frontmatter key (containing a literal dot) collided with Bases' own `<source>.<name>` property-id namespacing — `getValue('note.type')` looks for a field named `type`, not a field named `note.type` (that needs `note.note.type`). Renamed the fixture key to plain `type` in `e2e/vault/generator.ts` and `e2e/write-back-modal.e2e.ts` rather than working around it. Filed flow-kg3 (RoutineTimerView has no unit test seam — this class of bug is only caught by slow e2e today).

## 9. Verify

- [x] 9.1 `bun run typecheck`, `bun run lint`, `bun test ./tests` all pass (150 tests).
- [x] 9.2 `bun run build` then `xvfb-run -a bun x playwright test` (full e2e) pass. One test flakes intermittently on an unrelated pre-existing race (flow-6v7, filed this session) — recovers on Playwright's built-in retry, reproduced 3× total, not caused by this change (docs-only/domain-only diffs reproduced it too before any timer-view.ts changes existed).
