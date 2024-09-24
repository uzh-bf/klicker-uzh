import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

describe('Different microlearning workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  // get current year
  const currentYear = new Date().getFullYear()
  const courseName = 'Testkurs'

  it('creates and publishes a micro learning that should be visible to students', () => {
    const questionTitle = uuid()
    const question = uuid()
    const questionTitle2 = uuid()
    const question2 = uuid()
    const FTquestionTitle = 'FT ' + uuid()
    const FTquestion = 'FT ' + uuid()
    const FCtitle = 'FC ' + uuid()
    const FCquestion = 'FC ' + uuid()
    const FCanswer = 'FC ' + uuid()
    const CTtitle = 'CT ' + uuid()
    const CTquestion = 'CT ' + uuid()
    const microLearningName = uuid()
    const microLearningDisplayName = microLearningName
    const description = uuid()

    // set up SC question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // set up SC question without sample solution
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle2)
    cy.get('[data-cy="insert-question-text"]').click().type(question2)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create FT question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FREE_TEXT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FREE_TEXT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(FTquestionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(FTquestion)
    cy.get('[data-cy="set-free-text-length"]').click().type('100')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create Flashcard
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FLASHCARD.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(FCtitle)
    cy.get('[data-cy="insert-question-text"]').click().type(FCquestion)
    cy.get('[data-cy="insert-question-explanation"]').click().type(FCanswer)
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create content element
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CONTENT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CONTENT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(CTtitle)
    cy.get('[data-cy="insert-question-text"]').click().type(CTquestion)
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microLearningDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
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
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3 - add questions
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="question-0-stack-0"]').contains(questionTitle)
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${FTquestionTitle}"]`)
      .contains(FTquestionTitle)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer2,
    })
    // free text questions should also be accepted without sample solution
    cy.get('[data-cy="question-1-stack-0"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // add final stack with flashcard and content element
    const dataTransfer3 = new DataTransfer()
    cy.get(`[data-cy="question-item-${FCtitle}"]`)
      .contains(FCtitle)
      .trigger('dragstart', {
        dataTransfer3,
      })
    cy.get('[data-cy="drop-elements-add-stack"]').trigger('drop', {
      dataTransfer3,
    })
    cy.get('[data-cy="question-0-stack-1"]').contains(FCtitle)
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    const dataTransfer4 = new DataTransfer()
    cy.get(`[data-cy="question-item-${CTtitle}"]`)
      .contains(CTtitle)
      .trigger('dragstart', {
        dataTransfer4,
      })
    cy.get('[data-cy="drop-elements-stack-1"]').trigger('drop', {
      dataTransfer4,
    })
    cy.get('[data-cy="question-1-stack-1"]').contains(CTtitle)
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // SC question without sample solution should be rejected
    const dataTransfer5 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle2}"]`)
      .contains(questionTitle2)
      .trigger('dragstart', {
        dataTransfer5,
      })
    cy.get('[data-cy="drop-elements-stack-1"]').trigger('drop', {
      dataTransfer5,
    })
    cy.get('[data-cy="question-2-stack-1"]').contains(questionTitle2)
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="delete-question-2-stack-1"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // add displayname and description to stacks
    const title1 = 'Stack 1 Description Title'
    const title2 = 'Stack 2 Description Title'
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').click().type(title1)
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', title1)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').click()
    cy.get('[data-cy="stack-1-displayname"]').click().type(title2)
    cy.get('[data-cy="stack-1-displayname"]').should('have.value', title2)
    cy.get('[data-cy="close-stack-description"]').click()

    // move stacks around
    cy.get('[data-cy="move-stack-0-right"]').click()
    cy.get('[data-cy="question-0-stack-1"]').contains(questionTitle)
    cy.get('[data-cy="question-0-stack-0"]').contains(FCtitle)
    cy.get('[data-cy="question-1-stack-0"]').contains(CTtitle)
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', title2)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').click()
    cy.get('[data-cy="stack-1-displayname"]').should('have.value', title1)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="move-stack-1-left"]').click()
    cy.get('[data-cy="question-0-stack-0"]').contains(questionTitle)
    cy.get('[data-cy="question-0-stack-1"]').contains(FCtitle)
    cy.get('[data-cy="question-1-stack-1"]').contains(CTtitle)
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', title1)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').click()
    cy.get('[data-cy="stack-1-displayname"]').should('have.value', title2)
    cy.get('[data-cy="close-stack-description"]').click()

    // move questions in stack
    cy.get('[data-cy="move-question-0-stack-1-down"]').click()
    cy.get('[data-cy="question-0-stack-1"]').contains(CTtitle)
    cy.get('[data-cy="question-1-stack-1"]').contains(FCtitle)
    cy.get('[data-cy="move-question-1-stack-1-up"]').click()
    cy.get('[data-cy="question-0-stack-1"]').contains(FCtitle)
    cy.get('[data-cy="question-1-stack-1"]').contains(CTtitle)

    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // navigate to list of microlearnings
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.get(`[data-cy="publish-microlearning-${microLearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.published
    )

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

    cy.contains('[data-cy="microlearnings"]', microLearningDisplayName).should(
      'exist'
    )
    cy.findByText(microLearningDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').click().type('Free text answer')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // sign in as a student on a mobile device and respond to the all questions
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('iphone-x')
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()

    cy.contains('[data-cy="microlearnings"]', microLearningDisplayName).should(
      'exist'
    )
    cy.findByText(microLearningDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').should(
      'have.value',
      'Free text answer'
    )
    cy.get('[data-cy="practice-quiz-continue"]').click() // skip first already answered question (fetch from backend)

    // answer FC and CT
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="read-content-element-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.viewport('macbook-16')
  })

  it('creates and publishes a future micro learning that should not be visible to students and tests unpublishing it', () => {
    const questionTitle = uuid()
    const question = uuid()
    const microLearningName = uuid()
    const microLearningDisplayName = microLearningName
    const description = uuid()

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microLearningDisplayName)
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
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.get(`[data-cy="publish-microlearning-${microLearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
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

    cy.contains('[data-cy="microlearnings"]', microLearningDisplayName).should(
      'not.exist'
    )

    // switch back to the lecturer and unpublish the micro learning
    cy.clearAllCookies()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${microLearningName}"]`).click()
    cy.get(`[data-cy="unpublish-microlearning-${microLearningName}"]`).click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('creates and publishes a past micro learning that should not be visible to students', () => {
    const questionTitle = uuid()
    const question = uuid()
    const microLearningName = uuid()
    const microLearningDisplayName = microLearningName
    const description = uuid()

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microLearningDisplayName)
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
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.get(`[data-cy="publish-microlearning-${microLearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
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

    cy.contains('[data-cy="microlearnings"]', microLearningDisplayName).should(
      'not.exist'
    )
  })

  it('creates and edits a micro learning, which should then be accessible by students', () => {
    const questionTitle = uuid()
    const question = uuid()
    const microLearningName = uuid()
    const microLearningDisplayName = microLearningName
    const description = uuid()
    const stackTitle = 'Stack 1'

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microLearningDisplayName)
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
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').click().type(stackTitle)
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.get(`[data-cy="publish-microlearning-${microLearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
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

    cy.contains('[data-cy="microlearnings"]', microLearningDisplayName).should(
      'not.exist'
    )

    // switch back to the lecturer and unpublish the micro learning
    cy.clearAllCookies()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${microLearningName}"]`).click()
    cy.get(`[data-cy="unpublish-microlearning-${microLearningName}"]`).click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // edit the micro learning and add new values
    const newMicroLearningName = uuid()
    const newMicroLearningDisplayName = uuid()
    const newStackTitle = 'Stack 1 New'
    cy.get(`[data-cy="microlearning-actions-${microLearningName}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${microLearningName}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearnings).should(
      'exist'
    )

    // check if the first page of the edit form are shown correctly
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', microLearningName)
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .clear()
      .type(newMicroLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', microLearningDisplayName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .clear()
      .type(newMicroLearningDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)

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
    cy.get('[data-cy="drop-elements-add-stack"]').trigger('drop', {
      dataTransfer2,
    })
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle)
    cy.get('[data-cy="stack-0-displayname"]')
      .click()
      .clear()
      .type(newStackTitle)
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      newStackTitle
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${newMicroLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // recheck if the changes have been saved
    cy.get(`[data-cy="microlearning-actions-${newMicroLearningName}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${newMicroLearningName}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearnings).should(
      'exist'
    )
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', newMicroLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', newMicroLearningDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-start-date"]')
      .click()
      .should('have.value', `${currentYear}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .should('have.value', `${currentYear}-12-31T18:00`)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="question-0-stack-0"]').contains(questionTitle)
    cy.get('[data-cy="question-0-stack-1"]').contains(questionTitle)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${newMicroLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish the microlearning
    cy.get(`[data-cy="publish-microlearning-${newMicroLearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${newMicroLearningName}"]`).contains(
      messages.shared.generic.published
    )

    // sign in as student on a laptop and respond to both
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
      newMicroLearningDisplayName
    ).should('exist')
    cy.findByText(newMicroLearningDisplayName).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()

    cy.wait(500)
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="practice-quiz-continue"]').click()

    cy.get('[data-cy="sc-1-answer-option-1"]').click()

    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="practice-quiz-continue"]').click()
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

  it('converts a seeded past microlearning into a practice quiz', () => {
    const microLearningName = 'Test Microlearning Past No FT'
    const practiceQuizName = 'Practice Quiz Converted'
    const practiceQuizDisplayName = 'Practice Quiz Converted Displayname'

    // login as lecturer and navigate to course overview
    cy.clearAllCookies()
    cy.clearAllSessionStorage()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()

    // start conversion of a microlearning into a practice quiz
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${microLearningName}"]`).click()
    cy.get(
      `[data-cy="convert-microlearning-${microLearningName}-to-practice-quiz"]`
    ).click()

    // check if the practice quiz editor is open
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .should('have.value', `${microLearningName} (converted)`)
      .clear()
      .type(practiceQuizName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .should('have.value', microLearningName)
      .clear()
      .type(practiceQuizDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // continue to the next step and change the default settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
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
    cy.get('[data-cy="next-or-submit"]').click()

    // check if any questions are contained in the question step and create quiz
    cy.get('[data-cy="move-stack-1-left"]').should('exist').click()
    cy.get('[data-cy="move-stack-1-right"]').should('exist').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the practice quiz is listed in the course overview
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuizName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('creates, publishes and duplicates a micro learning, which should then be accessible by students', () => {
    const questionTitle = uuid()
    const questionTitle2 = uuid()
    const question = uuid()
    const microLearningName = uuid()
    const microLearningDisplayName = uuid()
    const microLearningNameDupl = `${microLearningName} (Copy)`
    const microLearningDisplayNameDupl = `${microLearningDisplayName} (NEW!)`
    const description = uuid()
    const stackTitle = 'Stack 1'

    // set up question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle2)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a microlearning
    cy.get('[data-cy="create-microlearning"]').click()

    // step 1
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(microLearningName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(microLearningDisplayName)
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
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').click().type(stackTitle)
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle)
    cy.get('[data-cy="close-stack-description"]').click()

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle2}"]`)
      .contains(questionTitle2)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-elements-add-stack"]').trigger('drop', {
      dataTransfer2,
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-session-list"]').click()

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.draft
    )

    // publish a microlearning
    cy.get(`[data-cy="publish-microlearning-${microLearningName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microLearningName}"]`).contains(
      messages.shared.generic.published
    )

    // switch back to the lecturer and duplicate the microlearning
    cy.clearAllCookies()
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${microLearningName}"]`).click()
    cy.get(`[data-cy="duplicate-microlearning-${microLearningName}"]`).click()
    cy.findByText('Create ' + messages.shared.generic.microlearnings).should(
      'exist'
    )

    // check if the first page of the edit form are shown correctly
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', microLearningNameDupl)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', microLearningDisplayName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .clear()
      .type(microLearningDisplayNameDupl)
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
    cy.get('[data-cy="next-or-submit"]').click()

    // add another question to the microlearning
    cy.get('[data-cy="question-0-stack-0"]').contains(
      questionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-1"]').contains(
      questionTitle2.substring(0, 20)
    )
    cy.get('[data-cy="open-stack-0-description"]').click()
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${microLearningNameDupl}"]`).contains(
      messages.shared.generic.draft
    )

    // publish the microlearning
    cy.get(`[data-cy="publish-microlearning-${microLearningNameDupl}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microLearningNameDupl}"]`).contains(
      messages.shared.generic.published
    )

    // sign in as student on a laptop and respond to both
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
      microLearningDisplayNameDupl
    ).should('exist')
    cy.findByText(microLearningDisplayNameDupl).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.wait(500)
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.wait(500)
    cy.get('[data-cy="finish-microlearning"]').click()
  })
})
