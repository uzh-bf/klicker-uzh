/**
 * U-catalog.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/U-catalog-workflow.cy.ts
 *
 * Tests catalog collections, answer collections, live quiz templates,
 * selection elements, object sharing, user groups and their permissions.
 *
 * Parts:
 *   1. Creation of Catalog Collections and Content
 *   2. Sharing of Catalog Collections
 *   3. Object Sharing / Permission verification
 *   4. User Groups (create, edit, leave, promote/demote, remove, transfer ownership, delete)
 *   Cleanup
 */

import { type Page } from '@playwright/test'
import {
  LECTURER_EMAIL,
  LECTURER_IND_EMAIL,
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_EMAIL,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST_EMAIL,
  LECTURER_INST_SHORTNAME,
  LECTURER_SHORTNAME,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture data ─────────────────────────────────────────────────────────────

const AC1 = {
  name: 'AC1',
  description: 'This is an answer collection',
  items: [
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
  ],
}

const AC2 = {
  name: 'AC2',
  description: 'This is an answer collection',
  items: [
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
    'Twenty',
  ],
}

const LIVE_QUIZ = {
  name: 'Live Quiz',
  displayName: 'Live Quiz',
  course: 'Testkurs',
  template: {
    name: 'Live Quiz Template',
    description: 'This is a live quiz template',
    instructions: 'With this template you can create a live quiz',
  },
}

const SC = {
  title: 'SC Title Test 1 (Version 1)',
  content: 'SC Question Content 1',
  choices: [{ value: '50%' }, { value: '100%' }],
}

const SCML = {
  title: 'SC Title Test 2 (Version 1)',
  content: 'SC Question Content 2',
  choices: [{ value: '50%', correct: true }, { value: '100%' }],
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

const CC_PUBLIC = 'Public Catalog Collection'
const CC_RESTRICTED = 'Restricted Catalog Collection'
const CC_RESTRICTED2 = 'Second Catalog Collection'

const USER_GROUP = {
  name: 'User Group TEST',
  nameNew: 'User Group NEW',
}

// Sharing groups for catalog collection group permissions
const GROUP_1 = 'Group 1'
const GROUP_2 = 'Group 2'
const GROUP_3 = 'Group 3'

// i18n label constants (mirrors packages/i18n/messages/en)
const ACCESS_PUBLIC = 'PUBLIC'
const ACCESS_RESTRICTED = 'RESTRICTED'
const ACCESS_GRANTED = 'ACCESS GRANTED'
const PERM_ADMIN = 'Admin'
const PERM_WRITE = 'Write'
const PERM_READ = 'Read'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToCatalog(page: Page): Promise<void> {
  await page.getByTestId('resources').click()
  await page.getByTestId('catalog').click()
}

async function navigateToAnswerCollections(page: Page): Promise<void> {
  await page.getByTestId('resources').click()
  await page.getByTestId('answer-collections').click()
}

async function navigateToUserGroups(page: Page): Promise<void> {
  await page.getByTestId('resources').click()
  await page.getByTestId('user-groups').click()
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
    if (i > 0) {
      await page.getByTestId('add-answer-collection-entry').click()
    }
    await page.getByTestId(`answer-collection-entry-${i}`).fill(items[i])
  }
  await page.getByTestId('submit-answer-collection').click()
  await page.waitForTimeout(500)
}

async function createSCQuestion(
  page: Page,
  title: string,
  content: string,
  choices: { value: string; correct?: boolean }[]
): Promise<void> {
  await page.getByTestId('create-question').click()
  // Default type is SC
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  for (let i = 0; i < choices.length; i++) {
    if (i > 0) {
      await page.getByTestId('add-new-answer').click()
    }
    await page.getByTestId(`insert-answer-field-${i}`).fill(choices[i].value)
    if (choices[i].correct) {
      await page.getByTestId(`set-correctness-${i}`).click()
    }
  }
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

async function createSEQuestion(
  page: Page,
  title: string,
  content: string,
  collectionName: string,
  numberOfInputs: number
): Promise<void> {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId('select-question-type-Selection (SE)').click()
  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('select-question-status').click()
  await page.getByTestId('select-question-status-Ready').click()
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)
  // Select the answer collection
  await page.getByTestId('select-answer-collection').click()
  await page.getByTestId(`select-answer-collection-${collectionName}`).click()
  // Set number of inputs
  await page.getByTestId('set-number-of-inputs').fill(String(numberOfInputs))
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(500)
}

async function createLiveQuizWithBlock(
  page: Page,
  name: string,
  displayName: string,
  courseName: string,
  questionTitles: string[]
): Promise<void> {
  await page.getByTestId('create-live-quiz').click()
  await page.getByTestId('insert-live-quiz-name').fill(name)
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('insert-live-display-name').fill(displayName)
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('select-course').click()
  await page.getByTestId(`select-course-${courseName}`).click()
  await page.getByTestId('next-or-submit').click()
  for (const title of questionTitles) {
    await page.getByTestId('search-element-input').fill(title)
    await page.getByTestId(`add-element-${title}`).click()
  }
  await page.getByTestId('next-or-submit').click()
  await page.waitForTimeout(500)
}

async function grantCatalogCollectionPermission(
  page: Page,
  collectionName: string,
  usernameOrEmail: string,
  permissionLabel: string
): Promise<void> {
  await page.getByTestId(`catalog-collection-${collectionName}-actions`).click()
  await page.getByTestId('share-catalog-collection').click()
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(usernameOrEmail)
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(permissionLabel).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await page.getByTestId('close-share-object').click()
}

async function grantCatalogCollectionGroupPermission(
  page: Page,
  groupName: string,
  permissionLabel: string
): Promise<void> {
  await page.getByTestId('new-permission-user-group').click()
  await page.getByText(groupName, { exact: true }).click()
  await page.getByTestId('new-permission-access-level').click()
  await page.getByText(permissionLabel).click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
}

async function addObjectToCatalog(
  page: Page,
  objectType: string,
  accessType: 'public' | 'restricted',
  optionIndex: number
): Promise<void> {
  await page.getByTestId('add-object-to-catalog-button').click()
  await page.getByTestId('object-type-selection').click()
  await page.getByTestId(`object-type-${objectType}`).click()
  await page.getByTestId('modal-object-access').click()
  await page.getByTestId(`object-access-${accessType}`).click()
  await page.locator('[id="object-selection-catalog-addition"]').click()
  await page
    .locator(
      `[id="react-select-object-selection-catalog-addition-option-${optionIndex}"]`
    )
    .click()
  await page.getByTestId('submit-add-object-button').click()
  await page.waitForTimeout(500)
}

// ─── Part 1: Creation of Catalog Collections and Content ─────────────────────

test.describe('Part 1: Creation of Catalog Collections and Content', () => {
  test('Create a new answer collection AC1 in the lecturer account', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(page, AC1.name, AC1.description, AC1.items)
    await expect(
      page.getByTestId(`answer-collection-${AC1.name}`)
    ).toBeVisible()
  })

  test('Create a new answer collection AC2 in the pro1 account', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(page, AC2.name, AC2.description, AC2.items)
    await expect(
      page.getByTestId(`answer-collection-${AC2.name}`)
    ).toBeVisible()
  })

  test('Create two new selection questions in the pro1 account', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await createSEQuestion(
      page,
      SEML.title,
      SEML.content,
      AC2.name,
      SEML.inputs
    )
    // Validate element
    await page.getByTestId('elements-search-input').fill(SEML.title)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`element-item-${SEML.title}`)).toBeVisible()
    await page.getByTestId('elements-search-input').clear()

    await createSEQuestion(
      page,
      SEML2.title,
      SEML2.content,
      AC2.name,
      SEML2.inputs
    )
    await page.getByTestId('elements-search-input').fill(SEML2.title)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`element-item-${SEML2.title}`)).toBeVisible()
    await page.getByTestId('elements-search-input').clear()
  })

  test('Create the questions required for the test workflow (SC/SCML)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await createSCQuestion(page, SC.title, SC.content, SC.choices)
    await createSCQuestion(page, SCML.title, SCML.content, SCML.choices)
  })

  test('Create a live quiz and convert it to a template', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await createLiveQuizWithBlock(
      page,
      LIVE_QUIZ.name,
      LIVE_QUIZ.displayName,
      LIVE_QUIZ.course,
      [SC.title, SCML.title]
    )
    await page.getByTestId('open-activity-overview').click()
    await page.waitForTimeout(500)

    // Convert live quiz to template
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.name}`).click()
    await page.getByTestId(`convert-to-template-${LIVE_QUIZ.name}`).click()
    await page.getByTestId('template-name').fill(LIVE_QUIZ.template.name)
    await page
      .getByTestId('template-description')
      .fill(LIVE_QUIZ.template.description)
    await page
      .getByTestId('template-instructions')
      .fill(LIVE_QUIZ.template.instructions)
    await page.getByTestId('submit-template-conversion').click()
    await page.waitForTimeout(500)
  })

  test('Share the answer collection AC1 with other users (ADMIN/WRITE/READ)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)

    await page.getByTestId(`answer-collection-actions-${AC1.name}`).click()
    await page.getByTestId('share-answer-collection').click()

    // ADMIN for pro1
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_ADMIN, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_ADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)

    // WRITE for pro2
    await page.getByTestId('new-permission-username-or-email').clear()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_INST_EMAIL)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_WRITE, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_WRITE
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
    ).toContainText(PERM_WRITE)

    // READ for pro3
    await page.getByTestId('new-permission-username-or-email').clear()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_INST2_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_READ, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_READ
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
    ).toContainText(PERM_READ)
  })

  test('Create public and restricted catalog collections', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Create public catalog collection
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').fill(CC_PUBLIC)
    await expect(page.getByTestId('modal-object-access')).toContainText(
      ACCESS_PUBLIC
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toContainText(
      ACCESS_PUBLIC
    )

    // Create restricted catalog collection
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').fill(CC_RESTRICTED)
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      ACCESS_RESTRICTED
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).toContainText(ACCESS_RESTRICTED)
  })

  test('Verify correct visibility of catalog collections to users (empty public not visible to others)', async ({
    page,
    loginLecturer,
    loginIndividualCatalyst,
    logoutUser,
  }) => {
    // Lecturer sees both
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).toBeVisible()
    await logoutUser()

    // pro1 doesn't see empty public CC, but sees restricted (to request access)
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${CC_PUBLIC}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).toBeVisible()
  })

  test('Add AC1 to both catalog collections', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Add AC1 as public to public CC
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_PUBLIC
    )
    await addObjectToCatalog(page, 'ANSWER_COLLECTION', 'public', 0)
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_PUBLIC
    )

    // Add AC1 as public to restricted CC
    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED
    )
    await addObjectToCatalog(page, 'ANSWER_COLLECTION', 'public', 0)
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_PUBLIC
    )
  })

  test('Verify that both catalog collections are visible to all users after adding content', async ({
    page,
    loginLecturer,
    loginIndividualCatalyst,
    logoutUser,
  }) => {
    // Lecturer sees both
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).toBeVisible()
    await logoutUser()

    // pro1 sees both; public CC reveals content, restricted CC opens request modal
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).toBeVisible()

    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toBeVisible()

    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId('confirm-request-access')).toBeVisible()
  })
})

// ─── Part 2: Sharing of Catalog Collections ───────────────────────────────────

test.describe('Part 2: Sharing of Catalog Collections', () => {
  test('Request access to CCRestricted from pro1', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await page.getByTestId('confirm-request-access').click()
    // After request, the actions button should not exist
    await expect(
      page.getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
    ).not.toBeVisible()
  })

  test('Share CCRestricted via request approval (WRITE for pro1) and direct sharing (ADMIN for pro2, READ for pro3)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Approve request for pro1 with WRITE permission
    await expect(
      page.getByTestId(`approve-sharing-request-${CC_RESTRICTED}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`deny-sharing-request-${CC_RESTRICTED}-pro1`)
    ).toBeVisible()
    await page
      .getByTestId(`approve-sharing-request-${CC_RESTRICTED}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      PERM_READ
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-WRITE').click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      PERM_WRITE
    )
    await page.getByTestId('confirm-approval').click()

    // Share directly with pro2 (ADMIN)
    await page
      .getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
      .click()
    await page.getByTestId('share-catalog-collection').click()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_INST_EMAIL)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_ADMIN, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_ADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)

    // Share directly with pro3 (READ)
    await page.getByTestId('new-permission-username-or-email').clear()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_INST2_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_READ, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_READ
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
    ).toContainText(PERM_READ)
  })

  test('Share CCPublic with user pro1 (ADMIN permissions)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`).click()
    await page.getByTestId('share-catalog-collection').click()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_ADMIN, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_ADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(PERM_ADMIN)
  })

  test('Add AC2 (restricted) to both catalog collections via pro1 (WRITE/ADMIN permissions)', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Add AC2 as restricted to public CC
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_PUBLIC
    )
    await addObjectToCatalog(page, 'ANSWER_COLLECTION', 'restricted', 1)
    await expect(page.getByTestId(`catalog-object-${AC2.name}`)).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC2.name}`)).toContainText(
      ACCESS_RESTRICTED
    )

    // Add AC2 as restricted to restricted CC
    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED
    )
    await addObjectToCatalog(page, 'ANSWER_COLLECTION', 'restricted', 1)
    await expect(page.getByTestId(`catalog-object-${AC2.name}`)).toContainText(
      ACCESS_RESTRICTED
    )
  })

  test('Add live quiz template to both catalog collections (public)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Add to public CC
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_PUBLIC
    )
    await addObjectToCatalog(page, 'LIVE_QUIZ_TEMPLATE', 'public', 0)
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template.name}`)
    ).toContainText(ACCESS_PUBLIC)

    // Add to restricted CC
    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED
    )
    await addObjectToCatalog(page, 'LIVE_QUIZ_TEMPLATE', 'public', 0)
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template.name}`)
    ).toContainText(ACCESS_PUBLIC)
  })

  test('Add selection questions to catalog collections and top-level catalog (via pro1)', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Add SEML (restricted) and SEML2 (public) to top-level
    await addObjectToCatalog(page, 'ELEMENT', 'restricted', 0)
    await expect(page.getByTestId(`catalog-object-${SEML.title}`)).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${SEML.title}`)
    ).toContainText(ACCESS_RESTRICTED)

    await addObjectToCatalog(page, 'ELEMENT', 'public', 1)
    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toContainText(ACCESS_PUBLIC)

    // Add both to public CC
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_PUBLIC
    )
    await addObjectToCatalog(page, 'ELEMENT', 'restricted', 0)
    await expect(page.getByTestId(`catalog-object-${SEML.title}`)).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${SEML.title}`)
    ).toContainText(ACCESS_RESTRICTED)

    await addObjectToCatalog(page, 'ELEMENT', 'public', 1)
    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toContainText(ACCESS_PUBLIC)

    // Add both to restricted CC
    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED
    )
    await addObjectToCatalog(page, 'ELEMENT', 'restricted', 0)
    await expect(page.getByTestId(`catalog-object-${SEML.title}`)).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${SEML.title}`)
    ).toContainText(ACCESS_RESTRICTED)

    await addObjectToCatalog(page, 'ELEMENT', 'public', 1)
    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toContainText(ACCESS_PUBLIC)
  })

  test('Verify permissions on catalog collections for lecturer (owner)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Verify owner privileges on CC_PUBLIC: can share, transfer ownership, delete, edit
    await page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`).click()
    await page.getByTestId('share-catalog-collection').click()
    await expect(
      page.getByTestId('new-permission-username-or-email')
    ).toBeVisible()
    await expect(page.getByTestId('transfer-ownership')).toBeVisible()
    await page.getByTestId('close-share-object').click()

    await page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`).click()
    await page.getByTestId('delete-catalog-collection').click()
    await page.getByTestId('cancel-delete-collection').click()

    // Rename and rename back
    await page
      .getByTestId(`change-catalog-collection-name-${CC_PUBLIC}`)
      .click()
    await page.getByTestId('insert-catalog-collection-name').click()
    await page.getByTestId('insert-catalog-collection-name').clear()
    await page
      .getByTestId('insert-catalog-collection-name')
      .fill(`${CC_PUBLIC} NEW`)
    await page.getByTestId('catalog-collection-name-change-confirm').click()
    await expect(
      page.getByTestId(`catalog-object-${CC_PUBLIC} NEW`)
    ).toBeVisible()
    await page
      .getByTestId(`change-catalog-collection-name-${CC_PUBLIC} NEW`)
      .click()
    await page.getByTestId('insert-catalog-collection-name').click()
    await page.getByTestId('insert-catalog-collection-name').clear()
    await page.getByTestId('insert-catalog-collection-name').fill(CC_PUBLIC)
    await page.getByTestId('catalog-collection-name-change-confirm').click()
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toBeVisible()

    // Navigate into CC_PUBLIC and verify content
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_PUBLIC
    )
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await page.getByTestId(`remove-object-${AC1.name}`).click()
    await page.getByTestId('cancel-removal').click()

    await expect(page.getByTestId(`catalog-object-${AC2.name}`)).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC2.name}`)).toContainText(
      ACCESS_RESTRICTED
    )
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await page.getByTestId(`remove-object-${AC2.name}`).click()
    await page.getByTestId('cancel-removal').click()

    // Verify live quiz template
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template.name}`)
    ).toContainText(ACCESS_PUBLIC)
    await page
      .getByTestId(`actions-dropdown-${LIVE_QUIZ.template.name}`)
      .click()
    await expect(
      page.getByTestId(`use-template-${LIVE_QUIZ.template.name}`)
    ).toBeVisible()
    await page.getByTestId(`remove-object-${LIVE_QUIZ.template.name}`).click()
    await page.getByTestId('cancel-removal').click()
    await page.getByTestId('leave-catalog-collection').click()

    // Verify SEML (restricted element) - lecturer has no access to AC2
    await expect(page.getByTestId(`catalog-object-${SEML.title}`)).toBeVisible()
    await page.getByTestId(`actions-dropdown-${SEML.title}`).click()
    await expect(
      page.getByTestId(`copy-object-${SEML.title}`)
    ).not.toBeVisible()
    await page.getByTestId(`request-access-${SEML.title}`).click()
    await page.getByTestId('cancel-request-access').click()

    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${SEML2.title}`).click()
    await expect(page.getByTestId(`copy-object-${SEML2.title}`)).toBeVisible()
    await page.getByTestId(`request-access-${SEML2.title}`).click()
    await page.getByTestId('cancel-request-access').click()

    // Navigate into CC_PUBLIC and check selection questions
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_PUBLIC
    )
    await expect(
      page.getByTestId(`catalog-object-${SEML.title}`)
    ).toContainText(ACCESS_RESTRICTED)
    await page.getByTestId(`actions-dropdown-${SEML.title}`).click()
    await expect(
      page.getByTestId(`copy-object-${SEML.title}`)
    ).not.toBeVisible()
    await page.getByTestId(`request-access-${SEML.title}`).click()
    await page.getByTestId('cancel-request-access').click()

    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toContainText(ACCESS_PUBLIC)
    await page.getByTestId(`actions-dropdown-${SEML2.title}`).click()
    await expect(page.getByTestId(`copy-object-${SEML2.title}`)).toBeVisible()
    await page.getByTestId(`request-access-${SEML2.title}`).click()
    await page.getByTestId('cancel-request-access').click()
    await page.getByTestId('leave-catalog-collection').click()

    // Navigate into CC_RESTRICTED
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED
    )
    await expect(
      page.getByTestId(`catalog-object-${SEML.title}`)
    ).toContainText(ACCESS_RESTRICTED)
    await page.getByTestId(`actions-dropdown-${SEML.title}`).click()
    await expect(
      page.getByTestId(`copy-object-${SEML.title}`)
    ).not.toBeVisible()
    await page.getByTestId(`request-access-${SEML.title}`).click()
    await page.getByTestId('cancel-request-access').click()

    await expect(
      page.getByTestId(`catalog-object-${SEML2.title}`)
    ).toContainText(ACCESS_PUBLIC)
    await page.getByTestId(`actions-dropdown-${SEML2.title}`).click()
    await expect(page.getByTestId(`copy-object-${SEML2.title}`)).toBeVisible()
    await page.getByTestId(`request-access-${SEML2.title}`).click()
    await page.getByTestId('cancel-request-access').click()

    // Verify owner privileges on CC_RESTRICTED
    await page.getByTestId('leave-catalog-collection').click()
    await page
      .getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
      .click()
    await page.getByTestId('share-catalog-collection').click()
    await expect(page.getByTestId('transfer-ownership')).toBeVisible()
    await expect(
      page.getByTestId('new-permission-username-or-email')
    ).toBeVisible()
    await page.getByTestId('close-share-object').click()

    await page
      .getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
      .click()
    await page.getByTestId('delete-catalog-collection').click()
    await page.getByTestId('cancel-delete-collection').click()
  })

  test('Verify permissions on catalog collections for pro1 (ADMIN on CCPublic, WRITE on CCRestricted)', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    // Test ADMIN privileges for pro1 on CC_PUBLIC
    await page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`).click()
    await page.getByTestId('share-catalog-collection').click()
    await expect(
      page.getByTestId('new-permission-username-or-email')
    ).toBeVisible()
    // pro1 is ADMIN, not owner — no transfer ownership
    await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
    await page.getByTestId('close-share-object').click()

    await page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`).click()
    await page.getByTestId('delete-catalog-collection').click()
    await page.getByTestId('cancel-delete-collection').click()

    // Rename and rename back
    await page
      .getByTestId(`change-catalog-collection-name-${CC_PUBLIC}`)
      .click()
    await page.getByTestId('insert-catalog-collection-name').click()
    await page.getByTestId('insert-catalog-collection-name').clear()
    await page
      .getByTestId('insert-catalog-collection-name')
      .fill(`${CC_PUBLIC} NEW`)
    await page.getByTestId('catalog-collection-name-change-confirm').click()
    await expect(
      page.getByTestId(`catalog-object-${CC_PUBLIC} NEW`)
    ).toBeVisible()
    await page
      .getByTestId(`change-catalog-collection-name-${CC_PUBLIC} NEW`)
      .click()
    await page.getByTestId('insert-catalog-collection-name').click()
    await page.getByTestId('insert-catalog-collection-name').clear()
    await page.getByTestId('insert-catalog-collection-name').fill(CC_PUBLIC)
    await page.getByTestId('catalog-collection-name-change-confirm').click()
    await expect(page.getByTestId(`catalog-object-${CC_PUBLIC}`)).toBeVisible()

    // Navigate into CC_PUBLIC and verify
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_PUBLIC
    )
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await page.getByTestId(`remove-object-${AC1.name}`).click()
    await page.getByTestId('cancel-removal').click()

    await expect(page.getByTestId(`catalog-object-${AC2.name}`)).toContainText(
      ACCESS_RESTRICTED
    )
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await page.getByTestId(`remove-object-${AC2.name}`).click()
    await page.getByTestId('cancel-removal').click()

    await expect(
      page.getByTestId(`catalog-object-${LIVE_QUIZ.template.name}`)
    ).toContainText(ACCESS_PUBLIC)
    await page
      .getByTestId(`actions-dropdown-${LIVE_QUIZ.template.name}`)
      .click()
    await expect(
      page.getByTestId(`use-template-${LIVE_QUIZ.template.name}`)
    ).toBeVisible()
    await page.getByTestId(`remove-object-${LIVE_QUIZ.template.name}`).click()
    await page.getByTestId('cancel-removal').click()

    // Test WRITE privileges on CC_RESTRICTED (no actions button)
    await page.getByTestId('leave-catalog-collection').click()
    await expect(
      page.getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
    ).not.toBeVisible()

    // Check that pro1 can add/remove objects in CC_PUBLIC (ADMIN)
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
  })

  test('Create second restricted catalog collection and user groups for group sharing', async ({
    page,
    loginLecturer,
    loginInstitutionalCatalyst2,
    logoutUser,
  }) => {
    // Create CC_RESTRICTED2
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').fill(CC_RESTRICTED2)
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      ACCESS_RESTRICTED
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED2}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED2}`)
    ).toContainText(ACCESS_RESTRICTED)

    // Create group 1 (lecturer OWNER, pro1 MEMBER)
    await navigateToUserGroups(page)
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP_1)
    await page
      .getByTestId('member-shortname-email-0')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${GROUP_1}`)).toBeVisible()
    await expect(page.getByTestId(`user-group-${GROUP_1}`)).toContainText(
      'Owner'
    )
    await page.getByTestId(`user-group-actions-${GROUP_1}`).click()
    await expect(page.getByTestId(`view-edit-group-${GROUP_1}`)).toBeVisible()
    await expect(page.getByTestId(`delete-group-${GROUP_1}`)).toBeVisible()
    await page.getByTestId(`view-edit-group-${GROUP_1}`).click()
    await expect(page.getByTestId('edit-group-name')).toBeVisible()
    await expect(
      page.getByTestId(`group-member-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await page.getByTestId('close-user-group-edit-modal').click()

    // Create group 2 (lecturer OWNER, pro2 ADMIN) - cancel first
    await navigateToUserGroups(page)
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP_2)
    await page.getByTestId('cancel-create-user-group').click()

    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP_2)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_INST_EMAIL)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${GROUP_2}`)).toBeVisible()
    await expect(page.getByTestId(`user-group-${GROUP_2}`)).toContainText(
      'Owner'
    )
    await page.getByTestId(`user-group-actions-${GROUP_2}`).click()
    await page.getByTestId(`view-edit-group-${GROUP_2}`).click()
    await expect(page.getByTestId('edit-group-name')).toBeVisible()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await page.getByTestId('close-user-group-edit-modal').click()
    await logoutUser()

    // Create group 3 (pro3 OWNER, lecturer MEMBER)
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)

    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP_3)
    await page.getByTestId('cancel-create-user-group').click()

    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP_3)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${GROUP_3}`)).toBeVisible()
    await expect(page.getByTestId(`user-group-${GROUP_3}`)).toContainText(
      'Owner'
    )
    await page.getByTestId(`user-group-actions-${GROUP_3}`).click()
    await page.getByTestId(`view-edit-group-${GROUP_3}`).click()
    await expect(page.getByTestId('edit-group-name')).toBeVisible()
    await expect(
      page.getByTestId(`group-member-${LECTURER_SHORTNAME}`)
    ).toBeVisible()
    await page.getByTestId('close-user-group-edit-modal').click()
  })

  test('Grant READ, WRITE and ADMIN group permissions to CC_RESTRICTED2', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page
      .getByTestId(`catalog-collection-${CC_RESTRICTED2}-actions`)
      .click()
    await page.getByTestId('share-catalog-collection').click()

    // Verify mutual exclusivity of username and user group fields
    await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_IND_SHORTNAME)
    await expect(page.getByTestId('new-permission-submit')).not.toBeDisabled()

    // Select group 1 — should clear username field
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP_1, { exact: true }).click()
    await expect(
      page.getByTestId('new-permission-username-or-email')
    ).toHaveValue('')
    await expect(page.getByTestId('new-permission-submit')).not.toBeDisabled()

    // Entering a username resets group field
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(LECTURER_INST2_SHORTNAME)
    await expect(page.getByTestId('new-permission-submit')).not.toBeDisabled()

    // Re-select group 1
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP_1, { exact: true }).click()

    // Grant READ to group 1
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_READ, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_READ
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId(`permission-${GROUP_1}`)).toBeVisible()
    await expect(page.getByTestId(`permission-${GROUP_1}`)).toContainText(
      PERM_READ
    )

    // Grant WRITE to group 2
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP_2, { exact: true }).click()
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_WRITE, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_WRITE
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId(`permission-${GROUP_2}`)).toBeVisible()
    await expect(page.getByTestId(`permission-${GROUP_2}`)).toContainText(
      PERM_WRITE
    )

    // Grant ADMIN to group 3
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP_3, { exact: true }).click()
    await page.getByTestId('new-permission-access-level').click()
    await page.getByText(PERM_ADMIN, { exact: true }).click()
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      PERM_ADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId(`permission-${GROUP_3}`)).toBeVisible()
    await expect(page.getByTestId(`permission-${GROUP_3}`)).toContainText(
      PERM_ADMIN
    )
  })

  test('Verify group 1 (READ) can open CC_RESTRICTED2 but cannot add objects', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_RESTRICTED2}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED2
    )
    await expect(
      page.getByTestId('add-object-to-catalog-button')
    ).not.toBeVisible()
  })

  test('Verify group 2 (WRITE) can open CC_RESTRICTED2 and add objects', async ({
    page,
    loginInstitutionalCatalyst,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_RESTRICTED2}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED2
    )
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
  })

  test('Verify group 3 (ADMIN) can open CC_RESTRICTED2 and add objects', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_RESTRICTED2}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      CC_RESTRICTED2
    )
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
  })
})

