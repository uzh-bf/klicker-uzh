import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

const questionTitle = uuid()
const question = uuid()
const practiceQuizName = uuid()
const practiceQuizDisplayName = uuid()
const description = uuid()

const practiceQuizName2 = uuid()
const practiceQuizDisplayName2 = uuid()
const description2 = uuid()
const courseName = 'Testkurs'

describe('Different practice quiz workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('Test creating and publishing a practice quiz', () => {
    // switch to question pool view
    cy.get('[data-cy="questions"]').click()

    // set up question with solution
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create practice quiz
    cy.get('[data-cy="create-practice-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-practice-quiz"]').click()

    // step 1
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .type(practiceQuizName)
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(practiceQuizDisplayName)
    cy.get('[data-cy="insert-practice-quiz-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    // TODO: fix course selection with select issue
    // cy.get('[data-cy="select-course"]').click()
    // cy.get(`[data-cy="select-course-${courseName}"]`).click()
    // cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier1)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier2}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier2
    )
    cy.get('[data-cy="insert-reset-time-days"]').clear().type('4')
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSEQUENTIAL}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish practice quiz
    cy.get(`[data-cy="publish-practice-quiz-${practiceQuizName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName}"]`).contains(
      messages.shared.generic.published
    )

    // sign in as student and answer practice quiz
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName}"]`)
      .contains(practiceQuizDisplayName)
      .click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .should('not.be.disabled')
      .click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // sign in as student on mobile and answer practice quiz again
    cy.viewport('iphone-x')
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName}"]`)
      .contains(practiceQuizDisplayName)
      .click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="practice-quiz-reset"]').click()

    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // navigate back to the home menu and then continue the practice quiz from step 2
    cy.get('[data-cy="mobile-menu-home"]').click()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName}"]`)
      .contains(practiceQuizDisplayName)
      .click()
    cy.get('[data-cy="practice-quiz-progress"]').children().eq(1).click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="mobile-menu-home"]').click()
    cy.viewport('macbook-16')
  })

  it('Test editing an existing practice quizs', () => {
    // switch back to question pool view
    cy.get('[data-cy="questions"]').click()

    // create practice quiz
    cy.get('[data-cy="create-practice-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-practice-quiz"]').click()

    // step 1
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .type(practiceQuizName2)
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(practiceQuizDisplayName2)
    cy.get('[data-cy="insert-practice-quiz-description"]')
      .click()
      .type(description2)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    // TODO: fix course selection with select issue
    // cy.get('[data-cy="select-course"]').click()
    // cy.get(`[data-cy="select-course-${courseName}"]`).click()
    // cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier1)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier2}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier2
    )
    cy.get('[data-cy="insert-reset-time-days"]').clear().type('4')
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSEQUENTIAL}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName2}"]`).contains(
      messages.shared.generic.draft
    )

    // go to course overview and look for practice quiz with corresponding title
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()

    // start editing the practice quiz
    cy.get(`[data-cy="edit-practice-quiz-${practiceQuizName2}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // change the multiplier to 4, reset time to 10 days and order to sequential
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier2)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier4)
    cy.get('[data-cy="insert-reset-time-days"]')
      .should('have.value', '4')
      .clear()
      .type('10')
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="next-or-submit"]').click()

    // add the question two further times
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName2}"]`).contains(
      messages.shared.generic.draft
    )

    // check if the practice quiz contains the correct number of questions
    cy.get(
      `[data-cy="practice-quiz-num-of-questions-${practiceQuizName2}"]`
    ).should('contain', '4 questions')

    // publish practice quiz
    cy.get(`[data-cy="publish-practice-quiz-${practiceQuizName2}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName2}"]`).contains(
      messages.shared.generic.published
    )

    // sign in as student and answer practice quiz
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName2}"]`)
      .contains(practiceQuizDisplayName2)
      .click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.findByText('50%').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
  })
})
