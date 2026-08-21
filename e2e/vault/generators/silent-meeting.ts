import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

export function generateSilentMeetingNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'silent-meeting',
      'The silent-meeting routine (see dev-docs/examples/silent-meeting.md) runs an Amazon-style silent meeting agenda: timed pre-read, context framing, open discussion, and action item locking, ending at the terminal action-items phase.\n`Meeting-brief.md` provides background notes.',
    ),
    routineFileNote(
      'silent-meeting',
      'silent-meeting-routine.md',
      {
        id: 'silent-meeting',
        name: 'Silent meeting agenda',
        phases: [
          {
            id: 'pre-read',
            label: 'Silent pre-read',
            kind: 'review',
            duration: 'PT5M',
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
            id: 'context',
            label: 'Context framing',
            kind: 'discussion',
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
            id: 'discussion',
            label: 'Open discussion',
            kind: 'discussion',
            duration: 'PT20M',
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
            label: 'Action items and owners',
            kind: 'discussion',
            duration: 'PT4M',
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
          { fromPhaseId: 'pre-read', toPhaseId: 'context', condition: { kind: 'always' } },
          { fromPhaseId: 'context', toPhaseId: 'discussion', condition: { kind: 'always' } },
          { fromPhaseId: 'discussion', toPhaseId: 'action-items', condition: { kind: 'always' } },
        ],
      },
      'Silent meeting agenda routine',
      'Hand-authored routine file for silent reading and structured meeting discussions with terminal finish.',
    ),
    createNote(
      'silent-meeting/Meeting-brief.md',
      { topic: 'Q3 Architectural Roadmap', docUrl: 'https://example.com/spec' },
      'Generated briefing document for the silent meeting agenda routine.',
    ),
  ]
}
