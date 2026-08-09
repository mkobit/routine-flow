// Module augmentation exposing Obsidian internal API members used by e2e tests.
// These members are not part of Obsidian's public API. They exist at runtime
// but are intentionally undocumented. Keep this surface minimal — add a member
// only when an e2e test demonstrably needs it, with a comment explaining why.
import 'obsidian'
import type { App } from 'obsidian'
import type RoutineFlowPlugin from '../src/main'

declare global {
  interface Window {
    // Exposed by Obsidian's Electron renderer for devtools access to the running app.
    // Undefined until the renderer finishes loading — see the `waitForFunction`
    // gate in e2e/fixtures/obsidian.ts. Stays optional so call sites can't
    // accidentally skip that check without a type error.
    readonly app?: App
  }
}

declare module 'obsidian' {
  interface PluginsRegistry {
    // Narrowed for our own plugin id only (write-back-modal.e2e.ts dispatches
    // engine actions directly); every other plugin id still falls back to
    // `unknown` via the Record intersection.
    readonly plugins: Record<string, unknown> & {
      'routine-flow'?: RoutineFlowPlugin
    }
  }

  interface SettingManager {
    readonly pluginTabs: readonly { readonly id: string }[]
    // Opens the Settings UI (a separate Electron BrowserWindow, not an in-page modal -- see
    // e2e/AGENTS.md) and switches to the tab with the given id. capture-screenshots.manual.ts
    // uses these to screenshot the settings tab.
    open: () => void
    openTabById: (id: string) => void
  }

  interface BasesPluginInstance {
    readonly registrations: Record<string, unknown>
  }

  interface BasesInternalPlugin {
    readonly instance?: BasesPluginInstance
  }

  interface InternalPluginsRegistry {
    readonly plugins: {
      readonly bases?: BasesInternalPlugin
    }
  }

  interface App {
    readonly plugins: PluginsRegistry
    readonly setting: SettingManager
    readonly internalPlugins: InternalPluginsRegistry
  }
}
