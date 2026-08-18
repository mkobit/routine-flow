## ADDED Requirements

### Requirement: Bundled routine presets are scaffolded through the same mechanism as the onboarding example
The system SHALL support scaffolding more than one named, pre-built routine preset into the vault (each its own routine note plus any accompanying `.base`/task notes), using the same file-creation mechanism the onboarding Pomodoro example already uses, rather than requiring a user to hand-author a `PhaseGraph` JSON block from scratch to get a working, customized routine.

#### Scenario: A non-Pomodoro preset scaffolds a complete, working routine
- **WHEN** a user invokes scaffolding for a bundled preset other than the default Pomodoro example
- **THEN** the system creates that preset's routine note (with a valid fenced JSON `PhaseGraph` block) and any accompanying `.base`/task notes it needs, without the user editing JSON directly

#### Scenario: Scaffolding an already-scaffolded preset does not overwrite existing files
- **WHEN** a user invokes scaffolding for a preset whose files already exist at their scaffold paths
- **THEN** the system leaves the existing files untouched and reports them as skipped, matching `scaffoldExampleRoutine`'s existing per-file skip behavior

## REMOVED Requirements

### Requirement: parseRoutineFile accepts queueCycle and futureDate completion policies
**Reason**: `CompletionPolicy.queueCycle`/`futureDate` are removed as distinct variants, collapsed into `{ kind: 'autoAdvance', actions: [...] }` (see `completion-policy-execution`). `parseRoutineFile` validates against `PhaseGraphSchema`, which no longer defines these variants at all.
**Migration**: a routine file's `{ kind: 'queueCycle' }` becomes `{ kind: 'autoAdvance', actions: [{ kind: 'queueCycle' }] }`; `{ kind: 'futureDate', after }` becomes `{ kind: 'autoAdvance', actions: [{ kind: 'deferDuration', after }] }`.
