import { routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

export function generateDogWalkNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'dog-walk',
      'The dog-walk routine paces preparation, neighborhood walk, and return cleanup.',
    ),
    routineFileNote(
      'dog-walk',
      'dog-walk-routine.md',
      {
        id: 'dog-walk',
        name: 'Dog walk routine',
        phases: [
          {
            id: 'walk-prep',
            label: 'Gear and leash prep',
            kind: 'ritual',
            duration: 'PT3M',
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
            id: 'neighborhood-walk',
            label: 'Neighborhood walk',
            kind: 'walk',
            duration: 'PT25M',
            taskSourceId: null,
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'post-walk',
            label: 'Paw wipe and hydration',
            kind: 'ritual',
            duration: 'PT2M',
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
          { fromPhaseId: 'walk-prep', toPhaseId: 'neighborhood-walk', condition: { kind: 'always' } },
          { fromPhaseId: 'neighborhood-walk', toPhaseId: 'post-walk', condition: { kind: 'always' } },
        ],
      },
      'Dog walk routine',
      'Hand-authored routine file for outdoor pet care.',
    ),
  ]
}
