export interface FanfareOptions {
  readonly baseFreq?: number
  readonly ratios?: readonly number[]
  readonly attackDuration?: number
  readonly decayDuration?: number
  readonly staggerInterval?: number
  readonly peakGain?: number
}

/**
 * Synthesizes a celebratory fanfare chord using the Web Audio API.
 * Uses pleasant fanfare chord frequency ratios ([1.0, 1.25, 1.5, 2.0] by default)
 * with exponential gain decay. Guards against errors if AudioContext is unavailable or suspended.
 */
export function playFanfareChord(
  audioContextFactory?: () => AudioContext | null,
  options?: FanfareOptions,
): void {
  try {
    let ctx: AudioContext | null = null
    if (audioContextFactory !== undefined) {
      ctx = audioContextFactory()
    }
    else if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext
      if (AudioContextClass) {
        ctx = new AudioContextClass()
      }
    }

    if (!ctx) {
      return
    }

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Ignore resume errors in background/headless environments
      })
    }

    const baseFreq = options?.baseFreq ?? 523.25
    const ratios = options?.ratios ?? [1.0, 1.25, 1.5, 2.0]
    const attack = options?.attackDuration ?? 0.02
    const decay = options?.decayDuration ?? 0.8
    const stagger = options?.staggerInterval ?? 0.08
    const peakGain = (options?.peakGain ?? 0.2) / ratios.length

    const now = ctx.currentTime

    for (let index = 0; index < ratios.length; index++) {
      const ratio = ratios[index] ?? 1.0
      const startTime = now + index * stagger
      const stopTime = startTime + decay + 0.05

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.frequency.setValueAtTime(baseFreq * ratio, startTime)

      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(stopTime)
    }

    // Auto-close after playback completes to prevent resource leaks
    const totalDurationMs = Math.ceil((ratios.length * stagger + decay + 0.1) * 1000)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        try {
          if (ctx && ctx.state !== 'closed') {
            void ctx.close().catch(() => {})
          }
        }
        catch {
          // Ignore close errors
        }
      }, totalDurationMs)
    }
  }
  catch {
    // Guard against errors if AudioContext is unavailable, suspended, or throws
  }
}
