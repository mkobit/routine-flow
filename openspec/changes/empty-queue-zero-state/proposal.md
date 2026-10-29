# Proposal

## Why

Users who execute structured review routines (such as daily kickoff, workday shutdown, and weekly review cadences) frequently encounter empty queues when an inbox or review list has zero items.
Current queue panels only render chore-exhausted copy or an error-like filter mismatch message, and do not provide an immediate button to advance past empty review stages.
Furthermore, when entering a phase whose queue is already drained, transitions guarded by `queueExhausted` are not evaluated on phase entry or start, stalling routine flow.

## What changes

- Add celebratory zero-state copy and clean iconography to the queue panel when review queues or inboxes reach zero items.
- Add an explicit Skip/Advance button in the empty queue panel to allow users to bypass empty review stages in one click.
- Evaluate `queueExhausted` edge transitions on phase entry and phase start so routines automatically advance past empty stages when configured.
- Re-synchronize and isolate `queueExhausted` state on phase transitions so stale values from previous phases do not persist.

## Capabilities

### New capabilities

(none)

### Modified capabilities

- `transition-predicate-resolution`: Evaluate `queueExhausted` transition conditions on phase entry and start.
- `queue-item-actions`: Render celebratory zero-state messaging and explicit advance controls for empty queues.

## Impact

- `src/timer/store.ts`: Synchronize queue exhaustion state on phase transitions and evaluate `queueExhausted` guards on start and advance.
- `src/views/timer/queue-panel.ts`: Render celebratory zero-state copy for review phases and explicit Skip/Advance action button.
- `styles.css`: Add styling for empty queue celebratory state, icon accents, and advance buttons.
- `tests/store.test.ts`: Add tests verifying `queueExhausted` transition resolution on phase entry and start.
- `tests/timer-view-decomposition.test.ts`: Add DOM tests verifying celebratory copy and advance button interactions.
