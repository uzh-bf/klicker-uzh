import messages from '../../../packages/i18n/messages/en'

describe('Create different types of elements (with and without sample solution) and edit them', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })
  })

  it('Create a content element', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CONTENT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CONTENT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(this.data.CT.title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.CT.content)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.CT.title}"]`).contains(
      this.data.CT.content
    )
    cy.get(`[data-cy="element-item-${this.data.CT.title}"]`).contains(
      this.data.CT.title
    )
    cy.get(`[data-cy="element-item-${this.data.CT.title}"]`).contains(
      messages.shared.DRAFT.statusLabel
    )
  })

  it('Check that values of content element are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.CT.title}"]`).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CONTENT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CT.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.DRAFT.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.CT.content)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a content element', function () {
    cy.get(`[data-cy="edit-question-${this.data.CT.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.CT.titleEdited)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.CT.contentEdited)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.CT.titleEdited}"]`).contains(
      this.data.CT.contentEdited
    )
    cy.get(`[data-cy="element-item-${this.data.CT.titleEdited}"]`).contains(
      this.data.CT.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.CT.titleEdited}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Check that edited content element is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.CT.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CT.titleEdited
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.CT.contentEdited)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a flashcard element', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FLASHCARD.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(this.data.FC.title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.REVIEW.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.FC.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.FC.explanation)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.FC.title}"]`).contains(
      this.data.FC.content
    )
    cy.get(`[data-cy="element-item-${this.data.FC.title}"]`).contains(
      this.data.FC.title
    )
    cy.get(`[data-cy="element-item-${this.data.FC.title}"]`).contains(
      messages.shared.REVIEW.statusLabel
    )
  })

  it('Check that values of flashcard element are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.FC.title}"]`).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.FC.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.REVIEW.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.FC.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .contains(this.data.FC.explanation)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a flashcard element', function () {
    cy.get(`[data-cy="edit-question-${this.data.FC.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.FC.titleEdited)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.FC.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .clear()
      .type(this.data.FC.explanationEdited)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.FC.titleEdited}"]`).contains(
      this.data.FC.contentEdited
    )
    cy.get(`[data-cy="element-item-${this.data.FC.titleEdited}"]`).contains(
      this.data.FC.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.FC.titleEdited}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Check that edited flashcard element is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.FC.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.FC.titleEdited
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.FC.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .contains(this.data.FC.explanationEdited)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a single choice question', function () {
    // fill in minimal information for SC question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(this.data.SC.title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.SC.content)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(this.data.SC.choices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.SC.choices[0]
    )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(this.data.SC.choices[1])
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
      .type(this.data.SC.choices[1])
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
    cy.get(`[data-cy="element-item-${this.data.SC.title}"]`).contains(
      this.data.SC.content
    )
    cy.get(`[data-cy="element-item-${this.data.SC.title}"]`).contains(
      this.data.SC.title
    )
    cy.get(`[data-cy="element-item-${this.data.SC.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Check that values of single choice question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('exist')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('exist')

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
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a single choice question and add a sample solution', function () {
    // update contents of SC question
    cy.get(`[data-cy="edit-question-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.SC.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.SC.contentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .type(this.data.SC.choicesEdited[0])
    cy.get('[data-cy="delete-answer-option-ix-1"]').click()
    cy.get('[data-cy="insert-answer-field-1"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .type(this.data.SC.choicesEdited[1])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .type(this.data.SC.choicesEdited[2])
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
    cy.get(`[data-cy="element-item-${this.data.SC.titleEdited}"]`).contains(
      this.data.SC.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.SC.titleEdited}"]`).contains(
      this.data.SC.contentEdited
    )
  })

  it('Edit the SC question again and add answer feedbacks', function () {
    cy.get(`[data-cy="edit-question-${this.data.SC.titleEdited}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // enable answer feedbacks and add valid ones for all options
    cy.get('[data-cy="configure-answer-feedbacks"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // feedbacks for all answer options are required
    cy.wrap(this.data.SC.choicesFeedbacks).each((feedback: string, ix) => {
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
    cy.get('[data-cy="insert-answer-feedback-0"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .type(this.data.SC.choicesFeedbacks[0])
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .type(this.data.SC.choicesFeedbacks[1])
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
    cy.get(`[data-cy="edit-question-${this.data.SC.titleEdited}"]`).click()
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

    cy.get('[data-cy="close-question-modal"]').click()
  })

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
    cy.get('[data-cy="mc-1-answer-option-1"]').should('exist')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('exist')
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
    cy.get('[data-cy="close-question-modal"]').click()
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

  it('Edit the MC question again and add answer feedbacks', function () {
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

    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a KPRIM question', function () {
    // create KPRIM question with minimal information
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.KPRIM.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.KPRIM.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.KP.title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.KP.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(this.data.KP.choices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(
      this.data.KP.choices[0]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(this.data.KP.choices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(
      this.data.KP.choices[1]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .type(this.data.KP.choices[2])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(
      this.data.KP.choices[2]
    )
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .type(this.data.KP.choices[3])
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
      .type(this.data.KP.choices[2])
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
    cy.get(`[data-cy="element-item-${this.data.KP.title}"]`).contains(
      this.data.KP.content
    )
    cy.get(`[data-cy="element-item-${this.data.KP.title}"]`).contains(
      this.data.KP.title
    )
    cy.get(`[data-cy="element-item-${this.data.KP.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-question-${this.data.KP.title}"]`).click()
    cy.get('[data-cy="kp-answer-options"]').should('have.length', 4)
  })

  it('Check that values of KPRIM question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.KP.title}"]`).click()
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
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a KPRIM question and add a sample solution', function () {
    // modify the question and test removing answer options and the corresponding validation
    cy.get(`[data-cy="edit-question-${this.data.KP.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.KP.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.KP.contentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .type(this.data.KP.choicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .type(this.data.KP.choicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .type(this.data.KP.choicesEdited[2])
    cy.get('[data-cy="delete-answer-option-ix-3"]').click()
    cy.get('[data-cy="insert-answer-field-3"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .clear()
      .type(this.data.KP.choicesEdited[3])
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
    cy.get(`[data-cy="element-item-${this.data.KP.titleEdited}"]`).contains(
      this.data.KP.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.KP.titleEdited}"]`).contains(
      this.data.KP.contentEdited
    )
  })

  it('Check that edited KPRIM question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.KP.titleEdited}"]`).click()
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
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit the KPRIM question again and add answer feedbacks', function () {
    cy.get(`[data-cy="edit-question-${this.data.KP.titleEdited}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // enable answer feedbacks and add valid ones for all options
    cy.get('[data-cy="configure-answer-feedbacks"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // feedbacks for all answer options are required
    cy.wrap(this.data.KP.choicesFeedbacks).each((feedback: string, ix) => {
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
    cy.get('[data-cy="insert-answer-feedback-0"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-0"]')
      .realClick()
      .type(this.data.KP.choicesFeedbacks[0])
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-feedback-1"]')
      .realClick()
      .type(this.data.KP.choicesFeedbacks[1])
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

  it('Create a Numerical question', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.NUMERICAL.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.NUMERICAL.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.NR.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.NR.content)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="set-numerical-minimum"]')
      .click()
      .type(String(this.data.NR.min))
    cy.get('[data-cy="set-numerical-maximum"]')
      .click()
      .type(String(this.data.NR.max))
    cy.get('[data-cy="set-numerical-unit"]').click().type(this.data.NR.unit)
    cy.get('[data-cy="set-numerical-accuracy"]')
      .click()
      .type(String(this.data.NR.accuracy))
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.NR.title}"]`).contains(
      this.data.NR.content
    )
    cy.get(`[data-cy="element-item-${this.data.NR.title}"]`).contains(
      this.data.NR.title
    )
    cy.get(`[data-cy="element-item-${this.data.NR.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-question-${this.data.NR.title}"]`).click()
    cy.get('[data-cy="input-numerical-minimum"]').contains(
      `Min: ${this.data.NR.min}`
    )
    cy.get('[data-cy="input-numerical-maximum"]').contains(
      `Max: ${this.data.NR.max}`
    )
    cy.get('[data-cy="input-numerical-accuracy"]').contains(
      `Precision: ${this.data.NR.accuracy}`
    )
    cy.get('[data-cy="input-numerical-unit"]').contains(this.data.NR.unit)
  })

  it('Check that values of Numerical question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.NR.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.NR.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.NR.content)
    cy.get('[data-cy="set-numerical-minimum"]').should(
      'have.value',
      String(this.data.NR.min)
    )
    cy.get('[data-cy="set-numerical-maximum"]').should(
      'have.value',
      String(this.data.NR.max)
    )
    cy.get('[data-cy="set-numerical-unit"]').should(
      'have.value',
      this.data.NR.unit
    )
    cy.get('[data-cy="set-numerical-accuracy"]').should(
      'have.value',
      String(this.data.NR.accuracy)
    )
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a Numerical question and add a sample solution', function () {
    cy.get(`[data-cy="edit-question-${this.data.NR.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.NR.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.NR.contentEdited)
    cy.get('[data-cy="set-numerical-minimum"]')
      .click()
      .clear()
      .type(String(this.data.NR.minEdited))
    cy.get('[data-cy="set-numerical-maximum"]')
      .click()
      .clear()
      .type(String(this.data.NR.maxEdited))
    cy.get('[data-cy="set-numerical-unit"]')
      .click()
      .clear()
      .type(this.data.NR.unitEdited)
    cy.get('[data-cy="set-numerical-accuracy"]')
      .click()
      .clear()
      .type(String(this.data.NR.accuracyEdited))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one solution range is required
    cy.wait(500)

    cy.wrap(this.data.NR.solutionRanges).each(
      (range: { min: number | null; max: number | null }, ix) => {
        cy.get('[data-cy="add-solution-range"]').click()
        if (range.min !== null) {
          cy.get(`[data-cy="set-solution-range-min-${ix}"]`)
            .click()
            .type(String(range.min))
        }
        if (range.max !== null) {
          cy.get(`[data-cy="set-solution-range-max-${ix}"]`)
            .click()
            .type(String(range.max))
        }
        cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
      }
    )

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
    cy.get(`[data-cy="element-item-${this.data.NR.titleEdited}"]`).contains(
      this.data.NR.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.NR.titleEdited}"]`).contains(
      this.data.NR.contentEdited
    )
  })

  it('Check that edited Numerical question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.NR.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.NR.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.NR.contentEdited)
    cy.get('[data-cy="set-numerical-minimum"]').should(
      'have.value',
      String(this.data.NR.minEdited)
    )
    cy.get('[data-cy="set-numerical-maximum"]').should(
      'have.value',
      String(this.data.NR.maxEdited)
    )
    cy.get('[data-cy="set-numerical-unit"]').should(
      'have.value',
      this.data.NR.unitEdited
    )
    cy.get('[data-cy="set-numerical-accuracy"]').should(
      'have.value',
      String(this.data.NR.accuracyEdited)
    )

    cy.wrap(this.data.NR.solutionRanges).each(
      (range: { min: number | null; max: number | null }, ix) => {
        if (range.min !== null) {
          cy.get(`[data-cy="set-solution-range-min-${ix}"]`).should(
            'have.value',
            String(range.min)
          )
        }
        if (range.max !== null) {
          cy.get(`[data-cy="set-solution-range-max-${ix}"]`).should(
            'have.value',
            String(range.max)
          )
        }
      }
    )

    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a Free Text question', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FREE_TEXT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FREE_TEXT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.FT.title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.FT.content)
    cy.get('[data-cy="set-free-text-length"]')
      .click()
      .type(String(this.data.FT.maxLength))
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    cy.get(`[data-cy="element-item-${this.data.FT.title}"]`).contains(
      this.data.FT.content
    )
    cy.get(`[data-cy="element-item-${this.data.FT.title}"]`).contains(
      this.data.FT.title
    )
    cy.get(`[data-cy="element-item-${this.data.FT.title}"]`).contains(
      messages.shared.READY.statusLabel
    )

    cy.get(`[data-cy="edit-question-${this.data.FT.title}"]`).click()
    cy.get('[data-cy="free-text-input-1"]').should('exist')
  })

  it('Check that values of Free Text question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.FT.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.FT.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.FT.content)
    cy.get('[data-cy="set-free-text-length"]').should(
      'have.value',
      this.data.FT.maxLength
    )
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a Free Text question', function () {
    cy.get(`[data-cy="edit-question-${this.data.FT.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.FT.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.FT.contentEdited)
    cy.get('[data-cy="set-free-text-length"]')
      .click()
      .clear()
      .type(String(this.data.FT.maxLengthEdited))

    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.wrap(this.data.FT.sampleSolution).each((solution: string, ix) => {
      cy.get(`[data-cy="add-solution-value"]`).click()
      cy.get(`[data-cy="set-solution-ix-${ix}"]`).click().type(solution)
      cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    })
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.FT.titleEdited}"]`).contains(
      this.data.FT.contentEdited
    )
    cy.get(`[data-cy="element-item-${this.data.FT.titleEdited}"]`).contains(
      this.data.FT.titleEdited
    )
  })

  it('Check that edited Free Text question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.FT.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.FT.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.FT.contentEdited)
    cy.get('[data-cy="set-free-text-length"]').should(
      'have.value',
      this.data.FT.maxLengthEdited
    )
    cy.wrap(this.data.FT.sampleSolution).each((solution: string, ix) => {
      cy.get(`[data-cy="set-solution-ix-${ix}"]`).should('have.value', solution)
    })
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a new question, duplicates it and then deletes the duplicate again', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(
      this.data.duplication.title
    )
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.duplication.content)
    cy.get('[data-cy="insert-answer-field-0"]').realClick().type('50%')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]').realClick().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // duplicate question and save
    cy.get(
      `[data-cy="duplicate-question-${this.data.duplication.title}"]`
    ).click()
    cy.wait(500)
    cy.findByText(messages.manage.questionForms.DUPLICATETitle).should('exist')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // check if duplicated question exists alongside original question
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).should('exist')
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).contains(messages.shared.DRAFT.statusLabel)

    // delete the duplicated question
    cy.get(
      `[data-cy="delete-question-${this.data.duplication.title} (Copy)"]`
    ).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete all created questions', function () {
    const questions = [
      this.data.CT.titleEdited,
      this.data.FC.titleEdited,
      this.data.SC.titleEdited,
      this.data.MC.titleEdited,
      this.data.KP.titleEdited,
      this.data.NR.titleEdited,
      this.data.FT.titleEdited,
    ]

    cy.wrap(questions).each((title: string) => {
      cy.get(`[data-cy="delete-question-${title}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })
  })
})
