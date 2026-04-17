/**
 * T-resources.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/T-resources-workflow.cy.ts
 * Tests answer collection creation, editing, sharing, catalog, permissions,
 * access levels, user groups and ownership transfer.
 */

import { type Page } from '@playwright/test'
import { expect, test } from '../util/fixtures.js'

// ─── Fixture data ────────────────────────────────────────────────────────────

const PUBLIC = {
  name: 'Public Answer Collection',
  description: 'This is a public answer collection',
  nameNew: 'Public Answer Collection New',
  descriptionNew: 'This is a new public answer collection',
  items: [
    'Red',
    'Green',
    'Blue',
    'Yellow',
    'Purple',
    'Orange',
    'Pink',
    'Black',
    'White',
    'Grey',
  ],
  itemsAfterDeletion: [
    'Red',
    'Green',
    'Blue',
    'Purple',
    'Orange',
    'Pink',
    'Black',
    'White',
    'Grey',
  ],
  itemsNew: [
    'Red NEW',
    'Green NEW',
    'Blue NEW',
    'Purple NEW',
    'Orange NEW',
    'Pink NEW',
    'Black NEW',
    'White NEW',
    'Grey NEW',
  ],
}

const RESTRICTED = {
  name: 'Restricted Answer Collection',
  description: 'This is a restricted answer collection',
  items: ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Turtle', 'Hamster'],
}

const PRIVATE = {
  name: 'Private Answer Collection',
  description: 'This is a private answer collection',
  items: ['Apple', 'Banana', 'Cherry', 'Grape', 'Lemon', 'Melon', 'Orange'],
}

