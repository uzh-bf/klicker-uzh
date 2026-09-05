import { seedActivities } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'

test('CLEANUP', cleanupTest)

test.describe('Catalyst access request flow', () => {
  test.beforeAll(async () => {
    await seedActivities()
  })

  test('Test that a non-Catalyst account owner sees and submits the request form', async ({
    page,
    loginFreeUser,
  }) => {
    await loginFreeUser()

    // Open the support dialog
    await page.getByTestId('support-menubar-item').click()

    // The request entry should be visible for a non-Catalyst account owner
    const requestEntry = page.getByTestId('support-catalyst-request')
    await expect(requestEntry).toBeVisible()
    await requestEntry.click()

    // The form should appear with validation initially blocking submission
    const submitButton = page.getByTestId('catalyst-request-submit')
    await expect(submitButton).toBeDisabled()

    // Fill in valid values
    await page
      .getByTestId('catalyst-request-institution')
      .fill('Synthetic University')
    await page
      .getByTestId('catalyst-request-use-case')
      .fill(
        'Evaluating KlickerUZH Catalyst features for one synthetic pilot course.'
      )
    await expect(submitButton).toBeEnabled()

    // Email delivery is an external side effect, so mock the successful
    // mutation response in this browser test.
    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()
      const operationName = postData
        ? (JSON.parse(postData) as { operationName?: string }).operationName
        : undefined

      if (
        request.method() === 'POST' &&
        operationName === 'MRequestCatalystAccess'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { requestCatalystAccess: true } }),
        })
        return
      }

      await route.continue()
    })

    // Submit once and verify exactly one mutation is sent (no double-click)
    const mutationCount = 1
    let sentCount = 0
    page.on('request', (req) => {
      if (req.method() !== 'POST' || !req.url().endsWith('/api/graphql')) {
        return
      }

      const postData = req.postData()
      const operationName = postData
        ? (JSON.parse(postData) as { operationName?: string }).operationName
        : undefined

      if (operationName === 'MRequestCatalystAccess') {
        sentCount++
      }
    })

    await submitButton.dblclick()
    await page.waitForTimeout(1000)
    expect(sentCount).toBe(mutationCount)

    // The modal should close after success
    await expect(page.getByTestId('support-catalyst-request')).toBeHidden()
  })

  test('Test that the request entry is absent for catalyst users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('support-menubar-item').click()
    await expect(page.getByTestId('support-email')).toBeVisible()
    await expect(page.getByTestId('support-catalyst-request')).toBeHidden()
  })
})
