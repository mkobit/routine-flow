## ADDED Requirements

### Requirement: Duration-formatting standard
`design.md` SHALL audit every current surface for duration/date text rendered as words rather than digits, state which (if any) need `Intl.DurationFormat`/`Temporal.Duration` today, and SHALL state the standard to apply once a duration-as-words surface (e.g. flow-gu1.56/flow-gu1.57 notification copy) is built.

#### Scenario: Current numeral-only surfaces are not misclassified
- **WHEN** a reader checks `design.md`'s audit against `src/timer/format.ts`'s `mm:ss` countdown display
- **THEN** the audit states this is a numeral display, not translated/human-readable duration text, and does not require `Intl.DurationFormat`

#### Scenario: Future surfaces have a stated standard to follow
- **WHEN** flow-gu1.56 or flow-gu1.57 (or any future surface) needs to render a duration or date as words
- **THEN** `design.md` states the concrete API (`Intl.DurationFormat`, `Temporal.Duration`) and locale source those surfaces must use, so the standard doesn't need re-deciding per bead

### Requirement: UI string translation infrastructure decision
`design.md` SHALL decide whether to build UI string translation infrastructure now, and if so, name a specific approach (hand-rolled catalog, `@formatjs/intl`, `i18next`, or `lingui`) with rationale grounded in the plugin's actual string surface and build constraints, rather than leaving the choice open.

#### Scenario: Decision is grounded in the plugin's actual scale
- **WHEN** a reader checks the rationale behind the chosen approach
- **THEN** it cites the audited count of hardcoded user-facing strings and files (`src/settings.ts`, `src/views/*.ts`, `src/main.ts`), not a generic best-practice claim

#### Scenario: Decision accounts for esbuild single-bundle output and locale source
- **WHEN** a reader checks how the chosen approach obtains the active locale and what it adds to the bundle
- **THEN** `design.md` states it uses Obsidian's own `getLanguage()` API (the language Obsidian's own Settings > General > Language sets) rather than `navigator.language`, and states the approach's added dependency footprint (if any)

### Requirement: Target language list and trigger
`design.md` SHALL state an initial target-language list (which may be English-only) and the concrete trigger condition for adding each additional locale, rather than an open-ended "TBD".

#### Scenario: No speculative upfront translation
- **WHEN** a reader checks the initial target-language list
- **THEN** it does not include translated strings for a language with no stated demand signal, consistent with not building speculative features ahead of need

### Requirement: String-extraction workflow
`design.md` SHALL define how new user-facing strings are kept out of source files once a message catalog exists (a lint rule, a script, or an explicit manual-review convention), and how the currently-hardcoded strings identified by the audit would migrate into the catalog if/when built.

#### Scenario: Workflow prevents silent catalog bypass
- **WHEN** a reader checks how a future PR that adds a new hardcoded UI string would be caught
- **THEN** `design.md` names a specific enforcement mechanism (e.g. an eslint rule, or an explicit statement that none is being built yet and why)

### Requirement: Sub-bead split
`design.md` SHALL enumerate the bd sub-beads to file under flow-gu1.63 for whichever pieces of this scoping are decided worth implementing now, or state explicitly that none are being filed yet and why.

#### Scenario: Every implementation decision maps to a bead or an explicit deferral
- **WHEN** a reader cross-references `design.md`'s decisions against the sub-beads filed
- **THEN** each decision that calls for future code has a corresponding bd issue, or `design.md` states explicitly that no implementation is warranted yet
