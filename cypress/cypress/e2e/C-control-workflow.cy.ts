import { v4 as uuid } from 'uuid'

const questionTitle = uuid()
const question = uuid()
const sessionTitle = uuid()
const session = uuid()

describe('Test functionalities of frontend-control application', () => {
  it('Create a new SC question to use it in a live quiz', () => {
    cy.loginLecturer()

    // create single choice question for use in test live quiz
    cy.createQuestionSC({
      title: questionTitle,
      content: question,
      choices: [{ content: '50%' }, { content: '100%' }],
    })
  })

  it('Create a new live quiz with the SC question', () => {
    cy.loginLecturer()

    // create live quiz with single choice question
    cy.createLiveQuiz({
      name: sessionTitle,
      displayName: session,
      blocks: [
        {
          questions: [questionTitle],
        },
      ],
    })

    // check if the creation was successful
    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionTitle)
  })

  it('Generate a token to log into the control-frontend application, execute session', () => {
    cy.loginLecturer()

    cy.get('[data-cy="user-menu"]').click()
    cy.get('[data-cy="token-generation-page"]').click()
    cy.get('[data-cy="generate-token"]').click()

    // save the token
    cy.get('[data-cy="control-login-token"]')
      .invoke('text')
      .then(($token) => {
        cy.wrap($token).as('token')
      })

    // login into the control-frontend application
    cy.loginControlApp()

    // check ppt links and start the session
    cy.get('[data-cy="unassigned-sessions"]').click()
    cy.get(`[data-cy="ppt-link-${sessionTitle}"]`).should('exist').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.findByText(sessionTitle).click()
    cy.get('[data-cy="confirm-start-session"]').click()

    // test the mobile menu of the control app
    cy.viewport('iphone-6')
    cy.get('[data-cy="ppt-button"]').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.get('[data-cy="home-button"]').click()
    cy.get('[data-cy="unassigned-sessions"]').click()
    cy.findByText(sessionTitle).click()
    cy.get('[data-cy="back-button"]').click()
    cy.findByText(sessionTitle).click()
    cy.viewport('macbook-16')

    // open and close block, end the session
    cy.get('[data-cy="activate-next-block"]').click()
    cy.get('[data-cy="deactivate-block"]').click()
    cy.get('[data-cy="end-session"]').click()
    cy.findByText(sessionTitle).should('not.exist')
  })

  // TODO (later): check if session is running correctly / add student answer
})
