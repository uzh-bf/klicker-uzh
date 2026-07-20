// @ts-nocheck
/**
 * Playwright translation of U-catalog.
 * Mirrors the original Cypress workflow with native Playwright actions.
 */
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { test } from '../util/fixtures.js'
import { enMessages as messages } from '../util/messages.js'
import {
  convertLiveQuizToTemplate,
  createAnswerCollection,
  createLiveQuiz,
  createQuestionSC,
  createQuestionSE,
  deleteAllElements,
  deleteAnswerCollection,
  env,
  expectByAssertion,
  getCatalogCollectionId,
  gotoCommit,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginInstitutionalCatalyst2,
  loginLecturer,
  logoutUser,
  runTask,
  selectOption,
  typeInto,
  validateElement,
} from '../util/workflow.js'

function readFixture(name: string) {
  return JSON.parse(
    fs.readFileSync(
      new URL(`../../cypress/cypress/fixtures/${name}`, import.meta.url),
      'utf8'
    )
  )
}

let page: Page
const aliases = new Map<string, unknown>()
const data = Object.assign(
  {},
  readFixture('U-catalog.json'),
  readFixture('questions.json')
)

test.describe
  .serial('Test all functionalities of catalog collections and objects contained therein', () => {
  async function openCatalogPage() {
    await gotoCommit(page, `${env('URL_MANAGE')}/resources/catalog`)
    await expect(page.getByTestId('add-object-to-catalog-button')).toBeVisible()
  }

  async function openCatalogCollection(collectionName: string) {
    const collectionId = await getCatalogCollectionId(collectionName)
    await gotoCommit(
      page,
      `${env('URL_MANAGE')}/resources/catalog/${collectionId}`
    )
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      collectionName
    )
  }

  async function openUserGroupsPage() {
    await gotoCommit(page, `${env('URL_MANAGE')}/resources/userGroups`)
    await expect(page.getByTestId('create-user-group')).toBeVisible()
  }

  async function clickCatalogCollectionAction(
    collectionName: string,
    actionTestId: string
  ) {
    const action = page.getByTestId(actionTestId)

    for (let attempt = 0; attempt < 3; attempt++) {
      await page
        .getByTestId(`catalog-collection-${collectionName}-actions`)
        .click({ force: true })

      if (await action.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await action.click({ force: true })
        return
      }
    }

    await expect(action).toBeVisible()
    await action.click({ force: true })
  }

  async function openObjectActions(
    objectName: string,
    expectedActionTestIds: string | string[]
  ) {
    const actionTestIds = Array.isArray(expectedActionTestIds)
      ? expectedActionTestIds
      : [expectedActionTestIds]
    const trigger = page.getByTestId(`actions-dropdown-${objectName}`)

    async function visibleAction() {
      for (const actionTestId of actionTestIds) {
        if (
          await page
            .getByTestId(actionTestId)
            .isVisible({ timeout: 1_000 })
            .catch(() => false)
        ) {
          return actionTestId
        }
      }

      return null
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await page.keyboard.press('Escape')
      await trigger.scrollIntoViewIfNeeded()
      await expect(trigger).toBeVisible()
      await trigger.click({ force: true })

      const clickedAction = await visibleAction()
      if (clickedAction) {
        return clickedAction
      }
    }

    await expect(page.getByTestId(actionTestIds[0])).toBeVisible()
    return actionTestIds[0]
  }

  async function verifyObjectCannotBeShared(objectName: string) {
    const requestAction = `request-access-${objectName}`
    const removeAction = `remove-object-${objectName}`

    await page.keyboard.press('Escape')
    await page
      .getByTestId(`actions-dropdown-${objectName}`)
      .click({ force: true })
    await expectByAssertion(
      page.getByTestId(`share-object-${objectName}`),
      'not.exist'
    )

    if (
      await page
        .getByTestId(requestAction)
        .isVisible({ timeout: 500 })
        .catch(() => false)
    ) {
      await page.getByTestId(requestAction).click({ force: true })
      await page.getByTestId('cancel-request-access').click({ force: true })
      await expect(page.getByTestId('cancel-request-access')).toBeHidden()
    } else if (
      await page
        .getByTestId(removeAction)
        .isVisible({ timeout: 500 })
        .catch(() => false)
    ) {
      await page.getByTestId(removeAction).click({ force: true })
      await page.getByTestId('cancel-removal').click({ force: true })
      await expect(page.getByTestId('cancel-removal')).toBeHidden()
    } else {
      await page.keyboard.press('Escape')
    }
  }

  async function verifyAdminOwnerPermissionsCCPublic({
    data,
    ownership,
    elementOwnership,
  }: {
    data: any
    ownership: boolean
    elementOwnership: boolean
  }) {
    await clickCatalogCollectionAction(
      data.CCPublic,
      'share-catalog-collection'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-username-or-email'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('transfer-ownership'),
      ownership ? 'exist' : 'not.exist'
    )
    await page.getByTestId('close-share-object').click({ force: true })
    await expect(page.getByTestId('close-share-object')).toBeHidden()
    await clickCatalogCollectionAction(
      data.CCPublic,
      'delete-catalog-collection'
    )
    await page.getByTestId('cancel-delete-collection').click()
    await page
      .getByTestId(`change-catalog-collection-name-${data.CCPublic}`)
      .click()
    await page.getByTestId('insert-catalog-collection-name').click()
    await page.getByTestId('insert-catalog-collection-name').clear()
    await typeInto(
      page.getByTestId('insert-catalog-collection-name'),
      `${data.CCPublic} NEW`
    )
    await page.getByTestId('catalog-collection-name-change-confirm').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic} NEW`),
      'exist'
    )
    await page
      .getByTestId(`change-catalog-collection-name-${data.CCPublic} NEW`)
      .click()
    await page.getByTestId('insert-catalog-collection-name').click()
    await page.getByTestId('insert-catalog-collection-name').clear()
    await typeInto(
      page.getByTestId('insert-catalog-collection-name'),
      `${data.CCPublic}`
    )
    await page.getByTestId('catalog-collection-name-change-confirm').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'exist'
    )
    await openCatalogCollection(data.CCPublic)
    await expectByAssertion(
      page.getByTestId('add-object-to-catalog-button'),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await openObjectActions(data.AC1.name, `remove-object-${data.AC1.name}`)
    await page.getByTestId(`remove-object-${data.AC1.name}`).click()
    await page.getByTestId('cancel-removal').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC2.name}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await openObjectActions(data.AC2.name, `remove-object-${data.AC2.name}`)
    await page.getByTestId(`remove-object-${data.AC2.name}`).click()
    await page.getByTestId('cancel-removal').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await openObjectActions(
      data.liveQuiz.template.name,
      `use-template-${data.liveQuiz.template.name}`
    )
    await expectByAssertion(
      page.getByTestId(`use-template-${data.liveQuiz.template.name}`),
      'exist'
    )
    await page
      .getByTestId(`remove-object-${data.liveQuiz.template.name}`)
      .click()
    await page.getByTestId('cancel-removal').click()
    await page.getByTestId('leave-catalog-collection').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      elementOwnership ? 'contain' : 'not.contain',
      messages.manage.catalog.accessRESTRICTED
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      elementOwnership ? 'contain' : 'not.contain',
      messages.manage.catalog.accessPUBLIC
    )
    await openCatalogCollection(data.CCPublic)
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML.title}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML2.title}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId('leave-catalog-collection').click()
    await openCatalogCollection(data.CCRestricted)
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML.title}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML2.title}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  }

  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Create a new answer collection AC1 in the lecturer account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.goto(`${env('URL_MANAGE')}/resources/answerCollections`, {
      waitUntil: 'commit',
    })
    await expect(page.getByTestId('create-answer-collection')).toBeVisible()
    await createAnswerCollection(page, {
      name: data.AC1.name,
      description: data.AC1.description,
      entries: data.AC1.items,
      userId: env('LECTURER_ID'),
    })
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.AC1.name}`),
      'exist'
    )
  })

  test('Create a new answer collection AC2 in the pro1 account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.AC2.name,
      description: data.AC2.description,
      entries: data.AC2.items,
      userId: env('LECTURER_IND_ID'),
    })
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.AC2.name}`),
      'exist'
    )
  })

  test('Create two new selection questions in the pro1 account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await createQuestionSE(page, {
      name: data.SEML.title,
      content: data.SEML.content,
      numberOfInputs: data.SEML.inputs,
      collectionName: data.AC2.name,
      userId: env('LECTURER_IND_ID'),
    })
    await validateElement(page, { element: data.SEML.title })
    await createQuestionSE(page, {
      name: data.SEML2.title,
      content: data.SEML2.content,
      numberOfInputs: data.SEML2.inputs,
      collectionName: data.AC2.name,
      userId: env('LECTURER_IND_ID'),
    })
    await validateElement(page, { element: data.SEML2.title })
  })

  test('Create the questions that will be required for this test workflow', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SC.title,
      content: data.SC.content,
      choices: data.SC.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      userId: env('LECTURER_ID'),
    })
  })

  test('Create a live quiz template', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: data.liveQuiz.name,
      displayName: data.liveQuiz.displayName,
      courseName: data.liveQuiz.course,
      blocks: [{ elements: [data.SC.title, data.SCML.title] }],
    })
    await page.getByTestId('open-activity-overview').click()
    await convertLiveQuizToTemplate(page, {
      liveQuiz: data.liveQuiz.name,
      name: data.liveQuiz.template.name,
      description: data.liveQuiz.template.description,
      instructions: data.liveQuiz.template.instructions,
      copyBeforeConversion: false,
      resourceAccessRequired: false,
    })
  })

  test('Share the answer collection AC1 with other users', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${data.AC1.name}`).click()
    await page.getByTestId('share-answer-collection').click()
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_IND_SHORTNAME')
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
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
    await page.getByTestId('new-permission-username-or-email').click()
    await page.getByTestId('new-permission-username-or-email').clear()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST_EMAIL')
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
    await page.getByTestId('new-permission-username-or-email').click()
    await page.getByTestId('new-permission-username-or-email').clear()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST2_SHORTNAME')
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
      page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test('Create public and private catalog collections CCPublic and CCPrivate', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').click()
    await typeInto(
      page.getByTestId('catalog-collection-name-input'),
      data.CCPublic
    )
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.CCPublic}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').click()
    await typeInto(
      page.getByTestId('catalog-collection-name-input'),
      data.CCRestricted
    )
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.CCRestricted}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
  })

  test('Verify correct visibility of catalog collections to users', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted}`),
      'exist'
    )
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted}`),
      'exist'
    )
  })

  test('Add AC1 to both catalog collections', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await openCatalogCollection(data.CCPublic)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ANSWER_COLLECTION`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.AC1.name)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId('leave-catalog-collection').click()
    await openCatalogCollection(data.CCRestricted)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ANSWER_COLLECTION`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.AC1.name)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  })

  test('Verify that both catalog collections are visible to all users', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted}`),
      'exist'
    )
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted}`),
      'exist'
    )
    await page.getByTestId(`catalog-object-${data.CCPublic}`).click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await page.getByTestId('leave-catalog-collection').click()
    await page.getByTestId(`catalog-object-${data.CCRestricted}`).click()
    await expectByAssertion(page.getByTestId('confirm-request-access'), 'exist')
  })

  test('Request access to CCRestricted from pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCRestricted}`).click()
    await page.getByTestId('confirm-request-access').click()
    await expectByAssertion(
      page.getByTestId(`catalog-collection-${data.CCRestricted}-actions`),
      'not.exist'
    )
  })

  test('Share CCRestricted with all other users and different permission levels (request approval & direct sharing)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await expectByAssertion(
      page.getByTestId(`approve-sharing-request-${data.CCRestricted}-pro1`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`deny-sharing-request-${data.CCRestricted}-pro1`),
      'exist'
    )
    await page
      .getByTestId(`approve-sharing-request-${data.CCRestricted}-pro1`)
      .click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      messages.manage.sharing.permissionsREAD
    )
    await page.getByTestId('permission-level-select').click()
    await page.getByTestId('permission-level-WRITE').click()
    await expect(page.getByTestId('permission-level-select')).toContainText(
      messages.manage.sharing.permissionsWRITE
    )
    await page.getByTestId('confirm-approval').click()
    await clickCatalogCollectionAction(
      data.CCRestricted,
      'share-catalog-collection'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST_EMAIL')
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
    await page.getByTestId('new-permission-username-or-email').click()
    await page.getByTestId('new-permission-username-or-email').clear()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST2_SHORTNAME')
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
      page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsREAD })
        .first()
    ).toBeAttached()
  })

  test('Share CCPublic with user pro1 and ADMIN permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await clickCatalogCollectionAction(
      data.CCPublic,
      'share-catalog-collection'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_IND_SHORTNAME')
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
      page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page
        .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
        .filter({ hasText: messages.manage.sharing.permissionsADMIN })
        .first()
    ).toBeAttached()
  })

  test('Add the second answer collection to both catalog collections with restricted visibility using WRITE / ADMIN permissions respectively', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await openCatalogCollection(data.CCPublic)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ANSWER_COLLECTION`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.AC2.name)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC2.name}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId('leave-catalog-collection').click()
    await openCatalogCollection(data.CCRestricted)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ANSWER_COLLECTION`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.AC2.name)
    await page.getByTestId('submit-add-object-button').click()
    await expect(
      page.getByTestId(`catalog-object-${data.AC2.name}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
  })

  test('Add the live quiz template to the top level of the catalog and both collections', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await openCatalogCollection(data.CCPublic)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-LIVE_QUIZ_TEMPLATE`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.liveQuiz.template.name)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId('leave-catalog-collection').click()
    await openCatalogCollection(data.CCRestricted)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-LIVE_QUIZ_TEMPLATE`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.liveQuiz.template.name)
    await page.getByTestId('submit-add-object-button').click()
    await expect(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  })

  test('Add the selection questions to the catalog collections and the top-level catalg collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ELEMENT`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.SEML.title)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML.title}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ELEMENT`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.SEML2.title)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML2.title}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await openCatalogCollection(data.CCPublic)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ELEMENT`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.SEML.title)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML.title}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ELEMENT`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.SEML2.title)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML2.title}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId('leave-catalog-collection').click()
    await openCatalogCollection(data.CCRestricted)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ELEMENT`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-0"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.SEML.title)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML.title}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId('add-object-to-catalog-button').click()
    await page.getByTestId('object-type-selection').click()
    await page.getByTestId(`object-type-ELEMENT`).click()
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-public').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessPUBLIC
    )
    await page.locator('[id="object-selection-catalog-addition"]').click()
    await page
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.SEML2.title)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.SEML2.title}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.SEML2.title}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  })

  test('Verify that the permissions on the catalog collections are correctly set for lecturer', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await verifyAdminOwnerPermissionsCCPublic({
      data: data,
      ownership: true,
      elementOwnership: false,
    })
    await page.getByTestId('leave-catalog-collection').click()
    await clickCatalogCollectionAction(
      data.CCRestricted,
      'share-catalog-collection'
    )
    await expectByAssertion(page.getByTestId('transfer-ownership'), 'exist')
    await expectByAssertion(
      page.getByTestId('new-permission-username-or-email'),
      'exist'
    )
    await page.getByTestId('close-share-object').click({ force: true })
    await expect(page.getByTestId('close-share-object')).toBeHidden()
    await clickCatalogCollectionAction(
      data.CCRestricted,
      'delete-catalog-collection'
    )
    await page.getByTestId('cancel-delete-collection').click()
  })

  test('Verify that the permissions on the catalog collections are correctly set for pro1', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await verifyAdminOwnerPermissionsCCPublic({
      data: data,
      ownership: false,
      elementOwnership: true,
    })
    await page.getByTestId('leave-catalog-collection').click()
    await expectByAssertion(
      page.getByTestId(`catalog-collection-${data.CCRestricted}-actions`),
      'not.exist'
    )
    await openCatalogCollection(data.CCPublic)
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId(`actions-dropdown-${data.AC1.name}`).click()
    await page.getByTestId(`remove-object-${data.AC1.name}`).click()
    await page.getByTestId('cancel-removal').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC2.name}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await page.getByTestId(`actions-dropdown-${data.AC2.name}`).click()
    await page.getByTestId(`remove-object-${data.AC2.name}`).click()
    await page.getByTestId('cancel-removal').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.liveQuiz.template.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page
      .getByTestId(`actions-dropdown-${data.liveQuiz.template.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`use-template-${data.liveQuiz.template.name}`),
      'exist'
    )
    await page
      .getByTestId(`remove-object-${data.liveQuiz.template.name}`)
      .click()
    await page.getByTestId('cancel-removal').click()
  })

  test('Create user groups with all users and prepare a new catalog collection for user group sharing', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').click()
    await typeInto(
      page.getByTestId('catalog-collection-name-input'),
      data.CCRestricted2
    )
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted2}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.CCRestricted2}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
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

  test('Grant direct READ, WRITE and ADMIN permissions to the catalog collection for the user groups', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await clickCatalogCollectionAction(
      data.CCRestricted2,
      'share-catalog-collection'
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
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-username-or-email'),
      'have.value',
      env('LECTURER_IND_SHORTNAME')
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
    await expectByAssertion(
      page.getByTestId('new-permission-username-or-email'),
      'have.value',
      ''
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('new-permission-username-or-email').click()
    await typeInto(
      page.getByTestId('new-permission-username-or-email'),
      env('LECTURER_INST2_SHORTNAME')
    )
    await expectByAssertion(
      page.getByTestId('new-permission-submit'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('new-permission-username-or-email'),
      'have.value',
      env('LECTURER_INST2_SHORTNAME')
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

  test('Verify that the users in group 1 have been granted READ permissions on the catalog collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCRestricted2}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      data.CCRestricted2
    )
    await expectByAssertion(
      page.getByTestId('add-object-to-catalog-button'),
      'not.exist'
    )
  })

  test('Verify that the users in group 2 have been granted WRITE permissions on the catalog collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCRestricted2}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      data.CCRestricted2
    )
    await expectByAssertion(
      page.getByTestId('add-object-to-catalog-button'),
      'exist'
    )
  })

  test('Verify that the users in group 3 have been granted ADMIN permissions on the catalog collection', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCRestricted2}`).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      data.CCRestricted2
    )
    await expectByAssertion(
      page.getByTestId('add-object-to-catalog-button'),
      'exist'
    )
  })

  test('Verify that user pro2 without permissions on the public catalog collection can see and request / import content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCPublic}`).click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessGranted)
    await expectByAssertion(
      page.getByTestId(`${data.AC1.name}-object-access`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`${data.AC2.name}-object-access`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('add-object-to-catalog-button'),
      'not.exist'
    )
    await page.getByTestId(`actions-dropdown-${data.AC2.name}`).click()
    await page.getByTestId(`request-access-${data.AC2.name}`).click()
    await page.getByTestId(`cancel-request-access`).click()
    await page
      .getByTestId(`actions-dropdown-${data.liveQuiz.template.name}`)
      .click()
    {
      const useTemplate = page.getByTestId(
        `use-template-${data.liveQuiz.template.name}`
      )
      await expect(useTemplate).toBeVisible()
      await Promise.all([
        page.waitForURL(/\/templates\//, { timeout: 15_000 }),
        useTemplate.click(),
      ])
    }
    await expectByAssertion(
      page.getByTestId(`live-quiz-template-submit`),
      'exist'
    )
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCPublic}`).click()
    await logoutUser(page)
  })

  test('Verify that user pro3 can see and request access to objects in restricted answer collection with READ permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst2(page)
    await openCatalogPage()
    await page.getByTestId(`catalog-object-${data.CCRestricted}`).click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessGranted)
    await expectByAssertion(
      page.getByTestId(`${data.AC1.name}-object-access`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`${data.AC2.name}-object-access`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('add-object-to-catalog-button'),
      'not.exist'
    )
    await page.getByTestId(`actions-dropdown-${data.AC2.name}`).click()
    await page.getByTestId(`request-access-${data.AC2.name}`).click()
    await page.getByTestId(`cancel-request-access`).click()
  })

  test('Verify that the permissions on the objects themselves (sharing, etc.) are determined by object access', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await openCatalogCollection(data.CCPublic)
    await openObjectActions(data.AC1.name, `share-object-${data.AC1.name}`)
    await page
      .getByTestId(`share-object-${data.AC1.name}`)
      .click({ force: true })
    await expectByAssertion(page.getByTestId('transfer-ownership'), 'exist')
    await page.getByTestId('close-share-object').click({ force: true })
    await expect(page.getByTestId('close-share-object')).toBeHidden()
    await verifyObjectCannotBeShared(data.AC2.name)
    await openCatalogCollection(data.CCRestricted)
    await openObjectActions(data.AC1.name, `share-object-${data.AC1.name}`)
    await page
      .getByTestId(`share-object-${data.AC1.name}`)
      .click({ force: true })
    await expectByAssertion(page.getByTestId('transfer-ownership'), 'exist')
    await page.getByTestId('close-share-object').click({ force: true })
    await expect(page.getByTestId('close-share-object')).toBeHidden()
    await verifyObjectCannotBeShared(data.AC2.name)
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await openCatalogPage()
    await openCatalogCollection(data.CCPublic)
    await openObjectActions(data.AC1.name, `share-object-${data.AC1.name}`)
    await page
      .getByTestId(`share-object-${data.AC1.name}`)
      .click({ force: true })
    await expectByAssertion(page.getByTestId('transfer-ownership'), 'not.exist')
    await page.getByTestId('close-share-object').click({ force: true })
    await expect(page.getByTestId('close-share-object')).toBeHidden()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC2.name}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await openCatalogCollection(data.CCRestricted)
    await openObjectActions(data.AC1.name, `share-object-${data.AC1.name}`)
    await page
      .getByTestId(`share-object-${data.AC1.name}`)
      .click({ force: true })
    await expectByAssertion(page.getByTestId('transfer-ownership'), 'not.exist')
    await page.getByTestId('close-share-object').click({ force: true })
    await expect(page.getByTestId('close-share-object')).toBeHidden()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC2.name}`)
    ).toContainText(messages.manage.catalog.accessRESTRICTED)
    await logoutUser(page)
    await loginInstitutionalCatalyst(page)
    await openCatalogPage()
    await openCatalogCollection(data.CCPublic)
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.AC1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.AC1.name}`)
    ).toContainText(messages.manage.catalog.accessGranted)
    await expectByAssertion(
      page.getByTestId(`actions-dropdown-${data.AC1.name}`),
      'not.exist'
    )
    await verifyObjectCannotBeShared(data.AC2.name)
    await openCatalogCollection(data.CCRestricted)
    await verifyObjectCannotBeShared(data.AC1.name)
    await verifyObjectCannotBeShared(data.AC2.name)
  })

  test('Create a user group with regular members and admins', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.userGroup.name)
    await page.getByTestId('cancel-create-user-group').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.userGroup.name)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_IND_SHORTNAME')
    )
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('add-member').click()
    await page.getByTestId('member-shortname-email-1').click()
    await typeInto(
      page.getByTestId('member-shortname-email-1'),
      env('LECTURER_INST_EMAIL')
    )
    await page.getByTestId('member-admin-1').click()
    await page.getByTestId('add-member').click()
    await page.getByTestId('member-shortname-email-2').click()
    await typeInto(
      page.getByTestId('member-shortname-email-2'),
      env('LECTURER_INST2_SHORTNAME')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`user-group-${data.userGroup.name}`)
    ).toContainText(messages.shared.generic.owner)
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.userGroup.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await expectByAssertion(page.getByTestId(`edit-group-name`), 'exist')
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
  })

  test('Verify that the other group members and admins can see the group, its members and appropriate actions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`user-group-${data.userGroup.name}`)
    ).toContainText(messages.shared.generic.owner)
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.userGroup.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_SHORTNAME')
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`)
    ).toContainText(env('LECTURER_IND_EMAIL'))
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`)
    ).toContainText(env('LECTURER_INST_EMAIL'))
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`)
    ).toContainText(env('LECTURER_INST2_EMAIL'))
    await expectByAssertion(
      page.getByTestId(
        `transfer-group-ownership-${env('LECTURER_IND_SHORTNAME')}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`demote-group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `transfer-group-ownership-${env('LECTURER_INST_SHORTNAME')}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`demote-group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `promote-group-member-${env('LECTURER_INST2_SHORTNAME')}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `remove-group-member-${env('LECTURER_INST2_SHORTNAME')}`
      ),
      'exist'
    )
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await expect(
      page.getByTestId(`user-group-${data.userGroup.name}`)
    ).toContainText(messages.manage.userGroups.admin)
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.userGroup.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`leave-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_SHORTNAME')
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`)
    ).toContainText(env('LECTURER_IND_EMAIL'))
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`)
    ).toContainText(env('LECTURER_INST_EMAIL'))
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`)
    ).toContainText(env('LECTURER_INST2_EMAIL'))
    await expectByAssertion(
      page.getByTestId(
        `transfer-group-ownership-${env('LECTURER_IND_SHORTNAME')}`
      ),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`demote-group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `transfer-group-ownership-${env('LECTURER_INST_SHORTNAME')}`
      ),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`demote-group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `promote-group-member-${env('LECTURER_INST2_SHORTNAME')}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `remove-group-member-${env('LECTURER_INST2_SHORTNAME')}`
      ),
      'exist'
    )
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await expect(
      page.getByTestId(`user-group-${data.userGroup.name}`)
    ).toContainText(messages.manage.userGroups.member)
    await expectByAssertion(
      page.getByTestId(`view-edit-group-${data.userGroup.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`leave-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_SHORTNAME')
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.contain',
      env('LECTURER_IND_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'not.contain',
      env('LECTURER_INST_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.contain',
      env('LECTURER_INST2_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(
        `transfer-group-ownership-${env('LECTURER_IND_SHORTNAME')}`
      ),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`demote-group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `transfer-group-ownership-${env('LECTURER_INST_SHORTNAME')}`
      ),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`demote-group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `promote-group-member-${env('LECTURER_INST2_SHORTNAME')}`
      ),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `remove-group-member-${env('LECTURER_INST2_SHORTNAME')}`
      ),
      'not.exist'
    )
    await logoutUser(page)
  })

  test('Verify that creating another group with the same name fails', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.userGroup.name)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_INST2_SHORTNAME')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId('submit-create-user-group'),
      'exist'
    )
  })

  test('Verify that a group can be left by admins and users', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`leave-group-${data.userGroup.name}`).click()
    await page.getByTestId('cancel-leave-group').click()
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`leave-group-${data.userGroup.name}`).click()
    await page.getByTestId('confirm-leave-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'not.exist'
    )
    await loginInstitutionalCatalyst2(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`leave-group-${data.userGroup.name}`).click()
    await page.getByTestId('confirm-leave-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'not.exist'
    )
  })

  test("Re-add the member and admin again using the add to group functionality and verify the action's success through the corresponding users", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
    await page.getByTestId('add-admin-group-input').click()
    await typeInto(
      page.getByTestId('add-admin-group-input'),
      env('LECTURER_IND_SHORTNAME')
    )
    await page.getByTestId('add-admin-group-confirm').click()
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('add-admin-group-input'),
      'have.value',
      ''
    )
    await page.getByTestId('add-member-group-input').click()
    await typeInto(
      page.getByTestId('add-member-group-input'),
      env('LECTURER_INST2_SHORTNAME')
    )
    await page.getByTestId('add-member-group-confirm').click()
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('add-member-group-input'),
      'have.value',
      ''
    )
  })

  test('Promote and demote two different users and check the persistence of this change through the corresponding accounts', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`)
    ).toContainText(env('LECTURER_INST2_EMAIL'))
    await page
      .getByTestId(`promote-group-member-${env('LECTURER_INST2_SHORTNAME')}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST2_SHORTNAME')}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`)
    ).toContainText(env('LECTURER_IND_EMAIL'))
    await page
      .getByTestId(`demote-group-admin-${env('LECTURER_IND_SHORTNAME')}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_IND_SHORTNAME')}`),
      'exist'
    )
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`user-group-${data.userGroup.name}`)
    ).toContainText(messages.manage.userGroups.member)
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`user-group-${data.userGroup.name}`)
    ).toContainText(messages.manage.userGroups.admin)
    await logoutUser(page)
  })

  test('Remove a member and an admin from the group and verify that the corresponding users lost access', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await page
      .getByTestId(`remove-group-admin-${env('LECTURER_INST2_SHORTNAME')}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST2_SHORTNAME')}`),
      'not.exist'
    )
    await page
      .getByTestId(`remove-group-member-${env('LECTURER_IND_SHORTNAME')}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`group-member-${env('LECTURER_IND_SHORTNAME')}`),
      'not.exist'
    )
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'not.exist'
    )
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'not.exist'
    )
    await logoutUser(page)
  })

  test('Transfer the ownership to one of the group admins, verify the change and transfer the ownership back', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await page
      .getByTestId(`transfer-group-ownership-${env('LECTURER_INST_SHORTNAME')}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'not.exist'
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_INST_SHORTNAME')
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_INST_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_SHORTNAME')}`),
      'exist'
    )
    await logoutUser(page)
    await loginInstitutionalCatalyst(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await page
      .getByTestId(`transfer-group-ownership-${env('LECTURER_SHORTNAME')}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_SHORTNAME')}`),
      'not.exist'
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_SHORTNAME')
    )
    await expect(page.getByTestId('group-owner-shortname-email')).toContainText(
      env('LECTURER_EMAIL')
    )
    await expectByAssertion(
      page.getByTestId(`group-admin-${env('LECTURER_INST_SHORTNAME')}`),
      'exist'
    )
    await logoutUser(page)
  })

  test('Change the name of the user group and verify its persistence', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.name}`),
      'exist'
    )
    await page.getByTestId(`user-group-actions-${data.userGroup.name}`).click()
    await page.getByTestId(`view-edit-group-${data.userGroup.name}`).click()
    await page.getByTestId('edit-group-name').click()
    await page.getByTestId('edit-group-name-input').click()
    await page.getByTestId('edit-group-name-input').clear()
    await typeInto(
      page.getByTestId('edit-group-name-input'),
      data.userGroup.nameNew
    )
    await page.getByTestId('save-new-group-name').click()
    await expectByAssertion(
      page.getByTestId('edit-group-name-input'),
      'not.exist'
    )
    await page.getByTestId('close-user-group-edit-modal').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.nameNew}`),
      'exist'
    )
  })

  test('Delete the user group and verify that it is not shown anymore to any members', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.nameNew}`),
      'exist'
    )
    await page
      .getByTestId(`user-group-actions-${data.userGroup.nameNew}`)
      .click()
    await page.getByTestId(`delete-group-${data.userGroup.nameNew}`).click()
    await page.getByTestId('cancel-delete-group').click()
    await page
      .getByTestId(`user-group-actions-${data.userGroup.nameNew}`)
      .click()
    await page.getByTestId(`delete-group-${data.userGroup.nameNew}`).click()
    await expectByAssertion(
      page.getByTestId('confirm-delete-group'),
      'be.disabled'
    )
    await page.getByTestId('delete-group-resolve-group-confirm').click()
    await expectByAssertion(
      page.getByTestId('confirm-delete-group'),
      'be.disabled'
    )
    await page.getByTestId('delete-group-revoke-permissions-confirm').click()
    await expectByAssertion(
      page.getByTestId('confirm-delete-group'),
      'be.disabled'
    )
    await page.getByTestId('delete-group-irrevocable-action-confirm').click()
    await page.getByTestId('confirm-delete-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.nameNew}`),
      'not.exist'
    )
    await logoutUser(page)
    await loginInstitutionalCatalyst(page)
    await openUserGroupsPage()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.userGroup.nameNew}`),
      'not.exist'
    )
    await logoutUser(page)
  })

  test('Cleanup: Delete all questions that have been created', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await deleteAllElements(page)
  })

  test('Cleanup: Remove the shared answer collection from all accounts and delete it', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${data.AC1.name}`).click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('confirm-remove-object').click()
    await logoutUser(page)
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${data.AC1.name}`).click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('confirm-remove-object').click()
    await logoutUser(page)
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await page.getByTestId(`answer-collection-actions-${data.AC1.name}`).click()
    await page.getByTestId('remove-answer-collection').click()
    await page.getByTestId('confirm-remove-object').click()
    await logoutUser(page)
    await loginLecturer(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await deleteAnswerCollection(page, { collectionName: data.AC1.name })
    await logoutUser(page)
    await loginIndividualCatalyst(page)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await deleteAnswerCollection(page, { collectionName: data.AC2.name })
  })

  test('Cleanup: Delete the live quiz template', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.template.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${data.liveQuiz.template.name}`)
      .click()
    await page.getByTestId('confirm-template-deletion').click()
    await expectByAssertion(
      page.getByTestId(`live-quiz-${data.liveQuiz.template.name}`),
      'not.exist'
    )
  })

  test('Cleanup: Remove the two catalog collections through the lecturer account (owner)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openCatalogPage()
    await clickCatalogCollectionAction(
      data.CCPublic,
      'delete-catalog-collection'
    )
    await page.getByTestId('confirm-delete-collection').click()
    await expectByAssertion(
      page.getByTestId(`catalog-collection-${data.CCPublic}-actions`),
      'not.exist'
    )
    await clickCatalogCollectionAction(
      data.CCRestricted,
      'delete-catalog-collection'
    )
    await page.getByTestId('confirm-delete-collection').click()
    await expectByAssertion(
      page.getByTestId(`catalog-collection-${data.CCRestricted}-actions`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCPublic}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.CCRestricted}`),
      'not.exist'
    )
  })
})
