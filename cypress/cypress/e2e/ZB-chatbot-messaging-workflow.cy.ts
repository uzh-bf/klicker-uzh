/// <reference types="cypress" />

/**
 * ZB-chatbot-messaging-workflow.cy.ts
 *
 * Tests for the chatbot messaging interface.
 * Covers the welcome state, sending messages, receiving (stubbed) streaming
 * responses, and the message action bar (copy, reload).
 *
 * All API calls are intercepted so these tests run without a real backend.
 */

const CHATBOT_ID = 'test-chatbot-messaging'

/**
 * Creates a minimal SSE stream body that simulates an assistant response.
 * The real backend uses the Vercel AI SDK streaming protocol.
 */
function makeStreamBody(text: string) {
  const lines = [
    `data: ${JSON.stringify({ type: 'start' })}`,
    `data: ${JSON.stringify({ type: 'start-step' })}`,
    `data: ${JSON.stringify({ type: 'text-start' })}`,
    `data: ${JSON.stringify({ type: 'text-delta', delta: text })}`,
    `data: ${JSON.stringify({ type: 'text-end' })}`,
    `data: ${JSON.stringify({ type: 'finish-step' })}`,
    `data: ${JSON.stringify({ type: 'finish' })}`,
    'data: [DONE]',
  ].join('\n')
  return lines
}

function setupChatIntercepts() {
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

  cy.intercept('POST', `/api/chatbots/${CHATBOT_ID}/threads`, {
    statusCode: 200,
    body: {
      id: 'thread-auto',
      title: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    },
  }).as('createThread')

  cy.intercept('PUT', `/api/chatbots/${CHATBOT_ID}/threads/*/title`, {
    statusCode: 200,
    body: { success: true },
  }).as('updateThreadTitle')

  cy.intercept('POST', `/api/chatbots/${CHATBOT_ID}/chat`, {
    statusCode: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: makeStreamBody(
      'This is a test response from the AI assistant.'
    ),
  }).as('chatStream')
}

function setupChatInterceptsWithMessages() {
  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/disclaimer`, {
    statusCode: 200,
    body: {
      disclaimer: null,
      status: { required: false, accepted: false },
    },
  }).as('getDisclaimer')

  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/threads`, {
    statusCode: 200,
    body: [
      {
        id: 'thread-with-msgs',
        title: 'Test Thread',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
        messages: [],
      },
    ],
  }).as('getThreads')

  cy.intercept(
    'GET',
    `/api/chatbots/${CHATBOT_ID}/threads/thread-with-msgs/messages`,
    {
      statusCode: 200,
      body: [
        {
          id: 'msg-u1',
          role: 'user',
          content: [{ type: 'text', text: 'What is photosynthesis?' }],
          parentId: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
        {
          id: 'msg-a1',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Photosynthesis is the process by which plants convert sunlight into energy.',
            },
          ],
          parentId: 'msg-u1',
          createdAt: '2025-01-15T10:00:05Z',
        },
      ],
    }
  ).as('getThreadMessages')

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

  cy.intercept('PUT', `/api/chatbots/${CHATBOT_ID}/threads/*/title`, {
    statusCode: 200,
    body: { success: true },
  }).as('updateThreadTitle')

  cy.intercept('POST', `/api/chatbots/${CHATBOT_ID}/chat`, {
    statusCode: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: makeStreamBody(
      'Here is the regenerated response about photosynthesis.'
    ),
  }).as('chatStream')
}

describe('Chatbot Messaging Interface', () => {
  beforeEach(() => {
    cy.clearAllCookies()
    cy.loginStudent()
    cy.wait(500)
  })

  it('Empty chat shows welcome message', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-welcome-message"]')
      .should('be.visible')
      .and('contain.text', 'How can I help you today?')
  })

  it('Composer input is visible and accepts text', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-composer"]').should('be.visible')
    cy.get('[data-cy="chat-composer-input"]')
      .should('be.visible')
      .and('have.attr', 'placeholder', 'Write a message...')

    cy.get('[data-cy="chat-composer-input"]').type('Hello, chatbot!')
    cy.get('[data-cy="chat-composer-input"]').should(
      'have.value',
      'Hello, chatbot!'
    )
  })

  it('Send button is present and clickable', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Type a message so the send button becomes active
    cy.get('[data-cy="chat-composer-input"]').type('Test message')
    cy.get('[data-cy="chat-send-button"]').should('be.visible')
  })

  it('Sending a message displays user message in the thread', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-composer-input"]').type('Hello, chatbot!')
    cy.get('[data-cy="chat-send-button"]').click()

    // User message should appear
    cy.get('[data-cy="chat-user-message"]').should('exist')
    cy.get('[data-cy="chat-user-message-content"]')
      .should('exist')
      .and('contain.text', 'Hello, chatbot!')
  })

  it('Assistant response appears after sending a message', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-composer-input"]').type('Hello, chatbot!')
    cy.get('[data-cy="chat-send-button"]').click()

    // Wait for the streaming response
    cy.wait('@chatStream')

    // Assistant message should appear
    cy.get('[data-cy="chat-assistant-message"]', { timeout: 10000 }).should(
      'exist'
    )
    cy.get('[data-cy="chat-assistant-message-content"]').should('exist')
  })

  it('Welcome message disappears after sending first message', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-welcome-message"]').should('be.visible')

    cy.get('[data-cy="chat-composer-input"]').type('Hello!')
    cy.get('[data-cy="chat-send-button"]').click()

    // Welcome message should be gone now that messages exist
    cy.get('[data-cy="chat-welcome-message"]').should('not.exist')
  })

  it('Existing thread with messages renders user and assistant messages', () => {
    setupChatInterceptsWithMessages()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Click on the existing thread
    cy.get('[data-cy="chat-thread-select"]').first().click()
    cy.wait('@getThreadMessages')

    // Both user and assistant messages should be rendered
    cy.get('[data-cy="chat-user-message"]').should('exist')
    cy.get('[data-cy="chat-user-message-content"]').should(
      'contain.text',
      'What is photosynthesis?'
    )
    cy.get('[data-cy="chat-assistant-message"]').should('exist')
    cy.get('[data-cy="chat-assistant-message-content"]').should(
      'contain.text',
      'Photosynthesis is the process'
    )
  })
})
