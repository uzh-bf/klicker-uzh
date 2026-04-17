/**
 * W-activity-log.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/W-activity-log-workflow.cy.ts
 * Tests creation, viewing, and modification of activity logs for
 * elements, activities (live quiz, practice quiz, microlearning, group activity),
 * courses, and answer collections across different permission levels.
 */

import { type Page } from '@playwright/test'
import {
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST_SHORTNAME,
  LECTURER_SHORTNAME,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
// From cypress/fixtures/questions.json
const SC = {
  title: 'SC Title Test 1 (Version 1)',
  content: 'SC Question Content 1',
  choices: [{ value: '50%' }, { value: '100%' }],
}

const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: [
    { value: '50%', correct: true },
    { value: '100%', correct: false },
  ],
}

const COLLECTION = {
  name: 'Collection (Version 1)',
  description: 'Collection Description',
  options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
}

const SEEDED_COURSE = 'Testkurs'

// From cypress/fixtures/W-activity-log.json
const ELEMENT = {
  newTitle: 'Activity Log Test Element Updated',
  message1: 'This is a test message for the activity log.',
  message2: 'This is another test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
}

const LIVE_QUIZ = {
  name: 'Activity Log Test Live Quiz',
  displayName: 'Activity Log Test Live Quiz',
  message: 'This is a test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
  messagePro4: 'User pro4 was here',
}

const PRACTICE_QUIZ = {
  name: 'Activity Log Test Practice Quiz',
  displayName: 'Activity Log Test Practice Quiz',
  message: 'This is a test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
  messagePro4: 'User pro4 was here',
}

const MICRO_LEARNING = {
  name: 'Activity Log Test Micro Learning',
  displayName: 'Activity Log Test Micro Learning',
  message: 'This is a test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
  messagePro4: 'User pro4 was here',
}

const GROUP_ACTIVITY = {
  name: 'Activity Log Test Group Activity',
  displayName: 'Activity Log Test Group Activity',
  message: 'This is a test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
  messagePro4: 'User pro4 was here',
}

const COURSE_LOG = {
  message: 'This is a test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
  messagePro4: 'User pro4 was here',
}

const ANSWER_COLLECTION_LOG = {
  message: 'This is a test message for the activity log.',
  messagePro1: 'User pro1 was here',
  messagePro2: 'User pro2 was here',
  messagePro3: 'User pro3 was here',
}

const PERM_READ = 'Read'
const PERM_WRITE = 'Write'
const PERM_EXECUTE = 'Execute'
const PERM_ADMIN = 'Admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open the activity log modal for an element from its dropdown actions.
 */
async function openElementActivityLog(page: Page, elementTitle: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementTitle)
  await page.keyboard.press('Enter')
  await page.getByTestId(`actions-element-${elementTitle}`).click()
  await page.getByTestId(`view-activity-log-${elementTitle}`).click()
}

/**
 * Submit a new message in the activity log and verify it appears.
 */
async function addAndVerifyActivityLogMessage(page: Page, message: string) {
  await page.getByTestId('activity-log-input').click()
  await page.getByTestId('activity-log-input').pressSequentially(message)
  await page.getByTestId('activity-log-submit').click()
  await expect(page.getByTestId(`activity-log-entry-${message}`)).toBeVisible()
}

/**
 * Verify that multiple activity log messages are visible, optionally add a new one.
 */
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
  await expect(page.getByTestId(`activity-log-entry-${message}`)).toBeVisible()

  if (message2) {
    await expect(
      page.getByTestId(`activity-log-entry-${message2}`)
    ).toBeVisible()
  }
  if (message3) {
    await expect(
      page.getByTestId(`activity-log-entry-${message3}`)
    ).toBeVisible()
  }
  if (message4) {
    await expect(
      page.getByTestId(`activity-log-entry-${message4}`)
    ).toBeVisible()
  }

  if (newMessage) {
    await addAndVerifyActivityLogMessage(page, newMessage)
  }

  await page.getByTestId('close-activity-log').click()
}

/**
 * Verify full element activity log content (creation + both messages + title change + status change).
 */
