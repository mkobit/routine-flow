---
is-routine: true
---

# Workday shutdown routine

End-of-day closure routine with inbox sweep, waiting-for review, and tomorrow planning.

```json
{
  "id": "workday-shutdown",
  "name": "Workday shutdown routine",
  "phases": [
    {
      "id": "inbox-sweep",
      "label": "Inbox zero sweep",
      "kind": "review",
      "duration": "PT10M",
      "taskSourceId": "inbox-queue",
      "queryFilter": {
        "property": "note.status",
        "value": "inbox"
      },
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "actions": [],
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null,
      "guidance": [
        "Clear email and communication inboxes",
        "Review sticky notes or temporary scratch files",
        "File all captured items into task system"
      ]
    },
    {
      "id": "waiting-check",
      "label": "Waiting-for check",
      "kind": "review",
      "duration": "PT5M",
      "taskSourceId": "waiting-queue",
      "queryFilter": {
        "property": "note.status",
        "value": "waiting"
      },
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "actions": [],
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null,
      "guidance": [
        "Review items pending external reply",
        "Send quick reminder pings if overdue"
      ]
    },
    {
      "id": "plan-tomorrow",
      "label": "Tomorrow planning",
      "kind": "ritual",
      "duration": "PT5M",
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
      "onExit": null,
      "guidance": [
        "Review tomorrow schedule and appointments",
        "Select top 3 outcomes for tomorrow",
        "Set out materials needed for morning"
      ]
    },
    {
      "id": "desk-tidy",
      "label": "Desk tidy and shutdown sign-off",
      "kind": "ritual",
      "duration": null,
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
      "onExit": null,
      "guidance": [
        "Clear and organize physical desk space",
        "Close all workspace applications and browser tabs",
        "Confirm shutdown complete"
      ]
    }
  ],
  "transitions": [
    {
      "fromPhaseId": "inbox-sweep",
      "toPhaseId": "waiting-check",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "inbox-sweep",
      "toPhaseId": "waiting-check",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "waiting-check",
      "toPhaseId": "plan-tomorrow",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "waiting-check",
      "toPhaseId": "plan-tomorrow",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "plan-tomorrow",
      "toPhaseId": "desk-tidy",
      "condition": {
        "kind": "always"
      }
    }
  ]
}
```