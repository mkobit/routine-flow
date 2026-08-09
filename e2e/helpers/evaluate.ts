import type { App } from 'obsidian'
import type { Page } from '@playwright/test'

// Unified runner: evaluates `fn` inside the Obsidian renderer. When `args` is
// omitted the function receives only `app`. Args must be JSON-serializable
// since they're shipped over CDP.
export async function evaluateObsidian<T>(
  page: Page,
  fn: (app: App) => T | Promise<T>,
): Promise<T>
export async function evaluateObsidian<T, A>(
  page: Page,
  fn: (app: App, args: A) => T | Promise<T>,
  args: A,
): Promise<T>
export async function evaluateObsidian<T, A>(
  page: Page,
  fn: ((app: App) => T | Promise<T>) | ((app: App, args: A) => T | Promise<T>),
  args?: A,
): Promise<T> {
  const fnSrc = fn.toString()
  return page.evaluate(([src, fnArgs]) => {
    // `Function`'s call signature is untyped (`(...args: any[]) => any` isn't even
    // declared on it in lib.es5), so recovering the shape of dynamically-built code
    // has no cast-free option — this is the one genuine boundary case.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Function's return type is untyped, no cast-free option
    const fnObj = new Function(`return (${src})`)() as (app: App, a?: unknown) => T | Promise<T>
    // `activeWindow` (Obsidian's currently-focused-window global) is unreliable here: once the
    // Settings UI opens in its own BrowserWindow (flow-ac5), `activeWindow` on every page can
    // point at that window, which has no `app` of its own. `window.app` is scoped to the actual
    // renderer this code runs in and is what the obsidianPage fixture itself waits on
    // (fixtures/obsidian.ts), so it stays correct regardless of which window currently has focus.
    const obsidianApp = window.app
    if (!obsidianApp) {
      throw new Error('evaluateObsidian: window.app is not ready — Obsidian has not finished loading')
    }
    return fnObj(obsidianApp, fnArgs)
  }, [fnSrc, args] as const)
}
