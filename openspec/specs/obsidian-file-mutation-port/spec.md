# obsidian-file-mutation-port Specification

## Purpose
TBD - created by archiving change obsidian-file-mutation-port. Update Purpose after archive.
## Requirements
### Requirement: writeFrontmatter sets the property on the resolved file
Given a `frontmatter` mutation whose `filePath` resolves to a vault file, `writeFrontmatter` SHALL set that file's frontmatter `property` to the mutation's `value`, and the returned promise SHALL resolve.

#### Scenario: Frontmatter property is written on an existing file
- **WHEN** `writeFrontmatter` is called with a mutation whose `filePath` resolves to a file
- **THEN** the file's frontmatter is updated so `property` equals `value`, and the returned promise resolves

### Requirement: appendText appends to the resolved file
Given an `append` mutation whose `filePath` resolves to a vault file, `appendText` SHALL append the mutation's `text` to that file's contents, and the returned promise SHALL resolve.

#### Scenario: Text is appended to an existing file
- **WHEN** `appendText` is called with a mutation whose `filePath` resolves to a file
- **THEN** the mutation's `text` is appended to the file, and the returned promise resolves

### Requirement: An unresolvable filePath rejects the mutation
When a `frontmatter` or `append` mutation's `filePath` does not resolve to a vault file, `writeFrontmatter`/`appendText` SHALL reject rather than throwing synchronously or silently no-op'ing, so `applyMutations` can surface the failure via its `{ success: false, cause }` result.

#### Scenario: writeFrontmatter rejects for a missing file
- **WHEN** `writeFrontmatter` is called with a mutation whose `filePath` does not resolve to a vault file
- **THEN** the returned promise rejects, and no frontmatter write is attempted

#### Scenario: appendText rejects for a missing file
- **WHEN** `appendText` is called with a mutation whose `filePath` does not resolve to a vault file
- **THEN** the returned promise rejects, and no append is attempted

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

