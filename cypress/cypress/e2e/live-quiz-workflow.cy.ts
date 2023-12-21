import messages from '../../../packages/i18n/messages/en'

describe('Different live-quiz workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('adds and then deletes a second question block', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const sessionName = 'Test Session ' + randomNumber
    const session = 'Displayed Test Session Name ' + randomNumber

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
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice ' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const sessionName = 'Test Session ' + randomNumber
    const session = 'Displayed Test Session Name ' + randomNumber

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
    cy.get('[data-cy="question-block"]')
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
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice ' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const sessionName = 'Test Session ' + randomNumber
    const session = 'Displayed Test Session Name ' + randomNumber

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
    cy.get('[data-cy="question-block"]')
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
    const randomNumber = Math.round(Math.random() * 1000)
    const session = 'Displayed Name ' + randomNumber
    const sessionName = 'Test Session ' + randomNumber
    const questionTitle = 'A Single Choice ' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber

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
      .contains(messages.manage.sessionForms.liveSessionNoCourse)
    cy.get('[data-cy="select-course"]')
      .click()
      .siblings()
      .eq(0)
      .findByText('Testkurs')
      .parent()
      .click()
    cy.get('[data-cy="select-course"]').contains('Testkurs')
    cy.get('[data-cy="set-gamification"]').should('not.be.checked')
    cy.get('[data-cy="set-gamification"]').click()
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier1)
    cy.get('[data-cy="select-multiplier"]')
      .click()
      .siblings()
      .eq(0)
      .findByText(messages.manage.sessionForms.multiplier2)
      .parent()
      .click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier2
    )
    // cy.get('[data-cy="set-gamification"]').should('be.checked'); // TODO: This does not work properly as it should be checked after a click
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get('[data-cy="question-block"]')
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
      cy.get('[data-cy="question-block"]')
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
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // login student again on mobile, test navigation and answer second question
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.viewport('iphone-x')
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)
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
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // repeat student actions on mobile device and answer second question
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('iphone-x')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)
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
})
