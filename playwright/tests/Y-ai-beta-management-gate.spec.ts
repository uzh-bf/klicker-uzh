import { URL_MANAGE } from '../util/constants.js'
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
  test('opens Knowledge Bases and Chatbots from Resources and generates elements from the library', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    const navigation = page.getByTestId('navigation')
    await expect(navigation.getByTestId('ai')).not.toBeAttached()
    await page.getByTestId('generate-elements').click()
    await expect(page).toHaveURL(/\/elements\/generate$/)
    await navigation.getByTestId('library').click()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await navigation.getByTestId('resources').click()
    await expect(page.getByTestId('answer-collections')).toBeVisible()
    await expect(page.getByTestId('element-generation')).not.toBeAttached()
    await expect(page.getByTestId('knowledge-bases')).toBeVisible()
    await expect(page.getByTestId('chatbots')).toBeVisible()

    // Both entries navigate to their existing routes.
    await page.getByTestId('knowledge-bases').click()
    await expect(page).toHaveURL(/\/resources\/knowledgeBases$/)
    await expect(page.getByTestId('knowledge-base-list')).toBeVisible()

    await page.getByTestId('resources').click()
    await page.getByTestId('chatbots').click()
    await expect(page).toHaveURL(/\/resources\/chatbots$/)
    await expect(page.getByTestId('chatbot-list')).toBeVisible()
  })

  test('revoking AI approval denies knowledge bases but preserves eligible chatbot authoring', async ({
    loginLecturer,
    page,
    updateLecturerAiAccess,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await updateLecturerAiAccess(false)
    try {
      await page.reload()
      await expect(page.getByTestId('homepage')).toBeVisible()

      const navigation = page.getByTestId('navigation')
      await navigation.getByTestId('resources').click()
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
        await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
      }

      await page.goto(`${manageUrl}/de/resources/knowledgeBases`)
      await expect(page).toHaveURL(/\/de\/resources\/knowledgeBases$/)
      await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
    } finally {
      await updateLecturerAiAccess(true)
    }
  })
})
