## ADDED Requirements

### Requirement: parseRoutineFile accepts queueCycle and futureDate completion policies
`parseRoutineFile` SHALL accept routine files whose phases declare `completionPolicy` with `kind: 'queueCycle'` or `kind: 'futureDate'` and valid `after` duration strings, and SHALL NOT reject them as unimplemented policies.

#### Scenario: Routine file with queueCycle policy parses successfully
- **WHEN** a routine file contains a phase with `completionPolicy: { kind: 'queueCycle' }`
- **THEN** `parseRoutineFile` SHALL return a successful parse result containing the graph

#### Scenario: Routine file with futureDate policy parses successfully
- **WHEN** a routine file contains a phase with `completionPolicy: { kind: 'futureDate', after: 'P1D' }`
- **THEN** `parseRoutineFile` SHALL return a successful parse result containing the graph with `after` converted to a `Temporal.Duration`
