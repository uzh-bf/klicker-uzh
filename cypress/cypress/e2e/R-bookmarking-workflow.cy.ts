import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString } from './helpers'

describe('Test bookmarking and flagging workflows for practice quizzes and microlearnings', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('R-bookmarking.json').then((data) => {
      this.data = data
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  // ! Part 0: Preparation - Question Creation
  // #region
  it('Creates the questions that should be bookmarked and/or flagged', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.question1.title,
      content: this.data.question1.content,
      choices: this.data.question1.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createQuestionMC({
      name: this.data.question2.title,
      content: this.data.question2.content,
      choices: this.data.question2.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
  })
  // #endregion

  // ! Part 1: Activity Creation
  // #region
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
      startDate: {
        monthDelta: -2,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      stacks: [
        { elements: [this.data.question1.title, this.data.question2.title] },
      ],
    })
  })
  // #endregion

  // ! Part 2: Flagging and Voting on Practice Quiz
  // #region
  it('Publish the practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="publish-practice-quiz-${this.data.PQ.name}"]`).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
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
    cy.wait(4000) // wait for toast to disappear (blocks button)
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.PQ.flag1
    )
    cy.get('[data-cy="flag-element-textarea"]').clear().type(this.data.PQ.flag2)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(4000) // wait for toast to disappear (blocks button)
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
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
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
    cy.get('[data-cy="mc-0-answer-option-1"]').click()
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
    cy.get(`[data-cy="actions-PRACTICE_QUIZ-${this.data.PQ.name}"]`).click()
    cy.get(`[data-cy="delete-practice-quiz-${this.data.PQ.name}"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="actions-PRACTICE_QUIZ-${this.data.PQ.name}"]`).should(
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
  // #endregion

  // ! Part 3: Flagging and Voting on Microlearning
  // #region
  it('Publish the microlearning', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="publish-microlearning-${this.data.ML.name}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
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
    cy.wait(4000) // wait for toast to disappear (blocks button)
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
    cy.wait(4000) // wait for toast to disappear (blocks button)
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.ML.flag2
    )
    cy.get('[data-cy="cancel-flag-element"]').click()

    // solve the microlearning
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
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
    cy.get(`[data-cy="actions-MICRO_LEARNING-${this.data.ML.name}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${this.data.ML.name}"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="actions-MICRO_LEARNING-${this.data.ML.name}"]`).should(
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

  it("Verify that the microlearning is no longer visible on the student's view", function () {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${this.data.ML.displayName}"]`).should(
      'not.exist'
    )
  })
  // #endregion
})