// ─── Part 3: Object Sharing ──────────────────────────────────────────────────

test.describe('Part 3: Object Sharing', () => {
  test('Verify pro2 without permissions on CC_PUBLIC can see and request/import content', async ({
    page,
    loginInstitutionalCatalyst,
    logoutUser,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_GRANTED
    )
    // No per-object access badge (means no extra permission dialog is shown)
    await expect(
      page.getByTestId(`${AC1.name}-object-access`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`${AC2.name}-object-access`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId('add-object-to-catalog-button')
    ).not.toBeVisible()

    // AC2 (restricted) can be requested
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await page.getByTestId(`request-access-${AC2.name}`).click()
    await page.getByTestId('cancel-request-access').click()

    // Live quiz template can be used
    await page
      .getByTestId(`actions-dropdown-${LIVE_QUIZ.template.name}`)
      .click()
    await page.getByTestId(`use-template-${LIVE_QUIZ.template.name}`).click()
    await expect(page.getByTestId('live-quiz-template-submit')).toBeVisible()

    // Navigate back to catalog
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await logoutUser()
  })

  test('Verify pro3 with READ on CC_RESTRICTED can see and request objects', async ({
    page,
    loginInstitutionalCatalyst2,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_GRANTED
    )
    await expect(
      page.getByTestId(`${AC1.name}-object-access`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`${AC2.name}-object-access`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId('add-object-to-catalog-button')
    ).not.toBeVisible()

    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await page.getByTestId(`request-access-${AC2.name}`).click()
    await page.getByTestId('cancel-request-access').click()
  })

  test('Verify object-level permissions are determined by object access (not just catalog)', async ({
    page,
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    logoutUser,
  }) => {
    // Lecturer: OWNER of AC1, no access to AC2
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await page.getByTestId(`share-object-${AC1.name}`).click()
    await expect(page.getByTestId('transfer-ownership')).toBeVisible()
    await page.getByTestId('close-share-object').click()
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await expect(page.getByTestId(`share-object-${AC2.name}`)).not.toBeVisible()
    await page.getByTestId(`request-access-${AC2.name}`).click()
    await page.getByTestId('cancel-request-access').click()

    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await page.getByTestId(`share-object-${AC1.name}`).click()
    await expect(page.getByTestId('transfer-ownership')).toBeVisible()
    await page.getByTestId('close-share-object').click()
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await expect(page.getByTestId(`share-object-${AC2.name}`)).not.toBeVisible()
    await page.getByTestId(`request-access-${AC2.name}`).click()
    await page.getByTestId('cancel-request-access').click()
    await logoutUser()

    // pro1: ADMIN on AC1 (no transfer), OWNER of AC2 (has transfer)
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await page.getByTestId(`share-object-${AC1.name}`).click()
    await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
    await page.getByTestId('close-share-object').click()
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await page.getByTestId(`share-object-${AC2.name}`).click()
    await expect(page.getByTestId('transfer-ownership')).toBeVisible()
    await page.getByTestId('close-share-object').click()

    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await page.getByTestId(`share-object-${AC1.name}`).click()
    await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
    await page.getByTestId('close-share-object').click()
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await page.getByTestId(`share-object-${AC2.name}`).click()
    await expect(page.getByTestId('transfer-ownership')).toBeVisible()
    await page.getByTestId('close-share-object').click()
    await logoutUser()

    // pro2: ADMIN on CC but without permissions on ACs
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)
    await page.getByTestId(`catalog-object-${CC_PUBLIC}`).click()
    await expect(page.getByTestId(`catalog-object-${AC1.name}`)).toContainText(
      ACCESS_GRANTED
    )
    // actions-dropdown should not exist for AC1 (insufficient permissions on object)
    await expect(
      page.getByTestId(`actions-dropdown-${AC1.name}`)
    ).not.toBeVisible()
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await expect(page.getByTestId(`share-object-${AC2.name}`)).not.toBeVisible()
    await page.getByTestId(`request-access-${AC2.name}`).click()
    await page.getByTestId('cancel-request-access').click()

    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${CC_RESTRICTED}`).click()
    await page.getByTestId(`actions-dropdown-${AC1.name}`).click()
    await expect(page.getByTestId(`share-object-${AC1.name}`)).not.toBeVisible()
    await page.getByTestId(`remove-object-${AC1.name}`).click()
    await page.getByTestId('cancel-removal').click()
    await page.getByTestId(`actions-dropdown-${AC2.name}`).click()
    await expect(page.getByTestId(`share-object-${AC2.name}`)).not.toBeVisible()
    await page.getByTestId(`remove-object-${AC2.name}`).click()
    await page.getByTestId('cancel-removal').click()
  })
})

// ─── Part 4: User Groups ─────────────────────────────────────────────────────

test.describe('Part 4: User Groups', () => {
  test('Create a user group with regular members and admins', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)

    // Cancel creation first
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(USER_GROUP.name)
    await page.getByTestId('cancel-create-user-group').click()

    // Create with multiple members
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(USER_GROUP.name)

    // pro1 as admin
    await page
      .getByTestId('member-shortname-email-0')
      .fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('member-admin-0').click()

    // pro2 as admin
    await page.getByTestId('add-member').click()
    await page.getByTestId('member-shortname-email-1').fill(LECTURER_INST_EMAIL)
    await page.getByTestId('member-admin-1').click()

    // pro3 as member
    await page.getByTestId('add-member').click()
    await page
      .getByTestId('member-shortname-email-2')
      .fill(LECTURER_INST2_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()

    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toContainText('Owner')
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await expect(
      page.getByTestId(`view-edit-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-group-${USER_GROUP.name}`)
    ).toBeVisible()

    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await expect(page.getByTestId('edit-group-name')).toBeVisible()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
  })

  test('Verify group members and admins can see the group and appropriate actions', async ({
    page,
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst2,
    logoutUser,
  }) => {
    // Owner (lecturer)
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toContainText('Owner')
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await expect(
      page.getByTestId(`view-edit-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`delete-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_SHORTNAME
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_EMAIL
    )

    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(LECTURER_IND_EMAIL)
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toContainText(LECTURER_INST_EMAIL)
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toContainText(LECTURER_INST2_EMAIL)

    await expect(
      page.getByTestId(`transfer-group-ownership-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`demote-group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`transfer-group-ownership-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`demote-group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`promote-group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await logoutUser()

    // Admin (pro1) — can edit but no transfer ownership on self
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toContainText('Admin')
    await expect(
      page.getByTestId(`view-edit-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`leave-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_SHORTNAME
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_EMAIL
    )
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(LECTURER_IND_EMAIL)
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toContainText(LECTURER_INST_EMAIL)
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toContainText(LECTURER_INST2_EMAIL)

    // pro1 cannot transfer ownership to themselves or demote/remove themselves
    await expect(
      page.getByTestId(`transfer-group-ownership-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`demote-group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`remove-group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    // But can demote pro2
    await expect(
      page.getByTestId(`transfer-group-ownership-${LECTURER_INST_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`demote-group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`promote-group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await logoutUser()

    // Member (pro3) — read-only, no modification actions, emails not shown
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toContainText('Member')
    await expect(
      page.getByTestId(`view-edit-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`leave-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_SHORTNAME
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_EMAIL
    )

    // Member sees shortnames but NOT emails of other members
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toContainText(LECTURER_IND_EMAIL)
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).not.toContainText(LECTURER_INST_EMAIL)
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).not.toContainText(LECTURER_INST2_EMAIL)

    await expect(
      page.getByTestId(`transfer-group-ownership-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`demote-group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`remove-group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`transfer-group-ownership-${LECTURER_INST_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`demote-group-admin-${LECTURER_INST_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`remove-group-admin-${LECTURER_INST_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`promote-group-member-${LECTURER_INST2_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`remove-group-member-${LECTURER_INST2_SHORTNAME}`)
    ).not.toBeVisible()
    await logoutUser()
  })

  test('Verify that creating another group with the same name fails', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(USER_GROUP.name)
    await page
      .getByTestId('member-shortname-email-0')
      .fill(LECTURER_INST2_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    // Dialog should still be open (creation failed)
    await expect(page.getByTestId('submit-create-user-group')).toBeVisible()
  })

  test('Verify that a group can be left by admins and users', async ({
    page,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst2,
  }) => {
    // pro1 (admin) leaves
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`leave-group-${USER_GROUP.name}`).click()
    await page.getByTestId('cancel-leave-group').click()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`leave-group-${USER_GROUP.name}`).click()
    await page.getByTestId('confirm-leave-group').click()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).not.toBeVisible()

    // pro3 (member) leaves
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`leave-group-${USER_GROUP.name}`).click()
    await page.getByTestId('confirm-leave-group').click()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).not.toBeVisible()
  })

  test('Re-add member and admin using the add-to-group functionality', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).not.toBeVisible()

    // Re-add pro1 as admin
    await page.getByTestId('add-admin-group-input').fill(LECTURER_IND_SHORTNAME)
    await page.getByTestId('add-admin-group-confirm').click()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await expect(page.getByTestId('add-admin-group-input')).toHaveValue('')

    // Re-add pro3 as member
    await page
      .getByTestId('add-member-group-input')
      .fill(LECTURER_INST2_SHORTNAME)
    await page.getByTestId('add-member-group-confirm').click()
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()
    await expect(page.getByTestId('add-member-group-input')).toHaveValue('')
  })

  test('Promote and demote users and verify the persistence through their accounts', async ({
    page,
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst2,
    logoutUser,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()

    // Promote pro3 (member → admin)
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).toContainText(LECTURER_INST2_EMAIL)
    await page
      .getByTestId(`promote-group-member-${LECTURER_INST2_SHORTNAME}`)
      .click()
    await expect(
      page.getByTestId(`group-member-${LECTURER_INST2_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST2_SHORTNAME}`)
    ).toBeVisible()

    // Demote pro1 (admin → member)
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).toContainText(LECTURER_IND_EMAIL)
    await page
      .getByTestId(`demote-group-admin-${LECTURER_IND_SHORTNAME}`)
      .click()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`group-member-${LECTURER_IND_SHORTNAME}`)
    ).toBeVisible()
    await logoutUser()

    // Verify pro1 now shows as member
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toContainText('Member')
    await logoutUser()

    // Verify pro3 now shows as admin
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toContainText('Admin')
    await logoutUser()
  })

  test('Remove a member and an admin from the group and verify access loss', async ({
    page,
    loginLecturer,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst2,
    logoutUser,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()

    // Remove promoted pro3 (now admin) and demoted pro1 (now member)
    await page
      .getByTestId(`remove-group-admin-${LECTURER_INST2_SHORTNAME}`)
      .click()
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST2_SHORTNAME}`)
    ).not.toBeVisible()

    await page
      .getByTestId(`remove-group-member-${LECTURER_IND_SHORTNAME}`)
      .click()
    await expect(
      page.getByTestId(`group-member-${LECTURER_IND_SHORTNAME}`)
    ).not.toBeVisible()
    await logoutUser()

    // Verify pro1 no longer sees the group
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).not.toBeVisible()
    await logoutUser()

    // Verify pro3 no longer sees the group
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).not.toBeVisible()
    await logoutUser()
  })

  test('Transfer group ownership to admin pro2, verify and transfer back', async ({
    page,
    loginLecturer,
    loginInstitutionalCatalyst,
    logoutUser,
  }) => {
    // Lecturer transfers ownership to pro2
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await page
      .getByTestId(`transfer-group-ownership-${LECTURER_INST_SHORTNAME}`)
      .click()

    // Verify: pro2 is now owner, lecturer became admin
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_INST_SHORTNAME
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_INST_EMAIL
    )
    await expect(
      page.getByTestId(`group-admin-${LECTURER_SHORTNAME}`)
    ).toBeVisible()
    await logoutUser()

    // pro2 transfers ownership back to lecturer
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()
    await page
      .getByTestId(`transfer-group-ownership-${LECTURER_SHORTNAME}`)
      .click()

    // Verify: lecturer is owner again, pro2 became admin
    await expect(
      page.getByTestId(`group-admin-${LECTURER_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_SHORTNAME
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      LECTURER_EMAIL
    )
    await expect(
      page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
    ).toBeVisible()
    await logoutUser()
  })

  test('Change the name of the user group and verify persistence', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.name}`)
    ).toBeVisible()
    await page.getByTestId(`user-group-actions-${USER_GROUP.name}`).click()
    await page.getByTestId(`view-edit-group-${USER_GROUP.name}`).click()

    await page.getByTestId('edit-group-name').click()
    await page.getByTestId('edit-group-name-input').clear()
    await page.getByTestId('edit-group-name-input').fill(USER_GROUP.nameNew)
    await page.getByTestId('save-new-group-name').click()
    await expect(page.getByTestId('edit-group-name-input')).not.toBeVisible()
    await page.getByTestId('close-user-group-edit-modal').click()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.nameNew}`)
    ).toBeVisible()
  })

  test('Delete the user group and verify it is not shown to members', async ({
    page,
    loginLecturer,
    loginInstitutionalCatalyst,
    logoutUser,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.nameNew}`)
    ).toBeVisible()

    // Cancel deletion first
    await page.getByTestId(`user-group-actions-${USER_GROUP.nameNew}`).click()
    await page.getByTestId(`delete-group-${USER_GROUP.nameNew}`).click()
    await page.getByTestId('cancel-delete-group').click()

    // Confirm deletion (multi-step confirmation)
    await page.getByTestId(`user-group-actions-${USER_GROUP.nameNew}`).click()
    await page.getByTestId(`delete-group-${USER_GROUP.nameNew}`).click()
    await expect(page.getByTestId('confirm-delete-group')).toBeDisabled()
    await page.getByTestId('delete-group-resolve-group-confirm').click()
    await expect(page.getByTestId('confirm-delete-group')).toBeDisabled()
    await page.getByTestId('delete-group-revoke-permissions-confirm').click()
    await expect(page.getByTestId('confirm-delete-group')).toBeDisabled()
    await page.getByTestId('delete-group-irrevocable-action-confirm').click()
    await page.getByTestId('confirm-delete-group').click()
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.nameNew}`)
    ).not.toBeVisible()
    await logoutUser()

    // pro2 (former member/admin) should no longer see the group
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToUserGroups(page)
    await expect(
      page.getByTestId(`user-group-${USER_GROUP.nameNew}`)
    ).not.toBeVisible()
    await logoutUser()
  })
})

// ─── Cleanup ──────────────────────────────────────────────────────────────────

test.describe('Cleanup', () => {
  test('Remove shared answer collection from all accounts and delete', async ({
    page,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginInstitutionalCatalyst2,
    loginLecturer,
    logoutUser,
  }) => {
    // Remove from pro1
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${AC1.name}`).click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('confirm-remove-object').click()
    await logoutUser()

    // Remove from pro2
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${AC1.name}`).click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('confirm-remove-object').click()
    await logoutUser()

    // Remove from pro3
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${AC1.name}`).click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('confirm-remove-object').click()
    await logoutUser()

    // Delete AC1 (lecturer)
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${AC1.name}`).click()
    await page.getByTestId('delete-answer-collection').click()
    await page.getByTestId('confirm-delete-answer-collection').click()
    await logoutUser()

    // Delete AC2 (pro1 who owns it)
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${AC2.name}`).click()
    await page.getByTestId('delete-answer-collection').click()
    await page.getByTestId('confirm-delete-answer-collection').click()
  })

  test('Delete the live quiz template', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${LIVE_QUIZ.template.name}`)
      .click()
    await page.getByTestId(`delete-template-${LIVE_QUIZ.template.name}`).click()
    await page.getByTestId('confirm-template-deletion').click()
    await expect(
      page.getByTestId(`live-quiz-${LIVE_QUIZ.template.name}`)
    ).not.toBeVisible()
  })

  test('Remove the catalog collections through the lecturer account (owner)', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await navigateToCatalog(page)

    await page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`).click()
    await page.getByTestId('delete-catalog-collection').click()
    await page.getByTestId('confirm-delete-collection').click()
    await expect(
      page.getByTestId(`catalog-collection-${CC_PUBLIC}-actions`)
    ).not.toBeVisible()

    await page
      .getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
      .click()
    await page.getByTestId('delete-catalog-collection').click()
    await page.getByTestId('confirm-delete-collection').click()
    await expect(
      page.getByTestId(`catalog-collection-${CC_RESTRICTED}-actions`)
    ).not.toBeVisible()

    await expect(
      page.getByTestId(`catalog-object-${CC_PUBLIC}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`catalog-object-${CC_RESTRICTED}`)
    ).not.toBeVisible()
  })
})
