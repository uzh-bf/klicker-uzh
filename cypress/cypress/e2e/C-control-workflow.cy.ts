import { v4 as uuid } from 'uuid'

describe('Test functionalities of frontend-control application', () => {
  it('Test the basic functionalities of the control application: login and session management', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // create a new session with one question for testing

    const questionTitle = uuid()
    const question = uuid()
    const sessionTitle = uuid()
    const session = uuid()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionTitle)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionTitle)

    // generate a token to log into the control-frontend
    cy.get('[data-cy="user-menu"]').click()
    cy.get('[data-cy="token-generation-page"]').click()
    cy.get('[data-cy="generate-token"]').click()

    // save the token
    cy.get('[data-cy="control-login-token"]')
      .invoke('text')
      .then(($token) => {
        cy.wrap($token).as('token')
      })

    // log into the control-frontend application
    cy.visit(Cypress.env('URL_CONTROL'))
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.viewport('macbook-16')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="shortname-field"]').type(
      Cypress.env('LECTURER_IDENTIFIER')
    )
    cy.get('@token').then((token) => {
      cy.get('[data-cy="token-field"]').type(String(token))
    })
    cy.get('[data-cy="submit-login"]').click()

    cy.get('[data-cy="unassigned-sessions"]').click()

    // check ppt links and start the session
    cy.get(`[data-cy="ppt-link-${sessionTitle}"]`).should('exist').click()
    cy.get('[data-cy="close-embedding-modal"]').click()

    cy.findByText(sessionTitle).click()
    cy.get('[data-cy="confirm-start-session"]').click()

    // test the mobile menu of the control app
    // resize the window to a mobile size
    cy.viewport('iphone-6')
    cy.get('[data-cy="ppt-button"]').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.get('[data-cy="home-button"]').click()
    cy.get('[data-cy="unassigned-sessions"]').click()
    cy.findByText(sessionTitle).click()
    cy.get('[data-cy="back-button"]').click()
    cy.findByText(sessionTitle).click()
    cy.viewport('macbook-16')

    // open and close the block and end the session
    cy.get('[data-cy="activate-next-block"]').click()
    cy.get('[data-cy="deactivate-block"]').click()
    cy.get('[data-cy="end-session"]').click()
    cy.findByText(sessionTitle).should('not.exist')

    // TODO (later): check if session is running correctly / add student answer
  })
})
