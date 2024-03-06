import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

describe('Different live-quiz workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('adds and then deletes a second question block', () => {
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
    cy.get('[data-cy="add-block"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 2)
    cy.get('[data-cy="delete-block"]').eq(1).click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
  })

  it('creates a session with one block', () => {
    const questionTitle = uuid()
    const question = uuid()
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

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

    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName)
  })

  it('creates a session, starts it and aborts it and then restarts it', () => {
    const questionTitle = uuid()
    const question = uuid()
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

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

    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName)

    // start session and then abort it
    cy.get(`[data-cy="start-session-${sessionName}"]`).click()
    cy.get('[data-cy="abort-session-cockpit"]').click()
    cy.get('[data-cy="abort-cancel-session"]').click()
    cy.get('[data-cy="abort-session-cockpit"]').click()
    cy.get('[data-cy="confirm-cancel-session"]').click()

    // start session and then skip through the blocks
    cy.get(`[data-cy="start-session-${sessionName}"]`).click()
    cy.get('[data-cy="interaction-first-block"]').click()
    cy.get('[data-cy="interaction-first-block"]').click()
    cy.get('[data-cy="interaction-first-block"]').click()
  })

  it('shows a possible workflow of running a session and answering questions', () => {
    const session = uuid()
    const sessionName = uuid()
    const questionTitle = uuid()
    const question = uuid()
    const courseName = 'Testkurs'

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('25%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // step 1
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseName)
    cy.get('[data-cy="set-gamification"]').should('not.be.checked')
    cy.get('[data-cy="set-gamification"]').click()
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
    // cy.get('[data-cy="set-gamification"]').should('be.checked'); // TODO: This does not work properly as it should be checked after a click
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

    cy.get('[data-cy="add-block"]').click()
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here"]').eq(1).trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="session"]').contains(sessionName)

    // start session and first block
    cy.get(`[data-cy="start-session-${sessionName}"]`).click()
    cy.get('[data-cy="interaction-first-block"]').click()

    // login student and answer first question
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // login student again on mobile, test navigation and answer second question
    cy.viewport('iphone-x')
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText(question).should('exist')

    // TODO: test feedback mechanism (including lecturer response, publishing, moderation, etc.)
    cy.get('[data-cy="mobile-menu-leaderboard"]').click()
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="mobile-menu-questions"]').click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.loginLecturer()

    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.wait(1000)

    // close first block
    cy.get('[data-cy="interaction-first-block"]').click()
    cy.wait(500)
    // start next block
    cy.get('[data-cy="interaction-first-block"]').click()
    cy.wait(500)

    // login student and answer first question
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // repeat student actions on mobile device and answer second question
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.loginLecturer()

    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="interaction-first-block"]').click()

    cy.url().then((url) => {
      const sessionIdEvaluation = url.split('/')[4]
      cy.visit(
        Cypress.env('URL_MANAGE') +
          '/sessions/' +
          sessionIdEvaluation +
          '/evaluation'
      )
    })

    // TODO: bugfix: evaluation is broken - does not fetch any answers. Once fixed, write better checks
    //  cy.get('[data-cy="session-total-participants"]').should('have.text', 'Total Teilnehmende: 1');
    //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
    cy.get('[data-cy="evaluate-next-question"]').click()
    //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
    //   cy.get('[data-cy="evaluate-next-question"]').click();
    //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
  })

  it('creates a live quiz without questions and tests the feedback mechanisms', () => {
    const courseName = 'Testkurs'
    const questionTitle = uuid()
    const question = uuid()
    const sessionName = uuid()

    // create a question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a live quiz with a single question
    // TODO - once this is possible, create an empty live quiz here
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="insert-live-display-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseName)
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

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
    cy.get('[data-cy="quick-start"]').click()

    // test feedback submission with moderation enabled, does not show up until published
    const feedback1 = 'Feedback during moderation enabled'
    cy.loginStudent()
    cy.clearAllLocalStorage()
    cy.findByText(sessionName).click()

    cy.get('[data-cy="feedback-input"]').type(feedback1)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedback1).should('not.exist')

    // check that feedback is visible to lecturer and switch its status to visible
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback1}"]`).should('exist').click()
    cy.get(`[data-cy="pin-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="pin-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="publish-feedback-${feedback1}"]`).click()
    cy.wait(1000)

    // check if feedback is now visible
    cy.loginStudent()
    cy.reload()
    cy.findByText(sessionName).click()
    cy.findByText(feedback1).should('exist')

    // login to lecturer and disable moderation
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get('[data-cy="toggle-moderation"]').click()

    // submit second feedback and check if it is immediately visible
    const feedback2 = 'Feedback without moderation'
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.get('[data-cy="feedback-input"]').type(feedback2)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedback2).should('exist')

    // upvote both first and second feedback
    cy.get(`[data-cy="feedback-upvote-${feedback1}"]`).click()
    cy.get(`[data-cy="feedback-upvote-${feedback2}"]`).click()

    // login to lecturer and answer second feedback
    const feedbackAnswer = 'Answer to feedback'
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback2}"]`).should('exist').click()
    cy.get(`[data-cy="respond-to-feedback-${feedback2}"]`).type(feedbackAnswer)
    cy.get(`[data-cy="submit-feedback-response-${feedback2}"]`).click()

    // check on student view that feedback answer is visible
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.findByText(feedbackAnswer).should('exist')
    cy.get(`[data-cy="feedback-response-upvote-${feedbackAnswer}"]`).click()

    // login to lecturer and pin feedback, check lecturer display
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback1}"]`).should('exist').click()
    cy.get(`[data-cy="pin-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="open-lecturer-overview-session-${sessionName}"]`).click()
    cy.findByText(feedback1).should('exist')
    cy.findByText(feedback2).should('not.exist')

    // delete feedback response
    cy.visit(Cypress.env('URL_MANAGE'))
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback2}"]`).should('exist').click()
    cy.get(`[data-cy="delete-response-${feedbackAnswer}"]`).click()
    cy.get(`[data-cy="delete-response-${feedbackAnswer}"]`).click()

    // check on student frontend that deleted feedback is no longer visible
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.findByText(feedbackAnswer).should('not.exist')

    // delete feedback
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="delete-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="delete-feedback-${feedback1}"]`).click()

    // check on student frontend that deleted feedback is no longer visible
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.findByText(feedback1).should('not.exist')
  })
})
