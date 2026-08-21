import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

export function generateSprintRetrospectiveNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'sprint-retrospective',
      'The sprint-retrospective routine (see dev-docs/examples/sprint-retrospective.md) runs facilitator-paced discussion segments (What went well, What didn\'t, Action items), each duration-less (`duration: null`) with `manualClear` completion, terminating at action items.\n`Agenda.md` lists the retrospective segments.',
    ),
    routineFileNote(
      'sprint-retrospective',
      'sprint-retrospective-routine.md',
      {
        id: 'sprint-retrospective',
        name: 'Sprint retrospective',
        phases: [
          {
            id: 'what-went-well',
            label: 'What went well',
            kind: 'discussion',
            duration: null,
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
            id: 'what-didnt',
            label: 'What didn\'t go well',
            kind: 'discussion',
            duration: null,
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
            id: 'action-items',
            label: 'Action items',
            kind: 'discussion',
            duration: null,
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
          { fromPhaseId: 'what-went-well', toPhaseId: 'what-didnt', condition: { kind: 'always' } },
          { fromPhaseId: 'what-didnt', toPhaseId: 'action-items', condition: { kind: 'always' } },
        ],
      },
      'Sprint retrospective routine',
      'Hand-authored routine file for team sprint retrospectives with terminal action-items phase.',
    ),
    createNote(
      'sprint-retrospective/Agenda.md',
      { segments: ['What went well', 'What didn\'t', 'Action items'] },
      'Generated test data for the sprint-retrospective routine (see dev-docs/examples/sprint-retrospective.md).',
    ),
  ]
}
