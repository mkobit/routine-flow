# Design

## Context

Structured review routines guide users through sequential review stages such as inbox processing and status reviews.
Review stages often start with zero items in the queue (Inbox zero) or reach zero items during the review.
Current timer views lack celebratory zero-state cues for review queues and lack a direct action to advance past empty stages.
Additionally, when a routine enters a phase whose queue is already empty, transitions guarded by `queueExhausted` fail to trigger on entry.
See `proposal.md` for user requirements.

## Goals / non-goals

**Goals:**
- Render celebratory zero-state messaging and clean iconography when a review queue has zero items.
- Provide an explicit Skip/Advance button in the empty queue panel to advance past empty stages in one click.
- Evaluate `queueExhausted` edge guards on phase entry and start within `EngineStore`.
- Synchronize and reset `queueExhausted` state on phase transition to prevent stale flag leakage across stages.

**Non-goals:**
- Automatic phase advancement for phases that lack an outgoing transition guarded by `queueExhausted`.
- Custom zero-state illustration assets (inline SVG icons from Obsidian icon set are used per `DESIGN.md`).

## Decisions

### Decision 1: Review queue zero-state messaging in `renderQueuePanel`

In `src/views/timer/queue-panel.ts`, evaluate whether the phase is a review phase or has items completed when `queueItems.length === 0`:
- When `phase.kind === 'review'`: render celebratory Inbox zero copy (`Inbox zero reached — nothing to review.`) with icon `check-check`.
- When `options.completedCount && options.completedCount > 0`: render completion copy (`All tasks completed early — queue exhausted.`) with icon `check-check`.
- When neither condition holds: render standard filter notice (`No notes match — check this routine's queue filter.`) with icon `inbox`.

*Alternatives considered:*
- Hardcoding chore blitz copy everywhere: Rejected because review and kickoff routines are not chore blitzes.

### Decision 2: One-click Skip/Advance button for empty queues

When `options.queueItems.length === 0`, render an explicit Skip/Advance button inside `routine-queue-empty` if `options.actionExecutor?.dispatch` is available:
- Button element with class `routine-action-btn mod-cta routine-queue-advance-btn`.
- Label text: `Advance stage`.
- Click handler triggers `actionExecutor.dispatch({ type: 'advance-phase' })`.

*Alternatives considered:*
- Requiring users to use top-level timer controls or hotkeys: Rejected because users focus on the empty queue panel when assessing remaining stage work.

### Decision 3: Phase entry and start `queueExhausted` evaluation in `EngineStore`

In `src/timer/store.ts`:
1. When `start` action is dispatched in `runDispatch`:
   - Inspect the current phase's task source.
   - If the task source has 0 items and `this.hasQueueExhaustedTransition(this.state.currentPhaseId)` is true, execute immediate phase transition via `completePhase` or `set-queue-exhausted`.
2. When a phase transition occurs in `applyAction` (`prevState.currentPhaseId !== nextState.currentPhaseId`):
   - Inspect the new phase's task source in `this.deps.taskSourceRegistry`.
   - Compute `newExhausted = source !== undefined && source.getQueue().length === 0`.
   - Update `this.state.queueExhausted` with `newExhausted`.
   - If `newExhausted && nextState.status === 'running' && this.hasQueueExhaustedTransition(nextState.currentPhaseId)`, trigger immediate progression to the next phase.

*Alternatives considered:*
- Polling task sources periodically: Rejected to avoid unnecessary CPU cycles and maintain reactive, deterministic state management.

## Risks / trade-offs

- **[Risk]** A phase with an empty queue and `queueExhausted` guard might advance immediately without user notice.
  → **Mitigation**: Routine Flow emits the standard phase transition notification via `ObsidianNotificationPort` informing the user that the stage completed and the next stage started.
- **[Risk]** Clicking `Advance stage` on the last stage of a routine ends the session unexpectedly.
  → **Mitigation**: `advance-phase` action naturally triggers `ended` status and runs session close hooks per existing engine design.
