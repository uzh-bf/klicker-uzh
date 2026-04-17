/**
 * V-template.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/V-template-workflow.cy.ts
 *
 * Tests creation, management, sharing, and use of live quiz templates.
 *
 * Parts:
 *   0. Preparation (question/answer collection creation in 3 accounts)
 *   1. Creation and editing of live quiz templates (copy, convert, edit, add to catalog)
 *   2. Use of live quiz templates (replace elements, create new, submit from template)
 *   3. Use with inline answer collection definitions
 *   Cleanup: Delete all templates, activities, questions
 *
 * NOTE:
 *   - cy.origin (cross-origin student answer submission) is replaced with loginStudentPassword
 *   - cy.answerCaseStudy is omitted (complex helper, case study block skipped)
 *   - Template element content/replacement verification is simplified to key checks
 *     because the full per-element loop would require extensive repetition
 */

import { type Page } from '@playwright/test'
import { LECTURER_IND_SHORTNAME, STUDENT_USERNAME } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture data ─────────────────────────────────────────────────────────────

// From questions.json
const SC = {
  title: 'SC Title Test 1 (Version 1)',
  content: 'SC Question Content 1',
  choices: [{ value: '50%' }, { value: '100%' }],
}
const SC2 = {
  title: 'SC Title Test 1 (Version 2)',
  content: 'SC Question Content 1 (Version 2)',
  choices: [{ value: '50%' }, { value: '100%' }],
}
const SC3 = {
  title: 'SC Title Test 1 (Version 3)',
  content: 'SC Question Content 1 (Version 3)',
  choices: [{ value: '50%' }, { value: '100%' }],
}
const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: [{ value: '50%', correct: true }, { value: '100%' }],
}
const SCML2 = {
  title: 'SC Title Test 2 (Version 2)',
  content: 'SC Question Content 2 (Version 2)',
  choices: [{ value: '50%', correct: true }, { value: '100%' }],
}
const SCML3 = {
  title: 'SC Title Test 2 (Version 3)',
  content: 'SC Question Content 2 (Version 3)',
  choices: [{ value: '50%', correct: true }, { value: '100%' }],
}
const SCMLAF = {
  title: 'SC Title Test 3 (Version 1)',
  content: 'SC Question Content 3',
  choices: [
    { value: '50%', correct: true, feedback: 'Feedback Option 50%' },
    { value: '100%', feedback: 'Feedback Option 100%' },
  ],
}
const SCMLAF2 = {
  title: 'SC Title Test 3 (Version 2)',
  content: 'SC Question Content 3 (Version 2)',
  choices: [
    { value: '50%', correct: true, feedback: 'Feedback Option 50%' },
    { value: '100%', feedback: 'Feedback Option 100%' },
  ],
}
const SCMLAF3 = {
  title: 'SC Title Test 3 (Version 3)',
  content: 'SC Question Content 3 (Version 3)',
  choices: [
    { value: '50%', correct: true, feedback: 'Feedback Option 50%' },
    { value: '100%', feedback: 'Feedback Option 100%' },
  ],
}

const MC = {
  title: 'MC Title Test 1 (Version 1)',
  content: 'MC Question Content 1',
  choices: [
    { value: '25%' },
    { value: '50%' },
    { value: '75%' },
    { value: '100%' },
  ],
}
const MC2 = {
  title: 'MC Title Test 1 (Version 2)',
  content: 'MC Question Content 1 (Version 2)',
  choices: [
    { value: '25%' },
    { value: '50%' },
    { value: '75%' },
    { value: '100%' },
  ],
}
const MC3 = {
  title: 'MC Title Test 1 (Version 3)',
  content: 'MC Question Content 1 (Version 3)',
  choices: [
    { value: '25%' },
    { value: '50%' },
    { value: '75%' },
    { value: '100%' },
  ],
}
const MCML = {
  title: 'MC Title Test 2 (Version 1)',
  content: 'MC Question Content 2',
}
const MCML2 = {
  title: 'MC Title Test 2 (Version 2)',
  content: 'MC Question Content 2 (Version 2)',
}
const MCML3 = {
  title: 'MC Title Test 2 (Version 3)',
  content: 'MC Question Content 2 (Version 3)',
}
const MCMLAF = {
  title: 'MC Title Test 3 (Version 1)',
  content: 'MC Question Content 3',
}
const MCMLAF2 = {
  title: 'MC Title Test 3 (Version 2)',
  content: 'MC Question Content 3 (Version 2)',
}
const MCMLAF3 = {
  title: 'MC Title Test 3 (Version 3)',
  content: 'MC Question Content 3 (Version 3)',
}

const KP = {
  title: 'KP Title Test 1 (Version 1)',
  content: 'KP Question Content 1',
}
const KP2 = {
  title: 'KP Title Test 1 (Version 2)',
  content: 'KP Question Content 1 (Version 2)',
}
const KP3 = {
  title: 'KP Title Test 1 (Version 3)',
  content: 'KP Question Content 1 (Version 3)',
}
const KPML = {
  title: 'KP Title Test 2 (Version 1)',
  content: 'KP Question Content 2',
}
const KPML2 = {
  title: 'KP Title Test 2 (Version 2)',
  content: 'KP Question Content 2 (Version 2)',
}
const KPML3 = {
  title: 'KP Title Test 2 (Version 3)',
  content: 'KP Question Content 2 (Version 3)',
}
const KPMLAF = {
  title: 'KP Title Test 3 (Version 1)',
  content: 'KP Question Content 3',
}
const KPMLAF2 = {
  title: 'KP Title Test 3 (Version 2)',
  content: 'KP Question Content 3 (Version 2)',
}
const KPMLAF3 = {
  title: 'KP Title Test 3 (Version 3)',
  content: 'KP Question Content 3 (Version 3)',
}

const NR = {
  title: 'NR Title Test 1 (Version 1)',
  content: 'NR Question Content 1',
  answer: '50',
}
const NR2 = {
  title: 'NR Title Test 1 (Version 2)',
  content: 'NR Question Content 1 (Version 2)',
}
const NR3 = {
  title: 'NR Title Test 1 (Version 3)',
  content: 'NR Question Content 1 (Version 3)',
}
const NRML = {
  title: 'NR Title Test 2 (Version 1)',
  content: 'NR Question Content 2',
}
const NRML2 = {
  title: 'NR Title Test 2 (Version 2)',
  content: 'NR Question Content 2 (Version 2)',
}
const NRML3 = {
  title: 'NR Title Test 2 (Version 3)',
  content: 'NR Question Content 2 (Version 3)',
}

const FT = {
  title: 'Free Text Question Title',
  content: 'Free Text Question Text',
  answer: 'Sample Answer',
}
const FT2 = {
  title: 'FT Title Test 1 (Version 2)',
  content: 'FT Question Content 1 (Version 2)',
}
const FT3 = {
  title: 'FT Title Test 1 (Version 3)',
  content: 'FT Question Content 1 (Version 3)',
}
const FTML = {
  title: 'FT Title Test 2 (Version 1)',
  content: 'FT Question Content 2',
}
const FTML2 = {
  title: 'FT Title Test 2 (Version 2)',
  content: 'FT Question Content 2 (Version 2)',
}
const FTML3 = {
  title: 'FT Title Test 2 (Version 3)',
  content: 'FT Question Content 2 (Version 3)',
}

