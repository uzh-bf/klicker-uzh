import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for selection elements', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })

    cy.loginLecturer()
    cy.get('[data-cy="resources"]').should('exist')
    cy.get('[data-cy="analytics"]').should('exist')
  })

  // ! Selection questions
  // #region
  it('Create the answer collections that will be used for the selection question tests', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.createAnswerCollection({
      name: this.data.SE.collection,
      description: this.data.SE.collectionDescription,
      entries: [...this.data.SE.solutions, ...this.data.SE.solutionsNotChosen],
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createAnswerCollection({
      name: this.data.SE.collectionEdited,
      description: this.data.SE.collectionDescriptionEdited,
      entries: [
        ...this.data.SE.solutionsEdited,
        ...this.data.SE.solutionsNotChosenEdited,
      ],
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Create a Selection question', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SELECTION.typeLabel)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // enter question data
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.SE.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.SE.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.SE.explanation)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select an answer collection
    cy.get('[data-cy="select-answer-collection"]').contains(
      messages.manage.questionForms.selectCollection
    )
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.SE.collection
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // configure number of inputs and test min & max restrictions
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .type(String(this.data.SE.inputs))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(
        String(
          this.data.SE.solutions.length + this.data.SE.solutionsNotChosen.length
        )
      ) // maximum number of inputs = options - 1
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(
        String(
          this.data.SE.solutions.length +
            this.data.SE.solutionsNotChosen.length -
            1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(String(this.data.SE.inputs))

    // test that enabling sample solution works correctly
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    cy.get(`[data-cy="element-item-${this.data.SE.title}"]`).contains(
      this.data.SE.content
    )
    cy.get(`[data-cy="element-item-${this.data.SE.title}"]`).contains(
      this.data.SE.title
    )
    cy.get(`[data-cy="element-item-${this.data.SE.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Verify that the correct content has been saved', function () {
    cy.get(`[data-cy="edit-question-${this.data.SE.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SE.title
    )
    cy.get('[data-cy="select-question-status"]').contains(
      messages.shared.READY.statusLabel
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.SE.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .contains(this.data.SE.explanation)
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.SE.collection
    )
    cy.get('[data-cy="configure-number-of-inputs"]').should(
      'have.value',
      this.data.SE.inputs
    )
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that creation was successful and that preview is visible and correct', function () {
    cy.get(`[data-cy="edit-question-${this.data.SE.title}"]`).click()
    cy.get(`[data-cy="element-item-${this.data.SE.title}"]`).contains(
      this.data.SE.title
    )
    cy.get(`[data-cy="element-item-${this.data.SE.title}"]`).contains(
      this.data.SE.content
    )

    // check that inputs are available
    for (let i = 1; i < this.data.SE.inputs; i++) {
      cy.get(`[id="selection-0-field-${i}"]`).should('exist')
    }

    // check that all options are available
    cy.get('[id="selection-0-field-0"]').click()
    cy.wrap(this.data.SE.solutions).each((value: string) => {
      cy.findByText(value).should('exist')
    })
    cy.wrap(this.data.SE.solutionsNotChosen).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Verify that all options of the answer collection can be edited', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE.solutions).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.SE.solutionsNotChosen).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Add a sample solution to the created selection question', function () {
    cy.get(`[data-cy="edit-question-${this.data.SE.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SE.title
    )

    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.get('[data-cy="choose-correct-answer-options"]').click()
    cy.findByText(this.data.SE.solutions[0]).realClick()
    cy.get('[data-cy="choose-correct-answer-options"]').contains(
      this.data.SE.solutions[0]
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // number of solutions needs to be >= number of inputs
    cy.wrap(this.data.SE.solutions.slice(1)).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').click()
      cy.findByText(solution).realClick()
      cy.get('[data-cy="choose-correct-answer-options"]').contains(solution)
    })
    cy.get('[data-cy="save-new-question"]').click()
  })

  it('Verify that the sample solution has been stored correctly for the modified selection question', function () {
    cy.get(`[data-cy="edit-question-${this.data.SE.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SE.title
    )

    cy.wrap(this.data.SE.solutions).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').contains(solution)
    })
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that the options that are used as a solution cannot be deleted anymore', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.findByText(messages.manage.resources.answerOptionUsed).should('exist')
    cy.wrap(this.data.SE.solutions).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.SE.solutionsNotChosen).each((sol) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Verify that the answer collection cannot be deleted anymore', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it('Edit the selection question and change the answer collection (including new sample solutions)', function () {
    cy.get(`[data-cy="edit-question-${this.data.SE.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.SE.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.SE.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .clear()
      .type(this.data.SE.explanationEdited)

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.SE.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.SE.collectionEdited
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // answer options are cleared on collection change
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(String(this.data.SE.inputsEdited))
    cy.wrap(this.data.SE.solutionsEdited).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').click()
      cy.findByText(solution).realClick()
    })

    cy.get('[data-cy="save-new-question"]').click()
  })

  it('Verify that the edited state of the selection question persists', function () {
    cy.get(`[data-cy="edit-question-${this.data.SE.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SE.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.SE.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .contains(this.data.SE.explanationEdited)
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.SE.collectionEdited
    )
    cy.get('[data-cy="configure-number-of-inputs"]').should(
      'have.value',
      this.data.SE.inputsEdited
    )
    cy.wrap(this.data.SE.solutionsEdited).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').contains(solution)
    })
  })

  it('Verify that the previous answer collection could be deleted again, the current one not', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'not.have.attr',
      'data-disabled'
    )
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="close-answer-collection-edit-modal"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it('Check that only answer options not used as solutions can be deleted', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE.solutions).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.SE.solutionsNotChosen).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE.solutionsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.SE.solutionsNotChosenEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Delete the selection question', function () {
    cy.deleteElement({ elementName: this.data.SE.titleEdited })
  })

  it('Verify that after the deletion of the linked questions, all solution options can be deleted again', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE.solutions).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.SE.solutionsNotChosen).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE.solutionsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.SE.solutionsNotChosenEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Cleanup: Delete all created answer collections', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.SE.collection })
    cy.deleteAnswerCollection({ collectionName: this.data.SE.collectionEdited })
  })
  // #endregion
})
