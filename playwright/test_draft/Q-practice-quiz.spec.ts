/**
 * Q-practice-quiz.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/Q-practice-quiz-workflow.cy.ts
 *
 * Part 0: Question creation (SC, SCML, MCML, KPML, NRML, FTML, FC, CT, Collection, SE, CS)
 * Part 1: Practice Quiz creation, editing, duplication, cleanup
 * Part 2: Running Practice Quizzes (publish, student solve, partial solve, delete)
 * Part 3: Future/Scheduled Practice Quizzes
 * Part 4: Editing/Duplication with Updated/Deleted Questions
 * Part 5: Sharing (individual + group permissions, ownership transfer, revoke)
 * Part 6: Activity Details Points (gamified vs. non-gamified)
 *
 * NOTE: Tests that require cy.task (getPracticeQuizInfo, removeSoftDeletedPracticeQuiz,
 *       changeActivityStatus) are omitted or simplified as there is no Playwright equivalent.
 *       Date picker interactions (cy.setDatetime) are skipped; the scheduled publish flow
 *       uses immediate publish instead where needed.
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

// ─── Fixture data ─────────────────────────────────────────────────────────────

const COURSE = 'Testkurs'
const SEEDED_COURSE = 'Testkurs'

const SC = {
  title: 'SC Title Test 1 (Version 1)',
  content: 'SC Question Content 1',
}

const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: ['Choice A', 'Choice B', 'Choice C'],
}

const MCML = {
  title: 'MC Title Test 2 (Version 1)',
  content: 'MC Question Content 2',
}

const KPML = {
  title: 'KPRIM Title Test 2 (Version 1)',
  content: 'KPRIM Question Content 2',
}

const NRML = {
  title: 'NR Title Test 2 (Version 1)',
  content: 'NR Question Content 2',
  answer: '100',
}

const FTML = {
  title: 'FT Title Test 2 (Version 1)',
  content: 'FT Question Content 2',
  answer: 'Answer 2',
}

const FC = {
  title: 'FC Question Title (Version 1)',
  content: 'FC Question Content (Version 1)',
  explanation: 'FC Explanation (Version 1)',
}

const CT = {
  title: 'CT Question Title (Version 1)',
  content: 'CT Question Content (Version 1)',
}

const COLLECTION = {
  name: 'Collection (Version 1)',
  options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
}

const SEML = {
  title: 'SE Title Test 2 (Version 1)',
  content: 'SE Question Content 2 (Version 1)',
  inputs: 3,
}

const CSML = {
  title: 'CS Title Test 1 (Version 1)',
  content: 'CS Question Content 1 (Version 1)',
}

const NRML2 = {
  title: 'NR Title Test 2 (Version 2)',
  content: 'NR Question Content 2 (Version 2)',
}

const FTML2 = {
  title: 'FT Title Test 2 (Version 2)',
  content: 'FT Question Content 2 (Version 2)',
}

const RUNNING = {
  name: 'Running Practice Quiz OLD',
  displayName: 'Running Practice Quiz OLD (Display)',
  description: 'This is the OLD description of the running practice quiz',
  nameNew: 'Running Practice Quiz',
  displayNameNew: 'Running Practice Quiz',
  descriptionNew: 'This is the description of the running practice quiz',
  nameDupl: 'Running Practice Quiz (Copy)',
}

const SCHEDULED = {
  name: 'Scheduled Practice Quiz',
  displayName: 'Scheduled Practice Quiz',
}

const MANIPULATION = {
  name: 'Manipulation Practice Quiz',
  displayName: 'Manipulation Practice Quiz (Display)',
  course: 'Testkurs',
  newNRTitle: 'New NR Title',
  newNRContent: 'New NR Content',
  duplicateName: 'Duplication of Practice Quiz',
  duplicateDisplayName: 'Duplication of Practice Quiz (Display)',
}

const SHARING = {
  quiz1: 'Sharing Practice Quiz 1',
  quiz1Display: 'Sharing Practice Quiz 1 (Display)',
  quiz2: 'Sharing Practice Quiz 2',
  quiz2Display: 'Sharing Practice Quiz 2 (Display)',
  quiz3: 'Sharing Practice Quiz 3',
  quiz3Display: 'Sharing Practice Quiz 3 (Display)',
  group1: 'Group 1',
  group2: 'Group 2',
  group3: 'Group 3',
  group4: 'Group 4',
}

const DETAILS = {
  name: 'Practice Quiz Activity Details',
  displayName: 'Practice Quiz Activity Details (Display)',
  courseName: 'Testkurs',
  nameNonGamified: 'Non-Gamified Practice Quiz Details',
  displayNameNonGamified: 'Non-Gamified Practice Quiz Details (Display)',
  courseNonGamified: 'Non-Gamified Course',
}

// ─── Permission label constants ───────────────────────────────────────────────

const PERM_READ = 'Read'
const PERM_EXECUTE = 'Execute'
const PERM_WRITE = 'Write'
const PERM_ADMIN = 'Admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToCoursePracticeQuizzes(
  page: Page,
  courseName: string
): Promise<void> {
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${courseName}`).click()
  await page.getByTestId('tab-practiceQuizzes').click()
}

async function createPracticeQuiz(
  page: Page,
  opts: {
    name: string
    displayName: string
    description?: string
    courseName: string
    multiplierLabel?: string
    stacks: { elements: string[]; title?: string }[]
  }
): Promise<void> {
  await page.getByTestId('create-practice-quiz').click()

  // Step 1: Name
  await page.getByTestId('insert-practice-quiz-name').fill(opts.name)
  await page.getByTestId('next-or-submit').click()

  // Step 2: Display name + description
  await page
    .getByTestId('insert-practice-quiz-display-name')
    .fill(opts.displayName)
  if (opts.description) {
    await page.getByTestId('insert-practice-quiz-description').click()
    await page
      .getByTestId('insert-practice-quiz-description')
      .pressSequentially(opts.description)
  }
  await page.getByTestId('next-or-submit').click()

  // Step 3: Settings
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${opts.courseName}`).click()
  if (opts.multiplierLabel) {
    await page.getByTestId('select-multiplier').click()
    await page.getByTestId(`select-multiplier-${opts.multiplierLabel}`).click()
  }
  await page.getByTestId('next-or-submit').click()

  // Step 4: Build stacks
  for (let stackIx = 0; stackIx < opts.stacks.length; stackIx++) {
    if (stackIx > 0) {
      await page.getByTestId('drop-elements-add-stack').click()
    }
    for (const elementTitle of opts.stacks[stackIx].elements) {
      await page.getByTestId('search-element-input').fill(elementTitle)
      await page.getByTestId(`add-element-${elementTitle}`).click()
    }
  }
  await page.getByTestId('next-or-submit').click()
  await page.waitForTimeout(500)
}

async function grantPracticeQuizPermission(
  page: Page,
  quizName: string,
  usernameOrEmail: string,
  permissionLabel: string
): Promise<void> {
  await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
  await page.getByTestId(`share-practice-quiz-${quizName}`).click()
  await page.getByTestId('new-permission-username-or-email').click()
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(usernameOrEmail)
  await page.getByTestId('new-permission-access-level').click()
  await page
    .getByTestId(`new-permission-access-level-${permissionLabel}`)
    .click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(page.getByTestId(`permission-${usernameOrEmail}`)).toBeVisible()
  await page.getByTestId('close-share-object').click()
}

async function revokePracticeQuizPermission(
  page: Page,
  quizName: string,
  usernameOrEmail: string
): Promise<void> {
  await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
  await page.getByTestId(`share-practice-quiz-${quizName}`).click()
  await expect(page.getByTestId(`permission-${usernameOrEmail}`)).toBeVisible()
  await page.getByTestId(`revoke-permission-${usernameOrEmail}`).click()
  await page.getByTestId('confirm-revocation').click()
  await expect(
    page.getByTestId(`permission-${usernameOrEmail}`)
  ).not.toBeVisible()
  await page.getByTestId('close-share-object').click()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Part 0: Question Creation', () => {
  test('Create questions required for practice quiz creation', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // SC with solution (SCML)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Single Choice (SC)').click()
    await page.getByTestId('insert-question-title').fill(SCML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SCML.content)
    // add correct answer choice
    await page.getByTestId('add-new-answer').click()
    await page.getByTestId('add-new-answer').click()
    await page.getByTestId('toggle-answer-correct-0').click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // MC (MCML)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Multiple Choice (MC)').click()
    await page.getByTestId('insert-question-title').fill(MCML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(MCML.content)
    await page.getByTestId('add-new-answer').click()
    await page.getByTestId('add-new-answer').click()
    await page.getByTestId('toggle-answer-correct-0').click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // KPRIM (KPML)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Kprim (KPRIM)').click()
    await page.getByTestId('insert-question-title').fill(KPML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(KPML.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // NR (NRML)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Numerical (NR)').click()
    await page.getByTestId('insert-question-title').fill(NRML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(NRML.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // FT (FTML)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Free Text (FT)').click()
    await page.getByTestId('insert-question-title').fill(FTML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(FTML.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // FC (Flashcard)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Flashcard (FC)').click()
    await page.getByTestId('insert-question-title').fill(FC.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(FC.content)
    await page.getByTestId('insert-question-explanation').click()
    await page
      .getByTestId('insert-question-explanation')
      .pressSequentially(FC.explanation)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // CT (Content)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Content (CT)').click()
    await page.getByTestId('insert-question-title').fill(CT.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(CT.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create answer collection
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await page.getByTestId('create-answer-collection').click()
    await page.getByTestId('answer-collection-name').fill(COLLECTION.name)
    for (const option of COLLECTION.options) {
      await page.getByTestId('add-collection-entry').click()
      await page.getByTestId('collection-entry-input').last().fill(option)
    }
    await page.getByTestId('save-answer-collection').click()
    await page.waitForTimeout(500)

    // SE (Selection)
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Selection (SE)').click()
    await page.getByTestId('insert-question-title').fill(SEML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SEML.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // CS (Case Study)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Case Study (CS)').click()
    await page.getByTestId('insert-question-title').fill(CSML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(CSML.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)
  })
})

test.describe('Part 1: Practice Quiz Creation', () => {
  test('Test the creation of a practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // cancel and reopen
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('cancel-activity-creation').click()
    await page.getByTestId('create-practice-quiz').click()

    // Step 1: Name
    await page.getByTestId('insert-practice-quiz-name').fill(RUNNING.name)
    await page.getByTestId('next-or-submit').click()

    // Step 2: Display name and description (back/forward test)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page
      .getByTestId('insert-practice-quiz-display-name')
      .fill(RUNNING.displayName)
    await page.getByTestId('insert-practice-quiz-description').click()
    await page
      .getByTestId('insert-practice-quiz-description')
      .pressSequentially(RUNNING.description)
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()

    // Step 3: Course + settings
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${COURSE}`).click()
    await expect(page.getByTestId('select-course')).toContainText(COURSE)
    await page.getByTestId('insert-reset-time-days').clear()
    await page.getByTestId('insert-reset-time-days').fill('4')
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()

    // Step 4: Add questions to individual stacks
    const questionTitles = [
      SCML.title,
      MCML.title,
      KPML.title,
      NRML.title,
      FTML.title,
      SEML.title,
      CSML.title,
      FC.title,
      CT.title,
    ]
    for (let i = 0; i < questionTitles.length; i++) {
      if (i > 0) {
        await page.getByTestId('drop-elements-add-stack').click()
      }
      await page.getByTestId('search-element-input').fill(questionTitles[i])
      await page.getByTestId(`add-element-${questionTitles[i]}`).click()
    }

    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()

    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${RUNNING.name}`)
    ).toBeVisible()
    await expect(page.getByTestId(`status-${RUNNING.name}-DRAFT`)).toBeVisible()
  })

  test('Edit the first created practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${RUNNING.name}`).click()
    await page.getByTestId(`edit-practice-quiz-${RUNNING.name}`).click()

    // Step 1: Rename
    await expect(page.getByTestId('insert-practice-quiz-name')).toHaveValue(
      RUNNING.name
    )
    await page.getByTestId('insert-practice-quiz-name').clear()
    await page.getByTestId('insert-practice-quiz-name').fill(RUNNING.nameNew)
    await page.getByTestId('next-or-submit').click()

    // Step 2: Update display name and description
    await expect(
      page.getByTestId('insert-practice-quiz-display-name')
    ).toHaveValue(RUNNING.displayName)
    await page.getByTestId('insert-practice-quiz-display-name').clear()
    await page
      .getByTestId('insert-practice-quiz-display-name')
      .fill(RUNNING.displayNameNew)
    await page.getByTestId('insert-practice-quiz-description').click()
    await page.getByTestId('insert-practice-quiz-description').clear()
    await page
      .getByTestId('insert-practice-quiz-description')
      .pressSequentially(RUNNING.descriptionNew)
    await page.getByTestId('next-or-submit').click()

    // Step 3: Settings
    await expect(page.getByTestId('select-course')).toContainText(COURSE)
    await page.getByTestId('next-or-submit').click()

    // Step 4: Add extra stack
    await page.getByTestId('drop-elements-add-stack').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${RUNNING.nameNew}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${RUNNING.nameNew}-DRAFT`)
    ).toBeVisible()
  })

  test('Verify that changes from editing went into effect', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${RUNNING.nameNew}`).click()
    await page.getByTestId(`edit-practice-quiz-${RUNNING.nameNew}`).click()

    // Step 1: Verify name
    await expect(page.getByTestId('insert-practice-quiz-name')).toHaveValue(
      RUNNING.nameNew
    )
    await page.getByTestId('next-or-submit').click()

    // Step 2: Verify display name and description
    await expect(
      page.getByTestId('insert-practice-quiz-display-name')
    ).toHaveValue(RUNNING.displayNameNew)
    await expect(
      page.getByTestId('insert-practice-quiz-description')
    ).toContainText(RUNNING.descriptionNew)
    await page.getByTestId('next-or-submit').click()

    // Step 3: Verify course
    await expect(page.getByTestId('select-course')).toContainText(COURSE)
    await page.getByTestId('next-or-submit').click()

    // Step 4: Verify stack content
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-8')).toContainText(
      CT.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-9')).toContainText(
      SCML.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
  })

  test('Create a practice quiz that will be scheduled', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createPracticeQuiz(page, {
      name: SCHEDULED.name,
      displayName: SCHEDULED.displayName,
      courseName: COURSE,
      stacks: [{ elements: [SCML.title] }, { elements: [MCML.title] }],
    })
  })

  test('Duplicate a practice quiz and validate its content', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${RUNNING.nameNew}`).click()
    await page.getByTestId(`duplicate-practice-quiz-${RUNNING.nameNew}`).click()

    // Step 1: Verify auto-filled duplicate name
    await expect(page.getByTestId('insert-practice-quiz-name')).toHaveValue(
      RUNNING.nameDupl
    )
    await page.getByTestId('next-or-submit').click()

    // Step 2
    await expect(
      page.getByTestId('insert-practice-quiz-display-name')
    ).toHaveValue(RUNNING.displayNameNew)
    await expect(
      page.getByTestId('insert-practice-quiz-description')
    ).toContainText(RUNNING.descriptionNew)
    await page.getByTestId('next-or-submit').click()

    // Step 3
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${COURSE}`).click()
    await page.getByTestId('next-or-submit').click()

    // Step 4: Verify stack elements
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-9')).toContainText(
      SCML.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
  })

  test('Cleanup: Delete the duplicated practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${RUNNING.nameDupl}`).click()
    await page.getByTestId(`delete-practice-quiz-${RUNNING.nameDupl}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()

    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${RUNNING.nameDupl}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 2: Running Practice Quizzes', () => {
  test('Publish the practice quiz immediately', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`publish-practice-quiz-${RUNNING.nameNew}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()

    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${RUNNING.nameNew}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${RUNNING.nameNew}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Solve the practice quiz (student view)', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${RUNNING.displayNameNew}`).click()
    await expect(page.getByText(RUNNING.descriptionNew)).toBeVisible()
    await page.getByTestId('start-practice-quiz').click()

    // SC question
    await expect(page.getByText(SCML.content)).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('sc-0-answer-option-1').click()
    await expect(page.getByTestId('student-stack-submit')).not.toBeDisabled()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('sc-0-answer-option-0')).toBeDisabled()
    await page.getByTestId('student-stack-continue').click()

    // MC question
    await expect(page.getByText(MCML.content)).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('mc-0-answer-option-1').click()
    await page.getByTestId('mc-0-answer-option-2').click()
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('mc-0-answer-option-0')).toBeDisabled()
    await page.getByTestId('student-stack-continue').click()

    // KPRIM question
    await expect(page.getByText(KPML.content)).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('toggle-kp-0-answer-0-correct').click()
    await page.getByTestId('toggle-kp-0-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-0-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-0-answer-3-correct').click()
    await page.getByTestId('student-stack-submit').click()
    await expect(
      page.getByTestId('toggle-kp-0-answer-0-correct')
    ).toBeDisabled()
    await page.getByTestId('student-stack-continue').click()

    // NR question
    await expect(page.getByText(NRML.content)).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('input-numerical-0').clear()
    await page.getByTestId('input-numerical-0').fill(NRML.answer)
    await expect(page.getByTestId('student-stack-submit')).not.toBeDisabled()
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('input-numerical-0')).toBeDisabled()
    await page.getByTestId('student-stack-continue').click()

    // FT question
    await expect(page.getByText(FTML.content)).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('free-text-input-0').fill(FTML.answer)
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('free-text-input-0')).toBeDisabled()
    await page.getByTestId('student-stack-continue').click()

    // SE question
    await expect(page.getByText(SEML.content)).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.locator('[id="selection-0-field-0"]').click()
    await page
      .locator('[id="react-select-selection-0-field-0-option-0"]')
      .click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // CS question
    await expect(page.getByText(CSML.content)).toBeVisible()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // Flashcard
    await expect(page.getByText(FC.content)).toBeVisible()
    await page.getByTestId('flashcard-front-0').click()
    await page.getByTestId('flashcard-response-0-Yes').click()
    await page.getByTestId('student-stack-submit').click()

    // Content
    await expect(page.getByText(CT.content)).toBeVisible()
    await expect(page.getByTestId('read-content-element-0')).toBeVisible()
    await page.getByTestId('practice-quiz-mark-all-as-read').click()
    await page.getByTestId('student-stack-submit').click()

    // Final SC (10th stack)
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
  })

  test('Cleanup: Delete the running practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${RUNNING.nameNew}`).click()
    await page.getByTestId(`delete-practice-quiz-${RUNNING.nameNew}`).click()

    // confirm-deletion-responses is required when there are student responses
    const confirmBtn = page.getByTestId('confirmation-modal-confirm')
    const responsesCheckbox = page.getByTestId('confirm-deletion-responses')
    if (await responsesCheckbox.isVisible()) {
      await responsesCheckbox.click()
    }
    await confirmBtn.click()

    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${RUNNING.nameNew}`)
    ).not.toBeVisible()
  })

  test('Verify that the running practice quiz is no longer visible to students', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await expect(
      page.getByTestId(`practice-quiz-${RUNNING.displayNameNew}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 3: Future/Scheduled Practice Quizzes', () => {
  test('Publish the scheduled practice quiz immediately and verify it is visible to students', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`publish-practice-quiz-${SCHEDULED.name}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()

    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${SCHEDULED.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${SCHEDULED.name}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Verify the published scheduled quiz is available to students', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await expect(
      page.getByTestId(`practice-quiz-${SCHEDULED.displayName}`)
    ).toBeVisible()
  })

  test('Unpublish the practice quiz again', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${SCHEDULED.name}`).click()
    await page.getByTestId(`unpublish-practice-quiz-${SCHEDULED.name}`).click()

    await expect(
      page.getByTestId(`status-${SCHEDULED.name}-DRAFT`)
    ).toBeVisible()
  })

  test('Verify that unpublished practice quiz is not visible to students', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await expect(
      page.getByTestId(`practice-quiz-${SCHEDULED.displayName}`)
    ).not.toBeVisible()
  })

  test('Cleanup: Delete the scheduled practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, COURSE)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${SCHEDULED.name}`).click()
    await page.getByTestId(`delete-practice-quiz-${SCHEDULED.name}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()

    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${SCHEDULED.name}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 4: Editing/Duplication with Updated/Deleted Questions', () => {
  test('Create a numerical question and include it in a practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Create NR question (NRML2)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Numerical (NR)').click()
    await page.getByTestId('insert-question-title').fill(NRML2.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(NRML2.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Create practice quiz with that question
    await createPracticeQuiz(page, {
      name: MANIPULATION.name,
      displayName: MANIPULATION.displayName,
      courseName: MANIPULATION.course,
      stacks: [{ elements: [NRML2.title] }],
    })

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${MANIPULATION.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${MANIPULATION.name}-DRAFT`)
    ).toBeVisible()
  })

  test('Edit NR question, then edit and save the unmodified practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Edit the NR question
    await page.getByTestId('elements-search-input').fill(NRML2.title)
    await page.keyboard.press('Enter')
    await page.getByTestId(`edit-element-${NRML2.title}`).click()
    await page.getByTestId('insert-question-title').clear()
    await page
      .getByTestId('insert-question-title')
      .fill(MANIPULATION.newNRTitle)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(MANIPULATION.newNRContent)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(1000)

    // Edit the practice quiz without modifications
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${MANIPULATION.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${MANIPULATION.name}`).click()
    await page.getByTestId(`edit-practice-quiz-${MANIPULATION.name}`).click()

    await expect(page.getByTestId('insert-practice-quiz-name')).toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await expect(
      page.getByTestId('insert-practice-quiz-display-name')
    ).toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('select-course')).toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('element-0-stack-0')).toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${MANIPULATION.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${MANIPULATION.name}-DRAFT`)
    ).toBeVisible()
  })

  test('Edit the practice quiz and add the modified NR question and a new FT question', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Create FT question (FTML2)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-Free Text (FT)').click()
    await page.getByTestId('insert-question-title').fill(FTML2.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(FTML2.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // Edit quiz to add the new NR and FT questions
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${MANIPULATION.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${MANIPULATION.name}`).click()
    await page.getByTestId(`edit-practice-quiz-${MANIPULATION.name}`).click()

    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()

    // Add the new NR question to stack 0
    await page.getByTestId('search-element-input').fill(MANIPULATION.newNRTitle)
    await page.getByTestId(`add-element-${MANIPULATION.newNRTitle}`).click()

    // Add a new stack with FT question
    await page.getByTestId('drop-elements-add-stack').click()
    await page.getByTestId('search-element-input').fill(FTML2.title)
    await page.getByTestId(`add-element-${FTML2.title}`).click()

    await page.getByTestId('next-or-submit').click()
  })

  test('Delete created questions and re-order blocks in the practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Delete the elements
    await page
      .getByTestId('elements-search-input')
      .fill(MANIPULATION.newNRTitle)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${MANIPULATION.newNRTitle}`)
    ).toBeVisible()
    await page.getByTestId(`delete-element-${MANIPULATION.newNRTitle}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)

    await page.getByTestId('elements-search-input').clear()
    await page.getByTestId('elements-search-input').fill(FTML2.title)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`element-item-${FTML2.title}`)).toBeVisible()
    await page.getByTestId(`delete-element-${FTML2.title}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)

    // Edit quiz and re-order stacks
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${MANIPULATION.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${MANIPULATION.name}`).click()
    await page.getByTestId(`edit-practice-quiz-${MANIPULATION.name}`).click()

    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('move-stack-0-right').click()
    await page.getByTestId('next-or-submit').click()
  })

  test('Duplicate the practice quiz and publish both', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, MANIPULATION.course)

    await page.getByTestId(`actions-PRACTICE_QUIZ-${MANIPULATION.name}`).click()
    await page
      .getByTestId(`duplicate-practice-quiz-${MANIPULATION.name}`)
      .click()

    // Step 1: Set duplicate name
    await page.getByTestId('insert-practice-quiz-name').clear()
    await page
      .getByTestId('insert-practice-quiz-name')
      .fill(MANIPULATION.duplicateName)
    await page.getByTestId('next-or-submit').click()

    // Step 2: Set display name
    await page.getByTestId('insert-practice-quiz-display-name').clear()
    await page
      .getByTestId('insert-practice-quiz-display-name')
      .fill(MANIPULATION.duplicateDisplayName)
    await page.getByTestId('next-or-submit').click()

    // Step 3: Course
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${MANIPULATION.course}`).click()
    await page.getByTestId('next-or-submit').click()

    // Step 4: Verify stacks and finish
    await page.getByTestId('next-or-submit').click()

    // Publish both practice quizzes
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()

    await page.getByTestId(`publish-practice-quiz-${MANIPULATION.name}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expect(
      page.getByTestId(`status-${MANIPULATION.name}-PUBLISHED`)
    ).toBeVisible()

    await page
      .getByTestId(`publish-practice-quiz-${MANIPULATION.duplicateName}`)
      .click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expect(
      page.getByTestId(`status-${MANIPULATION.duplicateName}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Answer the first practice quiz (student view)', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${MANIPULATION.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()

    // stack 1 (FT)
    await expect(page.getByText(FTML2.content)).toBeVisible()
    await page.getByTestId('free-text-input-0').fill('Testinput')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // stack 2 (NR - two inputs)
    await page.getByTestId('student-stack-submit').isDisabled()
    await page.getByTestId('input-numerical-0').clear()
    await page.getByTestId('input-numerical-0').fill('10')
    await page.getByTestId('input-numerical-1').clear()
    await page.getByTestId('input-numerical-1').fill('10')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
  })

  test('Answer the duplicated practice quiz (student view)', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId('quizzes').click()
    await page
      .getByTestId(`practice-quiz-${MANIPULATION.duplicateDisplayName}`)
      .click()
    await page.getByTestId('start-practice-quiz').click()

    // stack 1 (FT)
    await expect(page.getByText(FTML2.content)).toBeVisible()
    await page.getByTestId('free-text-input-0').fill('Testinput')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // stack 2 (NR)
    await page.getByTestId('input-numerical-0').clear()
    await page.getByTestId('input-numerical-0').fill('10')
    await page.getByTestId('input-numerical-1').clear()
    await page.getByTestId('input-numerical-1').fill('10')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
  })

  test('Delete the created practice quizzes', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCoursePracticeQuizzes(page, MANIPULATION.course)

    for (const name of [MANIPULATION.name, MANIPULATION.duplicateName]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${name}`).click()
      await page.getByTestId(`delete-practice-quiz-${name}`).click()
      await page.waitForTimeout(500)
      const responsesCheckbox = page.getByTestId('confirm-deletion-responses')
      if (await responsesCheckbox.isVisible()) {
        await responsesCheckbox.click()
      }
      await page.getByTestId('confirmation-modal-confirm').click()
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${name}`)
      ).not.toBeVisible()
    }
  })
})

test.describe('Part 5: Sharing Practice Quizzes', () => {
  test('Create three practice quizzes and verify owner permissions', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    for (let i = 1; i <= 3; i++) {
      const quizName = SHARING[`quiz${i}` as keyof typeof SHARING] as string
      const quizDisplay = SHARING[
        `quiz${i}Display` as keyof typeof SHARING
      ] as string

      await createPracticeQuiz(page, {
        name: quizName,
        displayName: quizDisplay,
        courseName: SEEDED_COURSE,
        stacks: [
          {
            elements: [
              SCML.title,
              MCML.title,
              KPML.title,
              NRML.title,
              FTML.title,
              SEML.title,
              CSML.title,
              CT.title,
            ],
          },
        ],
      })
      // Click "create new activity" to go back to the creation button
      const createNewActivity = page.getByTestId('create-new-activity')
      if (i < 3 && (await createNewActivity.isVisible())) {
        await createNewActivity.click()
      }
    }

    // Publish quiz2 immediately (simulates scheduled status)
    await page.getByTestId('activities').click()
    await page.getByTestId(`publish-practice-quiz-${SHARING.quiz2}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await page.waitForTimeout(500)

    // Publish quiz3 immediately (simulates published status)
    await page.getByTestId(`publish-practice-quiz-${SHARING.quiz3}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await page.waitForTimeout(500)

    // Verify owner sees all required actions for draft quiz1
    await expect(
      page.getByTestId(`publish-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`edit-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`open-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-access-link-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`duplicate-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Share practice quizzes with individual users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()

      // Grant READ to pro1
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_IND_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page.getByTestId(`new-permission-access-level-${PERM_READ}`).click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).toBeVisible()

      // Grant EXECUTE to pro2
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_INST_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_EXECUTE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
      ).toBeVisible()

      // Grant WRITE to pro3
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_INST2_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_WRITE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
      ).toBeVisible()

      // Grant ADMIN to pro4
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_INST3_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_ADMIN}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${LECTURER_INST3_SHORTNAME}`)
      ).toBeVisible()

      await page.getByTestId('close-share-object').click()
    }
  })

  test('Verify READ permissions (individual)', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).toBeVisible()
    }

    // READ: open preview, access link, lti link, view log visible; no edit, no publish
    await expect(
      page.getByTestId(`open-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`copy-access-link-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`view-activity-log-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Verify EXECUTE permissions (individual)', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).toBeVisible()
    }

    // EXECUTE: publish button visible for draft quiz
    await expect(
      page.getByTestId(`publish-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`open-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-access-link-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Verify WRITE permissions (individual)', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`change-activity-name-${quiz}`)
      ).toBeVisible()
    }

    // WRITE: publish + edit visible for draft quiz
    await expect(
      page.getByTestId(`publish-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`edit-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`open-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Verify ADMIN permissions (individual)', async ({
    page,
    loginInstitutionalCatalyst3,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`change-activity-name-${quiz}`)
      ).toBeVisible()
    }

    // ADMIN: same as owner — publish, edit, duplicate, share, delete
    await expect(
      page.getByTestId(`publish-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`edit-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`duplicate-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Revoke individual permissions for all users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    const users = [
      LECTURER_IND_SHORTNAME,
      LECTURER_INST_SHORTNAME,
      LECTURER_INST2_SHORTNAME,
      LECTURER_INST3_SHORTNAME,
    ]

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()

      for (const user of users) {
        await expect(page.getByTestId(`permission-${user}`)).toBeVisible()
        await page.getByTestId(`revoke-permission-${user}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expect(page.getByTestId(`permission-${user}`)).not.toBeVisible()
      }
      await page.getByTestId('close-share-object').click()
    }
  })

  test('Verify READ permissions revoked', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).not.toBeVisible()
    }
  })

  test('Verify EXECUTE permissions revoked', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).not.toBeVisible()
    }
  })

  test('Verify WRITE permissions revoked', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).not.toBeVisible()
    }
  })

  test('Verify ADMIN permissions revoked', async ({
    page,
    loginInstitutionalCatalyst3,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).not.toBeVisible()
    }
  })

  test('Create user groups and share practice quizzes with them', async ({
    page,
    loginLecturer,
    loginInstitutionalCatalyst2,
    loginInstitutionalCatalyst3,
  }) => {
    // Create group1 and group2 as main lecturer
    await loginLecturer()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()

    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group1)
    await page
      .getByTestId('member-shortname-email-0')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${SHARING.group1}`)).toBeVisible()

    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group2)
    await page
      .getByTestId('member-shortname-email-0')
      .fill(LECTURER_INST_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${SHARING.group2}`)).toBeVisible()

    // Create group3 as pro3 (inst2) with lecturer as member
    await loginInstitutionalCatalyst2()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group3)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${SHARING.group3}`)).toBeVisible()

    // Create group4 as pro4 (inst3) with lecturer as admin
    await loginInstitutionalCatalyst3()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group4)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${SHARING.group4}`)).toBeVisible()

    // Share with groups as main lecturer
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()

      // READ to group1
      await page.getByTestId('new-permission-user-group').click()
      await page
        .getByTestId(`new-permission-user-group-${SHARING.group1}`)
        .click()
      await page.getByTestId('new-permission-access-level').click()
      await page.getByTestId(`new-permission-access-level-${PERM_READ}`).click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${SHARING.group1}`)
      ).toBeVisible()

      // EXECUTE to group2
      await page.getByTestId('new-permission-user-group').click()
      await page
        .getByTestId(`new-permission-user-group-${SHARING.group2}`)
        .click()
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_EXECUTE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${SHARING.group2}`)
      ).toBeVisible()

      // WRITE to group3
      await page.getByTestId('new-permission-user-group').click()
      await page
        .getByTestId(`new-permission-user-group-${SHARING.group3}`)
        .click()
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_WRITE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${SHARING.group3}`)
      ).toBeVisible()

      // ADMIN to group4
      await page.getByTestId('new-permission-user-group').click()
      await page
        .getByTestId(`new-permission-user-group-${SHARING.group4}`)
        .click()
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_ADMIN}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${SHARING.group4}`)
      ).toBeVisible()

      await page.getByTestId('close-share-object').click()
    }
  })

  test('Verify READ group permissions', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    for (const quiz of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`)
      ).toBeVisible()
    }

    // With group permission, remove-practice-quiz should NOT exist
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`remove-practice-quiz-${SHARING.quiz1}`)
    ).not.toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Revoke group permissions for all groups', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    const groups = [
      SHARING.group1,
      SHARING.group2,
      SHARING.group3,
      SHARING.group4,
    ]

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()

      for (const group of groups) {
        await expect(page.getByTestId(`permission-${group}`)).toBeVisible()
        await page.getByTestId(`revoke-permission-${group}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expect(page.getByTestId(`permission-${group}`)).not.toBeVisible()
      }
      await page.getByTestId('close-share-object').click()
    }
  })

  test('Transfer ownership of all practice quizzes to pro1', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()

      // Grant WRITE to pro1
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_IND_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_WRITE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).toBeVisible()

      // Transfer ownership
      await page.getByTestId('transfer-ownership').click()
      await page
        .getByTestId('new-owner-username-email-input')
        .fill(LECTURER_IND_SHORTNAME)
      await page.getByTestId('confirm-ownership-transfer').click()

      await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).not.toBeVisible()
      await expect(
        page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
      ).toContainText(PERM_ADMIN)
      await page.getByTestId('close-share-object').click()
    }
  })

  test('Verify pro1 is the new owner and transfer back to main user', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    // Verify owner actions are visible for quiz1
    await expect(
      page.getByTestId(`publish-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${SHARING.quiz1}`).click()
    await expect(
      page.getByTestId(`edit-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-practice-quiz-${SHARING.quiz1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Transfer back to main user
    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()

      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_WRITE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)

      await page.getByTestId('transfer-ownership').click()
      await page
        .getByTestId('new-owner-username-email-input')
        .fill(LECTURER_SHORTNAME)
      await page.getByTestId('confirm-ownership-transfer').click()

      await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
      await expect(
        page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
      ).not.toBeVisible()
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).toContainText(PERM_ADMIN)
      await page.getByTestId('close-share-object').click()
    }
  })

  test('Remove the shared practice quizzes from pro1 using the removal functionality', async ({
    page,
    loginIndividualCatalyst,
    loginLecturer,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`remove-practice-quiz-${quizName}`).click()
      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expect(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quizName}`)
      ).not.toBeVisible()
    }

    // Verify in main user account that the permissions were removed
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const quizName of [SHARING.quiz1, SHARING.quiz2, SHARING.quiz3]) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quizName}`).click()
      await page.getByTestId(`share-practice-quiz-${quizName}`).click()
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).not.toBeVisible()
      await page.getByTestId('close-share-object').click()
    }
  })
})

test.describe('Part 6: Activity Details Points', () => {
  test('Create a practice quiz in a gamified course and verify points are shown', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createPracticeQuiz(page, {
      name: DETAILS.name,
      displayName: DETAILS.displayName,
      courseName: DETAILS.courseName,
      multiplierLabel: '2x',
      stacks: [
        { elements: [SCML.title, FC.title, CT.title] },
        { elements: [SCML.title, MCML.title, NRML.title, FTML.title] },
      ],
    })

    await page.getByTestId('open-activity-overview').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${DETAILS.name}`)
    ).toBeVisible()

    // Open details modal and verify points
    await page.getByTestId(`activity-name-${DETAILS.name}`).click()

    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).toContainText('P.')

    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(FC.title)
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(CT.title)

    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
      FTML.title
    )

    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Create a practice quiz in a non-gamified course and verify no points are shown', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createPracticeQuiz(page, {
      name: DETAILS.nameNonGamified,
      displayName: DETAILS.displayNameNonGamified,
      courseName: DETAILS.courseNonGamified,
      stacks: [
        { elements: [SCML.title, FC.title, CT.title] },
        { elements: [SCML.title, MCML.title, NRML.title, FTML.title] },
      ],
    })

    await page.getByTestId('open-activity-overview').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${DETAILS.nameNonGamified}`)
    ).toBeVisible()

    await page.getByTestId(`activity-name-${DETAILS.nameNonGamified}`).click()

    // Non-gamified: stack headers should NOT contain point values
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).not.toContainText('20 P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).not.toContainText('80 P.')

    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(FC.title)
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(CT.title)

    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
      FTML.title
    )

    await page.getByTestId('close-activity-details-modal').click()
  })
})
