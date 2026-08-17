import bookmarkingData from '../fixtures/R-bookmarking.json' with { type: 'json' }
import { cleanupTest } from '../util/cleanup.js'
import { LECTURER_ID, URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createMicroLearning,
  createPracticeQuiz,
  removeSoftDeletedMicrolearning,
  removeSoftDeletedPracticeQuiz,
} from '../util/fixtures/activities.js'
import {
  createQuestionMC,
  createQuestionSC,
  validateElement,
} from '../util/fixtures/elements.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'

const data = bookmarkingData

test('CLEANUP', cleanupTest)

async function createQuestionAndValidate(
  page: Parameters<typeof validateElement>[0],
  type: 'SC' | 'MC',
  question: typeof data.question1
) {
  if (type === 'SC') {
    await createQuestionSC({
      name: question.title,
      content: question.content,
      choices: question.choices,
      userId: LECTURER_ID,
    })
  } else {
    await createQuestionMC({
      name: question.title,
      content: question.content,
      choices: question.choices,
      userId: LECTURER_ID,
    })
  }

  await page.reload()
  await validateElement(page, question.title)
}

test.describe('Test bookmarking and flagging workflows for practice quizzes and microlearnings', () => {
  test('Creates the questions that should be bookmarked and/or flagged', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createQuestionAndValidate(page, 'SC', data.question1)
    await createQuestionAndValidate(page, 'MC', data.question2)
  })

  test('Create a practice quiz with the created questions', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createPracticeQuiz(page, {
      name: data.PQ.name,
      displayName: data.PQ.displayName,
      courseName: data.course,
      stacks: [
        { elements: [data.question1.title] },
        { elements: [data.question2.title] },
      ],
    })
  })

  test('Create a microlearning with the created questions', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createMicroLearning(page, {
      name: data.ML.name,
      displayName: data.ML.displayName,
      courseName: data.course,
      startDate: {
        monthDelta: -2,
        day: 16,
        hour: 2,
        minute: 0,
        validation: `${getDatetimeValidationString(-2, '16')}, 02:00`,
      },
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: `${getDatetimeValidationString(4, '14')}, 18:00`,
      },
      stacks: [{ elements: [data.question1.title, data.question2.title] }],
    })
  })

  test('Publish the practice quiz', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`publish-practice-quiz-${data.PQ.name}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
  })

  test('Test flagging and student feedback functionalities on practice quiz', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${data.PQ.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await page.getByTestId('flag-element-0-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
    await page.getByTestId('flag-element-textarea').fill(data.PQ.flag1)
    await expect(page.getByTestId('submit-flag-element')).toBeEnabled()
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000)
    await page.getByTestId('flag-element-0-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeEnabled()
    await expect(page.getByTestId('flag-element-textarea')).toHaveValue(
      data.PQ.flag1
    )
    await page.getByTestId('flag-element-textarea').clear()
    await page.getByTestId('flag-element-textarea').fill(data.PQ.flag2)
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000)
    await page.getByTestId('upvote-element-0-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('downvote-element-0-button').click()
    await page.waitForTimeout(500)
  })

  test('Bookmark the second element stack in the practice quiz', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${data.PQ.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('bookmark-element-stack').click()
  })

  test('Verify that the bookmarking action was successful', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('bookmarks').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`bookmarks-course-${data.course}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(data.question2.content)).toBeVisible()
    await page.getByTestId('mc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
  })

  test('Verify that removing the bookmarking works as expected', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()

    await page.getByTestId('bookmarks').click()
    await page.getByTestId(`bookmarks-course-${data.course}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await page.getByTestId('bookmark-element-stack').click()

    await page.getByTestId('header-home').click()
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.reload()
    await page.getByTestId('bookmarks').click()
    await page.getByTestId(`bookmarks-course-${data.course}`).click()
    await expect(
      page.getByText(messages.pwa.courses.noBookmarksSet)
    ).toBeVisible()
  })

  test('Cleanup: Delete the created practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()

    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${data.PQ.name}`).click()
    await page.getByTestId(`delete-practice-quiz-${data.PQ.name}`).click()
    await expect(page.getByTestId('confirmation-modal-confirm')).toBeDisabled()
    await page.getByTestId('confirm-deletion-responses').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expect(
      page.getByTestId(`actions-PRACTICE_QUIZ-${data.PQ.name}`)
    ).not.toBeAttached()
  })

  test('Cleanup (DB): Hard delete soft-deleted practice quiz (with results) directly in database', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.waitForTimeout(2000)
    const result = await removeSoftDeletedPracticeQuiz(data.PQ.name)
    expect(result).toBe(true)
    await page.goto(process.env.URL_MANAGE ?? URL_MANAGE)
  })

  test("Verify that the practice quiz is no longer visible on the student's view", async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await expect(
      page.getByTestId(`practice-quiz-${data.PQ.displayName}`)
    ).not.toBeAttached()
  })

  test('Publish the microlearning', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`publish-microlearning-${data.ML.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
  })

  test('Test flagging and student feedback functionalities on microlearning', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`microlearning-${data.ML.displayName}`).click()
    await page.getByTestId('start-microlearning').click()
    await page.getByTestId('flag-element-0-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
    await page.getByTestId('flag-element-textarea').fill(data.ML.flag1)
    await page.getByTestId('cancel-flag-element').click()
    await page.getByTestId('flag-element-0-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
    await page.getByTestId('flag-element-textarea').fill(data.ML.flag1)
    await expect(page.getByTestId('submit-flag-element')).toBeEnabled()
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000)
    await page.getByTestId('upvote-element-0-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('downvote-element-0-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('flag-element-0-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeEnabled()
    await expect(page.getByTestId('flag-element-textarea')).toHaveValue(
      data.ML.flag1
    )
    await page.getByTestId('flag-element-textarea').clear()
    await page.getByTestId('flag-element-textarea').fill(data.ML.flag2)
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000)
    await page.getByTestId('flag-element-0-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeEnabled()
    await expect(page.getByTestId('flag-element-textarea')).toHaveValue(
      data.ML.flag2
    )
    await page.getByTestId('cancel-flag-element').click()

    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('finish-microlearning').click()
  })

  test('Cleanup: Delete the created microlearning', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()

    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`actions-MICRO_LEARNING-${data.ML.name}`).click()
    await page.getByTestId(`delete-microlearning-${data.ML.name}`).click()
    await expect(page.getByTestId('confirmation-modal-confirm')).toBeDisabled()
    await page.getByTestId('confirm-deletion-responses').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expect(
      page.getByTestId(`actions-MICRO_LEARNING-${data.ML.name}`)
    ).not.toBeAttached()
  })

  test('Cleanup (DB): Hard delete soft-deleted microlearning (with feedbacks) directly in database', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.waitForTimeout(2000)
    const result = await removeSoftDeletedMicrolearning(data.ML.name)
    expect(result).toBe(true)
    await page.goto(process.env.URL_MANAGE ?? URL_MANAGE)
  })

  test("Verify that the microlearning is no longer visible on the student's view", async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await expect(
      page.getByTestId(`microlearning-${data.ML.displayName}`)
    ).not.toBeAttached()
  })
})
