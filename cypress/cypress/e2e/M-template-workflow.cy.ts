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
  it('Create a set of questions in the lecturer account for the template test suite', function () {
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
    cy.createQuestionSC({
      title: this.data.SCMLAF.title,
      content: this.data.SCMLAF.content,
      choices: this.data.SCMLAF.choices,
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
    cy.createQuestionMC({
      title: this.data.MCMLAF.title,
      content: this.data.MCMLAF.content,
      choices: this.data.MCMLAF.choices,
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
    cy.createQuestionKPRIM({
      title: this.data.KPMLAF.title,
      content: this.data.KPMLAF.content,
      choices: this.data.KPMLAF.choices,
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

    // create second set of questions that can be used to replace existing questions (with identical settings)
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSC({
      title: this.data.SC2.title,
      content: this.data.SC2.content,
      choices: this.data.SC2.choices,
    })
    cy.createQuestionSC({
      title: this.data.SCML2.title,
      content: this.data.SCML2.content,
      choices: this.data.SCML2.choices,
    })
    cy.createQuestionSC({
      title: this.data.SCMLAF2.title,
      content: this.data.SCMLAF2.content,
      choices: this.data.SCMLAF2.choices,
    })

    cy.createQuestionMC({
      title: this.data.MC2.title,
      content: this.data.MC2.content,
      choices: this.data.MC2.choices,
    })
    cy.createQuestionMC({
      title: this.data.MCML2.title,
      content: this.data.MCML2.content,
      choices: this.data.MCML2.choices,
    })
    cy.createQuestionMC({
      title: this.data.MCMLAF2.title,
      content: this.data.MCMLAF2.content,
      choices: this.data.MCMLAF2.choices,
    })

    cy.createQuestionKPRIM({
      title: this.data.KP2.title,
      content: this.data.KP2.content,
      choices: this.data.KP2.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KPML2.title,
      content: this.data.KPML2.content,
      choices: this.data.KPML2.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KPMLAF2.title,
      content: this.data.KPMLAF2.content,
      choices: this.data.KPMLAF2.choices,
    })

    cy.createQuestionNR({
      title: this.data.NR2.title,
      content: this.data.NR2.content,
      ...this.data.NR2.options,
    })
    cy.createQuestionNR({
      title: this.data.NRML2.title,
      content: this.data.NRML2.content,
      ...this.data.NRML2.options,
    })

    cy.createQuestionFT({
      title: this.data.FT2.title,
      content: this.data.FT2.content,
      ...this.data.FT2.options,
    })
    cy.createQuestionFT({
      title: this.data.FTML2.title,
      content: this.data.FTML2.content,
      ...this.data.FTML2.options,
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
      title: this.data.SE2.title,
      content: this.data.SE2.content,
      numberOfInputs: this.data.SE2.inputs,
      collectionName: this.data.collection.name,
    })
    cy.createQuestionSE({
      title: this.data.SEML2.title,
      content: this.data.SEML2.content,
      numberOfInputs: this.data.SEML2.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML2.solutions.includes(i)
      ),
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
    cy.createQuestionCS({
      title: this.data.CSML2.title,
      content: this.data.CSML2.content,
      explanation: this.data.CSML2.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CSML2.selectedItems.includes(i)
      ),
      criteria: this.data.CSML2.criteria,
      cases: this.data.CSML2.cases,
      solutions: this.data.CSML2.solutions,
    })
  })

  it("Create another set of questions in the account of user 'pro1' for the use in template", function () {
    cy.loginIndividualCatalyst()
    cy.createQuestionSC({
      title: this.data.SC3.title,
      content: this.data.SC3.content,
      choices: this.data.SC3.choices,
    })
    cy.createQuestionSC({
      title: this.data.SCML3.title,
      content: this.data.SCML3.content,
      choices: this.data.SCML3.choices,
    })
    cy.createQuestionSC({
      title: this.data.SCMLAF3.title,
      content: this.data.SCMLAF3.content,
      choices: this.data.SCMLAF3.choices,
    })

    cy.createQuestionMC({
      title: this.data.MC3.title,
      content: this.data.MC3.content,
      choices: this.data.MC3.choices,
    })
    cy.createQuestionMC({
      title: this.data.MCML3.title,
      content: this.data.MCML3.content,
      choices: this.data.MCML3.choices,
    })
    cy.createQuestionMC({
      title: this.data.MCMLAF3.title,
      content: this.data.MCMLAF3.content,
      choices: this.data.MCMLAF3.choices,
    })

    cy.createQuestionKPRIM({
      title: this.data.KP3.title,
      content: this.data.KP3.content,
      choices: this.data.KP3.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KPML3.title,
      content: this.data.KPML3.content,
      choices: this.data.KPML3.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KPMLAF3.title,
      content: this.data.KPMLAF3.content,
      choices: this.data.KPMLAF3.choices,
    })

    cy.createQuestionNR({
      title: this.data.NR3.title,
      content: this.data.NR3.content,
      ...this.data.NR3.options,
    })
    cy.createQuestionNR({
      title: this.data.NRML3.title,
      content: this.data.NRML3.content,
      ...this.data.NRML3.options,
    })

    cy.createQuestionFT({
      title: this.data.FT3.title,
      content: this.data.FT3.content,
      ...this.data.FT3.options,
    })
    cy.createQuestionFT({
      title: this.data.FTML3.title,
      content: this.data.FTML3.content,
      ...this.data.FTML3.options,
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
      title: this.data.SE3.title,
      content: this.data.SE3.content,
      numberOfInputs: this.data.SE3.inputs,
      collectionName: this.data.collection.name,
    })
    cy.createQuestionSE({
      title: this.data.SEML3.title,
      content: this.data.SEML3.content,
      numberOfInputs: this.data.SEML3.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML3.solutions.includes(i)
      ),
    })

    cy.createQuestionCS({
      title: this.data.CS3.title,
      content: this.data.CS3.content,
      explanation: this.data.CS3.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CS3.selectedItems.includes(i)
      ),
      criteria: this.data.CS3.criteria,
      cases: this.data.CS3.cases,
      solutions: this.data.CS3.solutions,
    })
    cy.createQuestionCS({
      title: this.data.CSML3.title,
      content: this.data.CSML3.content,
      explanation: this.data.CSML3.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CSML3.selectedItems.includes(i)
      ),
      criteria: this.data.CSML3.criteria,
      cases: this.data.CSML3.cases,
      solutions: this.data.CSML3.solutions,
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

  // TODO: add the second template to a restricted catalog collection and share access to it with user pro1
  // TODO: open template in lecturer account, test all functionalities and create new activity from it (& test it)
  // TODO: open the template in the restricted catalog collection through user pro1, test all functionalities, use it, create new activity from it (& test it) and verify that access to answer collection has been given (and verify that only elements that were used in live quiz have been added to own library)

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
