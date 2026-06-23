/**
 * J-elements-free-text.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/J-elements-free-text-workflow.cy.ts
 * Tests creation, persistence, editing, and sample solution
 * for Free Text (FT) element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  fillEditorField,
  searchAndEdit,
  setElementStatus,
  switchElementType,
  validateElement,
  verifyEditorField,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

// Fixture data (mirrors cypress/cypress/fixtures/DM-questions.json FT section)
const FT = {
  title: 'Free Text Question Title',
  content: 'Free Text Question Text',
  maxLength: 100,
  titleEdited: 'Free Text Question Title Edited',
  contentEdited: 'Free Text Question Text Edited',
  maxLengthEdited: 300,
  sampleSolution: [
    'Sample Solution 1',
    'Sample Solution 2',
    'Sample Solution 3',
  ],
}

test('CLEANUP', cleanupTest)

test.describe('Test creation and editing functionalities for Free Text elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  test('Create a Free Text question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    // Switch type to Free Text
    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.freeText)

    await page.getByTestId('insert-question-title').fill(FT.title)

    await setElementStatus(page, statusLabels.ready)

    await fillEditorField(page, 'insert-question-text', FT.content)

    await page.getByTestId('set-free-text-length').click()
    await page.getByTestId('set-free-text-length').fill(String(FT.maxLength))

    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    await validateElement(page, FT.title, [
      FT.content,
      FT.title,
      statusLabels.ready,
    ])

    // Verify free text input is shown
    await searchAndEdit(page, FT.title)
    await expect(page.getByTestId('free-text-input-0')).toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Check persistence
  // -------------------------------------------------------------------------
  test('Check that values of Free Text question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, FT.title)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      FT.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )

    await verifyEditorField(page, 'insert-question-text', FT.content)

    await expect(page.getByTestId('set-free-text-length')).toHaveValue(
      String(FT.maxLength)
    )

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Edit + sample solution
  // -------------------------------------------------------------------------
  test('Edit a Free Text question', async ({ page }) => {
    await searchAndEdit(page, FT.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(FT.titleEdited)

    await fillEditorField(page, 'insert-question-text', FT.contentEdited, true)

    await page.getByTestId('set-free-text-length').click()
    await page.getByTestId('set-free-text-length').clear()
    await page
      .getByTestId('set-free-text-length')
      .fill(String(FT.maxLengthEdited))

    // Enable sample solution - at least one correct answer required
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (let ix = 0; ix < FT.sampleSolution.length; ix++) {
      await page.getByTestId('add-solution-value').click()
      await page.getByTestId(`set-solution-ix-${ix}`).click()
      await page
        .getByTestId(`set-solution-ix-${ix}`)
        .fill(FT.sampleSolution[ix])
      await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    }

    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(1000)

    await validateElement(page, FT.titleEdited, [
      FT.contentEdited,
      FT.titleEdited,
    ])
  })

  // -------------------------------------------------------------------------
  // Check persistence after edit
  // -------------------------------------------------------------------------
  test('Check that edited Free Text question is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, FT.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      FT.titleEdited
    )
    await verifyEditorField(page, 'insert-question-text', FT.contentEdited)

    await expect(page.getByTestId('set-free-text-length')).toHaveValue(
      String(FT.maxLengthEdited)
    )

    for (let ix = 0; ix < FT.sampleSolution.length; ix++) {
      await expect(page.getByTestId(`set-solution-ix-${ix}`)).toHaveValue(
        FT.sampleSolution[ix]
      )
    }

    await page.getByTestId('close-element-modal').click()
  })
})
