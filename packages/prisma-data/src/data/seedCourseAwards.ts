/**
 * Production seed for externally-earned course points and achievements.
 *
 * One script for every round; the round is selected with ROUND and defined in
 * courseAwardRounds.ts. Points earned inside Klicker (quizzes, microlearnings)
 * are already on the leaderboard and must never appear in a payload — only
 * activities run outside the platform are seeded here.
 *
 * Payload: `_local/<round>_data.json`, gitignored because it carries real
 * usernames.
 *
 *   [{ "username": "someuser", "points": 400, "awards": ["shooting_star"] }]
 *
 * `points` (default 0) and `awards` (default none) are both optional, but a row
 * must do at least one of the two. A round that only hands out badges therefore
 * needs no special case: its rows carry no points, and the post-write check then
 * asserts that score and XP did not move, so nobody can be paid twice.
 *
 * Safety contract, unchanged from the audited single-round scripts:
 *   - dry run by default; a write needs an explicit DRY_RUN=false
 *   - the dry run freezes a payload-bound before-state dump, and the write
 *     refuses to start unless database and payload still match it
 *   - the after-state dump is the replay lock: once it exists the round is done
 *   - the write is a single Serializable transaction, verified before commit
 *
 * Usage:
 *   ROUND=<key> pnpm --filter @klicker-uzh/prisma-data seed:prod:course-awards
 *   ROUND=<key> DRY_RUN=false pnpm --filter … seed:prod:course-awards
 */
import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import type { RoundConfig } from './courseAwardRounds.js'
import { resolveRound, roundFile } from './courseAwardRounds.js'

interface SeedEntry {
  username: string
  points: number
  awards: string[]
}

interface ResolvedEntry extends SeedEntry {
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
  round: string
  courseId: string
  achievementIds: number[]
  payloadHash: string
  entries: ParticipantState[]
}

const DRY_RUN = process.env.DRY_RUN !== 'false'

const { key: ROUND, config } = resolveRound()
const inputUrl = roundFile(ROUND, 'data.json')
const comparisonUrl = roundFile(ROUND, 'comparison.csv')
const beforeDumpUrl = roundFile(ROUND, 'dump_before.json')
const afterDumpUrl = roundFile(ROUND, 'dump_after.json')

const AWARDS_BY_KEY = new Map(config.awards.map((award) => [award.key, award]))
const ACHIEVEMENT_IDS = config.awards
  .map((award) => award.id)
  .sort((a, b) => a - b)
const ALLOWED_INPUT_KEYS = new Set(['username', 'points', 'awards'])

