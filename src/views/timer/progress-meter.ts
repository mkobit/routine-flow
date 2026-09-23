import type { Temporal } from 'temporal-polyfill'
import { computeProgressFraction } from '../../timer/progress'
import { progressMeterStyleClass } from '../../timer/progress-meter-style'
import type { ProgressMeterStyle } from '../../timer/progress-meter-style'

export interface ProgressMeterOptions {
  readonly style: ProgressMeterStyle
  readonly isInert: boolean
  readonly duration: Temporal.Duration | null
  readonly remaining: Temporal.Duration | null
}

/**
 * Renders progress meters (radial ring, fill bar, battery drain, tick marks)
 * onto the countdown dial element.
 */
export function renderProgressMeter(dial: HTMLElement, options: ProgressMeterOptions): void {
  // Selects the active built-in style (flow-gu1.19.15.4 setting) via a class toggle on the
  // dial (DESIGN.md: "route all visual state through class toggles") -- 'radial' is the CSS
  // default and needs no class.
  const styleClass = progressMeterStyleClass(options.style)
  if (styleClass !== null) {
    dial.addClass(styleClass)
  }

  // Radial progress ring, sized to the dial so it frames just the mm:ss digits. Rendered for
  // this view's own timed phase; skipped for the inert state (the countdown isn't this view's
  // own). A stopped phase still shows the ring at 0 as a "ready" backdrop.
  if (!options.isInert && options.duration !== null && options.remaining !== null) {
    const fraction = computeProgressFraction(options.duration, options.remaining)
    // --routine-flow-progress is continuously-varying per-tick runtime data, not a discrete
    // visual state a snippet should override, so setting it inline is allowed (DESIGN.md). The
    // ring's appearance (stroke/color/width) stays entirely in styles.css, driven off this value
    // plus theme vars, so a snippet can still restyle the whole look via classes/vars.
    dial.style.setProperty('--routine-flow-progress', String(fraction))
    const ring = dial.createSvg('svg', { cls: 'routine-progress-ring', attr: { viewBox: '0 0 100 100' } })
    ring.createSvg('circle', { cls: 'routine-progress-track', attr: { cx: 50, cy: 50, r: 45, pathLength: 100 } })
    ring.createSvg('circle', { cls: 'routine-progress-indicator', attr: { cx: 50, cy: 50, r: 45, pathLength: 100 } })

    // Alternate built-in style (flow-gu1.19.15.1): a linear fill-bar, driven by the same
    // --routine-flow-progress set above -- no separate JS-side computation. Always rendered
    // alongside the ring; CSS hides it by default and shows it instead of the ring only when
    // the style-class toggle set above selects it (styles.css).
    const fillBar = dial.createDiv({ cls: 'routine-progress-fill-bar' })
    const fillBarTrack = fillBar.createDiv({ cls: 'routine-progress-fill-bar-track' })
    fillBarTrack.createDiv({ cls: 'routine-progress-fill-bar-indicator' })

    // Alternate built-in style (flow-gu1.19.15.2): a battery-drain meter, same
    // --routine-flow-progress contract and always-rendered/CSS-selected pattern as the
    // fill-bar above. The -cap div is the small terminal nub that reads the shape as a battery
    // rather than a plain bar.
    const batteryDrain = dial.createDiv({ cls: 'routine-progress-battery-drain' })
    const batteryDrainTrack = batteryDrain.createDiv({ cls: 'routine-progress-battery-drain-track' })
    batteryDrainTrack.createDiv({ cls: 'routine-progress-battery-drain-indicator' })
    batteryDrain.createDiv({ cls: 'routine-progress-battery-drain-cap' })

    // Alternate built-in style (flow-gu1.19.15.3): a tick-marks meter -- a row of discrete
    // segments that light up left-to-right as --routine-flow-progress advances, same contract
    // as the ring/fill-bar/battery-drain above. Last of the three alternate styles named in
    // flow-gu1.19.15.
    const tickMarks = dial.createDiv({ cls: 'routine-progress-tick-marks' })
    const tickMarksTrack = tickMarks.createDiv({ cls: 'routine-progress-tick-marks-track' })
    tickMarksTrack.createDiv({ cls: 'routine-progress-tick-marks-indicator' })
  }
}
