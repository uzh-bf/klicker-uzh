/**
 * N-course.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/N-course-workflow.cy.ts
 * Tests course creation, gamification, random group assignment,
 * course editing/archiving, deletion, and course sharing permissions.
 */

import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { type Page } from '@playwright/test'
import { chooseActivityAction } from '../util/actions.js'
import { cleanupTest } from '../util/cleanup.js'
import {
  LECTURER_EMAIL,
  LECTURER_ID,
  LECTURER_IND_EMAIL,
  LECTURER_IND_ID,
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_ID,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_ID,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST4_ID,
  LECTURER_INST4_SHORTNAME,
  LECTURER_INST_EMAIL,
  LECTURER_INST_ID,
  LECTURER_INST_SHORTNAME,
  LECTURER_SHORTNAME,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  STUDENT_USERNAME10,
  STUDENT_USERNAME11,
  STUDENT_USERNAME12,
  STUDENT_USERNAME2,
  STUDENT_USERNAME3,
  STUDENT_USERNAME4,
  STUDENT_USERNAME5,
  STUDENT_USERNAME6,
  STUDENT_USERNAME7,
  STUDENT_USERNAME8,
  STUDENT_USERNAME9,
  URL_STUDENT_LOGIN,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createGroupActivity as createGroupActivityActivity,
  createLiveQuiz as createLiveQuizActivity,
  createMicroLearning as createMicroLearningActivity,
  createPracticeQuiz as createPracticeQuizActivity,
} from '../util/fixtures/activities.js'
import {
  attachCourseCompetencyTree,
  createCourseDuplicationFailureFixture,
  createCourseRecord,
  createDeletedCourseActivities,
  deleteCourseWithActivitiesByName,
  deleteLiveQuizDirectPermission,
  ensureCourseParticipation,
  getCourseDuplicationSummary,
  getCourseLiveQuizResponseSummary,
  getCoursePin,
  grantLiveQuizDirectPermission,
  resetCourseLiveQuiz,
  submitCourseLiveQuizStudentResponse,
  updateCourseGroupDeadlineDate,
  updateElementContentAndInstances,
  type CourseDuplicationSummary,
  type CourseLiveQuizResponseSummary,
} from '../util/fixtures/courses.js'
import {
  createAnswerCollection as createAnswerCollectionDirect,
  createQuestionSC,
  createQuestionSE as createQuestionSEDirect,
  deleteElement,
} from '../util/fixtures/elements.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import { createQuestionCS as createQuestionCSWorkflow } from '../util/workflow.js'

// ---------------------------------------------------------------------------
// Fixture data (from cypress/fixtures/N-course.json)
// ---------------------------------------------------------------------------
const COURSE1 = {
  name: 'Course e265bead-e3a9-4aa9-b76b-eb8c6637d9f6',
  nameNew: 'Course 326ff897-554e-4b37-af6f-4c6e47efb775 NEW',
  displayName: 'Course e265bead-e3a9-4aa9-b76b-eb8c6637d9f6 (Display)',
  displayNameNew: 'Course 326ff897-554e-4b37-af6f-4c6e47efb775 NEW (Display)',
  notificationEmail: 'course1@example.com',
  notificationEmailNew: 'course1_new@example.com',
  description: "This description summarises the course's content.",
}

const COURSE2 = {
  name: 'Course 33a79abc-debc-4374-9405-38e99f92fba8',
  displayName: 'Course 33a79abc-debc-4374-9405-38e99f92fba8 (Display)',
  notificationEmail: 'course2@example.com',
  group1: 'Group Student 11',
  group2: 'Group Student 12',
}

const RUNNING_COURSE = { name: 'Testkurs' }
const PAST_COURSE = { name: 'Testkurs 2' }

const DELETION = {
  courseName: 'Course to be deleted',
  displayName: 'Course to be deleted display',
  notificationEmail: 'course_to_be_deleted@example.com',
  qTitle: 'Question Title',
  qContent: 'Question Content',
  lqName: 'Course Live Quiz',
  pqName: 'Course Practice Quiz',
  mlName: 'Course Micro Learning',
}

const SHARING = {
  course: 'Sharing Course Name',
  courseDisplayName: 'Sharing Course Display Name',
  courseNotificationEmail: 'sharing_course@example.com',
  liveQuiz: 'Sharing Live Quiz',
  practiceQuiz: 'Sharing Practice Quiz',
  microLearning: 'Sharing Micro Learning',
  groupActivity: 'Sharing Group Activity',
  group1: 'Group 1',
  group2: 'Group 2',
  group3: 'Group 3',
  group4: 'Group 4',
  group5: 'Group 5',
}

// From cypress/fixtures/questions.json
const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: [
    { value: '50%', correct: true },
    { value: '100%', correct: false },
  ],
}

const NRML = {
  title: 'NR Title Test 2 (Version 1)',
  content: 'NR Question Content 2',
  options: {
    min: '0',
    max: '100',
    unit: '%',
    accuracy: '2',
    solutionRanges: [
      { min: '0', max: '25' },
      { min: '75', max: '100' },
    ],
  },
}

const COLLECTION = {
  name: 'Collection (Version 1)',
  description: 'Collection Description',
  options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
}

const SEML = {
  title: 'SE Title Test 2 (Version 1)',
  content: 'SE Question Content 2',
  inputs: 3,
  solutions: [0, 1, 2, 4],
}

const CSML = {
  title: 'CS Title Test 1 (Version 1)',
  content: 'CS Question Test 1',
  explanation: 'CS Explanation Test 1',
  selectedItems: [0, 2, 4],
  criteria: [
    {
      id: '90OfR7GSUB',
      mode: 'range',
      name: 'Criterion 1 with range 0-100',
      min: 0,
      max: 100,
      step: 0.2,
      unit: '%',
    },
    {
      id: 'cAJKuQKzm5',
      mode: 'range',
      name: 'Criterion 2 with range -500 to 1000',
      min: -500,
      max: 1000,
      step: 10,
    },
  ],
  cases: [
    {
      id: 'SrrZEpetE2',
      title: 'Case 1',
      description: 'Case 1 Description',
    },
    {
      id: 'KELATtvxs_',
      title: 'Case 2',
      description: 'Case 2 Description',
    },
  ],
  solutions: {
    0: {
      0: {
        0: {
          lower: 23.4,
          upper: 87.9,
        },
        1: {
          lower: -234.5,
          upper: 456.7,
        },
      },
      1: {
        0: {
          lower: 0,
          upper: 100,
        },
        1: {
          lower: -500,
          upper: 789.3,
        },
      },
      2: {
        0: {
          lower: 45.6,
          upper: 92.1,
        },
        1: {
          lower: -123.4,
          upper: 1000,
        },
      },
    },
    1: {
      0: {
        0: {
          lower: 12.8,
          upper: 67.3,
        },
        1: {
          lower: -432.1,
          upper: 567.8,
        },
      },
      1: {
        0: {
          lower: 34.5,
          upper: 89.2,
        },
        1: {
          lower: -345.6,
          upper: 890.1,
        },
      },
      2: {
        0: {
          lower: 56.7,
          upper: 78.9,
        },
        1: {
          lower: -289.3,
          upper: 678.2,
        },
      },
    },
  },
}

// i18n string equivalents
const PERM_READ = 'Read'
const PERM_WRITE = 'Write'
const PERM_EXECUTE = 'Execution'
const PERM_ADMIN = 'Admin'
const PERM_OWNER = 'Owner'
const COURSE_DUPLICATION_RESPONSE_TIMEOUT = 120_000
const COURSE_DUPLICATION_TEST_TIMEOUT = 180_000
const SHARING_COURSE_GROUP_DEADLINE = new Date(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  2,
  12
)

