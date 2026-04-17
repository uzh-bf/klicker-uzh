/**
 * MA-elements-operations.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/MA-elements-operations-workflow.cy.ts
 * Tests three areas:
 *   Part 1: Question duplication
 *   Part 2: Auto-save functionality for Elements
 *   Part 3: Element instance updates (activities in Testkurs)
 */

import { type Page } from '@playwright/test'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture data ─────────────────────────────────────────────────────────────

const DUPLICATION = {
  title: 'Duplication question title',
  content: 'Duplication question content',
}

const AUTO_SAVE = {
  title: 'Auto Save question title',
  content: 'Auto Save question content',
  choices: [
    { value: 'Choice 1' },
    { value: 'Choice 2' },
    { value: 'Choice 3', correct: true },
    { value: 'Choice 4' },
  ],
  titleEdited: 'Auto Save question title new',
  contentEdited: 'Auto Save question content new',
  contentEdited2: 'Auto Save question content new 2',
  titleEditedDuplicated: 'Auto Save question title new (Copy)',
}

const UPDATE = {
  title1: 'Single Choice Question Title 1',
  title2: 'Single Choice Question Title 2',
  title3: 'Single Choice Question Title 3',
  content1: 'Single Choice Question Content 1',
  choices1: [
    { value: 'Choice 1', feedback: 'Feedback 1' },
    { value: 'Choice 2', feedback: 'Feedback 2' },
    { value: 'Choice 3', feedback: 'Feedback 3', correct: true },
    { value: 'Choice 4', feedback: 'Feedback 4' },
  ],
  choices2: [
    { value: 'Choice NEW 1', feedback: 'Feedback NEW 1' },
    { value: 'Choice NEW 2', feedback: 'Feedback NEW 2' },
    { value: 'Choice NEW 3', feedback: 'Feedback NEW 3', correct: true },
    { value: 'Choice NEW 4', feedback: 'Feedback NEW 4' },
  ],
  course: 'Testkurs',
  liveQuiz1: 'Live Quiz 1',
  liveQuiz2: 'Live Quiz 2',
  liveQuiz3: 'Live Quiz 3',
  practiceQuiz1: 'Practice Quiz 1',
  practiceQuiz2: 'Practice Quiz 2',
  practiceQuiz3: 'Practice Quiz 3',
  microlearning1: 'Microlearning 1',
  microlearning2: 'Microlearning 2',
  microlearning3: 'Microlearning 3',
  groupActivity1: 'Group Activity 1',
  groupActivity2: 'Group Activity 2',
  groupActivity3: 'Group Activity 3',
}

// i18n labels
const LABEL_SC = 'Single Choice (SC)'
const LABEL_DRAFT = 'Draft'
const LABEL_READY = 'Ready'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function searchAndEdit(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`edit-element-${elementName}`).click()
}

async function validateElement(
  page: Page,
  elementName: string,
  contains: string[] = [],
  shouldExist = true
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  const el = page.getByTestId(`element-item-${elementName}`)
  if (shouldExist) {
    await expect(el).toBeVisible()
    for (const text of contains) {
      await expect(el).toContainText(text)
    }
  } else {
    await expect(el).not.toBeVisible()
  }
  await page.getByTestId('elements-search-input').clear()
}

async function deleteElement(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`element-actions-${elementName}`).click()
  await page.getByTestId('delete-element').click()
  await page.getByTestId('confirm-delete-element').click()
  await expect(
    page.getByTestId(`element-item-${elementName}`)
  ).not.toBeVisible()
}

/** Fill in a full SC question with content (mirrors enterSCQuestionContent) */
async function enterSCQuestionContent(page: Page) {
  await page.getByTestId('insert-question-title').fill(AUTO_SAVE.title)
  await page.getByTestId('insert-question-text').click()
  await page
    .getByTestId('insert-question-text')
    .pressSequentially(AUTO_SAVE.content)

  await page.getByTestId('insert-answer-field-0').click()
  await page
    .getByTestId('insert-answer-field-0')
    .pressSequentially(AUTO_SAVE.choices[0].value)

  for (let i = 1; i < AUTO_SAVE.choices.length; i++) {
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`insert-answer-field-${i}`).click()
    await page
      .getByTestId(`insert-answer-field-${i}`)
      .pressSequentially(AUTO_SAVE.choices[i].value)
  }

  // Enable sample solution and mark correct answer
  await page.getByTestId('configure-sample-solution').click({ force: true })
  for (let i = 0; i < AUTO_SAVE.choices.length; i++) {
    if (AUTO_SAVE.choices[i].correct) {
      await page.getByTestId(`set-correctness-${i}`).click()
    }
  }
}

