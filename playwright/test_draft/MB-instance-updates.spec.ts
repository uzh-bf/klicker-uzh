/**
 * MB-instance-updates.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/MB-instance-updates-workflow.cy.ts
 * Tests element instance update workflows across all activity types.
 *
 * NOTE: This test suite requires the following to be pre-seeded in the DB:
 *   - Course "Testkurs"
 *   - Questions SCML, MCML, KPML (from questions.json fixture)
 *   - Live Quiz, Practice Quiz, Microlearning, Group Activity with those elements
 *
 * The creation steps (cy.createQuestionSC/MC/KPRIM, cy.createLiveQuiz etc.) are
 * large Cypress custom commands that interact with multi-step UI wizards.
 * In this Playwright port the creation tests are marked as TODO and the update /
 * verification tests are translated 1-to-1.
 */

import { type Page } from '@playwright/test'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture data (mirrors cypress/fixtures/questions.json + DM-questions.json) ─

const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: [{ value: '50%', correct: true }, { value: '100%' }],
}

const MCML = {
  title: 'MC Title Test 2 (Version 1)',
  content: 'MC Question Content 2',
  choices: [
    { value: '25%', correct: false },
    { value: '50%', correct: true },
    { value: '75%' },
    { value: '100%' },
  ],
}

const KPML = {
  title: 'KPRIM Title Test 2 (Version 1)',
  content: 'KPRIM Question Content 2',
  choices: [
    { value: '10%', correct: false },
    { value: '50%', correct: true },
    { value: '80%' },
    { value: '100%' },
  ],
}

const INSTANCE_UPDATES = {
  courseName: 'Testkurs',
  liveQuizName: 'Live Quiz Instance Update',
  practiceQuizName: 'Practice Quiz Instance Update',
  microlearningName: 'Microlearning Instance Update',
  groupActivityName: 'Group Activity Instance Update',
  newSCTitle: 'New Single Choice Title',
  newMCTitle: 'New Multiple Choice Title',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToActivities(page: Page) {
  await page.getByTestId('activities').click()
}

async function searchAndEdit(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`edit-element-${elementName}`).click()
}

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

  await page.getByTestId('insert-answer-field-0').click()
  await page
    .getByTestId('insert-answer-field-0')
    .pressSequentially(choices[0].value)

  for (let i = 1; i < choices.length; i++) {
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(300)
    await page.getByTestId(`insert-answer-field-${i}`).click()
    await page
      .getByTestId(`insert-answer-field-${i}`)
      .pressSequentially(choices[i].value)
  }

  // Enable sample solution and mark correct answers
  await page.getByTestId('configure-sample-solution').click({ force: true })
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].correct) {
      await page.getByTestId(`set-correctness-${i}`).click()
    }
  }

  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(1000)
}

async function createMCQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
) {
  await page.getByTestId('create-question').click()

  // Switch to MC type
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Multiple Choice (MC)').click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  await page.getByTestId('insert-answer-field-0').click()
  await page
    .getByTestId('insert-answer-field-0')
    .pressSequentially(choices[0].value)

  for (let i = 1; i < choices.length; i++) {
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(300)
    await page.getByTestId(`insert-answer-field-${i}`).click()
    await page
      .getByTestId(`insert-answer-field-${i}`)
      .pressSequentially(choices[i].value)
  }

  // Enable sample solution and mark correct answers
  await page.getByTestId('configure-sample-solution').click({ force: true })
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].correct) {
      await page.getByTestId(`set-correctness-${i}`).click()
    }
  }

  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(1000)
}

