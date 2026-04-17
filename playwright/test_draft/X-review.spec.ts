/**
 * X-review.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/X-review-workflow.cy.ts
 * Tests:
 *  Part 1: Activity review functionality (mark as reviewed, reset, modify elements triggers re-review)
 *  Part 2: Element list batch operations (archive, status, multiplier, base points)
 *  Part 3: Activity list batch operations (multiplier, course re-assignment, live quiz grading logic)
 */

import { type Page } from '@playwright/test'
import {
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST_SHORTNAME,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
// From cypress/fixtures/questions.json
const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: [
    { value: '50%', correct: true },
    { value: '100%', correct: false },
  ],
}

const MCML = {
  title: 'MC Title Test 2 (Version 1)',
  content: 'MC Question Content 2',
  choices: [
    { value: '50%', correct: true },
    { value: '25%' },
    { value: '100%' },
  ],
}

const KP = {
  title: 'KPRIM Title Test 1 (Version 1)',
  content: 'KPRIM Question Content 1',
}
const FT = {
  title: 'FT Title Test 1 (Version 1)',
  content: 'FT Question Content 1',
}
const FC = {
  title: 'FC Question Title (Version 1)',
  content: 'FC Question Content (Version 1)',
}
const CT = {
  title: 'CT Question Title (Version 1)',
  content: 'CT Question Content (Version 1)',
}
const CS = { title: 'CS Title Test 2 (Version 1)' }
const SEML = {
  title: 'SE Title Test 2 (Version 1)',
  content: 'SE Question Content 2',
  inputs: 3,
  solutions: [0, 1, 2, 4],
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

// From cypress/fixtures/X-review.json
const REVIEW = {
  course: { name: 'Review Course 1', displayName: 'Review Course 1 (Display)' },
  course2: {
    name: 'Review Course 2',
    displayName: 'Review Course 2 (Display)',
  },
  liveQuizNoCourse: 'Live Quiz without Course',
  liveQuiz: 'Standard Live Quiz',
  practiceQuiz: 'Standard Practice Quiz',
  microLearning: 'Standard Micro Learning',
  groupActivity: 'Standard Group Activity',
}

const BATCH = {
  course1: 'Batch Operations Course 1',
  course2: 'Batch Operations Course 2',
  course3: 'Batch Operations Course 3',
  course4: 'Batch Operations Course 4',
  course5: 'Batch Operations Course 5',
  courseNoGroups: 'Batch Operations Course No Groups',
  courseNotGamified: 'Batch Operations Course No Gamification',
  liveQuiz: 'Activity Batch Operations Live Quiz 1',
  liveQuiz2: 'Activity Batch Operations Live Quiz 2',
  practiceQuiz: 'Activity Batch Operations Practice Quiz 1',
  practiceQuiz2: 'Activity Batch Operations Practice Quiz 2',
  microLearning: 'Activity Batch Operations Micro Learning 1',
  microLearning2: 'Activity Batch Operations Micro Learning 2',
  groupActivity: 'Activity Batch Operations Group Activity 1',
}

// i18n label equivalents
const STATUS_REVIEWED = 'Reviewed'
const STATUS_MODIFIED_AFTER_REVIEW = 'Modified After Review'
const STATUS_READY = 'Ready'
const STATUS_REVIEW = 'Review'
const REVIEW_COMPLETED = 'Mark as reviewed'
const RESET_REVIEW = 'Reset review status'
const MULTIPLIER_2 = '2x'
const MULTIPLIER_3 = '3x'
const MULTIPLIER_4 = '4x'

const PERM_READ = 'Read'
const PERM_WRITE = 'Write'
const PERM_EXECUTE = 'Execute'
const PERM_ADMIN = 'Admin'

// Activities for Part 1
const ACTIVITIES_ALL = [
  { name: REVIEW.liveQuizNoCourse, type: 'LIVE_QUIZ' },
  { name: REVIEW.liveQuiz, type: 'LIVE_QUIZ' },
  { name: REVIEW.practiceQuiz, type: 'PRACTICE_QUIZ' },
  { name: REVIEW.microLearning, type: 'MICRO_LEARNING' },
  { name: REVIEW.groupActivity, type: 'GROUP_ACTIVITY' },
]

const ACTIVITIES_WITH_COURSE = [
  { name: REVIEW.liveQuiz, type: 'LIVE_QUIZ', tabKey: 'liveQuizzes' },
  {
    name: REVIEW.practiceQuiz,
    type: 'PRACTICE_QUIZ',
    tabKey: 'practiceQuizzes',
  },
  {
    name: REVIEW.microLearning,
    type: 'MICRO_LEARNING',
    tabKey: 'microLearnings',
  },
  {
    name: REVIEW.groupActivity,
    type: 'GROUP_ACTIVITY',
    tabKey: 'groupActivities',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  await page.getByTestId('insert-answer-field-0').fill(choices[0].value)
  if (choices[0].correct) {
    await page.getByTestId('set-correct-ix-0').click()
  }
  for (let i = 1; i < choices.length; i++) {
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(200)
    await page.getByTestId(`insert-answer-field-${i}`).fill(choices[i].value)
    if (choices[i].correct) {
      await page.getByTestId(`set-correct-ix-${i}`).click()
    }
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

async function createMCQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
) {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Multiple Choice (MC)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('insert-answer-field-0').fill(choices[0].value)
  if (choices[0].correct) {
    await page.getByTestId('set-correct-ix-0').click()
  }
  for (let i = 1; i < choices.length; i++) {
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(200)
    await page.getByTestId(`insert-answer-field-${i}`).fill(choices[i].value)
    if (choices[i].correct) {
      await page.getByTestId(`set-correct-ix-${i}`).click()
    }
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

async function createNRQuestion(page: Page, title: string, content: string) {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Numerical (NR)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('set-numerical-minimum').fill(NRML.options.min)
  await page.getByTestId('set-numerical-maximum').fill(NRML.options.max)
  await page.getByTestId('set-numerical-unit').fill(NRML.options.unit)
  await page.getByTestId('set-numerical-accuracy').fill(NRML.options.accuracy)
  for (let i = 0; i < NRML.options.solutionRanges.length; i++) {
    if (i > 0) {
      await page.getByTestId('add-solution-range').click()
    }
    await page
      .getByTestId(`solution-range-min-${i}`)
      .fill(NRML.options.solutionRanges[i].min)
    await page
      .getByTestId(`solution-range-max-${i}`)
      .fill(NRML.options.solutionRanges[i].max)
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

async function createCourse(
  page: Page,
  name: string,
  displayName: string,
  options: {
    gamification?: boolean
    groupCreation?: boolean
    maxGroupSize?: string
    preferredGroupSize?: string
  } = {}
) {
  await page.getByTestId('courses').click()
  await page.getByTestId('course-list-button-new-course').click()
  await page.getByTestId('course-name').fill(name)
  await page.getByTestId('course-display-name').fill(displayName)

  if (options.gamification === false) {
    await page.getByTestId('course-gamification').click()
    await expect(page.getByTestId('course-gamification')).toHaveAttribute(
      'data-state',
      'unchecked'
    )
  } else if (options.groupCreation !== false) {
    // Enable group creation with default or specified values
    await page.getByTestId('course-group-creation').click()
    await page.getByTestId('max-group-size').fill(options.maxGroupSize ?? '4')
    await page
      .getByTestId('preferred-group-size')
      .fill(options.preferredGroupSize ?? '2')
  }

  await page.getByTestId('manipulate-course-submit').click()
  await page.waitForTimeout(500)
}

async function shareActivity(
  page: Page,
  activityType: string,
  activityName: string,
  shareTestId: string,
  permissions: { username: string; level: string }[]
) {
  await page.getByTestId(`actions-${activityType}-${activityName}`).click()
  await page.getByTestId(shareTestId).click()

  for (const { username, level } of permissions) {
    await page.getByTestId('new-permission-username-or-email').fill(username)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(level).click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
  }
  await page.getByTestId('close-share-object').click()
}

/**
 * Mark all activities as reviewed from the activities list.
 */
async function markAllActivitiesAsReviewed(page: Page) {
  for (const activity of ACTIVITIES_ALL) {
    await page.getByTestId(`actions-${activity.type}-${activity.name}`).click()
    await page.getByTestId(`activity-information-${activity.name}`).click()
    await expect(page.getByTestId('activity-review-button')).toContainText(
      REVIEW_COMPLETED
    )
    await page.getByTestId('activity-review-button').click()
    await expect(page.getByTestId('activity-review-button')).toContainText(
      RESET_REVIEW
    )
    await page.getByTestId('close-activity-details-modal').click()
    await expect(
      page.getByTestId(`activity-${activity.type}-${activity.name}`)
    ).toContainText(STATUS_REVIEWED)
  }
}

// ===========================================================================
// Part 1: Activity review functionality
// ===========================================================================
test.describe('Part 1: Activity review functionality', () => {
  test('Prepare questions, courses, and one activity of each type', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Create questions
    await page.getByTestId('library').click()
    await createSCQuestion(page, SCML.title, SCML.content, SCML.choices)
    await createMCQuestion(page, MCML.title, MCML.content, MCML.choices)

    // Create courses
    await createCourse(page, REVIEW.course.name, REVIEW.course.displayName, {
      gamification: true,
      groupCreation: true,
    })
    await createCourse(page, REVIEW.course2.name, REVIEW.course2.displayName, {
      gamification: true,
      groupCreation: true,
    })

    // Create activities
    await page.getByTestId('library').click()
    await page.getByTestId('activities').click()

    // Live quiz without course
    await page.getByTestId('create-live-quiz').click()
    await page
      .getByTestId('insert-live-quiz-name')
      .fill(REVIEW.liveQuizNoCourse)
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Live quiz with course
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('insert-live-quiz-name').fill(REVIEW.liveQuiz)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${REVIEW.course.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Practice quiz
    await page.getByTestId('create-practice-quiz').click()
    await page
      .getByTestId('insert-practice-quiz-name')
      .fill(REVIEW.practiceQuiz)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${REVIEW.course.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Microlearning
    await page.getByTestId('create-microlearning').click()
    await page
      .getByTestId('insert-microlearning-name')
      .fill(REVIEW.microLearning)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${REVIEW.course.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Group activity
    await page.getByTestId('create-group-activity').click()
    await page
      .getByTestId('insert-group-activity-name')
      .fill(REVIEW.groupActivity)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${REVIEW.course.name}`).click()
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
  })

  test('Share live quiz (no course) and course with READ/EXECUTE/WRITE/ADMIN permissions', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    // Share live quiz without course
    await page.getByTestId('activities').click()
    await shareActivity(
      page,
      'LIVE_QUIZ',
      REVIEW.liveQuizNoCourse,
      `share-live-quiz-${REVIEW.liveQuizNoCourse}`,
      [
        { username: LECTURER_IND_SHORTNAME, level: PERM_READ },
        { username: LECTURER_INST_SHORTNAME, level: PERM_EXECUTE },
        { username: LECTURER_INST2_SHORTNAME, level: PERM_WRITE },
        { username: LECTURER_INST3_SHORTNAME, level: PERM_ADMIN },
      ]
    )

    // Share course
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${REVIEW.course.name}`).click()
    await page.getByTestId('course-share-button').click()

    for (const { username, level } of [
      { username: LECTURER_IND_SHORTNAME, level: PERM_READ },
      { username: LECTURER_INST_SHORTNAME, level: PERM_EXECUTE },
      { username: LECTURER_INST2_SHORTNAME, level: PERM_WRITE },
      { username: LECTURER_INST3_SHORTNAME, level: PERM_ADMIN },
    ]) {
      await page.getByTestId('new-permission-username-or-email').fill(username)
      await page.getByTestId('new-permission-access-level').click()
      await page.getByText(level).click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
    }
    await page.getByTestId('close-share-object').click()
  })

  test('Users with READ/EXECUTE/WRITE permissions cannot see the review button', async ({
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginInstitutionalCatalyst2,
    logoutUser,
    page,
  }) => {
    // READ user
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    for (const activity of ACTIVITIES_ALL) {
      await page
        .getByTestId(`actions-${activity.type}-${activity.name}`)
        .click()
      await page.getByTestId(`activity-information-${activity.name}`).click()
      await expect(page.getByTestId('activity-review-button')).not.toBeVisible()
      await page.getByTestId('close-activity-details-modal').click()
    }
    await logoutUser()

    // EXECUTE user
    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()
    for (const activity of ACTIVITIES_ALL) {
      await page
        .getByTestId(`actions-${activity.type}-${activity.name}`)
        .click()
      await page.getByTestId(`activity-information-${activity.name}`).click()
      await expect(page.getByTestId('activity-review-button')).not.toBeVisible()
      await page.getByTestId('close-activity-details-modal').click()
    }
    await logoutUser()

    // WRITE user
    await loginInstitutionalCatalyst2()
    await page.getByTestId('activities').click()
    for (const activity of ACTIVITIES_ALL) {
      await page
        .getByTestId(`actions-${activity.type}-${activity.name}`)
        .click()
      await page.getByTestId(`activity-information-${activity.name}`).click()
      await expect(page.getByTestId('activity-review-button')).not.toBeVisible()
      await page.getByTestId('close-activity-details-modal').click()
    }
    await logoutUser()
  })

  test('Set all activities to reviewed via OWNER, reset via ADMIN, re-set via course overview', async ({
    loginLecturer,
    loginInstitutionalCatalyst3,
    logoutUser,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await markAllActivitiesAsReviewed(page)
    await logoutUser()

    // ADMIN user resets all activities
    await loginInstitutionalCatalyst3()
    await page.getByTestId('activities').click()

    for (const activity of ACTIVITIES_ALL) {
      await page.getByTestId('activities-search-input').fill(activity.name)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`activity-${activity.type}-${activity.name}`)
      ).toContainText(STATUS_REVIEWED)
      await page
        .getByTestId(`actions-${activity.type}-${activity.name}`)
        .click()
      await page.getByTestId(`activity-information-${activity.name}`).click()
      await expect(page.getByTestId('activity-review-button')).toContainText(
        RESET_REVIEW
      )
      await page.getByTestId('activity-review-button').click()
      await expect(page.getByTestId('activity-review-button')).toContainText(
        REVIEW_COMPLETED
      )
      await page.getByTestId('close-activity-details-modal').click()
      await expect(
        page.getByTestId(`activity-${activity.type}-${activity.name}`)
      ).not.toContainText(STATUS_REVIEWED)
      await page.getByTestId('activities-search-input').clear()
    }

    // Re-mark live quiz without course as reviewed
    await page.getByTestId('activities').click()
    await page
      .getByTestId('activities-search-input')
      .fill(REVIEW.liveQuizNoCourse)
    await page.keyboard.press('Enter')
    await page
      .getByTestId(`actions-LIVE_QUIZ-${REVIEW.liveQuizNoCourse}`)
      .click()
    await page
      .getByTestId(`activity-information-${REVIEW.liveQuizNoCourse}`)
      .click()
    await page.getByTestId('activity-review-button').click()
    await expect(page.getByTestId('activity-review-button')).toContainText(
      RESET_REVIEW
    )
    await page.getByTestId('close-activity-details-modal').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${REVIEW.liveQuizNoCourse}`)
    ).toContainText(STATUS_REVIEWED)
    await page.getByTestId('activities-search-input').clear()

    // Re-set all course-assigned activities via course overview
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${REVIEW.course.name}`).click()

    for (const activity of ACTIVITIES_WITH_COURSE) {
      await page.getByTestId(`tab-${activity.tabKey}`).click()
      await expect(
        page.getByTestId(`activity-${activity.type}-${activity.name}`)
      ).not.toContainText(STATUS_REVIEWED)
      await page
        .getByTestId(`actions-${activity.type}-${activity.name}`)
        .click()
      await page.getByTestId(`activity-information-${activity.name}`).click()
      await expect(page.getByTestId('activity-review-button')).toContainText(
        REVIEW_COMPLETED
      )
      await page.getByTestId('activity-review-button').click()
      await expect(page.getByTestId('activity-review-button')).toContainText(
        RESET_REVIEW
      )
      await page.getByTestId('close-activity-details-modal').click()
      await expect(
        page.getByTestId(`activity-${activity.type}-${activity.name}`)
      ).toContainText(STATUS_REVIEWED)
    }
  })

  test('Edit each activity through the wizard and verify that the review status is updated', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const activity of ACTIVITIES_ALL) {
      const editTestId =
        activity.type === 'LIVE_QUIZ'
          ? `edit-live-quiz-${activity.name}`
          : activity.type === 'PRACTICE_QUIZ'
            ? `edit-practice-quiz-${activity.name}`
            : activity.type === 'MICRO_LEARNING'
              ? `edit-microlearning-${activity.name}`
              : `edit-group-activity-${activity.name}`

      await page.getByTestId('activities').click()
      await page
        .getByTestId(`actions-${activity.type}-${activity.name}`)
        .click()
      await page.getByTestId(editTestId).click()
      // Navigate through all wizard steps
      for (let i = 0; i < 4; i++) {
        await page.getByTestId('next-or-submit').click()
        await page.waitForTimeout(200)
      }

      // Return to overview and verify status changed to MODIFIED_AFTER_REVIEW
      await page.getByTestId('open-activity-overview').click()
      await expect(
        page.getByTestId(`activity-${activity.type}-${activity.name}`)
      ).toContainText(STATUS_MODIFIED_AFTER_REVIEW)
    }
  })

  test('Mark activities as reviewed, change course assignments, verify review status is reset', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await markAllActivitiesAsReviewed(page)

    // Assign live quiz (no course) to second course → status reset
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${REVIEW.liveQuizNoCourse}`)
      .click()
    await page.getByTestId(`edit-live-quiz-${REVIEW.liveQuizNoCourse}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${REVIEW.course2.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('open-activity-overview').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${REVIEW.liveQuizNoCourse}`)
    ).not.toContainText(STATUS_REVIEWED)
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${REVIEW.liveQuizNoCourse}`)
    ).not.toContainText(STATUS_MODIFIED_AFTER_REVIEW)

    // Re-assign other activities to different courses
    for (const [activityType, activityName, editTestId] of [
      ['LIVE_QUIZ', REVIEW.liveQuiz, `edit-live-quiz-${REVIEW.liveQuiz}`],
      [
        'PRACTICE_QUIZ',
        REVIEW.practiceQuiz,
        `edit-practice-quiz-${REVIEW.practiceQuiz}`,
      ],
      [
        'MICRO_LEARNING',
        REVIEW.microLearning,
        `edit-microlearning-${REVIEW.microLearning}`,
      ],
      [
        'GROUP_ACTIVITY',
        REVIEW.groupActivity,
        `edit-group-activity-${REVIEW.groupActivity}`,
      ],
    ] as [string, string, string][]) {
      await page.getByTestId('activities').click()
      await page.getByTestId(`actions-${activityType}-${activityName}`).click()
      await page.getByTestId(editTestId).click()
      await page.getByTestId('next-or-submit').click()
      await page.getByTestId('next-or-submit').click()
      await page.getByTestId('select-course').click()
      await page.getByTestId(`select-course-${REVIEW.course2.name}`).click()
      await page.getByTestId('next-or-submit').click()
      await page.getByTestId('next-or-submit').click()
      await page.getByTestId('open-activity-overview').click()
      await expect(
        page.getByTestId(`activity-${activityType}-${activityName}`)
      ).not.toContainText(STATUS_REVIEWED)
      await expect(
        page.getByTestId(`activity-${activityType}-${activityName}`)
      ).not.toContainText(STATUS_MODIFIED_AFTER_REVIEW)
    }
  })

  test('Mark activities as reviewed, modify an element, verify all activities show MODIFIED_AFTER_REVIEW', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await markAllActivitiesAsReviewed(page)

    // Modify the SC question title
    await page.getByTestId('library').click()
    await page.getByTestId(`edit-element-${SCML.title}`).click()
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').pressSequentially(' NEW')
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`edit-element-${SCML.title} NEW`)
    ).toBeVisible()

    // Verify all activities are now MODIFIED_AFTER_REVIEW
    await page.getByTestId('activities').click()
    for (const activity of ACTIVITIES_ALL) {
      await expect(
        page.getByTestId(`activity-${activity.type}-${activity.name}`)
      ).toContainText(STATUS_MODIFIED_AFTER_REVIEW)
    }
  })
})

