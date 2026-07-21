import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import fs from 'node:fs'

type AwardKey =
  | 'creative_mastermind'
  | 'shooting_star'
  | 'happiness'
  | 'busy_bee'

interface DTPSeedEntry {
  username: string
  points_delta: number
  creative_mastermind: boolean
  shooting_star: boolean
  happiness: boolean
  busy_bee: boolean
}

interface ResolvedSeedEntry extends DTPSeedEntry {
  participantId: string
  matchedUsername: string
}

interface ParticipantState {
  participantId: string
  username: string
  score: number
  xp: number
  achievements: number[]
}

interface StateDump {
  courseId: string
  achievementIds: number[]
  payloadHash: string
  entries: ParticipantState[]
}

const inputUrl = new URL('summerschool_dtp_data.json', import.meta.url)
const comparisonUrl = new URL(
  'summerschool_dtp_comparison.csv',
  import.meta.url
)
const beforeDumpUrl = new URL(
  'summerschool_dtp_dump_before.json',
  import.meta.url
)
const afterDumpUrl = new URL(
  'summerschool_dtp_dump_after.json',
  import.meta.url
)

const COURSE_ID =
  process.env.COURSE_ID || '043a156f-c3d4-484a-9b98-bbf7c54b92cc'
const DRY_RUN = process.env.DRY_RUN !== 'false'

// Achievement ID mappings in the database, verified against nameEN before any write
const AWARDS: { key: AwardKey; id: number; nameEN: string }[] = [
  { key: 'creative_mastermind', id: 11, nameEN: 'Creative Mastermind' },
  { key: 'shooting_star', id: 16, nameEN: 'Shooting Star' },
  { key: 'happiness', id: 14, nameEN: 'Happiness' },
  { key: 'busy_bee', id: 3, nameEN: 'Busy Bee' },
]

const ACHIEVEMENT_IDS = AWARDS.map((award) => award.id).sort((a, b) => a - b)
const ALLOWED_INPUT_KEYS = new Set<string>([
  'username',
  'points_delta',
  ...AWARDS.map((award) => award.key),
])

function loadInput(): DTPSeedEntry[] {
  if (!fs.existsSync(inputUrl)) {
    throw new Error(`Missing sanitized input file at ${inputUrl.pathname}`)
  }

  const input: unknown = JSON.parse(fs.readFileSync(inputUrl, 'utf-8'))
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Input must be a non-empty array')
  }

  const entries = input.map((value, index): DTPSeedEntry => {
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

    const awards = {} as Record<AwardKey, boolean>
    for (const award of AWARDS) {
      if (typeof row[award.key] !== 'boolean') {
        throw new Error(
          `Input row ${index + 1} has an invalid ${award.key} value`
        )
      }
      awards[award.key] = row[award.key] as boolean
    }

    return {
      username,
      points_delta: Number(row.points_delta),
      ...awards,
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
  entries: DTPSeedEntry[]
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
  const achievements = await prisma.achievement.findMany({
    where: { id: { in: ACHIEVEMENT_IDS } },
    select: { id: true, nameEN: true, type: true, scope: true },
  })
  const achievementsById = new Map(
    achievements.map((achievement) => [achievement.id, achievement])
  )

  for (const award of AWARDS) {
    const achievement = achievementsById.get(award.id)
    if (
      achievement?.nameEN !== award.nameEN ||
      achievement.type !== 'PARTICIPANT' ||
      achievement.scope !== 'GLOBAL'
    ) {
      throw new Error(
        `Achievement ${award.id} does not match ${award.nameEN} (PARTICIPANT/GLOBAL)`
      )
    }
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
          achievementId: { in: ACHIEVEMENT_IDS },
          participantId: { in: participantIds },
        },
        select: { participantId: true, achievementId: true },
      }),
    ])

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant])
  )
  const scoresById = new Map(
    leaderboardEntries.map((entry) => [entry.participantId, entry.score])
  )
  const achievementsById = new Map<string, number[]>()
  for (const instance of achievementInstances) {
    achievementsById.set(instance.participantId, [
      ...(achievementsById.get(instance.participantId) ?? []),
      instance.achievementId,
    ])
  }

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
      achievements: (achievementsById.get(participant.id) ?? []).sort(
        (a, b) => a - b
      ),
    }
  })
}

function createDump(
  entries: ParticipantState[],
  payloadHash: string
): StateDump {
  return {
    courseId: COURSE_ID,
    achievementIds: ACHIEVEMENT_IDS,
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

    const expectedAchievements = [
      ...new Set([
        ...beforeState.achievements,
        ...AWARDS.filter((award) => entry[award.key]).map((award) => award.id),
      ]),
    ].sort((a, b) => a - b)

    if (
      afterState.score !== beforeState.score + entry.points_delta ||
      afterState.xp !== beforeState.xp + entry.points_delta ||
      JSON.stringify(afterState.achievements) !==
        JSON.stringify(expectedAchievements)
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
      ...AWARDS.map((award) => award.nameEN),
    ],
    ...entries.map((entry) => [
      entry.username,
      entry.matchedUsername,
      entry.participantId,
      entry.points_delta,
      ...AWARDS.map((award) => entry[award.key]),
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

  console.log('Summer School 2026 DTP seed')
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
    for (const award of AWARDS) {
      const total = input.filter((entry) => entry[award.key]).length
      const pending = entries.filter(
        (entry, index) =>
          entry[award.key] && !before[index]?.achievements.includes(award.id)
      ).length
      console.log(
        `${award.nameEN} (ID ${award.id}) to award: ${total} (${pending} not yet held)`
      )
    }
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

        for (const award of AWARDS) {
          if (!entry[award.key]) continue

          await tx.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: entry.participantId,
                achievementId: award.id,
              },
            },
            create: {
              participantId: entry.participantId,
              achievementId: award.id,
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
