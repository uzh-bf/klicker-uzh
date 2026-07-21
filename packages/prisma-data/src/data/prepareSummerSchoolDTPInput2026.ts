/**
 * Prepares the Summer School 2026 DTP seed input by deriving the Busy Bee flag.
 *
 * The workbook column for Busy Bee is empty because the award depends on
 * in-platform behaviour, so it is derived here instead: a participant qualifies
 * when they answered every element instance of every non-deleted microlearning
 * in the course.
 *
 * Completion is read from QuestionResponse rather than from
 * ParticipantActivityPerformance or MicroLearning.completedCount: for this course
 * those two are empty (zero rows, zero counters) even though responses exist, so
 * they would silently derive zero awards.
 *
 * Reads the gitignored base input (workbook-derived, without busy_bee) and writes
 * the gitignored seed input consumed by seedSummerSchoolDTP2026.ts. Executes zero
 * database writes.
 */
import { prisma } from '@klicker-uzh/prisma'
import fs from 'node:fs'

interface BaseEntry {
  username: string
  points_delta: number
  creative_mastermind: boolean
  shooting_star: boolean
  happiness: boolean
}

const baseUrl = new URL('summerschool_dtp_base.json', import.meta.url)
const outputUrl = new URL('summerschool_dtp_data.json', import.meta.url)

const COURSE_ID =
  process.env.COURSE_ID || '043a156f-c3d4-484a-9b98-bbf7c54b92cc'

async function main() {
  const base: BaseEntry[] = JSON.parse(fs.readFileSync(baseUrl, 'utf-8'))
  console.log(`Base input entries: ${base.length}`)

  const microLearnings = await prisma.microLearning.findMany({
    where: { courseId: COURSE_ID, isDeleted: false },
    select: {
      id: true,
      name: true,
      status: true,
      stacks: { select: { elements: { select: { id: true } } } },
    },
    orderBy: { scheduledStartAt: 'asc' },
  })

  if (microLearnings.length === 0) {
    throw new Error(`Course ${COURSE_ID} has no microlearnings`)
  }

  const requiredInstances = microLearnings.map((microLearning) => {
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
    `\nMicrolearnings in course ${COURSE_ID}: ${requiredInstances.length}`
  )
  for (const microLearning of requiredInstances) {
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
    const candidates =
      byUsername.get(entry.username.toLocaleLowerCase('en-US')) ?? []
    const candidate = candidates[0]
    if (candidates.length !== 1 || !candidate) {
      throw new Error(
        `Expected exactly one participant match for ${entry.username}, found ${candidates.length}`
      )
    }
    return { ...entry, participantId: candidate.id }
  })

  const participantIds = resolved.map((entry) => entry.participantId)
  const responses = await prisma.questionResponse.findMany({
    where: {
      microLearningId: { in: requiredInstances.map((item) => item.id) },
      participantId: { in: participantIds },
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
    const completed = requiredInstances.filter((microLearning) => {
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
    return { ...rest, busy_bee: completed.length === requiredInstances.length }
  })

  console.log('\nFully completed, per microlearning:')
  for (const microLearning of requiredInstances) {
    console.log(
      `  ${microLearning.name}: ${completedPerMicroLearning.get(microLearning.name) ?? 0} of ${entries.length}`
    )
  }
  console.log('Fully completed microlearnings per participant:')
  for (const [completed, count] of [...histogram].sort((a, b) => a[0] - b[0])) {
    console.log(
      `  ${completed}/${requiredInstances.length}: ${count} participants`
    )
  }

  console.log(
    `\nBusy Bee awards: ${entries.filter((entry) => entry.busy_bee).length}`
  )
  console.log(
    `Point/XP delta: ${entries.reduce((sum, entry) => sum + entry.points_delta, 0)}`
  )
  console.log(
    `creative_mastermind: ${entries.filter((e) => e.creative_mastermind).length}`
  )
  console.log(`shooting_star: ${entries.filter((e) => e.shooting_star).length}`)
  console.log(`happiness: ${entries.filter((e) => e.happiness).length}`)

  fs.writeFileSync(outputUrl, `${JSON.stringify(entries, null, 2)}\n`)
  console.log(`\nSeed input written: ${outputUrl.pathname}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
