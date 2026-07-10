import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString, getFutureDate } from './helpers'

describe('Different live-quiz workflows', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('O-live-quiz.json').then((liveQuizData) => {
      this.data = { ...this.data, ...liveQuizData }
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  function openNextBlock() {
    cy.get('[data-cy="next-block-timeline"]', { timeout: 30000 })
      .should('be.visible')
      .and('not.be.disabled')
      .click()
    cy.get('[data-cy="next-block-timeline"]', { timeout: 30000 }).should(
      'be.visible'
    )
  }

  function visitEvaluationFromCockpit() {
    cy.get('[data-cy="evaluation-results-cockpit"]', { timeout: 30000 })
      .should('be.visible')
      .closest('a')
      .invoke('attr', 'href')
      .should('include', '/evaluation')
      .then((href) => {
        const evaluationHref = String(href)
        const evaluationUrl = evaluationHref.startsWith('http')
          ? evaluationHref
          : `${Cypress.env('URL_MANAGE')}${evaluationHref}`

        cy.visit({ url: evaluationUrl })
      })
    cy.get('[data-cy="change-chart-type"]', { timeout: 30000 }).should(
      'be.visible'
    )
  }

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  // ! Part 0: Preparation
  // #region
  it('Create the questions required in the live quiz test workflows', function () {
    cy.loginLecturer()

    // create single choice quesitons (with and without sample solution)
    cy.createQuestionSC({
      name: this.data.SC.title,
      content: this.data.SC.content,
      explanation: this.data.SC.explanation,
      choices: this.data.SC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      explanation: this.data.SCML.explanation,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCML2.title,
      content: this.data.SCML2.content,
      explanation: this.data.SCML2.explanation,
      choices: this.data.SCML2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create multiple choice questions (with and without sample solution)
    cy.createQuestionMC({
      name: this.data.MC.title,
      content: this.data.MC.content,
      explanation: this.data.MC.explanation,
      choices: this.data.MC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML.title,
      content: this.data.MCML.content,
      explanation: this.data.MCML.explanation,
      choices: this.data.MCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML2.title,
      content: this.data.MCML2.content,
      explanation: this.data.MCML2.explanation,
      choices: this.data.MCML2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create KPRIM questions (with and without sample solution)
    cy.createQuestionKPRIM({
      name: this.data.KP.title,
      content: this.data.KP.content,
      explanation: this.data.KP.explanation,
      choices: this.data.KP.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML.title,
      content: this.data.KPML.content,
      explanation: this.data.KPML.explanation,
      choices: this.data.KPML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML2.title,
      content: this.data.KPML2.content,
      explanation: this.data.KPML2.explanation,
      choices: this.data.KPML2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create numerical questions (with and without sample solution)
    cy.createQuestionNR({
      name: this.data.NR.title,
      content: this.data.NR.content,
      explanation: this.data.NR.explanation,
      ...this.data.NR.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      explanation: this.data.NRML.explanation,
      ...this.data.NRML.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML2.title,
      content: this.data.NRML2.content,
      explanation: this.data.NRML2.explanation,
      ...this.data.NRML2.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create free text questions (with and without sample solution)
    cy.createQuestionFT({
      name: this.data.FT.title,
      content: this.data.FT.content,
      explanation: this.data.FT.explanation,
      ...this.data.FT.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FTML.title,
      content: this.data.FTML.content,
      explanation: this.data.FTML.explanation,
      ...this.data.FTML.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FTML2.title,
      content: this.data.FTML2.content,
      explanation: this.data.FTML2.explanation,
      ...this.data.FTML2.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create answer collections that are required for selection and case study questions
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create selection and case study questions (with and without sample solution)
    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="elements-search-input"]', { timeout: 30000 }).should(
      'exist'
    )
    cy.createQuestionSE({
      name: this.data.SE.title,
      content: this.data.SE.content,
      explanation: this.data.SE.explanation,
      numberOfInputs: this.data.SE.inputs,
      collectionName: this.data.collection.name,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      explanation: this.data.SEML.explanation,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSE({
      name: this.data.SEML2.title,
      content: this.data.SEML2.content,
      explanation: this.data.SEML2.explanation,
      numberOfInputs: this.data.SEML2.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML2.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })

    // create case study questions (with and without sample solution)
    cy.createQuestionCS({
      name: this.data.CS.title,
      content: this.data.CS.content,
      explanation: this.data.CS.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CS.selectedItems.includes(i)
      ),
      criteria: this.data.CS.criteria,
      cases: this.data.CS.cases,
      solutions: this.data.CS.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionCS({
      name: this.data.CSML.title,
      content: this.data.CSML.content,
      explanation: this.data.CSML.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CSML.selectedItems.includes(i)
      ),
      criteria: this.data.CSML.criteria,
      cases: this.data.CSML.cases,
      solutions: this.data.CSML.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionCS({
      name: this.data.CSML2.title,
      content: this.data.CSML2.content,
      explanation: this.data.CSML2.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CSML2.selectedItems.includes(i)
      ),
      criteria: this.data.CSML2.criteria,
      cases: this.data.CSML2.cases,
      solutions: this.data.CSML2.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create content elements for both blocks
    cy.createContent({
      name: this.data.CT.title,
      content: this.data.CT.content,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createContent({
      name: this.data.CT2.title,
      content: this.data.CT2.content,
      userId: Cypress.env('LECTURER_ID'),
    })
  })
  // #endregion

  // ! Part 1: Live Quiz Creation
  // #region
  it('Test adding and deleting blocks to a live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="cancel-activity-creation"]').click()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type('TEMP')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type('TEMP DISPLAY')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
    cy.get('[data-cy="drop-elements-add-block"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 2)
    cy.get('[data-cy="delete-block-1"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
  })

  it('Create a live quiz with two questions and test all settings', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').type(
      this.data.course1.quiz.name
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').type(
      this.data.course1.quiz.displayName
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .realType(this.data.course1.quiz.description)
    cy.get('[data-cy="insert-live-description"]').contains(
      this.data.course1.quiz.description
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // course settings
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled') // not settings required
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.activityWizard.liveQuizNoCourse)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('not.exist')
    cy.selectOption('[data-cy="select-course"]', this.data.course1.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.selectOption('[data-cy="select-course"]', this.data.course2.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course2.name)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.selectOption('[data-cy="select-course"]', this.data.course1.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)

    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-default-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-default-points"]').click().type('-10') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-default-points"]').should('have.value', '10')
    cy.get('[data-cy="live-quiz-default-points"]')
      .click()
      .clear()
      .type(String(this.data.course1.quiz.defaultPoints))
    cy.get('[data-cy="live-quiz-default-points"]').should(
      'have.value',
      String(this.data.course1.quiz.defaultPoints)
    )
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-default-correct-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-default-correct-points"]').click().type('-20') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      '20'
    )
    cy.get('[data-cy="live-quiz-default-correct-points"]')
      .click()
      .clear()
      .type(String(this.data.course1.quiz.defaultCorrectPoints))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-max-bonus-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-max-bonus-points"]').click().type('-30') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should('have.value', '30')
    cy.get('[data-cy="live-quiz-max-bonus-points"]')
      .click()
      .clear()
      .type(String(this.data.course1.quiz.maxBonusPoints))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').click().type('-40') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should(
      'have.value',
      '40'
    )
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]')
      .click()
      .clear()
      .type(String(this.data.course1.quiz.timeToZeroBonus))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()

    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.activityWizard.multiplier1)
    cy.get('[data-cy="select-multiplier"]').realClick()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier2}"]`
    ).realClick()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )

    // toggle settings
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-feedback-enabled"]').click()
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )

    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').click()
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )

    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // add two questions in separate blocks, move blocks and add time limit of 10 for first and 20 for second block
    cy.get('[data-cy="next-or-submit"]').should('be.disabled') // empty element block cannot be submitted
    cy.get('[data-cy="delete-block-0"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled') // live quiz without blocks can be created
    cy.get('[data-cy="drop-elements-add-block"]').click()
    cy.get('[data-cy="next-or-submit"]').should('be.disabled') // recover previous state
    cy.createStacks({
      stacks: [
        { elements: [this.data.SC.title] },
        { elements: [this.data.SCML.title] },
      ],
      type: 'block',
    })

    // test sorting of blocks
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC.title.substring(0, 20))
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SC.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))

    // add time limits
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').type('10')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').type('20')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="close-block-countdown"]').click()

    // switch questions and check if settings persist
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Edit the created live quiz and check if all settings persist', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.course1.quiz.name}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course1.quiz.name}"]`
    ).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.course1.quiz.name}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      this.data.course1.quiz.name
    )
    cy.get('[data-cy="insert-live-quiz-name"]')
      .clear()
      .type(this.data.course1.quiz.nameNew)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      this.data.course1.quiz.displayName
    )
    cy.get('[data-cy="insert-live-display-name"]')
      .clear()
      .type(this.data.course1.quiz.displayNameNew)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.description)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .clear()
      .realType(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()

    // check settings and modify them
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
    cy.get('[data-cy="live-quiz-default-points"]').should(
      'have.value',
      this.data.course1.quiz.defaultPoints
    )
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      this.data.course1.quiz.defaultCorrectPoints
    )
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should(
      'have.value',
      this.data.course1.quiz.maxBonusPoints
    )
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should(
      'have.value',
      this.data.course1.quiz.timeToZeroBonus
    )
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )

    cy.get('[data-cy="select-multiplier"]').realClick()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier4}"]`
    ).realClick()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
    cy.get('[data-cy="set-feedback-enabled"]').click()
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check questions and modify them
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SC.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="block-time-limit"]').clear().type('15')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '15')
    cy.get('[data-cy="close-block-countdown"]').click()

    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="block-time-limit"]').clear().type('25')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '25')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC.title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    //  start editing again and check if correct values were saved
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      this.data.course1.quiz.nameNew
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      this.data.course1.quiz.displayNameNew
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC.title.substring(0, 20))
    cy.get('[data-cy="open-block-0-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '25')
    cy.get('[data-cy="close-block-countdown"]').click()
    cy.get('[data-cy="open-block-1-countdown"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '15')
    cy.get('[data-cy="close-block-countdown"]').click()
  })

  it('Duplicate the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.course1.quiz.nameNew}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).should('exist')

    // duplicate the live quiz and verify that the content is the same as for the original live quiz
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="duplicate-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      this.data.course1.quiz.nameDupl
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      this.data.course1.quiz.displayNameNew
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.course1.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC.title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.nameDupl}"]`
    ).should('exist')
  })

  it('Cleanup: Delete the duplicated live quiz', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.course1.quiz.nameDupl}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.nameDupl}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course1.quiz.nameDupl}"]`
    ).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course1.quiz.nameDupl}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course1.quiz.nameDupl}"]`
    ).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course1.quiz.nameDupl}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.course1.quiz.nameDupl).should('not.exist')
  })
  // #endregion

  // ! Part 2: Live Quiz Control
  // #region
  it('Start the created live quizzes, abort it, and restart & complete it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.course1.quiz.nameNew}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).should('exist')

    // start live quiz and then abort it
    cy.get(
      `[data-cy="start-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get('[data-cy="abort-live-quiz-cockpit"]').click()
    cy.get('[data-cy="abort-cancel-live-quiz"]').click()
    cy.get('[data-cy="abort-live-quiz-cockpit"]').click()
    cy.get('[data-cy="lq-deletion-responses-confirm"]').should('not.exist')
    cy.get('[data-cy="lq-deletion-feedbacks-confirm"]').should('not.exist')
    cy.get('[data-cy="lq-deletion-confusion-feedbacks-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="lq-deletion-leaderboard-entries-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="confirm-cancel-live-quiz"]')
      .should('not.be.disabled')
      .click()

    // start live quiz and then skip through the blocks
    cy.get(
      `[data-cy="start-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Cleanup: Delete the created and completed live quiz', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click()

    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.course1.quiz.nameNew}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist') // ? azure functions do not work in cypress CI actions
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.course1.quiz.nameNew).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedLiveQuiz', {
      lqName: this.data.course1.quiz.nameNew,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion

  // ! Part 3: Full Live Quiz Execution Cycle
  // #region
  it('Create and start a live quiz with all question types (with and without sample solution) to test the entire execution cycle', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-live-quiz-name"]').type(
      this.data.course2.quiz.name
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-live-display-name"]').type(
      this.data.course2.quiz.displayName
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .realType(this.data.course2.quiz.description)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course2.quiz.description)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.activityWizard.liveQuizNoCourse)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.selectOption('[data-cy="select-course"]', this.data.course1.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.selectOption('[data-cy="select-course"]', this.data.course2.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course2.name)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.selectOption('[data-cy="select-course"]', this.data.course1.name)
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.activityWizard.multiplier1)
    cy.get('[data-cy="select-multiplier"]').realClick()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier2}"]`
    ).realClick()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Questions
    cy.createStacks({
      stacks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
            this.data.NR.title,
            this.data.FT.title,
            this.data.SE.title,
            this.data.CS.title,
            this.data.CT.title,
          ],
        },
        {
          elements: [
            this.data.SCML2.title,
            this.data.MCML2.title,
            this.data.KPML2.title,
            this.data.NRML2.title,
            this.data.FTML2.title,
            this.data.SEML2.title,
            this.data.CSML2.title,
            this.data.CT2.title,
          ],
        },
      ],
      type: 'block',
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course2.quiz.name}"]`
    ).should('exist')

    // start live quiz and first block
    cy.get(`[data-cy="start-live-quiz-${this.data.course2.quiz.name}"]`).click()
    cy.wait(1000)
  })

  it('Check that the live quiz description is correctly shown to students', function () {
    // check if live quiz description is shown to students on desktop view
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
    cy.get('[data-cy="live-quiz-description"]', { timeout: 15_000 })
      .should('be.visible')
      .and('contain', this.data.course2.quiz.displayName)

    // check if the description is also shown correctly on mobile view
    cy.viewport('iphone-x')
    cy.get('[data-cy="live-quiz-description"]').contains(
      this.data.course2.quiz.displayName
    )
  })

  it('Start the first block of the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Respond to the first block of the running live quiz from the student view', function () {
    // login student and answer first question
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-0"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // provide feedback while moderation is enabled
    cy.get('[data-cy="feedback-input"]')
      .click()
      .type(this.data.course2.quiz.feedbackDesktop)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('not.exist')
    cy.wait(500)
  })

  it('Test the live quiz functionalities on mobile devices', function () {
    // login student again on mobile, test navigation and answer second question
    cy.viewport('iphone-x')
    cy.loginStudent({ preserveClientState: true })
    cy.findByText(this.data.course2.quiz.displayName).should('exist').click()
    cy.findByText(this.data.NR.content, { timeout: 10000 }).should('exist')
    cy.findByText(messages.pwa.liveQuiz.allQuestionsAnswered).should(
      'not.exist'
    )

    cy.get('[data-cy="mobile-menu-leaderboard"]').click()
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="mobile-menu-questions"]').click()
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').clear().type(this.data.NR.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-4"]').type(this.data.FT.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').should('not.be.disabled') // partial responses allowed
    cy.get('[id="selection-5-field-1"]').click()
    cy.get('[id="react-select-selection-5-field-1-option-2"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.answerCaseStudy({
      elementIx: 6,
      answers: this.data.CS.answers,
      cases: this.data.CS.cases,
      criteria: this.data.CS.criteria,
      initialValidation: cy
        .get('[data-cy="student-submit-answer"]')
        .should('be.disabled'),
      sequentialUI: true,
    })
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').click() // no answer required for content element
    cy.wait(500)

    // check that message is shown regarding all questions having been answered
    cy.findByText(messages.pwa.liveQuiz.allQuestionsAnswered).should('exist')

    // provide feedback while moderation is enabled
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="feedback-input"]')
      .click()
      .type(this.data.course2.quiz.feedbackMobile)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('not.exist')
    cy.findByText(this.data.course2.quiz.feedbackMobile).should('not.exist')
    cy.wait(500)
  })

  it('Start the second block of the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Make feedbacks visible, respond to one and disable moderation', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    // make both feedbacks visible and respond to one of them (moderation enabled)
    cy.get(
      `[data-cy="publish-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).should('exist')
    cy.get(
      `[data-cy="publish-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()
    cy.get(
      `[data-cy="publish-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).should('exist')
    cy.get(
      `[data-cy="publish-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="open-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()
    cy.get(
      `[data-cy="respond-to-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    )
      .click()
      .type(this.data.course2.quiz.feedbackResponse)
    cy.get(
      `[data-cy="submit-feedback-response-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()

    // pin and unpin feedback
    cy.get(
      `[data-cy="open-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="pin-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="pin-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()

    // disable moderation
    cy.get('[data-cy="toggle-moderation"]').click()
  })

  it('Answer questions in second block from student view', function () {
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()

    // SC question - skipping not permitted, partial answers not possible
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // MC question - skipping not permitted, partial answers not possible
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-0"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // KP question - skipping not permitted, partial answers not possible
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // NR question - skipping not permitted, partial answers not possible
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').clear().type(this.data.NR.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // FT question - skipping not permitted, partial answers not possible
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-4"]').type(this.data.FT.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // SE question - submit partial answer (only submit selection for one of two inputs)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // CS question - skipping not permitted, partial answers not possible
    cy.answerCaseStudy({
      elementIx: 6,
      answers: this.data.CSML2.answers,
      cases: this.data.CSML2.cases,
      criteria: this.data.CSML2.criteria,
      initialValidation: cy
        .get('[data-cy="student-submit-answer"]')
        .should('be.disabled'),
      sequentialUI: true,
    })
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // CT element - no answer required
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // verify that all questions have been answered (persists on reload)
    cy.findByText(messages.pwa.liveQuiz.allQuestionsAnswered).should('exist')
    cy.reload()
    cy.findByText(messages.pwa.liveQuiz.allQuestionsAnswered).should('exist')
  })

  it('Verify that the feedbacks and the given feedback response are visible to the student', function () {
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()

    // check that feedbacks are now visible and upvote them
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackMobile).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackResponse).should('exist')
    cy.get(
      `[data-cy="feedback-upvote-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="feedback-response-upvote-${this.data.course2.quiz.feedbackResponse}"]`
    ).click()

    // add another feedback, which should be immediately visible (no moderation)
    cy.get('[data-cy="feedback-input"]')
      .click()
      .type(this.data.course2.quiz.feedbackDesktop2)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop2).should('exist')
    cy.wait(500)
  })

  it('Check out the public evaluation links accessible through the embedding modal', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    // read required public evaluation links
    cy.get('[data-cy="embed-evaluation-cockpit"]').click()
    cy.get('[data-cy="open-embedding-link-generic-evaluation"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkEvaluation')
      })
    cy.get('[data-cy="open-embedding-link-question-0"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkQuestion0')
      })
    cy.get('[data-cy="open-embedding-link-question-6"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkQuestion6')
      })
    cy.get('[data-cy="open-embedding-link-question-7"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkQuestion7')
      })
    cy.get('[data-cy="open-embedding-link-question-9"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkQuestion9')
      })
    cy.get('[data-cy="open-embedding-link-leaderboard"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkLeaderboard')
      })

    // log out as a lecturer
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.wait(500)
    cy.reload()
    cy.origin(Cypress.env('URL_AUTH'), () => {
      cy.get('button[data-cy="tos-checkbox"]').should('exist')
    })

    // check out generic evaluation
    cy.get('@publicLinkEvaluation').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.SCML.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MCML.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.SCML.content).should('exist')

    // check out specific question evaluation
    cy.get('@publicLinkQuestion0').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.SCML.content).should('exist')
    cy.get('@publicLinkQuestion6').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.CS.content).should('exist')
    cy.get('@publicLinkQuestion7').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.CT.content).should('exist')
    cy.get('@publicLinkQuestion9').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.MCML2.content).should('exist')

    // check out leaderboard
    cy.get('@publicLinkLeaderboard').then((link) => {
      cy.visit(String(link))
    })

    // sample solution / explanation settings
    // verify that solution and explanation are only enabled for completed blocks
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    cy.get('[data-cy="embed-evaluation-cockpit"]').click()
    cy.get('[data-cy="embedding-show-solution-switch"]').click() // enable sample solution on evaluation
    cy.get('[data-cy="embedding-show-explanation-switch"]').click() // enable sample explanation on evaluation

    // SC question with sample solution and explanation (closed block)
    cy.get('[data-cy="open-embedding-link-question-0"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink0')
      })
    // NR question without sample solution but with explanation (closed block)
    cy.get('[data-cy="open-embedding-link-question-3"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink3')
      })

    // CT element without sample solution or explanation (closed block)
    cy.get('[data-cy="open-embedding-link-question-7"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink7')
      })

    // MC question with sample solution and explanation (active block)
    cy.get('[data-cy="open-embedding-link-question-9"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink9')
      })

    // for past SC question with sample solution and explanation, both switches should be active
    cy.get('@solutionEvaluationLink0').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.SCML.content).should('exist')
    cy.findByText(this.data.SCML.explanation).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    // for past NR question without sample solution but with explanation (closed block)
    cy.get('@solutionEvaluationLink3').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.NR.content).should('exist')
    cy.findByText(this.data.NR.explanation).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should('not.exist')
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    // for content elements, neither the sample solution nor the explanation switch should exist
    cy.get('@solutionEvaluationLink7').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.CT.content).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should('not.exist')
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should('not.exist')

    // for the active block, both the sample solution and explanation should be unchecked and disabled
    cy.get('@solutionEvaluationLink9').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.MCML2.content).should('exist')
    cy.findByText(this.data.MCML2.explanation).should('not.exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="evaluation-footer-show-solution"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
  })

  it('Check out the evaluation view of the live quiz and its content', function () {
    cy.loginLecturer()

    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.visit(`${Cypress.env('URL_MANAGE')}/quizzes/${quizId}/evaluation`)
    })

    // check content of evaluation view
    cy.findByText(this.data.SCML.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MCML.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.SCML.content).should('exist')

    // test instance navigation
    cy.get('[data-cy="evaluate-question-select"]')
      .should('exist')
      .contains(this.data.SCML.title)
    cy.get('[data-cy="evaluate-question-select"]').realClick()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.KPML.title}"]`
    ).realClick()
    cy.get('[data-cy="evaluate-question-select"]').contains(
      this.data.KPML.title
    )
    cy.get('[data-cy="evaluate-question-select"]').realClick()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.SCML.title}"]`
    ).realClick()
    cy.get('[data-cy="evaluate-question-select"]').contains(
      this.data.SCML.title
    )

    // navigate forwards and backwards through all questions
    // results of closed blocks should be shown directly - active blocks require confirmation
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KPML.title).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.NR.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.FT.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SE.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.CS.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.CT.content).should('exist')

    // results of active block should only be shown after confirmation
    // on second visit (after confirmation), no additional measures are required
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SCML2.content).should('not.exist')
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.SCML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.MCML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.KPML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.NRML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.FTML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.SEML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.findByText(this.data.CSML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.CT2.content).should('exist') // content elements are always displayed (even without results confirmation)
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.CSML2.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click().click().click()
    cy.findByText(this.data.NRML2.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click().click().click()
    cy.findByText(this.data.SCML2.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.CT.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.CS.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.SE.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.FT.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click().click().click()
    cy.findByText(this.data.MCML.title).should('exist')

    // test navigation through blocks
    cy.get('[data-cy="evaluate-stack-1"]').click()
    cy.findByText(this.data.SCML2.content).should('exist')
    cy.get('[data-cy="evaluate-stack-0"]').click()
    cy.findByText(this.data.SCML.title).should('exist')
    cy.get('[data-cy="evaluate-stack-1"]').click()
    cy.findByText(this.data.SCML2.content).should('exist')
  })

  it('Close block and delete feedback / feedback response', function () {
    cy.loginLecturer()

    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()

    // delete feedback mobile and response to desktop feedback
    cy.get(
      `[data-cy="delete-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get('[data-cy="confirm-feedback-deletion"]').click()
    cy.get(
      `[data-cy="open-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()
    cy.get(
      `[data-cy="delete-response-${this.data.course2.quiz.feedbackResponse}"]`
    ).click()
  })

  it('Verify that after closing the active live quiz block, the sample solution is shown', function () {
    cy.loginLecturer()

    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    cy.get('[data-cy="embed-evaluation-cockpit"]').click()
    cy.get('[data-cy="embedding-show-solution-switch"]').click() // enable sample solution on evaluation
    cy.get('[data-cy="embedding-show-explanation-switch"]').click() // enable sample explanation on evaluation

    // SC question with sample solution and explanation (closed block)
    cy.get('[data-cy="open-embedding-link-question-0"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink0')
      })
    // NR question without sample solution but with explanation (closed block)
    cy.get('[data-cy="open-embedding-link-question-3"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink3')
      })

    // CT element without sample solution or explanation (closed block)
    cy.get('[data-cy="open-embedding-link-question-7"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink7')
      })

    // MC question with sample solution and explanation (active block)
    cy.get('[data-cy="open-embedding-link-question-9"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('solutionEvaluationLink9')
      })

    // for past SC question with sample solution and explanation, both switches should be active
    cy.get('@solutionEvaluationLink0').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.SCML.content).should('exist')
    cy.findByText(this.data.SCML.explanation).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    // for past NR question without sample solution but with explanation (closed block)
    cy.get('@solutionEvaluationLink3').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.NR.content).should('exist')
    cy.findByText(this.data.NR.explanation).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should('not.exist')
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    // for content elements, neither the sample solution nor the explanation switch should exist
    cy.get('@solutionEvaluationLink7').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.CT.content).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should('not.exist')
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should('not.exist')

    // for the active block, both the sample solution and explanation should be unchecked and disabled
    cy.get('@solutionEvaluationLink9').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.MCML2.content).should('exist')
    cy.findByText(this.data.MCML2.explanation).should('exist')
    cy.get('[data-cy="evaluation-footer-show-solution"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="evaluation-footer-show-solution"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="evaluation-footer-show-explanation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
  })

  it('Check that the deleted feedbacks are not visible anymore', function () {
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackDesktop2).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackMobile).should('not.exist')
    cy.findByText(this.data.course2.quiz.feedbackResponse).should('not.exist')
  })

  it('End live quiz on lecturer cockpit', function () {
    cy.loginLecturer()

    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Cleanup: Delete the live quiz used for the full cycle test', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click()

    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.course2.quiz.name}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.course2.quiz.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course2.quiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course2.quiz.name}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get('body').contains('16 response(s) in this live quiz')
    cy.get(`[data-cy="confirm-deletion-responses"]`).realClick()
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).click()
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('not.be.disabled')
    cy.get(`[data-cy="confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.course2.quiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course2.quiz.name}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).realClick()
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.course2.quiz.name).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedLiveQuiz', {
      lqName: this.data.course2.quiz.name,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion

  // ! Part 4: Verify Editing / Duplication with Updated / Deleted Questions
  // #region
  it('Create live quiz with a single SC question', function () {
    cy.loginLecturer()

    // create single choice question and live quiz
    cy.createQuestionSC({
      name: this.data.SC2.title,
      content: this.data.SC2.content,
      choices: this.data.SC2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createLiveQuiz({
      name: this.data.liveQuiz.name,
      displayName: this.data.liveQuiz.displayName,
      courseName: this.data.liveQuiz.course,
      blocks: [{ elements: [this.data.SC2.title] }],
    })

    // open the overview and check its content
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-name-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SC2.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Edit the single choice question, edit and save the unmodified live quiz -> verify that nothing changed', function () {
    cy.loginLecturer()

    // modify single choice question
    cy.editElement({ element: this.data.SC2.title })
    cy.get('[data-cy="instance-update-switch"]').click() // deactivate instance updates (on by default)
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.liveQuiz.newSCTitle)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .realType(this.data.liveQuiz.newSCContent)
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(1000) // wait for the question to be saved and the modal to be closed

    // edit and save the live quiz without changing the question content
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-block-0"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and check its content
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-name-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SC2.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Add the modified single choice question and a multiple choice question to the live quiz', function () {
    cy.loginLecturer()

    // create single choice question and live quiz
    cy.createQuestionMC({
      name: this.data.MC2.title,
      content: this.data.MC2.content,
      choices: this.data.MC2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // edit the live quiz and add the modified SC and the new MC question
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-block-0"]').should('exist')

    cy.dragAndDropElement({
      element: this.data.liveQuiz.newSCTitle,
      target: 'drop-elements-block-0',
    })
    cy.get(`[data-cy="element-1-block-0"]`).contains(
      this.data.liveQuiz.newSCTitle.substring(0, 20)
    )

    cy.get('[data-cy="drop-elements-add-block"]').click()
    cy.dragAndDropElement({
      element: this.data.MC2.title,
      target: 'drop-elements-block-1',
    })
    cy.get(`[data-cy="element-0-block-1"]`).should('exist')
    cy.get(`[data-cy="element-0-block-1"]`).contains(
      this.data.MC2.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and check its content
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-name-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SC2.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      this.data.liveQuiz.newSCTitle
    )
    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.MC2.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Delete the two created elements and verify that the live quiz content is not modified on edit', function () {
    cy.loginLecturer()

    // modify single choice question
    cy.deleteElement({ elementName: this.data.liveQuiz.newSCTitle })
    cy.deleteElement({ elementName: this.data.MC2.title })

    // edit and save the live quiz without changing the question content
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and check its content
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-name-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SC2.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(
      this.data.liveQuiz.newSCTitle
    )
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.MC2.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Execute the live quiz, answer the questions and verify the question contents', function () {
    // start the live quiz and open the first block
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="start-live-quiz-${this.data.liveQuiz.name}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

    // switch to the student app and answer the elements in the first block
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.origin(
      Cypress.env('URL_STUDENT'),
      {
        args: {
          username: Cypress.env('STUDENT_USERNAME'),
          password: Cypress.env('STUDENT_PASSWORD'),
          data: this.data,
        },
      },
      ({ username, password, data }) => {
        cy.get('[data-cy="username-field"]').click().type(username)
        cy.get('[data-cy="password-field"]').click().type(password)
        cy.get('[data-cy="submit-login"]').click()
        cy.get(`[data-cy="live-quiz-${data.liveQuiz.displayName}"]`).click()

        // answer the elements in the first block
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="instance-question-content"]').contains(
          data.MC2.content
        )
        cy.get('[data-cy="mc-0-answer-option-1"]').click()
        cy.get('[data-cy="mc-0-answer-option-2"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
      }
    )
  })

  it('Open the next block and answer the multiple choice question in the second block', function () {
    // open the next block
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.liveQuiz.name}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

    // switch to the student app and answer the elements in the second block
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.origin(
      Cypress.env('URL_STUDENT'),
      {
        args: {
          username: Cypress.env('STUDENT_USERNAME'),
          password: Cypress.env('STUDENT_PASSWORD'),
          data: this.data,
        },
      },
      ({ username, password, data }) => {
        cy.get('[data-cy="username-field"]').click().type(username)
        cy.get('[data-cy="password-field"]').click().type(password)
        cy.get('[data-cy="submit-login"]').click()
        cy.get(`[data-cy="live-quiz-${data.liveQuiz.displayName}"]`).click()

        // answer the elements in the second block
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="instance-question-content"]').contains(
          data.SC2.content
        )
        cy.get('[data-cy="sc-0-answer-option-0"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="instance-question-content"]').contains(
          data.liveQuiz.newSCContent
        )
        cy.get('[data-cy="sc-1-answer-option-0"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
      }
    )
  })

  it('Close the second block of the live quiz and end it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.liveQuiz.name}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Duplicate the live quiz and check that the same questions are contained therein', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.liveQuiz.name}{enter}`
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="duplicate-live-quiz-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]')
      .clear()
      .type(this.data.liveQuiz.duplicateName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]')
      .clear()
      .type(this.data.liveQuiz.duplicateDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.liveQuiz.course)
    cy.get('[data-cy="select-course"]').contains(this.data.liveQuiz.course)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.MC2.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC2.title.substring(0, 20))
    cy.get('[data-cy="element-1-block-1"]')
      .should('exist')
      .should('contain', this.data.liveQuiz.newSCTitle.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.duplicateName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.liveQuiz.duplicateName}"]`
    ).click()

    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SC2.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(
      this.data.liveQuiz.newSCTitle
    )
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.MC2.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Execute the duplicated live quiz, answer the questions and verify the question contents', function () {
    // start the live quiz and open the first block
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="start-live-quiz-${this.data.liveQuiz.duplicateName}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

    // switch to the student app and answer the elements in the first block
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.origin(
      Cypress.env('URL_STUDENT'),
      {
        args: {
          username: Cypress.env('STUDENT_USERNAME'),
          password: Cypress.env('STUDENT_PASSWORD'),
          data: this.data,
        },
      },
      ({ username, password, data }) => {
        cy.get('[data-cy="username-field"]').click().type(username)
        cy.get('[data-cy="password-field"]').click().type(password)
        cy.get('[data-cy="submit-login"]').click()
        cy.get(
          `[data-cy="live-quiz-${data.liveQuiz.duplicateDisplayName}"]`
        ).click()

        // answer the elements in the first block
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="instance-question-content"]').contains(
          data.MC2.content
        )
        cy.get('[data-cy="mc-0-answer-option-1"]').click()
        cy.get('[data-cy="mc-0-answer-option-2"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
      }
    )
  })

  it('Open the next block and answer the multiple choice question in the second block', function () {
    // open the next block
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.liveQuiz.duplicateName}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

    // switch to the student app and answer the elements in the second block
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.origin(
      Cypress.env('URL_STUDENT'),
      {
        args: {
          username: Cypress.env('STUDENT_USERNAME'),
          password: Cypress.env('STUDENT_PASSWORD'),
          data: this.data,
        },
      },
      ({ username, password, data }) => {
        cy.get('[data-cy="username-field"]').click().type(username)
        cy.get('[data-cy="password-field"]').click().type(password)
        cy.get('[data-cy="submit-login"]').click()
        cy.get(
          `[data-cy="live-quiz-${data.liveQuiz.duplicateDisplayName}"]`
        ).click()

        // answer the elements in the second block
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="instance-question-content"]').contains(
          data.SC2.content
        )
        cy.get('[data-cy="sc-0-answer-option-0"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="instance-question-content"]').contains(
          data.liveQuiz.newSCContent
        )
        cy.get('[data-cy="sc-1-answer-option-0"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
      }
    )
  })

  it('Close the second block of the live quiz and end it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.liveQuiz.duplicateName}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Delete the created live quizzes', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="delete-live-quiz-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).realClick()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).realClick()

    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.duplicateName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.liveQuiz.duplicateName}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).realClick()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).realClick()
  })
  // #endregion

  // ! Part 5: Sharing of Live Quizzes
  // #region
  function verifyLiveQuizDetailsModalContent(activityName: string, data: any) {
    cy.get(`[data-cy="activity-name-${activityName}"]`).click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(
      data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      data.MCML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-2"]').contains(
      data.KPML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-3"]').contains(
      data.NRML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-4"]').contains(
      data.FTML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-5"]').contains(
      data.SEML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-6"]').contains(
      data.CSML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-7"]').contains(
      data.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="close-activity-details-modal"]').click()
  }

  function verifyLiveQuizOwnerPermissions(data: any) {
    // for a draft live quiz the following options should be available: start, edit, qr code, dropdown: embed, duplicate, convert to template, share, delete
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz1}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz1}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="template-from-live-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${data.sharing.quiz1}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled live quiz the following options should be available: start, duplicate, qr code, dropdown: embed, share, delete
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz2}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz2}"]`).click()
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${data.sharing.quiz2}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running live quiz the following options should be available: cockpit, evaluation, qr code, dropdown: embed, duplicate, share
    cy.get(`[data-cy="live-quiz-cockpit-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz3}"]`).click()
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz3}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)

    // for a completed live quiz the following options should be available: evaluation, duplicate, embed, dropdown: share, delete
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz4}"]`).click()
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz4}"]`).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${data.sharing.quiz4}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  function verifyLiveQuizREADPermissions(data: any, groupPermission: boolean) {
    cy.loginIndividualCatalyst()

    // elements should not be shared for users with READ permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // on draft activities, the following actions should be available: qr code, embed, remove, no dropdown
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz1}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz1}"]`).click()
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz1}"]`).should(
      'exist'
    )

    if (!groupPermission) {
      cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz1}"]`).should(
        'exist'
      )
    }
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)

    // on scheduled activities, the following actions should be available: qr code, embed, remove, no dropdown
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz2}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz2}"]`).click()
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz2}"]`).should(
      'exist'
    )

    if (!groupPermission) {
      cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz2}"]`).should(
        'exist'
      )
    }
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)

    // on published activities, the following actions should be available: evaluation, qr code, embed, dropdown: remove
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz3}"]`).click()
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz3}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)

    // on ended activities, the following actions should be available: evaluation, embed, remove, no dropdown
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz4}"]`).click()
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    if (!groupPermission) {
      cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz4}"]`).should(
        'exist'
      )
    }
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  function verifyLiveQuizEXECUTEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    cy.loginInstitutionalCatalyst()

    // elements should not be shared for users with EXECUTE permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // on draft activities, the following actions should be available: start, qr code, embed, dropdown: remove
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz1}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz1}"]`).click()
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz1}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)

    // on scheduled activities, the following actions should be available: start, qr code, embed, dropdown: remove
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz2}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz2}"]`).click()
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz2}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)

    // on published activities, the following actions should be available: cockpit, evaluation, qr code, dropdown: embed, remove
    cy.get(`[data-cy="live-quiz-cockpit-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz3}"]`).click()
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)

    // on ended activities, the following actions should be available: evaluation, embed, remove, no dropdown
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz4}"]`).click()
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    if (!groupPermission) {
      cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz4}"]`).should(
        'exist'
      )
    }
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  function verifyLiveQuizWRITEPermissions(data: any, groupPermission: boolean) {
    cy.loginInstitutionalCatalyst2()

    // elements should not be shared for users with WRITE permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
      }
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="change-activity-name-${data.sharing.quiz4}"]`).should(
      'not.exist'
    ) // name change action not available for ended activities

    // on draft activities, the following actions should be available: start, edit, qr code, dropdown: embed, remove
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz1}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz1}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)

    // on scheduled activities, the following actions should be available: start, qr code, embed, dropdown: remove
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz2}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz2}"]`).click()
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)

    // on published activities, the following actions should be available: cockpit, evaluation, qr code, dropdown: embed, remove
    cy.get(`[data-cy="live-quiz-cockpit-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz3}"]`).click()
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)

    // on ended activities, the following actions should be available: evaluation, embed, remove, no dropdown
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz4}"]`).click()
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    if (!groupPermission) {
      cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz4}"]`).should(
        'exist'
      )
    }
    cy.get('body').type('{esc}') // close dropdown

    verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  function verifyLiveQuizADMINPermissions(data: any, groupPermission: boolean) {
    cy.loginInstitutionalCatalyst3()

    // elements should be shared for users with ADMIN permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
      }
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="change-activity-name-${data.sharing.quiz4}"]`).should(
      'not.exist'
    ) // name change action not available for ended activities

    // for a draft live quiz the following options should be available: start, edit, qr code, dropdown: embed, duplicate, convert to template, share, delete
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz1}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz1}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="template-from-live-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-live-quiz-${data.sharing.quiz1}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled live quiz the following options should be available: start, duplicate, qr code, dropdown: embed, share, delete
    cy.get(`[data-cy="start-live-quiz-${data.sharing.quiz2}"]`).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz2}"]`).click()
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-live-quiz-${data.sharing.quiz2}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running live quiz the following options should be available: cockpit, evaluation, qr code, dropdown: embed, duplicate, share
    cy.get(`[data-cy="live-quiz-cockpit-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz3}"]`).click()
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-qr-modal-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)

    // for a completed live quiz the following options should be available: evaluation, duplicate, embed, dropdown: share, delete
    cy.get(`[data-cy="live-quiz-evaluation-${data.sharing.quiz4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${data.sharing.quiz4}"]`).click()
    cy.get(`[data-cy="duplicate-live-quiz-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="show-embedding-modal-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.quiz4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-live-quiz-${data.sharing.quiz4}"]`).should('exist')
    cy.get(`[data-cy="remove-live-quiz-${data.sharing.quiz4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-live-quiz-${data.sharing.quiz4}"]`).should('exist')

    cy.get('body').type('{esc}') // close dropdown
    verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  function verifyREADPermissionsRevoked(data: any) {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared live quizzes should no longer be visible
    cy.wrap([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('not.exist')
    })
  }

  function verifyEXECUTEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared live quizzes should no longer be visible
    cy.wrap([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('not.exist')
    })
  }

  function verifyWRITEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="activities"]').click()

    // previously shared live quizzes should no longer be visible
    cy.wrap([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('not.exist')
    })
  }

  function verifyADMINPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst3()

    // previously indirectly shared elements should no longer be visible
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((element: string) => {
      cy.validateElement({ element, shouldExist: false })
    })

    // previously shared live quizzes should no longer be visible
    cy.get('[data-cy="activities"]').click()
    const quizzes = [
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]
    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('not.exist')
    })
  }

  it('Create four different live quizzes and make sure that all required actions are shown to the object owner', function () {
    cy.loginLecturer()

    // create four different live quizzes
    for (let i = 1; i <= 4; i++) {
      cy.createLiveQuiz({
        name: this.data.sharing[`quiz${i}`],
        displayName: this.data.sharing[`quiz${i}Display`],
        blocks: [
          {
            elements: [
              this.data.SCML.title,
              this.data.MCML.title,
              this.data.KPML.title,
              this.data.NRML.title,
              this.data.FTML.title,
              this.data.SEML.title,
              this.data.CSML.title,
              this.data.CT.title,
            ],
          },
        ],
      })
      cy.get('[data-cy="create-new-activity"]').click()
    }

    // change the status of the second live quiz to scheduled
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.quiz2,
      activityType: 'LIVE_QUIZ',
      status: 'SCHEDULED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Live quiz to change status was not found in the database'
        )
      }
    })

    // change the status of the third live quiz to published
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.quiz3,
      activityType: 'LIVE_QUIZ',
      status: 'PUBLISHED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Live quiz to change status was not found in the database'
        )
      }
    })

    // change the status of the fourth live quiz to ended
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.quiz4,
      activityType: 'LIVE_QUIZ',
      status: 'ENDED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Live quiz to change status was not found in the database'
        )
      }
    })
    cy.reload()

    // verify that the owner sees all the correct actions
    cy.get('[data-cy="activities"]').click()
    verifyLiveQuizOwnerPermissions(this.data)
  })

  it('Share the live quizzes individually with different users and different permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    // grant READ, EXECUTE, WRITE and ADMIN permissions on all live quizzes to the users 2, 3, 4 and 5, respectively
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()

      // grant READ permission to user 2
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_IND_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsREAD)

      // grant EXECUTE permission to user 3
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_INST_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsEXECUTE)

      // grand WRITE permissions to user 4
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
      )
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // grant ADMIN permissions to user 5
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_INST3_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsADMIN
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`
      )
        .should('exist')
        .contains(messages.manage.sharing.permissionsADMIN)

      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Log in as the user with READ permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizREADPermissions(this.data, false)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizEXECUTEPermissions(this.data, false)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizWRITEPermissions(this.data, false)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizADMINPermissions(this.data, false)
  })

  it('Revoke the direct individual permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]
    const users = [
      Cypress.env('LECTURER_IND_SHORTNAME'),
      Cypress.env('LECTURER_INST_SHORTNAME'),
      Cypress.env('LECTURER_INST2_SHORTNAME'),
      Cypress.env('LECTURER_INST3_SHORTNAME'),
    ]

    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()

      // revoke permissions for users 2, 3, 4 and 5
      cy.wrap(users).each((user) => {
        cy.get(`[data-cy="permission-${user}"]`).should('exist')
        cy.get(`[data-cy="revoke-permission-${user}"]`).click()
        cy.get('[data-cy="confirm-revocation"]').click()
        cy.get(`[data-cy="permission-${user}"]`).should('not.exist')
      })
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Verify that user with previous READ permissions can no longer see / access the activity', function () {
    verifyREADPermissionsRevoked(this.data)
  })

  it('Verify that user with previous EXECUTE permissions can no longer see / access the activity', function () {
    verifyEXECUTEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous WRITE permissions can no longer see / access the activity', function () {
    verifyWRITEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous ADMIN permissions can no longer see / access the activity', function () {
    verifyADMINPermissionsRevoked(this.data)
  })

  it('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the live quizzes with them', function () {
    // create user groups with users 1 & 2 / 3 as member / admin
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group1)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME')) // pro1 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group1}"]`).should('exist')

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group2)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST_SHORTNAME')) // pro2 is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group2}"]`).should('exist')

    // create user group with users 1 and 4 with user 4 as owner
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group3)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_EMAIL')) // lecturer is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group3}"]`).should('exist')

    // create user group with users 1 and 5 with user 5 as owner
    cy.loginInstitutionalCatalyst3()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group4)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_EMAIL')) // lecturer is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group4}"]`).should('exist')
    cy.logoutUser()

    // share the live quizzes with the user groups with READ, EXECUTE, WRITE and ADMIN permissions
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()

      // grant READ permission to user group 1
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group1
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${this.data.sharing.group1}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsREAD)

      // grant EXECUTE permission to user group 2
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group2
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${this.data.sharing.group2}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsEXECUTE)

      // grand WRITE permissions to user group 3
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group3
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${this.data.sharing.group3}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // grant ADMIN permissions to user group 4
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group4
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsADMIN
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${this.data.sharing.group4}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Log in as the user with READ permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizREADPermissions(this.data, true)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizEXECUTEPermissions(this.data, true)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizWRITEPermissions(this.data, true)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyLiveQuizADMINPermissions(this.data, true)
  })

  it('Revoke the direct group permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]
    const groups = [
      this.data.sharing.group1,
      this.data.sharing.group2,
      this.data.sharing.group3,
      this.data.sharing.group4,
    ]

    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()

      // revoke permissions for all user groups
      cy.wrap(groups).each((group) => {
        cy.get(`[data-cy="permission-${group}"]`).should('exist')
        cy.get(`[data-cy="revoke-permission-${group}"]`).click()
        cy.get('[data-cy="confirm-revocation"]').click()
        cy.get(`[data-cy="permission-${group}"]`).should('not.exist')
      })
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Verify that user with previous READ permissions can no longer see / access the activity', function () {
    verifyREADPermissionsRevoked(this.data)
  })

  it('Verify that user with previous EXECUTE permissions can no longer see / access the activity', function () {
    verifyEXECUTEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous WRITE permissions can no longer see / access the activity', function () {
    verifyWRITEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous ADMIN permissions can no longer see / access the activity', function () {
    verifyADMINPermissionsRevoked(this.data)
  })

  it("Transfer ownership of all live quizzes to user 'pro1' using the username", function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()

      // share the course with WRITE permissions with user pro1
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_IND_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // transfer ownership to user pro1
      cy.get('[data-cy="transfer-ownership"]').click()
      cy.get('[data-cy="new-owner-username-email-input"]').type(
        Cypress.env('LECTURER_IND_SHORTNAME')
      )
      cy.get('[data-cy="confirm-ownership-transfer"]').click()

      // verify that the correct permissions are displayed
      cy.get('[data-cy="transfer-ownership"]').should('not.exist')
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
      ).contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it("Verify that user 'pro1' is the new owner and transfer the ownership back to the main user", function () {
    cy.loginIndividualCatalyst()

    // verify that the new owner sees all the correct actions
    cy.get('[data-cy="activities"]').click()
    verifyLiveQuizOwnerPermissions(this.data)

    // transfer the ownership of all quizzes back to the main user
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()

      // grant a WRITE permission to the main user (should change the existing permission in this case)
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // transfer ownership back to the main user
      cy.get('[data-cy="transfer-ownership"]').click()
      cy.get('[data-cy="new-owner-username-email-input"]').type(
        Cypress.env('LECTURER_SHORTNAME')
      )
      cy.get('[data-cy="confirm-ownership-transfer"]').click()

      // verify that the correct permissions are displayed
      cy.get('[data-cy="transfer-ownership"]').should('not.exist')
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it("Remove the shared live quizzes from user 'pro1' using the removal functionality", function () {
    cy.loginIndividualCatalyst()

    // remove the shared live quizzes from user pro1
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="remove-live-quiz-${quiz}"]`).click()
      cy.get('[data-cy="confirm-deletion-final"]').click()
      cy.get('[data-cy="confirm-derived-access"]').click()
      cy.get('[data-cy="confirm-dependency-access"]').click()
      cy.get('[data-cy="confirmation-modal-confirm"]').click()
      cy.get(`[data-cy="activity-LIVE_QUIZ-${quiz}"]`).should('not.exist')
      cy.get('[data-cy="confirmation-modal-close"]').should('not.exist')
    })
    cy.logoutUser()

    // verify in the main user account that the corresponding permissions were removed
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
      this.data.sharing.quiz4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-LIVE_QUIZ-${quiz}"]`).click()
      cy.get(`[data-cy="share-live-quiz-${quiz}"]`).click()
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })
  // #endregion

  // ! Part 6: Participation Modes Live Quiz
  // #region
  it('Create a gamified live quiz on which the different access modes can be tested and other activity types to validate limitations of live-quiz specific temporary accounts', function () {
    cy.loginLecturer()
    cy.createLiveQuiz({
      name: this.data.modes.name,
      displayName: this.data.modes.displayName,
      courseName: this.data.modes.course,
      blocks: [
        { elements: [this.data.SCML.title] },
        { elements: [this.data.MCML.title] },
      ],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createPracticeQuiz({
      name: this.data.modes.practiceQuizName,
      displayName: this.data.modes.practiceQuizDisplayName,
      courseName: this.data.modes.course,
      stacks: [
        { elements: [this.data.SCML.title] },
        { elements: [this.data.MCML.title] },
      ],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createMicroLearning({
      name: this.data.modes.microLearningName,
      displayName: this.data.modes.microLearningDisplayName,
      courseName: this.data.modes.course,
      startDate: {
        monthDelta: -3,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-3, '16') + ', 02:00',
      }, // 3 months in the past at 2:00
      endDate: {
        monthDelta: 3,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(3, '14') + ', 18:00',
      }, // 3 months in the future at 18:00
      stacks: [
        { elements: [this.data.SCML.title] },
        { elements: [this.data.MCML.title] },
      ],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // start live quiz and open first block
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="start-live-quiz-${this.data.modes.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Choose anonymous participation in live quiz and verify the correct availability of account actions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="running-live-quiz-dropdown"]').click()
    cy.get(`[data-cy="running-live-quiz-${this.data.modes.name}"]`).click()
    cy.get('[data-cy="open-qr-modal"]').click()

    // store the direct link to the live quiz
    cy.get('[data-cy="qr-link-direct"]').invoke('text').as('quizLink')

    // get the direct link to the live quiz and visit it
    cy.get('@quizLink').then((quizLink) => {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()

      // open the live quiz link and participate in the live quiz anonymously
      cy.visit(String(quizLink))
      cy.origin(
        Cypress.env('URL_STUDENT'),
        {
          args: {
            username: Cypress.env('STUDENT_USERNAME'),
            password: Cypress.env('STUDENT_PASSWORD'),
            messages,
            data: this.data,
          },
        },
        ({ username, password, messages, data }) => {
          cy.get('[data-cy="participate-anonymously"]').click()
          cy.get('[data-cy="participate-anonymously"]').should('not.exist') // wait for temporary account creation to finish

          // verify that the correct options are shown in the participant dropdown
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]').should('not.exist')
          cy.get('[data-cy="header-setup-profile"]').should('not.exist')
          cy.get('[data-cy="participant-profile-login"]')
            .should('exist')
            .contains(messages.shared.generic.login)
          cy.get('[data-cy="course-docs"]').should('exist')
          cy.get('[data-cy="language-switch"]').should('exist')
          cy.get('[data-cy="logout"]').should('not.exist')

          // reload and verify that the anonymous participation choice persists
          cy.reload()
          cy.get('[data-cy="participate-anonymously"]').should('not.exist')

          // log in with a valid account and verify that account mode selection is not shown
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="participant-profile-login"]').click()
          cy.get('[data-cy="username-field"]').type(username)
          cy.get('[data-cy="password-field"]').type(password)
          cy.get('[data-cy="submit-login"]').click()
          cy.get(`[data-cy="live-quiz-${data.modes.displayName}"]`).click()
          cy.wait(1000)

          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]')
            .should('exist')
            .contains(username)
          cy.get('[data-cy="participant-profile-login"]')
            .should('exist')
            .contains(messages.shared.generic.profile)
          cy.get('[data-cy="course-docs"]').should('exist')
          cy.get('[data-cy="language-switch"]').should('exist')
          cy.get('[data-cy="logout"]').should('exist')
        }
      )
    })
  })

  it('Choose a temporary pseudonymm and verify the correct availability of account actions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="running-live-quiz-dropdown"]').click()
    cy.get(`[data-cy="running-live-quiz-${this.data.modes.name}"]`).click()
    cy.get('[data-cy="open-qr-modal"]').click()

    // store the direct link to the live quiz
    cy.get('[data-cy="qr-link-direct"]').invoke('text').as('quizLink')

    // get the direct link to the live quiz and visit it
    cy.get('@quizLink').then((quizLink) => {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()

      // open the live quiz link and participate in the live quiz anonymously
      cy.visit(String(quizLink))
      cy.origin(
        Cypress.env('URL_STUDENT'),
        { args: { data: this.data } },
        ({ data }) => {
          // choose a temporary pseudonym
          cy.get('[data-cy="create-temporary-pseudonym"]').click()
          cy.get('[data-cy="cancel-define-pseudonym"]').click()
          cy.get('[data-cy="create-temporary-pseudonym"]').click()
          cy.get('[data-cy="pseudonym-input"]')
            .click()
            .type(data.modes.pseudonym)
          cy.get('[data-cy="pseudonym-next-step"]').click()
          cy.get('[data-cy="cancel-choose-avatar"]').click()
          cy.get('[data-cy="pseudonym-input"]').should(
            'have.value',
            data.modes.pseudonym
          )
          cy.get('[data-cy="pseudonym-next-step"]').click()
          cy.get('[data-cy="submit-pseudonym-and-avatar"]').should(
            'not.be.disabled'
          )
          cy.get('[data-cy="avatar-carousel-next"]').click().click()
          cy.get('[data-cy="avatar-carousel-prev"]').click()
          cy.get('[data-cy="submit-pseudonym-and-avatar"]').click()
          cy.wait(2000) // wait for toast to disappear

          // verify that the correct options are shown in the participant dropdown
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]')
            .should('exist')
            .contains(data.modes.pseudonym)
          cy.get('[data-cy="header-setup-profile"]').should('not.exist')
          cy.get('[data-cy="participant-profile-login"]').should('not.exist')
          cy.get('[data-cy="course-docs"]').should('exist')
          cy.get('[data-cy="language-switch"]').should('exist')
          cy.get('[data-cy="logout"]').should('exist')

          // reload and verify that the temporary account is still logged in
          cy.reload()
          cy.get('[data-cy="create-temporary-pseudonym"]').should('not.exist')
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]')
            .should('exist')
            .contains(data.modes.pseudonym)

          // log out of the current pseudonym and create a new one
          cy.reload()
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="logout"]').click()
          cy.get('[data-cy="create-temporary-pseudonym"]').click()
          cy.get('[data-cy="pseudonym-input"]').type(data.modes.pseudonym2)
          cy.get('[data-cy="pseudonym-next-step"]').click()
          cy.get('[data-cy="submit-pseudonym-and-avatar"]').click()
          cy.wait(2000) // wait for toast to disappear

          // verify that the correct options are shown in the participant dropdown
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]')
            .should('exist')
            .contains(data.modes.pseudonym2)
        }
      )
    })
  })

  it('Log in as a regular user and verify that all redirects work correctly', function () {
    cy.loginLecturer()
    cy.get('[data-cy="running-live-quiz-dropdown"]').click()
    cy.get(`[data-cy="running-live-quiz-${this.data.modes.name}"]`).click()
    cy.get('[data-cy="open-qr-modal"]').click()

    // store the direct link to the live quiz
    cy.get('[data-cy="qr-link-direct"]').invoke('text').as('quizLink')

    // get the direct link to the live quiz and visit it
    cy.get('@quizLink').then((quizLink) => {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()

      // open the live quiz link and participate in the live quiz anonymously
      cy.visit(String(quizLink))
      cy.origin(
        Cypress.env('URL_STUDENT'),
        {
          args: {
            username: Cypress.env('STUDENT_USERNAME'),
            password: Cypress.env('STUDENT_PASSWORD'),
            quizName: this.data.modes.displayName,
            messages,
          },
        },
        ({ username, password, quizName, messages }) => {
          // choose regular login
          cy.get('[data-cy="login-with-account"]').click()
          cy.get('[data-cy="username-field"]').type(username)
          cy.get('[data-cy="password-field"]').type(password)
          cy.get('[data-cy="submit-login"]').click()
          cy.wait(1000) // wait for the live quiz to load

          // verify that the participant has been automatically redirected to the live quiz
          cy.get('[data-cy="header-page-title"]').contains(quizName)

          // verify that the correct account actions are available
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]')
            .should('exist')
            .contains(username)
          cy.get('[data-cy="participant-profile-login"]')
            .should('exist')
            .contains(messages.shared.generic.profile)
          cy.get('[data-cy="course-docs"]').should('exist')
          cy.get('[data-cy="language-switch"]').should('exist')
          cy.get('[data-cy="logout"]').should('exist')

          // verify that login persists on reload
          cy.reload()
          cy.get('[data-cy="header-avatar"]').click()
          cy.get('[data-cy="header-logged-in-as"]')
            .should('exist')
            .contains(username)
        }
      )
    })
  })

  it('Visit the live quiz leaderboard and check out that valid temporary participants are visible', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.modes.name}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.visit(`${Cypress.env('URL_MANAGE')}/quizzes/${quizId}/evaluation`)
    })
    cy.get('[data-cy="evaluation-leaderboard"]').click()

    // check that the user with "pseudonym" usename is not available, but the one with "pseudonym2" is
    cy.get(`[data-cy="leaderboard-entry-${this.data.modes.pseudonym}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="leaderboard-entry-${this.data.modes.pseudonym2}"]`)
      .should('exist')
      .contains(this.data.modes.pseudonym2)
  })
  // #endregion

  // ! Part 6: Activity Details Points
  // #region
  it('Create a live quiz in a gamified course and validate that points are shown correctly', function () {
    cy.loginLecturer()
    cy.createLiveQuiz({
      name: this.data.details.name,
      displayName: this.data.details.displayName,
      courseName: this.data.details.courseName,
      multiplier: messages.manage.activityWizard.multiplier2,
      blocks: [
        {
          elements: [
            this.data.SC.title,
            this.data.MC.title,
            this.data.KP.title,
            this.data.NR.title,
            this.data.FT.title,
            this.data.SE.title,
            this.data.CS.title,
            this.data.CT.title,
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.NRML.title,
            this.data.FTML.title,
            this.data.SEML.title,
            this.data.CSML.title,
            this.data.CT2.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.details.name}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${this.data.details.name}"]`).click()
    cy.assertActivityPoints({
      basePoints: 130,
      correctnessPoints: 60,
      bonusPoints: 540,
      totalPoints: 730,
    })

    cy.get('[data-cy="activity-details-stack-header-0"]').contains('70 P.')
    cy.get('[data-cy="activity-details-stack-header-1"]').contains('660 P.')

    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SC.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MC.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KP.title)
    cy.get('[data-cy="stack-0-instance-3"]').contains(this.data.NR.title)
    cy.get('[data-cy="stack-0-instance-4"]').contains(this.data.FT.title)
    cy.get('[data-cy="stack-0-instance-5"]').contains(this.data.SE.title)
    cy.get('[data-cy="stack-0-instance-6"]').contains(this.data.CS.title)
    cy.get('[data-cy="stack-0-instance-7"]').contains(this.data.CT.title)

    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 0,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 1,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 2,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 3,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 4,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 5,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 6,
    })
    cy.assertInstancePoints({
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 7,
    })

    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.NRML.title)
    cy.get('[data-cy="stack-1-instance-3"]').contains(this.data.FTML.title)
    cy.get('[data-cy="stack-1-instance-4"]').contains(this.data.SEML.title)
    cy.get('[data-cy="stack-1-instance-5"]').contains(this.data.CSML.title)
    cy.get('[data-cy="stack-1-instance-6"]').contains(this.data.CT2.title)

    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 0,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 1,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 2,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 3,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 4,
    })
    cy.assertInstancePoints({
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 5,
    })
    cy.assertInstancePoints({
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      stackIx: 1,
      instanceIx: 6,
    })
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Create live quiz in a non-gamified course and validate that no points are shown', function () {
    cy.loginLecturer()
    cy.createLiveQuiz({
      name: this.data.details.nameNonGamified,
      displayName: this.data.details.displayNameNonGamified,
      courseName: this.data.details.courseNonGamified,
      blocks: [
        {
          elements: [
            this.data.SC.title,
            this.data.MC.title,
            this.data.KP.title,
            this.data.NR.title,
            this.data.FT.title,
            this.data.SE.title,
            this.data.CS.title,
            this.data.CT.title,
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.NRML.title,
            this.data.FTML.title,
            this.data.SEML.title,
            this.data.CSML.title,
            this.data.CT2.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.details.nameNonGamified}"]`
    ).should('exist')

    cy.get(
      `[data-cy="activity-name-${this.data.details.nameNonGamified}"]`
    ).click()
    cy.assertNoActivityPoints()

    cy.get('[data-cy="activity-details-stack-header-0"]').should(
      'not.contain',
      '70 P.'
    )
    cy.get('[data-cy="activity-details-stack-header-1"]').should(
      'not.contain',
      '660 P.'
    )

    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SC.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MC.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KP.title)
    cy.get('[data-cy="stack-0-instance-3"]').contains(this.data.NR.title)
    cy.get('[data-cy="stack-0-instance-4"]').contains(this.data.FT.title)
    cy.get('[data-cy="stack-0-instance-5"]').contains(this.data.SE.title)
    cy.get('[data-cy="stack-0-instance-6"]').contains(this.data.CS.title)
    cy.get('[data-cy="stack-0-instance-7"]').contains(this.data.CT.title)

    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 0,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 1,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 2,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 3,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 4,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 5,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 6,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 7,
    })

    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.NRML.title)
    cy.get('[data-cy="stack-1-instance-3"]').contains(this.data.FTML.title)
    cy.get('[data-cy="stack-1-instance-4"]').contains(this.data.SEML.title)
    cy.get('[data-cy="stack-1-instance-5"]').contains(this.data.CSML.title)
    cy.get('[data-cy="stack-1-instance-6"]').contains(this.data.CT2.title)

    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 0,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 1,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 2,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 3,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 4,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 5,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 6,
    })
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Create live quiz without course assignment and validate that no points are shown', function () {
    cy.loginLecturer()
    cy.createLiveQuiz({
      name: this.data.details.nameNoCourse,
      displayName: this.data.details.displayNameNoCourse,
      blocks: [
        {
          elements: [
            this.data.SC.title,
            this.data.MC.title,
            this.data.KP.title,
            this.data.NR.title,
            this.data.FT.title,
            this.data.SE.title,
            this.data.CS.title,
            this.data.CT.title,
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.NRML.title,
            this.data.FTML.title,
            this.data.SEML.title,
            this.data.CSML.title,
            this.data.CT2.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.details.nameNoCourse}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.details.nameNoCourse}"]`
    ).should('exist')

    cy.get(
      `[data-cy="activity-name-${this.data.details.nameNoCourse}"]`
    ).click()
    cy.assertNoActivityPoints()

    cy.get('[data-cy="activity-details-stack-header-0"]').should(
      'not.contain',
      '70 P.'
    )
    cy.get('[data-cy="activity-details-stack-header-1"]').should(
      'not.contain',
      '660 P.'
    )

    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SC.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MC.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KP.title)
    cy.get('[data-cy="stack-0-instance-3"]').contains(this.data.NR.title)
    cy.get('[data-cy="stack-0-instance-4"]').contains(this.data.FT.title)
    cy.get('[data-cy="stack-0-instance-5"]').contains(this.data.SE.title)
    cy.get('[data-cy="stack-0-instance-6"]').contains(this.data.CS.title)
    cy.get('[data-cy="stack-0-instance-7"]').contains(this.data.CT.title)

    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 0,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 1,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 2,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 3,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 4,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 5,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 6,
    })
    cy.assertNoInstancePoints({
      stackIx: 0,
      instanceIx: 7,
    })

    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.NRML.title)
    cy.get('[data-cy="stack-1-instance-3"]').contains(this.data.FTML.title)
    cy.get('[data-cy="stack-1-instance-4"]').contains(this.data.SEML.title)
    cy.get('[data-cy="stack-1-instance-5"]').contains(this.data.CSML.title)
    cy.get('[data-cy="stack-1-instance-6"]').contains(this.data.CT2.title)

    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 0,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 1,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 2,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 3,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 4,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 5,
    })
    cy.assertNoInstancePoints({
      stackIx: 1,
      instanceIx: 6,
    })
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })
  // #endregion

  // ! Part 7: PIN-protected Live Quizzes
  // #region
  function createAndStartProtectedLiveQuizzes(data: any) {
    cy.get('[data-cy="library"]').click()
    cy.createLiveQuiz({
      name: data.protected.gamifiedCourse.liveQuiz,
      displayName: data.protected.gamifiedCourse.liveQuiz,
      courseName: data.protected.gamifiedCourse.name,
      pinProtectionWithoutCourse: true,
      blocks: [{ elements: [data.SCML.title, data.MC.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()
    cy.createLiveQuiz({
      name: data.protected.nonGamifiedCourse.liveQuiz,
      displayName: data.protected.nonGamifiedCourse.liveQuiz,
      courseName: data.protected.nonGamifiedCourse.name,
      pinProtectionWithoutCourse: true,
      blocks: [{ elements: [data.SCML.title, data.MC.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // start both live quizzes
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${data.protected.gamifiedCourse.liveQuiz}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${data.protected.gamifiedCourse.liveQuiz}"]`
    ).should('exist')
    cy.get(
      `[data-cy="start-live-quiz-${data.protected.gamifiedCourse.liveQuiz}"]`
    ).click()
    cy.get('[data-cy="abort-live-quiz-cockpit"]').should('exist')
    cy.get('[data-cy="next-block-timeline"]').click() // start the first block of the live quiz
    cy.wait(500)

    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${data.protected.nonGamifiedCourse.liveQuiz}{enter}`
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${data.protected.nonGamifiedCourse.liveQuiz}"]`
    ).should('exist')
    cy.get(
      `[data-cy="start-live-quiz-${data.protected.nonGamifiedCourse.liveQuiz}"]`
    ).click()
    cy.get('[data-cy="abort-live-quiz-cockpit"]').should('exist')
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  }

  function enterPinAnswerFirstBlock(pin: string, data: any) {
    cy.get('[data-cy="live-quiz-pin-input-1"]').should('exist')
    cy.get('[data-cy="live-quiz-submit-pin"]').should('be.disabled')
    cy.get('[data-cy="live-quiz-pin-input-1"]').realClick().realType(pin)
    cy.get('[data-cy="live-quiz-submit-pin"]').click()

    // verify and answer the contained questions
    // answer the first provided question
    cy.get('[data-cy="instance-question-content"]').contains(data.SCML.content)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="instance-question-content"]').contains(data.MC.content)

    // reload the page and verify that the entered PIN persists (leave second block to following test case)
    cy.reload()
    cy.get('[data-cy="instance-question-content"]').contains(data.MC.content)
  }

  function studentAccountLinkAccess(
    link: string,
    data: any,
    loggedIn: boolean,
    gamified: boolean
  ) {
    // open the live quiz link and participate in the live quiz anonymously
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.origin(
      Cypress.env('URL_STUDENT'),
      {
        args: {
          username: Cypress.env('STUDENT_USERNAME'),
          password: Cypress.env('STUDENT_PASSWORD'),
          scQuestion: data.SCML.content,
          mcQuestion: data.MC.content,
          link,
          loggedIn,
          gamified,
        },
      },
      async ({
        username,
        password,
        scQuestion,
        mcQuestion,
        link,
        loggedIn,
        gamified,
      }) => {
        if (loggedIn) {
          // log in as a student
          cy.get('[data-cy="username-field"]').click().type(username)
          cy.get('[data-cy="password-field"]').click().type(password)
          cy.get('[data-cy="submit-login"]').click()
        }

        // visit the live quiz directly through the link and verify that the PIN is already filled in
        cy.visit(String(link))
        cy.get('[data-cy="live-quiz-pin-input-1"]').should('exist')
        cy.get('[data-cy="live-quiz-submit-pin"]')
          .should('not.be.disabled')
          .click()

        // if the quiz is gamified and the user is not logged in, select anonymous participation
        if (!loggedIn) {
          if (gamified) {
            // participate in the live quiz anonymously
            cy.get('[data-cy="participate-anonymously"]').click()
          } else {
            cy.get('[data-cy="participate-anonymously"]').should('not.exist')
          }

          // verify and answer the contained questions
          // answer the first provided question
          cy.get('[data-cy="instance-question-content"]').contains(scQuestion)
          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="sc-0-answer-option-0"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)
          cy.get('[data-cy="instance-question-content"]').contains(mcQuestion)

          // reload the page and verify that the entered PIN persists (leave second block to following test case)
          cy.reload()
          cy.get('[data-cy="instance-question-content"]').contains(mcQuestion)
        }

        // verify that the second question is shown (first one has already been completed earlier)
        cy.get('[data-cy="instance-question-content"]').contains(mcQuestion)

        // reload the page and verify that the entered PIN persists
        cy.reload()
        cy.get('[data-cy="instance-question-content"]').contains(mcQuestion)

        // answer the second provided question
        cy.get('[data-cy="instance-question-content"]').contains(mcQuestion)
        cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
        cy.get('[data-cy="mc-1-answer-option-1"]').click()
        cy.get('[data-cy="mc-1-answer-option-3"]').click()
        cy.get('[data-cy="student-submit-answer"]').click()
        cy.wait(500)
      }
    )
  }

  function getPinProtectedQuizLinks(data: any) {
    // obtain the live quiz pin for both quizzes from the lecturer cockpit
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${data.protected.gamifiedCourse.liveQuiz}{enter}`
    )
    cy.get(
      `[data-cy="live-quiz-cockpit-${data.protected.gamifiedCourse.liveQuiz}"]`
    ).click()
    cy.get('[data-cy="open-qr-modal"]').click()
    cy.get('[data-cy="qr-link-direct"]')
      .invoke('text')
      .then((text) => cy.wrap(text).as('protectedQuizLink'))
    cy.get('[data-cy="live-quiz-qr-modal-close"]').click()

    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${data.protected.nonGamifiedCourse.liveQuiz}{enter}`
    )
    cy.get(
      `[data-cy="live-quiz-cockpit-${data.protected.nonGamifiedCourse.liveQuiz}"]`
    ).click()
    cy.get('[data-cy="open-qr-modal"]').click()
    cy.get('[data-cy="qr-link-direct"]')
      .invoke('text')
      .then((text) => cy.wrap(text).as('protectedQuizLink2'))
    cy.get('[data-cy="live-quiz-qr-modal-close"]').click()
  }

  function endPinProtectedLiveQuizzes(data: any) {
    cy.wrap([
      data.protected.gamifiedCourse.liveQuiz,
      data.protected.nonGamifiedCourse.liveQuiz,
    ]).each((quiz) => {
      // end the live quiz
      cy.get('[data-cy="running-live-quiz-dropdown"]').click()
      cy.get(`[data-cy="running-live-quiz-${quiz}"]`).click()
      cy.get('[data-cy="next-block-timeline"]').click()
      cy.wait(500)
      cy.get('[data-cy="next-block-timeline"]').click()
      cy.wait(500)

      // delete and re-create the live quiz for the anonymous test case (with the same name)
      cy.task('deleteLiveQuiz', { name: quiz })
    })
  }

  it('Preparation: Reset the database and create all required content for the PIN-protected live quizzes', function () {
    cy.cleanup()
    cy.seed()

    // login the lecturer
    cy.loginLecturer()

    // seed two questions
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      explanation: this.data.SCML.explanation,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MC.title,
      content: this.data.MC.content,
      explanation: this.data.MC.explanation,
      choices: this.data.MC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create two regular courses (one with gamification, one without)
    cy.createCourse({
      name: this.data.protected.gamifiedCourse.name,
      displayName: this.data.protected.gamifiedCourse.displayName,
      isAssessmentEnabled: false,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: getFutureDate(-1, '11'), // 1 month ago
      endDate: getFutureDate(6, '20'), // 6 months from now
      groupDeadlineDate: getFutureDate(2, '12'), // 2 months from now
      maxGroupSize: 4,
      preferredGroupSize: 2,
      participants: [Cypress.env('STUDENT_USERNAME')],
    })
    cy.createCourse({
      name: this.data.protected.nonGamifiedCourse.name,
      displayName: this.data.protected.nonGamifiedCourse.displayName,
      isAssessmentEnabled: false,
      isGamificationEnabled: false,
      isGroupCreationEnabled: false,
      startDate: getFutureDate(-1, '11'), // 1 month ago
      endDate: getFutureDate(6, '20'), // 6 months from now
      groupDeadlineDate: getFutureDate(2, '12'), // 2 months from now
      participants: [Cypress.env('STUDENT_USERNAME')],
    })

    // create one live quiz in each of the courses
    createAndStartProtectedLiveQuizzes(this.data)
  })

  it('Have the a student with a valid account join both courses', function () {
    cy.loginStudent()
    cy.task('getCoursePin', {
      courseName: this.data.protected.gamifiedCourse.name,
    }).then((pin: number) => {
      // check if the pin was fetched successfully
      if (!pin) {
        throw new Error(
          'No course pin found. Please ensure that the previous test case has run successfully and generated a course pin.'
        )
      }

      // join the course
      cy.get('[data-cy="join-new-course"]').click()
      cy.get('[data-cy="join-course-pin-field-1"]')
        .realClick()
        .realType(String(pin))
      cy.get('[data-cy="join-course-submit-form"]').click()
      cy.get(
        `[data-cy="course-button-${this.data.protected.gamifiedCourse.displayName}"]`
      ).should('exist')
    })

    cy.task('getCoursePin', {
      courseName: this.data.protected.nonGamifiedCourse.name,
    }).then((pin: number) => {
      // check if the pin was fetched successfully
      if (!pin) {
        throw new Error(
          'No course pin found. Please ensure that the previous test case has run successfully and generated a course pin.'
        )
      }

      // join the course
      cy.get('[data-cy="join-new-course"]').click()
      cy.get('[data-cy="join-course-pin-field-1"]')
        .realClick()
        .realType(String(pin))
      cy.get('[data-cy="join-course-submit-form"]').click()
      cy.get(
        `[data-cy="course-button-${this.data.protected.nonGamifiedCourse.displayName}"]`
      ).should('exist')
    })
  })

  it('Verify that the shown PINs are identical with the stored ones', function () {
    // combine approach of loading and entering on student view does not work due to limitations of cypress
    // obtain the shown pins for both created live quizzes
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.protected.gamifiedCourse.liveQuiz}{enter}`
    )
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.protected.gamifiedCourse.liveQuiz}"]`
    ).click()
    cy.get('[data-cy="live-quiz-pin"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text.split(':')[1].replace(/\s+/g, '')).as('protectedQuizPin')
      })

    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.protected.nonGamifiedCourse.liveQuiz}{enter}`
    )
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.protected.nonGamifiedCourse.liveQuiz}"]`
    ).click()
    cy.get('[data-cy="live-quiz-pin"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text.split(':')[1].replace(/\s+/g, '')).as('protectedQuizPin2')
      })

    // verify that these pins are equal to the ones stored in the database
    cy.get('@protectedQuizPin').then((pin) => {
      cy.task('verifyLiveQuizPin', {
        pin,
        name: this.data.protected.gamifiedCourse.liveQuiz,
      }).then((result: boolean) => {
        // check if the correct pin is shown
        if (result === false) {
          throw new Error(
            'The wrong live quiz is shown for the quiz in question'
          )
        }

        // dummy action
        cy.visit(Cypress.env('URL_MANAGE'))
      })
    })
    cy.get('@protectedQuizPin2').then((pin) => {
      cy.task('verifyLiveQuizPin', {
        pin,
        name: this.data.protected.nonGamifiedCourse.liveQuiz,
      }).then((result: boolean) => {
        // check if the correct pin is shown
        if (result === false) {
          throw new Error(
            'The wrong live quiz is shown for the quiz in question'
          )
        }

        // dummy action
        cy.visit(Cypress.env('URL_MANAGE'))
      })
    })
  })

  it('Log in as one of the course participants and access both live quizzes using the provided PINs', function () {
    // this test case is only relevant for students with account and course participation -> otherwise direct quiz access
    cy.loginStudent()

    cy.task('getLiveQuizPin', {
      name: this.data.protected.gamifiedCourse.liveQuiz,
    }).then((pin: string) => {
      // open the live quiz and enter the loaded PIN
      cy.get(
        `[data-cy="live-quiz-${this.data.protected.gamifiedCourse.liveQuiz}"]`
      ).click()

      // enter the live quiz pin and answer the data in the first block
      enterPinAnswerFirstBlock(pin, this.data)
    })
    cy.get('[data-cy="header-home"]').click()

    cy.task('getLiveQuizPin', {
      name: this.data.protected.nonGamifiedCourse.liveQuiz,
    }).then((pin: string) => {
      // open the live quiz and enter the loaded PIN
      cy.get(
        `[data-cy="live-quiz-${this.data.protected.nonGamifiedCourse.liveQuiz}"]`
      ).click()

      // enter the live quiz pin and answer the data in the first block
      enterPinAnswerFirstBlock(pin, this.data)
    })
  })

  it('Test the direct access links for the live quiz with embedded PIN (logged in users)', function () {
    getPinProtectedQuizLinks(this.data)

    // verify that a logged-in user can use the corresponding direct access links to join the live quizzes
    // --> no account selector dialog is shown and questions can be answered (reload should not affect availability)
    cy.get('@protectedQuizLink').then(function (link) {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()
      studentAccountLinkAccess(String(link), this.data, true, true)
    })

    cy.get('@protectedQuizLink2').then(function (link) {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()
      studentAccountLinkAccess(String(link), this.data, true, false)
    })
  })

  it('Test the direct access links for the live quiz with embedded PIN (anonymous users)', function () {
    cy.loginLecturer()

    // end, delete and recreate both live quizzes
    endPinProtectedLiveQuizzes(this.data)

    // recreate both live quizzes
    createAndStartProtectedLiveQuizzes(this.data)

    // get the protected quiz access links for the two quizzes
    getPinProtectedQuizLinks(this.data)

    // verify that student without login can use the corresponding direct access links to join the live quizzes
    // --> anonymous participation and temporary pseudonym should both be available and questions can be answered
    cy.clearAllCookies()
    cy.clearAllLocalStorage()

    cy.get('@protectedQuizLink').then(function (link) {
      studentAccountLinkAccess(String(link), this.data, false, true)
    })

    cy.get('@protectedQuizLink2').then(function (link) {
      studentAccountLinkAccess(String(link), this.data, false, false)
    })

    // dummy action
    cy.visit(Cypress.env('URL_MANAGE'))
  })

  it('End the two protected live quizzes', function () {
    cy.loginLecturer()

    // end, delete and recreate both live quizzes
    endPinProtectedLiveQuizzes(this.data)
  })
  // #endregion

  // ! Part 8: Word Cloud
  // #region
  it('Test word cloud display', function () {
    cy.loginLecturer()

    // create questions
    cy.createQuestionNR({
      name: this.data.NR4.title,
      content: this.data.NR4.content,
      explanation: this.data.NR4.explanation,
      ...this.data.NR4.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FT4.title,
      content: this.data.FT4.content,
      explanation: this.data.FT4.explanation,
      ...this.data.FT4.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FT5.title,
      content: this.data.FT5.content,
      explanation: this.data.FT5.explanation,
      ...this.data.FT5.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create live quiz
    cy.createLiveQuiz({
      name: this.data.liveQuizWordCloud.name,
      displayName: this.data.liveQuizWordCloud.displayName,
      courseName: this.data.liveQuizWordCloud.course,
      blocks: [
        {
          elements: [
            this.data.NR4.title,
            this.data.FT4.title,
            this.data.FT5.title,
          ],
        },
      ],
    })
    cy.wait(500)

    // start live quiz from the creation success screen
    cy.get('[data-cy="quick-start"]').click()
    cy.get('[data-cy="next-block-timeline"]', { timeout: 30000 }).should(
      'exist'
    )
    openNextBlock()

    visitEvaluationFromCockpit()
    cy.get('[data-cy="change-chart-type"]').click()
    cy.get('[data-cy="change-chart-type-manage.evaluation.wordCloud"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.wait(1000)

    const noResponsesReceivedMessage =
      'No participants have submitted responses for this question 😔.'
    cy.get('[data-cy="word-cloud"]').should(
      'contain',
      noResponsesReceivedMessage
    )
    cy.get('[data-cy="word-cloud-language-filter"]').should('not.exist')
    cy.get('[data-cy="word-cloud-display-limit"]').should('not.exist')

    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.FT4.title}"]`
    ).click()
    cy.get('[data-cy="change-chart-type"]').click()
    cy.get('[data-cy="change-chart-type-manage.evaluation.wordCloud"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.get('[data-cy="word-cloud"]').should(
      'contain',
      noResponsesReceivedMessage
    )
    cy.get('[data-cy="word-cloud-language-filter"]').should('exist')
    cy.get('[data-cy="word-cloud-display-limit"]').should('exist')

    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.FT5.title}"]`
    ).click()
    cy.get('[data-cy="change-chart-type"]').click()
    cy.get('[data-cy="change-chart-type-manage.evaluation.wordCloud"]').click()
    cy.get('[data-cy="show-results-evaluation"]').click()
    cy.get('[data-cy="word-cloud"]').should(
      'contain',
      noResponsesReceivedMessage
    )
    cy.get('[data-cy="word-cloud-language-filter"]').should('exist')
    cy.get('[data-cy="word-cloud-display-limit"]').should('exist')
  })

  it('Seed live quiz answers for word cloud display', function () {
    cy.task('seedWordCloudLiveQuizResponses', {
      freeTextAnswer: this.data.FT4.answer,
      freeTextTitle: this.data.FT4.title,
      numericalAnswer: this.data.NR4.answer,
      numericalTitle: this.data.NR4.title,
      quizName: this.data.liveQuizWordCloud.name,
      secondFreeTextAnswer: this.data.FT5.answer,
      secondFreeTextTitle: this.data.FT5.title,
    })
  })

  it('Test word cloud display after receiving answers', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]', { timeout: 30000 })
      .clear()
      .type(`${this.data.liveQuizWordCloud.name}{enter}`)
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.liveQuizWordCloud.name}"]`,
      { timeout: 30000 }
    ).click()
    openNextBlock()
    visitEvaluationFromCockpit()
    cy.get('[data-cy="change-chart-type"]').click()
    cy.get('[data-cy="change-chart-type-manage.evaluation.wordCloud"]').click()
    cy.wait(1000)

    cy.get('[data-cy="word-cloud"]').should('contain', '50')
    cy.get('[data-cy="word-cloud-language-filter"]').should('not.exist')
    cy.get('[data-cy="word-cloud-display-limit"]').should('not.exist')

    // check for correct behaviour of filters
    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.FT4.title}"]`
    ).click()
    cy.get('[data-cy="change-chart-type"]').click()
    cy.get('[data-cy="change-chart-type-manage.evaluation.wordCloud"]').click()
    cy.wait(1000)

    cy.get('[data-cy="word-cloud"]').should('contain', 'hello')
    cy.get('[data-cy="word-cloud"]').should('contain', '42')
    cy.get('[data-cy="word-cloud"]').should('not.contain', 'of')

    cy.selectOption('[data-cy="word-cloud-language-select"]', 'none')
    cy.wait(500)
    cy.get('[data-cy="word-cloud"]').should('contain', 'of')

    cy.selectOption('[data-cy="word-cloud-mode-select"]', 'sentences')
    cy.wait(500)
    cy.get('[data-cy="word-cloud"]').should('contain', 'of')
    cy.get('[data-cy="word-cloud-language-filter"]').should('not.exist')
    cy.get('[data-cy="word-cloud-display-limit"]').should('not.exist')

    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.FT5.title}"]`
    ).click()
    cy.get('[data-cy="change-chart-type"]').click()
    cy.get('[data-cy="change-chart-type-manage.evaluation.wordCloud"]').click()
    cy.wait(1000)

    cy.get('[data-cy="word-cloud"]').should('contain', 'hallo')
    cy.get('[data-cy="word-cloud"]').should('contain', '42')
    cy.get('[data-cy="word-cloud"]').should('contain', 'von')

    cy.selectOption('[data-cy="word-cloud-language-select"]', 'de')
    cy.wait(500)
    cy.get('[data-cy="word-cloud"]').should('contain', 'hallo')
    cy.get('[data-cy="word-cloud"]').should('not.contain', 'von')
  })
  // #endregion

  // ! Part 8: Assessment Live Quizzes
  // #region
  // TODO
  // #endregion
})