// ===========================================================================
// Part 2: Element list batch operations
// ===========================================================================
test.describe('Part 2: Element list batch operations', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Prepare elements for element list batch operations', async ({
    page,
  }) => {
    // Show archived elements
    await page.getByTestId('show-archive-switch').click()

    // Create SC question (archived)
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(SCML.title)
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SCML.content)
    await page.getByTestId('insert-answer-field-0').fill(SCML.choices[0].value)
    await page.getByTestId('set-correct-ix-0').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(200)
    await page.getByTestId('insert-answer-field-1').fill(SCML.choices[1].value)
    // Set as archived
    await page.getByTestId('toggle-archive-element').click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create MC question (not archived)
    await createMCQuestion(page, MCML.title, MCML.content, MCML.choices)

    // Create KPRIM question (archived) - use kprim type
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-KPRIM').click()
    await page.getByTestId('insert-question-title').fill(KP.title)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(KP.content)
    await page.getByTestId('toggle-archive-element').click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create NR question (not archived)
    await createNRQuestion(page, NRML.title, NRML.content)

    // Create FT question
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Free Text (FT)').click()
    await page.getByTestId('insert-question-title').fill(FT.title)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(FT.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create FC flashcard (archived)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Flashcard (FC)').click()
    await page.getByTestId('insert-question-title').fill(FC.title)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(FC.content)
    await page.getByTestId('toggle-archive-element').click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create CT content element
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Content (CT)').click()
    await page.getByTestId('insert-question-title').fill(CT.title)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(CT.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create answer collection and SE question
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
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

    // Create SE question
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Selection (SE)').click()
    await page.getByTestId('insert-question-title').fill(SEML.title)
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SEML.content)
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${COLLECTION.name}`)
      .click()
    for (const idx of SEML.solutions) {
      await page.getByTestId(`set-correct-ix-${idx}`).click()
    }
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create CS question
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Case Study (CS)').click()
    await page.getByTestId('insert-question-title').fill(CS.title)
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${COLLECTION.name}`)
      .click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)
  })

  test('Verify that selected elements are shown correctly in batch operations modal', async ({
    page,
  }) => {
    await page.getByTestId('show-archive-switch').click()

    // Select specific elements
    await page.getByTestId(`element-checkbox-${SCML.title}`).click()
    await page.getByTestId(`element-checkbox-${KP.title}`).click()
    await page.getByTestId(`element-checkbox-${FC.title}`).click()
    await page.getByTestId(`element-checkbox-${CS.title}`).click()

    await page.getByTestId('element-batch-operations').click()

    // Only selected elements should appear
    for (const title of [SCML.title, KP.title, FC.title, CS.title]) {
      await expect(
        page.getByTestId(`element-batch-entry-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`element-batch-check-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`element-batch-x-${title}`)
      ).not.toBeVisible()
    }
    for (const title of [
      MCML.title,
      NRML.title,
      FT.title,
      CT.title,
      SEML.title,
    ]) {
      await expect(
        page.getByTestId(`element-batch-entry-${title}`)
      ).not.toBeVisible()
    }
    await page.getByTestId('close-batch-operations-modal').click()

    // Select all
    await page.getByTestId('select-all-elements').click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-elements').click() // select all

    await page.getByTestId('element-batch-operations').click()
    for (const title of [
      SCML.title,
      MCML.title,
      KP.title,
      NRML.title,
      FT.title,
      FC.title,
      CT.title,
      SEML.title,
      CS.title,
    ]) {
      await expect(
        page.getByTestId(`element-batch-entry-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`element-batch-check-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`element-batch-x-${title}`)
      ).not.toBeVisible()
    }
  })

  test('Verify that applied operations are displayed correctly in batch operations modal', async ({
    page,
  }) => {
    await page.getByTestId('show-archive-switch').click()
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()

    // Archive: already-archived elements show X, others show checkmark
    await page.getByTestId('archive-button').click()
    for (const title of [
      MCML.title,
      NRML.title,
      FT.title,
      CT.title,
      SEML.title,
      CS.title,
    ]) {
      await expect(
        page.getByTestId(`element-batch-check-${title}`)
      ).toBeVisible()
    }
    for (const title of [SCML.title, KP.title, FC.title]) {
      await expect(page.getByTestId(`element-batch-x-${title}`)).toBeVisible()
    }

    // Unarchive: previously-non-archived show X
    await page.getByTestId('unarchive-button').click()
    for (const title of [SCML.title, KP.title, FC.title]) {
      await expect(
        page.getByTestId(`element-batch-check-${title}`)
      ).toBeVisible()
    }
    for (const title of [
      MCML.title,
      NRML.title,
      FT.title,
      CT.title,
      SEML.title,
      CS.title,
    ]) {
      await expect(page.getByTestId(`element-batch-x-${title}`)).toBeVisible()
    }

    // Status checkbox — all elements applicable
    await page.getByTestId('status-checkbox').click()
    for (const title of [
      SCML.title,
      MCML.title,
      KP.title,
      NRML.title,
      FT.title,
      FC.title,
      CT.title,
      SEML.title,
      CS.title,
    ]) {
      await expect(
        page.getByTestId(`element-batch-check-${title}`)
      ).toBeVisible()
    }
    await page.getByTestId('status-checkbox').click()

    // Multiplier checkbox — only elements with sample solution (not KP/FT/FC/CT/CS)
    await page.getByTestId('multiplier-checkbox').click()
    for (const title of [SCML.title, MCML.title, NRML.title, SEML.title]) {
      await expect(
        page.getByTestId(`element-batch-check-${title}`)
      ).toBeVisible()
    }
    for (const title of [KP.title, FT.title, FC.title, CT.title, CS.title]) {
      await expect(page.getByTestId(`element-batch-x-${title}`)).toBeVisible()
    }
    await page.getByTestId('multiplier-checkbox').click()
  })

  test('Verify that archiving and unarchiving elements works correctly', async ({
    page,
  }) => {
    await page.getByTestId('show-archive-switch').click()

    const allElements = [
      SCML.title,
      MCML.title,
      KP.title,
      NRML.title,
      FT.title,
      FC.title,
      CT.title,
      SEML.title,
      CS.title,
    ]

    // Initially only SCML, KP, FC are archived
    for (const title of [SCML.title, KP.title, FC.title]) {
      await expect(page.getByTestId(`archive-badge-${title}`)).toBeVisible()
    }

    // Archive all
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('archive-button').click()
    await page.getByTestId('apply-batch-operations').click()

    for (const title of allElements) {
      await expect(page.getByTestId(`archive-badge-${title}`)).toBeVisible()
    }

    // Unarchive all
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('unarchive-button').click()
    await page.getByTestId('apply-batch-operations').click()

    for (const title of allElements) {
      await expect(page.getByTestId(`archive-badge-${title}`)).not.toBeVisible()
    }
  })

  test('Verify that status changes work for all elements', async ({ page }) => {
    const allElements = [
      SCML.title,
      MCML.title,
      KP.title,
      NRML.title,
      FT.title,
      FC.title,
      CT.title,
      SEML.title,
      CS.title,
    ]

    // All should be in READY state
    for (const title of allElements) {
      await expect(page.getByTestId(`element-item-${title}`)).toContainText(
        STATUS_READY
      )
    }

    // Change all to REVIEW
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('status-checkbox').click()
    await page.getByTestId('element-status-select').click()
    await page.getByText(STATUS_REVIEW).click()
    await page.getByTestId('apply-batch-operations').click()

    for (const title of allElements) {
      await expect(page.getByTestId(`element-item-${title}`)).toContainText(
        STATUS_REVIEW
      )
    }
  })

  test('Verify that multiplier and base point operations only apply to supported elements', async ({
    page,
  }) => {
    // Disable base points for all
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('base-points-checkbox').click()
    await expect(page.getByTestId('base-points-switch')).toHaveAttribute(
      'data-state',
      'checked'
    )
    await page.getByTestId('base-points-switch').click()
    await page.getByTestId('apply-batch-operations').click()

    // Verify base points disabled for all question types
    for (const element of [
      SCML.title,
      MCML.title,
      KP.title,
      NRML.title,
      FT.title,
      SEML.title,
      CS.title,
    ]) {
      await page.getByTestId(`edit-element-${element}`).click()
      await expect(
        page.getByTestId('configure-base-points')
      ).not.toHaveAttribute('data-state', 'checked')
      await page.getByTestId('close-element-modal').click()
    }

    // Enable base points and change multiplier to 3x
    await page.getByTestId('select-all-elements').click()
    await page.getByTestId('element-batch-operations').click()
    await page.getByTestId('base-points-checkbox').click()
    await page.getByTestId('multiplier-checkbox').click()
    await page.getByTestId('select-multiplier').click()
    await page.getByText(MULTIPLIER_3).click()
    await page.getByTestId('apply-batch-operations').click()

    // Verify base points enabled for elements with sample solution
    for (const element of [SCML.title, MCML.title, NRML.title, SEML.title]) {
      await page.getByTestId(`edit-element-${element}`).click()
      await expect(page.getByTestId('configure-base-points')).toHaveAttribute(
        'data-state',
        'checked'
      )
      await page.getByTestId('close-element-modal').click()
    }

    // Verify KP/FT/CS base points still disabled
    for (const element of [KP.title, FT.title, CS.title]) {
      await page.getByTestId(`edit-element-${element}`).click()
      await expect(
        page.getByTestId('configure-base-points')
      ).not.toHaveAttribute('data-state', 'checked')
      await page.getByTestId('close-element-modal').click()
    }
  })
})

