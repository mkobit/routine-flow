---
is-routine: true
---

# Weekly GTD review routine

GTD weekly review stepping through inbox clear, active projects, waiting-for follow-ups, and weekly planning.

```json
{
  "id": "weekly-gtd",
  "name": "Weekly GTD review",
  "phases": [
    {
      "id": "inbox-clear",
      "label": "Process inbox to zero",
      "kind": "review",
      "duration": "PT15M",
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
        "Process all loose physical papers and notes",
        "Triage email inboxes down to zero",
        "Clarify and convert inbox tasks to next actions"
      ]
    },
    {
      "id": "project-review",
      "label": "Active project review",
      "kind": "review",
      "duration": "PT20M",
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
        "Confirm every active project has at least one next action",
        "Archive completed projects",
        "Identify blocked project deliverables"
      ]
    },
    {
      "id": "waiting-review",
      "label": "Waiting-for follow-ups",
      "kind": "review",
      "duration": "PT10M",
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
        "Follow up on overdue delegated items",
        "Record received updates",
        "Archive resolved waiting-for items"
      ]
    },
    {
      "id": "someday-maybe",
      "label": "Someday and maybe review",
      "kind": "ritual",
      "duration": "PT10M",
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
        "Review someday/maybe list for relevant project ideas",
        "Transfer viable ideas into active projects",
        "Discard obsolete interests"
      ]
    },
    {
      "id": "weekly-planning",
      "label": "Weekly commitments and focus",
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
        "Choose 3 major outcome goals for the week",
        "Calendar deep focus time blocks",
        "Review personal and professional commitments"
      ]
    }
  ],
  "transitions": [
    {
      "fromPhaseId": "inbox-clear",
      "toPhaseId": "project-review",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "inbox-clear",
      "toPhaseId": "project-review",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "project-review",
      "toPhaseId": "waiting-review",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "project-review",
      "toPhaseId": "waiting-review",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "waiting-review",
      "toPhaseId": "someday-maybe",
      "condition": {
        "kind": "queueExhausted"
      }
    },
    {
      "fromPhaseId": "waiting-review",
      "toPhaseId": "someday-maybe",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "someday-maybe",
      "toPhaseId": "weekly-planning",
      "condition": {
        "kind": "always"
      }
    }
  ]
}
```