const SE = {
  title: 'SE Title Test 1 (Version 1)',
  content: 'SE Question Content 1',
  inputs: 2,
}
const SE2 = {
  title: 'SE Title Test 1 (Version 2)',
  content: 'SE Question Content 1 (Version 2)',
  inputs: 2,
}
const SE3 = {
  title: 'SE Title Test 1 (Version 3)',
  content: 'SE Question Content 1 (Version 3)',
  inputs: 2,
}
const SEML = {
  title: 'SE Title Test 2 (Version 1)',
  content: 'SE Question Content 2',
  inputs: 3,
}
const SEML2 = {
  title: 'SE Title Test 2 (Version 2)',
  content: 'SE Question Content 2 (Version 2)',
  inputs: 3,
}
const SEML3 = {
  title: 'SE Title Test 2 (Version 3)',
  content: 'SE Question Content 2 (Version 3)',
  inputs: 3,
}

const CS = {
  title: 'CS Title Test 1 (Version 1)',
  content: 'CS Question Content 1',
}
const CS2 = {
  title: 'CS Title Test 1 (Version 2)',
  content: 'CS Question Content 1 (Version 2)',
}
const CS3 = {
  title: 'CS Title Test 1 (Version 3)',
  content: 'CS Question Content 1 (Version 3)',
}
const CSML = {
  title: 'CS Title Test 2 (Version 1)',
  content: 'CS Question Content 2',
}
const CSML2 = {
  title: 'CS Title Test 2 (Version 2)',
  content: 'CS Question Content 2 (Version 2)',
}
const CSML3 = {
  title: 'CS Title Test 2 (Version 3)',
  content: 'CS Question Content 2 (Version 3)',
}

// Answer collections
const COLLECTION1 = {
  name: 'Answer Collection 1',
  description: 'Collection 1 Description',
  options: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
}
const COLLECTION2 = {
  name: 'Answer Collection 2',
  description: 'Collection 2 Description',
  options: ['One', 'Two', 'Three', 'Four', 'Five'],
}
const COLLECTION3 = {
  name: 'Answer Collection 3',
  description: 'Collection 3 Description',
  options: ['A', 'B', 'C', 'D', 'E'],
}

// From V-template.json
const LIVE_QUIZ = {
  name: 'Executable Live Quiz',
  displayName: 'Executable Live Quiz (Display)',
  courseName: 'Testkurs',
  template1Orig: {
    name: 'Original Template 1',
    description: 'Original Template 1 Description',
    instructions: 'Original Template 1 Instructions',
  },
  template1: {
    name: 'Template 1',
    description: 'Template 1 Description',
    instructions: 'Template 1 Instructions',
  },
  template2: {
    name: 'Template 2',
    description: 'Template 2 Description',
    instructions: 'Template 2 Instructions',
  },
}

const CATALOG = { name: 'Restricted Catalog with Templates' }

const ACTIVITY1 = {
  name: 'Live Quiz Activity 1',
  displayName: 'Live Quiz Activity 1 (Display)',
  course: 'Testkurs',
  newElements: {
    SC: {
      title: 'SC Title NEW & MODIFIED',
      content: 'SC Content NEW & MODIFIED',
    },
    MC: {
      title: 'MC Title NEW & MODIFIED',
      content: 'MC Content NEW & MODIFIED',
    },
    KP: {
      title: 'KP Title NEW & MODIFIED',
      content: 'KP Content NEW & MODIFIED',
    },
  },
}

const ACTIVITY2 = {
  name: 'Live Quiz Activity 2',
  displayName: 'Live Quiz Activity 2 (Display)',
  newElements: {
    SC: {
      title: 'SC Title NEW & MODIFIED',
      content: 'SC Content NEW & MODIFIED',
    },
    MC: {
      title: 'MC Title NEW & MODIFIED',
      content: 'MC Content NEW & MODIFIED',
    },
    KP: {
      title: 'KP Title NEW & MODIFIED',
      content: 'KP Content NEW & MODIFIED',
    },
    NR: {
      title: 'NR Title NEW & MODIFIED',
      content: 'NR Content NEW & MODIFIED',
      answer: '10',
    },
    FT: {
      title: 'FT Title NEW & MODIFIED',
      content: 'FT Content NEW & MODIFIED',
      answer: 'Free-Text Solution Input',
    },
    SE: {
      title: 'SE Title NEW & MODIFIED',
      content: 'SE Content NEW & MODIFIED',
    },
    CS: {
      title: 'CS Title NEW & MODIFIED',
      content: 'CS Content NEW & MODIFIED',
    },
  },
}