const permissionTestIds: Record<string, string> = {
  [PERM_READ]: 'READ',
  [PERM_EXECUTE]: 'EXECUTE',
  [PERM_WRITE]: 'WRITE',
  [PERM_ADMIN]: 'ADMIN',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the activities list by clicking the "activities" nav item,
 * then click "create-new-activity".
 */
async function goToCreateNewActivity(page: Page) {
  await page.getByTestId('create-new-activity').click()
}

async function ensureCreateActivityMenuOpen(
  page: Page,
  activityTestId: string
) {
  if (
    !(await page
      .getByTestId(activityTestId)
      .isVisible({ timeout: 1000 })
      .catch(() => false))
  ) {
    await page.getByTestId('create-new-activity').click()
  }
}

/**
 * Create a Single Choice question via the question library UI.
 */
async function createSCQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
) {
  await page.getByTestId('create-question').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  for (let i = 0; i < choices.length; i++) {
    if (i > 0) {
      await page.getByTestId('add-new-answer').click()
    }
    await page.getByTestId(`set-answer-${i}`).fill(choices[i].value)
    if (choices[i].correct) {
      await page.getByTestId(`set-correct-ix-${i}`).click()
    }
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

/**
 * Create a Numerical Range question via the question library UI.
 */
async function createNRQuestion(
  page: Page,
  title: string,
  content: string,
  options: {
    min?: string
    max?: string
    unit?: string
    accuracy?: string
    solutionRanges?: { min?: string; max?: string }[]
  }
) {
  await page.getByTestId('create-question').click()
  // Switch to NR type
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Numerical (NR)').click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  if (options.min !== undefined) {
    await page.getByTestId('set-numerical-minimum').fill(options.min)
  }
  if (options.max !== undefined) {
    await page.getByTestId('set-numerical-maximum').fill(options.max)
  }
  if (options.unit !== undefined) {
    await page.getByTestId('set-numerical-unit').fill(options.unit)
  }
  if (options.accuracy !== undefined) {
    await page.getByTestId('set-numerical-accuracy').fill(options.accuracy)
  }
  if (options.solutionRanges) {
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await page.getByTestId('set-solution-type-range').click()
    for (let i = 0; i < options.solutionRanges.length; i++) {
      await page.getByTestId('add-solution-range').click()
      const range = options.solutionRanges[i]
      if (range.min !== undefined) {
        await page.getByTestId(`set-solution-range-min-${i}`).fill(range.min)
      }
      if (range.max !== undefined) {
        await page.getByTestId(`set-solution-range-max-${i}`).fill(range.max)
      }
    }
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

/**
 * Create an answer collection in Resources → Answer Collections.
 */
async function createAnswerCollection(
  page: Page,
  name: string,
  description: string,
  options: string[]
) {
  await page.getByTestId('create-answer-collection').click()
  await page.getByTestId('answer-collection-name').fill(name)
  await page.getByTestId('answer-collection-description').fill(description)
  for (let i = 0; i < options.length; i++) {
    if (i > 0) {
      await page.getByTestId('add-answer-collection-entry').click()
    }
    await page.getByTestId(`answer-collection-entry-${i}`).fill(options[i])
  }
  await page.getByTestId('create-answer-collection-submit').click()
  await page.waitForTimeout(500)
}

/**
 * Create an SE (Selection) question that uses an answer collection.
 */
async function createSEQuestion(
  page: Page,
  title: string,
  content: string,
  collectionName: string,
  solutionIndices: number[],
  numInputs: number
) {
  await page.getByTestId('create-question').click()
  // Switch to SE type
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Selection (SE)').click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  await page.getByTestId('select-answer-collection').click()
  await page.getByTestId(`select-answer-collection-${collectionName}`).click()

  for (const idx of solutionIndices) {
    await page.getByTestId(`set-correct-ix-${idx}`).click()
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

/**
 * Create a live quiz via the activity wizard.
 */
async function createLiveQuiz(
  page: Page,
  name: string,
  courseName: string,
  questionTitle: string
) {
  await ensureCreateActivityMenuOpen(page, 'create-live-quiz')
  await page.getByTestId('create-live-quiz').click()

  // Step 1: name + course
  await page.getByTestId('insert-live-quiz-name').fill(name)
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  // Step 2: description (skip)
  await page.getByTestId('next-or-submit').click()

  // Step 3: add question
  await page.getByTestId('search-element-input').fill(questionTitle)
  await page.getByTestId(`add-element-${questionTitle}`).click()
  await page.getByTestId('next-or-submit').click()

  await page.waitForTimeout(500)
}

/**
 * Create a practice quiz via the activity wizard.
 */
async function createPracticeQuiz(
  page: Page,
  name: string,
  courseName: string,
  questionTitle: string
) {
  await ensureCreateActivityMenuOpen(page, 'create-practice-quiz')
  await page.getByTestId('create-practice-quiz').click()

  // Step 1: name + course
  await page.getByTestId('insert-practice-quiz-name').fill(name)
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  // Step 2: description (skip)
  await page.getByTestId('next-or-submit').click()

  // Step 3: add question to a stack
  await page.getByTestId('search-element-input').fill(questionTitle)
  await page.getByTestId(`add-element-${questionTitle}`).click()
  await page.getByTestId('next-or-submit').click()

  await page.waitForTimeout(500)
}

/**
 * Create a microlearning via the activity wizard.
 */
async function createMicroLearning(
  page: Page,
  name: string,
  courseName: string,
  questionTitle: string
) {
  await ensureCreateActivityMenuOpen(page, 'create-microlearning')
  await page.getByTestId('create-microlearning').click()

  // Step 1: name + course
  await page.getByTestId('insert-microlearning-name').fill(name)
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  // Step 2: dates (use default dates, just proceed)
  await page.getByTestId('next-or-submit').click()

  // Step 3: add question
  await page.getByTestId('search-element-input').fill(questionTitle)
  await page.getByTestId(`add-element-${questionTitle}`).click()
  await page.getByTestId('next-or-submit').click()

  await page.waitForTimeout(500)
}

/**
 * Create a group activity via the activity wizard.
 */
async function createGroupActivity(
  page: Page,
  name: string,
  courseName: string,
  questionTitle: string
) {
  await ensureCreateActivityMenuOpen(page, 'create-group-activity')
  await page.getByTestId('create-group-activity').click()

  // Step 1: name + course
  await page.getByTestId('insert-group-activity-name').fill(name)
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  // Step 2: clues (add at least one text clue)
  await page.getByTestId('add-clue').click()
  await page.getByTestId('clue-name-0').fill('Clue 1')
  await page.getByTestId('clue-display-name-0').fill('First Hint')
  await page.getByTestId('clue-content-0').fill('Lorem ipsum dolor sit amet')
  await page.getByTestId('next-or-submit').click()

  // Step 3: task description
  await page.getByTestId('group-activity-task').fill('Task Description')
  await page.getByTestId('next-or-submit').click()

  // Step 4: add question
  await page.getByTestId('search-element-input').fill(questionTitle)
  await page.getByTestId(`add-element-${questionTitle}`).click()
  await page.getByTestId('next-or-submit').click()

  await page.waitForTimeout(500)
}

/**
 * Share a course with a specific user and permission level.
 */
async function grantCoursePermission(
  page: Page,
  usernameOrEmail: string,
  permissionLabel: string,
  propagation = false
) {
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(usernameOrEmail)
  await page.getByTestId('new-permission-access-level').click()
  await page
    .getByTestId(`permission-level-${permissionTestIds[permissionLabel]}`)
    .click()
  if (propagation) {
    await page.getByTestId('new-permission-propagation').click()
    await expect(
      page.getByTestId('new-permission-propagation')
    ).toHaveAttribute('data-state', 'checked')
  }
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
}

/**
 * Share a course with a user group and permission level.
 */
async function grantGroupPermission(
  page: Page,
  groupName: string,
  permissionLabel: string,
  propagation = false
) {
  await page.getByTestId('new-permission-user-group').click()
  await page.getByText(groupName).click()
  await page.getByTestId('new-permission-access-level').click()
  await page
    .getByTestId(`permission-level-${permissionTestIds[permissionLabel]}`)
    .click()
  if (propagation) {
    await page.getByTestId('new-permission-propagation').click()
    await expect(
      page.getByTestId('new-permission-propagation')
    ).toHaveAttribute('data-state', 'checked')
  }
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
}

/**
 * Verify that a user has READ-level course permissions (can see activities, not elements/collections).
 */
async function verifyCourseReadPermissions(page: Page) {
  // elements not visible
  for (const title of [SCML.title, NRML.title, SEML.title, CSML.title]) {
    await page.getByTestId('elements-search-input').fill(title)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`element-item-${title}`)).not.toBeVisible()
    await page.getByTestId('elements-search-input').clear()
  }

  // answer collection not visible
  await page.getByTestId('resources').click()
  await page.getByTestId('answer-collections').click()
  await expect(
    page.getByTestId(`answer-collection-${COLLECTION.name}`)
  ).not.toBeVisible()

  // activities visible with READ badge
  await page.getByTestId('activities').click()
  await expectActivityOverviewPermission(
    page,
    'LIVE_QUIZ',
    SHARING.liveQuiz,
    'READ'
  )
  await expectActivityOverviewPermission(
    page,
    'PRACTICE_QUIZ',
    SHARING.practiceQuiz,
    'READ'
  )
  await expectActivityOverviewPermission(
    page,
    'MICRO_LEARNING',
    SHARING.microLearning,
    'READ'
  )
  await expectActivityOverviewPermission(
    page,
    'GROUP_ACTIVITY',
    SHARING.groupActivity,
    'READ'
  )
  // course with READ badge
  await page.getByTestId('courses').click()
  await expectCourseCardPermission(page, SHARING.course, 'READ')
  await page.getByTestId(`course-list-button-${SHARING.course}`).click()
  await expect(page.getByTestId('course-share-button')).not.toBeVisible()
  await expect(page.getByTestId('course-duplicate-button')).not.toBeVisible()
  await expectCourseActivityPermissionTabs(page, {
    liveQuiz: 'READ',
    practiceQuiz: 'READ',
    microLearning: 'READ',
    groupActivity: 'READ',
  })
}

/**
 * Verify that a user has EXECUTE-level course permissions.
 */
async function verifyCourseExecutePermissions(page: Page) {
  // elements not visible
  for (const title of [SCML.title, NRML.title, SEML.title, CSML.title]) {
    await page.getByTestId('elements-search-input').fill(title)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`element-item-${title}`)).not.toBeVisible()
    await page.getByTestId('elements-search-input').clear()
  }

  await page.getByTestId('activities').click()
  await expectActivityOverviewPermission(
    page,
    'LIVE_QUIZ',
    SHARING.liveQuiz,
    'EXECUTE'
  )
  await expectActivityOverviewPermission(
    page,
    'PRACTICE_QUIZ',
    SHARING.practiceQuiz,
    'EXECUTE'
  )
  await expectActivityOverviewPermission(
    page,
    'MICRO_LEARNING',
    SHARING.microLearning,
    'EXECUTE'
  )
  await expectActivityOverviewPermission(
    page,
    'GROUP_ACTIVITY',
    SHARING.groupActivity,
    'EXECUTE'
  )
  await page.getByTestId('courses').click()
  await expectCourseCardPermission(page, SHARING.course, 'EXECUTE')
  await page.getByTestId(`course-list-button-${SHARING.course}`).click()
  await expect(page.getByTestId('course-share-button')).not.toBeVisible()
  await expect(page.getByTestId('course-duplicate-button')).not.toBeVisible()
  await expectCourseActivityPermissionTabs(page, {
    liveQuiz: 'EXECUTE',
    practiceQuiz: 'EXECUTE',
    microLearning: 'EXECUTE',
    groupActivity: 'EXECUTE',
  })
}

/**
 * Verify that a user has WRITE-level course permissions.
 * propagation=true: activities show WRITE badge
 * propagation=false: activities show EXECUTE badge (course-level WRITE without propagation)
 */
async function verifyCourseWritePermissions(page: Page, propagation: boolean) {
  const activityBadge = propagation ? 'WRITE' : 'EXECUTE'

  await page.getByTestId('activities').click()
  await expectActivityOverviewPermission(
    page,
    'LIVE_QUIZ',
    SHARING.liveQuiz,
    activityBadge
  )
  await expectActivityOverviewPermission(
    page,
    'PRACTICE_QUIZ',
    SHARING.practiceQuiz,
    activityBadge
  )
  await expectActivityOverviewPermission(
    page,
    'MICRO_LEARNING',
    SHARING.microLearning,
    activityBadge
  )
  await expectActivityOverviewPermission(
    page,
    'GROUP_ACTIVITY',
    SHARING.groupActivity,
    activityBadge
  )
  await page.getByTestId('courses').click()
  await expectCourseCardPermission(page, SHARING.course, 'WRITE')
  await page.getByTestId(`course-list-button-${SHARING.course}`).click()
  await expect(page.getByTestId('course-share-button')).not.toBeVisible()
  await expect(page.getByTestId('course-duplicate-button')).not.toBeVisible()
  await expectCourseActivityPermissionTabs(page, {
    liveQuiz: activityBadge,
    practiceQuiz: activityBadge,
    microLearning: activityBadge,
    groupActivity: activityBadge,
  })
}

/**
 * Verify that a user has ADMIN-level course permissions.
 */
async function verifyCourseAdminPermissions(page: Page, checkBadge: boolean) {
  await page.getByTestId('activities').click()
  await expectActivityOverviewPermission(
    page,
    'LIVE_QUIZ',
    SHARING.liveQuiz,
    'ADMIN'
  )
  await expectActivityOverviewPermission(
    page,
    'PRACTICE_QUIZ',
    SHARING.practiceQuiz,
    'ADMIN'
  )
  await expectActivityOverviewPermission(
    page,
    'MICRO_LEARNING',
    SHARING.microLearning,
    'ADMIN'
  )
  await expectActivityOverviewPermission(
    page,
    'GROUP_ACTIVITY',
    SHARING.groupActivity,
    'ADMIN'
  )
  await page.getByTestId('courses').click()
  if (checkBadge) {
    await expectCourseCardPermission(page, SHARING.course, 'ADMIN')
  }
  await page.getByTestId(`course-list-button-${SHARING.course}`).click()
  await expect(page.getByTestId('course-share-button')).toBeVisible()
  await expect(page.getByTestId('course-duplicate-button')).toBeVisible()
  await expectCourseActivityPermissionTabs(page, {
    liveQuiz: 'ADMIN',
    practiceQuiz: 'ADMIN',
    microLearning: 'ADMIN',
    groupActivity: 'ADMIN',
  })
}

/**
 * Verify that a user has lost access to the course and its content.
 */
async function verifyCourseAccessLost(page: Page) {
  await page.getByTestId('courses').click()
  await expect(
    page.getByTestId(`course-list-button-${SHARING.course}`)
  ).not.toBeVisible()

  await page.getByTestId('activities').click()
  await expect(
    page.getByTestId(`activity-LIVE_QUIZ-${SHARING.liveQuiz}`)
  ).not.toBeVisible()
}

async function loginStudentPassword(page: Page, username: string) {
  await page.context().clearCookies()
  await page.goto('about:blank').catch(() => undefined)
  await page.goto(URL_STUDENT_LOGIN, { waitUntil: 'commit', timeout: 300_000 })
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
  })
  await page.getByTestId('username-field').fill(username)
  await page.getByTestId('password-field').fill(STUDENT_PASSWORD)
  await expect(page.getByTestId('submit-login')).toBeEnabled()
  await page.getByTestId('submit-login').click()
  await expect(page.getByTestId('homepage')).toBeVisible()
}

