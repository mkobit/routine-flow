---
is-routine: true
---

# Workout routine

Hand-authored routine file for manually verifying `finish-phase` completion of a duration-less phase (flow-gu1.24).
Mirrors [docs/examples/workout.md](../../docs/examples/workout.md)'s warmup/set/rest shape, with short durations so a manual pass doesn't take minutes.
`set`'s `taskSourceId` is `null` here (not `exercises`) — real `TaskSource` resolution is flow-djx's scope, not this fixture's.

```json
{
  "id": "workout",
  "name": "Workout",
  "phases": [
    {
      "id": "warmup",
      "label": "Warm-up",
      "kind": "warm-up",
      "duration": "PT5S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "set",
      "label": "Set",
      "kind": "set",
      "duration": null,
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "rest",
      "label": "Rest",
      "kind": "rest",
      "duration": "PT5S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    }
  ],
  "transitions": [
    { "fromPhaseId": "warmup", "toPhaseId": "set", "condition": { "kind": "always" } },
    { "fromPhaseId": "set", "toPhaseId": "rest", "condition": { "kind": "always" } },
    { "fromPhaseId": "rest", "toPhaseId": "set", "condition": { "kind": "always" } }
  ]
}
```
