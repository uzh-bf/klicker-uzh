import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for selection elements', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.fixture('DM-questions.json').then((data) => {
      this.data = data
    })

    cy.loginLecturer()
    cy.get('[data-cy="resources"]').should('exist')
    cy.get('[data-cy="analytics"]').should('exist')
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  // ! Selection questions
  // #region
  it('Create the answer collections that will be used for the selection question tests', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
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
    cy.get('[data-cy="select-question-type"]').realClick()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).realClick()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SELECTION.typeLabel)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // enter question data
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.SE.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.SE.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.SE.explanation)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select an answer collection
    cy.get('[data-cy="select-answer-collection"]').contains(
      messages.manage.elements.selectCollection
    )
    cy.selectOption(
      '[data-cy="select-answer-collection"]',
      this.data.SE.collection
    )
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

    cy.validateElement({
      element: this.data.SE.title,
      contains: [
        this.data.SE.content,
        this.data.SE.title,
        messages.shared.READY.statusLabel,
      ],
    })
  })

  it('Verify that the correct content has been saved', function () {
    cy.get(`[data-cy="edit-element-${this.data.SE.title}"]`).click()
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
    cy.get(`[data-cy="edit-element-${this.data.SE.title}"]`).click()

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
    cy.get(`[data-cy="edit-element-${this.data.SE.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SE.title
    )

    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.get('[data-cy="choose-correct-answer-options"]').realClick()
    cy.findByText(this.data.SE.solutions[0]).realClick()
    cy.get('[data-cy="choose-correct-answer-options"]').contains(
      this.data.SE.solutions[0]
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // number of solutions needs to be >= number of inputs
    cy.wrap(this.data.SE.solutions.slice(1)).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').realClick()
      cy.findByText(solution).realClick()
      cy.get('[data-cy="choose-correct-answer-options"]').contains(solution)
    })
    cy.get('[data-cy="save-new-question"]').click()
  })

  it('Verify that the sample solution has been stored correctly for the modified selection question', function () {
    cy.get(`[data-cy="edit-element-${this.data.SE.title}"]`).click()
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
    cy.get(`[data-cy="edit-element-${this.data.SE.title}"]`).click()
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

    cy.get('[data-cy="select-answer-collection"]').realClick()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.SE.collectionEdited}"]`
    ).realClick()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.SE.collectionEdited
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // answer options are cleared on collection change
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(String(this.data.SE.inputsEdited))
    cy.wrap(this.data.SE.solutionsEdited).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').realClick()
      cy.findByText(solution).realClick()
    })

    cy.get('[data-cy="save-new-question"]').click()
  })

  it('Verify that the edited state of the selection question persists', function () {
    cy.get(`[data-cy="edit-element-${this.data.SE.titleEdited}"]`).click()
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

  it('Verify that after the deletion of the linked questions, all solution options can be deleted again', function () {
    cy.deleteElement({ elementName: this.data.SE.titleEdited })

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
  // #endregion

  // ! Selection question with inline answer collection creation
  // #region
  it('Create a selection question with inline answer collection', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').realClick()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).realClick()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SELECTION.typeLabel)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // enter question data
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .type(this.data.SE_INLINE.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.SE_INLINE.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.SE_INLINE.explanation)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // check if button for manual creation is present and click it
    cy.get('[data-cy="create-inline-answer-collection"]')
      .should('exist')
      .click()

    // enter items manually
    cy.wrap(this.data.SE_INLINE.items).each((item: string) => {
      cy.get('#inline-answer-collection-options').type(`${item}{enter}`)
    })
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // configure number of inputs
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(String(this.data.SE_INLINE.inputs))

    // add sample solution
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select correct answers
    cy.wrap(this.data.SE_INLINE.solutions).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]')
        .realClick()
        .type(`${solution}{enter}`)
    })
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // add another item
    const additionalItem = 'Additional Selection Item'
    cy.get('#inline-answer-collection-options').type(`${additionalItem}{enter}`)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // check that the item was added
    cy.get('#inline-answer-collection-options').should(
      'contain',
      additionalItem
    )

    // select the additional item as correct answer
    cy.get('[data-cy="choose-correct-answer-options"]')
      .realClick()
      .type(`${additionalItem}{enter}`)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // verify the additional item is selected as a correct answer
    cy.get('[data-cy="choose-correct-answer-options"]').contains(additionalItem)

    // remove the item again and verify it was automatically removed from the answers too
    cy.get('#inline-answer-collection-options').type(`{backspace}`)

    // check that the item is removed from correct answers
    cy.get('[data-cy="choose-correct-answer-options"]').should(
      'not.contain',
      additionalItem
    )
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    cy.validateElement({
      element: this.data.SE_INLINE.title,
      contains: [this.data.SE_INLINE.content, this.data.SE_INLINE.title],
    })
  })

  it('Verify that a new answer collection was created when creating the selection question', function () {
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE_INLINE.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE_INLINE.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        this.data.SE_INLINE.solutions.includes(sol)
          ? 'be.disabled'
          : 'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Edit the inline created selection question', function () {
    cy.get(`[data-cy="edit-element-${this.data.SE_INLINE.title}"]`).click()

    // edit basic information
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.SE_INLINE.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.SE_INLINE.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .clear()
      .type(this.data.SE_INLINE.explanationEdited)

    // ensure that switching to manual item creation is not possible during editing
    cy.get('[data-cy="create-inline-answer-collection"]').should('not.exist')

    // edit number of inputs
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .clear()
      .type(String(this.data.SE_INLINE.inputsEdited))

    // verify that the correct answers only contain the selected answer options
    cy.wrap(this.data.SE_INLINE.solutions).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').contains(solution)
    })
    cy.wrap(
      this.data.SE_INLINE.items.filter(
        (item: string) => !this.data.SE_INLINE.solutions.includes(item)
      )
    ).each((solution: string) => {
      cy.get('[data-cy="choose-correct-answer-options"]').should(
        'not.contain',
        solution
      )
    })

    // save changes
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // verify the changes were saved
    cy.validateElement({
      element: this.data.SE_INLINE.titleEdited,
      contains: [
        this.data.SE_INLINE.contentEdited,
        this.data.SE_INLINE.titleEdited,
      ],
    })
  })

  it('Delete the inline created selection question', function () {
    cy.deleteElement({ elementName: this.data.SE_INLINE.titleEdited })

    // verify the collection can be deleted now
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE_INLINE.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.SE_INLINE.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.SE_INLINE.collection}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'not.have.attr',
      'data-disabled'
    )
  })
  // #endregion
})