const DIRECT = {
  name: 'Direct Answer Collection',
  description: 'This is a direct answer collection',
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

const ACCESS = {
  name: 'Access Answer Collection',
  description: 'This is an access answer collection',
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
  replacedName: 'Access Answer Collection New',
  replacedEntry: 'Eleven NEW',
  newEntry: 'Twenty-One',
  newEntry2: 'Twenty-Two',
}

const OWNERSHIP = {
  name: 'Ownership Answer Collection',
  description: 'This is an ownership answer collection',
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

const SHARED = {
  name: 'Shared Answer Collection',
  description: 'This is a shared answer collection',
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

const QUESTION = {
  title: 'New SE Question to block deletion',
  content: 'This is a new question to block deletion',
  numberOfInputs: 2,
  solutions: [0, 1, 4],
}

const GROUP1 = 'Group 1'
const GROUP2 = 'Group 2'
const GROUP3 = 'Group 3'

// User shortnames
const LECTURER_SHORTNAME = 'lecturer'
const PRO1_SHORTNAME = 'pro1'
const PRO1_EMAIL = 'pro1@df.uzh.ch'
const PRO2_SHORTNAME = 'pro2'
const PRO2_EMAIL = 'pro2@df.uzh.ch'
const PRO3_SHORTNAME = 'pro3'
const PRO3_EMAIL = 'pro3@df.uzh.ch'
const PRO4_SHORTNAME = 'pro4'

// i18n labels
const LABEL_SELECTION = 'Selection (SE)'
const LABEL_READ = 'Read'
const LABEL_WRITE = 'Write'
const LABEL_ADMIN = 'Admin'
const LABEL_ACCESS_REQUESTED = 'Access requested'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToResources(page: Page) {
  await page.getByTestId('resources').click()
}

async function goToAnswerCollections(page: Page) {
  await goToResources(page)
  await page.getByTestId('answer-collections').click()
}

async function goToCatalog(page: Page) {
  await goToResources(page)
  await page.getByTestId('catalog').click()
}

async function goToUserGroups(page: Page) {
  await goToResources(page)
  await page.getByTestId('user-groups').click()
}

async function createAnswerCollection(
  page: Page,
  name: string,
  description: string,
  items: string[]
) {
  await page.getByTestId('create-answer-collection').click()
  await page.getByTestId('answer-collection-name').fill(name)
  await page.getByTestId('answer-collection-description').click()
  await page
    .getByTestId('answer-collection-description')
    .pressSequentially(description)

  // First two items are in pre-filled inputs
  await page.getByTestId('response-entry-0').fill(items[0])
  await page.getByTestId('response-entry-1').fill(items[1])

  for (let i = 2; i < items.length; i++) {
    await page.getByTestId('add-response-entry').click()
    await page.getByTestId(`response-entry-${i}`).fill(items[i])
  }

  await page.getByTestId('submit-create-answer-collection').click()
  await expect(page.getByTestId(`answer-collection-${name}`)).toBeVisible()
}

async function deleteAnswerCollection(page: Page, collectionName: string) {
  await page.getByTestId(`answer-collection-actions-${collectionName}`).click()
  await page.getByTestId('delete-answer-collection').click()
  await page.getByTestId('confirm-remove-object').click()
  await expect(
    page.getByTestId(`answer-collection-${collectionName}`)
  ).not.toBeVisible()
}

async function removeAnswerCollection(page: Page, name: string) {
  await page.getByTestId(`answer-collection-actions-${name}`).click()
  await page.getByTestId('remove-answer-collection').click()
  await page.getByTestId('confirm-remove-object').click()
  await expect(page.getByTestId(`answer-collection-${name}`)).not.toBeVisible()
}

async function grantCollectionAccess(
  page: Page,
  collectionName: string,
  username: string,
  permissionLabel: string
) {
  await goToAnswerCollections(page)
  await page.getByTestId(`answer-collection-actions-${collectionName}`).click()
  await page.getByTestId('share-answer-collection').click()

  await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
  await page.getByTestId('new-permission-username-or-email').fill(username)
  await page.getByTestId('new-permission-access-level').click()
  await page
    .getByTestId(`permission-level-${permissionLabel.toUpperCase()}`)
    .click()
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)

  await expect(page.getByTestId(`permission-${username}`)).toContainText(
    permissionLabel
  )
}

async function createSEQuestion(
  page: Page,
  title: string,
  content: string,
  collectionName: string,
  solutions: number[],
  items: string[]
) {
  await page.getByTestId('create-question').click()
  await page.getByTestId('select-question-type').click()
  await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()

  await page.getByTestId('insert-question-title').fill(title)
  await page.getByTestId('insert-question-text').click()
  await page.getByTestId('insert-question-text').pressSequentially(content)

  await page.getByTestId('select-answer-collection').click()
  await page.getByTestId(`select-answer-collection-${collectionName}`).click()

  await page.getByTestId('configure-sample-solution').click({ force: true })
  for (const ix of solutions) {
    await page.getByTestId(`select-answer-option-${items[ix]}`).click()
  }

  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(1000)
}

async function deleteElement(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`element-actions-${elementName}`).click()
  await page.getByTestId('delete-element').click()
  await page.getByTestId('confirm-delete-element').click()
  await expect(
    page.getByTestId(`element-item-${elementName}`)
  ).not.toBeVisible()
}

async function testAnswerCollectionEditPermissions(
  page: Page,
  collectionName: string,
  replacedName: string,
  replacedEntry: string,
  firstItem: string,
  newEntry: string,
  newEntry2: string
) {
  await goToAnswerCollections(page)
  await page.getByTestId(`answer-collection-actions-${collectionName}`).click()
  await page.getByTestId('edit-answer-collection').click()

  await expect(page.getByTestId('answer-collection-name')).toHaveValue(
    collectionName
  )
  await page.getByTestId('answer-collection-name').clear()
  await page.getByTestId('answer-collection-name').fill(replacedName)
  await page.getByTestId('save-changes-answer-collection').click()

  await page.getByTestId('open-answer-collection-options').click()
  await page.getByTestId(`edit-answer-option-${firstItem}`).click()
  await expect(page.getByTestId('edit-answer-option-input')).toHaveValue(
    firstItem
  )
  await page.getByTestId('edit-answer-option-input').clear()
  await page.getByTestId('edit-answer-option-input').fill(replacedEntry)
  await page.getByTestId('save-edit-answer-option').click()

  await page.getByTestId('add-answer-option').click()
  await page.getByTestId('input-new-answer-option').fill(newEntry)
  await page.getByTestId('save-new-answer-option').click()

  await page.getByTestId('add-answer-option').click()
  await page.getByTestId('input-new-answer-option').fill(newEntry2)
  await page.getByTestId('save-new-answer-option').click()
  await page.getByTestId(`delete-answer-option-${newEntry2}`).click()
}

async function validateAndUndoWritePermissionChanges(
  page: Page,
  collectionName: string,
  replacedName: string,
  replacedEntry: string,
  firstItem: string,
  newEntry: string,
  newEntry2: string
) {
  await goToAnswerCollections(page)
  await page.getByTestId(`answer-collection-actions-${replacedName}`).click()
  await page.getByTestId('edit-answer-collection').click()

  await expect(page.getByTestId('answer-collection-name')).toHaveValue(
    replacedName
  )
  await page.getByTestId('answer-collection-name').clear()
  await page.getByTestId('answer-collection-name').fill(collectionName)
  await page.getByTestId('save-changes-answer-collection').click()

  await page.getByTestId('open-answer-collection-options').click()
  await page.getByTestId(`edit-answer-option-${replacedEntry}`).click()
  await expect(page.getByTestId('edit-answer-option-input')).toHaveValue(
    replacedEntry
  )
  await page.getByTestId('edit-answer-option-input').clear()
  await page.getByTestId('edit-answer-option-input').fill(firstItem)
  await page.getByTestId('save-edit-answer-option').click()

  await expect(page.getByTestId(`edit-answer-option-${newEntry}`)).toBeVisible()
  await page.getByTestId(`delete-answer-option-${newEntry}`).click()

  await expect(
    page.getByTestId(`edit-answer-option-${newEntry2}`)
  ).not.toBeVisible()
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('T: Answer collection creation and editing', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a public answer collection with UI validation', async ({
    page,
  }) => {
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)

    // Test cancel
    await page.getByTestId('create-answer-collection').click()
    await expect(page.getByTestId('answer-collection-name')).toBeVisible()
    await page.getByTestId('cancel-create-answer-collection').click()
    await expect(page.getByTestId('answer-collection-name')).not.toBeVisible()

    // Create with all items
    await page.getByTestId('create-answer-collection').click()
    await page.getByTestId('answer-collection-name').fill(PUBLIC.name)
    await expect(page.getByTestId('answer-collection-name')).toHaveValue(
      PUBLIC.name
    )

    await page.getByTestId('answer-collection-description').click()
    await page
      .getByTestId('answer-collection-description')
      .pressSequentially(PUBLIC.description)
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(PUBLIC.description)

    await page.getByTestId('response-entry-0').fill(PUBLIC.items[0])
    await expect(page.getByTestId('response-entry-0')).toHaveValue(
      PUBLIC.items[0]
    )
    await page.getByTestId('response-entry-1').fill(PUBLIC.items[1])
    await expect(page.getByTestId('response-entry-1')).toHaveValue(
      PUBLIC.items[1]
    )

    for (let i = 2; i < PUBLIC.items.length; i++) {
      await page.getByTestId('add-response-entry').click()
      await page.getByTestId(`response-entry-${i}`).fill(PUBLIC.items[i])
      await expect(page.getByTestId(`response-entry-${i}`)).toHaveValue(
        PUBLIC.items[i]
      )
    }

    // Test deletion of an answer option
    await expect(
      page.getByTestId(`response-entry-${PUBLIC.items.length - 1}`)
    ).toBeVisible()
    await page.getByTestId('remove-response-entry-3').click()
    await expect(
      page.getByTestId(`response-entry-${PUBLIC.items.length - 1}`)
    ).not.toBeVisible()
    await expect(page.getByTestId('response-entry-3')).toHaveValue(
      PUBLIC.items[4]
    )
    await expect(
      page.getByTestId('submit-create-answer-collection')
    ).not.toBeDisabled()

    // Test duplicate rejection
    await page.getByTestId('add-response-entry').click()
    await page
      .getByTestId(`response-entry-${PUBLIC.items.length - 1}`)
      .fill(PUBLIC.items[0])
    await page
      .getByTestId(`remove-response-entry-${PUBLIC.items.length - 1}`)
      .click()
    await expect(
      page.getByTestId(`response-entry-${PUBLIC.items.length - 1}`)
    ).not.toBeVisible()

    await page.getByTestId('submit-create-answer-collection').click()
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()
  })

  test('Edit the public answer collection', async ({ page }) => {
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await page.getByTestId('edit-answer-collection').click()

    await expect(page.getByTestId('answer-collection-name')).toHaveValue(
      PUBLIC.name
    )
    await page.getByTestId('answer-collection-name').clear()
    await page.getByTestId('answer-collection-name').fill(PUBLIC.nameNew)
    await expect(page.getByTestId('answer-collection-name')).toHaveValue(
      PUBLIC.nameNew
    )

    await page.getByTestId('answer-collection-description').click()
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(PUBLIC.description)
    await page.getByTestId('answer-collection-description').clear()
    await page
      .getByTestId('answer-collection-description')
      .pressSequentially(PUBLIC.descriptionNew)
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(PUBLIC.descriptionNew)
    await page.waitForTimeout(100)
    await page.getByTestId('save-changes-answer-collection').click()

    // Check current values
    await page.getByTestId('open-answer-collection-options').click()
    for (const value of PUBLIC.itemsAfterDeletion) {
      await expect(page.getByTestId(`answer-option-${value}`)).toContainText(
        value
      )
    }

    // Validate editing with duplicate check
    await page
      .getByTestId(`edit-answer-option-${PUBLIC.itemsAfterDeletion[0]}`)
      .click()
    await expect(page.getByTestId('edit-answer-option-input')).toHaveValue(
      PUBLIC.itemsAfterDeletion[0]
    )
    await expect(page.getByTestId('save-edit-answer-option')).not.toBeDisabled()
    await page.getByTestId('edit-answer-option-input').clear()
    await page
      .getByTestId('edit-answer-option-input')
      .fill(PUBLIC.itemsAfterDeletion[1])
    await expect(page.getByTestId('save-edit-answer-option')).toBeDisabled()
    await page.getByTestId('edit-answer-option-input').clear()
    await page
      .getByTestId('edit-answer-option-input')
      .fill(PUBLIC.itemsAfterDeletion[0])
    await expect(page.getByTestId('save-edit-answer-option')).not.toBeDisabled()
    await page.getByTestId('edit-answer-option-input').clear()
    await expect(page.getByTestId('save-edit-answer-option')).toBeDisabled()
    await page
      .getByTestId('edit-answer-option-input')
      .fill(PUBLIC.itemsAfterDeletion[0])
    await page.getByTestId('save-edit-answer-option').click()

    // Change all answer option values
    for (let i = 0; i < PUBLIC.itemsAfterDeletion.length; i++) {
      await page
        .getByTestId(`edit-answer-option-${PUBLIC.itemsAfterDeletion[i]}`)
        .click()
      await expect(page.getByTestId('edit-answer-option-input')).toHaveValue(
        PUBLIC.itemsAfterDeletion[i]
      )
      await page.getByTestId('edit-answer-option-input').clear()
      await page
        .getByTestId('edit-answer-option-input')
        .fill(PUBLIC.itemsNew[i])
      await page.getByTestId('save-edit-answer-option').click()
      await expect(
        page.getByTestId(`answer-option-${PUBLIC.itemsNew[i]}`)
      ).toContainText(PUBLIC.itemsNew[i])
    }

    // Delete last item and re-add it with validation
    const lastElement = PUBLIC.itemsNew[PUBLIC.itemsNew.length - 1]
    const existingElement = PUBLIC.itemsNew[0]
    await page.getByTestId(`delete-answer-option-${lastElement}`).click()
    await expect(
      page.getByTestId(`answer-option-${lastElement}`)
    ).not.toBeVisible()

    await page.getByTestId('add-answer-option').click()
    await expect(page.getByTestId('save-new-answer-option')).toBeDisabled()
    await page.getByTestId('input-new-answer-option').fill(lastElement)
    await expect(page.getByTestId('save-new-answer-option')).not.toBeDisabled()
    await page.getByTestId('input-new-answer-option').clear()
    await page.getByTestId('input-new-answer-option').fill(existingElement)
    await expect(page.getByTestId('save-new-answer-option')).toBeDisabled()
    await page.getByTestId('input-new-answer-option').fill(lastElement) // adds to existing text
    await expect(page.getByTestId('save-new-answer-option')).not.toBeDisabled()
    await page.getByTestId('input-new-answer-option').clear()
    await expect(page.getByTestId('save-new-answer-option')).toBeDisabled()
    await page.getByTestId('input-new-answer-option').fill(lastElement)
    await page.getByTestId('save-new-answer-option').click()
    await expect(
      page.getByTestId(`answer-option-${lastElement}`)
    ).toContainText(lastElement)
  })

  test('Verify that changes to the answer collection persist', async ({
    page,
  }) => {
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${PUBLIC.nameNew}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()

    await expect(page.getByTestId('answer-collection-name')).toHaveValue(
      PUBLIC.nameNew
    )
    await page.getByTestId('answer-collection-description').click()
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(PUBLIC.descriptionNew)
    await page.waitForTimeout(100)
    await page.getByTestId('save-changes-answer-collection').click()

    await page.getByTestId('open-answer-collection-options').click()
    for (const value of PUBLIC.itemsNew) {
      await expect(page.getByTestId(`answer-option-${value}`)).toContainText(
        value
      )
    }
  })

  test('Verify all answer collections can be used in selection questions by owner', async ({
    page,
  }) => {
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()

    await page.getByTestId('select-answer-collection').click()
    await expect(
      page.getByTestId(`select-answer-collection-${PUBLIC.nameNew}`)
    ).toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Cleanup: Delete public answer collection', async ({ page }) => {
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.nameNew}`)
    ).toBeVisible()
    await deleteAnswerCollection(page, PUBLIC.nameNew)
  })
})

test.describe('T: Private answer collection sharing', () => {
  test('Create a private answer collection (lecturer)', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(
      page,
      PRIVATE.name,
      PRIVATE.description,
      PRIVATE.items
    )
  })

  test('Verify private collection can be used in SE question by owner', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await goToAnswerCollections(page)
    // Create SE question using private collection
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      PRIVATE.name,
      QUESTION.solutions,
      PRIVATE.items
    )
    await page.getByTestId('elements-search-input').fill(QUESTION.title)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${QUESTION.title}`)
    ).toBeVisible()
  })

  test('Verify private collection cannot be used by pro1 (no access)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await expect(page.getByTestId('select-answer-collection')).not.toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Verify private collection cannot be deleted (used in question)', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${PRIVATE.name}`).click()
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  test('Delete the SE question depending on private collection', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await page.getByTestId('library').click()
    await deleteElement(page, QUESTION.title)
  })

  test('Verify private collection can be deleted after removing dependent question', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, PRIVATE.name)
  })
})

test.describe('T: Restricted answer collection - catalog and sharing', () => {
  test('Create a restricted answer collection', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(
      page,
      RESTRICTED.name,
      RESTRICTED.description,
      RESTRICTED.items
    )
  })

  test('Add restricted collection to catalog', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await page.locator('#object-selection-catalog-addition').click()
    await page
      .locator('[id^="react-select-object-selection-catalog-addition-option"]')
      .first()
      .click()
    await page.getByTestId('object-access-restricted').click()
    await page.getByTestId('submit-add-object').click()

    // Owner can remove but not copy/request
    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await expect(
      page.getByTestId(`copy-object-${RESTRICTED.name}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`request-access-${RESTRICTED.name}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`remove-object-${RESTRICTED.name}`)
    ).toBeVisible()
  })

  test('Test filters and search on catalog page (as pro1)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    // Test search
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()
    await page.getByTestId('search-catalog-collection').fill(PRIVATE.name)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).not.toBeVisible()
    await page.getByTestId('search-catalog-collection').clear()
    await page.getByTestId('search-catalog-collection').fill(RESTRICTED.name)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()

    // Test access type filters
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()
    await page.getByTestId('catalog-access-type-filter').click()
    await page.getByTestId('catalog-access-public').click()
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).not.toBeVisible()
    await page.getByTestId('catalog-access-type-filter').click()
    await page.getByTestId('catalog-access-restricted').click()
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()
    await page.getByTestId('catalog-access-type-filter').click()
    await page.getByTestId('catalog-access-all').click()
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()
  })

  test('Request access to restricted collection (pro1)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await page.getByTestId(`request-access-${RESTRICTED.name}`).click()
    await page.getByTestId('cancel-request-access').click()
    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await page.getByTestId(`request-access-${RESTRICTED.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
  })

  test('Request access to restricted collection (pro2)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await page.getByTestId(`request-access-${RESTRICTED.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
  })

  test('Verify access requests are correctly shown to collection owner', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${RESTRICTED.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`approve-sharing-request-${RESTRICTED.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`deny-sharing-request-${RESTRICTED.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`sharing-request-${RESTRICTED.name}-pro2`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`approve-sharing-request-${RESTRICTED.name}-pro2`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`deny-sharing-request-${RESTRICTED.name}-pro2`)
    ).toBeVisible()
  })

  test('Temporarily award ADMIN to pro3 and verify access request visibility', async ({
    loginLecturer,
    loginInstitutionalCatalyst2,
    logoutUser,
    page,
  }) => {
    // Grant ADMIN to pro3
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(PRO3_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-ADMIN').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${PRO3_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
    await logoutUser()

    // Verify pro3 can see requests
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${RESTRICTED.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`sharing-request-${RESTRICTED.name}-pro2`)
    ).toBeVisible()
    await logoutUser()

    // Revoke ADMIN from pro3
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await expect(page.getByTestId(`permission-${PRO3_SHORTNAME}`)).toBeVisible()
    await page.getByTestId(`revoke-permission-${PRO3_SHORTNAME}`).click()
    await page.getByTestId('cancel-revocation').click()
    await page.getByTestId(`revoke-permission-${PRO3_SHORTNAME}`).click()
    await page.getByTestId('confirm-revocation').click()
    await expect(
      page.getByTestId(`permission-${PRO3_SHORTNAME}`)
    ).not.toBeVisible()
    await logoutUser()

    // Verify pro3 no longer sees requests
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${RESTRICTED.name}-pro1`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`sharing-request-${RESTRICTED.name}-pro2`)
    ).not.toBeVisible()
  })

  test('Collection cannot be used in question by pro1 (pending request)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await expect(page.getByTestId('select-answer-collection')).not.toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Cancel request and re-request (pro1)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)

    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await page.getByTestId(`cancel-request-${RESTRICTED.name}`).click()
    await page.getByTestId('confirm-request-cancellation').click()

    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await page.getByTestId(`request-access-${RESTRICTED.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
  })

  test('Grant access to restricted collection for pro1', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page
      .getByTestId(`approve-sharing-request-${RESTRICTED.name}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      LABEL_READ
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-approval').click()
  })

  test('Decline access request for pro2', async ({ loginLecturer, page }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page
      .getByTestId(`deny-sharing-request-${RESTRICTED.name}-pro2`)
      .click()
  })

  test('Verify active permission for pro1 is shown correctly', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)
  })

  test('Restricted collection visible in resources and usable in SE question for pro1', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${RESTRICTED.name}`)
    ).toBeVisible()

    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await page.getByTestId('select-answer-collection').click()
    await expect(
      page.getByTestId(`select-answer-collection-${RESTRICTED.name}`)
    ).toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Restricted collection not visible in resources for pro2 (access declined)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${RESTRICTED.name}`)
    ).not.toBeVisible()

    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await expect(page.getByTestId('select-answer-collection')).not.toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Pro1 can use restricted collection in SE question', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      RESTRICTED.name,
      QUESTION.solutions,
      RESTRICTED.items
    )
    await page.getByTestId('elements-search-input').fill(QUESTION.title)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${QUESTION.title}`)
    ).toBeVisible()
  })

  test('Pro1 cannot remove collection that is used in a question', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await expect(page.getByTestId('remove-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  test('Verify answer option used as sample solution cannot be removed by owner', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()

    await page.getByTestId('open-answer-collection-options').click()
    for (let i = 0; i < RESTRICTED.items.length; i++) {
      const value = RESTRICTED.items[i]
      await expect(
        page.getByTestId(`edit-answer-option-${value}`)
      ).not.toBeDisabled()
      if (QUESTION.solutions.includes(i)) {
        await expect(
          page.getByTestId(`delete-answer-option-${value}`)
        ).toBeDisabled()
      } else {
        await expect(
          page.getByTestId(`delete-answer-option-${value}`)
        ).not.toBeDisabled()
      }
    }
  })

  test('Delete SE question (pro1)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await deleteElement(page, QUESTION.title)
  })

  test('Pro1 can remove collection after question is deleted', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('close-remove-object').click()
  })

  test('All answer options can be edited and deleted again by owner after pro1 removed it', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('edit-answer-collection').click()

    await page.getByTestId('open-answer-collection-options').click()
    for (const value of RESTRICTED.items) {
      await expect(
        page.getByTestId(`edit-answer-option-${value}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`delete-answer-option-${value}`)
      ).not.toBeDisabled()
    }
  })

  test('Change catalog access level from restricted to public', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    await expect(
      page.getByTestId(`${RESTRICTED.name}-object-access`)
    ).toContainText('Restricted')
    await page.getByTestId(`${RESTRICTED.name}-object-access`).click()
    await expect(page.getByTestId('object-access-restricted')).toBeVisible()
    await page.getByTestId('object-access-public').click()
    await page.getByTestId('confirm-access-change').click()
    await expect(
      page.getByTestId(`${RESTRICTED.name}-object-access`)
    ).toContainText('Public')
  })

  test('Verify copy/request available for non-owner after changing to public', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).toBeVisible()

    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await expect(
      page.getByTestId(`copy-object-${RESTRICTED.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`request-access-${RESTRICTED.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`remove-object-${RESTRICTED.name}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`${RESTRICTED.name}-object-access`)
    ).not.toBeVisible()
  })

  test('Remove restricted collection from catalog by owner', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page.getByTestId(`actions-dropdown-${RESTRICTED.name}`).click()
    await page.getByTestId(`remove-object-${RESTRICTED.name}`).click()
    await page.getByTestId('confirm-removal').click()
  })

  test('Verify collection no longer visible in catalog', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).not.toBeVisible()
  })

  test('Re-add with restricted access and grant admin to pro2', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await page.locator('#object-selection-catalog-addition').click()
    await page
      .locator('[id^="react-select-object-selection-catalog-addition-option"]')
      .first()
      .click()
    await page.getByTestId('object-access-restricted').click()
    await page.getByTestId('submit-add-object').click()

    // Grant admin to pro2
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${RESTRICTED.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
    await page.getByTestId('new-permission-username-or-email').fill(PRO2_EMAIL)
    await expect(page.getByTestId('new-permission-submit')).not.toBeDisabled()
    await page.getByTestId('new-permission-username-or-email').clear()
    await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
    await page.getByTestId('new-permission-username-or-email').fill(PRO2_EMAIL)
    await expect(page.getByTestId('new-permission-submit')).not.toBeDisabled()
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-ADMIN').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${PRO2_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Pro2 can add restricted collection to catalog', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await page.locator('#object-selection-catalog-addition').click()
    await expect(
      page.locator(
        '[id^="react-select-object-selection-catalog-addition-option-0"]'
      )
    ).toBeVisible()
    await page.getByTestId('close-add-object-modal').click()
  })

  test('Pro2 creates SE question with restricted collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      RESTRICTED.name,
      QUESTION.solutions,
      RESTRICTED.items
    )
    await page.getByTestId('elements-search-input').fill(QUESTION.title)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${QUESTION.title}`)
    ).toBeVisible()
  })

  test('Owner soft-deletes restricted collection (used by pro2)', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, RESTRICTED.name)
  })

  test('Soft-deleted collection no longer visible in catalog', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${RESTRICTED.name}`)
    ).not.toBeVisible()
  })

  test('Unused access for pro1 has been automatically revoked', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${RESTRICTED.name}`)
    ).not.toBeVisible()
  })

  test('Pro2 can no longer see collection in overview but dependent element remains', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${RESTRICTED.name}`)
    ).not.toBeVisible()

    await goToCatalog(page)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await expect(page.getByText('No objects available')).toBeVisible()
    await page.getByTestId('close-add-object-modal').click()

    // Delete dependent question
    await page.getByTestId('library').click()
    await page.getByTestId('elements-search-input').fill(QUESTION.title)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${QUESTION.title}`)
    ).toBeVisible()
    await page.getByTestId(`element-actions-${QUESTION.title}`).click()
    await page.getByTestId('delete-element').click()
    await page.getByTestId('confirm-delete-element').click()
  })
})

test.describe('T: Public answer collection in catalog', () => {
  test('Create public answer collection', async ({ loginLecturer, page }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(
      page,
      PUBLIC.name,
      PUBLIC.description,
      PUBLIC.items
    )
  })

  test('Add public collection to catalog and verify owner actions', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await page.locator('#object-selection-catalog-addition').click()
    await page
      .locator('[id^="react-select-object-selection-catalog-addition-option"]')
      .first()
      .click()
    await page.getByTestId('object-access-public').click()
    await page.getByTestId('submit-add-object').click()

    await expect(
      page.getByTestId(`catalog-object-${PUBLIC.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await expect(
      page.getByTestId(`copy-object-${PUBLIC.name}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`request-access-${PUBLIC.name}`)
    ).not.toBeVisible()
    await expect(page.getByTestId(`remove-object-${PUBLIC.name}`)).toBeVisible()
  })

  test('Pro1 requests access to public collection', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PUBLIC.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await page.getByTestId(`request-access-${PUBLIC.name}`).click()
    await expect(page.getByText('Request public resource')).toBeVisible()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${PUBLIC.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
  })

  test('Pro2 requests access to public collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await page.getByTestId(`request-access-${PUBLIC.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${PUBLIC.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
  })

  test('Verify access requests shown to owner', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${PUBLIC.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`approve-sharing-request-${PUBLIC.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`deny-sharing-request-${PUBLIC.name}-pro1`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`sharing-request-${PUBLIC.name}-pro2`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`approve-sharing-request-${PUBLIC.name}-pro2`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`deny-sharing-request-${PUBLIC.name}-pro2`)
    ).toBeVisible()
  })

  test('Grant access to pro1 and decline for pro2', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)

    // Approve pro1
    await page
      .getByTestId(`approve-sharing-request-${PUBLIC.name}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      LABEL_READ
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-approval').click()

    // Decline pro2
    await page.getByTestId(`deny-sharing-request-${PUBLIC.name}-pro2`).click()
  })

  test('Active permission for pro1 shown correctly', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)
  })

  test('Public collection visible in resources for pro1 and usable in SE', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()

    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await page.getByTestId('select-answer-collection').click()
    await expect(
      page.getByTestId(`select-answer-collection-${PUBLIC.name}`)
    ).toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Public collection not visible in resources for pro2 (declined)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).not.toBeVisible()

    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await expect(page.getByTestId('select-answer-collection')).not.toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Pro2 copies public collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PUBLIC.name}`)
    ).toBeVisible()

    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await page.getByTestId(`copy-object-${PUBLIC.name}`).click()
    await page.getByTestId('close-object-copy-modal').click()

    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await page.getByTestId(`copy-object-${PUBLIC.name}`).click()
    await page.getByTestId('cancel-object-copy').click()

    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await page.getByTestId(`copy-object-${PUBLIC.name}`).click()
    await page.getByTestId('confirm-object-copy').click()

    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()
  })

  test('Pro4 imports public collection (read permissions)', async ({
    loginInstitutionalCatalyst3,
    page,
  }) => {
    await loginInstitutionalCatalyst3()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PUBLIC.name}`)
    ).toBeVisible()

    // Cancel import via primary click
    await page.getByTestId(`catalog-object-${PUBLIC.name}`).click()
    await page.getByTestId('cancel-object-import').click()

    // Import via dropdown
    await page.getByTestId(`actions-dropdown-${PUBLIC.name}`).click()
    await page.getByTestId(`import-object-${PUBLIC.name}`).click()
    await page.getByTestId('confirm-object-import').click()

    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`permission-level-${PUBLIC.name}-READ`)
    ).toBeVisible()
  })

  test('Pro4 duplicates imported collection and verifies owner permissions', async ({
    loginInstitutionalCatalyst3,
    page,
  }) => {
    await loginInstitutionalCatalyst3()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()

    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await page.getByTestId('duplicate-answer-collection').click()
    await page.getByTestId('cancel-duplication').click()

    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await page.getByTestId('duplicate-answer-collection').click()
    await page.getByTestId('confirm-duplication').click()

    const duplicateName = `${PUBLIC.name} (Copy)`
    await expect(
      page.getByTestId(`answer-collection-${duplicateName}`)
    ).toBeVisible()

    // Verify owner actions available
    await page.getByTestId(`answer-collection-actions-${duplicateName}`).click()
    await expect(
      page.getByTestId(`view-activity-log-${duplicateName}`)
    ).toBeVisible()
    await expect(page.getByTestId('edit-answer-collection')).toBeVisible()
    await expect(page.getByTestId('share-answer-collection')).toBeVisible()
    await expect(page.getByTestId('duplicate-answer-collection')).toBeVisible()
    await expect(page.getByTestId('delete-answer-collection')).toBeVisible()
    await page.getByTestId(`answer-collection-${duplicateName}`).click() // close dropdown

    // Verify metadata and options can be edited
    await page.getByTestId(`answer-collection-actions-${duplicateName}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await expect(page.getByTestId('answer-collection-name')).toHaveValue(
      duplicateName
    )
    await page.getByTestId('open-answer-collection-options').click()
    for (const value of PUBLIC.items) {
      await expect(
        page.getByTestId(`edit-answer-option-${value}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`delete-answer-option-${value}`)
      ).not.toBeDisabled()
    }
  })

  test('Imported collection visible to pro2 (copied, with edit permissions)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)

    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await page.getByTestId('edit-answer-collection').click()

    await page.getByTestId('open-answer-collection-options').click()
    for (const value of PUBLIC.items) {
      await expect(
        page.getByTestId(`edit-answer-option-${value}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`delete-answer-option-${value}`)
      ).not.toBeDisabled()
    }
  })

  test('Pro1 removes public collection from their account', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()
    await removeAnswerCollection(page, PUBLIC.name)
  })

  test('Pro2 creates SE question with imported public collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      PUBLIC.name,
      QUESTION.solutions,
      PUBLIC.items
    )
    await page.getByTestId('elements-search-input').fill(QUESTION.title)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`element-item-${QUESTION.title}`)
    ).toBeVisible()
  })

  test('Pro2 cannot delete imported collection (used in question)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  test('Owner can fully edit original public collection', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${PUBLIC.name}`).click()
    await page.getByTestId('edit-answer-collection').click()

    await page.getByTestId('open-answer-collection-options').click()
    for (const value of PUBLIC.items) {
      await expect(
        page.getByTestId(`edit-answer-option-${value}`)
      ).not.toBeDisabled()
      await expect(
        page.getByTestId(`delete-answer-option-${value}`)
      ).not.toBeDisabled()
    }
  })

  test('Owner soft-deletes public collection', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, PUBLIC.name)
  })

  test('Imported collection still visible to pro2 (derived permission)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PUBLIC.name}`)
    ).toBeVisible()
  })

  test('Pro2 deletes SE question', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await deleteElement(page, QUESTION.title)
  })

  test('Pro2 removes imported collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, PUBLIC.name)
  })
})

