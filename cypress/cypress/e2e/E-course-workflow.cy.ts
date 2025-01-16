import messages from '../../../packages/i18n/messages/en'

// global variable for ensured consistency with current dates
const currentYear = new Date().getFullYear()

describe('Test course creation and editing functionalities', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('E-course.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 1: Course creation
  it('Test the creation of a new course without gamification', function () {
    // log into frontend-manage
    cy.loginLecturer()

    // switch to course list
    cy.get('[data-cy="courses"]').click()

    // create a new course
    cy.get('[data-cy="course-list-button-new-course"]').click()

    // fill in the form
    cy.get('[data-cy="course-name"]').type(this.data.course1.name)
    cy.get('[data-cy="course-display-name"]').type(
      this.data.course1.displayName
    )
    cy.get('[data-cy="course-description"]')
      .realClick()
      .type(this.data.course1.description)

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
    cy.findByText(this.data.course2.name).should('exist')

    // check that random group assignment should be disabled
    cy.get(`[data-cy="course-list-button-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="tab-groups"]').click()
    cy.get('[data-cy="assign-random-groups"]').should('be.disabled')
    cy.findByText(messages.manage.course.randomGroupsNotPossible).should(
      'exist'
    )
  })

  // ! Part 2: Randomized group creation
  it('Have 10 students join the course and the random assignment pool', function () {
    // get the course PIN from the lecturer view
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course2.name}"]`).click()
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
      cy.get(
        `[data-cy="course-button-${this.data.course2.displayName}"]`
      ).click()
      cy.get('[data-cy="student-course-create-group"]').click()
      cy.get('[data-cy="enter-random-group-pool"]').click()
      cy.findByText(messages.pwa.courses.leaveRandomGroupPool).should('exist')
    }
  })

  it('Have 2 students join the course and create groups by themselves', function () {
    // get the course PIN from the lecturer view
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="course-pin"]')
      .invoke('text')
      .then(($coursePin) => {
        cy.wrap($coursePin).as('coursePin')
      })

    // student 11 joins course and creates a group by himself
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME11') })
    cy.get('[data-cy="join-new-course"]').click()
    cy.get('@coursePin').then((pin) => {
      cy.get('[data-cy="join-course-pin-field"]').type(String(pin))
    })
    cy.get('[data-cy="join-course-submit-form"]').click()
    cy.get(`[data-cy="course-button-${this.data.course2.displayName}"]`).click()
    cy.get('[data-cy="student-course-create-group"]').click()
    cy.get('[data-cy="group-creation-name-input"]').type(
      this.data.course2.group1
    )
    cy.get('[data-cy="create-new-participant-group"]').click()
    cy.wait(1000)

    // student 12 joins course and creates a group by himself
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME12') })
    cy.get('[data-cy="join-new-course"]').click()
    cy.get('@coursePin').then((pin) => {
      cy.get('[data-cy="join-course-pin-field"]').type(String(pin))
    })
    cy.get('[data-cy="join-course-submit-form"]').click()
    cy.get(`[data-cy="course-button-${this.data.course2.displayName}"]`).click()
    cy.get('[data-cy="student-course-create-group"]').click()
    cy.get('[data-cy="group-creation-name-input"]').type(
      this.data.course2.group2
    )
    cy.get('[data-cy="create-new-participant-group"]').click()
    cy.wait(1000)
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

  // ! Part 3: Course overview, editing, and archiving
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
    cy.get('[data-cy="course-join-button"]').click()
    cy.get('[data-cy="course-join-modal"]').should('exist')
    cy.get('[data-cy="course-join-modal"]').should('contain', 'QR Code')
    cy.get('[data-cy="course-join-modal-close"]').click()

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
    cy.get('[data-cy="course-name"]')
      .clear()
      .type(this.data.course1.displayName)
    cy.get('[data-cy="course-display-name"]')
      .clear()
      .type(this.data.course1.displayNameNew)

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
    cy.get('[data-cy="course-name"]').should(
      'have.value',
      this.data.course1.displayName
    )
    cy.get('[data-cy="course-display-name"]').should(
      'have.value',
      this.data.course1.displayNameNew
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

  it('Test if the course leaderboards are visible on the student app', function () {
    cy.loginStudent()

    // check for the existince of the test course
    cy.get(`[data-cy="course-button-${this.data.running.name}"]`).click()
    cy.get('[data-cy="student-course-leaderboard-tab"]').should('exist')

    // check if the leaderboards exist
    cy.findByText(messages.pwa.courses.individualLeaderboard).should('exist')
    cy.findByText(messages.pwa.courses.groupLeaderboard).should('exist')
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

  // ! Part 4: Course deletion and required confirmations
  it('Create a course with live quiz, practice quiz, and microlearning, and delete it again', function () {
    cy.loginLecturer()

    // create a new course
    cy.get('[data-cy="courses"]').click()
    cy.get('[data-cy="course-list-button-new-course"]').click()
    cy.get('[data-cy="course-name"]').type(this.data.deletion.courseName)
    cy.get('[data-cy="course-display-name"]').type(
      this.data.deletion.displayName
    )
    cy.get('[data-cy="course-gamification"]').click()
    cy.get('[data-cy="manipulate-course-submit"]').click()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.deletion.courseName).should('exist')
    cy.reload()

    // create a question with sample solution
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSC({
      title: this.data.deletion.qTitle,
      content: this.data.deletion.qContent,
      choices: [{ content: '50%', correct: true }, { content: '100%' }],
    })

    // create a live quiz in the course
    cy.createLiveQuiz({
      name: this.data.deletion.lqName,
      displayName: this.data.deletion.lqName,
      courseName: this.data.deletion.courseName,
      blocks: [{ elements: [this.data.deletion.qTitle] }],
    })
    cy.get('[data-cy="create-new-element"]').click()

    // create a practice quiz in the course
    cy.createPracticeQuiz({
      name: this.data.deletion.pqName,
      displayName: this.data.deletion.pqName,
      description: this.data.course1.description,
      courseName: this.data.deletion.courseName,
      stacks: [{ elements: [this.data.deletion.qTitle] }],
    })
    cy.get('[data-cy="create-new-element"]').click()

    // create a microlearning in the course
    cy.createMicroLearning({
      name: this.data.deletion.mlName,
      displayName: this.data.deletion.mlName,
      description: this.data.course1.description,
      startDate: `${currentYear - 1}-01-01T02:00`,
      endDate: `${currentYear + 1}-01-01T02:00`,
      courseName: this.data.deletion.courseName,
      stacks: [{ elements: [this.data.deletion.qTitle] }],
    })
    cy.get('[data-cy="create-new-element"]').click()

    // delete the course and check that it is not visible anymore after a reload
    cy.get('[data-cy="courses"]').click()
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
    cy.get('[data-cy="live-quizzes"]').click()
    cy.contains('[data-cy="live-quiz-block"]', this.data.deletion.lqName)
    cy.get(`[data-cy="edit-live-quiz-${this.data.deletion.lqName}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
  })

  it('Cleanup: Delete the live quiz that is not assigned to the course anymore', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()
    cy.findByText(this.data.deletion.lqName).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${this.data.deletion.lqName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.deletion.lqName).should('not.exist')
  })

  // ! Cleanup
  it('Cleanup: Delete all created courses', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()

    // delete the non-gamified course
    cy.get(`[data-cy="delete-course-${this.data.course1.displayName}"]`).click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.findByText(this.data.course1.displayName).should('not.exist')

    // delete the gamified course
    cy.get(`[data-cy="delete-course-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="course-deletion-participations-confirm"]').click()
    cy.get('[data-cy="course-deletion-participant-group-confirm"]').click()
    cy.get('[data-cy="course-deletion-modal-confirm"]').click()
    cy.findByText(this.data.course2.name).should('not.exist')
  })
})
