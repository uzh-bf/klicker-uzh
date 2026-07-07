import { Page } from '@playwright/test'
import questionsData from '../../cypress/cypress/fixtures/questions.json' with { type: 'json' }
import activityLogData from '../../cypress/cypress/fixtures/W-activity-log.json' with { type: 'json' }
import { chooseActivityAction } from '../util/actions.js'
import { cleanupTest } from '../util/cleanup.js'
import {
  LECTURER_ID,
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST_SHORTNAME,
  LECTURER_SHORTNAME,
  URL_MANAGE,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createGroupActivity,
  createLiveQuiz,
  createMicroLearning,
  createPracticeQuiz,
  type GroupActivityClueType,
  selectOption,
} from '../util/fixtures/activities.js'
import {
  createAnswerCollection,
  createQuestionSC,
  validateElement,
} from '../util/fixtures/elements.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'

type WData = typeof questionsData & typeof activityLogData
type ActivityType =
  | 'LIVE_QUIZ'
  | 'PRACTICE_QUIZ'
  | 'MICRO_LEARNING'
  | 'GROUP_ACTIVITY'

const data = { ...questionsData, ...activityLogData } as WData
const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

test('CLEANUP', cleanupTest)

async function saveElementModal(page: Page) {
  await page.getByTestId('save-new-question').click({ force: true })
  await expect(page.getByTestId('insert-question-title')).not.toBeAttached({
    timeout: 30000,
  })
  await page.waitForTimeout(500)
}

async function openElementActivityLog(page: Page, elementTitle: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementTitle)
  await page.keyboard.press('Enter')
  await page.getByTestId(`actions-element-${elementTitle}`).click()
  await page.getByTestId(`view-activity-log-${elementTitle}`).click()
}

async function addAndVerifyActivityLogMessage(page: Page, message: string) {
  await page.getByTestId('activity-log-input').click()
  await page.getByTestId('activity-log-input').pressSequentially(message)
  await page.getByTestId('activity-log-submit').click()
  await expect(
    page.getByTestId(`activity-log-entry-${message}`).first()
  ).toBeAttached()
}

async function verifyActivityLogContent(
  page: Page,
  lecturerShortname: string,
  includeMessage2 = false,
  includeMessage3 = false
) {
  const creationMessage = `${lecturerShortname} created this object.`
  const titleChangeMessage = `${lecturerShortname} modified title (${data.SC.title} -> ${data.element.newTitle}).`
  const statusChangeMessage = `${lecturerShortname} modified status (READY -> REVIEW).`

  for (const message of [
    data.element.message1,
    data.element.message2,
    statusChangeMessage,
    titleChangeMessage,
    creationMessage,
    data.element.messagePro1,
  ]) {
    await expect(
      page.getByTestId(`activity-log-entry-${message}`).first()
    ).toBeAttached()
  }

  if (includeMessage2) {
    await expect(
      page.getByTestId(`activity-log-entry-${data.element.messagePro2}`).first()
    ).toBeAttached()
  }

  if (includeMessage3) {
    await expect(
      page.getByTestId(`activity-log-entry-${data.element.messagePro3}`).first()
    ).toBeAttached()
  }
}

async function verifyActivityComments(
  page: Page,
  {
    message,
    newMessage,
    message2,
    message3,
    message4,
  }: {
    message: string
    newMessage?: string
    message2?: string
    message3?: string
    message4?: string
  }
) {
  for (const activityMessage of [message, message2, message3, message4]) {
    if (activityMessage) {
      await expect(
        page.getByTestId(`activity-log-entry-${activityMessage}`).first()
      ).toBeAttached()
    }
  }

  if (newMessage) {
    await addAndVerifyActivityLogMessage(page, newMessage)
  }

  await page.getByTestId('close-activity-log').click()
}

async function grantPermission(
  page: Page,
  shortname: string,
  permission: string
) {
  await page.getByTestId('new-permission-username-or-email').click()
  await page.getByTestId('new-permission-username-or-email').fill(shortname)
  await selectOption(
    page,
    '[data-cy="new-permission-access-level"]',
    permission
  )
  await expect(page.getByTestId('new-permission-access-level')).toContainText(
    permission
  )
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(page.getByTestId(`permission-${shortname}`)).toContainText(
    permission
  )
}