async function createKPRIMQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
) {
  await page.getByTestId('create-question').click()

  // Switch to KPRIM type
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Kprim (KP)').click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  for (let i = 0; i < choices.length; i++) {
    if (i > 0) {
      await page.getByTestId('add-new-answer').click()
      await page.waitForTimeout(300)
    }
    await page.getByTestId(`insert-answer-field-${i}`).click()
    await page
      .getByTestId(`insert-answer-field-${i}`)
      .pressSequentially(choices[i].value)
  }

  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(1000)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('MB: Element instance update workflows', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  // -------------------------------------------------------------------------
  // Create elements
  // -------------------------------------------------------------------------
  test('Create SC, MC and KPRIM questions for instance update tests', async ({
    page,
  }) => {
    await createSCQuestion(page, SCML.title, SCML.content, SCML.choices)
    await createMCQuestion(page, MCML.title, MCML.content, MCML.choices)
    await createKPRIMQuestion(page, KPML.title, KPML.content, KPML.choices)
  })

  // -------------------------------------------------------------------------
  // Create activities
  // NOTE: Activity creation wizard has multiple steps and is implemented inline.
  // -------------------------------------------------------------------------
  test('Create a Live Quiz with SC/MC/KPRIM elements for instance update tests', async ({
    page,
  }) => {
    await goToActivities(page)
    await page.getByTestId('create-new-activity').click()
    await page.getByTestId('create-live-quiz').click()

    // Step 1: name & course
    await page.getByTestId('live-quiz-name').fill(INSTANCE_UPDATES.liveQuizName)
    await page
      .getByTestId('live-quiz-display-name')
      .fill(INSTANCE_UPDATES.liveQuizName)
    await page.getByTestId('select-course').click()
    await page
      .getByTestId(`select-course-${INSTANCE_UPDATES.courseName}`)
      .click()
    await page.getByTestId('next-or-submit').click()

    // Step 2: description (skip)
    await page.getByTestId('next-or-submit').click()

    // Step 3: blocks - add block 1 with 3 elements
    await page.getByTestId('add-block').click()
    for (const title of [SCML.title, MCML.title, KPML.title]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    // Add block 2 with same 3 elements
    await page.getByTestId('add-block').click()
    for (const title of [SCML.title, MCML.title, KPML.title]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)

    // Verify activity was created
    await goToActivities(page)
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
  })

  test('Create a Practice Quiz with SC/MC/KPRIM elements for instance update tests', async ({
    page,
  }) => {
    await goToActivities(page)
    await page.getByTestId('create-new-activity').click()
    await page.getByTestId('create-practice-quiz').click()

    // Step 1: name & course
    await page
      .getByTestId('practice-quiz-name')
      .fill(INSTANCE_UPDATES.practiceQuizName)
    await page
      .getByTestId('practice-quiz-display-name')
      .fill(INSTANCE_UPDATES.practiceQuizName)
    await page.getByTestId('select-course').click()
    await page
      .getByTestId(`select-course-${INSTANCE_UPDATES.courseName}`)
      .click()
    await page.getByTestId('next-or-submit').click()

    // Step 2: settings (skip)
    await page.getByTestId('next-or-submit').click()

    // Step 3: stacks
    await page.getByTestId('add-stack').click()
    for (const title of [SCML.title, MCML.title, KPML.title]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    await page.getByTestId('add-stack').click()
    for (const title of [SCML.title, MCML.title, KPML.title]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `activity-PRACTICE_QUIZ-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).toBeVisible()
  })

  test('Create a Microlearning with SC/MC/KPRIM elements for instance update tests', async ({
    page,
  }) => {
    await goToActivities(page)
    await page.getByTestId('create-new-activity').click()
    await page.getByTestId('create-microlearning').click()

    // Step 1: name & course
    await page
      .getByTestId('microlearning-name')
      .fill(INSTANCE_UPDATES.microlearningName)
    await page
      .getByTestId('microlearning-display-name')
      .fill(INSTANCE_UPDATES.microlearningName)
    await page.getByTestId('select-course').click()
    await page
      .getByTestId(`select-course-${INSTANCE_UPDATES.courseName}`)
      .click()
    await page.getByTestId('next-or-submit').click()

    // Step 2: dates (keep defaults)
    await page.getByTestId('next-or-submit').click()

    // Step 3: stacks
    await page.getByTestId('add-stack').click()
    for (const title of [SCML.title, MCML.title, KPML.title]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    await page.getByTestId('add-stack').click()
    for (const title of [SCML.title, MCML.title, KPML.title]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `activity-MICRO_LEARNING-${INSTANCE_UPDATES.microlearningName}`
      )
    ).toBeVisible()
  })

  test('Create a Group Activity with SC/MC/KPRIM elements for instance update tests', async ({
    page,
  }) => {
    await goToActivities(page)
    await page.getByTestId('create-new-activity').click()
    await page.getByTestId('create-group-activity').click()

    // Step 1: name & course
    await page
      .getByTestId('group-activity-name')
      .fill(INSTANCE_UPDATES.groupActivityName)
    await page
      .getByTestId('group-activity-display-name')
      .fill(INSTANCE_UPDATES.groupActivityName)
    await page.getByTestId('select-course').click()
    await page
      .getByTestId(`select-course-${INSTANCE_UPDATES.courseName}`)
      .click()
    await page.getByTestId('next-or-submit').click()

    // Step 2: task & dates (skip)
    await page.getByTestId('next-or-submit').click()

    // Step 3: elements (single stack)
    for (const title of [
      SCML.title,
      MCML.title,
      KPML.title,
      SCML.title,
      MCML.title,
      KPML.title,
    ]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`add-element-${title}`).click()
    }

    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `activity-GROUP_ACTIVITY-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Verify activity overview - no outdated instances initially
  // -------------------------------------------------------------------------
  test('Verify activity overview shows no outdated instance badges initially', async ({
    page,
  }) => {
    await goToActivities(page)

    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).not.toBeVisible()

    // Verify live quiz content
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()

    await expect(
      page.getByTestId(
        `activity-PRACTICE_QUIZ-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).toBeVisible()
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()

    await expect(
      page.getByTestId(
        `activity-MICRO_LEARNING-${INSTANCE_UPDATES.microlearningName}`
      )
    ).toBeVisible()
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()

    await expect(
      page.getByTestId(
        `activity-GROUP_ACTIVITY-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).toBeVisible()
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
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
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify edit views show no update hints before any element is changed
  // -------------------------------------------------------------------------
  test('Check the edit view of all activities and verify that no update hint is shown', async ({
    page,
  }) => {
    await goToActivities(page)

    // Live Quiz
    await page
      .getByTestId(`actions-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).not.toBeVisible()
    await page
      .getByTestId(`edit-live-quiz-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-block-1')).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()

    // Practice Quiz
    await goToActivities(page)
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`edit-practice-quiz-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-1')).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()

    // Microlearning
    await goToActivities(page)
    await page
      .getByTestId(
        `actions-MICRO_LEARNING-${INSTANCE_UPDATES.microlearningName}`
      )
      .click()
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`edit-microlearning-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-1')).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()

    // Group Activity
    await goToActivities(page)
    await page
      .getByTestId(
        `actions-GROUP_ACTIVITY-${INSTANCE_UPDATES.groupActivityName}`
      )
      .click()
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`edit-group-activity-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-3-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-4-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-5-stack-0')).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()
  })

  // -------------------------------------------------------------------------
  // Update SC question and update second instances in each activity
  // -------------------------------------------------------------------------
  test('Update the SC question and update the second instances in all activities', async ({
    page,
  }) => {
    // Edit the SC question title (disable auto-propagation)
    await searchAndEdit(page, SCML.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      SCML.title
    )
    await page.getByTestId('insert-question-title').clear()
    await page
      .getByTestId('insert-question-title')
      .fill(INSTANCE_UPDATES.newSCTitle)
    await page.getByTestId('instance-update-switch').click()
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    // Verify element was renamed
    await page.getByTestId('elements-search-input').clear()
    await page
      .getByTestId('elements-search-input')
      .fill(INSTANCE_UPDATES.newSCTitle)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${INSTANCE_UPDATES.newSCTitle}`)
    ).toBeVisible()

    // Live Quiz: update second instance (block 1) of SC question
    await goToActivities(page)
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page
      .getByTestId(`edit-live-quiz-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-1')).toBeVisible()
    await expect(page.getByTestId('update-element-1-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-block-1')).not.toBeVisible()

    await page.getByTestId('update-element-0-block-1').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-block-1')).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    // Verify live quiz activity overview
    await goToActivities(page)
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()

    // Practice Quiz: update second instance of SC
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page
      .getByTestId(`edit-practice-quiz-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-1')).not.toBeVisible()

    await page.getByTestId('update-element-0-stack-1').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await page.getByTestId('close-activity-details-modal').click()

    // Microlearning: update second instance of SC
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(
        `actions-MICRO_LEARNING-${INSTANCE_UPDATES.microlearningName}`
      )
      .click()
    await page
      .getByTestId(`edit-microlearning-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).toBeVisible()

    await page.getByTestId('update-element-0-stack-1').click()
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await page.getByTestId('close-activity-details-modal').click()

    // Group Activity: update 4th instance (index 3) of SC
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(
        `actions-GROUP_ACTIVITY-${INSTANCE_UPDATES.groupActivityName}`
      )
      .click()
    await page
      .getByTestId(`edit-group-activity-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-3-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-4-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-5-stack-0')).not.toBeVisible()

    await page.getByTestId('update-element-3-stack-0').click()
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-3-stack-0')).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  // -------------------------------------------------------------------------
  // Verify update badge disappears after updating all instances
  // -------------------------------------------------------------------------
  test('Verify that update message disappears after updating all instances in an activity', async ({
    page,
  }) => {
    // Live Quiz: update all instances (only block-0 SC remains)
    await goToActivities(page)
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page
      .getByTestId(`edit-live-quiz-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-block-1')).not.toBeVisible()

    await page.getByTestId('update-element-0-block-0').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()

    // Practice Quiz
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page
      .getByTestId(`edit-practice-quiz-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()

    await page.getByTestId('update-element-0-stack-0').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()

    // Microlearning
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(
        `actions-MICRO_LEARNING-${INSTANCE_UPDATES.microlearningName}`
      )
      .click()
    await page
      .getByTestId(`edit-microlearning-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()

    await page.getByTestId('update-element-0-stack-0').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()

    // Group Activity
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(
        `actions-GROUP_ACTIVITY-${INSTANCE_UPDATES.groupActivityName}`
      )
      .click()
    await page
      .getByTestId(`edit-group-activity-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-3-stack-0')).not.toBeVisible()

    await page.getByTestId('update-element-0-stack-0').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await page.getByTestId('cancel-activity-creation').click()
  })

  // -------------------------------------------------------------------------
  // Update MC question and update all outdated instances using "update all"
  // -------------------------------------------------------------------------
  test('Update the MC question and update all outdated instances using update-all button', async ({
    page,
  }) => {
    // Edit MC question
    await searchAndEdit(page, MCML.title)
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      MCML.title
    )
    await page.getByTestId('insert-question-title').clear()
    await page
      .getByTestId('insert-question-title')
      .fill(INSTANCE_UPDATES.newMCTitle)
    await page.getByTestId('instance-update-switch').click()
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(500)

    await page.getByTestId('elements-search-input').clear()
    await page
      .getByTestId('elements-search-input')
      .fill(INSTANCE_UPDATES.newMCTitle)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${INSTANCE_UPDATES.newMCTitle}`)
    ).toBeVisible()

    // Live Quiz: update-all
    await goToActivities(page)
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).toBeVisible()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page
      .getByTestId(`edit-live-quiz-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-block-0')).toBeVisible()
    await expect(page.getByTestId('update-element-2-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-block-1')).toBeVisible()
    await expect(page.getByTestId('update-element-2-block-1')).not.toBeVisible()

    await page.getByTestId('update-all-outdated-instances').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-block-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-0-block-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-block-1')).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await goToActivities(page)
    await expect(
      page.getByTestId(`instances-outdated-${INSTANCE_UPDATES.liveQuizName}`)
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.liveQuizName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()

    // Practice Quiz: update-all
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page
      .getByTestId(`edit-practice-quiz-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-1')).toBeVisible()

    await page.getByTestId('update-all-outdated-instances').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.practiceQuizName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.practiceQuizName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await page.getByTestId('close-activity-details-modal').click()

    // Microlearning: update-all
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(
        `actions-MICRO_LEARNING-${INSTANCE_UPDATES.microlearningName}`
      )
      .click()
    await page
      .getByTestId(`edit-microlearning-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-1')).not.toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-1')).toBeVisible()

    await page.getByTestId('update-all-outdated-instances').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.microlearningName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.microlearningName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await page.getByTestId('close-activity-details-modal').click()

    // Group Activity: update-all
    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).toBeVisible()
    await page
      .getByTestId(
        `actions-GROUP_ACTIVITY-${INSTANCE_UPDATES.groupActivityName}`
      )
      .click()
    await page
      .getByTestId(`edit-group-activity-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).toBeVisible()
    await expect(page.getByTestId('update-element-0-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-1-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-2-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-3-stack-0')).not.toBeVisible()
    await expect(page.getByTestId('update-element-4-stack-0')).toBeVisible()
    await expect(page.getByTestId('update-element-5-stack-0')).not.toBeVisible()

    await page.getByTestId('update-all-outdated-instances').click()
    await page.waitForTimeout(1000)
    await expect(
      page.getByTestId('update-all-outdated-instances')
    ).not.toBeVisible()
    await page.getByTestId('next-or-submit').click()

    await goToActivities(page)
    await expect(
      page.getByTestId(
        `instances-outdated-${INSTANCE_UPDATES.groupActivityName}`
      )
    ).not.toBeVisible()
    await page
      .getByTestId(`activity-name-${INSTANCE_UPDATES.groupActivityName}`)
      .click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      KPML.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      INSTANCE_UPDATES.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      INSTANCE_UPDATES.newMCTitle
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      KPML.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })
})
