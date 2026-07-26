import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import fs from 'node:fs'

interface PortfolioSeedEntry {
  username: string
  points_delta: number
  portfolio_award: boolean
}

interface ResolvedSeedEntry extends PortfolioSeedEntry {
  participantId: string
  matchedUsername: string
}

interface ParticipantState {
  participantId: string
  username: string
  score: number
  xp: number
  hasPortfolioAchievement: boolean
}

interface StateDump {
  courseId: string
  achievementId: number
  payloadHash: string
  entries: ParticipantState[]
}

const inputUrl = new URL('summerschool_portfolio_data.json', import.meta.url)
const comparisonUrl = new URL(
  'summerschool_portfolio_comparison.csv',
  import.meta.url
)
const beforeDumpUrl = new URL(
  'summerschool_portfolio_dump_before.json',
  import.meta.url
)
const afterDumpUrl = new URL(
  'summerschool_portfolio_dump_after.json',
  import.meta.url
)

const COURSE_ID =
  process.env.COURSE_ID || '043a156f-c3d4-484a-9b98-bbf7c54b92cc'
const PORTFOLIO_ACHIEVEMENT_ID = 21
const PORTFOLIO_ACHIEVEMENT_NAME = 'Portfolio Professional'
const DRY_RUN = process.env.DRY_RUN !== 'false'
const ALLOWED_INPUT_KEYS = new Set([
  'username',
  'points_delta',
  'portfolio_award',
])

function loadInput(): PortfolioSeedEntry[] {
  if (!fs.existsSync(inputUrl)) {
    throw new Error(`Missing sanitized input file at ${inputUrl.pathname}`)
  }

  const input: unknown = JSON.parse(fs.readFileSync(inputUrl, 'utf-8'))
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Input must be a non-empty array')
  }

  const entries = input.map((value, index): PortfolioSeedEntry => {
    if (typeof value !== 'object' || value === null) {
      throw new Error(`Input row ${index + 1} must be an object`)
    }

    const row = value as Record<string, unknown>
    const unsupportedKeys = Object.keys(row).filter(
      (key) => !ALLOWED_INPUT_KEYS.has(key)
    )
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `Input row ${index + 1} contains unsupported fields: ${unsupportedKeys.join(', ')}`
      )
    }

    const username = typeof row.username === 'string' ? row.username.trim() : ''
    if (username.length === 0) {
      throw new Error(`Input row ${index + 1} has no username`)
    }
    if (!Number.isInteger(row.points_delta) || Number(row.points_delta) <= 0) {
      throw new Error(
        `Input row ${index + 1} has an invalid points_delta value`
      )
    }
    if (typeof row.portfolio_award !== 'boolean') {
      throw new Error(
        `Input row ${index + 1} has an invalid portfolio_award value`
      )
    }

    return {
      username,
      points_delta: Number(row.points_delta),
      portfolio_award: row.portfolio_award,
    }
  })

  const normalizedUsernames = entries.map((entry) =>
    entry.username.toLocaleLowerCase('en-US')
  )
  if (new Set(normalizedUsernames).size !== entries.length) {
    throw new Error('Input contains duplicate usernames (case-insensitive)')
  }

  return entries
}

async function resolveParticipants(
  entries: PortfolioSeedEntry[]
): Promise<ResolvedSeedEntry[]> {
  const participants = await prisma.participant.findMany({
    where: {
      OR: entries.map((entry) => ({
        username: { equals: entry.username, mode: 'insensitive' },
      })),
    },
    select: { id: true, username: true },
  })

  const matches = new Map<string, (typeof participants)[number][]>()
  for (const participant of participants) {
    const key = participant.username.toLocaleLowerCase('en-US')
    matches.set(key, [...(matches.get(key) ?? []), participant])
  }

  return entries.map((entry) => {
    const key = entry.username.toLocaleLowerCase('en-US')
    const candidates = matches.get(key) ?? []
    const candidate = candidates[0]
    if (candidates.length !== 1 || !candidate) {
      throw new Error(
        `Expected exactly one participant match for ${entry.username}, found ${candidates.length}`
      )
    }

    return {
      ...entry,
      participantId: candidate.id,
      matchedUsername: candidate.username,
    }
  })
}