async function openActivitiesPage(page: Page) {
  await page.goto(`${manageUrl}/activities`, { waitUntil: 'commit' })
  await expect(page.getByTestId('activities-search-input')).toBeVisible()
}

async function openLibraryPage(page: Page) {
  await page.goto(manageUrl, { waitUntil: 'commit' })
  await expect(page.getByTestId('create-live-quiz')).toBeVisible()
}

async function filterActivities(page: Page, activityName: string) {
  await page.getByTestId('activities-search-input').clear()
  await page.getByTestId('activities-search-input').fill(activityName)
  await page.keyboard.press('Enter')
}

async function expectActivityVisible(
  page: Page,
  type: ActivityType,
  activityName: string
) {
  await openActivitiesPage(page)
  await filterActivities(page, activityName)
  await expect(
    page.getByTestId(`activity-${type}-${activityName}`)
  ).toBeVisible()
}

async function openCoursesPage(page: Page) {
  await page.goto(`${manageUrl}/courses`, { waitUntil: 'commit' })
  await expect(page.getByText('Please select a course:')).toBeVisible()
}

async function openCourseOverview(page: Page, courseName: string) {
  await openCoursesPage(page)
  await page.getByTestId(`course-list-button-${courseName}`).click()
  await expect(page.getByTestId('course-name-with-pin')).toContainText(
    courseName
  )
}

async function openAnswerCollectionsPage(page: Page) {
  await page.goto(`${manageUrl}/resources/answerCollections`, {
    waitUntil: 'commit',
  })
  await expect(page.getByTestId('create-answer-collection')).toBeVisible()
}

async function setUserPermissionsElementCollection(page: Page) {
  await grantPermission(
    page,
    LECTURER_IND_SHORTNAME,
    messages.manage.sharing.permissionsREAD
  )
  await grantPermission(
    page,
    LECTURER_INST_SHORTNAME,
    messages.manage.sharing.permissionsWRITE
  )
  await grantPermission(
    page,
    LECTURER_INST2_SHORTNAME,
    messages.manage.sharing.permissionsADMIN
  )
}

async function setUserPermissions(page: Page) {
  await grantPermission(
    page,
    LECTURER_IND_SHORTNAME,
    messages.manage.sharing.permissionsREAD
  )
  await grantPermission(
    page,
    LECTURER_INST_SHORTNAME,
    messages.manage.sharing.permissionsEXECUTE
  )
  await grantPermission(
    page,
    LECTURER_INST2_SHORTNAME,
    messages.manage.sharing.permissionsWRITE
  )
  await grantPermission(
    page,
    LECTURER_INST3_SHORTNAME,
    messages.manage.sharing.permissionsADMIN
  )
  await page.getByTestId('close-share-object').click()
}

function shareActivityTestId(type: ActivityType, name: string) {
  if (type === 'LIVE_QUIZ') return `share-live-quiz-${name}`
  if (type === 'PRACTICE_QUIZ') return `share-practice-quiz-${name}`
  if (type === 'MICRO_LEARNING') return `share-microlearning-${name}`
  return `share-group-activity-${name}`
}

async function openActivityLog(
  page: Page,
  type: ActivityType,
  activityName: string
) {
  await openActivitiesPage(page)
  await filterActivities(page, activityName)
  await expect(
    page.getByTestId(`actions-${type}-${activityName}`)
  ).toBeVisible()
  await chooseActivityAction(
    page,
    type,
    activityName,
    `view-activity-log-${activityName}`
  )
  await expect(page.getByTestId('activity-log-input')).toBeVisible()
}

async function shareActivity(
  page: Page,
  type: ActivityType,
  activityName: string
) {
  await openActivitiesPage(page)
  await filterActivities(page, activityName)
  await expect(
    page.getByTestId(`actions-${type}-${activityName}`)
  ).toBeVisible()
  await chooseActivityAction(
    page,
    type,
    activityName,
    shareActivityTestId(type, activityName)
  )
  await setUserPermissions(page)
}

async function createActivityLogElement(page: Page) {
  await page.getByTestId('create-question').click()
  await page.getByTestId('insert-question-title').fill(data.SC.title)
  await page.getByTestId('insert-question-text').click()
  await page
    .getByTestId('insert-question-text')
    .pressSequentially(data.SC.content)
  await page.getByTestId('insert-answer-field-0').click()
  await page
    .getByTestId('insert-answer-field-0')
    .pressSequentially(data.SC.choices[0].value)
  await page.getByTestId('insert-question-title').click()
  await page.getByTestId('add-new-answer').click()
  await page.waitForTimeout(500)
  await page.getByTestId('insert-answer-field-1').click()
  await page
    .getByTestId('insert-answer-field-1')
    .pressSequentially(data.SC.choices[1].value)
  await page.getByTestId('insert-question-title').click()
  await saveElementModal(page)
}

