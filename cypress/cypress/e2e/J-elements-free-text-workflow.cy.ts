import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for free text elements', function () {
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

  // ! Free Text questions
  // #region
  it('Create a Free Text question', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').realClick()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FREE_TEXT.typeLabel}"]`
    ).realClick()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FREE_TEXT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.FT.title)
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.FT.content)
      .should('contain', this.data.FT.content)
    cy.get('[data-cy="set-free-text-length"]')
      .click()
      .type(String(this.data.FT.maxLength))
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    cy.validateElement({
      element: this.data.FT.title,
      contains: [
        this.data.FT.content,
        this.data.FT.title,
        messages.shared.READY.statusLabel,
      ],
    })

    cy.get(`[data-cy="edit-element-${this.data.FT.title}"]`).click()
    cy.get('[data-cy="free-text-input-0"]').should('exist')
  })

  it('Check that values of Free Text question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.FT.title}"]`).click()
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
    cy.get(`[data-cy="edit-element-${this.data.FT.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.FT.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.FT.contentEdited)
      .should('contain', this.data.FT.contentEdited)
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

    cy.validateElement({
      element: this.data.FT.titleEdited,
      contains: [this.data.FT.contentEdited, this.data.FT.titleEdited],
    })
  })

  it('Check that edited Free Text question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.FT.titleEdited}"]`).click()
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
})
