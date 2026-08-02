---
sidebar_position: 2
---

# Getting started

This walkthrough takes you from an installed plugin to a running routine, then points you at a custom routine note.

## Prerequisite

Install and enable the plugin first.
See the [README](https://github.com/mkobit/routine-flow#installation) for installation.

## Add a Routine Timer view to a Base

Open an existing `.base` file or create a new one.
Add a new view and pick the **Routine Timer** view type.

## Configure the focus and break queue

The Routine Timer view exposes five options in Obsidian's Bases view-options UI:

- **Focus task property** (pre-filled `note.type`) and **Focus task value** (pre-filled `work`) — together they decide which notes appear in the focus queue.
- **Break task property** (pre-filled `note.type`) and **Break task value** (pre-filled `break`) — the same, for the break queue.
- **Routine file** — optional; see [Point at a custom routine note](#optional-point-at-a-custom-routine-note).

Left at their defaults, a note with frontmatter `type: work` shows up in the focus queue, and a note with `type: break` shows up in the break queue.
A note you want in the focus queue needs frontmatter like:

```yaml
---
type: "work"
---
```

## Run the default routine

The default routine runs 25 min focus, then 5 min break, repeating, with a 15 min long break after every fourth focus phase.

The controls:

- **Start** begins the current phase, and also resumes from a pause — the label stays "Start", it does not change to "Resume".
- **Pause** appears only while a phase is running.
- **Reset** opens a confirmation modal ("Reset routine? — its progress will be lost") and restarts the routine from the beginning.
- Clicking a task in the queue list starts a session against that specific note.

When a focus or break phase finishes and a note is active, a "Confirm write-back" modal proposes to increment a frontmatter property (default `sessions`) on that note.
Submit writes it; Cancel skips it.
This happens after breaks too, not only focus.

## Optional: point at a custom routine note

Set **Routine file** to a note whose frontmatter has `is-routine: true`.
Only such notes appear in the file picker.

The note's body must contain exactly one fenced ` ```json ` block shaped like a phase graph, with `id`, `name`, `phases[]`, and `transitions[]`.
Durations are ISO 8601 duration strings: `"PT10S"` is 10 seconds, `"PT25M"` is 25 minutes.

This minimal routine hands off between two phases, Alice and Bob, on a 10-second timer each:

````markdown
---
is-routine: true
---

```json
{
  "id": "standup",
  "name": "Standup",
  "phases": [
    {
      "id": "alice",
      "label": "Alice's turn",
      "kind": "turn",
      "duration": "PT10S",
      "taskSourceId": null,
      "completionPolicy": { "kind": "noOp" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "bob",
      "label": "Bob's turn",
      "kind": "turn",
      "duration": "PT10S",
      "taskSourceId": null,
      "completionPolicy": { "kind": "noOp" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    }
  ],
  "transitions": [
    { "fromPhaseId": "alice", "toPhaseId": "bob", "condition": { "kind": "always" } },
    { "fromPhaseId": "bob", "toPhaseId": "alice", "condition": { "kind": "always" } }
  ]
}
```
````

`taskSourceId` is `null` because neither phase has a queue.
For the completion-policy options that don't fully work yet, see [Usage notes & gotchas](./usage-notes).

## Where to go next

- [Usage notes & gotchas](./usage-notes) — things that trip people up.
- [Design & decisions](./design-notes) — why the plugin works the way it does.
