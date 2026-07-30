import type { Locator, Page } from '@playwright/test'
import { cleanupTest } from '../util/cleanup.js'
import {
  COURSE_ID_TEST,
  STUDENT_USERNAME2,
  URL_MANAGE,
  URL_STUDENT,
} from '../util/constants.js'
import {
  COURSE_QA_DATA,
  getCourseOverviewSettings,
  grantCourseReadAccess,
  seedCourseDiscussionThreads,
  setCourseQAFlags,
} from '../util/courseQa.js'
import { expect, test } from '../util/fixtures.js'

const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
const studentUrl = process.env.URL_STUDENT ?? URL_STUDENT
const courseName = COURSE_QA_DATA.course

test.describe.configure({ mode: 'serial' })

function courseThread(page: Page, content: string): Locator {
  return page
    .getByTestId(/^course-qa-thread-\d+$/)
    .filter({ has: page.getByText(content, { exact: true }) })
    .first()
}

test('CLEANUP', async () => {
  await cleanupTest()
  await setCourseQAFlags(courseName, {
    isCourseQARolloutEnabled: true,
    isCourseQAEnabled: true,
    isCourseQAAnonymousEnabled: true,
  })
})

test.describe('Course Q&A course-level workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('Lecturer sees Q&A tab on rollout-enabled course with empty overview initially', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${courseName}`).click()

    await page.getByTestId('tab-discussions').click()
    await expect(page.getByTestId('course-qa-overview-empty')).toBeVisible()
    await expect(page.getByTestId('course-qa-generate-embed')).toBeAttached()
  })

  test('Lecturer sees course-level Q&A settings', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${courseName}`).click()
    await page.getByTestId('course-settings-button').click()

    await expect(page.getByTestId('course-qa-enabled')).toBeVisible()
    await expect(page.getByTestId('course-qa-anonymous-enabled')).toBeVisible()
    await page.locator('body').press('Escape')
  })

  test('Read-only course users do not see write-only Q&A tools', async ({
    page,
    loginFreeUser,
  }) => {
    await grantCourseReadAccess(courseName, 'free@df.uzh.ch')
    await loginFreeUser()
    await page.goto(`${manageUrl}/courses/${COURSE_ID_TEST}?tab=discussions`)

    await expect(page).toHaveURL(
      new RegExp(`/courses/${COURSE_ID_TEST}(?:\\?tab=discussions)?$`)
    )
    await expect(page.getByTestId('course-name-with-pin')).toContainText(
      courseName
    )
    await expect(page.getByTestId('tab-discussions')).toHaveCount(0)
    await expect(page.getByTestId('course-qa-overview-empty')).toHaveCount(0)
    await expect(page.getByTestId('course-qa-generate-embed')).toHaveCount(0)
  })

  test('Student sees integrated Q&A on the course overview and can open the fallback page', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()

    const panel = page.getByTestId('course-overview-qa-panel')
    const content = page.getByTestId('course-overview-content')
    await expect(panel).toBeVisible()
    await expect(page).not.toHaveURL(/\/qa(?:[/?#]|$)/)
    await expect(page.getByTestId('course-qa-empty')).toBeVisible()

    const [panelBox, contentBox] = await Promise.all([
      panel.boundingBox(),
      content.boundingBox(),
    ])
    expect(panelBox).not.toBeNull()
    expect(contentBox).not.toBeNull()
    expect(panelBox!.x).toBeGreaterThanOrEqual(
      contentBox!.x + contentBox!.width
    )

    await page.goto(`${studentUrl}/course/${COURSE_ID_TEST}/qa`)
    await expect(page).toHaveURL(
      new RegExp(`/course/${COURSE_ID_TEST}/qa(?:[/?#]|$)`)
    )
    await expect(page.getByTestId('course-qa-empty')).toBeVisible()
  })

  test('Student can expand the collapsed course Q&A on mobile', async ({
    page,
    loginStudent,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()

    const toggle = page.getByTestId('course-overview-qa-toggle')
    const panel = page.getByTestId('course-overview-qa-panel')
    const content = page.getByTestId('course-overview-content')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('course-qa-thread-input')).toBeHidden()

    const contentHandle = await content.elementHandle()
    if (!contentHandle) {
      throw new Error('Course overview content did not render')
    }
    const sourceOrder = await panel.evaluate(
      (panelElement, contentElement) => ({
        sameParent: panelElement.parentElement === contentElement.parentElement,
        directlyBefore: panelElement.nextElementSibling === contentElement,
      }),
      contentHandle
    )
    expect(sourceOrder).toEqual({
      sameParent: true,
      directlyBefore: true,
    })

    const [panelBox, contentBox] = await Promise.all([
      panel.boundingBox(),
      content.boundingBox(),
    ])
    expect(panelBox).not.toBeNull()
    expect(contentBox).not.toBeNull()
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(contentBox!.y)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('course-qa-thread-input')).toBeVisible()
  })

  test('Malformed external scope links fail closed without crashing the fallback page', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await expect(page.getByTestId(`course-button-${courseName}`)).toBeVisible()
    const malformedScope = encodeURIComponent('ext:%E0%A4%A:ref')
    await page.goto(
      `${studentUrl}/course/${COURSE_ID_TEST}/qa?scopeKey=${malformedScope}`
    )

    await expect(page.getByTestId('course-qa-access-denied')).toBeVisible()
    await expect(page.getByTestId('course-qa-thread-input')).toHaveCount(0)
  })

  test('Student sees integrated Q&A when the course has no other overview content', async ({
    page,
    loginStudent,
  }) => {
    const originalSettings = await getCourseOverviewSettings(courseName)
    await setCourseQAFlags(courseName, {
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
      description: null,
    })

    try {
      await loginStudent()
      await expect(
        page.getByTestId(`course-button-${courseName}`)
      ).toBeVisible()
      await page.goto(`${studentUrl}/course/${COURSE_ID_TEST}`)
      await expect(page.getByTestId('course-overview-qa-panel')).toBeVisible()
      await expect(page.getByTestId('course-qa-empty')).toBeVisible()
    } finally {
      await setCourseQAFlags(courseName, originalSettings)
    }
  })

  test('Student creates a course-level thread and sees it appear', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()

    const createButton = page.getByTestId('course-qa-create-thread')
    await expect(createButton).toBeDisabled()
    await page
      .getByTestId('course-qa-thread-input')
      .fill(COURSE_QA_DATA.threads.course1)
    await expect(createButton).toBeEnabled()
    await createButton.click()

    await expect(
      page.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
    await expect(page.getByTestId('course-qa-empty')).toHaveCount(0)
  })

  test('Student upvotes their newly created thread and toggles it back off', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()

    const thread = courseThread(page, COURSE_QA_DATA.threads.course1)
    await expect(thread).toBeVisible()
    const upvote = thread.getByTestId(/^course-qa-thread-upvote-\d+$/)
    await expect(upvote).toHaveAttribute('aria-pressed', 'false')
    await expect(upvote).toHaveAttribute('aria-label', 'Upvote question')
    await upvote.click()
    await expect(upvote).toContainText('1')
    await expect(upvote).toHaveAttribute('aria-pressed', 'true')
    await expect(upvote).toHaveAttribute('aria-label', 'Upvote question')
    await upvote.click()
    await expect(upvote).toContainText('0')
    await expect(upvote).toHaveAttribute('aria-pressed', 'false')
    await expect(upvote).toHaveAttribute('aria-label', 'Upvote question')
  })

  test('Student replies to the thread and upvotes the reply', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${courseName}`).click()

    const thread = courseThread(page, COURSE_QA_DATA.threads.course1)
    const replyInput = thread.getByTestId(/^course-qa-reply-input-\d+$/)
    const replyToggle = thread.getByTestId(/^course-qa-open-reply-\d+$/)
    await expect(replyInput).toBeHidden()
    await expect(replyToggle).toHaveAttribute('aria-expanded', 'false')
    await replyToggle.click()
    await expect(replyToggle).toHaveAttribute('aria-expanded', 'true')

    await replyInput.fill('Discarded draft')
    await thread.getByTestId(/^course-qa-cancel-reply-\d+$/).click()
    await expect(replyToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(replyToggle).toBeFocused()

    await replyToggle.click()
    await expect(replyInput).toHaveValue('')
    await replyInput.fill(COURSE_QA_DATA.threads.reply1)
    await thread.getByTestId(/^course-qa-create-reply-\d+$/).click()
    await expect(
      thread.getByText(COURSE_QA_DATA.threads.reply1, { exact: true })
    ).toBeVisible()

    const replyUpvote = thread.getByTestId(/^course-qa-reply-upvote-\d+$/)
    await expect(replyUpvote).toHaveAttribute('aria-pressed', 'false')
    await expect(replyUpvote).toHaveAttribute('aria-label', 'Upvote reply')
    await replyUpvote.click()
    await expect(replyUpvote).toContainText('1')
    await expect(replyUpvote).toHaveAttribute('aria-pressed', 'true')
    await expect(replyUpvote).toHaveAttribute('aria-label', 'Upvote reply')
  })

  test('Lecturer reviews a complete thread and its replies inline', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.goto(`${manageUrl}/courses/${COURSE_ID_TEST}`)
    await page.getByTestId('tab-discussions').click()

    const thread = page
      .getByTestId(/^course-qa-overview-thread-\d+$/)
      .filter({ hasText: COURSE_QA_DATA.threads.course1 })
    const toggle = thread.getByTestId(/^course-qa-overview-thread-toggle-\d+$/)
    const content = thread.getByTestId(
      /^course-qa-overview-thread-content-\d+$/
    )
    await expect(thread).toHaveCount(1)
    await expect(thread).not.toHaveAttribute('open', '')
    await expect(toggle.getByLabel('0 upvotes')).toBeVisible()
    await expect
      .poll(() =>
        content.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      )
      .toBe(true)

    await toggle.press('Enter')

    await expect(thread).toHaveAttribute('open', '')
    await expect
      .poll(() =>
        content.evaluate(
          (element) => element.scrollHeight === element.clientHeight
        )
      )
      .toBe(true)
    await expect(
      thread.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
    const reply = thread.getByTestId(/^course-qa-overview-reply-\d+$/)
    await expect(reply).toHaveCount(1)
    await expect(reply).toContainText(COURSE_QA_DATA.threads.reply1)
    await expect(reply.getByLabel('1 upvote')).toBeVisible()
  })

  test('A second student can see the first thread and post their own', async ({
    page,
    loginStudentPassword,
  }) => {
    await loginStudentPassword(STUDENT_USERNAME2)
    await page.getByTestId(`course-button-${courseName}`).click()

    await expect(
      page.getByText(COURSE_QA_DATA.threads.course1, { exact: true })
    ).toBeVisible()
    await page
      .getByTestId('course-qa-thread-input')
      .fill(COURSE_QA_DATA.threads.course2)
    await page.getByTestId('course-qa-create-thread').click()
    await expect(
      page.getByText(COURSE_QA_DATA.threads.course2, { exact: true })
    ).toBeVisible()
  })

  test('Lecturer refreshes paginated discussions without losing a boundary thread', async ({
    page,
    loginLecturer,
  }) => {
    const initialThreads = Array.from(
      { length: 21 },
      (_, index) => `Pagination thread ${index + 1}`
    )
    const newestThread = 'Pagination thread added after page two'
    await seedCourseDiscussionThreads({
      courseName,
      contents: initialThreads,
      replaceExisting: true,
    })

    await loginLecturer()
    await page.goto(`${manageUrl}/courses/${COURSE_ID_TEST}`)
    await page.getByTestId('tab-discussions').click()

    const overviewThreads = page.getByTestId(/^course-qa-overview-thread-\d+$/)
    await expect(overviewThreads).toHaveCount(20)
    await page.getByTestId('course-qa-load-more-overview').click()
    await expect(overviewThreads).toHaveCount(21)

    await seedCourseDiscussionThreads({
      courseName,
      contents: [newestThread],
    })
    await page.getByTestId('course-qa-refresh-overview').click()
    await expect(page.getByText(newestThread, { exact: true })).toBeVisible()

    const loadMore = page.getByTestId('course-qa-load-more-overview')
    await expect(loadMore).toBeEnabled()
    await loadMore.click()
    await expect(overviewThreads).toHaveCount(22)
    await expect(
      page.getByText('Pagination thread 2', { exact: true })
    ).toBeVisible()
  })
})
