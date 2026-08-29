import { AchievementType, LeaderboardType } from '@klicker-uzh/prisma/client'
import { COURSE_ID_TEST, PARTICIPANT_IDS } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { getPrisma } from '../global-setup.js'
import { enMessages as messages } from '../util/messages.js'

let testAchievementId: number | undefined
let publicParticipantId: string | undefined
let publicParticipantWasPublic: boolean | undefined
let publicParticipantWasActive: boolean | undefined
let publicLeaderboardEntryId: number | undefined
let publicParticipantUsername: string | undefined
let receiptParticipantWasPublic: boolean | undefined
let receiptParticipantWasActive: boolean | undefined

test.beforeAll(async () => {
  const prisma = await getPrisma()
  await prisma.achievement.deleteMany({ where: { id: 900000 } })
  const achievement = await prisma.achievement.create({
    data: {
      id: 900000,
      nameDE: 'Quittungs-Testauszeichnung',
      nameEN: 'Receipt test achievement',
      descriptionDE: 'Auszeichnung für den Quittungstest.',
      descriptionEN: 'Achievement used to test receipt acknowledgement.',
      icon: '/achievements/Dreamteam.svg',
      rewardedPoints: 0,
      rewardedXP: 0,
      type: AchievementType.PARTICIPANT,
      isDiscoverable: true,
    },
  })
  testAchievementId = achievement.id

  const publicParticipantIdForTest = PARTICIPANT_IDS[0]!
  const receiptParticipantId = PARTICIPANT_IDS[48]!
  const [
    publicParticipant,
    publicParticipation,
    receiptParticipant,
    receiptParticipation,
  ] = await Promise.all([
    prisma.participant.findUniqueOrThrow({
      where: { id: publicParticipantIdForTest },
      select: { isProfilePublic: true, username: true },
    }),
    prisma.participation.findUniqueOrThrow({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: publicParticipantIdForTest,
        },
      },
      select: { isActive: true },
    }),
    prisma.participant.findUniqueOrThrow({
      where: { id: receiptParticipantId },
      select: { isProfilePublic: true },
    }),
    prisma.participation.findUniqueOrThrow({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: receiptParticipantId,
        },
      },
      select: { isActive: true },
    }),
  ])
  const publicLeaderboardEntry = await prisma.leaderboardEntry.create({
    data: {
      type: LeaderboardType.COURSE,
      score: 100,
      participant: { connect: { id: publicParticipantIdForTest } },
      course: { connect: { id: COURSE_ID_TEST } },
      participation: {
        connect: {
          courseId_participantId: {
            courseId: COURSE_ID_TEST,
            participantId: publicParticipantIdForTest,
          },
        },
      },
    },
  })
  publicParticipantId = publicParticipantIdForTest
  publicParticipantWasPublic = publicParticipant.isProfilePublic
  publicParticipantWasActive = publicParticipation.isActive
  publicLeaderboardEntryId = publicLeaderboardEntry.id
  publicParticipantUsername = publicParticipant.username
  receiptParticipantWasPublic = receiptParticipant.isProfilePublic
  receiptParticipantWasActive = receiptParticipation.isActive

  await Promise.all([
    prisma.participant.update({
      where: { id: publicParticipantIdForTest },
      data: { isProfilePublic: true },
    }),
    prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: publicParticipantIdForTest,
        },
      },
      data: { isActive: true },
    }),
    prisma.participant.update({
      where: { id: receiptParticipantId },
      data: { isProfilePublic: true },
    }),
    prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: receiptParticipantId,
        },
      },
      data: { isActive: true },
    }),
  ])

  await prisma.participantAchievementInstance.createMany({
    data: [
      {
        participantId: PARTICIPANT_IDS[48]!,
        achievementId: achievement.id,
        achievedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        participantId: publicParticipantIdForTest,
        achievementId: achievement.id,
        achievedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ],
  })
})

