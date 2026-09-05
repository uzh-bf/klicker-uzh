/**
 * Optional pre-step for seedCourseAwards.ts: derives the round's `derivedAward`
 * from in-platform behaviour instead of from the lecturer workbook.
 *
 * Rule: a participant qualifies when they answered every element instance of
 * every non-deleted microlearning in the course ("completed all microlearnings").
 *
 * Completion is read from QuestionResponse, never from
 * ParticipantActivityPerformance.completion or MicroLearning.completedCount /
 * startedCount: for the Summer School 2026 course all three are empty (zero rows,
 * zero counters) even though responses exist, so they derive zero awards silently
 * instead of failing.
 *
 * Reads the gitignored `_local/<round>_base.json` (workbook-derived rows without
 * the derived award) and writes `_local/<round>_data.json` for the seed. Executes
 * zero database writes; freezing the result into the payload keeps the seed's
 * payload-hash replay safety intact.
 *
 * Usage:
 *   ROUND=<key> pnpm --filter @klicker-uzh/prisma-data seed:prod:course-awards:prepare
 */
import { prisma } from '@klicker-uzh/prisma'
import fs from 'node:fs'
import { resolveRound, roundFile } from './courseAwardRounds.js'

interface BaseEntry {
  username: string
  points?: number
  awards?: string[]
}

const { key: ROUND, config } = resolveRound()
const baseUrl = roundFile(ROUND, 'base.json')
const outputUrl = roundFile(ROUND, 'data.json')

async function main() {
  const derivedAward = config.derivedAward
  if (!derivedAward) {
    throw new Error(`Round ${ROUND} declares no derivedAward`)
  }
  if (!config.awards.some((award) => award.key === derivedAward)) {
    throw new Error(
      `Round ${ROUND} derives ${derivedAward}, which is not one of its awards`
    )
  }

  const base: BaseEntry[] = JSON.parse(fs.readFileSync(baseUrl, 'utf-8'))
  console.log(`Base payload entries: ${base.length}`)

  const microLearnings = await prisma.microLearning.findMany({
    where: { courseId: config.courseId, isDeleted: false },
    select: {
      id: true,
      name: true,
      status: true,
      stacks: { select: { elements: { select: { id: true } } } },
    },
    orderBy: { scheduledStartAt: 'asc' },
  })

  if (microLearnings.length === 0) {
    throw new Error(`Course ${config.courseId} has no microlearnings`)
  }

  const required = microLearnings.map((microLearning) => {
    const instanceIds = microLearning.stacks.flatMap((stack) =>
      stack.elements.map((element) => element.id)
    )
    if (instanceIds.length === 0) {
      throw new Error(
        `Microlearning ${microLearning.name} has no element instances`
      )
    }
    return { ...microLearning, instanceIds }
  })

  console.log(
    `\nMicrolearnings in course ${config.courseId}: ${required.length}`
  )
  for (const microLearning of required) {
    console.log(
      `  ${microLearning.name} | ${microLearning.status} | ${microLearning.instanceIds.length} instances`
    )
  }

  const participants = await prisma.participant.findMany({
    where: {
      OR: base.map((entry) => ({
        username: { equals: entry.username, mode: 'insensitive' as const },
      })),
    },
    select: { id: true, username: true },
  })

  const byUsername = new Map<string, typeof participants>()
  for (const participant of participants) {
    const key = participant.username.toLocaleLowerCase('en-US')
    byUsername.set(key, [...(byUsername.get(key) ?? []), participant])
  }

  const resolved = base.map((entry) => {
    const candidates = byUsername.get(entry.username.toLocaleLowerCase('en-US'))
    const candidate = candidates?.[0]
    if (candidates?.length !== 1 || !candidate) {
      throw new Error(
        `Expected exactly one participant match for ${entry.username}, found ${candidates?.length ?? 0}`
      )
    }
    return { ...entry, participantId: candidate.id }
  })

  const responses = await prisma.questionResponse.findMany({
    where: {
      microLearningId: { in: required.map((item) => item.id) },
      participantId: { in: resolved.map((entry) => entry.participantId) },
    },
    select: {
      participantId: true,
      microLearningId: true,
      elementInstanceId: true,
    },
  })

  const answered = new Map<string, Set<number>>()
  for (const response of responses) {
    const key = `${response.participantId}:${response.microLearningId}`
    const set = answered.get(key) ?? new Set<number>()
    set.add(response.elementInstanceId)
    answered.set(key, set)
  }

  const completedPerMicroLearning = new Map<string, number>()
  const histogram = new Map<number, number>()

  const entries = resolved.map((entry) => {
    const completed = required.filter((microLearning) => {
      const set =
        answered.get(`${entry.participantId}:${microLearning.id}`) ??
        new Set<number>()
      return microLearning.instanceIds.every((id) => set.has(id))
    })

    for (const microLearning of completed) {
      completedPerMicroLearning.set(
        microLearning.name,
        (completedPerMicroLearning.get(microLearning.name) ?? 0) + 1
      )
    }
    histogram.set(completed.length, (histogram.get(completed.length) ?? 0) + 1)

    const { participantId: _participantId, ...rest } = entry
    const awards = (rest.awards ?? []).filter((award) => award !== derivedAward)
    return {
      ...rest,
      awards:
        completed.length === required.length
          ? [...awards, derivedAward]
          : awards,
    }
  })

  console.log('\nFully completed, per microlearning:')
  for (const microLearning of required) {
    console.log(
      `  ${microLearning.name}: ${completedPerMicroLearning.get(microLearning.name) ?? 0} of ${entries.length}`
    )
  }
  console.log('Fully completed microlearnings per participant:')
  for (const [completed, count] of [...histogram].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${completed}/${required.length}: ${count} participants`)
  }

  const derivedCount = entries.filter((entry) =>
    entry.awards.includes(derivedAward)
  ).length
  console.log(`\n${derivedAward} awards: ${derivedCount}`)
  console.log(
    `Point delta: ${entries.reduce((sum, entry) => sum + (entry.points ?? 0), 0)}`
  )
  for (const award of config.awards) {
    console.log(
      `${award.key}: ${entries.filter((entry) => entry.awards.includes(award.key)).length}`
    )
  }

  fs.mkdirSync(new URL('.', outputUrl), { recursive: true })
  fs.writeFileSync(outputUrl, `${JSON.stringify(entries, null, 2)}\n`)
  console.log(`\nSeed payload written: ${outputUrl.pathname}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
