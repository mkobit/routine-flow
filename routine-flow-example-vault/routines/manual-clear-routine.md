---
is-routine: true
---

# Manual clear routine

Hand-authored routine file for manually verifying the `manualClear` completionPolicy's advance control (flow-039).

```json
{
  "id": "manual-clear",
  "name": "Manual clear",
  "phases": [
    {
      "id": "focus",
      "label": "Focus",
      "kind": "focus",
      "duration": "PT5S",
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
      "id": "break",
      "label": "Break",
      "kind": "break",
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
    { "fromPhaseId": "focus", "toPhaseId": "break", "condition": { "kind": "always" } },
    { "fromPhaseId": "break", "toPhaseId": "focus", "condition": { "kind": "always" } }
  ]
}
```
