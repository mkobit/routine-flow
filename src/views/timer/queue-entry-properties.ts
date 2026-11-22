import { ListValue, NullValue } from 'obsidian'
import type { BasesEntry, BasesPropertyId, BasesViewConfig, RenderContext, Value } from 'obsidian'

const FILE_NAME_PROPERTY_ID: BasesPropertyId = 'file.name'

/**
 * Returns true when a Bases property value is null, NullValue, or a list of only empty values.
 */
export function isEmptyBasesValue(value: Value | null): boolean {
  if (value === null || value instanceof NullValue || value === NullValue.value) {
    return true
  }
  if (value instanceof ListValue) {
    const len = value.length()
    if (len === 0) {
      return true
    }
    return Array.from({ length: len }, (_, i) => i).every(i => isEmptyBasesValue(value.get(i)))
  }
  return false
}

/**
 * Renders configured `config.getOrder()` properties for a Bases entry into `containerEl`.
 */
export function renderOrderedEntryProperties(
  containerEl: HTMLElement,
  entry: BasesEntry,
  config: BasesViewConfig,
  renderContext: RenderContext,
): void {
  const orderedProps = config.getOrder()
  const nonEmptyEntries: readonly { readonly propId: BasesPropertyId, readonly value: Value }[] = orderedProps
    .filter(propId => propId !== FILE_NAME_PROPERTY_ID)
    .flatMap((propId) => {
      const value = entry.getValue(propId)
      if (value === null || isEmptyBasesValue(value)) {
        return []
      }
      return [{ propId, value }]
    })

  if (nonEmptyEntries.length === 0) {
    return
  }

  const propertiesEl = containerEl.createDiv({ cls: 'routine-queue-properties' })
  for (const { propId, value } of nonEmptyEntries) {
    const propEl = propertiesEl.createDiv({ cls: 'routine-queue-property' })
    propEl.createSpan({
      cls: 'routine-queue-property-label',
      text: config.getDisplayName(propId),
    })
    const valueEl = propEl.createSpan({ cls: 'routine-queue-property-value' })
    value.renderTo(valueEl, renderContext)
  }
}
