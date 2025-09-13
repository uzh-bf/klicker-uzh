import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for KPRIM elements', function () {
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

  // ! KPRIM questions
  // #region
  it('Create a KPRIM question', function () {
    // create KPRIM question with minimal information
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').realClick()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.KPRIM.typeLabel}"]`
    ).realClick()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.KPRIM.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.KP.title)
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .realType(this.data.KP.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .realType(this.data.KP.choices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.KP.choices[0]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .realType(this.data.KP.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.KP.choices[1]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .realType(this.data.KP.choices[2])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[2]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .realType(this.data.KP.choices[3])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(
      this.data.KP.choices[3]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // check if clearing an answer option correctly disables submission of the question
    cy.get('[data-cy="insert-answer-field-2"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .realType(this.data.KP.choices[2])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[2]
    )
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // test reordering answer options
    cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
    cy.get('[data-cy="move-answer-option-ix-0-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.KP.choices[1]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.KP.choices[0]
    )
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[2]
    )
    cy.get('[data-cy="insert-answer-field-3"]').findByText(
      this.data.KP.choices[3]
    )

    cy.get('[data-cy="move-answer-option-ix-3-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="move-answer-option-ix-3-down"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.KP.choices[1]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.KP.choices[0]
    )
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[3]
    )
    cy.get('[data-cy="insert-answer-field-3"]').findByText(
      this.data.KP.choices[2]
    )

    cy.get('[data-cy="move-answer-option-ix-2-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.KP.choices[1]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.KP.choices[3]
    )
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[0]
    )
    cy.get('[data-cy="insert-answer-field-3"]').findByText(
      this.data.KP.choices[2]
    )

    cy.get('[data-cy="move-answer-option-ix-2-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.KP.choices[1]
    )
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.KP.choices[3]
    )
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[2]
    )
    cy.get('[data-cy="insert-answer-field-3"]').findByText(
      this.data.KP.choices[0]
    )
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // verify that the created KPRIM question is correctly displayed in the question pool
    cy.validateElement({
      element: this.data.KP.title,
      contains: [
        this.data.KP.content,
        this.data.KP.title,
        messages.shared.READY.statusLabel,
      ],
    })
    cy.get(`[data-cy="edit-element-${this.data.KP.title}"]`).click()
    cy.get('[data-cy="kp-answer-options"]').should('have.length', 4)
  })

  it('Check that values of KPRIM question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.KP.title}"]`).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.KPRIM.typeLabel)
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.KP.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.KP.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.KP.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.KP.choices[3])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(this.data.KP.choices[2])
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .contains(this.data.KP.choices[0])
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit a KPRIM question and add a sample solution', function () {
    // modify the question and test removing answer options and the corresponding validation
    cy.get(`[data-cy="edit-element-${this.data.KP.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.KP.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .realType(this.data.KP.contentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .realType(this.data.KP.choicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .realType(this.data.KP.choicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .realType(this.data.KP.choicesEdited[2])
    cy.get('[data-cy="delete-answer-option-ix-3"]').click()
    cy.get('[data-cy="insert-answer-field-3"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .clear()
      .realType(this.data.KP.choicesEdited[3])
    cy.get('[data-cy="add-new-answer"]').should('be.disabled')
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // add a sample solution to the KPRIM question
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled') // no correct solution required for KPRIM questions
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get(`[data-cy="set-correctness-3"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    // verify that the updated KPRIM question is correctly displayed in the question pool
    cy.validateElement({
      element: this.data.KP.titleEdited,
      contains: [this.data.KP.contentEdited, this.data.KP.titleEdited],
    })
  })

  it('Check that edited KPRIM question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.KP.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.KP.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.KP.contentEdited)

    cy.wrap(this.data.KP.choicesEdited).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit the KPRIM question again and add answer feedbacks', function () {
    cy.get(`[data-cy="edit-element-${this.data.KP.titleEdited}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // enable answer feedbacks and add valid ones for all options
    cy.get('[data-cy="configure-answer-feedbacks"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // feedbacks for all answer options are required
    cy.wrap(this.data.KP.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get('[data-cy="save-new-question"]').should('be.disabled')
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .tyrealTypepe(feedback)
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
      .realType(this.data.KP.choicesFeedbacks[0])
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .realType(this.data.KP.choicesFeedbacks[1])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // verify that reordering answer options also reorders the corresponding feedbacks
    cy.wrap(this.data.KP.choicesEdited).each((choice: string, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .contains(choice)
    })
    cy.wrap(this.data.KP.choicesFeedbacks).each((feedback: string, ix) => {
      cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
        .realClick()
        .contains(feedback)
    })
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="move-answer-option-ix-1-down"]').realClick()
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.KP.choicesEdited[0])
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .contains(this.data.KP.choicesFeedbacks[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.KP.choicesEdited[2])
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .contains(this.data.KP.choicesFeedbacks[2])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(this.data.KP.choicesEdited[1])
    cy.get('[data-cy="insert-answer-feedback-2"]')
      .realClick()
      .contains(this.data.KP.choicesFeedbacks[1])
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="move-answer-option-ix-2-up"]').realClick()
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(this.data.KP.choicesEdited[0])
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .contains(this.data.KP.choicesFeedbacks[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(this.data.KP.choicesEdited[1])
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .contains(this.data.KP.choicesFeedbacks[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(this.data.KP.choicesEdited[2])
    cy.get('[data-cy="insert-answer-feedback-2"]')
      .realClick()
      .contains(this.data.KP.choicesFeedbacks[2])

    // save modified question
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })
  // #endregion
})
