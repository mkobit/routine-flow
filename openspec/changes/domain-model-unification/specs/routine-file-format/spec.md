## MODIFIED Requirements

### Requirement: A routine file's PhaseGraph is defined in a single fenced JSON code block
The note body SHALL contain exactly one fenced JSON code block encoding a unified `PhaseGraph`-shaped object (`id`, `name`, `phases`, `transitions`). Each phase in `phases` SHALL conform to `PhaseNodeSchema` (containing `id`, `name`, optional `duration`, `onCompletion`, optional `taskSource`, optional `logTarget`, and `handlers`).

#### Scenario: Valid single code block parses
- **WHEN** the note body contains one fenced JSON code block with a well-formed unified PhaseGraph-shaped object
- **THEN** parsing SHALL succeed and produce the corresponding `PhaseGraph` value

## NEW Requirements

### Requirement: parseRoutineFile accepts terminal nodes and resolves next phase to null
`parseRoutineFile` and `checkPhaseGraphIntegrity` SHALL accept graphs with terminal phase nodes (phases with no outgoing transition edges). When a traversal reaches a terminal node, `resolveNextPhaseId` SHALL return `null`.

#### Scenario: Routine graph with terminal node parses and validates successfully
- **WHEN** a routine graph contains a phase node with no outgoing transitions
- **THEN** `checkPhaseGraphIntegrity` SHALL return no validation issues, and `resolveNextPhaseId` from that phase SHALL return `null`

#### Scenario: Traversal of terminal node transitions engine to ended status
- **WHEN** `completePhase` or `advancePhase` occurs on a terminal phase node where `resolveNextPhaseId` returns `null`
- **THEN** `engineReducer` SHALL transition `EngineState.status` to `'ended'`
