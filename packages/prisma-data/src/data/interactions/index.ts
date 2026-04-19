import type { PrismaClient } from '@klicker-uzh/prisma/client'

import {
  COURSE_ID_TEST4 as COURSE_ID_ASSESSMENT,
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
} from '../constants.js'
import { seedChatInteractions } from './chatMessages.js'
import {
  assignDifficulty,
  assignProfiles,
  makeCalendar,
  makeRng,
  type ProfileBudget,
  type Rng,
} from './helpers.js'
import { seedLiveQuizResponses } from './liveQuizResponses.js'
import { ensureParticipations } from './participations.js'
import { seedQuestionResponses } from './responses.js'

const DEFAULT_SEED = 'klicker-analytics-fixture-v1'

// Fetches every element instance id in a course (practice + microlearning +
// live-quiz block instances) so the difficulty assigner covers anything
// that might receive a response or live-quiz response.
async function loadAllCourseInstanceIds(
  prisma: PrismaClient,
  courseId: string
): Promise<number[]> {
  const [pqStacks, mlStacks, liveBlocks] = await Promise.all([
    prisma.elementStack.findMany({
      where: { practiceQuiz: { courseId } },
      include: { elements: { select: { id: true } } },
    }),
    prisma.elementStack.findMany({
      where: { microLearning: { courseId } },
      include: { elements: { select: { id: true } } },
    }),
    prisma.elementBlock.findMany({
      where: { liveQuiz: { courseId } },
      include: { elements: { select: { id: true } } },
    }),
  ])
  const ids = new Set<number>()
  for (const s of pqStacks) for (const e of s.elements) ids.add(e.id)
  for (const s of mlStacks) for (const e of s.elements) ids.add(e.id)
  for (const b of liveBlocks) for (const e of b.elements) ids.add(e.id)
  return [...ids]
}

export type SeedInteractionsResult = {
  seed: string
  perCourse: Array<{
    courseId: string
    participations: number
    responses: { inserted: number; updated: number }
    liveQuizResponses: { inserted: number; updated: number; quizzes: number }
    chat: { threads: number; messages: number }
  }>
}

export async function seedInteractions({
  prisma,
  seed = DEFAULT_SEED,
}: {
  prisma: PrismaClient
  seed?: string
}): Promise<SeedInteractionsResult> {
  const rng: Rng = makeRng(seed)
  const calendar = makeCalendar()
  const profiles = assignProfiles(PARTICIPANT_IDS, rng)

  const perCourse: SeedInteractionsResult['perCourse'] = []

  // --- Course 1: Testkurs (main target) ---
  // Already has 50 participations; no-op on participations, then drive the
  // full response + chat volume here.
  const testkursInstanceIds = await loadAllCourseInstanceIds(
    prisma,
    COURSE_ID_TEST
  )
  const testkursDifficulties = assignDifficulty(testkursInstanceIds, rng)

  const testkursParticipations = await ensureParticipations({
    prisma,
    courseId: COURSE_ID_TEST,
    participantIds: PARTICIPANT_IDS,
  })
  const testkursResponses = await seedQuestionResponses({
    prisma,
    courseId: COURSE_ID_TEST,
    participantIds: PARTICIPANT_IDS,
    profiles,
    difficulties: testkursDifficulties,
    calendar,
    rng,
  })
  const testkursChat = await seedChatInteractions({
    prisma,
    courseId: COURSE_ID_TEST,
    participantIds: PARTICIPANT_IDS,
    profiles,
    calendar,
    rng,
  })
  perCourse.push({
    courseId: COURSE_ID_TEST,
    participations: testkursParticipations,
    responses: testkursResponses,
    liveQuizResponses: { inserted: 0, updated: 0, quizzes: 0 },
    chat: testkursChat,
  })

  // --- Course 2: Assessment Course ---
  // No participations yet; only 2 assessment live quizzes with 1 instance
  // each. Enrol a subset (30) and populate live-quiz responses so script 14
  // has actual data to roll up.
  const assessmentInstanceIds = await loadAllCourseInstanceIds(
    prisma,
    COURSE_ID_ASSESSMENT
  )
  const assessmentDifficulties = assignDifficulty(assessmentInstanceIds, rng)
  const assessmentParticipants = PARTICIPANT_IDS.slice(0, 30)
  // Assessment-course participants reuse their Testkurs profile budgets;
  // chat and quiz targets there don't apply (no chat bot, no practice
  // quizzes), but `ability` and `profile` still drive live-quiz outcomes.
  const assessmentProfiles = new Map<string, ProfileBudget>()
  for (const pid of assessmentParticipants) {
    const base = profiles.get(pid)
    if (base) assessmentProfiles.set(pid, base)
  }
  const assessmentParticipations = await ensureParticipations({
    prisma,
    courseId: COURSE_ID_ASSESSMENT,
    participantIds: assessmentParticipants,
  })
  const assessmentLiveQuiz = await seedLiveQuizResponses({
    prisma,
    courseId: COURSE_ID_ASSESSMENT,
    participantIds: assessmentParticipants,
    profiles: assessmentProfiles,
    difficulties: assessmentDifficulties,
    calendar,
    rng,
  })
  perCourse.push({
    courseId: COURSE_ID_ASSESSMENT,
    participations: assessmentParticipations,
    responses: { inserted: 0, updated: 0 },
    liveQuizResponses: assessmentLiveQuiz,
    chat: { threads: 0, messages: 0 },
  })

  return { seed, perCourse }
}
