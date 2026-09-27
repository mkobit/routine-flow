---
is-routine: true
---

# Leitner box spaced review

Hand-authored routine definition for Leitner box spaced repetition reviews.

```json
{
  "id": "leitner-box",
  "name": "Leitner box spaced review",
  "phases": [
    {
      "id": "review",
      "name": "Card review",
      "duration": null,
      "onCompletion": "waitForManual",
      "taskSourceId": "review-queue",
      "logTarget": {
        "kind": "activeItem"
      },
      "actions": [
        {
          "id": "grade-again",
          "label": "Again (10m)",
          "style": "destructive",
          "payload": {
            "kind": "deferDuration",
            "after": "PT10M",
            "property": "routine-due",
            "box": 1
          }
        },
        {
          "id": "grade-hard",
          "label": "Hard (1d)",
          "payload": {
            "kind": "deferDuration",
            "after": "P1D",
            "property": "routine-due",
            "box": 2
          }
        },
        {
          "id": "grade-good",
          "label": "Good (3d)",
          "style": "primary",
          "payload": {
            "kind": "deferDuration",
            "after": "P3D",
            "property": "routine-due",
            "box": 3
          }
        },
        {
          "id": "grade-easy",
          "label": "Easy (7d)",
          "payload": {
            "kind": "deferDuration",
            "after": "P7D",
            "property": "routine-due",
            "box": 4
          }
        }
      ],
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "review",
      "to": "review",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
```
