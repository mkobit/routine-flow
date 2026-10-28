import type { StageProgress } from '../../domain/phase/stage-progress'

export interface GuidanceChecklistOptions {
  readonly checkedItems?: ReadonlySet<string>
  readonly onToggle?: (item: string, checked: boolean) => void
}

/**
 * Renders stage stepper and linear progress bar showing position within multi-phase routine.
 */
export function renderStageProgress(containerEl: HTMLElement, progress: StageProgress): HTMLElement {
  const panel = containerEl.createDiv({ cls: 'routine-stage-progress' })

  // Linear progress bar reflecting completed stage fraction
  const progressBar = panel.createDiv({ cls: 'routine-stage-progress-bar' })
  const progressPercent = Math.round(progress.progressFraction * 100)
  if (typeof progressBar.style?.setProperty === 'function') {
    progressBar.style.setProperty('--routine-stage-progress', String(progress.progressFraction))
  }
  const indicator = progressBar.createDiv({ cls: 'routine-stage-progress-indicator' })
  if (typeof indicator.style?.setProperty === 'function') {
    indicator.style.setProperty('width', `${progressPercent}%`)
  }

  // Stepper list
  const stepper = panel.createEl('ol', { cls: 'routine-stage-stepper' })
  for (const stage of progress.stages) {
    const step = stepper.createEl('li', {
      cls: `routine-stage-step is-${stage.status}`,
    })
    if (stage.isCurrent) {
      step.addClass('is-current')
    }
    step.createSpan({ cls: 'routine-stage-step-indicator' })
    step.createSpan({ cls: 'routine-stage-step-label', text: stage.label })
  }

  return panel
}

/**
 * Renders interactive checklist guidance items with toggleable checkboxes.
 */
export function renderGuidanceChecklist(
  containerEl: HTMLElement,
  items: readonly string[],
  options?: GuidanceChecklistOptions,
): HTMLElement {
  const panel = containerEl.createDiv({ cls: 'routine-guidance-checklist' })
  panel.createDiv({ cls: 'routine-guidance-title', text: 'Guidance' })

  const list = panel.createEl('ul', { cls: 'routine-guidance-list' })
  for (const item of items) {
    const isChecked = options?.checkedItems?.has(item) ?? false
    const itemEl = list.createEl('li', {
      cls: `routine-guidance-item${isChecked ? ' is-checked' : ''}`,
    })

    const label = itemEl.createEl('label', { cls: 'routine-guidance-label' })
    const checkbox = label.createEl('input', {
      cls: 'routine-guidance-checkbox',
      attr: { type: 'checkbox' },
    })
    if (isChecked) {
      // eslint-disable-next-line functional/immutable-data -- setting DOM property on freshly created element
      checkbox.checked = true
    }

    label.createSpan({ cls: 'routine-guidance-text', text: item })

    let lastChecked = isChecked
    const handleToggle = (): void => {
      const checked = checkbox.checked
      if (checked !== lastChecked) {
        lastChecked = checked
        if (checked) {
          itemEl.addClass('is-checked')
        }
        else {
          itemEl.removeClass('is-checked')
        }
        options?.onToggle?.(item, checked)
      }
    }

    checkbox.addEventListener('change', handleToggle)
    checkbox.addEventListener('click', handleToggle)
  }

  return panel
}
