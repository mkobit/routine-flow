# Silent meeting agenda

## Description

An Amazon-style silent meeting pipeline: a timed quiet pre-read of documents/proposals, followed by brief context alignment, open discussion/debate, and closing with action item locking.
The routine runs once from start to finish and terminates at the action items phase.

## Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Silent pre-read | `pre-read` | `review` | 5m | `null` | `autoAdvance` | `activeItem` | none |
| Context framing | `context` | `discussion` | 3m | `null` | `autoAdvance` | `activeItem` | none |
| Open discussion | `discussion` | `discussion` | 20m | `null` | `manualClear` | `activeItem` | none |
| Action items | `action-items` | `discussion` | 4m | `null` | `manualClear` | `activeItem` | none |

Transitions:
1. `pre-read` → `context` (`always`)
2. `context` → `discussion` (`always`)
3. `discussion` → `action-items` (`always`)

`action-items` is a terminal node with no outgoing transitions (`status: 'ended'`).

## Walk-through

1. The meeting begins. The host starts the session, triggering `onEnter(pre-read)`.
2. Participants silently read the proposal document for 5 minutes.
3. Upon timer expiry, the engine automatically advances to `context` (3m alignment).
4. After context framing, the engine transitions into `discussion` (20m). Because `completionPolicy` is `manualClear`, the meeting can conclude discussion early or extend debate without premature cutoff.
5. Advancing from `discussion` enters `action-items` (4m).
6. When action items are recorded, advancing past `action-items` finds no outgoing edge, transitioning the engine state to `status: 'ended'`.
