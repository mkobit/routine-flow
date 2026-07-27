## Why

flow-gu1.63 raised two distinct, currently-undecided i18n-adjacent concerns: (1) whether/how to use `Intl.DurationFormat`/`Temporal.Duration` for human-readable duration text as opposed to the plugin's existing `mm:ss` numeral display, and (2) whether to build UI string translation infrastructure at all, and if so with what library. Neither has an implementation-ready answer today, and the bead's own acceptance criteria calls for a scoping doc, not code, as the next step. This blocks nothing urgent, but leaves future duration-bearing surfaces (flow-gu1.56/flow-gu1.57 notification copy) without a stated convention to follow when they're built.

## What Changes

- Add `design.md` deciding:
  - Which surfaces need `Intl.DurationFormat`/`Temporal.Duration`-based duration-as-words text today (none, confirmed by audit) and the standard to apply once flow-gu1.56/flow-gu1.57 or similar surfaces are built.
  - Whether to build UI string translation infrastructure now, and if so which approach (hand-rolled catalog vs. `@formatjs/intl` vs. `i18next` vs. `lingui`), grounded in the plugin's actual string surface (~53 hardcoded strings across 7 files) and esbuild single-bundle output.
  - An initial target-language list and the trigger for adding non-English locales.
  - A string-extraction/lint workflow so new hardcoded strings don't silently bypass the catalog once one exists.
- File implementation sub-beads under flow-gu1.63 for whichever pieces the scoping decides are worth building now (if any) — none, per this scoping's decisions (see design.md D5).
- Close flow-gu1.63 once this document exists — like `ui-surface-inventory` closing flow-gu1.20.1, the bead's stated deliverable (a scoping decision) is satisfied by the doc itself; unlike that precedent, no follow-up beads are filed, since every decision here resolves to "state the standard, defer implementation until a concrete trigger fires" rather than mapping onto immediate work.
- No `src/` or `styles.css` changes. This is a documentation/scoping artifact only.

## Capabilities

### New Capabilities
- `i18n-scoping`: the durable scoping decision for duration formatting and UI string translation, serving as the reference future duration- or translation-touching work must follow.

### Modified Capabilities
(none — no existing capability's runtime requirements change; this is a documentation artifact, not a behavior change)

## Impact

- New: `openspec/changes/i18n-scoping/` (this change), including `design.md`.
- bd: flow-gu1.63 closed once scoping is complete; sub-beads filed for any pieces scoped as worth implementing now.
- No `src/` or `styles.css` changes.
