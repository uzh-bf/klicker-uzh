/**
 * L-elements-case-study.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/L-elements-case-study-workflow.cy.ts
 * Tests creation, persistence, editing, sample solutions, and validation logic
 * for Case Study (CS) element type.
 *
 * Note: Answer collections are created through the UI since Playwright does not
 * have the cy.task() mechanism used by Cypress.
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

// ─── Type helpers ────────────────────────────────────────────────────────────

type RangeCriterion = {
  mode: 'range'
  name: string
  min: number
  max: number
  step: number
  unit?: string
}

type StepsCriterion = {
  mode: 'steps'
  name: string
  steps: number
  labels: { min: string; mid?: string; max: string }
}

type CriterionData = RangeCriterion | StepsCriterion

type SolutionEntry = { lower: number; upper: number }
type SolutionMap = Record<string, Record<string, Record<string, SolutionEntry>>>

// ─── Fixture data ─────────────────────────────────────────────────────────────

const CS = {
  title: 'Case Study Question Title',
  content: 'Case Study Question Text',
  explanation: 'Case Study Question Explanation',
  collection: 'Country Collection',
  collectionDescription: 'This is a collection of countries',
  items: ['Germany', 'France', 'Italy', 'Spain'],
  unselectedItems: ['USA', 'UK', 'Japan', 'China'],
  criteria: [
    {
      mode: 'range',
      name: 'Population',
      min: 1000000,
      max: 10000000,
      step: 1000,
    },
    {
      mode: 'range',
      name: 'Area',
      min: 100,
      max: 5000,
      step: 10,
      unit: 'km^2',
    },
  ] as CriterionData[],
  removedCriterion: {
    mode: 'steps',
    name: 'Closeness to Europe',
    steps: 5,
    labels: { min: 'Close', mid: 'Medium', max: 'Far' },
  } as StepsCriterion,
  cases: [
    { title: 'Case 1', description: 'Case 1 Description - Data from 1800' },
    { title: 'Case 2', description: 'Case 2 Description - Data from 2000' },
  ],
  removedCase: { title: 'Case 3', description: 'Case 3 Description' },
  solutionsWithAdditionalCriterion: {
    0: {
      0: {
        0: { lower: 3000000, upper: 4000000 },
        1: { lower: 1000, upper: 2000 },
        2: { lower: 1, upper: 2 },
      },
      1: {
        0: { lower: 5000000, upper: 6000000 },
        1: { lower: 2000, upper: 3000 },
        2: { lower: 2, upper: 3 },
      },
      2: {
        0: { lower: 7000000, upper: 8000000 },
        1: { lower: 3000, upper: 4000 },
        2: { lower: 3, upper: 3 },
      },
      3: {
        0: { lower: 9000000, upper: 10000000 },
        1: { lower: 4000, upper: 5000 },
        2: { lower: 4, upper: 5 },
      },
    },
    1: {
      0: {
        0: { lower: 2000000, upper: 3000000 },
        1: { lower: 500, upper: 1500 },
        2: { lower: 1, upper: 1 },
      },
      1: {
        0: { lower: 4000000, upper: 5000000 },
        1: { lower: 1500, upper: 2500 },
        2: { lower: 2, upper: 2 },
      },
      2: {
        0: { lower: 6000000, upper: 7000000 },
        1: { lower: 2500, upper: 3500 },
        2: { lower: 3, upper: 4 },
      },
      3: {
        0: { lower: 8000000, upper: 9000000 },
        1: { lower: 3500, upper: 4500 },
        2: { lower: 4, upper: 5 },
      },
    },
  } as Record<number, Record<number, Record<number, SolutionEntry>>>,
  solutions: {
    1: { 3: { 0: { lower: 8000000, upper: 9000000 } } },
  } as Record<number, Record<number, Record<number, SolutionEntry>>>,
  titleEdited: 'Case Study Question Title Edited',
  contentEdited: 'Case Study Question Text Edited',
  collectionEdited: 'Continent Collection',
  collectionDescriptionEdited: 'This is a collection of continents',
  itemsEdited: ['Europe', 'Asia'],
  unselectedItemsEdited: [
    'Africa',
    'North America',
    'Oceania',
    'Antarctica',
    'South America',
  ],
  criteriaEdited: [
    {
      mode: 'range',
      name: 'GDP per capita',
      min: 20000,
      max: 100000,
      step: 1000,
      unit: 'USD',
    },
    { mode: 'range', name: 'Life expectancy', min: 40, max: 90, step: 1 },
  ] as CriterionData[],
  casesEdited: [
    {
      title: 'Case 1 Edited',
      description: 'Case 1 Description - Data from 1900',
    },
    {
      title: 'Case 2 Edited',
      description: 'Case 2 Description - Predicted data for 2100',
    },
  ],
  solutionsEdited: {
    0: {
      0: { 0: { lower: 30000, upper: 40000 }, 1: { lower: 50, upper: 60 } },
      1: { 0: { lower: 50000, upper: 60000 }, 1: { lower: 60, upper: 70 } },
    },
    1: {
      0: { 0: { lower: 40000, upper: 50000 }, 1: { lower: 60, upper: 70 } },
      1: { 0: { lower: 60000, upper: 70000 }, 1: { lower: 70, upper: 80 } },
    },
  } as Record<number, Record<number, Record<number, SolutionEntry>>>,
}

const CS_INLINE = {
  title: 'Inline Case Study Question Title',
  content: 'Inline Case Study Question Text',
  explanation: 'Inline Case Study Question Explanation',
  items: ['Apple', 'Samsung', 'Google', 'Huawei'],
  criteria: [
    {
      mode: 'range',
      name: 'Market Share',
      min: 0,
      max: 100,
      step: 5,
      unit: '%',
    },
    {
      mode: 'steps',
      name: 'Product Quality',
      steps: 5,
      labels: { min: 'Low', mid: 'Medium', max: 'High' },
    },
  ] as CriterionData[],
  cases: [
    { title: 'Case A: 2020', description: 'Market data from 2020' },
    { title: 'Case B: 2023', description: 'Market data from 2023' },
  ],
  solutions: {
    0: {
      0: { 0: { lower: 10, upper: 20 }, 1: { lower: 3, upper: 4 } },
      1: { 0: { lower: 25, upper: 30 }, 1: { lower: 4, upper: 5 } },
      2: { 0: { lower: 15, upper: 25 }, 1: { lower: 4, upper: 5 } },
      3: { 0: { lower: 10, upper: 15 }, 1: { lower: 3, upper: 4 } },
    },
    1: {
      0: { 0: { lower: 15, upper: 25 }, 1: { lower: 4, upper: 5 } },
      1: { 0: { lower: 30, upper: 40 }, 1: { lower: 4, upper: 5 } },
      2: { 0: { lower: 20, upper: 30 }, 1: { lower: 5, upper: 5 } },
      3: { 0: { lower: 5, upper: 10 }, 1: { lower: 3, upper: 4 } },
    },
  } as Record<number, Record<number, Record<number, SolutionEntry>>>,
  titleEdited: 'Inline Case Study Question Title Edited',
  contentEdited: 'Inline Case Study Question Text Edited',
  explanationEdited: 'Inline Case Study Question Explanation Edited',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MSG_SELECT_COLLECTION = 'Select collection'
const MSG_ANSWER_OPTION_USED = 'Answer options marked with the warning symbol'

test('CLEANUP', cleanupTest)

async function fillCriterion(page: Page, ix: number, criterion: CriterionData) {
  await page.getByTestId(`criterion-${ix}-name`).click()
  await page.getByTestId(`criterion-${ix}-name`).clear()
  await page.getByTestId(`criterion-${ix}-name`).fill(criterion.name)

  if (criterion.mode === 'range') {
    await page.getByTestId(`criterion-${ix}-min`).click()
    await page.getByTestId(`criterion-${ix}-min`).clear()
    await page.getByTestId(`criterion-${ix}-min`).fill(String(criterion.min))
    await page.getByTestId(`criterion-${ix}-max`).click()
    await page.getByTestId(`criterion-${ix}-max`).clear()
    await page.getByTestId(`criterion-${ix}-max`).fill(String(criterion.max))
    await page.getByTestId(`criterion-${ix}-step`).click()
    await page.getByTestId(`criterion-${ix}-step`).clear()
    await page.getByTestId(`criterion-${ix}-step`).fill(String(criterion.step))
    if (criterion.unit) {
      await page.getByTestId(`criterion-${ix}-unit`).click()
      await page.getByTestId(`criterion-${ix}-unit`).fill(criterion.unit)
    }
  } else {
    await page.getByTestId(`criterion-${ix}-min-label`).click()
    await page.getByTestId(`criterion-${ix}-min-label`).clear()
    await page
      .getByTestId(`criterion-${ix}-min-label`)
      .fill(criterion.labels.min)
    await page.getByTestId(`criterion-${ix}-max-label`).click()
    await page.getByTestId(`criterion-${ix}-max-label`).clear()
    await page
      .getByTestId(`criterion-${ix}-max-label`)
      .fill(criterion.labels.max)
    await page.getByTestId(`criterion-${ix}-steps`).click()
    await page.getByTestId(`criterion-${ix}-steps`).clear()
    await page
      .getByTestId(`criterion-${ix}-steps`)
      .fill(String(criterion.steps))
    if (criterion.labels.mid) {
      await page.getByTestId(`criterion-${ix}-mid-label`).click()
      await page.getByTestId(`criterion-${ix}-mid-label`).clear()
      await page
        .getByTestId(`criterion-${ix}-mid-label`)
        .fill(criterion.labels.mid)
    }
  }
}

async function verifyCriterion(
  page: Page,
  ix: number,
  criterion: CriterionData
) {
  await expect(page.getByTestId(`criterion-${ix}-name`)).toHaveValue(
    criterion.name
  )
  if (criterion.mode === 'range') {
    await expect(page.getByTestId(`criterion-${ix}-min`)).toHaveValue(
      String(criterion.min)
    )
    await expect(page.getByTestId(`criterion-${ix}-max`)).toHaveValue(
      String(criterion.max)
    )
    await expect(page.getByTestId(`criterion-${ix}-step`)).toHaveValue(
      String(criterion.step)
    )
    if (criterion.unit) {
      await expect(page.getByTestId(`criterion-${ix}-unit`)).toHaveValue(
        criterion.unit
      )
    }
  } else {
    await expect(page.getByTestId(`criterion-${ix}-min-label`)).toHaveValue(
      criterion.labels.min
    )
    await expect(page.getByTestId(`criterion-${ix}-max-label`)).toHaveValue(
      criterion.labels.max
    )
    await expect(page.getByTestId(`criterion-${ix}-steps`)).toHaveValue(
      String(criterion.steps)
    )
    if (criterion.labels.mid) {
      await expect(page.getByTestId(`criterion-${ix}-mid-label`)).toHaveValue(
        criterion.labels.mid
      )
    }
  }
}

async function fillSolutions(
  page: Page,
  solutions: Record<number, Record<number, Record<number, SolutionEntry>>>
) {
  for (const [caseIxStr, caseVal] of Object.entries(solutions)) {
    for (const [itemIxStr, itemVal] of Object.entries(caseVal)) {
      for (const [criterionIxStr, value] of Object.entries(itemVal)) {
        const caseIx = Number(caseIxStr)
        const itemIx = Number(itemIxStr)
        const criterionIx = Number(criterionIxStr)
        const v = value as SolutionEntry
        await page
          .getByTestId(`case-solution-${caseIx}-${itemIx}-${criterionIx}-lower`)
          .click()
        await page
          .getByTestId(`case-solution-${caseIx}-${itemIx}-${criterionIx}-lower`)
          .fill(String(v.lower))
        await page
          .getByTestId(`case-solution-${caseIx}-${itemIx}-${criterionIx}-upper`)
          .click()
        await page
          .getByTestId(`case-solution-${caseIx}-${itemIx}-${criterionIx}-upper`)
          .fill(String(v.upper))
      }
    }
  }
}

async function verifySolutions(
  page: Page,
  solutions: Record<number, Record<number, Record<number, SolutionEntry>>>
) {
  for (const [caseIxStr, caseVal] of Object.entries(solutions)) {
    for (const [itemIxStr, itemVal] of Object.entries(caseVal)) {
      for (const [criterionIxStr, value] of Object.entries(itemVal)) {
        const caseIx = Number(caseIxStr)
        const itemIx = Number(itemIxStr)
        const criterionIx = Number(criterionIxStr)
        const v = value as SolutionEntry
        await expect(
          page.getByTestId(
            `case-solution-${caseIx}-${itemIx}-${criterionIx}-lower`
          )
        ).toHaveValue(String(v.lower))
        await expect(
          page.getByTestId(
            `case-solution-${caseIx}-${itemIx}-${criterionIx}-upper`
          )
        ).toHaveValue(String(v.upper))
      }
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Test creation and editing functionalities for Case Study elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  // -------------------------------------------------------------------------
  // Create answer collections
  // -------------------------------------------------------------------------
  test('Create the answer collection that will be used for the case study question tests', async ({
    page,
  }) => {
    await expect(page.getByTestId('resources')).toBeVisible()
    await expect(page.getByTestId('analytics')).toBeVisible()

    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()

    // Helper: fill a collection form (form starts with 2 pre-populated slots)
    const fillCollection = async (
      name: string,
      description: string,
      entries: string[]
    ) => {
      await page.locator('[data-cy="create-answer-collection"]').click()
      await page
        .getByTestId('answer-collection-name')
        .waitFor({ state: 'visible' })
      await page.getByTestId('answer-collection-name').fill(name)
      const descEditor = page.locator(
        '[data-cy="answer-collection-description"]'
      )
      await descEditor.click()
      await descEditor.pressSequentially(description)
      for (let i = 0; i < entries.length; i++) {
        if (i >= 2) {
          // slots 0 and 1 are pre-populated; add a new slot for index >= 2
          await page.locator('[data-cy="add-response-entry"]').click()
        }
        await page.getByTestId(`response-entry-${i}`).fill(entries[i])
      }
      await page.getByTestId('submit-create-answer-collection').click()
      await page.reload()
    }

    // Country Collection
    await fillCollection(CS.collection, CS.collectionDescription, [
      ...CS.items,
      ...CS.unselectedItems,
    ])
    await expect(
      page.getByTestId(`answer-collection-${CS.collection}`)
    ).toBeVisible()

    // Continent Collection
    await fillCollection(CS.collectionEdited, CS.collectionDescriptionEdited, [
      ...CS.itemsEdited,
      ...CS.unselectedItemsEdited,
    ])
    await expect(
      page.getByTestId(`answer-collection-${CS.collectionEdited}`)
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Create Case Study question
  // -------------------------------------------------------------------------
  test('Create a Case Study question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(`select-question-type-${elementTypeLabels.caseStudy}`)
      .click()
    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.caseStudy
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('insert-question-title').fill(CS.title)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(`select-question-status-${statusLabels.ready}`)
      .click()

    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(CS.content)
    await page.getByTestId('insert-question-explanation').click()
    await page
      .getByTestId('insert-question-explanation')
      .pressSequentially(CS.explanation)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select answer collection
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      MSG_SELECT_COLLECTION
    )
    await page.getByTestId('select-answer-collection').click()
    await page.getByTestId(`select-answer-collection-${CS.collection}`).click()
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      CS.collection
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select items
    for (const item of CS.items) {
      await page.getByTestId('choose-case-study-items').click()
      await page.getByRole('option', { name: item, exact: true }).click()
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }

    // Add criteria
    const allCriteria = [...CS.criteria, CS.removedCriterion]
    for (let ix = 0; ix < allCriteria.length; ix++) {
      const criterion = allCriteria[ix]
      await page.getByTestId(`add-${criterion.mode}-criterion`).click()
      await fillCriterion(page, ix, criterion)
      await verifyCriterion(page, ix, criterion)
    }
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Add cases (including one to remove)
    const allCases = [...CS.cases, CS.removedCase]
    for (let ix = 0; ix < allCases.length; ix++) {
      const caseItem = allCases[ix]
      await page.getByTestId('add-new-case').click()
      await page.getByTestId(`case-title-${ix}`).click()
      await page.getByTestId(`case-title-${ix}`).fill(caseItem.title)
      await page.getByTestId(`case-description-${ix}`).click()
      await page
        .getByTestId(`case-description-${ix}`)
        .pressSequentially(caseItem.description)
      await expect(page.getByTestId(`case-title-${ix}`)).toHaveValue(
        caseItem.title
      )
      await expect(page.getByTestId(`case-description-${ix}`)).toContainText(
        caseItem.description
      )
      await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    }

    // Remove the last case (cancel then confirm)
    await page.getByTestId(`delete-case-${CS.cases.length}`).click()
    await page.getByTestId('cancel-delete-case').click()
    await page.getByTestId(`delete-case-${CS.cases.length}`).click()
    await page.getByTestId('confirm-delete-case').click()
    await expect(
      page.getByTestId(`case-title-${CS.cases.length}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`case-description-${CS.cases.length}`)
    ).not.toBeVisible()

    // Sample solution toggle
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('configure-sample-solution').click()

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await validateElement(page, CS.title, [
      CS.content,
      CS.title,
      statusLabels.ready,
    ])
  })

  // -------------------------------------------------------------------------
  // Verify persistence
  // -------------------------------------------------------------------------
  test('Verify that the correct content has been saved', async ({ page }) => {
    await searchAndEdit(page, CS.title)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CS.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await expect(page.getByTestId('insert-question-text')).toContainText(
      CS.content
    )
    await expect(page.getByTestId('insert-question-explanation')).toContainText(
      CS.explanation
    )
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      CS.collection
    )

    for (const item of CS.items) {
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }

    const allCriteria = [...CS.criteria, CS.removedCriterion]
    for (let ix = 0; ix < allCriteria.length; ix++) {
      await verifyCriterion(page, ix, allCriteria[ix])
    }

    for (let ix = 0; ix < CS.cases.length; ix++) {
      await expect(page.getByTestId(`case-title-${ix}`)).toHaveValue(
        CS.cases[ix].title
      )
      await expect(page.getByTestId(`case-description-${ix}`)).toContainText(
        CS.cases[ix].description
      )
    }

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify preview
  // -------------------------------------------------------------------------
  test('Verify that creation was successful', async ({ page }) => {
    await searchAndEdit(page, CS.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CS.title
    )

    await expect(page.getByTestId('student-element-preview')).toContainText(
      CS.content
    )

    await expect(page.getByTestId('case-0-title')).toContainText(
      CS.cases[0].title
    )
    await expect(page.getByTestId('case-0-description')).toContainText(
      CS.cases[0].description
    )
    await expect(page.getByTestId('case-1-title')).toContainText(
      CS.cases[1].title
    )
    await expect(page.getByTestId('case-1-description')).toContainText(
      CS.cases[1].description
    )

    // Verify sliders exist for all items × cases × criteria
    for (let caseIx = 0; caseIx < CS.cases.length; caseIx++) {
      for (
        let criterionIx = 0;
        criterionIx < CS.criteria.length;
        criterionIx++
      ) {
        for (let itemIx = 0; itemIx < CS.items.length; itemIx++) {
          await expect(
            page.getByTestId(
              `cs-slider-nr-value-0-${caseIx}-${itemIx}-${criterionIx}`
            )
          ).toBeVisible()
        }
      }
    }

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify answer collection deletion restrictions
  // -------------------------------------------------------------------------
  test('Verify that the deletion of answer collection entries is limited, editing is unaffected', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${CS.collection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)

    for (const sol of CS.items) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    for (const sol of CS.unselectedItems) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  test('Verify that the answer collection used in the case study can no longer be deleted', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${CS.collection}`).click()
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    await expect(page.getByText(MSG_ANSWER_OPTION_USED)).toBeVisible()
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  // -------------------------------------------------------------------------
  // Add sample solution
  // -------------------------------------------------------------------------
  test('Add a sample solution to the case study question', async ({ page }) => {
    await searchAndEdit(page, CS.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CS.title
    )

    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await fillSolutions(page, CS.solutionsWithAdditionalCriterion)

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)
  })

  test('Verify that the sample solution has been stored correctly for the modified case study question', async ({
    page,
  }) => {
    await searchAndEdit(page, CS.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CS.title
    )

    await verifySolutions(page, CS.solutionsWithAdditionalCriterion)

    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that the case study validation logic covers all required cases and block submission of invalid element edit modals', async ({
    page,
  }) => {
    await searchAndEdit(page, CS.title)
    const rangeCriterion = CS.criteria[0] as RangeCriterion

    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('insert-question-title').fill(CS.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    const questionText = page.getByTestId('insert-question-text')
    await questionText.click()
    await page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
    )
    await page.keyboard.press('Backspace')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await questionText.pressSequentially(CS.content)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await fillEditorField(page, 'insert-question-explanation', '', true)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await fillEditorField(page, 'insert-question-explanation', CS.explanation)

    await page.getByTestId('configure-sample-solution').click()
    await page.getByTestId('criterion-0-name').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-0-name').fill(rangeCriterion.name)

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-0-min').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-0-min').fill(String(rangeCriterion.min))

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-0-max').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-0-max').fill(String(rangeCriterion.max))

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-0-step').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-0-step').fill(String(rangeCriterion.step))
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('configure-sample-solution').click()
    await page.getByTestId('criterion-2-name').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-2-name').fill(CS.removedCriterion.name)

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-2-min-label').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page
      .getByTestId('criterion-2-min-label')
      .fill(CS.removedCriterion.labels.min)

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-2-mid-label').clear()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page
      .getByTestId('criterion-2-mid-label')
      .fill(CS.removedCriterion.labels.mid!)

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-2-max-label').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page
      .getByTestId('criterion-2-max-label')
      .fill(CS.removedCriterion.labels.max)

    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-2-steps').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-2-steps').fill('0')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-2-steps').clear()
    await page.getByTestId('criterion-2-steps').fill('1')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-2-steps').clear()
    await page.getByTestId('criterion-2-steps').fill('2')
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-2-steps').clear()
    await page
      .getByTestId('criterion-2-steps')
      .fill(String(CS.removedCriterion.steps))
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('configure-sample-solution').click()
    await page.getByTestId('criterion-0-min').clear()
    await page
      .getByTestId('criterion-0-min')
      .fill(String(rangeCriterion.max + rangeCriterion.step + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-0-min').clear()
    await page
      .getByTestId('criterion-0-min')
      .fill(String(rangeCriterion.max - 2 * rangeCriterion.step + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('criterion-0-min').clear()
    await page
      .getByTestId('criterion-0-min')
      .fill(String(rangeCriterion.max - 2 * rangeCriterion.step - 1))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('criterion-0-min').clear()
    await page.getByTestId('criterion-0-min').fill(String(rangeCriterion.min))
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].lower))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-0-upper').clear()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page
      .getByTestId('case-solution-1-3-0-upper')
      .fill(String(CS.solutions[1][3][0].upper))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].upper + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].lower))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(rangeCriterion.min - 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(rangeCriterion.min))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(rangeCriterion.min + 1))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].lower))

    await page.getByTestId('case-solution-1-3-0-upper').clear()
    await page
      .getByTestId('case-solution-1-3-0-upper')
      .fill(String(rangeCriterion.max + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-upper').clear()
    await page
      .getByTestId('case-solution-1-3-0-upper')
      .fill(String(rangeCriterion.max))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-upper').clear()
    await page
      .getByTestId('case-solution-1-3-0-upper')
      .fill(String(rangeCriterion.max - 1))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-upper').clear()
    await page
      .getByTestId('case-solution-1-3-0-upper')
      .fill(String(CS.solutions[1][3][0].upper))

    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].upper - rangeCriterion.step + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].upper - rangeCriterion.step))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].upper - rangeCriterion.step - 1))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    await page.getByTestId('case-solution-1-3-0-lower').clear()
    await page
      .getByTestId('case-solution-1-3-0-lower')
      .fill(String(CS.solutions[1][3][0].lower))

    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page.getByTestId('case-solution-1-3-2-lower').fill('1')
    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page.getByTestId('case-solution-1-3-2-upper').fill('1')
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page
      .getByTestId('case-solution-1-3-2-lower')
      .fill(String(CS.removedCriterion.steps))
    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page
      .getByTestId('case-solution-1-3-2-upper')
      .fill(String(CS.removedCriterion.steps))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page
      .getByTestId('case-solution-1-3-2-lower')
      .fill(String(CS.removedCriterion.steps))
    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page.getByTestId('case-solution-1-3-2-upper').fill('1')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page
      .getByTestId('case-solution-1-3-2-lower')
      .fill(String(CS.solutionsWithAdditionalCriterion[1][3][2].lower))
    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page
      .getByTestId('case-solution-1-3-2-upper')
      .fill(String(CS.solutionsWithAdditionalCriterion[1][3][2].upper))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page
      .getByTestId('case-solution-1-3-2-lower')
      .fill(String(CS.removedCriterion.steps + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page.getByTestId('case-solution-1-3-2-lower').fill('0')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-2-lower').clear()
    await page
      .getByTestId('case-solution-1-3-2-lower')
      .fill(String(CS.solutionsWithAdditionalCriterion[1][3][2].lower))

    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page
      .getByTestId('case-solution-1-3-2-upper')
      .fill(String(CS.removedCriterion.steps + 1))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page.getByTestId('case-solution-1-3-2-upper').fill('0')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId('case-solution-1-3-2-upper').clear()
    await page
      .getByTestId('case-solution-1-3-2-upper')
      .fill(String(CS.solutionsWithAdditionalCriterion[1][3][2].upper))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Edit question + change collection
  // -------------------------------------------------------------------------
  test('Edit the case study question, change the answer collection (including new sample solutions), and remove one criterion', async ({
    page,
  }) => {
    await searchAndEdit(page, CS.title)

    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(CS.titleEdited)

    await fillEditorField(page, 'insert-question-text', CS.contentEdited, true)

    // Change collection with cancel then confirm
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${CS.collectionEdited}`)
      .click()
    await page.getByTestId('cancel-change-collection').click()
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${CS.collectionEdited}`)
      .click()
    await page.getByTestId('confirm-change-collection').click()
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      CS.collectionEdited
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select new items
    for (const item of CS.itemsEdited) {
      await page.getByTestId('choose-case-study-items').click()
      await page.getByRole('option', { name: item, exact: true }).click()
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }

    // Remove the removed criterion (index CS.criteria.length = 2)
    await page.getByTestId(`remove-criterion-${CS.criteria.length}`).click()
    await expect(
      page.getByTestId(`criterion-${CS.criteria.length}-name`)
    ).not.toBeVisible()

    // Edit existing criteria
    for (let ix = 0; ix < CS.criteriaEdited.length; ix++) {
      await fillCriterion(page, ix, CS.criteriaEdited[ix])
      await verifyCriterion(page, ix, CS.criteriaEdited[ix])
    }

    // Remove all existing cases
    for (let i = 0; i < CS.cases.length; i++) {
      await page.getByTestId('delete-case-0').click()
      await page.getByTestId('confirm-delete-case').click()
    }
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Add new cases
    for (let ix = 0; ix < CS.casesEdited.length; ix++) {
      const caseItem = CS.casesEdited[ix]
      await page.getByTestId('add-new-case').click()
      await page.getByTestId(`case-title-${ix}`).click()
      await page.getByTestId(`case-title-${ix}`).fill(caseItem.title)
      await page.getByTestId(`case-description-${ix}`).click()
      await page
        .getByTestId(`case-description-${ix}`)
        .pressSequentially(caseItem.description)
      await expect(page.getByTestId(`case-title-${ix}`)).toHaveValue(
        caseItem.title
      )
      await expect(page.getByTestId(`case-description-${ix}`)).toContainText(
        caseItem.description
      )
    }
    await expect(page.getByTestId('save-new-question')).toBeDisabled() // solution required

    // Add new sample solutions
    await fillSolutions(page, CS.solutionsEdited)

    await page.getByTestId('save-new-question').click()
  })

  // -------------------------------------------------------------------------
  // Verify edited persistence
  // -------------------------------------------------------------------------
  test('Verify that all changes to the case study question have been saved correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, CS.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CS.titleEdited
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      CS.contentEdited
    )
    await expect(page.getByTestId('select-answer-collection')).toContainText(
      CS.collectionEdited
    )

    for (const item of CS.itemsEdited) {
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }

    for (let ix = 0; ix < CS.criteriaEdited.length; ix++) {
      await verifyCriterion(page, ix, CS.criteriaEdited[ix])
    }

    for (let ix = 0; ix < CS.casesEdited.length; ix++) {
      await expect(page.getByTestId(`case-title-${ix}`)).toHaveValue(
        CS.casesEdited[ix].title
      )
      await expect(page.getByTestId(`case-description-${ix}`)).toContainText(
        CS.casesEdited[ix].description
      )
    }

    await verifySolutions(page, CS.solutionsEdited)

    await page.getByTestId('close-element-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify collection state after question edit
  // -------------------------------------------------------------------------
  test('Verify that all elements of the previously used answer collection and the collection itself can be deleted again', async ({
    page,
  }) => {
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    // Country Collection: no longer in use
    await page.getByTestId(`answer-collection-actions-${CS.collection}`).click()
    await expect(
      page.getByTestId('delete-answer-collection')
    ).not.toHaveAttribute('data-disabled')
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...CS.items, ...CS.unselectedItems]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await expect(page.getByText(MSG_ANSWER_OPTION_USED)).not.toBeVisible()
    await page.getByTestId('close-answer-collection-edit-modal').click()

    // Continent Collection: still in use
    await page
      .getByTestId(`answer-collection-actions-${CS.collectionEdited}`)
      .click()
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of CS.itemsEdited) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    for (const sol of CS.unselectedItemsEdited) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await expect(page.getByText(MSG_ANSWER_OPTION_USED)).toBeVisible()
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  test('Verify that after the deletion of the linked questions, all solution options can be deleted again', async ({
    page,
  }) => {
    await deleteElement(page, CS.titleEdited)

    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    // Country Collection
    await page.getByTestId(`answer-collection-actions-${CS.collection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...CS.items, ...CS.unselectedItems]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()

    // Continent Collection
    await page
      .getByTestId(`answer-collection-actions-${CS.collectionEdited}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)
    for (const sol of [...CS.itemsEdited, ...CS.unselectedItemsEdited]) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  // =========================================================================
  // Inline answer collection creation
  // =========================================================================

  test('Create a case study question with inline answer collection', async ({
    page,
  }) => {
    await page.getByTestId('create-question').click()

    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(`select-question-type-${elementTypeLabels.caseStudy}`)
      .click()
    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.caseStudy
    )
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('insert-question-title').fill(CS_INLINE.title)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(`select-question-status-${statusLabels.ready}`)
      .click()

    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(CS_INLINE.content)
    await page.getByTestId('insert-question-explanation').click()
    await page
      .getByTestId('insert-question-explanation')
      .pressSequentially(CS_INLINE.explanation)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Use inline collection
    await expect(
      page.getByTestId('create-inline-answer-collection')
    ).toBeVisible()
    await page.getByTestId('create-inline-answer-collection').click()

    for (const item of CS_INLINE.items) {
      await page.locator('#inline-answer-collection-options input').fill(item)
      await page
        .locator('#inline-answer-collection-options input')
        .press('Enter')
    }
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Add criteria
    for (let ix = 0; ix < CS_INLINE.criteria.length; ix++) {
      const criterion = CS_INLINE.criteria[ix]
      await page.getByTestId(`add-${criterion.mode}-criterion`).click()
      await fillCriterion(page, ix, criterion)
    }
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Add cases
    for (let ix = 0; ix < CS_INLINE.cases.length; ix++) {
      const caseItem = CS_INLINE.cases[ix]
      await page.getByTestId('add-new-case').click()
      await page.getByTestId(`case-title-${ix}`).click()
      await page.getByTestId(`case-title-${ix}`).fill(caseItem.title)
      await page.getByTestId(`case-description-${ix}`).click()
      await page
        .getByTestId(`case-description-${ix}`)
        .pressSequentially(caseItem.description)
    }
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Add sample solution
    await page.getByTestId('configure-sample-solution').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillSolutions(page, CS_INLINE.solutions)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Add extra item, fill solutions, then remove it
    const additionalItem = 'New Item'
    await page
      .locator('#inline-answer-collection-options input')
      .fill(additionalItem)
    await page.locator('#inline-answer-collection-options input').press('Enter')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // criterion 0: range (min=0, max=100, step=5); criterion 1: steps (steps=5, so values 1-5)
    const newItemIx = CS_INLINE.items.length
    const additionalItemSolutions: Record<
      number,
      Record<number, Record<number, SolutionEntry>>
    > = {
      0: {
        [newItemIx]: { 0: { lower: 0, upper: 10 }, 1: { lower: 1, upper: 3 } },
      },
      1: {
        [newItemIx]: { 0: { lower: 5, upper: 15 }, 1: { lower: 2, upper: 4 } },
      },
    }
    await fillSolutions(page, additionalItemSolutions)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Remove extra item
    await expect(
      page.locator('#inline-answer-collection-options')
    ).toContainText(additionalItem)
    await page
      .locator('#inline-answer-collection-options input')
      .press('Backspace')

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await validateElement(page, CS_INLINE.title, [
      CS_INLINE.title,
      CS_INLINE.content,
    ])
  })

  test('Verify that a new answer collection was created when creating the case study', async ({
    page,
  }) => {
    const collectionName = `AC: ${CS_INLINE.title}`
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page
      .getByTestId(`answer-collection-actions-${collectionName}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()
    await openAnswerCollectionOptions(page)

    for (const sol of CS_INLINE.items) {
      await expect(
        page.getByTestId(`delete-answer-option-${sol}`)
      ).toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${sol}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })

  test('Edit the inline created case study question', async ({ page }) => {
    await searchAndEdit(page, CS_INLINE.title)

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(CS_INLINE.titleEdited)
    await fillEditorField(
      page,
      'insert-question-text',
      CS_INLINE.contentEdited,
      true
    )
    await fillEditorField(
      page,
      'insert-question-explanation',
      CS_INLINE.explanationEdited,
      true
    )

    // Creating inline collection is not available during edit
    await expect(
      page.getByTestId('create-inline-answer-collection')
    ).not.toBeVisible()

    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await validateElement(page, CS_INLINE.titleEdited, [
      CS_INLINE.titleEdited,
      CS_INLINE.contentEdited,
    ])
  })

  test('Verify that all changes to the inline created case study have been saved correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, CS_INLINE.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      CS_INLINE.titleEdited
    )
    await expect(page.getByTestId('insert-question-text')).toContainText(
      CS_INLINE.contentEdited
    )
    await expect(page.getByTestId('insert-question-explanation')).toContainText(
      CS_INLINE.explanationEdited
    )

    for (const item of CS_INLINE.items) {
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }

    for (let ix = 0; ix < CS_INLINE.criteria.length; ix++) {
      await expect(page.getByTestId(`criterion-${ix}-name`)).toHaveValue(
        CS_INLINE.criteria[ix].name
      )
    }

    await page.getByTestId('close-element-modal').click()
  })
})
