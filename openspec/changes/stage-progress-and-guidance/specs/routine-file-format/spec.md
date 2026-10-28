# Spec Delta

## ADDED Requirements

### Requirement: parseRoutineFile accepts optional phase guidance checklist items
`parseRoutineFile` SHALL accept routine files whose phases declare optional `guidance` or `checklist` string arrays.
The loader SHALL preserve these strings as readonly checklist items in the parsed `PhaseNode`.

#### Scenario: Phase declares guidance checklist items
- **WHEN** a phase in a routine file contains `guidance: ["Review inbox", "Process unread notes"]`
- **THEN** `parseRoutineFile` returns a `PhaseGraph` whose corresponding `PhaseNode` contains the guidance strings

#### Scenario: Phase declares checklist alias
- **WHEN** a phase in a routine file contains `checklist: ["Step 1", "Step 2"]`
- **THEN** `parseRoutineFile` normalizes the items into `PhaseNode.guidance`
