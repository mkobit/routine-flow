---
sidebar_position: 8
---

# Theme compatibility and CSS integration

How Routine Flow integrates with Obsidian themes and user CSS snippets.

## Theme-native visual philosophy

Routine Flow is built to feel native inside Obsidian regardless of the active visual theme.
All component styles reference standard Obsidian CSS custom properties rather than hardcoded colors or measurements.

- **Backgrounds and text**: use `--background-primary`, `--background-secondary`, `--text-normal`, `--text-muted`, `--text-error`, and `--text-accent`.
- **Borders and radii**: use `--background-modifier-border`, `--radius-s`, and `--radius-m`.
- **Typography and spacing**: use `--font-ui-small`, `--font-ui-medium`, `--font-ui-large`, and the `--size-4-*` spacing scale.

## Dedicated paused-state accent and fallbacks

Routine Flow defines one deliberate visual accent layer to distinguish running and paused states.
The paused state uses Obsidian's extended palette variable `--color-orange`.

- The paused timer accent is defined via `--routine-flow-accent-paused: var(--color-orange, var(--text-warning))`.
- If a community theme does not define `--color-orange`, the variable automatically falls back to `--text-warning`.
- This ensures visual distinction between active and paused phases across all installed themes.

## Plugin CSS custom properties

Routine Flow exposes scoped CSS custom properties that can be adjusted via CSS snippets.

| Property | Default value | Purpose |
| :--- | :--- | :--- |
| `--routine-flow-countdown-size` | `calc(var(--font-ui-large) * 1.8)` | Countdown time digit size inside the dial. |
| `--routine-flow-accent-paused` | `var(--color-orange, var(--text-warning))` | Accent color used during paused timer states. |
| `--routine-flow-ring-size` | `150px` | Dimension of the countdown dial bounding box. |
| `--routine-flow-ring-stroke` | `6` | Stroke width for the radial SVG progress ring. |
| `--routine-flow-tick-count` | `12` | Number of segments rendered in the tick-marks progress style. |
| `--routine-flow-tick-mark-fraction` | `0.6` | Mark-to-gap ratio for the tick-marks progress style. |

## Progress meter styles and class toggles

Routine Flow provides four progress visualization styles configurable in settings.
Visual styles are toggled on `.routine-countdown-dial` via class selectors:

- **Radial** (`radial`): default SVG progress ring using `.routine-progress-ring`.
- **Linear fill bar** (`fill-bar`): continuous fill bar using `.routine-progress-style-fill-bar`.
- **Battery drain** (`battery-drain`): depletion meter using `.routine-progress-style-battery-drain`.
- **Tick marks** (`tick-marks`): segmented tick marks using `.routine-progress-style-tick-marks`.

## Community theme compatibility

The theme-native variable approach was audited against popular Obsidian community themes.

- **Minimal**: fully defines core text, accent, and modifier variables; default button and modal styling align cleanly.
- **AnuPpuccin**: defines custom accent and semantic color tokens; inherits native modal and form field structures.
- **Blue Topaz**: provides complete color palette custom properties; countdown text and progress ring resolve accurately.
- **Things**: defines clean light and dark palette variables; scoped controls and queue lists match native theme density.

## Plugin CSS class scoping

Every surface rendered by Routine Flow carries a scoped root class to enable targetable CSS snippets.

- **Timer view**: `.routine-timer-view`, `.routine-side-panel`, `.routine-timer-panel`, `.routine-countdown-dial`, `.routine-controls`, `.routine-queue`.
- **Write-back modal**: `.routine-write-back-modal`, `.routine-write-back-sentence`, `.routine-write-back-chip`, `.routine-write-back-actions`.
- **Routine replace modal**: `.routine-replace-modal`, `.routine-replace-warning`.
- **Reset confirm modal**: `.routine-reset-confirm-modal`.
- **Script hook confirm modal**: `.routine-script-hook-confirm-modal`.
- **Settings tab**: `.routine-setting-tab`.
- **Status bar**: `.routine-status-bar-item`.

## User CSS snippet customization

Users can customize any component surface by targeting the scoped classes or redefining plugin custom properties.

```css
/* Example snippet: customize paused accent and countdown size */
.routine-timer-view {
  --routine-flow-accent-paused: var(--color-yellow);
  --routine-flow-countdown-size: 2.5rem;
}
```

## Mobile and responsive design

Routine Flow surfaces inherit Obsidian's mobile layout behaviors.

- Containers use flexbox and grid layouts (`flex-wrap: wrap`, dynamic `calc(...)` expressions) to adapt to narrow viewports.
- Interactive chip fields use `field-sizing: content` with `min-inline-size` and `max-inline-size` boundaries.
- Component styling respects Obsidian's `.is-mobile`, `.is-phone`, and `.is-tablet` body utility classes.

