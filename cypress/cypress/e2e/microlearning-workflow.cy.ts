import messages from '../../../packages/i18n/messages/en'

describe('Different microlearning workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  // get current year
  const currentYear = new Date().getFullYear()

  it('creates and publishes a micro learning that should be visible to students', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Microlearning ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber
    const courseName = 'Testkurs'

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
    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]')
      .click()
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
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      microSessionName
    )
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.published
    )

    // TODO: replace by new response workflows
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

    cy.contains('[data-cy="microlearnings"]', microSessionDisplayName).should(
      'exist'
    )
    cy.findByText(microSessionDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="send-answer"]').click()

    // TODO: replace by new response workflows
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

    cy.contains('[data-cy="microlearnings"]', microSessionDisplayName).should(
      'exist'
    )
    cy.findByText(microSessionDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()

    cy.get('[data-cy="send-answer"]').click()
    cy.viewport('macbook-16')
  })

  it('creates and publishes a future micro learning that should not be visible to students and tests unpublishing it', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Microlearning ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber
    const courseName = 'Testkurs'

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

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]')
      .click()
      .type(`${currentYear + 1}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear + 1}-12-31T18:00`)
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
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      microSessionName
    )
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.published
    )

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

    cy.contains('[data-cy="microlearnings"]', microSessionDisplayName).should(
      'not.exist'
    )

    // switch back to the lecturer and unpublish the micro learning
    cy.clearAllCookies()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()
    cy.findByText(microSessionName)
    cy.get(`[data-cy="unpublish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.unpublishMicrolearning)
      .click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('creates and publishes a past micro learning that should not be visible to students', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Microlearning ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber
    const courseName = 'Testkurs'

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

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear - 1}-12-31T18:00`)
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
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      microSessionName
    )
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.published
    )

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

    cy.contains('[data-cy="microlearnings"]', microSessionDisplayName).should(
      'not.exist'
    )
  })

  it('creates and edits a micro learning, which should then be accessible by students', () => {
    const randomNumber = Math.round(Math.random() * 1000)
    const questionTitle = 'A Single Choice with solution' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber
    const microSessionName = 'Test Microlearning ' + randomNumber
    const microSessionDisplayName = 'Displayed Name ' + randomNumber
    const description = 'This is the official descriptioin of ' + randomNumber
    const courseName = 'Testkurs'

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

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microSessionName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microSessionDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]')
      .click()
      .type(`${currentYear + 1}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear + 1}-12-31T18:00`)
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
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      microSessionName
    )
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.published
    )

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

    cy.contains('[data-cy="microlearnings"]', microSessionDisplayName).should(
      'not.exist'
    )

    // switch back to the lecturer and unpublish the micro learning
    cy.clearAllCookies()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()
    cy.findByText(microSessionName)
    cy.get(`[data-cy="unpublish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.unpublishMicrolearning)
      .click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )

    // edit the micro learning
    cy.findByText(microSessionName)
    cy.get(`[data-cy="edit-microlearning-${microSessionName}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearnings).should(
      'exist'
    )

    // check if the first page of the edit form are shown correctly
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', microSessionName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', microSessionDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // check if correct values are in the form and rename it
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]')
      .click()
      .should('have.value', `${currentYear + 1}-01-01T02:00`)
      .type(`${currentYear}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .should('have.value', `${currentYear + 1}-12-31T18:00`)
      .type(`${currentYear}-12-31T18:00`)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier2)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier4
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // add another question to the microlearning
    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer2,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="load-session-list"]').click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      microSessionName
    )
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish the microlearning
    cy.findByText(microSessionName)
    cy.get(`[data-cy="publish-microlearning-${microSessionName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microSessionName}"]`).contains(
      messages.shared.generic.published
    )

    // TODO: replace by new response workflows
    // sign in as student on a laptop and respond to both
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains('[data-cy="microlearnings"]', microSessionDisplayName).should(
      'exist'
    )
    cy.findByText(microSessionDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()

    cy.wait(500)
    cy.get('[data-cy="send-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="send-answer"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()

    cy.get('[data-cy="send-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="send-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="finish-microlearning"]').click()
  })

  it('respond to a microlearning with all element types', () => {
    const seedMicrolearningDisplayName = 'Test Microlearning'

    cy.visit(Cypress.env('URL_STUDENT'))
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains(
      '[data-cy="microlearnings"]',
      seedMicrolearningDisplayName
    ).should('exist')
    cy.findByText(seedMicrolearningDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // answer stacks with single flashcards
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)

    // answer another stack with a single flashcard
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .should('not.be.disabled')
      .click()
    cy.wait(500)

    // answer remaining flashcards
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)

    // answer stack with all flashcards
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-2"]').click()
    cy.get('[data-cy="flashcard-response-2-Partially"]').click()
    cy.get('[data-cy="flashcard-front-3"]').click()
    cy.get('[data-cy="flashcard-response-3-No"]').click()
    cy.get('[data-cy="flashcard-front-4"]').click()
    cy.get('[data-cy="flashcard-response-4-Partially"]').click()
    cy.get('[data-cy="flashcard-front-5"]').click()
    cy.get('[data-cy="flashcard-response-5-Yes"]').click()
    cy.get('[data-cy="flashcard-front-6"]').click()
    cy.get('[data-cy="flashcard-response-6-Partially"]').click()
    cy.get('[data-cy="flashcard-front-7"]').click()
    cy.get('[data-cy="flashcard-response-7-No"]').click()
    cy.get('[data-cy="flashcard-front-8"]').click()
    cy.get('[data-cy="flashcard-response-8-Partially"]').click()
    cy.get('[data-cy="flashcard-front-9"]').click()
    cy.get('[data-cy="flashcard-response-9-Partially"]').click()
    cy.get('[data-cy="flashcard-front-10"]').click()
    cy.get('[data-cy="flashcard-response-10-Yes"]').click()
    cy.get('[data-cy="flashcard-front-11"]').click()
    cy.get('[data-cy="flashcard-response-11-Partially"]').click()
    cy.get('[data-cy="flashcard-front-12"]').click()
    cy.get('[data-cy="flashcard-response-12-No"]').click()
    cy.get('[data-cy="flashcard-front-13"]').click()
    cy.get('[data-cy="flashcard-response-13-No"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-14"]').click()
    cy.get('[data-cy="flashcard-response-14-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .should('not.be.disabled')
      .click()

    // answer free text question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type('Testinput')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="free-text-input-1"]').clear()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type('richtig')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer MC question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="mc-1-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer numerical question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('-20')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('-10')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('0')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').type('100')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer KPRIM question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer SC question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="sc-1-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer combined question stack
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type('richtig')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').clear().type('0')
    cy.get('[data-cy="input-numerical-3"]').clear().type('100')
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').click()
    cy.get('[data-cy="sc-5-answer-option-2"]').click()
    cy.get('[data-cy="sc-5-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer content elements (single and stacked)
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="read-content-element-2"]').click()
    cy.get('[data-cy="read-content-element-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // use automatic marking as read for second content element stack
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .click() // mark all as read
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .contains(messages.shared.generic.submit)
      .click() // submit responses and continue

    // answer combined stack with flashcard, content element and question
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="read-content-element-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').type('richtig')
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // answer combined stack with flashcard, content element and question
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .should('be.disabled') // contains mark all as read and is disabled
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="free-text-input-2"]').type('richtig')
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .should('not.be.disabled')
      .click() // contains mark all as read and click
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]')
      .contains(messages.shared.generic.finish)
      .click() // finish quiz

    // TODO: properly check content of evaluation page
    cy.findByText('Evaluation').should('exist')
  })
})
