import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for Single Choice elements', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('DM-questions.json').then((data) => {
      this.data = data
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  // ! Single choice questions
  // #region
  it('Create a single choice question', function () {
    // fill in minimal information for SC question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(this.data.SC.title)
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .realType(this.data.SC.content)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .realType(this.data.SC.choices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.SC.choices[0]
    )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .realType(this.data.SC.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.SC.choices[1]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // make sure that if the answer option fields are cleared, submission is blocked
    cy.get('[data-cy="insert-answer-field-1"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .realType(this.data.SC.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.SC.choices[1]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // try moving around the answer options and make sure that UI updates accordingly
    cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
    cy.get('[data-cy="move-answer-option-ix-0-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.SC.choices[1]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.SC.choices[0]
    )

    cy.get('[data-cy="move-answer-option-ix-1-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="move-answer-option-ix-1-down"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.SC.choices[0]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.SC.choices[1]
    )
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    // verify that the item immediately appears in the question pool after saving it
    cy.validateElement({
      element: this.data.SC.title,
      contains: [
        this.data.SC.content,
        this.data.SC.title,
        messages.shared.READY.statusLabel,
      ],
    })
  })

  it('Check that values of single choice question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="sc-0-answer-option-0"]').should('exist')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('exist')

    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SC.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.SC.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.SC.choices[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.SC.choices[1])
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit a single choice question and add a sample solution', function () {
    // update contents of SC question
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.SC.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .realType(this.data.SC.contentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .realType(this.data.SC.choicesEdited[0])
    cy.get('[data-cy="delete-answer-option-ix-1"]').click()
    cy.get('[data-cy="insert-answer-field-1"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .realType(this.data.SC.choicesEdited[1])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .realType(this.data.SC.choicesEdited[2])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // add a sample solution and check that exactly one correct answer is required
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="set-correctness-0"]`).click() // trigger to disable solution again
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // only one correct answer is allowed
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    // verify that the updated element immediately appears in the question pool after saving it
    cy.validateElement({
      element: this.data.SC.titleEdited,
      contains: [this.data.SC.contentEdited, this.data.SC.titleEdited],
    })
  })

  it('Edit the single choice question again and add answer feedbacks', function () {
    cy.get(`[data-cy="edit-element-${this.data.SC.titleEdited}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // enable answer feedbacks and add valid ones for all options
    cy.get('[data-cy="configure-answer-feedbacks"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // feedbacks for all answer options are required
    cy.wrap(this.data.SC.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get('[data-cy="save-new-question"]').should('be.disabled')
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .realType(feedback)
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`).contains(feedback)
    })
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // clearing an answer feedback field is correctly detected and leads to invalidation
    cy.get('[data-cy="insert-answer-feedback-1"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-0"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .realType(this.data.SC.choicesFeedbacks[0])
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .realType(this.data.SC.choicesFeedbacks[1])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // verify that reordering answer options also reorders the corresponding feedbacks
    cy.wrap(this.data.SC.choicesEdited).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })
    cy.wrap(this.data.SC.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .contains(feedback)
    })
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="move-answer-option-ix-1-down"]').realClick()
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.SC.choicesEdited[0])
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .contains(this.data.SC.choicesFeedbacks[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.SC.choicesEdited[2])
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .contains(this.data.SC.choicesFeedbacks[2])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(this.data.SC.choicesEdited[1])
    cy.get('[data-cy="insert-answer-feedback-2"]')
      .realClick()
      .contains(this.data.SC.choicesFeedbacks[1])
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="move-answer-option-ix-2-up"]').realClick()
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.SC.choicesEdited[0])
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .contains(this.data.SC.choicesFeedbacks[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.SC.choicesEdited[1])
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .contains(this.data.SC.choicesFeedbacks[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(this.data.SC.choicesEdited[2])
    cy.get('[data-cy="insert-answer-feedback-2"]')
      .realClick()
      .contains(this.data.SC.choicesFeedbacks[2])

    // save modified question
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Check that edited single choice question is stored and loaded correctly', function () {
    // check general question information
    cy.get(`[data-cy="edit-element-${this.data.SC.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SC.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.SC.contentEdited)

    // check choices content
    cy.wrap(this.data.SC.choicesEdited).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })

    // check answer feedbacks
    cy.wrap(this.data.SC.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .contains(feedback)
    })

    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion
})
