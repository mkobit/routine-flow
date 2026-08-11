# routine-file-format Specification

## Purpose
TBD - created by archiving change per-base-routine-selection. Update Purpose after archive.
## Requirements
### Requirement: Routine files are discoverable via a frontmatter marker
A vault note SHALL be recognized as a candidate routine file when its frontmatter contains `is-routine: true`.

#### Scenario: Note with the marker is recognized
- **WHEN** a vault note's frontmatter includes `is-routine: true`
- **THEN** it SHALL be treated as a candidate routine file for parsing

#### Scenario: Note without the marker is ignored
- **WHEN** a vault note's frontmatter does not include `is-routine: true`
- **THEN** it SHALL NOT be treated as a routine file

### Requirement: A routine file's PhaseGraph is defined in a single fenced JSON code block
The note body SHALL contain exactly one fenced JSON code block encoding a `PhaseGraph`-shaped object (`id`, `name`, `phases`, `transitions`).

#### Scenario: Valid single code block parses
- **WHEN** the note body contains one fenced JSON code block with a well-formed PhaseGraph-shaped object
- **THEN** parsing SHALL succeed and produce the corresponding `PhaseGraph` value once duration conversion and schema validation pass

### Requirement: Duration fields are declared as ISO 8601 duration strings and converted before validation
`phases[].duration` and `phases[].completionPolicy.after` (when `completionPolicy.kind` is `futureDate`) SHALL be authored as ISO 8601 duration strings (e.g. `"PT25M"`) in the routine file's JSON block. The loader SHALL convert each such string to a `Temporal.Duration` before running `PhaseGraphSchema` validation.

#### Scenario: Well-formed duration string converts
- **WHEN** a phase's `duration` field is the string `"PT25M"`
- **THEN** the parsed PhaseGraph's corresponding phase has a `Temporal.Duration` of 25 minutes, not a string

#### Scenario: Malformed duration string fails parsing
- **WHEN** a phase's `duration` field is a string that is not a valid ISO 8601 duration (e.g. `"25 minutes"`)
- **THEN** parsing SHALL fail with a `RoutineParseError` and SHALL NOT throw

### Requirement: parseRoutineFile never throws
`parseRoutineFile(content: string)` SHALL return a result distinguishing success (a `PhaseGraph`) from failure (a `RoutineParseError`), for any input, including malformed JSON, JSON not matching `PhaseGraphSchema`, or a missing or multiple fenced code block.

#### Scenario: Malformed JSON produces a parse error, not a thrown exception
- **WHEN** the fenced code block's content is not valid JSON
- **THEN** `parseRoutineFile` SHALL return a failure result carrying a `RoutineParseError`, and SHALL NOT throw

#### Scenario: Schema-invalid JSON produces a parse error with detail
- **WHEN** the fenced code block's content is valid JSON but fails `PhaseGraphSchema` validation
- **THEN** `parseRoutineFile` SHALL return a failure result whose `RoutineParseError` carries enough detail (the Zod issue path and message) to render a useful error message

#### Scenario: Missing or multiple code blocks produce a parse error
- **WHEN** the note body contains zero fenced JSON code blocks, or more than one
- **THEN** `parseRoutineFile` SHALL return a failure result carrying a `RoutineParseError`, and SHALL NOT throw

### Requirement: parseRoutineFile accepts queueCycle and futureDate completion policies
`parseRoutineFile` SHALL accept routine files whose phases declare `completionPolicy` with `kind: 'queueCycle'` or `kind: 'futureDate'` and valid `after` duration strings, and SHALL NOT reject them as unimplemented policies.

#### Scenario: Routine file with queueCycle policy parses successfully
- **WHEN** a routine file contains a phase with `completionPolicy: { kind: 'queueCycle' }`
- **THEN** `parseRoutineFile` SHALL return a successful parse result containing the graph

#### Scenario: Routine file with futureDate policy parses successfully
- **WHEN** a routine file contains a phase with `completionPolicy: { kind: 'futureDate', after: 'P1D' }`
- **THEN** `parseRoutineFile` SHALL return a successful parse result containing the graph with `after` converted to a `Temporal.Duration`

