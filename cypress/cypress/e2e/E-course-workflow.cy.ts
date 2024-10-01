import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

describe('Test course creation and editing functionalities', () => {
  const name = 'Z' + uuid()
  const displayName = name
  const description = uuid()
  const testCourseName = 'Testkurs'
  const currentYear = new Date().getFullYear()

  // it('Test the assignment of random groups in the seeded test course', () => {
  //   const testCourse = 'Testkurs'

  //   // log into frontend-manage
  //   cy.loginLecturer()

  //   // switch to course list
  //   cy.get('[data-cy="courses"]').click()
  //   cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
  //   cy.get('[data-cy="course-name-with-pin"]').should('contain', testCourse)

  //   // switch to the group leaderboard, assign random groups and verify that groups have been created
  //   cy.get('[data-cy="tab-groups"]').click()
  //   cy.get('[data-cy="assign-random-groups"]').click()
  //   cy.get('[data-cy="cancel-random-group-assignment"]').click()
  //   cy.get('[data-cy="assign-random-groups"]').click()
  //   cy.get('[data-cy="confirm-random-group-assignment"]').click()
  //   cy.wait(1000)
  //   cy.get('[data-cy="assign-random-groups"]').should('not.exist')
  //   cy.findByText(
  //     messages.manage.course.groupAssignmentFinalizedMessage
  //   ).should('exist')

  //   // move course end date and group creation deadline to the future, making random group assignment possible again
  //   cy.get('[data-cy="course-settings-button"]').click()
  //   cy.get('[data-cy="course-end-date-button"]').click()
  //   cy.get('[data-cy="course-end-date"]').type(`${currentYear + 3}-01-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').type(
  //     `${currentYear + 2}-01-01`
  //   )
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="manipulate-course-submit"]').click()
  //   cy.get('[data-cy="assign-random-groups"]')
  //     .should('exist')
  //     .should('be.disabled')
  //   cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
  //     'exist'
  //   )

  //   // login with first student that is part of a group - leave group and join pool
  //   cy.clearAllCookies()
  //   cy.clearAllLocalStorage()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME10'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get(`[data-cy="course-button-${testCourse}"]`).click()
  //   cy.get('[data-cy="student-course-existing-group-0"]').click()
  //   cy.get('[data-cy="leave-leaderboard"]').click()
  //   cy.wait(1000)
  //   cy.get('[data-cy="student-course-create-group"]').click()
  //   cy.get('[data-cy="enter-random-group-pool"]').click()
  //   cy.findByText(messages.pwa.courses.leaveRandomGroupPool).should('exist')

  //   // login as the lecturer again and check the course overview
  //   cy.clearAllCookies()
  //   cy.clearAllLocalStorage()
  //   cy.loginLecturer()
  //   cy.get('[data-cy="courses"]').click()
  //   cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
  //   cy.get('[data-cy="course-name-with-pin"]').should('contain', testCourse)
  //   cy.get('[data-cy="tab-groups"]').click()

  //   // check if first student is in pool, but assignment is still not possible
  //   cy.get('[data-cy="random-group-assignment-pool"]').findByText(
  //     Cypress.env('STUDENT_USERNAME10')
  //   )
  //   cy.get('[data-cy="assign-random-groups"]').should('exist')
  //   cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
  //     'not.exist'
  //   ) // -> there are groups with a single participant available

  //   // login as the student without group and join the random pool as well
  //   cy.clearAllCookies()
  //   cy.clearAllLocalStorage()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME11'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get(`[data-cy="course-button-${testCourse}"]`).click()
  //   cy.get('[data-cy="student-course-existing-group-0"]').click()
  //   cy.get('[data-cy="leave-leaderboard"]').click()
  //   cy.wait(1000)
  //   cy.get('[data-cy="student-course-create-group"]').click()
  //   cy.get('[data-cy="enter-random-group-pool"]').click()
  //   cy.findByText(messages.pwa.courses.leaveRandomGroupPool).should('exist')

  //   // check if first student is in pool, but assignment is still not possible
  //   cy.clearAllCookies()
  //   cy.clearAllLocalStorage()
  //   cy.loginLecturer()
  //   cy.get('[data-cy="courses"]').click()
  //   cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
  //   cy.get('[data-cy="course-name-with-pin"]').should('contain', testCourse)
  //   cy.get('[data-cy="tab-groups"]').click()
  //   cy.get('[data-cy="random-group-assignment-pool"]').findByText(
  //     Cypress.env('STUDENT_USERNAME11')
  //   )
  //   cy.get('[data-cy="assign-random-groups"]')
  //     .should('exist')
  //     .should('not.be.disabled')
  //   cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
  //     'not.exist'
  //   )
  //   cy.get('[data-cy="assign-random-groups"]').click()
  //   cy.get('[data-cy="confirm-random-group-assignment"]').click()

  //   // check that the pool with participants does no longer exist
  //   cy.get('[data-cy="random-group-assignment-pool"]').should('not.exist')
  // })

  // it('Test the creation of a new course', () => {
  //   // log into frontend-manage
  //   cy.loginLecturer()

  //   // switch to course list
  //   cy.get('[data-cy="courses"]').click()

  //   // create a new course
  //   cy.get('[data-cy="course-list-button-new-course"]').click()

  //   // fill in the form
  //   cy.get('[data-cy="course-name"]').type(name)
  //   cy.get('[data-cy="course-display-name"]').type(displayName)
  //   cy.get('[data-cy="course-description"]').focus().type(description)

  //   // change the start date
  //   cy.get('[data-cy="course-start-date-button"]').click()
  //   cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-01-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value

  //   // change the end date
  //   cy.get('[data-cy="course-end-date-button"]').click()
  //   cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-01-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value

  //   // change course color to red
  //   cy.get('[data-cy="course-color-trigger"]').click()
  //   cy.get('[data-cy="course-color-hex-input"]').clear()
  //   cy.get('[data-cy="course-color-hex-input"]').type('FF0000')
  //   cy.get('[data-cy="course-color-submit"]').click()

  //   // test gamification toggle
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'checked'
  //   )
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'unchecked'
  //   )
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'checked'
  //   )
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'unchecked'
  //   )

  //   // submit the form
  //   cy.get('[data-cy="manipulate-course-submit"]').click()

  //   // check if the course is in the list
  //   cy.get('[data-cy="courses"]').click()
  //   cy.findByText(name).should('exist')
  // })

  // it('Check the content of the course overview and edit course properties', () => {
  //   // log into frontend-manage
  //   cy.loginLecturer()

  //   // check if the course is in the detail view
  //   cy.get('[data-cy="courses"]').click()
  //   cy.get(`[data-cy="course-list-button-${name}"]`).click()
  //   cy.get('[data-cy="course-name-with-pin"]').should('contain', name)

  //   // check out course join modal
  //   cy.get('[data-cy="course-join-button"]').click()
  //   cy.get('[data-cy="course-join-modal"]').should('exist')
  //   cy.get('[data-cy="course-join-modal"]').should('contain', 'QR Code')
  //   cy.get('[data-cy="course-join-modal-close"]').click()

  //   // open the settings dialogue
  //   cy.get('[data-cy="course-settings-button"]').click()

  //   // check if the name properties have been set correctly
  //   cy.get('[data-cy="course-name"]').should('have.value', name)
  //   cy.get('[data-cy="course-display-name"]').should('have.value', displayName)

  //   // change the course name
  //   const newName = 'A' + uuid()
  //   const newDisplayName = 'B' + uuid()
  //   const newDescription = uuid()
  //   cy.get('[data-cy="course-name"]').clear().type(newName)
  //   cy.get('[data-cy="course-display-name"]').clear().type(newDisplayName)
  //   cy.get('[data-cy="course-description"]')
  //     .clear()
  //     .focus()
  //     .type(newDescription)

  //   // check course color and change it to green
  //   cy.get('[data-cy="course-color-trigger"]').click()
  //   cy.get('[data-cy="course-color-hex-input"]').should('have.value', 'FF0000')
  //   cy.get('[data-cy="course-color-hex-input"]').clear()
  //   cy.get('[data-cy="course-color-hex-input"]').type('00FF00')
  //   cy.get('[data-cy="course-color-submit"]').click()

  //   // check course start date and change it
  //   cy.get('[data-cy="course-start-date-button"]').click()
  //   cy.get('[data-cy="course-start-date"]').should(
  //     'have.value',
  //     `${currentYear + 1}-01-01`
  //   )
  //   cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-02-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value

  //   // check course end date and change it
  //   cy.get('[data-cy="course-end-date-button"]').click()
  //   cy.get('[data-cy="course-end-date"]').should(
  //     'have.value',
  //     `${currentYear + 2}-01-01`
  //   )
  //   cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-02-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value

  //   // enable gamification for the created course and check that it worked (switch active and disabled)
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'unchecked'
  //   )
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'checked'
  //   )

  //   // save settings and check correct values afterwards (gamification should be enabled & blocked)
  //   cy.get('[data-cy="manipulate-course-submit"]').click()
  //   cy.get('[data-cy="course-settings-button"]').click()
  //   cy.get('[data-cy="course-name"]').should('have.value', newName)
  //   cy.get('[data-cy="course-display-name"]').should(
  //     'have.value',
  //     newDisplayName
  //   )
  //   cy.get('[data-cy="course-start-date-button"]').click()
  //   cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-02-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="course-end-date-button"]').click()
  //   cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-02-01`)
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'checked'
  //   )
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'disabled',
  //     'disabled'
  //   )
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').should(
  //     'not.have.attr',
  //     'disabled',
  //     'disabled'
  //   )
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').click()
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').should(
  //     'have.attr',
  //     'data-state',
  //     'checked'
  //   )

  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').type(
  //     `${currentYear + 3}-01-01`
  //   )
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').type(
  //     `${currentYear + 1}-06-01`
  //   )
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
  //   cy.get('[data-cy="max-group-size"]').should('have.value', '5')
  //   cy.get('[data-cy="max-group-size"]').clear().type('10')
  //   cy.get('[data-cy="max-group-size"]').should('have.value', '10')
  //   cy.get('[data-cy="preferred-group-size"]').should('have.value', '3')
  //   cy.get('[data-cy="preferred-group-size"]').clear().type('4')
  //   cy.get('[data-cy="preferred-group-size"]').should('have.value', '4')
  //   cy.get('[data-cy="manipulate-course-submit"]').click()

  //   // check if the group creation deadline has been set correctly
  //   cy.get('[data-cy="course-settings-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').should(
  //     'have.value',
  //     `${currentYear + 1}-06-01`
  //   )
  // })

  // it('Test the creation of a new gamified course', () => {
  //   // log into frontend-manage
  //   cy.loginLecturer()

  //   // switch to course list
  //   cy.get('[data-cy="courses"]').click()

  //   // create a new course
  //   cy.get('[data-cy="course-list-button-new-course"]').click()

  //   // fill in the form
  //   cy.get('[data-cy="course-name"]').type(name)
  //   cy.get('[data-cy="course-display-name"]').type(displayName)

  //   // change the start date
  //   cy.get('[data-cy="course-start-date-button"]').click()
  //   cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-01-01`)
  //   // click outside to save the value
  //   cy.get('[data-cy="course-name"]').click()

  //   // change the end date
  //   cy.get('[data-cy="course-end-date-button"]').click()
  //   cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-01-01`)
  //   // click outside to save the value
  //   cy.get('[data-cy="course-name"]').click()

  //   // test gamification toggle
  //   cy.get('[data-cy="course-gamification"]').should(
  //     'have.attr',
  //     'data-state',
  //     'checked'
  //   )
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').should(
  //     'not.be.disabled'
  //   )
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').should('be.disabled')
  //   cy.get('[data-cy="group-creation-deadline"]').should('not.exist')
  //   cy.get('[data-cy="max-group-size"]').should('not.exist')
  //   cy.get('[data-cy="preferred-group-size"]').should('not.exist')

  //   // check if the values of the form are properly reset if gamification is disabled
  //   cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').click()
  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').clear()
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="max-group-size"]').clear()
  //   cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')

  //   // change group settings
  //   cy.get('[data-cy="course-gamification"]').click()
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').should(
  //     'not.be.disabled'
  //   )
  //   cy.get('[data-cy="toggle-group-creation-enabled"]').click()
  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').type(
  //     `${currentYear + 3}-01-01`
  //   )
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
  //   cy.get('[data-cy="group-creation-deadline-button"]').click()
  //   cy.get('[data-cy="group-creation-deadline"]').type(
  //     `${currentYear + 1}-06-01`
  //   )
  //   cy.get('[data-cy="course-name"]').click() // click outside to save the value
  //   cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
  //   cy.get('[data-cy="max-group-size"]').click().type('10')
  //   cy.get('[data-cy="preferred-group-size"]').click().type('4')

  //   // submit the form
  //   cy.get('[data-cy="manipulate-course-submit"]').click()

  //   // check if the course is in the list
  //   cy.get('[data-cy="courses"]').click()
  //   cy.findByText(name).should('exist')
  // })

  // it('Test the course overview on the student side', () => {
  //   // log into the student frontend
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.clearAllCookies()
  //   cy.clearAllLocalStorage()
  //   cy.viewport('iphone-x')
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.wait(1000)

  //   // check for the existince of the test course
  //   cy.get(`[data-cy="course-button-${testCourseName}"]`).click()
  //   cy.get('[data-cy="student-course-leaderboard-tab"]').should('exist')

  //   // check if the leaderboards exist
  //   cy.findByText(messages.pwa.courses.individualLeaderboard).should('exist')
  //   cy.findByText(messages.pwa.courses.groupLeaderboard).should('exist')

  //   // TODO: join the course created above (extract the pin after generation)
  // })

  it('Test archiving and deleting courses', () => {
    // ! Test archiving and unarchiving a course
    const runningCourse = 'Testkurs'
    const pastCourse = 'Testkurs 2'

    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${runningCourse}"]`).should('exist')
    cy.get(`[data-cy="course-list-button-${pastCourse}"]`).should('exist')

    // check the archiving functionality
    cy.get(`[data-cy="archive-course-${runningCourse}"]`).should('be.disabled')
    cy.get(`[data-cy="archive-course-${pastCourse}"]`)
      .should('not.be.disabled')
      .click()
    cy.findByText(messages.manage.courseList.confirmCourseArchive).should(
      'exist'
    )
    cy.get('[data-cy="course-archive-modal-cancel"]').click()
    cy.get(`[data-cy="archive-course-${pastCourse}"]`).click()
    cy.get('[data-cy="course-archive-modal-confirm"]').click()
    cy.get(`[data-cy="course-list-button-${pastCourse}"]`).should('not.exist')

    // check out the archive and re-activate the past course
    cy.get('[data-cy="toggle-course-archive"]').click()
    cy.get(`[data-cy="course-list-button-${pastCourse}"]`).should('exist')
    cy.get(`[data-cy="archive-course-${pastCourse}"]`).click()
    cy.findByText(messages.manage.courseList.confirmCourseUnarchive).should(
      'exist'
    )
    cy.get('[data-cy="course-archive-modal-confirm"]').click()
    cy.get('[data-cy="toggle-course-archive"]').click()
    cy.get(`[data-cy="course-list-button-${pastCourse}"]`).should('exist')

    // ! Create a course with live quiz, practice quiz, and microlearning, and delete it again
    const courseDelName = 'Course to be deleted' + uuid()
    const displayName = courseDelName + ' display'

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()
    cy.get('[data-cy="course-name"]').type(courseDelName)
    cy.get('[data-cy="course-display-name"]').type(displayName)
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="manipulate-course-submit"]').click()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseDelName).should('exist')
    cy.reload()

    // create a question with sample solution
    const questionTitle = 'Title ' + uuid()
    const question = 'Content ' + uuid()
    const liveQuizName = uuid()

    cy.get('[data-cy="questions"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click()
    cy.get('[data-cy="add-new-answer"]').click()
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click()

    // create a live quiz in the course
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(liveQuizName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(liveQuizName)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseDelName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseDelName)
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="create-new-element"]').click()

    // create a practice quiz in the course
    const quizName = 'Quiz ' + uuid()
    const quizDisplayName = quizName + ' display'
    cy.get('[data-cy="create-practice-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-practice-quiz"]').click()

    // step 1
    cy.get('[data-cy="insert-practice-quiz-name"]').click().type(quizName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(quizDisplayName)
    cy.get('[data-cy="insert-practice-quiz-description"]')
      .click()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseDelName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseDelName)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer2,
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="create-new-element"]').click()

    // create a microlearning in the course
    const microLearningName = 'Microlearning ' + uuid()
    const microLearningDisplayName = microLearningName + ' display'

    cy.get('[data-cy="create-microlearning"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
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
    cy.get(`[data-cy="select-course-${courseDelName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseDelName)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3 - add questions
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    const dataTransfer3 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer3,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer3,
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="create-new-element"]').click()

    // delete the course and check that it is not visible anymore after a reload
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseDelName}"]`).should('exist')
    cy.get(`[data-cy="delete-course-${courseDelName}"]`).click()
    cy.get('[data-cy="course-deletion-modal-cancel"]').click()
    cy.get(`[data-cy="delete-course-${courseDelName}"]`).click()
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
    cy.get(`[data-cy="course-list-button-${courseDelName}"]`).should(
      'not.exist'
    )
    cy.reload()
    cy.get(`[data-cy="course-list-button-${courseDelName}"]`).should(
      'not.exist'
    )

    // check that the live quiz has been removed from the course
    cy.get('[data-cy="sessions"]').click()
    cy.contains('[data-cy="session-block"]', liveQuizName)
    cy.get(`[data-cy="edit-session-${liveQuizName}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(
      messages.manage.sessionForms.liveQuizNoCourse
    )
  })
})
