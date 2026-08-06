---
is-routine: true
---

# Chore list routine

Hand-authored routine file for manually verifying `manualClear` completion of a *duration-less* phase (flow-gu1.53).
Mirrors [dev-docs/examples/chore-list.md](../../dev-docs/examples/chore-list.md)'s rotating chore list: one phase per chore, each `duration: null` and cleared manually (Done, then Clear), wrapping back to the first chore.
Distinct from `manual-clear-routine.md`, which exercises `manualClear` on a *timed* phase — here `duration` is `null`, so the only way a phase completes is `finish-phase`.

```json
{
  "id": "chore-list",
  "name": "Chore list",
  "phases": [
    {
      "id": "dishes",
      "label": "Dishes",
      "kind": "chore",
      "duration": null,
      "taskSourceId": null,
      "completionPolicy": { "kind": "manualClear" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "laundry",
      "label": "Laundry",
      "kind": "chore",
      "duration": null,
      "taskSourceId": null,
      "completionPolicy": { "kind": "manualClear" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "tidy",
      "label": "Tidy up",
      "kind": "chore",
      "duration": null,
      "taskSourceId": null,
      "completionPolicy": { "kind": "manualClear" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    }
  ],
  "transitions": [
    { "fromPhaseId": "dishes", "toPhaseId": "laundry", "condition": { "kind": "always" } },
    { "fromPhaseId": "laundry", "toPhaseId": "tidy", "condition": { "kind": "always" } },
    { "fromPhaseId": "tidy", "toPhaseId": "dishes", "condition": { "kind": "always" } }
  ]
}
```
