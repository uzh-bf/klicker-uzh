import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for Content elements', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Content elements
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
    cy.get(`[data-cy="edit-element-${this.data.CT.title}"]`).click()
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
    cy.get(`[data-cy="edit-element-${this.data.CT.title}"]`).click()
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
    cy.get(`[data-cy="edit-element-${this.data.CT.titleEdited}"]`).click()
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

  // ! Cleanup
  // #region
  it('Cleanup: Delete the content element', function () {
    cy.deleteElement({ elementName: this.data.CT.titleEdited })
  })
  // #endregion
})
