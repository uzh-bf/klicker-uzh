// @ts-nocheck
/**
 * Playwright translation of P-microlearning.
 * Mirrors the original Cypress workflow with native Playwright actions.
 */
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { test } from '../util/fixtures.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import {
  answerCaseStudy,
  assertAsynchronousActivityPoints,
  assertAsynchronousInstancePoints,
  assertNoActivityPoints,
  assertNoInstancePoints,
  createAnswerCollection,
  createContent,
  createFlashcard,
  createMicroLearning,
  createQuestionCS,
  createQuestionFT,
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionNR,
  createQuestionSC,
  createQuestionSE,
  createStacks,
  deleteAnswerCollection,
  deleteElement,
  dragAndDropElement,
  editElement,
  env,
  expectByAssertion,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginInstitutionalCatalyst2,
  loginInstitutionalCatalyst3,
  loginLecturer,
  loginStudent,
  loginStudentPassword,
  logoutUser,
  runTask,
  selectOption,
  setDatetime,
  typeInto,
  validateElement,
  verifyCaseStudyInputs,
} from '../util/workflow.js'

function readFixture(name: string) {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  )
}

async function selectActivityElements(
  page: Page,
  searchTerm: string,
  elementNames: string[]
) {
  await selectOption(page, '[data-cy="pagination-page-size"]', 'all')
  await expect(page.getByTestId('pagination-page-size')).toContainText('All')
  const search = page.getByTestId('elements-search-input')
  await search.fill(searchTerm)
  await page.keyboard.press('Enter')

  for (const elementName of elementNames) {
    const checkbox = page.getByTestId(`element-checkbox-${elementName}`)
    await expect(checkbox).toBeVisible()
    await checkbox.check()
  }
}

let page: Page
const aliases = new Map<string, unknown>()
const data = Object.assign(
  {},
  readFixture('questions.json'),
  readFixture('P-microlearning.json')
)

const startDate1 = getDatetimeValidationString(-2, '10') + ', 12:30'

const endDate1 = getDatetimeValidationString(2, '20') + ', 14:00'

const startDate2 = getDatetimeValidationString(-3, '15') + ', 10:45'

const endDate2 = getDatetimeValidationString(5, '15') + ', 16:00'

const extensionDate = getDatetimeValidationString(8, '15') + ', 18:50'

