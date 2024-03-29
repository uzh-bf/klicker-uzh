import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

describe('Question bookmarking and flagging workflow', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('creates two new questions, adds them to a practice quiz and microlearning and bookmarks them', () => {
    const questionTitle = uuid()
    const questionTitle2 = uuid()
    const question = uuid()
    const question2 = uuid()
    const courseName = 'Testkurs'
    const quizName = uuid()
    const microlearningName = uuid()

    // create first question in question pool
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create second question in question pool
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle2)
    cy.get('[data-cy="insert-question-text"]').click().type(question2)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('30%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('60%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create practice quiz with first question
    // step 1
    cy.get('[data-cy="create-practice-quiz"]').click()
    cy.get('[data-cy="insert-practice-quiz-name"]').type(quizName)
    cy.get('[data-cy="insert-practice-quiz-display-name"]').type(quizName)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="next-or-submit"]').click({ force: true })

    // step 3
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="create-new-element"]').click()
    cy.get('[data-cy="cancel-session-creation"] > div').click()

    // create microlearning with second question
    const currentYear = new Date().getFullYear()
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microlearningName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microlearningName)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]')
      .click({ force: true })
      .type(`${currentYear}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear}-12-31T18:00`)
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
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle2}"]`)
      .contains(questionTitle2)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer2,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    // publish both practice quiz and microlearning
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${quizName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish both practice quiz and microlearning
    cy.get(`[data-cy="publish-practice-quiz-${quizName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="practice-quiz-${quizName}"]`).contains(
      messages.shared.generic.published
    )

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microlearningName}"]`).contains(
      messages.shared.generic.draft
    )
    cy.get(`[data-cy="publish-microlearning-${microlearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microlearningName}"]`).contains(
      messages.shared.generic.published
    )

    // sign in as student on a laptop and bookmark the questions
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    // test flagging for microlearnings
    cy.get(`[data-cy="microlearning-${microlearningName}"]`).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="flag-element-button"]').click()
    cy.get('[data-cy="submit-flag-element"').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"').type(
      `Test flagging question on microlearning ${microlearningName}`
    )
    // TODO - actually submit the flagging once adding notification emails is available
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="cancel-flag-element"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(1000)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="finish-microlearning"]').click()

    // test bookmarking and flagging for practice quizzes
    // TODO: adapt bookmarking to custom created practice quiz instead of seed-based solution
    const quizNameTestSeed = 'Practice Quiz Demo Student Title'
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${quizNameTestSeed}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    cy.get('[data-cy="bookmark-element-stack"]').click()
    cy.get('[data-cy="flag-element-button"]').click()
    cy.get('[data-cy="submit-flag-element"').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"').type(
      `Test flagging question on practice quiz ${quizNameTestSeed}`
    )
    // TODO - actually submit the flagging once adding notification emails is available
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="cancel-flag-element"]').click()

    // open the bookmarks of the test course and check if the marked questions appear
    cy.get('[data-cy="header-home"]').click()
    cy.get('[data-cy="bookmarks"]').click()
    cy.wait(1000)
    cy.get(`[data-cy="bookmarks-course-${courseName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    // TODO: reintroduce once test-seed dependency is resolved
    // cy.get(`[data-cy="element-instance-header-${questionTitle}"]`).should(
    //   'exist'
    // )
  })
})
