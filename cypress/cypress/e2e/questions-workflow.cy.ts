import messages from '../../../packages/i18n/messages/en'

describe('Create questions', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('creates a content element', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Content ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  })

  it('creates a flashcard element', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Flashcard ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-question-explanation"]').click().type(question)
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  })

  it('creates a single choice question', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('exist')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('exist')
  })

  it('creates a multiple choice question', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Multiple Choice ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

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
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
    cy.get('[data-cy="mc-1-answer-option-1"]').should('exist')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('exist')
  })

  it('creates a KPRIM question', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A KPRIM ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

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
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(2).click().type('75%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(3).click().type('60%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
    cy.get('[data-cy="kp-answer-options"]').should('have.length', 4)
  })

  it('creates a Numeric question', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Numeric ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

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
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="set-numerical-minimum"]').click().type('0')
    cy.get('[data-cy="set-numerical-maximum"]').click().type('100')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
    cy.get('[data-cy="input-numerical-minimum"]').contains('Min: 0')
    cy.get('[data-cy="input-numerical-maximum"]').contains('Max: 100')
  })

  it('creates a Free Text question', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Free Text ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

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
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="set-free-text-length"]').click().type('100')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
    cy.get('[data-cy="free-text-response-input"]').should('exist')
  })

  it('creates a new question, duplicates it and then deletes the duplicate again', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice ' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    // duplicate question and save
    cy.get(`[data-cy="duplicate-question-${questionTitle}"]`).click()
    cy.wait(500)
    cy.findByText(messages.manage.questionForms.DUPLICATETitle).should('exist')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    // check if duplicated question exists alongside original question
    cy.get(`[data-cy="question-item-${questionTitle}"]`).should('exist')
    cy.get(`[data-cy="question-item-${questionTitle + ' (Copy)'}"]`).should(
      'exist'
    )

    // delete the duplicated question
    cy.get(`[data-cy="delete-question-${questionTitle} (Copy)"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="question-item-${questionTitle}"]`).should('exist')
    cy.get(`[data-cy="question-item-${questionTitle + ' (Copy)'}"]`).should(
      'not.exist'
    )
  })
})