test.describe.serial('Different microlearning workflows', () => {
  async function answerMicroLearningPreview(data) {
    {
      const __originArgs = { data }
      await page.getByTestId('start-microlearning').click()
      await page.getByTestId('sc-0-answer-option-0').click()
      await expectByAssertion(
        page.getByTestId('student-stack-submit'),
        'be.disabled'
      )
      await page.getByTestId('free-text-input-1').click()
      await typeInto(page.getByTestId('free-text-input-1'), data.FTML.answer)
      await page.getByTestId('student-stack-submit').click()
      await page.getByTestId('student-stack-continue').click()
      await expectByAssertion(
        page.getByTestId('practice-quiz-mark-all-as-read'),
        'be.disabled'
      )
      await page.getByTestId('flashcard-front-0').click()
      await page.getByTestId('flashcard-response-0-No').click()
      await page.getByTestId('flashcard-response-0-Yes').click()
      await expectByAssertion(
        page.getByTestId('practice-quiz-mark-all-as-read'),
        'not.be.disabled'
      )
      await page.getByTestId('read-content-element-1').click()
      await page.getByTestId('student-stack-submit').click()
      await page.getByTestId('sc-0-answer-option-0').click()
      await expectByAssertion(
        page.getByTestId('student-stack-submit'),
        'be.disabled'
      )
      await page.getByTestId('free-text-input-1').click()
      await typeInto(page.getByTestId('free-text-input-1'), data.FTML.answer)
      await page.getByTestId('student-stack-submit').click()
      await page.getByTestId('student-stack-continue').click()
    }
  }

  async function enterValidCompleteInputs(data) {
    await expectByAssertion(
      page.getByTestId('practice-quiz-mark-all-as-read'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), data.NRML.answer)
    await typeInto(page.getByTestId('free-text-input-4'), data.FTML.answer)
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-2"]')
      .click()
    await expect(page.locator('[id="selection-5-field-0"]')).toContainText(
      data.collection.options[2]
    )
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-0"]')
      .click()
    await expect(page.locator('[id="selection-5-field-0"]')).toContainText(
      data.collection.options[0]
    )
    await page.locator('[id="selection-5-field-1"]').click()
    await page
      .locator('[id="react-select-selection-5-field-1-option-0"]')
      .click()
    await expect(page.locator('[id="selection-5-field-1"]')).toContainText(
      data.collection.options[1]
    )
    await page.locator('[id="selection-5-field-2"]').click()
    await page
      .locator('[id="react-select-selection-5-field-2-option-0"]')
      .click()
    await expect(page.locator('[id="selection-5-field-2"]')).toContainText(
      data.collection.options[2]
    )
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
    })
    await page.getByTestId('flashcard-front-7').click()
    await page.getByTestId('flashcard-response-7-No').click()
    await page.getByTestId('flashcard-response-7-Yes').click()
    await page.getByTestId('read-content-element-8').click()
  }

  async function verifyPersistentCompleteInputs(data) {
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-1'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-1'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-2'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-0-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-0-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'have.value',
      data.NRML.answer
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'have.value',
      data.FTML.answer
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'be.disabled'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-0"]')
        .getByText(data.collection.options[0])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-1"]')
        .getByText(data.collection.options[1])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-2"]')
        .getByText(data.collection.options[2])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await verifyCaseStudyInputs(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    await expectByAssertion(
      page.getByTestId('flashcard-response-7-No'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('flashcard-response-7-Partially'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('flashcard-response-7-Yes'),
      'be.disabled'
    )
  }

  async function enterValidPartialInputs(data) {
    await expectByAssertion(
      page.getByTestId('practice-quiz-mark-all-as-read'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), data.NRML.answer)
    await typeInto(page.getByTestId('free-text-input-4'), data.FTML.answer)
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-2"]')
      .click()
    await expect(page.locator('[id="selection-5-field-0"]')).toContainText(
      data.collection.options[2]
    )
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
    })
    await page.getByTestId('flashcard-front-7').click()
    await page.getByTestId('flashcard-response-7-No').click()
    await page.getByTestId('flashcard-response-7-Yes').click()
    await page.getByTestId('read-content-element-8').click()
  }

  async function verifyPersistentPartialInputs(data) {
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-1'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-1'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-2'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-1-answer-option-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-0-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-0-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'have.value',
      data.NRML.answer
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'have.value',
      data.FTML.answer
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'be.disabled'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-0"]')
        .getByText(data.collection.options[2])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-1"]')
        .getByText(messages.shared.questions.seSelectOption)
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-2"]')
        .getByText(messages.shared.questions.seSelectOption)
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await verifyCaseStudyInputs(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    await expectByAssertion(
      page.getByTestId('flashcard-response-7-No'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('flashcard-response-7-Partially'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('flashcard-response-7-Yes'),
      'be.disabled'
    )
  }

  async function verifyMicroLearningDetailsModalContent(
    activityName: string,
    data: any
  ) {
    await page.getByTestId(`activity-name-${activityName}`).click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.MCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.KPML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      data.NRML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      data.SEML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      data.CSML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-7')).toContainText(
      data.CT.title.substring(0, 20)
    )
    await page.getByTestId('close-activity-details-modal').click()
  }

  async function verifyMicroLearningOwnerPermissions(data: any) {
    await expectByAssertion(
      page.getByTestId(`publish-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`end-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`extend-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro4}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `convert-microlearning-${data.sharing.micro4}-to-practice-quiz`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  async function verifyMicroLearningREADPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginIndividualCatalyst(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro4}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-analytics-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  async function verifyMicroLearningEXECUTEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginInstitutionalCatalyst(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`end-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`extend-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro4}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-analytics-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  async function verifyMicroLearningWRITEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginInstitutionalCatalyst2(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`change-activity-name-${data.sharing.micro4}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`publish-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`end-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`extend-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro4}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-analytics-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  async function verifyMicroLearningADMINPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginInstitutionalCatalyst3(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`change-activity-name-${data.sharing.micro4}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`publish-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)
    await expectByAssertion(
      page.getByTestId(`copy-microlearning-link-${data.sharing.micro3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`end-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`extend-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.sharing.micro4}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`duplicate-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(
        `convert-microlearning-${data.sharing.micro4}-to-practice-quiz`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-microlearning-${data.sharing.micro4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-microlearning-${data.sharing.micro4}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  async function verifyREADPermissionsRevoked(data: any) {
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyEXECUTEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyWRITEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyADMINPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst3(page)
    for (const [__index, element] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    const quizzes = [
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'not.exist'
      )
    }
  }

  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Create questions required for microlearning creation', async ({
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
    await createQuestionMC(page, {
      name: data.MCML.title,
      content: data.MCML.content,
      choices: data.MCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML.title,
      content: data.KPML.content,
      choices: data.KPML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML.title,
      content: data.NRML.content,
      ...data.NRML.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML.title,
      content: data.FTML.content,
      ...data.FTML.options,
      userId: env('LECTURER_ID'),
    })
    await createFlashcard(page, {
      name: data.FC.title,
      content: data.FC.content,
      explanation: data.FC.explanation,
      userId: env('LECTURER_ID'),
    })
    await createContent(page, {
      name: data.CT.title,
      content: data.CT.content,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expectByAssertion(
      page.getByTestId('create-answer-collection'),
      'exist'
    )
    await createAnswerCollection(page, {
      name: data.collection.name,
      description: data.collection.description,
      entries: data.collection.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.SEML.title,
      content: data.SEML.content,
      numberOfInputs: data.SEML.inputs,
      collectionName: data.collection.name,
      correctAnswers: data.collection.options.filter((_, i) =>
        data.SEML.solutions.includes(i)
      ),
      userId: env('LECTURER_ID'),
    })
    await createQuestionCS(page, {
      name: data.CSML.title,
      content: data.CSML.content,
      explanation: data.CSML.explanation,
      collectionName: data.collection.name,
      selectedItems: data.collection.options.filter((_, i) =>
        data.CSML.selectedItems.includes(i)
      ),
      criteria: data.CSML.criteria,
      cases: data.CSML.cases,
      solutions: data.CSML.solutions,
      userId: env('LECTURER_ID'),
    })
  })

  test('Create a microlearning around the current time', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('create-microlearning').click()
    await page.getByTestId('cancel-activity-creation').click()
    await page.getByTestId('create-microlearning').click()
    await page.getByTestId('insert-microlearning-name').click()
    await typeInto(
      page.getByTestId('insert-microlearning-name'),
      data.running.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-microlearning-display-name').click()
    await typeInto(
      page.getByTestId('insert-microlearning-display-name'),
      data.running.displayName
    )
    await page.getByTestId('insert-microlearning-description').click()
    await typeInto(
      page.getByTestId('insert-microlearning-description'),
      data.running.description
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(page, '[data-cy="select-course"]', data.course)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await setDatetime(page, {
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: -3,
        day: 10,
        hour: 12,
        minute: 30,
        validation: startDate1,
      },
    })
    await setDatetime(page, {
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: 1,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
    })
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier1
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier2}`
      )
      .click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')

    await selectActivityElements(page, data.SCML.title, [data.SCML.title])
    await expect(page.getByTestId('add-selection-to-one-stack')).toHaveText(
      'Add 1 stack with 1 element'
    )
    await expect(
      page.getByTestId('create-one-stack-per-selected-element')
    ).toHaveText('Add 1 stack with 1 element')
    await expect(
      page.getByTestId('add-selection-to-existing-container')
    ).toHaveText('Add 1 element')
    await page.getByTestId('add-selection-to-existing-container').click()
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await page.getByTestId('remove-element-0-stack-0').click()

    await selectActivityElements(page, 'Title Test 2 (Version 1)', [
      data.SCML.title,
      data.FTML.title,
    ])
    await expect(page.getByTestId('add-selection-to-one-stack')).toHaveText(
      'Add 1 stack with 2 elements'
    )
    await expect(
      page.getByTestId('create-one-stack-per-selected-element')
    ).toHaveText('Add 2 stacks with 1 element each')
    await expect(
      page.getByTestId('add-selection-to-existing-container').first()
    ).toHaveText('Add 2 elements')
    await page.getByTestId('add-selection-to-one-stack').click()
    await expect(page.getByTestId('stack-container-header')).toHaveCount(2)
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await page.getByTestId('delete-stack').last().click()
    await expect(page.getByTestId('stack-container-header')).toHaveCount(1)

    await selectActivityElements(page, 'Title Test 2 (Version 1)', [
      data.SCML.title,
      data.FTML.title,
    ])
    await page.getByTestId('create-one-stack-per-selected-element').click()
    await expect(page.getByTestId('stack-container-header')).toHaveCount(3)
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-2')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await page.getByTestId('delete-stack').last().click()
    await page.getByTestId('delete-stack').last().click()
    await expect(page.getByTestId('stack-container-header')).toHaveCount(1)

    await createStacks(page, {
      stacks: [
        // FT questions should also be accepted without sample solution
        { elements: [data.SCML.title, data.FTML.title] },
        { elements: [data.FC.title, data.CT.title] },
      ],
    })
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await dragAndDropElement(page, {
      element: data.SC.title,
      target: 'drop-elements-stack-1',
    })
    await expect(page.getByTestId('element-2-stack-1')).toContainText(
      data.SC.title
    )
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')
    await page.getByTestId('remove-element-2-stack-1').click()
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('open-stack-0-description').click()
    await page.getByTestId('stack-0-displayname').click()
    await typeInto(page.getByTestId('stack-0-displayname'), data.stack.title1)
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title1
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click()
    await page.getByTestId('stack-1-displayname').click()
    await typeInto(page.getByTestId('stack-1-displayname'), data.stack.title2)
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title2
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('move-stack-0-right').click()
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      data.CT.title
    )
    await page.getByTestId('open-stack-0-description').click()
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title2
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click()
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title1
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('move-stack-1-left').click()
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.CT.title
    )
    await page.getByTestId('open-stack-0-description').click()
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title1
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click()
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title2
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('move-element-0-stack-1-down').click()
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.CT.title
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.FC.title
    )
    await page.getByTestId('move-element-1-stack-1-up').click()
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.CT.title
    )
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
  })

  test('Edit the running microlearnings content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.name}`)
      .click()
    await page.getByTestId(`edit-microlearning-${data.running.name}`).click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await page.getByTestId('insert-microlearning-name').click()
    await expectByAssertion(
      page.getByTestId('insert-microlearning-name'),
      'have.value',
      data.running.name
    )
    await page.getByTestId('insert-microlearning-name').click()
    await page.getByTestId('insert-microlearning-name').clear()
    await typeInto(
      page.getByTestId('insert-microlearning-name'),
      data.running.nameNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-microlearning-display-name').click()
    await expectByAssertion(
      page.getByTestId('insert-microlearning-display-name'),
      'have.value',
      data.running.displayName
    )
    await page.getByTestId('insert-microlearning-display-name').click()
    await page.getByTestId('insert-microlearning-display-name').clear()
    await typeInto(
      page.getByTestId('insert-microlearning-display-name'),
      data.running.displayNameNew
    )
    await expect(
      page.getByTestId('insert-microlearning-description')
    ).toContainText(data.running.description)
    await page.getByTestId('insert-microlearning-description').click()
    await page.getByTestId('insert-microlearning-description').clear()
    await typeInto(
      page.getByTestId('insert-microlearning-description'),
      data.running.descriptionNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await setDatetime(page, {
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: -1,
        day: 15,
        hour: 10,
        minute: 45,
        validation: startDate2,
      },
    })
    await setDatetime(page, {
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: 3,
        day: 15,
        hour: 16,
        minute: 0,
        validation: endDate2,
      },
    })
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier4}`
      )
      .click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    const addQuestions = [data.SCML.title, data.FTML.title]
    await page.getByTestId('drop-elements-add-stack').click()
    for (const [ix, element] of Array.from(addQuestions).entries()) {
      await dragAndDropElement(page, {
        element,
        target: `drop-elements-stack-2`,
      })
      await expect(page.getByTestId(`element-${ix}-stack-2`)).toContainText(
        element
      )
    }
    await page.getByTestId('open-stack-0-description').click()
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title1
    )
    await page.getByTestId('stack-0-displayname').click()
    await page.getByTestId('stack-0-displayname').clear()
    await typeInto(
      page.getByTestId('stack-0-displayname'),
      data.stack.title1New
    )
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title1New
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click()
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title2
    )
    await page.getByTestId('stack-1-displayname').click()
    await page.getByTestId('stack-1-displayname').clear()
    await typeInto(
      page.getByTestId('stack-1-displayname'),
      data.stack.title2New
    )
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title2New
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.running.nameNew}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.nameNew}-DRAFT`),
      'exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page.getByTestId(`edit-microlearning-${data.running.nameNew}`).click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await page.getByTestId('insert-microlearning-name').click()
    await expectByAssertion(
      page.getByTestId('insert-microlearning-name'),
      'have.value',
      data.running.nameNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-microlearning-display-name').click()
    await expectByAssertion(
      page.getByTestId('insert-microlearning-display-name'),
      'have.value',
      data.running.displayNameNew
    )
    await expect(
      page.getByTestId('insert-microlearning-description')
    ).toContainText(data.running.descriptionNew)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('select-start-date'),
      'contain',
      startDate2
    )
    await expectByAssertion(
      page.getByTestId('select-end-date'),
      'contain',
      endDate2
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.CT.title
    )
    await expect(page.getByTestId('element-0-stack-2')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('element-1-stack-2')).toContainText(
      data.FTML.title
    )
    await page.getByTestId('open-stack-0-description').click()
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title1New
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click()
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title2New
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.running.nameNew}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.nameNew}-DRAFT`),
      'exist'
    )
  })

  test('Duplicate a microlearning and check the editors content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`duplicate-microlearning-${data.running.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByText('Create ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await page.getByTestId('insert-microlearning-name').click()
    await expectByAssertion(
      page.getByTestId('insert-microlearning-name'),
      'have.value',
      data.duplication.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-microlearning-display-name').click()
    await expectByAssertion(
      page.getByTestId('insert-microlearning-display-name'),
      'have.value',
      data.running.displayNameNew
    )
    await page.getByTestId('insert-microlearning-display-name').click()
    await page.getByTestId('insert-microlearning-display-name').clear()
    await typeInto(
      page.getByTestId('insert-microlearning-display-name'),
      data.duplication.displayName
    )
    await expect(
      page.getByTestId('insert-microlearning-description')
    ).toContainText(data.running.descriptionNew)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(page, '[data-cy="select-course"]', data.course)
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await expectByAssertion(
      page.getByTestId('select-start-date'),
      'contain',
      startDate2
    )
    await expectByAssertion(
      page.getByTestId('select-end-date'),
      'contain',
      endDate2
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.CT.title
    )
    await expect(page.getByTestId('element-0-stack-2')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('element-1-stack-2')).toContainText(
      data.FTML.title
    )
    await page.getByTestId('open-stack-0-description').click()
    await expectByAssertion(
      page.getByTestId('stack-0-displayname'),
      'have.value',
      data.stack.title1New
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('open-stack-1-description').click()
    await expectByAssertion(
      page.getByTestId('stack-1-displayname'),
      'have.value',
      data.stack.title2New
    )
    await page.getByTestId('close-stack-description').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.duplication.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.duplication.name}-DRAFT`),
      'exist'
    )
  })

  test('Create a microlearning that starts in the future', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createMicroLearning(page, {
      name: data.future.name,
      displayName: data.future.displayName,
      description: data.future.description,
      courseName: data.course,
      multiplier: messages.manage.activityWizard.multiplier2,
      startDate: {
        monthDelta: 3,
        day: 11,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(3, '11') + ', 02:00',
      }, // 3 months in the future at 2:00
      endDate: {
        monthDelta: 7,
        day: 20,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(7, '20') + ', 18:00',
      }, // 7 months in the future at 18:00
      stacks: [{ elements: [data.SCML.title] }],
    })
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.future.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.future.name}-DRAFT`),
      'exist'
    )
  })

  test('Create a microlearning with all element types', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createMicroLearning(page, {
      name: data.completed.name,
      displayName: data.completed.displayName,
      courseName: data.course,
      startDate: {
        monthDelta: -2,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      stacks: [
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.KPML.title,
            data.NRML.title,
            data.FTML.title,
            data.SEML.title,
            data.CSML.title,
            data.FC.title,
            data.CT.title,
          ],
        },
      ],
    })
  })

  test('Check if the drafted microlearning can be accessed by the lecturer through the activity preview', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const quiz = await runTask('getMicroLearningInfo', {
        mlName: data.running.nameNew,
      })
      if (quiz === null) {
        throw new Error('Microlearning not found')
      }
      await page.goto(
        `${env('URL_STUDENT')}/course/${quiz.courseId}/microLearnings/${quiz.id}`,
        { waitUntil: 'commit' }
      )
      await answerMicroLearningPreview(data)
    }
  })

  test('Publish a microlearning that will be running immediately', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`publish-microlearning-${data.running.nameNew}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`status-${data.running.nameNew}-PUBLISHED`),
      'exist'
    )
  })

  test('Check if the running microlearning can be accessed by the lecturer through the activity preview', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const quiz = await runTask('getMicroLearningInfo', {
        mlName: data.running.nameNew,
      })
      if (quiz === null) {
        throw new Error('Microlearning not found')
      }
      await page.goto(
        `${env('URL_STUDENT')}/course/${quiz.courseId}/microLearnings/${quiz.id}`,
        { waitUntil: 'commit' }
      )
      await answerMicroLearningPreview(data)
    }
  })

  test('Extend the running microlearning', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`extend-microlearning-${data.running.nameNew}`)
      .click()
    await page.getByTestId('extend-activity-cancel').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`extend-microlearning-${data.running.nameNew}`)
      .click()
    await setDatetime(page, {
      cyString: 'extend-activity-date',
      deselectorString: 'extension-modal-description',
      datetime: {
        monthDelta: 3,
        day: 15,
        hour: 18,
        minute: 50,
        validation: extensionDate,
      },
    })
    await page.getByTestId('extend-activity-confirm').click()
    await page.waitForTimeout(1000)
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`extend-microlearning-${data.running.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId('extend-activity-confirm'),
      'not.be.disabled'
    )
    await setDatetime(page, {
      cyString: 'extend-activity-date',
      deselectorString: 'extension-modal-description',
      datetime: {
        monthDelta: -12,
        day: 15,
        hour: 12,
        minute: 0,
        validation: getDatetimeValidationString(-4, '15') + ', 12:00',
      },
    })
    await expectByAssertion(
      page.getByTestId('extend-activity-confirm'),
      'be.disabled'
    )
    await page.getByTestId('extend-activity-cancel').click()
  })

  test('Respond to the first stack of the running microlearning from a laptop', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page
      .getByTestId(`microlearning-${data.running.displayNameNew}`)
      .click()
    await page.getByTestId('start-microlearning').click()
    await page.getByTestId('sc-0-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('free-text-input-1').click()
    await typeInto(page.getByTestId('free-text-input-1'), 'Free text answer')
    await page.getByTestId('student-stack-submit').click()
  })

  test("Check that the student's previous response is correctly loaded (despite cookie reset) and respond to the second stack", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    await page.evaluate(() => sessionStorage.clear()).catch(() => undefined)
    await loginStudent(page)
    await page
      .getByTestId(`microlearning-${data.running.displayNameNew}`)
      .click()
    await page.getByTestId('start-microlearning').click()
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-1'),
      'have.value',
      'Free text answer'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(
      page.getByTestId('practice-quiz-mark-all-as-read'),
      'be.disabled'
    )
    await page.getByTestId('flashcard-front-0').click()
    await page.getByTestId('flashcard-response-0-No').click()
    await page.getByTestId('flashcard-response-0-Yes').click()
    await expectByAssertion(
      page.getByTestId('practice-quiz-mark-all-as-read'),
      'not.be.disabled'
    )
    await page.getByTestId('read-content-element-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('sc-0-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('free-text-input-1').click()
    await typeInto(page.getByTestId('free-text-input-1'), 'Free text answer 2')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('finish-microlearning').click()
    await page.waitForTimeout(1000)
    await expectByAssertion(
      page.getByTestId(`microlearning-${data.running.displayNameNew}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`microlearning-${data.running.displayNameNew}`),
      'be.disabled'
    )
  })

  test('End the running microlearning', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await page.setViewportSize({ width: 1536, height: 960 })
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page.getByTestId(`end-microlearning-${data.running.nameNew}`).click()
    await expectByAssertion(
      page.getByTestId(`confirm-responses-microlearning`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirm-anonymous-responses-microlearning`),
      'not.exist'
    )
    await page.getByTestId(`confirmation-modal-cancel`).click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page.getByTestId(`end-microlearning-${data.running.nameNew}`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
  })

  test('Check that the microlearning is no longer visible to the student that submitted answers', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await expectByAssertion(
      page.getByTestId(`microlearning-${data.running.displayNameNew}`),
      'not.exist'
    )
  })

  test("Check that other students can't see the microlearning", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await expectByAssertion(
      page.getByTestId(`microlearning-${data.running.displayNameNew}`),
      'not.exist'
    )
  })

  test('Cleanup: Delete the running microlearning to avoid name collisions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${data.running.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'be.disabled'
    )
    await page.getByTestId(`confirm-deletion-responses`).click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'not.be.disabled'
    )
    await page.getByTestId(`confirmation-modal-cancel`).click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${data.running.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'be.disabled'
    )
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.running.nameNew}`),
      'not.exist'
    )
  })

  test('Cleanup: Delete the duplicated microlearning to avoid name collisions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.duplication.name}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${data.duplication.name}`)
      .click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.duplication.name}`),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted microlearning (with results) directly in database', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedMicrolearning', {
        mlName: data.running.nameNew,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted microlearning with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Publish the future microlearning', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`publish-microlearning-${data.future.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`status-${data.future.name}-SCHEDULED`),
      'exist'
    )
  })

  test('Verify that future microlearnings are not shown to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await expectByAssertion(
      page.getByTestId(`microlearning-${data.future.displayName}`),
      'not.exist'
    )
  })

  test('Check that a scheduled microlearning can be accessed through the activity preview', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const quiz = await runTask('getMicroLearningInfo', {
        mlName: data.future.name,
      })
      if (quiz === null) {
        throw new Error('Microlearning not found')
      }
      await page.goto(
        `${env('URL_STUDENT')}/course/${quiz.courseId}/microLearnings/${quiz.id}`,
        { waitUntil: 'commit' }
      )
      {
        await expectByAssertion(
          page.getByTestId('start-microlearning'),
          'exist'
        )
      }
    }
  })

  test('Unpublish the future microlearning from the lecturer view', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`actions-MICRO_LEARNING-${data.future.name}`).click()
    await page
      .getByTestId(`unpublish-microlearning-${data.future.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`status-${data.future.name}-DRAFT`),
      'exist'
    )
  })

  test('Cleanup: Delete the future microlearning to avoid name collisions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`actions-MICRO_LEARNING-${data.future.name}`).click()
    await page.getByTestId(`delete-microlearning-${data.future.name}`).click()
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-responses`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-anonymous-responses`),
      'not.exist'
    )
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.future.name}`),
      'not.exist'
    )
  })

  test('Publish the microlearning that contains all question types', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`publish-microlearning-${data.completed.name}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`status-${data.completed.name}-PUBLISHED`),
      'exist'
    )
  })

  test('Respond to all questions in the microlearning covering all element types', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page
      .getByTestId(`microlearning-${data.completed.displayName}`)
      .click()
    await page.getByTestId('start-microlearning').click()
    await enterValidCompleteInputs(data)
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-1').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), '-20')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), '10.45')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), '100')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('input-numerical-3').clear()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('input-numerical-3'), data.NRML.answer)
    await page.getByTestId('free-text-input-4').clear()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('free-text-input-4'), data.FTML.answer)
    await page.getByTestId('student-stack-submit').click()
    await page.waitForTimeout(500)
    await verifyPersistentCompleteInputs(data)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await verifyPersistentCompleteInputs(data)
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    await page.evaluate(() => sessionStorage.clear()).catch(() => undefined)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    await verifyPersistentCompleteInputs(data)
    await page
      .getByTestId('student-stack-continue')
      .getByText(messages.shared.generic.finish)
      .first()
      .click()
  })

  test('Answer to the microlearning with partial responses (where supported)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page
      .getByTestId(`microlearning-${data.completed.displayName}`)
      .click()
    await page.getByTestId('start-microlearning').click()
    await enterValidPartialInputs(data)
    await page.getByTestId('student-stack-submit').click()
    await page.waitForTimeout(500)
    await verifyPersistentPartialInputs(data)
    await page
      .getByTestId('student-stack-continue')
      .getByText(messages.shared.generic.finish)
      .first()
      .click()
  })

  test('Cleanup: Delete the complete microlearning to avoid naming collisions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.completed.name}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${data.completed.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'be.disabled'
    )
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.completed.name}`),
      'not.exist'
    )
  })

  test('Make sure that the complete microlearning is no longer visible to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await expectByAssertion(
      page.getByTestId(`microlearning-${data.completed.displayName}`),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted microlearning (with results) directly in database [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedMicrolearning', {
        mlName: data.completed.name,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted microlearning with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Convert the a past microlearning into a practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    const MLName = 'Microlearning for conversion'
    const MLDisplayName = 'Microlearning for conversion (display name)'
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML.title,
      content: data.MCML.content,
      choices: data.MCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML.title,
      content: data.KPML.content,
      choices: data.KPML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML.title,
      content: data.NRML.content,
      ...data.NRML.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML.title,
      content: data.FTML.content,
      ...data.FTML.options,
      userId: env('LECTURER_ID'),
    })
    await createFlashcard(page, {
      name: data.FC.title,
      content: data.FC.content,
      explanation: data.FC.explanation,
      userId: env('LECTURER_ID'),
    })
    await createMicroLearning(page, {
      name: MLName,
      displayName: MLDisplayName,
      courseName: data.course,
      startDate: {
        monthDelta: -2,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      stacks: [
        { elements: [data.SCML.title, data.MCML.title] },
        { elements: [data.KPML.title, data.NRML.title] },
        { elements: [data.FTML.title] },
        { elements: [data.FC.title] },
      ],
    })
    await page.waitForTimeout(1000)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`publish-microlearning-${MLName}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${MLName}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${MLName}-PUBLISHED`),
      'exist'
    )
    await page.getByTestId(`actions-MICRO_LEARNING-${MLName}`).click()
    await page.getByTestId(`end-microlearning-${MLName}`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await page.getByTestId(`actions-MICRO_LEARNING-${MLName}`).click()
    await page
      .getByTestId(`convert-microlearning-${MLName}-to-practice-quiz`)
      .click()
    await page.getByTestId('insert-practice-quiz-name').click()
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'have.value',
      `${MLName} (converted)`
    )
    await page.getByTestId('insert-practice-quiz-name').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-name'),
      data.conversion.pqName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-practice-quiz-display-name').click()
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
      'have.value',
      MLDisplayName
    )
    await page.getByTestId('insert-practice-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-display-name'),
      data.conversion.pqDisplayName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(page, '[data-cy="select-course"]', data.course)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier1
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier2}`
      )
      .click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('insert-reset-time-days').clear()
    await typeInto(page.getByTestId('insert-reset-time-days'), '4')
    await expectByAssertion(page.getByTestId('select-order'), 'exist')
    await expect(page.getByTestId('select-order')).toContainText(
      messages.manage.activityWizard.practiceQuizSPACED_REPETITION
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('move-stack-1-left'), 'exist')
    await page.getByTestId('move-stack-1-left').click()
    await expectByAssertion(page.getByTestId('move-stack-1-right'), 'exist')
    await page.getByTestId('move-stack-1-right').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.conversion.pqName}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.conversion.pqName}-DRAFT`),
      'exist'
    )
  })

  test('Create a microlearning with a selection question', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.collection2.name,
      description: data.collection2.description,
      entries: data.collection2.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.SEML2.title,
      content: data.SEML2.content,
      numberOfInputs: data.SEML2.inputs,
      collectionName: data.collection2.name,
      correctAnswers: data.collection2.options.filter((_, i) =>
        data.SEML2.solutions.includes(i)
      ),
      userId: env('LECTURER_ID'),
    })
    await createMicroLearning(page, {
      name: data.manipulation.name,
      displayName: data.manipulation.displayName,
      startDate: {
        monthDelta: -2,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      courseName: data.manipulation.course,
      stacks: [{ elements: [data.SEML2.title] }],
    })
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-DRAFT`),
      'exist'
    )
  })

  test('Edit the selection question and edit & save the microlearning without making any changes', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await editElement(page, { element: data.SEML2.title })
    await page.getByTestId('instance-update-switch').click()
    await page.getByTestId('insert-question-title').clear()
    await typeInto(
      page.getByTestId('insert-question-title'),
      data.manipulation.newSETitle
    )
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await typeInto(
      page.getByTestId('insert-question-text'),
      data.manipulation.newSEContent
    )
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(1000)
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`edit-microlearning-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-microlearning-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-microlearning-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-stack-0'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-DRAFT`),
      'exist'
    )
  })

  test('Add both the edited selection question and a new case study element to the microlearning', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionCS(page, {
      name: data.CSML2.title,
      content: data.CSML2.content,
      explanation: data.CSML2.explanation,
      collectionName: data.collection2.name,
      selectedItems: data.collection2.options.filter((_, i) =>
        data.CSML2.selectedItems.includes(i)
      ),
      criteria: data.CSML2.criteria,
      cases: data.CSML2.cases,
      solutions: data.CSML2.solutions,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`edit-microlearning-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-microlearning-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-microlearning-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await dragAndDropElement(page, {
      element: data.manipulation.newSETitle,
      target: 'drop-elements-stack-0',
    })
    await expect(page.getByTestId(`element-1-stack-0`)).toContainText(
      data.manipulation.newSETitle.substring(0, 20)
    )
    await page.getByTestId(`drop-elements-add-stack`).click()
    await dragAndDropElement(page, {
      element: data.CSML2.title,
      target: 'drop-elements-stack-1',
    })
    await expect(page.getByTestId(`element-0-stack-1`)).toContainText(
      data.CSML2.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-DRAFT`),
      'exist'
    )
  })

  test('Delete the selection and case study elements in the library, as well as the associated answer collection, re-order the stacks on the microlearning and publish it', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await deleteElement(page, { elementName: data.manipulation.newSETitle })
    await page.waitForTimeout(500)
    await deleteElement(page, { elementName: data.CSML2.title })
    await page.waitForTimeout(500)
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await deleteAnswerCollection(page, {
      collectionName: data.collection2.name,
    })
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`edit-microlearning-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-microlearning-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-microlearning-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SEML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-0')).toContainText(
      data.manipulation.newSETitle.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.CSML2.title.substring(0, 20)
    )
    await page.getByTestId('move-stack-0-right').click()
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.CSML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.SEML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.manipulation.newSETitle.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-DRAFT`),
      'exist'
    )
    await page
      .getByTestId(`publish-microlearning-${data.manipulation.name}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-PUBLISHED`),
      'exist'
    )
  })

  test('Respond to the elements in the published microlearning and verify their content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page
      .getByTestId(`microlearning-${data.manipulation.displayName}`)
      .click()
    await page.getByTestId('start-microlearning').click()
    await expectByAssertion(page.getByText(data.CSML2.content).first(), 'exist')
    await answerCaseStudy(page, {
      elementIx: 0,
      answers: data.CSML2.answers,
      criteria: data.CSML2.criteria,
    })
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.SEML2.content).first(), 'exist')
    await page.locator('[id="selection-0-field-0"]').click()
    await page
      .locator('[id="react-select-selection-0-field-0-option-2"]')
      .click()
    await expect(page.locator('[id="selection-0-field-0"]')).toContainText(
      data.collection2.options[2]
    )
    await page.locator('[id="selection-0-field-2"]').click()
    await page
      .locator('[id="react-select-selection-0-field-2-option-0"]')
      .click()
    await expect(page.locator('[id="selection-0-field-2"]')).toContainText(
      data.collection2.options[0]
    )
    await expectByAssertion(
      page.getByText(data.manipulation.newSEContent).first(),
      'exist'
    )
    await page.locator('[id="selection-1-field-0"]').click()
    await page
      .locator('[id="react-select-selection-1-field-0-option-2"]')
      .click()
    await expect(page.locator('[id="selection-1-field-0"]')).toContainText(
      data.collection2.options[2]
    )
    await page.locator('[id="selection-1-field-2"]').click()
    await page
      .locator('[id="react-select-selection-1-field-2-option-0"]')
      .click()
    await expect(page.locator('[id="selection-1-field-2"]')).toContainText(
      data.collection2.options[0]
    )
    await page.getByTestId('student-stack-submit').click()
  })

  test('Duplicate the microlearning, verify that the elements shown in the editor are the same as in the original microlearning, and publish it', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`duplicate-microlearning-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Create ' + messages.shared.generic.microlearning).first(),
      'exist'
    )
    await page.getByTestId('insert-microlearning-name').clear()
    await typeInto(
      page.getByTestId('insert-microlearning-name'),
      data.manipulation.duplicateName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-microlearning-display-name').clear()
    await typeInto(
      page.getByTestId('insert-microlearning-display-name'),
      data.manipulation.duplicateDisplayName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(
      page,
      '[data-cy="select-course"]',
      data.manipulation.course
    )
    await expect(page.getByTestId('select-course')).toContainText(
      data.manipulation.course
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.CSML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.SEML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.manipulation.newSETitle.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await expectByAssertion(
      page.getByTestId(
        `activity-MICRO_LEARNING-${data.manipulation.duplicateName}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.duplicateName}-DRAFT`),
      'exist'
    )
    await page
      .getByTestId(`publish-microlearning-${data.manipulation.duplicateName}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(
        `activity-MICRO_LEARNING-${data.manipulation.duplicateName}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.duplicateName}-PUBLISHED`),
      'exist'
    )
  })

  test('Respond to the elements in the duplicated microlearning and verify their content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page
      .getByTestId(`microlearning-${data.manipulation.duplicateDisplayName}`)
      .click()
    await page.getByTestId('start-microlearning').click()
    await expectByAssertion(page.getByText(data.CSML2.content).first(), 'exist')
    await answerCaseStudy(page, {
      elementIx: 0,
      answers: data.CSML2.answers,
      criteria: data.CSML2.criteria,
    })
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.SEML2.content).first(), 'exist')
    await page.locator('[id="selection-0-field-0"]').click()
    await page
      .locator('[id="react-select-selection-0-field-0-option-2"]')
      .click()
    await expect(page.locator('[id="selection-0-field-0"]')).toContainText(
      data.collection2.options[2]
    )
    await page.locator('[id="selection-0-field-2"]').click()
    await page
      .locator('[id="react-select-selection-0-field-2-option-0"]')
      .click()
    await expect(page.locator('[id="selection-0-field-2"]')).toContainText(
      data.collection2.options[0]
    )
    await expectByAssertion(
      page.getByText(data.manipulation.newSEContent).first(),
      'exist'
    )
    await page.locator('[id="selection-1-field-0"]').click()
    await page
      .locator('[id="react-select-selection-1-field-0-option-2"]')
      .click()
    await expect(page.locator('[id="selection-1-field-0"]')).toContainText(
      data.collection2.options[2]
    )
    await page.locator('[id="selection-1-field-2"]').click()
    await page
      .locator('[id="react-select-selection-1-field-2-option-0"]')
      .click()
    await expect(page.locator('[id="selection-1-field-2"]')).toContainText(
      data.collection2.options[0]
    )
    await page.getByTestId('student-stack-submit').click()
  })

  test('Delete both microlearnings to avoid naming collisions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-microLearnings').click()
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${data.manipulation.name}`)
      .click()
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.manipulation.name}`),
      'not.exist'
    )
    await page
      .getByTestId(`actions-MICRO_LEARNING-${data.manipulation.duplicateName}`)
      .click()
    await page
      .getByTestId(`delete-microlearning-${data.manipulation.duplicateName}`)
      .click()
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId(
        `activity-MICRO_LEARNING-${data.manipulation.duplicateName}`
      ),
      'not.exist'
    )
  })

  test('Create four different microlearnings and make sure that all required actions are shown to the object owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    for (let i = 1; i <= 4; i++) {
      await createMicroLearning(page, {
        name: data.sharing[`micro${i}`],
        displayName: data.sharing[`micro${i}Display`],
        courseName: data.seededCourse,
        startDate: {
          monthDelta: -2,
          day: 16,
          hour: 2,
          minute: 0,
          validation: getDatetimeValidationString(-2, '16') + ', 02:00',
        }, // 2 months in the past at 2:00
        endDate: {
          monthDelta: 4,
          day: 14,
          hour: 18,
          minute: 0,
          validation: getDatetimeValidationString(4, '14') + ', 18:00',
        }, // 4 months in the future at 18:00
        stacks: [
          {
            elements: [
              data.SCML.title,
              data.MCML.title,
              data.KPML.title,
              data.NRML.title,
              data.FTML.title,
              data.SEML.title,
              data.CSML.title,
              data.CT.title,
            ],
          },
        ],
      })
      await page.getByTestId('create-new-activity').click()
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.micro2,
        activityType: 'MICRO_LEARNING',
        status: 'SCHEDULED',
      })
      if (result === false) {
        throw new Error(
          'Microlearning to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.micro3,
        activityType: 'MICRO_LEARNING',
        status: 'PUBLISHED',
      })
      if (result === false) {
        throw new Error(
          'Microlearning to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.micro4,
        activityType: 'MICRO_LEARNING',
        status: 'ENDED',
      })
      if (result === false) {
        throw new Error(
          'Microlearning to change status was not found in the database'
        )
      }
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('activities').click()
    await verifyMicroLearningOwnerPermissions(data)
  })

  test('Share the microlearnings individual with different users and different permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_IND_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsREAD)
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
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_INST_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsEXECUTE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_INST_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsEXECUTE })
          .first()
      ).toBeAttached()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_INST2_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_INST2_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_INST3_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsADMIN)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_INST3_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_INST3_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Log in as the user with READ permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningREADPermissions(data, false)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningEXECUTEPermissions(data, false)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningWRITEPermissions(data, false)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningADMINPermissions(data, false)
  })

  test('Revoke the direct individual permissions for all users through the activity owner account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    const quizzes = [
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]
    const users = [
      env('LECTURER_IND_SHORTNAME'),
      env('LECTURER_INST_SHORTNAME'),
      env('LECTURER_INST2_SHORTNAME'),
      env('LECTURER_INST3_SHORTNAME'),
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      for (const [__index, user] of Array.from(users).entries()) {
        await expectByAssertion(page.getByTestId(`permission-${user}`), 'exist')
        await page.getByTestId(`revoke-permission-${user}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expectByAssertion(
          page.getByTestId(`permission-${user}`),
          'not.exist'
        )
      }
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Verify that user with previous READ permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyREADPermissionsRevoked(data)
  })

  test('Verify that user with previous EXECUTE permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyEXECUTEPermissionsRevoked(data)
  })

  test('Verify that user with previous WRITE permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyWRITEPermissionsRevoked(data)
  })

  test('Verify that user with previous ADMIN permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyADMINPermissionsRevoked(data)
  })

  test('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the microlearnings with them', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group1)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_IND_SHORTNAME')
    )
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group1}`),
      'exist'
    )
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group2)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_INST_SHORTNAME')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group2}`),
      'exist'
    )
    await loginInstitutionalCatalyst2(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group3)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_EMAIL')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group3}`),
      'exist'
    )
    await loginInstitutionalCatalyst3(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group4)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_EMAIL')
    )
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group4}`),
      'exist'
    )
    await logoutUser(page)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group1
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsREAD)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group1}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group1}`)
          .filter({ hasText: messages.manage.sharing.permissionsREAD })
          .first()
      ).toBeAttached()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group2
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsEXECUTE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group2}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group2}`)
          .filter({ hasText: messages.manage.sharing.permissionsEXECUTE })
          .first()
      ).toBeAttached()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group3
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group3}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group3}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group4
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsADMIN)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group4}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group4}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Log in as the user with READ permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningREADPermissions(data, true)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningEXECUTEPermissions(data, true)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningWRITEPermissions(data, true)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyMicroLearningADMINPermissions(data, true)
  })

  test('Revoke the direct group permissions for all users through the activity owner account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    const quizzes = [
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]
    const groups = [
      data.sharing.group1,
      data.sharing.group2,
      data.sharing.group3,
      data.sharing.group4,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      for (const [__index, group] of Array.from(groups).entries()) {
        await expectByAssertion(
          page.getByTestId(`permission-${group}`),
          'exist'
        )
        await page.getByTestId(`revoke-permission-${group}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expectByAssertion(
          page.getByTestId(`permission-${group}`),
          'not.exist'
        )
      }
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Verify that user with previous READ permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyREADPermissionsRevoked(data)
  })

  test('Verify that user with previous EXECUTE permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyEXECUTEPermissionsRevoked(data)
  })

  test('Verify that user with previous WRITE permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyWRITEPermissionsRevoked(data)
  })

  test('Verify that user with previous ADMIN permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyADMINPermissionsRevoked(data)
  })

  test("Transfer ownership of all microlearnings to user 'pro1' using the username", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_IND_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await page.getByTestId('transfer-ownership').click()
      await typeInto(
        page.getByTestId('new-owner-username-email-input'),
        env('LECTURER_IND_SHORTNAME')
      )
      await page.getByTestId('confirm-ownership-transfer').click()
      await expectByAssertion(
        page.getByTestId('transfer-ownership'),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'not.exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test("Verify that user 'pro1' is the new owner and transfer the ownership back to the main user", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await verifyMicroLearningOwnerPermissions(data)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await page.getByTestId('transfer-ownership').click()
      await typeInto(
        page.getByTestId('new-owner-username-email-input'),
        env('LECTURER_SHORTNAME')
      )
      await page.getByTestId('confirm-ownership-transfer').click()
      await expectByAssertion(
        page.getByTestId('transfer-ownership'),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
        'not.exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test("Remove the shared microlearnings from user 'pro1' using the removal functionality", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`remove-microlearning-${quiz}`).click()
      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`activity-MICRO_LEARNING-${quiz}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId('confirmation-modal-close'),
        'not.exist'
      )
    }
    await logoutUser(page)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).entries()) {
      await page.getByTestId(`actions-MICRO_LEARNING-${quiz}`).click()
      await page.getByTestId(`share-microlearning-${quiz}`).click()
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'not.exist'
      )
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Create a microlearning in a gamified course and validate that points are shown correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createMicroLearning(page, {
      name: data.details.name,
      displayName: data.details.displayName,
      courseName: data.details.courseName,
      multiplier: messages.manage.activityWizard.multiplier2,
      startDate: {
        monthDelta: -2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: startDate1,
      },
      endDate: {
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
      stacks: [
        {
          elements: [data.SCML.title, data.FC.title, data.CT.title],
        },
        {
          elements: [data.MCML.title, data.NRML.title, data.FTML.title],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-MICRO_LEARNING-${data.details.name}`),
      'exist'
    )
    await page.getByTestId(`activity-name-${data.details.name}`).click()
    await assertAsynchronousActivityPoints(page, { totalPoints: 80 })
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('20 P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).toContainText('60 P.')
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.CT.title
    )
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 20,
      stackIx: 0,
      instanceIx: 0,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 1,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 2,
    })
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.FTML.title
    )
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 20,
      stackIx: 1,
      instanceIx: 0,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 20,
      stackIx: 1,
      instanceIx: 1,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 20,
      stackIx: 1,
      instanceIx: 2,
    })
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Create a microlearning in a non-gamified course and validate that no points are shown', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createMicroLearning(page, {
      name: data.details.nameNonGamified,
      displayName: data.details.displayNameNonGamified,
      courseName: data.details.courseNonGamified,
      startDate: {
        monthDelta: -2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: startDate1,
      },
      endDate: {
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
      stacks: [
        {
          elements: [data.SCML.title, data.FC.title, data.CT.title],
        },
        {
          elements: [data.MCML.title, data.NRML.title, data.FTML.title],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(
        `activity-MICRO_LEARNING-${data.details.nameNonGamified}`
      ),
      'exist'
    )
    await page
      .getByTestId(`activity-name-${data.details.nameNonGamified}`)
      .click()
    await assertNoActivityPoints(page)
    await expectByAssertion(
      page.getByTestId('activity-details-stack-header-0'),
      'not.contain',
      '20 P.'
    )
    await expectByAssertion(
      page.getByTestId('activity-details-stack-header-1'),
      'not.contain',
      '60 P.'
    )
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.FC.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.CT.title
    )
    await assertNoInstancePoints(page, { stackIx: 0, instanceIx: 0 })
    await assertNoInstancePoints(page, { stackIx: 0, instanceIx: 1 })
    await assertNoInstancePoints(page, { stackIx: 0, instanceIx: 2 })
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.FTML.title
    )
    await assertNoInstancePoints(page, { stackIx: 1, instanceIx: 0 })
    await assertNoInstancePoints(page, { stackIx: 1, instanceIx: 1 })
    await assertNoInstancePoints(page, { stackIx: 1, instanceIx: 2 })
    await page.getByTestId('close-activity-details-modal').click()
  })
})
