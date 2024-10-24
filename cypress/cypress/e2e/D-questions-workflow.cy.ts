import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

describe('Create questions', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('Create a content element', () => {
    const randomQuestionNumber = uuid()
    const questionTitle = 'A Content ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

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
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(question)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
    cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
      messages.shared.DRAFT.statusLabel
    )
    cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  })

  // it('Create a flashcard element', () => {
  //   const randomQuestionNumber = uuid()
  //   const questionTitle = 'A Flashcard ' + randomQuestionNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.SC.typeLabel)
  //   cy.get('[data-cy="select-question-type"]').click()
  //   cy.get(
  //     `[data-cy="select-question-type-${messages.shared.FLASHCARD.typeLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.FLASHCARD.typeLabel)
  //   cy.get('[data-cy="insert-question-title"]').type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.REVIEW.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="insert-question-explanation"]').realClick().type(question)
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
  //     messages.shared.REVIEW.statusLabel
  //   )
  //   cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  // })

  // it('Create a single choice question', () => {
  //   const randomQuestionNumber = uuid()
  //   const questionTitle = 'A Single Choice ' + randomQuestionNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

  //   const choice1 = '50%'
  //   const choice2 = '100%'

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="insert-question-title"]').type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="insert-answer-field-0"]').realClick().type(choice1)
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice1)
  //   cy.get('[data-cy="add-new-answer"]').click()
  //   cy.wait(500)
  //   cy.get('[data-cy="insert-answer-field-1"]').realClick().type(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice2)
  //   cy.get('[data-cy="insert-question-title"]').click() // remove editor focus

  //   cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
  //   cy.get('[data-cy="move-answer-option-ix-0-down"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice1)

  //   cy.get('[data-cy="move-answer-option-ix-1-up"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="move-answer-option-ix-1-down"]').should('be.disabled')
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice1)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice2)
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
  //     messages.shared.READY.statusLabel
  //   )
  //   cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  //   cy.get('[data-cy="sc-1-answer-option-1"]').should('exist')
  //   cy.get('[data-cy="sc-1-answer-option-2"]').should('exist')
  // })

  // it('Create a multiple choice question', () => {
  //   const randomQuestionNumber = uuid()
  //   const questionTitle = 'A Multiple Choice ' + randomQuestionNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

  //   const choice1 = '50%'
  //   const choice2 = '100%'

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.SC.typeLabel)
  //   cy.get('[data-cy="select-question-type"]').click()
  //   cy.get(
  //     `[data-cy="select-question-type-${messages.shared.MC.typeLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.MC.typeLabel)
  //   cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="insert-answer-field-0"]').realClick().type(choice1)
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice1)
  //   cy.get('[data-cy="add-new-answer"]').click()
  //   cy.wait(500)
  //   cy.get('[data-cy="insert-answer-field-1"]').realClick().type(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice2)
  //   cy.get('[data-cy="insert-question-title"]').click() // remove editor focus

  //   cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
  //   cy.get('[data-cy="move-answer-option-ix-0-down"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice1)

  //   cy.get('[data-cy="move-answer-option-ix-1-up"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="move-answer-option-ix-1-down"]').should('be.disabled')
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice1)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice2)
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
  //     messages.shared.READY.statusLabel
  //   )
  //   cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  //   cy.get('[data-cy="mc-1-answer-option-1"]').should('exist')
  //   cy.get('[data-cy="mc-1-answer-option-2"]').should('exist')
  // })

  // it('Create a KPRIM question', () => {
  //   const randomQuestionNumber = uuid()
  //   const questionTitle = 'A KPRIM ' + randomQuestionNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

  //   const choice1 = '50%'
  //   const choice2 = '100%'
  //   const choice3 = '75%'
  //   const choice4 = '60%'

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.SC.typeLabel)
  //   cy.get('[data-cy="select-question-type"]').click()
  //   cy.get(
  //     `[data-cy="select-question-type-${messages.shared.KPRIM.typeLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.KPRIM.typeLabel)
  //   cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="insert-answer-field-0"]').realClick().type(choice1)
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice1)
  //   cy.get('[data-cy="add-new-answer"]').click()
  //   cy.wait(500)
  //   cy.get('[data-cy="insert-answer-field-1"]').realClick().type(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice2)
  //   cy.get('[data-cy="add-new-answer"]').click()
  //   cy.wait(500)
  //   cy.get('[data-cy="insert-answer-field-2"]').realClick().type(choice3)
  //   cy.get('[data-cy="insert-answer-field-2"]').findByText(choice3)
  //   cy.get('[data-cy="add-new-answer"]').click()
  //   cy.wait(500)
  //   cy.get('[data-cy="insert-answer-field-3"]').realClick().type(choice4)
  //   cy.get('[data-cy="insert-answer-field-3"]').findByText(choice4)
  //   cy.get('[data-cy="insert-question-title"]').click() // remove editor focus

  //   cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
  //   cy.get('[data-cy="move-answer-option-ix-0-down"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice1)
  //   cy.get('[data-cy="insert-answer-field-2"]').findByText(choice3)
  //   cy.get('[data-cy="insert-answer-field-3"]').findByText(choice4)

  //   cy.get('[data-cy="move-answer-option-ix-3-up"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="move-answer-option-ix-3-down"]').should('be.disabled')
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice1)
  //   cy.get('[data-cy="insert-answer-field-2"]').findByText(choice4)
  //   cy.get('[data-cy="insert-answer-field-3"]').findByText(choice3)

  //   cy.get('[data-cy="move-answer-option-ix-2-up"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice4)
  //   cy.get('[data-cy="insert-answer-field-2"]').findByText(choice1)
  //   cy.get('[data-cy="insert-answer-field-3"]').findByText(choice3)

  //   cy.get('[data-cy="move-answer-option-ix-2-down"]')
  //     .should('not.be.disabled')
  //     .click()
  //   cy.get('[data-cy="insert-answer-field-0"]').findByText(choice2)
  //   cy.get('[data-cy="insert-answer-field-1"]').findByText(choice4)
  //   cy.get('[data-cy="insert-answer-field-2"]').findByText(choice3)
  //   cy.get('[data-cy="insert-answer-field-3"]').findByText(choice1)
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
  //     messages.shared.READY.statusLabel
  //   )
  //   cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  //   cy.get('[data-cy="kp-answer-options"]').should('have.length', 4)
  // })

  // it('Create a Numeric question', () => {
  //   const randomQuestionNumber = uuid()
  //   const questionTitle = 'A Numeric ' + randomQuestionNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.SC.typeLabel)
  //   cy.get('[data-cy="select-question-type"]').click()
  //   cy.get(
  //     `[data-cy="select-question-type-${messages.shared.NUMERICAL.typeLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.NUMERICAL.typeLabel)
  //   cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="set-numerical-minimum"]').click().type('0')
  //   cy.get('[data-cy="set-numerical-maximum"]').click().type('100')
  //   cy.get('[data-cy="set-numerical-unit"]').click().type('%')
  //   cy.get('[data-cy="set-numerical-accuracy"]').click().type('0')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
  //     messages.shared.READY.statusLabel
  //   )
  //   cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  //   cy.get('[data-cy="input-numerical-minimum"]').contains('Min: 0')
  //   cy.get('[data-cy="input-numerical-maximum"]').contains('Max: 100')
  //   cy.get('[data-cy="input-numerical-accuracy"]').contains('Precision: 0')
  //   cy.get('[data-cy="input-numerical-unit"]').contains('%')
  // })

  // it('Create a Free Text question', () => {
  //   const randomQuestionNumber = uuid()
  //   const questionTitle = 'A Free Text ' + randomQuestionNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.SC.typeLabel)
  //   cy.get('[data-cy="select-question-type"]').click()
  //   cy.get(
  //     `[data-cy="select-question-type-${messages.shared.FREE_TEXT.typeLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="select-question-type"]')
  //     .should('exist')
  //     .contains(messages.shared.FREE_TEXT.typeLabel)
  //   cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="set-free-text-length"]').click().type('100')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(question)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(questionTitle)
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).contains(
  //     messages.shared.READY.statusLabel
  //   )
  //   cy.get(`[data-cy="edit-question-${questionTitle}"]`).click()
  //   cy.get('[data-cy="free-text-input-1"]').should('exist')
  // })

  // it('Create a new question, duplicates it and then deletes the duplicate again', () => {
  //   const randomNumber = uuid()
  //   const questionTitle = 'A Single Choice ' + randomNumber
  //   const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber

  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="insert-question-title"]').type(questionTitle)
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
  //   ).click()
  //   cy.get('[data-cy="insert-question-text"]').realClick().type(question)
  //   cy.get('[data-cy="insert-answer-field-0"]').realClick().type('50%')
  //   cy.get('[data-cy="add-new-answer"]').click()
  //   cy.wait(500)
  //   cy.get('[data-cy="insert-answer-field-1"]').realClick().type('100%')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   // duplicate question and save
  //   cy.get(`[data-cy="duplicate-question-${questionTitle}"]`).click()
  //   cy.wait(500)
  //   cy.findByText(messages.manage.questionForms.DUPLICATETitle).should('exist')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.wait(500)

  //   // check if duplicated question exists alongside original question
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).should('exist')
  //   cy.get(`[data-cy="question-item-${questionTitle + ' (Copy)'}"]`).should(
  //     'exist'
  //   )
  //   cy.get(`[data-cy="question-item-${questionTitle + ' (Copy)'}"]`).contains(
  //     messages.shared.DRAFT.statusLabel
  //   )

  //   // delete the duplicated question
  //   cy.get(`[data-cy="delete-question-${questionTitle} (Copy)"]`).click()
  //   cy.get('[data-cy="confirm-question-deletion"]').click()
  //   cy.get(`[data-cy="question-item-${questionTitle}"]`).should('exist')
  //   cy.get(`[data-cy="question-item-${questionTitle + ' (Copy)'}"]`).should(
  //     'not.exist'
  //   )
  // })
})
