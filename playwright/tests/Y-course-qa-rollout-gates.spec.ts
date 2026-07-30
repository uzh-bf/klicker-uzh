import { cleanupTest } from '../util/cleanup.js'
import { COURSE_ID_TEST, URL_MANAGE, URL_STUDENT } from '../util/constants.js'
import { COURSE_QA_DATA, setCourseQAFlags } from '../util/courseQa.js'
import { expect, test } from '../util/fixtures.js'

const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
const studentUrl = process.env.URL_STUDENT ?? URL_STUDENT
const courseName = COURSE_QA_DATA.course
const enabledFlags = {
  isCourseQARolloutEnabled: true,
  isCourseQAEnabled: true,
  isCourseQAAnonymousEnabled: true,
}

test.describe.configure({ mode: 'serial' })

test('CLEANUP', async () => {
  await cleanupTest()
  await setCourseQAFlags(courseName, enabledFlags)
})

test.afterAll(async () => {
  await setCourseQAFlags(courseName, enabledFlags)
})

test.describe('Course Q&A rollout-gate workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('Creates a course thread for runtime-gate persistence checks', async ({
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

  test('Runtime gate off hides the integrated panel and shows the fallback notice', async ({
    page,
    loginStudent,
  }) => {
    await setCourseQAFlags(courseName, {
      isCourseQAEnabled: false,
    })

    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()
    await expect(page).toHaveURL(
      new RegExp(`/course/${COURSE_ID_TEST}(?:[/?#]|$)`)
    )
    await expect(page.getByTestId('course-overview-content')).toBeVisible()
    await expect(page.getByTestId('course-overview-qa-panel')).toHaveCount(0)

    await page.goto(`${studentUrl}/course/${COURSE_ID_TEST}/qa`)
    await expect(page.getByTestId('course-qa-disabled-notice')).toBeVisible()
    await expect(page.getByTestId('course-qa-thread-input')).toHaveCount(0)
  })

  test('Lecturer sees the disabled notice while the runtime gate is off', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.goto(`${manageUrl}/courses/${COURSE_ID_TEST}`)
    await expect(page.getByTestId('tab-discussions')).toBeVisible()
    await page.getByTestId('tab-discussions').click()
    await expect(page.getByTestId('course-qa-disabled-notice')).toBeVisible()
  })

  test('Runtime gate on restores the student panel and existing thread', async ({
    page,
    loginStudent,
  }) => {
    await setCourseQAFlags(courseName, {
      isCourseQAEnabled: true,
    })

    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()
    await expect(page.getByTestId('course-overview-qa-panel')).toBeVisible()
    await expect(page.getByTestId('course-qa-disabled-notice')).toHaveCount(0)
    await expect(
      page.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
  })

  test('Rollout gate off hides Q&A in Manage', async ({
    page,
    loginLecturer,
  }) => {
    await setCourseQAFlags(courseName, {
      isCourseQARolloutEnabled: false,
    })

    await loginLecturer()
    await page.goto(`${manageUrl}/courses/${COURSE_ID_TEST}`)
    await expect(page.getByTestId('course-name-with-pin')).toContainText(
      courseName
    )
    await expect(page.getByTestId('tab-discussions')).toHaveCount(0)
  })

  test('Rollout gate off fails closed for student integrated and fallback views', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()
    await expect(page).toHaveURL(
      new RegExp(`/course/${COURSE_ID_TEST}(?:[/?#]|$)`)
    )
    await expect(page.getByTestId('course-overview-content')).toBeVisible()
    await expect(page.getByTestId('course-overview-qa-panel')).toHaveCount(0)

    await page.goto(`${studentUrl}/course/${COURSE_ID_TEST}/qa`)
    await expect(page.getByTestId('course-qa-access-denied')).toBeVisible()
    await expect(page.getByTestId('course-qa-thread-input')).toHaveCount(0)
  })
})