async function verifyActivityLogContent(
  page: Page,
  options: {
    includeMessage2?: boolean
    includeMessage3?: boolean
  } = {}
) {
  const creationMessage = `${LECTURER_SHORTNAME} created this object.`
  const titleChangeMessage = `${LECTURER_SHORTNAME} modified title (${SC.title} -> ${ELEMENT.newTitle}).`
  const statusChangeMessage = `${LECTURER_SHORTNAME} modified status (READY -> REVIEW).`

  await expect(
    page.getByTestId(`activity-log-entry-${ELEMENT.message1}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`activity-log-entry-${ELEMENT.message2}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`activity-log-entry-${statusChangeMessage}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`activity-log-entry-${titleChangeMessage}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`activity-log-entry-${creationMessage}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`activity-log-entry-${ELEMENT.messagePro1}`)
  ).toBeVisible()

  if (options.includeMessage2) {
    await expect(
      page.getByTestId(`activity-log-entry-${ELEMENT.messagePro2}`)
    ).toBeVisible()
  }
  if (options.includeMessage3) {
    await expect(
      page.getByTestId(`activity-log-entry-${ELEMENT.messagePro3}`)
    ).toBeVisible()
  }
}

/**
 * Share an element with READ (pro1), WRITE (pro2), ADMIN (pro3).
 */
async function setUserPermissionsElementCollection(page: Page) {
  // READ for pro1
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_IND_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_READ).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
  ).toContainText(PERM_READ)

  // WRITE for pro2
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_INST_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_WRITE).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
  ).toContainText(PERM_WRITE)

  // ADMIN for pro3
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_INST2_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_ADMIN).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
  ).toContainText(PERM_ADMIN)
}

/**
 * Share an activity/course with READ (pro1), EXECUTE (pro2), WRITE (pro3), ADMIN (pro4).
 */
async function setUserPermissions(page: Page) {
  // READ for pro1
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_IND_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_READ).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
  ).toContainText(PERM_READ)

  // EXECUTE for pro2
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_INST_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_EXECUTE).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
  ).toContainText(PERM_EXECUTE)

  // WRITE for pro3
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_INST2_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_WRITE).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
  ).toContainText(PERM_WRITE)

  // ADMIN for pro4
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(LECTURER_INST3_SHORTNAME)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(PERM_ADMIN).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${LECTURER_INST3_SHORTNAME}`)
  ).toContainText(PERM_ADMIN)

  await page.getByTestId('close-share-object').click()
}

