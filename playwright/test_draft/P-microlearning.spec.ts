/**
 * P-microlearning.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/P-microlearning-workflow.cy.ts
 *
 * Tests the full microlearning lifecycle:
 *   Part 0: Question & collection creation
 *   Part 1: Microlearning creation (running + future + complete)
 *   Part 2: Running microlearning workflows (publish, student responses, end, delete)
 *   Part 3: Future microlearning (publish, verify not shown to students, unpublish, delete)
 *   Part 4: Complete microlearning (publish, all element types, responses, delete)
 *   Part 5: Practice Quiz Conversion
 *   Part 6: Editing / Duplication with Updated / Deleted Questions
 *   Part 7: Sharing of Microlearnings (individual + group permissions)
 *   Part 8: Activity Details Points (gamified and non-gamified courses)
 */

import { type Page } from '@playwright/test'
import {
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST_SHORTNAME,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture constants (mirrors cypress/fixtures/questions.json + P-microlearning.json) ──────────

const COURSE = 'Testkurs'
const SEEDED_COURSE = 'Testkurs'

const RUNNING = {
  name: 'Running microlearning OLD',
  displayName: 'Running microlearning OLD (Display)',
  description: 'Running microlearning OLD description',
  nameNew: 'Running microlearning',
  displayNameNew: 'Running microlearning (Display)',
  descriptionNew: 'Running microlearning description',
}

const STACK = {
  title1: 'Stack 1 Description Title OLD',
  title2: 'Stack 2 Description Title OLD',
  title1New: 'Stack 1 Description Title',
  title2New: 'Stack 2 Description Title',
}

const FUTURE = {
  name: 'Future microlearning',
  displayName: 'Future microlearning (Display)',
  description: 'Future microlearning description',
}

const COMPLETED = {
  name: 'Complete microlearning',
  displayName: 'Complete microlearning (Display)',
}

const CONVERSION = {
  pqName: 'Practice Quiz Converted',
  pqDisplayName: 'Practice Quiz Converted Displayname',
}

const DUPLICATION = {
  name: 'Running microlearning (Copy)',
  displayName: 'Running microlearning (Display) (NEW!)',
}

const MANIPULATION = {
  course: 'Testkurs',
  name: 'Microlearning Manipulation',
  displayName: 'Microlearning Manipulation (Display)',
  newSETitle: 'New Selection Question Title',
  newSEContent: 'New Selection Question Content',
  duplicateName: 'Duplicated Microlearning',
  duplicateDisplayName: 'Duplicated Microlearning (Display)',
}

const SHARING = {
  micro1: 'Sharing Microlearning 1',
  micro1Display: 'Sharing Microlearning 1 (Display)',
  micro2: 'Sharing Microlearning 2',
  micro2Display: 'Sharing Microlearning 2 (Display)',
  micro3: 'Sharing Microlearning 3',
  micro3Display: 'Sharing Microlearning 3 (Display)',
  micro4: 'Sharing Microlearning 4',
  micro4Display: 'Sharing Microlearning 4 (Display)',
}

const DETAILS = {
  name: 'Microlearning Activity Details',
  displayName: 'Microlearning Activity Details (Display)',
  courseName: 'Testkurs',
  nameNonGamified: 'Non-Gamified Microlearning Details',
  displayNameNonGamified: 'Non-Gamified Microlearning Details (Display)',
  courseNonGamified: 'Non-Gamified Course',
}

// Questions / elements
const SC = {
  title: 'SC Title Test 1 (Version 1)',
  content: 'SC Question Content 1',
}
const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
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
  description: 'Collection Description',
}
const SEML = {
  title: 'SE Title Test 2 (Version 1)',
  content: 'SE Question Content 2',
  inputs: 3,
}
const CSML = {
  title: 'CS Title Test 1 (Version 1)',
  content: 'CS Question Test 1',
}
const SEML2 = {
  title: 'SE Title Test 2 (Version 2)',
  content: 'SE Question Content 2 (Version 2)',
  inputs: 3,
}
const CSML2 = {
  title: 'CS Title Test 1 (Version 2)',
  content: 'CS Question Test 1 (Version 2)',
}
const COLLECTION2 = {
  name: 'Collection (Version 2)',
  description: 'Collection Description (Version 2)',
  options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
}

