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

const loginFactory = (tokenData) => () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()

  cy.viewport('macbook-16')

  const token = sign(tokenData, 'abcd') // sign token with app secret

  cy.setCookie('next-auth.session-token', token, {
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  })

  cy.visit(Cypress.env('URL_MANAGE'))
}

Cypress.Commands.add(
  'loginLecturer',
  loginFactory({
    email: 'lecturer@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8821',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: true,
  })
)

Cypress.Commands.add(
  'loginFreeUser',
  loginFactory({
    email: 'free@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8822',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: false,
    catalystIndividual: false,
  })
)

Cypress.Commands.add(
  'loginIndividualCatalyst',
  loginFactory({
    email: 'pro1@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8823',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: false,
    catalystIndividual: true,
  })
)

Cypress.Commands.add(
  'loginInstitutionalCatalyst',
  loginFactory({
    email: 'pro2@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8824',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
)

Cypress.Commands.add('loginStudent', () => {
  cy.clearAllCookies()
  cy.visit(Cypress.env('URL_STUDENT'))
  cy.get('[data-cy="username-field"]')
    .click()
    .type(Cypress.env('STUDENT_USERNAME'))
  cy.get('[data-cy="password-field"]')
    .click()
    .type(Cypress.env('STUDENT_PASSWORD'))
  cy.get('[data-cy="submit-login"]').click()
  cy.wait(1000)
})

Cypress.Commands.add('loginControlApp', () => {
  cy.visit(Cypress.env('URL_CONTROL'))
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.viewport('macbook-16')
  cy.get('[data-cy="login-logo"]').should('exist')
  cy.get('[data-cy="shortname-field"]').type(Cypress.env('LECTURER_IDENTIFIER'))
  cy.get('@token').then((token) => {
    cy.get('[data-cy="token-field"]').type(String(token))
  })
  cy.get('[data-cy="submit-login"]').click()
})

Cypress.Commands.add(
  'createQuestionSC',
  ({
    title,
    content,
    answer1,
    answer2,
  }: {
    title: string
    content: string
    answer1: string
    answer2: string
  }) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(title)
    cy.get('[data-cy="insert-question-text"]').click().type(content)
    cy.get('[data-cy="insert-answer-field-0"]').click().type(answer1)
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type(answer2)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
  }
)

Cypress.Commands.add(
  'createLiveQuiz',
  ({
    name,
    displayName,
    blocks,
  }: {
    name: string
    displayName: string
    blocks: { questions: { title: string }[] }[]
  }) => {
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(displayName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    if (blocks.length > 0) {
      const dataTransfer = new DataTransfer()

      for (const question of blocks[0].questions) {
        cy.get(`[data-cy="question-item-${question.title}"]`)
          .contains(question.title)
          .trigger('dragstart', {
            dataTransfer,
          })
        cy.get('[data-cy="drop-questions-here-0"]').trigger('drop', {
          dataTransfer,
        })
      }
    }

    cy.get('[data-cy="next-or-submit"]').click()
  }
)

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
      loginStudent(): Chainable<void>
      loginControlApp(): Chainable<void>
      createQuestionSC({
        title,
        content,
        answer1,
        answer2,
      }: {
        title: string
        content: string
        answer1: string
        answer2: string
      }): Chainable<void>
      createLiveQuiz({
        name,
        displayName,
        blocks,
      }: {
        name: string
        displayName: string
        blocks: { questions: { title: string }[] }[]
      }): Chainable<void>
      // drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
    }
  }
}
