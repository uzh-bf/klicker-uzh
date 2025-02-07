import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for Multiple Choice elements', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })
  })

  // ! Multiple choice questions
  // #region
  it('Create a multiple choice question', function () {
    // insert general information for MC question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.MC.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.MC.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.MC.title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.MC.content)

    // insert answer options for MC question
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(this.data.MC.choices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.MC.choices[0]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(this.data.MC.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.MC.choices[1]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .type(this.data.MC.choices[2])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.MC.choices[2]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .type(this.data.MC.choices[3])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(
      this.data.MC.choices[3]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // verify that clearing an answer option is correctly recognized
    cy.get('[data-cy="insert-answer-field-1"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(this.data.MC.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.MC.choices[1]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // test moving around answer options
    cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
    cy.get('[data-cy="move-answer-option-ix-0-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.MC.choices[1]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.MC.choices[0]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="move-answer-option-ix-1-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="move-answer-option-ix-3-up"]').should('not.be.disabled')
    cy.get('[data-cy="move-answer-option-ix-3-down"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.MC.choices[0]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.MC.choices[1]
    )
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // verify that question is correctly created
    cy.get(`[data-cy="element-item-${this.data.MC.title}"]`).contains(
      this.data.MC.content
    )
    cy.get(`[data-cy="element-item-${this.data.MC.title}"]`).contains(
      this.data.MC.title
    )
    cy.get(`[data-cy="element-item-${this.data.MC.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-question-${this.data.MC.title}"]`).click()
    cy.get('[data-cy="mc-0-answer-option-0"]').should('exist')
    cy.get('[data-cy="mc-0-answer-option-1"]').should('exist')
  })

  it('Check that values of multiple choice question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.MC.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.MC.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.MC.content)

    cy.wrap(this.data.MC.choices).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit a multiple choice question and add a sample solution', function () {
    // modify minimal content of MC question
    cy.get(`[data-cy="edit-question-${this.data.MC.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.MC.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.MC.contentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[2])
    cy.get('[data-cy="delete-answer-option-ix-3"]').click() // test deleting answer options
    cy.get('[data-cy="insert-answer-field-3"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[3])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-4"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[4])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-5"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[5])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-6"]')
      .realClick()
      .clear()
      .type(this.data.MC.choicesEdited[6])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // enable sample solution and check that at least one correct answer is required
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="set-correctness-0"]`).click() // verify that sample solution can also be deactivated again
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get(`[data-cy="set-correctness-5"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    // verify that the updated content of the MC question is correctly displayed
    cy.get(`[data-cy="element-item-${this.data.MC.titleEdited}"]`).contains(
      this.data.MC.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.MC.titleEdited}"]`).contains(
      this.data.MC.contentEdited
    )
  })

  it('Edit the multiple choice question again and add answer feedbacks', function () {
    cy.get(`[data-cy="edit-question-${this.data.MC.titleEdited}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // enable answer feedbacks and add valid ones for all options
    cy.get('[data-cy="configure-answer-feedbacks"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // feedbacks for all answer options are required
    cy.wrap(this.data.MC.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get('[data-cy="save-new-question"]').should('be.disabled')
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .type(feedback)
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`).contains(feedback)
    })
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // clearing an answer feedback field is correctly detected and leads to invalidation
    cy.get('[data-cy="insert-answer-feedback-1"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .type(this.data.MC.choicesFeedbacks[1])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // verify that reordering answer options also reorders the corresponding feedbacks
    cy.get('[data-cy="move-answer-option-ix-1-down"]').click()
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.MC.choicesEdited[0])
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .contains(this.data.MC.choicesFeedbacks[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.MC.choicesEdited[2])
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .contains(this.data.MC.choicesFeedbacks[2])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(this.data.MC.choicesEdited[1])
    cy.get('[data-cy="insert-answer-feedback-2"]')
      .realClick()
      .contains(this.data.MC.choicesFeedbacks[1])

    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="move-answer-option-ix-2-up"]').click()
    cy.wrap(this.data.MC.choicesEdited).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })
    cy.wrap(this.data.MC.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .contains(feedback)
    })

    // save modified question
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Check that edited multiple choice question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.MC.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.MC.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.MC.contentEdited)

    // check content of existing choices
    cy.wrap(this.data.MC.choicesEdited).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })

    // check content of answer feedbacks
    cy.wrap(this.data.MC.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .contains(feedback)
    })

    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Delete the multiple choice question', function () {
    cy.deleteElement({ elementName: this.data.MC.titleEdited })
  })
  // #endregion
})
