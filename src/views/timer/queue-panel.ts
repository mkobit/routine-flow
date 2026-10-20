import { Notice, setIcon } from 'obsidian'
import type { App } from 'obsidian'
import { Temporal } from 'temporal-polyfill'
import type { Phase } from '../../domain/phase/phase'
import type { TaskQueueItem, TaskQueueItemId } from '../../domain/queue/task-source'
import type { QueueItemAction } from '../../domain/action/queue-item-action'
import type { ApplyMutationsResult } from '../../domain/mutation/apply-mutations'
import { FOCUS_PHASE_KIND, SELECTOR_PHASE_KIND } from '../../timer/phase-graph-query'
import { createDecelerationSchedule, selectRandomQueueItem } from '../../domain/queue/random-task-selector'
import { projectQueueItemBadges } from '../../domain/queue/queue-badge'
import { renderStateIcon } from './state-icon'

export interface QueueActionExecutor {
  readonly executeAction: (action: QueueItemAction, targetPath?: string) => Promise<ApplyMutationsResult | null>
  readonly reorderQueueItem?: (itemId: TaskQueueItemId, position: 'front' | 'back') => Promise<ApplyMutationsResult | null>
}

export interface QueuePanelOptions {
  readonly phase: Phase
  readonly activeFilePath: string | null
  readonly queueItems: readonly TaskQueueItem[]
  readonly app: App
  readonly actionExecutor?: QueueActionExecutor
  readonly onSelectTask: (filePath: string) => void
  readonly onOpenFile?: (filePath: string) => void
  readonly rng?: () => number
  readonly scheduleTotalSteps?: number
  readonly prefersReducedMotion?: boolean
  readonly setTimeout?: (callback: () => void, delayMs: number) => number
  readonly onSpinEnd?: (winner: TaskQueueItem) => void
}

const DEFAULT_SCHEDULE_TOTAL_STEPS = 20
const MIN_STEP_INTERVAL = Temporal.Duration.from({ milliseconds: 50 })
const MAX_STEP_INTERVAL = Temporal.Duration.from({ milliseconds: 400 })

function safeSetTimeout(callback: () => void, delayMs: number, customSetTimeout?: (callback: () => void, delayMs: number) => number): number {
  if (customSetTimeout) {
    return customSetTimeout(callback, delayMs)
  }
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    return window.setTimeout(callback, delayMs)
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fallback for headless test runners where window is not in global scope
  return (setTimeout as unknown as (cb: () => void, ms: number) => number)(callback, delayMs)
}

function checkPrefersReducedMotion(override?: boolean): boolean {
  if (override !== undefined) {
    return override
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    catch {
      return false
    }
  }
  return false
}

/**
 * Renders the work/break/selection queue panel, item list, spin controls, and action buttons.
 */
