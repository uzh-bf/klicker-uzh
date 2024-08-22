import { v4 as uuid } from 'uuid'

import messages from '../../../packages/i18n/messages/en'

describe('Test course creation and editing functionalities', () => {
  const name = 'Z' + uuid()
  const displayName = name
  const description = uuid()
  const testCourseName = 'Testkurs'

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
    // TODO: Fix the typing into the content input - does not seem to work...
    cy.get('[data-cy="create-course-description"]').click().type(description)

    // change the start date to the first of january 2024
    cy.get('[data-cy="create-course-start-date-button"]').click()
    cy.get('[data-cy="create-course-start-date"]').type('2024-01-01')
    // click outside to save the value
    cy.get('[data-cy="create-course-name"]').click()

    // change the end date to the first of january 2025
    cy.get('[data-cy="create-course-end-date-button"]').click()
    cy.get('[data-cy="create-course-end-date"]').type('2025-01-01')
    // click outside to save the value
    cy.get('[data-cy="create-course-name"]').click()

    // change course color to red using the following cys
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

    // TODO: check for description content here once bug above is fixed
    // cy.get('[data-cy="course-description"]').should('contain', description)
    // // change the description
    // cy.get('[data-cy="course-description-edit-button"]').click()
    // cy.get('[data-cy="course-description-input"]')
    //   .click()
    //   .type('New description')
    // cy.get('[data-cy="course-description-submit"]').click()

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

    // check course start date and change it to 2024-02-01
    cy.get('[data-cy="course-start-date-button"]').click()
    cy.get('[data-cy="course-start-date"]').should('have.value', '2024-01-01')
    cy.get('[data-cy="course-start-date"]').type('2024-02-01')
    // click outside to submit
    cy.get('[data-cy="course-name-with-pin"]').click()

    // check course end date and change it to 2025-02-01
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').should('have.value', '2025-01-01')
    cy.get('[data-cy="course-end-date"]').type('2025-02-01')
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
