# Workday shutdown ritual

## Description

A Cal Newport-style shutdown ritual to achieve clean psychological closure at the end of the workday: inbox and message triage, daily accomplishment logging, planning top priorities for tomorrow, and physical workspace tidy-up.

## Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Inbox triage | `inbox-triage` | `ritual` | 10m | `null` | `autoAdvance` | `activeItem` | none |
| Daily log | `daily-log` | `ritual` | 5m | `null` | `manualClear` | `activeItem` | none |
| Tomorrow plan | `tomorrow-plan` | `ritual` | 5m | `null` | `manualClear` | `activeItem` | none |
| Desk tidy | `desk-tidy` | `ritual` | `null` (manual) | `null` | `manualClear` | `activeItem` | none |

Transitions:
1. `inbox-triage` → `daily-log` (`always`)
2. `daily-log` → `tomorrow-plan` (`always`)
3. `tomorrow-plan` → `desk-tidy` (`always`)

`desk-tidy` is an untimed terminal phase with 0 outgoing transitions.

## Walk-through

1. Starting the shutdown routine begins `inbox-triage` (10m countdown) to clear communication channels.
2. The routine moves into `daily-log` to summarize accomplishments and capture loose notes.
3. Next, `tomorrow-plan` provides dedicated focus to select top 3 priorities for the following workday.
4. Finally, `desk-tidy` enters an untimed manual phase for physical workspace reset and shutdown sign-off.
5. Clearing `desk-tidy` ends traversal cleanly (`status: 'ended'`).
