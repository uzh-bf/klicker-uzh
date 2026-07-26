/**
 * K-elements-selection.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/K-elements-selection-workflow.cy.ts
 * Tests creation, persistence, editing, sample solution, and answer collection
 * interactions for Selection (SE) element type.
 *
 * Note: Answer collections are created through the UI rather than cy.task()
 * since Playwright does not have the Cypress task mechanism.
 */

import { Page } from '@playwright/test'
import { openAnswerCollectionOptions } from '../util/actions.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  deleteElement,
  fillEditorField,
  searchAndEdit,
  validateElement,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

// Fixture data (mirrors cypress/cypress/fixtures/DM-questions.json SE section)
const SE = {
  title: 'Selection Question Title',
  content: 'Selection Question Text',
  explanation: 'Selection Question Explanation',
  inputs: 2,
  collection: 'City Collection',
  collectionDescription: 'This is a collection of cities',
  solutions: ['London', 'Paris'],
  solutionsNotChosen: ['Tokyo', 'Berlin', 'Rome', 'Madrid'],
  titleEdited: 'Selection Question Title Edited',
  contentEdited: 'Selection Question Text Edited',
  explanationEdited: 'Selection Question Explanation Edited',
  inputsEdited: 1,
  collectionEdited: 'Meal Collection',
  collectionDescriptionEdited: 'This is a collection of meals',
  solutionsEdited: ['Curry', 'Pizza', 'Sushi'],
  solutionsNotChosenEdited: ['Burger', 'Pasta', 'Salad', 'Soup'],
}

const SE_INLINE = {
  title: 'Selection Inline Title',
  content: 'Selection Inline Text',
  explanation: 'Selection Inline Explanation',
  inputs: 2,
  collection: `AC: Selection Inline Title`,
  items: ['Alpha', 'Beta', 'Gamma', 'Delta'],
  solutions: ['Alpha', 'Beta'],
  titleEdited: 'Selection Inline Title Edited',
  contentEdited: 'Selection Inline Text Edited',
  explanationEdited: 'Selection Inline Explanation Edited',
  inputsEdited: 1,
}

const MSG_SELECT_COLLECTION = 'Select collection'
const MSG_ANSWER_OPTION_USED = 'Answer options marked with the warning symbol'

test('CLEANUP', cleanupTest)

async function createAnswerCollectionViaUI(
  page: Page,
  name: string,
  description: string,
  entries: string[]
) {
  await page.locator('[data-cy="create-answer-collection"]').click()
  await page.getByTestId('answer-collection-name').waitFor({ state: 'visible' })
  await page.getByTestId('answer-collection-name').fill(name)

  const descEditor = page.locator('[data-cy="answer-collection-description"]')
  await descEditor.click()
  await descEditor.pressSequentially(description)

  // The form starts with 2 empty entry slots; fill/add as needed
  for (let i = 0; i < entries.length; i++) {
    if (i >= 2) {
      await page.locator('[data-cy="add-response-entry"]').click()
    }
    await page.getByTestId(`response-entry-${i}`).fill(entries[i])
  }

  await page.locator('[data-cy="submit-create-answer-collection"]').click()
  await expect(
    page.locator(`[data-cy="answer-collection-${name}"]`)
  ).toBeVisible()
}

