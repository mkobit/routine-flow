import { z } from 'zod'

/** Built-in progress-meter visualizations for the timer panel's dial (see flow-gu1.19.15 family). */
export const PROGRESS_METER_STYLES = ['radial', 'fill-bar', 'battery-drain', 'tick-marks'] as const

export const ProgressMeterStyleSchema = z.enum(PROGRESS_METER_STYLES)

export type ProgressMeterStyle = z.infer<typeof ProgressMeterStyleSchema>

export const PROGRESS_METER_STYLE_LABELS: Record<ProgressMeterStyle, string> = {
  'radial': 'Radial ring',
  'fill-bar': 'Fill bar',
  'battery-drain': 'Battery drain',
  'tick-marks': 'Tick marks',
}

/**
 * CSS class toggled on `.routine-countdown-dial` (styles.css) to select an alternate built-in
 * style. `radial` is the CSS default and needs no class -- returns null so callers don't add an
 * empty/no-op class.
 */
export function progressMeterStyleClass(style: ProgressMeterStyle): string | null {
  return style === 'radial' ? null : `routine-progress-style-${style}`
}