async function joinCourse(page: Page, coursePin: number) {
  await page.getByTestId('join-new-course').click()
  await page.locator('input[data-input-otp="true"]').fill(String(coursePin))
  await expect(page.getByTestId('join-course-submit-form')).toBeEnabled()
  await page.getByTestId('join-course-submit-form').click()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function openStudentCourse(page: Page, displayName: string) {
  const courseByTestId = page.getByTestId(`course-button-${displayName}`)

  if (await courseByTestId.isVisible({ timeout: 5000 }).catch(() => false)) {
    await courseByTestId.click()
    return
  }

  await page
    .getByRole('link', { name: new RegExp(escapeRegExp(displayName)) })
    .click()
}

async function openStudentGroupTab(page: Page) {
  await page.getByRole('tab', { name: 'Create/Join Group' }).click()
  await expect(page.getByTestId('student-course-create-group')).toBeVisible()
}

async function confirmCourseDeletion(page: Page) {
  const finalConfirm = page.getByTestId('course-deletion-modal-confirm')

  for (let ix = 0; ix < 10; ix++) {
    if (await finalConfirm.isEnabled().catch(() => false)) {
      await finalConfirm.click()
      return
    }

    const confirmButtons = page.getByRole('button', { name: 'Confirm' })
    const count = await confirmButtons.count()
    let clicked = false

    for (let buttonIx = 0; buttonIx < count; buttonIx++) {
      const button = confirmButtons.nth(buttonIx)
      if (await button.isEnabled().catch(() => false)) {
        await button.click()
        clicked = true
        break
      }
    }

    if (!clicked) break
  }

  await expect(finalConfirm).toBeEnabled()
  await finalConfirm.click()
}

async function openCourseInManage(page: Page, courseName: string) {
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${courseName}`).click()
  await expect(page.getByTestId('tab-liveQuizzes')).toBeVisible({
    timeout: 30_000,
  })
}

async function submitCourseDuplication(page: Page, copyName?: string) {
  await expect(page.getByTestId('course-duplicate-button')).toBeVisible()
  await page.getByTestId('course-duplicate-button').click()

  if (copyName) {
    await page.getByTestId('course-name').fill(copyName)
    await page.getByTestId('course-display-name').fill(copyName)
  }

  await submitCourseFormAndWaitForCreateCourse(page)
}

async function submitCourseFormAndWaitForCreateCourse(
  page: Page,
  { expectSuccess = true }: { expectSuccess?: boolean } = {}
) {
  const createCourseResponse = page.waitForResponse(
    (response) => {
      const request = response.request()
      const postData = request.postData() ?? ''

      return (
        request.method() === 'POST' &&
        postData.includes('CreateCourse') &&
        response.status() < 500
      )
    },
    { timeout: COURSE_DUPLICATION_RESPONSE_TIMEOUT }
  )

  await page.getByTestId('manipulate-course-submit').click()
  const response = await createCourseResponse
  const body = (await response.json().catch(() => null)) as {
    errors?: unknown[]
  } | null

  if (expectSuccess) {
    expect(response.ok()).toBeTruthy()
    expect(body?.errors ?? []).toEqual([])
    await expect(page.getByTestId('course-name')).not.toBeVisible({
      timeout: 30_000,
    })
  } else {
    expect(body?.errors?.length ?? 0).toBeGreaterThan(0)
  }
}

async function expectCourseCardPermission(
  page: Page,
  courseName: string,
  permissionLevel: string
) {
  const courseCard = page.getByTestId(`course-list-button-${courseName}`)
  await expect(
    courseCard.getByTestId(`permission-level-${courseName}-${permissionLevel}`)
  ).toBeVisible()
}

async function expectActivityOverviewPermission(
  page: Page,
  type: 'LIVE_QUIZ' | 'PRACTICE_QUIZ' | 'MICRO_LEARNING' | 'GROUP_ACTIVITY',
  activityName: string,
  permissionLevel: string
) {
  const activityRow = page.getByTestId(`activity-${type}-${activityName}`)
  await expect(activityRow).toBeVisible()
  await expect(
    activityRow.getByTestId(
      `permission-level-${activityName}-${permissionLevel}`
    )
  ).toBeVisible()
}

async function expectCourseActivityPermissionTabs(
  page: Page,
  permissionLevelByActivity: {
    liveQuiz: string
    practiceQuiz: string
    microLearning: string
    groupActivity: string
  }
) {
  await page.getByTestId('tab-liveQuizzes').click()
  await expectActivityOverviewPermission(
    page,
    'LIVE_QUIZ',
    SHARING.liveQuiz,
    permissionLevelByActivity.liveQuiz
  )

  await page.getByTestId('tab-practiceQuizzes').click()
  await expectActivityOverviewPermission(
    page,
    'PRACTICE_QUIZ',
    SHARING.practiceQuiz,
    permissionLevelByActivity.practiceQuiz
  )

  await page.getByTestId('tab-microLearnings').click()
  await expectActivityOverviewPermission(
    page,
    'MICRO_LEARNING',
    SHARING.microLearning,
    permissionLevelByActivity.microLearning
  )

  await page.getByTestId('tab-groupActivities').click()
  await expectActivityOverviewPermission(
    page,
    'GROUP_ACTIVITY',
    SHARING.groupActivity,
    permissionLevelByActivity.groupActivity
  )
}

async function expectDuplicatedCourseSummary({
  courseName,
  ownerId,
  liveQuizzes,
  practiceQuizzes,
  microLearnings,
  groupActivities,
  directPermissions = 0,
}: {
  courseName: string
  ownerId?: string
  liveQuizzes: number
  practiceQuizzes: number
  microLearnings: number
  groupActivities: number
  directPermissions?: number
}) {
  const summary = await getCourseDuplicationSummary({ courseName, ownerId })

  expect(summary).not.toBeNull()
  expect(summary).toMatchObject({
    liveQuizzes,
    practiceQuizzes,
    microLearnings,
    groupActivities,
    participations: 0,
    participantGroups: 0,
    participantInvitations: 0,
    groupAssignmentPoolEntries: 0,
    directPermissions,
    questionResponses: 0,
    questionResponseDetails: 0,
    liveQuizResponses: 0,
    pointCorrections: 0,
    groupActivityInstances: 0,
    activityPerformances: 0,
    activityProgresses: 0,
    participantPerformances: 0,
    participantActivityPerformances: 0,
    aggregatedAnalytics: 0,
    aggregatedCourseAnalytics: 0,
    participantCourseAnalytics: 0,
  })
  expect(summary!.liveQuizStatuses).toEqual(Array(liveQuizzes).fill('DRAFT'))
  expect(summary!.practiceQuizStatuses).toEqual(
    Array(practiceQuizzes).fill('DRAFT')
  )
  expect(summary!.microLearningStatuses).toEqual(
    Array(microLearnings).fill('DRAFT')
  )
  expect(summary!.groupActivityStatuses).toEqual(
    Array(groupActivities).fill('DRAFT')
  )

  return summary!
}

async function verifyCourseDuplicationModalUi(page: Page) {
  await expect(page.getByTestId('course-name')).toHaveValue(
    `${SHARING.course} Copy`
  )
  await expect(page.getByTestId('course-display-name')).toHaveValue(
    `${SHARING.courseDisplayName} Copy`
  )
  await expect(page.getByTestId('course-duplication-copy-info')).toContainText(
    messages.manage.courseList.courseDuplicationCopyInfo
  )
  await expect(page.getByTestId('course-gamification')).not.toBeVisible()

  for (const testId of [
    'course-live-quizzes',
    'course-practice-quizzes',
    'course-microlearnings',
    'course-group-activities',
  ]) {
    await expect(page.getByTestId(testId)).toHaveAttribute(
      'data-state',
      'checked'
    )
    await page.getByTestId(testId).click()
    await expect(page.getByTestId(testId)).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    await page.getByTestId(testId).click()
    await expect(page.getByTestId(testId)).toHaveAttribute(
      'data-state',
      'checked'
    )
  }
}

async function verifyCopiedCourseActivities(page: Page) {
  await page.getByTestId('tab-liveQuizzes').click()
  await expect(
    page.getByTestId(`activity-LIVE_QUIZ-${SHARING.liveQuiz}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`status-${SHARING.liveQuiz}-DRAFT`)
  ).toBeVisible()

  await page.getByTestId('tab-practiceQuizzes').click()
  await expect(
    page.getByTestId(`activity-PRACTICE_QUIZ-${SHARING.practiceQuiz}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`status-${SHARING.practiceQuiz}-DRAFT`)
  ).toBeVisible()

  await page.getByTestId('tab-microLearnings').click()
  await expect(
    page.getByTestId(`activity-MICRO_LEARNING-${SHARING.microLearning}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`status-${SHARING.microLearning}-DRAFT`)
  ).toBeVisible()

  await page.getByTestId('tab-groupActivities').click()
  await expect(
    page.getByTestId(`activity-GROUP_ACTIVITY-${SHARING.groupActivity}`)
  ).toBeVisible()
  await expect(
    page.getByTestId(`status-${SHARING.groupActivity}-DRAFT`)
  ).toBeVisible()
}

function getActivityReference({
  summary,
  collection,
  activityName,
}: {
  summary: CourseDuplicationSummary
  collection:
    | 'liveQuizzes'
    | 'practiceQuizzes'
    | 'microLearnings'
    | 'groupActivities'
  activityName: string
}) {
  return summary.activityReferences[collection].find(
    (activity) => activity.name === activityName
  )
}

function expectCopiedActivityReferences({
  sourceSummary,
  copiedSummary,
}: {
  sourceSummary: CourseDuplicationSummary
  copiedSummary: CourseDuplicationSummary
}) {
  const activityRows = [
    {
      collection: 'liveQuizzes' as const,
      name: SHARING.liveQuiz,
    },
    {
      collection: 'practiceQuizzes' as const,
      name: SHARING.practiceQuiz,
    },
    {
      collection: 'microLearnings' as const,
      name: SHARING.microLearning,
    },
    {
      collection: 'groupActivities' as const,
      name: SHARING.groupActivity,
    },
  ]

  for (const activityRow of activityRows) {
    const sourceActivity = getActivityReference({
      summary: sourceSummary,
      collection: activityRow.collection,
      activityName: activityRow.name,
    })
    const copiedActivity = getActivityReference({
      summary: copiedSummary,
      collection: activityRow.collection,
      activityName: activityRow.name,
    })

    expect(sourceActivity, `source ${activityRow.name}`).toBeTruthy()
    expect(copiedActivity, `copied ${activityRow.name}`).toBeTruthy()
    expect(copiedActivity!.id).not.toEqual(sourceActivity!.id)
    expect(copiedActivity!.instances).toHaveLength(
      sourceActivity!.instances.length
    )

    sourceActivity!.instances.forEach((sourceInstance, ix) => {
      const copiedInstance = copiedActivity!.instances[ix]

      expect(copiedInstance.instanceId).not.toEqual(sourceInstance.instanceId)
      expect(copiedInstance.elementId).toEqual(sourceInstance.elementId)
    })
  }
}

function expectPermissionDetail({
  summary,
  detailsKey,
  objectType,
  objectId,
  userShortname,
  userGroupName,
  permissionLevel,
  propagation,
  derived,
}: {
  summary: CourseDuplicationSummary
  detailsKey: 'directPermissionDetails' | 'derivedPermissionDetails'
  objectType: string
  objectId: string
  userShortname?: string
  userGroupName?: string
  permissionLevel: string
  propagation?: boolean
  derived?: boolean
}) {
  const permission = summary[detailsKey].find((entry) => {
    return (
      entry.objectType === objectType &&
      entry.objectId === objectId &&
      entry.permissionLevel === permissionLevel &&
      (typeof userShortname === 'undefined' ||
        entry.userShortname === userShortname) &&
      (typeof userGroupName === 'undefined' ||
        entry.userGroupName === userGroupName)
    )
  })

  expect(
    permission,
    `${detailsKey} ${objectType} ${objectId} ${userShortname ?? userGroupName}`
  ).toBeTruthy()

  if (typeof propagation !== 'undefined') {
    expect(permission!.propagation).toEqual(propagation)
  }
  if (typeof derived !== 'undefined') {
    expect(permission!.derived).toEqual(derived)
  }
}