test.describe('T: User groups for answer collection sharing', () => {
  test('Create user groups and prepare shared answer collection', async ({
    loginLecturer,
    loginInstitutionalCatalyst2,
    logoutUser,
    page,
  }) => {
    // Create shared collection
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(
      page,
      SHARED.name,
      SHARED.description,
      SHARED.items
    )

    // Create group 1 (owner: lecturer, member: pro1)
    await goToUserGroups(page)
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP1)
    await page.getByTestId('member-shortname-email-0').fill(PRO1_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${GROUP1}`)).toBeVisible()

    // Create group 2 (owner: lecturer, admin: pro2)
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP2)
    await page.getByTestId('cancel-create-user-group').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP2)
    await page.getByTestId('member-shortname-email-0').fill(PRO2_EMAIL)
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${GROUP2}`)).toBeVisible()
    await logoutUser()

    // Create group 3 (owner: pro3, member: lecturer)
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToUserGroups(page)
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP3)
    await page.getByTestId('cancel-create-user-group').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').fill(GROUP3)
    await page.getByTestId('member-shortname-email-0').fill(LECTURER_SHORTNAME)
    await page.getByTestId('submit-create-user-group').click()
    await expect(page.getByTestId(`user-group-${GROUP3}`)).toBeVisible()
  })

  test('Grant READ/WRITE/ADMIN permissions to user groups', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${SHARED.name}`).click()
    await page.getByTestId('share-answer-collection').click()

    // READ for group 1
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP1).click()
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId(`permission-${GROUP1}`)).toContainText(
      LABEL_READ
    )

    // WRITE for group 2
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP2).click()
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-WRITE').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId(`permission-${GROUP2}`)).toContainText(
      LABEL_WRITE
    )

    // ADMIN for group 3
    await page.getByTestId('new-permission-user-group').click()
    await page.getByText(GROUP3).click()
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-ADMIN').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId(`permission-${GROUP3}`)).toContainText(
      LABEL_ADMIN
    )
  })

  test('Group 1 member (pro1) has READ permissions on shared collection', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${SHARED.name}`)
    ).toBeVisible()

    await page.getByTestId(`answer-collection-actions-${SHARED.name}`).click()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of SHARED.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Group 2 admin (pro2) has WRITE permissions on shared collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${SHARED.name}`)
    ).toBeVisible()
    await page.getByTestId(`answer-collection-actions-${SHARED.name}`).click()
    await expect(page.getByTestId('edit-answer-collection')).toBeVisible()
  })

  test('Group 3 member (pro3) has ADMIN permissions on shared collection', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${SHARED.name}`)
    ).toBeVisible()
    await page.getByTestId(`answer-collection-actions-${SHARED.name}`).click()
    await expect(page.getByTestId('edit-answer-collection')).toBeVisible()
  })
})

