## 0. Prerequisite gate

- [ ] 0.1 Confirm the dispatch-serialization bd issue (external prerequisite — `EngineStore.dispatch` races once real hooks are configured, tracked as its own bd issue this change depends on) is closed before starting group 2 onward.

## 1. Domain type changes (src/domain/session/*)

- [ ] 1.1 Add `session: Session | null` to `EngineState`; update its doc comment (remove the now-stale "deliberately does NOT embed a Session/PhaseInstance history yet" framing).
- [ ] 1.2 Add `currentInstance: PhaseInstance | null` to `Session`; update `history`'s doc comment to state it holds only closed instances.
- [ ] 1.3 Add `phaseDisplayName`/`phaseKind` fields to `PhaseInstance`, snapshotted alongside the existing `plannedDuration`.
- [ ] 1.4 Change `itemsTouched`'s element type from `TaskQueueItemId` to a lightweight per-touch record (`id`, `sourcePath`, `displayName`); remove `activeItem` as a separately stored field.

## 2. engineReducer: instance open/close + now-threading

- [ ] 2.1 Add a `now: Temporal.Instant` input to `engineReducer`, stamped onto `start`/`tick`/`finish-phase`/`advance-phase`/`stop` actions (per design.md Decision 1 — action-stamped, not a bare positional reducer parameter, not folded into `EngineDeps`).
- [ ] 2.2 Implement instance-open logic: mint a `PhaseInstanceId`, snapshot the entering phase's `label`/`kind`/`duration` into `phaseDisplayName`/`phaseKind`/`plannedDuration`, set as `session.currentInstance` at every point a phase becomes active (matching `deriveHookEvents`'s existing `onEnter` firing points).
- [ ] 2.3 Implement instance-close logic: set `endedAt`/`endReason`/`actualDuration` and append to `session.history` at every point a phase stops being active (matching `onComplete`/`onSkip`/`onExit` firing points), clearing `currentInstance`.
- [ ] 2.4 Implement session lifecycle: `start` opens a new `Session` (empty `history`, freshly opened `currentInstance`) only when `session` is `null`; `stop` resets `session` to `null` (alongside its existing full-state reset via `initialEngineState`).
- [ ] 2.5 Refactor `deriveHookEvents` to read `endReason` off the closed instance in `nextState` rather than independently re-deriving it; add `phaseInstanceId: PhaseInstanceId` to `HookEventOccurrence`.

## 3. EngineStore: now-stamping + item-activation snapshotting

- [ ] 3.1 `EngineStore.dispatch` reads `Temporal.Now.instant()` once per dispatch and stamps it onto instance-boundary actions before calling `engineReducer`.
- [ ] 3.2 Snapshot the active item's lightweight data (`id`/`sourcePath`/`displayName`) via `taskSourceRegistry` at the moment `activeFilePath` resolves to a new queue item, mirroring `syncQueueExhausted`'s "store resolves external state, feeds it back via the reducer" pattern, appending into `itemsTouched`.

## 4. HookContext construction

- [ ] 4.1 Delete `synthesizeHookContext`.
- [ ] 4.2 Build each fired event's `HookContext.instance`/`.session` by reading `EngineState.session`/`.currentInstance`/`.history`, selecting the instance via the event's `phaseInstanceId`.

## 5. Tests

- [ ] 5.1 Update existing reducer/store unit tests that construct `EngineState`/`EngineAction`/`HookContext`/`Session`/`PhaseInstance` literals for the new/changed fields.
- [ ] 5.2 Add tests covering each scenario in `specs/session-history-tracking/spec.md` and the modified scenarios in `specs/hook-execution/spec.md`.

## 6. Follow-up issue hygiene

- [ ] 6.1 Confirm the deferred `mutationsApplied`-audit-trail bd issue (filed separately, depends on this change) references the finalized `PhaseInstanceId`-minting mechanism from group 2 before it's picked up.
