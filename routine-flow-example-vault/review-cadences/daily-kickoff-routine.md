---
is-routine: true
---

# Daily kickoff routine

Structured morning routine combining hydration, inbox triage, and top-priority focus sprint.

```json
{
  "id": "daily-kickoff",
  "name": "Daily kickoff routine",
  "phases": [
    {
      "id": "morning-hydration",
      "label": "Hydration and morning movement",
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
        "Drink a full glass of water",
        "Perform light stretch or mobility exercise"
      ]
    },
    {
      "id": "daily-inbox",
      "label": "Quick inbox triage",
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
        "Scan urgent messages and replies",
        "Capture unexpected morning requests",
        "Quickly file or discard non-actionable items"
      ]
    },
    {
      "id": "priority-focus",
      "label": "Daily top priority sprint",
      "kind": "focus",
      "duration": "PT25M",
      "taskSourceId": "projects-queue",
      "queryFilter": {
        "property": "note.status",
        "value": "active"
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
        "Select #1 priority task for today",
        "Eliminate all notifications and distractions",
        "Sprint with focused momentum"
      ]
    },
    {
      "id": "workday-launch",
      "label": "Day plan confirmation",
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
        "Review today calendar schedule",
        "Confirm deep focus blocks",
        "Launch into primary sprint"
      ]
    }
  ],
  "transitions": [
    {
      "fromPhaseId": "morning-hydration",
      "toPhaseId": "daily-inbox",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "daily-inbox",
      "toPhaseId": "priority-focus",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "daily-inbox",
      "toPhaseId": "priority-focus",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "priority-focus",
      "toPhaseId": "workday-launch",
      "condition": {
        "kind": "always"
      }
    }
  ]
}
```