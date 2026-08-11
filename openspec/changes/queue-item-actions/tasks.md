## 1. Domain Models & Schemas

- [ ] 1.1 Implement `QueueItemActionSchema` and `QueueItemActionPayloadSchema` in `src/domain/action/queue-item-action.ts`
- [ ] 1.2 Implement pure `deriveActionMutations` in `src/domain/action/derive-action-mutations.ts`
- [ ] 1.3 Add unit tests for `QueueItemActionSchema` and `deriveActionMutations` in `test/domain/action/`

## 2. Phase & Routine Parser Integration

- [ ] 2.1 Update `PhaseSchema` in `src/domain/phase/phase.ts` to include optional `actions` field
- [ ] 2.2 Update routine parser in `src/domain/routine/routine-file.ts` to parse raw `actions` array
- [ ] 2.3 Add unit tests for routine parsing with `actions` in `test/domain/routine/`

## 3. UI & Dispatcher Wiring

- [ ] 3.1 Render action buttons for active queue item in `PomodoroTimerView`
- [ ] 3.2 Wire action button clicks to derive mutations and apply via `FileMutationPort`
- [ ] 3.3 Add tests for action button dispatching
