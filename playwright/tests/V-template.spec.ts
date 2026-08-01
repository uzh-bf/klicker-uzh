// @ts-nocheck
/**
 * Playwright translation of V-template.
 * Mirrors the original Cypress workflow with native Playwright actions.
 */
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { test } from '../util/fixtures.js'
import { fillEditorField } from '../util/fixtures/elements.js'
import { enMessages as messages } from '../util/messages.js'
import {
  acceptGamifiedLiveQuizAccountPrompt,
  answerCaseStudy,
  createAnswerCollection,
  createLiveQuiz,
  createQuestionCS,
  createQuestionFT,
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionNR,
  createQuestionSC,
  createQuestionSE,
  editElement,
  env,
  expectByAssertion,
  getLiveQuizTemplateId,
  gotoCommit,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginLecturer,
  loginStudent,
  openStudentLiveQuiz,
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
  readFixture('questions.json'),
  readFixture('V-template.json')
)

test.describe
  .serial('Test all functionalities related to the creation, management, sharing and use of templates', () => {
  async function openLiveQuizTemplate(templateName: string) {
    const templateId = await getLiveQuizTemplateId(templateName)
    await page.goto(`${env('URL_MANAGE')}/templates/${templateId}`, {
      waitUntil: 'commit',
    })
    await expect(page.getByTestId('template-instructions')).toBeVisible()
  }

  async function openLiveQuizCockpit(activityName: string) {
    const cockpitLink = page.getByTestId(`live-quiz-cockpit-${activityName}`)
    await expect(cockpitLink).toBeVisible()
    await Promise.all([
      page.waitForURL(/\/quizzes\/[^/]+\/cockpit/, { timeout: 15000 }),
      cockpitLink.click(),
    ])
  }

  async function startLiveQuiz(activityName: string) {
    const startButton = page.getByTestId(`start-live-quiz-${activityName}`)
    await expect(startButton).toBeVisible()
    await Promise.all([
      page.waitForURL(/\/quizzes\/[^/]+\/cockpit/, { timeout: 30000 }),
      startButton.click(),
    ])
    await expect(page.getByTestId('next-block-timeline')).toBeVisible()
  }

  function currentCockpitQuizId() {
    const quizId = page.url().match(/\/quizzes\/([^/]+)\/cockpit/)?.[1]
    if (!quizId) {
      throw new Error(`Could not extract live quiz id from URL ${page.url()}`)
    }
    return quizId
  }

  async function addInlineAnswerCollectionOptions(options: string[]) {
    const inlineCollectionInput = page.locator(
      '#inline-answer-collection-options input'
    )
    await expect(inlineCollectionInput).toBeVisible()

    for (const option of options) {
      await inlineCollectionInput.fill(option)
      await inlineCollectionInput.press('Enter')
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

  test('Create a set of questions in the lecturer account for the template test suite', async ({
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
    await createQuestionSC(page, {
      name: data.SCMLAF.title,
      content: data.SCMLAF.content,
      choices: data.SCMLAF.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MC.title,
      content: data.MC.content,
      choices: data.MC.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML.title,
      content: data.MCML.content,
      choices: data.MCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCMLAF.title,
      content: data.MCMLAF.content,
      choices: data.MCMLAF.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KP.title,
      content: data.KP.content,
      choices: data.KP.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML.title,
      content: data.KPML.content,
      choices: data.KPML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPMLAF.title,
      content: data.KPMLAF.content,
      choices: data.KPMLAF.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NR.title,
      content: data.NR.content,
      ...data.NR.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML.title,
      content: data.NRML.content,
      ...data.NRML.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT.title,
      content: data.FT.content,
      ...data.FT.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML.title,
      content: data.FTML.content,
      ...data.FTML.options,
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
    await validateElement(page, { element: data.SC.title })
    await createQuestionSE(page, {
      name: data.SE.title,
      content: data.SE.content,
      numberOfInputs: data.SE.inputs,
      collectionName: data.collection.name,
      userId: env('LECTURER_ID'),
    })
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
      name: data.CS.title,
      content: data.CS.content,
      explanation: data.CS.explanation,
      collectionName: data.collection.name,
      selectedItems: data.collection.options.filter((_, i) =>
        data.CS.selectedItems.includes(i)
      ),
      criteria: data.CS.criteria,
      cases: data.CS.cases,
      solutions: data.CS.solutions,
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

  test('Create a second set of questions in the lecturer user account for the use in the template test suite', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SC2.title,
      content: data.SC2.content,
      choices: data.SC2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCML2.title,
      content: data.SCML2.content,
      choices: data.SCML2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCMLAF2.title,
      content: data.SCMLAF2.content,
      choices: data.SCMLAF2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MC2.title,
      content: data.MC2.content,
      choices: data.MC2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML2.title,
      content: data.MCML2.content,
      choices: data.MCML2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCMLAF2.title,
      content: data.MCMLAF2.content,
      choices: data.MCMLAF2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KP2.title,
      content: data.KP2.content,
      choices: data.KP2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML2.title,
      content: data.KPML2.content,
      choices: data.KPML2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPMLAF2.title,
      content: data.KPMLAF2.content,
      choices: data.KPMLAF2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NR2.title,
      content: data.NR2.content,
      ...data.NR2.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML2.title,
      content: data.NRML2.content,
      ...data.NRML2.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT2.title,
      content: data.FT2.content,
      ...data.FT2.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML2.title,
      content: data.FTML2.content,
      ...data.FTML2.options,
      userId: env('LECTURER_ID'),
    })
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
    await validateElement(page, { element: data.SC2.title })
    await createQuestionSE(page, {
      name: data.SE2.title,
      content: data.SE2.content,
      numberOfInputs: data.SE2.inputs,
      collectionName: data.collection2.name,
      userId: env('LECTURER_ID'),
    })
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
    await createQuestionCS(page, {
      name: data.CS2.title,
      content: data.CS2.content,
      explanation: data.CS2.explanation,
      collectionName: data.collection2.name,
      selectedItems: data.collection2.options.filter((_, i) =>
        data.CS2.selectedItems.includes(i)
      ),
      criteria: data.CS2.criteria,
      cases: data.CS2.cases,
      solutions: data.CS2.solutions,
      userId: env('LECTURER_ID'),
    })
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
  })

  test("Create another set of questions in the account of user 'pro1' for the use in template", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await createQuestionSC(page, {
      name: data.SC3.title,
      content: data.SC3.content,
      choices: data.SC3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCML3.title,
      content: data.SCML3.content,
      choices: data.SCML3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCMLAF3.title,
      content: data.SCMLAF3.content,
      choices: data.SCMLAF3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionMC(page, {
      name: data.MC3.title,
      content: data.MC3.content,
      choices: data.MC3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML3.title,
      content: data.MCML3.content,
      choices: data.MCML3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCMLAF3.title,
      content: data.MCMLAF3.content,
      choices: data.MCMLAF3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KP3.title,
      content: data.KP3.content,
      choices: data.KP3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML3.title,
      content: data.KPML3.content,
      choices: data.KPML3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPMLAF3.title,
      content: data.KPMLAF3.content,
      choices: data.KPMLAF3.choices,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionNR(page, {
      name: data.NR3.title,
      content: data.NR3.content,
      ...data.NR3.options,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML3.title,
      content: data.NRML3.content,
      ...data.NRML3.options,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT3.title,
      content: data.FT3.content,
      ...data.FT3.options,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML3.title,
      content: data.FTML3.content,
      ...data.FTML3.options,
      userId: env('LECTURER_IND_ID'),
    })
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.collection3.name,
      description: data.collection3.description,
      entries: data.collection3.options,
      userId: env('LECTURER_IND_ID'),
    })
    await page.getByTestId('library').click()
    await validateElement(page, { element: data.SC3.title })
    await createQuestionSE(page, {
      name: data.SE3.title,
      content: data.SE3.content,
      numberOfInputs: data.SE3.inputs,
      collectionName: data.collection3.name,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionSE(page, {
      name: data.SEML3.title,
      content: data.SEML3.content,
      numberOfInputs: data.SEML3.inputs,
      collectionName: data.collection3.name,
      correctAnswers: data.collection3.options.filter((_, i) =>
        data.SEML3.solutions.includes(i)
      ),
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionCS(page, {
      name: data.CS3.title,
      content: data.CS3.content,
      explanation: data.CS3.explanation,
      collectionName: data.collection3.name,
      selectedItems: data.collection3.options.filter((_, i) =>
        data.CS3.selectedItems.includes(i)
      ),
      criteria: data.CS3.criteria,
      cases: data.CS3.cases,
      solutions: data.CS3.solutions,
      userId: env('LECTURER_IND_ID'),
    })
    await createQuestionCS(page, {
      name: data.CSML3.title,
      content: data.CSML3.content,
      explanation: data.CSML3.explanation,
      collectionName: data.collection3.name,
      selectedItems: data.collection3.options.filter((_, i) =>
        data.CSML3.selectedItems.includes(i)
      ),
      criteria: data.CSML3.criteria,
      cases: data.CSML3.cases,
      solutions: data.CSML3.solutions,
      userId: env('LECTURER_IND_ID'),
    })
  })

  test('Create a live quiz with all question types', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: data.liveQuiz.name,
      displayName: data.liveQuiz.displayName,
      courseName: data.liveQuiz.courseName,
      blocks: [
        {
          elements: [
            data.SC.title,
            data.MC.title,
            data.KP.title,
            data.NR.title,
            data.FT.title,
            data.SE.title,
            data.CS.title,
          ],
        },
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
        {
          elements: [data.SCMLAF.title, data.MCMLAF.title, data.KPMLAF.title],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.name}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`template-from-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
  })

  test('Create a template from a copy of the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page
      .getByTestId(`template-from-live-quiz-${data.liveQuiz.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('confirm-content-visibility'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('confirm-question-access'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('confirm-resource-access'),
      'not.exist'
    )
    await expectByAssertion(page.getByTestId('template-next-step'), 'not.exist')
    await page.getByTestId('copy-option-template').click()
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('confirm-activity-unavailability'),
      'not.exist'
    )
    await page.getByTestId('confirm-content-visibility').click()
    await expectByAssertion(
      page.getByTestId('confirm-content-visibility'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await page.getByTestId('confirm-question-access').click()
    await expectByAssertion(
      page.getByTestId('confirm-question-access'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await page.getByTestId('confirm-resource-access').click()
    await expectByAssertion(
      page.getByTestId('confirm-resource-access'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'not.be.disabled'
    )
    await page.getByTestId('close-template-conversion-modal').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page
      .getByTestId(`template-from-live-quiz-${data.liveQuiz.name}`)
      .click()
    await page.getByTestId('copy-option-template').click()
    await page.getByTestId('confirm-content-visibility').click()
    await page.getByTestId('confirm-question-access').click()
    await page.getByTestId('confirm-resource-access').click()
    await page.getByTestId('template-next-step').click()
    await expectByAssertion(
      page.getByTestId('submit-template-creation'),
      'be.disabled'
    )
    await page.getByTestId('template-name').click()
    await typeInto(
      page.getByTestId('template-name'),
      data.liveQuiz.template1Orig.name
    )
    await expectByAssertion(
      page.getByTestId('submit-template-creation'),
      'be.disabled'
    )
    await page.getByTestId('template-description').click()
    await typeInto(
      page.getByTestId('template-description'),
      data.liveQuiz.template1Orig.description
    )
    await expectByAssertion(
      page.getByTestId('submit-template-creation'),
      'be.disabled'
    )
    await page.getByTestId('template-instructions').click()
    await typeInto(
      page.getByTestId('template-instructions'),
      data.liveQuiz.template1Orig.instructions
    )
    await page.getByTestId('submit-template-creation').click()
    await expectByAssertion(
      page.getByTestId(
        `activity-LIVE_QUIZ-${data.liveQuiz.template1Orig.name}`
      ),
      'exist'
    )
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.template1Orig.name}`)
    ).toContainText(messages.shared.generic.template)
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`edit-template-${data.liveQuiz.template1Orig.name}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`template-from-live-quiz-${data.liveQuiz.name}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.template1Orig.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`use-template-${data.liveQuiz.template1Orig.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-template-${data.liveQuiz.template1Orig.name}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
  })

  test('Convert the live quiz into a second template', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page
      .getByTestId(`template-from-live-quiz-${data.liveQuiz.name}`)
      .click()
    await page.getByTestId('copy-option-template').click()
    await expectByAssertion(
      page.getByTestId('confirm-activity-unavailability'),
      'not.exist'
    )
    await page.getByTestId('convert-option-template').click()
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await page.getByTestId('confirm-activity-unavailability').click()
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await page.getByTestId('confirm-content-visibility').click()
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await page.getByTestId('confirm-question-access').click()
    await expectByAssertion(
      page.getByTestId('template-next-step'),
      'be.disabled'
    )
    await page.getByTestId('confirm-resource-access').click()
    await page.getByTestId('template-next-step').click()
    await expectByAssertion(
      page.getByTestId('submit-template-creation'),
      'be.disabled'
    )
    await page.getByTestId('template-name').click()
    await typeInto(
      page.getByTestId('template-name'),
      data.liveQuiz.template2.name
    )
    await expectByAssertion(
      page.getByTestId('submit-template-creation'),
      'be.disabled'
    )
    await page.getByTestId('template-description').click()
    await typeInto(
      page.getByTestId('template-description'),
      data.liveQuiz.template2.description
    )
    await expectByAssertion(
      page.getByTestId('submit-template-creation'),
      'be.disabled'
    )
    await page.getByTestId('template-instructions').click()
    await typeInto(
      page.getByTestId('template-instructions'),
      data.liveQuiz.template2.instructions
    )
    await page.getByTestId('submit-template-creation').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.template2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.template2.name}`)
    ).toContainText(messages.shared.generic.template)
    await expectByAssertion(
      page.getByTestId(`edit-template-${data.liveQuiz.template2.name}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.template2.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`use-template-${data.liveQuiz.template2.name}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-template-${data.liveQuiz.template2.name}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.name}`),
      'not.exist'
    )
  })

  test('Test the editing functionality for live quiz templates', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`edit-template-${data.liveQuiz.template1Orig.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('submit-template-edit'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('template-name'),
      'have.value',
      data.liveQuiz.template1Orig.name
    )
    await page.getByTestId('template-name').clear()
    await expectByAssertion(
      page.getByTestId('submit-template-edit'),
      'be.disabled'
    )
    await page.getByTestId('template-name').click()
    await typeInto(
      page.getByTestId('template-name'),
      data.liveQuiz.template1.name
    )
    await expectByAssertion(
      page.getByTestId('submit-template-edit'),
      'not.be.disabled'
    )
    await expect(page.getByTestId('template-description')).toContainText(
      data.liveQuiz.template1Orig.description
    )
    await page.getByTestId('template-description').click()
    await page.getByTestId('template-description').clear()
    await typeInto(
      page.getByTestId('template-description'),
      data.liveQuiz.template1.description
    )
    await expectByAssertion(
      page.getByTestId('submit-template-edit'),
      'not.be.disabled'
    )
    await expect(page.getByTestId('template-instructions')).toContainText(
      data.liveQuiz.template1Orig.instructions
    )
    await page.getByTestId('template-instructions').click()
    await page.getByTestId('template-instructions').clear()
    await typeInto(
      page.getByTestId('template-instructions'),
      data.liveQuiz.template1.instructions
    )
    await page.getByTestId('submit-template-edit').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.template1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.template1.name}`)
    ).toContainText(messages.shared.generic.template)
  })

  test('Verify that the content of both live quiz templates has been stored correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`edit-template-${data.liveQuiz.template1.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('template-name'),
      'have.value',
      data.liveQuiz.template1.name
    )
    await expect(page.getByTestId('template-description')).toContainText(
      data.liveQuiz.template1.description
    )
    await expect(page.getByTestId('template-instructions')).toContainText(
      data.liveQuiz.template1.instructions
    )
    await page.getByTestId('close-edit-template-modal').click()
    await page
      .getByTestId(`edit-template-${data.liveQuiz.template2.name}`)
      .click()
    await expectByAssertion(
      page.getByTestId('template-name'),
      'have.value',
      data.liveQuiz.template2.name
    )
    await expect(page.getByTestId('template-description')).toContainText(
      data.liveQuiz.template2.description
    )
    await expect(page.getByTestId('template-instructions')).toContainText(
      data.liveQuiz.template2.instructions
    )
    await page.getByTestId('close-edit-template-modal').click()
  })

  test('Add the live quiz template to the top level catalog collection', async ({
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
    ).toContainText(data.liveQuiz.template1.name)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.liveQuiz.template1.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.liveQuiz.template1.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
  })

  test("Add the second template to a restricted catalog collection and share access to it with user 'pro1'", async ({
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
    await expect(
      page.getByTestId('create-catalog-collection-button')
    ).toBeVisible()
    await page.getByTestId('create-catalog-collection-button').click()
    await page.getByTestId('catalog-collection-name-input').click()
    await typeInto(
      page.getByTestId('catalog-collection-name-input'),
      data.catalog.name
    )
    await page.getByTestId('modal-object-access').click()
    await page.getByTestId('object-access-restricted').click()
    await expect(page.getByTestId('modal-object-access')).toContainText(
      messages.manage.catalog.accessRESTRICTED
    )
    await page.getByTestId('create-catalog-collection-submit').click()
    await page.getByText(data.catalog.name, { exact: true }).click()
    await expect(page.getByTestId('catalog-browser-title')).toContainText(
      data.catalog.name
    )
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
      .locator('[id="react-select-object-selection-catalog-addition-option-1"]')
      .click()
    await expect(
      page.locator('[id="object-selection-catalog-addition"]')
    ).toContainText(data.liveQuiz.template2.name)
    await page.getByTestId('submit-add-object-button').click()
    await expectByAssertion(
      page.getByTestId(`catalog-object-${data.liveQuiz.template2.name}`),
      'exist'
    )
    await expect(
      page.getByTestId(`catalog-object-${data.liveQuiz.template2.name}`)
    ).toContainText(messages.manage.catalog.accessPUBLIC)
    await page.getByTestId('leave-catalog-collection').click()
    await page
      .getByTestId(`catalog-collection-${data.catalog.name}-actions`)
      .click()
    await page.getByTestId('share-catalog-collection').click()
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

  test('Open the template in the lecturer account and test all element content actions / verify default content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await openLiveQuizTemplate(data.liveQuiz.template1.name)
    await expect(page.getByTestId('template-instructions')).toContainText(
      data.liveQuiz.template1.instructions
    )
    await page.getByTestId('live-quiz-template-settings').click()
    await expectByAssertion(
      page.getByTestId('template-live-quiz-name'),
      'have.value',
      data.liveQuiz.template1.name
    )
    await expectByAssertion(
      page.getByTestId('template-live-quiz-display-name'),
      'have.value',
      data.liveQuiz.displayName
    )
    await page.getByTestId('submit-template-settings').click()
    await page.waitForTimeout(4000)
    await page.getByTestId(`live-quiz-template-element-0-0`).click()
    const combinations = [
      {
        identifier: '0-0',
        content: data.SC.content,
        alternativeContent: data.SC2.content,
        availableElements: [data.SC.title, data.SC2.title],
        unavailableElements: [
          data.SCML.title,
          data.SCML2.title,
          data.SCMLAF.title,
          data.SCMLAF2.title,
        ],
      },
      {
        identifier: '0-1',
        content: data.MC.content,
        alternativeContent: data.MC2.content,
        availableElements: [data.MC.title, data.MC2.title],
        unavailableElements: [
          data.MCML.title,
          data.MCML2.title,
          data.MCMLAF.title,
          data.MCMLAF2.title,
        ],
      },
      {
        identifier: '0-2',
        content: data.KP.content,
        alternativeContent: data.KP2.content,
        availableElements: [data.KP.title, data.KP2.title],
        unavailableElements: [
          data.KPML.title,
          data.KPML2.title,
          data.KPMLAF.title,
          data.KPMLAF2.title,
        ],
      },
      {
        identifier: '0-3',
        content: data.NR.content,
        alternativeContent: data.NR2.content,
        availableElements: [data.NR.title, data.NR2.title],
        unavailableElements: [data.NRML.title, data.NRML2.title],
      },
      {
        identifier: '0-4',
        content: data.FT.content,
        alternativeContent: data.FT2.content,
        availableElements: [data.FT.title, data.FT2.title],
        unavailableElements: [data.FTML.title, data.FTML2.title],
      },
      {
        identifier: '0-5',
        content: data.SE.content,
        alternativeContent: data.SE2.content,
        availableElements: [data.SE.title, data.SE2.title],
        unavailableElements: [data.SEML.title, data.SEML2.title],
      },
      {
        identifier: '0-6',
        content: data.CS.content,
        alternativeContent: data.CS2.content,
        availableElements: [data.CS.title, data.CS2.title],
        unavailableElements: [data.CSML.title, data.CSML2.title],
      },
      {
        identifier: '1-0',
        content: data.SCML.content,
        alternativeContent: data.SCML2.content,
        availableElements: [data.SCML.title, data.SCML2.title],
        unavailableElements: [
          data.SC.title,
          data.SC2.title,
          data.SCMLAF.title,
          data.SCMLAF2.title,
        ],
      },
      {
        identifier: '1-1',
        content: data.MCML.content,
        alternativeContent: data.MCML2.content,
        availableElements: [data.MCML.title, data.MCML2.title],
        unavailableElements: [
          data.MC.title,
          data.MC2.title,
          data.MCMLAF.title,
          data.MCMLAF2.title,
        ],
      },
      {
        identifier: '1-2',
        content: data.KPML.content,
        alternativeContent: data.KPML2.content,
        availableElements: [data.KPML.title, data.KPML2.title],
        unavailableElements: [
          data.KP.title,
          data.KP2.title,
          data.KPMLAF.title,
          data.KPMLAF2.title,
        ],
      },
      {
        identifier: '1-3',
        content: data.NRML.content,
        alternativeContent: data.NRML2.content,
        availableElements: [data.NRML.title, data.NRML2.title],
        unavailableElements: [data.NR.title, data.NR2.title],
      },
      {
        identifier: '1-4',
        content: data.FTML.content,
        alternativeContent: data.FTML2.content,
        availableElements: [data.FTML.title, data.FTML2.title],
        unavailableElements: [data.FT.title, data.FT2.title],
      },
      {
        identifier: '1-5',
        content: data.SEML.content,
        alternativeContent: data.SEML2.content,
        availableElements: [data.SEML.title, data.SEML2.title],
        unavailableElements: [data.SE.title, data.SE2.title],
      },
      {
        identifier: '1-6',
        content: data.CSML.content,
        alternativeContent: data.CSML2.content,
        availableElements: [data.CSML.title, data.CSML2.title],
        unavailableElements: [data.CS.title, data.CS2.title],
      },
      {
        identifier: '2-0',
        content: data.SCMLAF.content,
        alternativeContent: data.SCMLAF2.content,
        availableElements: [data.SCMLAF.title, data.SCMLAF2.title],
        unavailableElements: [
          data.SC.title,
          data.SC2.title,
          data.SCML.title,
          data.SCML2.title,
        ],
      },
      {
        identifier: '2-1',
        content: data.MCMLAF.content,
        alternativeContent: data.MCMLAF2.content,
        availableElements: [data.MCMLAF.title, data.MCMLAF2.title],
        unavailableElements: [
          data.MC.title,
          data.MC2.title,
          data.MCML.title,
          data.MCML2.title,
        ],
      },
      {
        identifier: '2-2',
        content: data.KPMLAF.content,
        alternativeContent: data.KPMLAF2.content,
        availableElements: [data.KPMLAF.title, data.KPMLAF2.title],
        unavailableElements: [
          data.KP.title,
          data.KP2.title,
          data.KPML.title,
          data.KPML2.title,
        ],
      },
    ]
    for (const [
      __index,
      {
        identifier,
        content,
        alternativeContent,
        availableElements,
        unavailableElements,
      },
    ] of Array.from(combinations).entries()) {
      await expectByAssertion(
        page.getByTestId(`live-quiz-template-submit`),
        'be.disabled'
      )
      await page.getByTestId(`live-quiz-template-element-${identifier}`).click()
      await expectByAssertion(
        page.getByTestId(`same-name-element-warning-${identifier}`),
        'exist'
      )
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      for (const [__index, elementName] of Array.from(
        availableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'exist'
        )
      }
      for (const [__index, elementName] of Array.from(
        unavailableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'not.exist'
        )
      }
      await page
        .getByTestId(`select-existing-element-${availableElements[1]}`)
        .click()
      await page.getByTestId('confirm-select-existing-element').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        alternativeContent
      )
      await expectByAssertion(
        page.getByTestId(`same-name-element-warning-${identifier}`),
        'not.exist'
      )
      await page
        .getByTestId(`create-new-element-template-${identifier}`)
        .click()
      await expect(page.getByTestId('insert-question-text')).toContainText(
        content
      )
      await page.waitForTimeout(1000)
      await fillEditorField(
        page,
        'insert-question-text',
        `${content} (NEW)`,
        true
      )
      await page.getByTestId('save-new-question').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        `${content} (NEW)`
      )
      await expectByAssertion(
        page.getByTestId(`same-name-element-warning-${identifier}`),
        'not.exist'
      )
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page.getByTestId('cancel-discard-new-edits').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        `${content} (NEW)`
      )
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page.getByTestId('confirm-discard-new-edits').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await expectByAssertion(
        page.getByTestId(`same-name-element-warning-${identifier}`),
        'exist'
      )
      await page.getByTestId(`live-quiz-template-element-${identifier}`).click()
    }
    await expectByAssertion(
      page.getByTestId(`live-quiz-template-submit`),
      'not.be.disabled'
    )
  })

  test('Use the template in the lecturer account to create an activity with partially new content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await openLiveQuizTemplate(data.liveQuiz.template1.name)
    await expect(page.getByTestId('template-instructions')).toContainText(
      data.liveQuiz.template1.instructions
    )
    await page.getByTestId('live-quiz-template-settings').click()
    await expectByAssertion(
      page.getByTestId('template-live-quiz-name'),
      'have.value',
      data.liveQuiz.template1.name
    )
    await page.getByTestId('template-live-quiz-name').click()
    await page.getByTestId('template-live-quiz-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-name'),
      data.activity1.name
    )
    await page.getByTestId('template-live-quiz-display-name').click()
    await page.getByTestId('template-live-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-display-name'),
      data.activity1.displayName
    )
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await page.getByTestId('template-live-quiz-course').click()
    await page.getByTestId(`select-course-${data.activity1.course}`).click()
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      data.activity1.course
    )
    await page.getByTestId('submit-template-settings').click()
    for (const [__index, { content, identifier }] of Array.from([
      { content: data.SC.content, identifier: '0-0' },
      { content: data.MC.content, identifier: '0-1' },
      { content: data.KP.content, identifier: '0-2' },
      { content: data.NR.content, identifier: '0-3' },
      { content: data.FT.content, identifier: '0-4' },
      { content: data.SE.content, identifier: '0-5' },
      { content: data.CS.content, identifier: '0-6' },
    ]).entries()) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('reset-template-data').click()
    await page.getByTestId('cancel-template-reset').click()
    await page.getByTestId('reset-template-data').click()
    await page.getByTestId('confirm-template-reset').click()
    await page.getByTestId('live-quiz-template-settings').click()
    await expectByAssertion(
      page.getByTestId('template-live-quiz-name'),
      'have.value',
      data.liveQuiz.template1.name
    )
    await page.getByTestId('template-live-quiz-name').click()
    await page.getByTestId('template-live-quiz-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-name'),
      data.activity1.name
    )
    await page.getByTestId('template-live-quiz-display-name').click()
    await page.getByTestId('template-live-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-display-name'),
      data.activity1.displayName
    )
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await page.getByTestId('template-live-quiz-course').click()
    await page.getByTestId(`select-course-${data.activity1.course}`).click()
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      data.activity1.course
    )
    await page.waitForTimeout(5000)
    await page.getByTestId('submit-template-settings').click()
    for (const [__index, { content, identifier }] of Array.from([
      { content: data.SC.content, identifier: '0-0' },
      { content: data.MC.content, identifier: '0-1' },
      { content: data.KP.content, identifier: '0-2' },
      { content: data.NR.content, identifier: '0-3' },
      { content: data.FT.content, identifier: '0-4' },
      { content: data.SE.content, identifier: '0-5' },
      { content: data.CS.content, identifier: '0-6' },
    ]).entries()) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    for (const [__index, { identifier, title, content }] of Array.from([
      {
        identifier: '1-0',
        title: data.SCML2.title,
        content: data.SCML2.content,
      },
      {
        identifier: '1-1',
        title: data.MCML2.title,
        content: data.MCML2.content,
      },
      {
        identifier: '1-2',
        title: data.KPML2.title,
        content: data.KPML2.content,
      },
      {
        identifier: '1-3',
        title: data.NRML2.title,
        content: data.NRML2.content,
      },
      {
        identifier: '1-4',
        title: data.FTML2.title,
        content: data.FTML2.content,
      },
      {
        identifier: '1-5',
        title: data.SEML2.title,
        content: data.SEML2.content,
      },
      {
        identifier: '1-6',
        title: data.CSML2.title,
        content: data.CSML2.content,
      },
    ]).entries()) {
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
    for (const [
      __index,
      { identifier, oldTitle, newTitle, newContent },
    ] of Array.from([
      {
        identifier: '2-0',
        oldTitle: data.SCMLAF.title,
        newTitle: data.activity1.newElements.SC.title,
        newContent: data.activity1.newElements.SC.content,
      },
      {
        identifier: '2-1',
        oldTitle: data.MCMLAF.title,
        newTitle: data.activity1.newElements.MC.title,
        newContent: data.activity1.newElements.MC.content,
      },
      {
        identifier: '2-2',
        oldTitle: data.KPMLAF.title,
        newTitle: data.activity1.newElements.KP.title,
        newContent: data.activity1.newElements.KP.content,
      },
    ]).entries()) {
      await page
        .getByTestId(`create-new-element-template-${identifier}`)
        .click()
      await expectByAssertion(
        page.getByTestId('insert-question-title'),
        'have.value',
        oldTitle
      )
      await page.waitForTimeout(2000)
      await page.getByTestId('insert-question-title').click()
      await page.getByTestId('insert-question-title').clear()
      await typeInto(page.getByTestId('insert-question-title'), newTitle)
      await fillEditorField(page, 'insert-question-text', newContent, true)
      await page.getByTestId('save-new-question').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        newContent
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    for (const [__index, { identifier, content }] of Array.from([
      { identifier: '0-0', content: data.SC.content },
      { identifier: '0-1', content: data.MC.content },
      { identifier: '0-2', content: data.KP.content },
      { identifier: '0-3', content: data.NR.content },
      { identifier: '0-4', content: data.FT.content },
      { identifier: '0-5', content: data.SE.content },
      { identifier: '0-6', content: data.CS.content },
      { identifier: '1-0', content: data.SCML2.content },
      { identifier: '1-1', content: data.MCML2.content },
      { identifier: '1-2', content: data.KPML2.content },
      { identifier: '1-3', content: data.NRML2.content },
      { identifier: '1-4', content: data.FTML2.content },
      { identifier: '1-5', content: data.SEML2.content },
      { identifier: '1-6', content: data.CSML2.content },
      {
        identifier: '2-0',
        content: data.activity1.newElements.SC.content,
      },
      {
        identifier: '2-1',
        content: data.activity1.newElements.MC.content,
      },
      {
        identifier: '2-2',
        content: data.activity1.newElements.KP.content,
      },
    ]).entries()) {
      await page.getByTestId(`live-quiz-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`live-quiz-template-element-${identifier}`).click()
    }
    await page.getByTestId(`live-quiz-template-submit`).click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.activity1.name}`),
      'exist'
    )
  })

  test('Verify that the new elements from the third block have been added to the library', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    for (const [__index, element] of Array.from([
      data.activity1.newElements.SC.title,
      data.activity1.newElements.MC.title,
      data.activity1.newElements.KP.title,
    ]).entries()) {
      await validateElement(page, { element })
    }
  })

  test('Execute the live quiz and open the first block', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.activity1.name}`),
      'exist'
    )
    await startLiveQuiz(data.activity1.name)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Verify the content of the elements through the student view and answer the questions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await openStudentLiveQuiz(page, data.activity1.displayName)
    await acceptGamifiedLiveQuizAccountPrompt(page, data.activity1.displayName)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.SC.content).first(), 'exist')
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.MC.content).first(), 'exist')
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.KP.content).first(), 'exist')
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), data.NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.FT.content).first(), 'exist')
    await typeInto(page.getByTestId('free-text-input-4'), data.FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.SE.content).first(), 'exist')
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.CS.content).first(), 'exist')
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CS.answers,
      cases: data.CS.cases,
      criteria: data.CS.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
      },
      sequentialUI: true,
    })
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
  })

  test('Close the first block and open the second block of the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity1.name)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Verify the content of the elements through the student view and answer the questions [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await openStudentLiveQuiz(page, data.activity1.displayName)
    await acceptGamifiedLiveQuizAccountPrompt(page, data.activity1.displayName)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.SCML2.content).first(), 'exist')
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.MCML2.content).first(), 'exist')
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.KPML2.content).first(), 'exist')
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.NRML2.content).first(), 'exist')
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), data.NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.FTML2.content).first(), 'exist')
    await typeInto(page.getByTestId('free-text-input-4'), data.FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.SEML2.content).first(), 'exist')
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(page.getByText(data.CSML2.content).first(), 'exist')
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CSML2.answers,
      cases: data.CSML2.cases,
      criteria: data.CSML2.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
      },
      sequentialUI: true,
    })
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
  })

  test('Close the second block and open the third block of the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity1.name)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Verify the content of the elements through the student view and answer the questions [3]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await openStudentLiveQuiz(page, data.activity1.displayName)
    await acceptGamifiedLiveQuizAccountPrompt(page, data.activity1.displayName)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByText(data.activity1.newElements.SC.content).first(),
      'exist'
    )
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByText(data.activity1.newElements.MC.content).first(),
      'exist'
    )
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await expectByAssertion(
      page.getByText(data.activity1.newElements.KP.content).first(),
      'exist'
    )
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
  })

  test('Verify the content of the evaluation and close the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity1.name)
    await page.waitForTimeout(1000)
    {
      const quizId = currentCockpitQuizId()
      await page.goto(`${env('URL_MANAGE')}/quizzes/${quizId}/evaluation`, {
        waitUntil: 'commit',
      })
    }
    await expectByAssertion(page.getByText(data.SC.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.MC.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.KP.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.FT.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.SE.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.CS.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.SCML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.MCML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.KPML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.NRML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.FTML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.SEML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.CSML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity1.newElements.SC.content).first(),
      'not.exist'
    )
    await page.getByTestId('show-results-evaluation').click()
    await expectByAssertion(
      page.getByText(data.activity1.newElements.SC.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(
      page.getByText(data.activity1.newElements.SC.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await page.getByTestId('show-results-evaluation').click()
    await expectByAssertion(
      page.getByText(data.activity1.newElements.MC.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await page.getByTestId('show-results-evaluation').click()
    await expectByAssertion(
      page.getByText(data.activity1.newElements.KP.content).first(),
      'exist'
    )
    await page.goto(`${env('URL_MANAGE')}`, { waitUntil: 'commit' })
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity1.name)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test("Open the template in the restricted catalog collection through user 'pro1', test all functionalities and create an activity from it", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page.getByText(data.catalog.name, { exact: true }).click()
    await page
      .getByTestId(`actions-dropdown-${data.liveQuiz.template2.name}`)
      .click()
    await page
      .getByTestId(`use-template-${data.liveQuiz.template2.name}`)
      .click()
    await page.getByTestId('live-quiz-template-settings').click()
    await expectByAssertion(
      page.getByTestId('template-live-quiz-name'),
      'have.value',
      data.liveQuiz.template2.name
    )
    await page.getByTestId('template-live-quiz-name').click()
    await page.getByTestId('template-live-quiz-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-name'),
      data.activity2.name
    )
    await page.getByTestId('template-live-quiz-display-name').click()
    await page.getByTestId('template-live-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-display-name'),
      data.activity2.displayName
    )
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await page.getByTestId('submit-template-settings').click()
    for (const [
      __index,
      { identifier, content, availableElements, unavailableElements },
    ] of Array.from([
      {
        identifier: '0-0',
        content: data.SC.content,
        availableElements: [data.SC3.title],
        unavailableElements: [
          data.SC.title,
          data.SC2.title,
          data.SCML.title,
          data.SCML2.title,
          data.SCML3.title,
          data.SCMLAF.title,
          data.SCMLAF2.title,
          data.SCMLAF3.title,
        ],
      },
      {
        identifier: '0-1',
        content: data.MC.content,
        availableElements: [data.MC3.title],
        unavailableElements: [
          data.MC.title,
          data.MC2.title,
          data.MCML.title,
          data.MCML2.title,
          data.MCML3.title,
          data.MCMLAF.title,
          data.MCMLAF2.title,
          data.MCMLAF3.title,
        ],
      },
      {
        identifier: '0-2',
        content: data.KP.content,
        availableElements: [data.KP3.title],
        unavailableElements: [
          data.KP.title,
          data.KP2.title,
          data.KPML.title,
          data.KPML2.title,
          data.KPML3.title,
          data.KPMLAF.title,
          data.KPMLAF2.title,
          data.KPMLAF3.title,
        ],
      },
      {
        identifier: '0-3',
        content: data.NR.content,
        availableElements: [data.NR3.title],
        unavailableElements: [
          data.NR.title,
          data.NR2.title,
          data.NRML.title,
          data.NRML2.title,
          data.NRML3.title,
        ],
      },
      {
        identifier: '0-4',
        content: data.FT.content,
        availableElements: [data.FT3.title],
        unavailableElements: [
          data.FT.title,
          data.FT2.title,
          data.FTML.title,
          data.FTML2.title,
          data.FTML3.title,
        ],
      },
      {
        identifier: '0-5',
        content: data.SE.content,
        availableElements: [data.SE3.title],
        unavailableElements: [
          data.SE.title,
          data.SE2.title,
          data.SEML.title,
          data.SEML2.title,
          data.SEML3.title,
        ],
      },
      {
        identifier: '0-6',
        content: data.CS.content,
        availableElements: [data.CS3.title],
        unavailableElements: [
          data.CS.title,
          data.CS2.title,
          data.CSML.title,
          data.CSML2.title,
          data.CSML3.title,
        ],
      },
    ]).entries()) {
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      for (const [__index, elementName] of Array.from(
        availableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'exist'
        )
      }
      for (const [__index, elementName] of Array.from(
        unavailableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'not.exist'
        )
      }
      await page
        .getByTestId(`select-existing-element-${availableElements[0]}`)
        .click()
      await page.getByTestId('confirm-select-existing-element').click()
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    for (const [
      __index,
      {
        identifier,
        content,
        title,
        newTitle,
        newContent,
        availableElements,
        unavailableElements,
        hasSampleSolutionDisabled = false,
        hasAnswerFeedbacksDisabled = false,
      },
    ] of Array.from([
      {
        identifier: '1-0',
        content: data.SCML.content,
        title: data.SCML.title,
        newTitle: data.activity2.newElements.SC.title,
        newContent: data.activity2.newElements.SC.content,
        availableElements: [data.SCML3.title],
        unavailableElements: [
          data.SC.title,
          data.SC2.title,
          data.SC3.title,
          data.SCML.title,
          data.SCML2.title,
          data.SCMLAF.title,
          data.SCMLAF2.title,
          data.SCMLAF3.title,
        ],
        hasSampleSolutionDisabled: true,
        hasAnswerFeedbacksDisabled: true,
      },
      {
        identifier: '1-1',
        content: data.MCML.content,
        title: data.MCML.title,
        newTitle: data.activity2.newElements.MC.title,
        newContent: data.activity2.newElements.MC.content,
        availableElements: [data.MCML3.title],
        unavailableElements: [
          data.MC.title,
          data.MC2.title,
          data.MC3.title,
          data.MCML.title,
          data.MCML2.title,
          data.MCMLAF.title,
          data.MCMLAF2.title,
          data.MCMLAF3.title,
        ],
        hasSampleSolutionDisabled: true,
        hasAnswerFeedbacksDisabled: true,
      },
      {
        identifier: '1-2',
        content: data.KPML.content,
        title: data.KPML.title,
        newTitle: data.activity2.newElements.KP.title,
        newContent: data.activity2.newElements.KP.content,
        availableElements: [data.KPML3.title],
        unavailableElements: [
          data.KP.title,
          data.KP2.title,
          data.KP3.title,
          data.KPML.title,
          data.KPML2.title,
          data.KPMLAF.title,
          data.KPMLAF2.title,
          data.KPMLAF3.title,
        ],
        hasSampleSolutionDisabled: true,
        hasAnswerFeedbacksDisabled: true,
      },
      {
        identifier: '1-3',
        content: data.NRML.content,
        title: data.NRML.title,
        newTitle: data.activity2.newElements.NR.title,
        newContent: data.activity2.newElements.NR.content,
        availableElements: [data.NRML3.title],
        unavailableElements: [
          data.NR.title,
          data.NR2.title,
          data.NR3.title,
          data.NRML.title,
          data.NRML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
      {
        identifier: '1-4',
        content: data.FTML.content,
        title: data.FTML.title,
        newTitle: data.activity2.newElements.FT.title,
        newContent: data.activity2.newElements.FT.content,
        availableElements: [data.FTML3.title],
        unavailableElements: [
          data.FT.title,
          data.FT2.title,
          data.FT3.title,
          data.FTML.title,
          data.FTML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
      {
        identifier: '1-5',
        content: data.SEML.content,
        title: data.SEML.title,
        newTitle: data.activity2.newElements.SE.title,
        newContent: data.activity2.newElements.SE.content,
        availableElements: [data.SEML3.title],
        unavailableElements: [
          data.SE.title,
          data.SE2.title,
          data.SE3.title,
          data.SEML.title,
          data.SEML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
      {
        identifier: '1-6',
        content: data.CSML.content,
        title: data.CSML.title,
        newTitle: data.activity2.newElements.CS.title,
        newContent: data.activity2.newElements.CS.content,
        availableElements: [data.CSML3.title],
        unavailableElements: [
          data.CS.title,
          data.CS2.title,
          data.CS3.title,
          data.CSML.title,
          data.CSML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
    ]).entries()) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      for (const [__index, elementName] of Array.from(
        availableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'exist'
        )
      }
      for (const [__index, elementName] of Array.from(
        unavailableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'not.exist'
        )
      }
      await page
        .getByTestId(`select-existing-element-${availableElements[0]}`)
        .click()
      await page.getByTestId('confirm-select-existing-element').click()
      await page
        .getByTestId(`create-new-element-template-${identifier}`)
        .click()
      await expectByAssertion(
        page.getByTestId('insert-question-title'),
        'have.value',
        title
      )
      await page.waitForTimeout(1000)
      await expectByAssertion(
        page.getByTestId('configure-sample-solution'),
        'not.exist'
      )
      if (hasAnswerFeedbacksDisabled) {
        await expectByAssertion(
          page.getByTestId('configure-answer-feedbacks'),
          'be.disabled'
        )
      }
      await expectByAssertion(
        page.getByTestId('element-tag-input'),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId('select-multiplier'),
        'not.exist'
      )
      await page.getByTestId('insert-question-title').click()
      await page.getByTestId('insert-question-title').clear()
      await typeInto(page.getByTestId('insert-question-title'), newTitle)
      await fillEditorField(page, 'insert-question-text', newContent, true)
      await page.getByTestId('save-new-question').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        newContent
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    for (const [
      __index,
      {
        identifier,
        content,
        availableElements,
        contentNew,
        unavailableElements,
      },
    ] of Array.from([
      {
        identifier: '2-0',
        content: data.SCMLAF.content,
        availableElements: [data.SCMLAF3.title],
        contentNew: data.SCMLAF3.content,
        unavailableElements: [
          data.SC3.title,
          data.SCML3.title,
          data.SCMLAF.title,
          data.SCMLAF2.title,
        ],
      },
      {
        identifier: '2-1',
        content: data.MCMLAF.content,
        availableElements: [data.MCMLAF3.title],
        contentNew: data.MCMLAF3.content,
        unavailableElements: [
          data.MC3.title,
          data.MCML3.title,
          data.MCMLAF.title,
          data.MCMLAF2.title,
        ],
      },
      {
        identifier: '2-2',
        content: data.KPMLAF.content,
        availableElements: [data.KPMLAF3.title],
        contentNew: data.KPMLAF3.content,
        unavailableElements: [
          data.KP3.title,
          data.KPML3.title,
          data.KPMLAF.title,
          data.KPMLAF2.title,
        ],
      },
    ]).entries()) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        content
      )
      await page
        .getByTestId(`replace-with-existing-element-${identifier}`)
        .click()
      for (const [__index, elementName] of Array.from(
        availableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'exist'
        )
      }
      for (const [__index, elementName] of Array.from(
        unavailableElements
      ).entries()) {
        await expectByAssertion(
          page.getByTestId(`select-existing-element-${elementName}`),
          'not.exist'
        )
      }
      await page
        .getByTestId(`select-existing-element-${availableElements[0]}`)
        .click()
      await page.getByTestId('confirm-select-existing-element').click()
      await expect(page.getByTestId('student-element-preview')).toContainText(
        contentNew
      )
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    await page.getByTestId(`live-quiz-template-submit`).click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.activity2.name}`),
      'exist'
    )
  })

  test('Verify that correct permissions and elements have been created on the answer collections contained in the template', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    for (const [__index, element] of Array.from([
      data.SC.title,
      data.MC.title,
      data.KP.title,
      data.NR.title,
      data.FT.title,
      data.SE.title,
      data.CS.title,
    ]).entries()) {
      await validateElement(page, { element })
    }
    for (const [__index, element] of Array.from([
      data.activity2.newElements.SC.title,
      data.activity2.newElements.MC.title,
      data.activity2.newElements.KP.title,
      data.activity2.newElements.NR.title,
      data.activity2.newElements.FT.title,
      data.activity2.newElements.SE.title,
      data.activity2.newElements.CS.title,
    ]).entries()) {
      await validateElement(page, { element })
    }
    await gotoCommit(page, `${env('URL_MANAGE')}/resources/answerCollections`)
    await expect(page.getByTestId('create-answer-collection')).toBeVisible()
    await expect(
      page.getByTestId(`answer-collection-${data.collection.name}`)
    ).toContainText(messages.manage.sharing.permissionsREAD)
    await expectByAssertion(
      page.getByTestId(`answer-collection-${data.collection3.name}`),
      'exist'
    )
  })

  test('Execute the live quiz and open the first block [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.activity2.name}`),
      'exist'
    )
    await startLiveQuiz(data.activity2.name)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Verify the content of the elements through the student view and answer the questions [4]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.waitForTimeout(1000)
    {
      const quizId = currentCockpitQuizId()
      aliases.set('quizId', quizId)
    }
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    await page.goto(env('URL_STUDENT'), { waitUntil: 'commit' })
    {
      const quizId = aliases.get('quizId')
      {
        const __originArgs = {
          username: env('STUDENT_USERNAME'),
          password: env('STUDENT_PASSWORD'),
          quizId: String(quizId),
          data: data,
        }
        const username = __originArgs.username
        const password = __originArgs.password
        await page.getByTestId('username-field').click()
        await typeInto(page.getByTestId('username-field'), username)
        await page.getByTestId('password-field').click()
        await typeInto(page.getByTestId('password-field'), password)
        await page.getByTestId('submit-login').click()
        await page.goto(`${env('URL_STUDENT')}/session/${quizId}`, {
          waitUntil: 'commit',
        })
        await acceptGamifiedLiveQuizAccountPrompt(
          page,
          data.activity2.displayName
        )
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.SC.content)
        await page.getByTestId('sc-0-answer-option-0').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.MC.content)
        await page.getByTestId('mc-1-answer-option-0').click()
        await page.getByTestId('mc-1-answer-option-1').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.KP.content)
        await page.getByTestId('toggle-kp-2-answer-0-correct').click()
        await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-3-correct').click()
        await page.getByTestId('student-submit-answer').click()
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.NR.content)
        await page.getByTestId('input-numerical-3').clear()
        await typeInto(page.getByTestId('input-numerical-3'), data.NR.answer)
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.FT.content)
        await typeInto(page.getByTestId('free-text-input-4'), data.FT.answer)
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.SE.content)
        await page.locator('[id="selection-5-field-0"]').click()
        await page
          .locator('[id="react-select-selection-5-field-0-option-1"]')
          .click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.CS.content)
      }
    }
    await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
  })

  test('Close the first block and open the second block of the live quiz [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Verify the content of the elements through the student view and answer the questions [5]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.waitForTimeout(1000)
    {
      const quizId = currentCockpitQuizId()
      aliases.set('quizId', quizId)
    }
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    await page.goto(env('URL_STUDENT'), { waitUntil: 'commit' })
    {
      const quizId = aliases.get('quizId')
      {
        const __originArgs = {
          username: env('STUDENT_USERNAME'),
          password: env('STUDENT_PASSWORD'),
          quizId: String(quizId),
          data: data,
        }
        const username = __originArgs.username
        const password = __originArgs.password
        await page.getByTestId('username-field').click()
        await typeInto(page.getByTestId('username-field'), username)
        await page.getByTestId('password-field').click()
        await typeInto(page.getByTestId('password-field'), password)
        await page.getByTestId('submit-login').click()
        await page.goto(`${env('URL_STUDENT')}/session/${quizId}`, {
          waitUntil: 'commit',
        })
        await acceptGamifiedLiveQuizAccountPrompt(
          page,
          data.activity2.displayName
        )
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.SC.content)
        await page.getByTestId('sc-0-answer-option-0').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.MC.content)
        await page.getByTestId('mc-1-answer-option-0').click()
        await page.getByTestId('mc-1-answer-option-1').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.KP.content)
        await page.getByTestId('toggle-kp-2-answer-0-correct').click()
        await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-3-correct').click()
        await page.getByTestId('student-submit-answer').click()
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.NR.content)
        await page.getByTestId('input-numerical-3').clear()
        await typeInto(
          page.getByTestId('input-numerical-3'),
          data.activity2.newElements.NR.answer
        )
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.FT.content)
        await typeInto(
          page.getByTestId('free-text-input-4'),
          data.activity2.newElements.FT.answer
        )
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.SE.content)
        await page.locator('[id="selection-5-field-0"]').click()
        await page
          .locator('[id="react-select-selection-5-field-0-option-1"]')
          .click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.activity2.newElements.CS.content)
      }
    }
    await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
  })

  test('Close the second block and open the third block of the live quiz [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Verify the content of the elements through the student view and answer the questions [6]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.waitForTimeout(1000)
    {
      const quizId = currentCockpitQuizId()
      aliases.set('quizId', quizId)
    }
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    await page.goto(env('URL_STUDENT'), { waitUntil: 'commit' })
    {
      const quizId = aliases.get('quizId')
      {
        const __originArgs = {
          username: env('STUDENT_USERNAME'),
          password: env('STUDENT_PASSWORD'),
          quizId: String(quizId),
          data: data,
        }
        const username = __originArgs.username
        const password = __originArgs.password
        await page.getByTestId('username-field').click()
        await typeInto(page.getByTestId('username-field'), username)
        await page.getByTestId('password-field').click()
        await typeInto(page.getByTestId('password-field'), password)
        await page.getByTestId('submit-login').click()
        await page.goto(`${env('URL_STUDENT')}/session/${quizId}`, {
          waitUntil: 'commit',
        })
        await acceptGamifiedLiveQuizAccountPrompt(
          page,
          data.activity2.displayName
        )
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.SCMLAF3.content)
        await page.getByTestId('sc-0-answer-option-0').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.MCMLAF3.content)
        await page.getByTestId('mc-1-answer-option-0').click()
        await page.getByTestId('mc-1-answer-option-1').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(data.KPMLAF3.content)
        await page.getByTestId('toggle-kp-2-answer-0-correct').click()
        await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-3-correct').click()
        await page.getByTestId('student-submit-answer').click()
      }
    }
    await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
  })

  test('Verify the content of the evaluation and close the live quiz [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.waitForTimeout(1000)
    {
      const quizId = currentCockpitQuizId()
      await page.goto(`${env('URL_MANAGE')}/quizzes/${quizId}/evaluation`, {
        waitUntil: 'commit',
      })
    }
    await expectByAssertion(page.getByText(data.SC.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.MC.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.KP.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.FT.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.SE.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.CS.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.SC.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.MC.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.KP.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.NR.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.FT.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.SE.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.activity2.newElements.CS.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.SCMLAF3.content).first(),
      'not.exist'
    )
    await page.getByTestId('show-results-evaluation').click()
    await expectByAssertion(
      page.getByText(data.SCMLAF3.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.MCMLAF3.content).first(),
      'not.exist'
    )
    await page.getByTestId('show-results-evaluation').click()
    await expectByAssertion(
      page.getByText(data.MCMLAF3.content).first(),
      'exist'
    )
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(
      page.getByText(data.KPMLAF3.content).first(),
      'not.exist'
    )
    await page.getByTestId('show-results-evaluation').click()
    await expectByAssertion(
      page.getByText(data.KPMLAF3.content).first(),
      'exist'
    )
    await page.goto(`${env('URL_MANAGE')}`, { waitUntil: 'commit' })
    await page.getByTestId('activities').click()
    await openLiveQuizCockpit(data.activity2.name)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Open the live quiz template in the catalog and enter new selection and case study elements with inline answer collections', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('catalog').click()
    await page
      .getByTestId(`catalog-object-${data.liveQuiz.template1.name}`)
      .click()
    await page.getByTestId('live-quiz-template-settings').click()
    await page.getByTestId('template-live-quiz-name').click()
    await page.getByTestId('template-live-quiz-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-name'),
      data.activity3.name
    )
    await page.getByTestId('template-live-quiz-display-name').click()
    await page.getByTestId('template-live-quiz-display-name').clear()
    await typeInto(
      page.getByTestId('template-live-quiz-display-name'),
      data.activity3.displayName
    )
    await expect(page.getByTestId('template-live-quiz-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await page.getByTestId('submit-template-settings').click()
    for (const [__index, identifier] of Array.from([
      '0-0',
      '0-1',
      '0-2',
      '0-3',
      '0-4',
    ]).entries()) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    await page.getByTestId(`create-new-element-template-0-5`).click()
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await typeInto(
      page.getByTestId('insert-question-title'),
      data.activity3.SETitle
    )
    await page.getByTestId('create-inline-answer-collection').click()
    await addInlineAnswerCollectionOptions(data.collection.options)
    await page.getByTestId('configure-number-of-inputs').click()
    await page.getByTestId('configure-number-of-inputs').clear()
    await typeInto(page.getByTestId('configure-number-of-inputs'), '2')
    await page.getByTestId('save-new-question').click()
    await page.getByTestId(`next-template-element-0-5`).click()
    await page.getByTestId(`create-new-element-template-0-6`).click()
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('insert-question-title').clear()
    await typeInto(
      page.getByTestId('insert-question-title'),
      data.activity3.CSTitle
    )
    await page.getByTestId('create-inline-answer-collection').click()
    await addInlineAnswerCollectionOptions(data.collection2.options)
    await page.getByTestId('save-new-question').click()
    await page.getByTestId(`next-template-element-0-6`).click()
    for (const [__index, identifier] of Array.from([
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
    ]).entries()) {
      await page.getByTestId(`accept-template-element-${identifier}`).click()
      await page.getByTestId(`next-template-element-${identifier}`).click()
    }
    await page.getByTestId(`live-quiz-template-submit`).click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.activity3.name}`),
      'exist'
    )
  })

  test('Verify that the elements and the answer collection have been created correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginInstitutionalCatalyst(page)
    await editElement(page, { element: data.activity3.SETitle })
    await expectByAssertion(
      page.getByTestId('create-inline-answer-collection'),
      'not.exist'
    )
    await page.locator('[id="selection-0-field-0"]').click()
    for (const [__index, value] of Array.from(
      data.collection.options
    ).entries()) {
      await expectByAssertion(page.getByText(value).first(), 'exist')
    }
    await page.getByTestId('close-element-modal').click()
    await editElement(page, { element: data.activity3.CSTitle })
    await expectByAssertion(
      page.getByTestId('create-inline-answer-collection'),
      'not.exist'
    )
    for (const [__index, item] of Array.from(
      data.collection2.options
    ).entries()) {
      await expect(page.getByTestId('choose-case-study-items')).toContainText(
        item
      )
    }
    await page.getByTestId('close-element-modal').click()
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    const SECollection = `AC: ${data.activity3.SETitle}`
    await page.getByTestId(`answer-collection-actions-${SECollection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await page.getByTestId('open-answer-collection-options').click()
    for (const [__index, item] of Array.from(
      data.collection.options
    ).entries()) {
      await expectByAssertion(
        page.getByTestId(`delete-answer-option-${item}`),
        'not.be.disabled'
      )
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${item}`),
        'not.be.disabled'
      )
    }
    await page.locator("[data-cy='close-answer-collection-edit-modal']").click()
    const CSCollection = `AC: ${data.activity3.CSTitle}`
    await page.getByTestId(`answer-collection-actions-${CSCollection}`).click()
    await page.getByTestId('edit-answer-collection').click()
    await page.getByTestId('open-answer-collection-options').click()
    for (const [__index, item] of Array.from(
      data.collection2.options
    ).entries()) {
      await expectByAssertion(
        page.getByTestId(`delete-answer-option-${item}`),
        'be.disabled'
      )
      await expectByAssertion(
        page.getByTestId(`edit-answer-option-${item}`),
        'not.be.disabled'
      )
    }
    await page.locator("[data-cy='close-answer-collection-edit-modal']").click()
  })

  test('Delete all created templates', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.template1.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${data.liveQuiz.template1.name}`)
      .click()
    await page.getByTestId('cancel-deletion').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.template1.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${data.liveQuiz.template1.name}`)
      .click()
    await page.getByTestId('confirm-template-deletion').click()
    await page.waitForTimeout(500)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.template2.name}`)
      .click()
    await page
      .getByTestId(`delete-template-${data.liveQuiz.template2.name}`)
      .click()
    await page.getByTestId('confirm-template-deletion').click()
    await page.waitForTimeout(500)
  })
})
