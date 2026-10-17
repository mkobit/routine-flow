---
is-routine: true
---

# Random task selector routine

Routine configuration note for randomized task selection, promotion, and interval timing.

```json
{
  "id": "random-selector",
  "name": "Random task selector",
  "phases": [
    {
      "id": "selector",
      "name": "Spin task wheel",
      "label": "Spin task wheel",
      "kind": "selector",
      "duration": null,
      "onCompletion": "waitForManual",
      "taskSourceId": "selector-queue",
      "queryFilter": {
        "property": "note.type",
        "value": "random-selector-task"
      },
      "selector": {
        "autoSpin": false,
        "promoteToFront": true
      },
      "handlers": {}
    },
    {
      "id": "focus",
      "name": "Focus sprint",
      "label": "Focus sprint",
      "kind": "focus",
      "duration": "PT25M",
      "onCompletion": "autoAdvance",
      "taskSourceId": "selector-queue",
      "queryFilter": {
        "property": "note.type",
        "value": "random-selector-task"
      },
      "handlers": {}
    },
    {
      "id": "short-break",
      "name": "Short break",
      "label": "Short break",
      "kind": "break",
      "duration": "PT5M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "selector",
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "focus",
      "to": "short-break",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "short-break",
      "to": "selector",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
```