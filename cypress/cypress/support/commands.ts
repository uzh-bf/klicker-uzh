import '@testing-library/cypress/add-commands'
import { sign } from 'jsonwebtoken'
import messages from '../../../packages/i18n/messages/en'

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

Cypress.Commands.add(
  'loginStudentPassword',
  ({ username }: { username: string }) => {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]').click().type(username)
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
  }
)

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
    correct1,
    correct2,
  }: {
    title: string
    content: string
    answer1: string
    answer2: string
    correct1?: boolean
    correct2?: boolean
  }) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(title)
    cy.get('[data-cy="insert-question-text"]').click().type(content)
    cy.get('[data-cy="insert-answer-field-0"]').click().type(answer1)
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type(answer2)

    if (typeof correct1 !== 'undefined' || typeof correct2 !== 'undefined') {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })

      if (correct1) {
        cy.get('[data-cy="set-correctness-0"]').click()
      }
      if (correct2) {
        cy.get('[data-cy="set-correctness-1"]').click()
      }
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
  }
)

Cypress.Commands.add(
  'createLiveQuiz',
  ({
    name,
    displayName,
    courseName,
    blocks,
  }: {
    name: string
    displayName: string
    courseName?: string
    blocks: { questions: string[] }[]
  }) => {
    cy.get('[data-cy="create-live-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-live-quiz-name"]').type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-live-display-name"]').type(displayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    if (typeof courseName !== 'undefined') {
      cy.get('[data-cy="select-course"]')
        .should('exist')
        .contains(messages.manage.sessionForms.liveQuizNoCourse)
      cy.get('[data-cy="select-course"]').click()
      cy.get(`[data-cy="select-course-${courseName}"]`).click()
      cy.get('[data-cy="select-course"]').contains(courseName)
    }
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Blocks & Questions
    if (blocks.length > 0) {
      const dataTransfer = new DataTransfer()

      blocks[0].questions.forEach((question, ix) => {
        cy.get(`[data-cy="question-item-${question}"]`)
          .contains(question)
          .trigger('dragstart', {
            dataTransfer,
          })
        cy.get('[data-cy="drop-questions-here-0"]').trigger('drop', {
          dataTransfer,
        })
        cy.get(`[data-cy="question-${ix}-block-0"]`)
          .should('exist')
          .should('contain', question.substring(0, 20))
      })
    }

    cy.get('[data-cy="next-or-submit"]').click()
  }
)

interface StackType {
  elements: string[]
}

function createStacks({ stacks }: { stacks: StackType[] }) {
  stacks[0].elements.forEach((element, ix) => {
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${element}"]`)
      .contains(element)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get(`[data-cy="question-${ix}-stack-0"]`).contains(element)
  })

  if (stacks.length > 1) {
    // TODO: implement the creation of further stacks
  }
}

Cypress.Commands.add(
  'createPracticeQuiz',
  ({
    name,
    displayName,
    description,
    courseName,
    stacks,
  }: {
    name: string
    displayName: string
    description?: string
    courseName: string
    stacks: StackType[]
  }) => {
    cy.get('[data-cy="create-practice-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').click().type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(displayName)
    cy.get('[data-cy="insert-practice-quiz-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Stacks
    createStacks({ stacks })

    cy.get('[data-cy="next-or-submit"]').click()
  }
)

Cypress.Commands.add(
  'createMicroLearning',
  ({
    name,
    displayName,
    description,
    courseName,
    stacks,
  }: {
    name: string
    displayName: string
    description?: string
    courseName: string
    stacks: StackType[]
  }) => {
    cy.get('[data-cy="create-microlearning"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-microlearning-name"]').click().type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(displayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Stacks
    createStacks({ stacks })

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
      loginStudentPassword({ username }: { username: string }): Chainable<void>
      loginControlApp(): Chainable<void>
      createQuestionSC({
        title,
        content,
        answer1,
        answer2,
        correct1,
        correct2,
      }: {
        title: string
        content: string
        answer1: string
        answer2: string
        correct1?: boolean
        correct2?: boolean
      }): Chainable<void>
      createLiveQuiz({
        name,
        displayName,
        courseName,
        blocks,
      }: {
        name: string
        displayName: string
        courseName?: string
        blocks: { questions: string[] }[]
      }): Chainable<void>
      createPracticeQuiz({
        name,
        displayName,
        description,
        courseName,
        stacks,
      }: {
        name: string
        displayName: string
        description?: string
        courseName: string
        stacks: StackType[]
      }): Chainable<void>
      createMicroLearning({
        name,
        displayName,
        description,
        courseName,
        stacks,
      }: {
        name: string
        displayName: string
        description?: string
        courseName: string
        stacks: StackType[]
      }): Chainable<void>
      // drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
      // visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
    }
  }
}
