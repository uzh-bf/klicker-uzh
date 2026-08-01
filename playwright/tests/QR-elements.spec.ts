import {
  ElementStatus,
  ElementType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { USER_ID_TEST } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

test('CLEANUP', cleanupTest)

const QR_TITLE = 'QR scan activity boundary'
const ACCEPTED_TITLE = 'Accepted activity question'

const activityButtons = [
  'create-practice-quiz',
  'create-microlearning',
  'create-group-activity',
  'create-live-quiz',
] as const

test.describe.serial('QR scan activity selection boundary', () => {
  let qrElementId: number
  let acceptedElementId: number

  test.beforeAll(async () => {
    const prisma = await getPrisma()
    const acceptedElement = await prisma.element.create({
      data: {
        type: ElementType.SC,
        status: ElementStatus.READY,
        name: ACCEPTED_TITLE,
        content: 'Choose the accepted answer',
        explanation: null,
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
          displayMode: 'LIST',
          choices: [
            { ix: 0, value: 'Correct', correct: true },
            { ix: 1, value: 'Incorrect', correct: false },
          ],
        },
        ownerId: USER_ID_TEST,
      },
    })

    acceptedElementId = acceptedElement.id
    await prisma.derivedPermission.create({
      data: {
        elementId: acceptedElement.id,
        userId: USER_ID_TEST,
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    const qrElement = await prisma.element.create({
      data: {
        type: ElementType.QR_SCAN,
        status: ElementStatus.READY,
        name: QR_TITLE,
        content: 'Scan the code to continue',
        explanation: null,
        basePoints: true,
        pointsMultiplier: 1,
        options: {},
        qrScanCode: 'qrBoundary01',
        ownerId: USER_ID_TEST,
      },
    })

    qrElementId = qrElement.id

    await prisma.derivedPermission.create({
      data: {
        elementId: qrElement.id,
        userId: USER_ID_TEST,
        permissionLevel: PermissionLevel.OWNER,
      },
    })
  })

  test.afterAll(async () => {
    const prisma = await getPrisma()
    await prisma.element.delete({ where: { id: qrElementId } })
    await prisma.element.delete({ where: { id: acceptedElementId } })
  })

  for (const activityButton of activityButtons) {
    test(`${activityButton} excludes QR scan elements from its question pool`, async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()

      await page.evaluate(() => {
        localStorage.setItem('elements-page-size', JSON.stringify(1))
      })
      await page.reload()
      await page.getByTestId('sort-by-question-pool').click()
      await page.getByTestId('sort-by-question-pool-title').click()

      const qrRow = page.getByTestId(`element-item-${QR_TITLE}`)
      await expect(qrRow).toBeVisible()
      await page.getByTestId('select-all-elements').click()

      await page.getByTestId(activityButton).click()
      await expect(page.getByTestId('cancel-activity-creation')).toBeVisible()
      await expect(qrRow).toHaveCount(0)
      await expect(
        page.getByTestId(`element-item-${ACCEPTED_TITLE}`)
      ).toBeVisible()

      await page.getByTestId('select-all-elements').click()
      if (
        activityButton === 'create-practice-quiz' ||
        activityButton === 'create-microlearning'
      ) {
        await page.getByTestId('paste-selected-questions').click()
        await expect(page.getByTestId('element-0-stack-0')).toContainText(
          ACCEPTED_TITLE
        )
      } else {
        await page.getByTestId('add-stack-with-selected').first().click()
        const elementType =
          activityButton === 'create-live-quiz' ? 'block' : 'stack'
        await expect(
          page.getByTestId(`element-0-${elementType}-1`)
        ).toContainText(ACCEPTED_TITLE)
      }
      await expect(page.getByText(QR_TITLE, { exact: true })).toHaveCount(0)

      await page.getByTestId('cancel-activity-creation').click()
      await expect(qrRow).toBeVisible()
    })
  }
})
