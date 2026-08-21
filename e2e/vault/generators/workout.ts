import fc from 'fast-check'
import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const WORKOUT_EXERCISE_POOL = ['Squats', 'Push-ups', 'Lunges', 'Plank', 'Rows', 'Deadlifts', 'Burpees'] as const

export function generateWorkoutNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...WORKOUT_EXERCISE_POOL), { minLength: 4, maxLength: 6 })
  const [sequence] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'workout',
      'The workout routine (see dev-docs/examples/workout.md) runs a warm-up, then rep-based set / timed rest cycles, finishing at a terminal cool-down.\n`Exercises.md` is the ordered, fixed-sequence exercise list the `set` phase steps through — no Bases query involved.',
    ),
    routineFileNote(
      'workout',
      'workout-routine.md',
      {
        id: 'workout',
        name: 'Workout',
        phases: [
          {
            id: 'warmup',
            label: 'Warm-up',
            kind: 'warm-up',
            duration: 'PT5S',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'set',
            label: 'Set',
            kind: 'set',
            duration: null,
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'rest',
            label: 'Rest',
            kind: 'rest',
            duration: 'PT5S',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'cooldown',
            label: 'Cool-down',
            kind: 'rest',
            duration: 'PT5S',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'warmup', toPhaseId: 'set', condition: { kind: 'always' } },
          { fromPhaseId: 'set', toPhaseId: 'rest', condition: { kind: 'always' } },
          { fromPhaseId: 'rest', toPhaseId: 'cooldown', condition: { kind: 'everyNth', n: 4 } },
          { fromPhaseId: 'rest', toPhaseId: 'set', condition: { kind: 'always' } },
        ],
      },
      'Workout routine',
      'Hand-authored routine file for workout warm-up/set/rest with terminal cool-down.',
    ),
    createNote(
      'workout/Exercises.md',
      { sequence: sequence ?? [] },
      'Generated test data for the workout routine (see dev-docs/examples/workout.md).',
    ),
  ]
}
