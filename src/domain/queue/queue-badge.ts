import type { PhaseQueueBadge } from '../phase/phase'
import type { TaskQueueItem } from './task-source'

export interface RenderedQueueBadge {
  readonly property: string
  readonly text: string
  readonly icon?: string
  readonly label?: string
  readonly variant: 'default' | 'accent' | 'muted'
}

export function formatBadgeValue(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : typeof value === 'number'
      ? Number.isFinite(value) ? String(value) : null
      : typeof value === 'string'
        ? value.trim().length > 0 ? value.trim() : null
        : typeof value === 'boolean'
          ? value ? '✓' : null
          : null
}

export function projectQueueItemBadges(
  item: TaskQueueItem,
  configs: readonly PhaseQueueBadge[],
): readonly RenderedQueueBadge[] {
  const extra = item.extraProperties
  return !extra || configs.length === 0
    ? Object.freeze([])
    : Object.freeze(
        configs.flatMap((config) => {
          const rawValue = extra[config.property]
          const formatted = formatBadgeValue(rawValue)
          return formatted === null
            ? []
            : [
                Object.freeze({
                  property: config.property,
                  text: `${config.prefix ?? ''}${formatted}${config.suffix ?? ''}`,
                  ...(config.icon !== undefined ? { icon: config.icon } : {}),
                  ...(config.label !== undefined ? { label: config.label } : {}),
                  variant: config.variant,
                }),
              ]
        }),
      )
}
