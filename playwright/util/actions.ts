import { type Locator, type Page } from '@playwright/test'

export type ActivityActionType =
  | 'LIVE_QUIZ'
  | 'PRACTICE_QUIZ'
  | 'MICRO_LEARNING'
  | 'GROUP_ACTIVITY'

async function findVisibleByTestId(
  page: Page,
  testId: string,
  timeout = 15_000
): Promise<Locator> {
  const startedAt = Date.now()
  const locator = page.getByTestId(testId)

  while (Date.now() - startedAt < timeout) {
    const count = await locator.count()

    for (let ix = 0; ix < count; ix++) {
      const candidate = locator.nth(ix)
      if (await candidate.isVisible().catch(() => false)) {
        return candidate
      }
    }

    await page.waitForTimeout(100)
  }

  throw new Error(`No visible element found for data-cy="${testId}"`)
}

export async function clickVisibleByTestId(
  page: Page,
  testId: string,
  timeout?: number
) {
  const locator = await findVisibleByTestId(page, testId, timeout)
  await locator.scrollIntoViewIfNeeded().catch(() => undefined)
  await locator.click()
}

export async function openActivityActionMenu(
  page: Page,
  type: ActivityActionType,
  name: string,
  expectedActionTestId?: string
) {
  await openActionMenuByTestId(
    page,
    `actions-${type}-${name}`,
    expectedActionTestId
  )
}

export async function chooseActivityAction(
  page: Page,
  type: ActivityActionType,
  name: string,
  actionTestId: string
) {
  await chooseActionByTestId(page, `actions-${type}-${name}`, actionTestId)
}

export async function openActionMenuByTestId(
  page: Page,
  triggerTestId: string,
  expectedActionTestId?: string
) {
  if (
    expectedActionTestId &&
    (await page
      .getByTestId(expectedActionTestId)
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    return
  }

  await clickVisibleByTestId(page, triggerTestId)

  if (expectedActionTestId) {
    await findVisibleByTestId(page, expectedActionTestId)
  }
}

export async function chooseActionByTestId(
  page: Page,
  triggerTestId: string,
  actionTestId: string
) {
  await openActionMenuByTestId(page, triggerTestId, actionTestId)
  await clickVisibleByTestId(page, actionTestId)
}
