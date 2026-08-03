---
sidebar_position: 4
---

# Usage notes & gotchas

Things that trip people up.

## Write-back fires on every phase, not just focus

The Settings description reads "Frontmatter property incremented when a focus phase completes," but the shipped default routine wires the same `onComplete` write-back hook on all three phases: focus, short break, and long break.
Expect the "Confirm write-back" modal after breaks too, whenever a note is active.

## `completionPolicy: "queueCycle"` and `"futureDate"` aren't executed yet

A routine file that uses either fails to load, with an error naming the offending phase.
This is a deliberate load-time rejection, not a bug to work around.

## "Custom rules" are transition conditions, not completion policies

A name-and-formula pair under Settings → "Custom rules" (for example `visitCounts.focus >= 4`) is referenced from a phase graph's `transitions[].condition` as `{"kind": "custom", "predicate": "<name>"}`.
It decides whether to take a transition; it does not decide when a phase completes.

## Script hooks run unsandboxed and are reviewed only once

A `.js` file bound under Settings → "Script hooks" runs in-process, with no sandbox, whenever the phase event you bind it to — `onEnter`, `onComplete`, `onSkip`, or `onExit` — fires.
You review its source in the "Trust ... ?" confirmation the first time you bind it.
Editing the file on disk afterward does not trigger another review; only removing and re-adding the binding does.

## The `notification` phase field does nothing yet

It is valid in a routine file's JSON as `{"sound": ..., "systemNotification": ...}`, but nothing in the plugin reads it yet.
Don't rely on it for now.

## The side panel can't start a routine on its own

The side panel mirrors whichever routine is currently running and gives you Pause, Resume, Done, Clear, and Reset, but it has no Start control.
Start a session from a Base's Routine Timer view first; the side panel then stays in sync with it.

## Resuming from a pause is labeled differently depending on where you click

The Base view's button always reads "Start," even when it's resuming a paused phase — it never relabels to "Resume."
The side panel and the status bar do call it "Resume" (or toggle on click, for the status bar).
Functionally identical either way, just an inconsistent label across the three surfaces.
