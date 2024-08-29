import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

describe('Test course creation and editing functionalities', () => {
  const name = 'Z' + uuid()
  const displayName = name
  const description = uuid()
  const testCourseName = 'Testkurs'
  const currentYear = new Date().getFullYear()

  it('Test the creation of a new course', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="create-course-name"]').type(name)
    cy.get('[data-cy="create-course-display-name"]').type(displayName)
    cy.get('[data-cy="create-course-description"]').focus().type(description)

    // change the start date
    cy.get('[data-cy="create-course-start-date-button"]').click()
    cy.get('[data-cy="create-course-start-date"]').type(`${currentYear}-01-01`)
    // click outside to save the value
    cy.get('[data-cy="create-course-name"]').click()

    // change the end date
    cy.get('[data-cy="create-course-end-date-button"]').click()
    cy.get('[data-cy="create-course-end-date"]').type(
      `${currentYear + 1}-01-01`
    )
    // click outside to save the value
    cy.get('[data-cy="create-course-name"]').click()

    // change course color to red
    cy.get('[data-cy="create-course-color-trigger"]').click()
    // first clear current test in field
    cy.get('[data-cy="create-course-color-hex-input"]').clear()
    cy.get('[data-cy="create-course-color-hex-input"]').type('FF0000')
    cy.get('[data-cy="create-course-color-submit"]').click()

    // test gamification toggle
    cy.get('[data-cy="create-course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="create-course-gamification"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="create-course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="create-course-gamification"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )

    // submit the form
    cy.get('[data-cy="create-course-submit"]').click()

    // check if the course is in the list
    cy.get('[data-cy="courses"]').click()
    cy.findByText(name).should('exist')
  })

  it('Check the content of the course overview and edit course properties', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // check if the course is in the detail view
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${name}"]`).click()
    cy.get('[data-cy="course-name-with-pin"]').should('contain', name)

    // check out course join modal
    cy.get('[data-cy="course-join-button"]').click()
    cy.get('[data-cy="course-join-modal"]').should('exist')
    cy.get('[data-cy="course-join-modal"]').should('contain', 'QR Code')
    cy.get('[data-cy="course-join-modal-close"]').click()

    // check course color and change it to green
    cy.get('[data-cy="course-color-trigger"]').click()
    cy.get('[data-cy="course-color-hex-input"]').should('have.value', 'FF0000')
    cy.get('[data-cy="course-color-hex-input"]').clear()
    cy.get('[data-cy="course-color-hex-input"]').type('00FF00')
    cy.get('[data-cy="course-color-submit"]').click()

    // check course start date and change it
    cy.get('[data-cy="course-start-date-button"]').click()
    cy.get('[data-cy="course-start-date"]').should(
      'have.value',
      `${currentYear}-01-01`
    )
    cy.get('[data-cy="course-start-date"]').type(`${currentYear}-02-01`)
    // click outside to submit
    cy.get('[data-cy="course-name-with-pin"]').click()

    // check course end date and change it
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').should(
      'have.value',
      `${currentYear + 1}-01-01`
    )
    cy.get('[data-cy="course-end-date"]').type(`${currentYear + 1}-02-01`)
    // click outside to submit
    cy.get('[data-cy="course-name-with-pin"]').click()

    // enable gamification for the created course and check that it worked (switch active and disabled)
    cy.get('[data-cy="course-gamification-switch"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="course-gamification-switch"]').click()
    cy.get('[data-cy="cancel-enable-gamification"]').click()
    cy.get('[data-cy="course-gamification-switch"]').click()
    cy.get('[data-cy="confirm-enable-gamification"]').click()
    cy.get('[data-cy="course-gamification-switch"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="course-gamification-switch"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )

    // TODO: add new test cases for the settings on the course overview related to groups
  })

  it('Test the creation of a new gamified course', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="create-course-name"]').type(name)
    cy.get('[data-cy="create-course-display-name"]').type(displayName)

    // change the start date
    cy.get('[data-cy="create-course-start-date-button"]').click()
    cy.get('[data-cy="create-course-start-date"]').type(`${currentYear}-01-01`)
    // click outside to save the value
    cy.get('[data-cy="create-course-name"]').click()

    // change the end date
    cy.get('[data-cy="create-course-end-date-button"]').click()
    cy.get('[data-cy="create-course-end-date"]').type(
      `${currentYear + 1}-01-01`
    )
    // click outside to save the value
    cy.get('[data-cy="create-course-name"]').click()

    // test gamification toggle
    cy.get('[data-cy="create-course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="toggle-group-creation-enabled"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="toggle-group-creation-enabled"]').should('be.disabled')
    cy.get('[data-cy="group-creation-deadline"]').should('not.exist')
    cy.get('[data-cy="max-group-size"]').should('not.exist')
    cy.get('[data-cy="preferred-group-size"]').should('not.exist')

    // check if the values of the form are properly reset if gamification is disabled
    cy.get('[data-cy="create-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').clear()
    cy.get('[data-cy="max-group-size"]').clear()
    cy.get('[data-cy="create-course-submit"]').should('be.disabled')
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="create-course-submit"]').should('not.be.disabled')

    // change group settings
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="toggle-group-creation-enabled"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').type(
      `${currentYear + 2}-01-01`
    )
    cy.get('[data-cy="create-course-submit"]').should('be.disabled')
    cy.get('[data-cy="group-creation-deadline"]').type(`${currentYear}-06-01`)
    cy.get('[data-cy="create-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="max-group-size"]').click().type('10')
    cy.get('[data-cy="preferred-group-size"]').click().type('4')

    // submit the form
    cy.get('[data-cy="create-course-submit"]').click()

    // check if the course is in the list
    cy.get('[data-cy="courses"]').click()
    cy.findByText(name).should('exist')

    // TODO: check out the settings on the course if they have been stored correctly
  })

  it('Test the course overview on the student side', () => {
    // log into the student frontend
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.viewport('iphone-x')
    cy.get('[data-cy="password-login"]').click()
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)

    // check for the existince of the test course
    cy.get(`[data-cy="course-button-${testCourseName}"]`).click()
    cy.get('[data-cy="student-course-leaderboard-tab"]').should('exist')

    // check if the leaderboards exist
    cy.findByText(messages.pwa.courses.individualLeaderboard).should('exist')
    cy.findByText(messages.pwa.courses.groupLeaderboard).should('exist')

    // TODO: join the course created above (extract the pin after generation)
  })
})
