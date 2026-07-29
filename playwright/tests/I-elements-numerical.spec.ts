/**
 * I-elements-numerical.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/I-elements-numerical-workflow.cy.ts
 * Tests creation, persistence, editing, range solutions, and exact solutions
 * for Numerical (NR) element type.
 */

import { cleanupTest } from '../util/cleanup.js'
import { NR_DATA as NR } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  fillEditorField,
  fillNumericalFields,
  saveElement,
  searchAndEdit,
  setElementStatus,
  switchElementType,
  validateElement,
  verifyEditorField,
  verifyNumericalFields,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

test('CLEANUP', cleanupTest)

test.describe('Test creation and editing functionalities for Numerical elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a Numerical question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.numerical)
    await page.getByTestId('insert-question-title').fill(NR.title)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(page, 'insert-question-text', NR.content)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await fillNumericalFields(page, {
      min: String(NR.min),
      max: String(NR.max),
      unit: NR.unit,
      accuracy: String(NR.accuracy),
    })

    await saveElement(page)
    await validateElement(page, NR.title, [
      NR.content,
      NR.title,
      statusLabels.ready,
    ])

    // Verify bounds display
    await searchAndEdit(page, NR.title)
    await expect(page.getByTestId('input-numerical-minimum')).toContainText(
      `Min: ${NR.min}`
    )
    await expect(page.getByTestId('input-numerical-maximum')).toContainText(
      `Max: ${NR.max}`
    )
    await expect(page.getByTestId('input-numerical-accuracy')).toContainText(
      `Precision: ${NR.accuracy}`
    )
    await expect(page.getByTestId('input-numerical-unit')).toContainText(
      NR.unit
    )
    await page.getByTestId('close-element-modal').click()
  })

  test('Check that values of Numerical question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.title)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      NR.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await verifyEditorField(page, 'insert-question-text', NR.content)
    await verifyNumericalFields(page, {
      min: String(NR.min),
      max: String(NR.max),
      unit: NR.unit,
      accuracy: String(NR.accuracy),
    })

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a Numerical question and add a sample solution', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(NR.titleEdited)
    await fillEditorField(page, 'insert-question-text', NR.contentEdited, true)
    await fillNumericalFields(
      page,
      {
        min: String(NR.minEdited),
        max: String(NR.maxEdited),
        unit: NR.unitEdited,
        accuracy: String(NR.accuracyEdited),
      },
      true
    )
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Enable sample solution — type selection required
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await page.waitForTimeout(500)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select range solution type
    await page.getByTestId('set-solution-type-range').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Add solution ranges
    for (let ix = 0; ix < NR.solutionRanges.length; ix++) {
      const range = NR.solutionRanges[ix]
      await page.getByTestId('add-solution-range').click()
      if (range.min !== null) {
        await page.getByTestId(`set-solution-range-min-${ix}`).click()
        await page
          .getByTestId(`set-solution-range-min-${ix}`)
          .fill(String(range.min))
      }
      if (range.max !== null) {
        await page.getByTestId(`set-solution-range-max-${ix}`).click()
        await page
          .getByTestId(`set-solution-range-max-${ix}`)
          .fill(String(range.max))
      }
      await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    }

    // Test boundary validation for an extra range
    const newIx = NR.solutionRanges.length
    await page.getByTestId('add-solution-range').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId(`set-solution-range-min-${newIx}`).click()
    await page
      .getByTestId(`set-solution-range-min-${newIx}`)
      .fill(String(NR.minEdited - 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`set-solution-range-min-${newIx}`).click()
    await page.getByTestId(`set-solution-range-min-${newIx}`).clear()
    await page
      .getByTestId(`set-solution-range-min-${newIx}`)
      .fill(String(NR.minEdited))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId(`delete-solution-range-ix-${newIx}`).click()
    await page.getByTestId('add-solution-range').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId(`set-solution-range-max-${newIx}`).click()
    await page
      .getByTestId(`set-solution-range-max-${newIx}`)
      .fill(String(NR.maxEdited + 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`set-solution-range-max-${newIx}`).click()
    await page.getByTestId(`set-solution-range-max-${newIx}`).clear()
    await page
      .getByTestId(`set-solution-range-max-${newIx}`)
      .fill(String(NR.maxEdited))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId(`delete-solution-range-ix-${newIx}`).click()
    await saveElement(page)
    await validateElement(page, NR.titleEdited, [
      NR.contentEdited,
      NR.titleEdited,
    ])
  })

  test('Check that edited Numerical question is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      NR.titleEdited
    )
    await verifyEditorField(page, 'insert-question-text', NR.contentEdited)
    await verifyNumericalFields(page, {
      min: String(NR.minEdited),
      max: String(NR.maxEdited),
      unit: NR.unitEdited,
      accuracy: String(NR.accuracyEdited),
    })

    for (let ix = 0; ix < NR.solutionRanges.length; ix++) {
      const range = NR.solutionRanges[ix]
      if (range.min !== null)
        await expect(
          page.getByTestId(`set-solution-range-min-${ix}`)
        ).toHaveValue(String(range.min))
      if (range.max !== null)
        await expect(
          page.getByTestId(`set-solution-range-max-${ix}`)
        ).toHaveValue(String(range.max))
    }

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit the numerical question again and set an exact solution', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.titleEdited)

    await page.getByTestId('set-solution-type-exact').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (let ix = 0; ix < NR.exactSolutions.length; ix++) {
      await page.getByTestId('add-exact-solution').click()
      await page.getByTestId(`set-exact-solution-${ix}`).click()
      await page
        .getByTestId(`set-exact-solution-${ix}`)
        .fill(String(NR.exactSolutions[ix]))
      await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    }

    // Exact solutions outside restrictions are invalid
    const newIx = NR.exactSolutions.length
    await page.getByTestId('add-exact-solution').click()
    await page.getByTestId(`set-exact-solution-${newIx}`).click()
    await page
      .getByTestId(`set-exact-solution-${newIx}`)
      .fill(String(NR.minEdited - 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`delete-exact-solution-${newIx}`).click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('add-exact-solution').click()
    await page.getByTestId(`set-exact-solution-${newIx}`).click()
    await page
      .getByTestId(`set-exact-solution-${newIx}`)
      .fill(String(NR.maxEdited + 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`delete-exact-solution-${newIx}`).click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await saveElement(page)
  })

  test('Verify that the exact solutions of the numerical question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.titleEdited)

    for (let ix = 0; ix < NR.exactSolutions.length; ix++) {
      await expect(page.getByTestId(`set-exact-solution-${ix}`)).toHaveValue(
        String(NR.exactSolutions[ix])
      )
    }

    await page.getByTestId('close-element-modal').click()
  })
})
