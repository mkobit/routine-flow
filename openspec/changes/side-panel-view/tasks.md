## 1. Side panel view

- [x] 1.1 Create `src/views/side-panel-view.ts` with `PomodoroSidePanelView extends ItemView` (view type `pomodoro-side-panel`), subscribing to `plugin.store` on open and unsubscribing on close, mirroring `PomodoroStatusBarItem`'s subscribe/unsubscribe lifecycle
- [x] 1.2 Implement idle-state render: `status === 'stopped'` shows placeholder text only, no controls, no queue
- [x] 1.3 Implement transport controls: Pause (running), Resume (paused/completed), Done (running + `remaining === null`), Reset (running/paused/completed) — dispatching `pause`/`resume`/`finish-phase`/`stop` respectively
- [x] 1.4 Implement queue rendering (title by `phase.kind`, item buttons, `.is-active-task` highlight, click dispatches `{type:'start', filePath}`), duplicated from `timer-view.ts:142-164` per design.md's decision not to extract a shared helper
- [x] 1.5 Apply `pomodoro-side-panel` root class and reuse `pomodoro-controls`/`pomodoro-queue` class names

## 2. Registration and discoverability

- [x] 2.1 Register the view type in `main.ts` via `this.registerView('pomodoro-side-panel', ...)`
- [x] 2.2 Add `activateView()` helper: reveal an existing `pomodoro-side-panel` leaf if one exists, otherwise create one via `workspace.getRightLeaf(false)` and reveal it
- [x] 2.3 Add a ribbon icon (Lucide `timer`, matching the Bases view registration) calling `activateView()`
- [x] 2.4 Add a command ("Open routine panel") calling `activateView()`
- [x] 2.5 Unload/cleanup: ensure the view's store subscription is released in `onClose`, mirroring `PomodoroStatusBarItem.unload()`

## 3. Testing

- [x] 3.1 Add `e2e/side-panel.e2e.ts` mirroring `e2e/status-bar.e2e.ts`'s structure: opening via ribbon icon, idle-state placeholder, pause/resume/reset control clicks reflected in the panel, queue item click switching the active file
- [x] 3.2 Run `bun run build && bun run test:e2e` (per the stale-build lesson — always rebuild before e2e) and confirm the new spec passes headless

## 4. Verification

- [x] 4.1 `bun run typecheck`
- [x] 4.2 `bun run lint`
- [x] 4.3 `bun test`
- [x] 4.4 Manual smoke check: covered by `e2e/side-panel.e2e.ts`'s "a routine started from a Bases timer view appears in the panel" test, which drives the real running app (ribbon icon click, Bases Start click, panel mirroring, Reset → idle) under `xvfb-run` — a `vault:dev:headless` pass would exercise the identical code path with less rigor and no repeatability, so it was skipped in favor of the automated coverage
