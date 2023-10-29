import '@testing-library/cypress/add-commands'
import { sign } from 'jsonwebtoken'

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
  cy.clearAllCookies()
  cy.clearAllLocalStorage()

  cy.viewport('macbook-16')

  const token = sign(
    {
      email: 'lecturer@bf.uzh.ch',
      sub: '76047345-3801-4628-ae7b-adbebcfe8821',
      role: 'USER',
      scope: 'FULL_ACCESS',
      catalystInstitutional: true,
      catalystIndividual: true,
    },
    'abcd'
  )

  cy.setCookie('next-auth.session-token', token, {
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  })

  cy.visit(Cypress.env('URL_MANAGE'))
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
