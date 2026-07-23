/**
 * H-elements-kprim.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/H-elements-kprim-workflow.cy.ts
 * Tests creation, persistence, editing, sample solution, and answer feedbacks
 * for KPRIM (KP) element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { KP_DATA as KP } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
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

test.describe('Test creation and editing functionalities for KPRIM elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a KPRIM question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.kprim)
    await page.getByTestId('insert-question-title').fill(KP.title)
    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(page, 'insert-question-text', KP.content)

    // Fill all 4 choices (blur editor before each add-new-answer)
    await fillAnswerField(page, 0, KP.choices[0])
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await fillAnswerField(page, 1, KP.choices[1])
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await fillAnswerField(page, 2, KP.choices[2])
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await fillAnswerField(page, 3, KP.choices[3])

    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Clearing option 2 disables save
    await page.getByTestId('insert-answer-field-2').click()
    await page.getByTestId('insert-answer-field-2').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillAnswerField(page, 2, KP.choices[2])
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Test reordering (mirrors cypress sequence)
    await expect(page.getByTestId('move-answer-option-ix-0-up')).toBeDisabled()
    await expect(
      page.getByTestId('move-answer-option-ix-0-down')
    ).not.toBeDisabled()
    await page.getByTestId('move-answer-option-ix-0-down').click()
    await verifyAnswerAndFeedbackFields(page, [
      KP.choices[1],
      KP.choices[0],
      KP.choices[2],
      KP.choices[3],
    ])

    await page.getByTestId('move-answer-option-ix-3-up').click()
    await expect(
      page.getByTestId('move-answer-option-ix-3-down')
    ).toBeDisabled()
    await verifyAnswerAndFeedbackFields(page, [
      KP.choices[1],
      KP.choices[0],
      KP.choices[3],
      KP.choices[2],
    ])

    await page.getByTestId('move-answer-option-ix-2-up').click()
    await verifyAnswerAndFeedbackFields(page, [
      KP.choices[1],
      KP.choices[3],
      KP.choices[0],
      KP.choices[2],
    ])

    await page.getByTestId('move-answer-option-ix-2-down').click()
    await verifyAnswerAndFeedbackFields(page, [
      KP.choices[1],
      KP.choices[3],
      KP.choices[2],
      KP.choices[0],
    ])

    await saveElement(page)
    await validateElement(page, KP.title, [
      KP.content,
      KP.title,
      statusLabels.ready,
    ])

    // Verify 4 answer options shown
    await searchAndEdit(page, KP.title)
    await expect(page.getByTestId('kp-answer-options')).toHaveCount(4)
    await page.getByTestId('close-element-modal').click()
  })

  test('Check that values of KPRIM question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, KP.title)

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.kprim
    )
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      KP.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await verifyEditorField(page, 'insert-question-text', KP.content)

    // After the moves above, saved order is [choices[1], choices[3], choices[2], choices[0]]
    await verifyAnswerAndFeedbackFields(page, [
      KP.choices[1],
      KP.choices[3],
      KP.choices[2],
      KP.choices[0],
    ])

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a KPRIM question and add a sample solution', async ({ page }) => {
    await searchAndEdit(page, KP.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(KP.titleEdited)
    await fillEditorField(page, 'insert-question-text', KP.contentEdited, true)

    // Edit first 3 existing slots
    for (let i = 0; i < 3; i++) {
      await fillAnswerField(page, i, KP.choicesEdited[i], true)
    }

    // Delete slot 3 and add a new one
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('delete-answer-option-ix-3').click()
    await expect(page.getByTestId('insert-answer-field-3')).not.toBeAttached()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await fillAnswerField(page, 3, KP.choicesEdited[3], true)

    // KPRIM is capped at 4 answers
    await expect(page.getByTestId('add-new-answer')).toBeDisabled()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // KPRIM: no correct solution required when sample solution is enabled
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('set-correctness-0').click()
    await page.getByTestId('set-correctness-2').click()
    await page.getByTestId('set-correctness-3').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await saveElement(page)
    await validateElement(page, KP.titleEdited, [
      KP.contentEdited,
      KP.titleEdited,
    ])
  })

  test('Check that edited KPRIM question is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, KP.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      KP.titleEdited
    )
    await verifyEditorField(page, 'insert-question-text', KP.contentEdited)
    await verifyAnswerAndFeedbackFields(page, KP.choicesEdited)

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit the KPRIM question again and add answer feedbacks', async ({
    page,
  }) => {
    await searchAndEdit(page, KP.titleEdited)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('configure-answer-feedbacks').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (let ix = 0; ix < KP.choicesFeedbacks.length; ix++) {
      await expect(page.getByTestId('save-new-question')).toBeDisabled()
      await fillFeedbackField(page, ix, KP.choicesFeedbacks[ix])
    }
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Clearing feedbacks re-disables
    await page.getByTestId('insert-answer-feedback-1').click()
    await page.getByTestId('insert-answer-feedback-1').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('insert-answer-feedback-0').click()
    await page.getByTestId('insert-answer-feedback-0').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, 0, KP.choicesFeedbacks[0])
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, 1, KP.choicesFeedbacks[1])
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Verify initial order then reorder
    await verifyAnswerAndFeedbackFields(
      page,
      KP.choicesEdited,
      KP.choicesFeedbacks
    )
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Move option 1 down: order [0, 2, 1, 3]
    await page.getByTestId('move-answer-option-ix-1-down').click()
    await verifyAnswerAndFeedbackFields(
      page,
      [
        KP.choicesEdited[0],
        KP.choicesEdited[2],
        KP.choicesEdited[1],
        KP.choicesEdited[3],
      ],
      [
        KP.choicesFeedbacks[0],
        KP.choicesFeedbacks[2],
        KP.choicesFeedbacks[1],
        KP.choicesFeedbacks[3],
      ]
    )
    await page.getByTestId('insert-question-title').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Move option 2 up: order back to [0, 1, 2, 3]
    await page.getByTestId('move-answer-option-ix-2-up').click()
    await verifyAnswerAndFeedbackFields(
      page,
      KP.choicesEdited,
      KP.choicesFeedbacks
    )

    await saveElement(page)
  })
})