test.describe('Feature test for activity logs', () => {
  test('Create single choice question, access activity log from element dropdown and add a message', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createActivityLogElement(page)
    await openElementActivityLog(page, data.SC.title)
    await addAndVerifyActivityLogMessage(page, data.element.message1)
    await page.getByTestId('close-activity-log').click()
  })

  test('Verify that the creation of the question is logged in the activity log', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    const creationMessage = `${LECTURER_SHORTNAME} created this object.`
    await openElementActivityLog(page, data.SC.title)
    await expect(
      page.getByTestId(`activity-log-entry-${creationMessage}`)
    ).toBeAttached()
    await page.getByTestId('close-activity-log').click()
  })

  test('Access activity log from element edit modal and add another message', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId(`edit-element-${data.SC.title}`).click()

    await page.getByTestId('element-activity-tab').click()
    await expect(
      page.getByTestId(`activity-log-entry-${data.element.message1}`)
    ).toBeAttached()
    await addAndVerifyActivityLogMessage(page, data.element.message2)
    await page.getByTestId('close-element-modal').click()
  })

  test('Track status modifications in the activity log', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await page.getByTestId(`edit-element-${data.SC.title}`).click()
    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(
        `select-question-status-${messages.shared.REVIEW.statusLabel}`
      )
      .click()
    await expect(page.getByTestId('select-question-status')).toContainText(
      messages.shared.REVIEW.statusLabel
    )
    await page.getByTestId('close-element-modal').click()

    const statusChangeMessage = `${LECTURER_SHORTNAME} modified status (READY -> REVIEW).`
    await openElementActivityLog(page, data.SC.title)
    await expect(
      page.getByTestId(`activity-log-entry-${statusChangeMessage}`)
    ).toBeAttached()
    await page.getByTestId('close-activity-log').click()
  })

  test('Track title modifications in the activity log', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await page.getByTestId(`edit-element-${data.SC.title}`).click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      data.SC.title
    )
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await page
      .getByTestId('insert-question-title')
      .pressSequentially(data.element.newTitle)
    await saveElementModal(page)

    const titleChangeMessage = `${LECTURER_SHORTNAME} modified title (${data.SC.title} -> ${data.element.newTitle}).`
    await openElementActivityLog(page, data.element.newTitle)
    await expect(
      page.getByTestId(`activity-log-entry-${titleChangeMessage}`)
    ).toBeAttached()
    await page.getByTestId('close-activity-log').click()

    await page.getByTestId(`edit-element-${data.element.newTitle}`).click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      data.element.newTitle
    )
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await page
      .getByTestId('insert-question-title')
      .pressSequentially(data.SC.title)
    await saveElementModal(page)
  })

  test('Grant READ, WRITE, ADMIN permissions on the element to the other users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('elements-search-input').clear()
    await page.getByTestId('elements-search-input').fill(data.SC.title)
    await page.keyboard.press('Enter')
    await page.getByTestId(`actions-element-${data.SC.title}`).click()
    await page.getByTestId(`share-element-${data.SC.title}`).click()
    await setUserPermissionsElementCollection(page)
  })

  test('Log in as the user with READ permissions, verify the permissions and enter a new message', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await openElementActivityLog(page, data.SC.title)
    await addAndVerifyActivityLogMessage(page, data.element.messagePro1)

    await verifyActivityLogContent(page, LECTURER_SHORTNAME)
    await page.getByTestId('close-activity-log').click()

    await page.getByTestId(`element-title-${data.SC.title}`).click()
    await page.getByTestId('element-activity-tab').click()
    await verifyActivityLogContent(page, LECTURER_SHORTNAME)
  })

  test('Log in as the user with WRITE permissions, verify the permissions and enter a new message', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await openElementActivityLog(page, data.SC.title)
    await addAndVerifyActivityLogMessage(page, data.element.messagePro2)

    await verifyActivityLogContent(page, LECTURER_SHORTNAME, true)
    await page.getByTestId('close-activity-log').click()

    await page.getByTestId(`element-title-${data.SC.title}`).click()
    await page.getByTestId('element-activity-tab').click()
    await verifyActivityLogContent(page, LECTURER_SHORTNAME, true)
  })

  test('Log in as the user with ADMIN permissions, verify the permissions and enter a new message', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await openElementActivityLog(page, data.SC.title)
    await addAndVerifyActivityLogMessage(page, data.element.messagePro3)

    await verifyActivityLogContent(page, LECTURER_SHORTNAME, true, true)
    await page.getByTestId('close-activity-log').click()

    await page.getByTestId(`element-title-${data.SC.title}`).click()
    await page.getByTestId('element-activity-tab').click()
    await verifyActivityLogContent(page, LECTURER_SHORTNAME, true, true)
  })

  test('Create different activities and share them with other users', async ({
    page,
    loginLecturer,
  }, testInfo) => {
    testInfo.setTimeout(180_000)
    await loginLecturer()

    await createQuestionSC({
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      userId: LECTURER_ID,
    })
    await page.reload()
    await validateElement(page, data.SCML.title)

    await createLiveQuiz(page, {
      name: data.liveQuiz.name,
      displayName: data.liveQuiz.displayName,
      courseName: data.seededCourse,
      blocks: [{ elements: [data.SCML.title] }],
    })
    await expectActivityVisible(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await openLibraryPage(page)

    await createPracticeQuiz(page, {
      name: data.practiceQuiz.name,
      displayName: data.practiceQuiz.displayName,
      courseName: data.seededCourse,
      stacks: [{ elements: [data.SCML.title] }],
    })
    await expectActivityVisible(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await openLibraryPage(page)

    await createMicroLearning(page, {
      name: data.microLearning.name,
      displayName: data.microLearning.displayName,
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
      courseName: data.seededCourse,
      stacks: [{ elements: [data.SCML.title] }],
    })
    await expectActivityVisible(page, 'MICRO_LEARNING', data.microLearning.name)
    await openLibraryPage(page)

    await createGroupActivity(page, {
      name: data.groupActivity.name,
      displayName: data.groupActivity.displayName,
      courseName: data.seededCourse,
      scheduledStartDate: {
        monthDelta: -1,
        day: 10,
        hour: 12,
        minute: 30,
        validation: `${getDatetimeValidationString(-1, '10')}, 12:30`,
      },
      scheduledEndDate: {
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: `${getDatetimeValidationString(2, '20')}, 14:00`,
      },
      task: 'TASK',
      clues: data.groupActivityStandardClues as GroupActivityClueType[],
      stack: {
        elements: [data.SCML.title],
      },
    })
    await expectActivityVisible(page, 'GROUP_ACTIVITY', data.groupActivity.name)

    await shareActivity(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await openActivityLog(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await addAndVerifyActivityLogMessage(page, data.liveQuiz.message)
    await page.getByTestId('close-activity-log').click()

    await shareActivity(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await openActivityLog(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await addAndVerifyActivityLogMessage(page, data.practiceQuiz.message)
    await page.getByTestId('close-activity-log').click()

    await shareActivity(page, 'MICRO_LEARNING', data.microLearning.name)
    await openActivityLog(page, 'MICRO_LEARNING', data.microLearning.name)
    await addAndVerifyActivityLogMessage(page, data.microLearning.message)
    await page.getByTestId('close-activity-log').click()

    await shareActivity(page, 'GROUP_ACTIVITY', data.groupActivity.name)
    await openActivityLog(page, 'GROUP_ACTIVITY', data.groupActivity.name)
    await addAndVerifyActivityLogMessage(page, data.groupActivity.message)
    await page.getByTestId('close-activity-log').click()
  })

  test('Add another message to the activities through the user with READ permissions', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()

    await openActivityLog(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await verifyActivityComments(page, {
      message: data.liveQuiz.message,
      newMessage: data.liveQuiz.messagePro1,
    })

    await openActivityLog(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await verifyActivityComments(page, {
      message: data.practiceQuiz.message,
      newMessage: data.practiceQuiz.messagePro1,
    })

    await openActivityLog(page, 'MICRO_LEARNING', data.microLearning.name)
    await verifyActivityComments(page, {
      message: data.microLearning.message,
      newMessage: data.microLearning.messagePro1,
    })

    await openActivityLog(page, 'GROUP_ACTIVITY', data.groupActivity.name)
    await verifyActivityComments(page, {
      message: data.groupActivity.message,
      newMessage: data.groupActivity.messagePro1,
    })
  })

  test('Add another message to the activities through the user with EXECUTE permissions', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()

    await openActivityLog(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await verifyActivityComments(page, {
      message: data.liveQuiz.message,
      message2: data.liveQuiz.messagePro1,
      newMessage: data.liveQuiz.messagePro2,
    })

    await openActivityLog(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await verifyActivityComments(page, {
      message: data.practiceQuiz.message,
      message2: data.practiceQuiz.messagePro1,
      newMessage: data.practiceQuiz.messagePro2,
    })

    await openActivityLog(page, 'MICRO_LEARNING', data.microLearning.name)
    await verifyActivityComments(page, {
      message: data.microLearning.message,
      message2: data.microLearning.messagePro1,
      newMessage: data.microLearning.messagePro2,
    })

    await openActivityLog(page, 'GROUP_ACTIVITY', data.groupActivity.name)
    await verifyActivityComments(page, {
      message: data.groupActivity.message,
      message2: data.groupActivity.messagePro1,
      newMessage: data.groupActivity.messagePro2,
    })
  })

  test('Add another message to the activities through the user with WRITE permissions', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()

    await openActivityLog(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await verifyActivityComments(page, {
      message: data.liveQuiz.message,
      message2: data.liveQuiz.messagePro1,
      message3: data.liveQuiz.messagePro2,
      newMessage: data.liveQuiz.messagePro3,
    })

    await openActivityLog(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await verifyActivityComments(page, {
      message: data.practiceQuiz.message,
      message2: data.practiceQuiz.messagePro1,
      message3: data.practiceQuiz.messagePro2,
      newMessage: data.practiceQuiz.messagePro3,
    })

    await openActivityLog(page, 'MICRO_LEARNING', data.microLearning.name)
    await verifyActivityComments(page, {
      message: data.microLearning.message,
      message2: data.microLearning.messagePro1,
      message3: data.microLearning.messagePro2,
      newMessage: data.microLearning.messagePro3,
    })

    await openActivityLog(page, 'GROUP_ACTIVITY', data.groupActivity.name)
    await verifyActivityComments(page, {
      message: data.groupActivity.message,
      message2: data.groupActivity.messagePro1,
      message3: data.groupActivity.messagePro2,
      newMessage: data.groupActivity.messagePro3,
    })
  })

  test('Add another message to the activities through the user with ADMIN permissions', async ({
    page,
    loginInstitutionalCatalyst3,
  }) => {
    await loginInstitutionalCatalyst3()

    await openActivityLog(page, 'LIVE_QUIZ', data.liveQuiz.name)
    await verifyActivityComments(page, {
      message: data.liveQuiz.message,
      message2: data.liveQuiz.messagePro1,
      message3: data.liveQuiz.messagePro2,
      message4: data.liveQuiz.messagePro3,
      newMessage: data.liveQuiz.messagePro4,
    })

    await openActivityLog(page, 'PRACTICE_QUIZ', data.practiceQuiz.name)
    await verifyActivityComments(page, {
      message: data.practiceQuiz.message,
      message2: data.practiceQuiz.messagePro1,
      message3: data.practiceQuiz.messagePro2,
      message4: data.practiceQuiz.messagePro3,
      newMessage: data.practiceQuiz.messagePro4,
    })

    await openActivityLog(page, 'MICRO_LEARNING', data.microLearning.name)
    await verifyActivityComments(page, {
      message: data.microLearning.message,
      message2: data.microLearning.messagePro1,
      message3: data.microLearning.messagePro2,
      message4: data.microLearning.messagePro3,
      newMessage: data.microLearning.messagePro4,
    })

    await openActivityLog(page, 'GROUP_ACTIVITY', data.groupActivity.name)
    await verifyActivityComments(page, {
      message: data.groupActivity.message,
      message2: data.groupActivity.messagePro1,
      message3: data.groupActivity.messagePro2,
      message4: data.groupActivity.messagePro3,
      newMessage: data.groupActivity.messagePro4,
    })
  })

  test.describe('Course activity logs', () => {
    test('Add a comment on the course and share it with other users', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await openCoursesPage(page)

      await page.getByTestId(`activity-log-course-${data.seededCourse}`).click()
      await addAndVerifyActivityLogMessage(page, data.course.message)
      await page.getByTestId('close-activity-log').click()

      await openCourseOverview(page, data.seededCourse)
      await page.getByTestId('course-share-button').click()
      await setUserPermissions(page)
    })

    test('Log in as the user with READ permissions and add a new message to the activity log', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await openCoursesPage(page)

      await page.getByTestId(`activity-log-course-${data.seededCourse}`).click()
      await verifyActivityComments(page, {
        message: data.course.message,
        newMessage: data.course.messagePro1,
      })
    })

    test('Log in as the user with EXECUTE permissions and add a new message to the activity log', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await openCoursesPage(page)

      await page.getByTestId(`activity-log-course-${data.seededCourse}`).click()
      await verifyActivityComments(page, {
        message: data.course.message,
        message2: data.course.messagePro1,
        newMessage: data.course.messagePro2,
      })
    })

    test('Log in as the user with WRITE permissions and add a new message to the activity log', async ({
      page,
      loginInstitutionalCatalyst2,
    }) => {
      await loginInstitutionalCatalyst2()

      await openCourseOverview(page, data.seededCourse)
      await page.getByTestId('course-activity-log-button').click()
      await verifyActivityComments(page, {
        message: data.course.message,
        message2: data.course.messagePro1,
        message3: data.course.messagePro2,
        newMessage: data.course.messagePro3,
      })
    })

    test('Log in as the user with ADMIN permissions and add a new message to the activity log', async ({
      page,
      loginInstitutionalCatalyst3,
    }) => {
      await loginInstitutionalCatalyst3()

      await openCourseOverview(page, data.seededCourse)
      await page.getByTestId('course-activity-log-button').click()
      await verifyActivityComments(page, {
        message: data.course.message,
        message2: data.course.messagePro1,
        message3: data.course.messagePro2,
        message4: data.course.messagePro3,
        newMessage: data.course.messagePro4,
      })
    })
  })

  test.describe('Answer collection activity logs', () => {
    test('Create an answer collection, add a comment and share it with other users', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()

      await openAnswerCollectionsPage(page)
      await createAnswerCollection({
        name: data.collection.name,
        description: data.collection.description,
        entries: data.collection.options,
        userId: LECTURER_ID,
      })
      await page.reload()
      await expect(
        page.getByTestId(`answer-collection-${data.collection.name}`)
      ).toBeAttached()

      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page
        .getByTestId(`view-activity-log-${data.collection.name}`)
        .click()
      await addAndVerifyActivityLogMessage(page, data.answerCollection.message)
      await page.getByTestId('close-activity-log').click()

      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page.getByTestId('share-answer-collection').click()
      await setUserPermissionsElementCollection(page)
    })

    test('Log in as the user with READ permissions and add a new message to the activity log', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await openAnswerCollectionsPage(page)
      await expect(
        page.getByTestId(`answer-collection-actions-${data.collection.name}`)
      ).toBeVisible()

      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page
        .getByTestId(`view-activity-log-${data.collection.name}`)
        .click()
      await verifyActivityComments(page, {
        message: data.answerCollection.message,
        newMessage: data.answerCollection.messagePro1,
      })
    })

    test('Log in as the user with WRITE permissions and add a new message to the activity log', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await openAnswerCollectionsPage(page)
      await expect(
        page.getByTestId(`answer-collection-actions-${data.collection.name}`)
      ).toBeVisible()

      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page
        .getByTestId(`view-activity-log-${data.collection.name}`)
        .click()
      await verifyActivityComments(page, {
        message: data.answerCollection.message,
        newMessage: data.answerCollection.messagePro1,
      })
    })

    test('Log in as the user with ADMIN permissions and add a new message to the activity log', async ({
      page,
      loginInstitutionalCatalyst2,
    }) => {
      await loginInstitutionalCatalyst2()
      await openAnswerCollectionsPage(page)
      await expect(
        page.getByTestId(`answer-collection-actions-${data.collection.name}`)
      ).toBeVisible()

      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page
        .getByTestId(`view-activity-log-${data.collection.name}`)
        .click()
      await verifyActivityComments(page, {
        message: data.answerCollection.message,
        message2: data.answerCollection.messagePro1,
        newMessage: data.answerCollection.messagePro2,
      })
    })
  })
})
