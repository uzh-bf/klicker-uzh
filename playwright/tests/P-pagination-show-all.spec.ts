import { expect, test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'

async function expectAllResultsLoaded(page: import('@playwright/test').Page) {
  const summary = page.getByText(/Showing 1 to \d+ of \d+ results/)
  await expect(summary).toBeVisible()

  const summaryText = await summary.textContent()
  const match = summaryText?.match(/Showing 1 to (\d+) of (\d+) results/)
  if (!match) {
    throw new Error(`Unexpected pagination summary: ${summaryText}`)
  }

  return Number(match[2])
}

test.describe('Show all pagination option', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('supports all and explicit batch selection for elements and activities', async ({
    page,
  }) => {
    await expect(page.getByTestId('pagination-page-size')).toBeVisible()

    await selectOption(page, '[data-cy="pagination-page-size"]', 'all')
    await expect(page.getByTestId('pagination-page-size')).toContainText('All')
    await expect(page.getByTestId('pagination-next')).toHaveCount(0)
    const totalElements = await expectAllResultsLoaded(page)
    await expect(page.locator('[data-cy^="element-item-"]')).toHaveCount(
      totalElements
    )
    await expect(page.getByTestId('element-batch-operations')).toHaveCount(0)

    await page.getByTestId('select-all-elements').click()
    await expect(page.getByTestId('element-batch-operations')).toBeVisible()

    await selectOption(page, '[data-cy="pagination-page-size"]', '50')
    await expect(page.getByTestId('pagination-page-size')).toContainText('50')

    await page.getByTestId('activities').click()
    await expect(page).toHaveURL(/\/activities/)
    await expect(page.getByTestId('pagination-page-size')).toBeVisible()

    await selectOption(page, '[data-cy="pagination-page-size"]', 'all')
    await expect(page.getByTestId('pagination-page-size')).toContainText('All')
    await expect(page.getByTestId('pagination-next')).toHaveCount(0)
    const totalActivities = await expectAllResultsLoaded(page)
    await expect(page.locator('[data-cy^="activity-item-"]')).toHaveCount(
      totalActivities
    )
    await expect(page.getByTestId('activity-batch-operations')).toHaveCount(0)

    await page.getByTestId('select-all-activities').click()
    await expect(page.getByTestId('activity-batch-operations')).toBeVisible()

    await selectOption(page, '[data-cy="pagination-page-size"]', '50')
    await expect(page.getByTestId('pagination-page-size')).toContainText('50')
  })
})
