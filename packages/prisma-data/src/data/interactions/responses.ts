import type { PrismaClient } from '@klicker-uzh/prisma/client'

import {
  correctnessProbability,
  type Calendar,
  type ProfileBudget,
  type Rng,
} from './helpers.js'

type ActivitySource = 'practiceQuiz' | 'microLearning'

type CourseActivity = {
  activityId: string
  source: ActivitySource
  instances: { id: number; elementType: string }[]
}

type Outcome = 'CORRECT' | 'PARTIAL' | 'WRONG'

// Element types for which this seeder emits payloads analytics can score.
const SCORABLE_ELEMENT_TYPES = new Set([
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
])

const OUTCOME_VALUES: Record<
  Outcome,
  { score: number; points: number; xp: number }
> = {
  CORRECT: { score: 1, points: 10, xp: 1 },
  PARTIAL: { score: 0.5, points: 5, xp: 0.5 },
  WRONG: { score: 0, points: 0, xp: 0 },
}

function activityFkFields(activity: CourseActivity) {
  return {
    practiceQuizId:
      activity.source === 'practiceQuiz' ? activity.activityId : null,
    microLearningId:
      activity.source === 'microLearning' ? activity.activityId : null,
  }
}

// Pull the full set of practice-quiz + microlearning element instances for
// one course, so every generated response lands on a real FK target.
async function loadCourseActivities(
  prisma: PrismaClient,
  courseId: string
): Promise<CourseActivity[]> {
  const [pqs, mls] = await Promise.all([
    prisma.practiceQuiz.findMany({
      where: { courseId, isDeleted: false },
      include: {
        stacks: {
          include: { elements: { select: { id: true, elementType: true } } },
        },
      },
    }),
    prisma.microLearning.findMany({
      where: { courseId, isDeleted: false },
      include: {
        stacks: {
          include: { elements: { select: { id: true, elementType: true } } },
        },
      },
    }),
  ])

  const activities: CourseActivity[] = []
  for (const pq of pqs) {
    const instances = pq.stacks.flatMap((s) => s.elements)
    if (instances.length > 0) {
      activities.push({ activityId: pq.id, source: 'practiceQuiz', instances })
    }
  }
  for (const ml of mls) {
    const instances = ml.stacks.flatMap((s) => s.elements)
    if (instances.length > 0) {
      activities.push({ activityId: ml.id, source: 'microLearning', instances })
    }
  }
  return activities
}

// Build valid response payloads consumed by analytics correctness computation.
function responsePayload(elementType: string, rng: Rng): object {
  switch (elementType) {
    case 'SC':
      return { choices: [rng.int(0, 3)] }
    case 'MC':
    case 'KPRIM':
      return { choices: rng.shuffle([0, 1, 2, 3]).slice(0, 2) }
    case 'NUMERICAL':
      return { value: `${rng.int(0, 100)}` }
    case 'FREE_TEXT':
      return { value: 'simulated response' }
    default:
      return { value: 'simulated' }
  }
}

