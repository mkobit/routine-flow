## Why

Once a routine is running, its only in-workspace surfaces are the Bases-embedded timer panel (bound to one leaf) and the glanceable status-bar item (display + pause/resume only, no queue).
There is no way to see the full phase/queue/controls picture while working in another file without switching back to the Bases leaf.
Mike raised this concretely during 2026-07-21 manual UX testing: "promote a pomodoro to the obsidian wide view so i can look at other files and dive into it, but still have my routine running."
flow-gu1.11 shipped the status-bar sub-surface (PR #94); this change delivers the second, fuller-fidelity sub-surface.

## What Changes

- Add a new Obsidian `ItemView`, `PomodoroSidePanelView` (`src/views/side-panel-view.ts`), registered as view type `pomodoro-side-panel`.
- It subscribes directly to the shared `EngineStore` (same pattern as `PomodoroStatusBarItem` and `PomodoroTimerView`) — no new state, no per-leaf routine binding, no possibility of disagreeing with other surfaces.
- Renders phase header, transport controls (Pause/Resume/Done/Reset as applicable), and the active phase's task queue — closer to the Bases timer panel's fidelity than the status bar, but display+control only: it cannot start an arbitrary routine from a stopped state (no routine-picker UI).
- Add a ribbon icon and a command palette entry ("Open routine panel"), both revealing/reusing the same leaf.
- Functional shell only — no custom CSS, matching how the status-bar item shipped.

## Capabilities

### New Capabilities
- `side-panel-view`: a workspace-wide, non-leaf-bound side panel that mirrors the shared engine's active phase/status/queue and offers transport controls (pause/resume/done/reset), with a distinct idle state when nothing is running.

### Modified Capabilities
(none — this is purely additive; no existing capability's requirements change)

## Impact

- New file: `src/views/side-panel-view.ts`.
- Modified: `src/main.ts` (register the view type, ribbon icon, command).
- New e2e coverage: `e2e/side-panel.e2e.ts`.
- No changes to `src/timer/*` (reducer, store) or `src/views/timer-view.ts` — this change only adds a new consumer of existing `EngineStore` state and existing `EngineAction`s (`pause`, `resume`, `finish-phase`, `stop`, `start`).