test.describe('T: Catalog availability modification workflows', () => {
  test('Create private collection and add to catalog as restricted', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await createAnswerCollection(
      page,
      PRIVATE.name,
      PRIVATE.description,
      PRIVATE.items
    )

    // Not in catalog yet
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PRIVATE.name}`)
    ).not.toBeVisible()

    // Add as restricted
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await page.locator('#object-selection-catalog-addition').click()
    await page
      .locator('[id^="react-select-object-selection-catalog-addition-option"]')
      .first()
      .click()
    await page.getByTestId('object-access-restricted').click()
    await page.getByTestId('submit-add-object').click()
  })

  test('Pro1 requests access and owner changes to public; request persists', async ({
    loginIndividualCatalyst,
    loginLecturer,
    logoutUser,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PRIVATE.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${PRIVATE.name}`).click()
    await page.getByTestId(`request-access-${PRIVATE.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${PRIVATE.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
    await logoutUser()

    // Owner changes to public
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page.getByTestId(`${PRIVATE.name}-object-access`).click()
    await page.getByTestId('object-access-public').click()
    await page.getByTestId('confirm-access-change').click()
    await expect(
      page.getByTestId(`${PRIVATE.name}-object-access`)
    ).toContainText('Public')
    await logoutUser()

    // Pro1 pending request still visible
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PRIVATE.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
    await logoutUser()

    // Owner pending request still visible
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${PRIVATE.name}-pro1`)
    ).toBeVisible()
  })

  test('Pro2 requests public collection; owner changes to restricted, approves pro1, removes from catalog', async ({
    loginInstitutionalCatalyst,
    loginLecturer,
    logoutUser,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${PRIVATE.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${PRIVATE.name}`).click()
    await expect(page.getByTestId(`copy-object-${PRIVATE.name}`)).toBeVisible()
    await page.getByTestId(`request-access-${PRIVATE.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${PRIVATE.name}`)
    ).toContainText(LABEL_ACCESS_REQUESTED)
    await logoutUser()

    // Change to restricted
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page.getByTestId(`${PRIVATE.name}-object-access`).click()
    await page.getByTestId('object-access-restricted').click()
    await page.getByTestId('confirm-access-change').click()
    await expect(
      page.getByTestId(`${PRIVATE.name}-object-access`)
    ).toContainText('Restricted')
    await logoutUser()

    // Pro2 can no longer copy
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page.getByTestId(`actions-dropdown-${PRIVATE.name}`).click()
    await expect(
      page.getByTestId(`copy-object-${PRIVATE.name}`)
    ).not.toBeVisible()
    await logoutUser()

    // Approve pro1 and remove from catalog
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page
      .getByTestId(`approve-sharing-request-${PRIVATE.name}-pro1`)
      .click()
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-approval').click()

    await page.getByTestId(`actions-dropdown-${PRIVATE.name}`).click()
    await page.getByTestId(`remove-object-${PRIVATE.name}`).click()
    await page.getByTestId('confirm-removal').click()

    // Decline pro2 request that persists after removal
    await expect(
      page.getByTestId(`sharing-request-${PRIVATE.name}-pro2`)
    ).toBeVisible()
    await page.getByTestId(`deny-sharing-request-${PRIVATE.name}-pro2`).click()
  })

  test('Pro1 still has access after collection removed from catalog', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${PRIVATE.name}`)
    ).toBeVisible()
    await page.getByTestId(`answer-collection-actions-${PRIVATE.name}`).click()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of PRIVATE.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Cleanup: Delete private collection', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, PRIVATE.name)
  })
})

