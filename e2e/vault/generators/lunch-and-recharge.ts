import { routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

export function generateLunchAndRechargeNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'lunch-and-recharge',
      'The lunch-and-recharge routine structures midday replenishment: meal prep, outdoor walking break, and quiet reading before afternoon focus.',
    ),
    routineFileNote(
      'lunch-and-recharge',
      'lunch-and-recharge-routine.md',
      {
        id: 'lunch-and-recharge',
        name: 'Lunch break and recharge',
        phases: [
          {
            id: 'meal-prep',
            label: 'Mindful lunch',
            kind: 'break',
            duration: 'PT25M',
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
            id: 'outdoor-walk',
            label: 'Outdoor daylight stroll',
            kind: 'walk',
            duration: 'PT15M',
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
            id: 'quiet-reset',
            label: 'Hydration and quiet reset',
            kind: 'break',
            duration: 'PT10M',
            taskSourceId: null,
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'meal-prep', toPhaseId: 'outdoor-walk', condition: { kind: 'always' } },
          { fromPhaseId: 'outdoor-walk', toPhaseId: 'quiet-reset', condition: { kind: 'always' } },
        ],
      },
      'Lunch break and recharge routine',
      'Hand-authored routine file for restorative midday breaks.',
    ),
  ]
}
