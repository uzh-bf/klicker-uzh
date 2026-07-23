// @ts-nocheck
/**
 * Playwright translation of S-group-activity.
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
  createAnswerCollection,
  createContent,
  createGroupActivity,
  createQuestionCS,
  createQuestionFT,
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionNR,
  createQuestionSC,
  createQuestionSE,
  createStacks,
  dragAndDropElement,
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
  readFixture('questions.json'),
  readFixture('S-group-activity.json')
)

const startDate1 = getDatetimeValidationString(2, '10') + ', 12:30'

const endDate1 = getDatetimeValidationString(3, '20') + ', 14:00'

const runningStartDate = getDatetimeValidationString(-1, '10') + ', 12:30'

const runningEndDate = getDatetimeValidationString(2, '20') + ', 14:00'

const extensionDate = getDatetimeValidationString(8, '15') + ', 18:50'

const synchronousStartDate = getDatetimeValidationString(2, '10') + ', 12:30'

const synchronousEndDate = getDatetimeValidationString(3, '20') + ', 14:00'

test.describe.serial('Create and solve a group activity', () => {
  async function answerGroupActivity(data) {
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-correct').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-incorrect').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await typeInto(
      page.getByTestId('input-numerical-3'),
      data.running.answers.numerical
    )
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('free-text-input-4').click()
    await typeInto(
      page.getByTestId('free-text-input-4'),
      data.running.answers.freeText
    )
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-0"]')
      .click()
    await expect(page.locator('[id="selection-5-field-0"]')).toContainText(
      data.collection.options[0]
    )
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await expect(page.locator('[id="selection-5-field-0"]')).toContainText(
      data.collection.options[2]
    )
    await page.locator('[id="selection-5-field-1"]').click()
    await page
      .locator('[id="react-select-selection-5-field-1-option-0"]')
      .click()
    await expect(page.locator('[id="selection-5-field-1"]')).toContainText(
      data.collection.options[0]
    )
    await page.locator('[id="selection-5-field-2"]').click()
    await page
      .locator('[id="react-select-selection-5-field-2-option-1"]')
      .click()
    await expect(page.locator('[id="selection-5-field-2"]')).toContainText(
      data.collection.options[3]
    )
    await page.locator('[id="selection-5-field-2"]').click()
    await page
      .locator('[id="react-select-selection-5-field-2-option-1"]')
      .click()
    await expect(page.locator('[id="selection-5-field-2"]')).toContainText(
      data.collection.options[4]
    )
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('submit-group-activity'),
          'be.disabled'
        )
      }, // full answer required
    })
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('sc-7-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'not.be.disabled'
    )
  }

  async function answerGroupActivityPartial(data) {
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-correct').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-incorrect').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await typeInto(
      page.getByTestId('input-numerical-3'),
      data.running.answers.numerical
    )
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('free-text-input-4').click()
    await typeInto(
      page.getByTestId('free-text-input-4'),
      data.running.answers.freeText
    )
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-0"]')
      .click()
    await expect(page.locator('[id="selection-5-field-0"]')).toContainText(
      data.collection.options[0]
    )
    await page.locator('[id="selection-5-field-1"]').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('submit-group-activity'),
          'be.disabled'
        )
      }, // full answer required
    })
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('sc-7-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'not.be.disabled'
    )
  }

  async function checkInputsDisabled(data) {
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
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
      page.getByTestId('toggle-kp-2-answer-0-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'be.disabled'
    )
    await expectByAssertion(
      page.locator('[id="selection-5-field-0"]'),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page.locator('[id="selection-5-field-1"]'),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page.locator('[id="selection-5-field-2"]'),
      'have.css',
      'pointer-events',
      'none'
    )
    await verifyCaseStudyInputs(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyValues: false,
      verifyDisabled: true,
    })
    await expectByAssertion(
      page.getByTestId('sc-7-answer-option-0'),
      'be.disabled'
    )
  }

  async function checkPersistentAnswers(data) {
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
      page.getByTestId('toggle-kp-2-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-0-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'have.value',
      data.running.answers.numerical
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'be.disabled'
    )
    await expect(page.getByTestId('free-text-input-4')).toContainText(
      data.running.answers.freeText
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
        .getByText(data.collection.options[0])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-5-field-2"]')
        .getByText(data.collection.options[4])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await verifyCaseStudyInputs(page, {
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
    })
    await expectByAssertion(
      page.getByTestId('sc-7-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-7-answer-option-1'),
      'be.disabled'
    )
  }

  async function checkPersistentAnswersPartial(data) {
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
      page.getByTestId('toggle-kp-2-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-0-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-3'),
      'have.value',
      data.running.answers.numerical
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-4'),
      'be.disabled'
    )
    await expect(page.getByTestId('free-text-input-4')).toContainText(
      data.running.answers.freeText
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
      page.getByTestId('sc-7-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-7-answer-option-1'),
      'be.disabled'
    )
  }

  async function checkGradingVisualization(
    scores: string[],
    maxPoints: string[],
    comments: string[],
    gradingComment?: string
  ) {
    const totalScore = scores.reduce(
      (acc: number, value: string) => acc + parseInt(value),
      0
    )
    const maxScore = maxPoints.reduce(
      (acc: number, value: string) => acc + parseInt(value),
      0
    )
    await expectByAssertion(
      page.getByText(`${totalScore}/${maxScore} Points`).first(),
      'exist'
    )
    for (const [ix, score] of Array.from(scores).entries()) {
      await expectByAssertion(
        page.getByTestId(`group-activity-grading-feedback-${ix}`),
        'contain',
        `${score}/${maxPoints[ix]} Points`
      )
      if (comments[ix]) {
        await expectByAssertion(
          page.getByTestId(`group-activity-grading-feedback-${ix}`),
          'contain',
          comments[ix]
        )
      }
    }
    if (gradingComment !== null) {
      await expectByAssertion(
        page.getByTestId('group-activity-results-comment'),
        'contain',
        gradingComment
      )
    }
  }

  async function verifyGroupActivityDetailsModalContent(
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

  async function verifyGroupActivityOwnerPermissions(data: any) {
    await expectByAssertion(
      page.getByTestId(`publish-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga1}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)
    await expectByAssertion(
      page.getByTestId(`start-group-activity-${data.sharing.ga2}-now`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga2}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)
    await expectByAssertion(
      page.getByTestId(`extend-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga3}`).click()
    await expectByAssertion(
      page.getByTestId(`end-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga4}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga5}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga5}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  async function verifyGroupActivityREADPermissions(
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
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    for (const [__index, quiz] of Array.from([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`view-activity-log-${quiz}`),
        'exist'
      )
      if (!groupPermission) {
        await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz}`).click()
        await expectByAssertion(
          page.getByTestId(`remove-group-activity-${quiz}`),
          'exist'
        )
        await typeInto(page.locator('body'), '{esc}')
      }
      await verifyGroupActivityDetailsModalContent(quiz, data)
    }
  }

  async function verifyGroupActivityEXECUTEPermissions(
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
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga1}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)
    await expectByAssertion(
      page.getByTestId(`start-group-activity-${data.sharing.ga2}-now`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga2}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga2}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)
    await expectByAssertion(
      page.getByTestId(`extend-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga3}`).click()
    await expectByAssertion(
      page.getByTestId(`end-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga3}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga4}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga5}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga5}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga5}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  async function verifyGroupActivityWRITEPermissions(
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
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    for (const [__index, quiz] of Array.from([
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga1}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga1}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)
    await expectByAssertion(
      page.getByTestId(`start-group-activity-${data.sharing.ga2}-now`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga2}`).click()
    await expectByAssertion(
      page.getByTestId(`unpublish-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga2}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)
    await expectByAssertion(
      page.getByTestId(`extend-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga3}`).click()
    await expectByAssertion(
      page.getByTestId(`end-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga3}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga4}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga5}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga5}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga5}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  async function verifyGroupActivityADMINPermissions(
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
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    for (const [__index, quiz] of Array.from([
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga1}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)
    await expectByAssertion(
      page.getByTestId(`start-group-activity-${data.sharing.ga2}-now`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga2}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)
    await expectByAssertion(
      page.getByTestId(`extend-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga3}`).click()
    await expectByAssertion(
      page.getByTestId(`end-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga4}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga4}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)
    await expectByAssertion(
      page.getByTestId(`grade-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await page.getByTestId(`actions-GROUP_ACTIVITY-${data.sharing.ga5}`).click()
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.ga5}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-group-activity-${data.sharing.ga5}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-group-activity-${data.sharing.ga5}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  async function verifyREADPermissionsRevoked(data: any) {
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyEXECUTEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyWRITEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
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
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
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

  test('Create questions required for group activity creation', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      choices: data.SCML.choices,
      multiplier: 2,
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
      multiplier: 3,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML.title,
      content: data.FTML.content,
      ...data.FTML.options,
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

  test('Create a group activity with the created questions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('create-group-activity').click()
    await page.getByTestId('insert-groupactivity-name').click()
    await typeInto(
      page.getByTestId('insert-groupactivity-name'),
      data.activity.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-groupactivity-display-name').click()
    await typeInto(
      page.getByTestId('insert-groupactivity-display-name'),
      data.activity.displayName
    )
    await page.getByTestId('insert-groupactivity-description').click()
    await typeInto(
      page.getByTestId('insert-groupactivity-description'),
      data.activity.task
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
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
    await setDatetime(page, {
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: 1,
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
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
    })
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('add-group-activity-clue').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.textClue
    )
    await page.getByTestId('group-activity-clue-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-name'),
      data.activity.clues[0].name
    )
    await page.getByTestId('group-activity-clue-display-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-display-name'),
      data.activity.clues[0].displayName
    )
    await page.getByTestId('group-activity-string-clue-value').click()
    await typeInto(
      page.getByTestId('group-activity-string-clue-value'),
      data.activity.clues[0].content
    )
    await page.getByTestId('group-activity-clue-save').click()
    await expectByAssertion(
      page.getByText(data.activity.clues[0].name).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.activity.clues[0].content).first(),
      'exist'
    )
    await page.getByTestId('add-group-activity-clue').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.textClue
    )
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-number').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.numericalClue
    )
    await page.getByTestId('group-activity-clue-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-name'),
      data.activity.clues[1].name
    )
    await page.getByTestId('group-activity-clue-display-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-display-name'),
      data.activity.clues[1].displayName
    )
    await typeInto(
      page.getByTestId('group-activity-number-clue-value'),
      String(data.activity.clues[1].content)
    )
    await page.getByTestId('group-activity-number-clue-unit').click()
    await typeInto(
      page.getByTestId('group-activity-number-clue-unit'),
      data.activity.clues[1].unit
    )
    await page.getByTestId('group-activity-clue-save').click()
    await expectByAssertion(
      page.getByText(data.activity.clues[1].name).first(),
      'exist'
    )
    await expectByAssertion(
      page
        .getByText(
          data.activity.clues[1].content + ' ' + data.activity.clues[1].unit
        )
        .first(),
      'exist'
    )
    await page.getByTestId('add-group-activity-clue').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.textClue
    )
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-number').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.numericalClue
    )
    await page.getByTestId('group-activity-clue-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-name'),
      data.activity.clues[2].name
    )
    await page.getByTestId('group-activity-clue-display-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-display-name'),
      data.activity.clues[2].displayName
    )
    await typeInto(
      page.getByTestId('group-activity-number-clue-value'),
      String(data.activity.clues[2].content)
    )
    await page.getByTestId('group-activity-clue-save').click()
    await expectByAssertion(
      page.getByText(data.activity.clues[2].name).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.activity.clues[2].content).first(),
      'exist'
    )
    await createStacks(page, {
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
          ],
        },
      ],
    })
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-groupActivities').click()
    await expectByAssertion(page.getByText(data.activity.name).first(), 'exist')
  })

  test('Creates a group activity that starts and ends in the future', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createGroupActivity(page, {
      name: data.synchronous.name,
      displayName: data.synchronous.displayName,
      task: data.synchronous.task,
      courseName: data.course,
      scheduledStartDate: {
        monthDelta: 2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: synchronousStartDate,
      }, // 2 months in the future at 12:30
      scheduledEndDate: {
        monthDelta: 3,
        day: 20,
        hour: 14,
        minute: 0,
        validation: synchronousEndDate,
      }, // 3 months in the future at 14:00
      clues: data.synchronous.clues,
      stack: {
        elements: [data.SCML.title, data.MCML.title, data.KPML.title],
      },
    })
  })

  test('Publish and unpublish the future group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.activity.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.activity.name}-DRAFT`),
      'exist'
    )
    await page
      .getByTestId(`publish-group-activity-${data.activity.name}`)
      .click()
    await page.getByTestId('cancel-publish-action').click()
    await page
      .getByTestId(`publish-group-activity-${data.activity.name}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.activity.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.activity.name}-SCHEDULED`),
      'exist'
    )
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.activity.name}`)
      .click()
    await page
      .getByTestId(`unpublish-group-activity-${data.activity.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.activity.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.activity.name}-DRAFT`),
      'exist'
    )
  })

  test('Edit the group activity', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.activity.name}`)
      .click()
    await page.getByTestId(`edit-group-activity-${data.activity.name}`).click()
    await page.getByTestId('insert-groupactivity-name').click()
    await expectByAssertion(
      page.getByTestId('insert-groupactivity-name'),
      'have.value',
      data.activity.name
    )
    await page.getByTestId('insert-groupactivity-name').clear()
    await typeInto(
      page.getByTestId('insert-groupactivity-name'),
      data.running.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-groupactivity-display-name').click()
    await expectByAssertion(
      page.getByTestId('insert-groupactivity-display-name'),
      'have.value',
      data.activity.displayName
    )
    await page.getByTestId('insert-groupactivity-display-name').clear()
    await typeInto(
      page.getByTestId('insert-groupactivity-display-name'),
      data.running.displayName
    )
    await page.getByTestId('insert-groupactivity-description').click()
    await expect(
      page.getByTestId('insert-groupactivity-description')
    ).toContainText(data.activity.task)
    await page.getByTestId('insert-groupactivity-description').click()
    await page.getByTestId('insert-groupactivity-description').clear()
    await typeInto(
      page.getByTestId('insert-groupactivity-description'),
      data.running.task
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
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
    await setDatetime(page, {
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: -3,
        day: 10,
        hour: 12,
        minute: 30,
        validation: runningStartDate,
      },
    })
    await setDatetime(page, {
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: -1,
        day: 20,
        hour: 14,
        minute: 0,
        validation: runningEndDate,
      },
    })
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByText(data.activity.clues[0].name).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.activity.clues[1].name).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.activity.clues[2].name).first(),
      'exist'
    )
    await page.getByTestId(`edit-clue-${data.activity.clues[0].name}`).click()
    await page.getByTestId('group-activity-clue-name').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-name'),
      'have.value',
      data.activity.clues[0].name
    )
    await page.getByTestId('group-activity-clue-name').clear()
    await typeInto(
      page.getByTestId('group-activity-clue-name'),
      data.running.clues[0].name
    )
    await page.getByTestId('group-activity-clue-display-name').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-display-name'),
      'have.value',
      data.activity.clues[0].displayName
    )
    await page.getByTestId('group-activity-clue-display-name').clear()
    await typeInto(
      page.getByTestId('group-activity-clue-display-name'),
      data.running.clues[0].displayName
    )
    await page.getByTestId('group-activity-string-clue-value').click()
    await expectByAssertion(
      page.getByTestId('group-activity-string-clue-value'),
      'have.value',
      data.activity.clues[0].content
    )
    await page.getByTestId('group-activity-string-clue-value').clear()
    await typeInto(
      page.getByTestId('group-activity-string-clue-value'),
      data.running.clues[0].content
    )
    await page.getByTestId('group-activity-clue-save').click()
    await expectByAssertion(
      page.getByText(data.running.clues[0].name).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.running.clues[0].content).first(),
      'exist'
    )
    await page.getByTestId(`remove-clue-${data.running.clues[0].name}`).click()
    await expectByAssertion(
      page.getByText(data.running.clues[0].name).first(),
      'not.exist'
    )
    await expectByAssertion(
      page.getByText(data.running.clues[0].content).first(),
      'not.exist'
    )
    await page.getByTestId('add-group-activity-clue').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.textClue
    )
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-number').click()
    await expectByAssertion(
      page.getByTestId('group-activity-clue-type'),
      'exist'
    )
    await expect(page.getByTestId('group-activity-clue-type')).toContainText(
      messages.manage.activityWizard.numericalClue
    )
    await page.getByTestId('group-activity-clue-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-name'),
      data.running.clues[1].name
    )
    await page.getByTestId('group-activity-clue-display-name').click()
    await typeInto(
      page.getByTestId('group-activity-clue-display-name'),
      data.running.clues[1].displayName
    )
    await typeInto(
      page.getByTestId('group-activity-number-clue-value'),
      String(data.running.clues[1].content)
    )
    await page.getByTestId('group-activity-number-clue-unit').click()
    await typeInto(
      page.getByTestId('group-activity-number-clue-unit'),
      data.running.clues[1].unit
    )
    await page.getByTestId('group-activity-clue-save').click()
    await expectByAssertion(
      page.getByTestId(`groupActivity-clue-${data.running.clues[1].name}`),
      'exist'
    )
    await expectByAssertion(
      page
        .getByText(
          data.running.clues[1].content + ' ' + data.running.clues[1].unit
        )
        .first(),
      'exist'
    )
    await dragAndDropElement(page, {
      element: data.SCML.title,
      target: 'drop-elements-stack-0',
    })
    await dragAndDropElement(page, {
      element: data.CT.title,
      target: 'drop-elements-stack-0',
    })
    await expectByAssertion(page.getByTestId(`element-0-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-0-stack-0`),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-1-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-1-stack-0`),
      'contain',
      data.MCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-2-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-2-stack-0`),
      'contain',
      data.KPML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-3-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-3-stack-0`),
      'contain',
      data.NRML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-4-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-4-stack-0`),
      'contain',
      data.FTML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-5-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-5-stack-0`),
      'contain',
      data.SEML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-6-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-6-stack-0`),
      'contain',
      data.CSML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-7-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-7-stack-0`),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId(`element-8-stack-0`), 'exist')
    await expectByAssertion(
      page.getByTestId(`element-8-stack-0`),
      'contain',
      data.CT.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-groupActivities').click()
    await expectByAssertion(page.getByText(data.running.name).first(), 'exist')
  })

  test('Publish the group activity and check its status', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.running.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.name}-DRAFT`),
      'exist'
    )
    await page
      .getByTestId(`publish-group-activity-${data.running.name}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.running.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.name}-PUBLISHED`),
      'exist'
    )
  })

  test('Extend the running group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByText(data.course).first().click()
    await page.getByTestId('tab-groupActivities').click()
    await page.getByTestId(`extend-group-activity-${data.running.name}`).click()
    await page.getByTestId('extend-activity-cancel').click()
    await page.getByTestId(`extend-group-activity-${data.running.name}`).click()
    await setDatetime(page, {
      cyString: 'extend-activity-date',
      deselectorString: 'extension-modal-description',
      datetime: {
        monthDelta: 6,
        day: 15,
        hour: 18,
        minute: 50,
        validation: extensionDate,
      },
    })
    await page.getByTestId('extend-activity-confirm').click()
    await page.waitForTimeout(1000)
    await page.getByTestId(`extend-group-activity-${data.running.name}`).click()
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

  test('Take part in the group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await page.getByTestId('start-group-activity').click()
    await page.getByTestId('upvote-element-0-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('downvote-element-0-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('upvote-element-1-button').click()
    await page.waitForTimeout(500)
    await page.getByTestId('flag-element-1-button').click()
    await expectByAssertion(
      page.getByTestId('submit-flag-element'),
      'be.disabled'
    )
    await typeInto(
      page.getByTestId('flag-element-textarea'),
      data.running.flagging.text
    )
    await page.getByTestId('cancel-flag-element').click()
    await page.getByTestId('flag-element-1-button').click()
    await expectByAssertion(
      page.getByTestId('submit-flag-element'),
      'be.disabled'
    )
    await typeInto(
      page.getByTestId('flag-element-textarea'),
      data.running.flagging.text
    )
    await expectByAssertion(
      page.getByTestId('submit-flag-element'),
      'not.be.disabled'
    )
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000)
    await page.getByTestId('flag-element-1-button').click()
    await expectByAssertion(
      page.getByTestId('submit-flag-element'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('flag-element-textarea'),
      'have.value',
      data.running.flagging.text
    )
    await page.getByTestId('flag-element-textarea').clear()
    await typeInto(
      page.getByTestId('flag-element-textarea'),
      data.running.flagging.textNew
    )
    await page.getByTestId('submit-flag-element').click()
    await page.waitForTimeout(4000)
    await page.getByTestId('flag-element-1-button').click()
    await expectByAssertion(
      page.getByTestId('submit-flag-element'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('flag-element-textarea'),
      'have.value',
      data.running.flagging.textNew
    )
    await page.getByTestId('cancel-flag-element').click()
    await answerGroupActivity(data)
    await page.getByTestId('submit-group-activity').click()
    await checkPersistentAnswers(data)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await checkPersistentAnswers(data)
  })

  test('Login as the second group member and verify that the submission was successful', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await checkPersistentAnswers(data)
  })

  test('Solve the group activity as a second student with partial answers (where available)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME5') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await page.getByTestId('start-group-activity').click()
    await answerGroupActivityPartial(data)
    await page.getByTestId('submit-group-activity').click()
    await checkPersistentAnswersPartial(data)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await checkPersistentAnswersPartial(data)
  })

  test('Login as a student of another group and start the group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await page.getByTestId('start-group-activity').click()
  })

  test('End the running group activity through the corresponding action on the lecturer interface', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByText(data.course).first().click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.running.name}`)
      .click()
    await page.getByTestId(`end-group-activity-${data.running.name}`).click()
    await page.getByTestId('confirm-instances-loosing-access').click()
    await page.getByTestId('confirmation-modal-cancel').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.running.name}`)
      .click()
    await page.getByTestId(`end-group-activity-${data.running.name}`).click()
    await page.getByTestId('confirm-instances-loosing-access').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expectByAssertion(
      page.getByTestId(`status-${data.running.name}-ENDED`),
      'exist'
    )
  })

  test('Verify that a valid submission is still visible after the group activity ended', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expect(
      page.getByTestId(`group-activity-${data.running.displayName}`)
    ).toContainText(messages.pwa.groupActivity.submitted)
    await page
      .getByTestId(`open-submission-${data.running.displayName}`)
      .click()
    await checkInputsDisabled(data)
    await checkPersistentAnswers(data)
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'not.exist'
    )
  })

  test('Verify that a started group activity can still be seen, but not submitted after it ended', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expect(
      page.getByTestId(`group-activity-${data.running.displayName}`)
    ).toContainText(messages.pwa.groupActivity.past)
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await checkInputsDisabled(data)
    await expectByAssertion(
      page.getByText(messages.pwa.groupActivity.groupActivityEnded).first(),
      'exist'
    )
  })

  test('Verify that a group activity cannot be started after it ended', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME3') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await expectByAssertion(
      page.getByTestId('start-group-activity'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByText(messages.pwa.groupActivity.groupActivityEnded).first(),
      'exist'
    )
  })

  test('Grade the submissions to the group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page.getByTestId(`grade-group-activity-${data.running.name}`).click()
    await page.getByTestId('group-activity-submission-0').click()
    await expectByAssertion(page.getByTestId('finalize-grading'), 'be.disabled')
    await expectByAssertion(
      page.getByTestId('groupActivity-save-submission-grading'),
      'be.disabled'
    )
    for (const [ix, score] of Array.from(
      data.running.grading.scores1
    ).entries()) {
      await page.getByTestId(`groupActivity-grading-score-${ix}`).fill(score)
      if (data.running.grading.comments1[ix]) {
        await page.getByTestId(`groupActivity-grading-comment-${ix}`).click()
        await typeInto(
          page.getByTestId(`groupActivity-grading-comment-${ix}`),
          data.running.grading.comments1[ix]
        )
      }
      await expectByAssertion(
        page.getByTestId('groupActivity-save-submission-grading'),
        'be.disabled'
      )
    }
    if (data.running.grading.gradingComment1 !== null) {
      await page.getByTestId('groupActivity-general-grading-comment').click()
      await typeInto(
        page.getByTestId('groupActivity-general-grading-comment'),
        data.running.grading.gradingComment1
      )
    }
    await page.getByTestId('group-activity-submission-1').click()
    await page.getByTestId('cancel-submission-switch').click()
    await page.getByTestId('groupActivity-passed').click()
    await page.getByTestId('groupActivity-save-submission-grading').click()
    await page.waitForTimeout(1000)
    await page.getByTestId('group-activity-submission-1').click()
    await page.getByTestId(`groupActivity-grading-score-0`).click()
    await typeInto(page.getByTestId(`groupActivity-grading-score-0`), '10')
    await page.getByTestId('group-activity-submission-0').click()
    if (await page.getByTestId('confirm-submission-switch').isVisible()) {
      await page.getByTestId('confirm-submission-switch').click()
    }
    for (const [ix, score] of Array.from(
      data.running.grading.scores1
    ).entries()) {
      await expectByAssertion(
        page.getByTestId(`groupActivity-grading-score-${ix}`),
        'have.value',
        score
      )
      if (data.running.grading.comments1[ix]) {
        await page.getByTestId(`groupActivity-grading-comment-${ix}`).click()
        await expect(
          page.getByTestId(`groupActivity-grading-comment-${ix}`)
        ).toContainText(data.running.grading.comments1[ix])
      }
    }
    await page.getByTestId('group-activity-submission-1').click()
    await page.getByTestId('confirm-submission-switch').click()
    await expectByAssertion(page.getByTestId('finalize-grading'), 'be.disabled')
    await expectByAssertion(
      page.getByTestId('groupActivity-save-submission-grading'),
      'be.disabled'
    )
    for (const [ix, score] of Array.from(
      data.running.grading.scores2
    ).entries()) {
      await page.getByTestId(`groupActivity-grading-score-${ix}`).fill(score)
      if (data.running.grading.comments2[ix]) {
        await page.getByTestId(`groupActivity-grading-comment-${ix}`).click()
        await typeInto(
          page.getByTestId(`groupActivity-grading-comment-${ix}`),
          data.running.grading.comments2[ix]
        )
      }
      await expectByAssertion(
        page.getByTestId('groupActivity-save-submission-grading'),
        'be.disabled'
      )
    }
    if (data.running.grading.gradingComment2 !== null) {
      await page.getByTestId('groupActivity-general-grading-comment').click()
      await typeInto(
        page.getByTestId('groupActivity-general-grading-comment'),
        data.running.grading.gradingComment2
      )
    }
    await page.getByTestId('groupActivity-failed').click()
    await expectByAssertion(page.getByTestId('finalize-grading'), 'be.disabled')
    await page.getByTestId('groupActivity-save-submission-grading').click()
    await expectByAssertion(
      page.getByTestId('group-activity-submission-2'),
      'be.disabled'
    )
    await page.getByTestId('finalize-grading').click()
    await page.getByTestId('cancel-finalize-grading').click()
    await page.getByTestId('finalize-grading').click()
    await page.getByTestId('confirm-finalize-grading').click()
    await page.waitForTimeout(1000)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('group-activity-submission-0').click()
    for (const [ix, score] of Array.from(
      data.running.grading.scores1
    ).entries()) {
      await expectByAssertion(
        page.getByTestId(`groupActivity-grading-score-${ix}`),
        'have.value',
        score
      )
      await expectByAssertion(
        page.getByTestId(`groupActivity-grading-score-${ix}`),
        'be.disabled'
      )
    }
    await expectByAssertion(
      page.getByTestId('groupActivity-passed'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('groupActivity-save-submission-grading'),
      'be.disabled'
    )
    await page.getByTestId('group-activity-submission-1').click()
    for (const [ix, score] of Array.from(
      data.running.grading.scores2
    ).entries()) {
      await expectByAssertion(
        page.getByTestId(`groupActivity-grading-score-${ix}`),
        'have.value',
        score
      )
      await expectByAssertion(
        page.getByTestId(`groupActivity-grading-score-${ix}`),
        'be.disabled'
      )
    }
    await expectByAssertion(
      page.getByTestId('groupActivity-passed'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('groupActivity-save-submission-grading'),
      'be.disabled'
    )
  })

  test('Verify that the student of the group with passing results can see the evaluation', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.running.displayName}`),
      'contain',
      messages.shared.generic.passed
    )
    await page.getByTestId(`open-feedback-${data.running.displayName}`).click()
    await expectByAssertion(
      page.getByText(messages.pwa.groupActivity.groupActivityPassed).first(),
      'exist'
    )
    await checkPersistentAnswers(data)
    await checkGradingVisualization(
      data.running.grading.scores1,
      data.running.grading.maxPoints,
      data.running.grading.comments1,
      data.running.grading.gradingComment1
    )
  })

  test('Verify that the second student of the first group can see the same results', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME15') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.running.displayName}`),
      'contain',
      messages.shared.generic.passed
    )
    await page.getByTestId(`open-feedback-${data.running.displayName}`).click()
    await expectByAssertion(
      page.getByText(messages.pwa.groupActivity.groupActivityPassed).first(),
      'exist'
    )
    await checkGradingVisualization(
      data.running.grading.scores1,
      data.running.grading.maxPoints,
      data.running.grading.comments1,
      data.running.grading.gradingComment1
    )
  })

  test('Verify that the student of the group with failing results can see the evaluation', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME5') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.running.displayName}`),
      'contain',
      messages.shared.generic.failed
    )
    await page.getByTestId(`open-feedback-${data.running.displayName}`).click()
    await expectByAssertion(
      page.getByText(messages.pwa.groupActivity.groupActivityFailed).first(),
      'exist'
    )
    await checkGradingVisualization(
      data.running.grading.scores2,
      data.running.grading.maxPoints,
      data.running.grading.comments2,
      data.running.grading.gradingComment2
    )
  })

  test('Verify that groups that have not attempted to submit anything to the group activity cannot see any results', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.running.displayName}`),
      'contain',
      messages.pwa.groupActivity.past
    )
    await page
      .getByTestId(`open-group-activity-${data.running.displayName}`)
      .click()
    await expectByAssertion(
      page.getByTestId('start-group-activity'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByText(messages.pwa.groupActivity.groupActivityEnded).first(),
      'exist'
    )
  })

  test('Cleanup: Delete the running and solved group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.running.name}`)
      .click()
    await page.getByTestId(`delete-group-activity-${data.running.name}`).click()
    await page.getByTestId(`confirm-deletion-started-instances`).click()
    await page.getByTestId(`confirm-deletion-submissions`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.running.name}`),
      'not.exist'
    )
  })

  test('Verify that the group activity is not visible to students anymore', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.running.displayName}`),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted group activity (with results) directly in database', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedGroupActivity', {
        gaName: data.running.name,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted group activity with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Publish the synchronous group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.synchronous.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.synchronous.name}-DRAFT`),
      'exist'
    )
    await page
      .getByTestId(`publish-group-activity-${data.synchronous.name}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.synchronous.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.synchronous.name}-SCHEDULED`),
      'exist'
    )
  })

  test('Login as a student and check that the group activity is not visible', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.synchronous.displayName}`),
      'exist'
    )
    await expect(
      page.getByTestId(`group-activity-${data.synchronous.displayName}`)
    ).toContainText(messages.shared.generic.scheduled)
    await expectByAssertion(
      page.getByTestId(`open-group-activity-${data.synchronous.displayName}`),
      'not.exist'
    )
  })

  test('Start the synchronous group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`start-group-activity-${data.synchronous.name}-now`)
      .click()
    await page.getByTestId('confirm-groups-getting-access').click()
    await page.getByTestId('confirm-activity-available-until').click()
    await page.getByTestId('confirmation-modal-cancel').click()
    await page
      .getByTestId(`start-group-activity-${data.synchronous.name}-now`)
      .click()
    await page.getByTestId('confirm-groups-getting-access').click()
    await page.getByTestId('confirm-activity-available-until').click()
    await page.getByTestId('confirmation-modal-confirm').click()
  })

  test('Login as a student and solve the group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.synchronous.displayName}`)
      .click()
    await page.getByTestId('start-group-activity').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-0').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('mc-1-answer-option-2').click()
    await expectByAssertion(
      page.getByTestId('submit-group-activity'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-correct').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-incorrect').click()
    await page.getByTestId('submit-group-activity').click()
    await page.waitForTimeout(2000)
  })

  test('Login as a second student and start the synchronous group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.synchronous.displayName}`)
      .click()
    await page.getByTestId('start-group-activity').click()
  })

  test('End the synchronous group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByText(data.course).first().click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.synchronous.name}`)
      .click()
    await page
      .getByTestId(`end-group-activity-${data.synchronous.name}`)
      .click()
    await page.getByTestId('confirm-instances-loosing-access').click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expectByAssertion(
      page.getByTestId(`status-${data.synchronous.name}-ENDED`),
      'exist'
    )
  })

  test('Login as a student with a valid submission', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-submission-${data.synchronous.displayName}`)
      .click()
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
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
      page.getByTestId('toggle-kp-2-answer-0-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-2-answer-3-incorrect'),
      'be.disabled'
    )
  })

  test('Login as another student and check that the group activity cannot be started anymore', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page
      .getByTestId(`open-group-activity-${data.synchronous.displayName}`)
      .click()
    await expectByAssertion(
      page.getByTestId('start-group-activity'),
      'not.exist'
    )
  })

  test('Cleanup: Delete the synchronous group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${data.synchronous.name}`)
      .click()
    await page
      .getByTestId(`delete-group-activity-${data.synchronous.name}`)
      .click()
    await page.getByTestId(`confirm-deletion-started-instances`).click()
    await page.getByTestId(`confirm-deletion-submissions`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.synchronous.name}`),
      'not.exist'
    )
  })

  test("Verify that the synchronous group activity isn't visible to students anymore", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId(`group-activity-${data.synchronous.displayName}`),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted group activity (with results) directly in database [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedGroupActivity', {
        gaName: data.synchronous.name,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted group activity with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Check if group messages can be sent', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await typeInto(
      page.getByTestId('group-message-textarea'),
      data.group.message1
    )
    await page.getByTestId('group-message-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('group-message-textarea'),
      'have.value',
      ''
    )
    await expectByAssertion(
      page.getByTestId('group-messages'),
      'contain',
      data.group.message1
    )
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME15') })
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId('group-messages'),
      'contain',
      data.group.message1
    )
    await typeInto(
      page.getByTestId('group-message-textarea'),
      data.group.message2
    )
    await page.getByTestId('group-message-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('group-message-textarea'),
      'have.value',
      ''
    )
    await expectByAssertion(
      page.getByTestId('group-messages'),
      'contain',
      data.group.message2
    )
    await loginStudent(page)
    await page.getByTestId(`course-button-${data.course}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await expectByAssertion(
      page.getByTestId('group-messages'),
      'contain',
      data.group.message1
    )
    await expectByAssertion(
      page.getByTestId('group-messages'),
      'contain',
      data.group.message2
    )
  })

  test('Create five different group activities and make sure that all required actions are shown to the object owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    for (let i = 1; i <= 5; i++) {
      await createGroupActivity(page, {
        name: data.sharing[`ga${i}`],
        displayName: data.sharing[`ga${i}Display`],
        courseName: data.seededCourse,
        scheduledStartDate: {
          monthDelta: -1,
          day: 10,
          hour: 12,
          minute: 30,
          validation: getDatetimeValidationString(-1, '10') + ', 12:30',
        }, // 1 month in the past at 12:30
        scheduledEndDate: {
          monthDelta: 2,
          day: 20,
          hour: 14,
          minute: 0,
          validation: getDatetimeValidationString(2, '20') + ', 14:00',
        }, // 2 months in the future at 14:00
        task: 'TASK',
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
        stack: {
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
      })
      await page.getByTestId('create-new-activity').click()
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.ga2,
        activityType: 'GROUP_ACTIVITY',
        status: 'SCHEDULED',
      })
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.ga3,
        activityType: 'GROUP_ACTIVITY',
        status: 'PUBLISHED',
      })
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.ga4,
        activityType: 'GROUP_ACTIVITY',
        status: 'ENDED',
      })
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.ga5,
        activityType: 'GROUP_ACTIVITY',
        status: 'GRADED',
      })
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('activities').click()
    await verifyGroupActivityOwnerPermissions(data)
  })

  test('Share the group activities individually with different users and different permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
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
    await verifyGroupActivityREADPermissions(data, false)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyGroupActivityEXECUTEPermissions(data, false)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyGroupActivityWRITEPermissions(data, false)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyGroupActivityADMINPermissions(data, false)
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
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]
    const users = [
      env('LECTURER_IND_SHORTNAME'),
      env('LECTURER_INST_SHORTNAME'),
      env('LECTURER_INST2_SHORTNAME'),
      env('LECTURER_INST3_SHORTNAME'),
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
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

  test('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the group activities with them', async ({
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
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
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
    await verifyGroupActivityREADPermissions(data, true)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyGroupActivityEXECUTEPermissions(data, true)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyGroupActivityWRITEPermissions(data, true)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyGroupActivityADMINPermissions(data, true)
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
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]
    const groups = [
      data.sharing.group1,
      data.sharing.group2,
      data.sharing.group3,
      data.sharing.group4,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
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

  test("Transfer ownership of all group activities to user 'pro1' using the username", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
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
    await verifyGroupActivityOwnerPermissions(data)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
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

  test("Remove the shared group activities from user 'pro1' using the removal functionality", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz}`).click()
      await page.getByTestId(`remove-group-activity-${quiz}`).click()
      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expectByAssertion(
        page.getByTestId(`activity-GROUP_ACTIVITY-${quiz}`),
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
      { name: data.sharing.ga1 },
      { name: data.sharing.ga2 },
      { name: data.sharing.ga3 },
      { name: data.sharing.ga4 },
      { name: data.sharing.ga5 },
    ]).entries()) {
      await page.getByTestId(`actions-GROUP_ACTIVITY-${quiz.name}`).click()
      await page.getByTestId(`share-group-activity-${quiz.name}`).click()
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'not.exist'
      )
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Create a group activity to check the activity preview', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createGroupActivity(page, {
      name: data.details.name,
      displayName: data.details.displayName,
      task: data.details.task,
      courseName: data.details.courseName,
      multiplier: messages.manage.activityWizard.multiplier2,
      scheduledStartDate: {
        monthDelta: 2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: synchronousStartDate,
      }, // 2 months in the future at 12:30
      scheduledEndDate: {
        monthDelta: 3,
        day: 20,
        hour: 14,
        minute: 0,
        validation: synchronousEndDate,
      }, // 3 months in the future at 14:00
      clues: data.synchronous.clues,
      stack: {
        elements: [
          data.SCML.title,
          data.MCML.title,
          data.KPML.title,
          data.NRML.title,
          data.FTML.title,
          data.SEML.title,
          data.CSML.title,
        ],
      },
    })
    await page.getByTestId('open-activity-overview').click()
  })

  test('Check points calculation for group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await expectByAssertion(
      page.getByTestId(`activity-GROUP_ACTIVITY-${data.details.name}`),
      'exist'
    )
    await page.getByTestId(`activity-name-${data.details.name}`).click()
    await assertAsynchronousActivityPoints(page, { totalPoints: 450 })
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('450 P.')
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.KPML.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      data.SEML.title
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      data.CSML.title
    )
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 100,
      stackIx: 0,
      instanceIx: 0,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 50,
      stackIx: 0,
      instanceIx: 1,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 50,
      stackIx: 0,
      instanceIx: 2,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 150,
      stackIx: 0,
      instanceIx: 3,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 50,
      stackIx: 0,
      instanceIx: 4,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 5,
    })
    await assertAsynchronousInstancePoints(page, {
      totalPoints: 50,
      stackIx: 0,
      instanceIx: 6,
    })
    await page.getByTestId('close-activity-details-modal').click()
  })
})
