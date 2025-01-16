describe('Test functionalities of frontend-control applicati functionon', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('C-control.json').then((data) => {
      this.data = data
    })
  })

  it('Create a new SC question to use it in a live quiz', function () {
    cy.loginLecturer()

    // create single choice question for use in test live quiz
    cy.createQuestionSC({
      title: this.data.questionTitle,
      content: this.data.questionContent,
      choices: [{ content: '50%' }, { content: '100%' }],
    })
  })

  it('Create a new live quiz with the SC question', function () {
    cy.loginLecturer()

    // create live quiz with single choice question
    cy.createLiveQuiz({
      name: this.data.quizName,
      displayName: this.data.quizDisplayName,
      blocks: [
        {
          elements: [this.data.questionTitle],
        },
      ],
    })

    // check if the creation was successful
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.contains('[data-cy="live-quiz-block"]', this.data.quizName)
  })

  it('Generate a token to log into the control-frontend application, execute quiz', function () {
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
    cy.get(`[data-cy="ppt-link-${this.data.quizName}"]`).should('exist').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.findByText(this.data.quizName).click()
    cy.get('[data-cy="confirm-start-live-quiz"]').click()

    // test the mobile menu of the control app
    cy.viewport('iphone-6')
    cy.get('[data-cy="ppt-button"]').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.get('[data-cy="home-button"]').click()
    cy.get('[data-cy="unassigned-live-quizzes"]').click()
    cy.findByText(this.data.quizName).click()
    cy.get('[data-cy="back-button"]').click()
    cy.findByText(this.data.quizName).click()
    cy.viewport('macbook-16')

    // open and close block, end the quiz
    cy.get('[data-cy="activate-next-block"]').click()
    cy.get('[data-cy="deactivate-block"]').click()
    cy.get('[data-cy="end-live-quiz"]').click()
    cy.findByText(this.data.quizName).should('not.exist')
  })

  // TODO (later): check if quiz is running correctly / add student answer
})
