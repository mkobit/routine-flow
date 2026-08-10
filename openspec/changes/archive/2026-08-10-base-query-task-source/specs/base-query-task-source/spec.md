## ADDED Requirements

### Requirement: TaskSourceRegistry resolves a TaskSourceId to a TaskSource
`TaskSourceRegistry.resolve` SHALL return the `TaskSource` currently registered under the given `TaskSourceId`, or `undefined` if none is registered.

#### Scenario: Resolving a registered id returns its TaskSource
- **WHEN** `resolve` is called with an id that has a `TaskSource` registered
- **THEN** the registered `TaskSource` is returned

#### Scenario: Resolving an unregistered id returns undefined
- **WHEN** `resolve` is called with an id that has no `TaskSource` registered
- **THEN** `undefined` is returned

### Requirement: BaseQuerySource projects Bases entries into TaskQueueItems
Given a list of `BaseQueryEntry` values, `BaseQuerySource.getQueue()` SHALL return one `TaskQueueItem` per entry, with `id` and `sourcePath` both equal to the entry's `path`, `displayName` equal to the entry's `basename`, and `cycleStatus`/`timeSpent`/`lastCycledAt` read from the entry's `routine-status`/`routine-time-spent`/`routine-last-cycled` frontmatter properties.

#### Scenario: An entry's identity fields project from its path/basename
- **WHEN** `getQueue` is called on a `BaseQuerySource` built from an entry with `path` "tasks/write-report.md" and `basename` "write-report"
- **THEN** the returned `TaskQueueItem`'s `id` and `sourcePath` both equal "tasks/write-report.md", and `displayName` equals "write-report"

#### Scenario: An entry with all frontmatter fields set projects them directly
- **WHEN** `getQueue` is called on a `BaseQuerySource` built from an entry whose frontmatter sets `routine-status`, `routine-time-spent`, and `routine-last-cycled`
- **THEN** the returned `TaskQueueItem`'s `cycleStatus`, `timeSpent`, and `lastCycledAt` equal those frontmatter values

### Requirement: Missing per-item frontmatter falls back to defined defaults
When an entry's frontmatter omits `routine-status`, `routine-time-spent`, or `routine-last-cycled`, `BaseQuerySource.getQueue()` SHALL default `cycleStatus` to `'pending'`, `timeSpent` to a zero `Temporal.Duration`, and `lastCycledAt` to `null`, respectively.

#### Scenario: An entry with no routine frontmatter gets default values
- **WHEN** `getQueue` is called on a `BaseQuerySource` built from an entry with no `routine-*` frontmatter properties
- **THEN** the returned `TaskQueueItem` has `cycleStatus` `'pending'`, a zero `timeSpent`, and a `null` `lastCycledAt`

### Requirement: BaseQuerySource sorts items ascending by priority
`BaseQuerySource.getQueue()` SHALL return items sorted ascending by the entry's `routine-priority` frontmatter property, treating a missing value as `0`, with ties broken by the entries' original order.

#### Scenario: Items sort by ascending priority
- **WHEN** `getQueue` is called on a `BaseQuerySource` built from entries with `routine-priority` values -5, 0, and 10 (in that construction order)
- **THEN** the returned items are ordered by priority -5, 0, 10

#### Scenario: Items with no priority sort as if priority were zero
- **WHEN** `getQueue` is called on a `BaseQuerySource` built from entries with `routine-priority` -5, no value, and 10
- **THEN** the returned items are ordered -5, then the no-value item, then 10
