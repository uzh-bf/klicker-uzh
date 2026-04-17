/**
 * O-live-quiz.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/O-live-quiz-workflow.cy.ts
 *
 * NOTE: Parts 1-7 of the original Cypress file are fully commented out.
 * Only Part 8 (Word Cloud) contains active tests and is implemented here.
 *
 * Part 8: Word Cloud
 *   - Create NR4, FT4, FT5 questions
 *   - Create and start a live quiz with those questions
 *   - Verify word cloud shows "no responses" before answers
 *   - Student answers questions
 *   - Verify word cloud shows responses after answers
 */

import { type Page } from '@playwright/test'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture data ─────────────────────────────────────────────────────────────

const NR4 = {
  title: 'NR Title Test 1 (Version 4)',
  content: 'NR Question Content 1 (Version 4)',
  explanation: 'NR Question Explanation 1 (Version 4)',
  answer: '50',
}

const FT4 = {
  title: 'FT Title Test 1 (Version 4)',
  content: 'FT Question Content 1 (Version 4)',
  explanation: 'FT Question Explanation 1 (Version 4)',
  answer:
    'hello 1st 42 of https://example.com @user #fun user@example.com :-) 😊 ! $5.00 @',
}

const FT5 = {
  title: 'FT Title Test 1 (Version 5)',
  content: 'FT Question Content 1 (Version 5)',
  explanation: 'FT Question Explanation 1 (Version 5)',
  answer:
    'hallo 1. 42 von https://example.com @nutzer #lustig nutzer@beispiel.com :-) 😊 ! $5.00 @',
}

const LIVE_QUIZ_WORD_CLOUD = {
  course: 'Testkurs',
  name: 'Live Quiz 4',
  displayName: 'Live Quiz 4 (Display)',
}

const NO_RESPONSES_MSG =
  'No participants have submitted responses for this question 😔.'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createNRQuestion(
  page: Page,
  title: string,
  content: string
): Promise<void> {
  await page.getByTestId('create-question').click()

  // Switch to Numerical (NR)
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Numerical (NR)').click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()

  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

async function createFTQuestion(
  page: Page,
  title: string,
  content: string
): Promise<void> {
  await page.getByTestId('create-question').click()

  // Switch to Free Text (FT)
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Free Text (FT)').click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()

  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

/**
 * Create a live quiz with a single block containing multiple elements.
 * Matches the Cypress createLiveQuiz command wizard flow.
 *
 * Wizard steps:
 *   1. Name
 *   2. Display name
 *   3. Settings / Course
 *   4. Blocks & Questions
 */
async function createLiveQuizWithBlock(
  page: Page,
  name: string,
  displayName: string,
  courseName: string,
  questionTitles: string[]
): Promise<void> {
  await page.getByTestId('create-live-quiz').click()

  // Step 1: Name
  await page.getByTestId('insert-live-quiz-name').fill(name)
  await page.getByTestId('next-or-submit').click()

  // Step 2: Display name
  await page.getByTestId('insert-live-display-name').fill(displayName)
  await page.getByTestId('next-or-submit').click()

  // Step 3: Course selection
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  // Step 4: Add questions to the first block
  for (const title of questionTitles) {
    await page.getByTestId('search-element-input').fill(title)
    await page.getByTestId(`add-element-${title}`).click()
  }
  await page.getByTestId('next-or-submit').click()

  await page.waitForTimeout(500)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Part 8: Word Cloud', () => {
  test('Test word cloud display (no responses)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Create the three required questions
    await createNRQuestion(page, NR4.title, NR4.content)
    await createFTQuestion(page, FT4.title, FT4.content)
    await createFTQuestion(page, FT5.title, FT5.content)

    // Create and configure the live quiz
    await page.getByTestId('activities').click()
    await createLiveQuizWithBlock(
      page,
      LIVE_QUIZ_WORD_CLOUD.name,
      LIVE_QUIZ_WORD_CLOUD.displayName,
      LIVE_QUIZ_WORD_CLOUD.course,
      [NR4.title, FT4.title, FT5.title]
    )

    // Start the live quiz from the activities view
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`start-live-quiz-${LIVE_QUIZ_WORD_CLOUD.name}`)
      .click()

    // Activate the first block
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)

    // Navigate to evaluation results
    const evalLink = page.getByTestId('evaluation-results-cockpit')
    const href = await evalLink.evaluate((el) => {
      const anchor = el.closest('a')
      return anchor ? anchor.getAttribute('href') : null
    })
    if (!href) throw new Error('Could not find evaluation href')
    await page.goto(`http://127.0.0.1:3002${href}`)

    // Switch to word cloud chart for NR4 (first question, default selection)
    await page.getByTestId('change-chart-type').click()
    await page
      .getByTestId('change-chart-type-manage.evaluation.wordCloud')
      .click()
    await page.getByTestId('show-results-evaluation').click()
    await page.waitForTimeout(1000)

    await expect(page.getByTestId('word-cloud')).toContainText(NO_RESPONSES_MSG)

    // Switch to FT4
    await page.getByTestId('evaluate-question-select').click()
    await page.getByTestId(`evaluation-select-instance-${FT4.title}`).click()
    await page.getByTestId('change-chart-type').click()
    await page
      .getByTestId('change-chart-type-manage.evaluation.wordCloud')
      .click()
    await page.getByTestId('show-results-evaluation').click()
    await expect(page.getByTestId('word-cloud')).toContainText(NO_RESPONSES_MSG)

    // Switch to FT5
    await page.getByTestId('evaluate-question-select').click()
    await page.getByTestId(`evaluation-select-instance-${FT5.title}`).click()
    await page.getByTestId('change-chart-type').click()
    await page
      .getByTestId('change-chart-type-manage.evaluation.wordCloud')
      .click()
    await page.getByTestId('show-results-evaluation').click()
    await expect(page.getByTestId('word-cloud')).toContainText(NO_RESPONSES_MSG)
  })

  test('Test answering live quiz questions (student)', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()

    // Find and join the running live quiz
    await page.getByText(LIVE_QUIZ_WORD_CLOUD.displayName).click()

    // Answer NR4 (numerical, index 0)
    await page.getByTestId('input-numerical-0').clear()
    await page.getByTestId('input-numerical-0').fill(NR4.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // Answer FT4 (free text, index 1)
    await page.getByTestId('free-text-input-1').fill(FT4.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // Answer FT5 (free text, index 2)
    await page.getByTestId('free-text-input-2').fill(FT5.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
  })

  test('Test word cloud display after receiving answers', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Go to the running live quiz cockpit
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${LIVE_QUIZ_WORD_CLOUD.name}`)
      .click()

    // End the current block (activate next block to finalize)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)

    // Navigate to evaluation results
    const evalLink = page.getByTestId('evaluation-results-cockpit')
    const href = await evalLink.evaluate((el) => {
      const anchor = el.closest('a')
      return anchor ? anchor.getAttribute('href') : null
    })
    if (!href) throw new Error('Could not find evaluation href')
    await page.goto(`http://127.0.0.1:3002${href}`)

    // Switch to word cloud for NR4 and verify a response is shown (value "50")
    await page.getByTestId('change-chart-type').click()
    await page
      .getByTestId('change-chart-type-manage.evaluation.wordCloud')
      .click()
    await page.waitForTimeout(1000)

    await expect(page.getByTestId('word-cloud')).toContainText('50')
  })
})
