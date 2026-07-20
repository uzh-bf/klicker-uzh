import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString } from './helpers'

describe('Test course creation and editing functionalities', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('N-course.json').then((courseData) => {
      this.data = { ...this.data, ...courseData }
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  // ! Part 1: Course creation
  // #region
  it('Test the creation of a new course without gamification', function () {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="course-name"]').click().type(this.data.course1.name)
    cy.get('[data-cy="course-display-name"]')
      .click()
      .type(this.data.course1.displayName)
    cy.get('[data-cy="course-description"]')
      .realClick()
      .realType(this.data.course1.description)

    // change the course language from the user default locale (english) to german
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.en
    )
    cy.selectOption('[data-cy="course-language"]', messages.shared.generic.de)
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.de
    )

    // enter a course notification email (should be pre-filled with the user email)
    cy.get('[data-cy="course-notification-email"]').should(
      'have.value',
      Cypress.env('LECTURER_EMAIL')
    )
    cy.get('[data-cy="course-notification-email"]')
      .click()
      .clear()
      .type(this.data.course1.notificationEmail)

    // change the start date (2 months in the future on the 15th - default is start of next month)
    cy.get('[data-cy="course-start-date"]').realClick()
    cy.get('[data-cy="course-start-date-next-month"]').realClick().wait(100)
    cy.get('[data-cy="course-start-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="course-start-date"]').should(
      'contain',
      getDatetimeValidationString(2, '15')
    )

    // change the end date (8 months in the future on the 15th - default is start + 6 months)
    cy.get('[data-cy="course-end-date"]').realClick()
    cy.get('[data-cy="course-end-date-next-month"]').realClick().wait(100)
    cy.get('[data-cy="course-end-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="course-end-date"]').should(
      'contain',
      getDatetimeValidationString(8, '15')
    )

    // change course color to red
    cy.get('[data-cy="course-color-trigger"]').click()
    cy.get('[data-cy="course-color-hex-input"]').clear()
    cy.get('[data-cy="course-color-hex-input"]').type('FF0000')
    cy.get('[data-cy="course-color-submit"]').click()

    // test gamification toggle
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )

    // submit the form
    cy.get('[data-cy="manipulate-course-submit"]').click()

    // check if the course is in the list
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course1.name).should('exist')
  })

  it('Test the creation of a new gamified course', function () {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="course-name"]').type(this.data.course2.name)
    cy.get('[data-cy="course-display-name"]').type(
      this.data.course2.displayName
    )

    // keep the course language as english
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.en
    )
    cy.selectOption('[data-cy="course-language"]', messages.shared.generic.en)
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.en
    )

    // enter a course notification email
    cy.get('[data-cy="course-notification-email"]').should(
      'have.value',
      Cypress.env('LECTURER_EMAIL')
    )
    cy.get('[data-cy="course-notification-email"]')
      .click()
      .clear()
      .type(this.data.course2.notificationEmail)

    // change the start date (3 months in the future on the 15th)
    cy.get('[data-cy="course-start-date"]').realClick()
    cy.get('[data-cy="course-start-date-next-month"]')
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-start-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="course-start-date"]').should(
      'contain',
      getDatetimeValidationString(3, '15')
    )

    // change the end date (9 months in the future on the 15th - default is start + 6 months)
    cy.get('[data-cy="course-end-date"]').realClick().wait(100)
    cy.get('[data-cy="course-end-date-next-month"]')
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-end-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="course-end-date"]').should(
      'contain',
      getDatetimeValidationString(9, '15')
    )

    // test gamification toggle
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="course-group-creation"]').should('not.be.disabled')
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-group-creation"]').should('be.disabled')
    cy.get('[data-cy="group-creation-deadline"]').should('not.exist')
    cy.get('[data-cy="max-group-size"]').should('not.exist')
    cy.get('[data-cy="preferred-group-size"]').should('not.exist')

    // check if the values of the form are properly reset if gamification is disabled
    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-group-creation"]').click()
    cy.get('[data-cy="max-group-size"]').clear()
    cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')

    // change group settings
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-group-creation"]').should('not.be.disabled')
    cy.get('[data-cy="course-group-creation"]').click()

    // enter an invalid group creation deadline date (after end date - 10 months in the future)
    // when field becomes visible, it is initialized with the current course date
    cy.get('[data-cy="group-creation-deadline"]').realClick()
    cy.get('[data-cy="group-creation-deadline-next-month"]')
      .realClick()
      .wait(100)
    cy.get('[data-cy="group-creation-deadline-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    const invalidGroupDeadline = getDatetimeValidationString(10, '15')
    cy.get('[data-cy="group-creation-deadline"]').should(
      'contain',
      invalidGroupDeadline
    )
    cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')

    // change this back to a valid date (5 months in the future)
    cy.get('[data-cy="group-creation-deadline"]').realClick()
    cy.get('[data-cy="group-creation-deadline-previous-month"]')
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
    cy.get('[data-cy="group-creation-deadline-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="group-creation-deadline"]').should(
      'contain',
      getDatetimeValidationString(5, '15')
    )
    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="max-group-size"]').click().clear().type('6')
    cy.get('[data-cy="preferred-group-size"]').click().clear().type('4')

    // submit the form
    cy.get('[data-cy="manipulate-course-submit"]').click()

    // check if the course is in the list
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course2.name).should('exist')

    // check that random group assignment should be disabled
    cy.get(`[data-cy="course-list-button-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="tab-groups"]').click()
    cy.get('[data-cy="assign-random-groups"]').should('be.disabled')
    cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
      'exist'
    )
  })
  // #endregion

  // ! Part 2: Randomized group creation
  // #region
  it('Have 10 students join the course and the random assignment pool', function () {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))

    cy.task('getCoursePin', { courseName: this.data.course2.name }).then(
      (pin: number) => {
        // check if the pin was fetched successfully
        if (!pin) {
          throw new Error(
            'No course pin found. Please ensure that the previous test case has run successfully and generated a course pin.'
          )
        }

        for (const studentUsername of [
          Cypress.env('STUDENT_USERNAME'),
          Cypress.env('STUDENT_USERNAME2'),
          Cypress.env('STUDENT_USERNAME3'),
          Cypress.env('STUDENT_USERNAME4'),
          Cypress.env('STUDENT_USERNAME5'),
          Cypress.env('STUDENT_USERNAME6'),
          Cypress.env('STUDENT_USERNAME7'),
          Cypress.env('STUDENT_USERNAME8'),
          Cypress.env('STUDENT_USERNAME9'),
          Cypress.env('STUDENT_USERNAME10'),
        ]) {
          cy.clearAllCookies()
          cy.clearAllLocalStorage()
          cy.visit(Cypress.env('URL_STUDENT'))

          cy.get('[data-cy="username-field"]').click().type(studentUsername)
          cy.get('[data-cy="password-field"]')
            .click()
            .type(Cypress.env('STUDENT_PASSWORD'))
          cy.get('[data-cy="submit-login"]').click()

          // join the course
          cy.get('[data-cy="join-new-course"]').click()
          cy.get('[data-cy="join-course-pin-field-1"]')
            .realClick()
            .realType(String(pin))
          cy.get('[data-cy="join-course-submit-form"]').click()

          // join the random assignment pool
          cy.get(
            `[data-cy="course-button-${this.data.course2.displayName}"]`
          ).click()
          cy.get('[data-cy="student-course-create-group"]').click()
          cy.get('[data-cy="enter-random-group-pool"]').click()
          cy.get('[data-cy="leave-random-group-pool"]').should('exist')
        }
      }
    )
  })

  it('Have 2 students join the course and create groups by themselves', function () {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))

    cy.task('getCoursePin', { courseName: this.data.course2.name }).then(
      (pin: number) => {
        // check if the pin was fetched successfully
        if (!pin) {
          throw new Error(
            'No course pin found. Please ensure that the previous test case has run successfully and generated a course pin.'
          )
        }

        // student 11 joins course and creates a group by himself
        cy.clearAllCookies()
        cy.clearAllLocalStorage()
        cy.visit(Cypress.env('URL_STUDENT'))
        cy.get('[data-cy="username-field"]')
          .click()
          .type(Cypress.env('STUDENT_USERNAME11'))
        cy.get('[data-cy="password-field"]')
          .click()
          .type(Cypress.env('STUDENT_PASSWORD'))
        cy.get('[data-cy="submit-login"]').click()

        // join the course
        cy.get('[data-cy="join-new-course"]').click()
        cy.get('[data-cy="join-course-pin-field-1"]')
          .realClick()
          .realType(String(pin))
        cy.get('[data-cy="join-course-submit-form"]').click()

        // create group
        cy.get(
          `[data-cy="course-button-${this.data.course2.displayName}"]`
        ).click()
        cy.get('[data-cy="student-course-create-group"]').click()
        cy.get('[data-cy="group-creation-name-input"]').type(
          this.data.course2.group1
        )
        cy.get('[data-cy="create-new-participant-group"]').click()
        cy.wait(1000)

        // student 12 joins course and creates a group by himself
        cy.clearAllCookies()
        cy.clearAllLocalStorage()
        cy.visit(Cypress.env('URL_STUDENT'))
        cy.get('[data-cy="username-field"]')
          .click()
          .type(Cypress.env('STUDENT_USERNAME12'))
        cy.get('[data-cy="password-field"]')
          .click()
          .type(Cypress.env('STUDENT_PASSWORD'))
        cy.get('[data-cy="submit-login"]').click()

        // join the course
        cy.get('[data-cy="join-new-course"]').click()
        cy.get('[data-cy="join-course-pin-field-1"]')
          .realClick()
          .realType(String(pin))
        cy.get('[data-cy="join-course-submit-form"]').click()

        // create group
        cy.get(
          `[data-cy="course-button-${this.data.course2.displayName}"]`
        ).click()
        cy.get('[data-cy="student-course-create-group"]').click()
        cy.get('[data-cy="group-creation-name-input"]').type(
          this.data.course2.group2
        )
        cy.get('[data-cy="create-new-participant-group"]').click()
        cy.wait(1000)
      }
    )
  })

  it('Trigger the random group assignment for the gamified course', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="tab-groups"]').click()
    cy.get('[data-cy="assign-random-groups"]').click()
    cy.get('[data-cy="cancel-random-group-assignment"]').click()
    cy.get('[data-cy="assign-random-groups"]').click()
    cy.get('[data-cy="confirm-random-group-assignment"]').click()
    cy.wait(1000)
    cy.get('[data-cy="assign-random-groups"]').should('not.exist')
    cy.findByText(
      messages.manage.course.groupAssignmentFinalizedMessage
    ).should('exist')
  })

  it('Check from the student view that they have been assigned to groups successfully', function () {
    for (const studentUsername of [
      Cypress.env('STUDENT_USERNAME'),
      Cypress.env('STUDENT_USERNAME2'),
      Cypress.env('STUDENT_USERNAME3'),
      Cypress.env('STUDENT_USERNAME11'),
      Cypress.env('STUDENT_USERNAME12'),
    ]) {
      cy.loginStudentPassword({ username: studentUsername })

      // check that an existing group is present
      cy.get(
        `[data-cy="course-button-${this.data.course2.displayName}"]`
      ).click()
      cy.get('[data-cy="student-course-create-group"]').should('not.exist')
    }
  })

  it('Check that if group formation deadline is moved into the future, randomized assignment is possible again', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course2.name}"]`).click()

    // modify the course end date and group creation deadline
    cy.get('[data-cy="course-settings-button"]').click()

    // change the group deadline date (4 months in the future on the 15th - random group generation changed it to today)
    cy.get('[data-cy="group-creation-deadline"]').realClick()
    cy.get('[data-cy="group-creation-deadline-next-month"]')
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
    cy.get('[data-cy="group-creation-deadline-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="group-creation-deadline"]').should(
      'contain',
      getDatetimeValidationString(4, '15')
    )

    // save the changes
    cy.get('[data-cy="manipulate-course-submit"]').click()

    // check that random assignment of groups would be possible again once students join the pool
    cy.get('[data-cy="tab-groups"]').click()
    cy.get('[data-cy="assign-random-groups"]')
      .should('exist')
      .should('be.disabled')
    cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
      'exist'
    )
  })
  // #endregion

  // ! Part 3: Course overview, editing, and archiving
  // #region
  it('Check the content of the course overview and edit course properties', function () {
    // log into frontend-manage
    cy.loginLecturer()

    // check if the course is in the detail view
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course1.name}"]`).click()
    cy.get('[data-cy="course-name-with-pin"]').should(
      'contain',
      this.data.course1.name
    )

    // check out course join modal
    cy.get('[data-cy="course-join-qr-code"]').click()
    cy.findByText(messages.manage.course.courseQRDescription).should('exist')
    cy.get('[data-cy="course-join-qr-code"]').click()

    // open the settings dialogue
    cy.get('[data-cy="course-settings-button"]').click()

    // check if the name properties have been set correctly
    cy.get('[data-cy="course-name"]').should(
      'have.value',
      this.data.course1.name
    )
    cy.get('[data-cy="course-display-name"]').should(
      'have.value',
      this.data.course1.displayName
    )

    // change the course name
    cy.get('[data-cy="course-name"]').clear().type(this.data.course1.nameNew)
    cy.get('[data-cy="course-display-name"]')
      .clear()
      .type(this.data.course1.displayNameNew)

    // check if the course language is set correctly
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.de
    )

    // change the course language to english
    cy.selectOption('[data-cy="course-language"]', messages.shared.generic.en)
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.en
    )

    // check if the notification email is set correctly
    cy.get('[data-cy="course-notification-email"]').should(
      'have.value',
      this.data.course1.notificationEmail
    )

    // change the course notification email
    cy.get('[data-cy="course-notification-email"]')
      .clear()
      .type(this.data.course1.notificationEmailNew)

    // check course color and change it to green
    cy.get('[data-cy="course-color-trigger"]').click()
    cy.get('[data-cy="course-color-hex-input"]').should('have.value', 'FF0000')
    cy.get('[data-cy="course-color-hex-input"]').clear()
    cy.get('[data-cy="course-color-hex-input"]').type('00FF00')
    cy.get('[data-cy="course-color-submit"]').click()

    // check course start date and change it (from 2 to 3 months in the future on the 15th)
    cy.get('[data-cy="course-start-date"]').should(
      'contain',
      getDatetimeValidationString(2, '15')
    )

    cy.get('[data-cy="course-start-date"]').realClick()
    cy.get('[data-cy="course-start-date-next-month"]').realClick().wait(100)
    cy.get('[data-cy="course-start-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="course-start-date"]').should(
      'contain',
      getDatetimeValidationString(3, '15')
    )

    // check course end date and change it (from 8 to 10 months in the future on the 15th)
    cy.get('[data-cy="course-end-date"]').should(
      'contain',
      getDatetimeValidationString(8, '15')
    )

    cy.get('[data-cy="course-end-date"]').realClick()
    cy.get('[data-cy="course-end-date-next-month"]')
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-end-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="course-end-date"]').should(
      'contain',
      getDatetimeValidationString(10, '15')
    )

    // enable gamification for the created course and check that it worked (switch active and disabled)
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    // save settings and check correct values afterwards (gamification should be enabled & blocked)
    cy.get('[data-cy="manipulate-course-submit"]').click()
    cy.get('[data-cy="course-settings-button"]').click()
    cy.get('[data-cy="course-name"]').should(
      'have.value',
      this.data.course1.nameNew
    )
    cy.get('[data-cy="course-display-name"]').should(
      'have.value',
      this.data.course1.displayNameNew
    )
    cy.get('[data-cy="course-language"]').should(
      'contain',
      messages.shared.generic.en
    )
    cy.get('[data-cy="course-notification-email"]').should(
      'have.value',
      this.data.course1.notificationEmailNew
    )
    cy.get('[data-cy="course-start-date"]').should(
      'contain',
      getDatetimeValidationString(3, '15')
    )
    cy.get('[data-cy="course-end-date"]').should(
      'contain',
      getDatetimeValidationString(10, '15')
    )
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="course-group-creation"]').click()
    cy.get('[data-cy="course-group-creation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    // set group creation deadline to 8 months in the future (is initialized with the course end date)
    cy.get('[data-cy="group-creation-deadline"]').should(
      'contain',
      getDatetimeValidationString(10, '15')
    )
    cy.get('[data-cy="group-creation-deadline"]').realClick()
    cy.get('[data-cy="group-creation-deadline-previous-month"]')
      .realClick()
      .wait(100)
      .realClick()
      .wait(100)
    cy.get('[data-cy="group-creation-deadline-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // verify that the correct date is selected
    cy.get('[data-cy="group-creation-deadline"]').should(
      'contain',
      getDatetimeValidationString(8, '15')
    )

    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="max-group-size"]').should('have.value', '5')
    cy.get('[data-cy="max-group-size"]').clear().type('10')
    cy.get('[data-cy="max-group-size"]').should('have.value', '10')
    cy.get('[data-cy="preferred-group-size"]').should('have.value', '3')
    cy.get('[data-cy="preferred-group-size"]').clear().type('4')
    cy.get('[data-cy="preferred-group-size"]').should('have.value', '4')
    cy.get('[data-cy="manipulate-course-submit"]').click()

    // check if the group creation deadline has been set correctly
    cy.get('[data-cy="course-settings-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').should(
      'contain',
      getDatetimeValidationString(8, '15')
    )
  })

  it('Test if the course leaderboards are visible on the student app', function () {
    cy.loginStudent()

    // check for the existince of the test course
    cy.get(`[data-cy="course-button-${this.data.running.name}"]`).click()
    cy.get('[data-cy="student-course-leaderboard-tab"]').should('exist')

    // check if the leaderboards exist
    cy.findByText(messages.pwa.courses.individualLeaderboard).should('exist')
    cy.findByText(messages.pwa.courses.groupLeaderboard).should('exist')

    // switch between entire course and biweekly leaderboard
    cy.get('[data-cy="student-course-join-leaderboard"]').click()
    cy.get('[data-cy="select-course-leaderboard"]').click()
    cy.get('[data-cy="select-biweekly-leaderboard"]').click()
    cy.get('[data-cy="select-course-leaderboard"]').click()

    // leave and re-join the course leaderboard
    cy.get('[data-cy="leave-leaderboard"]').click()
    cy.get('[data-cy="cancel-leave-course-leaderboard"]').click()
    cy.get('[data-cy="leave-leaderboard"]').click()
    cy.get('[data-cy="confirm-leave-course-leaderboard"]').click()
    cy.get('[data-cy="student-course-join-leaderboard"]').should('exist')
    cy.get('[data-cy="select-course-leaderboard"]').should('not.exist')
    cy.get('[data-cy="select-biweekly-leaderboard"]').should('not.exist')
    cy.get('[data-cy="student-course-join-leaderboard"]').click()
    cy.get('[data-cy="leave-leaderboard"]').should('exist')
    cy.get('[data-cy="select-course-leaderboard"]').should('exist')
    cy.get('[data-cy="select-biweekly-leaderboard"]').should('exist')
  })

  it('Test course archive functionality', function () {
    // login and switch to course list
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.running.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="course-list-button-${this.data.past.name}"]`).should(
      'exist'
    )

    // check the archiving functionality
    cy.get(`[data-cy="archive-course-${this.data.running.name}"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="archive-course-${this.data.past.name}"]`)
      .should('not.be.disabled')
      .click()
    cy.findByText(messages.manage.courseList.confirmCourseArchive).should(
      'exist'
    )
    cy.get('[data-cy="course-archive-modal-cancel"]').click()
    cy.get(`[data-cy="archive-course-${this.data.past.name}"]`).click()
    cy.get('[data-cy="course-archive-modal-confirm"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.past.name}"]`).should(
      'not.exist'
    )

    // check out the archive and re-activate the past course
    cy.get('[data-cy="toggle-course-archive"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.past.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="archive-course-${this.data.past.name}"]`).click()
    cy.findByText(messages.manage.courseList.confirmCourseUnarchive).should(
      'exist'
    )
    cy.get('[data-cy="course-archive-modal-confirm"]').click()
    cy.get('[data-cy="toggle-course-archive"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.past.name}"]`).should(
      'exist'
    )
  })
  // #endregion

  // ! Part 4: Course deletion and required confirmations
  // #region
  it('Create a course with live quiz, practice quiz, and microlearning, and delete it again', function () {
    cy.loginLecturer()

    // create a new course
    cy.get('[data-cy="courses"]').click()
    cy.get('[data-cy="course-list-button-new-course"]').click()
    cy.get('[data-cy="course-name"]').type(this.data.deletion.courseName)
    cy.get('[data-cy="course-display-name"]').type(
      this.data.deletion.displayName
    )
    cy.get('[data-cy="course-notification-email"]').should(
      'have.value',
      Cypress.env('LECTURER_EMAIL')
    )
    cy.get('[data-cy="course-notification-email"]')
      .clear()
      .type(this.data.deletion.notificationEmail)
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="manipulate-course-submit"]').click()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.deletion.courseName).should('exist')
    cy.reload()

    // create a question with sample solution
    cy.get('[data-cy="library"]').click()
    cy.location('pathname', { timeout: 15_000 }).should('eq', '/')
    cy.createQuestionSC({
      name: this.data.deletion.qTitle,
      content: this.data.deletion.qContent,
      choices: [{ value: '50%', correct: true }, { value: '100%' }],
      userId: Cypress.env('LECTURER_ID'),
    })

    // create a live quiz in the course
    cy.createLiveQuiz({
      name: this.data.deletion.lqName,
      displayName: this.data.deletion.lqName,
      courseName: this.data.deletion.courseName,
      blocks: [{ elements: [this.data.deletion.qTitle] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a practice quiz in the course
    cy.createPracticeQuiz({
      name: this.data.deletion.pqName,
      displayName: this.data.deletion.pqName,
      description: this.data.course1.description,
      courseName: this.data.deletion.courseName,
      stacks: [{ elements: [this.data.deletion.qTitle] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a microlearning in the course
    cy.createMicroLearning({
      name: this.data.deletion.mlName,
      displayName: this.data.deletion.mlName,
      startDate: {
        monthDelta: -2,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 4,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      courseName: this.data.deletion.courseName,
      stacks: [{ elements: [this.data.deletion.qTitle] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // delete the course and check that it is not visible anymore after a reload
    cy.get('[data-cy="courses"]').click()
    cy.location('pathname', { timeout: 15_000 }).should('eq', '/courses')
    cy.get(
      `[data-cy="course-list-button-${this.data.deletion.courseName}"]`
    ).should('exist')
    cy.get(`[data-cy="delete-course-${this.data.deletion.courseName}"]`).click()
    cy.get('[data-cy="course-deletion-modal-cancel"]').click()
    cy.get(`[data-cy="delete-course-${this.data.deletion.courseName}"]`).click()
    cy.get('[data-cy="course-deletion-participations-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="course-deletion-live-quiz-confirm"]')
      .should('exist')
      .click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').should('be.disabled')
    cy.get('[data-cy="course-deletion-practice-quiz-confirm"]')
      .should('exist')
      .click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').should('be.disabled')
    cy.get('[data-cy="course-deletion-micro-learning-confirm"]')
      .should('exist')
      .click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="course-deletion-group-activity-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="course-deletion-modal-confirm"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="course-deletion-participant-group-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="course-deletion-modal-confirm"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="course-deletion-leaderboard-entry-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.deletion.courseName}"]`
    ).should('not.exist')
    cy.reload()
    cy.get(
      `[data-cy="course-list-button-${this.data.deletion.courseName}"]`
    ).should('not.exist')

    // check that the live quiz has been removed from the course
    cy.get('[data-cy="activities"]').click()
    cy.location('pathname', { timeout: 15_000 }).should('eq', '/activities')
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.deletion.lqName}"]`
    ).should('exist')
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.deletion.lqName}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.deletion.lqName}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
  })

  it('Cleanup: Delete the live quiz that is not assigned to the course anymore', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click()
    cy.location('pathname', { timeout: 15_000 }).should('eq', '/activities')
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.deletion.lqName}"]`
    ).should('exist')
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.deletion.lqName}"]`).click()
    cy.get(`[data-cy="delete-live-quiz-${this.data.deletion.lqName}"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.deletion.lqName).should('not.exist')
  })

  it('Cleanup: Delete all created courses and created questions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()

    // delete the non-gamified course
    cy.get(`[data-cy="delete-course-${this.data.course1.nameNew}"]`).click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.findByText(this.data.course1.nameNew).should('not.exist')

    // delete the gamified course
    cy.get(`[data-cy="delete-course-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="course-deletion-participations-confirm"]').click()
    cy.get('[data-cy="course-deletion-participant-group-confirm"]').click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.findByText(this.data.course2.name).should('not.exist')

    cy.get('[data-cy="library"]').click()
    cy.validateElement({ element: this.data.deletion.qTitle })
    cy.deleteElement({ elementName: this.data.deletion.qTitle })
    cy.validateElement({
      element: this.data.deletion.qTitle,
      shouldExist: false,
    })
  })
  // #endregion

  // ! Part 5: Course Sharing
  // #region
  function verifyCourseReadPermissions({ data }: { data: any }) {
    // check that the elements used in the activities are not visible to the user
    cy.wrap([
      data.SCML.title,
      data.NRML.title,
      data.SEML.title,
      data.CSML.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // check that the answer collection is not visible to the user
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${data.SE.collection}"]`).should(
      'not.exist'
    )

    // verify that all activities are shown on the activity overview
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.liveQuiz}-READ"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.practiceQuiz}-READ"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(`[data-cy="permission-level-${data.sharing.microLearning}-READ"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(`[data-cy="permission-level-${data.sharing.groupActivity}-READ"]`)
      .should('exist')

    // course should be accessible and READ permissions should be granted on all activities
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`)
      .get(`[data-cy="permission-level-${data.sharing.course}-READ"]`)
      .should('exist')
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').should('not.exist')
    cy.get('[data-cy="tab-liveQuizzes"]').click()

    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.liveQuiz}-READ"]`)
      .should('exist')

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.practiceQuiz}-READ"]`)
      .should('exist')

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(`[data-cy="permission-level-${data.sharing.microLearning}-READ"]`)
      .should('exist')

    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(`[data-cy="permission-level-${data.sharing.groupActivity}-READ"]`)
      .should('exist')
  }

  function verifyCourseExecutePermissions({ data }: { data: any }) {
    // check that the elements used in the activities are not visible to the user
    cy.wrap([
      data.SCML.title,
      data.NRML.title,
      data.SEML.title,
      data.CSML.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // check that the answer collection is not visible to the user
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${data.SE.collection}"]`).should(
      'not.exist'
    )

    // verify that all activities are shown on the activity overview
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.liveQuiz}-EXECUTE"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.practiceQuiz}-EXECUTE"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(`[data-cy="permission-level-${data.sharing.microLearning}-EXECUTE"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(`[data-cy="permission-level-${data.sharing.groupActivity}-EXECUTE"]`)
      .should('exist')

    // course should be accessible and READ permissions should be granted on all activities
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`)
      .get(`[data-cy="permission-level-${data.sharing.course}-EXECUTE"]`)
      .should('exist')
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').should('not.exist')

    cy.get('[data-cy="tab-liveQuizzes"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.liveQuiz}-EXECUTE"]`)
      .should('exist')

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.practiceQuiz}-EXECUTE"]`)
      .should('exist')

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(`[data-cy="permission-level-${data.sharing.microLearning}-EXECUTE"]`)
      .should('exist')

    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(`[data-cy="permission-level-${data.sharing.groupActivity}-EXECUTE"]`)
      .should('exist')
  }

  function verifyCourseWritePermissions({
    data,
    propagation,
  }: {
    data: any
    propagation: boolean
  }) {
    // check that the elements used in the activities are not visible to the user
    cy.wrap([
      data.SCML.title,
      data.NRML.title,
      data.SEML.title,
      data.CSML.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // check that the answer collection is not visible to the user
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${data.SE.collection}"]`).should(
      'not.exist'
    )

    // verify that all activities are shown on the activity overview
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.liveQuiz}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.liveQuiz}-EXECUTE"]`
      )
      .should('exist')

    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.practiceQuiz}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.practiceQuiz}-EXECUTE"]`
      )
      .should('exist')

    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.microLearning}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.microLearning}-EXECUTE"]`
      )
      .should('exist')

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.groupActivity}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.groupActivity}-EXECUTE"]`
      )
      .should('exist')

    // course should be accessible and READ permissions should be granted on all activities
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`)
      .get(`[data-cy="permission-level-${data.sharing.course}-WRITE"]`)
      .should('exist')
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').should('not.exist')

    cy.get('[data-cy="tab-liveQuizzes"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.liveQuiz}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.liveQuiz}-EXECUTE"]`
      )
      .should('exist')

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.practiceQuiz}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.practiceQuiz}-EXECUTE"]`
      )
      .should('exist')

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.microLearning}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.microLearning}-EXECUTE"]`
      )
      .should('exist')

    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(
        propagation
          ? `[data-cy="permission-level-${data.sharing.groupActivity}-WRITE"]`
          : `[data-cy="permission-level-${data.sharing.groupActivity}-EXECUTE"]`
      )
      .should('exist')
  }

  function verifyCourseAdminPermissions({
    data,
    checkBadge,
  }: {
    data: any
    checkBadge: boolean
  }) {
    // check that the elements used in the activities are not visible to the user
    cy.wrap([
      data.SCML.title,
      data.NRML.title,
      data.SEML.title,
      data.CSML.title,
    ]).each((title: string) => {
      cy.validateElement({
        element: title,
        contains: [messages.manage.sharing.permissionsADMIN],
      })
    })

    // check that the answer collection is visible to the user
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${data.collection.name}"]`).should(
      'exist'
    )

    // verify that all activities are shown on the activity overview
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.liveQuiz}-ADMIN"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.practiceQuiz}-ADMIN"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(`[data-cy="permission-level-${data.sharing.microLearning}-ADMIN"]`)
      .should('exist')

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(`[data-cy="permission-level-${data.sharing.groupActivity}-ADMIN"]`)
      .should('exist')

    // course should be accessible and READ permissions should be granted on all activities
    cy.get('[data-cy="courses"]').click()
    if (checkBadge) {
      cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`)
        .get(`[data-cy="permission-level-${data.sharing.course}-ADMIN"]`)
        .should('exist')
    }
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').should('exist')

    cy.get('[data-cy="tab-liveQuizzes"]').click()
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-LIVE_QUIZ-${data.sharing.liveQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.liveQuiz}-ADMIN"]`)
      .should('exist')

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-PRACTICE_QUIZ-${data.sharing.practiceQuiz}"]`)
      .get(`[data-cy="permission-level-${data.sharing.practiceQuiz}-ADMIN"]`)
      .should('exist')

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.microLearning}"]`)
      .get(`[data-cy="permission-level-${data.sharing.microLearning}-ADMIN"]`)
      .should('exist')

    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-GROUP_ACTIVITY-${data.sharing.groupActivity}"]`)
      .get(`[data-cy="permission-level-${data.sharing.groupActivity}-ADMIN"]`)
      .should('exist')
  }

  function verifyCourseAccessLost(data) {
    // verify that the user has no access to any elements
    cy.wrap([
      data.SCML.title,
      data.NRML.title,
      data.SEML.title,
      data.CSML.title,
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // verify that the user has no access to the answer collection
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${data.collection.name}"]`).should(
      'not.exist'
    )

    // verify that the user has no access to the course
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${data.sharing.course}"]`).should(
      'not.exist'
    )
    cy.logoutUser()
  }

  it('Create a new course and assign an activity of each type to it', function () {
    cy.loginLecturer()

    // create a new course
    cy.get('[data-cy="courses"]').click()
    cy.get('[data-cy="course-list-button-new-course"]').click()
    cy.get('[data-cy="course-name"]').type(this.data.sharing.course)
    cy.get('[data-cy="course-display-name"]').type(
      this.data.sharing.courseDisplayName
    )
    cy.get('[data-cy="course-notification-email"]').should(
      'have.value',
      Cypress.env('LECTURER_EMAIL')
    )
    cy.get('[data-cy="course-notification-email"]')
      .clear()
      .type(this.data.sharing.courseNotificationEmail)

    // set course start date one year into the past
    cy.get('[data-cy="course-start-date"]').realClick().wait(100)
    cy.wrap(Array(13).fill(null)).each(() => {
      cy.get('[data-cy="course-start-date-previous-month"]')
        .realClick()
        .wait(100)
    })
    cy.get('[data-cy="course-start-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="course-start-date"]').should(
      'contain',
      getDatetimeValidationString(-12, '15')
    ) // verify that the correct date is selected

    // move the course date 4 years into the future
    // skip to 48 months in the future (default is already first day of next month + 6 months)
    cy.get('[data-cy="course-end-date"]').realClick().wait(100)
    cy.wrap(Array(48 - 7).fill(null)).each(() => {
      cy.get('[data-cy="course-end-date-next-month"]').realClick().wait(100)
    })
    cy.get('[data-cy="course-end-date-calendar"]')
      .findByText('15')
      .realClick()
      .wait(100)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="course-end-date"]').should(
      'contain',
      getDatetimeValidationString(48, '15')
    ) // verify that the correct date is selected

    cy.get('[data-cy="max-group-size"]').click().type('6')
    cy.get('[data-cy="preferred-group-size"]').click().type('4')
    cy.get('[data-cy="manipulate-course-submit"]').click()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.sharing.course).should('exist')
    cy.reload()

    // create four different questions, two of them depending on an answer collection
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionCS({
      name: this.data.CSML.title,
      content: this.data.CSML.content,
      explanation: this.data.CSML.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CSML.selectedItems.includes(i)
      ),
      criteria: this.data.CSML.criteria,
      cases: this.data.CSML.cases,
      solutions: this.data.CSML.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create a live quiz that is assigned to the course
    cy.createLiveQuiz({
      name: this.data.sharing.liveQuiz,
      displayName: this.data.sharing.liveQuiz,
      courseName: this.data.sharing.course,
      blocks: [{ elements: [this.data.SCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a practice quiz that is assigned to the course
    cy.createPracticeQuiz({
      name: this.data.sharing.practiceQuiz,
      displayName: this.data.sharing.practiceQuiz,
      courseName: this.data.sharing.course,
      stacks: [{ elements: [this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a microlearning that is assigned to the course
    cy.createMicroLearning({
      name: this.data.sharing.microLearning,
      displayName: this.data.sharing.microLearning,
      startDate: {
        monthDelta: 12,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(12, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 24,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(24, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      courseName: this.data.sharing.course,
      stacks: [{ elements: [this.data.SEML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a group activity that is assigned to the course
    cy.createGroupActivity({
      name: this.data.sharing.groupActivity,
      displayName: this.data.sharing.groupActivity,
      task: 'Task Description',
      courseName: this.data.sharing.course,
      scheduledStartDate: {
        monthDelta: 12,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(12, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      scheduledEndDate: {
        monthDelta: 24,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(24, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      clues: [
        {
          type: 'text',
          name: 'Clue 1',
          displayName: 'First Hint',
          content: 'Lorem ipsum dolor sit amet',
        },
        {
          type: 'text',
          name: 'Clue 2',
          displayName: 'Second Hint',
          content: 'Consectetur adipiscing elit',
        },
      ],
      stack: {
        elements: [this.data.CSML.title],
      },
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // verify that all activities are listed correctly in the course
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()

    cy.get('[data-cy="tab-liveQuizzes"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.sharing.liveQuiz}"]`
    ).should('exist')

    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.sharing.practiceQuiz}"]`
    ).should('exist')

    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.sharing.microLearning}"]`
    ).should('exist')

    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="publish-group-activity-${this.data.sharing.groupActivity}"]`
    ).should('exist')
  })

  it('Share the course directly with other users with READ, EXECUTE, WRITE and ADMIN permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    // share the course with READ permissions with user pro1
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)

    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)

    // share the course with EXECUTE permissions with user pro2
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsEXECUTE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsEXECUTE
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)

    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsEXECUTE)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')

    // share the course with WRITE permissions with user pro3
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)

    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')

    // share the course with WRITE permissions with user pro4 (with propagation)
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST3_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-propagation"]').realClick()
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)

    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'checked')

    // share the course with ADMIN permissions with user pro5
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST4_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)

    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')
  })

  it('Verify that the user with individual READ permissions can only see course & activities with READ permissions', function () {
    cy.loginIndividualCatalyst()
    verifyCourseReadPermissions({ data: this.data })
  })

  it('Verify that the user with individual EXECUTE permissions can only see course & activities with EXECUTE permissions', function () {
    cy.loginInstitutionalCatalyst()
    verifyCourseExecutePermissions({ data: this.data })
  })

  it('Verify that the user with individual WRITE permissions (no propagation) can only see course & activities with EXECUTE permissions', function () {
    cy.loginInstitutionalCatalyst2()
    verifyCourseWritePermissions({ data: this.data, propagation: false })
  })

  it('Verify that the user with individual WRITE permissions (with propagation) can only see course & activities with WRITE permissions', function () {
    cy.loginInstitutionalCatalyst3()
    verifyCourseWritePermissions({ data: this.data, propagation: true })
  })

  it('Verify that the user with individual ADMIN permissions can see course, activities, elements, and the answer collection', function () {
    cy.loginInstitutionalCatalyst4()
    verifyCourseAdminPermissions({ data: this.data, checkBadge: true })
  })

  it('Change the course ADMIN permission to WRITE level for user pro5 (without propagation)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-level-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).realClick()
    cy.get('[data-cy="permission-level-WRITE"]').realClick()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsWRITE)
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
  })

  it('Verify that the user with new WRITE permissions (without propagation) can only see course & activities with EXECUTE permissions', function () {
    cy.loginInstitutionalCatalyst4()
    verifyCourseWritePermissions({ data: this.data, propagation: false })
  })

  it('Activate propagation for the WRITE permission of user pro5', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).realClick()
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'checked')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
  })

  it('Verify that the user with new WRITE permissions (with propagation) can only see course & activities with WRITE permissions', function () {
    cy.loginInstitutionalCatalyst4()
    verifyCourseWritePermissions({ data: this.data, propagation: true })
  })

  it('Revoke all individual permissions and verify that the users cannot see the course and its content anymore', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')

    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)

    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')

    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')

    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`
    ).should('not.exist')

    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST4_SHORTNAME')}"]`
    ).should('not.exist')
    cy.logoutUser()

    cy.loginIndividualCatalyst()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst2()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst3()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst4()
    verifyCourseAccessLost(this.data)
  })

  it('Create user groups and share the course directly with other users with READ, EXECUTE, WRITE and ADMIN permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    // create user groups with users pro1, pro2 and pro3
    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group1)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_IND_EMAIL')) // pro1 is added as user
    cy.get('[data-cy="submit-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group2)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST_EMAIL')) // pro2 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group3)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME')) // pro3 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.logoutUser()

    // create user group with user pro1 in account of pro4
    cy.loginInstitutionalCatalyst3()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group4)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_SHORTNAME'))
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.logoutUser()

    // create user group with user pro1 in account of pro5
    cy.loginInstitutionalCatalyst4()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group5)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_SHORTNAME'))
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.logoutUser()

    // share the course with READ, EXECUTE, WRITE and ADMIN permissions with user groups
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    // share the course with READ permissions with user group group1
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption(
      '[data-cy="new-permission-user-group"]',
      this.data.sharing.group1
    )
    cy.get('[data-cy="new-permission-user-group"]').contains(
      this.data.sharing.group1
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.sharing.group1}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group1}"]`
    ).should('have.attr', 'data-state', 'unchecked')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)

    // share the course with EXECUTE permissions with user group group2
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption(
      '[data-cy="new-permission-user-group"]',
      this.data.sharing.group2
    )
    cy.get('[data-cy="new-permission-user-group"]').contains(
      this.data.sharing.group2
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsEXECUTE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsEXECUTE
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.sharing.group2}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsEXECUTE)
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group2}"]`
    ).should('have.attr', 'data-state', 'unchecked')

    // share the course with WRITE permissions with user group group3 (without propagation)
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption(
      '[data-cy="new-permission-user-group"]',
      this.data.sharing.group3
    )
    cy.get('[data-cy="new-permission-user-group"]').contains(
      this.data.sharing.group3
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.sharing.group3}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group3}"]`
    ).should('have.attr', 'data-state', 'unchecked')

    // share the course with WRITE permissions with user group group4 (with propagation)
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption(
      '[data-cy="new-permission-user-group"]',
      this.data.sharing.group4
    )
    cy.get('[data-cy="new-permission-user-group"]').contains(
      this.data.sharing.group4
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-propagation"]').realClick()
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.sharing.group4}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group4}"]`
    ).should('have.attr', 'data-state', 'checked')

    // share the course with ADMIN permissions with user group group5 (with propagation)
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption(
      '[data-cy="new-permission-user-group"]',
      this.data.sharing.group5
    )
    cy.get('[data-cy="new-permission-user-group"]').contains(
      this.data.sharing.group5
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.sharing.group5}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group5}"]`
    ).should('have.attr', 'data-state', 'unchecked')
  })

  it('Verify that the user in group 1 can see the objects according to course READ permissions', function () {
    cy.loginIndividualCatalyst()
    verifyCourseReadPermissions({ data: this.data })
  })

  it('Verify that the user in group 2 can see the objects according to course EXECUTE permissions', function () {
    cy.loginInstitutionalCatalyst()
    verifyCourseExecutePermissions({ data: this.data })
  })

  it('Verify that the user in group 3 can see the objects according to course WRITE permissions (without propagation)', function () {
    cy.loginInstitutionalCatalyst2()
    verifyCourseWritePermissions({ data: this.data, propagation: false })
  })

  it('Verify that the user in group 4 can see the objects according to course WRITE permissions (with propagation)', function () {
    cy.loginInstitutionalCatalyst3()
    verifyCourseWritePermissions({ data: this.data, propagation: true })
  })

  it('Verify that the user in group 5 can see the objects according to course ADMIN permissions', function () {
    cy.loginInstitutionalCatalyst4()
    verifyCourseAdminPermissions({ data: this.data, checkBadge: true })
  })

  it('Change the course ADMIN permission to WRITE level for user group 5 (without propagation)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    cy.get(`[data-cy="permission-${this.data.sharing.group5}"]`).contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get(
      `[data-cy="permission-level-${this.data.sharing.group5}"]`
    ).realClick()
    cy.get('[data-cy="permission-level-WRITE"]').realClick()
    cy.get(`[data-cy="permission-${this.data.sharing.group5}"]`).contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
  })

  it('Verify that the user in group 5 can see the objects according to course WRITE permissions (without propagation)', function () {
    cy.loginInstitutionalCatalyst4()
    verifyCourseWritePermissions({ data: this.data, propagation: false })
  })

  it('Activate propagation for the WRITE permission of user group 5', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group5}"]`
    ).should('have.attr', 'data-state', 'unchecked')
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group5}"]`
    ).realClick()
    cy.get(
      `[data-cy="permission-propagation-${this.data.sharing.group5}"]`
    ).should('have.attr', 'data-state', 'checked')
  })

  it('Verify that the user with new WRITE permissions (with propagation) can only see course & activities with WRITE permissions', function () {
    cy.loginInstitutionalCatalyst4()
    verifyCourseWritePermissions({ data: this.data, propagation: true })
  })

  it('Revoke all user group permissions and verify that the users cannot see the course and its content anymore', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
    cy.get(`[data-cy="permission-${this.data.sharing.group1}"]`).should('exist')

    cy.get(`[data-cy="revoke-permission-${this.data.sharing.group1}"]`).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(`[data-cy="permission-${this.data.sharing.group1}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="revoke-permission-${this.data.sharing.group2}"]`).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(`[data-cy="permission-${this.data.sharing.group2}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="revoke-permission-${this.data.sharing.group3}"]`).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(`[data-cy="permission-${this.data.sharing.group3}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="revoke-permission-${this.data.sharing.group4}"]`).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(`[data-cy="permission-${this.data.sharing.group4}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="revoke-permission-${this.data.sharing.group5}"]`).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(`[data-cy="permission-${this.data.sharing.group5}"]`).should(
      'not.exist'
    )
    cy.logoutUser()

    cy.loginIndividualCatalyst()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst2()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst3()
    verifyCourseAccessLost(this.data)

    cy.loginInstitutionalCatalyst4()
    verifyCourseAccessLost(this.data)
  })

  it("Transfer ownership of the course to user 'pro1' using the username", function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    // share the course with ADMIN permissions with user pro1
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-propagation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)

    // transfer ownership to user pro1
    cy.get('[data-cy="transfer-ownership"]').click()
    cy.get('[data-cy="new-owner-username-email-input"]').type(
      Cypress.env('LECTURER_IND_SHORTNAME')
    )
    cy.get('[data-cy="confirm-ownership-transfer"]').click()

    // verify that the correct permissions are displayed
    cy.get('[data-cy="transfer-ownership"]').should('not.exist')
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="owner-permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    )
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
  })

  it("Verify that user 'pro1' is the new owner and transfer the ownership back to the main user", function () {
    cy.loginIndividualCatalyst()

    // the user with ownership rights should now see all the activities, elemetns and resources in the course
    verifyCourseAdminPermissions({ data: this.data, checkBadge: false })

    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="delete-course-${this.data.sharing.course}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-course-${this.data.sharing.course}"]`).should(
      'not.exist'
    ) // removal only possible for shared courses
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()

    // transfer ownership back to the main user
    cy.get('[data-cy="transfer-ownership"]').click()
    cy.get('[data-cy="new-owner-username-email-input"]').type(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get('[data-cy="confirm-ownership-transfer"]').click()
    cy.get('[data-cy="transfer-ownership"]').should('not.exist')
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-propagation-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('have.attr', 'data-state', 'unchecked')
  })

  it("Remove the shared course from user 'pro1' using the removal functionality", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="remove-course-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="confirm-deletion-final"]').click()
    cy.get('[data-cy="confirm-dependency-access"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).should(
      'not.exist'
    )
    cy.logoutUser()

    // verify in the main user account that the corresponding admin permission was removed as well
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.sharing.course}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(`[data-cy="owner-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsOWNER)
  })
  // #endregion
})
