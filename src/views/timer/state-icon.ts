import { setIcon } from 'obsidian'

/**
 * Renders the first Lucide icon name that resolves into a fresh child span. `setIcon` no-ops
 * (leaves the element empty) for an unknown name, so listing fallbacks absorbs Lucide's
 * cross-version renames (e.g. `loader-2` -> `loader-circle`) without pinning to one alias --
 * which alias the bundled Obsidian version ships is version-dependent (see DESIGN.md iconography).
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