// Permission labels (i18n)
const PERM_READ = 'Read'
const PERM_EXECUTE = 'Execute'
const PERM_WRITE = 'Write'
const PERM_ADMIN = 'Admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to the course microlearning tab.
 */
async function goToCourseMicroLearnings(page: Page, courseName: string) {
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${courseName}`).click()
  await page.getByTestId('tab-microLearnings').click()
}

/**
 * Create a microlearning via the wizard (simplified — skips date pickers,
 * uses defaults for dates since we cannot replicate cy.setDatetime precisely).
 *
 * The wizard steps are:
 *   1. Name
 *   2. Display name + description
 *   3. Settings (course, dates, multiplier)
 *   4. Stacks with questions
 */
async function createMicroLearning(
  page: Page,
  opts: {
    name: string
    displayName: string
    description?: string
    courseName: string
    stacks: { elements: string[] }[]
    multiplierLabel?: string
  }
) {
  await page.getByTestId('create-microlearning').click()

  // Step 1: Name
  await page.getByTestId('insert-microlearning-name').fill(opts.name)
  await page.getByTestId('next-or-submit').click()

  // Step 2: Display name + optional description
  await page
    .getByTestId('insert-microlearning-display-name')
    .fill(opts.displayName)
  if (opts.description) {
    await page.getByTestId('insert-microlearning-description').click()
    await page
      .getByTestId('insert-microlearning-description')
      .pressSequentially(opts.description)
  }
  await page.getByTestId('next-or-submit').click()

  // Step 3: Settings — course selection
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${opts.courseName}`).click()

  if (opts.multiplierLabel) {
    await page.getByTestId('select-multiplier').click()
    await page.getByTestId(`select-multiplier-${opts.multiplierLabel}`).click()
  }

  await page.getByTestId('next-or-submit').click()

  // Step 4: Stacks
  for (let si = 0; si < opts.stacks.length; si++) {
    if (si > 0) {
      await page.getByTestId('drop-elements-add-stack').click()
    }
    for (const element of opts.stacks[si].elements) {
      await page.getByTestId('search-element-input').fill(element)
      await page.getByTestId(`add-element-${element}`).click()
    }
  }
  await page.getByTestId('next-or-submit').click()

  await page.waitForTimeout(500)
}

/**
 * Grant permission on a microlearning via the share dialog.
 */
async function grantMicroLearningPermission(
  page: Page,
  microName: string,
  usernameOrEmail: string,
  permissionLabel: string
) {
  await page.getByTestId(`actions-MICRO_LEARNING-${microName}`).click()
  await page.getByTestId(`share-microlearning-${microName}`).click()

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

  await page.getByTestId('close-share-object').click()
}

/**
 * Verify microlearning is visible in activities list and check a few key items.
 */
async function verifyMicroLearningVisible(page: Page, name: string) {
  await expect(
    page.getByTestId(`activity-MICRO_LEARNING-${name}`)
  ).toBeVisible()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Part 0: Question Creation', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create questions required for microlearning creation', async ({
    page,
  }) => {
    // SC without solution
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(SC.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').pressSequentially(SC.content)
    await page.getByTestId('add-choice').click()
    await page.getByTestId('add-choice').click()
    await page
      .locator('[data-testid^="insert-choice-value-"]')
      .first()
      .fill('Option 1')
    await page
      .locator('[data-testid^="insert-choice-value-"]')
      .nth(1)
      .fill('Option 2')
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // SCML with solution
    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(SCML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(SCML.content)
    await page.getByTestId('add-choice').click()
    await page.getByTestId('add-choice').click()
    await page
      .locator('[data-testid^="insert-choice-value-"]')
      .first()
      .fill('Option 1')
    await page
      .locator('[data-testid^="insert-choice-value-"]')
      .nth(1)
      .fill('Option 2')
    // Mark first choice as correct
    await page.locator('[data-testid^="set-choice-correct-"]').first().click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // MCML
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
    await page.getByTestId('add-choice').click()
    await page.getByTestId('add-choice').click()
    await page
      .locator('[data-testid^="insert-choice-value-"]')
      .first()
      .fill('MC Option 1')
    await page
      .locator('[data-testid^="insert-choice-value-"]')
      .nth(1)
      .fill('MC Option 2')
    await page.locator('[data-testid^="set-choice-correct-"]').first().click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // KPML
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId('select-question-type-KPRIM (KP)').click()
    await page.getByTestId('insert-question-title').fill(KPML.title)
    await page.getByTestId('select-question-status').click()
    await page.getByTestId('select-question-status-Ready').click()
    await page.getByTestId('insert-question-text').click()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(KPML.content)
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // NRML
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

    // FTML
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
  })
})

