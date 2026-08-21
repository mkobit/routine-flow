import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { generateBreakDurationVariantsNotes } from './generators/break-duration-variants'
import { generateBugTriageBlitzNotes } from './generators/bug-triage-blitz'
import { generateChoreListNotes } from './generators/chore-list'
import { generateDeskMicroMovementNotes } from './generators/desk-micro-movement'
import { generateDogWalkNotes } from './generators/dog-walk'
import { generateEveningWindDownNotes } from './generators/evening-wind-down'
import { generateLunchAndRechargeNotes } from './generators/lunch-and-recharge'
import { generateManualClearNotes } from './generators/manual-clear'
import { generateMorningKickoffNotes } from './generators/morning-kickoff'
import { generatePomodoroNotes } from './generators/pomodoro'
import { generateShutdownRitualNotes } from './generators/shutdown-ritual'
import { generateSilentMeetingNotes } from './generators/silent-meeting'
import { generateSpacedRepetitionNotes } from './generators/spaced-repetition'
import { generateSprintRetrospectiveNotes } from './generators/sprint-retrospective'
import { generateStandupNotes } from './generators/standup'
import { generateStretchBreakNotes } from './generators/stretch-break'
import { generateUltradianRhythmNotes } from './generators/ultradian-rhythm'
import { generateWorkoutNotes } from './generators/workout'
import { generateWriteBackVariantsNotes } from './generators/write-back-variants'
import { DEFAULT_VAULT_SEED, resolveVaultSeed } from './seed'
import type { NoteDefinition } from './schema'
import { writeVault } from './vault'

export { DEFAULT_VAULT_SEED, resolveVaultSeed, ANCHOR_DATE } from './seed'
export { routineFileNote, routineReadme, indexedPath, slugify } from './routine-note'
export * from './generators/break-duration-variants'
export * from './generators/bug-triage-blitz'
export * from './generators/chore-list'
export * from './generators/desk-micro-movement'
export * from './generators/dog-walk'
export * from './generators/evening-wind-down'
export * from './generators/lunch-and-recharge'
export * from './generators/manual-clear'
export * from './generators/morning-kickoff'
export * from './generators/pomodoro'
export * from './generators/shutdown-ritual'
export * from './generators/silent-meeting'
export * from './generators/spaced-repetition'
export * from './generators/sprint-retrospective'
export * from './generators/standup'
export * from './generators/stretch-break'
export * from './generators/ultradian-rhythm'
export * from './generators/workout'
export * from './generators/write-back-variants'

const ROUTINE_SEED_OFFSETS = {
  pomodoro: 0,
  standup: 1,
  workout: 2,
  spacedRepetition: 3,
  choreList: 4,
  morningKickoff: 5,
  eveningWindDown: 6,
  bugTriageBlitz: 7,
  ultradianRhythm: 8,
} as const

export const GENERATED_VAULT_FOLDERS = [
  'pomodoro',
  'standup',
  'workout',
  'spaced-repetition',
  'stretch-break',
  'chore-list',
  'sprint-retrospective',
  'manual-clear',
  'write-back-variants',
  'break-duration-variants',
  'silent-meeting',
  'shutdown-ritual',
  'lunch-and-recharge',
  'dog-walk',
  'morning-kickoff',
  'evening-wind-down',
  'bug-triage-blitz',
  'ultradian-rhythm',
  'desk-micro-movement',
] as const

export function generateVault(seed: number = resolveVaultSeed()): readonly NoteDefinition[] {
  return [
    ...generatePomodoroNotes(seed + ROUTINE_SEED_OFFSETS.pomodoro),
    ...generateStandupNotes(seed + ROUTINE_SEED_OFFSETS.standup),
    ...generateWorkoutNotes(seed + ROUTINE_SEED_OFFSETS.workout),
    ...generateSpacedRepetitionNotes(seed + ROUTINE_SEED_OFFSETS.spacedRepetition),
    ...generateStretchBreakNotes(),
    ...generateChoreListNotes(seed + ROUTINE_SEED_OFFSETS.choreList),
    ...generateSprintRetrospectiveNotes(),
    ...generateManualClearNotes(),
    ...generateWriteBackVariantsNotes(),
    ...generateBreakDurationVariantsNotes(),
    ...generateSilentMeetingNotes(),
    ...generateShutdownRitualNotes(),
    ...generateLunchAndRechargeNotes(),
    ...generateDogWalkNotes(),
    ...generateMorningKickoffNotes(seed + ROUTINE_SEED_OFFSETS.morningKickoff),
    ...generateEveningWindDownNotes(seed + ROUTINE_SEED_OFFSETS.eveningWindDown),
    ...generateBugTriageBlitzNotes(seed + ROUTINE_SEED_OFFSETS.bugTriageBlitz),
    ...generateUltradianRhythmNotes(seed + ROUTINE_SEED_OFFSETS.ultradianRhythm),
    ...generateDeskMicroMovementNotes(),
  ]
}

export async function rebuildGeneratedVault(baseDir: string, seed: number = resolveVaultSeed()): Promise<readonly Error[]> {
  await Promise.all(GENERATED_VAULT_FOLDERS.map(folder =>
    fs.rm(path.join(baseDir, folder), { recursive: true, force: true }),
  ))
  return writeVault(baseDir, generateVault(seed))
}