test.describe('Test creation and editing functionalities for Selection elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  // -------------------------------------------------------------------------
  // Create answer collections needed for tests
  // -------------------------------------------------------------------------
  test('Create the answer collections that will be used for the selection question tests', async ({
    page,
  }) => {
    await expect(page.getByTestId('resources')).toBeVisible()
    await expect(page.getByTestId('analytics')).toBeVisible()

    // Navigate to answer collections
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()

    // Create City Collection
    await createAnswerCollectionViaUI(
      page,
      SE.collection,
      SE.collectionDescription,
      [...SE.solutions, ...SE.solutionsNotChosen]
    )

    // Create Meal Collection
    await createAnswerCollectionViaUI(
      page,
      SE.collectionEdited,
      SE.collectionDescriptionEdited,
      [...SE.solutionsEdited, ...SE.solutionsNotChosenEdited]
    )
  })

  // -------------------------------------------------------------------------
  // Create Selection question
  // -------------------------------------------------------------------------
  test('Create a Selection question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(`select-question-type-${elementTypeLabels.selection}`)
      .click()
    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.selection
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('insert-question-title').fill(SE.title)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(`select-question-status-${statusLabels.ready}`)
      .click()

    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(SE.content)
    await page.getByTestId('insert-question-explanation').click()
    await page
      .getByTestId('insert-question-explanation')
      .pressSequentially(SE.explanation)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select an answer collection
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      MSG_SELECT_COLLECTION
    )
    await page.getByTestId('select-answer-collection').click()
    await page.getByTestId(`select-answer-collection-${SE.collection}`).click()
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      SE.collection
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Configure number of inputs
    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').fill(String(SE.inputs))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Test max restriction: num options - 1
    const maxAllowed = SE.solutions.length + SE.solutionsNotChosen.length - 1
    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page
      .getByTestId('configure-number-of-inputs')
      .fill(String(maxAllowed + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page
      .getByTestId('configure-number-of-inputs')
      .fill(String(maxAllowed))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page.getByTestId('configure-number-of-inputs').fill(String(SE.inputs))

    // Sample solution toggle
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('configure-sample-solution').click()

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await validateElement(page, SE.title, [
      SE.content,
      SE.title,
      statusLabels.ready,
    ])
  })

  // -------------------------------------------------------------------------
  // Verify persistence
  // -------------------------------------------------------------------------
  test('Verify that the correct content has been saved', async ({ page }) => {
    await searchAndEdit(page, SE.title)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SE.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      SE.content
    )
    await page.getByTestId('insert-question-explanation').click()
    await expect(page.getByTestId('insert-question-explanation')).toContainText(
      SE.explanation
    )
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      SE.collection
    )
    await expect(page.getByTestId('configure-number-of-inputs')).toHaveValue(
      String(SE.inputs)
    )

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify preview inputs and options
  // -------------------------------------------------------------------------
  test('Verify that creation was successful and that preview is visible and correct', async ({
    page,
  }) => {
    await searchAndEdit(page, SE.title)

    // Check that selection input fields are available
    for (let i = 1; i < SE.inputs; i++) {
      await expect(page.locator(`#selection-0-field-${i}`)).toBeVisible()
    }

    // Check all options are available
    await page.locator('#selection-0-field-0').click()
    for (const value of [...SE.solutions, ...SE.solutionsNotChosen]) {
      await expect(page.getByText(value)).toBeVisible()
    }

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify answer collection options are all editable
  // -------------------------------------------------------------------------
  test('Verify that all options of the answer collection can be edited', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${SE.collection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...SE.solutions, ...SE.solutionsNotChosen]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }

    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  // -------------------------------------------------------------------------
  // Add sample solution
  // -------------------------------------------------------------------------
  test('Add a sample solution to the created selection question', async ({
    page,
  }) => {
    await searchAndEdit(page, SE.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SE.title
    )

    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select first solution
    await page.getByTestId('choose-correct-answer-options').click()
    await page.getByText(SE.solutions[0]).click()
    await expect(
      page.getByTestId('choose-correct-answer-options')
    ).toContainText(SE.solutions[0])
    await expect(page.getByTestId('save-new-question')).toBeDisabled() // needs >= inputs solutions

    // Select remaining solutions
    for (const solution of SE.solutions.slice(1)) {
      await page.getByTestId('choose-correct-answer-options').click()
      await page.getByText(solution).click()
      await expect(
        page.getByTestId('choose-correct-answer-options')
      ).toContainText(solution)
    }

    await page.getByTestId('save-new-question').click()
  })

  // -------------------------------------------------------------------------
  // Verify sample solution persistence
  // -------------------------------------------------------------------------
  test('Verify that the sample solution has been stored correctly for the modified selection question', async ({
    page,
  }) => {
    await searchAndEdit(page, SE.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SE.title
    )

    for (const solution of SE.solutions) {
      await expect(
        page.getByTestId('choose-correct-answer-options')
      ).toContainText(solution)
    }

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify solution options can no longer be deleted from collection
  // -------------------------------------------------------------------------
  test('Verify that the options that are used as a solution cannot be deleted anymore', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${SE.collection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    await expect(
      page.getByText(MSG_ANSWER_OPTION_USED, { exact: false })
    ).toBeVisible()

    for (const sol of SE.solutions) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    for (const sol of SE.solutionsNotChosen) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }

    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify the answer collection itself cannot be deleted
  // -------------------------------------------------------------------------
  test('Verify that the answer collection cannot be deleted anymore', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${SE.collection}`).click()
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  // -------------------------------------------------------------------------
  // Edit question + change collection
  // -------------------------------------------------------------------------
  test('Edit the selection question and change the answer collection (including new sample solutions)', async ({
    page,
  }) => {
    await searchAndEdit(page, SE.title)

    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(SE.titleEdited)
    await fillEditorField(page, 'insert-question-text', SE.contentEdited, true)
    await fillEditorField(
      page,
      'insert-question-explanation',
      SE.explanationEdited,
      true
    )

    // Switch collection
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${SE.collectionEdited}`)
      .click()
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      SE.collectionEdited
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled() // answer options cleared

    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page
      .getByTestId('configure-number-of-inputs')
      .fill(String(SE.inputsEdited))

    for (const solution of SE.solutionsEdited) {
      await page.getByTestId('choose-correct-answer-options').click()
      await page.getByText(solution).click()
    }

    await page.getByTestId('save-new-question').click()
  })

  // -------------------------------------------------------------------------
  // Verify edited question persistence
  // -------------------------------------------------------------------------
  test('Verify that the edited state of the selection question persists', async ({
    page,
  }) => {
    await searchAndEdit(page, SE.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SE.titleEdited
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      SE.contentEdited
    )
    await page.getByTestId('insert-question-explanation').click()
    await expect(page.getByTestId('insert-question-explanation')).toContainText(
      SE.explanationEdited
    )
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      SE.collectionEdited
    )
    await expect(page.getByTestId('configure-number-of-inputs')).toHaveValue(
      String(SE.inputsEdited)
    )

    for (const solution of SE.solutionsEdited) {
      await expect(
        page.getByTestId('choose-correct-answer-options')
      ).toContainText(solution)
    }

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify previous collection can be deleted, current cannot
  // -------------------------------------------------------------------------
  test('Verify that the previous answer collection could be deleted again, the current one not', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    await page.getByTestId(`answer-collection-actions-${SE.collection}`).click()
    await expect(
      page.getByTestId('delete-answer-collection')
    ).not.toHaveAttribute('data-disabled')
    await page.getByTestId('edit-answer-collection').click()
    await page.getByTestId('close-answer-collection-edit-modal').click()

    await page
      .getByTestId(`answer-collection-actions-${SE.collectionEdited}`)
      .click()
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  // -------------------------------------------------------------------------
  // Check which options can be deleted per collection
  // -------------------------------------------------------------------------
  test('Check that only answer options not used as solutions can be deleted', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    // City collection: solutions are no longer in use → all deletable
    await page.getByTestId(`answer-collection-actions-${SE.collection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...SE.solutions, ...SE.solutionsNotChosen]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()

    // Meal collection: solutionsEdited are in use → not deletable
    await page
      .getByTestId(`answer-collection-actions-${SE.collectionEdited}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of SE.solutionsEdited) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    for (const sol of SE.solutionsNotChosenEdited) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  // -------------------------------------------------------------------------
  // Delete question → verify all options become deletable
  // -------------------------------------------------------------------------
  test('Verify that after the deletion of the linked questions, all solution options can be deleted again', async ({
    page,
  }) => {
    await deleteElement(page, SE.titleEdited)

    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    // City collection
    await page.getByTestId(`answer-collection-actions-${SE.collection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...SE.solutions, ...SE.solutionsNotChosen]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()

    // Meal collection
    await page
      .getByTestId(`answer-collection-actions-${SE.collectionEdited}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...SE.solutionsEdited, ...SE.solutionsNotChosenEdited]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  // =========================================================================
  // Inline answer collection creation
  // =========================================================================

  test('Create a selection question with inline answer collection', async ({
    page,
  }) => {
    await page.getByTestId('create-question').click()

    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(`select-question-type-${elementTypeLabels.selection}`)
      .click()
    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.selection
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('insert-question-title').fill(SE_INLINE.title)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(`select-question-status-${statusLabels.ready}`)
      .click()

    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SE_INLINE.content)
    await page.getByTestId('insert-question-explanation').click()
    await page
      .getByTestId('insert-question-explanation')
      .pressSequentially(SE_INLINE.explanation)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Use inline collection creation
    await expect(
      page.getByTestId('create-inline-answer-collection')
    ).toBeVisible()
    await page.getByTestId('create-inline-answer-collection').click()
    await expect(
      page.locator('#inline-answer-collection-options input')
    ).toBeVisible()

    for (const item of SE_INLINE.items) {
      await page.locator('#inline-answer-collection-options input').fill(item)
      await page
        .locator('#inline-answer-collection-options input')
        .press('Enter')
    }
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Configure number of inputs
    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page
      .getByTestId('configure-number-of-inputs')
      .fill(String(SE_INLINE.inputs))

    // Add sample solution
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (const solution of SE_INLINE.solutions) {
      await page.getByTestId('choose-correct-answer-options').click()
      await page
        .getByTestId('choose-correct-answer-options')
        .pressSequentially(`${solution}`)
      await page.keyboard.press('Enter')
    }
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Add extra item, select as correct answer, then remove it
    const additionalItem = 'Additional Selection Item'
    await page
      .locator('#inline-answer-collection-options input')
      .fill(additionalItem)
    await page.locator('#inline-answer-collection-options input').press('Enter')
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await expect(
      page.locator('#inline-answer-collection-options')
    ).toContainText(additionalItem)

    await page.getByTestId('choose-correct-answer-options').click()
    await page
      .getByTestId('choose-correct-answer-options')
      .pressSequentially(additionalItem)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await expect(
      page.getByTestId('choose-correct-answer-options')
    ).toContainText(additionalItem)

    // Remove the additional item → should also remove it from answers
    await page
      .locator('#inline-answer-collection-options input')
      .press('Backspace')
    await expect(
      page.getByTestId('choose-correct-answer-options')
    ).not.toContainText(additionalItem)

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await validateElement(page, SE_INLINE.title, [
      SE_INLINE.content,
      SE_INLINE.title,
    ])
  })

  test('Verify that a new answer collection was created when creating the selection question', async ({
    page,
  }) => {
    await expect(page.getByTestId('analytics')).toBeVisible()
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    await page
      .getByTestId(`answer-collection-actions-${SE_INLINE.collection}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)

    for (const sol of SE_INLINE.items) {
      const isCorrect = SE_INLINE.solutions.includes(sol)
      if (isCorrect) {
        await expect(
          page.getByTestId(`delete-answer-option-${sol}`)
        ).toBeDisabled()
      } else {
        await expect(
          page.getByTestId(`delete-answer-option-${sol}`)
        ).not.toBeDisabled()
      }
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }

    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  test('Edit the inline created selection question', async ({ page }) => {
    await searchAndEdit(page, SE_INLINE.title)

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(SE_INLINE.titleEdited)
    await fillEditorField(
      page,
      'insert-question-text',
      SE_INLINE.contentEdited,
      true
    )
    await fillEditorField(
      page,
      'insert-question-explanation',
      SE_INLINE.explanationEdited,
      true
    )

    // Creating inline collection is not available during edit
    await expect(
      page.getByTestId('create-inline-answer-collection')
    ).not.toBeVisible()

    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page
      .getByTestId('configure-number-of-inputs')
      .fill(String(SE_INLINE.inputsEdited))

    // Verify correct answers contain only selected options
    for (const solution of SE_INLINE.solutions) {
      await expect(
        page.getByTestId('choose-correct-answer-options')
      ).toContainText(solution)
    }
    for (const item of SE_INLINE.items.filter(
      (i) => !SE_INLINE.solutions.includes(i)
    )) {
      await expect(
        page.getByTestId('choose-correct-answer-options')
      ).not.toContainText(item)
    }

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await validateElement(page, SE_INLINE.titleEdited, [
      SE_INLINE.contentEdited,
      SE_INLINE.titleEdited,
    ])
  })

  test('Delete the inline created selection question', async ({ page }) => {
    await deleteElement(page, SE_INLINE.titleEdited)

    // After deletion, collection options should all be deletable
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page
      .getByTestId(`answer-collection-actions-${SE_INLINE.collection}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)

    for (const sol of SE_INLINE.items) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()

    await page
      .getByTestId(`answer-collection-actions-${SE_INLINE.collection}`)
      .click()
    await expect(
      page.getByTestId('delete-answer-collection')
    ).not.toHaveAttribute('data-disabled')
  })
})
