import { renderStateIcon } from './state-icon'

export interface StarJarMeterOptions {
  readonly current: number
  readonly target: number
  readonly progressFraction: number
  readonly isFull: boolean
  readonly trackerFilePath?: string | null
}

/**
 * Renders the star jar / point bank meter widget showing accumulated stars against goal threshold.
 */
export function renderStarJarMeter(
  containerEl: HTMLElement,
  options: StarJarMeterOptions,
): HTMLElement {
  const panel = containerEl.createDiv({ cls: 'routine-star-jar-meter' })
  if (options.isFull) {
    panel.addClass('is-full')
    panel.addClass('is-celebrating')
  }

  // Header row: icon + title on the left, current / target count on the right
  const header = panel.createDiv({ cls: 'routine-star-jar-header' })
  const titleContainer = header.createDiv({ cls: 'routine-star-jar-title-container' })
  renderStateIcon(titleContainer, ['star'])
  titleContainer.createSpan({ cls: 'routine-star-jar-title', text: 'Star jar' })

  const countContainer = header.createDiv({ cls: 'routine-star-jar-count' })
  countContainer.createSpan({ cls: 'routine-star-jar-current', text: String(options.current) })
  countContainer.createSpan({ cls: 'routine-star-jar-divider', text: ' / ' })
  countContainer.createSpan({ cls: 'routine-star-jar-target', text: `${String(options.target)} stars` })

  // Progress bar
  const progressBar = panel.createDiv({ cls: 'routine-star-jar-progress-bar' })
  progressBar.setAttribute('role', 'progressbar')
  progressBar.setAttribute('aria-valuenow', String(options.current))
  progressBar.setAttribute('aria-valuemin', '0')
  progressBar.setAttribute('aria-valuemax', String(options.target))
  progressBar.setAttribute('aria-label', `Star jar: ${String(options.current)} of ${String(options.target)} stars`)

  const progressPercent = Math.min(100, Math.round(options.progressFraction * 100))
  if (typeof progressBar.style?.setProperty === 'function') {
    progressBar.style.setProperty('--routine-star-jar-progress', String(options.progressFraction))
  }

  const indicator = progressBar.createDiv({ cls: 'routine-star-jar-indicator' })
  if (typeof indicator.style?.setProperty === 'function') {
    indicator.style.setProperty('width', `${String(progressPercent)}%`)
  }

  // Celebratory note when milestone reached
  if (options.isFull) {
    const celebration = panel.createDiv({ cls: 'routine-star-jar-celebration' })
    renderStateIcon(celebration, ['sparkles', 'check'])
    celebration.createSpan({
      cls: 'routine-star-jar-celebration-text',
      text: 'Goal reached! Reward unlocked',
    })
  }

  return panel
}
