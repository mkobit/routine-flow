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
      "label": "Card review",
      "kind": "review",
      "duration": null,
      "taskSourceId": "review-queue",
      "queryFilter": {
        "property": "note.type",
        "value": "flashcard"
      },
      "completionPolicy": {
        "kind": "manualClear"
      },
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null,
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
      ]
    }
  ],
  "transitions": [
    {
      "fromPhaseId": "review",
      "toPhaseId": "review",
      "condition": {
        "kind": "always"
      }
    }
  ]
}
```