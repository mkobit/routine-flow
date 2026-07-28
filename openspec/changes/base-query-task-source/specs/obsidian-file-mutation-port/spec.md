## REMOVED Requirements

### Requirement: Queue mutation methods are not yet supported
**Reason**: `BaseQuerySource` and the `TaskQueueItem.id`-equals-`sourcePath` convention (see the `base-query-task-source` capability) now let `queueReorder`/`queueStatusChange` resolve a `TaskQueueItemId` to a vault file via the existing `resolveFile` helper, so unconditional rejection is no longer correct.
**Migration**: See the new `reorderQueueItem`/`changeQueueItemStatus` requirements below. No existing caller relied on the unconditional rejection (both methods were unused stubs).

## ADDED Requirements

### Requirement: reorderQueueItem writes a priority sort key to the resolved file
Given a `queueReorder` mutation whose `itemId` resolves to a vault file, `reorderQueueItem` SHALL write that file's `routine-priority` frontmatter property to the current time in epoch milliseconds when `position` is `'back'`, or to the negation of the current time in epoch milliseconds when `position` is `'front'`, and the returned promise SHALL resolve.

#### Scenario: Cycling an item to the back writes an increasing priority
- **WHEN** `reorderQueueItem` is called with a `queueReorder` mutation whose `position` is `'back'` and whose `itemId` resolves to a file
- **THEN** the file's `routine-priority` frontmatter property is set to the current time in epoch milliseconds, and the returned promise resolves

#### Scenario: Cycling an item to the front writes a decreasing priority
- **WHEN** `reorderQueueItem` is called with a `queueReorder` mutation whose `position` is `'front'` and whose `itemId` resolves to a file
- **THEN** the file's `routine-priority` frontmatter property is set to the negation of the current time in epoch milliseconds, and the returned promise resolves

### Requirement: changeQueueItemStatus writes the status to the resolved file
Given a `queueStatusChange` mutation whose `itemId` resolves to a vault file, `changeQueueItemStatus` SHALL set that file's `routine-status` frontmatter property to the mutation's `status`, and the returned promise SHALL resolve.

#### Scenario: Status is written on an existing file
- **WHEN** `changeQueueItemStatus` is called with a mutation whose `itemId` resolves to a file
- **THEN** the file's `routine-status` frontmatter property is set to the mutation's `status`, and the returned promise resolves

### Requirement: An unresolvable itemId rejects the queue mutation
When a `queueReorder` or `queueStatusChange` mutation's `itemId` does not resolve to a vault file, `reorderQueueItem`/`changeQueueItemStatus` SHALL reject rather than throwing synchronously or silently no-op'ing.

#### Scenario: reorderQueueItem rejects for an unresolvable itemId
- **WHEN** `reorderQueueItem` is called with a mutation whose `itemId` does not resolve to a vault file
- **THEN** the returned promise rejects, and no frontmatter write is attempted

#### Scenario: changeQueueItemStatus rejects for an unresolvable itemId
- **WHEN** `changeQueueItemStatus` is called with a mutation whose `itemId` does not resolve to a vault file
- **THEN** the returned promise rejects, and no frontmatter write is attempted
