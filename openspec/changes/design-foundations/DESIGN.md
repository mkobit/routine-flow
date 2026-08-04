# Design foundations — Routine Flow

## Purpose

`openspec/changes/ui-surface-inventory/design.md` briefs all 12 UI surfaces independently but explicitly leaves the *cross-surface* visual language undefined — a color system for states, a typographic scale, a spacing scale, an iconography set.
Without it, briefing each surface to Stitch (or implementing it directly) risks 12 visually inconsistent one-off screens.
This document supplies that shared vocabulary, referenced by the same #1–#12 surface numbering `design.md`/`surface-model.md` use.

**Grounding convention:** this document names Obsidian CSS custom properties and Lucide icon names, not resolved hex/px values.
Theme-native means those values are only real once resolved against a specific Obsidian theme (light or dark, default or user-installed) — there is no single canonical value to record here.
Resolved values must be pulled from a running Obsidian instance (`bun run vault:dev` / `vault:dev:headless`) at the point a mockup is actually generated (flow-gu1.19.6, and each flow-gu1.19.8–13 mockup bead), not guessed or hardcoded in this document.

## Decision: theme-native, with one minimal accent layer

Confirmed with Mike, 2026-07-23.

- **Base chrome** (backgrounds, text, borders, existing interactive elements): maps 1:1 to Obsidian's own CSS custom properties.
  No plugin-authored hex value anywhere in this category.
- **One additional accent layer**, reserved only for a gap in Obsidian's own semantic vocabulary.
  Exactly one gap exists today: distinguishing a **paused** timer from a **running** one — Obsidian has `--text-error`/`--text-success`/`--text-warning`/`--interactive-accent`, but nothing that reads as "in progress but held."
  - Resolution: use Obsidian's own extended palette variable, `--color-orange` (documented, most built-in and community themes define it), rather than a hand-picked brand hue — this keeps the "accent layer" inside Obsidian's own vocabulary instead of introducing anything genuinely custom.
    Verified (flow-gu1.19.14, 2026-07-24) against the e2e-launched Obsidian instance (app 1.12.7 — the `obsidian` devDependency pins `1.13.1` for types only, the actual e2e app is older; re-verify if that pin is ever bumped): `--color-orange` resolves in both bundled themes (light `#ec7500`, dark `#e9973f`), and is byte-identical to `--text-warning` in both — Obsidian's own default theme currently aliases the two, so the documented fallback is presently redundant, not a hedge against a real gap.
    Keep the fallback anyway: it protects against a community theme that defines one without the other.
  - This is the *only* place a non-Obsidian **color** value is used (the countdown font-size multiplier below is a separate, non-color departure — see Open Questions).
    If a future surface turns up a second real color gap, extend this section deliberately — don't accumulate more accents by default.

### Why not the alternatives

- **Fully theme-native, zero accent** was close, but "paused vs. running" is a real communication gap: `design.md` surfaces #2 (loading), #3 (error), and #5 (empty-queue) are called out as "reduc[ing] to short strings today and... easy to confuse with each other," and the running/paused distinction has the same shape — an accent-free version would rely entirely on text, repeating the exact problem this epic exists to fix.
- **Custom brand identity** was rejected: this plugin is embedded inside whatever theme the user has chosen; a distinctive independent palette fights that context and adds a second, plugin-specific color system to maintain indefinitely.

## Color system — semantic state mapping

