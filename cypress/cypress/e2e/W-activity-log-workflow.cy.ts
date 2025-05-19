import messages from '../../../packages/i18n/messages/en'

describe('Feature test for activity logs', function () {
  before(() => {
    cy.seed()
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('W-activity-log.json').then((activityLogData) => {
      this.data = { ...this.data, ...activityLogData }
    })
  })

  it('Create single choice question, access activity log from element dropdown and add a message', function () {
    cy.loginLecturer()

    // create a single choice question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(this.data.SC.title)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.SC.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(this.data.SC.choices[0].value)
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(this.data.SC.choices[1].value)
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').click()

    // open the activity log modal from the element dropdown
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).realClick()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.message1)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.message1}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Verify that the creation of the question is logged in the activity log', function () {
    cy.loginLecturer()

    // compose message for element creation
    const creationMessage = `User ${Cypress.env('LECTURER_SHORTNAME')} created this object.`

    // verify that creation message is displayed correctly in the activity log
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).realClick()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="activity-log-entry-${creationMessage}"]`).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Access activity log from element edit modal and add another message', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()

    // change to the activity tab and check that the message is shown correctly
    cy.get('[data-cy="element-activity-tab"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.message1}"]`
    ).should('exist')

    // submit another message
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.message2)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.message2}"]`
    ).should('exist')
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Track status modifications in the activity log', function () {
    cy.loginLecturer()

    // change the title of the question
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.REVIEW.statusLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-status"]').contains(
      messages.shared.REVIEW.statusLabel
    ) // wait for change to go into effect
    cy.get('[data-cy="close-element-modal"]').click() // element status modifications should not be coupled to saving of the element

    // check the activity log and that a corresponding message is shown
    const titleChangeMessage = `User ${Cypress.env('LECTURER_SHORTNAME')} modified status (READY -> REVIEW).`
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).realClick()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="activity-log-entry-${titleChangeMessage}"]`).should(
      'exist'
    )
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Track title modifications in the activity log', function () {
    cy.loginLecturer()

    // change the title of the question
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SC.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.element.newTitle)
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // check the activity log and that a corresponding message is shown
    const titleChangeMessage = `User ${Cypress.env('LECTURER_SHORTNAME')} modified title (${this.data.SC.title} -> ${this.data.element.newTitle}).`
    cy.get(
      `[data-cy="actions-element-${this.data.element.newTitle}"]`
    ).realClick()
    cy.get(
      `[data-cy="view-activity-log-${this.data.element.newTitle}"]`
    ).click()
    cy.get(`[data-cy="activity-log-entry-${titleChangeMessage}"]`).should(
      'exist'
    )
    cy.get('[data-cy="close-activity-log"]').click()
  })
})
