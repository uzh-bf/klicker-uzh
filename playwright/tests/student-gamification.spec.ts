import { AchievementType } from '@klicker-uzh/prisma/client'
import { COURSE_ID_TEST, PARTICIPANT_IDS } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { getPrisma } from '../global-setup.js'
import { enMessages as messages } from '../util/messages.js'

let testAchievementId: number | undefined

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

  await prisma.participantAchievementInstance.createMany({
    data: [
      {
        participantId: PARTICIPANT_IDS[48]!,
        achievementId: achievement.id,
        achievedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        participantId: PARTICIPANT_IDS[49]!,
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
    .getByTestId('leaderboard-entry-testuser50')
    .first()
  await expect(publicParticipant).toBeVisible()
  await publicParticipant.click()
  await expect(page.getByText('Receipt test achievement')).toBeVisible()
  await expect(page.getByText(receiptNotice)).not.toBeVisible()
  await page.waitForTimeout(500)
  expect(acknowledgementRequests).toBe(2)
})
