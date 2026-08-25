import { Page } from '@playwright/test'
import dmQuestionsData from '../fixtures/DM-questions.json' with { type: 'json' }
import questionsData from '../fixtures/questions.json' with { type: 'json' }
import {
  chooseActionByTestId,
  chooseActivityAction,
  filterActivitiesByName,
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
  createQuestionMC,
  createQuestionSC,
  createQuestionSE,
  deleteElement,
  searchAndEdit,
  validateElement,
} from '../util/fixtures/elements.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import {
  acceptGamifiedLiveQuizAccountPrompt,
  createQuestionNR,
} from '../util/workflow.js'

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

  await page.getByTestId('activities').click()
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

      await page.getByTestId('elements-search-input').fill(data.update.title3)
      await page.getByTestId('elements-search-input').press('Enter')
      const obsoleteElement = page.getByTestId(
        `element-item-${data.update.title3}`
      )
      if (
        await obsoleteElement
          .waitFor({ state: 'visible', timeout: 5000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await deleteElement(page, data.update.title3)
      }

      await page.getByTestId('activities').click()
      for (const quiz of [
        data.update.liveQuiz1,
        data.update.liveQuiz2,
        data.update.liveQuiz3,
      ]) {
        await filterActivitiesByName(page, quiz)
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
        await page.getByTestId('activities').click()
        await filterActivitiesByName(page, quiz)
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
    test('Batch sharing applies updates first and reports elements without ADMIN access', async ({
      page,
      loginLecturer,
      loginInstitutionalCatalyst,
      loginIndividualCatalyst,
      logoutUser,
    }) => {
      await loginLecturer()
      await createQuestionMC({
        name: data.MCML.title,
        content: data.MCML.content,
        choices: data.MCML.choices,
        userId: LECTURER_ID,
      })
      await createQuestionNR(page, {
        name: data.NRML.title,
        content: data.NRML.content,
        ...data.NRML.options,
        multiplier: 3,
        userId: LECTURER_ID,
      })

      await page.reload()
      await openShareModalForElement(page, data.MCML.title)
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsADMIN,
      })
      await page.getByTestId('close-share-object').click()

      await openShareModalForElement(page, data.NRML.title)
      await shareElementWithUser(page, {
        shortnameOrEmail: LECTURER_INST_SHORTNAME,
        permission: messages.manage.sharing.permissionsWRITE,
      })
      await page.getByTestId('close-share-object').click()

      await logoutUser()
      await loginInstitutionalCatalyst()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').press('Enter')

      await page.getByTestId(`element-checkbox-${data.NRML.title}`).check()
      await page.getByTestId('element-batch-operations').click()
      await page.getByTestId('status-checkbox').check()
      await selectOption(
        page,
        '[data-cy="element-status-select"]',
        messages.shared.READY.statusLabel
      )
      await page.getByTestId('element-batch-sharing-checkbox').check()
      await page
        .getByTestId('element-batch-sharing-username-or-email')
        .fill(LECTURER_IND_SHORTNAME)
      await expect(
        page.getByTestId(`element-batch-sharing-x-${data.NRML.title}`)
      ).toBeVisible()
      await expect(page.getByTestId('apply-batch-operations')).toBeEnabled()
      await page.getByTestId('close-batch-operations-modal').click()
      await page.getByTestId(`element-checkbox-${data.NRML.title}`).uncheck()

      await page.getByTestId(`element-checkbox-${data.MCML.title}`).check()
      await page.getByTestId(`element-checkbox-${data.NRML.title}`).check()
      await page.getByTestId('element-batch-operations').click()
      await page.getByTestId('status-checkbox').check()
      await selectOption(
        page,
        '[data-cy="element-status-select"]',
        messages.shared.READY.statusLabel
      )
      await page.getByTestId('element-batch-sharing-checkbox').check()
      await page
        .getByTestId('element-batch-sharing-username-or-email')
        .fill(LECTURER_IND_SHORTNAME)
      await selectOption(
        page,
        '[data-cy="element-batch-sharing-permission-level"]',
        messages.manage.sharing.permissionsREAD
      )

      await expect(
        page.getByTestId(`element-batch-sharing-check-${data.MCML.title}`)
      ).toBeVisible()
      const writeOnlyElement = page.getByTestId(
        `element-batch-sharing-x-${data.NRML.title}`
      )
      await expect(writeOnlyElement).toBeVisible()
      await writeOnlyElement.hover()
      await expect(
        page.locator('li:visible').filter({
          hasText:
            messages.manage.questionPool.batchSharingInsufficientPermission,
        })
      ).toHaveText(
        messages.manage.questionPool.batchSharingInsufficientPermission
      )

      await page.getByTestId('apply-batch-operations').click()
      await expect(page.getByTestId('element-batch-result')).toBeVisible()
      await expect(
        page.getByTestId('element-batch-update-result')
      ).toContainText(messages.manage.questionPool.batchUpdateResultSuccess)
      await expect(
        page.getByTestId(`element-batch-sharing-result-${data.MCML.title}`)
      ).toContainText(messages.manage.questionPool.batchSharingResultShared)
      await expect(
        page.getByTestId(`element-batch-sharing-result-${data.NRML.title}`)
      ).toContainText(
        messages.manage.questionPool
          .batchSharingResultSkippedInsufficientPermission
      )
      await page.getByTestId('close-batch-operations-result').click()

      await validateElement(page, data.NRML.title, [
        messages.shared.READY.statusLabel,
      ])

      await logoutUser()
      await loginIndividualCatalyst()
      await validateElement(page, data.MCML.title)
      await page.getByTestId('elements-search-input').fill(data.NRML.title)
      await page.getByTestId('elements-search-input').press('Enter')
      await expect(
        page.getByTestId(`element-item-${data.NRML.title}`)
      ).toBeHidden()
    })

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
      await expectNotAttached(
        page.getByTestId(`archive-element-${data.SCML.title}`)
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
      await openActionMenuByTestId(
        page,
        `actions-element-${data.SCML.title}`,
        `view-activity-log-${data.SCML.title}`
      )
      await expect(
        page.getByTestId(`view-activity-log-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`remove-element-${data.SCML.title}`)
      ).toBeVisible()
      await expectNotAttached(
        page.getByTestId(`archive-element-${data.SCML.title}`)
      )
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
      await openActionMenuByTestId(
        page,
        `actions-element-${data.SCML.title}`,
        `archive-element-${data.SCML.title}`
      )
      await expect(
        page.getByTestId(`view-activity-log-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`share-element-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`delete-element-${data.SCML.title}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`archive-element-${data.SCML.title}`)
      ).toBeVisible()
    })

    test('ADMIN users can archive and restore an element from its action menu', async ({
      page,
      loginInstitutionalCatalyst2,
    }) => {
      await loginInstitutionalCatalyst2()
      await page.getByTestId('elements-search-input').clear()
      await page.getByTestId('elements-search-input').fill(data.SCML.title)
      await page.keyboard.press('Enter')

      const element = page.getByTestId(`element-item-${data.SCML.title}`)
      const archiveSwitch = page.getByTestId('show-archive-switch')
      const archiveBadge = page.getByTestId(`archive-badge-${data.SCML.title}`)
      let archiveAttempted = false

      try {
        await expect(element).toBeVisible()
        archiveAttempted = true
        await chooseActionByTestId(
          page,
          `actions-element-${data.SCML.title}`,
          `archive-element-${data.SCML.title}`
        )
        await expect(
          page.getByText(
            messages.manage.questionPool.elementArchivedSuccessfully
          )
        ).toBeVisible()
        await expect(element).not.toBeAttached()

        await archiveSwitch.click()
        await expect(element).toBeVisible()
        await expect(archiveBadge).toBeVisible()

        await chooseActionByTestId(
          page,
          `actions-element-${data.SCML.title}`,
          `unarchive-element-${data.SCML.title}`
        )
        await expect(
          page.getByText(
            messages.manage.questionPool.elementRestoredSuccessfully
          )
        ).toBeVisible()
        await expect(archiveBadge).not.toBeAttached()
        archiveAttempted = false
      } finally {
        if (archiveAttempted) {
          if ((await archiveSwitch.getAttribute('aria-checked')) !== 'true') {
            await archiveSwitch.click()
          }

          await element.waitFor({ state: 'visible' }).catch(() => undefined)
          if (await archiveBadge.isVisible().catch(() => false)) {
            await chooseActionByTestId(
              page,
              `actions-element-${data.SCML.title}`,
              `unarchive-element-${data.SCML.title}`
            )
            await expect(archiveBadge).not.toBeAttached()
          }
        }

        if ((await archiveSwitch.getAttribute('aria-checked')) === 'true') {
          await archiveSwitch.click()
        }
      }

      await expect(element).toBeVisible()
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
})