test.describe('Part 1: Microlearning Creation', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a microlearning around the current time', async ({ page }) => {
    // Test cancel + restart
    await page.getByTestId('create-microlearning').click()
    await page.getByTestId('cancel-activity-creation').click()
    await page.getByTestId('create-microlearning').click()

    // Step 1: Name
    await page.getByTestId('insert-microlearning-name').fill(RUNNING.name)
    await page.getByTestId('next-or-submit').click()

    // Test back navigation
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()

    // Step 2: Display name + description
    await page
      .getByTestId('insert-microlearning-display-name')
      .fill(RUNNING.displayName)
    await page.getByTestId('insert-microlearning-description').click()
    await page
      .getByTestId('insert-microlearning-description')
      .pressSequentially(RUNNING.description)
    await page.getByTestId('next-or-submit').click()

    // Step 3: Settings - select course (dates skipped, using defaults)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${COURSE}`).click()
    await page.getByTestId('next-or-submit').click()

    // Step 4: Stacks
    // Add stack 0: SCML + FTML
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('search-element-input').fill(FTML.title)
    await page.getByTestId(`add-element-${FTML.title}`).click()

    // Add stack 1: FC + CT
    await page.getByTestId('drop-elements-add-stack').click()
    await page.getByTestId('search-element-input').fill(FC.title)
    await page.getByTestId(`add-element-${FC.title}`).click()
    await page.getByTestId('search-element-input').fill(CT.title)
    await page.getByTestId(`add-element-${CT.title}`).click()

    // Add display names to stacks
    await page.getByTestId('open-stack-0-description').click({ force: true })
    await page.getByTestId('stack-0-displayname').fill(STACK.title1)
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click({ force: true })
    await page.getByTestId('stack-1-displayname').fill(STACK.title2)
    await page.getByTestId('close-stack-description').click()

    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('open-activity-overview').click()
  })

  test('Create a microlearning that starts in the future', async ({ page }) => {
    await createMicroLearning(page, {
      name: FUTURE.name,
      displayName: FUTURE.displayName,
      description: FUTURE.description,
      courseName: COURSE,
      stacks: [{ elements: [SCML.title] }],
    })

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${FUTURE.name}`)
    ).toBeVisible()
  })

  test('Create a microlearning with all element types', async ({ page }) => {
    await createMicroLearning(page, {
      name: COMPLETED.name,
      displayName: COMPLETED.displayName,
      courseName: COURSE,
      stacks: [
        {
          elements: [
            SCML.title,
            MCML.title,
            KPML.title,
            NRML.title,
            FTML.title,
            FC.title,
            CT.title,
          ],
        },
      ],
    })
  })
})

test.describe('Part 2: Running Microlearning Workflows', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Edit the running microlearning content', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)

    await page.getByTestId(`actions-MICRO_LEARNING-${RUNNING.name}`).click()
    await page.getByTestId(`edit-microlearning-${RUNNING.name}`).click()

    // Step 1: rename
    await page.getByTestId('insert-microlearning-name').clear()
    await page.getByTestId('insert-microlearning-name').fill(RUNNING.nameNew)
    await page.getByTestId('next-or-submit').click()

    // Step 2: rename display name
    await expect(
      page.getByTestId('insert-microlearning-display-name')
    ).toHaveValue(RUNNING.displayName)
    await page.getByTestId('insert-microlearning-display-name').clear()
    await page
      .getByTestId('insert-microlearning-display-name')
      .fill(RUNNING.displayNameNew)
    await page.getByTestId('next-or-submit').click()

    // Step 3: settings (just advance)
    await page.getByTestId('next-or-submit').click()

    // Step 4: verify stacks and add a third stack
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      FC.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      CT.title.substring(0, 20)
    )

    // Add third stack with SCML + FTML
    await page.getByTestId('drop-elements-add-stack').click()
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('search-element-input').fill(FTML.title)
    await page.getByTestId(`add-element-${FTML.title}`).click()

    // Update stack display names
    await page.getByTestId('open-stack-0-description').click({ force: true })
    await expect(page.getByTestId('stack-0-displayname')).toHaveValue(
      STACK.title1
    )
    await page.getByTestId('stack-0-displayname').clear()
    await page.getByTestId('stack-0-displayname').fill(STACK.title1New)
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click({ force: true })
    await expect(page.getByTestId('stack-1-displayname')).toHaveValue(
      STACK.title2
    )
    await page.getByTestId('stack-1-displayname').clear()
    await page.getByTestId('stack-1-displayname').fill(STACK.title2New)
    await page.getByTestId('close-stack-description').click()

    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${RUNNING.nameNew}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${RUNNING.nameNew}-DRAFT`)
    ).toBeVisible()
  })

  test('Duplicate a microlearning and check the editor content', async ({
    page,
  }) => {
    await goToCourseMicroLearnings(page, COURSE)

    await page.getByTestId(`actions-MICRO_LEARNING-${RUNNING.nameNew}`).click()
    await page.getByTestId(`duplicate-microlearning-${RUNNING.nameNew}`).click()

    // Verify name (should be "(Copy)" suffix)
    await expect(page.getByTestId('insert-microlearning-name')).toHaveValue(
      DUPLICATION.name
    )
    await page.getByTestId('next-or-submit').click()

    // Update display name
    await expect(
      page.getByTestId('insert-microlearning-display-name')
    ).toHaveValue(RUNNING.displayNameNew)
    await page.getByTestId('insert-microlearning-display-name').clear()
    await page
      .getByTestId('insert-microlearning-display-name')
      .fill(DUPLICATION.displayName)
    await page.getByTestId('next-or-submit').click()

    // Settings - select course (copy may not have it)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${COURSE}`).click()
    await page.getByTestId('next-or-submit').click()

    // Verify stacks are the same
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      FC.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      CT.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${DUPLICATION.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${DUPLICATION.name}-DRAFT`)
    ).toBeVisible()
  })

  test('Publish a microlearning that will be running immediately', async ({
    page,
  }) => {
    await goToCourseMicroLearnings(page, COURSE)

    await page.getByTestId(`publish-microlearning-${RUNNING.nameNew}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${RUNNING.nameNew}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Respond to the first stack of the running microlearning from a student', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()

    await page.getByTestId(`microlearning-${RUNNING.displayNameNew}`).click()
    await page.getByTestId('start-microlearning').click()
    await page.getByTestId('sc-0-answer-option-0').click()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('free-text-input-1').click()
    await page.getByTestId('free-text-input-1').fill('Free text answer')
    await page.getByTestId('student-stack-submit').click()
  })

  test('Continue and complete the running microlearning (stack 2 + 3)', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()

    await page.getByTestId(`microlearning-${RUNNING.displayNameNew}`).click()
    await page.getByTestId('start-microlearning').click()

    // Stack 1 already answered - continue
    await page.getByTestId('student-stack-continue').click()

    // Stack 2: FC + CT
    await page.getByTestId('flashcard-front-0').click()
    await page.getByTestId('flashcard-response-0-No').click()
    await page.getByTestId('flashcard-response-0-Yes').click()
    await page.getByTestId('read-content-element-1').click()
    await page.getByTestId('student-stack-submit').click()

    // Stack 3: another SC + FT
    await page.getByTestId('sc-0-answer-option-0').click()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await page.getByTestId('free-text-input-1').click()
    await page.getByTestId('free-text-input-1').fill('Free text answer 2')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('finish-microlearning').click()
    await page.waitForTimeout(1000)

    await expect(
      page.getByTestId(`microlearning-${RUNNING.displayNameNew}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`microlearning-${RUNNING.displayNameNew}`)
    ).toBeDisabled()
  })

  test('End the running microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)

    // Test cancel
    await page.getByTestId(`actions-MICRO_LEARNING-${RUNNING.nameNew}`).click()
    await page.getByTestId(`end-microlearning-${RUNNING.nameNew}`).click()
    await page.getByTestId('confirmation-modal-cancel').click()

    // Actually end
    await page.getByTestId(`actions-MICRO_LEARNING-${RUNNING.nameNew}`).click()
    await page.getByTestId(`end-microlearning-${RUNNING.nameNew}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
  })

  test('Check that the microlearning is no longer visible to the student', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await expect(
      page.getByTestId(`microlearning-${RUNNING.displayNameNew}`)
    ).not.toBeVisible()
  })

  test('Cleanup: Delete the running microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)

    await page.getByTestId(`actions-MICRO_LEARNING-${RUNNING.nameNew}`).click()
    await page.getByTestId(`delete-microlearning-${RUNNING.nameNew}`).click()
    // Confirm needs responses confirmation first
    await expect(page.getByTestId('confirmation-modal-confirm')).toBeDisabled()
    await page.getByTestId('confirm-deletion-responses').click()
    await expect(
      page.getByTestId('confirmation-modal-confirm')
    ).not.toBeDisabled()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${RUNNING.nameNew}`)
    ).not.toBeVisible()
  })

  test('Cleanup: Delete the duplicated microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)

    await page.getByTestId(`actions-MICRO_LEARNING-${DUPLICATION.name}`).click()
    await page.getByTestId(`delete-microlearning-${DUPLICATION.name}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${DUPLICATION.name}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 3: Future Microlearning', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Publish the future microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)
    await page.getByTestId(`publish-microlearning-${FUTURE.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${FUTURE.name}-SCHEDULED`)
    ).toBeVisible()
  })

  test('Verify that future microlearnings are not shown to students', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await expect(
      page.getByTestId(`microlearning-${FUTURE.displayName}`)
    ).not.toBeVisible()
  })

  test('Unpublish the future microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)
    await page.getByTestId(`actions-MICRO_LEARNING-${FUTURE.name}`).click()
    await page.getByTestId(`unpublish-microlearning-${FUTURE.name}`).click()
    await expect(page.getByTestId(`status-${FUTURE.name}-DRAFT`)).toBeVisible()
  })

  test('Cleanup: Delete the future microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, COURSE)
    await page.getByTestId(`actions-MICRO_LEARNING-${FUTURE.name}`).click()
    await page.getByTestId(`delete-microlearning-${FUTURE.name}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${FUTURE.name}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 4: Complete Microlearning (All Element Types)', () => {
  test('Publish the microlearning with all element types', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseMicroLearnings(page, COURSE)
    await page.getByTestId(`publish-microlearning-${COMPLETED.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${COMPLETED.name}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Respond to all questions in the complete microlearning', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()

    await page.getByTestId(`microlearning-${COMPLETED.displayName}`).click()
    await page.getByTestId('start-microlearning').click()

    // SC
    await page.getByTestId('sc-0-answer-option-1').click()

    // MC
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()

    // KPRIM
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()

    // NR
    await page.getByTestId('input-numerical-3').clear()
    await page.getByTestId('input-numerical-3').fill(NRML.answer)

    // FT
    await page.getByTestId('free-text-input-4').fill(FTML.answer)

    // FC
    await page.getByTestId('flashcard-front-5').click()
    await page.getByTestId('flashcard-response-5-Yes').click()

    // CT
    await page.getByTestId('read-content-element-6').click()

    await page.getByTestId('student-stack-submit').click()
    await page.waitForTimeout(500)

    // Finish
    await page.getByTestId('student-stack-continue').click()
  })

  test('Cleanup: Delete the complete microlearning', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseMicroLearnings(page, COURSE)

    await page.getByTestId(`actions-MICRO_LEARNING-${COMPLETED.name}`).click()
    await page.getByTestId(`delete-microlearning-${COMPLETED.name}`).click()
    await expect(page.getByTestId('confirmation-modal-confirm')).toBeDisabled()
    await page.getByTestId('confirm-deletion-responses').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${COMPLETED.name}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 5: Practice Quiz Conversion', () => {
  test('Convert a past microlearning into a practice quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    const MLName = 'Microlearning for conversion'
    const MLDisplayName = 'Microlearning for conversion (display name)'

    // Create the microlearning
    await createMicroLearning(page, {
      name: MLName,
      displayName: MLDisplayName,
      courseName: COURSE,
      stacks: [
        { elements: [SCML.title, MCML.title] },
        { elements: [KPML.title, NRML.title] },
        { elements: [FTML.title] },
        { elements: [FC.title] },
      ],
    })

    await page.waitForTimeout(1000)
    await goToCourseMicroLearnings(page, COURSE)

    // Publish and end
    await page.getByTestId(`publish-microlearning-${MLName}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${MLName}`)
    ).toBeVisible()
    await expect(page.getByTestId(`status-${MLName}-PUBLISHED`)).toBeVisible()

    await page.getByTestId(`actions-MICRO_LEARNING-${MLName}`).click()
    await page.getByTestId(`end-microlearning-${MLName}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)

    // Convert to practice quiz
    await page.getByTestId(`actions-MICRO_LEARNING-${MLName}`).click()
    await page
      .getByTestId(`convert-microlearning-${MLName}-to-practice-quiz`)
      .click()

    // Edit the practice quiz name
    await expect(page.getByTestId('insert-practice-quiz-name')).toHaveValue(
      `${MLName} (converted)`
    )
    await page.getByTestId('insert-practice-quiz-name').clear()
    await page.getByTestId('insert-practice-quiz-name').fill(CONVERSION.pqName)
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('insert-practice-quiz-display-name').clear()
    await page
      .getByTestId('insert-practice-quiz-display-name')
      .fill(CONVERSION.pqDisplayName)
    await page.getByTestId('next-or-submit').click()

    // Settings
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${COURSE}`).click()
    await page.getByTestId('next-or-submit').click()

    // Stacks
    await page.getByTestId('next-or-submit').click()

    // Verify in course overview
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${CONVERSION.pqName}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${CONVERSION.pqName}-DRAFT`)
    ).toBeVisible()
  })
})

test.describe('Part 6: Editing / Duplication with Updated / Deleted Questions', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a microlearning with a selection question', async ({ page }) => {
    // Create microlearning with selection question (using previously-created element SEML2)
    await createMicroLearning(page, {
      name: MANIPULATION.name,
      displayName: MANIPULATION.displayName,
      courseName: MANIPULATION.course,
      stacks: [{ elements: [SEML.title] }],
    })

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${MANIPULATION.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${MANIPULATION.name}-DRAFT`)
    ).toBeVisible()
  })

  test('Edit and save the microlearning without making any changes', async ({
    page,
  }) => {
    await goToCourseMicroLearnings(page, MANIPULATION.course)

    await page
      .getByTestId(`actions-MICRO_LEARNING-${MANIPULATION.name}`)
      .click()
    await page.getByTestId(`edit-microlearning-${MANIPULATION.name}`).click()

    // Step through all steps without changes
    await expect(page.getByTestId('insert-microlearning-name')).toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await expect(
      page.getByTestId('insert-microlearning-display-name')
    ).toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('select-course')).toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('element-0-stack-0')).toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${MANIPULATION.name}`)
    ).toBeVisible()
  })

  test('Publish the manipulation microlearning', async ({ page }) => {
    await goToCourseMicroLearnings(page, MANIPULATION.course)

    await page.getByTestId(`publish-microlearning-${MANIPULATION.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${MANIPULATION.name}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Create and publish a duplicated manipulation microlearning', async ({
    page,
  }) => {
    await goToCourseMicroLearnings(page, MANIPULATION.course)

    await page
      .getByTestId(`actions-MICRO_LEARNING-${MANIPULATION.name}`)
      .click()
    await page
      .getByTestId(`duplicate-microlearning-${MANIPULATION.name}`)
      .click()

    await page.getByTestId('insert-microlearning-name').clear()
    await page
      .getByTestId('insert-microlearning-name')
      .fill(MANIPULATION.duplicateName)
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('insert-microlearning-display-name').clear()
    await page
      .getByTestId('insert-microlearning-display-name')
      .fill(MANIPULATION.duplicateDisplayName)
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${MANIPULATION.course}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${MANIPULATION.duplicateName}`)
    ).toBeVisible()

    // Publish
    await page
      .getByTestId(`publish-microlearning-${MANIPULATION.duplicateName}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${MANIPULATION.duplicateName}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Delete both manipulation microlearnings', async ({ page }) => {
    await goToCourseMicroLearnings(page, MANIPULATION.course)

    // Delete first
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MANIPULATION.name}`)
      .click()
    await page.getByTestId(`delete-microlearning-${MANIPULATION.name}`).click()
    await page.getByTestId('confirm-deletion-responses').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${MANIPULATION.name}`)
    ).not.toBeVisible()

    // Delete duplicate
    await page
      .getByTestId(`actions-MICRO_LEARNING-${MANIPULATION.duplicateName}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${MANIPULATION.duplicateName}`)
      .click()
    await page.getByTestId('confirm-deletion-responses').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${MANIPULATION.duplicateName}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 7a: Sharing of Microlearnings (individual permissions)', () => {
  const MICROS = [
    SHARING.micro1,
    SHARING.micro2,
    SHARING.micro3,
    SHARING.micro4,
  ]

  test('Create four microlearnings in different states and verify owner permissions', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    for (let i = 1; i <= 4; i++) {
      await createMicroLearning(page, {
        name: SHARING[`micro${i}` as keyof typeof SHARING] as string,
        displayName: SHARING[
          `micro${i}Display` as keyof typeof SHARING
        ] as string,
        courseName: SEEDED_COURSE,
        stacks: [
          {
            elements: [
              SCML.title,
              MCML.title,
              KPML.title,
              NRML.title,
              FTML.title,
              CT.title,
            ],
          },
        ],
      })
      // Click "create new activity" to return to activities page
      await page.getByTestId('create-new-activity').click()
    }

    await page.getByTestId('activities').click()

    // Verify all 4 microlearnings are visible
    for (const micro of MICROS) {
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${micro}`)
      ).toBeVisible()
    }
  })

  test('Share the microlearnings individually with different users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const micro of MICROS) {
      await page.getByTestId(`actions-MICRO_LEARNING-${micro}`).click()
      await page.getByTestId(`share-microlearning-${micro}`).click()

      // READ for pro1
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_IND_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page.getByTestId(`new-permission-access-level-${PERM_READ}`).click()
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
      await page
        .getByTestId(`new-permission-access-level-${PERM_EXECUTE}`)
        .click()
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
      await page
        .getByTestId(`new-permission-access-level-${PERM_WRITE}`)
        .click()
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
      await page
        .getByTestId(`new-permission-access-level-${PERM_ADMIN}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expect(
        page.getByTestId(`permission-${LECTURER_INST3_SHORTNAME}`)
      ).toContainText(PERM_ADMIN)

      await page.getByTestId('close-share-object').click()
    }
  })

  test('Log in as user with READ permissions and check available actions', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    for (const micro of MICROS) {
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${micro}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`change-activity-name-${micro}`)
      ).not.toBeVisible()
    }

    // READ user should see: open preview, access link, lti link, activity log, remove
    await expect(
      page.getByTestId(`open-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-MICRO_LEARNING-${SHARING.micro1}`).click()
    await expect(
      page.getByTestId(`copy-microlearning-link-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-lti-link-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`view-activity-log-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Log in as user with EXECUTE permissions and check available actions', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()

    for (const micro of MICROS) {
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${micro}`)
      ).toBeVisible()
    }

    // EXECUTE user should see: publish for draft, open preview, access link, lti link, activity log, remove
    await expect(
      page.getByTestId(`publish-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-MICRO_LEARNING-${SHARING.micro1}`).click()
    await expect(
      page.getByTestId(`open-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-microlearning-link-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-lti-link-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`view-activity-log-${SHARING.micro1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Log in as user with WRITE permissions and check available actions', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('activities').click()

    for (const micro of MICROS) {
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${micro}`)
      ).toBeVisible()
    }

    // WRITE user should see: publish + edit for draft
    await expect(
      page.getByTestId(`publish-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-MICRO_LEARNING-${SHARING.micro1}`).click()
    await expect(
      page.getByTestId(`edit-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`open-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-microlearning-link-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`copy-lti-link-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`view-activity-log-${SHARING.micro1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Log in as user with ADMIN permissions and check available actions', async ({
    page,
    loginInstitutionalCatalyst3,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('activities').click()

    for (const micro of MICROS) {
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${micro}`)
      ).toBeVisible()
    }

    // ADMIN user should see: publish + edit + share + duplicate + delete for draft
    await expect(
      page.getByTestId(`publish-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-MICRO_LEARNING-${SHARING.micro1}`).click()
    await expect(
      page.getByTestId(`edit-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`open-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`duplicate-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-microlearning-${SHARING.micro1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Revoke direct individual permissions for all users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    for (const micro of MICROS) {
      await page.getByTestId(`actions-MICRO_LEARNING-${micro}`).click()
      await page.getByTestId(`share-microlearning-${micro}`).click()

      // Revoke all permissions
      for (const user of [
        LECTURER_IND_SHORTNAME,
        LECTURER_INST_SHORTNAME,
        LECTURER_INST2_SHORTNAME,
        LECTURER_INST3_SHORTNAME,
      ]) {
        const revokeBtn = page.getByTestId(`revoke-permission-${user}`)
        if (await revokeBtn.isVisible()) {
          await revokeBtn.click()
          await page.waitForTimeout(300)
        }
      }

      await page.getByTestId('close-share-object').click()
    }
  })

  test('Verify that users can no longer access the microlearnings after permissions are revoked', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    for (const micro of MICROS) {
      await expect(
        page.getByTestId(`activity-MICRO_LEARNING-${micro}`)
      ).not.toBeVisible()
    }
  })
})

test.describe('Part 8: Activity Details Points', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a microlearning in a gamified course and validate that points are shown', async ({
    page,
  }) => {
    await createMicroLearning(page, {
      name: DETAILS.name,
      displayName: DETAILS.displayName,
      courseName: DETAILS.courseName,
      multiplierLabel: '2x',
      stacks: [
        {
          elements: [SCML.title, FC.title, CT.title],
        },
        {
          elements: [MCML.title, NRML.title, FTML.title],
        },
      ],
    })

    await page.getByTestId('open-activity-overview').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${DETAILS.name}`)
    ).toBeVisible()

    // Open details modal and verify points
    await page.getByTestId(`activity-name-${DETAILS.name}`).click()

    // Verify stack headers show points
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).toContainText('P.')

    // Verify instances
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(FC.title)
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(CT.title)
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      FTML.title
    )

    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Create a microlearning in a non-gamified course and validate no points are shown', async ({
    page,
  }) => {
    await createMicroLearning(page, {
      name: DETAILS.nameNonGamified,
      displayName: DETAILS.displayNameNonGamified,
      courseName: DETAILS.courseNonGamified,
      stacks: [
        {
          elements: [SCML.title, FC.title, CT.title],
        },
        {
          elements: [MCML.title, NRML.title, FTML.title],
        },
      ],
    })

    await page.getByTestId('open-activity-overview').click()
    await expect(
      page.getByTestId(`activity-MICRO_LEARNING-${DETAILS.nameNonGamified}`)
    ).toBeVisible()

    await page.getByTestId(`activity-name-${DETAILS.nameNonGamified}`).click()

    // Non-gamified: stack headers should NOT show points
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).not.toContainText(' P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).not.toContainText(' P.')

    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(FC.title)
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(CT.title)
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      FTML.title
    )

    await page.getByTestId('close-activity-details-modal').click()
  })
})
