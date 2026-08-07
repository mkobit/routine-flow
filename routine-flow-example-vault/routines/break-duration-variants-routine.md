---
is-routine: true
---

# Break-duration variants routine

Hand-authored routine file for manually verifying that break *duration* varies with a `TransitionCondition` (flow-gu1.52).
Mirrors [dev-docs/examples/break-duration-variants.md](../../dev-docs/examples/break-duration-variants.md): one focus phase feeds three break phases of different lengths, and stacked `everyNth` transitions pick which break comes next.
Extends the shipped default graph (`DEFAULT_PHASE_GRAPH`, `src/timer/phase-graph.ts`), which selects only between one short and one long break with a single `everyNth(n=4)`; here a third tier and a second `everyNth` show the general selection mechanism.

Transitions from `focus` are declared longest-cadence first because `resolveNextPhaseId` takes the first satisfied condition: at focus visit 8 both `everyNth(n=8)` and `everyNth(n=4)` match, and declaring the `n=8` edge first is what makes the long break win.

Durations are compressed to seconds (like `write-back-variants-routine.md`) so a full 8-focus super-cycle is observable by hand; the real pomodoro semantics are minutes.

```json
{
  "id": "break-duration-variants",
  "name": "Break-duration variants",
  "phases": [
    {
      "id": "focus",
      "label": "Focus",
      "kind": "focus",
      "duration": "PT5S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "short-break",
      "label": "Short break",
      "kind": "break",
      "duration": "PT3S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "medium-break",
      "label": "Medium break",
      "kind": "break",
      "duration": "PT6S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "long-break",
      "label": "Long break",
      "kind": "break",
      "duration": "PT12S",
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
    { "fromPhaseId": "focus", "toPhaseId": "long-break", "condition": { "kind": "everyNth", "n": 8 } },
    { "fromPhaseId": "focus", "toPhaseId": "medium-break", "condition": { "kind": "everyNth", "n": 4 } },
    { "fromPhaseId": "focus", "toPhaseId": "short-break", "condition": { "kind": "always" } },
    { "fromPhaseId": "short-break", "toPhaseId": "focus", "condition": { "kind": "always" } },
    { "fromPhaseId": "medium-break", "toPhaseId": "focus", "condition": { "kind": "always" } },
    { "fromPhaseId": "long-break", "toPhaseId": "focus", "condition": { "kind": "always" } }
  ]
}
```
