describe('Test functionalities of frontend-control application', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('C-control.json').then((data) => {
      this.data = data
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  it('Create a live quiz with a new SC question to test execution from control app', function () {
    cy.loginLecturer()

    // create single choice question for use in test live quiz
    cy.createQuestionSC({
      name: this.data.questionTitle,
      content: this.data.questionContent,
      choices: [{ value: '50%' }, { value: '100%' }],
      userId: Cypress.env('LECTURER_ID'),
    })

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
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.quizName}"]`).should(
      'exist'
    )
  })

  it('Log in as the lecturer in the control application and test different screen sizes', function () {
    cy.loginLecturerControl()

    // check ppt links and start the quiz
    cy.get('[data-cy="unassigned-live-quizzes"]').click()
    cy.get(`[data-cy="ppt-link-${this.data.quizName}"]`).should('exist').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.get(`[data-cy="start-live-quiz-${this.data.quizName}"]`).click()
    cy.get('[data-cy="confirm-start-live-quiz"]').click()

    // test the mobile menu of the control app
    cy.viewport('iphone-6')
    cy.get('[data-cy="ppt-button"]').click()
    cy.get('[data-cy="close-embedding-modal"]').click()
    cy.get('[data-cy="home-button"]').click()
    cy.get('[data-cy="unassigned-live-quizzes"]').click()
    cy.get(`[data-cy="running-live-quiz-${this.data.quizName}"]`).click()
    cy.get('[data-cy="back-button"]').click()
    cy.get(`[data-cy="running-live-quiz-${this.data.quizName}"]`).click()
    cy.viewport('macbook-16')

    // open and close block, end the quiz
    cy.get('[data-cy="activate-next-block"]').click()
    cy.get('[data-cy="deactivate-block"]').click()
    cy.get('[data-cy="end-live-quiz"]').click()
    cy.get(`[data-cy="start-live-quiz-${this.data.quizName}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="running-live-quiz-${this.data.quizName}"]`).should(
      'not.exist'
    )
  })

  // ! Cleanup
  it('Cleanup: Delete the created and completed live quiz', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click()

    cy.get(`[data-cy="activity-LIVE_QUIZ-${this.data.quizName}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.quizName}"]`).realClick()
    cy.get(`[data-cy="delete-live-quiz-${this.data.quizName}"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.quizName).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedLiveQuiz', {
      lqName: this.data.quizName,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  // TODO (later): check if quiz is running correctly / add student answer
})
