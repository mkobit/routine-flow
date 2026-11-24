import { setIcon } from 'obsidian'

/**
 * Renders the first Lucide icon name that resolves into a fresh child span.
 * `setIcon` no-ops for unknown names, so listing fallbacks absorbs Lucide
 * renames across Obsidian versions.
 */
export function renderStateIcon(parent: HTMLElement, names: readonly string[]): HTMLElement {
  const iconEl = parent.createSpan({ cls: 'routine-state-icon' })
  for (const name of names) {
    setIcon(iconEl, name)
    if (iconEl.childElementCount > 0) {
      return iconEl
    }
  }
  return iconEl
}
