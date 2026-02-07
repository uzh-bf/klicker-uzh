/// <reference types="cypress" />

/**
 * Y-chatbot-auth-workflow.cy.ts
 *
 * Tests for the chatbot authentication and access control flow.
 * Verifies that unauthenticated users are redirected, the noLogin page renders
 * correctly, and authenticated users can access or are blocked from the chatbot
 * depending on their participation status.
 */

const CHATBOT_ID = 'test-chatbot-id'

describe('Chatbot Authentication & Access Control', () => {
  it('Unauthenticated user is redirected to /noLogin', () => {
    cy.clearAllCookies()
    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })
    cy.url().should('include', '/noLogin')
  })

  it('/noLogin page shows login-required message and login link', () => {
    cy.clearAllCookies()
    cy.visit(
      `${Cypress.env('URL_CHAT')}/noLogin?redirectTo=/${CHATBOT_ID}`,
      { failOnStatusCode: false }
    )

    cy.get('[data-cy="chat-no-login"]').should('be.visible')
    cy.get('[data-cy="chat-no-login-title"]')
      .should('be.visible')
      .and('contain.text', 'Login Required')
    cy.get('[data-cy="chat-no-login-link"]')
      .should('be.visible')
      .and('contain.text', 'Go to KlickerUZH Login')
  })

  it('Authenticated user with valid participation can access chatbot', () => {
    cy.clearAllCookies()

    // Intercept the disclaimer API to simulate no disclaimer required
    cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/disclaimer`, {
      statusCode: 200,
      body: {
        disclaimer: null,
        status: { required: false, accepted: false },
      },
    }).as('getDisclaimer')

    // Intercept threads API
    cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/threads`, {
      statusCode: 200,
      body: [],
    }).as('getThreads')

    // Intercept credits API
    cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/credits`, {
      statusCode: 200,
      body: { current: 50, total: 100 },
    }).as('getCredits')

    // Intercept chatbot metadata API
    cy.intercept('GET', `**/api/chatbots/${CHATBOT_ID}`, {
      statusCode: 200,
      body: {
        systemPrompts: {
          tutor: {
            prompt: 'You are a helpful tutor.',
            description: 'A helpful tutor mode.',
          },
        },
        modelSelection: false,
      },
    }).as('getChatbot')

    // Set a valid participant_token cookie (JWT signed with APP_SECRET=abcd)
    // For E2E tests we rely on the student being logged in via the PWA first.
    // Here we use the loginStudent command and then set the cookie for the chat domain.
    cy.loginStudent()
    cy.wait(1000)

    // Copy the participant cookie from the student app to the chat domain
    cy.getCookie('participant_token').then((cookie) => {
      if (cookie) {
        cy.setCookie('participant_token', cookie.value, {
          domain: '127.0.0.1',
          path: '/',
        })
      }
    })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    // Should see the chat interface (composer) or loading state, not the noLogin page
    cy.get('[data-cy="chat-no-login"]').should('not.exist')
  })
})
