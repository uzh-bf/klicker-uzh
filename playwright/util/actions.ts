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
  const locator = page.getByTestId(testId)
  let visibleIndex = -1

  await expect(async () => {
    const count = await locator.count()

    for (let ix = 0; ix < count; ix++) {
      const candidate = locator.nth(ix)
      if (await candidate.isVisible().catch(() => false)) {
        visibleIndex = ix
        return
      }
    }

    visibleIndex = -1
    expect(visibleIndex).toBeGreaterThanOrEqual(0)
  }).toPass({ intervals: [100], timeout })

  return locator.nth(visibleIndex)
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

export async function expectActionMenuItems(
  page: Page,
  triggerTestId: string,
  {
    visible = [],
    hidden = [],
  }: {
    visible?: string[]
    hidden?: string[]
  }
) {
  await openActionMenuByTestId(page, triggerTestId, visible[0])

  for (const testId of visible) {
    await findVisibleByTestId(page, testId)
  }

  for (const testId of hidden) {
    await expect(page.getByTestId(testId)).not.toBeVisible()
  }
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
  await openActivityActionMenu(page, type, name, actionTestId)
  await clickVisibleByTestId(page, actionTestId)
}

export async function openAnswerCollectionActionMenu(
  page: Page,
  collectionName: string,
  expectedActionTestId?: string
) {
  await openActionMenuByTestId(
    page,
    `answer-collection-actions-${collectionName}`,
    expectedActionTestId
  )
}

export async function chooseAnswerCollectionAction(
  page: Page,
  collectionName: string,
  actionTestId: string
) {
  await openAnswerCollectionActionMenu(page, collectionName, actionTestId)
  await clickVisibleByTestId(page, actionTestId)
}

export async function openUserGroupActionMenu(
  page: Page,
  groupName: string,
  expectedActionTestId?: string
) {
  await openActionMenuByTestId(
    page,
    `user-group-actions-${groupName}`,
    expectedActionTestId
  )
}

export async function chooseUserGroupAction(
  page: Page,
  groupName: string,
  actionTestId: string
) {
  await openUserGroupActionMenu(page, groupName, actionTestId)
  await clickVisibleByTestId(page, actionTestId)
}

export async function openCatalogObjectActionMenu(
  page: Page,
  objectName: string,
  expectedActionTestId?: string
) {
  await openActionMenuByTestId(
    page,
    `actions-dropdown-${objectName}`,
    expectedActionTestId
  )
}

export async function chooseCatalogObjectAction(
  page: Page,
  objectName: string,
  actionTestId: string
) {
  await openCatalogObjectActionMenu(page, objectName, actionTestId)
  await clickVisibleByTestId(page, actionTestId)
}
