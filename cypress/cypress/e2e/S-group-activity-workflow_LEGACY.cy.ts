import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString } from './helpers'

// first start date: 2 months in the future at 12:30
const startDate1 = getDatetimeValidationString(2, '10') + ', 12:30'

// first end date: 3 months in the future at 14:00
const endDate1 = getDatetimeValidationString(3, '20') + ', 14:00'

// start date of running activity: 1 month in the past at 12:30
const runningStartDate = getDatetimeValidationString(-1, '10') + ', 12:30'

// end date of running activity: 2 months in the future at 14:00
const runningEndDate = getDatetimeValidationString(2, '20') + ', 14:00'

// exention date: 8 months in the future at 18:50
const extensionDate = getDatetimeValidationString(8, '15') + ', 18:50'

// synchronous activity start date: 2 months in the future at 12:30
const synchronousStartDate = getDatetimeValidationString(2, '10') + ', 12:30'

// synchronous activity end date: 3 months in the future at 14:00
const synchronousEndDate = getDatetimeValidationString(3, '20') + ', 14:00'

describe('Create and solve a group activity', function () {
  before(() => {
    cy.seed()

    // remove private preview flag from lecturer user
    cy.task('updateLecturerPreviewFlags', {
      publicPreview: true,
      privatePreview: false,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error('Permissions of user could not be updated.')
      }
    })
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('S-group-activity.json').then((liveQuizData) => {
      this.data = { ...this.data, ...liveQuizData }
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Part 0: Preparation - Question Creation
  // #region
  it('Create questions required for group activity creation', function () {
    cy.loginLecturer()

    // SC question with solution
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      multiplier: 2,
      userId: Cypress.env('LECTURER_ID'),
    })

    // MC question
    cy.createQuestionMC({
      name: this.data.MCML.title,
      content: this.data.MCML.content,
      choices: this.data.MCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // KPRIM question
    cy.createQuestionKPRIM({
      name: this.data.KPML.title,
      content: this.data.KPML.content,
      choices: this.data.KPML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // NR question
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
      multiplier: 3,
      userId: Cypress.env('LECTURER_ID'),
    })

    // FT question
    cy.createQuestionFT({
      name: this.data.FTML.title,
      content: this.data.FTML.content,
      ...this.data.FTML.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // CT question
    cy.createContent({
      name: this.data.CT.title,
      content: this.data.CT.content,
      userId: Cypress.env('LECTURER_ID'),
    })
  })
  // #endregion

  // ! Part 1: Group Activity Creation
  // #region
  it('Create a group activity with the created questions', function () {
    cy.loginLecturer()

    // Step 1: Name
    cy.get('[data-cy="create-group-activity"]').click()
    cy.get('[data-cy="insert-groupactivity-name"]')
      .click()
      .type(this.data.activity.name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .type(this.data.activity.displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .type(this.data.activity.task)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course}"]`).click()
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.activityWizard.multiplier1)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier2}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )

    // set the start date of the group activity to 2 months in the future at 12:30
    cy.setDatetime('select-start-date', 'availability-section-header', {
      monthDelta: 1,
      day: 10,
      hour: 12,
      minute: 30,
      validation: startDate1,
    })

    // set the end date of the group activity to 3 months in the future at 14:00
    cy.setDatetime('select-end-date', 'availability-section-header', {
      monthDelta: 2,
      day: 20,
      hour: 14,
      minute: 0,
      validation: endDate1,
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Clues
    // 1) Text clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.activity.clues[0].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.activity.clues[0].displayName)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .type(this.data.activity.clues[0].content)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.activity.clues[0].name).should('exist')
    cy.findByText(this.data.activity.clues[0].content).should('exist')

    // 2) Numerical clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.activity.clues[1].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.activity.clues[1].displayName)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(this.data.activity.clues[1].content)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(this.data.activity.clues[1].unit)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.activity.clues[1].name).should('exist')
    cy.findByText(
      this.data.activity.clues[1].content +
        ' ' +
        this.data.activity.clues[1].unit
    ).should('exist')

    // 3) Numerical clue without unit
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.activity.clues[2].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.activity.clues[2].displayName)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(this.data.activity.clues[2].content)
    )
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.activity.clues[2].name).should('exist')
    cy.findByText(this.data.activity.clues[2].content).should('exist')

    // Step 4: Questions / Elements
    cy.createStacks({
      stacks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
            this.data.NRML.title,
            this.data.FTML.title,
          ],
        },
      ],
    })

    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(this.data.activity.name).should('exist')
  })

  it('Creates a group activity that starts and ends in the future', function () {
    cy.loginLecturer()
    cy.createGroupActivity({
      name: this.data.synchronous.name,
      displayName: this.data.synchronous.displayName,
      task: this.data.synchronous.task,
      courseName: this.data.course,
      scheduledStartDate: {
        monthDelta: 1,
        day: 10,
        hour: 12,
        minute: 30,
        validation: synchronousStartDate,
      }, // 2 months in the future at 12:30
      scheduledEndDate: {
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: synchronousEndDate,
      }, // 3 months in the future at 14:00
      clues: this.data.synchronous.clues,
      stack: {
        elements: [
          this.data.SCML.title,
          this.data.MCML.title,
          this.data.KPML.title,
        ],
      },
    })
  })

  it('Publish and unpublish the future group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${this.data.activity.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.activity.name}"]`
    ).click()
    cy.get('[data-cy="cancel-publish-action"]').click()
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.activity.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.activity.name}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
    cy.get(
      `[data-cy="unpublish-groupActivity-${this.data.activity.name}"]`
    ).click()
    cy.get(`[data-cy="groupActivity-${this.data.activity.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
  })

  it('Edit the group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.activity.name}"]`
    ).click()
    cy.get(`[data-cy="edit-groupActivity-${this.data.activity.name}"]`).click()

    // check the name, display name and task description and update them
    cy.get('[data-cy="insert-groupactivity-name"]')
      .click()
      .should('have.value', this.data.activity.name)
      .clear()
      .type(this.data.running.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .should('have.value', this.data.activity.displayName)
      .clear()
      .type(this.data.running.displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .contains(this.data.activity.task)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .clear()
      .type(this.data.running.task)
    cy.get('[data-cy="next-or-submit"]').click()

    // fill out the settings of the group activity
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.activityWizard.multiplier2)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )

    // set the start date of the group activity to 1 month in the past at 12:30 (from previous 2 months in the future)
    cy.setDatetime('select-start-date', 'availability-section-header', {
      monthDelta: -3,
      day: 10,
      hour: 12,
      minute: 30,
      validation: runningStartDate,
    })

    // set the end date of the group activity to 2 months in the future at 14:00 (from previous 3 months in the future)
    cy.setDatetime('select-end-date', 'availability-section-header', {
      monthDelta: -1,
      day: 20,
      hour: 14,
      minute: 0,
      validation: runningEndDate,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    // check that clues exist and add a new one
    cy.findByText(this.data.activity.clues[0].name).should('exist')
    cy.findByText(this.data.activity.clues[1].name).should('exist')
    cy.findByText(this.data.activity.clues[2].name).should('exist')

    // edit existing clue
    cy.get(`[data-cy="edit-clue-${this.data.activity.clues[0].name}"]`).click()
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .should('have.value', this.data.activity.clues[0].name)
      .clear()
      .type(this.data.running.clues[0].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .should('have.value', this.data.activity.clues[0].displayName)
      .clear()
      .type(this.data.running.clues[0].displayName)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .should('have.value', this.data.activity.clues[0].content)
      .clear()
      .type(this.data.running.clues[0].content)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.running.clues[0].name).should('exist')
    cy.findByText(this.data.running.clues[0].content).should('exist')

    // delete existing clue
    cy.get(`[data-cy="remove-clue-${this.data.running.clues[0].name}"]`).click()
    cy.findByText(this.data.running.clues[0].name).should('not.exist')
    cy.findByText(this.data.running.clues[0].content).should('not.exist')

    // create a new clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.running.clues[1].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.running.clues[1].displayName)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(this.data.running.clues[1].content)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(this.data.running.clues[1].unit)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.get(
      `[data-cy="groupActivity-clue-${this.data.running.clues[1].name}"]`
    ).should('exist')
    cy.findByText(
      this.data.running.clues[1].content + ' ' + this.data.running.clues[1].unit
    ).should('exist')

    // add another question to the group activity
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`)
      .contains(this.data.SCML.title)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.CT.title}"]`)
      .contains(this.data.CT.title)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer2,
    })

    // verify that the contained questions are correct
    cy.get(`[data-cy="element-0-stack-0"]`)
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get(`[data-cy="element-1-stack-0"]`)
      .should('exist')
      .should('contain', this.data.MCML.title.substring(0, 20))
    cy.get(`[data-cy="element-2-stack-0"]`)
      .should('exist')
      .should('contain', this.data.KPML.title.substring(0, 20))
    cy.get(`[data-cy="element-3-stack-0"]`)
      .should('exist')
      .should('contain', this.data.NRML.title.substring(0, 20))
    cy.get(`[data-cy="element-4-stack-0"]`)
      .should('exist')
      .should('contain', this.data.FTML.title.substring(0, 20))
    cy.get(`[data-cy="element-5-stack-0"]`)
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get(`[data-cy="element-6-stack-0"]`)
      .should('exist')
      .should('contain', this.data.CT.title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(this.data.running.name).should('exist')
  })
  // #endregion

  // ! Part 2: Running Group Activity & Participation
  // #region
  function answerGroupActivity(data) {
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').type(data.running.answers.numerical)
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-4"]')
      .click()
      .type(data.running.answers.freeText)
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-0"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('not.be.disabled')
  }

  function answerGroupActivityPartial(data) {
    // answer all questions in the group activity with partial inputs (where supported)
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').type(data.running.answers.numerical)
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-4"]')
      .click()
      .type(data.running.answers.freeText)
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-0"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('not.be.disabled')
  }

  function checkInputsDisabled(data) {
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-0"]').should('be.disabled')
  }

  function checkPersistentAnswers(data) {
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')

    cy.get('[data-cy="mc-1-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-3"]').should('be.disabled')

    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', data.running.answers.numerical)

    cy.get('[data-cy="free-text-input-4"]')
      .should('be.disabled')
      .contains(data.running.answers.freeText)

    cy.get('[data-cy="sc-5-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
  }

  function checkPersistentAnswersPartial(data) {
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', data.running.answers.numerical)
    cy.get('[data-cy="free-text-input-4"]')
      .should('be.disabled')
      .contains(data.running.answers.freeText)
    cy.get('[data-cy="sc-5-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
  }

  it('Publish the group activity and check its status', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.running.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`)
      .findByText(messages.shared.generic.running)
      .should('exist')
  })

  it('Extend the running group activity', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // open extension modal
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="extend-groupActivity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="extend-groupActivity-${this.data.running.name}"]`).click()

    // change the end date and check if the changes are saved
    cy.setDatetime('extend-activity-date', 'extension-modal-description', {
      monthDelta: 6,
      day: 15,
      hour: 18,
      minute: 50,
      validation: extensionDate,
    })
    cy.get('[data-cy="extend-activity-confirm"]').click()

    // check that changing the date to the past does not work
    cy.get(`[data-cy="extend-groupActivity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="extend-activity-confirm"]').should('not.be.disabled')
    cy.setDatetime('extend-activity-date', 'extension-modal-description', {
      monthDelta: -12,
      day: 15,
      hour: 12,
      minute: 0,
      validation: getDatetimeValidationString(-4, '15') + ', 12:00',
    })
    cy.get('[data-cy="extend-activity-confirm"]').should('be.disabled')
    cy.get('[data-cy="extend-activity-cancel"]').click()
  })

  it('Take part in the group activity', function () {
    cy.loginStudent()

    // start the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // test rating and flagging of group activity instances
    cy.get('[data-cy="upvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="downvote-element-0-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="upvote-element-1-button"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(
      this.data.running.flagging.text
    )
    cy.get('[data-cy="cancel-flag-element"]').click()
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(
      this.data.running.flagging.text
    )
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(4000) // wait for success toast to disappear (blocks button)
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.running.flagging.text
    )
    cy.get('[data-cy="flag-element-textarea"]')
      .clear()
      .type(this.data.running.flagging.textNew)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(4000) // wait for success toast to disappear (blocks button)
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.running.flagging.textNew
    )
    cy.get('[data-cy="cancel-flag-element"]').click()

    // answer the questions in the group activity
    answerGroupActivity(this.data)
    cy.get('[data-cy="submit-group-activity"]').click()

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswers(this.data)

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    checkPersistentAnswers(this.data)
  })

  it('Login as the second group member and verify that the submission was successful', function () {
    cy.loginStudent()

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()

    // check that the same answers are visible to the second student
    checkPersistentAnswers(this.data)
  })

  it('Solve the group activity as a second student with partial answers (where available)', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME5') })

    // start the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // answer the questions in the group activity
    answerGroupActivityPartial(this.data)
    cy.get('[data-cy="submit-group-activity"]').click()

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswersPartial(this.data)

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    checkPersistentAnswersPartial(this.data)
  })

  it('Login as a student of another group and start the group activity', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
  })
  // #endregion

  // ! Part 3: Group Activity Ending and Grading
  // #region
  it('End the running group activity through the corresponding action on the lecturer interface', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // end the group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="confirmation-modal-cancel"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`).findByText(
      messages.shared.generic.grading
    )
  })

  it('Verify that a valid submission is still visible after the group activity ended', function () {
    cy.loginStudent()

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).contains(messages.pwa.groupActivity.submitted)
    cy.get(
      `[data-cy="open-submission-${this.data.running.displayName}"]`
    ).click()

    // check that the same answers are visible to the student
    checkInputsDisabled(this.data)
    checkPersistentAnswers(this.data)
    cy.get('[data-cy="submit-group-activity"]').should('not.exist')
  })

  it('Verify that a started group activity can still be seen, but not submitted after it ended', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).contains(messages.pwa.groupActivity.past)
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()

    // submission should not be possible and inputs should be disabled
    checkInputsDisabled(this.data)
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it('Verify that a group activity cannot be started after it ended', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME3') })

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })
  // #endregion

  // ! Part 5: Synchronous Group Activity
  // #region
  it('Publish the synchronous group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${this.data.synchronous.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.synchronous.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.synchronous.name}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
  })

  it('Login as a student and check that the group activity is not visible', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${this.data.synchronous.displayName}"]`)
      .should('exist')
      .contains(messages.shared.generic.scheduled)
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).should('not.exist')
  })

  it('Start the synchronous group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="start-group-activity-${this.data.synchronous.name}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="confirmation-modal-cancel"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="start-group-activity-${this.data.synchronous.name}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()
  })

  it('Login as a student and solve the group activity', function () {
    cy.loginStudent()

    // start the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // answer the questions
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').click()
    cy.get('[data-cy="submit-group-activity"]').click()
    cy.wait(2000)
  })

  it('Login as a second student and start the synchronous group activity', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
  })

  it('End the synchronous group activity', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // end the group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="end-group-activity-${this.data.synchronous.name}"]`
    ).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(
      `[data-cy="groupActivity-${this.data.synchronous.name}"]`
    ).findByText(messages.shared.generic.grading)
  })

  it('Login as a student with a valid submission', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-submission-${this.data.synchronous.displayName}"]`
    ).click()

    // check that the inputs are disabled
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').should('be.disabled')
  })

  it('Login as another student and check that the group activity cannot be started anymore', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
  })

  it('Cleanup: Delete the synchronous group activity', function () {
    cy.loginLecturer()

    // delete the created group activities
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-groupActivity-${this.data.synchronous.name}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).should('not.exist')
  })

  it("Verify that the synchronous group activity isn't visible to students anymore", function () {
    cy.loginStudent()

    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.synchronous.displayName}"]`
    ).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted group activity (with results) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedGroupActivity', {
      gaName: this.data.synchronous.name,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted group activity with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion

  // ! Part 6: Miscellaneous
  // #region
  it('Check if group messages can be sent', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-message-textarea"]').type(this.data.group.message1)
    cy.get('[data-cy="group-message-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message1
    )

    // log into other student in the group and check for the message
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME15') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message1
    )
    cy.get('[data-cy="group-message-textarea"]').type(this.data.group.message2)
    cy.get('[data-cy="group-message-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message2
    )

    // log back into the first account and check if both messages are visible
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message1
    )
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message2
    )
  })
  // #endregion
})