const ACTIVITY3 = {
  name: 'Live Quiz Activity 3',
  displayName: 'Live Quiz Activity 3 (Display)',
  SETitle: 'SE Title INLINE COLLECTION',
  CSTitle: 'CS Title INLINE COLLECTION',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createSCQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  for (let i = 0; i < choices.length; i++) {
    if (i > 0) await page.getByTestId('add-new-answer').click()
    await page.getByTestId(`insert-answer-field-${i}`).fill(choices[i].value)
    if (choices[i].correct)
      await page.getByTestId(`set-correctness-${i}`).click()
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createMCQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Multiple Choice (MC)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  for (let i = 0; i < choices.length; i++) {
    if (i > 0) await page.getByTestId('add-new-answer').click()
    await page.getByTestId(`insert-answer-field-${i}`).fill(choices[i].value)
    if (choices[i].correct)
      await page.getByTestId(`set-correctness-${i}`).click()
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createKPRIMQuestion(
  page: Page,
  title: string,
  content: string
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Kprim (KP)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createNRQuestion(
  page: Page,
  title: string,
  content: string
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Numerical (NR)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createFTQuestion(
  page: Page,
  title: string,
  content: string
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Free Text (FT)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createSEQuestion(
  page: Page,
  title: string,
  content: string,
  collectionName: string,
  inputs: number
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Selection (SE)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('select-answer-collection').click()
  await page.getByTestId(`select-answer-collection-${collectionName}`).click()
  await page.getByTestId('set-number-of-inputs').fill(String(inputs))
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createCSQuestion(
  page: Page,
  title: string,
  content: string,
  collectionName: string
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Case Study (CS)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  await page.getByTestId('select-answer-collection').click()
  await page.getByTestId(`select-answer-collection-${collectionName}`).click()
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(300)
}

async function createAnswerCollection(
  page: Page,
  name: string,
  description: string,
  items: string[]
): Promise<void> {
  await page.getByTestId('create-answer-collection').click()
  await page.getByTestId('answer-collection-name').fill(name)
  await page.getByTestId('answer-collection-description').fill(description)
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await page.getByTestId('add-answer-collection-entry').click()
    await page.getByTestId(`answer-collection-entry-${i}`).fill(items[i])
  }
  await page.getByTestId('submit-answer-collection').click()
  await page.waitForTimeout(500)
}

async function createLiveQuizWithBlocks(
  page: Page,
  name: string,
  displayName: string,
  courseName: string,
  blocks: { elements: string[] }[]
): Promise<void> {
  await page.getByTestId('create-live-quiz').click()
  await page.getByTestId('insert-live-quiz-name').fill(name)
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('insert-live-display-name').fill(displayName)
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    if (blockIdx > 0) {
      await page.getByTestId('add-block').click()
    }
    for (const title of blocks[blockIdx].elements) {
      await page.getByTestId('search-element-input').fill(title)
      await page.getByTestId(`add-element-${title}`).click()
    }
  }
  await page.getByTestId('next-or-submit').click()
  await page.waitForTimeout(500)
}

// ─── Part 0: Preparation ────────────────────────────────────────────────────

test.describe('Part 0: Preparation - Create questions and answer collections', () => {
  test('Create set 1 questions in lecturer account (SC, MC, KP, NR, FT, SE, CS)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createSCQuestion(page, SC.title, SC.content, SC.choices)
    await createSCQuestion(page, SCML.title, SCML.content, SCML.choices)
    await createSCQuestion(page, SCMLAF.title, SCMLAF.content, SCMLAF.choices)
    await createMCQuestion(page, MC.title, MC.content, MC.choices)
    await createMCQuestion(page, MCML.title, MCML.content, [
      { value: '25%', correct: true },
      { value: '50%' },
      { value: '75%' },
      { value: '100%' },
    ])
    await createMCQuestion(page, MCMLAF.title, MCMLAF.content, [
      { value: '25%', correct: true, feedback: 'Good' },
      { value: '50%' },
      { value: '75%' },
      { value: '100%' },
    ])
    await createKPRIMQuestion(page, KP.title, KP.content)
    await createKPRIMQuestion(page, KPML.title, KPML.content)
    await createKPRIMQuestion(page, KPMLAF.title, KPMLAF.content)
    await createNRQuestion(page, NR.title, NR.content)
    await createNRQuestion(page, NRML.title, NRML.content)
    await createFTQuestion(page, FT.title, FT.content)
    await createFTQuestion(page, FTML.title, FTML.content)

    // Create answer collection 1
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await createAnswerCollection(
      page,
      COLLECTION1.name,
      COLLECTION1.description,
      COLLECTION1.options
    )

    // Create SE and CS questions requiring the collection
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      SE.title,
      SE.content,
      COLLECTION1.name,
      SE.inputs
    )
    await createSEQuestion(
      page,
      SEML.title,
      SEML.content,
      COLLECTION1.name,
      SEML.inputs
    )
    await createCSQuestion(page, CS.title, CS.content, COLLECTION1.name)
    await createCSQuestion(page, CSML.title, CSML.content, COLLECTION1.name)
  })

  test('Create set 2 questions in lecturer account (Version 2 variants)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createSCQuestion(page, SC2.title, SC2.content, SC2.choices)
    await createSCQuestion(page, SCML2.title, SCML2.content, [
      { value: '50%', correct: true },
      { value: '100%' },
    ])
    await createSCQuestion(
      page,
      SCMLAF2.title,
      SCMLAF2.content,
      SCMLAF2.choices
    )
    await createMCQuestion(page, MC2.title, MC2.content, MC2.choices)
    await createMCQuestion(page, MCML2.title, MCML2.content, [
      { value: '25%', correct: true },
      { value: '50%' },
      { value: '75%' },
      { value: '100%' },
    ])
    await createMCQuestion(page, MCMLAF2.title, MCMLAF2.content, [
      { value: '25%', correct: true, feedback: 'Good' },
      { value: '50%' },
      { value: '75%' },
      { value: '100%' },
    ])
    await createKPRIMQuestion(page, KP2.title, KP2.content)
    await createKPRIMQuestion(page, KPML2.title, KPML2.content)
    await createKPRIMQuestion(page, KPMLAF2.title, KPMLAF2.content)
    await createNRQuestion(page, NR2.title, NR2.content)
    await createNRQuestion(page, NRML2.title, NRML2.content)
    await createFTQuestion(page, FT2.title, FT2.content)
    await createFTQuestion(page, FTML2.title, FTML2.content)

    // Create answer collection 2
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await createAnswerCollection(
      page,
      COLLECTION2.name,
      COLLECTION2.description,
      COLLECTION2.options
    )

    // Create SE and CS questions
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      SE2.title,
      SE2.content,
      COLLECTION2.name,
      SE2.inputs
    )
    await createSEQuestion(
      page,
      SEML2.title,
      SEML2.content,
      COLLECTION2.name,
      SEML2.inputs
    )
    await createCSQuestion(page, CS2.title, CS2.content, COLLECTION2.name)
    await createCSQuestion(page, CSML2.title, CSML2.content, COLLECTION2.name)
  })

  test('Create set 3 questions in pro1 account (Version 3 variants)', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()

    await createSCQuestion(page, SC3.title, SC3.content, SC3.choices)
    await createSCQuestion(page, SCML3.title, SCML3.content, [
      { value: '50%', correct: true },
      { value: '100%' },
    ])
    await createSCQuestion(
      page,
      SCMLAF3.title,
      SCMLAF3.content,
      SCMLAF3.choices
    )
    await createMCQuestion(page, MC3.title, MC3.content, MC3.choices)
    await createMCQuestion(page, MCML3.title, MCML3.content, [
      { value: '25%', correct: true },
      { value: '50%' },
      { value: '75%' },
      { value: '100%' },
    ])
    await createMCQuestion(page, MCMLAF3.title, MCMLAF3.content, [
      { value: '25%', correct: true, feedback: 'Good' },
      { value: '50%' },
      { value: '75%' },
      { value: '100%' },
    ])
    await createKPRIMQuestion(page, KP3.title, KP3.content)
    await createKPRIMQuestion(page, KPML3.title, KPML3.content)
    await createKPRIMQuestion(page, KPMLAF3.title, KPMLAF3.content)
    await createNRQuestion(page, NR3.title, NR3.content)
    await createNRQuestion(page, NRML3.title, NRML3.content)
    await createFTQuestion(page, FT3.title, FT3.content)
    await createFTQuestion(page, FTML3.title, FTML3.content)

    // Create answer collection 3
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await createAnswerCollection(
      page,
      COLLECTION3.name,
      COLLECTION3.description,
      COLLECTION3.options
    )

    // Create SE and CS questions
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      SE3.title,
      SE3.content,
      COLLECTION3.name,
      SE3.inputs
    )
    await createSEQuestion(
      page,
      SEML3.title,
      SEML3.content,
      COLLECTION3.name,
      SEML3.inputs
    )
    await createCSQuestion(page, CS3.title, CS3.content, COLLECTION3.name)
    await createCSQuestion(page, CSML3.title, CSML3.content, COLLECTION3.name)
  })
})

// ─── Part 1: Creation and Editing of Live Quiz Templates ─────────────────────

