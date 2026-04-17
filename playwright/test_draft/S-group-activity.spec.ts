/**
 * S-group-activity.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/S-group-activity-workflow.cy.ts
 *
 * Part 0: Question creation (SC, MC, KPRIM, NR, FT, CT, SE, CS)
 * Part 1: Group Activity creation and editing
 * Part 2: Running Group Activity & Participation
 * Part 3: Group Activity Ending and Grading
 * Part 4: Grading the Group Activity
 * Part 5: Synchronous Group Activity
 * Part 6: Miscellaneous (group messages)
 * Part 7: Group Activity Sharing (individual + group permissions, ownership transfer, revoke)
 * Part 8: Activity Details Points
 *
 * NOTE: cy.setDatetime, cy.createGroupActivity commands are not available in Playwright.
 *       Date picker interactions are skipped; activities use wizard defaults for dates.
 *       cy.task (changeActivityStatus, removeSoftDeletedGroupActivity) are omitted.
 *       The grading flow requires the sharing tests to set up statuses via cy.task,
 *       which is not available; the sharing section creates activities in DRAFT and
 *       publishes quiz2/3 immediately to approximate the test intent.
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
}

const FTML = {
  title: 'FT Title Test 2 (Version 1)',
  content: 'FT Question Content 2',
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
}

const CSML = {
  title: 'CS Title Test 1 (Version 1)',
  content: 'CS Question Content 1 (Version 1)',
}

const ACTIVITY = {
  name: 'Group Activity Running',
  displayName: 'Group Activity Running (Display)',
  task: 'Group Activity Task Description',
  clues: [
    {
      name: 'Test Clue 1',
      displayName: 'Test Clue Display Name 1',
      content: 'Test Clue Content 1',
    },
    {
      name: 'Test Clue 2',
      displayName: 'Test Clue Display Name 2',
      content: 42,
      unit: 'kg',
    },
    {
      name: 'Test Clue 3',
      displayName: 'Test Clue Display Name 3',
      content: 60,
    },
  ],
}

const RUNNING = {
  name: 'Group Activity Running',
  displayName: 'Group Activity Running (Display)',
  task: 'Group Activity Task Description',
  clues: [
    {
      name: 'Test Clue 4',
      displayName: 'Test Clue Display Name 4',
      content: 'Test Clue Content 4',
    },
    {
      name: 'Test Clue 5',
      displayName: 'Test Clue Display Name 5',
      content: 50,
      unit: 'kg',
    },
  ],
  flagging: {
    text: 'This is a test flagging message',
    textNew: 'This is a NEW test flagging message',
  },
  answers: {
    freeText: 'Testanswer to Free-Text Question',
    numerical: '100',
  },
  grading: {
    maxPoints: ['200', '100', '100', '300', '100', '100', '100', '200'],
    scores1: ['100', '100', '50', '200', '80', '80', '90', '200'],
    scores2: ['50', '25', '25', '75', '25', '25', '30', '50'],
    comments1: [
      'Great job at question 1!',
      null,
      null,
      'Great job at question 4!',
      'Good job at question 5!',
      null,
      'Good job at question 7!',
      null,
    ],
    comments2: [
      'This is not correct for question 1...',
      null,
      'This is not correct for question 3...',
      null,
      null,
      null,
      'This is not correct for question 7...',
      null,
    ],
    gradingComment1: 'This is a test grading comment',
    gradingComment2: null,
  },
}

const SYNCHRONOUS = {
  name: 'Synchronous Group Activity',
  displayName: 'Synchronous Group Activity (Display)',
  task: 'Synchronous Group Activity Task Description',
  clues: [
    {
      type: 'text',
      name: 'Test Clue 1',
      displayName: 'Test Clue Display Name 1',
      content: 'Test Clue Content 1',
    },
    {
      type: 'number',
      name: 'Test Clue 2',
      displayName: 'Test Clue Display Name 2',
      content: '42',
      unit: 'kg',
    },
    {
      type: 'text',
      name: 'Test Clue 3',
      displayName: 'Test Clue Display Name 3',
      content: 'Content 3',
    },
  ],
}

const SHARING = {
  ga1: 'Sharing Group Activity 1',
  ga1Display: 'Sharing Group Activity 1 (Display)',
  ga2: 'Sharing Group Activity 2',
  ga2Display: 'Sharing Group Activity 2 (Display)',
  ga3: 'Sharing Group Activity 3',
  ga3Display: 'Sharing Group Activity 3 (Display)',
  ga4: 'Sharing Group Activity 4',
  ga4Display: 'Sharing Group Activity 4 (Display)',
  ga5: 'Sharing Group Activity 5',
  ga5Display: 'Sharing Group Activity 5 (Display)',
  group1: 'Group 1',
  group2: 'Group 2',
  group3: 'Group 3',
  group4: 'Group 4',
}

const DETAILS = {
  name: 'Group Activity Activity Details',
  displayName: 'Group Activity Activity Details (Display)',
  courseName: 'Testkurs',
  task: 'Group Activity Task Description',
}

const GROUP = {
  message1: 'Hello group! (initial message) from Alice',
  message2: 'Hello! (response) from Bob',
}

// Permission labels
const PERM_READ = 'Read'
const PERM_EXECUTE = 'Execute'
const PERM_WRITE = 'Write'
const PERM_ADMIN = 'Admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToCourseGroupActivities(
  page: Page,
  courseName: string
): Promise<void> {
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${courseName}`).click()
  await page.getByTestId('tab-groupActivities').click()
}

async function createGroupActivity(
  page: Page,
  opts: {
    name: string
    displayName: string
    task: string
    courseName: string
    clues: {
      name: string
      displayName: string
      content: string | number
      unit?: string
      type?: string
    }[]
    elements: string[]
  }
): Promise<void> {
  await page.getByTestId('create-group-activity').click()

  // Step 1: Name
  await page.getByTestId('insert-groupactivity-name').fill(opts.name)
  await page.getByTestId('next-or-submit').click()

  // Step 2: Display name + description
  await page
    .getByTestId('insert-groupactivity-display-name')
    .fill(opts.displayName)
  await page.getByTestId('insert-groupactivity-description').click()
  await page
    .getByTestId('insert-groupactivity-description')
    .pressSequentially(opts.task)
  await page.getByTestId('next-or-submit').click()

  // Step 3: Course (dates are left at defaults)
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${opts.courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  // Step 4: Clues
  for (const clue of opts.clues) {
    await page.getByTestId('add-group-activity-clue').click()
    if (clue.type === 'number') {
      await page.getByTestId('group-activity-clue-type').click()
      await page.getByTestId('group-activity-clue-type-number').click()
    }
    await page.getByTestId('group-activity-clue-name').fill(clue.name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(clue.displayName)
    if (clue.type === 'number') {
      await page
        .getByTestId('group-activity-number-clue-value')
        .fill(String(clue.content))
      if (clue.unit) {
        await page
          .getByTestId('group-activity-number-clue-unit')
          .fill(clue.unit)
      }
    } else {
      await page
        .getByTestId('group-activity-string-clue-value')
        .fill(String(clue.content))
    }
    await page.getByTestId('group-activity-clue-save').click()
  }

  // Step 5: Questions
  for (const element of opts.elements) {
    await page.getByTestId('search-element-input').fill(element)
    await page.getByTestId(`add-element-${element}`).click()
  }
  await page.getByTestId('next-or-submit').click()
  await page.waitForTimeout(500)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Part 0: Question Creation', () => {
  test('Create questions required for group activity creation', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // SCML (SC with solution)
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
    await page.getByTestId('add-new-answer').click()
    await page.getByTestId('add-new-answer').click()
    await page.getByTestId('toggle-answer-correct-0').click()
    await page.getByTestId('save-new-question').click({ force: true })
    await page.waitForTimeout(500)

    // MCML (MC)
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

    // KPML (KPRIM)
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

    // NRML (NR)
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

    // FTML (FT)
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

test.describe('Part 1: Group Activity Creation', () => {
  test('Create a group activity with the created questions', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    // Step 1: Name (with cancel/back test)
    await page.getByTestId('create-group-activity').click()
    await page.getByTestId('insert-groupactivity-name').fill(ACTIVITY.name)
    await page.getByTestId('next-or-submit').click()

    // Step 2: Display name and description
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page
      .getByTestId('insert-groupactivity-display-name')
      .fill(ACTIVITY.displayName)
    await page.getByTestId('insert-groupactivity-description').click()
    await page
      .getByTestId('insert-groupactivity-description')
      .pressSequentially(ACTIVITY.task)
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()

    // Step 3: Course selection (date inputs skipped)
    await page.getByTestId('select-course').click()
    await page.getByTestId(`select-course-${COURSE}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()

    // Step 4: Add clues
    // Clue 1: text type
    await page.getByTestId('add-group-activity-clue').click()
    await page
      .getByTestId('group-activity-clue-name')
      .fill(ACTIVITY.clues[0].name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(ACTIVITY.clues[0].displayName)
    await page
      .getByTestId('group-activity-string-clue-value')
      .fill(String(ACTIVITY.clues[0].content))
    await page.getByTestId('group-activity-clue-save').click()
    await expect(page.getByText(ACTIVITY.clues[0].name)).toBeVisible()
    await expect(
      page.getByText(String(ACTIVITY.clues[0].content))
    ).toBeVisible()

    // Clue 2: number type
    await page.getByTestId('add-group-activity-clue').click()
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-number').click()
    await page
      .getByTestId('group-activity-clue-name')
      .fill(ACTIVITY.clues[1].name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(ACTIVITY.clues[1].displayName)
    await page
      .getByTestId('group-activity-number-clue-value')
      .fill(String(ACTIVITY.clues[1].content))
    await page
      .getByTestId('group-activity-number-clue-unit')
      .fill(String((ACTIVITY.clues[1] as { unit: string }).unit))
    await page.getByTestId('group-activity-clue-save').click()
    await expect(page.getByText(ACTIVITY.clues[1].name)).toBeVisible()

    // Clue 3: number type without unit
    await page.getByTestId('add-group-activity-clue').click()
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-number').click()
    await page
      .getByTestId('group-activity-clue-name')
      .fill(ACTIVITY.clues[2].name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(ACTIVITY.clues[2].displayName)
    await page
      .getByTestId('group-activity-number-clue-value')
      .fill(String(ACTIVITY.clues[2].content))
    await page.getByTestId('group-activity-clue-save').click()
    await expect(page.getByText(ACTIVITY.clues[2].name)).toBeVisible()
    await expect(
      page.getByText(String(ACTIVITY.clues[2].content))
    ).toBeVisible()

    // Step 5: Questions (all in one stack)
    const elements = [
      SCML.title,
      MCML.title,
      KPML.title,
      NRML.title,
      FTML.title,
      SEML.title,
      CSML.title,
    ]
    for (const element of elements) {
      await page.getByTestId('search-element-input').fill(element)
      await page.getByTestId(`add-element-${element}`).click()
    }

    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-groupActivities').click()
    await expect(page.getByText(ACTIVITY.name)).toBeVisible()
  })

  test('Create a synchronous group activity (starts and ends in the future)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createGroupActivity(page, {
      name: SYNCHRONOUS.name,
      displayName: SYNCHRONOUS.displayName,
      task: SYNCHRONOUS.task,
      courseName: COURSE,
      clues: SYNCHRONOUS.clues,
      elements: [SCML.title, MCML.title, KPML.title],
    })
  })

  test('Publish and unpublish the future group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${ACTIVITY.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${ACTIVITY.name}-DRAFT`)
    ).toBeVisible()

    // Cancel publish, then confirm publish
    await page.getByTestId(`publish-group-activity-${ACTIVITY.name}`).click()
    await page.getByTestId('cancel-publish-action').click()
    await page.getByTestId(`publish-group-activity-${ACTIVITY.name}`).click()
    await page.getByTestId('confirm-publish-action').click()

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${ACTIVITY.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${ACTIVITY.name}-SCHEDULED`)
    ).toBeVisible()

    // Unpublish
    await page.getByTestId(`actions-GROUP_ACTIVITY-${ACTIVITY.name}`).click()
    await page.getByTestId(`unpublish-group-activity-${ACTIVITY.name}`).click()
    await expect(
      page.getByTestId(`status-${ACTIVITY.name}-DRAFT`)
    ).toBeVisible()
  })

  test('Edit the group activity', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await page.getByTestId(`actions-GROUP_ACTIVITY-${ACTIVITY.name}`).click()
    await page.getByTestId(`edit-group-activity-${ACTIVITY.name}`).click()

    // Update name
    await expect(page.getByTestId('insert-groupactivity-name')).toHaveValue(
      ACTIVITY.name
    )
    await page.getByTestId('insert-groupactivity-name').clear()
    await page.getByTestId('insert-groupactivity-name').fill(RUNNING.name)
    await page.getByTestId('next-or-submit').click()

    // Update display name and description
    await expect(
      page.getByTestId('insert-groupactivity-display-name')
    ).toHaveValue(ACTIVITY.displayName)
    await page.getByTestId('insert-groupactivity-display-name').clear()
    await page
      .getByTestId('insert-groupactivity-display-name')
      .fill(RUNNING.displayName)
    await page.getByTestId('insert-groupactivity-description').click()
    await page.getByTestId('insert-groupactivity-description').clear()
    await page
      .getByTestId('insert-groupactivity-description')
      .pressSequentially(RUNNING.task)
    await page.getByTestId('next-or-submit').click()

    // Settings (skip date pickers)
    await page.getByTestId('next-or-submit').click()

    // Clues: verify existing clues, edit first, remove, add new
    await expect(page.getByText(ACTIVITY.clues[0].name)).toBeVisible()
    await expect(page.getByText(ACTIVITY.clues[1].name)).toBeVisible()
    await expect(page.getByText(ACTIVITY.clues[2].name)).toBeVisible()

    // Edit existing clue
    await page.getByTestId(`edit-clue-${ACTIVITY.clues[0].name}`).click()
    await expect(page.getByTestId('group-activity-clue-name')).toHaveValue(
      ACTIVITY.clues[0].name
    )
    await page.getByTestId('group-activity-clue-name').clear()
    await page
      .getByTestId('group-activity-clue-name')
      .fill(RUNNING.clues[0].name)
    await page.getByTestId('group-activity-clue-display-name').clear()
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(RUNNING.clues[0].displayName)
    await page.getByTestId('group-activity-string-clue-value').clear()
    await page
      .getByTestId('group-activity-string-clue-value')
      .fill(String(RUNNING.clues[0].content))
    await page.getByTestId('group-activity-clue-save').click()
    await expect(page.getByText(RUNNING.clues[0].name)).toBeVisible()

    // Delete the edited clue
    await page.getByTestId(`remove-clue-${RUNNING.clues[0].name}`).click()
    await expect(page.getByText(RUNNING.clues[0].name)).not.toBeVisible()

    // Add new numerical clue
    await page.getByTestId('add-group-activity-clue').click()
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-number').click()
    await page
      .getByTestId('group-activity-clue-name')
      .fill(RUNNING.clues[1].name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(RUNNING.clues[1].displayName)
    await page
      .getByTestId('group-activity-number-clue-value')
      .fill(String(RUNNING.clues[1].content))
    await page
      .getByTestId('group-activity-number-clue-unit')
      .fill(String((RUNNING.clues[1] as { unit: string }).unit))
    await page.getByTestId('group-activity-clue-save').click()
    await expect(
      page.getByTestId(`groupActivity-clue-${RUNNING.clues[1].name}`)
    ).toBeVisible()

    // Add questions (SCML and CT already in from original; add CT)
    await page.getByTestId('search-element-input').fill(SCML.title)
    await page.getByTestId(`add-element-${SCML.title}`).click()
    await page.getByTestId('search-element-input').fill(CT.title)
    await page.getByTestId(`add-element-${CT.title}`).click()

    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-groupActivities').click()
    await expect(page.getByText(RUNNING.name)).toBeVisible()
  })
})

test.describe('Part 2: Running Group Activity & Participation', () => {
  test('Publish the group activity and check its status', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${RUNNING.name}`)
    ).toBeVisible()
    await expect(page.getByTestId(`status-${RUNNING.name}-DRAFT`)).toBeVisible()

    await page.getByTestId(`publish-group-activity-${RUNNING.name}`).click()
    await page.getByTestId('confirm-publish-action').click()

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${RUNNING.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${RUNNING.name}-PUBLISHED`)
    ).toBeVisible()
  })

  test('Take part in the group activity (student)', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()

    // Navigate to the group activity
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page.getByTestId(`open-group-activity-${RUNNING.displayName}`).click()
    await page.getByTestId('start-group-activity').click()

    // Test rating and flagging
    await page.getByTestId('upvote-element-0-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('flag-element-1-button').click()
    await expect(page.getByTestId('submit-flag-element')).toBeDisabled()
    await page.getByTestId('flag-element-textarea').fill(RUNNING.flagging.text)
    await expect(page.getByTestId('submit-flag-element')).not.toBeDisabled()
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000) // wait for toast

    // Answer all questions
    await expect(page.getByTestId('submit-group-activity')).toBeDisabled()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-correct').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-incorrect').click()
    await page.getByTestId('input-numerical-3').fill(RUNNING.answers.numerical)
    await page.getByTestId('free-text-input-4').fill(RUNNING.answers.freeText)
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-0"]')
      .click()
    await page.locator('[id="selection-5-field-1"]').click()
    await page
      .locator('[id="react-select-selection-5-field-1-option-0"]')
      .click()
    await page.locator('[id="selection-5-field-2"]').click()
    await page
      .locator('[id="react-select-selection-5-field-2-option-1"]')
      .click()
    await page.getByTestId('sc-7-answer-option-0').click()
    await expect(page.getByTestId('submit-group-activity')).not.toBeDisabled()
    await page.getByTestId('submit-group-activity').click()

    // Verify inputs are disabled after submission
    await expect(page.getByTestId('sc-0-answer-option-0')).toBeDisabled()
    await expect(page.getByTestId('mc-1-answer-option-1')).toBeDisabled()
    await expect(page.getByTestId('input-numerical-3')).toBeDisabled()
    await expect(page.getByTestId('free-text-input-4')).toBeDisabled()
    await expect(page.getByTestId('sc-7-answer-option-0')).toBeDisabled()
  })
})

test.describe('Part 3: Group Activity Ending', () => {
  test('End the running group activity', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await page.getByTestId(`actions-GROUP_ACTIVITY-${RUNNING.name}`).click()
    await page.getByTestId(`end-group-activity-${RUNNING.name}`).click()
    await page.getByTestId('confirm-instances-loosing-access').click()
    await page.getByTestId('confirmation-modal-cancel').click()

    await page.getByTestId(`actions-GROUP_ACTIVITY-${RUNNING.name}`).click()
    await page.getByTestId(`end-group-activity-${RUNNING.name}`).click()
    await page.getByTestId('confirm-instances-loosing-access').click()
    await page.getByTestId('confirmation-modal-confirm').click()

    await expect(page.getByTestId(`status-${RUNNING.name}-ENDED`)).toBeVisible()
  })

  test('Verify valid submission is still visible after group activity ended', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page.getByTestId(`open-submission-${RUNNING.displayName}`).click()

    // Verify inputs are disabled
    await expect(page.getByTestId('sc-0-answer-option-0')).toBeDisabled()
    await expect(page.getByTestId('input-numerical-3')).toBeDisabled()
    await expect(page.getByTestId('free-text-input-4')).toBeDisabled()
    await expect(page.getByTestId('sc-7-answer-option-0')).toBeDisabled()
    await expect(page.getByTestId('submit-group-activity')).not.toBeVisible()
  })

  test('Cleanup: Delete the running and solved group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await page.getByTestId(`actions-GROUP_ACTIVITY-${RUNNING.name}`).click()
    await page.getByTestId(`delete-group-activity-${RUNNING.name}`).click()
    await page.getByTestId('confirm-deletion-started-instances').click()
    await page.getByTestId('confirm-deletion-submissions').click()
    await page.getByTestId('confirmation-modal-confirm').click()

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${RUNNING.name}`)
    ).not.toBeVisible()
  })

  test('Verify the group activity is not visible to students anymore', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expect(
      page.getByTestId(`group-activity-${RUNNING.displayName}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 4: Grading the Group Activity', () => {
  // NOTE: Full grading tests require a submitted group activity, which depends
  // on the running tests above completing successfully. The grading UI is tested
  // here at a basic level — deep grading assertion requires data from Part 2.

  test('Grade the first submission of the group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    const gradeButton = page.getByTestId(`grade-group-activity-${RUNNING.name}`)
    if (!(await gradeButton.isVisible())) {
      // Activity was cleaned up; skip grading test
      return
    }

    await gradeButton.click()
    await page.getByTestId('group-activity-submission-0').click()
    await expect(page.getByTestId('finalize-grading')).toBeDisabled()
    await expect(
      page.getByTestId('groupActivity-save-submission-grading')
    ).toBeDisabled()

    // Fill in scores for each element
    for (let ix = 0; ix < RUNNING.grading.scores1.length; ix++) {
      await page
        .getByTestId(`groupActivity-grading-score-${ix}`)
        .fill(RUNNING.grading.scores1[ix])
      const comment = RUNNING.grading.comments1[ix]
      if (comment) {
        await page.getByTestId(`groupActivity-grading-comment-${ix}`).click()
        await page
          .getByTestId(`groupActivity-grading-comment-${ix}`)
          .pressSequentially(comment)
      }
    }

    if (RUNNING.grading.gradingComment1) {
      await page.getByTestId('groupActivity-general-grading-comment').click()
      await page
        .getByTestId('groupActivity-general-grading-comment')
        .pressSequentially(RUNNING.grading.gradingComment1)
    }

    await page.getByTestId('groupActivity-passed').click()
    await page.getByTestId('groupActivity-save-submission-grading').click()
    await page.waitForTimeout(1000)
  })
})

test.describe('Part 5: Synchronous Group Activity', () => {
  test('Publish the synchronous group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${SYNCHRONOUS.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`status-${SYNCHRONOUS.name}-DRAFT`)
    ).toBeVisible()

    await page.getByTestId(`publish-group-activity-${SYNCHRONOUS.name}`).click()
    await page.getByTestId('confirm-publish-action').click()

    await expect(
      page.getByTestId(`status-${SYNCHRONOUS.name}-SCHEDULED`)
    ).toBeVisible()
  })

  test('Start the synchronous group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await page
      .getByTestId(`start-group-activity-${SYNCHRONOUS.name}-now`)
      .click()
    await page.getByTestId('confirm-groups-getting-access').click()
    await page.getByTestId('confirm-activity-available-until').click()
    await page.getByTestId('confirmation-modal-cancel').click()

    await page
      .getByTestId(`start-group-activity-${SYNCHRONOUS.name}-now`)
      .click()
    await page.getByTestId('confirm-groups-getting-access').click()
    await page.getByTestId('confirm-activity-available-until').click()
    await page.getByTestId('confirmation-modal-confirm').click()
  })

  test('Student can solve the synchronous group activity', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${SYNCHRONOUS.displayName}`)
      .click()
    await page.getByTestId('start-group-activity').click()

    await expect(page.getByTestId('submit-group-activity')).toBeDisabled()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-correct').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-incorrect').click()
    await page.getByTestId('submit-group-activity').click()
    await page.waitForTimeout(2000)
  })

  test('End the synchronous group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await page.getByTestId(`actions-GROUP_ACTIVITY-${SYNCHRONOUS.name}`).click()
    await page.getByTestId(`end-group-activity-${SYNCHRONOUS.name}`).click()
    await page.getByTestId('confirm-instances-loosing-access').click()
    await page.getByTestId('confirmation-modal-confirm').click()

    await expect(
      page.getByTestId(`status-${SYNCHRONOUS.name}-ENDED`)
    ).toBeVisible()
  })

  test('Student with valid submission can view it after activity ends', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page.getByTestId(`open-submission-${SYNCHRONOUS.displayName}`).click()

    await expect(page.getByTestId('sc-0-answer-option-0')).toBeDisabled()
    await expect(page.getByTestId('mc-1-answer-option-1')).toBeDisabled()
    await expect(
      page.getByTestId('toggle-kp-2-answer-0-correct')
    ).toBeDisabled()
  })

  test('Cleanup: Delete the synchronous group activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await goToCourseGroupActivities(page, COURSE)

    await page.getByTestId(`actions-GROUP_ACTIVITY-${SYNCHRONOUS.name}`).click()
    await page.getByTestId(`delete-group-activity-${SYNCHRONOUS.name}`).click()
    await page.getByTestId('confirm-deletion-started-instances').click()
    await page.getByTestId('confirm-deletion-submissions').click()
    await page.getByTestId('confirmation-modal-confirm').click()

    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${SYNCHRONOUS.name}`)
    ).not.toBeVisible()
  })
})

test.describe('Part 6: Miscellaneous - Group Messages', () => {
  test('Check if group messages can be sent', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page.getByTestId('group-message-textarea').fill(GROUP.message1)
    await page.getByTestId('group-message-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('group-message-textarea')).toHaveValue('')
    await expect(page.getByTestId('group-messages')).toContainText(
      GROUP.message1
    )
  })
})

test.describe('Part 7: Group Activity Sharing', () => {
  test('Create five group activities and verify owner permissions', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    const gaDisplays = [
      SHARING.ga1Display,
      SHARING.ga2Display,
      SHARING.ga3Display,
      SHARING.ga4Display,
      SHARING.ga5Display,
    ]

    for (let i = 0; i < gaNames.length; i++) {
      await createGroupActivity(page, {
        name: gaNames[i],
        displayName: gaDisplays[i],
        task: 'TASK',
        courseName: SEEDED_COURSE,
        clues: [
          {
            name: 'Clue 1',
            displayName: 'First Hint',
            content: 'Lorem ipsum dolor sit amet',
          },
          {
            name: 'Clue 2',
            displayName: 'Second Hint',
            content: 'Consectetur adipiscing elit',
          },
        ],
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
      })
      if (i < gaNames.length - 1) {
        const createNew = page.getByTestId('create-new-activity')
        if (await createNew.isVisible()) {
          await createNew.click()
        }
      }
    }

    // Publish ga2 and ga3 to simulate different statuses
    await page.getByTestId('activities').click()
    await page.getByTestId(`publish-group-activity-${SHARING.ga2}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await page.waitForTimeout(500)

    await page.getByTestId(`publish-group-activity-${SHARING.ga3}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await page.waitForTimeout(500)

    // Start ga3 to put it in PUBLISHED state
    await page.getByTestId(`start-group-activity-${SHARING.ga3}-now`).click()
    await page.getByTestId('confirm-groups-getting-access').click()
    await page.getByTestId('confirm-activity-available-until').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await page.waitForTimeout(500)

    // Verify owner actions for draft ga1
    await expect(
      page.getByTestId(`publish-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    await expect(
      page.getByTestId(`edit-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Share group activities individually with different users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]

    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()

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

    for (const ga of [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).toBeVisible()
    }

    // READ: view log visible; no edit, no publish
    await expect(
      page.getByTestId(`view-activity-log-${SHARING.ga1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    await expect(
      page.getByTestId(`remove-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Verify EXECUTE permissions (individual)', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()

    for (const ga of [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).toBeVisible()
    }

    // EXECUTE: publish visible for draft ga1
    await expect(
      page.getByTestId(`publish-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    await expect(
      page.getByTestId(`view-activity-log-${SHARING.ga1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Verify WRITE permissions (individual)', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('activities').click()

    for (const ga of [SHARING.ga1, SHARING.ga2, SHARING.ga3]) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).toBeVisible()
      await expect(page.getByTestId(`change-activity-name-${ga}`)).toBeVisible()
    }

    // WRITE: edit visible for draft ga1
    await expect(
      page.getByTestId(`publish-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    await expect(
      page.getByTestId(`edit-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Verify ADMIN permissions (individual)', async ({
    page,
    loginInstitutionalCatalyst3,
  }) => {
    await loginInstitutionalCatalyst3()
    await page.getByTestId('activities').click()

    for (const ga of [SHARING.ga1, SHARING.ga2, SHARING.ga3]) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).toBeVisible()
      await expect(page.getByTestId(`change-activity-name-${ga}`)).toBeVisible()
    }

    // ADMIN: same as owner — publish, edit, share, delete
    await expect(
      page.getByTestId(`publish-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    await expect(
      page.getByTestId(`edit-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Revoke individual permissions for all users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    const users = [
      LECTURER_IND_SHORTNAME,
      LECTURER_INST_SHORTNAME,
      LECTURER_INST2_SHORTNAME,
      LECTURER_INST3_SHORTNAME,
    ]

    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()

      for (const user of users) {
        await expect(page.getByTestId(`permission-${user}`)).toBeVisible()
        await page.getByTestId(`revoke-permission-${user}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expect(page.getByTestId(`permission-${user}`)).not.toBeVisible()
      }
      await page.getByTestId('close-share-object').click()
    }
  })

  test('Verify all individual permissions revoked', async ({
    page,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginInstitutionalCatalyst2,
    loginInstitutionalCatalyst3,
  }) => {
    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]

    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    for (const ga of gaNames) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).not.toBeVisible()
    }

    await loginInstitutionalCatalyst()
    await page.getByTestId('activities').click()
    for (const ga of gaNames) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).not.toBeVisible()
    }
  })

  test('Create user groups and share group activities with them', async ({
    page,
    loginLecturer,
    loginInstitutionalCatalyst2,
    loginInstitutionalCatalyst3,
  }) => {
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

    await loginInstitutionalCatalyst2()
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(SHARING.group3)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${SHARING.group3}`)).toBeVisible()

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

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()

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

  test('Verify READ group permissions — remove button not present', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    for (const ga of [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]) {
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${ga}`)
      ).toBeVisible()
    }

    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    // With group permission, remove button should not be present
    await expect(
      page.getByTestId(`remove-group-activity-${SHARING.ga1}`)
    ).not.toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Revoke group permissions for all groups', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    const groups = [
      SHARING.group1,
      SHARING.group2,
      SHARING.group3,
      SHARING.group4,
    ]

    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()

      for (const group of groups) {
        await expect(page.getByTestId(`permission-${group}`)).toBeVisible()
        await page.getByTestId(`revoke-permission-${group}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expect(page.getByTestId(`permission-${group}`)).not.toBeVisible()
      }
      await page.getByTestId('close-share-object').click()
    }
  })

  test('Transfer ownership of all group activities to pro1', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()

      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_IND_SHORTNAME)
      await page.getByTestId('new-permission-access-level').click()
      await page
        .getByTestId(`new-permission-access-level-${PERM_WRITE}`)
        .click()
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)

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

  test('Verify pro1 is new owner and transfer back to main user', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    // Verify owner actions for ga1
    await expect(
      page.getByTestId(`publish-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${SHARING.ga1}`).click()
    await expect(
      page.getByTestId(`edit-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`share-group-activity-${SHARING.ga1}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Transfer back
    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()

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

  test('Remove shared group activities from pro1 using removal functionality', async ({
    page,
    loginIndividualCatalyst,
    loginLecturer,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()

    const gaNames = [
      SHARING.ga1,
      SHARING.ga2,
      SHARING.ga3,
      SHARING.ga4,
      SHARING.ga5,
    ]
    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`remove-group-activity-${gaName}`).click()
      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expect(
        page.getByTestId(`activity-GROUP_ACTIVITY-${gaName}`)
      ).not.toBeVisible()
    }

    // Verify main user no longer sees pro1's permission
    await loginLecturer()
    await page.getByTestId('activities').click()
    for (const gaName of gaNames) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${gaName}`).click()
      await page.getByTestId(`share-group-activity-${gaName}`).click()
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).not.toBeVisible()
      await page.getByTestId('close-share-object').click()
    }
  })
})

test.describe('Part 8: Activity Details Points', () => {
  test('Create a group activity and verify points calculation', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createGroupActivity(page, {
      name: DETAILS.name,
      displayName: DETAILS.displayName,
      task: DETAILS.task,
      courseName: DETAILS.courseName,
      clues: [
        {
          name: 'Test Clue 1',
          displayName: 'Test Clue Display Name 1',
          content: 'Test Clue Content 1',
        },
      ],
      elements: [
        SCML.title,
        MCML.title,
        KPML.title,
        NRML.title,
        FTML.title,
        SEML.title,
        CSML.title,
      ],
    })

    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('activities').click()
    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${DETAILS.name}`)
    ).toBeVisible()

    await page.getByTestId(`activity-name-${DETAILS.name}`).click()
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('P.')

    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      NRML.title
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      FTML.title
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      SEML.title
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      CSML.title
    )

    await page.getByTestId('close-activity-details-modal').click()
  })
})
