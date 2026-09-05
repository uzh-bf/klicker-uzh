// @ts-nocheck
/**
 * Playwright translation of T-resources.
 * Mirrors the original Cypress workflow with native Playwright actions.
 */
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { test } from '../util/fixtures.js'
import { enMessages as messages } from '../util/messages.js'
import {
  addObjectToCatalog,
  createAnswerCollection,
  createQuestionSE,
  deleteAnswerCollection,
  deleteElement,
  editElement,
  env,
  expectByAssertion,
  gotoCommit,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginInstitutionalCatalyst2,
  loginInstitutionalCatalyst3,
  loginLecturer,
  logoutUser,
  runTask,
  selectOption,
  typeInto,
  validateElement,
} from '../util/workflow.js'

function readFixture(name: string) {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  )
}

let page: Page
const aliases = new Map<string, unknown>()
const data = Object.assign({}, readFixture('T-resources.json'))

test.describe.serial('Create, edit and share answer collections', () => {
  async function removeAnswerCollection({ name }: { name: string }) {
    await clickAnswerCollectionAction(name, 'remove-answer-collection')
    await page.getByTestId('confirm-remove-object').click()
  }

  async function openAnswerCollectionOptions() {
    if (
      await page
        .getByTestId('search-answer-options')
        .isVisible({ timeout: 500 })
        .catch(() => false)
    ) {
      return
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByTestId('open-answer-collection-options').click()
      if (
        await page
          .getByTestId('search-answer-options')
          .isVisible({ timeout: 1_000 })
          .catch(() => false)
      ) {
        return
      }
    }

    await expect(page.getByTestId('search-answer-options')).toBeVisible({
      timeout: 30_000,
    })
  }

  async function openUserGroupsPage() {
    await gotoCommit(page, `${env('URL_MANAGE')}/resources/userGroups`)
    await expect(page.getByTestId('create-user-group')).toBeVisible()
  }

  async function openAnswerCollectionsPage() {
    await gotoCommit(page, `${env('URL_MANAGE')}/resources/answerCollections`)
    await expect(page.getByTestId('create-answer-collection')).toBeVisible()
  }

  async function openAnswerCollectionActions(
    collectionName: string,
    expectedAction = 'edit-answer-collection'
  ) {
    const action = page.getByTestId(expectedAction)

    for (let attempt = 0; attempt < 3; attempt++) {
      await page
        .getByTestId(`answer-collection-actions-${collectionName}`)
        .click()

      if (await action.isVisible({ timeout: 1_000 }).catch(() => false)) {
        return
      }
    }

    await expect(action).toBeVisible()
  }

  async function clickAnswerCollectionAction(
    collectionName: string,
    actionTestId: string
  ) {
    await openAnswerCollectionActions(collectionName, actionTestId)
    await page.getByTestId(actionTestId).click()
  }

  async function grantCollectionAccess({
    collectionName,
    permissionLevel,
    username,
  }: {
    collectionName: string
    permissionLevel: string
    username: string
  }) {
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(collectionName, 'share-answer-collection')
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      username
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      permissionLevel
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      permissionLevel
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId(`permission-${username}`), 'exist')
    await expect(
      page
        .getByTestId(`permission-${username}`)
        .filter({ hasText: permissionLevel })
        .first()
    ).toBeAttached()
  }

  async function testAnswerCollectionEditPermissions(data) {
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'edit-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      data.access.name
    )
    await page.getByTestId('answer-collection-name').click()
    await page.getByTestId('answer-collection-name').clear()
    await typeInto(
      page.getByTestId('answer-collection-name'),
      data.access.replacedName
    )
    await page.getByTestId('save-changes-answer-collection').click()
    await openAnswerCollectionOptions()
    await page.getByTestId(`edit-answer-option-${data.access.items[0]}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-answer-option-input`),
      'have.value',
      data.access.items[0]
    )
    await page.getByTestId(`edit-answer-option-input`).click()
    await page.getByTestId(`edit-answer-option-input`).clear()
    await typeInto(
      page.getByTestId(`edit-answer-option-input`),
      data.access.replacedEntry
    )
    await page.getByTestId(`save-edit-answer-option`).click()
    await page.getByTestId('add-answer-option').click()
    await typeInto(
      page.getByTestId(`input-new-answer-option`),
      data.access.newEntry
    )
    await page.getByTestId(`save-new-answer-option`).click()
    await page.getByTestId('add-answer-option').click()
    await page.getByTestId('input-new-answer-option').click()
    await typeInto(
      page.getByTestId('input-new-answer-option'),
      data.access.newEntry2
    )
    await page.getByTestId('save-new-answer-option').click()
    await page
      .getByTestId(`delete-answer-option-${data.access.newEntry2}`)
      .click()
  }

  async function validateAndUndoWritePermissionChanges(data) {
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.replacedName,
      'edit-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      data.access.replacedName
    )
    await page.getByTestId('answer-collection-name').click()
    await page.getByTestId('answer-collection-name').clear()
    await typeInto(page.getByTestId('answer-collection-name'), data.access.name)
    await page.getByTestId('save-changes-answer-collection').click()
    await openAnswerCollectionOptions()
    await page
      .getByTestId(`edit-answer-option-${data.access.replacedEntry}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-answer-option-input`),
      'have.value',
      data.access.replacedEntry
    )
    await page.getByTestId(`edit-answer-option-input`).click()
    await page.getByTestId(`edit-answer-option-input`).clear()
    await typeInto(
      page.getByTestId(`edit-answer-option-input`),
      data.access.items[0]
    )
    await page.getByTestId(`save-edit-answer-option`).click()
    await expectByAssertion(
      page.getByTestId(`edit-answer-option-${data.access.newEntry}`),
      'exist'
    )
    await page
      .getByTestId(`delete-answer-option-${data.access.newEntry}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-answer-option-${data.access.newEntry2}`),
      'not.exist'
    )
  }

  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Create an answer collection', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await gotoCommit(page, `${env('URL_MANAGE')}/resources/answerCollections`)
    await expect(page.getByTestId('create-answer-collection')).toBeVisible()
    await page.getByTestId('create-answer-collection').click()
    await expectByAssertion(page.getByTestId('answer-collection-name'), 'exist')
    await page.getByTestId('cancel-create-answer-collection').click()
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'not.exist'
    )
    await page.getByTestId('create-answer-collection').click()
    await typeInto(page.getByTestId('answer-collection-name'), data.public.name)
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      data.public.name
    )
    await page.getByTestId('answer-collection-description').click()
    await typeInto(
      page.getByTestId('answer-collection-description'),
      data.public.description
    )
    await page.getByTestId('answer-collection-description').click()
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(data.public.description)
    await typeInto(page.getByTestId('response-entry-0'), data.public.items[0])
    await expectByAssertion(
      page.getByTestId('response-entry-0'),
      'have.value',
      data.public.items[0]
    )
    await typeInto(page.getByTestId('response-entry-1'), data.public.items[1])
    await expectByAssertion(
      page.getByTestId('response-entry-1'),
      'have.value',
      data.public.items[1]
    )
    for (const [ix, value] of Array.from(
      data.public.items.slice(2)
    ).entries()) {
      await page.getByTestId('add-response-entry').click()
      await typeInto(page.getByTestId(`response-entry-${ix + 2}`), value)
      await expectByAssertion(
        page.getByTestId(`response-entry-${ix + 2}`),
        'have.value',
        value
      )
    }
    await expectByAssertion(
      page.getByTestId(`response-entry-${data.public.items.length - 1}`),
      'exist'
    )
    await page.getByTestId('remove-response-entry-3').click()
    await expectByAssertion(
      page.getByTestId(`response-entry-${data.public.items.length - 1}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`response-entry-3`),
      'have.value',
      data.public.items[4]
    )
    await expectByAssertion(
      page.getByTestId('submit-create-answer-collection'),
      'not.be.disabled'
    )
    await page.getByTestId('add-response-entry').click()
    await typeInto(
      page.getByTestId(`response-entry-${data.public.items.length - 1}`),
      data.public.items[0]
    )
    await expectByAssertion(
      page.getByTestId(`response-entry-${data.public.items.length - 1}`),
      'have.value',
      data.public.items[0]
    )
    await page
      .getByTestId(`remove-response-entry-${data.public.items.length - 1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`response-entry-${data.public.items.length - 1}`),
      'not.exist'
    )
    await page.getByTestId('submit-create-answer-collection').click()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
  })

  test('Edit the answer collection', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.public.name,
      'edit-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      data.public.name
    )
    await page.getByTestId('answer-collection-name').fill(data.public.nameNew)
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      data.public.nameNew
    )
    await page.getByTestId('answer-collection-description').click()
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(data.public.description)
    await page.getByTestId('answer-collection-description').click()
    await page.getByTestId('answer-collection-description').clear()
    await typeInto(
      page.getByTestId('answer-collection-description'),
      data.public.descriptionNew
    )
    await page.getByTestId('answer-collection-description').click()
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(data.public.descriptionNew)
    await page.waitForTimeout(100)
    await page.getByTestId('save-changes-answer-collection').click()
    await page.waitForTimeout(1000)
    await openAnswerCollectionOptions()
    for (const [__index, value] of Array.from(
      data.public.itemsAfterDeletion
    ).entries()) {
      await expect(page.getByTestId(`answer-option-${value}`)).toContainText(
        value
      )
    }
    await page
      .getByTestId(`edit-answer-option-${data.public.itemsAfterDeletion[0]}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-answer-option-input`),
      'have.value',
      data.public.itemsAfterDeletion[0]
    )
    await expectByAssertion(
      page.getByTestId(`save-edit-answer-option`),
      'not.be.disabled'
    )
    await page.getByTestId(`edit-answer-option-input`).clear()
    await typeInto(
      page.getByTestId(`edit-answer-option-input`),
      data.public.itemsAfterDeletion[1]
    )
    await expectByAssertion(
      page.getByTestId(`save-edit-answer-option`),
      'be.disabled'
    )
    await page.getByTestId(`edit-answer-option-input`).clear()
    await typeInto(
      page.getByTestId(`edit-answer-option-input`),
      data.public.itemsAfterDeletion[0]
    )
    await expectByAssertion(
      page.getByTestId(`save-edit-answer-option`),
      'not.be.disabled'
    )
    await page.getByTestId(`edit-answer-option-input`).clear()
    await expectByAssertion(
      page.getByTestId(`save-edit-answer-option`),
      'be.disabled'
    )
    await page.getByTestId(`edit-answer-option-input`).clear()
    await typeInto(
      page.getByTestId(`edit-answer-option-input`),
      data.public.itemsAfterDeletion[0]
    )
    await page.getByTestId(`save-edit-answer-option`).click()
    for (const [ix, value] of Array.from(
      data.public.itemsAfterDeletion
    ).entries()) {
      await page.getByTestId(`edit-answer-option-${value}`).click()
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-input`),
        'have.value',
        value
      )
      await page.getByTestId(`edit-answer-option-input`).clear()
      await typeInto(
        page.getByTestId(`edit-answer-option-input`),
        data.public.itemsNew[ix]
      )
      await page.getByTestId(`save-edit-answer-option`).click()
      await expect(
        page.getByTestId(`answer-option-${data.public.itemsNew[ix]}`)
      ).toContainText(data.public.itemsNew[ix])
    }
    const existingElement = data.public.itemsNew[0]
    const lastElement = data.public.itemsNew[data.public.itemsNew.length - 1]
    await page.getByTestId(`delete-answer-option-${lastElement}`).click()
    await expectByAssertion(
      page.getByTestId(`answer-option-${lastElement}`),
      'not.exist'
    )
    await page.getByTestId(`add-answer-option`).click()
    await expectByAssertion(
      page.getByTestId(`save-new-answer-option`),
      'be.disabled'
    )
    await typeInto(page.getByTestId(`input-new-answer-option`), lastElement)
    await expectByAssertion(
      page.getByTestId(`save-new-answer-option`),
      'not.be.disabled'
    )
    await page.getByTestId(`input-new-answer-option`).clear()
    await typeInto(page.getByTestId(`input-new-answer-option`), existingElement)
    await expectByAssertion(
      page.getByTestId(`save-new-answer-option`),
      'be.disabled'
    )
    await typeInto(page.getByTestId(`input-new-answer-option`), lastElement)
    await expectByAssertion(
      page.getByTestId(`save-new-answer-option`),
      'not.be.disabled'
    )
    await page.getByTestId(`input-new-answer-option`).clear()
    await expectByAssertion(
      page.getByTestId(`save-new-answer-option`),
      'be.disabled'
    )
    await typeInto(page.getByTestId(`input-new-answer-option`), lastElement)
    await page.getByTestId(`save-new-answer-option`).click()
    await expect(
      page.getByTestId(`answer-option-${lastElement}`)
    ).toContainText(lastElement)
  })

  test('Verify that the changes to the private answer collection persist', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.public.nameNew,
      'edit-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      data.public.nameNew
    )
    await page.getByTestId('answer-collection-description').click()
    await expect(
      page.getByTestId('answer-collection-description')
    ).toContainText(data.public.descriptionNew)
    await page.waitForTimeout(100)
    await page.getByTestId('save-changes-answer-collection').click()
    await openAnswerCollectionOptions()
    for (const [__index, value] of Array.from(data.public.itemsNew).entries()) {
      await expect(page.getByTestId(`answer-option-${value}`)).toContainText(
        value
      )
    }
  })

  test('Verify that all answer collections can be used in selection questions by owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await page.getByTestId('select-answer-collection').click()
    await expectByAssertion(
      page.getByTestId(`select-answer-collection-${data.public.nameNew}`),
      'exist'
    )
  })

  test('Cleanup: Delete all created answer collections (full deletion, since no other users have access)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.nameNew}`),
      'exist'
    )
    await deleteAnswerCollection(page, { collectionName: data.public.nameNew })
  })

  test('Create a private answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.private.name,
      description: data.private.description,
      entries: data.private.items,
      userId: env('LECTURER_ID'),
    })
  })

  test('Verify that the private answer collection can be used in a selection question by the owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.private.name,
      correctAnswers: data.private.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_ID'),
    })
    await validateElement(page, { element: data.question.title })
  })

  test("Verify that the private answer collection cannot be integrated into a question by user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await expectByAssertion(
      page.getByTestId('select-answer-collection'),
      'not.exist'
    )
  })

  test('Verify that the private answer collection cannot be deleted as it is used in a question', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await openAnswerCollectionActions(
      data.private.name,
      'delete-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'have.attr',
      'data-disabled'
    )
  })

  test('Delete the selection question that depends on the private answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await validateElement(page, { element: data.question.title })
    await deleteElement(page, { elementName: data.question.title })
    await validateElement(page, {
      element: data.question.title,
      shouldExist: false,
    })
  })

  test('Verify that the private answer collection can be deleted', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.private.name })
  })

  test('Create an answer collection [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.restricted.name,
      description: data.restricted.description,
      entries: data.restricted.items,
      userId: env('LECTURER_ID'),
    })
  })

  test('Add the answer collection as a restricted collection to the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.goto(`${env('URL_MANAGE')}/resources/catalog`, {
      waitUntil: 'commit',
    })
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
    await addObjectToCatalog(page, {
      objectName: data.restricted.name,
      objectType: 'ANSWER_COLLECTION',
      permissionLevel: 'restricted',
    })
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await expectByAssertion(
      page.getByTestId(`copy-object-${data.restricted.name}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`request-access-${data.restricted.name}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-object-${data.restricted.name}`),
      'exist'
    )
  })

  test('Test filters and search on the catalog page', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await page.getByTestId('search-catalog-collection').click()
    await typeInto(
      page.getByTestId('search-catalog-collection'),
      data.private.name
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'not.exist'
    )
    await page.getByTestId('search-catalog-collection').clear()
    await typeInto(
      page.getByTestId('search-catalog-collection'),
      data.restricted.name
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await expect(page.getByTestId('catalog-access-type-filter')).toContainText(
      messages.manage.catalog.all
    )
    await page.getByTestId('catalog-access-type-filter').click()
    await page.getByTestId('catalog-access-public').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'not.exist'
    )
    await page.getByTestId('catalog-access-type-filter').click()
    await page.getByTestId('catalog-access-restricted').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await page.getByTestId('catalog-access-type-filter').click()
    await page.getByTestId('catalog-access-all').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
  })

  test('Request access to restricted answer collection (for user pro1)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await page.getByTestId(`request-access-${data.restricted.name}`).click()
    await page.getByTestId('cancel-request-access').click()
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await page.getByTestId(`request-access-${data.restricted.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.restricted.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Request access to restricted answer collection (for user pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await page.getByTestId(`request-access-${data.restricted.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.restricted.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Verify that access requests are correctly shown to collection owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.restricted.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.restricted.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.restricted.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.restricted.name}-pro2`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.restricted.name}-pro2`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.restricted.name}-pro2`),
      'exist'
    )
  })

  test('Temporarily award ADMIN permissions to user pro3 and verify that the access requests are visible as well', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'share-answer-collection'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST2_SHORTNAME')
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.restricted.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.restricted.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.restricted.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.restricted.name}-pro2`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.restricted.name}-pro2`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.restricted.name}-pro2`),
      'exist'
    )
    await logoutUser(page)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await page
      .getByTestId(`revoke-permission-${env('LECTURER_INST2_SHORTNAME')}`)
      .click()
    await page.getByTestId('cancel-revocation').click()
    await page
      .getByTestId(`revoke-permission-${env('LECTURER_INST2_SHORTNAME')}`)
      .click()
    await page.getByTestId('confirm-revocation').click()
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.restricted.name}-pro1`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.restricted.name}-pro1`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.restricted.name}-pro1`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.restricted.name}-pro2`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.restricted.name}-pro2`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.restricted.name}-pro2`),
      'not.exist'
    )
  })

  test('Verify that answer collection cannot be integrated into question by user pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await expectByAssertion(
      page.getByTestId('select-answer-collection'),
      'not.exist'
    )
  })

  test('Cancel the request through user pro1 and request the answer collection again', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expect(
      page.getByTestId(`catalog-object-${data.restricted.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await page.getByTestId(`cancel-request-${data.restricted.name}`).click()
    await page.getByTestId('confirm-request-cancellation').click()
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await page.getByTestId(`request-access-${data.restricted.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.restricted.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Grant access to restricted answer collection (for user pro1)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page
      .getByTestId(`approve-sharing-request-${data.restricted.name}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-approval').click()
  })

  test('Decline access request to restricted answer collection (for user pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page
      .getByTestId(`deny-sharing-request-${data.restricted.name}-pro2`)
      .click()
  })

  test("Verify that the active permission for user 'pro1' is shown correctly", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test('Verify that restricted answer collection is visible in resources for user pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.restricted.name}`),
      'exist'
    )
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${data.restricted.name}`)
      .click()
  })

  test('Verify that restricted answer collection is not visible in resources for user pro2', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expect(
      page.getByText(messages.manage.resources.noAnswerCollections).first()
    ).toBeAttached()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.restricted.name}`),
      'not.exist'
    )
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await expectByAssertion(
      page.getByTestId('select-answer-collection'),
      'not.exist'
    )
  })

  test('Verify that restricted answer collection can be used in selection question by user pro1 and create question', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.restricted.name,
      correctAnswers: data.restricted.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_IND_ID'),
    })
  })

  test('Verify that collection cannot be removed by user pro1 as it is used in a question', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await page
      .getByTestId(`answer-collection-actions-${data.restricted.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'have.attr',
      'data-disabled'
    )
  })

  test('Verify that answer option used as a sample solution cannot be removed (by owner)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'edit-answer-collection'
    )
    await openAnswerCollectionOptions()
    for (const [ix, value] of Array.from(data.restricted.items).entries()) {
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${value}`),
        'not.be.disabled'
      )
      if (data.question.solutions.includes(ix)) {
        await expectByAssertion(
          page.getByTestId(`delete-answer-option-${value}`),
          'be.disabled'
        )
      } else {
        await expectByAssertion(
          page.getByTestId(`delete-answer-option-${value}`),
          'not.be.disabled'
        )
      }
    }
  })

  test('Delete the selection question (user pro1)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('library').click()
    await validateElement(page, { element: data.question.title })
    await deleteElement(page, { elementName: data.question.title })
    await validateElement(page, {
      element: data.question.title,
      shouldExist: false,
    })
  })

  test('Verify that restricted answer collection can be removed by user pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'remove-answer-collection'
    )
    await page.getByTestId('close-remove-object').click()
  })

  test('Verify that all answer options of the restricted answer collection can be edited and deleted again by owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'edit-answer-collection'
    )
    await openAnswerCollectionOptions()
    for (const [ix, value] of Array.from(data.restricted.items).entries()) {
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${value}`),
        'not.be.disabled'
      )
      await expectByAssertion(
        page.getByTestId(`delete-answer-option-${value}`),
        'not.be.disabled'
      )
    }
  })

  test('Change the access level of the answer collection in the catalog to public', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expect(
      page.getByTestId(`${data.restricted.name}-object-access`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId(`${data.restricted.name}-object-access`).click()
    await expectByAssertion(
      page.getByTestId('object-access-restricted'),
      'exist'
    )
    await page.getByTestId('object-access-public').click()
    await page.getByTestId('confirm-access-change').click()
    await expect(
      page.getByTestId(`${data.restricted.name}-object-access`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  })

  test('Verify that answer collections can now be imported or requested', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await expectByAssertion(
      page.getByTestId(`copy-object-${data.restricted.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`request-access-${data.restricted.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-object-${data.restricted.name}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`${data.restricted.name}-object-access`),
      'not.exist'
    )
  })

  test('Remove the answer collection from the catalog (by owner)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByTestId(`actions-dropdown-${data.restricted.name}`).click()
    await page.getByTestId(`remove-object-${data.restricted.name}`).click()
    await page.getByTestId('confirm-removal').click()
  })

  test('Verify that the answer collection is no longer visible in the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'not.exist'
    )
  })

  test('Re-add the answer collection with restricted access to the answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await addObjectToCatalog(page, {
      objectName: data.restricted.name,
      objectType: 'ANSWER_COLLECTION',
      permissionLevel: 'restricted',
    })
  })

  test("Grant admin access to user 'pro2' for the restricted answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.restricted.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').clear()
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test('Verify that user pro2 should now be able to add this collection to the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ANSWER_COLLECTION`).click()
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await expectByAssertion(
      page.locator(
        '[id="react-select-object-selection-catalog-addition-option-0"]'
      ),
      'exist'
    )
  })

  test("Create a question with the restricted answer collection for user 'pro2'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.restricted.name,
      correctAnswers: data.restricted.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_INST_ID'),
    })
  })

  test('Delete created restricted answer collection (through owner interface - soft deletion since used by pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.restricted.name })
  })

  test('Verify that the soft-deleted answer collection is no longer visible in the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.restricted.name}`),
      'not.exist'
    )
  })

  test('Verify that the unused access to the collection for user pro1 has been revoked', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.restricted.name}`),
      'not.exist'
    )
  })

  test('Verify that the user pro2 can no longer the answer collection in the overview or add it to the catalog, but the depenedent element remained intact', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.restricted.name}`),
      'not.exist'
    )
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ANSWER_COLLECTION`).click()
    await expect(
      page.getByText(messages.manage.catalog.noObjectsAvailable).first()
    ).toBeAttached()
    await page.getByTestId('close-add-object-modal').click()
    await page.getByTestId('library').click()
    await editElement(page, { element: data.question.title })
    await expectByAssertion(
      page.getByTestId('save-new-question'),
      'not.be.disabled'
    )
    await page.getByTestId('close-element-modal').click()
    await validateElement(page, { element: data.question.title })
    await deleteElement(page, { elementName: data.question.title })
    await validateElement(page, {
      element: data.question.title,
      shouldExist: false,
    })
  })

  test('Create an answer collection [3]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.public.name,
      description: data.public.description,
      entries: data.public.items,
      userId: env('LECTURER_ID'),
    })
  })

  test('Add the answer collection with public access to the catalog and verify visibility', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await addObjectToCatalog(page, {
      objectName: data.public.name,
      objectType: 'ANSWER_COLLECTION',
      permissionLevel: 'public',
    })
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.public.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await expectByAssertion(
      page.getByTestId(`copy-object-${data.public.name}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`request-access-${data.public.name}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-object-${data.public.name}`),
      'exist'
    )
  })

  test("Request access to the public answer collection (for user 'pro1')", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.public.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await page.getByTestId(`request-access-${data.public.name}`).click()
    await expect(
      page.getByText(messages.manage.catalog.requestPublicResource).first()
    ).toBeAttached()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.public.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test("Request access to the public answer collection (for user 'pro2')", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.public.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await page.getByTestId(`request-access-${data.public.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.public.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Verify that access requests are correctly shown to collection owner [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.public.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.public.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.public.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.public.name}-pro2`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.public.name}-pro2`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.public.name}-pro2`),
      'exist'
    )
  })

  test('Grant access to public answer collection (for user pro1)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page
      .getByTestId(`approve-sharing-request-${data.public.name}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-approval').click()
  })

  test('Decline access request to public answer collection (for user pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page
      .getByTestId(`deny-sharing-request-${data.public.name}-pro2`)
      .click()
  })

  test("Verify that the active permission for user 'pro1' is shown correctly [2]", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.public.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test("Verify that the public answer collection is visible in resources for user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${data.public.name}`)
      .click()
  })

  test("Verify that the public answer collection is not visible in resources for user 'pro2'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expect(
      page.getByText(messages.manage.resources.noAnswerCollections).first()
    ).toBeAttached()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'not.exist'
    )
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await expectByAssertion(
      page.getByTestId('select-answer-collection'),
      'not.exist'
    )
  })

  test('Copy the public answer collection into a users own account (for user pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.public.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await page.getByTestId(`copy-object-${data.public.name}`).click()
    await page.getByTestId('close-object-copy-modal').click()
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await page.getByTestId(`copy-object-${data.public.name}`).click()
    await page.getByTestId('cancel-object-copy').click()
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await page.getByTestId(`copy-object-${data.public.name}`).click()
    await page.getByTestId('confirm-object-copy').click()
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
  })

  test('Import the public answer collection into a users own account (read permissions; for user pro4)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst3(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.public.name}`),
      'exist'
    )
    await page.getByTestId(`catalog-object-${data.public.name}`).click()
    await page.getByTestId('cancel-object-import').click()
    await page.getByTestId(`actions-dropdown-${data.public.name}`).click()
    await page.getByTestId(`import-object-${data.public.name}`).click()
    await page.getByTestId('confirm-object-import').click()
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`permission-level-${data.public.name}-READ`),
      'exist'
    )
  })

  test('Duplicate the imported answer collection and verify that the user has owner permissions on the duplicate (for user pro4)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst3(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.public.name,
      'duplicate-answer-collection'
    )
    await page.getByTestId('cancel-duplication').click()
    await clickAnswerCollectionAction(
      data.public.name,
      'duplicate-answer-collection'
    )
    await page.getByTestId('confirm-duplication').click()
    const duplicateName = `${data.public.name} (Copy)`
    await expectByAssertion(
      page.getByTestId(`answer-collection-${duplicateName}`),
      'exist'
    )
    await openAnswerCollectionActions(
      duplicateName,
      `view-activity-log-${duplicateName}`
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${duplicateName}`),
      'exist'
    )
    await expectByAssertion(page.getByTestId('edit-answer-collection'), 'exist')
    await expectByAssertion(
      page.getByTestId('share-answer-collection'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('duplicate-answer-collection'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'exist'
    )
    await page.getByTestId('edit-answer-collection').click()
    await expectByAssertion(
      page.getByTestId('answer-collection-name'),
      'have.value',
      duplicateName
    )
    await openAnswerCollectionOptions()
    for (const [__index, value] of Array.from(data.public.items).entries()) {
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${value}`),
        'not.be.disabled'
      )
      await expectByAssertion(
        page.getByTestId(`delete-answer-option-${value}`),
        'not.be.disabled'
      )
    }
  })

  test('Verify that imported answer collection is visible to user pro2 (copied and with edit permissions)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.public.name,
      'edit-answer-collection'
    )
    await openAnswerCollectionOptions()
    for (const [__index, value] of Array.from(data.public.items).entries()) {
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${value}`),
        'not.be.disabled'
      )
      await expectByAssertion(
        page.getByTestId(`delete-answer-option-${value}`),
        'not.be.disabled'
      )
    }
  })

  test('Remove the public answer collection from user pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
    await removeAnswerCollection({ name: data.public.name })
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'not.exist'
    )
  })

  test('Create a selection question with sample solution and imported answer collection (for user pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.public.name,
      correctAnswers: data.public.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_INST_ID'),
    })
    await validateElement(page, { element: data.question.title })
  })

  test("Verify that imported answer collection cannot be deleted by user 'pro2' as it is used in a question", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await page
      .getByTestId(`answer-collection-actions-${data.public.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'have.attr',
      'data-disabled'
    )
  })

  test('Verify that original answer collection can be completely edited by owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.public.name,
      'edit-answer-collection'
    )
    await openAnswerCollectionOptions()
    for (const [__index, value] of Array.from(data.public.items).entries()) {
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${value}`),
        'not.be.disabled'
      )
      await expectByAssertion(
        page.getByTestId(`delete-answer-option-${value}`),
        'not.be.disabled'
      )
    }
  })

  test('Delete the created public answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.public.name })
  })

  test('Verify that imported answer collection is still visible to user pro2 (due to derived permission)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.public.name}`),
      'exist'
    )
  })

  test('Delete the selection question for user pro2', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('library').click()
    await validateElement(page, { element: data.question.title })
    await deleteElement(page, { elementName: data.question.title })
    await validateElement(page, {
      element: data.question.title,
      shouldExist: false,
    })
  })

  test('Remove the imported answer collection from user pro2', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.public.name })
  })

  test('Create user groups with all users and prepare a new answer collection for user group sharing', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.shared.name,
      description: data.shared.description,
      entries: data.shared.items,
      userId: env('LECTURER_ID'),
    })
    await openUserGroupsPage()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.group1)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_IND_SHORTNAME')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.group1}`),
      'exist'
    )
    await expect(page.getByTestId(`user-group-${data.group1}`)).toContainText(
      messages.shared.generic.owner
    )
    await page.getByTestId(`user-group-actions-${data.group1}`).click()
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.group1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-${data.group1}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.group1}`).click()
    await expectByAssertion(page.getByTestId(`edit-group-name`), 'exist')
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await page.getByTestId('close-user-group-edit-modal').click()
    await openUserGroupsPage()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.group2)
    await page.getByTestId('cancel-create-user-group').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.group2)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_INST_EMAIL')
    )
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.group2}`),
      'exist'
    )
    await expect(page.getByTestId(`user-group-${data.group2}`)).toContainText(
      messages.shared.generic.owner
    )
    await page.getByTestId(`user-group-actions-${data.group2}`).click()
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.group2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-${data.group2}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.group2}`).click()
    await expectByAssertion(page.getByTestId(`edit-group-name`), 'exist')
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await page.getByTestId('close-user-group-edit-modal').click()
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await openUserGroupsPage()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.group3)
    await page.getByTestId('cancel-create-user-group').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.group3)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_SHORTNAME')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.group3}`),
      'exist'
    )
    await expect(page.getByTestId(`user-group-${data.group3}`)).toContainText(
      messages.shared.generic.owner
    )
    await page.getByTestId(`user-group-actions-${data.group3}`).click()
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.group3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-${data.group3}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.group3}`).click()
    await expectByAssertion(page.getByTestId(`edit-group-name`), 'exist')
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_SHORTNAME')}`),
      'exist'
    )
    await page.getByTestId('close-user-group-edit-modal').click()
    await logoutUser(page)
  })

  test('Grant direct READ, WRITE and ADMIN permissions to the answer collection for the user groups', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.shared.name,
      'share-answer-collection'
    )
    await expect(page.getByTestId('new-permission-user-group')).toContainText(
      messages.manage.sharing.noUserGroupSelected
    )
    await selectOption(
      page,
      '[data-cy="new-permission-user-group"]',
      data.group1
    )
    await expect(page.getByTestId('new-permission-user-group')).toContainText(
      data.group1
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsREAD
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${data.group1}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${data.group1}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
    await expect(page.getByTestId('new-permission-user-group')).toContainText(
      messages.manage.sharing.noUserGroupSelected
    )
    await selectOption(
      page,
      '[data-cy="new-permission-user-group"]',
      data.group2
    )
    await expect(page.getByTestId('new-permission-user-group')).toContainText(
      data.group2
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsWRITE
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${data.group2}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${data.group2}`)
        .filter({ hasText: messages.manage.sharing.permissionsWRITE })
        .first()
    ).toBeAttached()
    await expect(page.getByTestId('new-permission-user-group')).toContainText(
      messages.manage.sharing.noUserGroupSelected
    )
    await selectOption(
      page,
      '[data-cy="new-permission-user-group"]',
      data.group3
    )
    await expect(page.getByTestId('new-permission-user-group')).toContainText(
      data.group3
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${data.group3}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${data.group3}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test('Verify that the users in group 1 have been granted READ permissions on the answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.shared.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.shared.name,
      'view-answer-collection'
    )
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.shared.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test('Verify that the users in group 2 have been granted WRITE permissions on the answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.shared.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.shared.name,
      'edit-answer-collection'
    )
  })

  test('Verify that the users in group 3 have been granted ADMIN permissions on the answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.shared.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.shared.name,
      'edit-answer-collection'
    )
  })

  test('Create a private answer collection [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.private.name,
      description: data.private.description,
      entries: data.private.items,
      userId: env('LECTURER_ID'),
    })
  })

  test('Verify that the private answer collection is not visible in the catalog for the owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.private.name}`),
      'not.exist'
    )
  })

  test('Add the private collection with restricted object access to the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await addObjectToCatalog(page, {
      objectName: data.private.name,
      objectType: 'ANSWER_COLLECTION',
      permissionLevel: 'restricted',
    })
  })

  test('Verify that the restricted answer collection is now also visible to other users and request access for pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.private.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.private.name}`).click()
    await page.getByTestId(`request-access-${data.private.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.private.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Change the access rights to public access', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expect(
      page.getByTestId(`${data.private.name}-object-access`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId(`${data.private.name}-object-access`).click()
    await expectByAssertion(
      page.getByTestId('object-access-restricted'),
      'exist'
    )
    await page.getByTestId('object-access-public').click()
    await page.getByTestId('confirm-access-change').click()
    await expect(
      page.getByTestId(`${data.private.name}-object-access`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  })

  test('Verify that the pending access request is still visible to the user', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expect(
      page.getByTestId(`catalog-object-${data.private.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Verify that the pending sharing request is still visible to the owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.private.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.private.name}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.private.name}-pro1`),
      'exist'
    )
  })

  test('Verify that the public answer collection is still visible in the catalog for a different user and can be imported', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.private.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.private.name}`).click()
    await expectByAssertion(
      page.getByTestId(`copy-object-${data.private.name}`),
      'exist'
    )
  })

  test('Request access to the public answer collection (for user pro2)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.private.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.private.name}`).click()
    await page.getByTestId(`request-access-${data.private.name}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expect(
      page.getByTestId(`catalog-object-${data.private.name}`)
    ).toContainText(messages.manage.catalog.accessRequested)
  })

  test('Change the access rights to restricted access', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expect(
      page.getByTestId(`${data.private.name}-object-access`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId(`${data.private.name}-object-access`).click()
    await page.getByTestId('object-access-restricted').click()
    await page.getByTestId('confirm-access-change').click()
    await expect(
      page.getByTestId(`${data.private.name}-object-access`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
  })

  test('Verify that the import functionality is not available anymore', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.private.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.private.name}`).click()
    await expectByAssertion(
      page.getByTestId(`copy-object-${data.private.name}`),
      'not.exist'
    )
  })

  test('Approve access request for user pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page
      .getByTestId(`approve-sharing-request-${data.private.name}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-approval').click()
  })

  test('Remove the answer collection entirely from the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByTestId(`actions-dropdown-${data.private.name}`).click()
    await page.getByTestId(`remove-object-${data.private.name}`).click()
    await page.getByTestId('confirm-removal').click()
  })

  test('Verify that access request by user pro2 has been not been declined automatically and decline it', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.private.name}-pro2`),
      'exist'
    )
    await page
      .getByTestId(`deny-sharing-request-${data.private.name}-pro2`)
      .click()
  })

  test('Verify that user pro1 still has access to the private collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.private.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.private.name,
      'view-answer-collection'
    )
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.private.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test('Cleanup: Delete the private answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.private.name })
  })

  test('Create a restricted answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.direct.name,
      description: data.direct.description,
      entries: data.direct.items,
      userId: env('LECTURER_ID'),
    })
  })

  test("Give direct access to user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await expectByAssertion(page.getByTestId('resources'), 'exist')
    await grantCollectionAccess({
      collectionName: data.direct.name,
      username: env('LECTURER_IND_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsREAD,
    })
  })

  test('Add the answer collection with restricted object access to the catalog', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await addObjectToCatalog(page, {
      objectName: data.direct.name,
      objectType: 'ANSWER_COLLECTION',
      permissionLevel: 'restricted',
    })
  })

  test("Verify that the restricted answer collection is visible in resources for user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.direct.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.direct.name,
      'view-answer-collection'
    )
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.direct.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test("Request access to the restricted answer collection (for user 'pro2')", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.direct.name}`),
      'exist'
    )
    await page.getByTestId(`actions-dropdown-${data.direct.name}`).click()
    await page.getByTestId(`request-access-${data.direct.name}`).click()
    await page.getByTestId('confirm-request-access').click()
  })

  test("Verify that the sharing request by user 'pro2' is visible in the catalog and give direct access to the answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.direct.name}-pro2`),
      'exist'
    )
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.direct.name,
      'share-answer-collection'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST_EMAIL')
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test("Verify that the access request by user 'pro2' has been resolved automatically", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await expectByAssertion(
      page.getByTestId(`sharing-request-${data.direct.name}-pro2`),
      'not.exist'
    )
  })

  test("Verify that the restricted answer collection is visible in resources for user 'pro2'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.direct.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.direct.name,
      'view-answer-collection'
    )
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.direct.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test("Verify that shared answer collection can be used in questions by user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('library').click()
    await page.getByTestId('create-question').click()
    await page.getByTestId('select-question-type').click()
    await page
      .getByTestId(
        `select-question-type-${messages.shared.SELECTION.typeLabel}`
      )
      .click()
    await page.getByTestId('select-answer-collection').click()
    await page
      .getByTestId(`select-answer-collection-${data.direct.name}`)
      .click()
  })

  test("Cleanup: Remove the shared answer collection from user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.direct.name}`),
      'exist'
    )
    await removeAnswerCollection({ name: data.direct.name })
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.direct.name}`),
      'not.exist'
    )
  })

  test("Cleanup: Remove the shared answer collection from user 'pro2'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.direct.name}`),
      'exist'
    )
    await removeAnswerCollection({ name: data.direct.name })
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.direct.name}`),
      'not.exist'
    )
  })

  test('Cleanup: Delete the restricted answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.direct.name })
  })

  test('Create a new private answer collection that can be shared between users with different access levels', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.access.name,
      description: data.access.description,
      entries: data.access.items,
      userId: env('LECTURER_ID'),
    })
  })

  test("Grant READ permissions to user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_IND_SHORTNAME')
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test("Grant WRITE permissions to user 'pro2'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST_SHORTNAME')
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsWRITE
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsWRITE })
        .first()
    ).toBeAttached()
  })

  test("Grant ADMIN permissions to user 'pro3'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST2_SHORTNAME')
    )
    await selectOption(
      page,
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsADMIN
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test("Verify that user 'pro1' can view the answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.access.name,
      'view-answer-collection'
    )
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.access.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test("Verify that user 'pro1' can remove the answer collection (but do not trigger removal)", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'not.exist'
    )
  })

  test("Verify that user 'pro1' can use the created answer collection in a question", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.access.name,
      correctAnswers: data.access.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_IND_ID'),
    })
  })

  test("Verify that user 'pro1' can no longer remove the used answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'have.attr',
      'data-disabled'
    )
  })

  test("Use the write permissions of user 'pro2' to make changes to the answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await testAnswerCollectionEditPermissions(data)
  })

  test('Verify as an owner that the changes persist and undo them', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await validateAndUndoWritePermissionChanges(data)
  })

  test("Verify that user 'pro2' can remove the answer collection (but do not trigger removal)", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'not.exist'
    )
  })

  test("Verify that user 'pro2' can use the answer collection in a question", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.access.name,
      correctAnswers: data.access.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_INST_ID'),
    })
  })

  test("Verify that user 'pro2' can no longer remove the used answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'have.attr',
      'data-disabled'
    )
  })

  test("Use the write permissions of user 'pro3' to make changes to the answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await expectByAssertion(page.getByTestId('resources'), 'exist')
    await testAnswerCollectionEditPermissions(data)
  })

  test('Verify as an owner that the changes persist and undo them [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await expectByAssertion(page.getByTestId('resources'), 'exist')
    await validateAndUndoWritePermissionChanges(data)
  })

  test("Verify that user 'pro3' can both remove and delete the answer collection (but do not trigger either", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'exist'
    )
  })

  test("Verify that user 'pro3' can use the answer collection in a question", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await createQuestionSE(page, {
      name: data.question.title,
      content: data.question.content,
      numberOfInputs: data.question.numberOfInputs,
      collectionName: data.access.name,
      correctAnswers: data.access.items.filter((_, i) =>
        data.question.solutions.includes(i)
      ),
      userId: env('LECTURER_INST2_ID'),
    })
  })

  test("Verify that user 'pro3' can no longer remove or delete the used answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('remove-answer-collection'),
      'have.attr',
      'data-disabled'
    )
    await expectByAssertion(
      page.getByTestId('delete-answer-collection'),
      'have.attr',
      'data-disabled'
    )
  })

  test("Verify that user 'pro3' can open the sharing dialogue and has access to all permissions with the correct values", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsWRITE })
        .first()
    ).toBeAttached()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test("Verify that user 'pro3' can modify the permissions of user 'pro1' to WRITE", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
    await page
      .getByTestId(`permission-level-${env('LECTURER_IND_SHORTNAME')}`)
      .click()
    await page.getByTestId('permission-level-WRITE').click()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsWRITE })
        .first()
    ).toBeAttached()
  })

  test("Verify that user 'pro1' has been granted write permissions and test edit permissions", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await testAnswerCollectionEditPermissions(data)
  })

  test('Verify as an owner that the changes persist, undo them and change the permissions back to read level', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await validateAndUndoWritePermissionChanges(data)
    await page.getByTestId('close-answer-collection-edit-modal').click()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsWRITE })
        .first()
    ).toBeAttached()
    await page
      .getByTestId(`permission-level-${env('LECTURER_IND_SHORTNAME')}`)
      .click()
    await page.getByTestId('permission-level-READ').click()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
    await expectByAssertion(
      page.getByTestId(`revoke-permission-${env('LECTURER_IND_SHORTNAME')}`),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId(`revoke-permission-${env('LECTURER_INST_SHORTNAME')}`),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId(`revoke-permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.be.disabled'
    )
  })

  test("Verify that user 'pro1' has read permissions again and can view the answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.access.name}`),
      'exist'
    )
    await page
      .getByTestId(`answer-collection-actions-${data.access.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('edit-answer-collection'),
      'not.exist'
    )
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.access.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test("Remove the created question for user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('library').click()
    await deleteElement(page, { elementName: data.question.title })
  })

  test("Revoke the access to the user collection for user 'pro1'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.access.name,
      'share-answer-collection'
    )
    await page
      .getByTestId(`revoke-permission-${env('LECTURER_IND_SHORTNAME')}`)
      .click()
    await page.getByTestId('confirm-revocation').click()
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await page.getByTestId('show-derived-permissions').click()
    await expectByAssertion(
      page.getByTestId(`derived-permission-${env('LECTURER_INST_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`derived-permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
    await page
      .getByTestId(`revoke-permission-${env('LECTURER_INST_SHORTNAME')}`)
      .click()
    await page.getByTestId('confirm-revocation').click()
    await expectByAssertion(
      page.getByTestId(`revoke-permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId(`derived-permission-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`derived-permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
    await page.getByTestId('hide-derived-permissions').click()
    await expectByAssertion(
      page.getByTestId(`derived-permission-${env('LECTURER_INST_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`derived-permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
  })

  test("Cleanup: Remove the created question and answer collection for user 'pro2'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('library').click()
    await deleteElement(page, { elementName: data.question.title })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-actions-${data.access.name}`),
      'not.exist'
    )
  })

  test("Cleanup: Remove the created question and answer collection for user 'pro3'", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('library').click()
    await deleteElement(page, { elementName: data.question.title })
    await openAnswerCollectionsPage()
    await removeAnswerCollection({ name: data.access.name })
  })

  test('Cleanup: Delete the answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.access.name })
  })

  test('Create a new answer collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.ownership.name,
      description: data.ownership.description,
      entries: data.ownership.items,
      userId: env('LECTURER_ID'),
    })
  })

  test("Grant READ permissions to user 'pro1' [2]", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_IND_SHORTNAME')
    )
    await expect(page.getByTestId('new-permission-access-level')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('new-permission-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test("Transfer ownership to user 'pro2' using the e-mail address", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await page.getByTestId('transfer-ownership').click()
    await page.getByTestId('cancel-ownership-transfer').click()
    await page.getByTestId('transfer-ownership').click()
    await typeInto(
      page.getByTestId('new-owner-username-email-input'),
      env('LECTURER_INST_EMAIL')
    )
    await page.getByTestId('confirm-ownership-transfer').click()
    await expectByAssertion(page.getByTestId('transfer-ownership'), 'not.exist')
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test("Verify that user 'pro2' is the new owner with an overview of all permissions", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test("Verify that user 'pro1' still has read access to the answer collection", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.ownership.name}`),
      'exist'
    )
    await clickAnswerCollectionAction(
      data.ownership.name,
      'view-answer-collection'
    )
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.ownership.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test("Transfer ownership to user 'pro1' using the username", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await page.getByTestId('transfer-ownership').click()
    await typeInto(
      page.getByTestId('new-owner-username-email-input'),
      env('LECTURER_IND_SHORTNAME')
    )
    await page.getByTestId('confirm-ownership-transfer').click()
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test("Verify that user 'pro1' is the new owner with an overview of all permissions", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test('Change own access rights from admin permissions to read access for main user', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
    await page
      .getByTestId(`permission-level-${env('LECTURER_SHORTNAME')}`)
      .click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('cancel-modify-own-permissions').click()
    await page
      .getByTestId(`permission-level-${env('LECTURER_SHORTNAME')}`)
      .click()
    await page.getByTestId('permission-level-READ').click()
    await page.getByTestId('confirm-modify-own-permissions').click()
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
      'not.exist'
    )
    await expect(
      page.getByTestId(`answer-collection-${data.ownership.name}`)
    ).toContainText(messages.manage.sharing.permissionsREAD)
    await page
      .getByTestId(`answer-collection-actions-${data.ownership.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('share-answer-collection'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('edit-answer-collection'),
      'not.exist'
    )
    await page.getByTestId('view-answer-collection').click()
    await page.getByTestId('open-collection-options').click()
    for (const [__index, value] of Array.from(data.ownership.items).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
  })

  test('Change the main users access rights back to admin permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
    await page
      .getByTestId(`permission-level-${env('LECTURER_SHORTNAME')}`)
      .click()
    await page.getByTestId('permission-level-ADMIN').click()
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test('Have the main user revoke its own access through the use of admin rights', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
    await page
      .getByTestId(`revoke-permission-${env('LECTURER_SHORTNAME')}`)
      .click()
    await page.getByTestId('cancel-modify-own-permissions').click()
    await page
      .getByTestId(`revoke-permission-${env('LECTURER_SHORTNAME')}`)
      .click()
    await page.getByTestId('confirm-modify-own-permissions').click()
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
      'not.exist'
    )
  })

  test('Verify that the main user has no permissions on the collection anymore', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await clickAnswerCollectionAction(
      data.ownership.name,
      'share-answer-collection'
    )
    await expectByAssertion(
      page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
      'not.exist'
    )
  })

  test('Cleanup: Remove the answer collection from user pro2', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openAnswerCollectionsPage()
    await removeAnswerCollection({ name: data.ownership.name })
  })

  test('Cleanup: Delete the answer collection [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openAnswerCollectionsPage()
    await deleteAnswerCollection(page, { collectionName: data.ownership.name })
  })
})
