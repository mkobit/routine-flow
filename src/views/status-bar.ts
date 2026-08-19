import type RoutineFlowPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import { findPhaseById } from '../timer/phase-graph'
import { formatPhaseHeader } from '../timer/format'

/**
 * Workspace-wide status bar item mirroring the shared EngineStore's active
 * phase, so a running routine stays visible while another file has focus.
 * Click toggles pause/resume; the item hides itself when there's nothing
 * running or paused to show or act on.
 */
export class RoutineStatusBarItem {
  private readonly el: HTMLElement
  private unsubscribe: (() => void) | null = null

  constructor(private readonly plugin: RoutineFlowPlugin) {
    this.el = plugin.addStatusBarItem()
    this.el.addClass('routine-status-bar-item')
    this.el.addEventListener('click', () => this.handleClick())
  }

  load(): void {
    this.unsubscribe = this.plugin.store.subscribe(state => this.render(state))
    this.render(this.plugin.store.getState())
  }

  unload(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private render(state: EngineState): void {
    this.el.className = 'routine-status-bar-item'
    const graph = this.plugin.store.getGraph()
    const phase = state.status === 'stopped' ? undefined : findPhaseById(graph, state.currentPhaseId)
    if (phase === undefined) {
      this.el.setText('')
      this.el.hide()
      return
    }
    this.el.addClass(`is-${state.status}`)
    this.el.setText(formatPhaseHeader(phase, state.remaining, state.status))
    this.el.show()
  }

  private handleClick(): void {
    const state = this.plugin.store.getState()
    if (state.status === 'running') {
      void this.plugin.store.dispatch({ type: 'pause' })
    }
    else if (state.status === 'paused') {
      void this.plugin.store.dispatch({ type: 'resume' })
    }
  }
}
