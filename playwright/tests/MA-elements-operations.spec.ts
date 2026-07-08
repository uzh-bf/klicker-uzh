import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'
import { Page, TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import dmQuestionsData from '../../cypress/cypress/fixtures/DM-questions.json' with { type: 'json' }
import questionsData from '../../cypress/cypress/fixtures/questions.json' with { type: 'json' }
import {
  chooseActionByTestId,
  chooseActivityAction,
  openActionMenuByTestId,
} from '../util/actions.js'
import { cleanupTest } from '../util/cleanup.js'
import {
  LECTURER_ID,
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST_EMAIL,
  LECTURER_INST_SHORTNAME,
  LECTURER_SHORTNAME,
  URL_MANAGE,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createGroupActivity,
  createLiveQuiz,
  createMicroLearning,
  createPracticeQuiz,
  selectOption,
} from '../util/fixtures/activities.js'
import {
  createAnswerCollection,
  createQuestionSC,
  createQuestionSE,
  deleteElement,
  searchAndEdit,
  validateElement,
} from '../util/fixtures/elements.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import { acceptGamifiedLiveQuizAccountPrompt } from '../util/workflow.js'

type Choice = {
  value: string
  correct?: boolean
  feedback?: string
}

type MaData = typeof questionsData &
  typeof dmQuestionsData & {
    duplication: {
      title: string
      content: string
    }
    autoSave: {
      title: string
      content: string
      choices: Choice[]
      titleEdited: string
      contentEdited: string
      contentEdited2: string
      titleEditedDuplicated: string
    }
    update: {
      title1: string
      title2: string
      title3: string
      content1: string
      content2: string
      content3: string
      choices1: Choice[]
      choices2: Choice[]
      choices3: Choice[]
      course: string
      liveQuiz1: string
      liveQuiz2: string
      liveQuiz3: string
      practiceQuiz1: string
      practiceQuiz2: string
      practiceQuiz3: string
      microlearning1: string
      microlearning2: string
      microlearning3: string
      groupActivity1: string
      groupActivity2: string
      groupActivity3: string
    }
    collection: {
      name: string
      description: string
      options: string[]
    }
    SEML: {
      title: string
      content: string
      inputs: number
      solutions: number[]
    }
    SEML2: {
      title: string
      content: string
      inputs: number
      solutions: number[]
    }
    SCML: {
      title: string
      content: string
      choices: Choice[]
    }
    group1: string
    group2: string
    group3: string
  }

const data = { ...questionsData, ...dmQuestionsData } as MaData

test('CLEANUP', cleanupTest)

async function expectNotAttached(locator: ReturnType<Page['locator']>) {
  await expect(locator).not.toBeAttached()
}

async function validateElementPresence(
  page: Page,
  elementName: string,
  shouldExist = true,
  contains: string[] = []
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')

  const element = page.getByTestId(`element-item-${elementName}`)
  if (shouldExist) {
    await expect(element).toBeVisible()
    for (const text of contains) {
      await expect(element).toContainText(text)
    }
  } else {
    await expect(element).not.toBeAttached()
  }

  await page.getByTestId('elements-search-input').clear()
}

async function enterSCQuestionContent(page: Page) {
  await page.getByTestId('insert-question-title').fill(data.autoSave.title)
  await page.getByTestId('insert-question-text').click()
  await page
    .getByTestId('insert-question-text')
    .pressSequentially(data.autoSave.content)

  await page.getByTestId('insert-answer-field-0').click()
  await page
    .getByTestId('insert-answer-field-0')
    .pressSequentially(data.autoSave.choices[0].value)

  for (let ix = 1; ix < data.autoSave.choices.length; ix++) {
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('add-new-answer').click()
    await page.waitForTimeout(500)
    await page.getByTestId(`insert-answer-field-${ix}`).click()
    await page
      .getByTestId(`insert-answer-field-${ix}`)
      .pressSequentially(data.autoSave.choices[ix].value)
  }

  await page.getByTestId('configure-sample-solution').click({ force: true })
  for (let ix = 0; ix < data.autoSave.choices.length; ix++) {
    if (data.autoSave.choices[ix].correct) {
      await page.getByTestId(`set-correctness-${ix}`).click()
    }
  }
}

async function clearAndTypeEditor(page: Page, testId: string, text: string) {
  const editor = page.getByTestId(testId)
  await editor.click()
  await editor.clear()
  await editor.pressSequentially(text)
}

async function saveElementModal(page: Page) {
  await page.getByTestId('save-new-question').click({ force: true })
  await expect(page.getByTestId('insert-question-title')).not.toBeAttached({
    timeout: 30000,
  })
  await page.waitForTimeout(500)
}

async function createSelectionQuestionForSharing(
  page: Page,
  question: MaData['SEML'] | MaData['SEML2']
) {
  await page.getByTestId('resources').click()
  await page.getByTestId('answer-collections').click()
  await expect(page.getByTestId('answer-collection-list')).toBeVisible()
  await createAnswerCollection({
    name: data.collection.name,
    description: data.collection.description,
    entries: data.collection.options,
    userId: LECTURER_ID,
  })

  await page.reload()
  await expect(
    page.getByTestId(`answer-collection-${data.collection.name}`)
  ).toBeVisible()
  await page.getByTestId('library').click()
  await expect(page.getByTestId('elements-search-input')).toBeVisible()
  await createQuestionSE({
    name: question.title,
    content: question.content,
    numberOfInputs: question.inputs,
    collectionName: data.collection.name,
    correctAnswers: data.collection.options.filter((_, ix) =>
      question.solutions.includes(ix)
    ),
    userId: LECTURER_ID,
  })
  await page.reload()
  await validateElement(page, question.title)
}

async function addObjectToCatalog(
  page: Page,
  {
    objectName,
    objectType,
    permissionLevel,
  }: {
    objectName: string
    objectType: string
    permissionLevel: 'public' | 'restricted'
  }
) {
  await page.getByTestId('add-object-to-catalog-button').click()

  await page.getByTestId('object-type-selection').click()
  await page.getByTestId(`object-type-${objectType}`).click()
  await expect(page.getByTestId('object-type-selection')).toContainText(
    messages.shared.types[objectType as keyof typeof messages.shared.types]
  )

  await expect(page.getByTestId('modal-object-access')).toContainText(
    messages.manage.catalog.accessRESTRICTED
  )
  await page.getByTestId('modal-object-access').click()
  await expect(page.getByTestId('object-access-restricted')).toBeVisible()
  await expect(page.getByTestId('object-access-public')).toBeVisible()
  await page.getByTestId(`object-access-${permissionLevel}`).click()

  await page.locator('#object-selection-catalog-addition').click()
  await page.getByText(objectName, { exact: true }).click()
  await page.getByTestId('submit-add-object-button').click()

  await expect(page.getByTestId(`catalog-object-${objectName}`)).toBeVisible()
}

async function shareElementWithUser(
  page: Page,
  {
    shortnameOrEmail,
    expectedPermissionKey = shortnameOrEmail,
    permission,
  }: {
    shortnameOrEmail: string
    expectedPermissionKey?: string
    permission: string
  }
) {
  await page.getByTestId('new-permission-username-or-email').click()
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(shortnameOrEmail)
  await selectOption(
    page,
    '[data-cy="new-permission-access-level"]',
    permission
  )
  await expect(page.getByTestId('new-permission-access-level')).toContainText(
    permission
  )
  await page.getByTestId('new-permission-submit').click()
  await page.waitForTimeout(500)
  await expect(
    page.getByTestId(`permission-${expectedPermissionKey}`)
  ).toContainText(permission)
  await expect(
    page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
  ).toContainText(messages.manage.sharing.permissionsOWNER)
}

async function openShareModalForElement(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await page.getByTestId(`actions-element-${elementName}`).click()
  await page.getByTestId(`share-element-${elementName}`).click()
}

async function publishSetOfActivities(
  page: Page,
  {
    course,
    liveQuiz,
    practiceQuiz,
    microlearning,
    groupActivity,
  }: {
    course: string
    liveQuiz: string
    practiceQuiz: string
    microlearning: string
    groupActivity: string
  }
) {
  async function confirmPublishDialog() {
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(dialog).toBeHidden({ timeout: 30000 })
  }

  await openActivitiesOverview(page)
  await page.getByTestId('activities-search-input').fill(liveQuiz)
  await page.keyboard.press('Enter')
  await Promise.all([
    page.waitForURL(/\/cockpit/, { timeout: 30000 }),
    page.getByTestId(`start-live-quiz-${liveQuiz}`).click(),
  ])
  await expect(page.getByTestId('next-block-timeline')).toBeVisible({
    timeout: 30000,
  })
  await page.getByTestId('next-block-timeline').click()
  await page.waitForTimeout(500)

  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${course}`).click()
  await page.getByTestId('tab-practiceQuizzes').click()
  await page.getByTestId(`publish-practice-quiz-${practiceQuiz}`).click()
  await page.getByTestId('publish-practice-quiz-immediately').click()

  await page.getByTestId('tab-microLearnings').click()
  await page.getByTestId(`publish-microlearning-${microlearning}`).click()
  await confirmPublishDialog()

  await page.getByTestId('tab-groupActivities').click()
  await page.getByTestId(`publish-group-activity-${groupActivity}`).click()
  await confirmPublishDialog()
}

async function verifySingleChoiceQuestionContent(
  page: Page,
  {
    submission,
    content,
    choices,
  }: {
    submission: boolean
    content: string
    choices: Choice[]
  }
) {
  await expect(page.getByTestId('instance-question-content')).toContainText(
    content
  )

  for (let ix = 0; ix < choices.length; ix++) {
    await expect(page.getByTestId(`sc-0-answer-option-${ix}`)).toContainText(
      choices[ix].value
    )
  }

  if (submission) {
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    for (let ix = 0; ix < choices.length; ix++) {
      await expect(page.getByTestId(`sc-0-feedback-${ix}`)).toContainText(
        choices[ix].feedback ?? ''
      )
    }
  }
}

async function openStudentLiveQuiz(page: Page, displayName: string) {
  const tile = page.getByTestId(`live-quiz-${displayName}`)
  await expect(tile).toBeVisible()
  await Promise.all([
    page.waitForURL(/\/session\//, { waitUntil: 'commit' }),
    tile.click(),
  ])
  await acceptGamifiedLiveQuizAccountPrompt(page, displayName)
  await expect(page.getByTestId('instance-question-content')).toBeVisible()
}

async function returnToStudentHome(page: Page) {
  await page.goto('/', { waitUntil: 'commit' })
  await expect(page.getByTestId('homepage')).toBeVisible()
}

async function openActivitiesOverview(page: Page) {
  await page.goto(
    new URL('/activities', process.env.URL_MANAGE ?? URL_MANAGE).toString(),
    { waitUntil: 'commit' }
  )
  await expect(page.getByTestId('activities-search-input')).toBeVisible()
}

async function confirmDeletionModal(page: Page, confirmationTestIds: string[]) {
  const confirmButton = page.getByTestId('confirmation-modal-confirm')
  const startedAt = Date.now()

  while (Date.now() - startedAt < 15_000) {
    for (const testId of confirmationTestIds) {
      const confirmation = page.getByTestId(testId).first()
      if (await confirmation.isVisible().catch(() => false)) {
        await confirmation.click()
      }
    }

    if (await confirmButton.isEnabled().catch(() => false)) {
      await confirmButton.click()
      return
    }

    await page.waitForTimeout(100)
  }

  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
}

const packageEntries = ['Package Alpha', 'Package Beta', 'Package Gamma']
const packageChoices: Choice[] = [
  { value: 'Package answer A', correct: true },
  { value: 'Package answer B', correct: false },
]

function packageNames(suffix: string) {
  return {
    collection: `PW Package Collection ${suffix}`,
    singleChoice: `PW Package SC ${suffix}`,
    selection: `PW Package SE ${suffix}`,
  }
}

async function seedPackageElements({
  page,
  suffix,
  userId = LECTURER_ID,
}: {
  page: Page
  suffix: string
  userId?: string
}) {
  const names = packageNames(suffix)

  await createAnswerCollection({
    name: names.collection,
    description: `Answer collection for ${suffix}`,
    entries: packageEntries,
    userId,
  })
  await createQuestionSC({
    name: names.singleChoice,
    content: `Single choice package content ${suffix}`,
    choices: packageChoices,
    userId,
  })
  await createQuestionSE({
    name: names.selection,
    content: `Selection package content ${suffix}`,
    numberOfInputs: 1,
    collectionName: names.collection,
    correctAnswers: [packageEntries[0]],
    userId,
  })

  await page.goto(process.env.URL_MANAGE ?? URL_MANAGE, { waitUntil: 'commit' })
  await expect(page.getByTestId('elements-search-input')).toBeVisible()
  await validateElement(page, names.singleChoice)
  await validateElement(page, names.selection)

  return names
}

async function selectElementForPackage(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`element-checkbox-${elementName}`).click()
}

function getSharedSearchTerm(elementNames: string[]) {
  if (elementNames.length <= 1) {
    return elementNames[0]
  }

  let suffix = elementNames[0]
  for (const elementName of elementNames.slice(1)) {
    while (suffix && !elementName.endsWith(suffix)) {
      suffix = suffix.slice(1)
    }
  }

  return suffix.trim() || elementNames[0]
}

async function selectElementsForPackage(page: Page, elementNames: string[]) {
  await page.getByTestId('elements-search-input').clear()
  await page
    .getByTestId('elements-search-input')
    .fill(getSharedSearchTerm(elementNames))
  await page.keyboard.press('Enter')

  for (const elementName of elementNames) {
    await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
    await page.getByTestId(`element-checkbox-${elementName}`).click()
  }
}

async function expectElementSearchResultCount(
  page: Page,
  elementName: string,
  count: number
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toHaveCount(
    count
  )
  await page.getByTestId('elements-search-input').clear()
}

async function openExportPackageModal(page: Page, elementNames: string[]) {
  if (elementNames.length === 1) {
    await selectElementForPackage(page, elementNames[0])
  } else {
    await selectElementsForPackage(page, elementNames)
  }

  await page.getByTestId('elements-download').click()
  await expect(
    page.getByTestId('download-selected-elements-package')
  ).toBeVisible()
}

async function openElementsLibraryPage(page: Page) {
  await page.getByTestId('library').click()
  await expect(page.getByTestId('elements-search-input')).toBeVisible()
}

async function openAnswerCollectionsPage(page: Page) {
  await page.getByTestId('resources').click()
  await page.getByTestId('answer-collections').click()
  await expect(page.getByTestId('answer-collection-list')).toBeVisible()
}

async function shareAnswerCollectionWithUser(
  page: Page,
  {
    collectionName,
    shortnameOrEmail,
    expectedPermissionKey = shortnameOrEmail,
    permission,
  }: {
    collectionName: string
    shortnameOrEmail: string
    expectedPermissionKey?: string
    permission: string
  }
) {
  await openAnswerCollectionsPage(page)
  await chooseActionByTestId(
    page,
    `answer-collection-actions-${collectionName}`,
    'share-answer-collection'
  )
  await shareElementWithUser(page, {
    shortnameOrEmail,
    expectedPermissionKey,
    permission,
  })
  await page.getByTestId('close-share-object').click()
}

async function verifyReadOnlyAnswerCollectionVisible(
  page: Page,
  collectionName: string,
  entries: string[]
) {
  await openAnswerCollectionsPage(page)
  await expect(
    page.getByTestId(`answer-collection-${collectionName}`)
  ).toBeVisible()
  await openActionMenuByTestId(
    page,
    `answer-collection-actions-${collectionName}`,
    'view-answer-collection'
  )
  await expect(page.getByTestId('view-answer-collection')).toBeVisible()
  await expect(page.getByTestId('edit-answer-collection')).not.toBeVisible()
  await page.getByTestId('view-answer-collection').click()
  await page.getByTestId('open-collection-options').click()

  for (const [index, entry] of entries.entries()) {
    await expect(
      page.getByTestId(`viewing-collection-answer-${index}`)
    ).toContainText(entry)
  }

  await page.getByTestId('close-viewing-collection-modal').click()
  await expect(
    page.getByTestId('close-viewing-collection-modal')
  ).not.toBeAttached()
}

async function downloadElementPackage({
  page,
  testInfo,
  elementNames,
}: {
  page: Page
  testInfo: TestInfo
  elementNames: string[]
}) {
  await openExportPackageModal(page, elementNames)

  await expect(
    page.getByTestId('download-selected-elements-package')
  ).toBeEnabled()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('download-selected-elements-package').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.zip$/)

  const zipPath = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(zipPath)
  await page.getByTestId('close-element-download-modal').click()
  await expect(
    page.getByTestId('download-selected-elements-package')
  ).not.toBeAttached()

  return zipPath
}

async function openImportPackageModal(page: Page) {
  await page.getByTestId('elements-upload').click()
  await expect(page.getByTestId('element-import-dropzone')).toBeVisible()
}

async function uploadPackageFile(page: Page, filePath: string) {
  await page
    .getByTestId('element-import-dropzone')
    .locator('input[type="file"]')
    .setInputFiles(filePath)
}

function observePreparePackageUploadRequests(page: Page) {
  let requests = 0

  page.on('request', (request) => {
    const postData = request.postData() ?? ''
    if (postData.includes('PrepareElementImportPackageUpload')) {
      requests++
    }
  })

  return () => requests
}

async function importPackageFile(page: Page, filePath: string) {
  await openImportPackageModal(page)
  await uploadPackageFile(page, filePath)
  await expect(page.getByTestId('element-import-preview-panel')).toBeVisible()
  await expect(page.getByTestId('confirm-element-import')).toBeEnabled()
  await page.getByTestId('confirm-element-import').click()
  await expect(
    page.getByTestId('element-import-preview-panel')
  ).not.toBeAttached({
    timeout: 30000,
  })
}

async function expectAnswerCollectionCount(
  page: Page,
  collectionName: string,
  count: number
) {
  await openAnswerCollectionsPage(page)
  await expect(
    page.getByTestId(`answer-collection-${collectionName}`)
  ).toHaveCount(count)
}

async function expectNoPackageDownload(page: Page) {
  const download = await page
    .waitForEvent('download', { timeout: 2000 })
    .catch(() => null)
  expect(download).toBeNull()
}

test.describe('Create different types of elements (with and without sample solution) and edit them', () => {
  test.describe('Part 1: Question duplication', () => {
    test.beforeEach(async ({ loginLecturer }) => {
      await loginLecturer()
    })

    test('Create a new question, duplicates it and then deletes them again', async ({
      page,
    }) => {
      await page.getByTestId('create-question').click()
      await page
        .getByTestId('insert-question-title')
        .fill(data.duplication.title)
      await selectOption(
        page,
        '[data-cy="select-question-status"]',
        messages.shared.DRAFT.statusLabel
      )
      await page.getByTestId('insert-question-text').click()
      await page
        .getByTestId('insert-question-text')
        .pressSequentially(data.duplication.content)
      await page.getByTestId('insert-answer-field-0').click()
      await page.getByTestId('insert-answer-field-0').pressSequentially('50%')
      await page.getByTestId('insert-question-title').click()
      await page.getByTestId('add-new-answer').click()
      await page.waitForTimeout(500)
      await page.getByTestId('insert-answer-field-1').click()
      await page.getByTestId('insert-answer-field-1').pressSequentially('100%')
      await saveElementModal(page)

      await page
        .getByTestId(`duplicate-element-${data.duplication.title}`)
        .click()
      await page.waitForTimeout(500)
      await expect(
        page.getByText(messages.manage.elements.DUPLICATETitle)
      ).toBeVisible()
      await saveElementModal(page)

      await validateElementPresence(page, data.duplication.title)
      await validateElementPresence(
        page,
        `${data.duplication.title} (Copy)`,
        true,
        [messages.shared.DRAFT.statusLabel]
      )

      await deleteElement(page, `${data.duplication.title} (Copy)`)
      await validateElementPresence(
        page,
        `${data.duplication.title} (Copy)`,
        false
      )
      await deleteElement(page, data.duplication.title)
      await validateElementPresence(page, data.duplication.title, false)
    })
  })

  test.describe('Part 2: Auto-Save functionality for Elements', () => {
    test.beforeEach(async ({ loginLecturer }) => {
      await loginLecturer()
    })

    test('Verify that empty questions are not stored in local storage (creation)', async ({
      page,
    }) => {
      await page.getByTestId('create-question').click()
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await page.getByTestId('create-question').click()
      await expectNotAttached(
        page.getByTestId('discard-recovered-element-data')
      )
      await expectNotAttached(page.getByTestId('load-recovered-element-data'))
      await expect(page.getByTestId('select-question-type')).toContainText(
        messages.shared.SC.typeLabel
      )
      await expect(page.getByTestId('insert-question-title')).toHaveValue('')
    })

    test('Verify that non-empty questions are stored and loaded correctly on demand (creation)', async ({
      page,
    }) => {
      await page.getByTestId('create-question').click()
      await enterSCQuestionContent(page)
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await page.getByTestId('create-question').click()
      await page.getByTestId('load-recovered-element-data').click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.title
      )
      await page.getByTestId('insert-question-text').click()
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.content
      )
      for (let ix = 0; ix < data.autoSave.choices.length; ix++) {
        await expect(
          page.getByTestId(`insert-answer-field-${ix}`)
        ).toContainText(data.autoSave.choices[ix].value)
      }
    })

    test('Verify that non-empty questions are stored and discarded on request (creation)', async ({
      page,
    }) => {
      await page.getByTestId('create-question').click()
      await enterSCQuestionContent(page)
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await page.getByTestId('create-question').click()
      await page.getByTestId('discard-recovered-element-data').click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue('')
    })

    test('Verify that local storage is correctly cleared after creating a question', async ({
      page,
    }) => {
      await page.getByTestId('create-question').click()
      await enterSCQuestionContent(page)
      await page.waitForTimeout(3000)
      await saveElementModal(page)

      await page.getByTestId('create-question').click()
      await expectNotAttached(page.getByTestId('load-recovered-element-data'))
      await expect(page.getByTestId('insert-question-title')).toHaveValue('')
    })

    test('Verify that opening the edit modal and closing without modifications does not trigger prompt', async ({
      page,
    }) => {
      await searchAndEdit(page, data.autoSave.title)
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.title
      )
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await searchAndEdit(page, data.autoSave.title)
      await expectNotAttached(
        page.getByTestId('discard-recovered-element-data')
      )
      await expectNotAttached(page.getByTestId('load-recovered-element-data'))
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.title
      )
    })

    test('Verify that after editing a question and waiting for auto-save the corresponding content can be loaded', async ({
      page,
    }) => {
      await searchAndEdit(page, data.autoSave.title)
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.title
      )
      await page
        .getByTestId('insert-question-title')
        .fill(data.autoSave.titleEdited)
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.content
      )
      await clearAndTypeEditor(
        page,
        'insert-question-text',
        data.autoSave.contentEdited
      )
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await searchAndEdit(page, data.autoSave.title)
      await page.getByTestId('load-recovered-element-data').click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.titleEdited
      )
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.contentEdited
      )
    })

    test('Verify that after editing a question, auto-saving and discarding the saved content, the original content is loaded', async ({
      page,
    }) => {
      await searchAndEdit(page, data.autoSave.title)
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.title
      )
      await page
        .getByTestId('insert-question-title')
        .fill(data.autoSave.titleEdited)
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.content
      )
      await clearAndTypeEditor(
        page,
        'insert-question-text',
        data.autoSave.contentEdited
      )
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await searchAndEdit(page, data.autoSave.title)
      await page.getByTestId('discard-recovered-element-data').click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.title
      )
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.content
      )
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await searchAndEdit(page, data.autoSave.title)
      await expectNotAttached(
        page.getByTestId('discard-recovered-element-data')
      )
      await expectNotAttached(page.getByTestId('load-recovered-element-data'))
    })

    test('Verify that after editing an element and saving it, no prompt is shown to the user', async ({
      page,
    }) => {
      await searchAndEdit(page, data.autoSave.title)
      await page
        .getByTestId('insert-question-title')
        .fill(data.autoSave.titleEdited)
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.content
      )
      await clearAndTypeEditor(
        page,
        'insert-question-text',
        data.autoSave.contentEdited
      )
      await page.waitForTimeout(3000)
      await saveElementModal(page)

      await searchAndEdit(page, data.autoSave.titleEdited)
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.titleEdited
      )
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.contentEdited
      )
    })

    test('Verify that when duplicating a question, wating for auto-save and opening the creation form, the content cannot be loaded', async ({
      page,
    }) => {
      await page
        .getByTestId(`duplicate-element-${data.autoSave.titleEdited}`)
        .click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.titleEditedDuplicated
      )
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.contentEdited
      )
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await page.getByTestId('create-question').click()
      await expectNotAttached(page.getByTestId('load-recovered-element-data'))
    })

    test('Verify that when duplicating a question, modifying it slightly,wating for auto-save and opening the creation form, the content can be loaded', async ({
      page,
    }) => {
      await page
        .getByTestId(`duplicate-element-${data.autoSave.titleEdited}`)
        .click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.titleEditedDuplicated
      )
      await clearAndTypeEditor(
        page,
        'insert-question-text',
        data.autoSave.contentEdited2
      )
      await page.waitForTimeout(3000)
      await page.getByTestId('close-element-modal').click()

      await page.getByTestId('create-question').click()
      await page.getByTestId('load-recovered-element-data').click()
      await expect(page.getByTestId('insert-question-title')).toHaveValue(
        data.autoSave.titleEditedDuplicated
      )
      await expect(page.getByTestId('insert-question-text')).toContainText(
        data.autoSave.contentEdited2
      )
    })

    test('Cleanup: Delete the auto-saved element', async ({ page }) => {
      await deleteElement(page, data.autoSave.titleEdited)
    })
  })

  test.describe('Part 3: Element instance updates', () => {
    test('Create a single choice question with sample solution and answer feedbacks', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await createQuestionSC({
        name: data.update.title1,
        content: data.update.content1,
        choices: data.update.choices1,
        userId: LECTURER_ID,
      })
      await page.reload()
      await validateElement(page, data.update.title1)
    })

    test('Include the single choice question in three activities of each type', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()

      for (const quiz of [
        data.update.liveQuiz1,
        data.update.liveQuiz2,
        data.update.liveQuiz3,
      ]) {
        await createLiveQuiz(page, {
          name: quiz,
          displayName: quiz,
          courseName: data.update.course,
          blocks: [{ elements: [data.update.title1] }],
        })
        await page.getByTestId('create-new-activity').click()
      }

      for (const quiz of [
        data.update.practiceQuiz1,
        data.update.practiceQuiz2,
        data.update.practiceQuiz3,
      ]) {
        await createPracticeQuiz(page, {
          name: quiz,
          displayName: quiz,
          courseName: data.update.course,
          stacks: [{ elements: [data.update.title1] }],
        })
        await page.getByTestId('create-new-activity').click()
      }

      for (const microlearning of [
        data.update.microlearning1,
        data.update.microlearning2,
        data.update.microlearning3,
      ]) {
        await createMicroLearning(page, {
          name: microlearning,
          displayName: microlearning,
          startDate: {
            monthDelta: -2,
            day: 16,
            hour: 2,
            minute: 0,
            validation: `${getDatetimeValidationString(-2, '16')}, 02:00`,
          },
          endDate: {
            monthDelta: 4,
            day: 14,
            hour: 18,
            minute: 0,
            validation: `${getDatetimeValidationString(4, '14')}, 18:00`,
          },
          courseName: data.update.course,
          stacks: [{ elements: [data.update.title1] }],
        })
        await page.getByTestId('create-new-activity').click()
      }

      for (const groupActivity of [
        data.update.groupActivity1,
        data.update.groupActivity2,
        data.update.groupActivity3,
      ]) {
        await createGroupActivity(page, {
          name: groupActivity,
          displayName: groupActivity,
          task: 'Task Description',
          courseName: data.update.course,
          scheduledStartDate: {
            monthDelta: -1,
            day: 10,
            hour: 12,
            minute: 30,
            validation: `${getDatetimeValidationString(-1, '10')}, 12:30`,
          },
          scheduledEndDate: {
            monthDelta: 2,
            day: 20,
            hour: 14,
            minute: 0,
            validation: `${getDatetimeValidationString(2, '20')}, 14:00`,
          },
          clues: [
            {
              type: 'text',
              name: 'Clue 1',
              displayName: 'First Hint',
              content: 'Lorem ipsum dolor sit amet',
            },
            {
              type: 'text',
              name: 'Clue 2',
              displayName: 'Second Hint',
              content: 'Consectetur adipiscing elit',
            },
          ],
          stack: { elements: [data.update.title1] },
        })
        await page.getByTestId('create-new-activity').click()
      }
    })

    test('Start one activity of each type (and open the first block for the live quiz', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await publishSetOfActivities(page, {
        course: data.update.course,
        liveQuiz: data.update.liveQuiz1,
        practiceQuiz: data.update.practiceQuiz1,
        microlearning: data.update.microlearning1,
        groupActivity: data.update.groupActivity1,
      })
    })

    test('Update the content of the single choice question (including answer feedbacks) and trigger instance updates', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await searchAndEdit(page, data.update.title1)

      await page.getByTestId('insert-question-title').fill(data.update.title2)
      await clearAndTypeEditor(
        page,
        'insert-question-text',
        data.update.content2
      )

      for (let ix = 0; ix < data.update.choices2.length; ix++) {
        await clearAndTypeEditor(
          page,
          `insert-answer-field-${ix}`,
          data.update.choices2[ix].value
        )
      }

      for (let ix = 0; ix < data.update.choices2.length; ix++) {
        await clearAndTypeEditor(
          page,
          `insert-answer-feedback-${ix}`,
          data.update.choices2[ix].feedback ?? ''
        )
      }

      await expect(page.getByTestId('instance-update-switch')).toHaveAttribute(
        'data-state',
        'checked'
      )
      for (const activityName of [
        data.update.liveQuiz2,
        data.update.practiceQuiz2,
        data.update.microlearning2,
        data.update.groupActivity2,
        data.update.liveQuiz3,
        data.update.practiceQuiz3,
        data.update.microlearning3,
        data.update.groupActivity3,
      ]) {
        await expect(
          page.getByTestId(`instance-update-list-activity-${activityName}`)
        ).toBeVisible()
      }
      for (const activityName of [
        data.update.liveQuiz1,
        data.update.practiceQuiz1,
        data.update.microlearning1,
        data.update.groupActivity1,
      ]) {
        await expectNotAttached(
          page.getByTestId(`instance-update-list-activity-${activityName}`)
        )
      }

      await saveElementModal(page)
    })

    test('Publish / start the second set of activities', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await publishSetOfActivities(page, {
        course: data.update.course,
        liveQuiz: data.update.liveQuiz2,
        practiceQuiz: data.update.practiceQuiz2,
        microlearning: data.update.microlearning2,
        groupActivity: data.update.groupActivity2,
      })
    })

    test('Edit the question again and disable the sample solution, verify that no instances in practice quizzes / microlearnings are updated', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await searchAndEdit(page, data.update.title2)

      await page.getByTestId('insert-question-title').fill(data.update.title3)
      await clearAndTypeEditor(
        page,
        'insert-question-text',
        data.update.content3
      )

      for (let ix = 0; ix < data.update.choices3.length; ix++) {
        await clearAndTypeEditor(
          page,
          `insert-answer-field-${ix}`,
          data.update.choices3[ix].value
        )
      }

      await page.getByTestId('configure-sample-solution').click({ force: true })

      await expect(page.getByTestId('instance-update-switch')).toHaveAttribute(
        'data-state',
        'checked'
      )
      for (const activityName of [
        data.update.liveQuiz3,
        data.update.groupActivity3,
      ]) {
        await expect(
          page.getByTestId(`instance-update-list-activity-${activityName}`)
        ).toBeVisible()
      }
      for (const activityName of [
        data.update.liveQuiz1,
        data.update.practiceQuiz1,
        data.update.microlearning1,
        data.update.groupActivity1,
        data.update.liveQuiz2,
        data.update.practiceQuiz2,
        data.update.microlearning2,
        data.update.groupActivity2,
        data.update.practiceQuiz3,
        data.update.microlearning3,
      ]) {
        await expectNotAttached(
          page.getByTestId(`instance-update-list-activity-${activityName}`)
        )
      }

      await saveElementModal(page)
    })

    test('Publish / start all remaining activities', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await publishSetOfActivities(page, {
        course: data.update.course,
        liveQuiz: data.update.liveQuiz3,
        practiceQuiz: data.update.practiceQuiz3,
        microlearning: data.update.microlearning3,
        groupActivity: data.update.groupActivity3,
      })
    })

    test('Verify from a student perspective that all live quizzes have been correctly updated', async ({
      page,
      loginStudent,
    }) => {
      await loginStudent()
      await expect(page.getByTestId('homepage')).toBeVisible()

      await openStudentLiveQuiz(page, data.update.liveQuiz1)
      await verifySingleChoiceQuestionContent(page, {
        submission: false,
        content: data.update.content1,
        choices: data.update.choices1,
      })

      await returnToStudentHome(page)
      await openStudentLiveQuiz(page, data.update.liveQuiz2)
      await verifySingleChoiceQuestionContent(page, {
        submission: false,
        content: data.update.content2,
        choices: data.update.choices2,
      })

      await returnToStudentHome(page)
      await openStudentLiveQuiz(page, data.update.liveQuiz3)
      await verifySingleChoiceQuestionContent(page, {
        submission: false,
        content: data.update.content3,
        choices: data.update.choices3,
      })
    })

    test('Verify from a student perspective that all practice quizzes have been correctly updated', async ({
      page,
      loginStudent,
    }) => {
      await loginStudent()
      await expect(page.getByTestId('homepage')).toBeVisible()

      for (const [quiz, content, choices] of [
        [data.update.practiceQuiz1, data.update.content1, data.update.choices1],
        [data.update.practiceQuiz2, data.update.content2, data.update.choices2],
        [data.update.practiceQuiz3, data.update.content2, data.update.choices2],
      ] as const) {
        await returnToStudentHome(page)
        await page.getByTestId('quizzes').click()
        await expect(page.getByTestId(`practice-quiz-${quiz}`)).toBeVisible()
        await page.getByTestId(`practice-quiz-${quiz}`).click()
        await expect(page.getByTestId('start-practice-quiz')).toBeVisible()
        await page.getByTestId('start-practice-quiz').click()
        await verifySingleChoiceQuestionContent(page, {
          submission: true,
          content,
          choices,
        })
      }
    })

    test('Verify from a student perspective that all microlearnings have been correctly updated', async ({
      page,
      loginStudent,
    }) => {
      await loginStudent()
      await expect(page.getByTestId('homepage')).toBeVisible()

      for (const [microlearning, content, choices] of [
        [
          data.update.microlearning1,
          data.update.content1,
          data.update.choices1,
        ],
        [
          data.update.microlearning2,
          data.update.content2,
          data.update.choices2,
        ],
        [
          data.update.microlearning3,
          data.update.content2,
          data.update.choices2,
        ],
      ] as const) {
        await returnToStudentHome(page)
        await expect(
          page.getByTestId(`microlearning-${microlearning}`)
        ).toBeVisible()
        await page.getByTestId(`microlearning-${microlearning}`).click()
        await expect(page.getByTestId('start-microlearning')).toBeVisible()
        await page.getByTestId('start-microlearning').click()
        await verifySingleChoiceQuestionContent(page, {
          submission: true,
          content,
          choices,
        })
      }
    })

    test('Verify from a student perspective that all group activities have been correctly updated', async ({
      page,
      loginStudent,
    }) => {
      await loginStudent()
      await expect(page.getByTestId('homepage')).toBeVisible()

      for (const [groupActivity, content, choices] of [
        [
          data.update.groupActivity1,
          data.update.content1,
          data.update.choices1,
        ],
        [
          data.update.groupActivity2,
          data.update.content2,
          data.update.choices2,
        ],
        [
          data.update.groupActivity3,
          data.update.content3,
          data.update.choices3,
        ],
      ] as const) {
        await returnToStudentHome(page)
        await page.getByTestId(`course-button-${data.update.course}`).click()
        await expect(
          page.getByTestId('student-course-existing-group-0')
        ).toBeVisible()
        await page.getByTestId('student-course-existing-group-0').click()
        await expect(
          page.getByTestId(`open-group-activity-${groupActivity}`)
        ).toBeVisible()
        await page.getByTestId(`open-group-activity-${groupActivity}`).click()
        await expect(page.getByTestId('start-group-activity')).toBeVisible()
        await page.getByTestId('start-group-activity').click()
        await verifySingleChoiceQuestionContent(page, {
          submission: false,
          content,
          choices,
        })
      }
    })

    test('Cleanup: Delete the created single choice questions and all created activities', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()

      await deleteElement(page, data.update.title3)

      await openActivitiesOverview(page)
      for (const quiz of [
        data.update.liveQuiz1,
        data.update.liveQuiz2,
        data.update.liveQuiz3,
      ]) {
        await page.getByTestId('activities-search-input').fill(quiz)
        await page.keyboard.press('Enter')
        await Promise.all([
          page.waitForURL(/\/cockpit/, { timeout: 30000 }),
          page.getByTestId(`live-quiz-cockpit-${quiz}`).click(),
        ])
        await expect(page.getByTestId('next-block-timeline')).toBeVisible()
        await page.getByTestId('next-block-timeline').click()
        await page.waitForTimeout(500)
        await page.getByTestId('next-block-timeline').click()
        await page.waitForTimeout(500)
        await page.reload()
        await openActivitiesOverview(page)
        await page.getByTestId('activities-search-input').fill(quiz)
        await page.keyboard.press('Enter')
        await chooseActivityAction(
          page,
          'LIVE_QUIZ',
          quiz,
          `delete-live-quiz-${quiz}`
        )
        await confirmDeletionModal(page, [
          'confirm-deletion-responses',
          'confirm-deletion-qa-feedbacks',
          'confirm-deletion-confusion-feedbacks',
        ])
        await page.getByTestId('activities-search-input').clear()
      }

      await page.getByTestId('courses').click()
      await page.getByTestId(`course-list-button-${data.update.course}`).click()
      await page.getByTestId('tab-practiceQuizzes').click()
      for (const quiz of [
        data.update.practiceQuiz1,
        data.update.practiceQuiz2,
        data.update.practiceQuiz3,
      ]) {
        await chooseActivityAction(
          page,
          'PRACTICE_QUIZ',
          quiz,
          `delete-practice-quiz-${quiz}`
        )
        await confirmDeletionModal(page, [
          'confirm-deletion-responses',
          'confirm-deletion-anonymous-responses',
        ])
        await expectNotAttached(
          page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`)
        )
      }

      await page.getByTestId('tab-microLearnings').click()
      for (const microlearning of [
        data.update.microlearning1,
        data.update.microlearning2,
        data.update.microlearning3,
      ]) {
        await chooseActivityAction(
          page,
          'MICRO_LEARNING',
          microlearning,
          `delete-microlearning-${microlearning}`
        )
        await confirmDeletionModal(page, [
          'confirm-deletion-responses',
          'confirm-deletion-anonymous-responses',
        ])
        await expectNotAttached(
          page.getByTestId(`activity-MICRO_LEARNING-${microlearning}`)
        )
      }

      await page.getByTestId('tab-groupActivities').click()
      for (const groupActivity of [
        data.update.groupActivity1,
        data.update.groupActivity2,
        data.update.groupActivity3,
      ]) {
        await chooseActivityAction(
          page,
          'GROUP_ACTIVITY',
          groupActivity,
          `delete-group-activity-${groupActivity}`
        )
        await confirmDeletionModal(page, [
          'confirm-deletion-started-instances',
          'confirm-deletion-submissions',
        ])
        await expectNotAttached(
          page.getByTestId(`activity-GROUP_ACTIVITY-${groupActivity}`)
        )
      }
    })
  })

  test.describe('Part 4: Sharing functionalities for elements (restricted catalog collection)', () => {
    test('Create a selection question', async ({ page, loginLecturer }) => {
      await loginLecturer()
      await createSelectionQuestionForSharing(page, data.SEML)
    })

    test('Add the question as a restricted collection to the catalog', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()

      await addObjectToCatalog(page, {
        objectName: data.SEML.title,
        objectType: 'ELEMENT',
        permissionLevel: 'restricted',
      })

      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await expectNotAttached(
        page.getByTestId(`copy-object-${data.SEML.title}`)
      )
      await expectNotAttached(
        page.getByTestId(`request-access-${data.SEML.title}`)
      )
      await expect(
        page.getByTestId(`remove-object-${data.SEML.title}`)
      ).toBeVisible()
    })

    test('Test filters and search on the catalog page', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()

      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page
        .getByTestId('search-catalog-collection')
        .fill('SOME NON-EXISTING TITLE')
      await expectNotAttached(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      )
      await page.getByTestId('search-catalog-collection').fill(data.SEML.title)
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()

      await expect(
        page.getByTestId('catalog-access-type-filter')
      ).toContainText(messages.manage.catalog.all)
      await selectOption(
        page,
        '[data-cy="catalog-access-type-filter"]',
        messages.manage.catalog.accessPUBLIC
      )
      await expectNotAttached(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      )
      await selectOption(
        page,
        '[data-cy="catalog-access-type-filter"]',
        messages.manage.catalog.accessRESTRICTED
      )
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await selectOption(
        page,
        '[data-cy="catalog-access-type-filter"]',
        messages.manage.catalog.all
      )
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
    })

    test('Request access to restricted question (for user pro1)', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`request-access-${data.SEML.title}`).click()
      await page.getByTestId('cancel-request-access').click()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`request-access-${data.SEML.title}`).click()
      await page.getByTestId('confirm-request-access').click()

      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toContainText(messages.manage.catalog.accessRequested)
    })

    test('Request access to restricted question (for user pro2)', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`request-access-${data.SEML.title}`).click()
      await page.getByTestId('confirm-request-access').click()

      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toContainText(messages.manage.catalog.accessRequested)
    })

    test('Verify that access requests are correctly shown to collection owner', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      for (const user of ['pro1', 'pro2']) {
        await expect(
          page.getByTestId(`sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
        await expect(
          page.getByTestId(`approve-sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
        await expect(
          page.getByTestId(`deny-sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
      }
    })

    test('Temporarily award ADMIN permissions to user pro3 and verify that the access requests are visible as well', async ({
      page,
      loginLecturer,
      loginInstitutionalCatalyst2,
      logoutUser,
    }) => {
      await loginLecturer()
      await openShareModalForElement(page, data.SEML.title)
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST2_SHORTNAME,
        permission: messages.manage.sharing.permissionsADMIN,
      })
      await logoutUser()

      await loginInstitutionalCatalyst2()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      for (const user of ['pro1', 'pro2']) {
        await expect(
          page.getByTestId(`sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
        await expect(
          page.getByTestId(`approve-sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
        await expect(
          page.getByTestId(`deny-sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
      }
      await logoutUser()

      await loginLecturer()
      await openShareModalForElement(page, data.SEML.title)
      await expect(
        page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
      ).toBeVisible()
      await page
        .getByTestId(`revoke-permission-${LECTURER_INST2_SHORTNAME}`)
        .click()
      await page.getByTestId('confirm-revocation').click()
      await expectNotAttached(
        page.getByTestId(`permission-${LECTURER_INST2_SHORTNAME}`)
      )
      await expect(
        page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
      ).toContainText(messages.manage.sharing.permissionsOWNER)
      await logoutUser()

      await loginInstitutionalCatalyst2()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      for (const user of ['pro1', 'pro2']) {
        await expectNotAttached(
          page.getByTestId(`sharing-request-${data.SEML.title}-${user}`)
        )
        await expectNotAttached(
          page.getByTestId(`approve-sharing-request-${data.SEML.title}-${user}`)
        )
        await expectNotAttached(
          page.getByTestId(`deny-sharing-request-${data.SEML.title}-${user}`)
        )
      }
    })

    test('Cancel the request through user pro1 and request the element again', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()

      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toContainText(messages.manage.catalog.accessRequested)
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`cancel-request-${data.SEML.title}`).click()
      await page.getByTestId('confirm-request-cancellation').click()

      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`request-access-${data.SEML.title}`).click()
      await page.getByTestId('confirm-request-access').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toContainText(messages.manage.catalog.accessRequested)
    })

    test('Grant access to restricted question (for user pro1)', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await page
        .getByTestId(`approve-sharing-request-${data.SEML.title}-pro1`)
        .click()
      await expect(page.getByTestId('permission-level-select')).toContainText(
        messages.manage.sharing.permissionsREAD
      )
      await selectOption(
        page,
        '[data-cy="permission-level-select"]',
        messages.manage.sharing.permissionsREAD
      )
      await page.getByTestId('confirm-approval').click()
    })

    test('Decline access request to restricted question (for user pro2)', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await page
        .getByTestId(`deny-sharing-request-${data.SEML.title}-pro2`)
        .click()
    })

    test("Verify that the active permission for user 'pro1' is shown correctly", async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await openShareModalForElement(page, data.SEML.title)
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).toContainText(messages.manage.sharing.permissionsREAD)
      await expect(
        page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
      ).toContainText(messages.manage.sharing.permissionsOWNER)
    })

    test('Verify that restricted question is visible for user pro1', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await validateElement(page, data.SEML.title)
    })

    test('Verify that restricted question is not visible for user pro2', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await validateElementPresence(page, data.SEML.title, false)
    })

    test('Change the access level of the question in the catalog to public', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()

      await expect(
        page.getByTestId(`${data.SEML.title}-object-access`)
      ).toContainText(messages.manage.catalog.accessRESTRICTED)
      await selectOption(
        page,
        `[data-cy="${data.SEML.title}-object-access"]`,
        messages.manage.catalog.accessPUBLIC
      )
      await page.getByTestId('confirm-access-change').click()
      await expect(
        page.getByTestId(`${data.SEML.title}-object-access`)
      ).toContainText(messages.manage.catalog.accessPUBLIC)
    })

    test('Verify that question can now be imported or requested', async ({
      page,
      loginInstitutionalCatalyst2,
    }) => {
      await loginInstitutionalCatalyst2()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()

      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await expect(
        page.getByTestId(`copy-object-${data.SEML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`request-access-${data.SEML.title}`)
      ).toBeVisible()
      await expectNotAttached(
        page.getByTestId(`remove-object-${data.SEML.title}`)
      )
      await expectNotAttached(
        page.getByTestId(`${data.SEML.title}-object-access`)
      )
    })

    test('Remove the question from the catalog (by owner)', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`remove-object-${data.SEML.title}`).click()
      await page.getByTestId('confirm-removal').click()
    })

    test('Verify that the question is no longer visible in the catalog', async ({
      page,
      loginInstitutionalCatalyst2,
    }) => {
      await loginInstitutionalCatalyst2()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expectNotAttached(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      )
    })

    test('Re-add the question with restricted access to the restricted catalog collection', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await addObjectToCatalog(page, {
        objectName: data.SEML.title,
        objectType: 'ELEMENT',
        permissionLevel: 'restricted',
      })
    })

    test("Grant admin access to user 'pro2' for the restricted question", async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await openShareModalForElement(page, data.SEML.title)
      await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
      await page
        .getByTestId('new-permission-username-or-email')
        .fill(LECTURER_INST_EMAIL)
      await expect(page.getByTestId('new-permission-submit')).toBeEnabled()
      await page.getByTestId('new-permission-username-or-email').clear()
      await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_EMAIL,
        expectedPermissionKey: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsADMIN,
      })
      await expect(
        page.getByTestId(`permission-${LECTURER_INST_SHORTNAME}`)
      ).toContainText(messages.manage.sharing.permissionsADMIN)
    })

    test('Verify that user pro2 should now be able to add this question to the catalog', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()

      await page.getByTestId('add-object-to-catalog-button').click()
      await selectOption(
        page,
        '[data-cy="object-type-selection"]',
        messages.shared.types.ELEMENT
      )
      await page.locator('#object-selection-catalog-addition').click()
      await expect(
        page.locator('#react-select-object-selection-catalog-addition-option-0')
      ).toBeVisible()
    })

    test('Cleanup: Reset the database', cleanupTest)
  })

  test.describe('Part 5: Sharing functionalities for elements (public catalog collection)', () => {
    test('Create a selection question', async ({ page, loginLecturer }) => {
      await loginLecturer()
      await createSelectionQuestionForSharing(page, data.SEML)
    })

    test('Add the question with public access to the catalog and verify visibility', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()

      await addObjectToCatalog(page, {
        objectName: data.SEML.title,
        objectType: 'ELEMENT',
        permissionLevel: 'public',
      })

      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await expectNotAttached(
        page.getByTestId(`copy-object-${data.SEML.title}`)
      )
      await expectNotAttached(
        page.getByTestId(`request-access-${data.SEML.title}`)
      )
      await expect(
        page.getByTestId(`remove-object-${data.SEML.title}`)
      ).toBeVisible()
    })

    test("Request access to the public question (for user 'pro1')", async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`request-access-${data.SEML.title}`).click()
      await expect(
        page.getByText(messages.manage.catalog.requestPublicResource)
      ).toBeVisible()
      await page.getByTestId('confirm-request-access').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toContainText(messages.manage.catalog.accessRequested)
    })

    test("Request access to the public question (for user 'pro2')", async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`request-access-${data.SEML.title}`).click()
      await page.getByTestId('confirm-request-access').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toContainText(messages.manage.catalog.accessRequested)
    })

    test('Verify that access requests are correctly shown to question owner', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      for (const user of ['pro1', 'pro2']) {
        await expect(
          page.getByTestId(`sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
        await expect(
          page.getByTestId(`approve-sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
        await expect(
          page.getByTestId(`deny-sharing-request-${data.SEML.title}-${user}`)
        ).toBeVisible()
      }
    })

    test('Grant access to public question (for user pro1)', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await page
        .getByTestId(`approve-sharing-request-${data.SEML.title}-pro1`)
        .click()
      await expect(page.getByTestId('permission-level-select')).toContainText(
        messages.manage.sharing.permissionsREAD
      )
      await selectOption(
        page,
        '[data-cy="permission-level-select"]',
        messages.manage.sharing.permissionsREAD
      )
      await page.getByTestId('confirm-approval').click()
    })

    test('Decline access request to public question (for user pro2)', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await page
        .getByTestId(`deny-sharing-request-${data.SEML.title}-pro2`)
        .click()
    })

    test("Verify that the active permission for user 'pro1' is shown correctly", async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await openShareModalForElement(page, data.SEML.title)
      await expect(
        page.getByTestId(`permission-${LECTURER_IND_SHORTNAME}`)
      ).toContainText(messages.manage.sharing.permissionsREAD)
      await expect(
        page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
      ).toContainText(messages.manage.sharing.permissionsOWNER)
    })

    test("Verify that the public question is visible for user 'pro1'", async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await validateElementPresence(page, data.SEML.title, true)
    })

    test("Verify that the public question is not visible for user 'pro2'", async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await validateElementPresence(page, data.SEML.title, false)
    })

    test('Import (and copy) the public question (for user pro2)', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('catalog').click()
      await expect(
        page.getByTestId(`catalog-object-${data.SEML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`copy-object-${data.SEML.title}`).click()
      await page.getByTestId('close-object-copy-modal').click()

      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`copy-object-${data.SEML.title}`).click()
      await page.getByTestId('cancel-object-copy').click()
      await page.getByTestId(`actions-dropdown-${data.SEML.title}`).click()
      await page.getByTestId(`copy-object-${data.SEML.title}`).click()
      await page.getByTestId('confirm-object-copy').click()

      await page.getByTestId('library').click()
      await expect(page.getByTestId('elements-search-input')).toBeVisible()
      await page.reload()
      await validateElementPresence(page, data.SEML.title, true)
    })

    test('Verify that imported question is visible to user pro2 (copied and with edit permissions)', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SEML.title)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${data.SEML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`edit-element-${data.SEML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`duplicate-element-${data.SEML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`actions-element-${data.SEML.title}`)
      ).toBeVisible()
    })

    test('Remove the public question from user pro1', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SEML.title)
      await page.keyboard.press('Enter')
      await page.getByTestId(`element-item-${data.SEML.title}`).click()
      await page.getByTestId(`remove-element-${data.SEML.title}`).click()

      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expectNotAttached(
        page.getByTestId(`answer-collection-${data.SEML.title}`)
      )
    })

    test('Delete the original public question', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await deleteElement(page, data.SEML.title)
    })

    test('Verify that imported question is still visible to user pro2 (due to derived permission)', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await validateElement(page, data.SEML.title)
    })

    test('Remove the imported question from user pro2', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await deleteElement(page, data.SEML.title)
    })

    test('Cleanup: Reset the database', cleanupTest)
  })

  test.describe('Part 6: Direct sharing / enabled functionalities', () => {
    test('Create a single choice question and share it with different permission levels', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await createQuestionSC({
        name: data.SCML.title,
        content: data.SCML.content,
        choices: data.SCML.choices,
        userId: LECTURER_ID,
      })
      await page.reload()
      await openShareModalForElement(page, data.SCML.title)

      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_IND_SHORTNAME,
        permission: messages.manage.sharing.permissionsREAD,
      })
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsWRITE,
      })
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST2_SHORTNAME,
        permission: messages.manage.sharing.permissionsADMIN,
      })
    })

    test('Verify that the user with granted access are able to access the correct element manipulation functionalities', async ({
      page,
      loginIndividualCatalyst,
      loginInstitutionalCatalyst,
      loginInstitutionalCatalyst2,
      logoutUser,
    }) => {
      await loginIndividualCatalyst()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SCML.title)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${data.SCML.title}`)
      ).toBeVisible()
      await expectNotAttached(
        page.getByTestId(`edit-element-${data.SCML.title}`)
      )
      await expect(
        page.getByTestId(`duplicate-element-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`remove-element-${data.SCML.title}`)
      ).toBeVisible()
      await expectNotAttached(
        page.getByTestId(`actions-element-${data.SCML.title}`)
      )
      await logoutUser()

      await loginInstitutionalCatalyst()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SCML.title)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`edit-element-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`duplicate-element-${data.SCML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-element-${data.SCML.title}`).click()
      await expect(
        page.getByTestId(`view-activity-log-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`remove-element-${data.SCML.title}`)
      ).toBeVisible()
      await logoutUser()

      await loginInstitutionalCatalyst2()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SCML.title)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`edit-element-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`duplicate-element-${data.SCML.title}`)
      ).toBeVisible()
      await page.getByTestId(`actions-element-${data.SCML.title}`).click()
      await expect(
        page.getByTestId(`view-activity-log-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`share-element-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`delete-element-${data.SCML.title}`)
      ).toBeVisible()
    })

    test('Cleanup: Delete the created question again and verify deletion', async ({
      page,
      loginLecturer,
      loginIndividualCatalyst,
    }) => {
      await loginLecturer()
      await deleteElement(page, data.SCML.title)
      await validateElementPresence(page, data.SCML.title, false)

      await loginIndividualCatalyst()
      await page.reload()
      await validateElementPresence(page, data.SCML.title, false)
    })

    test('Create user groups with all users and prepare a new selection question (incl. answer collection) for user group sharing', async ({
      page,
      loginLecturer,
      loginInstitutionalCatalyst2,
      logoutUser,
    }) => {
      await loginLecturer()
      await createSelectionQuestionForSharing(page, data.SEML2)

      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('user-groups').click()

      await page.getByTestId('create-user-group').click()
      await page.getByTestId('user-group-name').fill(data.group1)
      await page
        .getByTestId('member-shortname-email-0')
        .fill(LECTURER_IND_SHORTNAME)
      await page.getByTestId('submit-create-user-group').click()
      await expect(page.getByTestId(`user-group-${data.group1}`)).toBeVisible()
      await expect(page.getByTestId(`user-group-${data.group1}`)).toContainText(
        messages.shared.generic.owner
      )
      await page.getByTestId(`user-group-actions-${data.group1}`).click()
      await expect(
        page.getByTestId(`view-edit-group-${data.group1}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`delete-group-${data.group1}`)
      ).toBeVisible()
      await page.getByTestId(`view-edit-group-${data.group1}`).click()
      await expect(page.getByTestId('edit-group-name')).toBeVisible()
      await expect(
        page.getByTestId(`group-member-${LECTURER_IND_SHORTNAME}`)
      ).toBeVisible()
      await page.getByTestId('close-user-group-edit-modal').click()

      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('user-groups').click()
      await page.getByTestId('create-user-group').click()
      await page.getByTestId('user-group-name').fill(data.group2)
      await page.getByTestId('cancel-create-user-group').click()
      await page.getByTestId('create-user-group').click()
      await page.getByTestId('user-group-name').fill(data.group2)
      await page
        .getByTestId('member-shortname-email-0')
        .fill(LECTURER_INST_EMAIL)
      await page.getByTestId('member-admin-0').click()
      await page.getByTestId('submit-create-user-group').click()
      await expect(page.getByTestId(`user-group-${data.group2}`)).toBeVisible()
      await expect(page.getByTestId(`user-group-${data.group2}`)).toContainText(
        messages.shared.generic.owner
      )
      await page.getByTestId(`user-group-actions-${data.group2}`).click()
      await expect(
        page.getByTestId(`view-edit-group-${data.group2}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`delete-group-${data.group2}`)
      ).toBeVisible()
      await page.getByTestId(`view-edit-group-${data.group2}`).click()
      await expect(page.getByTestId('edit-group-name')).toBeVisible()
      await expect(
        page.getByTestId(`group-admin-${LECTURER_INST_SHORTNAME}`)
      ).toBeVisible()
      await page.getByTestId('close-user-group-edit-modal').click()
      await logoutUser()

      await loginInstitutionalCatalyst2()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('user-groups').click()
      await page.getByTestId('create-user-group').click()
      await page.getByTestId('user-group-name').fill(data.group3)
      await page.getByTestId('cancel-create-user-group').click()
      await page.getByTestId('create-user-group').click()
      await page.getByTestId('user-group-name').fill(data.group3)
      await page
        .getByTestId('member-shortname-email-0')
        .fill(LECTURER_SHORTNAME)
      await page.getByTestId('submit-create-user-group').click()
      await expect(page.getByTestId(`user-group-${data.group3}`)).toBeVisible()
      await expect(page.getByTestId(`user-group-${data.group3}`)).toContainText(
        messages.shared.generic.owner
      )
      await page.getByTestId(`user-group-actions-${data.group3}`).click()
      await expect(
        page.getByTestId(`view-edit-group-${data.group3}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`delete-group-${data.group3}`)
      ).toBeVisible()
      await page.getByTestId(`view-edit-group-${data.group3}`).click()
      await expect(page.getByTestId('edit-group-name')).toBeVisible()
      await expect(
        page.getByTestId(`group-member-${LECTURER_SHORTNAME}`)
      ).toBeVisible()
      await page.getByTestId('close-user-group-edit-modal').click()
      await logoutUser()
    })

    test('Grant direct READ, WRITE and ADMIN permissions to the element for the user groups', async ({
      page,
      loginLecturer,
    }) => {
      await loginLecturer()
      await openShareModalForElement(page, data.SEML2.title)

      for (const [groupName, permission] of [
        [data.group1, messages.manage.sharing.permissionsREAD],
        [data.group2, messages.manage.sharing.permissionsWRITE],
        [data.group3, messages.manage.sharing.permissionsADMIN],
      ] as const) {
        if (groupName === data.group1) {
          await expect(page.getByTestId('new-permission-submit')).toBeDisabled()
        } else {
          await expect(
            page.getByTestId('new-permission-user-group')
          ).toContainText(messages.manage.sharing.noUserGroupSelected)
        }
        await selectOption(
          page,
          '[data-cy="new-permission-user-group"]',
          groupName
        )
        await expect(
          page.getByTestId('new-permission-user-group')
        ).toContainText(groupName)
        await expect(page.getByTestId('new-permission-submit')).toBeEnabled()
        await selectOption(
          page,
          '[data-cy="new-permission-access-level"]',
          permission
        )
        await expect(
          page.getByTestId('new-permission-access-level')
        ).toContainText(permission)
        await page.getByTestId('new-permission-submit').click()
        await page.waitForTimeout(500)
        await expect(page.getByTestId(`permission-${groupName}`)).toContainText(
          permission
        )
        if (groupName === data.group1) {
          await expect(
            page.getByTestId(`owner-permission-${LECTURER_SHORTNAME}`)
          ).toContainText(messages.manage.sharing.permissionsOWNER)
        }
      }
    })

    async function verifySharedSelectionAndCollection(
      page: Page,
      {
        canEdit,
        canOpenActions,
      }: {
        canEdit: boolean
        canOpenActions: boolean
      }
    ) {
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SEML2.title)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${data.SEML2.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`duplicate-element-${data.SEML2.title}`)
      ).toBeVisible()
      if (canEdit) {
        await expect(
          page.getByTestId(`edit-element-${data.SEML2.title}`)
        ).toBeVisible()
      }
      if (canOpenActions) {
        await expect(
          page.getByTestId(`actions-element-${data.SEML2.title}`)
        ).toBeVisible()
      }

      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('answer-collections').click()
      await expect(
        page.getByTestId(`answer-collection-${data.collection.name}`)
      ).toBeVisible()
      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page.getByTestId('view-answer-collection').click()
      await page.getByTestId('open-collection-options').click()
      for (const value of data.collection.options) {
        await expect(page.getByText(value, { exact: true })).toBeVisible()
      }
    }

    test('Verify that the users in group 1 have been granted READ permissions on the element and contained answer collection', async ({
      page,
      loginIndividualCatalyst,
    }) => {
      await loginIndividualCatalyst()
      await validateElement(page, data.SEML2.title)
      await expect(
        page.getByTestId(`duplicate-element-${data.SEML2.title}`)
      ).toBeVisible()
      await expect(page.getByTestId('analytics')).toBeVisible()
      await page.getByTestId('resources').click()
      await page.getByTestId('answer-collections').click()
      await expect(
        page.getByTestId(`answer-collection-${data.collection.name}`)
      ).toBeVisible()
      await page
        .getByTestId(`answer-collection-actions-${data.collection.name}`)
        .click()
      await page.getByTestId('view-answer-collection').click()
      await page.getByTestId('open-collection-options').click()
      for (const value of data.collection.options) {
        await expect(page.getByText(value, { exact: true })).toBeVisible()
      }
    })

    test('Verify that the users in group 2 have been granted WRITE permissions on the element and contained answer collection', async ({
      page,
      loginInstitutionalCatalyst,
    }) => {
      await loginInstitutionalCatalyst()
      await verifySharedSelectionAndCollection(page, {
        canEdit: true,
        canOpenActions: false,
      })
    })

    test('Verify that the users in group 3 have been granted ADMIN permissions on the element and contained answer collection', async ({
      page,
      loginInstitutionalCatalyst2,
    }) => {
      await loginInstitutionalCatalyst2()
      await verifySharedSelectionAndCollection(page, {
        canEdit: true,
        canOpenActions: true,
      })
    })
  })

  test.describe('Part 7: Element import/export packages', () => {
    test.beforeEach(async ({ loginLecturer }) => {
      await loginLecturer()
    })

    test('Download action is disabled until at least one element is selected', async ({
      page,
    }) => {
      await expect(page.getByTestId('elements-download')).toBeDisabled()
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).not.toBeAttached()
    })

    test('Owner can export selected elements as a ZIP package', async ({
      page,
    }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `export ${testInfo.workerIndex}`,
      })

      await openExportPackageModal(page, [names.singleChoice, names.selection])
      await expect(
        page.getByTestId('element-export-answer-collections-overview')
      ).toBeVisible()
      await expect(
        page.getByTestId('element-package-answer-collection-0')
      ).toContainText(names.collection)
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()
      const downloadPromise = page.waitForEvent('download')
      await page.getByTestId('download-selected-elements-package').click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toMatch(/\.zip$/)
    })

    test('Export preview warns about external media links without blocking download', async ({
      page,
    }, testInfo) => {
      const elementName = `PW Package external media ${testInfo.workerIndex}`

      await createQuestionSC({
        name: elementName,
        content: `External media package content https://example.com/media-${testInfo.workerIndex}.png`,
        explanation: `External media explanation https://example.com/explanation-${testInfo.workerIndex}.jpg`,
        choices: [
          {
            value: `Choice with https://example.com/choice-${testInfo.workerIndex}.webp`,
            correct: true,
          },
          { value: 'Distractor', correct: false },
        ],
        userId: LECTURER_ID,
      })

      await page.goto(process.env.URL_MANAGE ?? URL_MANAGE, {
        waitUntil: 'commit',
      })
      await expect(page.getByTestId('elements-search-input')).toBeVisible()
      await validateElement(page, elementName)

      await openExportPackageModal(page, [elementName])
      await expect(
        page.getByTestId('element-export-package-warning')
      ).toContainText(
        messages.manage.elements.elementImportExternalMediaWarning
      )
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()
    })

    test('Downloaded package can be imported back with inline preview in the same modal', async ({
      page,
    }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `roundtrip ${testInfo.workerIndex}`,
      })
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.singleChoice, names.selection],
      })

      await openImportPackageModal(page)
      await uploadPackageFile(page, zipPath)

      const dialog = page.getByRole('dialog')
      const previewPanel = page.getByTestId('element-import-preview-panel')
      await expect(dialog).toHaveCount(1)
      await expect(
        page.getByTestId('element-import-answer-collections-overview')
      ).toBeVisible()
      await expect(
        page.getByTestId('element-package-answer-collection-0')
      ).toContainText(names.collection)
      await expect(previewPanel).toBeVisible()
      await expect(page.getByTestId('element-import-0')).toBeVisible()

      const modalBefore = await dialog.first().boundingBox()
      const panelBefore = await previewPanel.boundingBox()
      await page.getByTestId('preview-imported-element-0').click()
      await expect(
        page.getByTestId('element-import-preview-content')
      ).toBeVisible()
      await expect(dialog).toHaveCount(1)
      await expect(previewPanel).toBeVisible()

      const modalAfter = await dialog.first().boundingBox()
      const panelAfter = await previewPanel.boundingBox()
      expect(
        Math.abs((modalAfter?.width ?? 0) - (modalBefore?.width ?? 0))
      ).toBeLessThan(40)
      expect(
        Math.abs((modalAfter?.height ?? 0) - (modalBefore?.height ?? 0))
      ).toBeLessThan(40)
      expect(
        Math.abs((panelAfter?.width ?? 0) - (panelBefore?.width ?? 0))
      ).toBeLessThan(80)
      expect(
        Math.abs((panelAfter?.height ?? 0) - (panelBefore?.height ?? 0))
      ).toBeLessThan(80)

      await page.getByTestId('confirm-element-import').click()
      await expect(
        page.getByTestId('element-import-preview-panel')
      ).not.toBeAttached({
        timeout: 30000,
      })

      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(names.singleChoice)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${names.singleChoice}`)
      ).toHaveCount(2)

      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(names.selection)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${names.selection}`)
      ).toHaveCount(2)
    })

    test('Package import creates private copies without carrying shared permissions', async ({
      page,
      loginLecturer,
      loginInstitutionalCatalyst,
      loginInstitutionalCatalyst2,
      logoutUser,
    }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `permission isolation ${testInfo.workerIndex}`,
      })

      await openShareModalForElement(page, names.selection)
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsWRITE,
      })
      await page.getByTestId('close-share-object').click()

      await shareAnswerCollectionWithUser(page, {
        collectionName: names.collection,
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsWRITE,
      })

      await openElementsLibraryPage(page)
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.selection],
      })

      await logoutUser()
      await loginInstitutionalCatalyst()
      await openElementsLibraryPage(page)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)

      await logoutUser()
      await loginInstitutionalCatalyst2()
      await openElementsLibraryPage(page)
      await importPackageFile(page, zipPath)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)

      await logoutUser()
      await loginLecturer()
      await openElementsLibraryPage(page)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)

      await logoutUser()
      await loginInstitutionalCatalyst()
      await openElementsLibraryPage(page)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)
    })

    test('Invalid package upload is rejected before import confirmation', async ({
      page,
    }, testInfo) => {
      const invalidPackage = testInfo.outputPath('invalid-elements.zip')
      await writeFile(invalidPackage, Buffer.from('not a zip package'))

      await openImportPackageModal(page)
      await uploadPackageFile(page, invalidPackage)

      await expect(
        page.getByTestId('element-import-package-error')
      ).toContainText(messages.manage.elements.elementImportInvalidFile, {
        timeout: 30000,
      })
      await expect(
        page.getByTestId('element-import-preview-panel')
      ).not.toBeAttached()
      await expect(
        page.getByTestId('element-import-answer-collections-overview')
      ).not.toBeAttached()
      await expect(
        page.getByTestId('confirm-element-import')
      ).not.toBeAttached()
    })

    test('Non-ZIP and oversized uploads are rejected before SAS upload preparation', async ({
      page,
    }, testInfo) => {
      const invalidTextPackage = testInfo.outputPath('invalid-elements.txt')
      const oversizedPackage = testInfo.outputPath('oversized-elements.zip')

      await writeFile(invalidTextPackage, Buffer.from('not a zip package'))
      await writeFile(
        oversizedPackage,
        Buffer.alloc(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES + 1)
      )

      await openImportPackageModal(page)
      const getPrepareRequests = observePreparePackageUploadRequests(page)

      await uploadPackageFile(page, invalidTextPackage)
      await expect(
        page.getByTestId('element-import-package-error')
      ).toContainText(messages.manage.elements.elementImportInvalidFile)
      expect(getPrepareRequests()).toBe(0)

      await uploadPackageFile(page, oversizedPackage)
      await expect(
        page.getByTestId('element-import-package-error')
      ).toContainText('10 MB')
      expect(getPrepareRequests()).toBe(0)
    })

    test('READ permission cannot export an element package', async ({
      page,
      loginInstitutionalCatalyst,
      logoutUser,
    }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `read blocked ${testInfo.workerIndex}`,
      })

      await openShareModalForElement(page, names.singleChoice)
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsREAD,
      })
      await page.getByTestId('close-share-object').click()

      await logoutUser()
      await loginInstitutionalCatalyst()
      await openExportPackageModal(page, [names.singleChoice])
      await expect(
        page.getByTestId('element-export-answer-collections-overview')
      ).toBeVisible()
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeDisabled()
      await expectNoPackageDownload(page)
      await expect(
        page.getByTestId('element-export-package-error')
      ).toBeVisible()
    })

    test('READ access to a linked answer collection is visible but cannot be exported in a package', async ({
      page,
      loginInstitutionalCatalyst,
      logoutUser,
    }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `collection read blocked ${testInfo.workerIndex}`,
      })

      await openShareModalForElement(page, names.selection)
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsWRITE,
      })
      await page.getByTestId('close-share-object').click()

      await shareAnswerCollectionWithUser(page, {
        collectionName: names.collection,
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsREAD,
      })

      await logoutUser()
      await loginInstitutionalCatalyst()
      await verifyReadOnlyAnswerCollectionVisible(
        page,
        names.collection,
        packageEntries
      )
      await openElementsLibraryPage(page)
      await openExportPackageModal(page, [names.selection])

      const overview = page.getByTestId(
        'element-export-answer-collections-overview'
      )
      await expect(overview).toBeVisible()
      await expect(overview).toContainText(
        messages.manage.elements.packageAnswerCollectionExportPermissionError
      )
      await expect(overview).not.toContainText(names.collection)
      for (const entry of packageEntries) {
        await expect(overview).not.toContainText(entry)
      }

      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeDisabled()
      await expectNoPackageDownload(page)
      await expect(
        page.getByTestId('element-export-package-error')
      ).toContainText(
        messages.manage.elements.packageAnswerCollectionExportPermissionError
      )
    })
  })
})
