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

  // TODO: move this to a function that is shared with apps/auth
  const token = sign(
    {
      email: 'lecturer@bf.uzh.ch',
      sub: '76047345-3801-4628-ae7b-adbebcfe8821',
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
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

Cypress.Commands.add('loginFreeUser', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()

  cy.viewport('macbook-16')

  const token = sign(
    {
      email: 'free@bf.uzh.ch',
      sub: '76047345-3801-4628-ae7b-adbebcfe8822',
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
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

Cypress.Commands.add('loginIndividualCatalyst', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()

  cy.viewport('macbook-16')

  const token = sign(
    {
      email: 'pro1@bf.uzh.ch',
      sub: '76047345-3801-4628-ae7b-adbebcfe8823',
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
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

Cypress.Commands.add('loginInstitutionalCatalyst', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()

  cy.viewport('macbook-16')

  const token = sign(
    {
      email: 'pro2@bf.uzh.ch',
      sub: '76047345-3801-4628-ae7b-adbebcfe8824',
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: true,
      catalystIndividual: false,
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
      loginFreeUser(): Chainable<void>
      loginIndividualCatalyst(): Chainable<void>
      loginInstitutionalCatalyst(): Chainable<void>
      // drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
    }
  }
}
