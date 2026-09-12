/**
 * E-elements-flashcards.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/E-elements-flashcards-workflow.cy.ts
 * Tests creation, persistence, and editing of Flashcard element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { FLASHCARD_DATA as FC } from '../util/constants.js'
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

test.describe('Test creation and editing functionalities for Flashcard elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a flashcard element', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.flashcard)
    await page.getByTestId('insert-question-title').fill(FC.title)
    await setElementStatus(page, statusLabels.review)
    await fillEditorField(page, 'insert-question-text', FC.content)
    await fillEditorField(page, 'insert-question-explanation', FC.explanation)
    await saveElement(page)

    await validateElement(page, FC.title, [
      FC.content,
      FC.title,
      statusLabels.review,
    ])
  })

  test('Check that values of flashcard element are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, FC.title)

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.flashcard
    )
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      FC.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.review
    )
    await verifyEditorField(page, 'insert-question-text', FC.content)
    await verifyEditorField(page, 'insert-question-explanation', FC.explanation)

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a flashcard element', async ({ page }) => {
    await searchAndEdit(page, FC.title)

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(FC.titleEdited)
    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(page, 'insert-question-text', FC.contentEdited, true)
    await fillEditorField(
      page,
      'insert-question-explanation',
      FC.explanationEdited,
      true
    )
    await saveElement(page)

    await validateElement(page, FC.titleEdited, [
      FC.contentEdited,
      FC.titleEdited,
      statusLabels.ready,
    ])
  })

  test('Check that edited flashcard element is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, FC.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      FC.titleEdited
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await verifyEditorField(page, 'insert-question-text', FC.contentEdited)
    await verifyEditorField(
      page,
      'insert-question-explanation',
      FC.explanationEdited
    )

    await page.getByTestId('close-element-modal').click()
  })
})
