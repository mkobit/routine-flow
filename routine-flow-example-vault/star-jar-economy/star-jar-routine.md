---
is-routine: true
---

# Star jar reward routine

Stateful token economy routine that accumulates task stars into a tracker note and branches to a prize celebration break at 15 stars.

```json
{
  "id": "star-jar",
  "name": "Star jar reward routine",
  "trackerFilePath": "star-jar-economy/Star-Jar-Tracker.md",
  "phases": [
    {
      "id": "focus",
      "label": "Focus session",
      "kind": "focus",
      "duration": "PT25M",
      "taskSourceId": "star-tasks",
      "logTarget": {
        "kind": "activeItem"
      },
      "badges": [
        {
          "property": "stars",
          "label": "Stars",
          "icon": "star",
          "variant": "accent"
        }
      ],
      "handlers": {
        "onComplete": [
          {
            "kind": "preset",
            "preset": "accumulateReward"
          }
        ]
      },
      "onCompletion": "waitForManual"
    },
    {
      "id": "short-break",
      "label": "Short break",
      "kind": "break",
      "duration": "PT5M",
      "onCompletion": "autoAdvance"
    },
    {
      "id": "prize-break",
      "label": "Prize celebration break",
      "kind": "break",
      "duration": "PT30M",
      "onCompletion": "autoAdvance",
      "handlers": {
        "onExit": [
          {
            "kind": "preset",
            "preset": "resetReward"
          }
        ]
      }
    }
  ],
  "transitions": [
    {
      "from": "focus",
      "to": "prize-break",
      "guard": {
        "kind": "custom",
        "predicate": "star-jar-full"
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
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "prize-break",
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
```