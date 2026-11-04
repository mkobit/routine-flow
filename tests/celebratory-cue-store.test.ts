import { describe, expect, mock, test } from 'bun:test'
import { EngineStore } from '../src/timer/store'
import { PhaseGraphSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema } from '../src/domain/phase/phase'
import type { NotificationPort } from '../src/timer/notification-port'
import type { AudioCuePort } from '../src/timer/audio-cue-port'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'

describe('celebratory cue and notification in EngineStore', () => {
  const focusId = PhaseIdSchema.parse('focus')
  const shortBreakId = PhaseIdSchema.parse('short-break')
  const prizeBreakId = PhaseIdSchema.parse('prize-break')

  const rewardEconomyGraph: PhaseGraph = PhaseGraphSchema.parse({
    id: 'star-jar',
    name: 'Star jar reward routine',
    trackerFilePath: 'star-jar-economy/Star-Jar-Tracker.md',
    phases: [
      {
        id: focusId,
        name: 'Focus',
        label: 'Focus session',
        kind: 'focus',
        duration: 'PT25M',
        onCompletion: 'waitForManual',
        handlers: {
          onComplete: [{ kind: 'preset', preset: 'accumulateReward' }],
        },
      },
      {
        id: shortBreakId,
        name: 'Short break',
        label: 'Short break',
        kind: 'break',
        duration: 'PT5M',
        onCompletion: 'autoAdvance',
        handlers: {},
      },
      {
        id: prizeBreakId,
        name: 'Prize celebration break',
        label: 'Prize celebration break',
        kind: 'break',
        duration: 'PT30M',
        onCompletion: 'autoAdvance',
        handlers: {
          onExit: [{ kind: 'preset', preset: 'resetReward' }],
        },
      },
    ],
    transitions: [
      {
        from: focusId,
        to: prizeBreakId,
        guard: { kind: 'custom', predicateName: 'star-jar-full' },
      },
      {
        from: focusId,
        to: shortBreakId,
        guard: { kind: 'always' },
      },
      {
        from: shortBreakId,
        to: focusId,
        guard: { kind: 'always' },
      },
      {
        from: prizeBreakId,
        to: focusId,
        guard: { kind: 'always' },
      },
    ],
  })

  test('transitioning into reward phase triggers celebratory toast notice and fanfare chime', async () => {
    const notifyInApp = mock((_msg: string) => {})
    const notifySystem = mock((_title: string, _body: string) => {})
    const notificationPort: NotificationPort = { notifyInApp, notifySystem }

    const playFanfare = mock(() => {})
    const audioCuePort: AudioCuePort = { playFanfare }

    const frontmatterReader: FrontmatterReader = {
      readValue: () => 15,
      readAll: () => ({ stars: 15, target: 15 }),
    }

    const store = new EngineStore(rewardEconomyGraph, {
      notificationPort,
      audioCuePort,
      frontmatterReader,
      predicateRegistry: {
        resolve: name => (name === 'star-jar-full' ? () => true : undefined),
      },
    })

    // Verify initial tracker frontmatter is synced on initialization
    expect(store.getState().trackerFrontmatter).toEqual({ stars: 15, target: 15 })

    // Start focus
    await store.dispatch({ type: 'start' })
    expect(store.getState().status).toBe('running')
    expect(store.getState().currentPhaseId).toBe(focusId)

    // Complete focus and advance to next phase
    await store.dispatch({ type: 'finish-phase' })
    await store.dispatch({ type: 'advance-phase' })

    // Store transitions to prizeBreakId
    expect(store.getState().currentPhaseId).toBe(prizeBreakId)

    // Fanfare chime must have been triggered
    expect(playFanfare).toHaveBeenCalledTimes(1)

    // Celebratory toast notice must have been dispatched
    expect(notifyInApp).toHaveBeenCalledWith(
      expect.stringContaining('Reward threshold reached'),
    )
    expect(notifyInApp).toHaveBeenCalledWith(
      expect.stringContaining('Routine Flow: Reward threshold reached! Enjoy your prize celebration break'),
    )
  })

  test('transitioning to standard short break does NOT trigger fanfare cue', async () => {
    const notifyInApp = mock((_msg: string) => {})
    const notifySystem = mock((_title: string, _body: string) => {})
    const notificationPort: NotificationPort = { notifyInApp, notifySystem }

    const playFanfare = mock(() => {})
    const audioCuePort: AudioCuePort = { playFanfare }

    const store = new EngineStore(rewardEconomyGraph, {
      notificationPort,
      audioCuePort,
      predicateRegistry: {
        resolve: () => () => false, // star-jar-full is false -> branches to short break
      },
    })

    await store.dispatch({ type: 'start' })
    await store.dispatch({ type: 'finish-phase' })
    await store.dispatch({ type: 'advance-phase' })

    expect(store.getState().currentPhaseId).toBe(shortBreakId)

    // Fanfare NOT called for standard break
    expect(playFanfare).not.toHaveBeenCalled()

    // Normal phase transition toast dispatched instead
    expect(notifyInApp).toHaveBeenCalledWith('Routine Flow: Short break phase started')
  })
})