function expectCopiedIndividualPermissions(summary: CourseDuplicationSummary) {
  const copiedLiveQuiz = getActivityReference({
    summary,
    collection: 'liveQuizzes',
    activityName: SHARING.liveQuiz,
  })

  expect(copiedLiveQuiz).toBeTruthy()

  const courseDirectPermissions = [
    {
      userShortname: LECTURER_IND_SHORTNAME,
      permissionLevel: 'READ',
      propagation: false,
    },
    {
      userShortname: LECTURER_INST_SHORTNAME,
      permissionLevel: 'EXECUTE',
      propagation: false,
    },
    {
      userShortname: LECTURER_INST2_SHORTNAME,
      permissionLevel: 'WRITE',
      propagation: false,
    },
    {
      userShortname: LECTURER_INST3_SHORTNAME,
      permissionLevel: 'WRITE',
      propagation: true,
    },
    {
      userShortname: LECTURER_INST4_SHORTNAME,
      permissionLevel: 'ADMIN',
      propagation: false,
    },
  ]

  courseDirectPermissions.forEach((permission) => {
    expectPermissionDetail({
      summary,
      detailsKey: 'directPermissionDetails',
      objectType: 'COURSE',
      objectId: summary.courseId,
      ...permission,
    })
  })

  expectPermissionDetail({
    summary,
    detailsKey: 'directPermissionDetails',
    objectType: 'LIVE_QUIZ',
    objectId: copiedLiveQuiz!.id,
    userShortname: LECTURER_INST_SHORTNAME,
    permissionLevel: 'ADMIN',
    propagation: false,
  })

  const derivedChecks = [
    {
      userShortname: LECTURER_IND_SHORTNAME,
      coursePermissionLevel: 'READ',
      liveQuizPermissionLevel: 'READ',
    },
    {
      userShortname: LECTURER_INST_SHORTNAME,
      coursePermissionLevel: 'EXECUTE',
      liveQuizPermissionLevel: 'ADMIN',
    },
    {
      userShortname: LECTURER_INST2_SHORTNAME,
      coursePermissionLevel: 'WRITE',
      liveQuizPermissionLevel: 'EXECUTE',
    },
    {
      userShortname: LECTURER_INST3_SHORTNAME,
      coursePermissionLevel: 'WRITE',
      liveQuizPermissionLevel: 'WRITE',
    },
    {
      userShortname: LECTURER_INST4_SHORTNAME,
      coursePermissionLevel: 'ADMIN',
      liveQuizPermissionLevel: 'ADMIN',
    },
  ]

  derivedChecks.forEach((permission) => {
    expectPermissionDetail({
      summary,
      detailsKey: 'derivedPermissionDetails',
      objectType: 'COURSE',
      objectId: summary.courseId,
      userShortname: permission.userShortname,
      permissionLevel: permission.coursePermissionLevel,
      derived: false,
    })
    expectPermissionDetail({
      summary,
      detailsKey: 'derivedPermissionDetails',
      objectType: 'LIVE_QUIZ',
      objectId: copiedLiveQuiz!.id,
      userShortname: permission.userShortname,
      permissionLevel: permission.liveQuizPermissionLevel,
    })
  })
}

function expectCopiedUserGroupPermissions(summary: CourseDuplicationSummary) {
  const copiedLiveQuiz = getActivityReference({
    summary,
    collection: 'liveQuizzes',
    activityName: SHARING.liveQuiz,
  })

  if (!copiedLiveQuiz) {
    throw new Error(`Missing live quiz ${SHARING.liveQuiz}`)
  }

  const groupDirectPermissions = [
    {
      userGroupName: SHARING.group1,
      permissionLevel: 'READ',
      propagation: false,
    },
    {
      userGroupName: SHARING.group2,
      permissionLevel: 'EXECUTE',
      propagation: false,
    },
    {
      userGroupName: SHARING.group3,
      permissionLevel: 'WRITE',
      propagation: false,
    },
    {
      userGroupName: SHARING.group4,
      permissionLevel: 'WRITE',
      propagation: true,
    },
    {
      userGroupName: SHARING.group5,
      permissionLevel: 'ADMIN',
      propagation: false,
    },
  ]

  groupDirectPermissions.forEach((permission) => {
    expectPermissionDetail({
      summary,
      detailsKey: 'directPermissionDetails',
      objectType: 'COURSE',
      objectId: summary.courseId,
      ...permission,
    })
  })

  const groupMemberDerivedPermissions = [
    {
      userShortname: LECTURER_IND_SHORTNAME,
      coursePermissionLevel: 'READ',
      liveQuizPermissionLevel: 'READ',
    },
    {
      userShortname: LECTURER_INST_SHORTNAME,
      coursePermissionLevel: 'EXECUTE',
      liveQuizPermissionLevel: 'EXECUTE',
    },
    {
      userShortname: LECTURER_INST2_SHORTNAME,
      coursePermissionLevel: 'WRITE',
      liveQuizPermissionLevel: 'EXECUTE',
    },
    {
      userShortname: LECTURER_INST3_SHORTNAME,
      coursePermissionLevel: 'WRITE',
      liveQuizPermissionLevel: 'WRITE',
    },
    {
      userShortname: LECTURER_INST4_SHORTNAME,
      coursePermissionLevel: 'ADMIN',
      liveQuizPermissionLevel: 'ADMIN',
    },
  ]

  groupMemberDerivedPermissions.forEach((permission) => {
    expectPermissionDetail({
      summary,
      detailsKey: 'derivedPermissionDetails',
      objectType: 'COURSE',
      objectId: summary.courseId,
      userShortname: permission.userShortname,
      permissionLevel: permission.coursePermissionLevel,
      derived: false,
    })
    expectPermissionDetail({
      summary,
      detailsKey: 'derivedPermissionDetails',
      objectType: 'LIVE_QUIZ',
      objectId: copiedLiveQuiz.id,
      userShortname: permission.userShortname,
      permissionLevel: permission.liveQuizPermissionLevel,
    })
  })
}

async function verifyCopiedCoursePermissionBadges({
  page,
  courseName,
  coursePermissionLevel,
  liveQuizPermissionLevel,
}: {
  page: Page
  courseName: string
  coursePermissionLevel: string
  liveQuizPermissionLevel: string
}) {
  await page.getByTestId('courses').click()
  const courseCard = page.getByTestId(`course-list-button-${courseName}`)
  await expect(
    courseCard.getByTestId(
      `permission-level-${courseName}-${coursePermissionLevel}`
    )
  ).toBeVisible()
  await courseCard.click()
  await page.getByTestId('tab-liveQuizzes').click()
  const liveQuizRow = page.getByTestId(`activity-LIVE_QUIZ-${SHARING.liveQuiz}`)
  await expect(
    liveQuizRow.getByTestId(
      `permission-level-${SHARING.liveQuiz}-${liveQuizPermissionLevel}`
    )
  ).toBeVisible()
}

async function verifyCopiedCourseAdminReview(page: Page, courseName: string) {
  await openCourseInManage(page, courseName)
  await page.getByTestId('tab-liveQuizzes').click()
  await chooseActivityAction(
    page,
    'LIVE_QUIZ',
    SHARING.liveQuiz,
    `activity-information-${SHARING.liveQuiz}`
  )
  await expect(page.getByTestId('activity-review-button')).toContainText(
    messages.manage.activities.reviewCompleted
  )
  await page.getByTestId('activity-review-button').click()
  await expect(page.getByTestId('activity-review-button')).toContainText(
    messages.manage.activities.resetReview
  )
  await page.getByTestId('close-activity-details-modal').click()
}

async function revokeCopiedPermissionAndVerifySourceUnaffected({
  page,
  copiedCourseName,
  shortname,
}: {
  page: Page
  copiedCourseName: string
  shortname: string
}) {
  await openCourseInManage(page, copiedCourseName)
  await page.getByTestId('course-share-button').click()
  await expect(page.getByTestId(`permission-${shortname}`)).toBeVisible()
  await page.getByTestId(`revoke-permission-${shortname}`).click()
  await page.getByTestId('confirm-revocation').click()
  await expect(page.getByTestId(`permission-${shortname}`)).not.toBeVisible()
  await page.getByTestId('close-share-object').click()

  await openCourseInManage(page, SHARING.course)
  await page.getByTestId('course-share-button').click()
  await expect(page.getByTestId(`permission-${shortname}`)).toBeVisible()
  await page.getByTestId('close-share-object').click()
}

async function expectLiveQuizElementInstanceContent({
  courseName,
  liveQuizName,
  content,
}: {
  courseName: string
  liveQuizName: string
  content: string
}) {
  await expect(async () => {
    const summary = await getCourseDuplicationSummary({
      courseName,
      ownerId: LECTURER_ID,
    })

    expect(summary).not.toBeNull()

    const activity = getActivityReference({
      summary: summary!,
      collection: 'liveQuizzes',
      activityName: liveQuizName,
    })

    expect(activity).toBeTruthy()
    expect(
      activity!.instances.map((instance) => instance.elementContent)
    ).toContain(content)
    expect(
      activity!.instances.map((instance) => instance.elementDataContent)
    ).toContain(content)
  }).toPass({ timeout: 10_000 })
}

async function startLiveQuizInCourse({
  page,
  courseName,
  liveQuizName,
}: {
  page: Page
  courseName: string
  liveQuizName: string
}) {
  await openCourseInManage(page, courseName)
  await page.getByTestId('tab-liveQuizzes').click()
  await expect(
    page.getByTestId(`start-live-quiz-${liveQuizName}`)
  ).toBeVisible()
  await page.getByTestId(`start-live-quiz-${liveQuizName}`).click()
  await expect(page).toHaveURL(/\/quizzes\//, { timeout: 60_000 })
  await expect(page.getByTestId('next-block-timeline')).toBeVisible({
    timeout: 60_000,
  })
  await page.getByTestId('next-block-timeline').click()
  await page.waitForTimeout(500)
}

async function expectCourseLiveQuizResponseSummary({
  courseName,
  liveQuizName,
}: {
  courseName: string
  liveQuizName: string
}) {
  let latestSummary: CourseLiveQuizResponseSummary | null = null

  await expect(async () => {
    latestSummary = await getCourseLiveQuizResponseSummary({
      courseName,
      liveQuizName,
      participantUsername: STUDENT_USERNAME,
    })

    expect(latestSummary.responseCount).toEqual(1)
    expect(latestSummary.correctnesses).toContain('CORRECT')
    expect(latestSummary.resultTotals).toContain(1)
  }).toPass({ timeout: 10_000 })

  return latestSummary!
}

// ===========================================================================
// Part 1: Course creation
// ===========================================================================
test('CLEANUP', cleanupTest)

test.describe('Part 1: Course creation', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Test the creation of a new course without gamification', async ({
    page,
  }) => {
    await page.getByTestId('courses').click()
    await page.getByTestId('course-list-button-new-course').click()

    await page.getByTestId('course-name').fill(COURSE1.name)
    await page.getByTestId('course-display-name').fill(COURSE1.displayName)
    await page.getByTestId('course-description').click()
    await page
      .getByTestId('course-description')
      .pressSequentially(COURSE1.description)

    // notification email pre-filled; replace it
    await page.getByTestId('course-notification-email').fill('')
    await page
      .getByTestId('course-notification-email')
      .fill(COURSE1.notificationEmail)

    // Toggle gamification off (default is checked)
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'checked'
    )
    await page.getByTestId('course-gamification').click()
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    // toggle back and off again to match cypress test
    await page.getByTestId('course-gamification').click()
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'checked'
    )
    await page.getByTestId('course-gamification').click()
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'unchecked'
    )

    await page.getByTestId('manipulate-course-submit').click()

    await page.getByTestId('courses').click()
    await expect(page.getByText(COURSE1.name)).toBeVisible()
  })

  test('Test the creation of a new gamified course', async ({ page }) => {
    await page.getByTestId('courses').click()
    await page.getByTestId('course-list-button-new-course').click()

    await page.getByTestId('course-name').fill(COURSE2.name)
    await page.getByTestId('course-display-name').fill(COURSE2.displayName)
    await page.getByTestId('course-notification-email').fill('')
    await page
      .getByTestId('course-notification-email')
      .fill(COURSE2.notificationEmail)

    // gamification toggle should be checked
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'checked'
    )

    // Disable gamification and verify group creation is disabled
    await page.getByTestId('course-gamification').click()
    await expect(page.getByTestId('course-group-creation')).toBeDisabled()
    await expect(page.getByTestId('group-creation-deadline')).not.toBeVisible()
    await expect(page.getByTestId('max-group-size')).not.toBeVisible()
    await expect(page.getByTestId('preferred-group-size')).not.toBeVisible()

    // Check form validity and re-enable gamification
    await expect(
      page.getByTestId('manipulate-course-submit')
    ).not.toBeDisabled()
    await page.getByTestId('course-gamification').click()

    // Enable group creation, clear max-group-size → submit should be disabled
    await page.getByTestId('course-group-creation').click()
    await page.getByTestId('max-group-size').clear()
    await expect(page.getByTestId('manipulate-course-submit')).toBeDisabled()

    // Disable gamification resets form → submit enabled
    await page.getByTestId('course-gamification').click()
    await expect(
      page.getByTestId('manipulate-course-submit')
    ).not.toBeDisabled()

    // Re-enable gamification and configure groups
    await page.getByTestId('course-gamification').click()
    await page.getByTestId('course-group-creation').click()
    await expect(page.getByTestId('course-group-creation')).not.toBeDisabled()

    // Set max and preferred group sizes
    await page.getByTestId('max-group-size').fill('6')
    await page.getByTestId('preferred-group-size').fill('4')
    await expect(
      page.getByTestId('manipulate-course-submit')
    ).not.toBeDisabled()

    await page.getByTestId('manipulate-course-submit').click()

    await page.getByTestId('courses').click()
    await expect(page.getByText(COURSE2.name)).toBeVisible()

    // Verify random group assignment is disabled (no participants yet)
    await page.getByTestId(`course-list-button-${COURSE2.name}`).click()
    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('assign-random-groups')).toBeDisabled()
  })
})

