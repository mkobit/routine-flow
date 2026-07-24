## Context

`src/timer/store.ts`'s `EngineStore` is the single source of truth for timer state (`main.ts:53`) — every rendering surface subscribes to it and never holds a second copy.
`PomodoroTimerView` (`src/views/timer-view.ts`) is a `BasesView` bound to one leaf's configured `routineFile`; it can show an "inert" disclaimer when a *different* routine is globally active, and its "Start" button can switch the active routine (with a `RoutineReplaceModal` confirmation) because it owns a `viewGraph`.
`PomodoroStatusBarItem` (`src/views/status-bar.ts`) is the opposite extreme: a single-line glanceable projection with no routine binding, hides itself entirely when `status === 'stopped'`, and only offers click-to-pause/resume.
`openspec/changes/ui-surface-inventory/surface-model.md` §2.5 already resolved the cross-cutting question of whether this new surface needs its own design pass from `PomodoroTimerView`'s: yes for layout/interaction set, no for state — subscribing to the same `EngineStore` means agreement is structural, not something this design needs to solve.

This design covers the second sub-surface of flow-gu1.11 (`design.md` surface #9): a persistent, workspace-wide side panel, closer to `PomodoroTimerView`'s fidelity (phase + controls + queue) than the status bar, but usable while another file has focus.

## Goals / Non-Goals

**Goals:**
- Full transport control (pause/resume/done/reset) and queue visibility for whatever routine is globally active, from any workspace context.
- Agree with every other surface by construction (subscribe to the same `EngineStore`, hold no state of its own).
- Standard Obsidian panel discoverability: ribbon icon + command, both revealing the same leaf.

**Non-Goals:**
- Starting a routine from a stopped state, or picking which routine to start — this view has no `viewGraph` concept and no routine-selection UI. That remains `PomodoroTimerView`'s job.
- Any custom CSS/visual design pass — functional shell only, matching how the status bar shipped (flow-gu1.19.2 foundations land later).
- Extracting a shared queue-rendering helper between this view and `PomodoroTimerView` — deliberately duplicated for now (see Decisions).

## Decisions

**No `viewGraph`, no Start button, no RoutineReplaceModal.** Because this panel isn't bound to any specific Bases leaf's `routineFile`, it cannot offer "Start" in the sense `PomodoroTimerView` does (switch to a specific routine, possibly replacing the active one). Since the reducer's `resume` action (`src/timer/reducer.ts:61-62`) and a `start` action without a `filePath` (`:53-58`) are behaviorally identical when the routine doesn't change — both just set `status: 'running'` — the panel uses `resume` for its paused/completed control, sidestepping the confirm-modal flow entirely. Alternative considered: reuse `PomodoroTimerView.handleStart`'s logic with the currently-active graph as an implicit `viewGraph` — rejected, since it would always take the "no confirm needed" branch of `decideStartAction` anyway (same graph id) but adds a misleading `Start`-labeled affordance that looks like it can launch a *different* routine when it can't.

**Idle state is placeholder text, not a hidden panel.** The status bar hides itself (`el.hide()`) when stopped because it's transient chrome; a side panel is a persistent, deliberately-opened surface, so vanishing content would look broken rather than idle. Alternative considered: leave it blank — rejected as indistinguishable from a rendering bug. Alternative considered: a routine picker — rejected as materially larger scope (needs its own routine-discovery UI, which doesn't exist anywhere in the plugin today).

**Queue-rendering is duplicated from `timer-view.ts:142-164`, not extracted.** The two call sites differ enough at the edges (the panel never reaches this code path from a `viewGraph`-relative "is this leaf's own routine active" check) that a shared helper would need its own parameter surface to paper over that difference. Deferred until a third consumer or a concrete drift bug makes the duplication costly — consistent with this repo's minimum-code convention.

**Ribbon icon + command share one `activateView()`.** Standard Obsidian pattern (core Outline/Backlinks panels): find an existing leaf of type `pomodoro-side-panel` via `workspace.getLeavesOfType`, reveal it if found, otherwise create one via `workspace.getRightLeaf(false)` and reveal it. Right sidebar chosen over left because the left sidebar in this vault's convention holds navigation (file explorer), and a live-updating companion panel matches the right sidebar's existing role (backlinks, outline). Reuses the `timer` Lucide icon already used for the Bases view registration (`main.ts:74`), for visual continuity rather than introducing a second icon for the same concept.

## Risks / Trade-offs

- **[Risk]** A user expects "Start" to appear here since it's the most prominent verb elsewhere in the plugin → **Mitigation**: the idle-state placeholder text explicitly points at the Bases timer view ("start one from a Bases timer view"), so the panel's own absence of a Start affordance is self-explanatory rather than a silent gap.
- **[Risk]** Duplicated queue-rendering logic (this change and `timer-view.ts`) drifts if one is changed without the other (e.g. a future badge/status treatment per `ui-surface-inventory/design.md` surface #1's design direction) → **Mitigation**: accepted per the Decisions section above; both call sites are small (~20 lines) and grep-discoverable by the `.pomodoro-queue`/`is-active-task` class names if a future pass needs to update both.
- **[Trade-off]** No unit tests for this view (DOM-imperative code, same as `status-bar.ts`/`timer-view.ts` today) → covered instead by a dedicated e2e file, consistent with existing precedent rather than introducing a new testing pattern for one view.

## Migration Plan

Not applicable — purely additive (new file, new registration calls in `main.ts`). No data migration, no breaking change to `EngineStore`/`EngineAction`/reducer.

## Open Questions

None outstanding — reveal mechanism, idle state, control semantics, and the duplication-vs-extraction call were all resolved with the user before this document was written.
