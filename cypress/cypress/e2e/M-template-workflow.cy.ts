import { CatalogObjectType } from '@klicker-uzh/types'
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
      title: this.data.SC.title,
      content: this.data.SC.content,
      choices: this.data.SC.choices,
    })
    cy.createQuestionSC({
      title: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
    })

    cy.createQuestionMC({
      title: this.data.MC.title,
      content: this.data.MC.content,
      choices: this.data.MC.choices,
    })
    cy.createQuestionMC({
      title: this.data.MCML.title,
      content: this.data.MCML.content,
      choices: this.data.MCML.choices,
    })

    cy.createQuestionKPRIM({
      title: this.data.KP.title,
      content: this.data.KP.content,
      choices: this.data.KP.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KPML.title,
      content: this.data.KPML.content,
      choices: this.data.KPML.choices,
    })

    cy.createQuestionNR({
      title: this.data.NR.title,
      content: this.data.NR.content,
      ...this.data.NR.options,
    })
    cy.createQuestionNR({
      title: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
    })

    cy.createQuestionFT({
      title: this.data.FT.title,
      content: this.data.FT.content,
      ...this.data.FT.options,
    })
    cy.createQuestionFT({
      title: this.data.FTML.title,
      content: this.data.FTML.content,
      ...this.data.FTML.options,
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
      title: this.data.SE.title,
      content: this.data.SE.content,
      numberOfInputs: this.data.SE.inputs,
      collectionName: this.data.collection.name,
    })
    cy.createQuestionSE({
      title: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
    })

    cy.createQuestionCS({
      title: this.data.CS.title,
      content: this.data.CS.content,
      explanation: this.data.CS.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CS.selectedItems.includes(i)
      ),
      criteria: this.data.CS.criteria,
      cases: this.data.CS.cases,
      solutions: this.data.CS.solutions,
    })
    cy.createQuestionCS({
      title: this.data.CSML.title,
      content: this.data.CSML.content,
      explanation: this.data.CSML.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CSML.selectedItems.includes(i)
      ),
      criteria: this.data.CSML.criteria,
      cases: this.data.CSML.cases,
      solutions: this.data.CSML.solutions,
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

  it('Add the live quiz template to the top level catalog collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.LIVE_QUIZ_TEMPLATE}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-public"]').click()
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

  // TODO: use live quiz template to create new activities

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
      this.data.SC.title,
      this.data.MC.title,
      this.data.KP.title,
      this.data.NR.title,
      this.data.FT.title,
      this.data.SE.title,
      this.data.CS.title,
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KPML.title,
      this.data.NRML.title,
      this.data.FTML.title,
      this.data.SEML.title,
      this.data.CSML.title,
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
