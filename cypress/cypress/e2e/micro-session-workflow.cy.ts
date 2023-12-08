import messages from '../../../packages/i18n/messages/en'

describe('Different micro-session workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('creates and publishes a micro session that should be visible to students', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Micro-Session ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    //
    // create a micro-session
    cy.get('[data-cy="create-micro-session"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-micro-session"]').click()

    // step 1
    cy.get('[data-cy="insert-micro-session-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-micro-session-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-micro-session-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]')
      .click()
      .siblings()
      .eq(0)
      .findByText('Testkurs')
      .parent()
      .click()
    cy.get('[data-cy="select-course"]').should('exist').contains('Testkurs')
    cy.get('[data-cy="select-start-date"]').click().type('2023-01-01T18:00')
    cy.get('[data-cy="select-end-date"]').click().type('2023-12-31T18:00')
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
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="micro-session"]').contains(microSessionName)
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.draft)

    // publish a micro-session
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-micro-session-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicroSession)
      .click()
    cy.get('[data-cy="verify-publish-action"]').click()
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.published)

    // sign in as student on a laptop and respond to one question
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains('[data-cy="micro-learnings"]', microSessionDisplayName).should(
      'exist'
    )
    cy.findByText(microSessionDisplayName).click()
    cy.get('[data-cy="start-micro-session"]').click()
    cy.get('[data-cy="choice-option"]').eq(0).click()
    cy.get('[data-cy="send-answer"]').click()

    // sign in as a student on a mobile device and respond to the first question
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('iphone-x')
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains('[data-cy="micro-learnings"]', microSessionDisplayName).should(
      'exist'
    )
    cy.findByText(microSessionDisplayName).click()
    cy.get('[data-cy="start-micro-session"]').click()
    cy.get('[data-cy="choice-option"]').eq(0).click()
    cy.get('[data-cy="send-answer"]').click()
    cy.viewport('macbook-16')
  })

  it('creates and publishes a future micro session that should not be visible to students and tests unpublishing it', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Micro-Session ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a micro-session
    cy.get('[data-cy="create-micro-session"]').click()

    // step 1
    cy.get('[data-cy="insert-micro-session-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-micro-session-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-micro-session-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]')
      .click()
      .siblings()
      .eq(0)
      .findByText('Testkurs')
      .parent()
      .click()
    cy.get('[data-cy="select-course"]').should('exist').contains('Testkurs')
    cy.get('[data-cy="select-start-date"]').click().type('2024-01-01T18:00')
    cy.get('[data-cy="select-end-date"]').click().type('2024-12-31T18:00')
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
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
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
    cy.get('[data-cy="micro-session"]').contains(microSessionName)
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.draft)

    // publish a micro-session
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-micro-session-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicroSession)
      .click()
    cy.get('[data-cy="verify-publish-action"]').click()
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.published)

    // sign in as student
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains('[data-cy="micro-learnings"]', microSessionDisplayName).should(
      'not.exist'
    )

    // switch back to the lecturer and unpublish the micro session
    cy.clearAllCookies()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText('Testkurs').click()
    cy.findByText(microSessionName)
    cy.get(`[data-cy="unpublish-micro-session-${microSessionName}"]`)
      .contains(messages.manage.course.unpublishMicroSession)
      .click()
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.draft)
  })

  it('creates and publishes a past micro session that should not be visible to students', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Micro-Session ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a micro-session
    cy.get('[data-cy="create-micro-session"]').click()

    // step 1
    cy.get('[data-cy="insert-micro-session-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-micro-session-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-micro-session-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]')
      .click()
      .siblings()
      .eq(0)
      .findByText('Testkurs')
      .parent()
      .click()
    cy.get('[data-cy="select-course"]').should('exist').contains('Testkurs')
    cy.get('[data-cy="select-start-date"]').click().type('2021-01-01T18:00')
    cy.get('[data-cy="select-end-date"]').click().type('2021-12-31T18:00')
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
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
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
    cy.get('[data-cy="micro-session"]').contains(microSessionName)
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.draft)

    // publish a micro-session
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-micro-session-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicroSession)
      .click()
    cy.get('[data-cy="verify-publish-action"]').click()
    cy.findByText(microSessionName)
      .parentsUntil('[data-cy="micro-session"]')
      .contains(messages.shared.generic.published)

    // sign in as student
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains('[data-cy="micro-learnings"]', microSessionDisplayName).should(
      'not.exist'
    )
  })
})
