import { prisma } from '@klicker-uzh/prisma'
import fs from 'node:fs'

interface AnonymizedParticipantData {
  participantId: string
  total_points: number
  swiss_quiz_award: string | null
  simulation_award: string | null
  escape_room_award: string | null
}

const dataUrl = new URL('summerschool_data.json', import.meta.url)

// Graceful check for the anonymized data file
if (!fs.existsSync(dataUrl)) {
  console.error(`Error: Missing anonymized input file at ${dataUrl.pathname}`)
  console.error(
    'Please ensure the local anonymization process has been completed.'
  )
  process.exit(1)
}

const PARTICIPANTS: AnonymizedParticipantData[] = JSON.parse(
  fs.readFileSync(dataUrl, 'utf-8')
)

// Production course ID: Summer School 2026
const COURSE_ID =
  process.env.COURSE_ID || '043a156f-c3d4-484a-9b98-bbf7c54b92cc'

// Safe-by-default dry run check
const DRY_RUN = process.env.DRY_RUN !== 'false'

// Achievement ID Mappings in Database
const ACHIEVEMENT_SWISS_WHIZ = 18 // Badge Switzerland / Swiss Quiz
const ACHIEVEMENT_ESCAPE_ARTIST = 19 // Badge Escape Room
const ACHIEVEMENT_CHOCO_STRATEGIST = 20 // Award Unternehmenssimulation

async function main() {
  console.log(`Starting Summer School 2026 points & achievements seed...`)
  console.log(`Course ID: ${COURSE_ID}`)
  console.log(
    `Dry Run Mode: ${DRY_RUN ? 'ENABLED (No database writes will occur)' : 'DISABLED (DATABASE WRITES ACTIVE)'}`
  )

  if (COURSE_ID === '043a156f-c3d4-484a-9b98-bbf7c54b92cc' && !DRY_RUN) {
    console.warn(
      '⚠️ WARNING: Executing updates directly against the PRODUCTION course.'
    )
  }

  // --- PRE-FLIGHT VALIDATION ---
  console.log('\nRunning pre-flight checks...')

  // 1. Verify Achievements to prevent ID drift across environments
  const achievements = await prisma.achievement.findMany({
    where: {
      id: {
        in: [
          ACHIEVEMENT_SWISS_WHIZ,
          ACHIEVEMENT_ESCAPE_ARTIST,
          ACHIEVEMENT_CHOCO_STRATEGIST,
        ],
      },
    },
    select: { id: true, nameEN: true },
  })

  const achievementNames: Record<number, string> = {
    [ACHIEVEMENT_SWISS_WHIZ]: 'Swiss Whiz',
    [ACHIEVEMENT_ESCAPE_ARTIST]: 'Escape Artist',
    [ACHIEVEMENT_CHOCO_STRATEGIST]: 'ChocoStrategist',
  }

  for (const ach of achievements) {
    const expected = achievementNames[ach.id]
    if (ach.nameEN !== expected) {
      throw new Error(
        `Prisma Achievement ID drift detected! Expected ID ${ach.id} to be "${expected}", but found "${ach.nameEN}".`
      )
    }
  }
  console.log('✓ Achievement ID mappings verified.')

  // 2. Verify all participant IDs exist and are enrolled in the course
  const participantIds = PARTICIPANTS.map((p) => p.participantId)
  const participations = await prisma.participation.findMany({
    where: {
      courseId: COURSE_ID,
      participantId: { in: participantIds },
    },
    select: { participantId: true },
  })

  const enrolledIds = new Set(participations.map((p) => p.participantId))
  const missingEnrollments = participantIds.filter((id) => !enrolledIds.has(id))

  if (missingEnrollments.length > 0) {
    throw new Error(
      `Pre-flight validation failed: The following ${missingEnrollments.length} participant IDs are not enrolled/participating in course ${COURSE_ID}:\n` +
        missingEnrollments.map((id) => `  - ${id}`).join('\n')
    )
  }
  console.log(
    `✓ All ${PARTICIPANTS.length} participants verified as enrolled in course.\n`
  )

  let updatedCount = 0

  for (const entry of PARTICIPANTS) {
    if (DRY_RUN) {
      console.log(
        `[DRY RUN] Would update LeaderboardEntry: Participant ${entry.participantId} -> increment score by ${entry.total_points} in Course ${COURSE_ID}`
      )
      console.log(
        `[DRY RUN] Would update XP: Participant ${entry.participantId} -> increment by ${entry.total_points}`
      )
      if (entry.swiss_quiz_award === 'Badge Switzerland') {
        console.log(
          `[DRY RUN] Would award Swiss Quiz (ID ${ACHIEVEMENT_SWISS_WHIZ}) to Participant ${entry.participantId}`
        )
      }
      if (entry.escape_room_award === 'Badge Escape Room') {
        console.log(
          `[DRY RUN] Would award Escape Room (ID ${ACHIEVEMENT_ESCAPE_ARTIST}) to Participant ${entry.participantId}`
        )
      }
      if (entry.simulation_award === 'Award Unternehmenssimulation') {
        console.log(
          `[DRY RUN] Would award Simulation (ID ${ACHIEVEMENT_CHOCO_STRATEGIST}) to Participant ${entry.participantId}`
        )
      }
    } else {
      console.log(
        `Processing updates for Participant ${entry.participantId} (Points: +${entry.total_points})...`
      )

      // Execute all mutations for the participant atomically inside a transaction
      await prisma.$transaction(async (tx) => {
        // A. Upsert LeaderboardEntry
        await tx.leaderboardEntry.upsert({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              participantId: entry.participantId,
              courseId: COURSE_ID,
            },
          },
          create: {
            type: 'COURSE',
            score: entry.total_points,
            participantId: entry.participantId,
            courseId: COURSE_ID,
          },
          update: {
            score: {
              increment: entry.total_points,
            },
          },
        })

        // B. Update overall participant XP
        await tx.participant.update({
          where: { id: entry.participantId },
          data: {
            xp: {
              increment: entry.total_points,
            },
          },
        })

        // C. Award Swiss Quiz Achievement (ID 18)
        if (entry.swiss_quiz_award === 'Badge Switzerland') {
          await tx.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: entry.participantId,
                achievementId: ACHIEVEMENT_SWISS_WHIZ,
              },
            },
            create: {
              participantId: entry.participantId,
              achievementId: ACHIEVEMENT_SWISS_WHIZ,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {},
          })
        }

        // D. Award Escape Room Achievement (ID 19)
        if (entry.escape_room_award === 'Badge Escape Room') {
          await tx.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: entry.participantId,
                achievementId: ACHIEVEMENT_ESCAPE_ARTIST,
              },
            },
            create: {
              participantId: entry.participantId,
              achievementId: ACHIEVEMENT_ESCAPE_ARTIST,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {},
          })
        }

        // E. Award Simulation Achievement (ID 20)
        if (entry.simulation_award === 'Award Unternehmenssimulation') {
          await tx.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: entry.participantId,
                achievementId: ACHIEVEMENT_CHOCO_STRATEGIST,
              },
            },
            create: {
              participantId: entry.participantId,
              achievementId: ACHIEVEMENT_CHOCO_STRATEGIST,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {},
          })
        }
      })
    }

    updatedCount++
  }

  console.log(
    `\nSeed action completed. Processed: ${updatedCount} participants.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
