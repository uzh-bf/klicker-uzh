import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import fs from 'node:fs'

/**
 * Badge-only follow-up round: grants Shooting Star to participants who were
 * missed by the DTP payload. Awards no points and no XP, so it deliberately does
 * not reuse seedSummerSchoolDTP2026.ts, which requires a positive points delta
 * per row and is replay-locked by its own after-state dump.
 */

interface ResolvedEntry {
  username: string
  participantId: string
  matchedUsername: string
}

interface ParticipantState {
  participantId: string
  username: string
  score: number
  xp: number
  hasAchievement: boolean
}

interface StateDump {
  courseId: string
  achievementId: number
  payloadHash: string
  entries: ParticipantState[]
}

const inputUrl = new URL('summerschool_shootingstar_data.json', import.meta.url)
const comparisonUrl = new URL(
  'summerschool_shootingstar_comparison.csv',
  import.meta.url
)
const beforeDumpUrl = new URL(
  'summerschool_shootingstar_dump_before.json',
  import.meta.url
)
const afterDumpUrl = new URL(
  'summerschool_shootingstar_dump_after.json',
  import.meta.url
)

const COURSE_ID =
  process.env.COURSE_ID || '043a156f-c3d4-484a-9b98-bbf7c54b92cc'
const DRY_RUN = process.env.DRY_RUN !== 'false'

const ACHIEVEMENT_ID = 16
const ACHIEVEMENT_NAME = 'Shooting Star'

function loadInput(): string[] {
  if (!fs.existsSync(inputUrl)) {
    throw new Error(`Missing sanitized input file at ${inputUrl.pathname}`)
  }

  const input: unknown = JSON.parse(fs.readFileSync(inputUrl, 'utf-8'))
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Input must be a non-empty array of usernames')
  }

  const usernames = input.map((value, index): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Input row ${index + 1} is not a non-empty username`)
    }
    return value.trim()
  })

  const normalized = usernames.map((username) =>
    username.toLocaleLowerCase('en-US')
  )
  if (new Set(normalized).size !== usernames.length) {
    throw new Error('Input contains duplicate usernames (case-insensitive)')
  }

  return usernames
}

async function resolveParticipants(
  usernames: string[]
): Promise<ResolvedEntry[]> {
  const participants = await prisma.participant.findMany({
    where: {
      OR: usernames.map((username) => ({
        username: { equals: username, mode: 'insensitive' },
      })),
    },
    select: { id: true, username: true },
  })

  const matches = new Map<string, (typeof participants)[number][]>()
  for (const participant of participants) {
    const key = participant.username.toLocaleLowerCase('en-US')
    matches.set(key, [...(matches.get(key) ?? []), participant])
  }

  return usernames.map((username) => {
    const candidates = matches.get(username.toLocaleLowerCase('en-US')) ?? []
    const candidate = candidates[0]
    if (candidates.length !== 1 || !candidate) {
      throw new Error(
        `Expected exactly one participant match for ${username}, found ${candidates.length}`
      )
    }

    return {
      username,
      participantId: candidate.id,
      matchedUsername: candidate.username,
    }
  })
}

async function validateDatabaseReferences(entries: ResolvedEntry[]) {
  const achievement = await prisma.achievement.findUnique({
    where: { id: ACHIEVEMENT_ID },
    select: { nameEN: true, type: true, scope: true },
  })
  if (
    achievement?.nameEN !== ACHIEVEMENT_NAME ||
    achievement.type !== 'PARTICIPANT' ||
    achievement.scope !== 'GLOBAL'
  ) {
    throw new Error(
      `Achievement ${ACHIEVEMENT_ID} does not match ${ACHIEVEMENT_NAME} (PARTICIPANT/GLOBAL)`
    )
  }

  const participations = await prisma.participation.findMany({
    where: {
      courseId: COURSE_ID,
      participantId: { in: entries.map((entry) => entry.participantId) },
    },
    select: { participantId: true, isActive: true },
  })
  const enrolledIds = new Set(
    participations.map((participation) => participation.participantId)
  )
  const missing = entries
    .filter((entry) => !enrolledIds.has(entry.participantId))
    .map((entry) => entry.username)
  if (missing.length > 0) {
    console.warn(
      `Warning: ${missing.length} participants have no course participation row: ${missing.join(', ')}`
    )
  }

  const inactiveIds = new Set(
    participations
      .filter((participation) => !participation.isActive)
      .map((participation) => participation.participantId)
  )
  const inactive = entries
    .filter((entry) => inactiveIds.has(entry.participantId))
    .map((entry) => entry.username)
  if (inactive.length > 0) {
    console.warn(
      `Warning: ${inactive.length} enrolled participants are inactive: ${inactive.join(', ')}`
    )
  }
}

async function readState(
  client: typeof prisma | Prisma.TransactionClient,
  entries: ResolvedEntry[]
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
          achievementId: ACHIEVEMENT_ID,
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
  const holders = new Set(
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
      hasAchievement: holders.has(participant.id),
    }
  })
}

function createDump(
  entries: ParticipantState[],
  payloadHash: string
): StateDump {
  return {
    courseId: COURSE_ID,
    achievementId: ACHIEVEMENT_ID,
    payloadHash,
    entries,
  }
}

function assertSameDump(actual: StateDump, expected: StateDump, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the saved before-state dump`)
  }
}

