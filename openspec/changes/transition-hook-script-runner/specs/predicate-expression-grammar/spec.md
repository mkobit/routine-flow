## ADDED Requirements

### Requirement: A named predicate is authored as a restricted formula string in settings
The settings tab SHALL let a user create a named `'custom'` predicate by entering a formula string, evaluated against `fromPhaseId` and `visitCounts`, without requiring a separate vault file.

#### Scenario: A formula-authored predicate is selectable as a TransitionCondition's custom predicate
- **WHEN** a user creates a named predicate with a formula string in the settings tab
- **THEN** that name resolves via the configured `PredicateRegistry` to a `Predicate` evaluating that formula

### Requirement: The formula grammar supports comparisons, conditionals, and boolean operators only
The formula grammar SHALL support numeric/string comparison operators, an `if(condition, thenValue, elseValue)` form, and boolean operators (`and`/`or`/`not` or equivalent), evaluated against the visit-count data available to a `Predicate`. The grammar SHALL NOT support variable assignment, user-defined functions, loops, recursion, or any I/O operation.

#### Scenario: A comparison-and-conditional formula evaluates correctly
- **WHEN** a formula `if(visitCounts.focus >= 4, true, false)` is evaluated with `visitCounts.focus` equal to `4`
- **THEN** the predicate evaluates to `true`

#### Scenario: The grammar rejects an attempted I/O or assignment construct
- **WHEN** a formula string contains a construct outside the supported grammar (e.g. an attempted variable assignment or function definition)
- **THEN** registering that formula fails validation rather than silently accepting unsupported syntax

### Requirement: Formula evaluation is synchronous and requires no execution isolation
Evaluating a registered formula-authored `Predicate` SHALL be synchronous, performed in-process on the same thread as `engineReducer`, with no Worker, message-passing, or serialization boundary involved.

#### Scenario: A formula-authored predicate evaluates inline within resolveNextPhaseId
- **WHEN** `resolveNextPhaseId` evaluates a `'custom'` transition whose predicate name resolves to a formula-authored `Predicate`
- **THEN** the predicate's result is available synchronously, with no `await` or asynchronous callback involved

### Requirement: Identifier resolution is restricted to a fixed whitelist, not general property access
The grammar SHALL resolve identifiers and member access only against a fixed whitelist (`fromPhaseId`, and each phase id's own key under `visitCounts`) and SHALL NOT permit resolution against any other property, including prototype-chain properties of the underlying values.

#### Scenario: A prototype-chain reference is rejected
- **WHEN** a formula string references `visitCounts.constructor` or `visitCounts.__proto__` (or an equivalent prototype-chain property)
- **THEN** registering that formula fails validation rather than resolving to a non-whitelisted value

### Requirement: An invalid formula fails registration, not evaluation
A formula string that cannot be parsed under the supported grammar SHALL fail at the point it's registered in settings, with a validation error shown to the user, rather than being accepted and failing (or silently misbehaving) when later evaluated as a transition is resolved.

#### Scenario: An unparseable formula is rejected at registration time
- **WHEN** a user attempts to save a named predicate whose formula string cannot be parsed
- **THEN** the settings tab shows a validation error and does not save the predicate as resolvable
