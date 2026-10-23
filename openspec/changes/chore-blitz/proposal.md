# Proposal

## Why

Users complete short tasks quickly in a chore blitz against a fixed phase countdown.
Current phase execution only supports single active task write-backs and waits for the full countdown duration before advancing.
Users need rapid task check-off, live completion feedback, automatic early advancement upon queue exhaustion, and batch frontmatter updates across all finished chores.

## What changes

- Add automatic early phase advancement when a running timed phase exhausts its task queue and has an outgoing transition guarded by `condition: { kind: 'queueExhausted' }`.
- Distinguish completed items from viewed items in `PhaseInstance.itemsTouched` using an explicit completion status.
- Add `{ kind: 'completedItems' }` log target to support batch frontmatter write-backs across all tasks completed during a phase instance.
- Add immediate candidate selection advancement upon `markDone` action execution to eliminate user interface latency.
- Add a live completed chore counter to the queue panel and header.
- Add visual celebration feedback and an in-app notice when a chore blitz phase finishes early due to queue exhaustion.
- Add a chore blitz example routine, vault generator, documentation guide, and end-to-end integration tests.

## Capabilities

### New capabilities

(none)

### Modified capabilities

- `transition-predicate-resolution`: Evaluate `queueExhausted` edge guards and trigger early phase advancement during running timed phases.
- `session-history-tracking`: Track completion status for each touched item in `PhaseInstance.itemsTouched`.
- `frontmatter-write-back-trigger`: Support `{ kind: 'completedItems' }` log target and generate batch frontmatter mutations across completed chores.
- `queue-item-actions`: Advance active task immediately upon `markDone` action execution and display a dynamic completed chore counter.
- `phase-transition-notifications`: Emit in-app notice and visual cue on early phase completion caused by queue exhaustion.

## Impact

- `src/domain/session/session.ts`: Update `ItemTouch` to include `status: 'viewed' | 'completed'` and `completedAt`.
- `src/domain/phase/phase.ts`: Extend `PhaseLogTargetSchema` to support `{ kind: 'completedItems' }`.
- `src/timer/reducer.ts`: Handle early phase advancement on `set-queue-exhausted` action and add pure `record-item-completion` action.
- `src/timer/store.ts`: Dispatch item completion and stamp `now` onto queue exhaustion events.
- `src/timer/write-back.ts`: Resolve multiple target file paths and generate batch `FileMutation` entries for `completedItems`.
- `src/views/timer/queue-panel.ts`: Display completed chore counter and immediately activate next candidate chore on check-off.
- `src/views/timer-view.ts`: Render celebratory state feedback on early phase exit.
- `e2e/vault/generators/chore-blitz.ts` and `e2e/chore-blitz.e2e.ts`: Add generator and Playwright test suite.
- `docs/docs/examples/chore-blitz.md`: Author user documentation guide.