async function validateDatabaseReferences(entries: ResolvedSeedEntry[]) {
  const achievement = await prisma.achievement.findUnique({
    where: { id: PORTFOLIO_ACHIEVEMENT_ID },
    select: { nameEN: true, type: true, scope: true },
  })
  if (
    achievement?.nameEN !== PORTFOLIO_ACHIEVEMENT_NAME ||
    achievement.type !== 'PARTICIPANT' ||
    achievement.scope !== 'GLOBAL'
  ) {
    throw new Error(
      `Achievement ${PORTFOLIO_ACHIEVEMENT_ID} does not match ${PORTFOLIO_ACHIEVEMENT_NAME} (PARTICIPANT/GLOBAL)`
    )
  }

  const participantIds = entries.map((entry) => entry.participantId)
  const participations = await prisma.participation.findMany({
    where: {
      courseId: COURSE_ID,
      participantId: { in: participantIds },
    },
    select: { participantId: true, isActive: true },
  })
  const enrolledIds = new Set(
    participations.map((participation) => participation.participantId)
  )
  const missingUsernames = entries
    .filter((entry) => !enrolledIds.has(entry.participantId))
    .map((entry) => entry.username)
  if (missingUsernames.length > 0) {
    console.warn(
      `Warning: ${missingUsernames.length} participants have no course participation row but must still have prior course leaderboard state: ${missingUsernames.join(', ')}`
    )
  }

  const inactiveIds = new Set(
    participations
      .filter((participation) => !participation.isActive)
      .map((participation) => participation.participantId)
  )
  const inactiveUsernames = entries
    .filter((entry) => inactiveIds.has(entry.participantId))
    .map((entry) => entry.username)
  if (inactiveUsernames.length > 0) {
    console.warn(
      `Warning: ${inactiveUsernames.length} enrolled participants are inactive: ${inactiveUsernames.join(', ')}`
    )
  }
}

async function readState(
  client: typeof prisma | Prisma.TransactionClient,
  entries: ResolvedSeedEntry[]
): Promise<ParticipantState[]> {
  const participantIds = entries.map((entry) => entry.participantId)
  const [participants, leaderboardEntries, achievementInstances] =
    await Promise.all([
      client.participant.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, username: true, xp: true },
      }),
      client.leaderboardEntry.findMany({
        where: {
          type: 'COURSE',
          courseId: COURSE_ID,
          participantId: { in: participantIds },
        },
        select: { participantId: true, score: true },
      }),
      client.participantAchievementInstance.findMany({
        where: {
          achievementId: PORTFOLIO_ACHIEVEMENT_ID,
          participantId: { in: participantIds },
        },
        select: { participantId: true },
      }),
    ])

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant])
  )
  const scoresById = new Map(
    leaderboardEntries.map((entry) => [entry.participantId, entry.score])
  )
  const achievementIds = new Set(
    achievementInstances.map((instance) => instance.participantId)
  )

  return entries.map((entry) => {
    const participant = participantsById.get(entry.participantId)
    const score = scoresById.get(entry.participantId)
    if (!participant || score === undefined) {
      throw new Error(
        `Missing participant or existing course leaderboard entry for ${entry.username}`
      )
    }

    return {
      participantId: participant.id,
      username: participant.username,
      score,
      xp: participant.xp,
      hasPortfolioAchievement: achievementIds.has(participant.id),
    }
  })
}

function createDump(
  entries: ParticipantState[],
  payloadHash: string
): StateDump {
  return {
    courseId: COURSE_ID,
    achievementId: PORTFOLIO_ACHIEVEMENT_ID,
    payloadHash,
    entries,
  }
}

function assertSameDump(actual: StateDump, expected: StateDump, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the saved before-state dump`)
  }
}

function assertExpectedChanges(
  before: ParticipantState[],
  after: ParticipantState[],
  entries: ResolvedSeedEntry[]
) {
  const mismatches: string[] = []

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const beforeState = before[index]
    const afterState = after[index]
    if (!entry || !beforeState || !afterState) {
      throw new Error('Verification state has an unexpected row count')
    }

    const expectedAchievement =
      beforeState.hasPortfolioAchievement || entry.portfolio_award
    if (
      afterState.score !== beforeState.score + entry.points_delta ||
      afterState.xp !== beforeState.xp + entry.points_delta ||
      afterState.hasPortfolioAchievement !== expectedAchievement
    ) {
      mismatches.push(entry.username)
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Verification failed for ${mismatches.length} participants: ${mismatches.join(', ')}`
    )
  }
}

