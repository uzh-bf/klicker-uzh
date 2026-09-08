import { getPrisma } from '../global-setup.js'
import { URL_MANAGE, USER_ID_TEST } from '../util/constants.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'

/**
 * Lecturer AI beta management gate (apps/frontend-manage).
 *
 * Broader AI requires beta enrollment, GrowthBook `ai-beta`, and approval.
 * Eligible chatbot authors do not require administrative AI approval.
 * The dev E2E environment forces the flag on and the seeded lecturer starts
 * with the entitlement, so the denied half of the gate is exercised by
 * flipping the entitlement off through the database and reloading.
 */

test('CLEANUP', cleanupTest)

test.describe('AI beta management navigation gate', () => {
  test('shows Knowledge Bases and Chatbots under a top-level AI menu next to Resources and Analytics when the gate is open', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    // The AI entrypoint sits between Resources and Analytics in the bar.
    const navigation = page.getByTestId('navigation')
    await expect(navigation.getByTestId('resources')).toBeVisible()
    await expect(navigation.getByTestId('ai')).toBeVisible()
    await expect(navigation.getByTestId('analytics')).toBeVisible()
    const resourcesPosition = await navigation
      .getByTestId('resources')
      .evaluate((el) => el.getBoundingClientRect().left)
    const aiPosition = await navigation
      .getByTestId('ai')
      .evaluate((el) => el.getBoundingClientRect().left)
    const analyticsPosition = await navigation
      .getByTestId('analytics')
      .evaluate((el) => el.getBoundingClientRect().left)
    expect(resourcesPosition).toBeLessThan(aiPosition)
    expect(aiPosition).toBeLessThan(analyticsPosition)

    // Knowledge Bases and Chatbots moved out of the Resources dropdown.
    await navigation.getByTestId('resources').click()
    await expect(page.getByTestId('answer-collections')).toBeVisible()
    await expect(page.getByTestId('knowledge-bases')).not.toBeAttached()
    await expect(page.getByTestId('chatbots')).not.toBeAttached()
    await page.keyboard.press('Escape')

    // The AI menu carries both entries.
    await navigation.getByTestId('ai').click()
    await expect(page.getByTestId('knowledge-bases')).toBeVisible()
    await expect(page.getByTestId('chatbots')).toBeVisible()

    // Both entries navigate to their existing routes.
    await page.getByTestId('knowledge-bases').click()
    await expect(page).toHaveURL(/\/resources\/knowledgeBases$/)
    await expect(page.getByTestId('knowledge-base-list')).toBeVisible()

    await page.getByTestId('ai').click()
    await page.getByTestId('chatbots').click()
    await expect(page).toHaveURL(/\/resources\/chatbots$/)
    await expect(page.getByTestId('chatbot-list')).toBeVisible()
  })

  test('revoking AI approval denies knowledge bases but preserves eligible chatbot authoring', async ({
    loginLecturer,
    page,
  }) => {
    const prisma = await getPrisma()
    const previousAccess = await prisma.user.findUniqueOrThrow({
      where: { id: USER_ID_TEST },
      select: { aiFeaturesEnabled: true, betaEnabled: true },
    })
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    try {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        // Keep beta enrollment open so this isolates administrative approval
        // from the independent chatbot authoring gate.
        data: { aiFeaturesEnabled: false, betaEnabled: true },
      })
      await page.reload()
      await expect(page.getByTestId('homepage')).toBeVisible()

      const navigation = page.getByTestId('navigation')
      await navigation.getByTestId('ai').click()
      await expect(page.getByTestId('knowledge-bases')).not.toBeAttached()
      await expect(page.getByTestId('chatbots')).toBeVisible()
      await page.getByTestId('chatbots').click()
      await expect(page.getByTestId('chatbot-list')).toBeVisible()

      const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

      for (const path of [
        '/resources/knowledgeBases',
        '/resources/knowledgeBases/00000000-0000-4000-8000-000000000000',
      ]) {
        await page.goto(`${manageUrl}${path}`)
        // No redirect: the URL stays on the requested route and the denied
        // state renders in place.
        await expect(page).toHaveURL(
          new RegExp(path.replaceAll('/', '\\/') + '$')
        )
        await expect(
          page.getByTestId('ai-beta-unavailable'),
          `Unavailable state on ${path}`
        ).toBeVisible()
      }

      await page.goto(`${manageUrl}/de/resources/knowledgeBases`)
      await expect(page).toHaveURL(/\/de\/resources\/knowledgeBases$/)
      await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
    } finally {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: previousAccess,
      })
    }
  })

  test('hides the AI menu and renders unavailable states when both AI gates are closed', async ({
    loginLecturer,
    page,
  }) => {
    const prisma = await getPrisma()
    const previousAccess = await prisma.user.findUniqueOrThrow({
      where: { id: USER_ID_TEST },
      select: { aiFeaturesEnabled: true, betaEnabled: true },
    })
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    try {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: { aiFeaturesEnabled: false, betaEnabled: false },
      })
      await page.reload()
      await expect(page.getByTestId('homepage')).toBeVisible()

      const navigation = page.getByTestId('navigation')
      await expect(navigation.getByTestId('ai')).not.toBeAttached()

      const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

      for (const [path, unavailableState] of [
        ['/resources/knowledgeBases', 'ai-beta-unavailable'],
        [
          '/resources/knowledgeBases/00000000-0000-4000-8000-000000000000',
          'ai-beta-unavailable',
        ],
        ['/resources/chatbots', 'chatbot-authoring-unavailable'],
      ]) {
        await page.goto(manageUrl + path)
        // No redirect: the URL stays on the requested route and the denied
        // state renders in place.
        await expect(page).toHaveURL(manageUrl + path)
        await expect(
          page.getByTestId(unavailableState),
          'Unavailable state on ' + path
        ).toBeVisible()
      }

      await page.goto(manageUrl + '/de/resources/knowledgeBases')
      await expect(page).toHaveURL(manageUrl + '/de/resources/knowledgeBases')
      await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
    } finally {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: previousAccess,
      })
    }
  })
})