/**
 * Score and XP must be untouched by this round: it grants a badge only.
 */
function assertExpectedChanges(
  before: ParticipantState[],
  after: ParticipantState[]
) {
  const mismatches: string[] = []

  for (let index = 0; index < before.length; index++) {
    const beforeState = before[index]
    const afterState = after[index]
    if (!beforeState || !afterState) {
      throw new Error('Verification state has an unexpected row count')
    }

    if (
      afterState.score !== beforeState.score ||
      afterState.xp !== beforeState.xp ||
      !afterState.hasAchievement
    ) {
      mismatches.push(beforeState.username)
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

function writeComparison(entries: ResolvedEntry[], before: ParticipantState[]) {
  const rows = [
    [
      'Source Username',
      'Matched Database Username',
      'Participant ID',
      'Already Held',
    ],
    ...entries.map((entry, index) => [
      entry.username,
      entry.matchedUsername,
      entry.participantId,
      before[index]?.hasAchievement ?? false,
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
  const usernames = loadInput()
  if (fs.existsSync(afterDumpUrl)) {
    throw new Error(
      'After-state dump exists. This seed has already completed and must not be rerun.'
    )
  }

  const payloadHash = createHash('sha256')
    .update(JSON.stringify(usernames))
    .digest('hex')

  console.log('Summer School 2026 Shooting Star follow-up seed')
  console.log(`Course ID: ${COURSE_ID}`)
  console.log(
    `Dry Run Mode: ${DRY_RUN ? 'ENABLED (no database writes)' : 'DISABLED (database writes active)'}`
  )

  const entries = await resolveParticipants(usernames)
  await validateDatabaseReferences(entries)

  const before = await readState(prisma, entries)
  const currentDump = createDump(before, payloadHash)
  writeComparison(entries, before)

  if (DRY_RUN) {
    if (fs.existsSync(beforeDumpUrl)) {
      const savedDump = JSON.parse(
        fs.readFileSync(beforeDumpUrl, 'utf-8')
      ) as StateDump
      assertSameDump(currentDump, savedDump, 'Dry-run state and payload')
    }
    writeDump(beforeDumpUrl, currentDump)
    const pending = before.filter((state) => !state.hasAchievement).length
    console.log(`Participants matched: ${entries.length}`)
    console.log(
      `${ACHIEVEMENT_NAME} (ID ${ACHIEVEMENT_ID}) to award: ${entries.length} (${pending} not yet held)`
    )
    console.log('Point and XP delta: 0 (badge-only round)')
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
        await tx.participantAchievementInstance.upsert({
          where: {
            participantId_achievementId: {
              participantId: entry.participantId,
              achievementId: ACHIEVEMENT_ID,
            },
          },
          create: {
            participantId: entry.participantId,
            achievementId: ACHIEVEMENT_ID,
            achievedAt: new Date(),
            achievedCount: 1,
          },
          update: {},
        })
      }

      const transactionAfter = await readState(tx, entries)
      assertExpectedChanges(transactionBefore, transactionAfter)
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
