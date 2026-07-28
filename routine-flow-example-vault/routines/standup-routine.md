---
is-routine: true
---

# Standup routine

Hand-authored routine file for manually verifying per-base routine selection (flow-gu1.23).
Mirrors [docs/examples/standup.md](../../docs/examples/standup.md)'s two-person round robin, with short durations so a manual pass doesn't take minutes per turn.

```json
{
  "id": "standup",
  "name": "Standup",
  "phases": [
    {
      "id": "alice",
      "label": "Alice's turn",
      "kind": "turn",
      "duration": "PT10S",
      "taskSourceId": null,
      "completionPolicy": { "kind": "noOp" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "bob",
      "label": "Bob's turn",
      "kind": "turn",
      "duration": "PT10S",
      "taskSourceId": null,
      "completionPolicy": { "kind": "noOp" },
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    }
  ],
  "transitions": [
    { "fromPhaseId": "alice", "toPhaseId": "bob", "condition": { "kind": "always" } },
    { "fromPhaseId": "bob", "toPhaseId": "alice", "condition": { "kind": "always" } }
  ]
}
```
