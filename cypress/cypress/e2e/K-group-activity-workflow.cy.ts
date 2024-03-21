import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

describe('Create and solve a group activity', () => {
  it('create a group activity and solve it', function () {
    const questionTitle = uuid()
    const question = uuid()

    const random = Math.floor(Math.random() * 1000)
    const name = 'Test Group Activity ' + random
    const displayName = 'Test Group Activity Display Name ' + random
    const description = 'Test Group Activity Description ' + random
    const courseName = 'Testkurs'
    const currentYear = new Date().getFullYear()

    cy.loginLecturer()

    // set up question with solution
    cy.get('[data-cy="questions"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // fill out first step of creation process
    cy.get('[data-cy="create-group-activity"]').click()
    cy.get('[data-cy="insert-groupactivity-name"]').click().type(name)
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .type(displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // fill out the settings of the group activity
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
    cy.get('[data-cy="select-start-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear - 1}-12-31T18:00`)

    // add clues to the group activity
    // create 1 text clue and two numerical clues (one with and one without unit)
    const clueName = 'Test Clue ' + random
    const clueDisplayName = 'Test Clue Display Name ' + random
    const clueContent = 'Test Clue Content ' + random
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .type(clueContent)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName).should('exist')
    cy.findByText(clueContent).should('exist')

    const clueName2 = 'Test Clue 2 ' + random
    const clueDisplayName2 = 'Test Clue Display Name 2 ' + random
    const clueContent2 = Math.floor(Math.random() * 1000)
    const clueUnit = 'kg'
    const fullContent2 = clueContent2 + ' ' + clueUnit
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName2)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName2)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(clueContent2)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]').click().type(clueUnit)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName2).should('exist')
    cy.findByText(fullContent2).should('exist')

    const clueName3 = 'Test Clue 3 ' + random
    const clueDisplayName3 = 'Test Clue Display Name 3 ' + random
    const clueContent3 = Math.floor(Math.random() * 1000)
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName3)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName3)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(clueContent3)
    )
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName3).should('exist')
    cy.findByText(clueContent3).should('exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // add questions to the group activity
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

    // TODO: check the content of the created group activity properly
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(name).should('exist')
  })

  it('take part in the seeded group activity', function () {
    cy.loginStudent()

    // start the group activity
    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="open-group-activity-0"]').click()
    cy.get('[data-cy="start-group-activity"]').click()

    // answer the questions in the group activity
    cy.get('[data-cy="free-text-input-1"]').click().type('Testanswer 1')
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="mc-2-answer-option-4"]').click()
    cy.get('[data-cy="input-numerical-3"]').type('57')
    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').click()
    cy.get('[data-cy="sc-5-answer-option-5"]').click()
    cy.get('[data-cy="submit-group-activity"]').click()

    // check that the answers are persistent and the fields disabled
    cy.get('[data-cy="free-text-input-1"]')
      .should('be.disabled')
      .contains('Testanswer 1')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', '57')

    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-5"]').should('be.disabled')

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    cy.get('[data-cy="free-text-input-1"]')
      .should('be.disabled')
      .contains('Testanswer 1')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', '57')

    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-5"]').should('be.disabled')

    // login again with second group member and check that the results
    // are still there and the inputs submitted
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
    cy.clearLocalStorage()

    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="username-field"]').click().type('testuser12')
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)

    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="open-group-activity-0"]').click()

    cy.get('[data-cy="free-text-input-1"]')
      .should('be.disabled')
      .contains('Testanswer 1')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', '57')

    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-5"]').should('be.disabled')
  })
})