// ─── Part 1: Question duplication ────────────────────────────────────────────

test.describe('Part 1: Question duplication', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a new question, duplicate it and then delete them again', async ({
    page,
  }) => {
    // Create question
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(DUPLICATION.title)

    await page.getByTestId('select-question-status').click()
    await page.getByTestId(`select-question-status-${LABEL_DRAFT}`).click()

    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(DUPLICATION.content)

    await page.getByTestId('insert-answer-field-0').click()
    await page.getByTestId('insert-answer-field-0').pressSequentially('50%')

    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-answer-field-1').click()
    await page.getByTestId('insert-answer-field-1').pressSequentially('100%')

    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Navigate to the question and duplicate
    await page.getByTestId('elements-search-input').fill(DUPLICATION.title)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${DUPLICATION.title}`)
    ).toBeVisible()

    await page.getByTestId(`duplicate-element-${DUPLICATION.title}`).click()
    await page.waitForTimeout(500)

    // Verify the duplicate modal title
    await expect(page.getByText('Duplicate')).toBeVisible()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Both original and copy should exist
    await validateElement(page, DUPLICATION.title)
    await validateElement(page, `${DUPLICATION.title} (Copy)`, [LABEL_DRAFT])

    // Delete both
    await deleteElement(page, `${DUPLICATION.title} (Copy)`)
    await validateElement(page, `${DUPLICATION.title} (Copy)`, [], false)
    await deleteElement(page, DUPLICATION.title)
    await validateElement(page, DUPLICATION.title, [], false)
  })
})

// ─── Part 2: Auto-save functionality ─────────────────────────────────────────

test.describe('Part 2: Auto-save functionality for Elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Verify that empty questions are not stored in local storage (creation)', async ({
    page,
  }) => {
    // Open modal, wait for auto-save, close
    await page.getByTestId('create-question').click()
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // Recovery prompt should not be shown
    await page.getByTestId('create-question').click()
    await expect(
      page.getByTestId('discard-recovered-element-data')
    ).not.toBeVisible()
    await expect(
      page.getByTestId('load-recovered-element-data')
    ).not.toBeVisible()
    await expect(page.getByTestId('select-question-type')).toContainText(
      LABEL_SC
    )
    await expect(page.getByTestId('insert-question-title')).toHaveValue('')
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that non-empty questions are stored and loaded correctly on demand (creation)', async ({
    page,
  }) => {
    await page.getByTestId('create-question').click()
    await enterSCQuestionContent(page)
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // Re-open and load
    await page.getByTestId('create-question').click()
    await page.getByTestId('load-recovered-element-data').click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.title
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.content
    )
    for (let ix = 0; ix < AUTO_SAVE.choices.length; ix++) {
      await expect(page.getByTestId(`insert-answer-field-${ix}`)).toContainText(
        AUTO_SAVE.choices[ix].value
      )
    }
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that non-empty questions are stored and discarded on request (creation)', async ({
    page,
  }) => {
    await page.getByTestId('create-question').click()
    await enterSCQuestionContent(page)
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    await page.getByTestId('create-question').click()
    await page.getByTestId('discard-recovered-element-data').click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue('')
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that local storage is correctly cleared after creating a question', async ({
    page,
  }) => {
    await page.getByTestId('create-question').click()
    await enterSCQuestionContent(page)
    await page.waitForTimeout(3000)
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    // After save, no prompt
    await page.getByTestId('create-question').click()
    await expect(
      page.getByTestId('load-recovered-element-data')
    ).not.toBeVisible()
    await expect(page.getByTestId('insert-question-title')).toHaveValue('')
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that opening the edit modal and closing without modifications does not trigger prompt', async ({
    page,
  }) => {
    await searchAndEdit(page, AUTO_SAVE.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.title
    )
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // No prompt on re-open
    await searchAndEdit(page, AUTO_SAVE.title)
    await expect(
      page.getByTestId('discard-recovered-element-data')
    ).not.toBeVisible()
    await expect(
      page.getByTestId('load-recovered-element-data')
    ).not.toBeVisible()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.title
    )
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that after editing a question and waiting for auto-save the corresponding content can be loaded', async ({
    page,
  }) => {
    await searchAndEdit(page, AUTO_SAVE.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.title
    )

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(AUTO_SAVE.titleEdited)
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.content
    )
    await page.getByTestId('insert-question-text').clear()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(AUTO_SAVE.contentEdited)
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // Re-open and load
    await searchAndEdit(page, AUTO_SAVE.title)
    await page.getByTestId('load-recovered-element-data').click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.titleEdited
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.contentEdited
    )
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that after editing a question, auto-saving and discarding the saved content, the original content is loaded', async ({
    page,
  }) => {
    await searchAndEdit(page, AUTO_SAVE.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.title
    )

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(AUTO_SAVE.titleEdited)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(AUTO_SAVE.contentEdited)
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // Re-open, discard, verify original
    await searchAndEdit(page, AUTO_SAVE.title)
    await page.getByTestId('discard-recovered-element-data').click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.title
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.content
    )
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // After discard, no prompt
    await searchAndEdit(page, AUTO_SAVE.title)
    await expect(
      page.getByTestId('discard-recovered-element-data')
    ).not.toBeVisible()
    await expect(
      page.getByTestId('load-recovered-element-data')
    ).not.toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that after editing an element and saving it, no prompt is shown to the user', async ({
    page,
  }) => {
    await searchAndEdit(page, AUTO_SAVE.title)

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(AUTO_SAVE.titleEdited)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(AUTO_SAVE.contentEdited)
    await page.waitForTimeout(3000)
    await page.getByTestId('save-new-question').click()

    // Verify edit was saved and no prompt
    await searchAndEdit(page, AUTO_SAVE.titleEdited)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.titleEdited
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.contentEdited
    )
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that when duplicating a question, waiting for auto-save and opening the creation form, the content cannot be loaded', async ({
    page,
  }) => {
    await page.getByTestId('elements-search-input').fill(AUTO_SAVE.titleEdited)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${AUTO_SAVE.titleEdited}`)
    ).toBeVisible()
    await page.getByTestId(`duplicate-element-${AUTO_SAVE.titleEdited}`).click()

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.titleEditedDuplicated
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.contentEdited
    )
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // Duplicate auto-save should NOT appear in create form
    await page.getByTestId('create-question').click()
    await expect(
      page.getByTestId('load-recovered-element-data')
    ).not.toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify that when duplicating a question, modifying it slightly, waiting for auto-save and opening the creation form, the content can be loaded', async ({
    page,
  }) => {
    await page.getByTestId('elements-search-input').fill(AUTO_SAVE.titleEdited)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${AUTO_SAVE.titleEdited}`)
    ).toBeVisible()
    await page.getByTestId(`duplicate-element-${AUTO_SAVE.titleEdited}`).click()

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.titleEditedDuplicated
    )
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(AUTO_SAVE.contentEdited2)
    await page.waitForTimeout(3000)
    await page.getByTestId('close-element-modal').click()

    // Modified duplicate should appear in create form
    await page.getByTestId('create-question').click()
    await page.getByTestId('load-recovered-element-data').click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      AUTO_SAVE.titleEditedDuplicated
    )
    await page.getByTestId('insert-question-text').click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      AUTO_SAVE.contentEdited2
    )
    await page.getByTestId('close-element-modal').click()
  })

  test('Cleanup: Delete the auto-saved element', async ({ page }) => {
    await deleteElement(page, AUTO_SAVE.titleEdited)
  })
})

// ─── Part 3: Element instance updates ────────────────────────────────────────
//
// This part covers creating activities (live quizzes, practice quizzes,
// microlearnings, group activities) with an SC question, publishing them, then
// updating the SC question and verifying updates propagate to instances.
//
// It relies heavily on cy.createLiveQuiz / cy.createPracticeQuiz / etc. custom
// commands and on the student PWA for answer submission. Full implementation
// requires equivalent Playwright helper utilities for those flows.
//
// TODO: Implement Part 3 once Playwright helpers for activity creation,
// publishing, and student-side interaction are available.
