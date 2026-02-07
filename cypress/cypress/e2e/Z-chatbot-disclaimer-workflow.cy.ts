/// <reference types="cypress" />

/**
 * Z-chatbot-disclaimer-workflow.cy.ts
 *
 * Tests for the chatbot disclaimer modal flow.
 * Verifies that the disclaimer modal appears when required, its content is
 * rendered properly, and the accept/decline actions behave correctly.
 *
 * All API calls are intercepted so these tests run without a real backend.
 */

const CHATBOT_ID = 'test-chatbot-disclaimer'

const DISCLAIMER_DATA = {
  id: 'disclaimer-1',
  name: 'Test Disclaimer',
  title: 'Chatbot Terms of Use',
  introText: 'Welcome to the chatbot. Please read the following terms.',
}

function setupChatInterceptsWithDisclaimer(
  disclaimerStatus: {
    required: boolean
    accepted: boolean
    declined?: boolean
  } = { required: true, accepted: false }
) {
  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/disclaimer`, {
    statusCode: 200,
    body: {
      disclaimer: DISCLAIMER_DATA,
      status: disclaimerStatus,
    },
  }).as('getDisclaimer')

  cy.intercept('POST', `/api/chatbots/${CHATBOT_ID}/disclaimer`, {
    statusCode: 200,
    body: { success: true },
  }).as('postDisclaimer')

  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/threads`, {
    statusCode: 200,
    body: [],
  }).as('getThreads')

  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/credits`, {
    statusCode: 200,
    body: { current: 50, total: 100 },
  }).as('getCredits')

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
}

describe('Chatbot Disclaimer Flow', () => {
  beforeEach(() => {
    cy.clearAllCookies()
    // Set up a valid participant token for the chat app domain.
    // In a real E2E environment this would come from the student login flow.
    cy.loginStudent()
    cy.wait(500)
  })

  it('Disclaimer modal appears when required and not yet accepted', () => {
    setupChatInterceptsWithDisclaimer({ required: true, accepted: false })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Disclaimer modal should be visible
    cy.get('[data-cy="chat-disclaimer-content"]').should('be.visible')
    cy.get('[data-cy="chat-disclaimer-accept"]').should('be.visible')
    cy.get('[data-cy="chat-disclaimer-decline"]').should('be.visible')
  })

  it('Disclaimer modal displays Student Responsibility and Data Protection sections', () => {
    setupChatInterceptsWithDisclaimer({ required: true, accepted: false })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-disclaimer-content"]').within(() => {
      cy.contains('Student Responsibility').should('be.visible')
      cy.contains('Data Protection').should('be.visible')
      cy.contains('What happens after your choice').should('be.visible')
    })
  })

  it('Accepting disclaimer closes modal and enables chat', () => {
    setupChatInterceptsWithDisclaimer({ required: true, accepted: false })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-disclaimer-accept"]').click()
    cy.wait('@postDisclaimer')

    // Modal should be gone, chat interface should be visible
    cy.get('[data-cy="chat-disclaimer-content"]').should('not.exist')
    cy.get('[data-cy="chat-composer"]').should('be.visible')
  })

  it('Declining disclaimer shows blocked message', () => {
    setupChatInterceptsWithDisclaimer({ required: true, accepted: false })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-disclaimer-decline"]').click()
    cy.wait('@postDisclaimer')

    // Should show the "Chatbot unavailable" blocked view
    cy.get('[data-cy="chat-disclaimer-declined"]').should('be.visible')
    cy.contains('Chatbot unavailable').should('be.visible')
    cy.contains('You declined the chatbot disclaimer').should('be.visible')
  })

  it('"Show disclaimer again" button re-opens modal after decline', () => {
    setupChatInterceptsWithDisclaimer({ required: true, accepted: false })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Decline first
    cy.get('[data-cy="chat-disclaimer-decline"]').click()
    cy.wait('@postDisclaimer')

    // Click "Show disclaimer again"
    cy.get('[data-cy="chat-show-disclaimer-again"]').click()

    // Modal should re-appear
    cy.get('[data-cy="chat-disclaimer-content"]').should('be.visible')
    cy.get('[data-cy="chat-disclaimer-accept"]').should('be.visible')
  })

  it('No disclaimer modal appears when disclaimer is already accepted', () => {
    setupChatInterceptsWithDisclaimer({
      required: true,
      accepted: true,
    })

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Modal should not appear, chat should be immediately available
    cy.get('[data-cy="chat-disclaimer-content"]').should('not.exist')
    cy.get('[data-cy="chat-composer"]').should('be.visible')
  })

  it('No disclaimer modal appears when no disclaimer is required', () => {
    cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/disclaimer`, {
      statusCode: 200,
      body: {
        disclaimer: null,
        status: { required: false, accepted: false },
      },
    }).as('getDisclaimer')

    cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/threads`, {
      statusCode: 200,
      body: [],
    }).as('getThreads')

    cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/credits`, {
      statusCode: 200,
      body: { current: 50, total: 100 },
    }).as('getCredits')

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

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-disclaimer-content"]').should('not.exist')
    cy.get('[data-cy="chat-composer"]').should('be.visible')
  })
})
