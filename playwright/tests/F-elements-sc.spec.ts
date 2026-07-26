/**
 * F-elements-sc.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/F-elements-sc-workflow.cy.ts
 * Tests creation, persistence, editing, sample solution, and answer feedbacks
 * for Single Choice (SC) element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { SC_DATA as SC } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  fillAnswerField,
  fillEditorField,
  fillFeedbackField,
  saveElement,
  searchAndEdit,
  validateElement,
  verifyAnswerAndFeedbackFields,
  verifyEditorField,
} from '../util/fixtures/elements.js'
import { statusLabels } from '../util/messages.js'

test('CLEANUP', cleanupTest)

test.describe('Test creation and editing functionalities for Single Choice elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a single choice question', async ({ page }) => {
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(SC.title)

    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(`select-question-status-${statusLabels.ready}`)
      .click()

    await fillEditorField(page, 'insert-question-text', SC.content)

    // Save should be disabled with no answer options yet
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await fillAnswerField(page, 0, SC.choices[0])
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)

    // Adding blank answer should disable save
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await fillAnswerField(page, 1, SC.choices[1])

    // Remove editor focus
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Clearing answer option 1 should re-disable save
    await fillAnswerField(page, 1, '', true)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await fillAnswerField(page, 1, SC.choices[1])
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Test moving answer options
    await expect(page.getByTestId('move-answer-option-ix-0-up')).toBeDisabled()
    await expect(
      page.getByTestId('move-answer-option-ix-0-down')
    ).not.toBeDisabled()
    await page.getByTestId('move-answer-option-ix-0-down').click()
    await expect(page.getByTestId('insert-answer-field-0')).toContainText(
      SC.choices[1]
    )
    await expect(page.getByTestId('insert-answer-field-1')).toContainText(
      SC.choices[0]
    )

    await page.getByTestId('move-answer-option-ix-1-up').click()
    await expect(
      page.getByTestId('move-answer-option-ix-1-down')
    ).toBeDisabled()
    await expect(page.getByTestId('insert-answer-field-0')).toContainText(
      SC.choices[0]
    )
    await expect(page.getByTestId('insert-answer-field-1')).toContainText(
      SC.choices[1]
    )

    await saveElement(page)
    await validateElement(page, SC.title, [
      SC.content,
      SC.title,
      statusLabels.ready,
    ])
  })

  test('Check that values of single choice question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, SC.title)

    await expect(page.getByTestId('sc-0-answer-option-0')).toBeVisible()
    await expect(page.getByTestId('sc-0-answer-option-1')).toBeVisible()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SC.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )

    await verifyEditorField(page, 'insert-question-text', SC.content)
    await verifyAnswerAndFeedbackFields(page, SC.choices)

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a single choice question and add a sample solution', async ({
    page,
  }) => {
    await searchAndEdit(page, SC.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(SC.titleEdited)
    await fillEditorField(page, 'insert-question-text', SC.contentEdited, true)

    await fillAnswerField(page, 0, SC.choicesEdited[0], true)
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('delete-answer-option-ix-1').click()
    await expect(page.getByTestId('insert-answer-field-1')).not.toBeAttached()

    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await fillAnswerField(page, 1, SC.choicesEdited[1], true)

    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await fillAnswerField(page, 2, SC.choicesEdited[2], true)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Add sample solution — at least one correct answer required
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('set-correctness-0').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Deactivate and re-activate
    await page.getByTestId('set-correctness-0').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('set-correctness-0').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Only one correct answer allowed for SC
    await page.getByTestId('set-correctness-2').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('set-correctness-2').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await saveElement(page)
    await validateElement(page, SC.titleEdited, [
      SC.contentEdited,
      SC.titleEdited,
    ])
  })

  test('Edit the single choice question again and add answer feedbacks', async ({
    page,
  }) => {
    await searchAndEdit(page, SC.titleEdited)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Enable answer feedbacks — all options require feedbacks
    await page.getByTestId('configure-answer-feedbacks').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (let ix = 0; ix < SC.choicesFeedbacks.length; ix++) {
      await expect(page.getByTestId('save-new-question')).toBeDisabled()
      await fillFeedbackField(page, ix, SC.choicesFeedbacks[ix])
    }
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Clearing feedbacks re-disables save
    await fillFeedbackField(page, 1, '', true)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, 0, '', true)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, 0, SC.choicesFeedbacks[0])
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, 1, SC.choicesFeedbacks[1])
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Verify reordering also reorders feedbacks (initial order)
    await verifyAnswerAndFeedbackFields(
      page,
      SC.choicesEdited,
      SC.choicesFeedbacks
    )
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Move option 1 down: order becomes [0, 2, 1]
    await page.getByTestId('move-answer-option-ix-1-down').click()
    await verifyAnswerAndFeedbackFields(
      page,
      [SC.choicesEdited[0], SC.choicesEdited[2], SC.choicesEdited[1]],
      [SC.choicesFeedbacks[0], SC.choicesFeedbacks[2], SC.choicesFeedbacks[1]]
    )

    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Move option 2 up: order back to [0, 1, 2]
    await page.getByTestId('move-answer-option-ix-2-up').click()
    await verifyAnswerAndFeedbackFields(
      page,
      SC.choicesEdited,
      SC.choicesFeedbacks
    )

    await saveElement(page)
  })

  test('Check that edited single choice question is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, SC.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SC.titleEdited
    )
    await verifyEditorField(page, 'insert-question-text', SC.contentEdited)
    await verifyAnswerAndFeedbackFields(
      page,
      SC.choicesEdited,
      SC.choicesFeedbacks
    )

    await page.getByTestId('close-element-modal').click()
  })
})
