/**
 * D-elements-content.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/D-elements-content-workflow.cy.ts
 * Tests creation, persistence, and editing of Content element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { CONTENT_DATA as CT } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  fillEditorField,
  saveElement,
  searchAndEdit,
  setElementStatus,
  switchElementType,
  validateElement,
  verifyEditorField,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

test('CLEANUP', cleanupTest)

test.describe('Test creation and editing functionalities for Content elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a content element', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.content)
    await page.getByTestId('insert-question-title').fill(CT.title)
    await setElementStatus(page, statusLabels.draft)
    await fillEditorField(page, 'insert-question-text', CT.content)
    await saveElement(page)

    await validateElement(page, CT.title, [
      CT.content,
      CT.title,
      statusLabels.draft,
    ])
  })

  test('Check that values of content element are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, CT.title)

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.content
    )
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CT.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.draft
    )
    await verifyEditorField(page, 'insert-question-text', CT.content)

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a content element', async ({ page }) => {
    await searchAndEdit(page, CT.title)

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(CT.titleEdited)
    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(page, 'insert-question-text', CT.contentEdited, true)
    await saveElement(page)

    await validateElement(page, CT.titleEdited, [
      CT.contentEdited,
      CT.titleEdited,
      statusLabels.ready,
    ])
  })

  test('Check that edited content element is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, CT.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CT.titleEdited
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await verifyEditorField(page, 'insert-question-text', CT.contentEdited)

    await page.getByTestId('close-element-modal').click()
  })
})
