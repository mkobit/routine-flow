## MODIFIED Requirements

### Requirement: EdgeGuard evaluates transition conditions purely and synchronously
Every `TransitionEdge` in a `PhaseGraph` SHALL specify an `EdgeGuard` (`always`, `everyNth`, `queueExhausted`, `custom`). The transition resolver SHALL evaluate `guard` as a pure, synchronous predicate without side effects.

#### Scenario: EdgeGuard evaluates synchronously during next phase resolution
- **WHEN** `resolveNextPhaseId` or `findNextPhase` evaluates graph edges
- **THEN** matching `EdgeGuard`s SHALL return `true` or `false` synchronously without triggering file mutations or network I/O
