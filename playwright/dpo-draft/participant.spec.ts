import { expect, test, type Page } from '@playwright/test'

async function chooseView(page: Page, index: number) {
  await page.getByTestId('dpo-view').click()
  await page.getByRole('option').nth(index).click()
}

for (const [index, view] of [
  [1, 'eduid'],
  [2, 'assessment'],
] as const) {
  test(`${view} requires only choices and acknowledgement`, async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (
        ['fetch', 'xhr', 'ping'].includes(request.resourceType()) &&
        !new URL(request.url()).pathname.startsWith('/_next/')
      )
        requests.push(request.url())
    })
    await page.goto('/de/dpo-draft')
    await chooseView(page, index)
    await expect(
      page.locator('input[type=email], input[type=password], input[type=text]')
    ).toHaveCount(0)
    await expect(page.getByTestId(`dpo-${view}-submit`)).toBeDisabled()
    await page.getByTestId(`dpo-${view}-la-false`).click()
    await page.getByTestId(`dpo-${view}-ack-checkbox`).check()
    await page.getByTestId(`dpo-${view}-submit`).click()
    await expect(page.getByTestId(`dpo-${view}-result`)).toBeVisible()
    expect(requests).toEqual([])
  })
}

test('renewed acknowledgement preserves saved refusals', async ({ page }) => {
  await page.goto('/en/dpo-draft')
  await chooseView(page, 3)
  await expect(page.getByTestId('dpo-gate-submit')).toBeDisabled()
  await page.getByTestId('dpo-gate-scenario').click()
  await page.getByRole('option').nth(1).click()
  await expect(page.getByTestId('dpo-gate-la-false')).toBeChecked()
  await page.getByTestId('dpo-gate-research-details').click()
  await expect(page.getByTestId('dpo-gate-research-object')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.getByTestId('dpo-gate-ack-checkbox').check()
  await page.getByTestId('dpo-gate-submit').click()
  await expect(page.getByTestId('dpo-gate-result')).toBeVisible()
  await expect(page.getByTestId('dpo-gate-la-false')).toBeChecked()
  await expect(page.getByTestId('dpo-gate-research-object')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('analytics withdrawal requires confirmation and stays independent of research', async ({
  page,
}) => {
  await page.goto('/en/dpo-draft')
  await chooseView(page, 4)
  const analytics = page.getByTestId('dpo-settings-analytics')
  const research = page.getByTestId('dpo-settings-research')
  await research.click()
  await expect(analytics).toBeChecked()
  await analytics.click()
  await page.getByTestId('dpo-settings-analytics-cancel').click()
  await expect(analytics).toBeChecked()
  await expect(research).not.toBeChecked()
  await analytics.click()
  await page.getByTestId('dpo-settings-analytics-confirm').click()
  await expect(analytics).not.toBeChecked()
  await analytics.click()
  await expect(analytics).toBeChecked()
  await expect(research).not.toBeChecked()
})

test('joining and rejoining rank retained points without retroactive awards', async ({
  page,
}) => {
  await page.goto('/de/dpo-draft')
  await chooseView(page, 5)
  await page.getByTestId('dpo-leaderboard-close').click()
  await expect(page.getByTestId('dpo-leaderboard-personal-points')).toHaveText(
    '120'
  )
  await expect(page.getByTestId('dpo-leaderboard-ranking-points')).toHaveText(
    '0'
  )
  for (let join = 0; join < 2; join++) {
    await page.getByTestId('dpo-leaderboard-open').click()
    await page
      .getByTestId(
        join === 0 ? 'dpo-leaderboard-join' : 'dpo-leaderboard-rejoin'
      )
      .click()
    await expect(page.getByTestId('dpo-leaderboard-ranking-points')).toHaveText(
      '120'
    )
    await expect(page.getByTestId('dpo-leaderboard-awards')).toHaveText('0')
    await page.getByTestId('dpo-leaderboard-open').click()
    await page.getByTestId('dpo-leaderboard-leave').click()
    await expect(
      page.getByTestId('dpo-leaderboard-personal-points')
    ).toHaveText('120')
    await expect(page.getByTestId('dpo-leaderboard-ranking-points')).toHaveText(
      '0'
    )
  }
})
