import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

const testCourse = 'Testkurs'
const currentYear = new Date().getFullYear()

const questionTitle1 = uuid()
const questionTitle2 = uuid()
const questionContent1 = 'Question Content 1'
const questionContent2 = 'Question Content 2'

const practiceQuizName = 'Bookmarking practice quiz'
const practiceQuizDisplayName = practiceQuizName + ' (Display)'
const flagPQ1 = `Test flagging question on practice quiz ${practiceQuizName}`
const flagPQ2 = `Test flagging question on practice quiz ${practiceQuizName} new`

const microlearningName = 'Bookmarking microlearning'
const microlearningDisplayName = microlearningName + ' (Display)'
const microStartDate = `${currentYear}-01-01T02:00`
const microEndDate = `${currentYear}-12-31T18:00`
const microMutliplier = messages.manage.sessionForms.multiplier2
const flagML1 = `Test flagging question on microlearning ${microlearningName}`
const flagML2 = `Test flagging question on microlearning ${microlearningName} new`

describe('Test bookmarking and flagging workflows for practice quizzes and microlearnings', () => {
  // ! Part 0: Preparation - Question Creation
  it('Creates the questions that should be bookmarked and/or flagged', () => {
    cy.loginLecturer()
    cy.createQuestionSC({
      title: questionTitle1,
      content: questionContent1,
      choices: [
        { content: '50%', correct: true },
        { content: '100%' },
        { content: '75%' },
      ],
    })

    cy.createQuestionMC({
      title: questionTitle2,
      content: questionContent2,
      choices: [
        { content: '30%', correct: true },
        { content: '60%' },
        { content: '90%', correct: true },
      ],
    })
  })

  // ! Part 1: Activity Creation
  it('Create a practice quiz with the created questions', () => {
    cy.loginLecturer()
    cy.createPracticeQuiz({
      name: practiceQuizName,
      displayName: practiceQuizDisplayName,
      courseName: testCourse,
      stacks: [{ elements: [questionTitle1] }, { elements: [questionTitle2] }],
    })
  })

  it('Create a microlearning with the created questions', () => {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: microlearningName,
      displayName: microlearningDisplayName,
      courseName: testCourse,
      startDate: microStartDate,
      endDate: microEndDate,
      multiplier: microMutliplier,
      stacks: [{ elements: [questionTitle1, questionTitle2] }],
    })
  })

  // ! Part 2: Flagging and Voting on Practice Quiz
  it('Publish the practice quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName}"]`).contains(
      messages.shared.generic.draft
    )
    cy.get(`[data-cy="publish-practice-quiz-${practiceQuizName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Test flagging and student feedback functionalities on practice quiz', () => {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(flagPQ1)
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should('have.value', flagPQ1)
    cy.get('[data-cy="flag-element-textarea"]').clear().type(flagPQ2)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.get('[data-cy="upvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="downvote-element-0-button"]').click()
    cy.wait(500)
  })

  it('Bookmark the second element stack in the practice quiz', () => {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="bookmark-element-stack"]').click()
  })

  it('Verify that the bookmarking progress was successful', () => {
    cy.loginStudent()
    cy.get('[data-cy="bookmarks"]').click()
    cy.wait(500)
    cy.get(`[data-cy="bookmarks-course-${testCourse}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.findByText(questionContent2).should('exist')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
  })

  it('Verify that removing the bookmarking works as expected', () => {
    cy.loginStudent()

    // remove the bookmark
    cy.get('[data-cy="bookmarks"]').click()
    cy.get(`[data-cy="bookmarks-course-${testCourse}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="bookmark-element-stack"]').click()

    // go back to the home screen and check if the bookmark was removed
    cy.get('[data-cy="header-home"]').click()
    cy.reload()
    cy.get('[data-cy="bookmarks"]').click()
    cy.get(`[data-cy="bookmarks-course-${testCourse}"]`).click()
    cy.findByText(messages.pwa.courses.noBookmarksSet).should('exist')
  })

  it('Cleanup: Delete the created practice quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-actions-${practiceQuizName}"]`).click()
    cy.get(`[data-cy="delete-practice-quiz-${practiceQuizName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="practice-quiz-actions-${practiceQuizName}"]`).should(
      'not.exist'
    )
  })

  it("Verify that the practice quiz is no longer visible on the student's view", () => {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName}"]`).should(
      'not.exist'
    )
  })

  // ! Part 3: Flagging and Voting on Microlearning
  it('Publish the microlearning', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microlearningName}"]`).contains(
      messages.shared.generic.draft
    )
    cy.get(`[data-cy="publish-microlearning-${microlearningName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microlearningName}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Test flagging and student feedback functionalities on microlearning', () => {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${microlearningDisplayName}"]`).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(flagML1)
    cy.get('[data-cy="cancel-flag-element"]').click()
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(flagML1)
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
    cy.get('[data-cy="upvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="downvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should('have.value', flagML1)
    cy.get('[data-cy="flag-element-textarea"]').clear().type(flagML2)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-0-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should('have.value', flagML2)
    cy.get('[data-cy="cancel-flag-element"]').click()

    // solve the microlearning
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="finish-microlearning"]').click()
  })

  it('Cleanup: Delete the created microlearning', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${microlearningName}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${microlearningName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${microlearningName}"]`).should(
      'not.exist'
    )
  })

  it("Verify that the microlearning is no longer visible on the student's view", () => {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${microlearningDisplayName}"]`).should(
      'not.exist'
    )
  })
})
