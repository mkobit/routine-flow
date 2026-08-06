---
is-routine: true
---

# Write-back variants routine

Hand-authored routine file for manually verifying the write-back hook's per-phase configuration surface (flow-gu1.51).
Mirrors [dev-docs/examples/write-back.md](../../dev-docs/examples/write-back.md): three phases, each in a different write-back state.
Distinct from the shipped default graph (`DEFAULT_PHASE_GRAPH`, `src/timer/phase-graph.ts`), which puts every phase in the same `onComplete: write-back` + `activeItem` state — here each phase varies one axis so all three outcomes are observable in a single run.

- `active-write` opts in with `logTarget: activeItem` — on completion it prompts to write the configured property to the active file.
- `callback-write` opts in with `logTarget: { kind: 'callback', name: 'dailyNote' }` — no resolver is registered (`src/main.ts` wires `logTargetResolverRegistry: { resolve: () => undefined }`), so it resolves no target and skips silently.
- `no-write` opts out with `onComplete: null` — completing it never reads a file, prompts, or writes.

```json
{
  "id": "write-back-variants",
  "name": "Write-back variants",
  "phases": [
    {
      "id": "active-write",
      "label": "Active-item write",
      "kind": "focus",
      "duration": "PT10S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "activeItem" },
      "onEnter": null,
      "onComplete": { "name": "write-back", "params": {} },
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "callback-write",
      "label": "Callback write",
      "kind": "focus",
      "duration": "PT10S",
      "taskSourceId": null,
      "completionPolicy": null,
      "notification": null,
      "logTarget": { "kind": "callback", "name": "dailyNote" },
      "onEnter": null,
      "onComplete": { "name": "write-back", "params": {} },
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "no-write",
      "label": "No write-back",
      "kind": "break",
      "duration": "PT10S",
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
    { "fromPhaseId": "active-write", "toPhaseId": "callback-write", "condition": { "kind": "always" } },
    { "fromPhaseId": "callback-write", "toPhaseId": "no-write", "condition": { "kind": "always" } },
    { "fromPhaseId": "no-write", "toPhaseId": "active-write", "condition": { "kind": "always" } }
  ]
}
```
