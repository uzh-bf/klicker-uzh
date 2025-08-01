import messages from '../../../packages/i18n/messages/en'

describe('Test all functionalities related to the creation, management, sharing and use of templates', function () {
  before(() => {
    cy.seed()

    // set browser language to english (independent of local machine setting
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setLocaleOverride',
      params: { locale: 'en' },
    })
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('V-template.json').then((questionData) => {
      this.data = { ...this.data, ...questionData }
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Part 0: Preparation
  // #region
  it('Create a set of questions in the lecturer account for the template test suite', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.SC.title,
      content: this.data.SC.content,
      choices: this.data.SC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCMLAF.title,
      content: this.data.SCMLAF.content,
      choices: this.data.SCMLAF.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionMC({
      name: this.data.MC.title,
      content: this.data.MC.content,
      choices: this.data.MC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML.title,
      content: this.data.MCML.content,
      choices: this.data.MCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCMLAF.title,
      content: this.data.MCMLAF.content,
      choices: this.data.MCMLAF.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionKPRIM({
      name: this.data.KP.title,
      content: this.data.KP.content,
      choices: this.data.KP.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML.title,
      content: this.data.KPML.content,
      choices: this.data.KPML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPMLAF.title,
      content: this.data.KPMLAF.content,
      choices: this.data.KPMLAF.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionNR({
      name: this.data.NR.title,
      content: this.data.NR.content,
      ...this.data.NR.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionFT({
      name: this.data.FT.title,
      content: this.data.FT.content,
      ...this.data.FT.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FTML.title,
      content: this.data.FTML.content,
      ...this.data.FTML.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.SC.title}"]`).should('exist') // verify that switch to the library was successful
    cy.createQuestionSE({
      name: this.data.SE.title,
      content: this.data.SE.content,
      numberOfInputs: this.data.SE.inputs,
      collectionName: this.data.collection.name,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })

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
  })

  it('Create a second set of questions in the lecturer user account for the use in the template test suite', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.SC2.title,
      content: this.data.SC2.content,
      choices: this.data.SC2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCML2.title,
      content: this.data.SCML2.content,
      choices: this.data.SCML2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCMLAF2.title,
      content: this.data.SCMLAF2.content,
      choices: this.data.SCMLAF2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionMC({
      name: this.data.MC2.title,
      content: this.data.MC2.content,
      choices: this.data.MC2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML2.title,
      content: this.data.MCML2.content,
      choices: this.data.MCML2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCMLAF2.title,
      content: this.data.MCMLAF2.content,
      choices: this.data.MCMLAF2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionKPRIM({
      name: this.data.KP2.title,
      content: this.data.KP2.content,
      choices: this.data.KP2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML2.title,
      content: this.data.KPML2.content,
      choices: this.data.KPML2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPMLAF2.title,
      content: this.data.KPMLAF2.content,
      choices: this.data.KPMLAF2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionNR({
      name: this.data.NR2.title,
      content: this.data.NR2.content,
      ...this.data.NR2.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML2.title,
      content: this.data.NRML2.content,
      ...this.data.NRML2.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionFT({
      name: this.data.FT2.title,
      content: this.data.FT2.content,
      ...this.data.FT2.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FTML2.title,
      content: this.data.FTML2.content,
      ...this.data.FTML2.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection2.name,
      description: this.data.collection2.description,
      entries: this.data.collection2.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.SC2.title}"]`).should('exist') // verify that switch to the library was successful
    cy.createQuestionSE({
      name: this.data.SE2.title,
      content: this.data.SE2.content,
      numberOfInputs: this.data.SE2.inputs,
      collectionName: this.data.collection2.name,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSE({
      name: this.data.SEML2.title,
      content: this.data.SEML2.content,
      numberOfInputs: this.data.SEML2.inputs,
      collectionName: this.data.collection2.name,
      correctAnswers: this.data.collection2.options.filter((_, i) =>
        this.data.SEML2.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionCS({
      name: this.data.CS2.title,
      content: this.data.CS2.content,
      explanation: this.data.CS2.explanation,
      collectionName: this.data.collection2.name,
      selectedItems: this.data.collection2.options.filter((_, i) =>
        this.data.CS2.selectedItems.includes(i)
      ),
      criteria: this.data.CS2.criteria,
      cases: this.data.CS2.cases,
      solutions: this.data.CS2.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionCS({
      name: this.data.CSML2.title,
      content: this.data.CSML2.content,
      explanation: this.data.CSML2.explanation,
      collectionName: this.data.collection2.name,
      selectedItems: this.data.collection2.options.filter((_, i) =>
        this.data.CSML2.selectedItems.includes(i)
      ),
      criteria: this.data.CSML2.criteria,
      cases: this.data.CSML2.cases,
      solutions: this.data.CSML2.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it("Create another set of questions in the account of user 'pro1' for the use in template", function () {
    cy.loginIndividualCatalyst()
    cy.createQuestionSC({
      name: this.data.SC3.title,
      content: this.data.SC3.content,
      choices: this.data.SC3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCML3.title,
      content: this.data.SCML3.content,
      choices: this.data.SCML3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCMLAF3.title,
      content: this.data.SCMLAF3.content,
      choices: this.data.SCMLAF3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.createQuestionMC({
      name: this.data.MC3.title,
      content: this.data.MC3.content,
      choices: this.data.MC3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML3.title,
      content: this.data.MCML3.content,
      choices: this.data.MCML3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCMLAF3.title,
      content: this.data.MCMLAF3.content,
      choices: this.data.MCMLAF3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.createQuestionKPRIM({
      name: this.data.KP3.title,
      content: this.data.KP3.content,
      choices: this.data.KP3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML3.title,
      content: this.data.KPML3.content,
      choices: this.data.KPML3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPMLAF3.title,
      content: this.data.KPMLAF3.content,
      choices: this.data.KPMLAF3.choices,
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.createQuestionNR({
      name: this.data.NR3.title,
      content: this.data.NR3.content,
      ...this.data.NR3.options,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML3.title,
      content: this.data.NRML3.content,
      ...this.data.NRML3.options,
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.createQuestionFT({
      name: this.data.FT3.title,
      content: this.data.FT3.content,
      ...this.data.FT3.options,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FTML3.title,
      content: this.data.FTML3.content,
      ...this.data.FTML3.options,
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection3.name,
      description: this.data.collection3.description,
      entries: this.data.collection3.options,
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.SC3.title}"]`).should('exist') // verify that switch to the library was successful
    cy.createQuestionSE({
      name: this.data.SE3.title,
      content: this.data.SE3.content,
      numberOfInputs: this.data.SE3.inputs,
      collectionName: this.data.collection3.name,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionSE({
      name: this.data.SEML3.title,
      content: this.data.SEML3.content,
      numberOfInputs: this.data.SEML3.inputs,
      collectionName: this.data.collection3.name,
      correctAnswers: this.data.collection3.options.filter((_, i) =>
        this.data.SEML3.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_IND_ID'),
    })

    cy.createQuestionCS({
      name: this.data.CS3.title,
      content: this.data.CS3.content,
      explanation: this.data.CS3.explanation,
      collectionName: this.data.collection3.name,
      selectedItems: this.data.collection3.options.filter((_, i) =>
        this.data.CS3.selectedItems.includes(i)
      ),
      criteria: this.data.CS3.criteria,
      cases: this.data.CS3.cases,
      solutions: this.data.CS3.solutions,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.createQuestionCS({
      name: this.data.CSML3.title,
      content: this.data.CSML3.content,
      explanation: this.data.CSML3.explanation,
      collectionName: this.data.collection3.name,
      selectedItems: this.data.collection3.options.filter((_, i) =>
        this.data.CSML3.selectedItems.includes(i)
      ),
      criteria: this.data.CSML3.criteria,
      cases: this.data.CSML3.cases,
      solutions: this.data.CSML3.solutions,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
  })
  // #endregion

  // ! Part 1: Creation and editing of live quiz templates
  // #region
  it('Create a live quiz with all question types', function () {
    cy.loginLecturer()
    cy.createLiveQuiz({
      name: this.data.liveQuiz.name,
      displayName: this.data.liveQuiz.displayName,
      courseName: this.data.liveQuiz.courseName,
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
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
            this.data.NRML.title,
            this.data.FTML.title,
            this.data.SEML.title,
            this.data.CSML.title,
          ],
        },
        {
          elements: [
            this.data.SCMLAF.title,
            this.data.MCMLAF.title,
            this.data.KPMLAF.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()

    // verify the existense of the created live quiz including all actions
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="duplicate-live-quiz-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-live-quiz-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).should('exist')
  })

  it('Create a template from a copy of the live quiz', function () {
    // convert a copy of the created live quiz into a template
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).click()
    cy.get('[data-cy="confirm-content-visibility"]').should('not.exist')
    cy.get('[data-cy="confirm-question-access"]').should('not.exist')
    cy.get('[data-cy="confirm-resource-access"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').should('not.exist')
    cy.get('[data-cy="copy-option-template"]').click()

    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-activity-unavailability"]').should('not.exist')
    cy.get('[data-cy="confirm-content-visibility"]').click()
    cy.get('[data-cy="confirm-content-visibility"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-question-access"]').click()
    cy.get('[data-cy="confirm-question-access"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-resource-access"]').click()
    cy.get('[data-cy="confirm-resource-access"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').should('not.be.disabled')
    cy.get('[data-cy="close-template-conversion-modal"]').click()

    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).click()
    cy.get('[data-cy="copy-option-template"]').click()
    cy.get('[data-cy="confirm-content-visibility"]').click()
    cy.get('[data-cy="confirm-question-access"]').click()
    cy.get('[data-cy="confirm-resource-access"]').click()
    cy.get('[data-cy="template-next-step"]').click()

    // insert name, description and instructions for the new template
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-name"]')
      .click()
      .type(this.data.liveQuiz.template1Orig.name)
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-description"]')
      .realClick()
      .type(this.data.liveQuiz.template1Orig.description)
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-instructions"]')
      .realClick()
      .type(this.data.liveQuiz.template1Orig.instructions)
    cy.get('[data-cy="submit-template-creation"]').click()

    // verify that the template has been created and that the original live quiz still exists with all functionalities
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.template1Orig.name}"]`
    )
      .should('exist')
      .contains(messages.shared.generic.template)
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template1Orig.name}"]`
    ).should('exist')

    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="duplicate-live-quiz-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-live-quiz-${this.data.liveQuiz.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-name-${this.data.liveQuiz.name}"]`).realClick() // close dropdown

    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template1Orig.name}"]`
    ).click()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template1Orig.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template1Orig.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.liveQuiz.template1Orig.name}"]`
    ).realClick() // close dropdown
  })

  it('Convert the live quiz into a second template', function () {
    // convert the live quiz into a template
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).click()
    cy.get('[data-cy="copy-option-template"]').click()
    cy.get('[data-cy="confirm-activity-unavailability"]').should('not.exist')
    cy.get('[data-cy="convert-option-template"]').click()
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-activity-unavailability"]').click()
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-content-visibility"]').click()
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-question-access"]').click()
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-resource-access"]').click()
    cy.get('[data-cy="template-next-step"]').click()

    // insert name, description and instructions for the new template
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-name"]')
      .click()
      .type(this.data.liveQuiz.template2.name)
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-description"]')
      .realClick()
      .type(this.data.liveQuiz.template2.description)
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-instructions"]')
      .realClick()
      .type(this.data.liveQuiz.template2.instructions)
    cy.get('[data-cy="submit-template-creation"]').click()

    // verify that the template has been created and that the original live quiz does not exist anymore
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.template2.name}"]`
    )
      .should('exist')
      .contains(messages.shared.generic.template)
    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template2.name}"]`
    ).should('exist')

    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template2.name}"]`
    ).click()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template2.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template2.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.liveQuiz.template2.name}"]`
    ).realClick() // close dropdown

    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).should(
      'not.exist'
    )
  })

  it('Test the editing functionality for live quiz templates', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template1Orig.name}"]`
    ).click()

    // insert updates values for name, description and instructions
    cy.get('[data-cy="submit-template-edit"]').should('not.be.disabled')
    cy.get('[data-cy="template-name"]').should(
      'have.value',
      this.data.liveQuiz.template1Orig.name
    )
    cy.get('[data-cy="template-name"]').clear()
    cy.get('[data-cy="submit-template-edit"]').should('be.disabled')
    cy.get('[data-cy="template-name"]')
      .click()
      .type(this.data.liveQuiz.template1.name)

    cy.get('[data-cy="submit-template-edit"]').should('not.be.disabled')
    cy.get('[data-cy="template-description"]').contains(
      this.data.liveQuiz.template1Orig.description
    )
    cy.get('[data-cy="template-description"]')
      .realClick()
      .clear()
      .type(this.data.liveQuiz.template1.description)

    cy.get('[data-cy="submit-template-edit"]').should('not.be.disabled')
    cy.get('[data-cy="template-instructions"]').contains(
      this.data.liveQuiz.template1Orig.instructions
    )
    cy.get('[data-cy="template-instructions"]')
      .realClick()
      .clear()
      .type(this.data.liveQuiz.template1.instructions)
    cy.get('[data-cy="submit-template-edit"]').click()

    // verify that the template is shown in an updated version
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.liveQuiz.template1.name}"]`
    )
      .should('exist')
      .contains(messages.shared.generic.template)
  })

  it('Verify that the content of both live quiz templates has been stored correctly', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="template-name"]').should(
      'have.value',
      this.data.liveQuiz.template1.name
    )
    cy.get('[data-cy="template-description"]').contains(
      this.data.liveQuiz.template1.description
    )
    cy.get('[data-cy="template-instructions"]').contains(
      this.data.liveQuiz.template1.instructions
    )
    cy.get('[data-cy="close-edit-template-modal"]').click()

    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template2.name}"]`
    ).click()
    cy.get('[data-cy="template-name"]').should(
      'have.value',
      this.data.liveQuiz.template2.name
    )
    cy.get('[data-cy="template-description"]').contains(
      this.data.liveQuiz.template2.description
    )
    cy.get('[data-cy="template-instructions"]').contains(
      this.data.liveQuiz.template2.instructions
    )
    cy.get('[data-cy="close-edit-template-modal"]').click()
  })

  it('Add the live quiz template to the top level catalog collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-LIVE_QUIZ_TEMPLATE"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.liveQuiz.template1.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(
      `[data-cy="catalog-object-${this.data.liveQuiz.template1.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="catalog-object-${this.data.liveQuiz.template1.name}"]`
    ).contains(messages.manage.catalog.accessPUBLIC)
  })

  it("Add the second template to a restricted catalog collection and share access to it with user 'pro1'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // create a restricted catalog collection
    cy.get('[data-cy="create-catalog-collection-button"]').click()
    cy.get('[data-cy="catalog-collection-name-input"]')
      .click()
      .type(this.data.catalog.name)
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[data-cy="create-catalog-collection-submit"]').click()

    // add the second template to the restricted catalog collection
    cy.get(`[data-cy="catalog-object-${this.data.catalog.name}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.catalog.name)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-LIVE_QUIZ_TEMPLATE"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-1"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.liveQuiz.template2.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(
      `[data-cy="catalog-object-${this.data.liveQuiz.template2.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="catalog-object-${this.data.liveQuiz.template2.name}"]`
    ).contains(messages.manage.catalog.accessPUBLIC)

    // share access to the restricted catalog collection with user 'pro1'
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.catalog.name}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()
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
  })
  // #endregion

  // ! Part 2: Use of live quiz templates
  // #region
  it('Open the template in the lecturer account and test all element content actions / verify default content', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="template-instructions"]').contains(
      this.data.liveQuiz.template1.instructions
    )

    // verify the content of the settings
    cy.get('[data-cy="live-quiz-template-settings"]').click()
    cy.get('[data-cy="template-live-quiz-name"]').should(
      'have.value',
      this.data.liveQuiz.template1.name
    )
    cy.get('[data-cy="template-live-quiz-display-name"]').should(
      'have.value',
      this.data.liveQuiz.displayName
    )
    cy.get('[data-cy="submit-template-settings"]').click()
    cy.wait(4000) // wait for the success toast to disappear to make the button below accessible
    cy.get(`[data-cy="live-quiz-template-element-0-0"]`).click() // close the automatically opened first element

    // test the content and functionalities for all elements
    const combinations = [
      {
        identifier: '0-0',
        content: this.data.SC.content,
        alternativeContent: this.data.SC2.content,
        availableElements: [this.data.SC.title, this.data.SC2.title],
        unavailableElements: [
          this.data.SCML.title,
          this.data.SCML2.title,
          this.data.SCMLAF.title,
          this.data.SCMLAF2.title,
        ],
      },
      {
        identifier: '0-1',
        content: this.data.MC.content,
        alternativeContent: this.data.MC2.content,
        availableElements: [this.data.MC.title, this.data.MC2.title],
        unavailableElements: [
          this.data.MCML.title,
          this.data.MCML2.title,
          this.data.MCMLAF.title,
          this.data.MCMLAF2.title,
        ],
      },
      {
        identifier: '0-2',
        content: this.data.KP.content,
        alternativeContent: this.data.KP2.content,
        availableElements: [this.data.KP.title, this.data.KP2.title],
        unavailableElements: [
          this.data.KPML.title,
          this.data.KPML2.title,
          this.data.KPMLAF.title,
          this.data.KPMLAF2.title,
        ],
      },
      {
        identifier: '0-3',
        content: this.data.NR.content,
        alternativeContent: this.data.NR2.content,
        availableElements: [this.data.NR.title, this.data.NR2.title],
        unavailableElements: [this.data.NRML.title, this.data.NRML2.title],
      },
      {
        identifier: '0-4',
        content: this.data.FT.content,
        alternativeContent: this.data.FT2.content,
        availableElements: [this.data.FT.title, this.data.FT2.title],
        unavailableElements: [this.data.FTML.title, this.data.FTML2.title],
      },
      {
        identifier: '0-5',
        content: this.data.SE.content,
        alternativeContent: this.data.SE2.content,
        availableElements: [this.data.SE.title, this.data.SE2.title],
        unavailableElements: [this.data.SEML.title, this.data.SEML2.title],
      },
      {
        identifier: '0-6',
        content: this.data.CS.content,
        alternativeContent: this.data.CS2.content,
        availableElements: [this.data.CS.title, this.data.CS2.title],
        unavailableElements: [this.data.CSML.title, this.data.CSML2.title],
      },
      {
        identifier: '1-0',
        content: this.data.SCML.content,
        alternativeContent: this.data.SCML2.content,
        availableElements: [this.data.SCML.title, this.data.SCML2.title],
        unavailableElements: [
          this.data.SC.title,
          this.data.SC2.title,
          this.data.SCMLAF.title,
          this.data.SCMLAF2.title,
        ],
      },
      {
        identifier: '1-1',
        content: this.data.MCML.content,
        alternativeContent: this.data.MCML2.content,
        availableElements: [this.data.MCML.title, this.data.MCML2.title],
        unavailableElements: [
          this.data.MC.title,
          this.data.MC2.title,
          this.data.MCMLAF.title,
          this.data.MCMLAF2.title,
        ],
      },
      {
        identifier: '1-2',
        content: this.data.KPML.content,
        alternativeContent: this.data.KPML2.content,
        availableElements: [this.data.KPML.title, this.data.KPML2.title],
        unavailableElements: [
          this.data.KP.title,
          this.data.KP2.title,
          this.data.KPMLAF.title,
          this.data.KPMLAF2.title,
        ],
      },
      {
        identifier: '1-3',
        content: this.data.NRML.content,
        alternativeContent: this.data.NRML2.content,
        availableElements: [this.data.NRML.title, this.data.NRML2.title],
        unavailableElements: [this.data.NR.title, this.data.NR2.title],
      },
      {
        identifier: '1-4',
        content: this.data.FTML.content,
        alternativeContent: this.data.FTML2.content,
        availableElements: [this.data.FTML.title, this.data.FTML2.title],
        unavailableElements: [this.data.FT.title, this.data.FT2.title],
      },
      {
        identifier: '1-5',
        content: this.data.SEML.content,
        alternativeContent: this.data.SEML2.content,
        availableElements: [this.data.SEML.title, this.data.SEML2.title],
        unavailableElements: [this.data.SE.title, this.data.SE2.title],
      },
      {
        identifier: '1-6',
        content: this.data.CSML.content,
        alternativeContent: this.data.CSML2.content,
        availableElements: [this.data.CSML.title, this.data.CSML2.title],
        unavailableElements: [this.data.CS.title, this.data.CS2.title],
      },
      {
        identifier: '2-0',
        content: this.data.SCMLAF.content,
        alternativeContent: this.data.SCMLAF2.content,
        availableElements: [this.data.SCMLAF.title, this.data.SCMLAF2.title],
        unavailableElements: [
          this.data.SC.title,
          this.data.SC2.title,
          this.data.SCML.title,
          this.data.SCML2.title,
        ],
      },
      {
        identifier: '2-1',
        content: this.data.MCMLAF.content,
        alternativeContent: this.data.MCMLAF2.content,
        availableElements: [this.data.MCMLAF.title, this.data.MCMLAF2.title],
        unavailableElements: [
          this.data.MC.title,
          this.data.MC2.title,
          this.data.MCML.title,
          this.data.MCML2.title,
        ],
      },
      {
        identifier: '2-2',
        content: this.data.KPMLAF.content,
        alternativeContent: this.data.KPMLAF2.content,
        availableElements: [this.data.KPMLAF.title, this.data.KPMLAF2.title],
        unavailableElements: [
          this.data.KP.title,
          this.data.KP2.title,
          this.data.KPML.title,
          this.data.KPML2.title,
        ],
      },
    ]

    cy.wrap(combinations).each(
      ({
        identifier,
        content,
        alternativeContent,
        availableElements,
        unavailableElements,
      }: {
        identifier: string
        content: string
        alternativeContent: string
        availableElements: string[]
        unavailableElements: string[]
      }) => {
        cy.get(`[data-cy="live-quiz-template-submit"]`).should('be.disabled')
        cy.get(`[data-cy="live-quiz-template-element-${identifier}"]`).click()
        cy.get(`[data-cy="same-name-element-warning-${identifier}"]`).should(
          'exist'
        )

        // check template instance preview
        cy.get('[data-cy="student-element-preview"]').contains(content)

        // check available elements for replacement
        cy.get(
          `[data-cy="replace-with-existing-element-${identifier}"]`
        ).click()
        cy.wrap(availableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'exist'
          )
        })
        cy.wrap(unavailableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'not.exist'
          )
        })
        cy.get(
          `[data-cy="select-existing-element-${availableElements[1]}"]`
        ).click()
        cy.get('[data-cy="confirm-select-existing-element"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(
          alternativeContent
        )
        cy.get(`[data-cy="same-name-element-warning-${identifier}"]`).should(
          'not.exist'
        )

        // check possibility to create a new element
        cy.get(`[data-cy="create-new-element-template-${identifier}"]`).click()
        cy.get('[data-cy="insert-question-text"]').contains(content)
        cy.wait(1000) // wait for form to be fully populated to avoid overlapping inputs

        cy.get('[data-cy="insert-question-text"]')
          .click()
          .clear()
          .type(`${content} (NEW)`)
        cy.get('[data-cy="save-new-question"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(
          `${content} (NEW)`
        )
        cy.get(`[data-cy="same-name-element-warning-${identifier}"]`).should(
          'not.exist'
        )

        // check accepting template instance without changes
        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="cancel-discard-new-edits"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(
          `${content} (NEW)`
        )
        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="confirm-discard-new-edits"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(content)
        cy.get(`[data-cy="same-name-element-warning-${identifier}"]`).should(
          'exist'
        )

        // close the collapsible again
        cy.get(`[data-cy="live-quiz-template-element-${identifier}"]`).click()
      }
    )
    cy.get(`[data-cy="live-quiz-template-submit"]`).should('not.be.disabled')
  })

  it('Use the template in the lecturer account to create an activity with partially new content', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="template-instructions"]').contains(
      this.data.liveQuiz.template1.instructions
    )

    // verify the content of the settings
    cy.get('[data-cy="live-quiz-template-settings"]').click()
    cy.get('[data-cy="template-live-quiz-name"]').should(
      'have.value',
      this.data.liveQuiz.template1.name
    )
    cy.get('[data-cy="template-live-quiz-name"]')
      .click()
      .clear()
      .type(this.data.activity1.name)
    cy.get('[data-cy="template-live-quiz-display-name"]')
      .click()
      .clear()
      .type(this.data.activity1.displayName)
    cy.get('[data-cy="template-live-quiz-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    cy.get('[data-cy="template-live-quiz-course"]').realClick()
    cy.get(
      `[data-cy="select-course-${this.data.activity1.course}"]`
    ).realClick()
    cy.get('[data-cy="template-live-quiz-course"]').contains(
      this.data.activity1.course
    )
    cy.get('[data-cy="submit-template-settings"]').click()

    // accept the template instance for the first block
    cy.wrap([
      { content: this.data.SC.content, identifier: '0-0' },
      { content: this.data.MC.content, identifier: '0-1' },
      { content: this.data.KP.content, identifier: '0-2' },
      { content: this.data.NR.content, identifier: '0-3' },
      { content: this.data.FT.content, identifier: '0-4' },
      { content: this.data.SE.content, identifier: '0-5' },
      { content: this.data.CS.content, identifier: '0-6' },
    ]).each(
      ({ content, identifier }: { content: string; identifier: string }) => {
        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="student-element-preview"]').contains(content)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // reload and reset progress
    cy.reload()
    cy.get('[data-cy="reset-template-data"]').click()
    cy.get('[data-cy="cancel-template-reset"]').click()
    cy.get('[data-cy="reset-template-data"]').click()
    cy.get('[data-cy="confirm-template-reset"]').click()

    // re-do settings section and the first block
    cy.get('[data-cy="live-quiz-template-settings"]').click()
    cy.get('[data-cy="template-live-quiz-name"]').should(
      'have.value',
      this.data.liveQuiz.template1.name
    )
    cy.get('[data-cy="template-live-quiz-name"]')
      .click()
      .clear()
      .type(this.data.activity1.name)
    cy.get('[data-cy="template-live-quiz-display-name"]')
      .click()
      .clear()
      .type(this.data.activity1.displayName)
    cy.get('[data-cy="template-live-quiz-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    cy.get('[data-cy="template-live-quiz-course"]').realClick()
    cy.get(
      `[data-cy="select-course-${this.data.activity1.course}"]`
    ).realClick()
    cy.get('[data-cy="template-live-quiz-course"]').contains(
      this.data.activity1.course
    )
    cy.wait(5000) // wait for the auto-save notification toast to disappear (blocks submission button)
    cy.get('[data-cy="submit-template-settings"]').click()
    cy.wrap([
      { content: this.data.SC.content, identifier: '0-0' },
      { content: this.data.MC.content, identifier: '0-1' },
      { content: this.data.KP.content, identifier: '0-2' },
      { content: this.data.NR.content, identifier: '0-3' },
      { content: this.data.FT.content, identifier: '0-4' },
      { content: this.data.SE.content, identifier: '0-5' },
      { content: this.data.CS.content, identifier: '0-6' },
    ]).each(
      ({ content, identifier }: { content: string; identifier: string }) => {
        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="student-element-preview"]').contains(content)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // replace the instances in the second block with version 2
    cy.wrap([
      {
        identifier: '1-0',
        title: this.data.SCML2.title,
        content: this.data.SCML2.content,
      },
      {
        identifier: '1-1',
        title: this.data.MCML2.title,
        content: this.data.MCML2.content,
      },
      {
        identifier: '1-2',
        title: this.data.KPML2.title,
        content: this.data.KPML2.content,
      },
      {
        identifier: '1-3',
        title: this.data.NRML2.title,
        content: this.data.NRML2.content,
      },
      {
        identifier: '1-4',
        title: this.data.FTML2.title,
        content: this.data.FTML2.content,
      },
      {
        identifier: '1-5',
        title: this.data.SEML2.title,
        content: this.data.SEML2.content,
      },
      {
        identifier: '1-6',
        title: this.data.CSML2.title,
        content: this.data.CSML2.content,
      },
    ]).each(
      ({
        identifier,
        title,
        content,
      }: {
        identifier: string
        title: string
        content: string
      }) => {
        cy.get(
          `[data-cy="replace-with-existing-element-${identifier}"]`
        ).click()
        cy.get(`[data-cy="select-existing-element-${title}"]`).click()
        cy.get('[data-cy="confirm-select-existing-element"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(content)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // create modified versions of the instances in block 3
    cy.wrap([
      {
        identifier: '2-0',
        oldTitle: this.data.SCMLAF.title,
        newTitle: this.data.activity1.newElements.SC.title,
        newContent: this.data.activity1.newElements.SC.content,
      },
      {
        identifier: '2-1',
        oldTitle: this.data.MCMLAF.title,
        newTitle: this.data.activity1.newElements.MC.title,
        newContent: this.data.activity1.newElements.MC.content,
      },
      {
        identifier: '2-2',
        oldTitle: this.data.KPMLAF.title,
        newTitle: this.data.activity1.newElements.KP.title,
        newContent: this.data.activity1.newElements.KP.content,
      },
    ]).each(
      ({
        identifier,
        oldTitle,
        newTitle,
        newContent,
      }: {
        identifier: string
        oldTitle: string
        newTitle: string
        newContent: string
      }) => {
        cy.get(`[data-cy="create-new-element-template-${identifier}"]`).click()
        cy.get('[data-cy="insert-question-title"]').should(
          'have.value',
          oldTitle
        )
        cy.wait(1000) // wait for the form to be fully populated to avoid overlapping inputs

        cy.get('[data-cy="insert-question-title"]')
          .click()
          .clear()
          .type(newTitle)
        cy.get('[data-cy="insert-question-text"]')
          .realClick()
          .clear()
          .type(newContent)
        cy.get('[data-cy="save-new-question"]').click()
        cy.wait(500) // wait for element to be properly saved and UI to update

        cy.get('[data-cy="student-element-preview"]').contains(newContent)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // reload and restore progress, make sure that all inputs persisted
    cy.reload()
    cy.wrap([
      { identifier: '0-0', content: this.data.SC.content },
      { identifier: '0-1', content: this.data.MC.content },
      { identifier: '0-2', content: this.data.KP.content },
      { identifier: '0-3', content: this.data.NR.content },
      { identifier: '0-4', content: this.data.FT.content },
      { identifier: '0-5', content: this.data.SE.content },
      { identifier: '0-6', content: this.data.CS.content },
      { identifier: '1-0', content: this.data.SCML2.content },
      { identifier: '1-1', content: this.data.MCML2.content },
      { identifier: '1-2', content: this.data.KPML2.content },
      { identifier: '1-3', content: this.data.NRML2.content },
      { identifier: '1-4', content: this.data.FTML2.content },
      { identifier: '1-5', content: this.data.SEML2.content },
      { identifier: '1-6', content: this.data.CSML2.content },
      {
        identifier: '2-0',
        content: this.data.activity1.newElements.SC.content,
      },
      {
        identifier: '2-1',
        content: this.data.activity1.newElements.MC.content,
      },
      {
        identifier: '2-2',
        content: this.data.activity1.newElements.KP.content,
      },
    ]).each(
      ({ identifier, content }: { identifier: string; content: string }) => {
        cy.get(`[data-cy="live-quiz-template-element-${identifier}"]`).click() // open
        cy.get('[data-cy="student-element-preview"]').contains(content)
        cy.get(`[data-cy="live-quiz-template-element-${identifier}"]`).click() // close
      }
    )

    // submit the creation of an activity from the template and verify that the live quiz overview is correctly opened
    cy.get(`[data-cy="live-quiz-template-submit"]`).click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.activity1.name}"]`).should(
      'exist'
    )
  })

  it('Verify that the new elements from the third block have been added to the library', function () {
    cy.loginLecturer()
    cy.wrap([
      this.data.activity1.newElements.SC.title,
      this.data.activity1.newElements.MC.title,
      this.data.activity1.newElements.KP.title,
    ]).each((element: string) => {
      cy.get(`[data-cy="element-item-${element}"]`).should('exist')
    })
  })

  it('Execute the live quiz and open the first block', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.activity1.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="start-live-quiz-${this.data.activity1.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Verify the content of the elements through the student view and answer the questions', function () {
    cy.loginStudent()
    cy.findByText(this.data.activity1.displayName).click()

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.SC.content).should('exist')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.MC.content).should('exist')
    cy.get('[data-cy="mc-1-answer-option-0"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.KP.content).should('exist')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.NR.content).should('exist')
    cy.get('[data-cy="input-numerical-3"]').clear().type(this.data.NR.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.FT.content).should('exist')
    cy.get('[data-cy="free-text-input-4"]').type(this.data.FT.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.SE.content).should('exist')
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.CS.content).should('exist')
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
  })

  it('Close the first block and open the second block of the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity1.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click() // open block
  })

  it('Verify the content of the elements through the student view and answer the questions', function () {
    cy.loginStudent()
    cy.findByText(this.data.activity1.displayName).click()

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.SCML2.content).should('exist')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.MCML2.content).should('exist')
    cy.get('[data-cy="mc-1-answer-option-0"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.KPML2.content).should('exist')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.NRML2.content).should('exist')
    cy.get('[data-cy="input-numerical-3"]').clear().type(this.data.NR.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.FTML2.content).should('exist')
    cy.get('[data-cy="free-text-input-4"]').type(this.data.FT.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.SEML2.content).should('exist')
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.CSML2.content).should('exist')
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
  })

  it('Close the second block and open the third block of the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity1.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click() // open block
  })

  it('Verify the content of the elements through the student view and answer the questions', function () {
    cy.loginStudent()
    cy.findByText(this.data.activity1.displayName).click()

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.activity1.newElements.SC.content).should('exist')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.activity1.newElements.MC.content).should('exist')
    cy.get('[data-cy="mc-1-answer-option-0"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.findByText(this.data.activity1.newElements.KP.content).should('exist')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
  })

  it('Verify the content of the evaluation and close the live quiz', function () {
    cy.loginLecturer()

    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity1.name}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.visit(`${Cypress.env('URL_MANAGE')}/quizzes/${quizId}/evaluation`)
    })

    // check content of evaluation view
    cy.findByText(this.data.SC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KP.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.NR.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.FT.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SE.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.CS.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SCML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MCML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KPML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.NRML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.FTML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SEML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.CSML2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity1.newElements.SC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity1.newElements.MC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity1.newElements.KP.content).should('exist')

    // end the live quiz
    cy.visit(`${Cypress.env('URL_MANAGE')}`)
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity1.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click() // open block
    cy.wait(500)
  })

  it("Open the template in the restricted catalog collection through user 'pro1', test all functionalities and create an activity from it", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.catalog.name}"]`).click()
    cy.get(
      `[data-cy="actions-dropdown-${this.data.liveQuiz.template2.name}"]`
    ).realClick()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template2.name}"]`
    ).click()

    // settings section
    cy.get('[data-cy="live-quiz-template-settings"]').click()
    cy.get('[data-cy="template-live-quiz-name"]').should(
      'have.value',
      this.data.liveQuiz.template2.name
    )
    cy.get('[data-cy="template-live-quiz-name"]')
      .click()
      .clear()
      .type(this.data.activity2.name)
    cy.get('[data-cy="template-live-quiz-display-name"]')
      .click()
      .clear()
      .type(this.data.activity2.displayName)
    cy.get('[data-cy="template-live-quiz-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    cy.get('[data-cy="submit-template-settings"]').click()

    // in first block, check preview & correct replacement options, but keep the template instances
    cy.wrap([
      {
        identifier: '0-0',
        content: this.data.SC.content,
        availableElements: [this.data.SC3.title],
        unavailableElements: [
          this.data.SC.title,
          this.data.SC2.title,
          this.data.SCML.title,
          this.data.SCML2.title,
          this.data.SCML3.title,
          this.data.SCMLAF.title,
          this.data.SCMLAF2.title,
          this.data.SCMLAF3.title,
        ],
      },
      {
        identifier: '0-1',
        content: this.data.MC.content,
        availableElements: [this.data.MC3.title],
        unavailableElements: [
          this.data.MC.title,
          this.data.MC2.title,
          this.data.MCML.title,
          this.data.MCML2.title,
          this.data.MCML3.title,
          this.data.MCMLAF.title,
          this.data.MCMLAF2.title,
          this.data.MCMLAF3.title,
        ],
      },
      {
        identifier: '0-2',
        content: this.data.KP.content,
        availableElements: [this.data.KP3.title],
        unavailableElements: [
          this.data.KP.title,
          this.data.KP2.title,
          this.data.KPML.title,
          this.data.KPML2.title,
          this.data.KPML3.title,
          this.data.KPMLAF.title,
          this.data.KPMLAF2.title,
          this.data.KPMLAF3.title,
        ],
      },
      {
        identifier: '0-3',
        content: this.data.NR.content,
        availableElements: [this.data.NR3.title],
        unavailableElements: [
          this.data.NR.title,
          this.data.NR2.title,
          this.data.NRML.title,
          this.data.NRML2.title,
          this.data.NRML3.title,
        ],
      },
      {
        identifier: '0-4',
        content: this.data.FT.content,
        availableElements: [this.data.FT3.title],
        unavailableElements: [
          this.data.FT.title,
          this.data.FT2.title,
          this.data.FTML.title,
          this.data.FTML2.title,
          this.data.FTML3.title,
        ],
      },
      {
        identifier: '0-5',
        content: this.data.SE.content,
        availableElements: [this.data.SE3.title],
        unavailableElements: [
          this.data.SE.title,
          this.data.SE2.title,
          this.data.SEML.title,
          this.data.SEML2.title,
          this.data.SEML3.title,
        ],
      },
      {
        identifier: '0-6',
        content: this.data.CS.content,
        availableElements: [this.data.CS3.title],
        unavailableElements: [
          this.data.CS.title,
          this.data.CS2.title,
          this.data.CSML.title,
          this.data.CSML2.title,
          this.data.CSML3.title,
        ],
      },
    ]).each(
      ({
        identifier,
        content,
        availableElements,
        unavailableElements,
      }: {
        identifier: string
        content: string
        availableElements: string[]
        unavailableElements: string[]
      }) => {
        cy.get(
          `[data-cy="replace-with-existing-element-${identifier}"]`
        ).click()
        cy.wrap(availableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'exist'
          )
        })
        cy.wrap(unavailableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'not.exist'
          )
        })
        cy.get(
          `[data-cy="select-existing-element-${availableElements[0]}"]`
        ).click()
        cy.get('[data-cy="confirm-select-existing-element"]').click()

        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="student-element-preview"]').contains(content)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // in second block, check preview & correct replacement options, but create custom version of the elements (custom title & content)
    cy.wrap([
      {
        identifier: '1-0',
        content: this.data.SCML.content,
        title: this.data.SCML.title,
        newTitle: this.data.activity2.newElements.SC.title,
        newContent: this.data.activity2.newElements.SC.content,
        availableElements: [this.data.SCML3.title],
        unavailableElements: [
          this.data.SC.title,
          this.data.SC2.title,
          this.data.SC3.title,
          this.data.SCML.title,
          this.data.SCML2.title,
          this.data.SCMLAF.title,
          this.data.SCMLAF2.title,
          this.data.SCMLAF3.title,
        ],
        hasSampleSolutionDisabled: true,
        hasAnswerFeedbacksDisabled: true,
      },
      {
        identifier: '1-1',
        content: this.data.MCML.content,
        title: this.data.MCML.title,
        newTitle: this.data.activity2.newElements.MC.title,
        newContent: this.data.activity2.newElements.MC.content,
        availableElements: [this.data.MCML3.title],
        unavailableElements: [
          this.data.MC.title,
          this.data.MC2.title,
          this.data.MC3.title,
          this.data.MCML.title,
          this.data.MCML2.title,
          this.data.MCMLAF.title,
          this.data.MCMLAF2.title,
          this.data.MCMLAF3.title,
        ],
        hasSampleSolutionDisabled: true,
        hasAnswerFeedbacksDisabled: true,
      },
      {
        identifier: '1-2',
        content: this.data.KPML.content,
        title: this.data.KPML.title,
        newTitle: this.data.activity2.newElements.KP.title,
        newContent: this.data.activity2.newElements.KP.content,
        availableElements: [this.data.KPML3.title],
        unavailableElements: [
          this.data.KP.title,
          this.data.KP2.title,
          this.data.KP3.title,
          this.data.KPML.title,
          this.data.KPML2.title,
          this.data.KPMLAF.title,
          this.data.KPMLAF2.title,
          this.data.KPMLAF3.title,
        ],
        hasSampleSolutionDisabled: true,
        hasAnswerFeedbacksDisabled: true,
      },
      {
        identifier: '1-3',
        content: this.data.NRML.content,
        title: this.data.NRML.title,
        newTitle: this.data.activity2.newElements.NR.title,
        newContent: this.data.activity2.newElements.NR.content,
        availableElements: [this.data.NRML3.title],
        unavailableElements: [
          this.data.NR.title,
          this.data.NR2.title,
          this.data.NR3.title,
          this.data.NRML.title,
          this.data.NRML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
      {
        identifier: '1-4',
        content: this.data.FTML.content,
        title: this.data.FTML.title,
        newTitle: this.data.activity2.newElements.FT.title,
        newContent: this.data.activity2.newElements.FT.content,
        availableElements: [this.data.FTML3.title],
        unavailableElements: [
          this.data.FT.title,
          this.data.FT2.title,
          this.data.FT3.title,
          this.data.FTML.title,
          this.data.FTML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
      {
        identifier: '1-5',
        content: this.data.SEML.content,
        title: this.data.SEML.title,
        newTitle: this.data.activity2.newElements.SE.title,
        newContent: this.data.activity2.newElements.SE.content,
        availableElements: [this.data.SEML3.title],
        unavailableElements: [
          this.data.SE.title,
          this.data.SE2.title,
          this.data.SE3.title,
          this.data.SEML.title,
          this.data.SEML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
      {
        identifier: '1-6',
        content: this.data.CSML.content,
        title: this.data.CSML.title,
        newTitle: this.data.activity2.newElements.CS.title,
        newContent: this.data.activity2.newElements.CS.content,
        availableElements: [this.data.CSML3.title],
        unavailableElements: [
          this.data.CS.title,
          this.data.CS2.title,
          this.data.CS3.title,
          this.data.CSML.title,
          this.data.CSML2.title,
        ],
        hasSampleSolutionDisabled: true,
      },
    ]).each(
      ({
        identifier,
        content,
        title,
        newTitle,
        newContent,
        availableElements,
        unavailableElements,
        hasSampleSolutionDisabled = false,
        hasAnswerFeedbacksDisabled = false,
      }: {
        identifier: string
        content: string
        title: string
        newTitle: string
        newContent: string
        availableElements: string[]
        unavailableElements: string[]
        hasSampleSolutionDisabled?: boolean
        hasAnswerFeedbacksDisabled?: boolean
      }) => {
        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="student-element-preview"]').contains(content)

        cy.get(
          `[data-cy="replace-with-existing-element-${identifier}"]`
        ).click()
        cy.wrap(availableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'exist'
          )
        })
        cy.wrap(unavailableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'not.exist'
          )
        })
        cy.get(
          `[data-cy="select-existing-element-${availableElements[0]}"]`
        ).click()
        cy.get('[data-cy="confirm-select-existing-element"]').click()

        // verify that certain settings are disabled / hidden and enter new title & content
        cy.get(`[data-cy="create-new-element-template-${identifier}"]`).click()
        cy.get('[data-cy="insert-question-title"]').should('have.value', title)
        cy.wait(1000) // wait for form to be fully populated to avoid overlapping inputs

        cy.get('[data-cy="configure-sample-solution"]').should('not.exist')
        if (hasAnswerFeedbacksDisabled) {
          cy.get('[data-cy="configure-answer-feedbacks"]').should('be.disabled')
        }
        cy.get('[data-cy="element-tag-input"]').should('not.exist')
        cy.get('[data-cy="select-multiplier"]').should('not.exist')
        cy.get('[data-cy="insert-question-title"]')
          .click()
          .clear()
          .type(newTitle)
        cy.get('[data-cy="insert-question-text"]')
          .click()
          .clear()
          .type(newContent)
        cy.get('[data-cy="save-new-question"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(newContent)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // in third block, check preview & correct replacement options, replace with existing elements in own library
    cy.wrap([
      {
        identifier: '2-0',
        content: this.data.SCMLAF.content,
        availableElements: [this.data.SCMLAF3.title],
        contentNew: this.data.SCMLAF3.content,
        unavailableElements: [
          this.data.SC3.title,
          this.data.SCML3.title,
          this.data.SCMLAF.title,
          this.data.SCMLAF2.title,
        ],
      },
      {
        identifier: '2-1',
        content: this.data.MCMLAF.content,
        availableElements: [this.data.MCMLAF3.title],
        contentNew: this.data.MCMLAF3.content,
        unavailableElements: [
          this.data.MC3.title,
          this.data.MCML3.title,
          this.data.MCMLAF.title,
          this.data.MCMLAF2.title,
        ],
      },
      {
        identifier: '2-2',
        content: this.data.KPMLAF.content,
        availableElements: [this.data.KPMLAF3.title],
        contentNew: this.data.KPMLAF3.content,
        unavailableElements: [
          this.data.KP3.title,
          this.data.KPML3.title,
          this.data.KPMLAF.title,
          this.data.KPMLAF2.title,
        ],
      },
    ]).each(
      ({
        identifier,
        content,
        availableElements,
        contentNew,
        unavailableElements,
      }: {
        identifier
        content: string
        availableElements: string[]
        contentNew: string
        unavailableElements: string[]
      }) => {
        cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
        cy.get('[data-cy="student-element-preview"]').contains(content)

        cy.get(
          `[data-cy="replace-with-existing-element-${identifier}"]`
        ).click()
        cy.wrap(availableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'exist'
          )
        })
        cy.wrap(unavailableElements).each((elementName: string) => {
          cy.get(`[data-cy="select-existing-element-${elementName}"]`).should(
            'not.exist'
          )
        })
        cy.get(
          `[data-cy="select-existing-element-${availableElements[0]}"]`
        ).click()
        cy.get('[data-cy="confirm-select-existing-element"]').click()
        cy.get('[data-cy="student-element-preview"]').contains(contentNew)
        cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
      }
    )

    // submit the creation of an activity from the template and verify that the live quiz overview is correctly opened
    cy.get(`[data-cy="live-quiz-template-submit"]`).click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.activity2.name}"]`).should(
      'exist'
    )
  })

  it('Verify that correct permissions and elements have been created on the answer collections contained in the template', function () {
    cy.loginIndividualCatalyst()

    // template instances should have been created as new elements in the pool
    cy.wrap([
      this.data.SC.title,
      this.data.MC.title,
      this.data.KP.title,
      this.data.NR.title,
      this.data.FT.title,
      this.data.SE.title,
      this.data.CS.title,
    ]).each((element: string) => {
      cy.get(`[data-cy="element-item-${element}"]`).should('exist')
    })

    // modified versions of elements (new elements) should have been created as new elements in the pool
    cy.wrap([
      this.data.activity2.newElements.SC.title,
      this.data.activity2.newElements.MC.title,
      this.data.activity2.newElements.KP.title,
      this.data.activity2.newElements.NR.title,
      this.data.activity2.newElements.FT.title,
      this.data.activity2.newElements.SE.title,
      this.data.activity2.newElements.CS.title,
    ]).each((element: string) => {
      cy.get(`[data-cy="element-item-${element}"]`).should('exist')
    })

    // read permissions on the shared and used answer collections should have been granted automatically
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-${this.data.collection.name}"]`
    ).contains(messages.manage.sharing.permissionsREAD) // shared through elements in template
    cy.get(
      `[data-cy="answer-collection-${this.data.collection3.name}"]`
    ).should('exist') // owned
  })

  it('Execute the live quiz and open the first block', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.activity2.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="start-live-quiz-${this.data.activity2.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Verify the content of the elements through the student view and answer the questions', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.wrap(quizId).as('quizId')
    })

    // student 11 joins course and creates a group by himself
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('@quizId').then((quizId) => {
      cy.origin(
        Cypress.env('URL_STUDENT'),
        {
          args: {
            username: Cypress.env('STUDENT_USERNAME'),
            password: Cypress.env('STUDENT_PASSWORD'),
            quizId: String(quizId),
            data: this.data,
          },
        },
        ({ username, password, quizId, data }) => {
          cy.get('[data-cy="username-field"]').click().type(username)
          cy.get('[data-cy="password-field"]').click().type(password)
          cy.get('[data-cy="submit-login"]').click()

          // directly access the live quiz through the URL
          cy.visit(`${Cypress.env('URL_STUDENT')}/session/${quizId}`)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.SC.content
          )
          cy.get('[data-cy="sc-0-answer-option-0"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.MC.content
          )
          cy.get('[data-cy="mc-1-answer-option-0"]').click()
          cy.get('[data-cy="mc-1-answer-option-1"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.KP.content
          )
          cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.NR.content
          )
          cy.get('[data-cy="input-numerical-3"]').clear().type(data.NR.answer)
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.FT.content
          )
          cy.get('[data-cy="free-text-input-4"]').type(data.FT.answer)
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.SE.content
          )
          cy.get('[id="selection-5-field-0"]').click()
          cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          // answering case study question with corresponding function inside an origin wrapper does not work
          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.CS.content
          )
        }
      )
    })

    // dummy action
    cy.visit(Cypress.env('URL_MANAGE'))
  })

  it('Close the first block and open the second block of the live quiz', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click() // open block
  })

  it('Verify the content of the elements through the student view and answer the questions', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.wrap(quizId).as('quizId')
    })

    // student 11 joins course and creates a group by himself
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('@quizId').then((quizId) => {
      cy.origin(
        Cypress.env('URL_STUDENT'),
        {
          args: {
            username: Cypress.env('STUDENT_USERNAME'),
            password: Cypress.env('STUDENT_PASSWORD'),
            quizId: String(quizId),
            data: this.data,
          },
        },
        ({ username, password, quizId, data }) => {
          cy.get('[data-cy="username-field"]').click().type(username)
          cy.get('[data-cy="password-field"]').click().type(password)
          cy.get('[data-cy="submit-login"]').click()

          // directly access the live quiz through the URL
          cy.visit(`${Cypress.env('URL_STUDENT')}/session/${quizId}`)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.SC.content
          )
          cy.get('[data-cy="sc-0-answer-option-0"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.MC.content
          )
          cy.get('[data-cy="mc-1-answer-option-0"]').click()
          cy.get('[data-cy="mc-1-answer-option-1"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.KP.content
          )
          cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.NR.content
          )
          cy.get('[data-cy="input-numerical-3"]')
            .clear()
            .type(data.activity2.newElements.NR.answer)
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.FT.content
          )
          cy.get('[data-cy="free-text-input-4"]').type(
            data.activity2.newElements.FT.answer
          )
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.SE.content
          )
          cy.get('[id="selection-5-field-0"]').click()
          cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          // answering case study question with corresponding function inside an origin wrapper does not work
          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.activity2.newElements.CS.content
          )
        }
      )
    })

    // dummy action
    cy.visit(Cypress.env('URL_MANAGE'))
  })

  it('Close the second block and open the third block of the live quiz', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click() // open block
  })

  it('Verify the content of the elements through the student view and answer the questions', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.wrap(quizId).as('quizId')
    })

    // student 11 joins course and creates a group by himself
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('@quizId').then((quizId) => {
      cy.origin(
        Cypress.env('URL_STUDENT'),
        {
          args: {
            username: Cypress.env('STUDENT_USERNAME'),
            password: Cypress.env('STUDENT_PASSWORD'),
            quizId: String(quizId),
            data: this.data,
          },
        },
        ({ username, password, quizId, data }) => {
          cy.get('[data-cy="username-field"]').click().type(username)
          cy.get('[data-cy="password-field"]').click().type(password)
          cy.get('[data-cy="submit-login"]').click()

          // directly access the live quiz through the URL
          cy.visit(`${Cypress.env('URL_STUDENT')}/session/${quizId}`)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.SCMLAF3.content
          )
          cy.get('[data-cy="sc-0-answer-option-0"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.MCMLAF3.content
          )
          cy.get('[data-cy="mc-1-answer-option-0"]').click()
          cy.get('[data-cy="mc-1-answer-option-1"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
          cy.wait(500)

          cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
          cy.get('[data-cy="instance-question-content"]').contains(
            data.KPMLAF3.content
          )
          cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
          cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
          cy.get('[data-cy="student-submit-answer"]').click()
        }
      )
    })

    // dummy action
    cy.visit(Cypress.env('URL_MANAGE'))
  })

  it('Verify the content of the evaluation and close the live quiz', function () {
    cy.loginIndividualCatalyst()

    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.visit(`${Cypress.env('URL_MANAGE')}/quizzes/${quizId}/evaluation`)
    })

    // check content of evaluation view
    cy.findByText(this.data.SC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KP.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.NR.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.FT.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SE.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.CS.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.SC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.MC.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.KP.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.NR.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.FT.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.SE.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.activity2.newElements.CS.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SCMLAF3.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MCMLAF3.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KPMLAF3.content).should('exist')

    // end the live quiz
    cy.visit(`${Cypress.env('URL_MANAGE')}`)
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${this.data.activity2.name}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click() // open block
    cy.wait(500)
  })
  // #endregion

  // ! Part 3: Use the live quiz template with inline answer collection definitions
  // #region
  it('Open the live quiz template in the catalog and enter new selection and case study elements with inline answer collections', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // open the template and complete the necessary parts of the settings step
    cy.get(
      `[data-cy="catalog-object-${this.data.liveQuiz.template1.name}"]`
    ).realClick()
    cy.get('[data-cy="live-quiz-template-settings"]').click()
    cy.get('[data-cy="template-live-quiz-name"]')
      .click()
      .clear()
      .type(this.data.activity3.name)
    cy.get('[data-cy="template-live-quiz-display-name"]')
      .click()
      .clear()
      .type(this.data.activity3.displayName)
    cy.get('[data-cy="template-live-quiz-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    cy.get('[data-cy="submit-template-settings"]').click()

    // accept all elements up to the first selection / case study element
    cy.wrap(['0-0', '0-1', '0-2', '0-3', '0-4']).each((identifier: string) => {
      cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
      cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
    })

    // modify the selection element using an inline answer collection definition
    cy.get(`[data-cy="create-new-element-template-0-5"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.activity3.SETitle)
    cy.get('[data-cy="create-inline-answer-collection"]').click()
    cy.wrap(this.data.collection.options).each((option: string) => {
      cy.get('#inline-answer-collection-options').type(`${option}{enter}`)
    })
    cy.get('[data-cy="configure-number-of-inputs"]').click().clear().type('2')
    cy.get('[data-cy="save-new-question"]').click()
    cy.get(`[data-cy="next-template-element-0-5"]`).click()

    // modify the case study element, defining another inline answer collection
    cy.get(`[data-cy="create-new-element-template-0-6"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.activity3.CSTitle)
    cy.get('[data-cy="create-inline-answer-collection"]').click()
    cy.wrap(this.data.collection2.options).each((option: string) => {
      cy.get('#inline-answer-collection-options').type(`${option}{enter}`)
    })
    cy.get('[data-cy="save-new-question"]').click()
    cy.get(`[data-cy="next-template-element-0-6"]`).click()

    // accept all remaining instances as contained in the template
    cy.wrap([
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
    ]).each((identifier: string) => {
      cy.get(`[data-cy="accept-template-element-${identifier}"]`).click()
      cy.get(`[data-cy="next-template-element-${identifier}"]`).click()
    })

    // confirm live quiz creation and verify successful redirect
    cy.get(`[data-cy="live-quiz-template-submit"]`).click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.activity3.name}"]`).should(
      'exist'
    )
  })

  it('Verify that the elements and the answer collection have been created correctly', function () {
    cy.loginInstitutionalCatalyst()

    // verify that the content of the selection element has been stored correctly
    cy.get(`[data-cy="edit-element-${this.data.activity3.SETitle}"]`).click()
    cy.get('[data-cy="create-inline-answer-collection"]').should('not.exist') // ensure that switching to manual item creation is not possible during editing
    cy.get('[id="selection-0-field-0"]').click()
    cy.wrap(this.data.collection.options).each((value: string) => {
      cy.findByText(value).should('exist') // verify that correct options are available for selection
    })
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the content of the case study element has been stored correctly
    cy.get(`[data-cy="edit-element-${this.data.activity3.CSTitle}"]`).click()
    cy.get('[data-cy="create-inline-answer-collection"]').should('not.exist') // ensure that switching to manual item creation is not possible during editing
    cy.wrap(this.data.collection2.options).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').contains(item) // verify that the correct items are available for assessment
    })
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the answer collection based on the selection question has been created correctly
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    const SECollection = `AC: ${this.data.activity3.SETitle}`
    cy.get(`[data-cy="answer-collection-actions-${SECollection}"]`).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.collection.options).each((item: string) => {
      cy.get(`[data-cy="delete-answer-option-${item}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${item}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    // verify that the answer collection based on the case study question has been created correctly
    const CSCollection = `AC: ${this.data.activity3.CSTitle}`
    cy.get(`[data-cy="answer-collection-actions-${CSCollection}"]`).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.collection2.options).each((item: string) => {
      cy.get(`[data-cy="delete-answer-option-${item}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${item}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })
  // #endregion

  // ! Cleanup: Deletion of all created templates, activities and questions
  // #region
  it('Delete all created templates', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="cancel-deletion"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="confirm-template-deletion"]').click()
    cy.wait(500)

    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template2.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template2.name}"]`
    ).click()
    cy.get('[data-cy="confirm-template-deletion"]').click()
    cy.wait(500)
  })
  // #endregion
})