| Plugin state | Obsidian variable | Used by (surfaces) |
| :-- | :-- | :-- |
| Running | `--interactive-accent` / `--text-accent` | #1 |
| Paused | `--color-orange` (fallback `--text-warning`) | #1 |
| Stopped / informational (not an error) | `--text-muted` | #1 (idle queue), #4 |
| Error | `--text-error` / `--background-modifier-error` | #3 |
| Warning / destructive confirmation | `--text-warning`, Obsidian's warning/destructive button convention | #7 |
| Success / write confirmed | `--text-success` / `--background-modifier-success` | #6 (if a post-submit confirmation is ever added) |
| Loading / in progress | `--text-muted` text + Lucide `loader-2` (spin) | #2 |
| Empty / no items | `--text-muted` text + iconography (see below) | #5 |
| Default body text | `--text-normal` | all |
| Faint / tertiary text | `--text-faint` | queue secondary metadata |
| Borders / dividers | `--background-modifier-border` | modal field grouping (#6, #7), settings groups (#8) |
| Surface background | `--background-primary` (panel/modal) | all |

Note: #2 (loading), #4 (inert), and #5 (empty) all resolve to `--text-muted` — color alone does not distinguish them from each other.
That distinction is carried by the iconography table below (`loader-2` vs. `info` vs. `inbox`/`list-x`) plus copy, not by color.
Don't assume the color system alone resolves the confusability `design.md` #2/#3/#5 flags.

## Typography scale

Maps Obsidian's UI font-size variables onto the hierarchy `design.md` already establishes per surface (e.g. #1: "large countdown, smaller phase/status text").

| Role | Obsidian variable | Applies to |
| :-- | :-- | :-- |
| Countdown (largest, dominant) | `--routine-flow-countdown-size: calc(var(--font-ui-large) * 1.8)` — confirmed (flow-gu1.19.14): raw `--font-ui-large` (20px) is only 1.33x `--font-ui-medium` (15px), too close to read as dominant; the 1.8x multiplier (36px) gives a clear 2.4x hierarchy over the phase label (see Open Questions) | #1 header |
| Phase label / status | `--font-ui-medium` | #1 header secondary line |
| Body / field text | `--font-ui-small` | modal fields (#6, #7), settings (#8) |
| Secondary / muted metadata | `--font-ui-smaller` | queue item metadata, descriptions |
| Weight | `--font-normal` default; `--font-bold` reserved for the countdown and primary CTA labels only | — |

## Spacing scale

Use Obsidian's `--size-4-*` token scale (its 4px-based spacing system) rather than inventing new pixel values.

| Tier | Obsidian variable(s) | Applies to |
| :-- | :-- | :-- |
| Tight | `--size-4-1` / `--size-4-2` | control-row gaps, list-item internal padding |
| Standard | `--size-4-3` / `--size-4-4` | field-to-field spacing in modals, section padding |
| Loose | `--size-4-5` and above | panel-to-panel spacing, group separation |

## Iconography

Obsidian ships Lucide; use `setIcon()` / the Icon component with these semantic assignments.
Verify each name still resolves in the installed Lucide set during implementation — Lucide occasionally renames icons across versions.
Three of the names below are known-renamed in current Lucide (kept here as the names to search for first, since which alias Obsidian's bundled version resolves is unverified): `loader-2` → `loader-circle`, `alert-circle` → `circle-alert`, `alert-triangle` → `triangle-alert`.

| Meaning | Icon | Surfaces |
| :-- | :-- | :-- |
| Start / running | `play` | #1 |
| Pause | `pause` | #1 |
| Reset / stop | `square` or `rotate-ccw` | #1 |
| Done (manual clear) | `check` | #1 |
| Loading | `loader-2` (CSS spin) | #2 |
| Error | `alert-circle` | #3 |
| Informational / inert | `info` | #4 |
| Empty / no items | `inbox` or `list-x` | #5 |
| Destructive confirmation | `alert-triangle` | #7 |
| Queue / list | `list-todo` | #1 (queue heading, if one is added) |

## Elevation, borders, radius

- Field/section grouping in modals (#6, #7) and settings groups (#8): `--background-modifier-border` for dividers, `--radius-s` / `--radius-m` for any container corners — match Obsidian's own `Modal`/`Setting` chrome rather than inventing a new radius.
- No custom box-shadow / elevation system — Obsidian's `Modal` already provides this; don't reimplement it.

## User theming and CSS-snippet compatibility

Mike flagged (2026-07-23) that users must be able to apply their own themes, CSS snippets, and imagery against this plugin — not just passively inherit the active theme, but actively restyle it.
This constrains implementation, not just color choice:

- Every value in the tables above is a CSS custom property *reference*, never a hardcoded hex/px literal baked into a rule.
  This is already required by the theme-native decision, and it's also what makes user CSS snippets viable — a snippet can override a `var(--interactive-accent)` reference or a plugin class, but can't cleanly override a hardcoded literal.
- One stable, documented CSS class namespace, applied consistently as a snippet target.
  `timer-view.ts` carries the `routine-*` prefix (`routine-timer-view`, `-timer-panel`, `-controls`, `-queue`, etc.).
  **Resolved for surface #6** (flow-gu1.19.18): `WriteBackModal` now adds `routine-write-back-modal` via `modalEl.addClass(...)`.
  **Resolved for surface #7** (flow-gu1.62): `RoutineReplaceModal` now adds `routine-replace-modal` via `modalEl.addClass(...)`.
  `RoutineFlowSettingTab` (#8) still adds **no plugin-scoped class at all** — it renders straight onto `containerEl`, so a user's snippet could only reach it via Obsidian's generic `.setting-item` selector, which hits every plugin's settings tab indiscriminately, not just this one.
  Adding a root-level scoped class (e.g. via `containerEl.addClass(...)`) is a prerequisite for snippet-targeting that remaining surface, not something that already exists — treat it as part of its implementation pass (flow-gu1.58), not a retrofit deferred to flow-q2p.
- No JS-driven inline `style=` attributes for anything a snippet should be able to target — route all visual state through class toggles.
- Any hardcoded fallback (e.g. for the rare theme that doesn't define `--color-orange`) must itself be overridable the same way: a plugin-scoped custom property, e.g. `--routine-flow-accent-paused: var(--color-orange, var(--text-warning));`, never an unconditional literal.
- flow-q2p ("Custom CSS stylesheet support for user theming") is where an explicit override mechanism gets built.
  This document establishes the discipline — stable classes, var-only values — that makes that bead cheap rather than a retrofit.
- Imagery and any visual asset (Mike, 2026-07-23): no raster/bitmap assets (PNG/JPG/WebP) anywhere in the plugin, ever — every visual element must be HTML/CSS or inline SVG, drawable and stylable rather than a shipped image file.
  This applies beyond icons: if a future surface introduces a graphical timer/progress representation (e.g. a circular countdown ring), it must be built as SVG (`stroke`/`stroke-dasharray` on a `<circle>`) or pure CSS (`conic-gradient`, `clip-path`), never a pre-rendered image sequence.
  Three reasons this is a hard requirement, not a preference: (1) scaling — vector/CSS scales cleanly at any zoom or display density, a raster asset doesn't; (2) asset footprint — zero bundled image files to ship or version, consistent with the plugin's minimal-surface-area conventions; (3) theming — an SVG using `currentColor`/`fill: var(--interactive-accent)` or a CSS-drawn shape re-themes automatically with the rest of this document's var-based system (including per-task/per-context recoloring, e.g. a future capability to tint the timer differently by task type), where a bitmap would need a whole new asset per palette.
  Lucide icons already satisfy this (inherit `currentColor`); the constraint mainly rules out generating/vendoring any illustrative or decorative image, including anything Stitch mockups might invent — if a mockup shows a raster-style graphic (a rendered ring, a photo-realistic illustration), treat it as a Stitch generation artifact to redesign as SVG/CSS during implementation, not something to source as an asset.
  Applies now, not deferred like the rest of this bullet's onboarding-specific case (surface #12 still needs its own scoping pass for *whether* it uses imagery at all — this constrains *how*, whenever it does).

## Non-goals

- Resolved hex/px values — theme-native means there is no single canonical value; pull real numbers from a running Obsidian instance at generation/implementation time.
- The flow-gu1.60 `Pomodoro*` → `Routine Flow` class-name rename — this document's class-naming principle (stable, documented, var-only) applies regardless of the literal prefix chosen there.
- Per-surface layout/hierarchy decisions — `design.md` and `surface-model.md` already own those; this document supplies the shared vocabulary they draw from.

## Open Questions

- **Resolved** (flow-gu1.19.14, 2026-07-24): whether `--color-orange` is actually defined for the plugin's target Obsidian version.
  Confirmed defined against the e2e-launched instance (app 1.12.7) in both bundled themes — see the Decision section above.
  Still unverified: commonly-used community themes (not installed in the e2e/dev vault); treat as a residual risk covered by the documented `--text-warning` fallback, not blocking.
- **Resolved** (flow-gu1.19.14, 2026-07-24): countdown font size needs the multiplier.
  Measured `--font-ui-large` at 20px vs. `--font-ui-medium` at 15px — only a 1.33x ratio, too close to read as clearly dominant.
  `calc(var(--font-ui-large) * 1.8)` measures 36px, a 2.4x ratio over the phase label.
  Lock in `--routine-flow-countdown-size: calc(var(--font-ui-large) * 1.8)` for flow-gu1.19.8's mockup; the numeric hierarchy check is done, only the visual pass at flow-gu1.19.8 remains.
