import type { Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { LECTURER_ID } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { createQuestionSC } from '../util/fixtures/elements.js'

async function openBatchOperations(page: Page, elementName: string) {
  const search = page.getByTestId('elements-search-input')
  await search.fill(elementName)
  await search.press('Enter')

  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`element-checkbox-${elementName}`).check()
  await page.getByTestId('element-batch-operations').click()
  await expect(
    page.getByTestId('batch-selected-elements-description')
  ).toBeVisible()
}

test('requires explicit opt-in before propagating batch changes', async ({
  page,
  loginLecturer,
}, testInfo) => {
  const elementName = `W6 Batch Operations ${testInfo.workerIndex}-${testInfo.retry}`
  await createQuestionSC({
    name: elementName,
    content: 'Synthetic batch operations test content.',
    choices: [{ value: 'Correct' }, { value: 'Incorrect' }],
    userId: LECTURER_ID,
  })

  try {
    await loginLecturer()

    const capturedVariables: Record<string, unknown>[] = []
    await page.route('**/api/graphql', async (route) => {
      const rawBody = route.request().postData()
      const body = rawBody
        ? (JSON.parse(rawBody) as {
            operationName?: string
            variables?: Record<string, unknown>
          })
        : undefined

      if (body?.operationName !== 'ApplyElementBatchOperations') {
        await route.continue()
        return
      }

      capturedVariables.push(body.variables ?? {})
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { applyElementBatchOperations: 1 } }),
      })
    })

    await openBatchOperations(page, elementName)

    await expect(
      page.getByTestId('batch-selected-elements-description')
    ).toHaveText(
      'Review the selected elements below. Then choose the actions to apply.'
    )
    await expect(page.getByTestId('batch-element-name-heading')).toBeVisible()
    await expect(page.getByTestId('batch-element-update-heading')).toBeVisible()

    const instanceUpdates = page.getByRole('switch', {
      name: 'Also apply these changes to draft and scheduled activities',
    })
    const templateUpdates = page.getByRole('switch', {
      name: 'Also update activity templates',
    })
    await expect(instanceUpdates).not.toBeChecked()
    await expect(templateUpdates).not.toBeChecked()
    await expect(templateUpdates).toBeDisabled()

    await page.getByTestId('archive-button').click()
    await page.getByTestId('apply-batch-operations').click()
    await expect.poll(() => capturedVariables.length).toBe(1)
    await expect(page.getByTestId('close-batch-operations-modal')).toHaveCount(
      0
    )
    expect(capturedVariables[0]).toMatchObject({
      archive: true,
      unarchive: false,
      updateInstances: false,
      updateTemplateInstances: false,
    })

    await openBatchOperations(page, elementName)
    await page.getByTestId('archive-button').click()

    await instanceUpdates.click()
    await expect(instanceUpdates).toBeChecked()
    await expect(templateUpdates).toBeEnabled()
    await templateUpdates.click()
    await expect(templateUpdates).toBeChecked()

    await page.getByTestId('apply-batch-operations').click()
    await expect.poll(() => capturedVariables.length).toBe(2)
    await expect(page.getByTestId('close-batch-operations-modal')).toHaveCount(
      0
    )
    expect(capturedVariables[1]).toMatchObject({
      archive: true,
      unarchive: false,
      updateInstances: true,
      updateTemplateInstances: true,
    })
  } finally {
    const prisma = await getPrisma()
    await prisma.element.deleteMany({ where: { name: elementName } })
  }
})