// ===========================================================================
// Part 2: Randomized group creation
// ===========================================================================
test.describe('Part 2: Randomized group creation', () => {
  test('Have 10 students join the course and the random assignment pool', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(180_000)
    const coursePin = await getCoursePin(COURSE2.name)
    const students = [
      STUDENT_USERNAME,
      STUDENT_USERNAME2,
      STUDENT_USERNAME3,
      STUDENT_USERNAME4,
      STUDENT_USERNAME5,
      STUDENT_USERNAME6,
      STUDENT_USERNAME7,
      STUDENT_USERNAME8,
      STUDENT_USERNAME9,
      STUDENT_USERNAME10,
    ]

    for (const studentUsername of students) {
      await loginStudentPassword(page, studentUsername)
      await joinCourse(page, coursePin)
      await openStudentCourse(page, COURSE2.displayName)
      await openStudentGroupTab(page)
      await page.getByTestId('student-course-create-group').click()
      await page.getByTestId('enter-random-group-pool').click()
      await expect(page.getByTestId('leave-random-group-pool')).toBeVisible()
    }
  })

  test('Have 2 students join the course and create groups by themselves', async ({
    page,
  }) => {
    const coursePin = await getCoursePin(COURSE2.name)

    // Student 11: creates group
    await loginStudentPassword(page, STUDENT_USERNAME11)
    await joinCourse(page, coursePin)
    await openStudentCourse(page, COURSE2.displayName)
    await page.getByTestId('student-course-create-group').click()
    await page.getByTestId('group-creation-name-input').fill(COURSE2.group1)
    await page.getByTestId('create-new-participant-group').click()
    await page.waitForTimeout(1000)

    // Student 12: creates group
    await loginStudentPassword(page, STUDENT_USERNAME12)
    await joinCourse(page, coursePin)
    await openStudentCourse(page, COURSE2.displayName)
    await page.getByTestId('student-course-create-group').click()
    await page.getByTestId('group-creation-name-input').fill(COURSE2.group2)
    await page.getByTestId('create-new-participant-group').click()
    await page.waitForTimeout(1000)
  })

  test('Trigger the random group assignment for the gamified course', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE2.name}`).click()
    await page.getByTestId('tab-groups').click()

    await page.getByTestId('assign-random-groups').click()
    await page.getByTestId('cancel-random-group-assignment').click()
    await page.getByTestId('assign-random-groups').click()
    await page.getByTestId('confirm-random-group-assignment').click()
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('assign-random-groups')).not.toBeAttached()
  })

  test('Check from the student view that they have been assigned to groups successfully', async ({
    page,
  }) => {
    for (const studentUsername of [
      STUDENT_USERNAME,
      STUDENT_USERNAME2,
      STUDENT_USERNAME3,
      STUDENT_USERNAME11,
      STUDENT_USERNAME12,
    ]) {
      await loginStudentPassword(page, studentUsername)
      await openStudentCourse(page, COURSE2.displayName)
      await expect(
        page.getByTestId('student-course-create-group')
      ).not.toBeAttached()
    }
  })

  test('Check that if group formation deadline is moved into the future, randomized assignment is possible again', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE2.name}`).click()
    await page.getByTestId('course-settings-button').click()

    await page.getByTestId('group-creation-deadline').click()
    for (let i = 0; i < 4; i++) {
      await page
        .getByTestId('group-creation-deadline-next-month')
        .locator('..')
        .click()
      await page.waitForTimeout(100)
    }
    await page
      .getByTestId('group-creation-deadline-calendar')
      .getByText('15', { exact: true })
      .click()
    await page.getByTestId('course-name').click()
    await page.getByTestId('manipulate-course-submit').click()

    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('assign-random-groups')).toBeAttached()
    await expect(page.getByTestId('assign-random-groups')).toBeDisabled()
  })
})

// ===========================================================================
// Part 3: Course overview, editing, and archiving
// ===========================================================================
test.describe('Part 3: Course overview, editing, and archiving', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Check the content of the course overview and edit course properties', async ({
    page,
  }) => {
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE1.name}`).click()
    await expect(page.getByTestId('course-name-with-pin')).toContainText(
      COURSE1.name
    )

    // QR code modal
    await page.getByTestId('course-join-qr-code').click()
    await page.getByTestId('course-join-qr-code').click()

    // Open settings
    await page.getByTestId('course-settings-button').click()
    await expect(page.getByTestId('course-name')).toHaveValue(COURSE1.name)
    await expect(page.getByTestId('course-display-name')).toHaveValue(
      COURSE1.displayName
    )

    // Change name and display name
    await page.getByTestId('course-name').fill(COURSE1.nameNew)
    await page.getByTestId('course-display-name').fill(COURSE1.displayNameNew)

    // Check notification email
    await expect(page.getByTestId('course-notification-email')).toHaveValue(
      COURSE1.notificationEmail
    )
    await page
      .getByTestId('course-notification-email')
      .fill(COURSE1.notificationEmailNew)

    // Enable gamification (currently off from creation test)
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    await page.getByTestId('course-gamification').click()
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'checked'
    )

    await page.getByTestId('manipulate-course-submit').click()
    await expect(page.getByTestId('course-name')).not.toBeAttached()

    // Verify changes saved
    await page.getByTestId('course-settings-button').click()
    await expect(page.getByTestId('course-name')).toHaveValue(COURSE1.nameNew)
    await expect(page.getByTestId('course-display-name')).toHaveValue(
      COURSE1.displayNameNew
    )
    await expect(page.getByTestId('course-notification-email')).toHaveValue(
      COURSE1.notificationEmailNew
    )
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'checked'
    )

    // Enable group creation and set sizes
    await page.getByTestId('course-group-creation').click()
    await expect(page.getByTestId('course-group-creation')).toHaveAttribute(
      'data-state',
      'checked'
    )
    await page.getByTestId('max-group-size').fill('10')
    await page.getByTestId('preferred-group-size').fill('4')

    await page.getByTestId('manipulate-course-submit').click()
    await expect(page.getByTestId('course-name')).not.toBeAttached()

    // Verify group settings are still present after saving.
    await page.getByTestId('course-settings-button').click()
    await expect(page.getByTestId('group-creation-deadline')).toBeVisible()
  })

  test('Test if the course leaderboards are visible on the student app', async ({
    loginStudent,
    page,
  }) => {
    await loginStudent()
    await openStudentCourse(page, RUNNING_COURSE.name)
    await expect(
      page.getByTestId('student-course-leaderboard-tab')
    ).toBeVisible()

    // Leave and rejoin leaderboard
    await page.getByTestId('student-course-join-leaderboard').click()
    await page.getByTestId('leave-leaderboard').click()
    await page.getByTestId('cancel-leave-course-leaderboard').click()
    await page.getByTestId('leave-leaderboard').click()
    await page.getByTestId('confirm-leave-course-leaderboard').click()
    await expect(
      page.getByTestId('student-course-join-leaderboard')
    ).toBeVisible()

    await page.getByTestId('student-course-join-leaderboard').click()
    await expect(page.getByTestId('leave-leaderboard')).toBeVisible()
  })

  test('Test course archive functionality', async ({ page }) => {
    await page.getByTestId('courses').click()

    // Running course cannot be archived
    await expect(
      page.getByTestId(`archive-course-${RUNNING_COURSE.name}`)
    ).toBeDisabled()

    // Past course can be archived
    await expect(
      page.getByTestId(`archive-course-${PAST_COURSE.name}`)
    ).not.toBeDisabled()

    // Cancel then confirm archiving
    await page.getByTestId(`archive-course-${PAST_COURSE.name}`).click()
    await page.getByTestId('course-archive-modal-cancel').click()
    await page.getByTestId(`archive-course-${PAST_COURSE.name}`).click()
    await page.getByTestId('course-archive-modal-confirm').click()
    await expect(
      page.getByTestId(`course-list-button-${PAST_COURSE.name}`)
    ).not.toBeVisible()

    // Toggle archive view and unarchive
    await page.getByTestId('toggle-course-archive').click()
    await expect(
      page.getByTestId(`course-list-button-${PAST_COURSE.name}`)
    ).toBeVisible()
    await page.getByTestId(`archive-course-${PAST_COURSE.name}`).click()
    await page.getByTestId('course-archive-modal-confirm').click()
    await page.getByTestId('toggle-course-archive').click()
    await expect(
      page.getByTestId(`course-list-button-${PAST_COURSE.name}`)
    ).toBeVisible()
  })
})

// ===========================================================================
// Part 4: Course deletion and required confirmations
// ===========================================================================
test.describe('Part 4: Course deletion', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a course with live quiz, practice quiz, and microlearning, and delete it again', async ({
    page,
  }) => {
    // --- Create course ---
    await page.getByTestId('courses').click()
    await page.getByTestId('course-list-button-new-course').click()
    await page.getByTestId('course-name').fill(DELETION.courseName)
    await page.getByTestId('course-display-name').fill(DELETION.displayName)
    await page.getByTestId('course-notification-email').fill('')
    await page
      .getByTestId('course-notification-email')
      .fill(DELETION.notificationEmail)
    // Disable gamification for simplicity
    await page.getByTestId('course-gamification').click()
    await page.getByTestId('manipulate-course-submit').click()
    await page.getByTestId('courses').click()
    await expect(page.getByText(DELETION.courseName)).toBeVisible()
    await page.reload()

    // --- Create question ---
    await page.getByTestId('library').click()
    await expect(page.getByTestId('elements-search-input')).toBeVisible()
    await createQuestionSC({
      name: DELETION.qTitle,
      content: DELETION.qContent,
      choices: [
        { value: '50%', correct: true },
        { value: '100%', correct: false },
      ],
      userId: LECTURER_ID,
    })
    await page.reload()
    await expect(page.getByTestId('elements-search-input')).toBeVisible()

    // --- Create activities ---
    await createLiveQuizActivity(page, {
      name: DELETION.lqName,
      displayName: DELETION.lqName,
      courseName: DELETION.courseName,
      blocks: [{ elements: [DELETION.qTitle] }],
    })
    await goToCreateNewActivity(page)

    await createPracticeQuizActivity(page, {
      name: DELETION.pqName,
      displayName: DELETION.pqName,
      description: COURSE1.description,
      courseName: DELETION.courseName,
      stacks: [{ elements: [DELETION.qTitle] }],
    })
    await goToCreateNewActivity(page)

    await createMicroLearningActivity(page, {
      name: DELETION.mlName,
      displayName: DELETION.mlName,
      courseName: DELETION.courseName,
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
      stacks: [{ elements: [DELETION.qTitle] }],
    })
    await goToCreateNewActivity(page)

    // --- Delete course ---
    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${DELETION.courseName}`)
    ).toBeVisible()

    await page.getByTestId(`delete-course-${DELETION.courseName}`).click()
    await page.getByTestId('course-deletion-modal-cancel').click()

    await page.getByTestId(`delete-course-${DELETION.courseName}`).click()

    // No participations — participation confirm should not exist
    await expect(
      page.getByTestId('course-deletion-participations-confirm')
    ).not.toBeVisible()

    // Confirm LQ, PQ, ML deletions
    await expect(
      page.getByTestId('course-deletion-live-quiz-confirm')
    ).toBeVisible()
    await page.getByTestId('course-deletion-live-quiz-confirm').click()
    await expect(
      page.getByTestId('course-deletion-modal-confirm')
    ).toBeDisabled()

    await expect(
      page.getByTestId('course-deletion-practice-quiz-confirm')
    ).toBeVisible()
    await page.getByTestId('course-deletion-practice-quiz-confirm').click()
    await expect(
      page.getByTestId('course-deletion-modal-confirm')
    ).toBeDisabled()

    await expect(
      page.getByTestId('course-deletion-micro-learning-confirm')
    ).toBeVisible()
    await page.getByTestId('course-deletion-micro-learning-confirm').click()
    await expect(
      page.getByTestId('course-deletion-modal-confirm')
    ).not.toBeDisabled()

    // Group activity: not created so should not be visible
    await expect(
      page.getByTestId('course-deletion-group-activity-confirm')
    ).not.toBeVisible()

    await page.getByTestId('course-deletion-modal-confirm').click()
    await expect(
      page.getByTestId(`course-list-button-${DELETION.courseName}`)
    ).not.toBeVisible()
    await page.reload()
    await expect(
      page.getByTestId(`course-list-button-${DELETION.courseName}`)
    ).not.toBeVisible()

    // Verify live quiz still exists (unassigned)
    await page.getByTestId('activities').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${DELETION.lqName}`)
    ).toBeVisible({ timeout: 30_000 })
  })

  test('Cleanup: Delete the live quiz that is not assigned to the course anymore', async ({
    page,
  }) => {
    await page.getByTestId('activities').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${DELETION.lqName}`)
    ).toBeVisible({ timeout: 30_000 })
    await page.getByTestId(`actions-LIVE_QUIZ-${DELETION.lqName}`).click()
    await page.getByTestId(`delete-live-quiz-${DELETION.lqName}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expect(page.getByText(DELETION.lqName)).not.toBeVisible()
  })

  test('Cleanup: Delete all created courses and created questions', async ({
    page,
  }) => {
    await page.getByTestId('courses').click()

    // Delete non-gamified course (renamed in Part 3)
    await page.getByTestId(`delete-course-${COURSE1.nameNew}`).click()
    await page.getByTestId('course-deletion-modal-confirm').click()
    await expect(page.getByText(COURSE1.nameNew)).not.toBeVisible()

    // Delete gamified course (has participations and groups)
    await page.getByTestId(`delete-course-${COURSE2.name}`).click()
    const participationsConfirm = page.getByTestId(
      'course-deletion-participations-confirm'
    )
    if (
      await participationsConfirm
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await participationsConfirm.click()
    }
    const groupConfirm = page.getByTestId(
      'course-deletion-participant-group-confirm'
    )
    if (await groupConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await groupConfirm.click()
    }
    await confirmCourseDeletion(page)
    await expect(page.getByText(COURSE2.name)).not.toBeVisible()

    // Delete question
    await page.getByTestId('library').click()
    await page.getByTestId('elements-search-input').fill(DELETION.qTitle)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${DELETION.qTitle}`)
    ).toBeVisible()
    await deleteElement(page, DELETION.qTitle)
    await page.getByTestId('elements-search-input').clear()
    await expect(
      page.getByTestId(`element-item-${DELETION.qTitle}`)
    ).not.toBeVisible()
  })
})

