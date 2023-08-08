export function performLecturerLogin(cy) {
  cy.clearAllCookies()
  cy.viewport('macbook-16')
  cy.visit(Cypress.env('URL_MANAGE'))

  cy.get('[data-cy="delegated-login-button"').click()

  cy.get('[data-cy="identifier-field"]').type(
    Cypress.env('LECTURER_IDENTIFIER')
  )
  cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'))

  cy.get(':nth-child(2) > form > button').click()
}

describe('Login / Logout workflows for lecturer and students', () => {
  it('signs in into student account', () => {
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('macbook-16')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.wait(1000)
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
  })

  it('signs in into student account on mobile', () => {
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('iphone-x')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.wait(1000)
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.viewport('macbook-16')
  })

  it('signs in into lecturer account', () => {
    performLecturerLogin(cy)

    cy.get('[data-cy="homepage"]').should('exist')

    cy.get('[data-cy="user-menu"]').click()
  })
})