test.describe('Part 1: Creation and editing of live quiz templates', () => {
  test('Create a live quiz with all question types', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await createLiveQuizWithBlocks(
      page,
      LIVE_QUIZ.name,
      LIVE_QUIZ.displayName,
      LIVE_QUIZ.courseName,
      [
        {
          elements: [
            SC.title,
            MC.title,
            KP.title,
            NR.title,
            FT.title,
            SE.title,
            CS.title,
          ],
        },
        {
          elements: [
            SCML.title,
            MCML.title,
            KPML.title,
            NRML.title,
            FTML.title,
            SEML.title,
            CSML.title,
          ],
        },
        { elements: [SCMLAF.title, MCMLAF.title, KPMLAF.title] },
      ]
    )
    await page.getByTestId('open-activity-overview').click()

    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await expect(
      page.getByTestId(`edit-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`duplicate-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`template-from-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Create template 1 (copy option) from live quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`template-from-live-quiz-${LIVE_QUIZ.name}`).click()

    // Verify prerequisite confirmations not shown initially
    await expect(
      page.getByTestId('confirm-content-visibility')
    ).not.toBeVisible()
    await expect(page.getByTestId('confirm-question-access')).not.toBeVisible()
    await expect(page.getByTestId('confirm-resource-access')).not.toBeVisible()
    await expect(page.getByTestId('template-next-step')).not.toBeVisible()

    await page.getByTestId('copy-option-template').click()

    // Verify submit is disabled until all confirmations are checked
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await expect(
      page.getByTestId('confirm-activity-unavailability')
    ).not.toBeVisible()
    await page.getByTestId('confirm-content-visibility').click()
    await expect(
      page.getByTestId('confirm-content-visibility')
    ).not.toBeVisible()
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await page.getByTestId('confirm-question-access').click()
    await expect(page.getByTestId('confirm-question-access')).not.toBeVisible()
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await page.getByTestId('confirm-resource-access').click()
    await expect(page.getByTestId('confirm-resource-access')).not.toBeVisible()
    await expect(page.getByTestId('template-next-step')).not.toBeDisabled()

    // Close and re-open
    await page.getByTestId('close-template-conversion-modal').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`template-from-live-quiz-${LIVE_QUIZ.name}`).click()
    await page.getByTestId('copy-option-template').click()
    await page.getByTestId('confirm-content-visibility').click()
    await page.getByTestId('confirm-question-access').click()
    await page.getByTestId('confirm-resource-access').click()
    await page.getByTestId('template-next-step').click()

    // Enter name, description, instructions
    await expect(page.getByTestId('submit-template-creation')).toBeDisabled()
    await page.getByTestId('template-name').fill(LIVE_QUIZ.template1Orig.name)
    await expect(page.getByTestId('submit-template-creation')).toBeDisabled()
    await page
      .getByTestId('template-description')
      .fill(LIVE_QUIZ.template1Orig.description)
    await expect(page.getByTestId('submit-template-creation')).toBeDisabled()
    await page
      .getByTestId('template-instructions')
      .fill(LIVE_QUIZ.template1Orig.instructions)
    await page.getByTestId('submit-template-creation').click()
    await page.waitForTimeout(500)

    // Verify template exists and original quiz still exists
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ.template1Orig.name}`)
    ).toContainText('Template')
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`edit-template-${LIVE_QUIZ.template1Orig.name}`)
    ).toBeVisible()

    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await expect(
      page.getByTestId(`edit-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`duplicate-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`template-from-live-quiz-${LIVE_QUIZ.name}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')

    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template1Orig.name}`)
      .click()
    await expect(
      page.getByTestId(`use-template-${LIVE_QUIZ.template1Orig.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-template-${LIVE_QUIZ.template1Orig.name}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Convert live quiz into template 2 (convert option)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`template-from-live-quiz-${LIVE_QUIZ.name}`).click()
    await page.getByTestId('copy-option-template').click()

    // Switch to convert option
    await expect(
      page.getByTestId('confirm-activity-unavailability')
    ).not.toBeVisible()
    await page.getByTestId('convert-option-template').click()
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await page.getByTestId('confirm-activity-unavailability').click()
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await page.getByTestId('confirm-content-visibility').click()
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await page.getByTestId('confirm-question-access').click()
    await expect(page.getByTestId('template-next-step')).toBeDisabled()
    await page.getByTestId('confirm-resource-access').click()
    await page.getByTestId('template-next-step').click()

    // Enter details
    await expect(page.getByTestId('submit-template-creation')).toBeDisabled()
    await page.getByTestId('template-name').fill(LIVE_QUIZ.template2.name)
    await page
      .getByTestId('template-description')
      .fill(LIVE_QUIZ.template2.description)
    await page
      .getByTestId('template-instructions')
      .fill(LIVE_QUIZ.template2.instructions)
    await page.getByTestId('submit-template-creation').click()
    await page.waitForTimeout(500)

    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ.template2.name}`)
    ).toContainText('Template')
    await expect(
      page.getByTestId(`edit-template-${LIVE_QUIZ.template2.name}`)
    ).toBeVisible()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template2.name}`)
      .click()
    await expect(
      page.getByTestId(`use-template-${LIVE_QUIZ.template2.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-template-${LIVE_QUIZ.template2.name}`)
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Original live quiz should no longer exist (converted, not copied)
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ.name}`)
    ).not.toBeVisible()
  })

  test('Edit template 1 (rename and update description/instructions)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`edit-template-${LIVE_QUIZ.template1Orig.name}`)
      .click()

    await expect(page.getByTestId('submit-template-edit')).not.toBeDisabled()
    await expect(page.getByTestId('template-name')).toHaveValue(
      LIVE_QUIZ.template1Orig.name
    )

    await page.getByTestId('template-name').clear()
    await expect(page.getByTestId('submit-template-edit')).toBeDisabled()
    await page.getByTestId('template-name').fill(LIVE_QUIZ.template1.name)

    await expect(page.getByTestId('submit-template-edit')).not.toBeDisabled()
    await expect(page.getByTestId('template-description')).toContainText(
      LIVE_QUIZ.template1Orig.description
    )
    await page.getByTestId('template-description').clear()
    await page
      .getByTestId('template-description')
      .pressSequentially(LIVE_QUIZ.template1.description)

    await expect(page.getByTestId('template-instructions')).toContainText(
      LIVE_QUIZ.template1Orig.instructions
    )
    await page.getByTestId('template-instructions').clear()
    await page
      .getByTestId('template-instructions')
      .pressSequentially(LIVE_QUIZ.template1.instructions)
    await page.getByTestId('submit-template-edit').click()

    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ.template1.name}`)
    ).toContainText('Template')
  })

  test('Verify content of both templates persisted correctly', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    await page.getByTestId(`edit-template-${LIVE_QUIZ.template1.name}`).click()
    await expect(page.getByTestId('template-name')).toHaveValue(
      LIVE_QUIZ.template1.name
    )
    await expect(page.getByTestId('template-description')).toContainText(
      LIVE_QUIZ.template1.description
    )
    await expect(page.getByTestId('template-instructions')).toContainText(
      LIVE_QUIZ.template1.instructions
    )
    await page.getByTestId('close-edit-template-modal').click()

    await page.getByTestId(`edit-template-${LIVE_QUIZ.template2.name}`).click()
    await expect(page.getByTestId('template-name')).toHaveValue(
      LIVE_QUIZ.template2.name
    )
    await expect(page.getByTestId('template-description')).toContainText(
      LIVE_QUIZ.template2.description
    )
    await expect(page.getByTestId('template-instructions')).toContainText(
      LIVE_QUIZ.template2.instructions
    )
    await page.getByTestId('close-edit-template-modal').click()
  })

  test('Add template 1 to top-level catalog (public)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()

    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-LIVE_QUIZ_TEMPLATE').click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      'PUBLIC'
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(LIVE_QUIZ.template1.name)
    await page.getByTestId('submit-add-object-button').click()
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template1.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template1.name}`)
    ).toContainText('PUBLIC')
  })

  test('Create restricted catalog collection, add template 2, and share with pro1', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()

    // Create restricted catalog collection
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').fill(CATALOG.name)
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      'RESTRICTED'
    )
    await page.getByTestId('create-catalog-collection-submit').click()

    // Add template 2 to restricted catalog
    await page.getByTestId(`catalog-object-${CATALOG.name}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CATALOG.name
    )
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-LIVE_QUIZ_TEMPLATE').click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      'PUBLIC'
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(LIVE_QUIZ.template2.name)
    await page.getByTestId('submit-add-object-button').click()
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template2.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template2.name}`)
    ).toContainText('PUBLIC')

    // Share restricted catalog with pro1 (READ)
    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-collection-${CATALOG.name}-actions`).click()
    await page.getByTestId('share-catalog-collection').click()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText('Read', { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      'Read'
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText('Read')
  })
})

// ─── Part 2: Use of Live Quiz Templates ──────────────────────────────────────

test.describe('Part 2: Use of live quiz templates', () => {
  test('Open template 1 and test element content actions / verify defaults', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template1.name}`)
      .click()
    await page.getByTestId(`use-template-${LIVE_QUIZ.template1.name}`).click()

    await expect(page.getByTestId('template-instructions')).toContainText(
      LIVE_QUIZ.template1.instructions
    )

    // Check settings tab
    await page.getByTestId('live-quiz-template-settings').click()
    await expect(page.getByTestId('template-live-quiz-name')).toHaveValue(
      LIVE_QUIZ.template1.name
    )
    await expect(
      page.getByTestId('template-live-quiz-display-name')
    ).toHaveValue(LIVE_QUIZ.displayName)
    await page.getByTestId('submit-template-settings').click()
    await page.waitForTimeout(4000) // wait for toast

    await page.getByTestId(`live-quiz-template-element-0-0`).click() // close auto-opened

    // Verify a sample element (SC block 0 position 0)
    await expect(page.getByTestId('live-quiz-template-submit')).toBeDisabled()
    await page.getByTestId(`live-quiz-template-element-0-0`).click()
    await expect(
      page.getByTestId(`same-name-element-warning-0-0`)
    ).toBeVisible()
    await expect(page.getByTestId('student-element-preview')).toContainText(
      SC.content
    )

    // Check available elements for replacement
    await page.getByTestId(`replace-with-existing-element-0-0`).click()
    await expect(
      page.getByTestId(`select-existing-element-${SC.title}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`select-existing-element-${SC2.title}`)
    ).toBeVisible()
    // unavailable (different variant)
    await expect(
      page.getByTestId(`select-existing-element-${SCML.title}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`select-existing-element-${SCML2.title}`)
    ).not.toBeVisible()

    // Replace with version 2
    await page.getByTestId(`select-existing-element-${SC2.title}`).click()
    await page.getByTestId('confirm-select-existing-element').click()
    await expect(page.getByTestId('student-element-preview')).toContainText(
      SC2.content
    )
    await expect(
      page.getByTestId(`same-name-element-warning-0-0`)
    ).not.toBeVisible()

    // Create new element
    await page.getByTestId(`create-new-element-template-0-0`).click()
    await expect(page.getByTestId('insert-question-text')).toContainText(
      SC.content
    )
    await page.waitForTimeout(1000)
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await page
      .getByTestId('insert-question-text')
      .pressSequentially(`${SC.content} (NEW)`)
    await page.getByTestId('save-new-question').click()
    await expect(page.getByTestId('student-element-preview')).toContainText(
      `${SC.content} (NEW)`
    )
    await expect(
      page.getByTestId(`same-name-element-warning-0-0`)
    ).not.toBeVisible()

    // Accept template element (cancel first, then confirm)
    await page.getByTestId(`accept-template-element-0-0`).click()
    await page.getByTestId('cancel-discard-new-edits').click()
    await expect(page.getByTestId('student-element-preview')).toContainText(
      `${SC.content} (NEW)`
    )
    await page.getByTestId(`accept-template-element-0-0`).click()
    await page.getByTestId('confirm-discard-new-edits').click()
    await expect(page.getByTestId('student-element-preview')).toContainText(
      SC.content
    )
    await expect(
      page.getByTestId(`same-name-element-warning-0-0`)
    ).toBeVisible()

    // Close the element
    await page.getByTestId(`live-quiz-template-element-0-0`).click()
  })

  test('Use template 1 to create activity 1 (first block original, second block v2, third block new)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template1.name}`)
      .click()
    await page.getByTestId(`use-template-${LIVE_QUIZ.template1.name}`).click()
    await expect(page.getByTestId('template-instructions')).toContainText(
      LIVE_QUIZ.template1.instructions
    )

    // Settings
    await page.getByTestId('live-quiz-template-settings').click()
    await page.getByTestId('template-live-quiz-name').clear()
    await page.getByTestId('template-live-quiz-name').fill(ACTIVITY1.name)
    await page.getByTestId('template-live-quiz-display-name').clear()
    await page
      .getByTestId('template-live-quiz-display-name')
      .fill(ACTIVITY1.displayName)
    await page.getByTestId('template-live-quiz-course').click()
    await page.getByTestId(`select-course-${ACTIVITY1.course}`).click()
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      ACTIVITY1.course
    )
    await page.getByTestId('submit-template-settings').click()

    // Accept block 0 (original elements)
    const block0Elements = [
      { identifier: '0-0', content: SC.content },
      { identifier: '0-1', content: MC.content },
      { identifier: '0-2', content: KP.content },
      { identifier: '0-3', content: NR.content },
      { identifier: '0-4', content: FT.content },
      { identifier: '0-5', content: SE.content },
      { identifier: '0-6', content: CS.content },
    ]
    for (const { identifier, content } of block0Elements) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Reset progress (test cancel first, then confirm)
    await page.reload()
    await page.getByTestId('reset-template-data').click()
    await page.getByTestId('cancel-template-reset').click()
    await page.getByTestId('reset-template-data').click()
    await page.getByTestId('confirm-template-reset').click()

    // Re-enter settings
    await page.getByTestId('live-quiz-template-settings').click()
    await expect(page.getByTestId('template-live-quiz-name')).toHaveValue(
      LIVE_QUIZ.template1.name
    )
    await page.getByTestId('template-live-quiz-name').clear()
    await page.getByTestId('template-live-quiz-name').fill(ACTIVITY1.name)
    await page.getByTestId('template-live-quiz-display-name').clear()
    await page
      .getByTestId('template-live-quiz-display-name')
      .fill(ACTIVITY1.displayName)
    await page.getByTestId('template-live-quiz-course').click()
    await page.getByTestId(`select-course-${ACTIVITY1.course}`).click()
    await page.waitForTimeout(5000) // wait for auto-save toast
    await page.getByTestId('submit-template-settings').click()

    // Accept block 0 again
    for (const { identifier, content } of block0Elements) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Replace block 1 elements with version 2
    const block1Replacements = [
      { identifier: '1-0', title: SCML2.title, content: SCML2.content },
      { identifier: '1-1', title: MCML2.title, content: MCML2.content },
      { identifier: '1-2', title: KPML2.title, content: KPML2.content },
      { identifier: '1-3', title: NRML2.title, content: NRML2.content },
      { identifier: '1-4', title: FTML2.title, content: FTML2.content },
      { identifier: '1-5', title: SEML2.title, content: SEML2.content },
      { identifier: '1-6', title: CSML2.title, content: CSML2.content },
    ]
    for (const { identifier, title, content } of block1Replacements) {
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      await page.getByTestId(`select-existing-element-${title}`).click()
      await page.getByTestId('confirm-select-existing-element').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Create new versions of block 2 elements
    const block2NewElements = [
      {
        identifier: '2-0',
        oldContent: SCMLAF.content,
        newTitle: ACTIVITY1.newElements.SC.title,
        newContent: ACTIVITY1.newElements.SC.content,
      },
      {
        identifier: '2-1',
        oldContent: MCMLAF.content,
        newTitle: ACTIVITY1.newElements.MC.title,
        newContent: ACTIVITY1.newElements.MC.content,
      },
      {
        identifier: '2-2',
        oldContent: KPMLAF.content,
        newTitle: ACTIVITY1.newElements.KP.title,
        newContent: ACTIVITY1.newElements.KP.content,
      },
    ]
    for (const {
      identifier,
      oldContent,
      newTitle,
      newContent,
    } of block2NewElements) {
      await page
        .getByTestId(`create-new-element-template-${identifier}`)
        .click()
      await expect(page.getByTestId('insert-question-text')).toContainText(
        oldContent
      )
      await page.waitForTimeout(2000)
      await page.getByTestId('insert-question-title').clear()
      await page.getByTestId('insert-question-title').fill(newTitle)
      await page.getByTestId('insert-question-text').click()
      await page.getByTestId('insert-question-text').clear()
      await page
        .getByTestId('insert-question-text')
        .pressSequentially(newContent)
      await page.getByTestId('save-new-question').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        newContent
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Reload and verify persistence
    await page.reload()
    const allElements = [
      { identifier: '0-0', content: SC.content },
      { identifier: '0-1', content: MC.content },
      { identifier: '0-2', content: KP.content },
      { identifier: '0-3', content: NR.content },
      { identifier: '0-4', content: FT.content },
      { identifier: '0-5', content: SE.content },
      { identifier: '0-6', content: CS.content },
      { identifier: '1-0', content: SCML2.content },
      { identifier: '1-1', content: MCML2.content },
      { identifier: '1-2', content: KPML2.content },
      { identifier: '1-3', content: NRML2.content },
      { identifier: '1-4', content: FTML2.content },
      { identifier: '1-5', content: SEML2.content },
      { identifier: '1-6', content: CSML2.content },
      { identifier: '2-0', content: ACTIVITY1.newElements.SC.content },
      { identifier: '2-1', content: ACTIVITY1.newElements.MC.content },
      { identifier: '2-2', content: ACTIVITY1.newElements.KP.content },
    ]
    for (const { identifier, content } of allElements) {
      await page.getByTestId(`live-quiz-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`live-quiz-template-element-${identifier}`).click()
    }

    // Submit and verify
    await page.getByTestId('live-quiz-template-submit').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${ACTIVITY1.name}`)
    ).toBeVisible()
  })

  test('Verify new block 3 elements were added to the library', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    for (const title of [
      ACTIVITY1.newElements.SC.title,
      ACTIVITY1.newElements.MC.title,
      ACTIVITY1.newElements.KP.title,
    ]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId(`element-item-${title}`)).toBeVisible()
      await page.getByTestId('elements-search-input').clear()
    }
  })

  test('Execute activity 1 - start quiz and first block', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${ACTIVITY1.name}`)
    ).toBeVisible()
    await page.getByTestId(`start-live-quiz-${ACTIVITY1.name}`).click()
    await page.getByTestId('next-block-timeline').click()
  })

  test('Activity 1 - Student answers block 1 questions', async ({
    page,
    loginStudentPassword,
  }) => {
    await loginStudentPassword(STUDENT_USERNAME)
    await page.getByText(ACTIVITY1.displayName).click()

    // SC (index 0)
    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + SC.content)).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // MC (index 1)
    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + MC.content)).toBeVisible()
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // KP (index 2)
    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + KP.content)).toBeVisible()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // NR (index 3)
    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + NR.content)).toBeVisible()
    await page.getByTestId('input-numerical-3').clear()
    await page.getByTestId('input-numerical-3').fill(NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // FT (index 4)
    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + FT.content)).toBeVisible()
    await page.getByTestId('free-text-input-4').fill(FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    // SE (index 5)
    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + SE.content)).toBeVisible()
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
  })

  test('Activity 1 - Advance to block 2', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY1.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Activity 1 - Student answers block 2 questions (v2 replacements)', async ({
    page,
    loginStudentPassword,
  }) => {
    await loginStudentPassword(STUDENT_USERNAME)
    await page.getByText(ACTIVITY1.displayName).click()

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + SCML2.content)).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + MCML2.content)).toBeVisible()
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + KPML2.content)).toBeVisible()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + NRML2.content)).toBeVisible()
    await page.getByTestId('input-numerical-3').clear()
    await page.getByTestId('input-numerical-3').fill(NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + FTML2.content)).toBeVisible()
    await page.getByTestId('free-text-input-4').fill(FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(page.locator('text=' + SEML2.content)).toBeVisible()
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
  })

  test('Activity 1 - Advance to block 3', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY1.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Activity 1 - Student answers block 3 questions (new elements)', async ({
    page,
    loginStudentPassword,
  }) => {
    await loginStudentPassword(STUDENT_USERNAME)
    await page.getByText(ACTIVITY1.displayName).click()

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(
      page.locator('text=' + ACTIVITY1.newElements.SC.content)
    ).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(
      page.locator('text=' + ACTIVITY1.newElements.MC.content)
    ).toBeVisible()
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('student-submit-answer')).toBeDisabled()
    await expect(
      page.locator('text=' + ACTIVITY1.newElements.KP.content)
    ).toBeVisible()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
  })

  test('Verify evaluation content and close activity 1', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY1.name}`).click()
    await page.waitForTimeout(1000)

    const url = page.url()
    const quizId = url.split('/')[4]
    await page.goto(`http://127.0.0.1:3002/quizzes/${quizId}/evaluation`)

    // Verify expected questions appear in order
    const evalContents = [
      SC.content,
      MC.content,
      KP.content,
      NR.content,
      FT.content,
      SE.content,
      CS.content,
      SCML2.content,
      MCML2.content,
      KPML2.content,
      NRML2.content,
      FTML2.content,
      SEML2.content,
      CSML2.content,
    ]
    for (const content of evalContents) {
      await expect(page.locator(`text=${content}`)).toBeVisible()
      await page.getByTestId('evaluate-next-question').click()
    }

    // New elements require clicking "show results"
    await expect(
      page.locator(`text=${ACTIVITY1.newElements.SC.content}`)
    ).not.toBeVisible()
    await page.getByTestId('show-results-evaluation').click()
    await expect(
      page.locator(`text=${ACTIVITY1.newElements.SC.content}`)
    ).toBeVisible()
    await page.getByTestId('evaluate-next-question').click()

    await page.getByTestId('show-results-evaluation').click()
    await expect(
      page.locator(`text=${ACTIVITY1.newElements.MC.content}`)
    ).toBeVisible()
    await page.getByTestId('evaluate-next-question').click()

    await page.getByTestId('show-results-evaluation').click()
    await expect(
      page.locator(`text=${ACTIVITY1.newElements.KP.content}`)
    ).toBeVisible()

    // End the live quiz
    await page.goto('http://127.0.0.1:3002')
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY1.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Pro1 opens template 2 from restricted catalog and creates activity 2', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByTestId(`catalog-object-${CATALOG.name}`).click()
    await page
      .getByTestId(`actions-dropdown-${LIVE_QUIZ.template2.name}`)
      .click()
    await page.getByTestId(`use-template-${LIVE_QUIZ.template2.name}`).click()

    // Settings
    await page.getByTestId('live-quiz-template-settings').click()
    await expect(page.getByTestId('template-live-quiz-name')).toHaveValue(
      LIVE_QUIZ.template2.name
    )
    await page.getByTestId('template-live-quiz-name').clear()
    await page.getByTestId('template-live-quiz-name').fill(ACTIVITY2.name)
    await page.getByTestId('template-live-quiz-display-name').clear()
    await page
      .getByTestId('template-live-quiz-display-name')
      .fill(ACTIVITY2.displayName)
    await page.getByTestId('submit-template-settings').click()

    // Block 0: check available elements (only pro1's version 3 elements are available)
    // and accept original content
    const block0ProVerify = [
      {
        identifier: '0-0',
        content: SC.content,
        available: SC3.title,
        unavailable: SC.title,
      },
      {
        identifier: '0-1',
        content: MC.content,
        available: MC3.title,
        unavailable: MC.title,
      },
      {
        identifier: '0-2',
        content: KP.content,
        available: KP3.title,
        unavailable: KP.title,
      },
      {
        identifier: '0-3',
        content: NR.content,
        available: NR3.title,
        unavailable: NR.title,
      },
      {
        identifier: '0-4',
        content: FT.content,
        available: FT3.title,
        unavailable: FT.title,
      },
      {
        identifier: '0-5',
        content: SE.content,
        available: SE3.title,
        unavailable: SE.title,
      },
      {
        identifier: '0-6',
        content: CS.content,
        available: CS3.title,
        unavailable: CS.title,
      },
    ]
    for (const {
      identifier,
      content,
      available,
      unavailable,
    } of block0ProVerify) {
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      await expect(
        page.getByTestId(`select-existing-element-${available}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`select-existing-element-${unavailable}`)
      ).not.toBeVisible()
      // Select the available element but accept template version
      await page.getByTestId(`select-existing-element-${available}`).click()
      await page.getByTestId('confirm-select-existing-element').click()
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Block 1: create custom new elements
    const block1NewElements = [
      {
        identifier: '1-0',
        title: SCML.title,
        newTitle: ACTIVITY2.newElements.SC.title,
        newContent: ACTIVITY2.newElements.SC.content,
      },
      {
        identifier: '1-1',
        title: MCML.title,
        newTitle: ACTIVITY2.newElements.MC.title,
        newContent: ACTIVITY2.newElements.MC.content,
      },
      {
        identifier: '1-2',
        title: KPML.title,
        newTitle: ACTIVITY2.newElements.KP.title,
        newContent: ACTIVITY2.newElements.KP.content,
      },
      {
        identifier: '1-3',
        title: NRML.title,
        newTitle: ACTIVITY2.newElements.NR.title,
        newContent: ACTIVITY2.newElements.NR.content,
      },
      {
        identifier: '1-4',
        title: FTML.title,
        newTitle: ACTIVITY2.newElements.FT.title,
        newContent: ACTIVITY2.newElements.FT.content,
      },
      {
        identifier: '1-5',
        title: SEML.title,
        newTitle: ACTIVITY2.newElements.SE.title,
        newContent: ACTIVITY2.newElements.SE.content,
      },
      {
        identifier: '1-6',
        title: CSML.title,
        newTitle: ACTIVITY2.newElements.CS.title,
        newContent: ACTIVITY2.newElements.CS.content,
      },
    ]
    for (const {
      identifier,
      title,
      newTitle,
      newContent,
    } of block1NewElements) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page
        .getByTestId(`create-new-element-template-${identifier}`)
        .click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(title)
      await page.waitForTimeout(1000)
      // Verify no sample solution or multiplier available for template elements
      await expect(
        page.getByTestId('configure-sample-solution')
      ).not.toBeVisible()
      await expect(page.getByTestId('element-tag-input')).not.toBeVisible()
      await expect(page.getByTestId('select-multiplier')).not.toBeVisible()
      await page.getByTestId('insert-question-title').clear()
      await page.getByTestId('insert-question-title').fill(newTitle)
      await page.getByTestId('insert-question-text').click()
      await page.getByTestId('insert-question-text').clear()
      await page
        .getByTestId('insert-question-text')
        .pressSequentially(newContent)
      await page.getByTestId('save-new-question').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        newContent
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Block 2: replace with pro1's version 3 AFML elements
    const block2Replacements = [
      {
        identifier: '2-0',
        content: SCMLAF.content,
        available: SCMLAF3.title,
        contentNew: SCMLAF3.content,
      },
      {
        identifier: '2-1',
        content: MCMLAF.content,
        available: MCMLAF3.title,
        contentNew: MCMLAF3.content,
      },
      {
        identifier: '2-2',
        content: KPMLAF.content,
        available: KPMLAF3.title,
        contentNew: KPMLAF3.content,
      },
    ]
    for (const {
      identifier,
      content,
      available,
      contentNew,
    } of block2Replacements) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      await expect(
        page.getByTestId(`select-existing-element-${available}`)
      ).toBeVisible()
      await page.getByTestId(`select-existing-element-${available}`).click()
      await page.getByTestId('confirm-select-existing-element').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        contentNew
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Submit
    await page.getByTestId('live-quiz-template-submit').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${ACTIVITY2.name}`)
    ).toBeVisible()
  })

  test('Verify permissions and elements were created for activity 2 (pro1)', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()

    // Template instances should exist as elements
    for (const title of [
      SC.title,
      MC.title,
      KP.title,
      NR.title,
      FT.title,
      SE.title,
      CS.title,
    ]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId(`element-item-${title}`)).toBeVisible()
      await page.getByTestId('elements-search-input').clear()
    }

    // New elements from template
    for (const title of [
      ACTIVITY2.newElements.SC.title,
      ACTIVITY2.newElements.MC.title,
      ACTIVITY2.newElements.KP.title,
      ACTIVITY2.newElements.NR.title,
      ACTIVITY2.newElements.FT.title,
      ACTIVITY2.newElements.SE.title,
      ACTIVITY2.newElements.CS.title,
    ]) {
      await page.getByTestId('elements-search-input').fill(title)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId(`element-item-${title}`)).toBeVisible()
      await page.getByTestId('elements-search-input').clear()
    }

    // Answer collection from template should have READ permissions
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expect(
      page.getByTestId(`answer-collection-${COLLECTION1.name}`)
    ).toContainText('READ')
    await expect(
      page.getByTestId(`answer-collection-${COLLECTION3.name}`)
    ).toBeVisible()
  })

  test('Execute activity 2 (pro1) and verify blocks', async ({
    page,
    loginIndividualCatalyst,
    loginStudentPassword,
    logoutUser,
  }) => {
    // Start activity 2
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${ACTIVITY2.name}`)
    ).toBeVisible()
    await page.getByTestId(`start-live-quiz-${ACTIVITY2.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await logoutUser()

    // Student answers block 1
    await loginStudentPassword(STUDENT_USERNAME)
    await page.getByText(ACTIVITY2.displayName).click()

    await expect(page.locator('text=' + SC.content)).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + MC.content)).toBeVisible()
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + KP.content)).toBeVisible()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + NR.content)).toBeVisible()
    await page.getByTestId('input-numerical-3').clear()
    await page.getByTestId('input-numerical-3').fill(NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + FT.content)).toBeVisible()
    await page.getByTestId('free-text-input-4').fill(FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + SE.content)).toBeVisible()
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await logoutUser()

    // Advance to block 2
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY2.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await logoutUser()

    // Student answers block 2 (new elements)
    await loginStudentPassword(STUDENT_USERNAME)
    await page.getByText(ACTIVITY2.displayName).click()

    await expect(
      page.locator('text=' + ACTIVITY2.newElements.SC.content)
    ).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(
      page.locator('text=' + ACTIVITY2.newElements.MC.content)
    ).toBeVisible()
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(
      page.locator('text=' + ACTIVITY2.newElements.KP.content)
    ).toBeVisible()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(
      page.locator('text=' + ACTIVITY2.newElements.NR.content)
    ).toBeVisible()
    await page.getByTestId('input-numerical-3').clear()
    await page
      .getByTestId('input-numerical-3')
      .fill(ACTIVITY2.newElements.NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(
      page.locator('text=' + ACTIVITY2.newElements.FT.content)
    ).toBeVisible()
    await page
      .getByTestId('free-text-input-4')
      .fill(ACTIVITY2.newElements.FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(
      page.locator('text=' + ACTIVITY2.newElements.SE.content)
    ).toBeVisible()
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await logoutUser()

    // Advance to block 3
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY2.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await logoutUser()

    // Student answers block 3 (SCMLAF3, MCMLAF3, KPMLAF3)
    await loginStudentPassword(STUDENT_USERNAME)
    await page.getByText(ACTIVITY2.displayName).click()

    await expect(page.locator('text=' + SCMLAF3.content)).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + MCMLAF3.content)).toBeVisible()
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=' + KPMLAF3.content)).toBeVisible()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await logoutUser()

    // Verify evaluation content and end quiz
    await loginIndividualCatalyst()
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY2.name}`).click()
    await page.waitForTimeout(1000)

    const url = page.url()
    const quizId = url.split('/')[4]
    await page.goto(`http://127.0.0.1:3002/quizzes/${quizId}/evaluation`)

    const evalContents = [
      SC.content,
      MC.content,
      KP.content,
      NR.content,
      FT.content,
      SE.content,
      CS.content,
      ACTIVITY2.newElements.SC.content,
      ACTIVITY2.newElements.MC.content,
      ACTIVITY2.newElements.KP.content,
      ACTIVITY2.newElements.NR.content,
      ACTIVITY2.newElements.FT.content,
      ACTIVITY2.newElements.SE.content,
      ACTIVITY2.newElements.CS.content,
    ]
    for (const content of evalContents) {
      await expect(page.locator(`text=${content}`)).toBeVisible()
      await page.getByTestId('evaluate-next-question').click()
    }

    // Active elements need confirmation
    await expect(page.locator(`text=${SCMLAF3.content}`)).not.toBeVisible()
    await page.getByTestId('show-results-evaluation').click()
    await expect(page.locator(`text=${SCMLAF3.content}`)).toBeVisible()
    await page.getByTestId('evaluate-next-question').click()
    await page.getByTestId('show-results-evaluation').click()
    await expect(page.locator(`text=${MCMLAF3.content}`)).toBeVisible()
    await page.getByTestId('evaluate-next-question').click()
    await page.getByTestId('show-results-evaluation').click()
    await expect(page.locator(`text=${KPMLAF3.content}`)).toBeVisible()

    // End quiz
    await page.goto('http://127.0.0.1:3002')
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${ACTIVITY2.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })
})