// ===========================================================================
// Part 1: Element Activity Log
// ===========================================================================
test.describe('Feature test for activity logs - Elements', () => {
  test('Create single choice question, access activity log and add a message', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Create a single choice question
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(SC.title)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(SC.content)
    await page.getByTestId('insert-answer-field-0').fill(SC.choices[0].value)
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(300)
    await page.getByTestId('insert-answer-field-1').fill(SC.choices[1].value)
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    // Open activity log from element dropdown
    await openElementActivityLog(page, SC.title)

    await addAndVerifyActivityLogMessage(page, ELEMENT.message1)
    await page.getByTestId('close-activity-log').click()
  })

  test('Verify that the creation of the question is logged in the activity log', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    const creationMessage = `${LECTURER_SHORTNAME} created this object.`

    await openElementActivityLog(page, SC.title)
    await expect(
      page.getByTestId(`activity-log-entry-${creationMessage}`)
    ).toBeVisible()
    await page.getByTestId('close-activity-log').click()
  })

  test('Access activity log from element edit modal and add another message', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId(`edit-element-${SC.title}`).click()

    // Switch to activity tab
    await page.getByTestId('element-activity-tab').click()
    await expect(
      page.getByTestId(`activity-log-entry-${ELEMENT.message1}`)
    ).toBeVisible()

    await addAndVerifyActivityLogMessage(page, ELEMENT.message2)
    await page.getByTestId('close-element-modal').click()
  })

  test('Track status modifications in the activity log', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Change status to REVIEW (without saving the element)
    await page.getByTestId(`edit-element-${SC.title}`).click()
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Review').click()
    await expect(page.getByTestId('select-question-status')).toContainText(
      'Review'
    )
    await page.getByTestId('close-element-modal').click()

    // Verify status change is logged
    const statusChangeMessage = `${LECTURER_SHORTNAME} modified status (READY -> REVIEW).`
    await openElementActivityLog(page, SC.title)
    await expect(
      page.getByTestId(`activity-log-entry-${statusChangeMessage}`)
    ).toBeVisible()
    await page.getByTestId('close-activity-log').click()
  })

  test('Track title modifications in the activity log', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Change title
    await page.getByTestId(`edit-element-${SC.title}`).click()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SC.title
    )
    await page.getByTestId('insert-question-title').fill(ELEMENT.newTitle)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Verify title change is logged
    const titleChangeMessage = `${LECTURER_SHORTNAME} modified title (${SC.title} -> ${ELEMENT.newTitle}).`
    await openElementActivityLog(page, ELEMENT.newTitle)
    await expect(
      page.getByTestId(`activity-log-entry-${titleChangeMessage}`)
    ).toBeVisible()
    await page.getByTestId('close-activity-log').click()

    // Change title back
    await page.getByTestId(`edit-element-${ELEMENT.newTitle}`).click()
    await page.getByTestId('insert-question-title').fill(SC.title)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)
  })

  test('Grant READ, WRITE, ADMIN permissions on the element to other users', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('elements-search-input').clear()
    await page.getByTestId('elements-search-input').fill(SC.title)
    await page.keyboard.press('Enter')
    await page.getByTestId(`actions-element-${SC.title}`).click()
    await page.getByTestId(`share-element-${SC.title}`).click()
    await setUserPermissionsElementCollection(page)
  })

  test('Log in as user with READ permissions, verify and add a message', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await openElementActivityLog(page, SC.title)
    await addAndVerifyActivityLogMessage(page, ELEMENT.messagePro1)

    await verifyActivityLogContent(page)
    await page.getByTestId('close-activity-log').click()

    // Also check from element edit modal
    await page.getByTestId(`element-title-${SC.title}`).click()
    await page.getByTestId('element-activity-tab').click()
    await verifyActivityLogContent(page)
    await page.getByTestId('close-element-modal').click()
  })

  test('Log in as user with WRITE permissions, verify and add a message', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await openElementActivityLog(page, SC.title)
    await addAndVerifyActivityLogMessage(page, ELEMENT.messagePro2)

    await verifyActivityLogContent(page, { includeMessage2: true })
    await page.getByTestId('close-activity-log').click()

    // Also check from element edit modal
    await page.getByTestId(`element-title-${SC.title}`).click()
    await page.getByTestId('element-activity-tab').click()
    await verifyActivityLogContent(page, { includeMessage2: true })
    await page.getByTestId('close-element-modal').click()
  })

  test('Log in as user with ADMIN permissions, verify and add a message', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await openElementActivityLog(page, SC.title)
    await addAndVerifyActivityLogMessage(page, ELEMENT.messagePro3)

    await verifyActivityLogContent(page, {
      includeMessage2: true,
      includeMessage3: true,
    })
    await page.getByTestId('close-activity-log').click()

    // Also check from element edit modal
    await page.getByTestId(`element-title-${SC.title}`).click()
    await page.getByTestId('element-activity-tab').click()
    await verifyActivityLogContent(page, {
      includeMessage2: true,
      includeMessage3: true,
    })
    await page.getByTestId('close-element-modal').click()
  })
})

