/**
 * R-bookmarking.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/R-bookmarking-workflow.cy.ts
 * Tests bookmarking and flagging workflows for practice quizzes and microlearnings.
 */

import { expect, test } from '../util/fixtures.js'

const COURSE = 'Testkurs'

const QUESTION1 = {
  title: 'Question 1 Title',
  content: 'Question Content 1',
  choices: [
    { value: '50%', correct: true },
    { value: '100%' },
    { value: '75%' },
  ],
}

const QUESTION2 = {
  title: 'Question 2 Title',
  content: 'Question Content 2',
  choices: [
    { value: '30%', correct: true },
    { value: '60%' },
    { value: '90%', correct: true },
  ],
}

const PQ = {
  name: 'Bookmarking practice quiz',
  displayName: 'Bookmarking practice quiz (Display)',
  flag1: 'Test flagging question on practice quiz Bookmarking practice quiz',
  flag2:
    'Test flagging question on practice quiz Bookmarking practice quiz new',
}

const ML = {
  name: 'Bookmarking microlearning',
  displayName: 'Bookmarking microlearning (Display)',
  flag1: 'Test flagging question on microlearning Bookmarking microlearning',
  flag2:
    'Test flagging question on microlearning Bookmarking microlearning new',
}

test.describe('R: Bookmarking and flagging workflows', () => {
  // -------------------------------------------------------------------------
  // Part 0: Question creation
  // -------------------------------------------------------------------------
  test.describe('Part 0: Question creation', () => {
    test.beforeEach(async ({ loginLecturer }) => {
      await loginLecturer()
    })

    test('Create SC question 1 for bookmarking tests', async ({ page }) => {
      await page.getByTestId('create-question').click()
      await page.getByTestId('insert-question-title').fill(QUESTION1.title)
      await page.getByTestId('insert-question-text').click()
      await page
        .getByTestId('insert-question-text')
        .pressSequentially(QUESTION1.content)

      await page.getByTestId('insert-answer-field-0').click()
      await page
        .getByTestId('insert-answer-field-0')
        .pressSequentially(QUESTION1.choices[0].value)

      for (let i = 1; i < QUESTION1.choices.length; i++) {
        await page.getByTestId('add-new-answer').click()
        await page.waitForTimeout(300)
        await page.getByTestId(`insert-answer-field-${i}`).click()
        await page
          .getByTestId(`insert-answer-field-${i}`)
          .pressSequentially(QUESTION1.choices[i].value)
      }

      await page.getByTestId('configure-sample-solution').click({ force: true })
      for (let i = 0; i < QUESTION1.choices.length; i++) {
        if (QUESTION1.choices[i].correct) {
          await page.getByTestId(`set-correctness-${i}`).click()
        }
      }

      await page.getByTestId('save-new-question').click({ force: true })
      await page.waitForTimeout(1000)
    })

    test('Create MC question 2 for bookmarking tests', async ({ page }) => {
      await page.getByTestId('create-question').click()

      await page.getByTestId('select-question-type').click()
      await page
        .getByTestId('select-question-type-Multiple Choice (MC)')
        .click()

      await page.getByTestId('insert-question-title').fill(QUESTION2.title)
      await page.getByTestId('insert-question-text').click()
      await page
        .getByTestId('insert-question-text')
        .pressSequentially(QUESTION2.content)

      await page.getByTestId('insert-answer-field-0').click()
      await page
        .getByTestId('insert-answer-field-0')
        .pressSequentially(QUESTION2.choices[0].value)

      for (let i = 1; i < QUESTION2.choices.length; i++) {
        await page.getByTestId('add-new-answer').click()
        await page.waitForTimeout(300)
        await page.getByTestId(`insert-answer-field-${i}`).click()
        await page
          .getByTestId(`insert-answer-field-${i}`)
          .pressSequentially(QUESTION2.choices[i].value)
      }

      await page.getByTestId('configure-sample-solution').click({ force: true })
      for (let i = 0; i < QUESTION2.choices.length; i++) {
        if (QUESTION2.choices[i].correct) {
          await page.getByTestId(`set-correctness-${i}`).click()
        }
      }

      await page.getByTestId('save-new-question').click({ force: true })
      await page.waitForTimeout(1000)
    })
  })

  // -------------------------------------------------------------------------
  // Part 1: Activity creation
  // -------------------------------------------------------------------------
  test.describe('Part 1: Activity creation', () => {
    test.beforeEach(async ({ loginLecturer }) => {
      await loginLecturer()
    })

    test('Create practice quiz with the two questions', async ({ page }) => {
      await page.getByTestId('activities').click()
      await page.getByTestId('create-new-activity').click()
      await page.getByTestId('create-practice-quiz').click()

      await page.getByTestId('practice-quiz-name').fill(PQ.name)
      await page.getByTestId('practice-quiz-display-name').fill(PQ.displayName)
      await page.getByTestId('select-course').click()
      await page.getByTestId(`select-course-${COURSE}`).click()
      await page.getByTestId('next-or-submit').click()

      // Step 2: settings
      await page.getByTestId('next-or-submit').click()

      // Step 3: stacks - stack 1 with question1
      await page.getByTestId('add-stack').click()
      await page.getByTestId('elements-search-input').fill(QUESTION1.title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${QUESTION1.title}`).click()

      // stack 2 with question2
      await page.getByTestId('add-stack').click()
      await page.getByTestId('elements-search-input').fill(QUESTION2.title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${QUESTION2.title}`).click()

      await page.getByTestId('next-or-submit').click()
      await page.waitForTimeout(1000)

      await page.getByTestId('activities').click()
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${PQ.name}`)
      ).toBeVisible()
    })

    test('Create microlearning with both questions', async ({ page }) => {
      await page.getByTestId('activities').click()
      await page.getByTestId('create-new-activity').click()
      await page.getByTestId('create-microlearning').click()

      await page.getByTestId('microlearning-name').fill(ML.name)
      await page.getByTestId('microlearning-display-name').fill(ML.displayName)
      await page.getByTestId('select-course').click()
      await page.getByTestId(`select-course-${COURSE}`).click()
      await page.getByTestId('next-or-submit').click()

      // Step 2: dates
      await page.getByTestId('next-or-submit').click()

      // Step 3: stacks
      await page.getByTestId('add-stack').click()
      await page.getByTestId('elements-search-input').fill(QUESTION1.title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${QUESTION1.title}`).click()

      await page.getByTestId('elements-search-input').fill(QUESTION2.title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${QUESTION2.title}`).click()

      await page.getByTestId('next-or-submit').click()
      await page.waitForTimeout(1000)

      await page.getByTestId('activities').click()
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${ML.name}`)
      ).toBeVisible()
    })
  })

  // -------------------------------------------------------------------------
  // Part 2: Flagging, voting and bookmarking on practice quiz
  // -------------------------------------------------------------------------
  test.describe('Part 2: Practice quiz flagging and bookmarking', () => {
    test('Publish the practice quiz', async ({ loginLecturer, page }) => {
      await loginLecturer()
      await page.getByTestId('courses').click()
      await page.getByTestId(`course-list-button-${COURSE}`).click()
      await page.getByTestId('tab-practiceQuizzes').click()
      await page.getByTestId(`publish-practice-quiz-${PQ.name}`).click()
      await page.getByTestId('publish-practice-quiz-immediately').click()
      await page.waitForTimeout(500)
    })

    test('Test flagging and student feedback on practice quiz', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()
      await page.getByTestId('quizzes').click()
      await page.getByTestId(`practice-quiz-${PQ.displayName}`).click()
      await page.getByTestId('start-practice-quiz').click()

      // Flag element 0 - submit with empty flag should be disabled
      await page.getByTestId('flag-element-0-button').click()
      await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
      await page.getByTestId('flag-element-textarea').fill(PQ.flag1)
      await expect(page.getByTestId('submit-flag-element')).not.toBeDisabled()
      await page.getByTestId('submit-flag-element').click()
      await page.waitForTimeout(4000) // wait for toast to disappear

      // Re-open and update flag
      await page.getByTestId('flag-element-0-button').click()
      await expect(page.getByTestId('submit-flag-element')).not.toBeDisabled()
      await expect(page.getByTestId('flag-element-textarea')).toHaveValue(
        PQ.flag1
      )
      await page.getByTestId('flag-element-textarea').clear()
      await page.getByTestId('flag-element-textarea').fill(PQ.flag2)
      await page.getByTestId('submit-flag-element').click()
      await page.waitForTimeout(4000)

      // Upvote then downvote
      await page.getByTestId('upvote-element-0-button').click()
      await page.waitForTimeout(500)
      await page.getByTestId('downvote-element-0-button').click()
      await page.waitForTimeout(500)
    })

    test('Bookmark the second element stack in the practice quiz', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()
      await page.getByTestId('quizzes').click()
      await page.getByTestId(`practice-quiz-${PQ.displayName}`).click()
      await page.getByTestId('start-practice-quiz').click()

      // Answer first stack
      await page.getByTestId('sc-0-answer-option-0').click()
      await page.getByTestId('student-stack-submit').click()
      await page.waitForTimeout(500)
      await page.getByTestId('student-stack-continue').click()

      // Bookmark second stack
      await page.getByTestId('bookmark-element-stack').click()
      await page.waitForTimeout(500)
    })

    test('Verify that the bookmarking action was successful', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()
      await page.getByTestId('bookmarks').click()
      await page.waitForTimeout(500)
      await page.getByTestId(`bookmarks-course-${COURSE}`).click()
      await page.getByTestId('start-practice-quiz').click()
      await expect(page.getByText(QUESTION2.content)).toBeVisible()

      // Answer and submit
      await page.getByTestId('mc-0-answer-option-1').click()
      await page.getByTestId('student-stack-submit').click()
      await page.waitForTimeout(500)
    })

    test('Verify that removing the bookmark works correctly', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()

      // Remove bookmark
      await page.getByTestId('bookmarks').click()
      await page.getByTestId(`bookmarks-course-${COURSE}`).click()
      await page.getByTestId('start-practice-quiz').click()
      await page.getByTestId('bookmark-element-stack').click()
      await page.waitForTimeout(500)

      // Navigate home and reload to verify removal
      await page.getByTestId('header-home').click()
      await page.reload()
      await page.getByTestId('bookmarks').click()
      await page.getByTestId(`bookmarks-course-${COURSE}`).click()
      // no bookmarks set
      await expect(page.getByText('No bookmarks set')).toBeVisible()
    })

    test('Cleanup: Delete the practice quiz', async ({
      loginLecturer,
      page,
    }) => {
      await loginLecturer()
      await page.getByTestId('courses').click()
      await page.getByTestId(`course-list-button-${COURSE}`).click()
      await page.getByTestId('tab-practiceQuizzes').click()
      await page.getByTestId(`actions-PRACTICE_QUIZ-${PQ.name}`).click()
      await page.getByTestId(`delete-practice-quiz-${PQ.name}`).click()
      await expect(
        page.getByTestId('confirmation-modal-confirm')
      ).toBeDisabled()
      await page.getByTestId('confirm-deletion-responses').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expect(
        page.getByTestId(`actions-PRACTICE_QUIZ-${PQ.name}`)
      ).not.toBeVisible()
    })

    test('Verify practice quiz is no longer visible to students', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()
      await page.getByTestId('quizzes').click()
      await expect(
        page.getByTestId(`practice-quiz-${PQ.displayName}`)
      ).not.toBeVisible()
    })
  })

  // -------------------------------------------------------------------------
  // Part 3: Flagging on microlearning
  // -------------------------------------------------------------------------
  test.describe('Part 3: Microlearning flagging', () => {
    test('Publish the microlearning', async ({ loginLecturer, page }) => {
      await loginLecturer()
      await page.getByTestId('courses').click()
      await page.getByTestId(`course-list-button-${COURSE}`).click()
      await page.getByTestId('tab-microLearnings').click()
      await page.getByTestId(`publish-microlearning-${ML.name}`).click()
      await page.getByTestId('confirm-publish-action').click()
      await page.waitForTimeout(500)
    })

    test('Test flagging and student feedback on microlearning', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()
      await page.getByTestId(`microlearning-${ML.displayName}`).click()
      await page.getByTestId('start-microlearning').click()

      // Flag with cancel
      await page.getByTestId('flag-element-0-button').click()
      await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
      await page.getByTestId('flag-element-textarea').fill(ML.flag1)
      await page.getByTestId('cancel-flag-element').click()

      // Flag again and submit
      await page.getByTestId('flag-element-0-button').click()
      await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
      await page.getByTestId('flag-element-textarea').fill(ML.flag1)
      await expect(page.getByTestId('submit-flag-element')).not.toBeDisabled()
      await page.getByTestId('submit-flag-element').click()
      await page.waitForTimeout(4000)

      // Vote
      await page.getByTestId('upvote-element-0-button').click()
      await page.waitForTimeout(500)
      await page.getByTestId('downvote-element-0-button').click()
      await page.waitForTimeout(500)

      // Update flag
      await page.getByTestId('flag-element-0-button').click()
      await expect(page.getByTestId('submit-flag-element')).not.toBeDisabled()
      await expect(page.getByTestId('flag-element-textarea')).toHaveValue(
        ML.flag1
      )
      await page.getByTestId('flag-element-textarea').clear()
      await page.getByTestId('flag-element-textarea').fill(ML.flag2)
      await page.getByTestId('submit-flag-element').click()
      await page.waitForTimeout(4000)

      // Verify flag2 is stored
      await page.getByTestId('flag-element-0-button').click()
      await expect(page.getByTestId('submit-flag-element')).not.toBeDisabled()
      await expect(page.getByTestId('flag-element-textarea')).toHaveValue(
        ML.flag2
      )
      await page.getByTestId('cancel-flag-element').click()

      // Solve the microlearning
      await page.getByTestId('sc-0-answer-option-0').click()
      await page.getByTestId('mc-1-answer-option-1').click()
      await page.getByTestId('student-stack-submit').click()
      await page.waitForTimeout(500)
      await page.getByTestId('student-stack-continue').click()
      await page.getByTestId('finish-microlearning').click()
    })

    test('Cleanup: Delete the microlearning', async ({
      loginLecturer,
      page,
    }) => {
      await loginLecturer()
      await page.getByTestId('courses').click()
      await page.getByTestId(`course-list-button-${COURSE}`).click()
      await page.getByTestId('tab-microLearnings').click()
      await page.getByTestId(`actions-MICRO_LEARNING-${ML.name}`).click()
      await page.getByTestId(`delete-microlearning-${ML.name}`).click()
      await expect(
        page.getByTestId('confirmation-modal-confirm')
      ).toBeDisabled()
      await page.getByTestId('confirm-deletion-responses').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expect(
        page.getByTestId(`actions-MICRO_LEARNING-${ML.name}`)
      ).not.toBeVisible()
    })

    test('Verify microlearning is no longer visible to students', async ({
      loginStudent,
      page,
    }) => {
      await loginStudent()
      await expect(
        page.getByTestId(`microlearning-${ML.displayName}`)
      ).not.toBeVisible()
    })
  })
})
