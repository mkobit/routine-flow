import { test, expect, describe } from 'bun:test'
import { TimerTicker } from '../../src/timer/ticker'
import type { TickerTimers } from '../../src/timer/ticker'

interface RecordedCall {
  readonly callback: () => void
  readonly delayMs: number
  readonly id: number
}

/** A fake TickerTimers that records calls instead of touching real interval timers. */
function fakeTimers(): { timers: TickerTimers, calls: () => readonly RecordedCall[], cleared: () => readonly number[] } {
  let calls: RecordedCall[] = []
  let cleared: number[] = []
  let nextId = 1
  const timers: TickerTimers = {
    setInterval: (callback, delayMs) => {
      const id = nextId
      nextId += 1
      calls = [...calls, { callback, delayMs, id }]
      return id
    },
    clearInterval: (id) => {
      cleared = [...cleared, id]
    },
  }
  return { timers, calls: () => calls, cleared: () => cleared }
}

describe('TimerTicker', () => {
  test('start() registers a 1-second interval', () => {
    const { timers, calls } = fakeTimers()
    new TimerTicker(() => {}, timers).start()

    expect(calls().length).toBe(1)
    expect(calls()[0]?.delayMs).toBe(1000)
  })

  test('start() is idempotent -- a second call while running registers no additional interval', () => {
    const { timers, calls } = fakeTimers()
    const ticker = new TimerTicker(() => {}, timers)

    ticker.start()
    ticker.start()

    expect(calls().length).toBe(1)
  })

  test('the registered interval firing dispatches a tick action', () => {
    const { timers, calls } = fakeTimers()
    let dispatched: { type: 'tick' }[] = []
    const ticker = new TimerTicker((action) => {
      dispatched = [...dispatched, action]
    }, timers)
    ticker.start()

    calls()[0]?.callback()

    expect(dispatched).toEqual([{ type: 'tick' }])
  })

  test('stop() clears the running interval', () => {
    const { timers, calls, cleared } = fakeTimers()
    const ticker = new TimerTicker(() => {}, timers)
    ticker.start()

    ticker.stop()

    expect(cleared()).toEqual([calls()[0]!.id])
  })

  test('stop() before start() is a no-op', () => {
    const { timers, cleared } = fakeTimers()

    new TimerTicker(() => {}, timers).stop()

    expect(cleared()).toEqual([])
  })

  test('stop() is idempotent -- a second call clears nothing further', () => {
    const { timers, cleared } = fakeTimers()
    const ticker = new TimerTicker(() => {}, timers)
    ticker.start()

    ticker.stop()
    ticker.stop()

    expect(cleared().length).toBe(1)
  })

  test('start() after stop() registers a fresh interval', () => {
    const { timers, calls } = fakeTimers()
    const ticker = new TimerTicker(() => {}, timers)
    ticker.start()
    ticker.stop()

    ticker.start()

    expect(calls().length).toBe(2)
    expect(calls()[1]?.id).not.toBe(calls()[0]?.id)
  })
})
