import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for Flashcard elements', function () {
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

  // ! Flashcards
  // #region
  it('Create a flashcard element', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').realClick()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FLASHCARD.typeLabel}"]`
    ).realClick()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(this.data.FC.title)
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.REVIEW.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .realType(this.data.FC.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .realType(this.data.FC.explanation)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.validateElement({
      element: this.data.FC.title,
      contains: [
        this.data.FC.content,
        this.data.FC.title,
        messages.shared.REVIEW.statusLabel,
      ],
    })
  })

  it('Check that values of flashcard element are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.FC.title}"]`).click()
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
    cy.get(`[data-cy="edit-element-${this.data.FC.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.FC.titleEdited)
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .realType(this.data.FC.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .clear()
      .realType(this.data.FC.explanationEdited)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.validateElement({
      element: this.data.FC.titleEdited,
      contains: [
        this.data.FC.contentEdited,
        this.data.FC.titleEdited,
        messages.shared.READY.statusLabel,
      ],
    })
  })

  it('Check that edited flashcard element is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.FC.titleEdited}"]`).click()
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
})
