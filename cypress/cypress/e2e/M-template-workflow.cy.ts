import messages from '../../../packages/i18n/messages/en'

describe('Test all functionalities related to the creation, management, sharing and use of templates', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('M-template.json').then((liveQuizData) => {
      this.data = { ...this.data, ...liveQuizData }
    })
  })

  // ! Part 0: Preparation
  // #region
  it('Create the questions required in the live quiz test workflows', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      title: this.data.SC1.title,
      content: this.data.SC1.content,
      choices: this.data.SC1.choices,
    })
    cy.createQuestionSC({
      title: this.data.SC2.title,
      content: this.data.SC2.content,
      choices: this.data.SC2.choices,
    })

    cy.createQuestionMC({
      title: this.data.MC1.title,
      content: this.data.MC1.content,
      choices: this.data.MC1.choices,
    })
    cy.createQuestionMC({
      title: this.data.MC2.title,
      content: this.data.MC2.content,
      choices: this.data.MC2.choices,
    })

    cy.createQuestionKPRIM({
      title: this.data.KP1.title,
      content: this.data.KP1.content,
      choices: this.data.KP1.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KP2.title,
      content: this.data.KP2.content,
      choices: this.data.KP2.choices,
    })

    cy.createQuestionNR({
      title: this.data.NR1.title,
      content: this.data.NR1.content,
      ...this.data.NR1.options,
    })
    cy.createQuestionNR({
      title: this.data.NR2.title,
      content: this.data.NR2.content,
      ...this.data.NR2.options,
    })

    cy.createQuestionFT({
      title: this.data.FT1.title,
      content: this.data.FT1.content,
      ...this.data.FT1.options,
    })
    cy.createQuestionFT({
      title: this.data.FT2.title,
      content: this.data.FT2.content,
      ...this.data.FT2.options,
    })

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
    })

    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      title: this.data.SE1.title,
      content: this.data.SE1.content,
      numberOfInputs: this.data.SE1.inputs,
      collectionName: this.data.collection.name,
    })
    cy.createQuestionSE({
      title: this.data.SE2.title,
      content: this.data.SE2.content,
      numberOfInputs: this.data.SE2.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SE2.solutions.includes(i)
      ),
    })

    cy.createQuestionCS({
      title: this.data.CS1.title,
      content: this.data.CS1.content,
      explanation: this.data.CS1.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CS1.selectedItems.includes(i)
      ),
      criteria: this.data.CS1.criteria,
      cases: this.data.CS1.cases,
      solutions: this.data.CS1.solutions,
    })
    cy.createQuestionCS({
      title: this.data.CS2.title,
      content: this.data.CS2.content,
      explanation: this.data.CS2.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CS2.selectedItems.includes(i)
      ),
      criteria: this.data.CS2.criteria,
      cases: this.data.CS2.cases,
      solutions: this.data.CS2.solutions,
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
            this.data.SC1.title,
            this.data.MC1.title,
            this.data.KP1.title,
            this.data.NR1.title,
            this.data.FT1.title,
            this.data.SE1.title,
            this.data.CS1.title,
          ],
        },
        {
          elements: [
            this.data.SC2.title,
            this.data.MC2.title,
            this.data.KP2.title,
            this.data.NR2.title,
            this.data.FT2.title,
            this.data.SE2.title,
            this.data.CS2.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()

    // verify the existense of the created live quiz including all actions
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.name}"]`).should('exist')
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
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).click()
    cy.get('[data-cy="confirm-content-visibility"]').should('not.exist')
    cy.get('[data-cy="confirm-question-access"]').should('not.exist')
    cy.get('[data-cy="confirm-resource-access"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').should('not.exist')
    cy.get('[data-cy="copy-option-template"]').click()

    cy.get('[data-cy="template-next-step"]').should('be.disabled')
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
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.template1Orig.name}"]`)
      .should('exist')
      .contains(messages.shared.generic.template)
    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template1Orig.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template1Orig.name}"]`
    ).should('exist')

    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.name}"]`).should('exist')
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

  it('Convert the live quiz into a second template', function () {
    // convert the live quiz into a template
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="template-from-live-quiz-${this.data.liveQuiz.name}"]`
    ).click()
    cy.get('[data-cy="copy-option-template"]').click()
    cy.get('[data-cy="convert-option-template"]').click()
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
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.template2.name}"]`)
      .should('exist')
      .contains(messages.shared.generic.template)
    cy.get(
      `[data-cy="edit-template-${this.data.liveQuiz.template2.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template2.name}"]`
    ).should('exist')
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.name}"]`).should(
      'not.exist'
    )
  })

  it('Test the editing functionality for live quiz templates', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
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
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.template1.name}"]`)
      .should('exist')
      .contains(messages.shared.generic.template)
  })

  it('Verify that the content of both live quiz templates has been stored correctly', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()

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

  // #endregion

  // ! Cleanup: Deletion of all created templates, activities and questions
  // #region

  it('Delete all created templates', function () {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="cancel-deletion"]').click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template1.name}"]`
    ).click()
    cy.get('[data-cy="confirm-template-deletion"]').click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template2.name}"]`
    ).click()
    cy.get('[data-cy="confirm-template-deletion"]').click()
  })

  it('Delete all created activities', function () {
    // TODO: implement this test case once there are any activities created (that have not been converted)
    cy.loginLecturer()
  })

  it('Delete all created questions', function () {
    cy.loginLecturer()
    const questions = [
      this.data.SC1.title,
      this.data.MC1.title,
      this.data.KP1.title,
      this.data.NR1.title,
      this.data.FT1.title,
      this.data.SE1.title,
      this.data.CS1.title,
      this.data.SC2.title,
      this.data.MC2.title,
      this.data.KP2.title,
      this.data.NR2.title,
      this.data.FT2.title,
      this.data.SE2.title,
      this.data.CS2.title,
    ]
    cy.wrap(questions).each((question: string) => {
      cy.deleteElement({ elementName: question })
    })
  })

  it('Delete all created resources', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.collection.name })
  })

  it('Cleanup: Verify that the answer collections and catalog collections have been deleted correctly', function () {
    cy.loginLecturer()

    // validate that no collections except from the seeded ones remain
    cy.task('verifyDeletionAnswerCollections').then((result) => {
      if (result === null || result === false) {
        throw new Error(
          'The database contains answer collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })

    // validate that no catalog collections except from the seeded ones remain
    cy.task('verifyDeletionCatalogCollections').then((result) => {
      if (result === null || result === false) {
        throw new Error(
          'The database contains catalog collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  // #endregion
})
