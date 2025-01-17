import messages from '../../../packages/i18n/messages/en'

// compute current year dynamically to ensure continued functionality
const currentYear = new Date().getFullYear()
const mlStartDate = `${currentYear}-01-01T02:00`
const mlEndDate = `${currentYear}-12-31T18:00`

describe('Test bookmarking and flagging workflows for practice quizzes and microlearnings', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('I-bookmarking.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 0: Preparation - Question Creation
  it('Creates the questions that should be bookmarked and/or flagged', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      title: this.data.question1.title,
      content: this.data.question1.content,
      choices: this.data.question1.choices,
    })

    cy.createQuestionMC({
      title: this.data.question2.title,
      content: this.data.question2.content,
      choices: this.data.question2.choices,
    })
  })

  // ! Part 1: Activity Creation
  it('Create a practice quiz with the created questions', function () {
    cy.loginLecturer()
    cy.createPracticeQuiz({
      name: this.data.PQ.name,
      displayName: this.data.PQ.displayName,
      courseName: this.data.course,
      stacks: [
        { elements: [this.data.question1.title] },
        { elements: [this.data.question2.title] },
      ],
    })
  })

  it('Create a microlearning with the created questions', function () {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: this.data.ML.name,
      displayName: this.data.ML.displayName,
      courseName: this.data.course,
      startDate: mlStartDate,
      endDate: mlEndDate,
      stacks: [
        { elements: [this.data.question1.title, this.data.question2.title] },
      ],
    })
  })

  // ! Part 2: Flagging and Voting on Practice Quiz
  it('Publish the practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.PQ.name}"]`).contains(
      messages.shared.generic.draft
    )
    cy.get(`[data-cy="publish-practice-quiz-${this.data.PQ.name}"]`).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.PQ.name}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Test flagging and student feedback functionalities on practice quiz', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.PQ.displayName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(this.data.PQ.flag1)
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.PQ.flag1
    )
    cy.get('[data-cy="flag-element-textarea"]').clear().type(this.data.PQ.flag2)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.get('[data-cy="upvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="downvote-element-0-button"]').click()
    cy.wait(500)
  })

  it('Bookmark the second element stack in the practice quiz', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.PQ.displayName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="bookmark-element-stack"]').click()
  })

  it('Verify that the bookmarking action was successful', function () {
    cy.loginStudent()
    cy.get('[data-cy="bookmarks"]').click()
    cy.wait(500)
    cy.get(`[data-cy="bookmarks-course-${this.data.course}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.findByText(this.data.question2.content).should('exist')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
  })

  it('Verify that removing the bookmarking works as expected', function () {
    cy.loginStudent()

    // remove the bookmark
    cy.get('[data-cy="bookmarks"]').click()
    cy.get(`[data-cy="bookmarks-course-${this.data.course}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="bookmark-element-stack"]').click()

    // go back to the home screen and check if the bookmark was removed
    cy.get('[data-cy="header-home"]').click()
    cy.reload()
    cy.get('[data-cy="bookmarks"]').click()
    cy.get(`[data-cy="bookmarks-course-${this.data.course}"]`).click()
    cy.findByText(messages.pwa.courses.noBookmarksSet).should('exist')
  })

  it('Cleanup: Delete the created practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-actions-${this.data.PQ.name}"]`).click()
    cy.get(`[data-cy="delete-practice-quiz-${this.data.PQ.name}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="practice-quiz-actions-${this.data.PQ.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup (DB): Hard delete soft-deleted practice quiz (with results) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedPracticeQuiz', {
      quizName: this.data.PQ.name,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted practice quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  it("Verify that the practice quiz is no longer visible on the student's view", function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.PQ.displayName}"]`).should(
      'not.exist'
    )
  })

  // ! Part 3: Flagging and Voting on Microlearning
  it('Publish the microlearning', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${this.data.ML.name}"]`).contains(
      messages.shared.generic.draft
    )
    cy.get(`[data-cy="publish-microlearning-${this.data.ML.name}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${this.data.ML.name}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Test flagging and student feedback functionalities on microlearning', function () {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${this.data.ML.displayName}"]`).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(this.data.ML.flag1)
    cy.get('[data-cy="cancel-flag-element"]').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(this.data.ML.flag1)
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
    cy.get('[data-cy="upvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="downvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.ML.flag1
    )
    cy.get('[data-cy="flag-element-textarea"]').clear().type(this.data.ML.flag2)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.ML.flag2
    )
    cy.get('[data-cy="cancel-flag-element"]').click()

    // solve the microlearning
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="finish-microlearning"]').click()
  })

  it('Cleanup: Delete the created microlearning', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${this.data.ML.name}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${this.data.ML.name}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${this.data.ML.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup (DB): Hard delete soft-deleted microlearning (with feedbacks) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedMicrolearning', {
      mlName: this.data.ML.name,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted microlearning with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  it('Cleanup: Delete all created questions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    const questions = [this.data.question1.title, this.data.question2.title]

    cy.wrap(questions).each((title: string) => {
      cy.get(`[data-cy="delete-question-${title}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })
  })

  it("Verify that the microlearning is no longer visible on the student's view", function () {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${this.data.ML.displayName}"]`).should(
      'not.exist'
    )
  })
})
