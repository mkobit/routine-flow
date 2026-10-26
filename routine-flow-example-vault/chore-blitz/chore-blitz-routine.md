---
is-routine: true
---

# Chore blitz routine

Hand-authored routine file with queueExhausted terminal branch and completedItems batch write-back.

```json
{
  "id": "chore-blitz",
  "name": "Chore blitz",
  "phases": [
    {
      "id": "blitz",
      "label": "Chore blitz sprint",
      "kind": "focus",
      "duration": "PT15M",
      "taskSourceId": "chore-queue",
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "completedItems"
      },
      "actions": [
        {
          "id": "done",
          "label": "Done",
          "style": "primary",
          "payload": {
            "kind": "markDone"
          }
        }
      ],
      "onEnter": null,
      "onComplete": "write-back",
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "breather",
      "label": "Intermission breather",
      "kind": "break",
      "duration": "PT3M",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "actions": [],
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "wrap-up",
      "label": "Clean-up and wrap-up",
      "kind": "ritual",
      "duration": "PT5M",
      "taskSourceId": null,
      "completionPolicy": {
        "kind": "manualClear"
      },
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "actions": [],
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    }
  ],
  "transitions": [
    {
      "fromPhaseId": "blitz",
      "toPhaseId": "wrap-up",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "blitz",
      "toPhaseId": "breather",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "breather",
      "toPhaseId": "blitz",
      "condition": {
        "kind": "always"
      }
    }
  ]
}
```
