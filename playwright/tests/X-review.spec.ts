// @ts-nocheck
/**
 * Playwright translation of X-review.
 * Mirrors the original Cypress workflow with native Playwright actions.
 */
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import {
  chooseActivityAction,
  chooseCourseAction,
  type ActivityActionType,
} from '../util/actions.js'
import { test } from '../util/fixtures.js'
import { getDatetimeValidationString, getFutureDate } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import {
  createAnswerCollection,
  createContent,
  createCourse,
  createFlashcard,
  createGroupActivity,
  createLiveQuiz,
  createMicroLearning,
  createPracticeQuiz,
  createQuestionCS,
  createQuestionFT,
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionNR,
  createQuestionSC,
  createQuestionSE,
  env,
  expectByAssertion,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginInstitutionalCatalyst2,
  loginInstitutionalCatalyst3,
  loginLecturer,
  logoutUser,
  runTask,
  selectOption,
  shareObject,
  typeInto,
} from '../util/workflow.js'

function readFixture(name: string) {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  )
}

let page: Page
const aliases = new Map<string, unknown>()
const data = Object.assign(
  {},
  readFixture('questions.json'),
  readFixture('X-review.json')
)

test.describe
  .serial('Feature test for review functionalities and batch operations', () => {
  async function chooseReviewActivityAction(
    activity: { name: string; type: ActivityActionType },
    actionTestId: string
  ) {
    await chooseActivityAction(page, activity.type, activity.name, actionTestId)
  }

  async function openActivityInformation(activity: {
    name: string
    type: ActivityActionType
  }) {
    await chooseReviewActivityAction(
      activity,
      `activity-information-${activity.name}`
    )
  }

  async function editActivity(
    type: ActivityActionType,
    name: string,
    actionTestId: string
  ) {
    await chooseActivityAction(page, type, name, actionTestId)
  }

  async function verifyActivityReviewButtonVisibility(
    data: any,
    expectedVisibility: boolean
  ) {
    await page.getByTestId('activities').click()
    for (const activity of [
      { name: data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      await openActivityInformation(activity)
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        expectedVisibility ? 'exist' : 'not.exist'
      )
      await page.getByTestId('close-activity-details-modal').click()
    }
  }

  async function markAllActivitiesAsReviewed(data: any) {
    for (const activity of [
      { name: data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      await openActivityInformation(activity)
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        'contain',
        messages.manage.activities.reviewCompleted
      )
      await page.getByTestId('activity-review-button').click()
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        'contain',
        messages.manage.activities.resetReview
      )
      await page.getByTestId('close-activity-details-modal').click()
      await expectByAssertion(
        page.getByTestId(`activity-${activity.type}-${activity.name}`),
        'contain',
        messages.shared.generic.reviewStatusREVIEWED
      )
    }
  }

  const validCourseStart = getFutureDate(1, '11')

  const validCourseGroupDeadline = getFutureDate(2, '12')

  const validCourseEnd = getFutureDate(12, '20')

  const invalidCourseStart = getFutureDate(3, '20')

  const invalidCourseGroupDeadline = getFutureDate(3, '21')

  const invalidCourseEnd = getFutureDate(5, '20')

  const activityStart = {
    monthDelta: 3,
    day: 11,
    hour: 2,
    minute: 0,
    validation: getDatetimeValidationString(3, '11') + ', 02:00',
  }

  const activityEnd = {
    monthDelta: 7,
    day: 20,
    hour: 18,
    minute: 0,
    validation: getDatetimeValidationString(7, '20') + ', 18:00',
  }

  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Prepare two questions, one course, one activity of each type (two live quizzes - one without a course)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML.title,
      content: data.MCML.content,
      choices: data.MCML.choices,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('courses').click()
    await createCourse(page, {
      name: data.review.course.name,
      displayName: data.review.course.displayName,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: getFutureDate(1, '11'),
      endDate: getFutureDate(12, '20'),
      groupDeadlineDate: getFutureDate(1, '12'),
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await createCourse(page, {
      name: data.review.course2.name,
      displayName: data.review.course2.displayName,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: getFutureDate(1, '11'),
      endDate: getFutureDate(12, '20'),
      groupDeadlineDate: getFutureDate(1, '12'),
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await page.getByTestId('library').click()
    await createLiveQuiz(page, {
      name: data.review.liveQuizNoCourse,
      displayName: data.review.liveQuizNoCourse,
      blocks: [{ elements: [data.SCML.title, data.MCML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createLiveQuiz(page, {
      name: data.review.liveQuiz,
      displayName: data.review.liveQuiz,
      courseName: data.review.course.name,
      blocks: [{ elements: [data.SCML.title, data.MCML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createPracticeQuiz(page, {
      name: data.review.practiceQuiz,
      displayName: data.review.practiceQuiz,
      courseName: data.review.course.name,
      stacks: [{ elements: [data.SCML.title, data.MCML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createMicroLearning(page, {
      name: data.review.microLearning,
      displayName: data.review.microLearning,
      startDate: {
        monthDelta: 3,
        day: 11,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(3, '11') + ', 02:00',
      }, // 3 months in the future at 2:00 (defaults at first of next month)
      endDate: {
        monthDelta: 7,
        day: 20,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(7, '20') + ', 18:00',
      }, // 7 months in the future at 18:00 (defaults at second of next month)
      courseName: data.review.course.name,
      stacks: [{ elements: [data.SCML.title, data.MCML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createGroupActivity(page, {
      name: data.review.groupActivity,
      displayName: data.review.groupActivity,
      courseName: data.review.course.name,
      scheduledStartDate: {
        monthDelta: 3,
        day: 11,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(3, '11') + ', 02:00',
      }, // 3 months in the future at 2:00
      scheduledEndDate: {
        monthDelta: 7,
        day: 20,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(7, '20') + ', 18:00',
      }, // 7 months in the future at 18:00
      task: 'TASK',
      clues: [
        {
          type: 'text',
          name: 'Clue 1',
          displayName: 'First Hint',
          content: 'Lorem ipsum dolor sit amet',
        },
        {
          type: 'text',
          name: 'Clue 2',
          displayName: 'Second Hint',
          content: 'Consectetur adipiscing elit',
        },
      ],
      stack: {
        elements: [data.SCML.title, data.MCML.title],
      },
    })
    await page.getByTestId('create-new-activity').click()
  })

  test('Share the live quiz without a course and the course with other users with READ, EXECUTE, WRITE, and ADMIN permissions, respectively', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await chooseActivityAction(
      page,
      'LIVE_QUIZ',
      data.review.liveQuizNoCourse,
      `share-live-quiz-${data.review.liveQuizNoCourse}`
    )
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_IND_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsREAD,
    })
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsEXECUTE,
    })
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST2_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsWRITE,
    })
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST3_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsADMIN,
    })
    await page.getByTestId(`close-share-object`).click()
    await page.goto(`${env('URL_MANAGE')}/courses`, { waitUntil: 'commit' })
    await page
      .getByTestId(`course-list-button-${data.review.course.name}`)
      .click()
    await expect(page.getByTestId('course-name-with-pin')).toContainText(
      data.review.course.name
    )
    await chooseCourseAction(page, 'course-share-button')
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_IND_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsREAD,
    })
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsEXECUTE,
    })
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST2_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsWRITE,
    })
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST3_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsADMIN,
    })
    await page.getByTestId(`close-share-object`).click()
  })

  test('Verify that the users with READ, EXECUTE, and WRITE permissions can open the details modal, but cannot see the review button', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await verifyActivityReviewButtonVisibility(data, false)
    await logoutUser(page)
    await loginInstitutionalCatalyst(page)
    await verifyActivityReviewButtonVisibility(data, false)
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await verifyActivityReviewButtonVisibility(data, false)
    await logoutUser(page)
  })

  test('Set all activities to reviewed through the OWNER and ADMIN users through activity list and course overview, unset it again and verify that all changes persist', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await markAllActivitiesAsReviewed(data)
    await logoutUser(page)
    await loginInstitutionalCatalyst3(page)
    await page.getByTestId('activities').click()
    for (const activity of [
      { name: data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      await typeInto(
        page.getByTestId('activities-search-input'),
        `${activity.name}{enter}`
      )
      await expectByAssertion(
        page.getByTestId(`activity-${activity.type}-${activity.name}`),
        'contain',
        messages.shared.generic.reviewStatusREVIEWED
      )
      await openActivityInformation(activity)
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        'contain',
        messages.manage.activities.resetReview
      )
      await page.getByTestId('activity-review-button').click()
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        'contain',
        messages.manage.activities.reviewCompleted
      )
      await page.getByTestId('close-activity-details-modal').click()
      await expectByAssertion(
        page.getByTestId(`activity-${activity.type}-${activity.name}`),
        'not.contain',
        messages.shared.generic.reviewStatusREVIEWED
      )
      await page.getByTestId('activities-search-input').clear()
    }
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.review.liveQuizNoCourse}{enter}`
    )
    await openActivityInformation({
      name: data.review.liveQuizNoCourse,
      type: 'LIVE_QUIZ',
    })
    await expectByAssertion(
      page.getByTestId('activity-review-button'),
      'contain',
      messages.manage.activities.reviewCompleted
    )
    await page.getByTestId('activity-review-button').click()
    await expectByAssertion(
      page.getByTestId('activity-review-button'),
      'contain',
      messages.manage.activities.resetReview
    )
    await page.getByTestId('close-activity-details-modal').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuizNoCourse}`),
      'contain',
      messages.shared.generic.reviewStatusREVIEWED
    )
    await page.getByTestId('activities-search-input').clear()
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.review.course.name}`)
      .click()
    for (const activity of [
      {
        name: data.review.liveQuiz,
        type: 'LIVE_QUIZ',
        tabKey: 'liveQuizzes',
      },
      {
        name: data.review.practiceQuiz,
        type: 'PRACTICE_QUIZ',
        tabKey: 'practiceQuizzes',
      },
      {
        name: data.review.microLearning,
        type: 'MICRO_LEARNING',
        tabKey: 'microLearnings',
      },
      {
        name: data.review.groupActivity,
        type: 'GROUP_ACTIVITY',
        tabKey: 'groupActivities',
      },
    ]) {
      await page.getByTestId(`tab-${activity.tabKey}`).click()
      await expectByAssertion(
        page.getByTestId(`activity-${activity.type}-${activity.name}`),
        'not.contain',
        messages.shared.generic.reviewStatusREVIEWED
      )
      await openActivityInformation(activity)
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        'contain',
        messages.manage.activities.reviewCompleted
      )
      await page.getByTestId('activity-review-button').click()
      await expectByAssertion(
        page.getByTestId('activity-review-button'),
        'contain',
        messages.manage.activities.resetReview
      )
      await page.getByTestId('close-activity-details-modal').click()
      await expectByAssertion(
        page.getByTestId(`activity-${activity.type}-${activity.name}`),
        'contain',
        messages.shared.generic.reviewStatusREVIEWED
      )
    }
  })

  test('Edit each activity through the wizard and verify that the status changes as expected', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await editActivity(
      'LIVE_QUIZ',
      data.review.liveQuizNoCourse,
      `edit-live-quiz-${data.review.liveQuizNoCourse}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuizNoCourse}`),
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'LIVE_QUIZ',
      data.review.liveQuiz,
      `edit-live-quiz-${data.review.liveQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuiz}`),
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'PRACTICE_QUIZ',
      data.review.practiceQuiz,
      `edit-practice-quiz-${data.review.practiceQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.review.practiceQuiz}`),
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'MICRO_LEARNING',
      data.review.microLearning,
      `edit-microlearning-${data.review.microLearning}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.review.microLearning}`),
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'GROUP_ACTIVITY',
      data.review.groupActivity,
      `edit-group-activity-${data.review.groupActivity}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.review.groupActivity}`),
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
  })

  test('Mark the activities as reviewed again and change the course assignments, verify that the review status is reset', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await markAllActivitiesAsReviewed(data)
    await page.getByTestId('activities').click()
    await editActivity(
      'LIVE_QUIZ',
      data.review.liveQuizNoCourse,
      `edit-live-quiz-${data.review.liveQuizNoCourse}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(
      page,
      '[data-cy="select-course"]',
      data.review.course2.name
    )
    await expect(page.getByTestId('select-course')).toContainText(
      data.review.course2.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuizNoCourse}`),
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuizNoCourse}`),
      'not.contain',
      messages.shared.generic.reviewStatusREVIEWED
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'LIVE_QUIZ',
      data.review.liveQuiz,
      `edit-live-quiz-${data.review.liveQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(
      page,
      '[data-cy="select-course"]',
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await expect(page.getByTestId('select-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuiz}`),
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.review.liveQuiz}`),
      'not.contain',
      messages.shared.generic.reviewStatusREVIEWED
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'PRACTICE_QUIZ',
      data.review.practiceQuiz,
      `edit-practice-quiz-${data.review.practiceQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(
      page,
      '[data-cy="select-course"]',
      data.review.course2.name
    )
    await expect(page.getByTestId('select-course')).toContainText(
      data.review.course2.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.review.practiceQuiz}`),
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.review.practiceQuiz}`),
      'not.contain',
      messages.shared.generic.reviewStatusREVIEWED
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'MICRO_LEARNING',
      data.review.microLearning,
      `edit-microlearning-${data.review.microLearning}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(
      page,
      '[data-cy="select-course"]',
      data.review.course2.name
    )
    await expect(page.getByTestId('select-course')).toContainText(
      data.review.course2.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.review.microLearning}`),
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.review.microLearning}`),
      'not.contain',
      messages.shared.generic.reviewStatusREVIEWED
    )
    await page.getByTestId('activities').click()
    await editActivity(
      'GROUP_ACTIVITY',
      data.review.groupActivity,
      `edit-group-activity-${data.review.groupActivity}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(
      page,
      '[data-cy="select-course"]',
      data.review.course2.name
    )
    await expect(page.getByTestId('select-course')).toContainText(
      data.review.course2.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.review.groupActivity}`),
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.review.groupActivity}`),
      'not.contain',
      messages.shared.generic.reviewStatusREVIEWED
    )
  })

  test('Mark the activities as reviewed again, modify a contained element and verify that the review status is updated correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await markAllActivitiesAsReviewed(data)
    await page.getByTestId('library').click()
    await page.getByTestId(`edit-element-${data.SCML.title}`).click()
    await page.getByTestId('insert-question-title').click()
    await typeInto(page.getByTestId('insert-question-title'), ' NEW')
    await page.getByTestId('save-new-question').click()
    await expectByAssertion(
      page.getByTestId(`edit-element-${data.SCML.title} NEW`),
      'exist'
    )
    await page.getByTestId('activities').click()
    for (const activity of [
      { name: data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      await expectByAssertion(
        page.getByTestId(`activity-${activity.type}-${activity.name}`),
        'contain',
        messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
      )
    }
  })

  test('Prepare elements for element list batch operations', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
    await loginLecturer(page)
    await page.waitForTimeout(1000)
    await page.getByTestId('show-archive-switch').click()
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      multiplier: 2,
      isArchived: true,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML.title,
      content: data.MCML.content,
      choices: data.MCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KP.title,
      content: data.KP.content,
      choices: data.KP.choices,
      isArchived: true,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML.title,
      content: data.NRML.content,
      ...data.NRML.options,
      multiplier: 3,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT.title,
      content: data.FT.content,
      ...data.FT.options,
      userId: env('LECTURER_ID'),
    })
    await createFlashcard(page, {
      name: data.FC.title,
      content: data.FC.content,
      explanation: data.FC.explanation,
      isArchived: true,
      userId: env('LECTURER_ID'),
    })
    await createContent(page, {
      name: data.CT.title,
      content: data.CT.content,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.collection.name,
      description: data.collection.description,
      entries: data.collection.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.SEML.title,
      content: data.SEML.content,
      numberOfInputs: data.SEML.inputs,
      collectionName: data.collection.name,
      correctAnswers: data.collection.options.filter((_, i) =>
        data.SEML.solutions.includes(i)
      ),
      userId: env('LECTURER_ID'),
    })
    await createQuestionCS(page, {
      name: data.CS.title,
      content: data.CS.content,
      explanation: data.CS.explanation,
      collectionName: data.collection.name,
      selectedItems: data.collection.options.filter((_, i) =>
        data.CS.selectedItems.includes(i)
      ),
      criteria: data.CS.criteria,
      cases: data.CS.cases,
      solutions: data.CS.solutions,
      userId: env('LECTURER_ID'),
    })
  })

  test('Verify that selected elements are shown correctly in element batch operations modal', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('show-archive-switch').click()
    await page.getByTestId(`element-checkbox-${data.SCML.title}`).click()
    await page.getByTestId(`element-checkbox-${data.KP.title}`).click()
    await page.getByTestId(`element-checkbox-${data.FC.title}`).click()
    await page.getByTestId(`element-checkbox-${data.CS.title}`).click()
    await page.getByTestId('element-batch-operations').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.KP.title,
      data.FC.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.MCML.title,
      data.NRML.title,
      data.FT.title,
      data.CT.title,
      data.SEML.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'not.exist'
      )
    }
    await page.getByTestId('close-batch-operations-modal').click()
    await page.getByTestId('select-all-elements').click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.FC.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'not.exist'
      )
    }
  })

  test('Verify that the applied operations are displayed correctly in batch operations modal', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('show-archive-switch').click()
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('archive-button').click()
    for (const [__index, title] of Array.from([
      data.MCML.title,
      data.NRML.title,
      data.FT.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.KP.title,
      data.FC.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('unarchive-button').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.KP.title,
      data.FC.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.MCML.title,
      data.NRML.title,
      data.FT.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('status-checkbox').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.FC.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    await page.getByTestId('status-checkbox').click()
    await page.getByTestId('multiplier-checkbox').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.NRML.title,
      data.SEML.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.KP.title,
      data.FT.title,
      data.FC.title,
      data.CT.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('multiplier-checkbox').click()
    await page.getByTestId('base-points-checkbox').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.FC.title,
      data.CT.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('base-points-checkbox').click()
    await page.getByTestId('status-checkbox').click()
    await page.getByTestId('base-points-checkbox').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.FC.title,
      data.CT.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('multiplier-checkbox').click()
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.NRML.title,
      data.SEML.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.KP.title,
      data.FT.title,
      data.FC.title,
      data.CT.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
  })

  test('Verify that archiving / unarchiving elements works correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('show-archive-switch').click()
    const allElements = [
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.FC.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.KP.title,
      data.FC.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`archive-badge-${title}`),
        'exist'
      )
    }
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('archive-button').click()
    for (const [__index, title] of Array.from([
      data.MCML.title,
      data.NRML.title,
      data.FT.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-check-${title}`),
        'exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.KP.title,
      data.FC.title,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`element-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('apply-batch-operations').click()
    for (const [__index, title] of Array.from(allElements).entries()) {
      await expectByAssertion(
        page.getByTestId(`archive-badge-${title}`),
        'exist'
      )
    }
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('unarchive-button').click()
    await page.getByTestId('apply-batch-operations').click()
    for (const [__index, title] of Array.from(allElements).entries()) {
      await expectByAssertion(
        page.getByTestId(`archive-badge-${title}`),
        'not.exist'
      )
    }
  })

  test('Verify that status changes are possible for all elements', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    const allElements = [
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.FC.title,
      data.CT.title,
      data.SEML.title,
      data.CS.title,
    ]
    for (const [__index, title] of Array.from(allElements).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-item-${title}`),
        'contain',
        messages.shared.READY.statusLabel
      )
    }
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('status-checkbox').click()
    await selectOption(
      page,
      '[data-cy="element-status-select"]',
      messages.shared.REVIEW.statusLabel
    )
    await page.getByTestId('apply-batch-operations').click()
    for (const [__index, title] of Array.from(allElements).entries()) {
      await expectByAssertion(
        page.getByTestId(`element-item-${title}`),
        'contain',
        messages.shared.REVIEW.statusLabel
      )
    }
  })

  test('Verify that points multiplier and base point operations are only applied for supported elements', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('base-points-checkbox').click()
    await expectByAssertion(
      page.getByTestId('base-points-switch'),
      'have.attr',
      'data-state',
      'checked'
    )
    await page.getByTestId('base-points-switch').click()
    await expectByAssertion(
      page.getByTestId('base-points-switch'),
      'not.have.attr',
      'data-state',
      'checked'
    )
    await page.getByTestId('apply-batch-operations').click()
    for (const [__index, element] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KP.title,
      data.NRML.title,
      data.FT.title,
      data.SEML.title,
      data.CS.title,
    ]).entries()) {
      await page.getByTestId(`edit-element-${element}`).click()
      await expectByAssertion(
        page.getByTestId('configure-base-points'),
        'not.have.attr',
        'data-state',
        'checked'
      )
      await page.getByTestId('close-element-modal').click()
    }
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('base-points-checkbox').click()
    await expectByAssertion(
      page.getByTestId('base-points-switch'),
      'have.attr',
      'data-state',
      'checked'
    )
    await page.getByTestId('multiplier-checkbox').click()
    await selectOption(page, '[data-cy="select-multiplier"]', '3')
    await page.getByTestId('apply-batch-operations').click()
    for (const [__index, element] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.NRML.title,
      data.SEML.title,
    ]).entries()) {
      await page.getByTestId(`edit-element-${element}`).click()
      await expectByAssertion(
        page.getByTestId('configure-base-points'),
        'have.attr',
        'data-state',
        'checked'
      )
      await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
      await expect(page.getByTestId('select-multiplier')).toContainText(
        messages.manage.activityWizard.multiplier3
      )
      await page.getByTestId('close-element-modal').click()
    }
    for (const [__index, element] of Array.from([
      data.KP.title,
      data.FT.title,
      data.CS.title,
    ]).entries()) {
      await page.getByTestId(`edit-element-${element}`).click()
      await expectByAssertion(
        page.getByTestId('configure-base-points'),
        'not.have.attr',
        'data-state',
        'checked'
      )
      await page.getByTestId('close-element-modal').click()
    }
  })

  test('Prepare elements, activities, and courses for activity batch operations', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
    await loginLecturer(page)
    await page.waitForTimeout(1000)
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML.title,
      content: data.NRML.content,
      ...data.NRML.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('courses').click()
    await createCourse(page, {
      name: data.batch.course1,
      displayName: data.batch.course1,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: validCourseStart,
      endDate: validCourseEnd,
      groupDeadlineDate: validCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await createCourse(page, {
      name: data.batch.course2,
      displayName: data.batch.course2,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: validCourseStart,
      endDate: validCourseEnd,
      groupDeadlineDate: validCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await createCourse(page, {
      name: data.batch.course3,
      displayName: data.batch.course3,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: validCourseStart,
      endDate: invalidCourseEnd,
      groupDeadlineDate: validCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await createCourse(page, {
      name: data.batch.course4,
      displayName: data.batch.course4,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: invalidCourseStart,
      endDate: invalidCourseEnd,
      groupDeadlineDate: invalidCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await createCourse(page, {
      name: data.batch.course5,
      displayName: data.batch.course5,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: invalidCourseStart,
      endDate: validCourseEnd,
      groupDeadlineDate: invalidCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    await createCourse(page, {
      name: data.batch.courseNoGroups,
      displayName: data.batch.courseNoGroups,
      isGamificationEnabled: true,
      isGroupCreationEnabled: false,
      startDate: validCourseStart,
      endDate: validCourseEnd,
    })
    await createCourse(page, {
      name: data.batch.courseNotGamified,
      displayName: data.batch.courseNotGamified,
      isGamificationEnabled: false,
      isGroupCreationEnabled: false,
      startDate: validCourseStart,
      endDate: validCourseEnd,
    })
    await page.getByTestId('library').click()
    await createLiveQuiz(page, {
      name: data.batch.liveQuiz,
      displayName: data.batch.liveQuiz,
      courseName: data.batch.course1,
      blocks: [{ elements: [data.SCML.title, data.NRML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createPracticeQuiz(page, {
      name: data.batch.practiceQuiz,
      displayName: data.batch.practiceQuiz,
      courseName: data.batch.course1,
      stacks: [{ elements: [data.SCML.title, data.NRML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createMicroLearning(page, {
      name: data.batch.microLearning,
      displayName: data.batch.microLearning,
      courseName: data.batch.course1,
      startDate: activityStart,
      endDate: activityEnd,
      stacks: [{ elements: [data.SCML.title, data.NRML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createGroupActivity(page, {
      name: data.batch.groupActivity,
      displayName: data.batch.groupActivity,
      courseName: data.batch.course1,
      scheduledStartDate: activityStart,
      scheduledEndDate: activityEnd,
      task: 'TASK',
      clues: data.groupActivityStandardClues,
      stack: { elements: [data.SCML.title, data.NRML.title] },
    })
    await page.getByTestId('create-new-activity').click()
    await createLiveQuiz(page, {
      name: data.batch.liveQuiz2,
      displayName: data.batch.liveQuiz2,
      courseName: data.batch.courseNotGamified,
      blocks: [{ elements: [data.SCML.title, data.NRML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createPracticeQuiz(page, {
      name: data.batch.practiceQuiz2,
      displayName: data.batch.practiceQuiz2,
      courseName: data.batch.courseNotGamified,
      stacks: [{ elements: [data.SCML.title, data.NRML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createMicroLearning(page, {
      name: data.batch.microLearning2,
      displayName: data.batch.microLearning2,
      courseName: data.batch.courseNotGamified,
      startDate: activityStart,
      endDate: activityEnd,
      stacks: [{ elements: [data.SCML.title, data.NRML.title] }],
    })
    await page.getByTestId('create-new-activity').click()
  })

  test('Verify that selected activities are shown correctly in activity batch operations modal', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz}`).click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.microLearning}`)
      .click()
    await page.getByTestId('activity-batch-operations').click()
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.microLearning,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.batch.practiceQuiz,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'not.exist'
      )
    }
    await page.getByTestId('close-batch-operations-modal').click()
    await page.getByTestId('select-all-activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-activities').click()
    await page.getByTestId('activity-batch-operations').click()
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.microLearning,
      data.batch.practiceQuiz,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
  })

  test('Verify that the applied operations are displayed correctly in activity batch operations modal', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-activities').click()
    await page.getByTestId('activity-batch-operations').click()
    await page.getByTestId('multiplier-checkbox').click()
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.microLearning,
      data.batch.practiceQuiz,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz2,
      data.batch.microLearning2,
      data.batch.practiceQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('course-checkbox').click()
    await selectOption(
      page,
      '[data-cy="select-course"]',
      data.batch.courseNotGamified
    )
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.microLearning,
      data.batch.practiceQuiz,
      data.batch.liveQuiz2,
      data.batch.microLearning2,
      data.batch.practiceQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`activity-batch-entry-${data.batch.groupActivity}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-check-${data.batch.groupActivity}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-x-${data.batch.groupActivity}`),
      'exist'
    )
    await selectOption(page, '[data-cy="select-course"]', data.batch.course3)
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.liveQuiz2,
      data.batch.practiceQuiz,
      data.batch.practiceQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.batch.microLearning,
      data.batch.microLearning2,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
    await selectOption(page, '[data-cy="select-course"]', data.batch.course4)
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.liveQuiz2,
      data.batch.practiceQuiz,
      data.batch.practiceQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.batch.microLearning,
      data.batch.microLearning2,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
    await selectOption(page, '[data-cy="select-course"]', data.batch.course5)
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.liveQuiz2,
      data.batch.practiceQuiz,
      data.batch.practiceQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.batch.microLearning,
      data.batch.microLearning2,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('course-checkbox').click()
    await page.getByTestId('live-quiz-points-checkbox').click()
    await expectByAssertion(
      page.getByTestId(`activity-batch-entry-${data.batch.liveQuiz}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-check-${data.batch.liveQuiz}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-x-${data.batch.liveQuiz}`),
      'not.exist'
    )
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz2, // non-gamified live quizzes are not affected
      data.batch.practiceQuiz,
      data.batch.practiceQuiz2,
      data.batch.microLearning,
      data.batch.microLearning2,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
  })

  test('Verify that multiplier changes are applied correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-activities').click()
    await page.getByTestId('activity-batch-operations').click()
    await page.getByTestId('multiplier-checkbox').click()
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.microLearning,
      data.batch.practiceQuiz,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz2,
      data.batch.microLearning2,
      data.batch.practiceQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
    await selectOption(
      page,
      '[data-cy="select-multiplier"]',
      messages.manage.activityWizard.multiplier3
    )
    await page.getByTestId('apply-batch-operations').click()
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz,
      `edit-live-quiz-${data.batch.liveQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier3
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz2,
      `edit-live-quiz-${data.batch.liveQuiz2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'PRACTICE_QUIZ',
      data.batch.practiceQuiz,
      `edit-practice-quiz-${data.batch.practiceQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier3
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'PRACTICE_QUIZ',
      data.batch.practiceQuiz2,
      `edit-practice-quiz-${data.batch.practiceQuiz2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'MICRO_LEARNING',
      data.batch.microLearning,
      `edit-microlearning-${data.batch.microLearning}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier3
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'MICRO_LEARNING',
      data.batch.microLearning2,
      `edit-microlearning-${data.batch.microLearning2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'GROUP_ACTIVITY',
      data.batch.groupActivity,
      `edit-group-activity-${data.batch.groupActivity}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier3
    )
  })

  test('Verify that course re-assignments are applied correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz}`).click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.practiceQuiz}`)
      .click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.microLearning}`)
      .click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.groupActivity}`)
      .click()
    await page.getByTestId('activity-batch-operations').click()
    await page.getByTestId('course-checkbox').click()
    await selectOption(page, '[data-cy="select-course"]', data.batch.course2)
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.microLearning,
      data.batch.practiceQuiz,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    await page.getByTestId('apply-batch-operations').click()
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz,
      `edit-live-quiz-${data.batch.liveQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'PRACTICE_QUIZ',
      data.batch.practiceQuiz,
      `edit-practice-quiz-${data.batch.practiceQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'MICRO_LEARNING',
      data.batch.microLearning,
      `edit-microlearning-${data.batch.microLearning}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'GROUP_ACTIVITY',
      data.batch.groupActivity,
      `edit-group-activity-${data.batch.groupActivity}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
  })

  test('Verify that customized live quiz grading logic is applied correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz}`).click()
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz2}`).click()
    await page.getByTestId('activity-batch-operations').click()
    await page.getByTestId('live-quiz-points-checkbox').click()
    await page.getByTestId(`base-points-input`).clear()
    await typeInto(page.getByTestId(`base-points-input`), '100')
    await page.getByTestId(`correctness-points-input`).clear()
    await typeInto(page.getByTestId(`correctness-points-input`), '200')
    await page.getByTestId(`bonus-points-input`).clear()
    await typeInto(page.getByTestId(`bonus-points-input`), '300')
    await page.getByTestId(`bonus-times-input`).clear()
    await typeInto(page.getByTestId(`bonus-times-input`), '60')
    await expectByAssertion(
      page.getByTestId(`activity-batch-entry-${data.batch.liveQuiz}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-check-${data.batch.liveQuiz}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-x-${data.batch.liveQuiz}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-entry-${data.batch.liveQuiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-check-${data.batch.liveQuiz2}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-x-${data.batch.liveQuiz2}`),
      'exist'
    )
    await page.getByTestId('apply-batch-operations').click()
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz,
      `edit-live-quiz-${data.batch.liveQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('live-quiz-advanced-settings').click()
    await expectByAssertion(
      page.getByTestId('live-quiz-default-points'),
      'have.value',
      '100'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-default-correct-points'),
      'have.value',
      '200'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-max-bonus-points'),
      'have.value',
      '300'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-time-to-zero-bonus'),
      'have.value',
      '60'
    )
    await page.getByTestId('live-quiz-advanced-settings-close').click()
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz2,
      `edit-live-quiz-${data.batch.liveQuiz2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings'),
      'not.exist'
    )
  })

  test('Verify that the combination of multiplier change and course re-assignment is possible simultaneously', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz2}`).click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.practiceQuiz2}`)
      .click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.microLearning2}`)
      .click()
    await page
      .getByTestId(`activity-checkbox-${data.batch.groupActivity}`)
      .click()
    await page.getByTestId('activity-batch-operations').click()
    await page.getByTestId('multiplier-checkbox').click()
    await selectOption(
      page,
      '[data-cy="select-multiplier"]',
      messages.manage.activityWizard.multiplier4
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-entry-${data.batch.groupActivity}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-check-${data.batch.groupActivity}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`activity-batch-x-${data.batch.groupActivity}`),
      'not.exist'
    )
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz2,
      data.batch.practiceQuiz2,
      data.batch.microLearning2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'exist'
      )
    }
    await page.getByTestId('course-checkbox').click()
    await selectOption(page, '[data-cy="select-course"]', data.batch.course2)
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz2,
      data.batch.practiceQuiz2,
      data.batch.microLearning2,
      data.batch.groupActivity,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    await page.getByTestId('apply-batch-operations').click()
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz2,
      `edit-live-quiz-${data.batch.liveQuiz2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'PRACTICE_QUIZ',
      data.batch.practiceQuiz2,
      `edit-practice-quiz-${data.batch.practiceQuiz2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'MICRO_LEARNING',
      data.batch.microLearning2,
      `edit-microlearning-${data.batch.microLearning2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'GROUP_ACTIVITY',
      data.batch.groupActivity,
      `edit-group-activity-${data.batch.groupActivity}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course2
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
  })

  test('Verify that the combination of multiplier change, course re-assignment and customized grading logic is possible for the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz}`).click()
    await page.getByTestId(`activity-checkbox-${data.batch.liveQuiz2}`).click()
    await page.getByTestId('activity-batch-operations').click()
    await page.getByTestId('course-checkbox').click()
    await selectOption(page, '[data-cy="select-course"]', data.batch.course3)
    await page.getByTestId('multiplier-checkbox').click()
    await selectOption(
      page,
      '[data-cy="select-multiplier"]',
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('live-quiz-points-checkbox').click()
    await page.getByTestId(`base-points-input`).clear()
    await typeInto(page.getByTestId(`base-points-input`), '1')
    await page.getByTestId(`correctness-points-input`).clear()
    await typeInto(page.getByTestId(`correctness-points-input`), '2')
    await page.getByTestId(`bonus-points-input`).clear()
    await typeInto(page.getByTestId(`bonus-points-input`), '3')
    await page.getByTestId(`bonus-times-input`).clear()
    await typeInto(page.getByTestId(`bonus-times-input`), '4')
    for (const [__index, title] of Array.from([
      data.batch.liveQuiz,
      data.batch.liveQuiz2,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-batch-entry-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-check-${title}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`activity-batch-x-${title}`),
        'not.exist'
      )
    }
    await page.getByTestId('apply-batch-operations').click()
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz,
      `edit-live-quiz-${data.batch.liveQuiz}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course3
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('live-quiz-advanced-settings').click()
    await expectByAssertion(
      page.getByTestId('live-quiz-default-points'),
      'have.value',
      '1'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-default-correct-points'),
      'have.value',
      '2'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-max-bonus-points'),
      'have.value',
      '3'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-time-to-zero-bonus'),
      'have.value',
      '4'
    )
    await page.getByTestId('live-quiz-advanced-settings-close').click()
    await page.getByTestId(`activities`).click()
    await page.waitForTimeout(500)
    await editActivity(
      'LIVE_QUIZ',
      data.batch.liveQuiz2,
      `edit-live-quiz-${data.batch.liveQuiz2}`
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.batch.course3
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('live-quiz-advanced-settings').click()
    await expectByAssertion(
      page.getByTestId('live-quiz-default-points'),
      'have.value',
      '1'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-default-correct-points'),
      'have.value',
      '2'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-max-bonus-points'),
      'have.value',
      '3'
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-time-to-zero-bonus'),
      'have.value',
      '4'
    )
    await page.getByTestId('live-quiz-advanced-settings-close').click()
  })
})
