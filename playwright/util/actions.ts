import { expect, type Locator, type Page } from '@playwright/test'

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

function openMenuItemByTestId(page: Page, testId: string) {
  return page
    .locator(
      '[data-slot="dropdown-menu-content"][data-state="open"], [data-slot="menubar-content"][data-state="open"]'
    )
    .getByTestId(testId)
    .first()
}

export async function clickVisibleByTestId(
  page: Page,
  testId: string,
  timeout = 15_000
) {
  const locator = openMenuItemByTestId(page, testId)
  await locator.waitFor({ state: 'visible', timeout })
  await locator.scrollIntoViewIfNeeded().catch(() => undefined)
  await locator.click({ timeout })
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

export async function filterActivitiesByName(page: Page, activityName: string) {
  const searchInput = page.getByTestId('activities-search-input')

  await expect(searchInput).toBeVisible()
  await searchInput.fill(activityName)
  await expect(searchInput).toHaveValue(activityName)
  await searchInput.press('Enter')
  await expect(searchInput).toHaveValue(activityName)
}

export async function openCourseActionMenu(
  page: Page,
  expectedActionTestId?: string
) {
  await openActionMenuByTestId(
    page,
    'course-actions-menu',
    expectedActionTestId
  )
}

export async function chooseCourseAction(page: Page, actionTestId: string) {
  await chooseActionByTestId(page, 'course-actions-menu', actionTestId)
}

export async function openActionMenuByTestId(
  page: Page,
  triggerTestId: string,
  expectedActionTestId?: string
) {
  const trigger = await findVisibleByTestId(page, triggerTestId)
  const expectedAction = expectedActionTestId
    ? openMenuItemByTestId(page, expectedActionTestId)
    : undefined

  if (expectedAction && (await expectedAction.isVisible().catch(() => false)))
    return

  if ((await trigger.getAttribute('aria-expanded')) === 'true') {
    if (!expectedAction) return

    // An action from a closing Radix portal can still be visible. Close that
    // menu fully before opening a fresh menu with actionable items.
    await page.keyboard.press('Escape')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  }

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined)
  await trigger.click()

  if (expectedAction) await expectedAction.waitFor({ state: 'visible' })
}

export async function chooseActionByTestId(
  page: Page,
  triggerTestId: string,
  actionTestId: string
) {
  const directAction = page
    .getByTestId(actionTestId)
    .and(page.getByRole('button'))
    .first()

  if (await directAction.isVisible().catch(() => false)) {
    await directAction.scrollIntoViewIfNeeded().catch(() => undefined)
    await directAction.click()
    return
  }

  await openActionMenuByTestId(page, triggerTestId, actionTestId)
  await clickVisibleByTestId(page, actionTestId)
}