function csvCell(value: string | number | boolean): string {
  const text = String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function writeComparison(entries: ResolvedSeedEntry[]) {
  const rows = [
    [
      'Source Username',
      'Matched Database Username',
      'Participant ID',
      'Points Delta',
      'Portfolio Award',
    ],
    ...entries.map((entry) => [
      entry.username,
      entry.matchedUsername,
      entry.participantId,
      entry.points_delta,
      entry.portfolio_award,
    ]),
  ]
  fs.writeFileSync(
    comparisonUrl,
    `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
  )
}

function writeDump(url: URL, dump: StateDump) {
  fs.writeFileSync(url, `${JSON.stringify(dump, null, 2)}\n`)
}

async function main() {
  const input = loadInput()
  if (fs.existsSync(afterDumpUrl)) {
    throw new Error(
      'After-state dump exists. This seed has already completed and must not be rerun.'
    )
  }

  const payloadHash = createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
  const totalPoints = input.reduce((sum, entry) => sum + entry.points_delta, 0)
  const totalAwards = input.filter((entry) => entry.portfolio_award).length

  console.log('Summer School 2026 portfolio seed')
  console.log(`Course ID: ${COURSE_ID}`)
  console.log(
    `Dry Run Mode: ${DRY_RUN ? 'ENABLED (no database writes)' : 'DISABLED (database writes active)'}`
  )

  const entries = await resolveParticipants(input)
  await validateDatabaseReferences(entries)
  writeComparison(entries)

  const before = await readState(prisma, entries)
  const currentDump = createDump(before, payloadHash)

  if (DRY_RUN) {
    if (fs.existsSync(beforeDumpUrl)) {
      const savedDump = JSON.parse(
        fs.readFileSync(beforeDumpUrl, 'utf-8')
      ) as StateDump
      assertSameDump(currentDump, savedDump, 'Dry-run state and payload')
    }
    writeDump(beforeDumpUrl, currentDump)
    console.log(`Participants matched: ${entries.length}`)
    console.log(`Point and XP delta: ${totalPoints}`)
    console.log(`Portfolio achievements to award: ${totalAwards}`)
    console.log(`Comparison CSV: ${comparisonUrl.pathname}`)
    console.log(`Before-state dump: ${beforeDumpUrl.pathname}`)
    console.log('Dry run complete. Zero database writes executed.')
    return
  }

  if (!fs.existsSync(beforeDumpUrl)) {
    throw new Error(
      'Missing before-state dump. Run the production command in dry-run mode first.'
    )
  }
  const savedDump = JSON.parse(
    fs.readFileSync(beforeDumpUrl, 'utf-8')
  ) as StateDump
  assertSameDump(currentDump, savedDump, 'Current database state')

  const after = await prisma.$transaction(
    async (tx) => {
      const transactionBefore = await readState(tx, entries)
      assertSameDump(
        createDump(transactionBefore, payloadHash),
        savedDump,
        'Transaction starting state'
      )

      for (const entry of entries) {
        await tx.leaderboardEntry.update({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              participantId: entry.participantId,
              courseId: COURSE_ID,
            },
          },
          data: { score: { increment: entry.points_delta } },
        })
        await tx.participant.update({
          where: { id: entry.participantId },
          data: { xp: { increment: entry.points_delta } },
        })

        if (entry.portfolio_award) {
          await tx.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: entry.participantId,
                achievementId: PORTFOLIO_ACHIEVEMENT_ID,
              },
            },
            create: {
              participantId: entry.participantId,
              achievementId: PORTFOLIO_ACHIEVEMENT_ID,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {},
          })
        }
      }

      const transactionAfter = await readState(tx, entries)
      assertExpectedChanges(transactionBefore, transactionAfter, entries)
      return transactionAfter
    },
    { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 60_000 }
  )

  writeDump(afterDumpUrl, createDump(after, payloadHash))
  console.log(`Verification Summary: ${entries.length} Successes, 0 Mismatches`)
  console.log(`After-state dump: ${afterDumpUrl.pathname}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
