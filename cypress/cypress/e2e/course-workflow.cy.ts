describe('Test course creation and editing functionalities', () => {
  const randomNumber = Math.round(Math.random() * 1000)
  const name = 'Testkurs ' + randomNumber
  const displayName = 'Testkurs Display ' + randomNumber
  const description = 'lorem ipsum dolor sit amet'

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
    cy.get('[data-cy="create-course-description"]').type(description)

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
    cy.get('[data-cy="create-course-gamification"]').click()
    cy.get('[data-cy="create-course-gamification"]').click()

    // submit the form
    cy.get('[data-cy="create-course-submit"]').click()

    // check if the course is in the list
    cy.get('[data-cy="courses"]').click()
    cy.findByText(name).should('exist')
  })
})
