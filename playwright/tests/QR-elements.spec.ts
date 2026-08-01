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

const activityButtons = [
  'create-practice-quiz',
  'create-microlearning',
  'create-group-activity',
  'create-live-quiz',
] as const

test.describe.serial('QR scan activity selection boundary', () => {
  let qrElementId: number

  test.beforeAll(async () => {
    const prisma = await getPrisma()
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
  })

  for (const activityButton of activityButtons) {
    test(`${activityButton} excludes QR scan elements from its question pool`, async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()

      const qrRow = page.getByTestId(`element-item-${QR_TITLE}`)
      await expect(qrRow).toBeVisible()
      await page.getByTestId(`element-checkbox-${QR_TITLE}`).click()

      await page.getByTestId(activityButton).click()
      await expect(page.getByTestId('cancel-activity-creation')).toBeVisible()
      await expect(qrRow).toHaveCount(0)

      await page.getByTestId('cancel-activity-creation').click()
      await expect(qrRow).toBeVisible()
    })
  }
})