test.afterAll(async () => {
  if (typeof testAchievementId === 'undefined') return

  const prisma = await getPrisma()
  await prisma.achievement.delete({ where: { id: testAchievementId } })

  if (
    typeof publicParticipantId !== 'undefined' &&
    typeof publicParticipantWasActive !== 'undefined'
  ) {
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: publicParticipantId,
        },
      },
      data: { isActive: publicParticipantWasActive },
    })
  }

  if (typeof publicLeaderboardEntryId !== 'undefined') {
    await prisma.leaderboardEntry.delete({
      where: { id: publicLeaderboardEntryId },
    })
  }

  if (
    typeof publicParticipantId !== 'undefined' &&
    typeof publicParticipantWasPublic !== 'undefined'
  ) {
    await prisma.participant.update({
      where: { id: publicParticipantId },
      data: { isProfilePublic: publicParticipantWasPublic },
    })
  }

  if (
    typeof receiptParticipantWasPublic !== 'undefined' &&
    typeof receiptParticipantWasActive !== 'undefined'
  ) {
    await Promise.all([
      prisma.participant.update({
        where: { id: PARTICIPANT_IDS[48]! },
        data: { isProfilePublic: receiptParticipantWasPublic },
      }),
      prisma.participation.update({
        where: {
          courseId_participantId: {
            courseId: COURSE_ID_TEST,
            participantId: PARTICIPANT_IDS[48]!,
          },
        },
        data: { isActive: receiptParticipantWasActive },
      }),
    ])
  }
})

test('acknowledges receipts only for self profiles and retries after failure', async ({
  page,
  loginStudentPassword,
}) => {
  let acknowledgementRequests = 0
  let failAcknowledgement = true

  await loginStudentPassword('testuser49')
  await expect(page.getByTestId('homepage')).toBeVisible()

  await page.route('**/api/graphql', async (route) => {
    const postData = route.request().postData() ?? ''

    if (postData.includes('AcknowledgeAchievementReceipt')) {
      acknowledgementRequests += 1

      if (failAcknowledgement) {
        await route.abort('failed')
        return
      }
    }

    await route.continue()
  })

  const receiptNotice = messages.pwa.general.newAchievementReceipt
  await page.goto('/profile')
  await expect(page.getByText('Receipt test achievement')).toBeVisible()
  await expect(page.getByText(receiptNotice)).toBeVisible()
  await expect.poll(() => acknowledgementRequests).toBe(1)
  await page.waitForTimeout(2000)
  expect(acknowledgementRequests).toBe(1)

  failAcknowledgement = false
  await page.reload()
  await expect(page.getByText('Receipt test achievement')).toBeVisible()
  await expect(page.getByText(receiptNotice)).not.toBeVisible()
  await expect.poll(() => acknowledgementRequests).toBe(2)

  const prisma = await getPrisma()
  const acknowledged = await prisma.participantAchievementInstance.findUnique({
    where: {
      participantId_achievementId: {
        participantId: PARTICIPANT_IDS[48]!,
        achievementId: testAchievementId!,
      },
    },
  })
  expect(acknowledged?.receiptAcknowledgedAt).not.toBeNull()

  await page.reload()
  await expect(page.getByText('Receipt test achievement')).toBeVisible()
  await expect(page.getByText(receiptNotice)).not.toBeVisible()
  await page.waitForTimeout(500)
  expect(acknowledgementRequests).toBe(2)

  await loginStudentPassword('testuser49')
  await expect(page.getByTestId('homepage')).toBeVisible()
  await page.goto('/profile')
  await expect(page.getByText('Receipt test achievement')).toBeVisible()
  await expect(page.getByText(receiptNotice)).not.toBeVisible()
  await page.waitForTimeout(500)
  expect(acknowledgementRequests).toBe(2)

  await page.goto(`/course/${COURSE_ID_TEST}`)
  const publicParticipant = page
    .getByTestId(`leaderboard-entry-${publicParticipantUsername}`)
    .first()
  await expect(publicParticipant).toBeVisible()
  await publicParticipant.click()
  await expect(page.getByText('Receipt test achievement')).toBeVisible()
  await expect(page.getByText(receiptNotice)).not.toBeVisible()
  await page.waitForTimeout(500)
  expect(acknowledgementRequests).toBe(2)
})
