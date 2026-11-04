import { describe, expect, mock, test } from 'bun:test'
import { playFanfareChord } from '../src/timer/fanfare'

interface ScheduledParamCall {
  readonly method: string
  readonly args: readonly unknown[]
}

class MockScheduledParam {
  readonly calls: ScheduledParamCall[] = []

  setValueAtTime(val: number, time: number): void {
    this.calls.push({ method: 'setValueAtTime', args: [val, time] })
  }

  exponentialRampToValueAtTime(val: number, time: number): void {
    this.calls.push({ method: 'exponentialRampToValueAtTime', args: [val, time] })
  }
}

class MockOscillator {
  readonly type = 'sine'
  readonly frequency = new MockScheduledParam()
  readonly connectCalls: unknown[] = []
  readonly startCalls: number[] = []
  readonly stopCalls: number[] = []

  connect(node: unknown): void {
    this.connectCalls.push(node)
  }

  start(time: number): void {
    this.startCalls.push(time)
  }

  stop(time: number): void {
    this.stopCalls.push(time)
  }
}

class MockGainNode {
  readonly gain = new MockScheduledParam()
  readonly connectCalls: unknown[] = []

  connect(node: unknown): void {
    this.connectCalls.push(node)
  }
}

class MockAudioContext {
  currentTime = 10.0
  state: AudioContextState = 'running'
  readonly destination = {}
  readonly oscillators: MockOscillator[] = []
  readonly gains: MockGainNode[] = []
  readonly resume = mock(async () => {})
  readonly close = mock(async () => {})

  createOscillator(): MockOscillator {
    const osc = new MockOscillator()
    this.oscillators.push(osc)
    return osc
  }

  createGain(): MockGainNode {
    const gainNode = new MockGainNode()
    this.gains.push(gainNode)
    return gainNode
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock audio context helper
const asAudioContext = (ctx: MockAudioContext): AudioContext => ctx as unknown as AudioContext

describe('playFanfareChord', () => {
  test('creates 4 oscillators with [1.0, 1.25, 1.5, 2.0] frequency ratios and exponential gain decay', () => {
    const mockCtx = new MockAudioContext()

    playFanfareChord(() => asAudioContext(mockCtx), { baseFreq: 500 })

    expect(mockCtx.oscillators).toHaveLength(4)
    expect(mockCtx.gains).toHaveLength(4)

    // Check frequency ratios: [1.0, 1.25, 1.5, 2.0] * 500 = [500, 625, 750, 1000]
    const expectedFreqs = [500, 625, 750, 1000]
    mockCtx.oscillators.forEach((osc, idx) => {
      expect(osc.type).toBe('sine')
      expect(osc.frequency.calls[0]?.args[0]).toBeCloseTo(expectedFreqs[idx] ?? 0, 2)
      expect(osc.connectCalls[0]).toBe(mockCtx.gains[idx])
      expect(osc.startCalls.length).toBe(1)
      expect(osc.stopCalls.length).toBe(1)
    })

    // Check gain envelopes: initial set, exponential ramp up, exponential ramp down
    mockCtx.gains.forEach((g) => {
      expect(g.connectCalls[0]).toBe(mockCtx.destination)
      expect(g.gain.calls).toHaveLength(3)
      expect(g.gain.calls[0]?.method).toBe('setValueAtTime')
      expect(g.gain.calls[1]?.method).toBe('exponentialRampToValueAtTime')
      expect(g.gain.calls[2]?.method).toBe('exponentialRampToValueAtTime')
    })
  })

  test('resumes suspended audio context', () => {
    const mockCtx = new MockAudioContext()
    // eslint-disable-next-line functional/immutable-data -- test setup
    mockCtx.state = 'suspended'

    playFanfareChord(() => asAudioContext(mockCtx))
    expect(mockCtx.resume).toHaveBeenCalled()
  })

  test('safely no-ops when audio context is unavailable or returns null', () => {
    expect(() => {
      playFanfareChord(() => null)
    }).not.toThrow()
  })

  test('guards against errors thrown during audio context creation or playback', () => {
    expect(() => {
      playFanfareChord(() => {
        throw new Error('Web Audio not allowed')
      })
    }).not.toThrow()
  })
})
