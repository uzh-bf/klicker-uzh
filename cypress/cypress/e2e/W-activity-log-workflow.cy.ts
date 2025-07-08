import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString } from './helpers'

describe('Feature test for activity logs', function () {
  before(() => {
    cy.seed()
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load data fixture', function () {
    cy.fixture('questions.json').then((sharedData) => {
      this.data = sharedData
    })
    cy.fixture('W-activity-log.json').then((activityLogData) => {
      this.data = { ...this.data, ...activityLogData }
    })
  })

  function verifyActivityLogContent(
    lecturerShortname: string,
    data: any,
    includeMessage2: boolean = false,
    includeMessage3: boolean = false
  ) {
    const creationMessage = `${lecturerShortname} created this object.`
    const titleChangeMessage = `${lecturerShortname} modified title (${data.SC.title} -> ${data.element.newTitle}).`
    const statusChangeMessage = `${lecturerShortname} modified status (READY -> REVIEW).`

    cy.get(`[data-cy="activity-log-entry-${data.element.message1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-log-entry-${data.element.message2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-log-entry-${statusChangeMessage}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-log-entry-${titleChangeMessage}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="activity-log-entry-${creationMessage}"]`).should('exist')

    cy.get(`[data-cy="activity-log-entry-${data.element.messagePro1}"]`).should(
      'exist'
    )

    if (includeMessage2) {
      cy.get(
        `[data-cy="activity-log-entry-${data.element.messagePro2}"]`
      ).should('exist')
    }

    if (includeMessage3) {
      cy.get(
        `[data-cy="activity-log-entry-${data.element.messagePro3}"]`
      ).should('exist')
    }
  }

  function verifyActivityComments({
    message,
    newMessage,
    message2,
    message3,
    message4,
  }: {
    message: string
    newMessage?: string
    message2?: string
    message3?: string
    message4?: string
  }) {
    cy.get(`[data-cy="activity-log-entry-${message}"]`).should('exist')

    if (message2) {
      cy.get(`[data-cy="activity-log-entry-${message2}"]`).should('exist')
    } else {
    }

    if (message3) {
      cy.get(`[data-cy="activity-log-entry-${message3}"]`).should('exist')
    }

    if (message4) {
      cy.get(`[data-cy="activity-log-entry-${message4}"]`).should('exist')
    }

    if (newMessage) {
      cy.get('[data-cy="activity-log-input"]').click().type(newMessage)
      cy.get('[data-cy="activity-log-submit"]').click()
      cy.get(`[data-cy="activity-log-entry-${newMessage}"]`).should('exist')
    }

    cy.get('[data-cy="close-activity-log"]').click()
  }

  function setUserPermissionsElementCollection() {
    // share the element with READ permissions with user pro1
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
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)

    // share the element with WRITE permissions with user pro2
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // share the element with ADMIN permissions with user pro3
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  }

  function setUserPermissions() {
    // grant READ permission to user 2
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
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)

    // grant EXECUTE permission to user 3
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
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsEXECUTE)

    // grand WRITE permissions to user 4
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
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // grant ADMIN permissions to user 5
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST3_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
    cy.get(`[data-cy="close-share-object"]`).click()
  }

  it('Create single choice question, access activity log from element dropdown and add a message', function () {
    cy.loginLecturer()

    // create a single choice question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(this.data.SC.title)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.SC.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(this.data.SC.choices[0].value)
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(this.data.SC.choices[1].value)
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').click()

    // open the activity log modal from the element dropdown
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.message1)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.message1}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Verify that the creation of the question is logged in the activity log', function () {
    cy.loginLecturer()

    // compose message for element creation
    const creationMessage = `${Cypress.env('LECTURER_SHORTNAME')} created this object.`

    // verify that creation message is displayed correctly in the activity log
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="activity-log-entry-${creationMessage}"]`).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Access activity log from element edit modal and add another message', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()

    // change to the activity tab and check that the message is shown correctly
    cy.get('[data-cy="element-activity-tab"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.message1}"]`
    ).should('exist')

    // submit another message
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.message2)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.message2}"]`
    ).should('exist')
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Track status modifications in the activity log', function () {
    cy.loginLecturer()

    // change the title of the question
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="select-question-status"]').realClick()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.REVIEW.statusLabel}"]`
    ).realClick()
    cy.get('[data-cy="select-question-status"]').contains(
      messages.shared.REVIEW.statusLabel
    ) // wait for change to go into effect
    cy.get('[data-cy="close-element-modal"]').click() // element status modifications should not be coupled to saving of the element

    // check the activity log and that a corresponding message is shown
    const statusChangeMessage = `${Cypress.env('LECTURER_SHORTNAME')} modified status (READY -> REVIEW).`
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="activity-log-entry-${statusChangeMessage}"]`).should(
      'exist'
    )
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Track title modifications in the activity log', function () {
    cy.loginLecturer()

    // change the title of the question
    cy.get(`[data-cy="edit-element-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SC.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.element.newTitle)
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // check the activity log and that a corresponding message is shown
    const titleChangeMessage = `${Cypress.env('LECTURER_SHORTNAME')} modified title (${this.data.SC.title} -> ${this.data.element.newTitle}).`
    cy.get(`[data-cy="actions-element-${this.data.element.newTitle}"]`).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.element.newTitle}"]`
    ).click()
    cy.get(`[data-cy="activity-log-entry-${titleChangeMessage}"]`).should(
      'exist'
    )
    cy.get('[data-cy="close-activity-log"]').click()

    // change the title back to the original
    cy.get(`[data-cy="edit-element-${this.data.element.newTitle}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.element.newTitle
    )
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.SC.title)
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)
  })

  it('Grant READ, WRITE, ADMIN permissions on the element to the other users', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SC.title}"]`).click()
    setUserPermissionsElementCollection()
  })

  it('Log in as the user with READ permissions, verify the permissions and enter a new message', function () {
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.messagePro1)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.messagePro1}"]`
    ).should('exist')

    // check that all previously created messages are shown
    verifyActivityLogContent(Cypress.env('LECTURER_SHORTNAME'), this.data)
    cy.get('[data-cy="close-activity-log"]').click()

    // click on the title of the element to open the element edit modal and check out the activity log
    cy.get(`[data-cy="element-title-${this.data.SC.title}"]`).realClick()
    cy.get('[data-cy="element-activity-tab"]').click()
    verifyActivityLogContent(Cypress.env('LECTURER_SHORTNAME'), this.data)
  })

  it('Log in as the user with WRITE permissions, verify the permissions and enter a new message', function () {
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.messagePro2)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.messagePro2}"]`
    ).should('exist')

    // check that all previously created messages are shown
    verifyActivityLogContent(Cypress.env('LECTURER_SHORTNAME'), this.data, true)
    cy.get('[data-cy="close-activity-log"]').click()

    // click on the title of the element to open the element edit modal and check out the activity log
    cy.get(`[data-cy="element-title-${this.data.SC.title}"]`).realClick()
    cy.get('[data-cy="element-activity-tab"]').click()
    verifyActivityLogContent(Cypress.env('LECTURER_SHORTNAME'), this.data, true)
  })

  it('Log in as the user with ADMIN permissions, verify the permissions and enter a new message', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get(`[data-cy="actions-element-${this.data.SC.title}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.SC.title}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.element.messagePro3)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.element.messagePro3}"]`
    ).should('exist')

    // check that all previously created messages are shown
    verifyActivityLogContent(
      Cypress.env('LECTURER_SHORTNAME'),
      this.data,
      true,
      true
    )
    cy.get('[data-cy="close-activity-log"]').click()

    // click on the title of the element to open the element edit modal and check out the activity log
    cy.get(`[data-cy="element-title-${this.data.SC.title}"]`).realClick()
    cy.get('[data-cy="element-activity-tab"]').click()
    verifyActivityLogContent(
      Cypress.env('LECTURER_SHORTNAME'),
      this.data,
      true,
      true
    )
  })

  it('Create different activities and share them with other users', function () {
    const currentYear = new Date().getFullYear()
    cy.loginLecturer()

    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createLiveQuiz({
      name: this.data.liveQuiz.name,
      displayName: this.data.liveQuiz.displayName,
      courseName: this.data.seededCourse,
      blocks: [{ elements: [this.data.SCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createPracticeQuiz({
      name: this.data.practiceQuiz.name,
      displayName: this.data.practiceQuiz.displayName,
      courseName: this.data.seededCourse,
      stacks: [{ elements: [this.data.SCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createMicroLearning({
      name: this.data.microLearning.name,
      displayName: this.data.microLearning.displayName,
      startDate: {
        monthDelta: -3,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 3,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      courseName: this.data.seededCourse,
      stacks: [{ elements: [this.data.SCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createGroupActivity({
      name: this.data.groupActivity.name,
      displayName: this.data.groupActivity.displayName,
      courseName: this.data.seededCourse,
      scheduledStartDate: {
        monthDelta: -2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: getDatetimeValidationString(-1, '10') + ', 12:30',
      }, // 1 month in the past at 12:30
      scheduledEndDate: {
        monthDelta: 1,
        day: 20,
        hour: 14,
        minute: 0,
        validation: getDatetimeValidationString(2, '20') + ', 14:00',
      }, // 2 months in the future at 14:00
      task: 'TASK',
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
        elements: [this.data.SCML.title],
      },
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // share live quiz with different permissions
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="share-live-quiz-${this.data.liveQuiz.name}"]`).click()
    setUserPermissions()

    // add a comment to the live quiz
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.liveQuiz.name}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.liveQuiz.message)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.liveQuiz.message}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()

    // share practice quiz with different permissions
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="share-practice-quiz-${this.data.practiceQuiz.name}"]`
    ).click()
    setUserPermissions()

    // add a comment to the practice quiz
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.practiceQuiz.message)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.practiceQuiz.message}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()

    // share microlearning with different permissions
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.microLearning.name}"]`
    ).click()
    cy.get(
      `[data-cy="share-microlearning-${this.data.microLearning.name}"]`
    ).click()
    setUserPermissions()

    // add a comment to the microlearning
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.microLearning.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.microLearning.name}"]`
    ).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.microLearning.message)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.microLearning.message}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()

    // share group activity with different permissions
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.groupActivity.name}"]`
    ).click()
    cy.get(
      `[data-cy="share-group-activity-${this.data.groupActivity.name}"]`
    ).click()
    setUserPermissions()

    // add a comment to the group activity
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.groupActivity.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.groupActivity.name}"]`
    ).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.groupActivity.message)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.groupActivity.message}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()
  })

  it('Add another message to the activities through the user with READ permissions', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()

    // check live quiz activity log and add another message
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.liveQuiz.name}"]`).click()
    verifyActivityComments({
      message: this.data.liveQuiz.message,
      newMessage: this.data.liveQuiz.messagePro1,
    })

    // check practice quiz activity log and add another message
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.practiceQuiz.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.practiceQuiz.message,
      newMessage: this.data.practiceQuiz.messagePro1,
    })

    // check microlearning activity log and add another message
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.microLearning.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.microLearning.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.microLearning.message,
      newMessage: this.data.microLearning.messagePro1,
    })

    // check group activity activity log and add another message
    cy.get(
      `[data-cy="view-activity-log-${this.data.groupActivity.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.groupActivity.message,
      newMessage: this.data.groupActivity.messagePro1,
    })
  })

  it('Add another message to the activities through the user with EXECUTE permissions', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="activities"]').click()

    // check live quiz activity log and add another message
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.liveQuiz.name}"]`).click()
    verifyActivityComments({
      message: this.data.liveQuiz.message,
      message2: this.data.liveQuiz.messagePro1,
      newMessage: this.data.liveQuiz.messagePro2,
    })

    // check practice quiz activity log and add another message
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.practiceQuiz.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.practiceQuiz.message,
      message2: this.data.practiceQuiz.messagePro1,
      newMessage: this.data.practiceQuiz.messagePro2,
    })

    // check microlearning activity log and add another message
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.microLearning.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.microLearning.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.microLearning.message,
      message2: this.data.microLearning.messagePro1,
      newMessage: this.data.microLearning.messagePro2,
    })

    // check group activity activity log and add another message
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.groupActivity.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.groupActivity.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.groupActivity.message,
      message2: this.data.groupActivity.messagePro1,
      newMessage: this.data.groupActivity.messagePro2,
    })
  })

  it('Add another message to the activities through the user with WRITE permissions', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="activities"]').click()

    // check live quiz activity log and add another message
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.liveQuiz.name}"]`).click()
    verifyActivityComments({
      message: this.data.liveQuiz.message,
      message2: this.data.liveQuiz.messagePro1,
      message3: this.data.liveQuiz.messagePro2,
      newMessage: this.data.liveQuiz.messagePro3,
    })

    // check practice quiz activity log and add another message
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.practiceQuiz.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.practiceQuiz.message,
      message2: this.data.practiceQuiz.messagePro1,
      message3: this.data.practiceQuiz.messagePro2,
      newMessage: this.data.practiceQuiz.messagePro3,
    })

    // check microlearning activity log and add another message
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.microLearning.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.microLearning.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.microLearning.message,
      message2: this.data.microLearning.messagePro1,
      message3: this.data.microLearning.messagePro2,
      newMessage: this.data.microLearning.messagePro3,
    })

    // check group activity activity log and add another message
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.groupActivity.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.groupActivity.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.groupActivity.message,
      message2: this.data.groupActivity.messagePro1,
      message3: this.data.groupActivity.messagePro2,
      newMessage: this.data.groupActivity.messagePro3,
    })
  })

  it('Add another message to the activities through the user with ADMIN permissions', function () {
    cy.loginInstitutionalCatalyst3()
    cy.get('[data-cy="activities"]').click()

    // check live quiz activity log and add another message
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.name}"]`).click()
    cy.get(`[data-cy="view-activity-log-${this.data.liveQuiz.name}"]`).click()
    verifyActivityComments({
      message: this.data.liveQuiz.message,
      message2: this.data.liveQuiz.messagePro1,
      message3: this.data.liveQuiz.messagePro2,
      message4: this.data.liveQuiz.messagePro3,
      newMessage: this.data.liveQuiz.messagePro4,
    })

    // check practice quiz activity log and add another message
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.practiceQuiz.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.practiceQuiz.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.practiceQuiz.message,
      message2: this.data.practiceQuiz.messagePro1,
      message3: this.data.practiceQuiz.messagePro2,
      message4: this.data.practiceQuiz.messagePro3,
      newMessage: this.data.practiceQuiz.messagePro4,
    })

    // check microlearning activity log and add another message
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.microLearning.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.microLearning.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.microLearning.message,
      message2: this.data.microLearning.messagePro1,
      message3: this.data.microLearning.messagePro2,
      message4: this.data.microLearning.messagePro3,
      newMessage: this.data.microLearning.messagePro4,
    })

    // check group activity activity log and add another message
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.groupActivity.name}"]`
    ).click()
    cy.get(
      `[data-cy="view-activity-log-${this.data.groupActivity.name}"]`
    ).click()
    verifyActivityComments({
      message: this.data.groupActivity.message,
      message2: this.data.groupActivity.messagePro1,
      message3: this.data.groupActivity.messagePro2,
      message4: this.data.groupActivity.messagePro3,
      newMessage: this.data.groupActivity.messagePro4,
    })
  })

  it('Add a comment on the course and share it with other users', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()

    // add a comment to the course
    cy.get(`[data-cy="activity-log-course-${this.data.seededCourse}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.course.message)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(`[data-cy="activity-log-entry-${this.data.course.message}"]`).should(
      'exist'
    )
    cy.get('[data-cy="close-activity-log"]').click()

    // open the course overview and share the course with other users
    cy.get(`[data-cy="course-list-button-${this.data.seededCourse}"]`).click()
    cy.get('[data-cy="course-share-button"]').click()
    setUserPermissions()
  })

  it('Log in as the user with READ permissions and add a new message to the activity log', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="courses"]').click()

    // check course activity log and add another message
    cy.get(`[data-cy="activity-log-course-${this.data.seededCourse}"]`).click()
    verifyActivityComments({
      message: this.data.course.message,
      newMessage: this.data.course.messagePro1,
    })
  })

  it('Log in as the user with EXECUTE permissions and add a new message to the activity log', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="courses"]').click()

    // check course activity log and add another message
    cy.get(`[data-cy="activity-log-course-${this.data.seededCourse}"]`).click()
    verifyActivityComments({
      message: this.data.course.message,
      message2: this.data.course.messagePro1,
      newMessage: this.data.course.messagePro2,
    })
  })

  it('Log in as the user with WRITE permissions and add a new message to the activity log', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="courses"]').click()

    // check course activity log and add another message
    cy.get(`[data-cy="course-list-button-${this.data.seededCourse}"]`).click()
    cy.get('[data-cy="course-activity-log-button"]').click()
    verifyActivityComments({
      message: this.data.course.message,
      message2: this.data.course.messagePro1,
      message3: this.data.course.messagePro2,
      newMessage: this.data.course.messagePro3,
    })
  })

  it('Log in as the user with ADMIN permissions and add a new message to the activity log', function () {
    cy.loginInstitutionalCatalyst3()
    cy.get('[data-cy="courses"]').click()

    // check course activity log and add another message
    cy.get(`[data-cy="course-list-button-${this.data.seededCourse}"]`).click()
    cy.get('[data-cy="course-activity-log-button"]').click()
    verifyActivityComments({
      message: this.data.course.message,
      message2: this.data.course.messagePro1,
      message3: this.data.course.messagePro2,
      message4: this.data.course.messagePro3,
      newMessage: this.data.course.messagePro4,
    })
  })

  it('Create an answer collection, add a comment and share it with other users', function () {
    cy.loginLecturer()

    // create an answer collection
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // add a comment to the answer collection
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get(`[data-cy="view-activity-log-${this.data.collection.name}"]`).click()
    cy.get('[data-cy="activity-log-input"]')
      .click()
      .type(this.data.answerCollection.message)
    cy.get('[data-cy="activity-log-submit"]').click()
    cy.get(
      `[data-cy="activity-log-entry-${this.data.answerCollection.message}"]`
    ).should('exist')
    cy.get('[data-cy="close-activity-log"]').click()

    // share the answer collection with other users
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get(`[data-cy="share-answer-collection"]`).click()
    setUserPermissionsElementCollection()
  })

  it('Log in as the user with READ permissions and add a new message to the activity log', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    // check answer collection activity log and add another message
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get(`[data-cy="view-activity-log-${this.data.collection.name}"]`).click()
    verifyActivityComments({
      message: this.data.answerCollection.message,
      newMessage: this.data.answerCollection.messagePro1,
    })
  })

  it('Log in as the user with WRITE permissions and add a new message to the activity log', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    // check answer collection activity log and add another message
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get(`[data-cy="view-activity-log-${this.data.collection.name}"]`).click()
    verifyActivityComments({
      message: this.data.answerCollection.message,
      newMessage: this.data.answerCollection.messagePro1,
    })
  })

  it('Log in as the user with ADMIN permissions and add a new message to the activity log', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    // check answer collection activity log and add another message
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get(`[data-cy="view-activity-log-${this.data.collection.name}"]`).click()
    verifyActivityComments({
      message: this.data.answerCollection.message,
      message2: this.data.answerCollection.messagePro1,
      newMessage: this.data.answerCollection.messagePro2,
    })
  })
})
