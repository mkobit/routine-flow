/** The subset of the interval timer API TimerTicker needs, swappable in tests without touching the real `window`. */
export interface TickerTimers {
  readonly setInterval: (callback: () => void, delayMs: number) => number
  readonly clearInterval: (id: number) => void
}

const windowTimers: TickerTimers = {
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: id => window.clearInterval(id),
}

export class TimerTicker {
  private dispatch: (action: { type: 'tick' }) => void
  private intervalId: number | null = null
  private readonly timers: TickerTimers
  private readonly getIntervalMs: () => number

  constructor(
    dispatch: (action: { type: 'tick' }) => void,
    arg2?: (() => number) | TickerTimers,
    timers: TickerTimers = windowTimers,
  ) {
    this.dispatch = dispatch
    if (typeof arg2 === 'function') {
      this.getIntervalMs = arg2
      this.timers = timers
    }
    else if (arg2 !== undefined) {
      this.getIntervalMs = () => 1000
      this.timers = arg2
    }
    else {
      this.getIntervalMs = () => 1000
      this.timers = timers
    }
  }

  public start() {
    if (this.intervalId !== null) {
      return
    }
    const delayMs = Math.max(10, this.getIntervalMs())
    this.intervalId = this.timers.setInterval(() => {
      this.dispatch({ type: 'tick' })
    }, delayMs)
  }

  public stop() {
    if (this.intervalId !== null) {
      this.timers.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  public restart() {
    if (this.intervalId !== null) {
      this.stop()
      this.start()
    }
  }
}
