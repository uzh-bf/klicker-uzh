import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

describe('Test course creation and editing functionalities', () => {
  const courseName = 'Course e265bead-e3a9-4aa9-b76b-eb8c6637d9f6'
  const courseNameNew = 'Course 326ff897-554e-4b37-af6f-4c6e47efb775 NEW'
  const courseName2 = 'Course 33a79abc-debc-4374-9405-38e99f92fba8'
  const courseDisplayName = courseName + ' (Display)'
  const courseDisplayNameNew = courseNameNew + ' (Display)'
  const courseDisplayName2 = courseName2 + ' (Display)'
  const description = uuid()
  const runningTestCourse = 'Testkurs'
  const pastTestcourse = 'Testkurs 2'
  const currentYear = new Date().getFullYear()

  it('Test the creation of a new course without gamification', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="course-name"]').type(courseName)
    cy.get('[data-cy="course-display-name"]').type(courseDisplayName)
    cy.get('[data-cy="course-description"]').focus().type(description)

    // change the start date
    cy.get('[data-cy="course-start-date-button"]').click()
    cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-01-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // change the end date
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-01-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

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
    cy.findByText(courseName).should('exist')
  })

  it('Test the creation of a new gamified course', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="course-name"]').type(courseName2)
    cy.get('[data-cy="course-display-name"]').type(courseDisplayName2)

    // change the start date
    cy.get('[data-cy="course-start-date-button"]').click()
    cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-01-01`)
    // click outside to save the value
    cy.get('[data-cy="course-name"]').click()

    // change the end date
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-01-01`)
    // click outside to save the value
    cy.get('[data-cy="course-name"]').click()

    // test gamification toggle
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="toggle-group-creation-enabled"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="toggle-group-creation-enabled"]').should('be.disabled')
    cy.get('[data-cy="group-creation-deadline"]').should('not.exist')
    cy.get('[data-cy="max-group-size"]').should('not.exist')
    cy.get('[data-cy="preferred-group-size"]').should('not.exist')

    // check if the values of the form are properly reset if gamification is disabled
    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="toggle-group-creation-enabled"]').click()
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').clear()
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="max-group-size"]').clear()
    cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')

    // change group settings
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="toggle-group-creation-enabled"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="toggle-group-creation-enabled"]').click()
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').type(
      `${currentYear + 3}-01-01`
    )
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').type(
      `${currentYear + 1}-06-01`
    )
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="manipulate-course-submit"]').should('not.be.disabled')
    cy.get('[data-cy="max-group-size"]').click().clear().type('6')
    cy.get('[data-cy="preferred-group-size"]').click().clear().type('4')

    // submit the form
    cy.get('[data-cy="manipulate-course-submit"]').click()

    // check if the course is in the list
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseName2).should('exist')

    // check that random group assignment should be disabled
    cy.get(`[data-cy="course-list-button-${courseName2}"]`).click()
    cy.get('[data-cy="tab-groups"]').click()
    cy.get('[data-cy="assign-random-groups"]').should('be.disabled')
    cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
      'exist'
    )
  })

  it('Have 10 students join the course and the random assignment pool', () => {
    // get the course PIN from the lecturer view
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseName2}"]`).click()
    cy.get('[data-cy="course-pin"]')
      .invoke('text')
      .then(($coursePin) => {
        cy.wrap($coursePin).as('coursePin')
      })

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
      cy.loginStudentPassword({ username: studentUsername })

      // join the course
      cy.get('[data-cy="join-new-course"]').click()
      cy.get('@coursePin').then((pin) => {
        cy.get('[data-cy="join-course-pin-field"]').type(String(pin))
      })
      cy.get('[data-cy="join-course-submit-form"]').click()

      // join the random assignment pool
      cy.get(`[data-cy="course-button-${courseDisplayName2}"]`).click()
      cy.get('[data-cy="student-course-create-group"]').click()
      cy.get('[data-cy="enter-random-group-pool"]').click()
      cy.findByText(messages.pwa.courses.leaveRandomGroupPool).should('exist')
    }
  })

  it('Have 2 students join the course and create groups by themselves', () => {
    // get the course PIN from the lecturer view
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseName2}"]`).click()
    cy.get('[data-cy="course-pin"]')
      .invoke('text')
      .then(($coursePin) => {
        cy.wrap($coursePin).as('coursePin')
      })

    // student 11 joins course and creates a group by himself
    const groupName11 = 'Group Student 11'
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME11') })
    cy.get('[data-cy="join-new-course"]').click()
    cy.get('@coursePin').then((pin) => {
      cy.get('[data-cy="join-course-pin-field"]').type(String(pin))
    })
    cy.get('[data-cy="join-course-submit-form"]').click()
    cy.get(`[data-cy="course-button-${courseDisplayName2}"]`).click()
    cy.get('[data-cy="student-course-create-group"]').click()
    cy.get('[data-cy="group-creation-name-input"]').type(groupName11)
    cy.get('[data-cy="create-new-participant-group"]').click()

    // student 12 joins course and creates a group by himself
    const groupName12 = 'Group Student 12'
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME12') })
    cy.get('[data-cy="join-new-course"]').click()
    cy.get('@coursePin').then((pin) => {
      cy.get('[data-cy="join-course-pin-field"]').type(String(pin))
    })
    cy.get('[data-cy="join-course-submit-form"]').click()
    cy.get(`[data-cy="course-button-${courseDisplayName2}"]`).click()
    cy.get('[data-cy="student-course-create-group"]').click()
    cy.get('[data-cy="group-creation-name-input"]').type(groupName12)
    cy.get('[data-cy="create-new-participant-group"]').click()
  })

  it('Trigger the random group assignment for the gamified course', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseName2}"]`).click()
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

  it('Check from the student view that they have been assigned to groups successfully', () => {
    for (const studentUsername of [
      Cypress.env('STUDENT_USERNAME'),
      Cypress.env('STUDENT_USERNAME2'),
      Cypress.env('STUDENT_USERNAME3'),
      Cypress.env('STUDENT_USERNAME11'),
      Cypress.env('STUDENT_USERNAME12'),
    ]) {
      cy.loginStudentPassword({ username: studentUsername })

      // check that an existing group is present
      cy.get(`[data-cy="course-button-${courseDisplayName2}"]`).click()
      cy.get('[data-cy="student-course-create-group"]').should('not.exist')
    }
  })

  it('Check that if group formation deadline is moved into the future, randomized assignment is possible again', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseName2}"]`).click()

    // modify the course end date and group creation deadline
    cy.get('[data-cy="course-settings-button"]').click()
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').type(`${currentYear + 3}-01-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').type(
      `${currentYear + 2}-01-01`
    )
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
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

  it('Check the content of the course overview and edit course properties', () => {
    // log into frontend-manage
    cy.loginLecturer()

    // check if the course is in the detail view
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseName}"]`).click()
    cy.get('[data-cy="course-name-with-pin"]').should('contain', courseName)

    // check out course join modal
    cy.get('[data-cy="course-join-button"]').click()
    cy.get('[data-cy="course-join-modal"]').should('exist')
    cy.get('[data-cy="course-join-modal"]').should('contain', 'QR Code')
    cy.get('[data-cy="course-join-modal-close"]').click()

    // open the settings dialogue
    cy.get('[data-cy="course-settings-button"]').click()

    // check if the name properties have been set correctly
    cy.get('[data-cy="course-name"]').should('have.value', courseName)
    cy.get('[data-cy="course-display-name"]').should(
      'have.value',
      courseDisplayName
    )

    // change the course name
    cy.get('[data-cy="course-name"]').clear().type(courseNameNew)
    cy.get('[data-cy="course-display-name"]').clear().type(courseDisplayNameNew)

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
      `${currentYear + 1}-01-01`
    )
    cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-02-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

    // check course end date and change it
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').should(
      'have.value',
      `${currentYear + 2}-01-01`
    )
    cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-02-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value

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
    cy.get('[data-cy="course-name"]').should('have.value', courseNameNew)
    cy.get('[data-cy="course-display-name"]').should(
      'have.value',
      courseDisplayNameNew
    )
    cy.get('[data-cy="course-start-date-button"]').click()
    cy.get('[data-cy="course-start-date"]').type(`${currentYear + 1}-02-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="course-end-date-button"]').click()
    cy.get('[data-cy="course-end-date"]').type(`${currentYear + 2}-02-01`)
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="course-gamification"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="toggle-group-creation-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="toggle-group-creation-enabled"]').click()
    cy.get('[data-cy="toggle-group-creation-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )

    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').type(
      `${currentYear + 3}-01-01`
    )
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
    cy.get('[data-cy="manipulate-course-submit"]').should('be.disabled')
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').type(
      `${currentYear + 1}-06-01`
    )
    cy.get('[data-cy="course-name"]').click() // click outside to save the value
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
    cy.get('[data-cy="group-creation-deadline-button"]').click()
    cy.get('[data-cy="group-creation-deadline"]').should(
      'have.value',
      `${currentYear + 1}-06-01`
    )
  })

  it('Test if the course leaderboards are visible on the student app', () => {
    cy.loginStudent()

    // check for the existince of the test course
    cy.get(`[data-cy="course-button-${runningTestCourse}"]`).click()
    cy.get('[data-cy="student-course-leaderboard-tab"]').should('exist')

    // check if the leaderboards exist
    cy.findByText(messages.pwa.courses.individualLeaderboard).should('exist')
    cy.findByText(messages.pwa.courses.groupLeaderboard).should('exist')
  })

  it('Test course archive functionality', () => {
    // login and switch to course list
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${runningTestCourse}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="course-list-button-${pastTestcourse}"]`).should('exist')

    // check the archiving functionality
    cy.get(`[data-cy="archive-course-${runningTestCourse}"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="archive-course-${pastTestcourse}"]`)
      .should('not.be.disabled')
      .click()
    cy.findByText(messages.manage.courseList.confirmCourseArchive).should(
      'exist'
    )
    cy.get('[data-cy="course-archive-modal-cancel"]').click()
    cy.get(`[data-cy="archive-course-${pastTestcourse}"]`).click()
    cy.get('[data-cy="course-archive-modal-confirm"]').click()
    cy.get(`[data-cy="course-list-button-${pastTestcourse}"]`).should(
      'not.exist'
    )

    // check out the archive and re-activate the past course
    cy.get('[data-cy="toggle-course-archive"]').click()
    cy.get(`[data-cy="course-list-button-${pastTestcourse}"]`).should('exist')
    cy.get(`[data-cy="archive-course-${pastTestcourse}"]`).click()
    cy.findByText(messages.manage.courseList.confirmCourseUnarchive).should(
      'exist'
    )
    cy.get('[data-cy="course-archive-modal-confirm"]').click()
    cy.get('[data-cy="toggle-course-archive"]').click()
    cy.get(`[data-cy="course-list-button-${pastTestcourse}"]`).should('exist')
  })

  it('Create a course with live quiz, practice quiz, and microlearning, and delete it again', () => {
    cy.loginLecturer()

    // test-specific variables
    const courseDelName = 'Course to be deleted ' + uuid()
    const courseDelDisplayName = courseDelName + ' display'
    const questionTitle = uuid()
    const questionContent = uuid()
    const liveQuizName = uuid()
    const practiceQuizName = uuid()
    const microLearningName = uuid()

    // create a new course
    cy.get('[data-cy="courses"]').click()
    cy.get('[data-cy="course-list-button-new-course"]').click()
    cy.get('[data-cy="course-name"]').type(courseDelName)
    cy.get('[data-cy="course-display-name"]').type(courseDelDisplayName)
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="manipulate-course-submit"]').click()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(courseDelName).should('exist')
    cy.reload()

    // create a question with sample solution
    cy.get('[data-cy="questions"]').click()
    cy.createQuestionSC({
      title: questionTitle,
      content: questionContent,
      answer1: '50%',
      answer2: '100%',
      correct1: true,
    })

    // create a live quiz in the course
    cy.createLiveQuiz({
      name: liveQuizName,
      displayName: liveQuizName,
      courseName: courseDelName,
      blocks: [{ questions: [questionTitle] }],
    })
    cy.get('[data-cy="create-new-element"]').click()

    // create a practice quiz in the course
    cy.createPracticeQuiz({
      name: practiceQuizName,
      displayName: practiceQuizName,
      description: description,
      courseName: courseDelName,
      stacks: [{ elements: [questionTitle] }],
    })
    cy.get('[data-cy="create-new-element"]').click()

    // create a microlearning in the course
    cy.createMicroLearning({
      name: microLearningName,
      displayName: microLearningName,
      description,
      courseName: courseDelName,
      stacks: [{ elements: [questionTitle] }],
    })
    cy.get('[data-cy="create-new-element"]').click()

    // delete the course and check that it is not visible anymore after a reload
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${courseDelName}"]`).should('exist')
    cy.get(`[data-cy="delete-course-${courseDelName}"]`).click()
    cy.get('[data-cy="course-deletion-modal-cancel"]').click()
    cy.get(`[data-cy="delete-course-${courseDelName}"]`).click()
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

  it('Cleanup: Delete all created courses', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()

    // delete the non-gamified course
    cy.get(`[data-cy="delete-course-${courseNameNew}"]`).click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.findByText(courseNameNew).should('not.exist')

    // delete the gamified course
    cy.get(`[data-cy="delete-course-${courseName2}"]`).click()
    cy.get('[data-cy="course-deletion-participations-confirm"]').click()
    cy.get('[data-cy="course-deletion-participant-group-confirm"]').click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.findByText(courseName2).should('not.exist')
  })
})