// One QuestionResponse row per (participant, element instance). If the
// participant "retries" the activity their trialsCount climbs and the
// last-response fields update — matches the upsert semantics the real app
// uses, so analytics first-vs-last metrics read as intended.
export async function seedQuestionResponses({
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
}): Promise<{ inserted: number; updated: number }> {
  const activities = await loadCourseActivities(prisma, courseId)
  if (activities.length === 0) return { inserted: 0, updated: 0 }

  const participations = await prisma.participation.findMany({
    where: {
      courseId,
      participantId: { in: [...participantIds] },
    },
    select: { id: true, participantId: true },
  })
  const participationByParticipant = new Map(
    participations.map((p) => [p.participantId, p.id])
  )

  let inserted = 0
  let updated = 0

  for (const participantId of participantIds) {
    const budget = profiles.get(participantId)
    if (!budget || budget.responsesTarget === 0) continue
    const participationId = participationByParticipant.get(participantId)
    if (!participationId) continue

    // Pick a random subset of (activity, instance) pairs to respond to.
    const instancePool: {
      activity: CourseActivity
      instanceId: number
      elementType: string
    }[] = []
    for (const a of activities) {
      for (const inst of a.instances) {
        if (!SCORABLE_ELEMENT_TYPES.has(inst.elementType)) continue
        instancePool.push({
          activity: a,
          instanceId: inst.id,
          elementType: inst.elementType,
        })
      }
    }
    const targetResponses = Math.min(
      budget.responsesTarget,
      instancePool.length
    )
    const shuffled = rng.shuffle(instancePool).slice(0, targetResponses)

    for (const pick of shuffled) {
      const difficulty = difficulties.get(pick.instanceId) ?? 0.5
      const pCorrect = correctnessProbability(budget.ability, difficulty)

      // Decide on 1–3 attempts. Heavy users retry more.
      const maxAttempts =
        budget.profile === 'heavy' ? 3 : budget.profile === 'medium' ? 2 : 1
      const attempts = rng.int(1, maxAttempts)

      const timestamps: Date[] = []
      for (let i = 0; i < attempts; i++) timestamps.push(calendar.sample(rng))
      timestamps.sort((a, b) => a.getTime() - b.getTime())

      const outcomes: Outcome[] = timestamps.map(() =>
        rng.bool(pCorrect) ? 'CORRECT' : rng.bool(0.3) ? 'PARTIAL' : 'WRONG'
      )

      const first = outcomes[0]!
      const last = outcomes[outcomes.length - 1]!
      const firstTs = timestamps[0]!
      const lastTs = timestamps[timestamps.length - 1]!

      const correctCount = outcomes.filter((o) => o === 'CORRECT').length
      const partialCount = outcomes.filter((o) => o === 'PARTIAL').length
      const wrongCount = outcomes.filter((o) => o === 'WRONG').length
      const correctStreak = (() => {
        let s = 0
        for (let i = outcomes.length - 1; i >= 0; i--) {
          if (outcomes[i] === 'CORRECT') s++
          else break
        }
        return s
      })()

      const perResponsePoints =
        last === 'CORRECT' ? 30 : last === 'PARTIAL' ? 15 : 0
      const totalScore =
        outcomes.reduce((acc, o) => acc + OUTCOME_VALUES[o].score, 0) * 10
      const timeSpent = 5 + rng.next() * 45

      // Aggregated responses JSON has an element-type-dependent shape in
      // production. For SC/MC/KPRIM we store {total, [idx]: count}. For
      // FREE_TEXT/NUMERICAL we store {total, responses: [...]}. Analytics
      // scripts don't introspect this beyond ensuring it's not null.
      const aggregated = { total: outcomes.length }

      const firstPayload = responsePayload(pick.elementType, rng)
      const lastPayload = responsePayload(pick.elementType, rng)

      const baseData = {
        participantId,
        participationId,
        elementInstanceId: pick.instanceId,
        courseId,
        trialsCount: outcomes.length,
        totalScore,
        totalPointsAwarded: perResponsePoints,
        totalXpAwarded: last === 'CORRECT' ? 10 : 0,
        averageTimeSpent: timeSpent,
        lastAnsweredAt: lastTs,
        lastAwardedAt: lastTs,
        lastXpAwardedAt: last === 'CORRECT' ? lastTs : null,
        correctCount,
        correctCountStreak: correctStreak,
        lastCorrectAt: correctCount > 0 ? lastTs : null,
        partialCorrectCount: partialCount,
        lastPartialCorrectAt: partialCount > 0 ? lastTs : null,
        wrongCount,
        lastWrongAt: wrongCount > 0 ? lastTs : null,
        firstResponse: firstPayload,
        firstResponseCorrectness: first,
        lastResponse: lastPayload,
        lastResponseCorrectness: last,
        aggregatedResponses: aggregated,
        createdAt: firstTs,
        updatedAt: lastTs,
        ...activityFkFields(pick.activity),
      }

      const existing = await prisma.questionResponse.findUnique({
        where: {
          participantId_elementInstanceId: {
            participantId,
            elementInstanceId: pick.instanceId,
          },
        },
        select: { id: true },
      })

      if (existing) {
        await prisma.questionResponse.update({
          where: { id: existing.id },
          data: baseData,
        })
        updated++
      } else {
        await prisma.questionResponse.create({ data: baseData })
        inserted++
      }

      // Per-attempt log: the analytics pipeline reads these (not the
      // aggregated QuestionResponse) for monthly correctness windows and
      // activity progress. Wipe + recreate so re-runs stay idempotent.
      await prisma.questionResponseDetail.deleteMany({
        where: { participantId, elementInstanceId: pick.instanceId },
      })
      await prisma.questionResponseDetail.createMany({
        data: timestamps.map((ts, i) => {
          const outcome = outcomes[i]!
          const v = OUTCOME_VALUES[outcome]
          return {
            score: v.score,
            pointsAwarded: v.points,
            xpAwarded: v.xp,
            timeSpent: 5 + rng.next() * 45,
            response: responsePayload(pick.elementType, rng),
            participantId,
            participationId,
            elementInstanceId: pick.instanceId,
            ...activityFkFields(pick.activity),
            createdAt: ts,
            updatedAt: ts,
          }
        }),
      })
    }
  }

  return { inserted, updated }
}
