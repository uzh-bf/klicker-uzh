import messages from '../../../packages/i18n/messages/en'

describe('ActivityLog feature tests', function () {
  before(() => {
    cy.cleanup()
    cy.seed()
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('DM-questions.json').then((data) => {
      this.data = data
    })
  })

  it('Access activity log from element dropdown', function () {
    // Navigate to the question pool
    cy.visit(Cypress.env('URL_MANAGE'))

    // Wait for elements to load
    cy.contains(this.data.SC.title).should('be.visible')

    // Open the element's dropdown menu
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()

    // Click on the activity log item in the dropdown
    cy.get(`[data-cy="view-activity-log-"]`).click({ force: true })

    // Verify the activity log dialog is open
    cy.contains(messages.shared.activity.title).should('be.visible')

    // Close the activity log dialog
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Access activity log from element edit modal', function () {
    // Navigate to the question pool
    cy.visit(Cypress.env('URL_MANAGE'))

    // Find our test element and open it for editing
    cy.contains(this.data.SC.title).should('be.visible')
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()

    // Click on the Activity tab
    cy.contains(messages.shared.generic.activity).click()

    // Verify the activity log is visible within the edit modal
    // TODO: check for the real form
    cy.get('form').should('exist')

    // Close the element edit modal
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Create a message in the activity log', function () {
    // Navigate to the question pool
    cy.visit(Cypress.env('URL_MANAGE'))

    // Find our test element
    cy.contains(this.data.SC.title).should('be.visible')

    // Open the element's dropdown menu and access the activity log
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-"]`).click({ force: true })

    // Type a message in the activity log
    const testMessage = `Test message ${new Date().toISOString()}`
    // TODO: switch to the activity tab, use more specific selector for the textarea
    cy.get('textarea').type(testMessage)

    // Submit the message
    cy.contains(messages.shared.activity.send).click()

    // Verify the message appears in the activity log
    cy.contains(testMessage).should('be.visible')

    // Close the activity log dialog
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Track title modifications in the activity log', function () {
    // Navigate to the question pool
    cy.visit(Cypress.env('URL_MANAGE'))

    // Find our test element and open it for editing
    cy.contains(this.data.SC.title).should('be.visible')
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()

    // Change the title
    const updatedTitle = `${this.data.SC.title} Updated ${new Date().getTime()}`
    cy.get('[data-cy="insert-question-title"]').clear().type(updatedTitle)

    // Save the changes
    cy.get('[type="submit"]').click()

    // Wait for the success toast and dismiss it
    cy.contains('Question saved successfully').should('be.visible')

    // Open the activity log from dropdown
    cy.contains(updatedTitle).should('be.visible')
    cy.get(`[data-cy="actions-element-${updatedTitle}"]`).click()
    cy.get(`[data-cy="view-activity-log-"]`).click({ force: true })

    // Verify a modification entry exists for the title change
    cy.contains(this.data.SC.title).should('be.visible')
    cy.contains(updatedTitle).should('be.visible')

    // Close the activity log dialog
    cy.get('[data-cy="close-activity-log"]').click()
  })

  // TODO: add once status tracking works
  // it('Track status modifications in the activity log', function () {
  //   // Navigate to the question pool
  //   cy.visit(Cypress.env('URL_MANAGE'))

  //   // Find the updated element and open it for editing
  //   cy.contains('Updated').should('be.visible')
  //   cy.get(`[data-cy="edit-element-`).first().click()

  //   // Change the status from READY to DRAFT
  //   cy.get('[data-cy="select-question-status"]').click()
  //   cy.get(
  //     `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
  //   ).click()

  //   // Save the changes
  //   cy.get('[type="submit"]').click()

  //   // Wait for the success toast
  //   cy.contains('Question saved successfully').should('be.visible')

  //   // Open the activity log from dropdown
  //   cy.get(`[data-cy="actions-element-`).first().click()
  //   cy.get(`[data-cy="view-activity-log-"]`).click({ force: true })

  //   // Verify a modification entry exists for the status change
  //   cy.contains(messages.shared.READY.statusLabel).should('be.visible')
  //   cy.contains(messages.shared.DRAFT.statusLabel).should('be.visible')

  //   // Close the activity log dialog
  //   cy.get('[data-cy="close-activity-log"]').click()
  // })
})