// ===========================================================================
// Part 5: Course Sharing
// ===========================================================================
test.describe('Part 5: Course Sharing - Individual permissions', () => {
  test('Create a new course and assign an activity of each type to it', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Create course
    await page.getByTestId('courses').click()
    await page.getByTestId('course-list-button-new-course').click()
    await page.getByTestId('course-name').fill(SHARING.course)
    await page
      .getByTestId('course-display-name')
      .fill(SHARING.courseDisplayName)
    await page.getByTestId('course-notification-email').fill('')
    await page
      .getByTestId('course-notification-email')
      .fill(SHARING.courseNotificationEmail)
    await page.getByTestId('max-group-size').fill('6')
    await page.getByTestId('preferred-group-size').fill('4')
    await page.getByTestId('manipulate-course-submit').click()
    await page.getByTestId('courses').click()
    await expect(page.getByText(SHARING.course)).toBeVisible()
    await updateCourseGroupDeadlineDate({
      courseName: SHARING.course,
      groupDeadlineDate: SHARING_COURSE_GROUP_DEADLINE,
    })
    await page.reload()

    // Create questions
    await page.getByTestId('library').click()
    await expect(page.getByTestId('elements-search-input')).toBeVisible()
    await createQuestionSC({
      name: SCML.title,
      content: SCML.content,
      choices: SCML.choices,
      userId: LECTURER_ID,
    })
    await createNRQuestion(page, NRML.title, NRML.content, NRML.options)

    // Create answer collection and SE question
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await createAnswerCollectionDirect({
      name: COLLECTION.name,
      description: COLLECTION.description,
      entries: COLLECTION.options,
      userId: LECTURER_ID,
    })

    await page.getByTestId('library').click()
    await expect(page.getByTestId('elements-search-input')).toBeVisible()
    await createQuestionSEDirect({
      name: SEML.title,
      content: SEML.content,
      collectionName: COLLECTION.name,
      numberOfInputs: SEML.inputs,
      correctAnswers: COLLECTION.options.filter((_, ix) =>
        SEML.solutions.includes(ix)
      ),
      userId: LECTURER_ID,
    })
    await createQuestionCSWorkflow(page, {
      name: CSML.title,
      content: CSML.content,
      explanation: CSML.explanation,
      collectionName: COLLECTION.name,
      selectedItems: COLLECTION.options.filter((_, ix) =>
        CSML.selectedItems.includes(ix)
      ),
      criteria: CSML.criteria,
      cases: CSML.cases,
      solutions: CSML.solutions,
      userId: LECTURER_ID,
    })
    await page.reload()
    await expect(page.getByTestId('elements-search-input')).toBeVisible()

    // Create activities
    await createLiveQuizActivity(page, {
      name: SHARING.liveQuiz,
      displayName: SHARING.liveQuiz,
      courseName: SHARING.course,
      blocks: [{ elements: [SCML.title] }],
    })
    await goToCreateNewActivity(page)

    await createPracticeQuizActivity(page, {
      name: SHARING.practiceQuiz,
      displayName: SHARING.practiceQuiz,
      courseName: SHARING.course,
      stacks: [{ elements: [NRML.title] }],
    })
    await goToCreateNewActivity(page)

    await createMicroLearningActivity(page, {
      name: SHARING.microLearning,
      displayName: SHARING.microLearning,
      courseName: SHARING.course,
      startDate: {
        monthDelta: 1,
        day: 16,
        hour: 2,
        minute: 0,
        validation: `${getDatetimeValidationString(1, '16')}, 02:00`,
      },
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: `${getDatetimeValidationString(4, '14')}, 18:00`,
      },
      stacks: [{ elements: [SEML.title] }],
    })
    await goToCreateNewActivity(page)

    await createGroupActivityActivity(page, {
      name: SHARING.groupActivity,
      displayName: SHARING.groupActivity,
      task: 'Task Description',
      courseName: SHARING.course,
      scheduledStartDate: {
        monthDelta: 1,
        day: 16,
        hour: 2,
        minute: 0,
        validation: `${getDatetimeValidationString(1, '16')}, 02:00`,
      },
      scheduledEndDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: `${getDatetimeValidationString(4, '14')}, 18:00`,
      },
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
        elements: [CSML.title],
      },
    })

    // Verify activities in course
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()

    await page.getByTestId('tab-liveQuizzes').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${SHARING.liveQuiz}`)
    ).toBeVisible()

    await page.getByTestId('tab-practiceQuizzes').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${SHARING.practiceQuiz}`)
    ).toBeVisible()

    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${SHARING.microLearning}`)
    ).toBeVisible()

    await page.getByTestId('tab-groupActivities').click()
    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${SHARING.groupActivity}`)
    ).toBeVisible()
  })

  test('Duplicate the course as owner and verify copied activities, clean state, and shared element references', async ({
    loginLecturer,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const copyName = `${SHARING.course} Copy`
    const competencyTreeName = `${SHARING.course} Competency Tree`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })
    await resetCourseLiveQuiz({
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
    })
    await createDeletedCourseActivities(SHARING.course)
    await attachCourseCompetencyTree({
      courseName: SHARING.course,
      ownerId: LECTURER_ID,
      treeName: competencyTreeName,
    })

    await loginLecturer()
    await openCourseInManage(page, SHARING.course)
    await expect(page.getByTestId('course-duplicate-button')).toBeVisible()
    await page.getByTestId('course-duplicate-button').click()
    await verifyCourseDuplicationModalUi(page)
    await submitCourseFormAndWaitForCreateCourse(page)

    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${copyName}`)
    ).toBeVisible()
    await openCourseInManage(page, copyName)
    await verifyCopiedCourseActivities(page)

    const copiedSummary = await expectDuplicatedCourseSummary({
      courseName: copyName,
      ownerId: LECTURER_ID,
      liveQuizzes: 1,
      practiceQuizzes: 1,
      microLearnings: 1,
      groupActivities: 1,
    })
    const sourceSummary = await getCourseDuplicationSummary({
      courseName: SHARING.course,
      ownerId: LECTURER_ID,
    })

    expect(sourceSummary).not.toBeNull()
    expect(copiedSummary.isGamificationEnabled).toEqual(
      sourceSummary!.isGamificationEnabled
    )
    expect(sourceSummary!.competencyTreeName).toEqual(competencyTreeName)
    expect(copiedSummary.competencyTreeId).toEqual(
      sourceSummary!.competencyTreeId
    )
    expect(copiedSummary.competencyTreeName).toEqual(competencyTreeName)
    expectCopiedActivityReferences({
      sourceSummary: sourceSummary!,
      copiedSummary,
    })

    await expect(
      ensureCourseParticipation({
        courseName: SHARING.course,
        participantUsername: STUDENT_USERNAME,
      })
    ).resolves.toEqual(expect.any(String))
    await expect(
      ensureCourseParticipation({
        courseName: copyName,
        participantUsername: STUDENT_USERNAME,
      })
    ).resolves.toEqual(expect.any(String))

    await startLiveQuizInCourse({
      page,
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
    })
    await startLiveQuizInCourse({
      page,
      courseName: copyName,
      liveQuizName: SHARING.liveQuiz,
    })

    await expect(
      submitCourseLiveQuizStudentResponse({
        courseName: SHARING.course,
        liveQuizName: SHARING.liveQuiz,
        participantUsername: STUDENT_USERNAME,
      })
    ).resolves.toMatchObject({
      courseId: sourceSummary!.courseId,
      liveQuizId: getActivityReference({
        summary: sourceSummary!,
        collection: 'liveQuizzes',
        activityName: SHARING.liveQuiz,
      })!.id,
    })
    await expect(
      submitCourseLiveQuizStudentResponse({
        courseName: copyName,
        liveQuizName: SHARING.liveQuiz,
        participantUsername: STUDENT_USERNAME,
      })
    ).resolves.toMatchObject({
      courseId: copiedSummary.courseId,
      liveQuizId: getActivityReference({
        summary: copiedSummary,
        collection: 'liveQuizzes',
        activityName: SHARING.liveQuiz,
      })!.id,
    })

    const sourceResponseSummary = await expectCourseLiveQuizResponseSummary({
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
    })
    const copiedResponseSummary = await expectCourseLiveQuizResponseSummary({
      courseName: copyName,
      liveQuizName: SHARING.liveQuiz,
    })

    expect(copiedResponseSummary.courseId).not.toEqual(
      sourceResponseSummary.courseId
    )
    expect(copiedResponseSummary.liveQuizId).not.toEqual(
      sourceResponseSummary.liveQuizId
    )
    expect(copiedResponseSummary.instanceIds[0]).not.toEqual(
      sourceResponseSummary.instanceIds[0]
    )
  })

  test('Duplicate the course without group creation and verify group activities are not copied', async ({
    loginLecturer,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const copyName = `${SHARING.course} Copy Without Groups`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })

    await loginLecturer()
    await openCourseInManage(page, SHARING.course)
    await expect(page.getByTestId('course-duplicate-button')).toBeVisible()
    await page.getByTestId('course-duplicate-button').click()
    await page.getByTestId('course-name').fill(copyName)
    await page.getByTestId('course-display-name').fill(copyName)
    await expect(page.getByTestId('course-group-creation')).toHaveAttribute(
      'data-state',
      'checked'
    )
    await page.getByTestId('course-group-creation').click()
    await expect(page.getByTestId('course-group-creation')).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    await expect(page.getByTestId('course-group-activities')).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    await expect(page.getByTestId('course-group-activities')).toBeDisabled()
    await submitCourseFormAndWaitForCreateCourse(page)

    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${copyName}`)
    ).toBeVisible()

    await expectDuplicatedCourseSummary({
      courseName: copyName,
      ownerId: LECTURER_ID,
      liveQuizzes: 1,
      practiceQuizzes: 1,
      microLearnings: 1,
      groupActivities: 0,
    })
  })

  test('Does not leave a partial course when activity duplication fails', async ({
    loginLecturer,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const sourceName = `${SHARING.course} Invalid Duplication Source`
    const copyName = `${sourceName} Copy`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })
    await createCourseDuplicationFailureFixture(sourceName)

    await loginLecturer()
    await openCourseInManage(page, sourceName)
    await page.getByTestId('course-duplicate-button').click()
    await submitCourseFormAndWaitForCreateCourse(page, { expectSuccess: false })
    await expect(
      page.getByText(messages.manage.courseList.courseCreationFailed)
    ).toBeVisible()
    await expect(async () => {
      const summary = await getCourseDuplicationSummary({
        courseName: copyName,
        ownerId: LECTURER_ID,
      })
      expect(summary).toBeNull()
    }).toPass()
    await deleteCourseWithActivitiesByName({
      courseName: sourceName,
      ownerId: LECTURER_ID,
    })
  })

  test('Allows assessment courses to be duplicated as assessment courses', async ({
    loginLecturer,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const assessmentCourseName = `${SHARING.course} Assessment`
    const assessmentCopyName = `${assessmentCourseName} Copy`
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)

    await deleteCourseWithActivitiesByName({
      courseName: assessmentCopyName,
      ownerId: LECTURER_ID,
    })
    await deleteCourseWithActivitiesByName({
      courseName: assessmentCourseName,
      ownerId: LECTURER_ID,
    })
    await createCourseRecord({
      name: assessmentCourseName,
      displayName: assessmentCourseName,
      notificationEmail: LECTURER_EMAIL,
      startDate,
      endDate,
      isAssessmentEnabled: true,
      isGamificationEnabled: true,
      isGroupCreationEnabled: false,
    })

    await loginLecturer()
    await openCourseInManage(page, assessmentCourseName)
    await submitCourseDuplication(page)
    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${assessmentCopyName}`)
    ).toBeVisible()

    const summary = await getCourseDuplicationSummary({
      courseName: assessmentCopyName,
      ownerId: LECTURER_ID,
    })
    expect(summary).toMatchObject({
      isAssessmentEnabled: true,
      authType: 'SSO',
      pinCode: null,
      liveQuizzes: 0,
      practiceQuizzes: 0,
      microLearnings: 0,
      groupActivities: 0,
    })

    await deleteCourseWithActivitiesByName({
      courseName: assessmentCopyName,
      ownerId: LECTURER_ID,
    })
    await deleteCourseWithActivitiesByName({
      courseName: assessmentCourseName,
      ownerId: LECTURER_ID,
    })
  })

  test('Share the course directly with other users with READ, EXECUTE, WRITE and ADMIN permissions', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    // READ for pro1
    await grantCoursePermission(page, LECTURER_IND_SHORTNAME, PERM_READ, false)
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(PERM_READ)
    await expect(
      page.getByTestId(`permission-propagation-${LECTURER_IND_SHORTNAME}`)
    ).toHaveAttribute('data-state', 'unchecked')
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_OWNER)

    // EXECUTE for pro2
    await grantCoursePermission(
      page,
      LECTURER_INST_SHORTNAME,
      PERM_EXECUTE,
      false
    )
    await expect(
      page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
    ).toContainText(PERM_EXECUTE)

    // WRITE for pro3 (no propagation)
    await grantCoursePermission(
      page,
      LECTURER_INST2_SHORTNAME,
      PERM_WRITE,
      false
    )
    await expect(
      page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
    ).toContainText(PERM_WRITE)
    await expect(
      page.getByTestId(`permission-propagation-${LECTURER_INST2_SHORTNAME}`)
    ).toHaveAttribute('data-state', 'unchecked')

    // WRITE for pro4 (with propagation)
    await grantCoursePermission(
      page,
      LECTURER_INST3_SHORTNAME,
      PERM_WRITE,
      true
    )
    await expect(
      page.getByTestId(`permission-${LECTURER_INST3_SHORTNAME}`)
    ).toContainText(PERM_WRITE)
    await expect(
      page.getByTestId(`permission-propagation-${LECTURER_INST3_SHORTNAME}`)
    ).toHaveAttribute('data-state', 'checked')

    // ADMIN for pro5
    await grantCoursePermission(
      page,
      LECTURER_INST4_SHORTNAME,
      PERM_ADMIN,
      false
    )
    await expect(
      page.getByTestId(`permission-${LECTURER_INST4_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)
  })

  test('Duplicate the shared course as owner and preserve direct individual permissions', async ({
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginInstitutionalCatalyst2,
    loginInstitutionalCatalyst3,
    loginInstitutionalCatalyst4,
    logoutUser,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const copyName = `${SHARING.course} Shared Copy`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })
    await deleteLiveQuizDirectPermission({
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
      ownerId: LECTURER_ID,
      userId: LECTURER_INST_ID,
    })
    await grantLiveQuizDirectPermission({
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
      ownerId: LECTURER_ID,
      userId: LECTURER_INST_ID,
      permissionLevel: PermissionLevel.ADMIN,
      propagation: false,
    })

    await loginLecturer()
    await openCourseInManage(page, SHARING.course)
    await submitCourseDuplication(page, copyName)
    await deleteLiveQuizDirectPermission({
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
      ownerId: LECTURER_ID,
      userId: LECTURER_INST_ID,
    })

    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${copyName}`)
    ).toBeVisible()

    const summary = await expectDuplicatedCourseSummary({
      courseName: copyName,
      ownerId: LECTURER_ID,
      liveQuizzes: 1,
      practiceQuizzes: 1,
      microLearnings: 1,
      groupActivities: 1,
      directPermissions: 6,
    })
    expectCopiedIndividualPermissions(summary)
    await logoutUser()

    await loginIndividualCatalyst()
    await verifyCopiedCoursePermissionBadges({
      page,
      courseName: copyName,
      coursePermissionLevel: 'READ',
      liveQuizPermissionLevel: 'READ',
    })
    await logoutUser()

    await loginInstitutionalCatalyst()
    await verifyCopiedCoursePermissionBadges({
      page,
      courseName: copyName,
      coursePermissionLevel: 'EXECUTE',
      liveQuizPermissionLevel: 'ADMIN',
    })
    await logoutUser()

    await loginInstitutionalCatalyst2()
    await verifyCopiedCoursePermissionBadges({
      page,
      courseName: copyName,
      coursePermissionLevel: 'WRITE',
      liveQuizPermissionLevel: 'EXECUTE',
    })
    await logoutUser()

    await loginInstitutionalCatalyst3()
    await verifyCopiedCoursePermissionBadges({
      page,
      courseName: copyName,
      coursePermissionLevel: 'WRITE',
      liveQuizPermissionLevel: 'WRITE',
    })
    await logoutUser()

    await loginInstitutionalCatalyst4()
    await verifyCopiedCourseAdminReview(page, copyName)
    await logoutUser()

    await loginLecturer()
    await revokeCopiedPermissionAndVerifySourceUnaffected({
      page,
      copiedCourseName: copyName,
      shortname: LECTURER_IND_SHORTNAME,
    })

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })
  })

  test('Verify that the user with individual READ permissions can only see course & activities with READ permissions', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseReadPermissions(page)
    await expect(
      getCourseDuplicationSummary({
        courseName: `${SHARING.course} Copy`,
        ownerId: LECTURER_IND_ID,
      })
    ).resolves.toBeNull()
  })

  test('Verify that the user with individual EXECUTE permissions can only see course & activities with EXECUTE permissions', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseExecutePermissions(page)
    await expect(
      getCourseDuplicationSummary({
        courseName: `${SHARING.course} Copy`,
        ownerId: LECTURER_INST_ID,
      })
    ).resolves.toBeNull()
  })

  test('Verify that the user with individual WRITE permissions (no propagation) can only see course & activities with EXECUTE permissions', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, false)
    await expect(
      getCourseDuplicationSummary({
        courseName: `${SHARING.course} Copy`,
        ownerId: LECTURER_INST2_ID,
      })
    ).resolves.toBeNull()
  })

  test('Verify that the user with individual WRITE permissions (with propagation) can only see course & activities with WRITE permissions', async ({
    loginInstitutionalCatalyst3,
    page,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, true)
    await expect(
      getCourseDuplicationSummary({
        courseName: `${SHARING.course} Copy`,
        ownerId: LECTURER_INST3_ID,
      })
    ).resolves.toBeNull()
  })

  test('Verify that the user with individual ADMIN permissions can see course, activities, elements, and the answer collection', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseAdminPermissions(page, true)
  })

  test('Verify that an ADMIN user can duplicate selected course activities', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const copyName = `${SHARING.course} Admin Copy`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_INST4_ID,
    })

    await loginInstitutionalCatalyst4()
    await openCourseInManage(page, SHARING.course)
    await expect(page.getByTestId('course-duplicate-button')).toBeVisible()
    await page.getByTestId('course-duplicate-button').click()
    await page.getByTestId('course-name').fill(copyName)
    await page.getByTestId('course-display-name').fill(copyName)
    for (const testId of [
      'course-practice-quizzes',
      'course-microlearnings',
      'course-group-activities',
    ]) {
      await expect(page.getByTestId(testId)).toHaveAttribute(
        'data-state',
        'checked'
      )
      await page.getByTestId(testId).click()
      await expect(page.getByTestId(testId)).toHaveAttribute(
        'data-state',
        'unchecked'
      )
    }
    await submitCourseFormAndWaitForCreateCourse(page)

    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${copyName}`)
    ).toBeVisible()

    const summary = await expectDuplicatedCourseSummary({
      courseName: copyName,
      ownerId: LECTURER_INST4_ID,
      liveQuizzes: 1,
      practiceQuizzes: 0,
      microLearnings: 0,
      groupActivities: 0,
      directPermissions: 5,
    })
    expectPermissionDetail({
      summary,
      detailsKey: 'directPermissionDetails',
      objectType: 'COURSE',
      objectId: summary.courseId,
      userShortname: LECTURER_SHORTNAME,
      permissionLevel: 'ADMIN',
      propagation: false,
    })

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_INST4_ID,
    })
  })

  test('Change the course ADMIN permission to WRITE level for user pro5 (without propagation)', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    await expect(
      page.getByTestId(`permission-${LECTURER_INST4_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)
    await page
      .getByTestId(`permission-level-${LECTURER_INST4_SHORTNAME}`)
      .click()
    await page.getByTestId('permission-level-WRITE').click()
    await expect(
      page.getByTestId(`permission-${LECTURER_INST4_SHORTNAME}`)
    ).toContainText(PERM_WRITE)
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_OWNER)
  })

  test('Verify that the user with new WRITE permissions (without propagation) can only see course & activities with EXECUTE permissions', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, false)
  })

  test('Activate propagation for the WRITE permission of user pro5', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    await expect(
      page.getByTestId(`permission-propagation-${LECTURER_INST4_SHORTNAME}`)
    ).toHaveAttribute('data-state', 'unchecked')
    await page
      .getByTestId(`permission-propagation-${LECTURER_INST4_SHORTNAME}`)
      .click()
    await expect(
      page.getByTestId(`permission-propagation-${LECTURER_INST4_SHORTNAME}`)
    ).toHaveAttribute('data-state', 'checked')
  })

  test('Verify that the user with new WRITE permissions (with propagation) can only see course & activities with WRITE permissions', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, true)
  })

  test('Revoke all individual permissions and verify that the users cannot see the course and its content anymore', async ({
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginInstitutionalCatalyst2,
    loginInstitutionalCatalyst3,
    loginInstitutionalCatalyst4,
    logoutUser,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    for (const shortname of [
      LECTURER_IND_SHORTNAME,
      LECTURER_INST_SHORTNAME,
      LECTURER_INST2_SHORTNAME,
      LECTURER_INST3_SHORTNAME,
      LECTURER_INST4_SHORTNAME,
    ]) {
      await page.getByTestId(`revoke-permission-${shortname}`).click()
      await page.getByTestId('confirm-revocation').click()
      await expect(
        page.getByTestId(`permission-${shortname}`)
      ).not.toBeVisible()
    }
    await logoutUser()

    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst2()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst3()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()
  })
})

// ===========================================================================
// Part 5b: Course Sharing - User group permissions
// ===========================================================================
test.describe('Part 5b: Course Sharing - User group permissions', () => {
  test('Create user groups and share the course directly with other users with READ, EXECUTE, WRITE and ADMIN permissions', async ({
    loginLecturer,
    loginInstitutionalCatalyst3,
    loginInstitutionalCatalyst4,
    logoutUser,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()

    // Create group1 with pro1 as user
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group1)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_IND_EMAIL)
    await page.getByTestId('submit-create-user-group').click()

    // Create group2 with pro2 as admin
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group2)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_INST_EMAIL)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()

    // Create group3 with pro3 as admin
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group3)
    await page
      .getByTestId('member-shortname-email-0')
      .fill(LECTURER_INST2_SHORTNAME)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await logoutUser()

    // Create group4 in pro4 account with lecturer as user
    await loginInstitutionalCatalyst3()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group4)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await logoutUser()

    // Create group5 in pro5 account with lecturer as admin
    await loginInstitutionalCatalyst4()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group5)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await logoutUser()

    // Share course with groups
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    // READ to group1
    await grantGroupPermission(page, SHARING.group1, PERM_READ, false)
    await expect(
      page.getByTestId(`permission-${SHARING.group1}`)
    ).toContainText(PERM_READ)
    await expect(
      page.getByTestId(`permission-propagation-${SHARING.group1}`)
    ).toHaveAttribute('data-state', 'unchecked')
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_OWNER)

    // EXECUTE to group2
    await grantGroupPermission(page, SHARING.group2, PERM_EXECUTE, false)
    await expect(
      page.getByTestId(`permission-${SHARING.group2}`)
    ).toContainText(PERM_EXECUTE)

    // WRITE to group3 (no propagation)
    await grantGroupPermission(page, SHARING.group3, PERM_WRITE, false)
    await expect(
      page.getByTestId(`permission-${SHARING.group3}`)
    ).toContainText(PERM_WRITE)
    await expect(
      page.getByTestId(`permission-propagation-${SHARING.group3}`)
    ).toHaveAttribute('data-state', 'unchecked')

    // WRITE to group4 (with propagation)
    await grantGroupPermission(page, SHARING.group4, PERM_WRITE, true)
    await expect(
      page.getByTestId(`permission-${SHARING.group4}`)
    ).toContainText(PERM_WRITE)
    await expect(
      page.getByTestId(`permission-propagation-${SHARING.group4}`)
    ).toHaveAttribute('data-state', 'checked')

    // ADMIN to group5
    await grantGroupPermission(page, SHARING.group5, PERM_ADMIN, false)
    await expect(
      page.getByTestId(`permission-${SHARING.group5}`)
    ).toContainText(PERM_ADMIN)
  })

  test('Duplicate the shared course as owner and preserve direct user group permissions', async ({
    loginLecturer,
    page,
  }) => {
    test.setTimeout(COURSE_DUPLICATION_TEST_TIMEOUT)

    const copyName = `${SHARING.course} Group Shared Copy`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })

    await loginLecturer()
    await openCourseInManage(page, SHARING.course)
    await submitCourseDuplication(page, copyName)

    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`course-list-button-${copyName}`)
    ).toBeVisible()

    const summary = await expectDuplicatedCourseSummary({
      courseName: copyName,
      ownerId: LECTURER_ID,
      liveQuizzes: 1,
      practiceQuizzes: 1,
      microLearnings: 1,
      groupActivities: 1,
      directPermissions: 5,
    })
    expectCopiedUserGroupPermissions(summary)

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })
  })

  test('Verify that the user in group 1 can see the objects according to course READ permissions', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseReadPermissions(page)
  })

  test('Verify that the user in group 2 can see the objects according to course EXECUTE permissions', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseExecutePermissions(page)
  })

  test('Verify that the user in group 3 can see the objects according to course WRITE permissions (without propagation)', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, false)
  })

  test('Verify that the user in group 4 can see the objects according to course WRITE permissions (with propagation)', async ({
    loginInstitutionalCatalyst3,
    page,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, true)
  })

  test('Verify that the user in group 5 can see the objects according to course ADMIN permissions', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseAdminPermissions(page, true)
  })

  test('Change the course ADMIN permission to WRITE level for user group 5 (without propagation)', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    await expect(
      page.getByTestId(`permission-${SHARING.group5}`)
    ).toContainText(PERM_ADMIN)
    await page.getByTestId(`permission-level-${SHARING.group5}`).click()
    await page.getByTestId('permission-level-WRITE').click()
    await expect(
      page.getByTestId(`permission-${SHARING.group5}`)
    ).toContainText(PERM_WRITE)
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_OWNER)
  })

  test('Verify that the user in group 5 can see the objects according to course WRITE permissions (without propagation)', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, false)
  })

  test('Activate propagation for the WRITE permission of user group 5', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    await expect(
      page.getByTestId(`permission-propagation-${SHARING.group5}`)
    ).toHaveAttribute('data-state', 'unchecked')
    await page.getByTestId(`permission-propagation-${SHARING.group5}`).click()
    await expect(
      page.getByTestId(`permission-propagation-${SHARING.group5}`)
    ).toHaveAttribute('data-state', 'checked')
  })

  test('Verify that the user with new WRITE permissions (with propagation) can only see course & activities with WRITE permissions', async ({
    loginInstitutionalCatalyst4,
    page,
  }) => {
    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseWritePermissions(page, true)
  })

  test('Revoke all user group permissions and verify that the users cannot see the course and its content anymore', async ({
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginInstitutionalCatalyst2,
    loginInstitutionalCatalyst3,
    loginInstitutionalCatalyst4,
    logoutUser,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    for (const group of [
      SHARING.group1,
      SHARING.group2,
      SHARING.group3,
      SHARING.group4,
      SHARING.group5,
    ]) {
      await page.getByTestId(`revoke-permission-${group}`).click()
      await page.getByTestId('confirm-revocation').click()
      await expect(page.getByTestId(`permission-${group}`)).not.toBeVisible()
    }
    await logoutUser()

    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst2()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst3()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()

    await loginInstitutionalCatalyst4()
    await page.getByTestId('library').click()
    await verifyCourseAccessLost(page)
    await logoutUser()
  })

  test("Transfer ownership of the course to user 'pro1' using the username", async ({
    loginLecturer,
    logoutUser,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    // Grant ADMIN to pro1 first
    await grantCoursePermission(page, LECTURER_IND_SHORTNAME, PERM_ADMIN, false)
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)

    // Transfer ownership to pro1
    await page.getByTestId('transfer-ownership').click()
    await page
      .getByTestId('new-owner-username-email-input')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('confirm-ownership-transfer').click()

    // Verify new ownership state
    await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(PERM_OWNER)
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)
    await logoutUser()
  })

  test("Verify that user 'pro1' is the new owner and transfer the ownership back to the main user", async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await verifyCourseAdminPermissions(page, false)

    await page.getByTestId('courses').click()
    await expect(
      page.getByTestId(`delete-course-${SHARING.course}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-course-${SHARING.course}`)
    ).not.toBeVisible()

    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()

    await page.getByTestId('transfer-ownership').click()
    await page
      .getByTestId('new-owner-username-email-input')
      .fill(LECTURER_SHORTNAME)
    await page.getByTestId('confirm-ownership-transfer').click()

    await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_OWNER)
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)
  })

  test("Remove the shared course from user 'pro1' using the removal functionality", async ({
    loginIndividualCatalyst,
    loginLecturer,
    logoutUser,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('courses').click()
    await page.getByTestId(`remove-course-${SHARING.course}`).click()
    await page.getByTestId('confirm-deletion-final').click()
    await page.getByTestId('confirm-dependency-access').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expect(
      page.getByTestId(`course-list-button-${SHARING.course}`)
    ).not.toBeVisible()
    await logoutUser()

    // Verify permission was removed in main account
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SHARING.course}`).click()
    await page.getByTestId('course-share-button').click()
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
    ).toContainText(PERM_OWNER)
  })

  test('Modify one referenced element and verify it updates both same-name live quizzes', async ({
    loginLecturer,
    page,
  }) => {
    const copyName = `${SHARING.course} Copy`
    const updatedLiveQuizElementContent = `Updated sharing live quiz question content ${Date.now()}`

    await deleteCourseWithActivitiesByName({
      courseName: copyName,
      ownerId: LECTURER_ID,
    })
    await loginLecturer()
    await openCourseInManage(page, SHARING.course)
    await submitCourseDuplication(page, copyName)

    const result = await updateElementContentAndInstances({
      elementName: SCML.title,
      ownerId: LECTURER_ID,
      content: updatedLiveQuizElementContent,
    })
    expect(result.elementId).toEqual(expect.any(Number))
    expect(result.updatedInstances).toBeGreaterThan(1)

    await expectLiveQuizElementInstanceContent({
      courseName: SHARING.course,
      liveQuizName: SHARING.liveQuiz,
      content: updatedLiveQuizElementContent,
    })
    await expectLiveQuizElementInstanceContent({
      courseName: copyName,
      liveQuizName: SHARING.liveQuiz,
      content: updatedLiveQuizElementContent,
    })
  })
})
