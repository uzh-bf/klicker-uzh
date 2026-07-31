import type { PrismaClient } from '@klicker-uzh/prisma/client'

import {
  correctnessProbability,
  type Calendar,
  type ProfileBudget,
  type Rng,
} from './helpers.js'

// Promote assessment-mode live quizzes on a course from DRAFT to ENDED and
// stamp startedAt/finishedAt so script 14's SQL can see them as finished
// assessments. Returns the list of quizzes that were touched.
async function prepareAssessmentLiveQuizzes(
  prisma: PrismaClient,
  courseId: string,
  calendar: Calendar,
  rng: Rng
) {
  const quizzes = await prisma.liveQuiz.findMany({
    where: { courseId, isAssessmentEnabled: true, isDeleted: false },
    include: {
      blocks: {
        include: { elements: { select: { id: true, elementType: true } } },
      },
    },
  })

  const prepared: {
    id: string
    startedAt: Date
    finishedAt: Date
    instances: { id: number; elementType: string; blockExecution: number }[]
  }[] = []

  for (const q of quizzes) {
    const startedAt = calendar.sample(rng)
    // 15-45 min sessions.
    const duration = (15 + rng.int(0, 30)) * 60 * 1000
    const finishedAt = new Date(startedAt.getTime() + duration)

    await prisma.liveQuiz.update({
      where: { id: q.id },
      data: {
        status: 'ENDED',
        startedAt,
        finishedAt,
      },
    })

    const instances: (typeof prepared)[number]['instances'] = []
    for (const block of q.blocks) {
      for (const inst of block.elements) {
        instances.push({
          id: inst.id,
          elementType: inst.elementType,
          blockExecution: block.execution ?? 0,
        })
      }
    }
    prepared.push({ id: q.id, startedAt, finishedAt, instances })
  }
  return prepared
}

function liveResponsePayload(elementType: string, rng: Rng): object {
  switch (elementType) {
    case 'SC':
      return { choices: [rng.int(0, 3)] }
    case 'MC':
    case 'KPRIM':
      return { choices: rng.shuffle([0, 1, 2, 3]).slice(0, 2) }
    case 'NUMERICAL':
      return { value: `${rng.int(0, 100)}` }
    case 'FREE_TEXT':
      return { value: 'simulated live response' }
    default:
      return { value: 'simulated' }
  }
}

export async function seedLiveQuizResponses({
  prisma,
  courseId,
  participantIds,
  profiles,
  difficulties,
  calendar,
  rng,
}: {
  prisma: PrismaClient
  courseId: string
  participantIds: readonly string[]
  profiles: Map<string, ProfileBudget>
  difficulties: Map<number, number>
  calendar: Calendar
  rng: Rng
}): Promise<{ inserted: number; updated: number; quizzes: number }> {
  const quizzes = await prepareAssessmentLiveQuizzes(
    prisma,
    courseId,
    calendar,
    rng
  )
  if (quizzes.length === 0) return { inserted: 0, updated: 0, quizzes: 0 }

  let inserted = 0
  let updated = 0

  for (const quiz of quizzes) {
    // ~60-80% of enrolled participants attend each quiz.
    const attending = rng
      .shuffle(participantIds)
      .slice(
        0,
        Math.max(
          1,
          Math.floor(participantIds.length * (0.6 + rng.next() * 0.2))
        )
      )

    for (const participantId of attending) {
      const budget = profiles.get(participantId)
      const ability = budget?.ability ?? 0.5
      // Dormant users attend rarely; skip with high probability.
      if (budget?.profile === 'dormant' && rng.bool(0.8)) continue

      for (const instance of quiz.instances) {
        const difficulty = difficulties.get(instance.id) ?? 0.5
        const pCorrect = correctnessProbability(ability, difficulty)
        const outcome = rng.bool(pCorrect)
          ? 'CORRECT'
          : rng.bool(0.3)
            ? 'PARTIAL'
            : 'WRONG'

        // ~10% of responses land after finishedAt — exercises the
        // `lateSubmitterRate` metric in aggregated live quiz analytics.
        const isLate = rng.bool(0.1)
        const deadline = isLate
          ? quiz.finishedAt.getTime() + rng.int(60, 900) * 1000
          : quiz.startedAt.getTime() +
            rng.next() * (quiz.finishedAt.getTime() - quiz.startedAt.getTime())
        const submittedAt = new Date(deadline)

        const basePoints = 10
        const correctnessPoints =
          outcome === 'CORRECT' ? 5 : outcome === 'PARTIAL' ? 2 : 0
        const bonusPoints =
          outcome === 'CORRECT' && !isLate ? rng.int(0, 30) : 0

        const payload = liveResponsePayload(instance.elementType, rng)

        const existing = await prisma.liveQuizResponse.findUnique({
          where: {
            instanceId_elementBlockExecution_participantId: {
              instanceId: instance.id,
              elementBlockExecution: instance.blockExecution,
              participantId,
            },
          },
          select: { id: true },
        })

        const data = {
          instanceId: instance.id,
          elementBlockExecution: instance.blockExecution,
          participantId,
          submittedAt,
          response: payload,
          timeSpent: 5 + rng.next() * 25,
          correctness: outcome as 'CORRECT' | 'PARTIAL' | 'WRONG',
          basePoints,
          correctnessPoints,
          bonusPoints,
          correctionOnly: false,
          createdAt: submittedAt,
          updatedAt: submittedAt,
        }

        if (existing) {
          await prisma.liveQuizResponse.update({
            where: { id: existing.id },
            data,
          })
          updated++
        } else {
          await prisma.liveQuizResponse.create({ data })
          inserted++
        }
      }
    }
  }

  return { inserted, updated, quizzes: quizzes.length }
}
