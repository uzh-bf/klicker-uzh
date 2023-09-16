/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
Cypress.Commands.add('loginLecturer', () => {
  cy.viewport('macbook-16')

  cy.visit(Cypress.env('URL_MANAGE'))
  cy.clearAllCookies()
  cy.clearAllLocalStorage()

  cy.get('[data-cy="delegated-login-button"').then((btn) => {
    if (btn.is(':disabled')) {
      cy.get('button[data-cy="tos-checkbox"]').click()
    }
  })

  cy.get('[data-cy="delegated-login-button"').should('be.enabled').click()

  cy.get('[data-cy="identifier-field"]').type(
    Cypress.env('LECTURER_IDENTIFIER')
  )
  cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'))

  cy.get(':nth-child(2) > form > button').click()
})

//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
declare global {
  namespace Cypress {
    interface Chainable {
      loginLecturer(): Chainable<void>
      // drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
    }
  }
}
import '@testing-library/cypress/add-commands'