test.describe('T: Direct sharing of answer collections', () => {
  test('Create restricted collection and grant direct READ to pro1', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(
      page,
      DIRECT.name,
      DIRECT.description,
      DIRECT.items
    )
    await grantCollectionAccess(page, DIRECT.name, PRO1_SHORTNAME, LABEL_READ)
  })

  test('Add direct collection to catalog as restricted', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId('object-type-ANSWER_COLLECTION').click()
    await page.locator('#object-selection-catalog-addition').click()
    await page
      .locator('[id^="react-select-object-selection-catalog-addition-option"]')
      .first()
      .click()
    await page.getByTestId('object-access-restricted').click()
    await page.getByTestId('submit-add-object').click()
  })

  test('Restricted collection visible for pro1 (direct access)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${DIRECT.name}`)
    ).toBeVisible()

    await page.getByTestId(`answer-collection-actions-${DIRECT.name}`).click()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of DIRECT.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Pro2 requests access to direct restricted collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`catalog-object-${DIRECT.name}`)
    ).toBeVisible()
    await page.getByTestId(`actions-dropdown-${DIRECT.name}`).click()
    await page.getByTestId(`request-access-${DIRECT.name}`).click()
    await page.getByTestId('confirm-request-access').click()
  })

  test('Owner grants direct access to pro2 - request auto-resolves', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${DIRECT.name}-pro2`)
    ).toBeVisible()

    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${DIRECT.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await page.getByTestId('new-permission-username-or-email').fill(PRO2_EMAIL)
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      LABEL_READ
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${PRO2_SHORTNAME}`)
    ).toContainText(LABEL_READ)
  })

  test('Pro2 access request auto-resolved after direct grant', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToCatalog(page)
    await expect(
      page.getByTestId(`sharing-request-${DIRECT.name}-pro2`)
    ).not.toBeVisible()
  })

  test('Restricted collection visible for pro2 with direct grant', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${DIRECT.name}`)
    ).toBeVisible()
    await page.getByTestId(`answer-collection-actions-${DIRECT.name}`).click()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of DIRECT.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Pro1 can use shared collection in SE question', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page.getByTestId(`select-question-type-${LABEL_SELECTION}`).click()
    await page.getByTestId('select-answer-collection').click()
    await expect(
      page.getByTestId(`select-answer-collection-${DIRECT.name}`)
    ).toBeVisible()
    await page.getByTestId('close-element-modal').click()
  })

  test('Cleanup: Remove direct collection from pro1 and pro2, delete', async ({
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
    loginLecturer,
    logoutUser,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${DIRECT.name}`)
    ).toBeVisible()
    await removeAnswerCollection(page, DIRECT.name)
    await logoutUser()

    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${DIRECT.name}`)
    ).toBeVisible()
    await removeAnswerCollection(page, DIRECT.name)
    await logoutUser()

    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, DIRECT.name)
  })
})

test.describe('T: Access levels and associated permissions', () => {
  test('Create access collection and grant READ/WRITE/ADMIN permissions', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(page.getByTestId('answer-collection-list')).toBeVisible()
    await createAnswerCollection(
      page,
      ACCESS.name,
      ACCESS.description,
      ACCESS.items
    )

    // Grant READ to pro1
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(PRO1_SHORTNAME)
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      LABEL_READ
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)
  })

  test('Grant WRITE to pro2', async ({ loginLecturer, page }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(PRO2_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-WRITE').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${PRO2_SHORTNAME}`)
    ).toContainText(LABEL_WRITE)
  })

  test('Grant ADMIN to pro3', async ({ loginLecturer, page }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
    await page
      .getByTestId('new-permission-username-or-email')
      .fill(PRO3_SHORTNAME)
    await page.getByTestId('new-permission-access-level').click()
    await page.getByTestId('permission-level-ADMIN').click()
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expect(
      page.getByTestId(`permission-${PRO3_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Pro1 can view collection and remove it (READ)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${ACCESS.name}`)
    ).toBeVisible()

    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of ACCESS.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Pro1 has remove (not delete) option', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('remove-answer-collection')).toBeVisible()
    await expect(page.getByTestId('delete-answer-collection')).not.toBeVisible()
  })

  test('Pro1 creates SE question with access collection', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      ACCESS.name,
      QUESTION.solutions,
      ACCESS.items
    )
  })

  test('Pro1 can no longer remove collection (used in question)', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('remove-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  test('Pro2 makes WRITE changes to collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await testAnswerCollectionEditPermissions(
      page,
      ACCESS.name,
      ACCESS.replacedName,
      ACCESS.replacedEntry,
      ACCESS.items[0],
      ACCESS.newEntry,
      ACCESS.newEntry2
    )
  })

  test('Owner verifies and undoes WRITE changes', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await validateAndUndoWritePermissionChanges(
      page,
      ACCESS.name,
      ACCESS.replacedName,
      ACCESS.replacedEntry,
      ACCESS.items[0],
      ACCESS.newEntry,
      ACCESS.newEntry2
    )
  })

  test('Pro2 has remove (not delete) option', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('remove-answer-collection')).toBeVisible()
    await expect(page.getByTestId('delete-answer-collection')).not.toBeVisible()
  })

  test('Pro2 creates SE question with access collection', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      ACCESS.name,
      QUESTION.solutions,
      ACCESS.items
    )
  })

  test('Pro2 can no longer remove collection (used in question)', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('remove-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  test('Pro3 makes ADMIN-level changes to collection', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await testAnswerCollectionEditPermissions(
      page,
      ACCESS.name,
      ACCESS.replacedName,
      ACCESS.replacedEntry,
      ACCESS.items[0],
      ACCESS.newEntry,
      ACCESS.newEntry2
    )
  })

  test('Owner verifies and undoes pro3 changes', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await validateAndUndoWritePermissionChanges(
      page,
      ACCESS.name,
      ACCESS.replacedName,
      ACCESS.replacedEntry,
      ACCESS.items[0],
      ACCESS.newEntry,
      ACCESS.newEntry2
    )
  })

  test('Pro3 has both remove and delete options', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('remove-answer-collection')).toBeVisible()
    await expect(page.getByTestId('delete-answer-collection')).toBeVisible()
  })

  test('Pro3 creates SE question with access collection', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('library').click()
    await createSEQuestion(
      page,
      QUESTION.title,
      QUESTION.content,
      ACCESS.name,
      QUESTION.solutions,
      ACCESS.items
    )
  })

  test('Pro3 can no longer remove or delete collection (used in question)', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('remove-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
    await expect(page.getByTestId('delete-answer-collection')).toHaveAttribute(
      'data-disabled'
    )
  })

  test('Pro3 can open sharing dialogue and see all permissions', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)
    await expect(
      page.getByTestId(`permission-${PRO2_SHORTNAME}`)
    ).toContainText(LABEL_WRITE)
    await expect(
      page.getByTestId(`permission-${PRO3_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Pro3 modifies pro1 permissions to WRITE', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)
    await page.getByTestId(`permission-level-${PRO1_SHORTNAME}`).click()
    await page.getByTestId('permission-level-WRITE').click()
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_WRITE)
  })

  test('Pro1 now has WRITE permissions and can edit', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await testAnswerCollectionEditPermissions(
      page,
      ACCESS.name,
      ACCESS.replacedName,
      ACCESS.replacedEntry,
      ACCESS.items[0],
      ACCESS.newEntry,
      ACCESS.newEntry2
    )
  })

  test('Owner verifies pro1 WRITE changes, undoes them, reverts pro1 to READ', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await validateAndUndoWritePermissionChanges(
      page,
      ACCESS.name,
      ACCESS.replacedName,
      ACCESS.replacedEntry,
      ACCESS.items[0],
      ACCESS.newEntry,
      ACCESS.newEntry2
    )
    await page.getByTestId('close-answer-collection-edit-modal').click()

    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_WRITE)
    await page.getByTestId(`permission-level-${PRO1_SHORTNAME}`).click()
    await page.getByTestId('permission-level-READ').click()
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)

    // Verify revoke is not disabled
    await expect(
      page.getByTestId(`revoke-permission-${PRO1_SHORTNAME}`)
    ).not.toBeDisabled()
    await expect(
      page.getByTestId(`revoke-permission-${PRO2_SHORTNAME}`)
    ).not.toBeDisabled()
    await expect(
      page.getByTestId(`revoke-permission-${PRO3_SHORTNAME}`)
    ).not.toBeDisabled()
  })

  test('Pro1 has read permissions again - view only', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${ACCESS.name}`)
    ).toBeVisible()

    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await expect(page.getByTestId('edit-answer-collection')).not.toBeVisible()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of ACCESS.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Remove question for pro1', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await page.getByTestId('library').click()
    await deleteElement(page, QUESTION.title)
  })

  test('Revoke pro1 access and verify derived permission handling', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page.getByTestId(`answer-collection-actions-${ACCESS.name}`).click()
    await page.getByTestId('share-answer-collection').click()

    await page.getByTestId(`revoke-permission-${PRO1_SHORTNAME}`).click()
    await page.getByTestId('confirm-revocation').click()
    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).not.toBeVisible()

    // Show derived permissions - none for revoked user
    await page.getByTestId('show-derived-permissions').click()
    await expect(
      page.getByTestId(`derived-permission-${PRO2_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`derived-permission-${PRO3_SHORTNAME}`)
    ).not.toBeVisible()

    // Revoke pro2 permission
    await page.getByTestId(`revoke-permission-${PRO2_SHORTNAME}`).click()
    await page.getByTestId('confirm-revocation').click()
    await expect(
      page.getByTestId(`revoke-permission-${PRO3_SHORTNAME}`)
    ).not.toBeDisabled()

    // Derived permission shown for pro2 (has a question)
    await expect(
      page.getByTestId(`derived-permission-${PRO2_SHORTNAME}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`derived-permission-${PRO3_SHORTNAME}`)
    ).not.toBeVisible()

    // Hide derived permissions
    await page.getByTestId('hide-derived-permissions').click()
    await expect(
      page.getByTestId(`derived-permission-${PRO2_SHORTNAME}`)
    ).not.toBeVisible()
  })

  test('Cleanup: remove question and collection for pro2', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await page.getByTestId('library').click()
    await deleteElement(page, QUESTION.title)

    await page.reload()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-actions-${ACCESS.name}`)
    ).not.toBeVisible()
  })

  test('Cleanup: remove question and collection for pro3', async ({
    loginInstitutionalCatalyst2,
    page,
  }) => {
    await loginInstitutionalCatalyst2()
    await page.getByTestId('library').click()
    await deleteElement(page, QUESTION.title)

    await goToAnswerCollections(page)
    await removeAnswerCollection(page, ACCESS.name)
  })

  test('Cleanup: delete access collection', async ({ loginLecturer, page }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, ACCESS.name)
  })
})

test.describe('T: Ownership transfer', () => {
  test('Create ownership collection and grant READ to pro1', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await createAnswerCollection(
      page,
      OWNERSHIP.name,
      OWNERSHIP.description,
      OWNERSHIP.items
    )
    await grantCollectionAccess(
      page,
      OWNERSHIP.name,
      PRO1_SHORTNAME,
      LABEL_READ
    )
  })

  test('Transfer ownership to pro2 using email', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await page.getByTestId('transfer-ownership').click()

    await page.getByTestId('cancel-ownership-transfer').click()
    await page.getByTestId('transfer-ownership').click()
    await page.getByTestId('new-owner-username-email-input').fill(PRO2_EMAIL)
    await page.getByTestId('confirm-ownership-transfer').click()

    await expect(page.getByTestId('transfer-ownership')).not.toBeVisible()
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Pro2 is new owner with all permissions visible', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).toContainText(LABEL_READ)
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Pro1 still has read access', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await expect(
      page.getByTestId(`answer-collection-${OWNERSHIP.name}`)
    ).toBeVisible()

    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of OWNERSHIP.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Transfer ownership from pro2 to pro1 using username', async ({
    loginInstitutionalCatalyst,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await page.getByTestId('transfer-ownership').click()
    await page
      .getByTestId('new-owner-username-email-input')
      .fill(PRO1_SHORTNAME)
    await page.getByTestId('confirm-ownership-transfer').click()

    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`permission-${PRO2_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Pro1 is new owner with all permissions visible', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${PRO1_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`permission-${PRO2_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Main user downgrades own ADMIN to READ', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
    await page.getByTestId(`permission-level-${LECTURER_SHORTNAME}`).click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('cancel-modify-own-permissions').click()
    await page.getByTestId(`permission-level-${LECTURER_SHORTNAME}`).click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-modify-own-permissions').click()

    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`answer-collection-${OWNERSHIP.name}`)
    ).toContainText(LABEL_READ)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await expect(page.getByTestId('share-answer-collection')).not.toBeVisible()
    await expect(page.getByTestId('edit-answer-collection')).not.toBeVisible()
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const value of OWNERSHIP.items) {
      await expect(page.getByText(value)).toBeVisible()
    }
  })

  test('Pro1 upgrades main user back to ADMIN', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_READ)
    await page.getByTestId(`permission-level-${LECTURER_SHORTNAME}`).click()
    await page.getByTestId('permission-level-ADMIN').click()
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
  })

  test('Main user revokes own access', async ({ loginLecturer, page }) => {
    await loginLecturer()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()

    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).toContainText(LABEL_ADMIN)
    await page.getByTestId(`revoke-permission-${LECTURER_SHORTNAME}`).click()
    await page.getByTestId('cancel-modify-own-permissions').click()
    await page.getByTestId(`revoke-permission-${LECTURER_SHORTNAME}`).click()
    await page.getByTestId('confirm-modify-own-permissions').click()
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).not.toBeVisible()
  })

  test('Main user has no permissions on collection anymore', async ({
    loginIndividualCatalyst,
    page,
  }) => {
    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await page
      .getByTestId(`answer-collection-actions-${OWNERSHIP.name}`)
      .click()
    await page.getByTestId('share-answer-collection').click()
    await expect(
      page.getByTestId(`permission-${LECTURER_SHORTNAME}`)
    ).not.toBeVisible()
  })

  test('Cleanup: Pro2 removes collection, pro1 deletes it', async ({
    loginInstitutionalCatalyst,
    loginIndividualCatalyst,
    logoutUser,
    page,
  }) => {
    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await removeAnswerCollection(page, OWNERSHIP.name)
    await logoutUser()

    await loginIndividualCatalyst()
    await expect(page.getByTestId('analytics')).toBeVisible()
    await goToAnswerCollections(page)
    await deleteAnswerCollection(page, OWNERSHIP.name)
  })
})
