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
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('S-group-activity.json').then((groupActivityData) => {
      this.data = { ...this.data, ...groupActivityData }
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

    // create answer collection
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create selection question
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create case study question
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
    cy.get('[data-cy="select-course"]').realClick()
    cy.get(`[data-cy="select-course-${this.data.course}"]`).realClick()
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.activityWizard.multiplier1)
    cy.get('[data-cy="select-multiplier"]').realClick()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier2}"]`
    ).realClick()
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
    cy.get('[data-cy="group-activity-clue-type"]').realClick()
    cy.get('[data-cy="group-activity-clue-type-number"]').realClick()
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
    cy.get('[data-cy="group-activity-clue-type"]').realClick()
    cy.get('[data-cy="group-activity-clue-type-number"]').realClick()
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
            this.data.SEML.title,
            this.data.CSML.title,
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

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.activity.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.activity.name}-DRAFT"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="publish-group-activity-${this.data.activity.name}"]`
    ).click()
    cy.get('[data-cy="cancel-publish-action"]').click()
    cy.get(
      `[data-cy="publish-group-activity-${this.data.activity.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.activity.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.activity.name}-SCHEDULED"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.activity.name}"]`
    ).click()
    cy.get(
      `[data-cy="unpublish-group-activity-${this.data.activity.name}"]`
    ).click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.activity.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.activity.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Edit the group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.activity.name}"]`
    ).click()
    cy.get(`[data-cy="edit-group-activity-${this.data.activity.name}"]`).click()

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
    cy.get('[data-cy="select-multiplier"]').realClick()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier4}"]`
    ).realClick()
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
    cy.get('[data-cy="group-activity-clue-type"]').realClick()
    cy.get('[data-cy="group-activity-clue-type-number"]').realClick()
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
      .should('contain', this.data.SEML.title.substring(0, 20))
    cy.get(`[data-cy="element-6-stack-0"]`)
      .should('exist')
      .should('contain', this.data.CSML.title.substring(0, 20))
    cy.get(`[data-cy="element-7-stack-0"]`)
      .should('exist')
      .should('contain', this.data.SCML.title.substring(0, 20))
    cy.get(`[data-cy="element-8-stack-0"]`)
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
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-0"]').click()
    cy.get('[id="selection-5-field-0"]').contains(data.collection.options[0])
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-1"]').click()
    cy.get('[id="selection-5-field-0"]').contains(data.collection.options[2])
    cy.get('[id="selection-5-field-1"]').click()
    // option numbers smaller than ix since only available objects are shown in select component (0 removed here)
    cy.get('[id="react-select-selection-5-field-1-option-0"]').click()
    cy.get('[id="selection-5-field-1"]').contains(data.collection.options[0])
    cy.get('[id="selection-5-field-2"]').click()
    cy.get('[id="react-select-selection-5-field-2-option-1"]').click()
    cy.get('[id="selection-5-field-2"]').contains(data.collection.options[3])
    cy.get('[id="selection-5-field-2"]').click()
    cy.get('[id="react-select-selection-5-field-2-option-1"]').click()
    cy.get('[id="selection-5-field-2"]').contains(data.collection.options[4])
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.answerCaseStudy({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: cy
        .get('[data-cy="submit-group-activity"]')
        .should('be.disabled'), // full answer required
    })
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-7-answer-option-0"]').click()
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
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-0"]').click()
    cy.get('[id="selection-5-field-0"]').contains(data.collection.options[0])
    cy.get('[id="selection-5-field-1"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.answerCaseStudy({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: cy
        .get('[data-cy="submit-group-activity"]')
        .should('be.disabled'), // full answer required
    })
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-7-answer-option-0"]').click()
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
    cy.get('[id="selection-5-field-0"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[id="selection-5-field-1"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[id="selection-5-field-2"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.verifyCaseStudyInputs({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyValues: false,
      verifyDisabled: true,
    })
    cy.get('[data-cy="sc-7-answer-option-0"]').should('be.disabled')
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

    cy.get('[id="selection-5-field-0"]')
      .contains(data.collection.options[2])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-5-field-1"]')
      .contains(data.collection.options[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-5-field-2"]')
      .contains(data.collection.options[4])
      .should('have.css', 'pointer-events', 'none')
    cy.verifyCaseStudyInputs({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
    })
    cy.get('[data-cy="sc-7-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-7-answer-option-1"]').should('be.disabled')
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
    cy.get('[id="selection-5-field-0"]')
      .contains(data.collection.options[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-5-field-1"]')
      .contains(messages.shared.questions.seSelectOption)
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-5-field-2"]')
      .contains(messages.shared.questions.seSelectOption)
      .should('have.css', 'pointer-events', 'none')
    cy.verifyCaseStudyInputs({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    cy.get('[data-cy="sc-7-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-7-answer-option-1"]').should('be.disabled')
  }

  function checkGradingVisualization(
    scores: string[],
    maxPoints: string[],
    comments: string[],
    gradingComment?: string
  ) {
    const totalScore = scores.reduce(
      (acc: number, value: string) => acc + parseInt(value),
      0
    )
    const maxScore = maxPoints.reduce(
      (acc: number, value: string) => acc + parseInt(value),
      0
    )

    cy.findByText(`${totalScore}/${maxScore} Points`).should('exist')
    cy.wrap(scores).each((score: string, ix) => {
      cy.get(`[data-cy="group-activity-grading-feedback-${ix}"]`).should(
        'contain',
        `${score}/${maxPoints[ix]} Points`
      )

      if (comments[ix]) {
        cy.get(`[data-cy="group-activity-grading-feedback-${ix}"]`).should(
          'contain',
          comments[ix]
        )
      }
    })

    if (gradingComment !== null) {
      cy.get('[data-cy="group-activity-results-comment"]').should(
        'contain',
        gradingComment
      )
    }
  }

  it('Publish the group activity and check its status', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.running.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.name}-DRAFT"]`).should('exist')
    cy.get(
      `[data-cy="publish-group-activity-${this.data.running.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.running.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.name}-PUBLISHED"]`).should(
      'exist'
    )
  })

  it('Extend the running group activity', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // open extension modal
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="extend-group-activity-${this.data.running.name}"]`
    ).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(
      `[data-cy="extend-group-activity-${this.data.running.name}"]`
    ).click()

    // change the end date and check if the changes are saved
    cy.setDatetime('extend-activity-date', 'extension-modal-description', {
      monthDelta: 6,
      day: 15,
      hour: 18,
      minute: 50,
      validation: extensionDate,
    })
    cy.get('[data-cy="extend-activity-confirm"]').click()
    cy.wait(1000) // wait for the extension to be processed and stored

    // check that changing the date to the past does not work
    cy.get(
      `[data-cy="extend-group-activity-${this.data.running.name}"]`
    ).click()
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
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
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
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="confirmation-modal-cancel"]').click()

    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(`[data-cy="status-${this.data.running.name}-ENDED"]`).should('exist')
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

  // ! Part 4: Grading the Group Activity
  // #region
  it('Grade the submissions to the group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="grade-group-activity-${this.data.running.name}"]`).click()

    // grade the responses for the first submission
    cy.get('[data-cy="group-activity-submission-0"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
    cy.wrap(this.data.running.grading.scores1).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`)
        .click()
        .type(score)
      if (this.data.running.grading.comments1[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .type(this.data.running.grading.comments1[ix])
      }

      cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
        'be.disabled'
      )
    })

    if (this.data.running.grading.gradingComment1 !== null) {
      cy.get('[data-cy="groupActivity-general-grading-comment"]')
        .realClick()
        .type(this.data.running.grading.gradingComment1)
    }

    // test submission switch and warning that should be visible
    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.get('[data-cy="cancel-submission-switch"]').click()

    // save grading decisions
    cy.get('[data-cy="groupActivity-passed"]').click()
    cy.get('[data-cy="groupActivity-save-submission-grading"]').click()
    cy.wait(1000)

    // start grading the second submission, switch back to the first one and check if the grading is still there
    cy.get('[data-cy="group-activity-submission-1"]').click()
    // cy.wait(500)
    cy.get(`[data-cy="groupActivity-grading-score-0"]`).click().type('10')
    cy.get('[data-cy="group-activity-submission-0"]').click()
    // cy.wait(500)
    // cy.get('[data-cy="confirm-submission-switch"]').click()
    cy.wrap(this.data.running.grading.scores1).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'have.value',
        score
      )
      if (this.data.running.grading.comments1[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .contains(this.data.running.grading.comments1[ix])
      }
    })

    // grade the responses for the second submission
    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.get('[data-cy="confirm-submission-switch"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')

    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
    cy.wrap(this.data.running.grading.scores2).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`)
        .click()
        .type(score)
      if (this.data.running.grading.comments2[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .type(this.data.running.grading.comments2[ix])
      }
      cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
        'be.disabled'
      )
    })

    if (this.data.running.grading.gradingComment2 !== null) {
      cy.get('[data-cy="groupActivity-general-grading-comment"]')
        .realClick()
        .type(this.data.running.grading.gradingComment2)
    }
    cy.get('[data-cy="groupActivity-failed"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').click()

    // check if last submission is disabled
    cy.get('[data-cy="group-activity-submission-2"]').should('be.disabled')

    // finalize the grading process
    cy.get('[data-cy="finalize-grading"]').click()
    cy.get('[data-cy="cancel-finalize-grading"]').click()
    cy.get('[data-cy="finalize-grading"]').click()
    cy.get('[data-cy="confirm-finalize-grading"]').click()
    cy.wait(1000)
    cy.reload()

    // check that the inputs to the different submissions are disabled after finalization of grading
    cy.get('[data-cy="group-activity-submission-0"]').click()
    cy.wrap(this.data.running.grading.scores1).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'have.value',
        score
      )
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'be.disabled'
      )
    })
    cy.get('[data-cy="groupActivity-passed"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )

    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.wrap(this.data.running.grading.scores2).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'have.value',
        score
      )
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'be.disabled'
      )
    })
    cy.get('[data-cy="groupActivity-passed"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
  })

  it('Verify that the student of the group with passing results can see the evaluation', function () {
    cy.loginStudent()

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.shared.generic.passed)

    cy.get(`[data-cy="open-feedback-${this.data.running.displayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswers(this.data)

    // check grading
    checkGradingVisualization(
      this.data.running.grading.scores1,
      this.data.running.grading.maxPoints,
      this.data.running.grading.comments1,
      this.data.running.grading.gradingComment1
    )
  })

  it('Verify that the second student of the first group can see the same results', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME15') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.shared.generic.passed)

    cy.get(`[data-cy="open-feedback-${this.data.running.displayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(
      this.data.running.grading.scores1,
      this.data.running.grading.maxPoints,
      this.data.running.grading.comments1,
      this.data.running.grading.gradingComment1
    )
  })

  it('Verify that the student of the group with failing results can see the evaluation', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME5') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.shared.generic.failed)

    cy.get(`[data-cy="open-feedback-${this.data.running.displayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityFailed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(
      this.data.running.grading.scores2,
      this.data.running.grading.maxPoints,
      this.data.running.grading.comments2,
      this.data.running.grading.gradingComment2
    )
  })

  it('Verify that groups that have not attempted to submit anything to the group activity cannot see any results', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.pwa.groupActivity.past)

    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it('Cleanup: Delete the running and solved group activity', function () {
    cy.loginLecturer()

    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.running.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-group-activity-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.running.name}"]`
    ).should('not.exist')
  })

  it('Verify that the group activity is not visible to students anymore', function () {
    cy.loginStudent()

    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted group activity (with results) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedGroupActivity', {
      gaName: this.data.running.name,
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

  // ! Part 5: Synchronous Group Activity
  // #region
  it('Publish the synchronous group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.synchronous.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.synchronous.name}-DRAFT"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="publish-group-activity-${this.data.synchronous.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.synchronous.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.synchronous.name}-SCHEDULED"]`).should(
      'exist'
    )
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
      `[data-cy="start-group-activity-${this.data.synchronous.name}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="confirmation-modal-cancel"]').click()
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
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="end-group-activity-${this.data.synchronous.name}"]`
    ).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(`[data-cy="status-${this.data.synchronous.name}-ENDED"]`).should(
      'exist'
    )
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
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-group-activity-${this.data.synchronous.name}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.synchronous.name}"]`
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

  // ! Part 7: Group Activity Sharing
  // #region
  function verifyGroupActivityDetailsModalContent(
    activityName: string,
    data: any
  ) {
    cy.get(`[data-cy="activity-name-${activityName}"]`).click()
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.MCML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.KPML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.NRML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.FTML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.SEML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.CSML.title.substring(0, 20)
    )
    cy.get('[data-cy="activity-details-modal"]').contains(
      data.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="close-activity-details-modal"]').click()
  }

  function verifyGroupActivityOwnerPermissions(data: any) {
    // for a draft group activity the following options should be available: publish, edit, share, delete
    cy.get(`[data-cy="publish-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga1}"]`).click()
    cy.get(`[data-cy="edit-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga1}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga1}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)

    // for a scheduled group activity the following options should be available: start, share, unpublish, delete
    cy.get(`[data-cy="start-group-activity-${data.sharing.ga2}-now"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga2}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga2}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga2}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)

    // for a running group activity the following options should be available: extend, end, share, delete
    cy.get(`[data-cy="extend-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga3}"]`).click()
    cy.get(`[data-cy="end-group-activity-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga3}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)

    // for a completed group activity the following options should be available: grade, share, delete
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga4}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga4}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga4}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)

    // for a graded group activity the following options should be available: grade, share, delete
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga5}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga5}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga5}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  function verifyGroupActivityREADPermissions(
    data: any,
    groupPermission: boolean
  ) {
    cy.loginIndividualCatalyst()

    // elements should not be shared for users with READ permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // for a any group activity the following options should be available: remove
    cy.wrap([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).each((quiz: string) => {
      cy.get(`[data-cy="view-activity-log-${quiz}"]`).should('exist')

      if (!groupPermission) {
        cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz}"]`).click()
        cy.get(`[data-cy="remove-group-activity-${quiz}"]`).should('exist')
        cy.get(`[data-cy="activity-name-${quiz}"]`).realClick() // close dropdown
      }

      verifyGroupActivityDetailsModalContent(quiz, data)
    })
  }

  function verifyGroupActivityEXECUTEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    cy.loginInstitutionalCatalyst()

    // elements should not be shared for users with EXECUTE permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // for a draft group activity the following options should be available: publish, remove
    cy.get(`[data-cy="publish-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga1}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga1}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga1}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)

    // for a scheduled group activity the following options should be available: start, unpublish, remove
    cy.get(`[data-cy="start-group-activity-${data.sharing.ga2}-now"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga2}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga2}"]`).should('exist')
    cy.get(`[data-cy="unpublish-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga2}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga2}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)

    // for a running group activity the following options should be available: extend, end, remove
    cy.get(`[data-cy="extend-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga3}"]`).click()
    cy.get(`[data-cy="end-group-activity-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga3}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga3}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)

    // for a completed group activity the following options should be available: grade, remove
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga4}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga4}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga4}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)

    // for a graded group activity the following options should be available: grade, remove
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga5}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga5}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga5}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga5}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  function verifyGroupActivityWRITEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    cy.loginInstitutionalCatalyst2()

    // elements should not be shared for users with WRITE permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([data.sharing.ga1, data.sharing.ga2, data.sharing.ga3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
      }
    )

    // name change action not available for eneded or graded activities
    cy.wrap([data.sharing.ga4, data.sharing.ga5]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // for a draft group activity the following options should be available: publish, edit, remove
    cy.get(`[data-cy="publish-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga1}"]`).click()
    cy.get(`[data-cy="edit-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga1}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga1}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga1}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)

    // for a scheduled group activity the following options should be available: start, unpublish, remove
    cy.get(`[data-cy="start-group-activity-${data.sharing.ga2}-now"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga2}"]`).click()
    cy.get(`[data-cy="unpublish-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga2}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga2}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga2}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)

    // for a running group activity the following options should be available: extend, end, remove
    cy.get(`[data-cy="extend-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga3}"]`).click()
    cy.get(`[data-cy="end-group-activity-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga3}"]`).should(
      !groupPermission ? 'exist' : 'not.exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga3}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)

    // for a completed group activity the following options should be available: grade, remove
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga4}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga4}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga4}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)

    // for a graded group activity the following options should be available: grade, remove
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga5}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga5}"]`).should('exist')
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga5}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="activity-name-${data.sharing.ga5}"]`).realClick() // close dropdown

    verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  function verifyGroupActivityADMINPermissions(
    data: any,
    groupPermission: boolean
  ) {
    cy.loginInstitutionalCatalyst3()

    // elements should be shared for users with ADMIN permissions on activity
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-item-${title}"]`).should('exist')
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([data.sharing.ga1, data.sharing.ga2, data.sharing.ga3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
      }
    )

    // name change action not available for eneded or graded activities
    cy.wrap([data.sharing.ga4, data.sharing.ga5]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // for a draft group activity the following options should be available: publish, edit, share, remove, delete
    cy.get(`[data-cy="publish-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga1}"]`).click()
    cy.get(`[data-cy="edit-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga1}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga1}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga1, data)

    // for a scheduled group activity the following options should be available: start, share, unpublish, remove, delete
    cy.get(`[data-cy="start-group-activity-${data.sharing.ga2}-now"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga2}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga2}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga2}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga2, data)

    // for a running group activity the following options should be available: extend, end, share, remove, delete
    cy.get(`[data-cy="extend-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga3}"]`).click()
    cy.get(`[data-cy="end-group-activity-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga3}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga3}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga3, data)

    // for a completed group activity the following options should be available: grade, share, remove, delete
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga4}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga4}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga4}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga4}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga4, data)

    // for a graded group activity the following options should be available: grade, share, remove, delete
    cy.get(`[data-cy="grade-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-GROUP_ACTIVITY-${data.sharing.ga5}"]`).click()
    cy.get(`[data-cy="view-activity-log-${data.sharing.ga5}"]`).should('exist')
    cy.get(`[data-cy="share-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-group-activity-${data.sharing.ga5}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-group-activity-${data.sharing.ga5}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.ga5}"]`).realClick() // close dropdown
    verifyGroupActivityDetailsModalContent(data.sharing.ga5, data)
  }

  function verifyREADPermissionsRevoked(data: any) {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared group activities should no longer be visible
    cy.wrap([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('not.exist')
    })
  }

  function verifyEXECUTEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared group activities should no longer be visible
    cy.wrap([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('not.exist')
    })
  }

  function verifyWRITEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="activities"]').click()

    // previously shared group activities should no longer be visible
    cy.wrap([
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('not.exist')
    })
  }

  function verifyADMINPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst3()

    // previously indirectly shared elements should no longer be visible
    cy.wrap([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).each((element) => {
      cy.get(`[data-cy="element-item-${element}"]`).should('not.exist')
    })

    // previously shared group activities should no longer be visible
    cy.get('[data-cy="activities"]').click()
    const quizzes = [
      data.sharing.ga1,
      data.sharing.ga2,
      data.sharing.ga3,
      data.sharing.ga4,
      data.sharing.ga5,
    ]
    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('not.exist')
    })
  }

  it('Create five different group activities and make sure that all required actions are shown to the object owner', function () {
    cy.loginLecturer()

    // create five different group activities
    for (let i = 1; i <= 5; i++) {
      cy.createGroupActivity({
        name: this.data.sharing[`ga${i}`],
        displayName: this.data.sharing[`ga${i}Display`],
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
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
            this.data.NRML.title,
            this.data.FTML.title,
            this.data.SEML.title,
            this.data.CSML.title,
            this.data.CT.title,
          ],
        },
      })
      cy.get('[data-cy="create-new-activity"]').click()
    }

    // change the status of the second group activity to scheduled
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.ga2,
      activityType: 'GROUP_ACTIVITY',
      status: 'SCHEDULED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    })

    // change the status of the third group activity to published
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.ga3,
      activityType: 'GROUP_ACTIVITY',
      status: 'PUBLISHED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    })

    // change the status of the fourth group activity to ended
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.ga4,
      activityType: 'GROUP_ACTIVITY',
      status: 'ENDED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    })

    // change the status of the fifth group activity to graded
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.ga5,
      activityType: 'GROUP_ACTIVITY',
      status: 'GRADED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Group activity to change status was not found in the database'
        )
      }
    })
    cy.reload()

    // verify that the owner sees all the correct actions
    cy.get('[data-cy="activities"]').click()
    verifyGroupActivityOwnerPermissions(this.data)
  })

  it('Share the group activities individually with different users and different permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    // grant READ, EXECUTE, WRITE and ADMIN permissions on all group activities to the users 2, 3, 4 and 5, respectively
    cy.wrap([
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

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
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
      )
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
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`
      )
        .should('exist')
        .contains(messages.manage.sharing.permissionsADMIN)

      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Log in as the user with READ permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityREADPermissions(this.data, false)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityEXECUTEPermissions(this.data, false)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityWRITEPermissions(this.data, false)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityADMINPermissions(this.data, false)
  })

  it('Revoke the direct individual permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]
    const users = [
      Cypress.env('LECTURER_IND_SHORTNAME'),
      Cypress.env('LECTURER_INST_SHORTNAME'),
      Cypress.env('LECTURER_INST2_SHORTNAME'),
      Cypress.env('LECTURER_INST3_SHORTNAME'),
    ]

    cy.wrap(quizzes).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

      // revoke permissions for users 2, 3, 4 and 5
      cy.wrap(users).each((user) => {
        cy.get(`[data-cy="permission-${user}"]`).should('exist')
        cy.get(`[data-cy="revoke-permission-${user}"]`).click()
        cy.get('[data-cy="confirm-revocation"]').click()
        cy.get(`[data-cy="permission-${user}"]`).should('not.exist')
      })
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Verify that user with previous READ permissions can no longer see / access the activity', function () {
    verifyREADPermissionsRevoked(this.data)
  })

  it('Verify that user with previous EXECUTE permissions can no longer see / access the activity', function () {
    verifyEXECUTEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous WRITE permissions can no longer see / access the activity', function () {
    verifyWRITEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous ADMIN permissions can no longer see / access the activity', function () {
    verifyADMINPermissionsRevoked(this.data)
  })

  it('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the group activities with them', function () {
    // create user groups with users 1 & 2 / 3 as member / admin
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group1)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME')) // pro1 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group1}"]`).should('exist')

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group2)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST_SHORTNAME')) // pro2 is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group2}"]`).should('exist')

    // create user group with users 1 and 4 with user 4 as owner
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group3)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_EMAIL')) // lecturer is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group3}"]`).should('exist')

    // create user group with users 1 and 5 with user 5 as owner
    cy.loginInstitutionalCatalyst3()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.sharing.group4)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_EMAIL')) // lecturer is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.sharing.group4}"]`).should('exist')
    cy.logoutUser()

    // share the group activities with the user groups with READ, EXECUTE, WRITE and ADMIN permissions
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

      // grant READ permission to user group 1
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group1
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group1}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsREAD)

      // grant EXECUTE permission to user group 2
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group2
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group2}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsEXECUTE)

      // grand WRITE permissions to user group 3
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group3
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group3}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // grant ADMIN permissions to user group 4
      cy.selectOption(
        '[data-cy="new-permission-user-group"]',
        this.data.sharing.group4
      )
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsADMIN
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group4}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Log in as the user with READ permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityREADPermissions(this.data, true)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityEXECUTEPermissions(this.data, true)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityWRITEPermissions(this.data, true)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyGroupActivityADMINPermissions(this.data, true)
  })

  it('Revoke the direct group permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]
    const groups = [
      this.data.sharing.group1,
      this.data.sharing.group2,
      this.data.sharing.group3,
      this.data.sharing.group4,
    ]

    cy.wrap(quizzes).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

      // revoke permissions for all user groups
      cy.wrap(groups).each((group) => {
        cy.get(`[data-cy="permission-${group}"]`).should('exist')
        cy.get(`[data-cy="revoke-permission-${group}"]`).click()
        cy.get('[data-cy="confirm-revocation"]').click()
        cy.get(`[data-cy="permission-${group}"]`).should('not.exist')
      })
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Verify that user with previous READ permissions can no longer see / access the activity', function () {
    verifyREADPermissionsRevoked(this.data)
  })

  it('Verify that user with previous EXECUTE permissions can no longer see / access the activity', function () {
    verifyEXECUTEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous WRITE permissions can no longer see / access the activity', function () {
    verifyWRITEPermissionsRevoked(this.data)
  })

  it('Verify that user with previous ADMIN permissions can no longer see / access the activity', function () {
    verifyADMINPermissionsRevoked(this.data)
  })

  it("Transfer ownership of all group activities to user 'pro1' using the username", function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.wrap([
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

      // share the course with WRITE permissions with user pro1
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_IND_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

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
        `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
      ).contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it("Verify that user 'pro1' is the new owner and transfer the ownership back to the main user", function () {
    cy.loginIndividualCatalyst()

    // verify that the new owner sees all the correct actions
    cy.get('[data-cy="activities"]').click()
    verifyGroupActivityOwnerPermissions(this.data)

    // transfer the ownership of all quizzes back to the main user
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

      // grant a WRITE permission to the main user (should change the existing permission in this case)
      cy.get('[data-cy="new-permission-username-or-email"]')
        .click()
        .type(Cypress.env('LECTURER_SHORTNAME'))
      cy.selectOption(
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // transfer ownership back to the main user
      cy.get('[data-cy="transfer-ownership"]').click()
      cy.get('[data-cy="new-owner-username-email-input"]').type(
        Cypress.env('LECTURER_SHORTNAME')
      )
      cy.get('[data-cy="confirm-ownership-transfer"]').click()

      // verify that the correct permissions are displayed
      cy.get('[data-cy="transfer-ownership"]').should('not.exist')
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it("Remove the shared group activities from user 'pro1' using the removal functionality", function () {
    cy.loginIndividualCatalyst()

    // remove the shared group activities from user pro1
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.ga1,
      this.data.sharing.ga2,
      this.data.sharing.ga3,
      this.data.sharing.ga4,
      this.data.sharing.ga5,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz}"]`).click()
      cy.get(`[data-cy="remove-group-activity-${quiz}"]`).click()
      cy.get('[data-cy="confirm-deletion-final"]').click()
      cy.get('[data-cy="confirm-derived-access"]').click()
      cy.get('[data-cy="confirm-dependency-access"]').click()
      cy.get('[data-cy="confirmation-modal-confirm"]').click()
      cy.get(`[data-cy="activity-GROUP_ACTIVITY-${quiz}"]`).should('not.exist')
      cy.get('[data-cy="confirmation-modal-close"]').should('not.exist')
    })
    cy.logoutUser()

    // verify in the main user account that the corresponding permissions were removed
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      { name: this.data.sharing.ga1 },
      { name: this.data.sharing.ga2 },
      { name: this.data.sharing.ga3 },
      { name: this.data.sharing.ga4 },
      { name: this.data.sharing.ga5 },
    ]).each((quiz: { name: string }) => {
      cy.get(`[data-cy="actions-GROUP_ACTIVITY-${quiz.name}"]`).click()
      cy.get(`[data-cy="share-group-activity-${quiz.name}"]`).click()

      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })
  // #endregion
})
