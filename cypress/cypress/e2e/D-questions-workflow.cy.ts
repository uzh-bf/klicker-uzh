import messages from '../../../packages/i18n/messages/en'

describe('Create different types of elements (with and without sample solution) and edit them', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 1: Content elements
  // #region
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
    cy.get('[data-cy="close-element-modal"]').click()
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
    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion

  // ! Part 2: Flashcards
  // #region
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
    cy.get('[data-cy="close-element-modal"]').click()
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
    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion

  // ! Part 3: Single choice questions
  // #region
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
    cy.get('[data-cy="close-element-modal"]').click()
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

  it('Edit the single choice question again and add answer feedbacks', function () {
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

    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion

  // ! Part 4: Multiple choice questions
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

  // ! Part 5: KPRIM questions
  // #region
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
    cy.get('[data-cy="close-element-modal"]').click()
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
    cy.get('[data-cy="close-element-modal"]').click()
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
  // #endregion

  // ! Part 6: Numerical questions
  // #region
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
    cy.get('[data-cy="close-element-modal"]').click()
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
    cy.wait(500)
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // selection of sample solution type required

    cy.get('[data-cy="set-solution-type-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // selection of sample solution type required
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

    // solution ranges with min below restrictions min or max above restrictions max are not allowed
    const newIx = this.data.NR.solutionRanges.length
    cy.get('[data-cy="add-solution-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // min or max required
    cy.get(`[data-cy="set-solution-range-min-${newIx}"]`)
      .click()
      .type(String(this.data.NR.minEdited - 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-solution-range-min-${newIx}"]`)
      .click()
      .clear()
      .type(String(this.data.NR.minEdited))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="delete-solution-range-ix-${newIx}"]`).click()
    cy.get('[data-cy="add-solution-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // min or max required
    cy.get(`[data-cy="set-solution-range-max-${newIx}"]`)
      .click()
      .type(String(this.data.NR.maxEdited + 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-solution-range-max-${newIx}"]`)
      .click()
      .clear()
      .type(String(this.data.NR.maxEdited))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="delete-solution-range-ix-${newIx}"]`).click()

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

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit the numerical question again and set an exact solution', function () {
    cy.get(`[data-cy="edit-question-${this.data.NR.titleEdited}"]`).click()
    cy.get('[data-cy="set-solution-type-exact"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required

    cy.wrap(this.data.NR.exactSolutions).each((solution: number, ix) => {
      cy.get(`[data-cy="add-exact-solution"]`).click()
      cy.get(`[data-cy="set-exact-solution-${ix}"]`)
        .click()
        .type(String(solution))
      cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    })

    // exact solutions outside of the restrictions are not allowed
    const newIx = this.data.NR.exactSolutions.length
    cy.get(`[data-cy="add-exact-solution"]`).click()
    cy.get(`[data-cy="set-exact-solution-${newIx}"]`)
      .click()
      .type(String(this.data.NR.minEdited - 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="delete-exact-solution-${newIx}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="add-exact-solution"]`).click()
    cy.get(`[data-cy="set-exact-solution-${newIx}"]`)
      .click()
      .type(String(this.data.NR.maxEdited + 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="delete-exact-solution-${newIx}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Verify that the exact solutions of the numerical question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.NR.titleEdited}"]`).click()
    cy.wrap(this.data.NR.exactSolutions).each((solution: number, ix) => {
      cy.get(`[data-cy="set-exact-solution-${ix}"]`).should(
        'have.value',
        String(solution)
      )
    })
    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion

  // ! Part 7: Free Text questions
  // #region
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
    cy.get('[data-cy="close-element-modal"]').click()
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
    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion

  // ! Part 8: Selection questions
  // #region
  it('Create the answer collections that will be used for the selection question tests', function () {
    cy.get('[data-cy="resources"]').click()
    cy.createAnswerCollection({
      name: this.data.SE.collection,
      accessCy: 'private',
      access: messages.manage.resources.accessPRIVATE,
      description: this.data.SE.collectionDescription,
      entries: [...this.data.SE.solutions, ...this.data.SE.solutionsNotChosen],
    })
    cy.createAnswerCollection({
      name: this.data.SE.collectionEdited,
      accessCy: 'restricted',
      access: messages.manage.resources.accessRESTRICTED,
      description: this.data.SE.collectionDescriptionEdited,
      entries: [
        ...this.data.SE.solutionsEdited,
        ...this.data.SE.solutionsNotChosenEdited,
      ],
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
      cy.get(`[id="selection-1-field-${i + 1}"]`).should('exist')
    }

    // check that all options are available
    cy.get('[id="selection-1-field-1"]').click()
    cy.wrap(this.data.SE.solutions).each((value: string) => {
      cy.findByText(value).should('exist')
    })
    cy.wrap(this.data.SE.solutionsNotChosen).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Verify that all options of the answer collection can be edited', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.SE.collection}"]`).click()

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
    cy.get(`[data-cy="answer-collection-${this.data.SE.collection}"]`).click()
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
    cy.get(`[data-cy="answer-collection-${this.data.SE.collection}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
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
    cy.get(`[data-cy="answer-collection-${this.data.SE.collection}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
    cy.get('[data-cy="close-answer-collection-edit-modal"]').click()
    cy.get(
      `[data-cy="answer-collection-${this.data.SE.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
  })

  it('Check that only answer options not used as solutions can be deleted', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.SE.collection}"]`).click()

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
      `[data-cy="answer-collection-${this.data.SE.collectionEdited}"]`
    ).click()
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

  // ! Part 9: Case Study questions
  // #region
  it('Create the answer collection that will be used for the case study question tests', function () {
    cy.get('[data-cy="resources"]').click()
    cy.createAnswerCollection({
      name: this.data.CS.collection,
      accessCy: 'private',
      access: messages.manage.resources.accessPRIVATE,
      description: this.data.CS.collectionDescription,
      entries: [...this.data.CS.items, ...this.data.CS.unselectedItems],
    })
    cy.createAnswerCollection({
      name: this.data.CS.collectionEdited,
      accessCy: 'restricted',
      access: messages.manage.resources.accessRESTRICTED,
      description: this.data.CS.collectionDescriptionEdited,
      entries: [
        ...this.data.CS.itemsEdited,
        ...this.data.CS.unselectedItemsEdited,
      ],
    })
  })

  it('Create a Case Study question', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CASE_STUDY.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CASE_STUDY.typeLabel)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // enter question data
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.CS.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.CS.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.CS.explanation)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select an answer collection
    cy.get('[data-cy="select-answer-collection"]').contains(
      messages.manage.questionForms.selectCollection
    )
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.CS.collection}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collection
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select items for case study
    cy.wrap(this.data.CS.items).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').click()
      cy.findByText(item).realClick()
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    // add new criteria, and remove one again
    cy.wrap([...this.data.CS.criteria, this.data.CS.removedCriterion]).each(
      (
        criterion: {
          name: string
          min: number
          max: number
          step: number
          unit?: string
        },
        ix
      ) => {
        cy.get('[data-cy="add-new-criterion"]').click()
        cy.get(`[data-cy="criterion-${ix}-name"]`).click().type(criterion.name)
        cy.get(`[data-cy="criterion-${ix}-min"]`)
          .click()
          .type(String(criterion.min))
        cy.get(`[data-cy="criterion-${ix}-max"]`)
          .click()
          .type(String(criterion.max))
        cy.get(`[data-cy="criterion-${ix}-step"]`)
          .click()
          .type(String(criterion.step))
        if (criterion.unit) {
          cy.get(`[data-cy="criterion-${ix}-unit"]`)
            .click()
            .type(criterion.unit)
        }

        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )
        cy.get(`[data-cy="criterion-${ix}-min"]`).should(
          'have.value',
          String(criterion.min)
        )
        cy.get(`[data-cy="criterion-${ix}-max"]`).should(
          'have.value',
          String(criterion.max)
        )
        cy.get(`[data-cy="criterion-${ix}-step"]`).should(
          'have.value',
          String(criterion.step)
        )
        if (criterion.unit) {
          cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
            'have.value',
            criterion.unit
          )
        }
      }
    )
    cy.get(
      `[data-cy="remove-criterion-${this.data.CS.criteria.length}"]`
    ).click()
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-name"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-min"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-max"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-step"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    cy.wrap([...this.data.CS.cases, this.data.CS.removedCase]).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get('[data-cy="add-new-case"]').click()
        cy.get(`[data-cy="case-title-${ix}"]`).click().type(caseItem.title)
        cy.get(`[data-cy="case-description-${ix}"]`)
          .realClick()
          .type(caseItem.description)

        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
        cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
      }
    )
    cy.get(`[data-cy="delete-case-${this.data.CS.cases.length}"]`).click()
    cy.get(`[data-cy="cancel-delete-case"]`).click()
    cy.get(`[data-cy="delete-case-${this.data.CS.cases.length}"]`).click()
    cy.get(`[data-cy="confirm-delete-case"]`).click()
    cy.get(`[data-cy="case-title-${this.data.CS.cases.length}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="case-description-${this.data.CS.cases.length}"]`).should(
      'not.exist'
    )

    // test that enabling sample solution works correctly
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    cy.get(`[data-cy="element-item-${this.data.CS.title}"]`).contains(
      this.data.CS.content
    )
    cy.get(`[data-cy="element-item-${this.data.CS.title}"]`).contains(
      this.data.CS.title
    )
    cy.get(`[data-cy="element-item-${this.data.CS.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Verify that the correct content has been saved', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )
    cy.get('[data-cy="select-question-status"]').contains(
      messages.shared.READY.statusLabel
    )
    cy.get('[data-cy="insert-question-text"]').contains(this.data.CS.content)
    cy.get('[data-cy="insert-question-explanation"]').contains(
      this.data.CS.explanation
    )

    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collection
    )
    cy.wrap(this.data.CS.items).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    cy.wrap(this.data.CS.criteria).each(
      (
        criterion: {
          name: string
          min: number
          max: number
          step: number
          unit?: string
        },
        ix
      ) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )
        cy.get(`[data-cy="criterion-${ix}-min"]`).should(
          'have.value',
          String(criterion.min)
        )
        cy.get(`[data-cy="criterion-${ix}-max"]`).should(
          'have.value',
          String(criterion.max)
        )
        cy.get(`[data-cy="criterion-${ix}-step"]`).should(
          'have.value',
          String(criterion.step)
        )
        if (criterion.unit) {
          cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
            'have.value',
            criterion.unit
          )
        }
      }
    )

    cy.wrap(this.data.CS.cases).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
      }
    )

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it.only('Verify that creation was successful', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )

    cy.get('[data-cy="student-element-preview"]')
      .findByText(messages.shared.questions.csCaseStudyInstructions)
      .should('exist')
    cy.get('[data-cy="student-element-preview"]') // instructions should be visible in preview
      .findByText(this.data.CS.content)
      .should('exist')

    // check if case information is visible
    cy.get('[data-cy="case-1-title"]').contains(this.data.CS.cases[0].title)
    cy.get('[data-cy="case-1-description"]').contains(
      this.data.CS.cases[0].description
    )
    cy.get('[data-cy="case-2-title"]').contains(this.data.CS.cases[1].title)
    cy.get('[data-cy="case-2-description"]').contains(
      this.data.CS.cases[1].description
    )

    // check that sliders are initilized correctly and that values changes persist
    const steps = 78
    const midValue =
      this.data.CS.criteria[0].min +
      (this.data.CS.criteria[0].max - this.data.CS.criteria[0].min) / 2
    const slidedValue = midValue + steps * this.data.CS.criteria[0].step
    cy.get('[data-cy="cs-slider-nr-value-1-1-1-1"]').should('have.value', '')
    cy.get('[data-cy="cs-slider-1-1-1-1"]')
      .click()
      .type('{rightarrow}{leftarrow}')
    cy.get('[data-cy="cs-slider-nr-value-1-1-1-1"]').should(
      'have.value',
      String(midValue)
    )
    cy.get('[data-cy="cs-slider-1-1-1-1"]')
      .click()
      .type('{rightarrow}'.repeat(steps))
    cy.get('[data-cy="cs-slider-nr-value-1-1-1-1"]').should(
      'have.value',
      String(slidedValue)
    )

    // check that moving a slider all the way to one end works to be expected
    cy.get('[data-cy="cs-slider-nr-value-1-1-1-2"]').should('have.value', '')
    cy.get('[data-cy="cs-slider-1-1-1-2"]')
      .click()
      .type('{leftarrow}'.repeat(260))
    cy.get('[data-cy="cs-slider-nr-value-1-1-1-2"]').should(
      'have.value',
      String(this.data.CS.criteria[1].min)
    )
    cy.get('[data-cy="cs-slider-1-1-1-2"]')
      .click()
      .type('{rightarrow}'.repeat(600))
    cy.get('[data-cy="cs-slider-nr-value-1-1-1-2"]').should(
      'have.value',
      String(this.data.CS.criteria[1].max)
    )

    // check that sliders are shown for all response items
    for (let caseIx = 0; caseIx < this.data.CS.cases.length; caseIx++) {
      for (
        let criterionIx = 0;
        criterionIx < this.data.CS.criteria.length;
        criterionIx++
      ) {
        for (let itemIx = 0; itemIx < this.data.CS.items.length; itemIx++) {
          cy.get(
            `[data-cy="cs-slider-nr-value-1-${caseIx + 1}-${itemIx + 1}-${criterionIx + 1}"]`
          ).should('exist')
        }
      }
    }
  })

  it('Verify that the deletion of answer collection entries is limited, editing is unaffected', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.CS.collection}"]`).click()

    cy.wrap(this.data.CS.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItems).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Verify that the answer collection used in the case study can no longer be deleted', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.CS.collection}"]`).click()
    cy.findByText(messages.manage.resources.answerOptionUsed).should('exist')
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
  })

  it('Add a sample solution to the case study question', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )

    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // correct answers for all criteria & items are required
    Object.entries(this.data.CS.solutions).forEach(([caseIx, caseValue]) => {
      Object.entries(caseValue).forEach(([itemIx, itemValue]) => {
        Object.entries(itemValue).forEach(([criterionIx, criterionValue]) => {
          const value = criterionValue as { lower: number; upper: number }

          cy.get('[data-cy="save-new-question"]').should('be.disabled')
          cy.get(
            `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
          )
            .click()
            .type(String(value.lower))
          cy.get(
            `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
          )
            .click()
            .type(String(value.upper))

          cy.get(
            `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
          ).should('have.value', String(value.lower))
          cy.get(
            `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
          ).should('have.value', String(value.upper))
        })
      })
    })
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)
  })

  it('Verify that the sample solution has been stored correctly for the modified case study question', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )

    Object.entries(this.data.CS.solutions).forEach(([caseIx, caseValue]) => {
      Object.entries(caseValue).forEach(([itemIx, itemValue]) => {
        Object.entries(itemValue).forEach(([criterionIx, criterionValue]) => {
          const value = criterionValue as { lower: number; upper: number }

          cy.get(
            `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
          ).should('have.value', String(value.lower))
          cy.get(
            `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
          ).should('have.value', String(value.upper))
        })
      })
    })

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that the case study validation logic covers all required cases and block submission of invalid element edit modals', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.title}"]`).click()

    // missing question title -> invalid
    cy.get('[data-cy="insert-question-title"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.CS.title)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // missing question content -> invalid
    cy.get('[data-cy="insert-question-text"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.CS.content)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // missing question explanation -> valid
    cy.get('[data-cy="insert-question-explanation"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.CS.explanation)

    // criteria name, min, max, step required -> invalid (if removed)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="criterion-0-name"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-name"]')
      .click()
      .type(this.data.CS.criteria[0].name)

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-min"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .type(String(this.data.CS.criteria[0].min))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-max"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-max"]')
      .click()
      .type(String(this.data.CS.criteria[0].max))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-step"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-step"]')
      .click()
      .type(String(this.data.CS.criteria[0].step))
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // criterion min <= max required & max - min >= 2 * step -> otherwise invalid
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(
        String(this.data.CS.criteria[0].max + this.data.CS.criteria[0].step + 1)
      )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.criteria[0].max - 2 * this.data.CS.criteria[0].step + 1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.criteria[0].max - 2 * this.data.CS.criteria[0].step - 1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min))
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: lower and upper bound required
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="case-solution-1-3-0-upper"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .type(this.data.CS.solutions[1][3][0].upper)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: min <= max required
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].upper + 1)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: min and max lie within the bounds of the criterion
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min - 1))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min + 1))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].max + 1))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].max))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].max - 1))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].upper)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: max - min >= step size
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.solutions[1][3][0].upper -
            this.data.CS.criteria[0].step +
            1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.solutions[1][3][0].upper - this.data.CS.criteria[0].step
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.solutions[1][3][0].upper -
            this.data.CS.criteria[0].step -
            1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
  })

  it('Edit the case study question and change the answer collection (including new sample solutions)', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.CS.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.CS.contentEdited)

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="cancel-change-collection"]').click()
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="confirm-change-collection"]').click()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collectionEdited
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // answer options are cleared on collection change

    // select items for case study
    cy.wrap(this.data.CS.itemsEdited).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').click()
      cy.findByText(item).realClick()
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    // clear all fields, enter new criteria
    cy.wrap(this.data.CS.criteriaEdited).each(
      (
        criterion: {
          name: string
          min: number
          max: number
          step: number
          unit?: string
        },
        ix
      ) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`)
          .click()
          .clear()
          .type(criterion.name)
        cy.get(`[data-cy="criterion-${ix}-min"]`)
          .click()
          .clear()
          .type(String(criterion.min))
        cy.get(`[data-cy="criterion-${ix}-max"]`)
          .click()
          .clear()
          .type(String(criterion.max))
        cy.get(`[data-cy="criterion-${ix}-step"]`)
          .click()
          .clear()
          .type(String(criterion.step))
        cy.get(`[data-cy="criterion-${ix}-unit"]`).click().clear()

        if (criterion.unit) {
          cy.get(`[data-cy="criterion-${ix}-unit"]`)
            .click()
            .type(criterion.unit)
        }

        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )
        cy.get(`[data-cy="criterion-${ix}-min"]`).should(
          'have.value',
          String(criterion.min)
        )
        cy.get(`[data-cy="criterion-${ix}-max"]`).should(
          'have.value',
          String(criterion.max)
        )
        cy.get(`[data-cy="criterion-${ix}-step"]`).should(
          'have.value',
          String(criterion.step)
        )
        if (criterion.unit) {
          cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
            'have.value',
            criterion.unit
          )
        }
      }
    )

    // remove all existing cases
    for (let i = 0; i < this.data.CS.cases.length; i++) {
      cy.get(`[data-cy="delete-case-0"]`).click()
      cy.get(`[data-cy="confirm-delete-case"]`).click()
    }
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // cases required

    // add new cases
    cy.wrap(this.data.CS.casesEdited).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get('[data-cy="add-new-case"]').click()
        cy.get(`[data-cy="case-title-${ix}"]`).click().type(caseItem.title)
        cy.get(`[data-cy="case-description-${ix}"]`)
          .realClick()
          .type(caseItem.description)

        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
      }
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // solution required

    // add new sample solutions
    Object.entries(this.data.CS.solutionsEdited).forEach(
      ([caseIx, caseValue]) => {
        Object.entries(caseValue).forEach(([itemIx, itemValue]) => {
          Object.entries(itemValue).forEach(([criterionIx, criterionValue]) => {
            const value = criterionValue as { lower: number; upper: number }

            cy.get('[data-cy="save-new-question"]').should('be.disabled')
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
            )
              .click()
              .type(String(value.lower))
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
            )
              .click()
              .type(String(value.upper))

            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
            ).should('have.value', String(value.lower))
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
            ).should('have.value', String(value.upper))
          })
        })
      }
    )

    cy.get('[data-cy="save-new-question"]').click()
  })

  it('Verify that all changes to the case study question have been saved correctly', function () {
    cy.get(`[data-cy="edit-question-${this.data.CS.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.CS.contentEdited)

    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collectionEdited
    )
    cy.wrap(this.data.CS.itemsEdited).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    cy.wrap(this.data.CS.criteriaEdited).each(
      (
        criterion: {
          name: string
          min: number
          max: number
          step: number
          unit?: string
        },
        ix
      ) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )
        cy.get(`[data-cy="criterion-${ix}-min"]`).should(
          'have.value',
          String(criterion.min)
        )
        cy.get(`[data-cy="criterion-${ix}-max"]`).should(
          'have.value',
          String(criterion.max)
        )
        cy.get(`[data-cy="criterion-${ix}-step"]`).should(
          'have.value',
          String(criterion.step)
        )
        if (criterion.unit) {
          cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
            'have.value',
            criterion.unit
          )
        }
      }
    )

    cy.wrap(this.data.CS.casesEdited).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
      }
    )

    Object.entries(this.data.CS.solutionsEdited).forEach(
      ([caseIx, caseValue]) => {
        Object.entries(caseValue).forEach(([itemIx, itemValue]) => {
          Object.entries(itemValue).forEach(([criterionIx, criterionValue]) => {
            const value = criterionValue as { lower: number; upper: number }

            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
            ).should('have.value', String(value.lower))
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
            ).should('have.value', String(value.upper))
          })
        })
      }
    )

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that all elements of the previously used answer collection and the collection itself can be deleted again', function () {
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.CS.collection}"]`).click()
    cy.wrap(this.data.CS.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItems).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.findByText(messages.manage.resources.answerOptionUsed).should(
      'not.exist'
    )
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.wrap(this.data.CS.itemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.findByText(messages.manage.resources.answerOptionUsed).should('exist')
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })
  // #endregion

  // ! Part 10: Question duplication
  // #region
  it('Create a new question, duplicates it and then deletes them again', function () {
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

    // delete the created and duplicated question
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
    cy.get(`[data-cy="delete-question-${this.data.duplication.title}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'not.exist'
    )
  })
  // #endregion

  // ! Part 11: Auto-Save functionality for Elements
  // #region
  function enterSCQuestionContent(data) {
    cy.get('[data-cy="insert-question-title"]').type(data.autoSave.title)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(data.autoSave.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(data.autoSave.choices[0].content)
    cy.wrap(data.autoSave.choices.slice(1)).each(
      (choice: { content: string }, ix) => {
        cy.get('[data-cy="add-new-answer"]').click()
        cy.wait(500)
        cy.get(`[data-cy="insert-answer-field-${ix + 1}"]`)
          .realClick()
          .type(choice.content)
      }
    )
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.wrap(data.autoSave.choices).each((choice: { correct?: boolean }, ix) => {
      if (choice.correct) {
        cy.get(`[data-cy="set-correctness-${ix}"]`).click()
      }
    })
  }

  it('Verify that empty questions are not stored in local storage (creation)', function () {
    // open modal, wait for auto-save, close modal
    cy.get('[data-cy="create-question"]').click()
    cy.wait(3000) // wait longer than auto-save requires
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="select-question-type"]').contains(
      messages.shared.SC.typeLabel
    )
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that non-empty questions are stored and loaded correctly on demand (creation)', function () {
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // re-open modal, load data, verify content, close modal
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.autoSave.content)
    cy.wrap(this.data.autoSave.choices).each(
      (choice: { content: string }, ix) => {
        cy.get(`[data-cy="insert-answer-field-${ix}"]`).contains(choice.content)
      }
    )
  })

  it('Verify that non-empty questions are stored and discarded on request (creation)', function () {
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="discard-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that local storage is correctly cleared after creating a question', function () {
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // check that local storage is cleared correctly on save and new editor is empty
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that opening the edit modal and closing without modifications does not trigger prompt', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
  })

  it('Verify that after editing a question and waiting for auto-save the corresponding content can be loaded', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown & load data, verify updated content is visible
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
  })

  it('Verify that after editing a question, auto-saving and discarding the saved content, the original content is loaded', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown & discard data, verify original content is visible
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.wait(3000)
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that when closing and opening now after discarding, no prompt is shown
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that after editing an element and saving it, no prompt is shown to the user', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="save-new-question"]').click()

    // recovery prompt should not be shown, verify edited content is visible
    cy.get(
      `[data-cy="edit-question-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
  })

  it('Verify that when duplicating a question, wating for auto-save and opening the creation form, the content cannot be loaded', function () {
    cy.get(
      `[data-cy="duplicate-question-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the duplicated
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that when duplicating a question, modifying it slightly,wating for auto-save and opening the creation form, the content can be loaded', function () {
    cy.get(
      `[data-cy="duplicate-question-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited2)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the duplicated
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited2
    )
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Delete all created questions', function () {
    const questions = [
      this.data.CT.titleEdited,
      this.data.FC.titleEdited,
      this.data.SC.titleEdited,
      this.data.MC.titleEdited,
      this.data.KP.titleEdited,
      this.data.NR.titleEdited,
      this.data.FT.titleEdited,
      this.data.SE.titleEdited,
      this.data.CS.titleEdited,
      this.data.autoSave.titleEdited,
    ]

    cy.wrap(questions).each((title: string) => {
      cy.get(`[data-cy="delete-question-${title}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })
  })

  it('Verify that after the deletion of the linked question, all solution options can be deleted again', function () {
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.SE.collection}"]`).click()
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
      `[data-cy="answer-collection-${this.data.SE.collectionEdited}"]`
    ).click()
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

    cy.get(`[data-cy="answer-collection-${this.data.CS.collection}"]`).click()
    cy.wrap(this.data.CS.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItems).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.wrap(this.data.CS.itemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Cleanup: Delete all created answer collections', function () {
    cy.get('[data-cy="resources"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.SE.collection })
    cy.deleteAnswerCollection({ collectionName: this.data.SE.collectionEdited })
    cy.deleteAnswerCollection({ collectionName: this.data.CS.collection })
    cy.deleteAnswerCollection({ collectionName: this.data.CS.collectionEdited })

    // validate that no collections except from the seeded ones remain
    cy.task('verifyDeletionAnswerCollections').then((result) => {
      // check if the verification was successful
      if (result === null || result === false) {
        throw new Error(
          'The database contains answer collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion
})