// ===========================================================================
// Part 2: Activity logs for activities
// ===========================================================================
test.describe('Feature test for activity logs - Activities', () => {
  test('Create activities and share them with other users', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Create SC question for activities
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(SCML.title)
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SCML.content)
    await page.getByTestId('insert-answer-field-0').fill(SCML.choices[0].value)
    await page.getByTestId('set-correct-ix-0').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(300)
    await page.getByTestId('insert-answer-field-1').fill(SCML.choices[1].value)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create live quiz
    await page.getByTestId('activities').click()
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('insert-live-quiz-name').fill(LIVE_QUIZ.name)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${SEEDED_COURSE}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Create practice quiz
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('insert-practice-quiz-name').fill(PRACTICE_QUIZ.name)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${SEEDED_COURSE}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Create microlearning
    await page.getByTestId('create-microlearning').click()
    await page
      .getByTestId('insert-microlearning-name')
      .fill(MICRO_LEARNING.name)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${SEEDED_COURSE}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Create group activity
    await page.getByTestId('create-group-activity').click()
    await page
      .getByTestId('insert-group-activity-name')
      .fill(GROUP_ACTIVITY.name)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${SEEDED_COURSE}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('add-clue').click()
    await page.getByTestId('clue-name-0').fill('Clue 1')
    await page.getByTestId('clue-display-name-0').fill('First Hint')
    await page.getByTestId('clue-content-0').fill('Lorem ipsum dolor sit amet')
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('group-activity-task').fill('TASK')
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Share live quiz and add a comment
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`share-live-quiz-${LIVE_QUIZ.name}`).click()
    await setUserPermissions(page)

    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`view-activity-log-${LIVE_QUIZ.name}`).click()
    await addAndVerifyActivityLogMessage(page, LIVE_QUIZ.message)
    await page.getByTestId('close-activity-log').click()

    // Share practice quiz and add a comment
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${PRACTICE_QUIZ.name}`)
      .click()
    await page.getByTestId(`share-practice-quiz-${PRACTICE_QUIZ.name}`).click()
    await setUserPermissions(page)

    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${PRACTICE_QUIZ.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${PRACTICE_QUIZ.name}`).click()
    await addAndVerifyActivityLogMessage(page, PRACTICE_QUIZ.message)
    await page.getByTestId('close-activity-log').click()

    // Share microlearning and add a comment
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MICRO_LEARNING.name}`)
      .click()
    await page.getByTestId(`share-microlearning-${MICRO_LEARNING.name}`).click()
    await setUserPermissions(page)

    await page
      .getByTestId(`actions-MICRO_LEARNING-${MICRO_LEARNING.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${MICRO_LEARNING.name}`).click()
    await addAndVerifyActivityLogMessage(page, MICRO_LEARNING.message)
    await page.getByTestId('close-activity-log').click()

    // Share group activity and add a comment
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${GROUP_ACTIVITY.name}`)
      .click()
    await page
      .getByTestId(`share-group-activity-${GROUP_ACTIVITY.name}`)
      .click()
    await setUserPermissions(page)

    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${GROUP_ACTIVITY.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${GROUP_ACTIVITY.name}`).click()
    await addAndVerifyActivityLogMessage(page, GROUP_ACTIVITY.message)
    await page.getByTestId('close-activity-log').click()
  })

  test('Add messages to activities through user with READ permissions', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    // Live quiz
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`view-activity-log-${LIVE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: LIVE_QUIZ.message,
      newMessage: LIVE_QUIZ.messagePro1,
    })

    // Practice quiz
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${PRACTICE_QUIZ.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${PRACTICE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: PRACTICE_QUIZ.message,
      newMessage: PRACTICE_QUIZ.messagePro1,
    })

    // Microlearning
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MICRO_LEARNING.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${MICRO_LEARNING.name}`).click()
    await verifyActivityComments(page, {
      message: MICRO_LEARNING.message,
      newMessage: MICRO_LEARNING.messagePro1,
    })

    // Group activity
    await page.getByTestId(`view-activity-log-${GROUP_ACTIVITY.name}`).click()
    await verifyActivityComments(page, {
      message: GROUP_ACTIVITY.message,
      newMessage: GROUP_ACTIVITY.messagePro1,
    })
  })

  test('Add messages to activities through user with EXECUTE permissions', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()

    // Live quiz
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`view-activity-log-${LIVE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: LIVE_QUIZ.message,
      message2: LIVE_QUIZ.messagePro1,
      newMessage: LIVE_QUIZ.messagePro2,
    })

    // Practice quiz
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${PRACTICE_QUIZ.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${PRACTICE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: PRACTICE_QUIZ.message,
      message2: PRACTICE_QUIZ.messagePro1,
      newMessage: PRACTICE_QUIZ.messagePro2,
    })

    // Microlearning
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MICRO_LEARNING.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${MICRO_LEARNING.name}`).click()
    await verifyActivityComments(page, {
      message: MICRO_LEARNING.message,
      message2: MICRO_LEARNING.messagePro1,
      newMessage: MICRO_LEARNING.messagePro2,
    })

    // Group activity
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${GROUP_ACTIVITY.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${GROUP_ACTIVITY.name}`).click()
    await verifyActivityComments(page, {
      message: GROUP_ACTIVITY.message,
      message2: GROUP_ACTIVITY.messagePro1,
      newMessage: GROUP_ACTIVITY.messagePro2,
    })
  })

  test('Add messages to activities through user with WRITE permissions', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('activities').click()

    // Live quiz
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`view-activity-log-${LIVE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: LIVE_QUIZ.message,
      message2: LIVE_QUIZ.messagePro1,
      message3: LIVE_QUIZ.messagePro2,
      newMessage: LIVE_QUIZ.messagePro3,
    })

    // Practice quiz
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${PRACTICE_QUIZ.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${PRACTICE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: PRACTICE_QUIZ.message,
      message2: PRACTICE_QUIZ.messagePro1,
      message3: PRACTICE_QUIZ.messagePro2,
      newMessage: PRACTICE_QUIZ.messagePro3,
    })

    // Microlearning
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MICRO_LEARNING.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${MICRO_LEARNING.name}`).click()
    await verifyActivityComments(page, {
      message: MICRO_LEARNING.message,
      message2: MICRO_LEARNING.messagePro1,
      message3: MICRO_LEARNING.messagePro2,
      newMessage: MICRO_LEARNING.messagePro3,
    })

    // Group activity
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${GROUP_ACTIVITY.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${GROUP_ACTIVITY.name}`).click()
    await verifyActivityComments(page, {
      message: GROUP_ACTIVITY.message,
      message2: GROUP_ACTIVITY.messagePro1,
      message3: GROUP_ACTIVITY.messagePro2,
      newMessage: GROUP_ACTIVITY.messagePro3,
    })
  })

  test('Add messages to activities through user with ADMIN permissions', async ({
    loginInstitutionalCatalyst3,
    page,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('activities').click()

    // Live quiz
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`view-activity-log-${LIVE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: LIVE_QUIZ.message,
      message2: LIVE_QUIZ.messagePro1,
      message3: LIVE_QUIZ.messagePro2,
      message4: LIVE_QUIZ.messagePro3,
      newMessage: LIVE_QUIZ.messagePro4,
    })

    // Practice quiz
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${PRACTICE_QUIZ.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${PRACTICE_QUIZ.name}`).click()
    await verifyActivityComments(page, {
      message: PRACTICE_QUIZ.message,
      message2: PRACTICE_QUIZ.messagePro1,
      message3: PRACTICE_QUIZ.messagePro2,
      message4: PRACTICE_QUIZ.messagePro3,
      newMessage: PRACTICE_QUIZ.messagePro4,
    })

    // Microlearning
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MICRO_LEARNING.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${MICRO_LEARNING.name}`).click()
    await verifyActivityComments(page, {
      message: MICRO_LEARNING.message,
      message2: MICRO_LEARNING.messagePro1,
      message3: MICRO_LEARNING.messagePro2,
      message4: MICRO_LEARNING.messagePro3,
      newMessage: MICRO_LEARNING.messagePro4,
    })

    // Group activity
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${GROUP_ACTIVITY.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${GROUP_ACTIVITY.name}`).click()
    await verifyActivityComments(page, {
      message: GROUP_ACTIVITY.message,
      message2: GROUP_ACTIVITY.messagePro1,
      message3: GROUP_ACTIVITY.messagePro2,
      message4: GROUP_ACTIVITY.messagePro3,
      newMessage: GROUP_ACTIVITY.messagePro4,
    })
  })
})

// ===========================================================================
// Part 3: Activity log for courses
// ===========================================================================
test.describe('Feature test for activity logs - Courses', () => {
  test('Add a comment on the course and share it with other users', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()

    // Add a comment to the course
    await page.getByTestId(`activity-log-course-${SEEDED_COURSE}`).click()
    await addAndVerifyActivityLogMessage(page, COURSE_LOG.message)
    await page.getByTestId('close-activity-log').click()

    // Share the course with other users
    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()
    await page.getByTestId('course-share-button').click()
    await setUserPermissions(page)
  })

  test('Log in as user with READ permissions and add message to course log', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('courses').click()

    await page.getByTestId(`activity-log-course-${SEEDED_COURSE}`).click()
    await verifyActivityComments(page, {
      message: COURSE_LOG.message,
      newMessage: COURSE_LOG.messagePro1,
    })
  })

  test('Log in as user with EXECUTE permissions and add message to course log', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('courses').click()

    await page.getByTestId(`activity-log-course-${SEEDED_COURSE}`).click()
    await verifyActivityComments(page, {
      message: COURSE_LOG.message,
      message2: COURSE_LOG.messagePro1,
      newMessage: COURSE_LOG.messagePro2,
    })
  })

  test('Log in as user with WRITE permissions and add message to course log', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('courses').click()

    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()
    await page.getByTestId('course-activity-log-button').click()
    await verifyActivityComments(page, {
      message: COURSE_LOG.message,
      message2: COURSE_LOG.messagePro1,
      message3: COURSE_LOG.messagePro2,
      newMessage: COURSE_LOG.messagePro3,
    })
  })

  test('Log in as user with ADMIN permissions and add message to course log', async ({
    loginInstitutionalCatalyst3,
    page,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('courses').click()

    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()
    await page.getByTestId('course-activity-log-button').click()
    await verifyActivityComments(page, {
      message: COURSE_LOG.message,
      message2: COURSE_LOG.messagePro1,
      message3: COURSE_LOG.messagePro2,
      message4: COURSE_LOG.messagePro3,
      newMessage: COURSE_LOG.messagePro4,
    })
  })
})

// ===========================================================================
// Part 4: Activity log for answer collections
// ===========================================================================
test.describe('Feature test for activity logs - Answer Collections', () => {
  test('Create an answer collection, add a comment and share it with other users', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    // Create collection
    await page.getByTestId('create-answer-collection').click()
    await page.getByTestId('answer-collection-name').fill(COLLECTION.name)
    await page
      .getByTestId('answer-collection-description')
      .fill(COLLECTION.description)
    for (let i = 0; i < COLLECTION.options.length; i++) {
      if (i > 0) {
        await page.getByTestId('add-answer-collection-entry').click()
      }
      await page
        .getByTestId(`answer-collection-entry-${i}`)
        .fill(COLLECTION.options[i])
    }
    await page.getByTestId('create-answer-collection-submit').click()
    await page.waitForTimeout(500)

    // Add comment to collection
    await page
      .getByTestId(`answer-collection-actions-${COLLECTION.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${COLLECTION.name}`).click()
    await addAndVerifyActivityLogMessage(page, ANSWER_COLLECTION_LOG.message)
    await page.getByTestId('close-activity-log').click()

    // Share collection with other users
    await page
      .getByTestId(`answer-collection-actions-${COLLECTION.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await setUserPermissionsElementCollection(page)
  })

  test('Log in as user with READ permissions and add message to collection log', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    await page
      .getByTestId(`answer-collection-actions-${COLLECTION.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${COLLECTION.name}`).click()
    await verifyActivityComments(page, {
      message: ANSWER_COLLECTION_LOG.message,
      newMessage: ANSWER_COLLECTION_LOG.messagePro1,
    })
  })

  test('Log in as user with WRITE permissions and add message to collection log', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    await page
      .getByTestId(`answer-collection-actions-${COLLECTION.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${COLLECTION.name}`).click()
    await verifyActivityComments(page, {
      message: ANSWER_COLLECTION_LOG.message,
      newMessage: ANSWER_COLLECTION_LOG.messagePro1,
    })
  })

  test('Log in as user with ADMIN permissions and add message to collection log', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()

    await page
      .getByTestId(`answer-collection-actions-${COLLECTION.name}`)
      .click()
    await page.getByTestId(`view-activity-log-${COLLECTION.name}`).click()
    await verifyActivityComments(page, {
      message: ANSWER_COLLECTION_LOG.message,
      message2: ANSWER_COLLECTION_LOG.messagePro1,
      newMessage: ANSWER_COLLECTION_LOG.messagePro2,
    })
  })
})