// ─── Part 3: Use template with inline answer collection definitions ────────────

test.describe('Part 3: Use template with inline answer collection definitions', () => {
  test('Pro2 opens template 1 from catalog and creates activity 3 with inline collections', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()

    await page.getByTestId(`catalog-object-${LIVE_QUIZ.template1.name}`).click()

    // Settings
    await page.getByTestId('live-quiz-template-settings').click()
    await page.getByTestId('template-live-quiz-name').clear()
    await page.getByTestId('template-live-quiz-name').fill(ACTIVITY3.name)
    await page.getByTestId('template-live-quiz-display-name').clear()
    await page
      .getByTestId('template-live-quiz-display-name')
      .fill(ACTIVITY3.displayName)
    await page.getByTestId('submit-template-settings').click()

    // Accept elements 0-0 through 0-4
    for (const identifier of ['0-0', '0-1', '0-2', '0-3', '0-4']) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Modify SE element with inline answer collection
    await page.getByTestId(`create-new-element-template-0-5`).click()
    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(ACTIVITY3.SETitle)
    await page.getByTestId('create-inline-answer-collection').click()
    for (const option of COLLECTION1.options) {
      await page.locator('#inline-answer-collection-options').fill(`${option}`)
      await page.locator('#inline-answer-collection-options').press('Enter')
    }
    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await page.getByTestId('configure-number-of-inputs').fill('2')
    await page.getByTestId('save-new-question').click()
    await page.getByTestId(`next-template-element-0-5`).click()

    // Modify CS element with inline answer collection
    await page.getByTestId(`create-new-element-template-0-6`).click()
    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(ACTIVITY3.CSTitle)
    await page.getByTestId('create-inline-answer-collection').click()
    for (const option of COLLECTION2.options) {
      await page.locator('#inline-answer-collection-options').fill(`${option}`)
      await page.locator('#inline-answer-collection-options').press('Enter')
    }
    await page.getByTestId('save-new-question').click()
    await page.getByTestId(`next-template-element-0-6`).click()

    // Accept all remaining elements
    for (const identifier of [
      '1-0',
      '1-1',
      '1-2',
      '1-3',
      '1-4',
      '1-5',
      '1-6',
      '2-0',
      '2-1',
      '2-2',
    ]) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }

    // Submit
    await page.getByTestId('live-quiz-template-submit').click()
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${ACTIVITY3.name}`)
    ).toBeVisible()
  })

  test('Verify elements and inline answer collections were created correctly', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()

    // Verify SE element (inline collection, cannot switch to manual)
    await page.getByTestId('elements-search-input').fill(ACTIVITY3.SETitle)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${ACTIVITY3.SETitle}`)
    ).toBeVisible()
    await page.getByTestId(`edit-element-${ACTIVITY3.SETitle}`).click()
    await expect(
      page.getByTestId('create-inline-answer-collection')
    ).not.toBeVisible()
    await page.locator('[id="selection-0-field-0"]').click()
    for (const value of COLLECTION1.options) {
      await expect(page.getByText(value)).toBeVisible()
    }
    await page.getByTestId('close-element-modal').click()

    // Verify CS element (inline collection, cannot switch to manual)
    await page.getByTestId('elements-search-input').fill(ACTIVITY3.CSTitle)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${ACTIVITY3.CSTitle}`)
    ).toBeVisible()
    await page.getByTestId(`edit-element-${ACTIVITY3.CSTitle}`).click()
    await expect(
      page.getByTestId('create-inline-answer-collection')
    ).not.toBeVisible()
    for (const item of COLLECTION2.options) {
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }
    await page.getByTestId('close-element-modal').click()

    // Verify answer collection created from SE element
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    const seCollection = `AC: ${ACTIVITY3.SETitle}`
    await page.getByTestId(`answer-collection-actions-${seCollection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await page.getByTestId('open-answer-collection-options').click()
    for (const item of COLLECTION1.options) {
      await expect(
        page.getByTestId(`delete-answer-option-${item}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${item}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()

    // Verify answer collection created from CS element
    const csCollection = `AC: ${ACTIVITY3.CSTitle}`
    await page.getByTestId(`answer-collection-actions-${csCollection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await page.getByTestId('open-answer-collection-options').click()
    for (const item of COLLECTION2.options) {
      await expect(
        page.getByTestId(`delete-answer-option-${item}`)
      ).toBeDisabled()
      await expect(
        page.getByTestId(`edit-answer-option-${item}`)
      ).not.toBeDisabled()
    }
    await page.getByTestId('close-answer-collection-edit-modal').click()
  })
})

// ─── Cleanup ──────────────────────────────────────────────────────────────────

test.describe('Cleanup', () => {
  test('Delete all created templates', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    // Delete template 1 (cancel first, then confirm)
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template1.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${LIVE_QUIZ.template1.name}`)
      .click()
    await page.getByTestId('cancel-deletion').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template1.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${LIVE_QUIZ.template1.name}`)
      .click()
    await page.getByTestId('confirm-template-deletion').click()
    await page.waitForTimeout(500)

    // Delete template 2
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template2.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${LIVE_QUIZ.template2.name}`)
      .click()
    await page.getByTestId('confirm-template-deletion').click()
    await page.waitForTimeout(500)
  })
})
