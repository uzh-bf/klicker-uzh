/**
 * C-control.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/C-control-workflow.cy.ts
 * Tests the frontend-control application: creating a live quiz via DB helper,
 * running it from the control app, and cleaning up.
 */

import { cleanupTest } from '../util/cleanup.js'
import { CONTROL_DATA, LECTURER_ID, viewPorts } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { createQuestionSC } from '../util/fixtures/elements.js'
import { removeSoftDeletedLiveQuiz } from '../util/fixtures/manage.js'

test('CLEANUP', cleanupTest)

test.describe('Test functionalities of frontend-control application', () => {
  test('Create a live quiz with a new SC question to test execution from control app', async ({
    page,
    loginLecturer,
    createLiveQuiz,
  }) => {
    // Seed the SC question directly via DB helper
    await createQuestionSC({
      name: CONTROL_DATA.questionTitle,
      content: CONTROL_DATA.questionContent,
      choices: [{ value: '50%' }, { value: '100%' }],
      userId: LECTURER_ID,
    })

    await loginLecturer()
    await page.reload()

    await createLiveQuiz(page, {
      name: CONTROL_DATA.quizName,
      displayName: CONTROL_DATA.quizDisplayName,
      questionTitle: CONTROL_DATA.questionTitle,
    })
  })

  test('Log in as the lecturer in the control application and test different screen sizes', async ({
    page,
    loginLecturerControl,
  }) => {
    await loginLecturerControl()

    // PPT link and start quiz
    await page.getByTestId('unassigned-live-quizzes').click()
    await expect(
      page.getByTestId(`ppt-link-${CONTROL_DATA.quizName}`)
    ).toBeVisible()
    await page.getByTestId(`ppt-link-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('close-embedding-modal').click()
    await page.getByTestId(`start-live-quiz-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('confirm-start-live-quiz').click()

    // Mobile menu test (iphone-6: 375x667)
    await page.setViewportSize(viewPorts.iphone6)
    await page.getByTestId('ppt-button').click()
    await page.getByTestId('close-embedding-modal').click()
    await page.getByTestId('home-button').click()
    await page.getByTestId('unassigned-live-quizzes').click()
    await page.getByTestId(`running-live-quiz-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('back-button').click()
    await page.getByTestId(`running-live-quiz-${CONTROL_DATA.quizName}`).click()
    await page.setViewportSize(viewPorts.default)

    // Open block, deactivate, end quiz
    await page.getByTestId('activate-next-block').click()
    await page.getByTestId('deactivate-block').click()
    await page.getByTestId('end-live-quiz').click()

    await expect(
      page.getByTestId(`start-live-quiz-${CONTROL_DATA.quizName}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`running-live-quiz-${CONTROL_DATA.quizName}`)
    ).not.toBeVisible()
  })

  test('Cleanup: Delete the created and completed live quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${CONTROL_DATA.quizName}`)
    ).toBeVisible()
    await page.getByTestId(`actions-LIVE_QUIZ-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId(`delete-live-quiz-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expect(page.getByText(CONTROL_DATA.quizName)).not.toBeVisible()
  })

  test('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', async ({
    loginLecturer,
  }) => {
    await removeSoftDeletedLiveQuiz({ lqName: CONTROL_DATA.quizName })
    await loginLecturer()
  })
})
