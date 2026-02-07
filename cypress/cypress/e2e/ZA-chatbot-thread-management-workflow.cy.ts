/// <reference types="cypress" />

/**
 * ZA-chatbot-thread-management-workflow.cy.ts
 *
 * Tests for the chatbot thread management features.
 * Covers creating threads, switching between them, editing thread titles,
 * deleting threads, and verifying sidebar layout.
 *
 * All API calls are intercepted so these tests run without a real backend.
 */

const CHATBOT_ID = 'test-chatbot-threads'

const EXISTING_THREADS = [
  {
    id: 'thread-1',
    title: 'First conversation',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    messages: [],
  },
  {
    id: 'thread-2',
    title: 'Second conversation',
    createdAt: '2025-01-16T14:00:00Z',
    updatedAt: '2025-01-16T14:30:00Z',
    messages: [],
  },
]

function setupChatIntercepts(threads = EXISTING_THREADS) {
  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/disclaimer`, {
    statusCode: 200,
    body: {
      disclaimer: null,
      status: { required: false, accepted: false },
    },
  }).as('getDisclaimer')

  cy.intercept('GET', `/api/chatbots/${CHATBOT_ID}/threads`, {
    statusCode: 200,
    body: threads,
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
      id: 'thread-new',
      title: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    },
  }).as('createThread')

  cy.intercept(
    'GET',
    `/api/chatbots/${CHATBOT_ID}/threads/thread-1/messages`,
    {
      statusCode: 200,
      body: [
        {
          id: 'msg-1',
          role: 'user',
          content: [{ type: 'text', text: 'Hello chatbot!' }],
          parentId: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello! How can I help you today?' },
          ],
          parentId: 'msg-1',
          createdAt: '2025-01-15T10:00:05Z',
        },
      ],
    }
  ).as('getThread1Messages')

  cy.intercept(
    'GET',
    `/api/chatbots/${CHATBOT_ID}/threads/thread-2/messages`,
    {
      statusCode: 200,
      body: [
        {
          id: 'msg-3',
          role: 'user',
          content: [{ type: 'text', text: 'Tell me about physics' }],
          parentId: null,
          createdAt: '2025-01-16T14:00:00Z',
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Physics is the study of matter, energy, and their interactions.',
            },
          ],
          parentId: 'msg-3',
          createdAt: '2025-01-16T14:00:05Z',
        },
      ],
    }
  ).as('getThread2Messages')

  cy.intercept('DELETE', `/api/chatbots/${CHATBOT_ID}/threads/*`, {
    statusCode: 200,
    body: { success: true },
  }).as('deleteThread')

  cy.intercept('PUT', `/api/chatbots/${CHATBOT_ID}/threads/*/title`, {
    statusCode: 200,
    body: { success: true },
  }).as('updateThreadTitle')
}

describe('Chatbot Thread Management', () => {
  beforeEach(() => {
    cy.clearAllCookies()
    cy.loginStudent()
    cy.wait(500)
  })

  it('Sidebar shows Chat History header and New Chat button', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.contains('Chat History').should('be.visible')
    cy.get('[data-cy="chat-new-thread-button"]')
      .should('be.visible')
      .and('contain.text', 'New Chat')
  })

  it('Existing threads appear in the sidebar thread list', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-thread-list"]').should('be.visible')
    cy.get('[data-cy="chat-thread-item"]').should('have.length', 2)
    cy.contains('First conversation').should('be.visible')
    cy.contains('Second conversation').should('be.visible')
  })

  it('Clicking "New Chat" creates a new thread and navigates to it', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-new-thread-button"]').click()
    cy.wait('@createThread')

    // Should navigate to the new thread URL
    cy.url().should('include', '/threads/thread-new')
  })

  it('Clicking a thread in sidebar navigates to it and loads messages', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Click first thread — triggers URL navigation
    cy.get('[data-cy="chat-thread-select"]').first().click()

    // Should navigate to the thread URL
    cy.url().should('include', '/threads/thread-1')

    cy.wait('@getThread1Messages')

    // Should display the messages in the chat area
    cy.get('[data-cy="chat-user-message"]').should('exist')
    cy.get('[data-cy="chat-assistant-message"]').should('exist')
  })

  it('Thread edit icon opens inline title editing', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Hover over and click the edit button on the first thread
    cy.get('[data-cy="chat-thread-item"]').first().within(() => {
      cy.get('[data-cy="chat-thread-edit-button"]').click({ force: true })
    })

    // Should show the title input field
    cy.get('[data-cy="chat-thread-title-input"]').should('be.visible')
    cy.get('[data-cy="chat-thread-title-save"]').should('be.visible')
    cy.get('[data-cy="chat-thread-title-cancel"]').should('be.visible')
  })

  it('Saving an edited thread title calls the API', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Start editing
    cy.get('[data-cy="chat-thread-item"]').first().within(() => {
      cy.get('[data-cy="chat-thread-edit-button"]').click({ force: true })
    })

    // Clear and type new title
    cy.get('[data-cy="chat-thread-title-input"]')
      .find('input')
      .clear()
      .type('Updated Title')

    // Save
    cy.get('[data-cy="chat-thread-title-save"]').click()
    cy.wait('@updateThreadTitle')

    // Input should disappear, title should be updated
    cy.get('[data-cy="chat-thread-title-input"]').should('not.exist')
  })

  it('Cancelling title edit reverts the input', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    // Start editing
    cy.get('[data-cy="chat-thread-item"]').first().within(() => {
      cy.get('[data-cy="chat-thread-edit-button"]').click({ force: true })
    })

    // Cancel
    cy.get('[data-cy="chat-thread-title-cancel"]').click()

    // Input should disappear
    cy.get('[data-cy="chat-thread-title-input"]').should('not.exist')
    // Original title should still be shown
    cy.contains('First conversation').should('be.visible')
  })

  it('Deleting a thread removes it from the sidebar', () => {
    setupChatIntercepts()

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-thread-item"]').should('have.length', 2)

    // Delete the first thread
    cy.get('[data-cy="chat-thread-item"]').first().within(() => {
      cy.get('[data-cy="chat-thread-delete-button"]').click({ force: true })
    })

    cy.wait('@deleteThread')

    // Thread should be removed from the list
    cy.get('[data-cy="chat-thread-item"]').should('have.length', 1)
    cy.contains('First conversation').should('not.exist')
  })

  it('Empty thread list shows no thread items', () => {
    setupChatIntercepts([])

    cy.visit(`${Cypress.env('URL_CHAT')}/${CHATBOT_ID}`, {
      failOnStatusCode: false,
    })

    cy.wait('@getDisclaimer')

    cy.get('[data-cy="chat-thread-list"]').should('be.visible')
    cy.get('[data-cy="chat-thread-item"]').should('have.length', 0)
  })
})
