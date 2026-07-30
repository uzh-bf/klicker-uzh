import { cleanupTest } from '../util/cleanup.js'
import { LECTURER_ID } from '../util/constants.js'
import { COURSE_QA_DATA, setCourseQAFlags } from '../util/courseQa.js'
import { expect, test } from '../util/fixtures.js'
import { createPracticeQuiz } from '../util/fixtures/activities.js'
import { createQuestionSC } from '../util/fixtures/elements.js'

const courseName = COURSE_QA_DATA.course

test.describe.configure({ mode: 'serial' })

test('CLEANUP', async () => {
  await cleanupTest()
  await setCourseQAFlags(courseName, {
    isCourseQARolloutEnabled: true,
    isCourseQAEnabled: true,
    isCourseQAAnonymousEnabled: true,
  })
})

test.describe('Course Q&A practice workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('Lecturer creates the practice question', async () => {
    expect(
      await createQuestionSC({
        name: COURSE_QA_DATA.question.title,
        content: COURSE_QA_DATA.question.content,
        choices: [...COURSE_QA_DATA.question.choices],
        userId: LECTURER_ID,
      })
    ).toBe(true)
  })

  test('Lecturer creates and publishes the practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createPracticeQuiz(page, {
      name: COURSE_QA_DATA.practiceQuiz.name,
      displayName: COURSE_QA_DATA.practiceQuiz.displayName,
      courseName,
      stacks: [{ elements: [COURSE_QA_DATA.question.title] }],
    })

    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${courseName}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`publish-practice-quiz-${COURSE_QA_DATA.practiceQuiz.name}`)
      .click()
    const publication = page.waitForResponse((response) => {
      const request = response.request()
      return (
        request.method() === 'POST' &&
        request
          .postData()
          ?.includes('"operationName":"PublishPracticeQuiz"') === true
      )
    })
    await page.getByTestId('publish-practice-quiz-immediately').click()
    const publicationResponse = await publication
    expect(publicationResponse.ok()).toBe(true)
    const publicationResult = (await publicationResponse.json()) as {
      data?: { publishPracticeQuiz?: { status?: string } }
      errors?: unknown[]
    }
    expect(publicationResult.errors).toBeUndefined()
    expect(publicationResult.data?.publishPracticeQuiz?.status).toBe(
      'PUBLISHED'
    )
    await expect(
      page.getByTestId('publish-practice-quiz-immediately')
    ).toBeHidden()
  })

  test('Student creates a course-level thread for scope-boundary checks', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()
    await page
      .getByTestId('course-qa-thread-input')
      .fill(COURSE_QA_DATA.threads.course1)
    await page.getByTestId('course-qa-create-thread').click()
    await expect(
      page.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
  })

  test('Student completes a practice stack and posts in the integrated discussion', async ({
    page,
    loginStudent,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await page
      .getByTestId(`practice-quiz-${COURSE_QA_DATA.practiceQuiz.displayName}`)
      .click()
    await page.getByTestId('start-practice-quiz').click()

    const rail = page.getByTestId('student-stack-discussion-rail')
    const toggle = page.getByTestId('student-stack-discussion-toggle')
    await expect(rail).toHaveCount(0)
    const answer = page.getByTestId('sc-0-answer-option-0')
    await expect(answer).toBeVisible()
    await expect(answer).toBeEnabled()
    await answer.focus()
    await expect(answer).toBeFocused()
    await answer.press('Enter')
    const submit = page.getByTestId('student-stack-submit')
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(rail).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('course-qa-thread-input')).toBeHidden()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page).not.toHaveURL(/\/qa(?:[/?#]|$)/)

    await page
      .getByTestId('course-qa-thread-input')
      .fill(COURSE_QA_DATA.threads.stack1)
    await page.getByTestId('course-qa-create-thread').click()
    await expect(
      page.getByText(COURSE_QA_DATA.threads.stack1, { exact: true })
    ).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(toggle).toBeHidden()
    await expect(page.getByTestId('course-qa-thread-input')).toBeVisible()

    const content = rail.locator('xpath=preceding-sibling::*[1]')
    const [railBox, contentBox] = await Promise.all([
      rail.boundingBox(),
      content.boundingBox(),
    ])
    expect(railBox).not.toBeNull()
    expect(contentBox).not.toBeNull()
    expect(railBox!.x).toBeGreaterThanOrEqual(contentBox!.x + contentBox!.width)
  })

  test('Course feed excludes stack-scoped threads', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()

    await expect(page.getByTestId('course-overview-qa-panel')).toBeVisible()
    await expect(
      page.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(COURSE_QA_DATA.threads.stack1, { exact: true })
    ).toHaveCount(0)
  })

  test('Lecturer overview groups course and stack threads', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${courseName}`).click()
    await page.getByTestId('tab-discussions').click()
    await page.getByTestId('course-qa-refresh-overview').click()

    const groups = page.getByTestId('course-qa-overview-groups')
    await expect(groups).toBeVisible()
    const sourceGroup = groups
      .locator('[data-cy^="course-qa-overview-group-"]')
      .filter({ hasText: COURSE_QA_DATA.threads.course1 })
      .filter({ hasText: COURSE_QA_DATA.threads.stack1 })
    await expect(sourceGroup).toBeVisible()
    await expect(
      sourceGroup.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
    await expect(
      sourceGroup.getByText(COURSE_QA_DATA.threads.stack1, { exact: true })
    ).toBeVisible()
    await expect(
      sourceGroup.locator('span').filter({ hasText: /^Course$/ })
    ).toBeVisible()
    await expect(
      sourceGroup.getByText('Practice stack 0', { exact: true })
    ).toBeVisible()
  })
})
