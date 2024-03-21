describe('Create and solve a group activity', () => {
  beforeEach(() => {
    // cy.exec('cd .. && pnpm run prisma:setup:yes && cd cypress', {
    //   failOnNonZeroExit: false,
    // })
    cy.loginStudent()
  })

  // TODO
  it('create a group activity and solve it', function () {})

  it('take part in the seeded group activity', function () {
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
