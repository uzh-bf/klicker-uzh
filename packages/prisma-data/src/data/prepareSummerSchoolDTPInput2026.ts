/**
 * Prepares the Summer School 2026 DTP seed input by deriving the Busy Bee flag.
 *
 * The workbook column for Busy Bee is empty because the award depends on
 * in-platform behaviour, so it is derived here instead: a participant qualifies
 * when they fully completed every non-deleted microlearning of the course.
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
      startedCount: true,
      completedCount: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
    orderBy: { scheduledStartAt: 'asc' },
  })

  console.log(
    `\nMicrolearnings in course ${COURSE_ID}: ${microLearnings.length}`
  )
  for (const ml of microLearnings) {
    console.log(
      `  ${ml.id} | ${ml.name} | ${ml.status} | started ${ml.startedCount} | completed ${ml.completedCount} | ${ml.scheduledStartAt.toISOString()} -> ${ml.scheduledEndAt.toISOString()}`
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

  const microLearningIds = microLearnings.map((ml) => ml.id)
  const performances = await prisma.participantActivityPerformance.findMany({
    where: {
      microLearningId: { in: microLearningIds },
      participantId: { in: resolved.map((entry) => entry.participantId) },
    },
    select: {
      participantId: true,
      microLearningId: true,
      completion: true,
      totalScore: true,
    },
  })

  const completionByParticipant = new Map<string, Map<string, number>>()
  for (const performance of performances) {
    if (!performance.microLearningId) continue
    const map =
      completionByParticipant.get(performance.participantId) ??
      new Map<string, number>()
    map.set(performance.microLearningId, performance.completion)
    completionByParticipant.set(performance.participantId, map)
  }

  const histogram = new Map<number, number>()
  const partialCounts = new Map<number, number>()
  const entries = resolved.map((entry) => {
    const map = completionByParticipant.get(entry.participantId) ?? new Map()
    const completed = microLearningIds.filter(
      (id) => (map.get(id) ?? 0) >= 1
    ).length
    const partial = microLearningIds.filter((id) => {
      const value = map.get(id) ?? 0
      return value > 0 && value < 1
    }).length

    histogram.set(completed, (histogram.get(completed) ?? 0) + 1)
    partialCounts.set(partial, (partialCounts.get(partial) ?? 0) + 1)

    const { participantId: _participantId, ...rest } = entry
    return { ...rest, busy_bee: completed === microLearningIds.length }
  })

  console.log('\nFully completed microlearnings per participant:')
  for (const [completed, count] of [...histogram].sort((a, b) => a[0] - b[0])) {
    console.log(
      `  ${completed}/${microLearningIds.length}: ${count} participants`
    )
  }
  console.log('Partially completed (0 < completion < 1) per participant:')
  for (const [partial, count] of [...partialCounts].sort(
    (a, b) => a[0] - b[0]
  )) {
    console.log(`  ${partial}: ${count} participants`)
  }

  const busyBees = entries.filter((entry) => entry.busy_bee).length
  console.log(`\nBusy Bee awards: ${busyBees}`)
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
