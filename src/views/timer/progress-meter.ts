import { computeProgressFraction } from '../../timer/progress'
import { progressMeterStyleClass } from '../../timer/progress-meter-style'
import type { ProgressMeterStyle } from '../../timer/progress-meter-style'

export interface ProgressMeterOptions {
  readonly style: ProgressMeterStyle
  readonly isInert: boolean
  readonly duration: Temporal.Duration | null
  readonly remaining: Temporal.Duration | null
  readonly isExhausted?: boolean
}

/**
 * Renders progress meters (radial ring, fill bar, battery drain, tick marks)
 * onto the countdown dial element.
 */
export function renderProgressMeter(dial: HTMLElement, options: ProgressMeterOptions): void {
  // Select active built-in style via class toggle on the dial ('radial' is CSS default).
  const styleClass = progressMeterStyleClass(options.style)
  if (styleClass !== null) {
    dial.addClass(styleClass)
  }

  if (options.isExhausted) {
    dial.addClass('is-exhausted')
    dial.addClass('is-celebrating')
  }

  // Render progress meters for this view's own timed phase; skip when inert.
  if (!options.isInert && options.duration !== null && options.remaining !== null) {
    const fraction = options.isExhausted ? 1 : computeProgressFraction(options.duration, options.remaining)
    // Continuous per-tick runtime value; appearance stays in styles.css.
    dial.style.setProperty('--routine-flow-progress', String(fraction))
    const ring = dial.createSvg('svg', { cls: 'routine-progress-ring', attr: { viewBox: '0 0 100 100' } })
    ring.createSvg('circle', { cls: 'routine-progress-track', attr: { cx: 50, cy: 50, r: 45, pathLength: 100 } })
    ring.createSvg('circle', { cls: 'routine-progress-indicator', attr: { cx: 50, cy: 50, r: 45, pathLength: 100 } })

    // Alternate styles are always rendered and selected via CSS class toggles on the dial.
    const fillBar = dial.createDiv({ cls: 'routine-progress-fill-bar' })
    const fillBarTrack = fillBar.createDiv({ cls: 'routine-progress-fill-bar-track' })
    fillBarTrack.createDiv({ cls: 'routine-progress-fill-bar-indicator' })

    const batteryDrain = dial.createDiv({ cls: 'routine-progress-battery-drain' })
    const batteryDrainTrack = batteryDrain.createDiv({ cls: 'routine-progress-battery-drain-track' })
    batteryDrainTrack.createDiv({ cls: 'routine-progress-battery-drain-indicator' })
    batteryDrain.createDiv({ cls: 'routine-progress-battery-drain-cap' })

    const tickMarks = dial.createDiv({ cls: 'routine-progress-tick-marks' })
    const tickMarksTrack = tickMarks.createDiv({ cls: 'routine-progress-tick-marks-track' })
    tickMarksTrack.createDiv({ cls: 'routine-progress-tick-marks-indicator' })
  }
}