// ===========================================================================
// Part 3: Activity list batch operations
// ===========================================================================
test.describe('Part 3: Activity list batch operations', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Prepare elements, activities, and courses for activity batch operations', async ({
    page,
  }) => {
    // Create questions
    await page.getByTestId('library').click()
    await createSCQuestion(page, SCML.title, SCML.content, SCML.choices)
    await createNRQuestion(page, NRML.title, NRML.content)

    // Create valid courses
    for (const courseName of [BATCH.course1, BATCH.course2]) {
      await createCourse(page, courseName, courseName, {
        gamification: true,
        groupCreation: true,
      })
    }

    // Create invalid courses with restricted date ranges (shorter end)
    for (const courseName of [BATCH.course3, BATCH.course4, BATCH.course5]) {
      await createCourse(page, courseName, courseName, {
        gamification: true,
        groupCreation: true,
      })
    }

    // Course without group creation
    await createCourse(page, BATCH.courseNoGroups, BATCH.courseNoGroups, {
      gamification: true,
      groupCreation: false,
    })

    // Course without gamification
    await createCourse(page, BATCH.courseNotGamified, BATCH.courseNotGamified, {
      gamification: false,
    })

    // Create activities
    await page.getByTestId('library').click()
    await page.getByTestId('activities').click()

    // Live quiz 1 (gamified course)
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('insert-live-quiz-name').fill(BATCH.liveQuiz)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.course1}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Practice quiz 1
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('insert-practice-quiz-name').fill(BATCH.practiceQuiz)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.course1}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Microlearning 1
    await page.getByTestId('create-microlearning').click()
    await page
      .getByTestId('insert-microlearning-name')
      .fill(BATCH.microLearning)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.course1}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Group activity 1
    await page.getByTestId('create-group-activity').click()
    await page
      .getByTestId('insert-group-activity-name')
      .fill(BATCH.groupActivity)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.course1}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('add-clue').click()
    await page.getByTestId('clue-name-0').fill('Clue 1')
    await page.getByTestId('clue-display-name-0').fill('First Hint')
    await page.getByTestId('clue-content-0').fill('Lorem ipsum')
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('group-activity-task').fill('TASK')
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Live quiz 2 (non-gamified course)
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('insert-live-quiz-name').fill(BATCH.liveQuiz2)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.courseNotGamified}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Practice quiz 2 (non-gamified)
    await page.getByTestId('create-practice-quiz').click()
    await page
      .getByTestId('insert-practice-quiz-name')
      .fill(BATCH.practiceQuiz2)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.courseNotGamified}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()

    // Microlearning 2 (non-gamified)
    await page.getByTestId('create-microlearning').click()
    await page
      .getByTestId('insert-microlearning-name')
      .fill(BATCH.microLearning2)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${BATCH.courseNotGamified}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('create-new-activity').click()
  })

  test('Verify that selected activities are shown correctly in activity batch operations modal', async ({
    page,
  }) => {
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)

    // Select specific activities
    await page.getByTestId(`activity-checkbox-${BATCH.liveQuiz}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.microLearning}`).click()

    await page.getByTestId('activity-batch-operations').click()

    // Only selected should appear
    for (const title of [BATCH.liveQuiz, BATCH.microLearning]) {
      await expect(
        page.getByTestId(`activity-batch-entry-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`activity-batch-check-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`activity-batch-x-${title}`)
      ).not.toBeVisible()
    }
    for (const title of [BATCH.practiceQuiz, BATCH.groupActivity]) {
      await expect(
        page.getByTestId(`activity-batch-entry-${title}`)
      ).not.toBeVisible()
    }
    await page.getByTestId('close-batch-operations-modal').click()

    // Select all
    await page.getByTestId('select-all-activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-activities').click()

    await page.getByTestId('activity-batch-operations').click()
    for (const title of [
      BATCH.liveQuiz,
      BATCH.microLearning,
      BATCH.practiceQuiz,
      BATCH.groupActivity,
    ]) {
      await expect(
        page.getByTestId(`activity-batch-entry-${title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`activity-batch-check-${title}`)
      ).toBeVisible()
    }
  })

  test('Verify that multiplier changes are applied correctly', async ({
    page,
  }) => {
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId('select-all-activities').click()
    await page.getByTestId('activity-batch-operations').click()

    // Enable multiplier change
    await page.getByTestId('multiplier-checkbox').click()
    // Gamified activities show checkmark
    for (const title of [
      BATCH.liveQuiz,
      BATCH.microLearning,
      BATCH.practiceQuiz,
      BATCH.groupActivity,
    ]) {
      await expect(
        page.getByTestId(`activity-batch-check-${title}`)
      ).toBeVisible()
    }
    // Non-gamified activities show X
    for (const title of [
      BATCH.liveQuiz2,
      BATCH.microLearning2,
      BATCH.practiceQuiz2,
    ]) {
      await expect(page.getByTestId(`activity-batch-x-${title}`)).toBeVisible()
    }

    // Set multiplier to 3
    await page.getByTestId('select-multiplier').click()
    await page.getByText(MULTIPLIER_3).click()
    await page.getByTestId('apply-batch-operations').click()

    // Verify gamified activities have multiplier 3
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`actions-LIVE_QUIZ-${BATCH.liveQuiz}`).click()
    await page.getByTestId(`edit-live-quiz-${BATCH.liveQuiz}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      MULTIPLIER_3
    )

    // Non-gamified live quiz should not have multiplier setting
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`actions-LIVE_QUIZ-${BATCH.liveQuiz2}`).click()
    await page.getByTestId(`edit-live-quiz-${BATCH.liveQuiz2}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('select-multiplier')).not.toBeVisible()
  })

  test('Verify that course re-assignments are applied correctly', async ({
    page,
  }) => {
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)

    // Select gamified activities
    await page.getByTestId(`activity-checkbox-${BATCH.liveQuiz}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.practiceQuiz}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.microLearning}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.groupActivity}`).click()
    await page.getByTestId('activity-batch-operations').click()

    await page.getByTestId('course-checkbox').click()
    await page.getByTestId('select-course').click()
    await page.getByText(BATCH.course2).click()

    // All selected activities should show checkmark
    for (const title of [
      BATCH.liveQuiz,
      BATCH.microLearning,
      BATCH.practiceQuiz,
      BATCH.groupActivity,
    ]) {
      await expect(
        page.getByTestId(`activity-batch-check-${title}`)
      ).toBeVisible()
    }
    await page.getByTestId('apply-batch-operations').click()

    // Verify course assignment changed to course2
    for (const [activityType, name, editTestId] of [
      ['LIVE_QUIZ', BATCH.liveQuiz, `edit-live-quiz-${BATCH.liveQuiz}`],
      [
        'PRACTICE_QUIZ',
        BATCH.practiceQuiz,
        `edit-practice-quiz-${BATCH.practiceQuiz}`,
      ],
      [
        'MICRO_LEARNING',
        BATCH.microLearning,
        `edit-microlearning-${BATCH.microLearning}`,
      ],
      [
        'GROUP_ACTIVITY',
        BATCH.groupActivity,
        `edit-group-activity-${BATCH.groupActivity}`,
      ],
    ] as [string, string, string][]) {
      await page.getByTestId('activities').click()
      await page.waitForTimeout(500)
      await page.getByTestId(`actions-${activityType}-${name}`).click()
      await page.getByTestId(editTestId).click()
      await page.getByTestId('next-or-submit').click()
      await page.getByTestId('next-or-submit').click()
      await expect(page.getByTestId('select-course')).toContainText(
        BATCH.course2
      )
    }
  })

  test('Verify that customized live quiz grading logic is applied correctly', async ({
    page,
  }) => {
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)

    // Select both live quizzes
    await page.getByTestId(`activity-checkbox-${BATCH.liveQuiz}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.liveQuiz2}`).click()
    await page.getByTestId('activity-batch-operations').click()

    // Enable live quiz points modification
    await page.getByTestId('live-quiz-points-checkbox').click()
    await page.getByTestId('base-points-input').fill('100')
    await page.getByTestId('correctness-points-input').fill('200')
    await page.getByTestId('bonus-points-input').fill('300')
    await page.getByTestId('bonus-times-input').fill('60')

    // Gamified LQ shows checkmark, non-gamified shows X
    await expect(
      page.getByTestId(`activity-batch-check-${BATCH.liveQuiz}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`activity-batch-x-${BATCH.liveQuiz2}`)
    ).toBeVisible()
    await page.getByTestId('apply-batch-operations').click()

    // Verify gamified LQ has new grading logic
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`actions-LIVE_QUIZ-${BATCH.liveQuiz}`).click()
    await page.getByTestId(`edit-live-quiz-${BATCH.liveQuiz}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('live-quiz-advanced-settings').click()
    await expect(page.getByTestId('live-quiz-default-points')).toHaveValue(
      '100'
    )
    await expect(
      page.getByTestId('live-quiz-default-correct-points')
    ).toHaveValue('200')
    await expect(page.getByTestId('live-quiz-max-bonus-points')).toHaveValue(
      '300'
    )
    await expect(page.getByTestId('live-quiz-time-to-zero-bonus')).toHaveValue(
      '60'
    )
    await page.getByTestId('live-quiz-advanced-settings-close').click()

    // Non-gamified LQ should not have advanced settings
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`actions-LIVE_QUIZ-${BATCH.liveQuiz2}`).click()
    await page.getByTestId(`edit-live-quiz-${BATCH.liveQuiz2}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await expect(
      page.getByTestId('live-quiz-advanced-settings')
    ).not.toBeVisible()
  })

  test('Verify that combination of multiplier change and course re-assignment works', async ({
    page,
  }) => {
    await page.getByTestId('activities').click()
    await page.waitForTimeout(500)

    // Select non-gamified activities and group activity
    await page.getByTestId(`activity-checkbox-${BATCH.liveQuiz2}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.practiceQuiz2}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.microLearning2}`).click()
    await page.getByTestId(`activity-checkbox-${BATCH.groupActivity}`).click()
    await page.getByTestId('activity-batch-operations').click()

    // Change multiplier to 4
    await page.getByTestId('multiplier-checkbox').click()
    await page.getByTestId('select-multiplier').click()
    await page.getByText(MULTIPLIER_4).click()

    // Assign to course2 (gamified)
    await page.getByTestId('course-checkbox').click()
    await page.getByTestId('select-course').click()
    await page.getByText(BATCH.course2).click()

    for (const title of [
      BATCH.liveQuiz2,
      BATCH.practiceQuiz2,
      BATCH.microLearning2,
      BATCH.groupActivity,
    ]) {
      await expect(
        page.getByTestId(`activity-batch-check-${title}`)
      ).toBeVisible()
    }
    await page.getByTestId('apply-batch-operations').click()

    // Verify course and multiplier changed for all
    for (const [activityType, name, editTestId] of [
      ['LIVE_QUIZ', BATCH.liveQuiz2, `edit-live-quiz-${BATCH.liveQuiz2}`],
      [
        'PRACTICE_QUIZ',
        BATCH.practiceQuiz2,
        `edit-practice-quiz-${BATCH.practiceQuiz2}`,
      ],
      [
        'MICRO_LEARNING',
        BATCH.microLearning2,
        `edit-microlearning-${BATCH.microLearning2}`,
      ],
      [
        'GROUP_ACTIVITY',
        BATCH.groupActivity,
        `edit-group-activity-${BATCH.groupActivity}`,
      ],
    ] as [string, string, string][]) {
      await page.getByTestId('activities').click()
      await page.waitForTimeout(500)
      await page.getByTestId(`actions-${activityType}-${name}`).click()
      await page.getByTestId(editTestId).click()
      await page.getByTestId('next-or-submit').click()
      await page.getByTestId('next-or-submit').click()
      await expect(page.getByTestId('select-course')).toContainText(
        BATCH.course2
      )
      await expect(page.getByTestId('select-multiplier')).toContainText(
        MULTIPLIER_4
      )
    }
  })
})