export function renderQueuePanel(queueEl: HTMLElement, options: QueuePanelOptions): void {
  queueEl.empty()
  const queueTitle = options.phase.kind === SELECTOR_PHASE_KIND
    ? 'Selection queue'
    : options.phase.kind === FOCUS_PHASE_KIND
      ? 'Work queue'
      : 'Break queue'

  const headerEl = queueEl.createDiv({ cls: 'routine-queue-header' })
  headerEl.createEl('h3', { text: queueTitle })

  const liveRegion = queueEl.createDiv({
    cls: 'routine-queue-announcer sr-only',
    attr: {
      'aria-live': 'polite',
      'aria-atomic': 'true',
    },
  })

  if (options.queueItems.length === 0) {
    const emptyEl = queueEl.createDiv({ cls: 'routine-queue-empty' })
    renderStateIcon(emptyEl, ['inbox', 'list-x'])
    emptyEl.createEl('p', { text: 'No notes match — check this routine\'s queue filter.' })
    return
  }

  const isSelectorPhase = options.phase.kind === SELECTOR_PHASE_KIND
  const canSpin = options.queueItems.length >= 2
  let spinBtn: HTMLElement | null = null
  let isSpinning = false

  if (isSelectorPhase) {
    const toolbarEl = headerEl.createDiv({ cls: 'routine-queue-header-toolbar' })
    spinBtn = toolbarEl.createEl('button', {
      cls: 'routine-queue-spin-btn',
      attr: {
        'aria-label': 'Spin queue',
        'title': 'Spin queue',
      },
    })
    setIcon(spinBtn, 'dices')
    if (!canSpin) {
      spinBtn.setAttribute('disabled', 'true')
    }
  }

  const ul = queueEl.createEl('ul')
  const itemEls = options.queueItems.map((item) => {
    const li = ul.createEl('li')
    const itemRow = li.createDiv({ cls: 'routine-queue-item-row' })
    const taskBtn = itemRow.createEl('button', { cls: 'routine-task-name', text: item.displayName })

    const badges = projectQueueItemBadges(item, options.phase.badges ?? [])
    if (badges.length > 0) {
      const badgesEl = itemRow.createDiv({ cls: 'routine-queue-badges' })
      for (const badge of badges) {
        const badgeEl = badgesEl.createSpan({
          cls: `routine-queue-badge mod-${badge.variant}`,
          attr: badge.label ? { 'aria-label': badge.label, 'title': badge.label } : {},
        })
        if (badge.icon) {
          const iconEl = badgeEl.createSpan({ cls: 'routine-queue-badge-icon' })
          setIcon(iconEl, badge.icon)
        }
        badgeEl.createSpan({ cls: 'routine-queue-badge-text', text: badge.text })
      }
    }

    const openFileBtn = itemRow.createEl('button', {
      cls: 'routine-open-file-btn',
      attr: { 'aria-label': `Open ${item.displayName}`, 'title': `Open ${item.displayName}` },
    })
    setIcon(openFileBtn, 'file-text')
    openFileBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (options.onOpenFile) {
        options.onOpenFile(item.sourcePath)
      }
      else {
        const file = options.app.vault.getFileByPath(item.sourcePath)
        if (file) {
          const leaf = options.app.workspace.getLeaf('tab')
          void leaf.openFile(file)
          options.app.workspace.setActiveLeaf(leaf, { focus: true })
        }
      }
    })

    if (options.activeFilePath === item.sourcePath) {
      li.addClass('is-active-task')
      if (isSelectorPhase) {
        li.addClass('is-roulette-winner')
        liveRegion.setText(`Selected task: ${item.displayName}`)
      }
      if (options.phase.actions.length > 0) {
        const actionsEl = li.createDiv({ cls: 'routine-queue-actions' })
        for (const action of options.phase.actions) {
          const actionBtn = actionsEl.createEl('button', {
            cls: `routine-action-btn${action.style ? ` mod-${action.style === 'primary' ? 'cta' : action.style === 'destructive' ? 'warning' : action.style}` : ''}`,
            text: action.label,
          })
          actionBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (options.actionExecutor) {
              void (async () => {
                try {
                  const result = await options.actionExecutor?.executeAction(action, item.sourcePath)
                  if (result !== null && result !== undefined && !result.success) {
                    const causeMsg = result.cause instanceof Error ? result.cause.message : String(result.cause)
                    new Notice(`Routine Flow: action failed (${action.label}) — ${causeMsg}`)
                  }
                }
                catch (cause: unknown) {
                  const causeMsg = cause instanceof Error ? cause.message : String(cause)
                  new Notice(`Routine Flow: action failed (${action.label}) — ${causeMsg}`)
                }
              })()
            }
          })
        }
      }
    }

    taskBtn.addEventListener('click', () => {
      if (isSelectorPhase) {
        if (isSpinning) {
          return
        }
        triggerWinnerSelection(item, li)
        return
      }
      options.onSelectTask(item.sourcePath)
    })

    return { item, li }
  })

  const triggerWinnerSelection = (selectedItem: TaskQueueItem, selectedLi: HTMLElement): void => {
    for (const { li } of itemEls) {
      li.removeClass('is-roulette-highlight')
      li.removeClass('is-roulette-winner')
    }
    selectedLi.addClass('is-roulette-winner')
    liveRegion.setText(`Selected task: ${selectedItem.displayName}`)
    options.onSelectTask(selectedItem.sourcePath)
  }

  if (isSelectorPhase && spinBtn && canSpin) {
    const triggerSpin = (): void => {
      if (isSpinning) {
        return
      }

      const winner = selectRandomQueueItem(options.queueItems, { rng: options.rng })
      if (!winner) {
        return
      }

      const winnerIndex = options.queueItems.findIndex(i => i.sourcePath === winner.sourcePath)
      if (winnerIndex < 0) {
        return
      }

      const finishSelection = (winnerLi: HTMLElement): void => {
        triggerWinnerSelection(winner, winnerLi)
        options.onSpinEnd?.(winner)
        isSpinning = false
        spinBtn?.removeAttribute('disabled')
      }

      const prefersReduced = checkPrefersReducedMotion(options.prefersReducedMotion)
      if (prefersReduced) {
        const winnerEntry = itemEls[winnerIndex]
        if (winnerEntry) {
          finishSelection(winnerEntry.li)
        }
        return
      }

      isSpinning = true
      spinBtn?.setAttribute('disabled', 'true')
      for (const { li } of itemEls) {
        li.removeClass('is-roulette-winner')
        li.removeClass('is-roulette-highlight')
      }

      const numCandidates = options.queueItems.length
      const baseSteps = options.scheduleTotalSteps ?? DEFAULT_SCHEDULE_TOTAL_STEPS
      const remainder = baseSteps % numCandidates
      const adjustment = (winnerIndex - remainder + numCandidates) % numCandidates
      const totalSteps = Math.max(1, baseSteps + adjustment)

      const schedule = createDecelerationSchedule({
        totalSteps,
        minInterval: MIN_STEP_INTERVAL,
        maxInterval: MAX_STEP_INTERVAL,
      })

      let currentStep = 0
      const runStep = (): void => {
        const step = schedule[currentStep]
        if (!step) {
          const winnerEntry = itemEls[winnerIndex]
          if (winnerEntry) {
            finishSelection(winnerEntry.li)
          }
          return
        }

        const candidateIndex = step.index % numCandidates
        for (let i = 0; i < itemEls.length; i++) {
          const entry = itemEls[i]
          if (entry) {
            if (i === candidateIndex) {
              entry.li.addClass('is-roulette-highlight')
            }
            else {
              entry.li.removeClass('is-roulette-highlight')
            }
          }
        }

        currentStep++
        if (currentStep < schedule.length) {
          safeSetTimeout(runStep, step.intervalMs, options.setTimeout)
        }
        else {
          safeSetTimeout(() => {
            const winnerEntry = itemEls[winnerIndex]
            if (winnerEntry) {
              finishSelection(winnerEntry.li)
            }
          }, step.intervalMs, options.setTimeout)
        }
      }

      runStep()
    }

    spinBtn.addEventListener('click', () => {
      triggerSpin()
    })
  }
}
