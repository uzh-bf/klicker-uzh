/**
 * G-elements-mc.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/G-elements-mc-workflow.cy.ts
 * Tests creation, persistence, editing, sample solution, and answer feedbacks
 * for Multiple Choice (MC) element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { MC_DATA as MC } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  addAnswerChoices,
  deleteElement,
  fillAnswerField,
  fillEditorField,
  fillFeedbackField,
  saveElement,
  searchAndEdit,
  setElementStatus,
  switchElementType,
  validateElement,
  verifyAnswerAndFeedbackFields,
  verifyEditorField,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

test('CLEANUP', cleanupTest)

test.describe('Test creation and editing functionalities for Multiple Choice elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a multiple choice question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.multipleChoice)
    await page.getByTestId('insert-question-title').fill(MC.title)
    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(page, 'insert-question-text', MC.content)

    // Fill all 4 choices (first slot exists, add-new-answer for slots 1-3)
    await addAnswerChoices(page, MC.choices, 0)

    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Clearing an answer disables save
    await page.getByTestId('insert-answer-field-1').click()
    await page.getByTestId('insert-answer-field-1').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillAnswerField(page, 1, MC.choices[1])
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Test reordering
    await expect(page.getByTestId('move-answer-option-ix-0-up')).toBeDisabled()
    await expect(
      page.getByTestId('move-answer-option-ix-0-down')
    ).not.toBeDisabled()
    await page.getByTestId('move-answer-option-ix-0-down').click()
    await expect(page.getByTestId('insert-answer-field-0')).toContainText(
      MC.choices[1]
    )
    await expect(page.getByTestId('insert-answer-field-1')).toContainText(
      MC.choices[0]
    )
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('move-answer-option-ix-1-up').click()
    await expect(
      page.getByTestId('move-answer-option-ix-3-up')
    ).not.toBeDisabled()
    await expect(
      page.getByTestId('move-answer-option-ix-3-down')
    ).toBeDisabled()
    await expect(page.getByTestId('insert-answer-field-0')).toContainText(
      MC.choices[0]
    )
    await expect(page.getByTestId('insert-answer-field-1')).toContainText(
      MC.choices[1]
    )

    await saveElement(page)
    await validateElement(page, MC.title, [
      MC.content,
      MC.title,
      statusLabels.ready,
    ])

    // Verify answer option data-cy attributes
    await searchAndEdit(page, MC.title)
    await expect(page.getByTestId('mc-0-answer-option-0')).toBeVisible()
    await expect(page.getByTestId('mc-0-answer-option-1')).toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Check that values of multiple choice question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, MC.title)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      MC.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await verifyEditorField(page, 'insert-question-text', MC.content)
    await verifyAnswerAndFeedbackFields(page, MC.choices)

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a multiple choice question and add a sample solution', async ({
    page,
  }) => {
    await searchAndEdit(page, MC.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(MC.titleEdited)
    await fillEditorField(page, 'insert-question-text', MC.contentEdited, true)

    // Edit first 3 existing slots
    for (let i = 0; i < 3; i++) {
      await fillAnswerField(page, i, MC.choicesEdited[i], true)
    }

    // Delete slot 3, add slots 3–6
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('delete-answer-option-ix-3').click()
    await expect(page.getByTestId('insert-answer-field-3')).not.toBeAttached()
    await addAnswerChoices(page, MC.choicesEdited.slice(3), 3)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Sample solution — at least one correct answer required
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('set-correctness-0').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Deactivate and re-activate
    await page.getByTestId('set-correctness-0').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('set-correctness-0').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // MC allows multiple correct answers
    await page.getByTestId('set-correctness-2').click()
    await page.getByTestId('set-correctness-5').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await saveElement(page)
    await validateElement(page, MC.titleEdited, [
      MC.contentEdited,
      MC.titleEdited,
    ])
  })

  test('Edit the multiple choice question again and add answer feedbacks', async ({
    page,
  }) => {
    await searchAndEdit(page, MC.titleEdited)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('configure-answer-feedbacks').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (let ix = 0; ix < MC.choicesFeedbacks.length; ix++) {
      await expect(page.getByTestId('save-new-question')).toBeDisabled()
      await fillFeedbackField(page, ix, MC.choicesFeedbacks[ix])
    }
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Clear feedback 1 re-disables
    await page.getByTestId('insert-answer-feedback-1').click()
    await page.getByTestId('insert-answer-feedback-1').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, 1, MC.choicesFeedbacks[1])
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Move option 1 down: order becomes [0, 2, 1, ...]
    await page.getByTestId('move-answer-option-ix-1-down').click()
    await verifyAnswerAndFeedbackFields(
      page,
      [
        MC.choicesEdited[0],
        MC.choicesEdited[2],
        MC.choicesEdited[1],
        ...MC.choicesEdited.slice(3),
      ],
      [
        MC.choicesFeedbacks[0],
        MC.choicesFeedbacks[2],
        MC.choicesFeedbacks[1],
        ...MC.choicesFeedbacks.slice(3),
      ]
    )
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Move option 2 up: order back to [0, 1, 2, ...]
    await page.getByTestId('move-answer-option-ix-2-up').click()
    await verifyAnswerAndFeedbackFields(
      page,
      MC.choicesEdited,
      MC.choicesFeedbacks
    )

    await saveElement(page)
  })

  test('Check that edited multiple choice question is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, MC.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      MC.titleEdited
    )
    await verifyEditorField(page, 'insert-question-text', MC.contentEdited)
    await verifyAnswerAndFeedbackFields(
      page,
      MC.choicesEdited,
      MC.choicesFeedbacks
    )

    await page.getByTestId('close-element-modal').click()
  })

  test('Cleanup: Delete the multiple choice question', async ({ page }) => {
    await deleteElement(page, MC.titleEdited)
  })
})