function loadInput(): SeedEntry[] {
  if (!fs.existsSync(inputUrl)) {
    throw new Error(`Missing sanitized payload at ${inputUrl.pathname}`)
  }

  const input: unknown = JSON.parse(fs.readFileSync(inputUrl, 'utf-8'))
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Payload must be a non-empty array')
  }

  const entries = input.map((value, index): SeedEntry => {
    const row = index + 1
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Payload row ${row} must be an object`)
    }

    const record = value as Record<string, unknown>
    const unsupported = Object.keys(record).filter(
      (field) => !ALLOWED_INPUT_KEYS.has(field)
    )
    if (unsupported.length > 0) {
      throw new Error(
        `Payload row ${row} contains unsupported fields: ${unsupported.join(', ')}`
      )
    }

    const username =
      typeof record.username === 'string' ? record.username.trim() : ''
    if (username.length === 0) {
      throw new Error(`Payload row ${row} has no username`)
    }

    const points = record.points ?? 0
    if (!Number.isInteger(points) || Number(points) < 0) {
      throw new Error(`Payload row ${row} has an invalid points value`)
    }

    const awards = record.awards ?? []
    if (
      !Array.isArray(awards) ||
      awards.some((award) => typeof award !== 'string')
    ) {
      throw new Error(`Payload row ${row} has an invalid awards value`)
    }
    const awardKeys = awards as string[]
    if (new Set(awardKeys).size !== awardKeys.length) {
      throw new Error(`Payload row ${row} lists the same award twice`)
    }
    const unknown = awardKeys.filter((award) => !AWARDS_BY_KEY.has(award))
    if (unknown.length > 0) {
      throw new Error(
        `Payload row ${row} references awards outside round ${ROUND}: ${unknown.join(', ')}`
      )
    }

    if (Number(points) === 0 && awardKeys.length === 0) {
      throw new Error(`Payload row ${row} grants neither points nor an award`)
    }

    return { username, points: Number(points), awards: awardKeys }
  })

  const normalized = entries.map((entry) =>
    entry.username.toLocaleLowerCase('en-US')
  )
  if (new Set(normalized).size !== entries.length) {
    throw new Error('Payload contains duplicate usernames (case-insensitive)')
  }

  return entries
}

async function resolveParticipants(
  entries: SeedEntry[]
): Promise<ResolvedEntry[]> {
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
    const candidates = matches.get(entry.username.toLocaleLowerCase('en-US'))
    const candidate = candidates?.[0]
    if (candidates?.length !== 1 || !candidate) {
      throw new Error(
        `Expected exactly one participant match for ${entry.username}, found ${candidates?.length ?? 0}`
      )
    }

    return {
      ...entry,
      participantId: candidate.id,
      matchedUsername: candidate.username,
    }
  })
}

async function validateDatabaseReferences(
  round: RoundConfig,
  entries: ResolvedEntry[]
) {
  const achievements = await prisma.achievement.findMany({
    where: { id: { in: ACHIEVEMENT_IDS } },
    select: { id: true, nameEN: true, type: true, scope: true },
  })
  const achievementsById = new Map(
    achievements.map((achievement) => [achievement.id, achievement])
  )

  for (const award of round.awards) {
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

  const participations = await prisma.participation.findMany({
    where: {
      courseId: round.courseId,
      participantId: { in: entries.map((entry) => entry.participantId) },
    },
    select: { participantId: true, isActive: true },
  })
  const enrolled = new Set(
    participations.map((participation) => participation.participantId)
  )
  const missing = entries
    .filter((entry) => !enrolled.has(entry.participantId))
    .map((entry) => entry.username)
  if (missing.length > 0) {
    console.warn(
      `Warning: ${missing.length} participants have no course participation row but must still have prior course leaderboard state: ${missing.join(', ')}`
    )
  }

  const inactive = new Set(
    participations
      .filter((participation) => !participation.isActive)
      .map((participation) => participation.participantId)
  )
  const inactiveUsernames = entries
    .filter((entry) => inactive.has(entry.participantId))
    .map((entry) => entry.username)
  if (inactiveUsernames.length > 0) {
    console.warn(
      `Warning: ${inactiveUsernames.length} enrolled participants are inactive: ${inactiveUsernames.join(', ')}`
    )
  }
}

async function readState(
  client: typeof prisma | Prisma.TransactionClient,
  round: RoundConfig,
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
          courseId: round.courseId,
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
  const heldById = new Map<string, number[]>()
  for (const instance of achievementInstances) {
    heldById.set(instance.participantId, [
      ...(heldById.get(instance.participantId) ?? []),
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
      achievements: (heldById.get(participant.id) ?? []).sort((a, b) => a - b),
    }
  })
}

function createDump(
  round: RoundConfig,
  entries: ParticipantState[],
  payloadHash: string
): StateDump {
  return {
    round: ROUND,
    courseId: round.courseId,
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

/**
 * Score and XP must move by exactly the payload delta and nothing else, so a
 * badge-only round (delta 0) fails if it touches the leaderboard at all.
 */
function assertExpectedChanges(
  before: ParticipantState[],
  after: ParticipantState[],
  entries: ResolvedEntry[]
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
        ...entry.awards.map((award) => AWARDS_BY_KEY.get(award)?.id ?? -1),
      ]),
    ].sort((a, b) => a - b)

    if (
      afterState.score !== beforeState.score + entry.points ||
      afterState.xp !== beforeState.xp + entry.points ||
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
  return `"${String(value).replaceAll('"', '""')}"`
}

function writeComparison(round: RoundConfig, entries: ResolvedEntry[]) {
  const rows = [
    [
      'Source Username',
      'Matched Database Username',
      'Participant ID',
      'Points',
      ...round.awards.map((award) => award.nameEN),
    ],
    ...entries.map((entry) => [
      entry.username,
      entry.matchedUsername,
      entry.participantId,
      entry.points,
      ...round.awards.map((award) => entry.awards.includes(award.key)),
    ]),
  ]
  fs.writeFileSync(
    comparisonUrl,
    `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
  )
}

function writeDump(url: URL, dump: StateDump) {
  fs.mkdirSync(new URL('.', url), { recursive: true })
  fs.writeFileSync(url, `${JSON.stringify(dump, null, 2)}\n`)
}

async function main() {
  if (fs.existsSync(afterDumpUrl)) {
    throw new Error(
      `Round ${ROUND} already has an after-state dump. It has completed and must not be rerun.`
    )
  }

  const input = loadInput()
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
  const totalPoints = input.reduce((sum, entry) => sum + entry.points, 0)

  console.log(`Course award seed: ${config.label} (round ${ROUND})`)
  console.log(`Course ID: ${config.courseId}`)
  console.log(
    `Dry Run Mode: ${DRY_RUN ? 'ENABLED (no database writes)' : 'DISABLED (database writes active)'}`
  )

  const entries = await resolveParticipants(input)
  await validateDatabaseReferences(config, entries)
  writeComparison(config, entries)

  const before = await readState(prisma, config, entries)
  const currentDump = createDump(config, before, payloadHash)

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
    for (const award of config.awards) {
      const total = entries.filter((entry) =>
        entry.awards.includes(award.key)
      ).length
      const pending = entries.filter(
        (entry, index) =>
          entry.awards.includes(award.key) &&
          !before[index]?.achievements.includes(award.id)
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
      const transactionBefore = await readState(tx, config, entries)
      assertSameDump(
        createDump(config, transactionBefore, payloadHash),
        savedDump,
        'Transaction starting state'
      )

      for (const entry of entries) {
        if (entry.points > 0) {
          await tx.leaderboardEntry.update({
            where: {
              type_participantId_courseId: {
                type: 'COURSE',
                participantId: entry.participantId,
                courseId: config.courseId,
              },
            },
            data: { score: { increment: entry.points } },
          })
          await tx.participant.update({
            where: { id: entry.participantId },
            data: { xp: { increment: entry.points } },
          })
        }

        for (const key of entry.awards) {
          const award = AWARDS_BY_KEY.get(key)
          if (!award) {
            throw new Error(`Unknown award ${key} reached the write path`)
          }

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

      const transactionAfter = await readState(tx, config, entries)
      assertExpectedChanges(transactionBefore, transactionAfter, entries)
      return transactionAfter
    },
    { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 60_000 }
  )

  writeDump(afterDumpUrl, createDump(config, after, payloadHash))
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
