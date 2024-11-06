import { v4 as uuid } from 'uuid'

const questionTitle = uuid()
const question = uuid()
const quizTitle = uuid()
const quiz = uuid()

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
      name: quizTitle,
      displayName: quiz,
      blocks: [
        {
          questions: [questionTitle],
        },
      ],
    })

    // check if the creation was successful
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.contains('[data-cy="live-quiz-block"]', quizTitle)
  })

  it('Generate a token to log into the control-frontend application, execute quiz', () => {
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

    // check ppt links and start the quiz
    cy.get('[data-cy="unassigned-live-quizzes"]').click()
    cy.get(`[data-cy="ppt-link-${quizTitle}"]`).should('exist').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.findByText(quizTitle).click()
    cy.get('[data-cy="confirm-start-live-quiz"]').click()

    // test the mobile menu of the control app
    cy.viewport('iphone-6')
    cy.get('[data-cy="ppt-button"]').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.get('[data-cy="home-button"]').click()
    cy.get('[data-cy="unassigned-live-quizzes"]').click()
    cy.findByText(quizTitle).click()
    cy.get('[data-cy="back-button"]').click()
    cy.findByText(quizTitle).click()
    cy.viewport('macbook-16')

    // open and close block, end the quiz
    cy.get('[data-cy="activate-next-block"]').click()
    cy.get('[data-cy="deactivate-block"]').click()
    cy.get('[data-cy="end-live-quiz"]').click()
    cy.findByText(quizTitle).should('not.exist')
  })

  // TODO (later): check if quiz is running correctly / add student answer
})
