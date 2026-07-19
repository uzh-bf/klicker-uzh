// @ts-nocheck
/**
 * Playwright translation of Q-practice-quiz.
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
  createPracticeQuiz,
  createQuestionCS,
  createQuestionFT,
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionNR,
  createQuestionSC,
  createQuestionSE,
  createStacks,
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
  readFixture('Q-practice-quiz.json')
)

const currentYear = new Date().getFullYear()

test.describe.serial('Different practice quiz workflows', () => {
  async function answerRunningPracticeQuiz(data) {
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-1'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.MCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('mc-0-answer-option-1').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('mc-0-answer-option-1').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('mc-0-answer-option-1').click()
    await page.getByTestId('mc-0-answer-option-2').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-1'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-2'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-3'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.KPML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-0-correct').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-1-incorrect').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-2-incorrect').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-3-correct').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-0-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-0-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-1-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-2-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-3-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-3-incorrect'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.NRML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-0').clear()
    await typeInto(page.getByTestId('input-numerical-0'), '-20')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-0').clear()
    await typeInto(page.getByTestId('input-numerical-0'), '0.55')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('input-numerical-0').clear()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('input-numerical-0'), data.NRML.answer)
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('input-numerical-0'),
      'have.value',
      data.NRML.answer
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-0'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.FTML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('free-text-input-0'), 'Testinput')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('free-text-input-0').clear()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('free-text-input-0'), data.FTML.answer)
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('free-text-input-0'),
      'have.value',
      data.FTML.answer
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-0'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.SEML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.locator('[id="selection-0-field-1"]').click()
    await page
      .locator('[id="react-select-selection-0-field-1-option-0"]')
      .click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.locator('[id="selection-0-field-0"]').click()
    await page
      .locator('[id="react-select-selection-0-field-0-option-0"]')
      .click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.locator('[id="selection-0-field-2"]').click()
    await page
      .locator('[id="react-select-selection-0-field-2-option-1"]')
      .click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page
        .locator('[id="selection-0-field-0"]')
        .getByText(data.collection.options[1])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-0-field-1"]')
        .getByText(data.collection.options[0])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-0-field-2"]')
        .getByText(data.collection.options[3])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.CSML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await answerCaseStudy(page, {
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('student-stack-submit'),
          'be.disabled'
        )
      },
    })
    await page.getByTestId('student-stack-submit').click()
    await verifyCaseStudyInputs(page, {
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('practice-quiz-progress-5').click()
    await expectByAssertion(
      page.getByTestId('student-stack-continue'),
      'not.be.disabled'
    )
    await page.getByTestId('practice-quiz-progress-3').click()
    await expectByAssertion(
      page.getByTestId('student-stack-continue'),
      'not.be.disabled'
    )
    await page.getByTestId('practice-quiz-progress-1').click()
    await expectByAssertion(
      page.getByTestId('student-stack-continue'),
      'not.be.disabled'
    )
    await page.getByTestId('practice-quiz-progress-2').click()
    await expectByAssertion(
      page.getByTestId('student-stack-continue'),
      'not.be.disabled'
    )
    await page.getByTestId('practice-quiz-progress-0').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('student-stack-continue').click()
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.FC.content).first(), 'exist')
    await page.getByTestId('flashcard-front-0').click()
    await page.getByTestId('flashcard-response-0-No').click()
    await page.getByTestId('flashcard-response-0-Yes').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    await expectByAssertion(page.getByTestId('read-content-element-0'), 'exist')
    await page
      .getByTestId('practice-quiz-mark-all-as-read')
      .getByText(messages.pwa.practiceQuiz.markAllAsRead)
      .first()
      .click()
    await page
      .getByTestId('student-stack-submit')
      .getByText(messages.shared.generic.submit)
      .first()
      .click()
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-1'),
      'be.disabled'
    )
    await page
      .getByTestId('student-stack-continue')
      .getByText(messages.shared.generic.finish)
      .first()
      .click()
  }

  async function answerRunningPracticeQuizPreview(data) {
    {
      const __originArgs = { data }
      await page.getByTestId('start-practice-quiz').click()
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.SCML.content
      )
      await expectByAssertion(
        page.getByTestId('student-stack-submit'),
        'be.disabled'
      )
      await page.getByTestId('sc-0-answer-option-1').click()
      await page.getByTestId('student-stack-submit').click()
      await expectByAssertion(
        page.getByTestId('sc-0-answer-option-0'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('sc-0-answer-option-1'),
        'be.disabled'
      )
      await page.getByTestId('student-stack-continue').click()
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.MCML.content
      )
      await expectByAssertion(
        page.getByTestId('student-stack-submit'),
        'be.disabled'
      )
      await page.getByTestId('mc-0-answer-option-1').click()
      await page.getByTestId('mc-0-answer-option-2').click()
      await page.getByTestId('student-stack-submit').click()
      await expectByAssertion(
        page.getByTestId('mc-0-answer-option-0'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('mc-0-answer-option-1'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('mc-0-answer-option-2'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('mc-0-answer-option-3'),
        'be.disabled'
      )
      await page.getByTestId('student-stack-continue').click()
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.KPML.content
      )
      await expectByAssertion(
        page.getByTestId('student-stack-submit'),
        'be.disabled'
      )
      await page.getByTestId('toggle-kp-0-answer-0-correct').click()
      await page.getByTestId('toggle-kp-0-answer-1-incorrect').click()
      await page.getByTestId('toggle-kp-0-answer-2-incorrect').click()
      await page.getByTestId('toggle-kp-0-answer-3-correct').click()
      await page.getByTestId('student-stack-submit').click()
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-0-correct'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-0-incorrect'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-1-correct'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-1-incorrect'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-2-correct'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-2-incorrect'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-3-correct'),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId('toggle-kp-0-answer-3-incorrect'),
        'be.disabled'
      )
      await page.getByTestId('student-stack-continue').click()
    }
  }

  async function answerRunningPracticeQuizPartial(data) {
    await expectByAssertion(
      page.getByText(data.running.descriptionNew).first(),
      'exist'
    )
    await page.getByTestId('start-practice-quiz').click()
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-1'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.MCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('mc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-1'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-2'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('mc-0-answer-option-3'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.KPML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-0-correct').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-1-incorrect').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-2-incorrect').click()
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-0-answer-3-correct').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-0-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-0-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-1-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-1-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-2-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-2-incorrect'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-3-correct'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('toggle-kp-0-answer-3-incorrect'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.NRML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-0').clear()
    await typeInto(page.getByTestId('input-numerical-0'), data.NRML.answer)
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('input-numerical-0'),
      'have.value',
      data.NRML.answer
    )
    await expectByAssertion(
      page.getByTestId('input-numerical-0'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.FTML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('free-text-input-0'), data.FTML.answer)
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('free-text-input-0'),
      'have.value',
      data.FTML.answer
    )
    await expectByAssertion(
      page.getByTestId('free-text-input-0'),
      'be.disabled'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.SEML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.locator('[id="selection-0-field-0"]').click()
    await page
      .locator('[id="react-select-selection-0-field-0-option-0"]')
      .click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page
        .locator('[id="selection-0-field-0"]')
        .getByText(data.collection.options[0])
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-0-field-1"]')
        .getByText(messages.shared.questions.seSelectOption)
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await expectByAssertion(
      page
        .locator('[id="selection-0-field-2"]')
        .getByText(messages.shared.questions.seSelectOption)
        .first(),
      'have.css',
      'pointer-events',
      'none'
    )
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.CSML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await answerCaseStudy(page, {
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('student-stack-submit'),
          'be.disabled'
        )
      }, // full answer required
    })
    await page.getByTestId('student-stack-submit').click()
    await verifyCaseStudyInputs(page, {
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.FC.content).first(), 'exist')
    await page.getByTestId('flashcard-front-0').click()
    await page.getByTestId('flashcard-response-0-No').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    await expectByAssertion(page.getByTestId('read-content-element-0'), 'exist')
    await page
      .getByTestId('practice-quiz-mark-all-as-read')
      .getByText(messages.pwa.practiceQuiz.markAllAsRead)
      .first()
      .click()
    await page
      .getByTestId('student-stack-submit')
      .getByText(messages.shared.generic.submit)
      .first()
      .click()
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-0'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('sc-0-answer-option-1'),
      'be.disabled'
    )
    await page
      .getByTestId('student-stack-continue')
      .getByText(messages.shared.generic.finish)
      .first()
      .click()
  }

  async function verifyPracticeQuizDetailsModalContent(
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

  async function verifyPracticeQuizOwnerPermissions(data: any) {
    await expectByAssertion(
      page.getByTestId(`publish-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  async function verifyPracticeQuizREADPermissions(
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
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  async function verifyPracticeQuizEXECUTEPermissions(
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
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  async function verifyPracticeQuizWRITEPermissions(
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
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  async function verifyPracticeQuizADMINPermissions(
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
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`publish-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz1}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`edit-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-practice-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz2}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz2}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`unpublish-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-practice-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`evaluation-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.sharing.quiz3}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`copy-access-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`open-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`copy-lti-link-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-practice-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-practice-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  async function verifyREADPermissionsRevoked(data: any) {
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyEXECUTEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyWRITEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
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
    const quizzes = [data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
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

  test('Create questions required for practice quiz creation', async ({
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
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
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

  test('Test the creation of a practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('cancel-activity-creation').click()
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('insert-practice-quiz-name').click()
    await typeInto(
      page.getByTestId('insert-practice-quiz-name'),
      data.running.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-practice-quiz-display-name').click()
    await typeInto(
      page.getByTestId('insert-practice-quiz-display-name'),
      data.running.displayName
    )
    await page.getByTestId('insert-practice-quiz-description').click()
    await typeInto(
      page.getByTestId('insert-practice-quiz-description'),
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
    await page.getByTestId('select-order').click()
    await page
      .getByTestId(
        `select-order-${messages.manage.activityWizard.practiceQuizSEQUENTIAL}`
      )
      .click()
    await expectByAssertion(page.getByTestId('select-order'), 'exist')
    await expect(page.getByTestId('select-order')).toContainText(
      messages.manage.activityWizard.practiceQuizSEQUENTIAL
    )
    await page.getByTestId('select-order').click()
    await page
      .getByTestId(
        `select-order-${messages.manage.activityWizard.practiceQuizSPACED_REPETITION}`
      )
      .click()
    await expectByAssertion(page.getByTestId('select-order'), 'exist')
    await expect(page.getByTestId('select-order')).toContainText(
      messages.manage.activityWizard.practiceQuizSPACED_REPETITION
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await createStacks(page, {
      stacks: [
        { elements: [data.SCML.title] },
        { elements: [data.MCML.title] },
        { elements: [data.KPML.title] },
        { elements: [data.NRML.title] },
        { elements: [data.FTML.title] },
        { elements: [data.SEML.title] },
        { elements: [data.CSML.title] },
        { elements: [data.FC.title] },
        { elements: [data.CT.title] },
      ],
    })
    await dragAndDropElement(page, {
      element: data.SC.title,
      target: 'drop-elements-stack-1',
    })
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.SC.title
    )
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')
    await page.getByTestId('remove-element-1-stack-1').click()
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
    await page.getByTestId('tab-practiceQuizzes').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.running.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.name}-DRAFT`),
      'exist'
    )
  })

  test('Edit the first created practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${data.running.name}`).click()
    await page.getByTestId(`edit-practice-quiz-${data.running.name}`).click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.practiceQuiz).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'have.value',
      data.running.name
    )
    await page.getByTestId('insert-practice-quiz-name').click()
    await page.getByTestId('insert-practice-quiz-name').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-name'),
      data.running.nameNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
      'have.value',
      data.running.displayName
    )
    await page.getByTestId('insert-practice-quiz-display-name').click()
    await page.getByTestId('insert-practice-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-display-name'),
      data.running.displayNameNew
    )
    await expect(
      page.getByTestId('insert-practice-quiz-description')
    ).toContainText(data.running.description)
    await page.getByTestId('insert-practice-quiz-description').click()
    await page.getByTestId('insert-practice-quiz-description').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-description'),
      data.running.descriptionNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier4}`
      )
      .click()
    await expectByAssertion(page.getByTestId('select-order'), 'exist')
    await expect(page.getByTestId('select-order')).toContainText(
      messages.manage.activityWizard.practiceQuizSPACED_REPETITION
    )
    await page.getByTestId('select-order').click()
    await page
      .getByTestId(
        `select-order-${messages.manage.activityWizard.practiceQuizSEQUENTIAL}`
      )
      .click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.MCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-2')).toContainText(
      data.KPML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-3')).toContainText(
      data.NRML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-4')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-5')).toContainText(
      data.SEML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-6')).toContainText(
      data.CSML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-7')).toContainText(
      data.FC.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-8')).toContainText(
      data.CT.title.substring(0, 20)
    )
    await page.getByTestId('drop-elements-add-stack').click()
    await dragAndDropElement(page, {
      element: data.SCML.title,
      target: 'drop-elements-stack-9',
    })
    await expect(page.getByTestId('element-0-stack-9')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.running.nameNew}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.nameNew}-DRAFT`),
      'exist'
    )
  })

  test('Verify that the changes from editing went into effect', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.running.nameNew}`)
      .click()
    await page.getByTestId(`edit-practice-quiz-${data.running.nameNew}`).click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.practiceQuiz).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'have.value',
      data.running.nameNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
      'have.value',
      data.running.displayNameNew
    )
    await expect(
      page.getByTestId('insert-practice-quiz-description')
    ).toContainText(data.running.descriptionNew)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await expectByAssertion(page.getByTestId('select-order'), 'exist')
    await expect(page.getByTestId('select-order')).toContainText(
      messages.manage.activityWizard.practiceQuizSEQUENTIAL
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.MCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-2')).toContainText(
      data.KPML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-3')).toContainText(
      data.NRML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-4')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-5')).toContainText(
      data.SEML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-6')).toContainText(
      data.CSML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-7')).toContainText(
      data.FC.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-8')).toContainText(
      data.CT.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-9')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
  })

  test('Create a practice quiz that will be scheduled', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createPracticeQuiz(page, {
      name: data.scheduled.name,
      displayName: data.scheduled.displayName,
      courseName: data.course,
      stacks: [
        { elements: [data.SCML.title] },
        { elements: [data.MCML.title] },
      ],
    })
  })

  test('Duplicate a practice quiz and validate its content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`duplicate-practice-quiz-${data.running.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByText('Create ' + messages.shared.generic.practiceQuiz).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'have.value',
      data.running.nameDupl
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
      'have.value',
      data.running.displayNameNew
    )
    await expect(
      page.getByTestId('insert-practice-quiz-description')
    ).toContainText(data.running.descriptionNew)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(page, '[data-cy="select-course"]', data.course)
    await expect(page.getByTestId('select-course')).toContainText(data.course)
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await expectByAssertion(page.getByTestId('select-order'), 'exist')
    await expect(page.getByTestId('select-order')).toContainText(
      messages.manage.activityWizard.practiceQuizSEQUENTIAL
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('element-0-stack-0')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.MCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-2')).toContainText(
      data.KPML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-3')).toContainText(
      data.NRML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-4')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-5')).toContainText(
      data.SEML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-6')).toContainText(
      data.CSML.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-7')).toContainText(
      data.FC.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-8')).toContainText(
      data.CT.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-9')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
  })

  test('Cleanup: Delete the duplicated practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.running.nameDupl}`)
      .click()
    await page
      .getByTestId(`delete-practice-quiz-${data.running.nameDupl}`)
      .click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.running.nameDupl}`),
      'not.exist'
    )
  })

  test('Check out the preview of the draft practice quiz and validate its content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const quiz = await runTask('getPracticeQuizInfo', {
        quizName: data.running.nameNew,
      })
      if (quiz === null) {
        throw new Error('Practice quiz not found')
      }
      await page.goto(
        `${env('URL_STUDENT')}/course/${quiz.courseId}/practiceQuizzes/${quiz.id}`,
        { waitUntil: 'commit' }
      )
      await answerRunningPracticeQuizPreview(data)
    }
  })

  test('Publish the practice quiz around the current time', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`publish-practice-quiz-${data.running.nameNew}`)
      .click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.running.nameNew}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.running.nameNew}-PUBLISHED`),
      'exist'
    )
  })

  test('Solve the practice quiz and test the student view accordingly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page
      .getByTestId(`practice-quiz-${data.running.displayNameNew}`)
      .click()
    await expectByAssertion(
      page.getByText(data.running.descriptionNew).first(),
      'exist'
    )
    await page.getByTestId('start-practice-quiz').click()
    await answerRunningPracticeQuiz(data)
  })

  test('Solve the practice quiz with partial answers (where supported)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentPassword(page, { username: env('STUDENT_USERNAME2') })
    await page.getByTestId('quizzes').click()
    await page
      .getByTestId(`practice-quiz-${data.running.displayNameNew}`)
      .click()
    await answerRunningPracticeQuizPartial(data)
  })

  test('Check that published practice quizzes can still be accessed as a preview', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const quiz = await runTask('getPracticeQuizInfo', {
        quizName: data.running.nameNew,
      })
      if (quiz === null) {
        throw new Error('Practice quiz not found')
      }
      await page.goto(
        `${env('URL_STUDENT')}/course/${quiz.courseId}/practiceQuizzes/${quiz.id}`,
        { waitUntil: 'commit' }
      )
      await answerRunningPracticeQuizPreview(data)
    }
  })

  test('Cleanup: Delete the running practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.running.nameNew}`)
      .click()
    await page
      .getByTestId(`delete-practice-quiz-${data.running.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'be.disabled'
    )
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.running.nameNew}`),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted practice quiz (with results) directly in database', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedPracticeQuiz', {
        quizName: data.running.nameNew,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted practice quiz with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Verify that the running practice quiz is no longer visible to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await expectByAssertion(
      page.getByTestId(`practice-quiz-${data.running.nameNew}`),
      'not.exist'
    )
  })

  test('Publish the future practice quiz and verify scheduled state', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`publish-practice-quiz-${data.scheduled.name}`)
      .click()
    const courseStartMonthDelta = -12 - new Date().getMonth()
    await expectByAssertion(
      page.getByTestId('schedule-practice-quiz-publication'),
      'be.disabled'
    )
    await setDatetime(page, {
      cyString: 'practice-quiz-available-from',
      deselectorString: 'publish-immediately-header',
      datetime: {
        monthDelta: courseStartMonthDelta,
        day: 1,
        hour: 0,
        minute: 0,
        validation:
          getDatetimeValidationString(courseStartMonthDelta, '01') + ', 00:00',
      },
    })
    await expectByAssertion(
      page.getByTestId('schedule-practice-quiz-publication'),
      'be.disabled'
    )
    await setDatetime(page, {
      cyString: 'practice-quiz-available-from',
      deselectorString: 'publish-immediately-header',
      datetime: {
        monthDelta: 4 - courseStartMonthDelta,
        day: 15,
        hour: 12,
        minute: 0,
        validation: getDatetimeValidationString(4, '15') + ', 12:00',
      },
    })
    await page.getByTestId('schedule-practice-quiz-publication').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.scheduled.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.scheduled.name}-SCHEDULED`),
      'exist'
    )
  })

  test('Verify that scheduled practice quizzes are not visible to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await expectByAssertion(
      page.getByTestId(`practice-quiz-${data.scheduled.displayName}`),
      'not.exist'
    )
  })

  test('Check that scheduled practice quizzes can be accessed as a preview', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const quiz = await runTask('getPracticeQuizInfo', {
        quizName: data.scheduled.name,
      })
      if (quiz === null) {
        throw new Error('Practice quiz not found')
      }
      await page.goto(
        `${env('URL_STUDENT')}/course/${quiz.courseId}/practiceQuizzes/${quiz.id}`,
        { waitUntil: 'commit' }
      )
      {
        await expectByAssertion(
          page.getByTestId('start-practice-quiz'),
          'exist'
        )
      }
    }
  })

  test('Unpublish the practice quiz again on the lecturer view', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.scheduled.name}`)
      .click()
    await page
      .getByTestId(`unpublish-practice-quiz-${data.scheduled.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.scheduled.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.scheduled.name}-DRAFT`),
      'exist'
    )
  })

  test('Check that immediate publication works for practice quizzes with past start dates', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`publish-practice-quiz-${data.scheduled.name}`)
      .click()
    await setDatetime(page, {
      cyString: 'practice-quiz-available-from',
      deselectorString: 'publish-immediately-header',
      datetime: {
        monthDelta: -1,
        day: 15,
        hour: 12,
        minute: 0,
        validation: getDatetimeValidationString(-1, '15') + ', 12:00',
      },
    })
    await page.getByTestId('schedule-practice-quiz-publication').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.scheduled.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.scheduled.name}-PUBLISHED`),
      'exist'
    )
  })

  test('Verify that the modified and published practice quiz is available to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await expectByAssertion(
      page.getByTestId(`practice-quiz-${data.scheduled.displayName}`),
      'exist'
    )
  })

  test('Cleanup: Delete the scheduled practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${data.course}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.scheduled.name}`)
      .click()
    await page
      .getByTestId(`delete-practice-quiz-${data.scheduled.name}`)
      .click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.scheduled.name}`),
      'not.exist'
    )
  })

  test('Verify that the scheduled practice quiz is not visible to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await expectByAssertion(
      page.getByTestId(`practice-quiz-${data.scheduled.displayName}`),
      'not.exist'
    )
  })

  test('Create a numerical question and included it in a practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionNR(page, {
      name: data.NRML2.title,
      content: data.NRML2.content,
      ...data.NRML2.options,
      userId: env('LECTURER_ID'),
    })
    await createPracticeQuiz(page, {
      name: data.manipulation.name,
      displayName: data.manipulation.displayName,
      courseName: data.manipulation.course,
      stacks: [{ elements: [data.NRML2.title] }],
    })
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-DRAFT`),
      'exist'
    )
  })

  test('Edit the numerical question, edit and save the unmodified practice quiz -> verify that nothing changed', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await editElement(page, { element: data.NRML2.title })
    await page.getByTestId('instance-update-switch').click()
    await page.getByTestId('insert-question-title').clear()
    await typeInto(
      page.getByTestId('insert-question-title'),
      data.manipulation.newNRTitle
    )
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await typeInto(
      page.getByTestId('insert-question-text'),
      data.manipulation.newNRContent
    )
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(1000)
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`edit-practice-quiz-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.practiceQuiz).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
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
    await page.getByTestId('tab-practiceQuizzes').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-DRAFT`),
      'exist'
    )
  })

  test('Edit the practice quiz again and add the modified NR question and a new FT question', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionFT(page, {
      name: data.FTML2.title,
      content: data.FTML2.content,
      ...data.FTML2.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`edit-practice-quiz-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.practiceQuiz).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await dragAndDropElement(page, {
      element: data.manipulation.newNRTitle,
      target: 'drop-elements-stack-0',
    })
    await expect(page.getByTestId(`element-1-stack-0`)).toContainText(
      data.manipulation.newNRTitle.substring(0, 20)
    )
    await page.getByTestId(`drop-elements-add-stack`).click()
    await dragAndDropElement(page, {
      element: data.FTML2.title,
      target: 'drop-elements-stack-1',
    })
    await expect(page.getByTestId(`element-0-stack-1`)).toContainText(
      data.FTML2.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
  })

  test('Delete the created questions and edit and re-order the blocks in the practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await deleteElement(page, { elementName: data.manipulation.newNRTitle })
    await deleteElement(page, { elementName: data.FTML2.title })
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`edit-practice-quiz-${data.manipulation.name}`)
      .click()
    await expectByAssertion(
      page.getByText('Edit ' + messages.shared.generic.practiceQuiz).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-practice-quiz-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('move-stack-0-right').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
  })

  test('Duplicate the practice quiz, verify that the same instances are shown in the editor, and publish both practice quizzes', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`duplicate-practice-quiz-${data.manipulation.name}`)
      .click()
    await page.getByTestId('insert-practice-quiz-name').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-name'),
      data.manipulation.duplicateName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-practice-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('insert-practice-quiz-display-name'),
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
      data.FTML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-0-stack-1')).toContainText(
      data.NRML2.title.substring(0, 20)
    )
    await expect(page.getByTestId('element-1-stack-1')).toContainText(
      data.manipulation.newNRTitle.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`publish-practice-quiz-${data.manipulation.name}`)
      .click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.manipulation.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.name}-PUBLISHED`),
      'exist'
    )
    await page
      .getByTestId(`publish-practice-quiz-${data.manipulation.duplicateName}`)
      .click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expectByAssertion(
      page.getByTestId(
        `activity-PRACTICE_QUIZ-${data.manipulation.duplicateName}`
      ),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`status-${data.manipulation.duplicateName}-PUBLISHED`),
      'exist'
    )
  })

  test('Answer the first practice quiz through the student view and verify its content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page
      .getByTestId(`practice-quiz-${data.manipulation.displayName}`)
      .click()
    await page.getByTestId('start-practice-quiz').click()
    await expectByAssertion(page.getByText(data.FTML2.content).first(), 'exist')
    await typeInto(page.getByTestId('free-text-input-0'), 'Testinput')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.NRML2.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-0').clear()
    await typeInto(page.getByTestId('input-numerical-0'), '10')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-1').clear()
    await typeInto(page.getByTestId('input-numerical-1'), '10')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
  })

  test('Answer the duplicated practice quiz through the student view and verify its content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page
      .getByTestId(`practice-quiz-${data.manipulation.duplicateDisplayName}`)
      .click()
    await page.getByTestId('start-practice-quiz').click()
    await expectByAssertion(page.getByText(data.FTML2.content).first(), 'exist')
    await typeInto(page.getByTestId('free-text-input-0'), 'Testinput')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expectByAssertion(page.getByText(data.NRML2.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-0').clear()
    await typeInto(page.getByTestId('input-numerical-0'), '10')
    await expectByAssertion(
      page.getByTestId('student-stack-submit'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-1').clear()
    await typeInto(page.getByTestId('input-numerical-1'), '10')
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
  })

  test('Delete the created practice quizzes', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page
      .getByTestId(`course-list-button-${data.manipulation.course}`)
      .click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.manipulation.name}`)
      .click()
    await page
      .getByTestId(`delete-practice-quiz-${data.manipulation.name}`)
      .click()
    await page.waitForTimeout(500)
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.manipulation.name}`),
      'not.exist'
    )
    await page
      .getByTestId(`actions-PRACTICE_QUIZ-${data.manipulation.duplicateName}`)
      .click()
    await page
      .getByTestId(`delete-practice-quiz-${data.manipulation.duplicateName}`)
      .click()
    await page.waitForTimeout(500)
    await page.getByTestId(`confirm-deletion-responses`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByTestId(
        `activity-PRACTICE_QUIZ-${data.manipulation.duplicateName}`
      ),
      'not.exist'
    )
  })

  test('Create four different practice quizzes and make sure that all required actions are shown to the object owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    for (let i = 1; i <= 3; i++) {
      await createPracticeQuiz(page, {
        name: data.sharing[`quiz${i}`],
        displayName: data.sharing[`quiz${i}Display`],
        courseName: data.seededCourse,
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
        activityName: data.sharing.quiz2,
        activityType: 'PRACTICE_QUIZ',
        status: 'SCHEDULED',
      })
      if (result === false) {
        throw new Error(
          'Practice quiz to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.quiz3,
        activityType: 'PRACTICE_QUIZ',
        status: 'PUBLISHED',
      })
      if (result === false) {
        throw new Error(
          'Practice quiz to change status was not found in the database'
        )
      }
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('activities').click()
    await verifyPracticeQuizOwnerPermissions(data)
  })

  test('Share the practice quizzes individual with different users and different permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
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
    await verifyPracticeQuizREADPermissions(data, false)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyPracticeQuizEXECUTEPermissions(data, false)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyPracticeQuizWRITEPermissions(data, false)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyPracticeQuizADMINPermissions(data, false)
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
    const quizzes = [data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]
    const users = [
      env('LECTURER_IND_SHORTNAME'),
      env('LECTURER_INST_SHORTNAME'),
      env('LECTURER_INST2_SHORTNAME'),
      env('LECTURER_INST3_SHORTNAME'),
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
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

  test('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the practice quizzes with them', async ({
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
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
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
    await verifyPracticeQuizREADPermissions(data, true)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyPracticeQuizEXECUTEPermissions(data, true)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyPracticeQuizWRITEPermissions(data, true)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyPracticeQuizADMINPermissions(data, true)
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
    const quizzes = [data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]
    const groups = [
      data.sharing.group1,
      data.sharing.group2,
      data.sharing.group3,
      data.sharing.group4,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
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

  test("Transfer ownership of all practice quizzes to user 'pro1' using the username", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
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
    await verifyPracticeQuizOwnerPermissions(data)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
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

  test("Remove the shared practice quizzes from user 'pro1' using the removal functionality", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`remove-practice-quiz-${quiz}`).click()
      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expectByAssertion(
        page.getByTestId(`activity-PRACTICE_QUIZ-${quiz}`),
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
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await page.getByTestId(`actions-PRACTICE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-practice-quiz-${quiz}`).click()
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'not.exist'
      )
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Create a practice quiz in a gamified course and validate that points are shown correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createPracticeQuiz(page, {
      name: data.details.name,
      displayName: data.details.displayName,
      courseName: data.details.courseName,
      multiplier: messages.manage.activityWizard.multiplier2,
      stacks: [
        {
          elements: [data.SCML.title, data.FC.title, data.CT.title],
        },
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.NRML.title,
            data.FTML.title,
          ],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-PRACTICE_QUIZ-${data.details.name}`),
      'exist'
    )
    await page.getByTestId(`activity-name-${data.details.name}`).click()
    await assertAsynchronousActivityPoints(page, { totalPoints: 100 })
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('20 P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).toContainText('80 P.')
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
      data.SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
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

  test('Create a practice quiz in a non-gamified course and validate that no points are shown', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createPracticeQuiz(page, {
      name: data.details.nameNonGamified,
      displayName: data.details.displayNameNonGamified,
      courseName: data.details.courseNonGamified,
      stacks: [
        {
          elements: [data.SCML.title, data.FC.title, data.CT.title],
        },
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.NRML.title,
            data.FTML.title,
          ],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(
        `activity-PRACTICE_QUIZ-${data.details.nameNonGamified}`
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
      '80 P.'
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
      data.SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
      data.FTML.title
    )
    await assertNoInstancePoints(page, { stackIx: 1, instanceIx: 0 })
    await assertNoInstancePoints(page, { stackIx: 1, instanceIx: 1 })
    await assertNoInstancePoints(page, { stackIx: 1, instanceIx: 2 })
    await page.getByTestId('close-activity-details-modal').click()
  })
})
