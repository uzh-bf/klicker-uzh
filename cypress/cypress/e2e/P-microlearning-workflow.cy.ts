import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString } from './helpers'

// first start date: 2 months in the past at 12:30
const startDate1 = getDatetimeValidationString(-2, '10') + ', 12:30'

// first end date: 2 months in the future at 14:00
const endDate1 = getDatetimeValidationString(2, '20') + ', 14:00'

// second start date: 3 month in the past at 10:45
const startDate2 = getDatetimeValidationString(-3, '15') + ', 10:45'

// second end date: 5 month in the future at 16:00
const endDate2 = getDatetimeValidationString(5, '15') + ', 16:00'

// exention date: 8 months in the future at 18:50
const extensionDate = getDatetimeValidationString(8, '15') + ', 18:50'

// ? All microlearning creation steps are bundled in the beginning of the test, since reloading the page
// ? sometimes triggers a recomputation of the randomized question titles, not allowing for a comparison anymore
describe('Different microlearning workflows', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('P-microlearning.json').then((microLearningData) => {
      this.data = { ...this.data, ...microLearningData }
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
    cy.task('setCourseQAFlags', {
      courseName: 'Testkurs',
      isCourseQARolloutEnabled: true,
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: false,
    })
  })

  // ! Part 0: Preparation - Question Creation
  // #region
  it('Create questions required for microlearning creation', function () {
    cy.loginLecturer()

    // SC question without solution
    cy.createQuestionSC({
      name: this.data.SC.title,
      content: this.data.SC.content,
      choices: this.data.SC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // SC question with solution
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
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
      userId: Cypress.env('LECTURER_ID'),
    })

    // FT question
    cy.createQuestionFT({
      name: this.data.FTML.title,
      content: this.data.FTML.content,
      ...this.data.FTML.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // FC question
    cy.createFlashcard({
      name: this.data.FC.title,
      content: this.data.FC.content,
      explanation: this.data.FC.explanation,
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
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })

    // create a case study question
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

  // ! Part 1: Microlearning Creation
  // #region
  it('Create a microlearning around the current time', function () {
    // Start creation
    cy.loginLecturer()
    cy.get('[data-cy="create-microlearning"]').click()
    cy.get('[data-cy="cancel-activity-creation"]').click()
    cy.get('[data-cy="create-microlearning"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(this.data.running.name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(this.data.running.displayName)
    cy.get('[data-cy="insert-microlearning-description"]')
      .realClick()
      .realType(this.data.running.description)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.selectOption('[data-cy="select-course"]', this.data.course)
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)

    // set the start date to 2 months in the past at 12:30 (default is start of next month)
    cy.setDatetime({
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: -3,
        day: 10,
        hour: 12,
        minute: 30,
        validation: startDate1,
      },
    })

    // set the end date to 2 months in the future at 14:00 (default is start of next month)
    cy.setDatetime({
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: 1,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
    })

    // select multiplier
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
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Create stacks
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.createStacks({
      stacks: [
        // FT questions should also be accepted without sample solution
        { elements: [this.data.SCML.title, this.data.FTML.title] },
        { elements: [this.data.FC.title, this.data.CT.title] },
      ],
    })
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // SC question without sample solution should be rejected
    cy.dragAndDropElement({
      element: this.data.SC.title,
      target: 'drop-elements-stack-1',
    })
    cy.get('[data-cy="element-2-stack-1"]').contains(this.data.SC.title)
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="remove-element-2-stack-1"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // add displayname and description to stacks
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]')
      .click()
      .type(this.data.stack.title1)
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title1
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]')
      .click()
      .type(this.data.stack.title2)
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title2
    )
    cy.get('[data-cy="close-stack-description"]').click()

    // move stacks around
    cy.get('[data-cy="move-stack-0-right"]').click()
    cy.get('[data-cy="element-0-stack-1"]').contains(this.data.SCML.title)
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.FTML.title)
    cy.get('[data-cy="element-0-stack-0"]').contains(this.data.FC.title)
    cy.get('[data-cy="element-1-stack-0"]').contains(this.data.CT.title)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title2
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title1
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="move-stack-1-left"]').click()
    cy.get('[data-cy="element-0-stack-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="element-1-stack-0"]').contains(this.data.FTML.title)
    cy.get('[data-cy="element-0-stack-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.CT.title)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title1
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title2
    )
    cy.get('[data-cy="close-stack-description"]').click()

    // move questions in stack
    cy.get('[data-cy="move-element-0-stack-1-down"]').click()
    cy.get('[data-cy="element-0-stack-1"]').contains(this.data.CT.title)
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="move-element-1-stack-1-up"]').click()
    cy.get('[data-cy="element-0-stack-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.CT.title)

    // finalize microlearning creation
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // navigate to list of microlearnings and check status
    cy.get('[data-cy="open-activity-overview"]').click()
  })

  it('Edit the running microlearnings content', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="edit-microlearning-${this.data.running.name}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // check if the first page of the edit form are shown correctly
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', this.data.running.name)
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .clear()
      .type(this.data.running.nameNew)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', this.data.running.displayName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .clear()
      .type(this.data.running.displayNameNew)
    cy.get('[data-cy="insert-microlearning-description"]').contains(
      this.data.running.description
    )
    cy.get('[data-cy="insert-microlearning-description"]')
      .realClick()
      .clear()
      .realType(this.data.running.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)

    // check if correct values are in the form and rename it
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)

    // check, change and verify the start date
    // (before: 2 months in the past at 12:30, new: 3 months in the past at 10:45)
    cy.setDatetime({
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: -1,
        day: 15,
        hour: 10,
        minute: 45,
        validation: startDate2,
      },
    })

    // check, change and verify the end date
    // (before: 2 months in the future at 14:00, new: 5 months in the future at 16:00)
    cy.setDatetime({
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: {
        monthDelta: 3,
        day: 15,
        hour: 16,
        minute: 0,
        validation: endDate2,
      },
    })

    // update the activity multiplier
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
    cy.get('[data-cy="next-or-submit"]').click()

    // add another stack to the microlearning
    const addQuestions = [this.data.SCML.title, this.data.FTML.title]
    cy.get('[data-cy="drop-elements-add-stack"]').click()
    cy.wrap(addQuestions).each((element: string, ix) => {
      cy.dragAndDropElement({ element, target: `drop-elements-stack-2` })
      cy.get(`[data-cy="element-${ix}-stack-2"]`).contains(element)
    })

    // check stack descriptions
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title1
    )
    cy.get('[data-cy="stack-0-displayname"]')
      .click()
      .clear()
      .type(this.data.stack.title1New)
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title1New
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title2
    )
    cy.get('[data-cy="stack-1-displayname"]')
      .click()
      .clear()
      .type(this.data.stack.title2New)
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title2New
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.nameNew}-DRAFT"]`).should(
      'exist'
    )

    // recheck if the changes have been saved
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', this.data.running.nameNew)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', this.data.running.displayNameNew)
    cy.get('[data-cy="insert-microlearning-description"]').contains(
      this.data.running.descriptionNew
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-start-date"]').should('contain', startDate2)
    cy.get('[data-cy="select-end-date"]').should('contain', endDate2)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="element-0-stack-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="element-1-stack-0"]').contains(this.data.FTML.title)
    cy.get('[data-cy="element-0-stack-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.CT.title)
    cy.get('[data-cy="element-0-stack-2"]').contains(this.data.SCML.title)
    cy.get('[data-cy="element-1-stack-2"]').contains(this.data.FTML.title)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title1New
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title2New
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.nameNew}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Duplicate a microlearning and check the editors content', function () {
    // duplicate the microlearning
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="duplicate-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.findByText('Create ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // check general information
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', this.data.duplication.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', this.data.running.displayNameNew)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .clear()
      .type(this.data.duplication.displayName)
    cy.get('[data-cy="insert-microlearning-description"]').contains(
      this.data.running.descriptionNew
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the settings have been copied correctly
    cy.selectOption('[data-cy="select-course"]', this.data.course)
    cy.get('[data-cy="select-course"]').contains(this.data.course)
    cy.get('[data-cy="select-start-date"]').should('contain', startDate2)
    cy.get('[data-cy="select-end-date"]').should('contain', endDate2)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.activityWizard.multiplier4)
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the elements are correctly duplicated
    cy.get('[data-cy="element-0-stack-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="element-1-stack-0"]').contains(this.data.FTML.title)
    cy.get('[data-cy="element-0-stack-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.CT.title)
    cy.get('[data-cy="element-0-stack-2"]').contains(this.data.SCML.title)
    cy.get('[data-cy="element-1-stack-2"]').contains(this.data.FTML.title)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      this.data.stack.title1New
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      this.data.stack.title2New
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.duplication.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.duplication.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Create a microlearning that starts in the future', function () {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: this.data.future.name,
      displayName: this.data.future.displayName,
      description: this.data.future.description,
      courseName: this.data.course,
      multiplier: messages.manage.activityWizard.multiplier2,
      startDate: {
        monthDelta: 3,
        day: 11,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(3, '11') + ', 02:00',
      }, // 3 months in the future at 2:00
      endDate: {
        monthDelta: 7,
        day: 20,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(7, '20') + ', 18:00',
      }, // 7 months in the future at 18:00
      stacks: [{ elements: [this.data.SCML.title] }],
    })

    // check if creation was successful
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.future.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.future.name}-DRAFT"]`).should('exist')
  })

  it('Create a microlearning with all element types', function () {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: this.data.completed.name,
      displayName: this.data.completed.displayName,
      courseName: this.data.course,
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
            this.data.FC.title,
            this.data.CT.title,
          ],
        },
      ],
    })
  })
  // #endregion

  // ! Part 2: Running Microlearning and Answer Workflows / Student Frontend
  // #region
  function answerMicroLearningPreview(data) {
    cy.origin(Cypress.env('URL_STUDENT'), { args: { data } }, ({ data }) => {
      cy.get('[data-cy="start-microlearning"]').click()
      cy.get('[data-cy="sc-0-answer-option-0"]').click()
      cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
      cy.get('[data-cy="free-text-input-1"]').click().type(data.FTML.answer)
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.get('[data-cy="student-stack-continue"]').click()

      cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
      cy.get('[data-cy="flashcard-front-0"]').click()
      cy.get('[data-cy="flashcard-response-0-No"]').click()
      cy.get('[data-cy="flashcard-response-0-Yes"]').click()
      cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should(
        'not.be.disabled'
      )
      cy.get('[data-cy="read-content-element-1"]').click()
      cy.get('[data-cy="student-stack-submit"]').click()

      cy.get('[data-cy="sc-0-answer-option-0"]').click()
      cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
      cy.get('[data-cy="free-text-input-1"]').click().type(data.FTML.answer)
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.get('[data-cy="student-stack-continue"]').click()
    })
  }

  it('Check if the drafted microlearning can be accessed by the lecturer through the activity preview', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getMicroLearningInfo', { mlName: this.data.running.nameNew }).then(
      (quiz: { id: string; courseId: string }) => {
        // check if the query was successful
        if (quiz === null) {
          throw new Error('Microlearning not found')
        }

        // visit the activity preview with the manager cookie being active
        cy.visit(
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/microLearnings/${quiz.id}`
        )

        // verify that the microlearning can be answered through the activity preview
        answerMicroLearningPreview(this.data)
      }
    )
  })

  it('Publish a microlearning that will be running immediately', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(
      `[data-cy="publish-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="status-${this.data.running.nameNew}-PUBLISHED"]`).should(
      'exist'
    )
  })

  it('Check if the running microlearning can be accessed by the lecturer through the activity preview', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getMicroLearningInfo', { mlName: this.data.running.nameNew }).then(
      (quiz: { id: string; courseId: string }) => {
        // check if the query was successful
        if (quiz === null) {
          throw new Error('Microlearning not found')
        }

        // visit the activity preview with the manager cookie being active
        cy.visit(
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/microLearnings/${quiz.id}`
        )

        // verify that the microlearning can be answered through the activity preview
        answerMicroLearningPreview(this.data)
      }
    )
  })

  it('Extend the running microlearning', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    // open extension modal
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="extend-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="extend-microlearning-${this.data.running.nameNew}"]`
    ).click()

    // change the end date and check if the changes are saved
    cy.setDatetime({
      cyString: 'extend-activity-date',
      deselectorString: 'extension-modal-description',
      datetime: {
        monthDelta: 3,
        day: 15,
        hour: 18,
        minute: 50,
        validation: extensionDate,
      },
    })

    cy.get('[data-cy="extend-activity-confirm"]').click()
    cy.wait(1000) // wait for the extension to be processed and stored

    // check that changing the date to the past does not work
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="extend-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get('[data-cy="extend-activity-confirm"]').should('not.be.disabled')
    cy.setDatetime({
      cyString: 'extend-activity-date',
      deselectorString: 'extension-modal-description',
      datetime: {
        monthDelta: -12,
        day: 15,
        hour: 12,
        minute: 0,
        validation: getDatetimeValidationString(-4, '15') + ', 12:00',
      },
    })
    cy.get('[data-cy="extend-activity-confirm"]').should('be.disabled')
    cy.get('[data-cy="extend-activity-cancel"]').click()
  })

  it('Respond to the first stack of the running microlearning from a laptop', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.running.displayNameNew}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').click().type('Free text answer')
    cy.get('[data-cy="student-stack-submit"]').click()
  })

  it("Check that the student's previous response is correctly loaded (despite cookie reset) and respond to the second stack", function () {
    // sign in as a student on a mobile device and respond to the all questions
    cy.viewport('iphone-6+')
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.loginStudent()

    cy.get(
      `[data-cy="microlearning-${this.data.running.displayNameNew}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').should(
      'have.value',
      'Free text answer'
    )
    cy.get('[data-cy="student-stack-continue"]').click() // skip first already answered question (fetch from backend)

    // answer the second element stack
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-0"]').click()
    cy.get('[data-cy="flashcard-response-0-No"]').click()
    cy.get('[data-cy="flashcard-response-0-Yes"]').click()
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // answer the third element stack and finish microlearning
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').click().type('Free text answer 2')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    cy.get('[data-cy="microlearning-evaluation-qa-panel"]')
      .next('[data-cy="microlearning-evaluation-results"]')
      .should('exist')
    cy.get('[data-cy="microlearning-evaluation-qa-toggle"]')
      .should('have.attr', 'aria-expanded', 'false')
      .click()
      .should('have.attr', 'aria-expanded', 'true')
    cy.get('[data-cy="microlearning-evaluation-qa-context"]')
      .find('option')
      .first()
      .should('contain.text', '1.')
    cy.get('[data-cy="microlearning-evaluation-qa-context"]')
      .find('option')
      .eq(1)
      .invoke('val')
      .then((stackId) => {
        const value = String(stackId)
        cy.get('[data-cy="microlearning-evaluation-qa-context"]')
          .select(value)
          .should('have.value', value)
        cy.get(
          `[id="microlearning-evaluation-qa-${value}-thread-content"]`
        ).should('be.visible')
      })

    cy.get('[data-cy="finish-microlearning"]').click()
    cy.wait(1000)
    cy.get(
      `[data-cy="microlearning-${this.data.running.displayNameNew}"]`
    ).should('exist')
    cy.get(
      `[data-cy="microlearning-${this.data.running.displayNameNew}"]`
    ).should('be.disabled')
  })

  it('End the running microlearning', function () {
    cy.viewport('macbook-16')
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="end-microlearning-${this.data.running.nameNew}"]`).click()
    cy.get(`[data-cy="confirm-responses-microlearning"]`).should('not.exist')
    cy.get(`[data-cy="confirm-anonymous-responses-microlearning"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="end-microlearning-${this.data.running.nameNew}"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
  })

  it('Check that the microlearning is no longer visible to the student that submitted answers', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.running.displayNameNew}"]`
    ).should('not.exist')
  })

  it("Check that other students can't see the microlearning", function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(
      `[data-cy="microlearning-${this.data.running.displayNameNew}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete the running microlearning to avoid name collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the running microlearning
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('not.be.disabled')
    cy.get(`[data-cy="confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.running.nameNew}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete the duplicated microlearning to avoid name collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the duplicated microlearning
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.duplication.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.duplication.name}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.duplication.name}"]`
    ).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted microlearning (with results) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedMicrolearning', {
      mlName: this.data.running.nameNew,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted microlearning with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion

  // ! Part 3: Future Microlearning
  // #region
  it('Publish the future microlearning', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="publish-microlearning-${this.data.future.name}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="status-${this.data.future.name}-SCHEDULED"]`).should(
      'exist'
    )
  })

  it('Verify that future microlearnings are not shown to students', function () {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${this.data.future.displayName}"]`).should(
      'not.exist'
    )
  })

  it('Check that a scheduled microlearning can be accessed through the activity preview', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getMicroLearningInfo', { mlName: this.data.future.name }).then(
      (quiz: { id: string; courseId: string }) => {
        // check if the query was successful
        if (quiz === null) {
          throw new Error('Microlearning not found')
        }

        // visit the activity preview with the manager cookie being active
        cy.visit(
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/microLearnings/${quiz.id}`
        )

        // verify that the scheduled microlearning is visible to lecturers
        cy.origin(Cypress.env('URL_STUDENT'), () => {
          cy.get('[data-cy="start-microlearning"]').should('exist')
        })
      }
    )
  })

  it('Unpublish the future microlearning from the lecturer view', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.future.name}"]`
    ).click()
    cy.get(
      `[data-cy="unpublish-microlearning-${this.data.future.name}"]`
    ).click()
    cy.get(`[data-cy="status-${this.data.future.name}-DRAFT"]`).should('exist')
  })

  it('Cleanup: Delete the future microlearning to avoid name collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the future microlearning
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.future.name}"]`
    ).click()
    cy.get(`[data-cy="delete-microlearning-${this.data.future.name}"]`).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-anonymous-responses"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.future.name}"]`
    ).should('not.exist')
  })
  // #endregion

  // ! Part 4: Complete Microlearning
  // #region
  it('Publish the microlearning that contains all question types', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="publish-microlearning-${this.data.completed.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="status-${this.data.completed.name}-PUBLISHED"]`).should(
      'exist'
    )
  })

  function enterValidCompleteInputs(data) {
    // enter valid response for all questions to check correct input validation afterwards
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')

    cy.get('[data-cy="sc-0-answer-option-1"]').click()

    cy.get('[data-cy="mc-1-answer-option-1"]').click()

    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()

    cy.get('[data-cy="input-numerical-3"]').clear().type(data.NRML.answer)

    cy.get('[data-cy="free-text-input-4"]').type(data.FTML.answer)

    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-2"]').click()
    cy.get('[id="selection-5-field-0"]').contains(data.collection.options[2])
    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-0"]').click()
    cy.get('[id="selection-5-field-0"]').contains(data.collection.options[0])
    cy.get('[id="selection-5-field-1"]').click()
    cy.get('[id="react-select-selection-5-field-1-option-0"]').click()
    cy.get('[id="selection-5-field-1"]').contains(data.collection.options[1])
    cy.get('[id="selection-5-field-2"]').click()
    cy.get('[id="react-select-selection-5-field-2-option-0"]').click()
    cy.get('[id="selection-5-field-2"]').contains(data.collection.options[2])

    cy.answerCaseStudy({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
    })

    cy.get('[data-cy="flashcard-front-7"]').click()
    cy.get('[data-cy="flashcard-response-7-No"]').click()
    cy.get('[data-cy="flashcard-response-7-Yes"]').click()

    cy.get('[data-cy="read-content-element-8"]').click()
  }

  function verifyPersistentCompleteInputs(data) {
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')

    cy.get('[data-cy="mc-1-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-3"]').should('be.disabled')

    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('have.value', data.NRML.answer)
      .should('be.disabled')

    cy.get('[data-cy="free-text-input-4"]')
      .should('have.value', data.FTML.answer)
      .should('be.disabled')

    cy.get('[id="selection-5-field-0"]')
      .contains(data.collection.options[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-5-field-1"]')
      .contains(data.collection.options[1])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-5-field-2"]')
      .contains(data.collection.options[2])
      .should('have.css', 'pointer-events', 'none')

    cy.verifyCaseStudyInputs({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })

    cy.get('[data-cy="flashcard-response-7-No"]').should('be.disabled')
    cy.get('[data-cy="flashcard-response-7-Partially"]').should('be.disabled')
    cy.get('[data-cy="flashcard-response-7-Yes"]').should('be.disabled')
  }

  it('Respond to all questions in the microlearning covering all element types', function () {
    cy.loginStudent()

    cy.get(
      `[data-cy="microlearning-${this.data.completed.displayName}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // enter valid response for all questions to check correct input validation afterwards
    enterValidCompleteInputs(this.data)
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')

    // test inputs to MC question (2)
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-1-answer-option-2"]').click()

    // test inputs to NR question (4)
    cy.get('[data-cy="input-numerical-3"]').clear().type('-20')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').clear().type('10.45')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-3"]').clear().type('100')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-3"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-3"]').type(this.data.NRML.answer)

    // test inputs to FT question (5)
    cy.get('[data-cy="free-text-input-4"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-4"]').type(this.data.FTML.answer)

    // submit responses
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)

    // verify that the entered answers persist and inputs are disabled
    verifyPersistentCompleteInputs(this.data)

    // verify that the results persist across a reload
    cy.reload()
    verifyPersistentCompleteInputs(this.data)

    // verify that the entered answers are correctly refetched from the backend after a reload and cookie reset
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.reload()
    cy.wait(1000)
    verifyPersistentCompleteInputs(this.data)

    // finish the microlearning
    cy.get('[data-cy="student-stack-continue"]')
      .contains(messages.shared.generic.finish)
      .click()
  })

  function enterValidPartialInputs(data) {
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').click()
    cy.get('[data-cy="input-numerical-3"]').clear().type(data.NRML.answer)
    cy.get('[data-cy="free-text-input-4"]').type(data.FTML.answer)

    cy.get('[id="selection-5-field-0"]').click()
    cy.get('[id="react-select-selection-5-field-0-option-2"]').click()
    cy.get('[id="selection-5-field-0"]').contains(data.collection.options[2])

    cy.answerCaseStudy({
      elementIx: 6,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
    })

    cy.get('[data-cy="flashcard-front-7"]').click()
    cy.get('[data-cy="flashcard-response-7-No"]').click()
    cy.get('[data-cy="flashcard-response-7-Yes"]').click()
    cy.get('[data-cy="read-content-element-8"]').click()
  }

  function verifyPersistentPartialInputs(data) {
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')

    cy.get('[data-cy="mc-1-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-3"]').should('be.disabled')

    cy.get('[data-cy="toggle-kp-2-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-0-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-2-answer-3-incorrect"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('have.value', data.NRML.answer)
      .should('be.disabled')

    cy.get('[data-cy="free-text-input-4"]')
      .should('have.value', data.FTML.answer)
      .should('be.disabled')

    cy.get('[id="selection-5-field-0"]')
      .contains(data.collection.options[2])
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

    cy.get('[data-cy="flashcard-response-7-No"]').should('be.disabled')
    cy.get('[data-cy="flashcard-response-7-Partially"]').should('be.disabled')
    cy.get('[data-cy="flashcard-response-7-Yes"]').should('be.disabled')
  }

  it('Answer to the microlearning with partial responses (where supported)', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    cy.get(
      `[data-cy="microlearning-${this.data.completed.displayName}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // enter responses for all questions (partial responses where supported)
    enterValidPartialInputs(this.data)

    // submit responses
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)

    // verify that the entered answers persist and inputs are disabled
    verifyPersistentPartialInputs(this.data)

    //
    cy.get('[data-cy="student-stack-continue"]')
      .contains(messages.shared.generic.finish)
      .click() // finish quiz
  })

  it('Cleanup: Delete the complete microlearning to avoid naming collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the microlearning with all element types
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.completed.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.completed.name}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.completed.name}"]`
    ).should('not.exist')
  })

  it('Make sure that the complete microlearning is no longer visible to students', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.completed.displayName}"]`
    ).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted microlearning (with results) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedMicrolearning', {
      mlName: this.data.completed.name,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted microlearning with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion

  // ! Part 5: Practice Quiz Conversion
  // #region
  it('Convert the a past microlearning into a practice quiz', function () {
    const MLName = 'Microlearning for conversion'
    const MLDisplayName = 'Microlearning for conversion (display name)'

    // create questions and microlearning
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML.title,
      content: this.data.MCML.content,
      choices: this.data.MCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML.title,
      content: this.data.KPML.content,
      choices: this.data.KPML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionFT({
      name: this.data.FTML.title,
      content: this.data.FTML.content,
      ...this.data.FTML.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createFlashcard({
      name: this.data.FC.title,
      content: this.data.FC.content,
      explanation: this.data.FC.explanation,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.createMicroLearning({
      name: MLName,
      displayName: MLDisplayName,
      courseName: this.data.course,
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
      stacks: [
        { elements: [this.data.SCML.title, this.data.MCML.title] },
        { elements: [this.data.KPML.title, this.data.NRML.title] },
        { elements: [this.data.FTML.title] },
        { elements: [this.data.FC.title] },
      ],
    })
    cy.wait(1000)
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    // publish and end microleraning
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="publish-microlearning-${MLName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="activity-MICRO_LEARNING-${MLName}"]`).should('exist')
    cy.get(`[data-cy="status-${MLName}-PUBLISHED"]`).should('exist')
    cy.get(`[data-cy="actions-MICRO_LEARNING-${MLName}"]`).click()
    cy.get(`[data-cy="end-microlearning-${MLName}"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)

    // start conversion of a microlearning into a practice quiz
    cy.get(`[data-cy="actions-MICRO_LEARNING-${MLName}"]`).click()
    cy.get(
      `[data-cy="convert-microlearning-${MLName}-to-practice-quiz"]`
    ).click()

    // check if the practice quiz editor is open
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .should('have.value', `${MLName} (converted)`)
      .clear()
      .type(this.data.conversion.pqName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .should('have.value', MLDisplayName)
      .clear()
      .type(this.data.conversion.pqDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // continue to the next step and change the default settings
    cy.selectOption('[data-cy="select-course"]', this.data.course)
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
    cy.get('[data-cy="insert-reset-time-days"]').clear().type('4')
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.activityWizard.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="next-or-submit"]').click()

    // check if any questions are contained in the question step and create quiz
    cy.get('[data-cy="move-stack-1-left"]').should('exist').click()
    cy.get('[data-cy="move-stack-1-right"]').should('exist').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the practice quiz is listed in the course overview
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.conversion.pqName}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.conversion.pqName}-DRAFT"]`).should(
      'exist'
    )
  })
  // #endregion

  // ! Part 6: Verify Editing / Duplication with Updated / Deleted Questions
  // #region
  it('Create a microlearning with a selection question', function () {
    cy.loginLecturer()

    // create answer collection and selection question
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection2.name,
      description: this.data.collection2.description,
      entries: this.data.collection2.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.SEML2.title,
      content: this.data.SEML2.content,
      numberOfInputs: this.data.SEML2.inputs,
      collectionName: this.data.collection2.name,
      correctAnswers: this.data.collection2.options.filter((_, i) =>
        this.data.SEML2.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })

    // create microlearning with selection question
    cy.createMicroLearning({
      name: this.data.manipulation.name,
      displayName: this.data.manipulation.displayName,
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
      courseName: this.data.manipulation.course,
      stacks: [{ elements: [this.data.SEML2.title] }],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.manipulation.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Edit the selection question and edit & save the microlearning without making any changes', function () {
    cy.loginLecturer()

    // modify numerical question
    cy.editElement({ element: this.data.SEML2.title })
    cy.get('[data-cy="instance-update-switch"]').click() // deactivate instance updates (on by default)
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.manipulation.newSETitle)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .realType(this.data.manipulation.newSEContent)
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(1000) // wait for the question to be saved and the modal to be closed

    // edit and save the unmodified practice quiz
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // save the practice quiz without modifications
    cy.get('[data-cy="insert-microlearning-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-stack-0"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.manipulation.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Add both the edited selection question and a new case study element to the microlearning', function () {
    cy.loginLecturer()

    // create new case study element
    cy.createQuestionCS({
      name: this.data.CSML2.title,
      content: this.data.CSML2.content,
      explanation: this.data.CSML2.explanation,
      collectionName: this.data.collection2.name,
      selectedItems: this.data.collection2.options.filter((_, i) =>
        this.data.CSML2.selectedItems.includes(i)
      ),
      criteria: this.data.CSML2.criteria,
      cases: this.data.CSML2.cases,
      solutions: this.data.CSML2.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })

    // include both the updated selection question and case study in the microlearning
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // save the practice quiz without modifications
    cy.get('[data-cy="insert-microlearning-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()

    cy.dragAndDropElement({
      element: this.data.manipulation.newSETitle,
      target: 'drop-elements-stack-0',
    })
    cy.get(`[data-cy="element-1-stack-0"]`).contains(
      this.data.manipulation.newSETitle.substring(0, 20)
    )

    cy.get(`[data-cy="drop-elements-add-stack"]`).click()
    cy.dragAndDropElement({
      element: this.data.CSML2.title,
      target: 'drop-elements-stack-1',
    })
    cy.get(`[data-cy="element-0-stack-1"]`).contains(
      this.data.CSML2.title.substring(0, 20)
    )

    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.manipulation.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Delete the selection and case study elements in the library, as well as the associated answer collection, re-order the stacks on the microlearning and publish it', function () {
    cy.loginLecturer()

    // delete elements
    cy.deleteElement({ elementName: this.data.manipulation.newSETitle })
    cy.wait(500)
    cy.deleteElement({ elementName: this.data.CSML2.title })
    cy.wait(500)

    // delete associated answer collection
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({
      collectionName: this.data.collection2.name,
    })

    // edit the microlearning
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // re-order the stacks on the microlearning questions step
    cy.get('[data-cy="insert-microlearning-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.SEML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-1-stack-0"]').contains(
      this.data.manipulation.newSETitle.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.CSML2.title.substring(0, 20)
    )
    cy.get('[data-cy="move-stack-0-right"]').click()
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.CSML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.SEML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-1-stack-1"]').contains(
      this.data.manipulation.newSETitle.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.manipulation.name}-DRAFT"]`).should(
      'exist'
    )

    // publish the microlearning
    cy.get(
      `[data-cy="publish-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="status-${this.data.manipulation.name}-PUBLISHED"]`
    ).should('exist')
  })

  it('Respond to the elements in the published microlearning and verify their content', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.manipulation.displayName}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // answer elements in stack 1
    cy.findByText(this.data.CSML2.content).should('exist')
    cy.answerCaseStudy({
      elementIx: 0,
      answers: this.data.CSML2.answers,
      criteria: this.data.CSML2.criteria,
    })
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    // answer elements in stack 2
    cy.findByText(this.data.SEML2.content).should('exist')
    cy.get('[id="selection-0-field-0"]').click()
    cy.get('[id="react-select-selection-0-field-0-option-2"]').click()
    cy.get('[id="selection-0-field-0"]').contains(
      this.data.collection2.options[2]
    )
    cy.get('[id="selection-0-field-2"]').click()
    cy.get('[id="react-select-selection-0-field-2-option-0"]').click()
    cy.get('[id="selection-0-field-2"]').contains(
      this.data.collection2.options[0]
    )

    cy.findByText(this.data.manipulation.newSEContent).should('exist')
    cy.get('[id="selection-1-field-0"]').click()
    cy.get('[id="react-select-selection-1-field-0-option-2"]').click()
    cy.get('[id="selection-1-field-0"]').contains(
      this.data.collection2.options[2]
    )
    cy.get('[id="selection-1-field-2"]').click()
    cy.get('[id="react-select-selection-1-field-2-option-0"]').click()
    cy.get('[id="selection-1-field-2"]').contains(
      this.data.collection2.options[0]
    )
    cy.get('[data-cy="student-stack-submit"]').click()
  })

  it('Duplicate the microlearning, verify that the elements shown in the editor are the same as in the original microlearning, and publish it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="duplicate-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Create ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // edit the name / displayname and ensure that the correct instance are added
    cy.get('[data-cy="insert-microlearning-name"]')
      .clear()
      .type(this.data.manipulation.duplicateName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .clear()
      .type(this.data.manipulation.duplicateDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.manipulation.course)
    cy.get('[data-cy="select-course"]').contains(this.data.manipulation.course)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.CSML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.SEML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-1-stack-1"]').contains(
      this.data.manipulation.newSETitle.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.duplicateName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="status-${this.data.manipulation.duplicateName}-DRAFT"]`
    ).should('exist')

    // publish the microlearning
    cy.get(
      `[data-cy="publish-microlearning-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.duplicateName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="status-${this.data.manipulation.duplicateName}-PUBLISHED"]`
    ).should('exist')
  })

  it('Respond to the elements in the duplicated microlearning and verify their content', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.manipulation.duplicateDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // answer elements in stack 1
    cy.findByText(this.data.CSML2.content).should('exist')
    cy.answerCaseStudy({
      elementIx: 0,
      answers: this.data.CSML2.answers,
      criteria: this.data.CSML2.criteria,
    })
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    // answer elements in stack 2
    cy.findByText(this.data.SEML2.content).should('exist')
    cy.get('[id="selection-0-field-0"]').click()
    cy.get('[id="react-select-selection-0-field-0-option-2"]').click()
    cy.get('[id="selection-0-field-0"]').contains(
      this.data.collection2.options[2]
    )
    cy.get('[id="selection-0-field-2"]').click()
    cy.get('[id="react-select-selection-0-field-2-option-0"]').click()
    cy.get('[id="selection-0-field-2"]').contains(
      this.data.collection2.options[0]
    )

    cy.findByText(this.data.manipulation.newSEContent).should('exist')
    cy.get('[id="selection-1-field-0"]').click()
    cy.get('[id="react-select-selection-1-field-0-option-2"]').click()
    cy.get('[id="selection-1-field-0"]').contains(
      this.data.collection2.options[2]
    )
    cy.get('[id="selection-1-field-2"]').click()
    cy.get('[id="react-select-selection-1-field-2-option-0"]').click()
    cy.get('[id="selection-1-field-2"]').contains(
      this.data.collection2.options[0]
    )
    cy.get('[data-cy="student-stack-submit"]').click()
  })

  it('Delete both microlearnings to avoid naming collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the first microlearning
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.name}"]`
    ).should('not.exist')

    // delete the duplicated microlearning
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.wait(500)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.manipulation.duplicateName}"]`
    ).should('not.exist')
  })
  // #endregion

  // ! Part 5: Sharing of Microlearnings
  // #region
  function verifyMicroLearningDetailsModalContent(
    activityName: string,
    data: any
  ) {
    cy.get(`[data-cy="activity-name-${activityName}"]`).click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(
      data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      data.MCML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-2"]').contains(
      data.KPML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-3"]').contains(
      data.NRML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-4"]').contains(
      data.FTML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-5"]').contains(
      data.SEML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-6"]').contains(
      data.CSML.title.substring(0, 20)
    )
    cy.get('[data-cy="stack-0-instance-7"]').contains(
      data.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="close-activity-details-modal"]').click()
  }

  function verifyMicroLearningOwnerPermissions(data: any) {
    // for a draft microlearning the following options should be available: publish, edit, open preview, access link, lti link, duplicate, share, delete
    cy.get(`[data-cy="publish-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro1}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro1}"]`).should('exist')
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)

    // for a scheduled microlearning the following options should be available: access link, open preview, lti link, duplicate, share, unpublish, delete
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro2}"]`).click()
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro2}"]`).should('exist')
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)

    // for a running microlearning the following options should be available: access link, evaluation, end, extend, open preview, lti link, duplicate, share, delete
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro3}"]`).click()
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro3}"]`
    ).should('exist')
    cy.get(`[data-cy="end-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="extend-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro3}"]`).should('exist')
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)

    // for a completed microlearning the following options should be available: evaluation, duplicate, convert, open preview, share, delete
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro4}"]`
    ).should('exist')

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro4}"]`).click()
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="convert-microlearning-${data.sharing.micro4}-to-practice-quiz"]`
    ).should('exist')
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  function verifyMicroLearningREADPermissions(
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
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // for a draft microlearning the following options should be available: open preview, access link, lti link, remove
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro1}"]`).click()
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro1}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)

    // for a scheduled microlearning the following options should be available: access link, open preview, lti link, remove
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro2}"]`).click()
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro2}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)

    // for a running microlearning the following options should be available: access link, evaluation, open preview, lti link, remove
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro3}"]`).click()
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro3}"]`
    ).should('exist')
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)

    // for a completed microlearning the following options should be available: evaluation, analytics, open preview, remove
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro4}"]`
    ).should('exist')

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro4}"]`).click()
    cy.get(`[data-cy="open-analytics-async-activity"]`).should('exist')
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  function verifyMicroLearningEXECUTEPermissions(
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
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
    })

    // for a draft microlearning the following options should be available: publish, open preview, access link, lti link, remove
    cy.get(`[data-cy="publish-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro1}"]`).click()
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro1}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)

    // for a scheduled microlearning the following options should be available: access link, open preview, lti link, unpublish, remove
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro2}"]`).click()
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro2}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)

    // for a running microlearning the following options should be available: access link, evaluation, end, extend, open preview, lti link, remove
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro3}"]`).click()
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro3}"]`
    ).should('exist')
    cy.get(`[data-cy="end-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="extend-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)

    // for a completed microlearning the following options should be available: evaluation, analytics, open preview, remove
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro4}"]`
    ).should('exist')

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro4}"]`).click()
    cy.get(`[data-cy="open-analytics-async-activity"]`).should('exist')
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  function verifyMicroLearningWRITEPermissions(
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
    ]).each((title: string) => {
      cy.validateElement({ element: title, shouldExist: false })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
    })
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="change-activity-name-${data.sharing.micro4}"]`).should(
      'not.exist'
    ) // name change action not available for ended activities

    // for a draft microlearning the following options should be available: publish, edit, open preview, access link, lti link, remove
    cy.get(`[data-cy="publish-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro1}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro1}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)

    // for a scheduled microlearning the following options should be available: access link, open preview, lti link, unpublish, remove
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro2}"]`).click()
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro2}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)

    // for a running microlearning the following options should be available: access link, evaluation, end, extend, open preview, lti link, remove
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro3}"]`).click()
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro3}"]`
    ).should('exist')
    cy.get(`[data-cy="end-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="extend-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro3}"]`).should('exist')
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)

    // for a completed microlearning the following options should be available: evaluation, analytics, open preview, remove
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro4}"]`
    ).should('exist')

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro4}"]`).click()
    cy.get(`[data-cy="open-analytics-async-activity"]`).should('exist')
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get('body').type('{esc}') // close dropdown

    verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  function verifyMicroLearningADMINPermissions(
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
    ]).each((title: string) => {
      cy.validateElement({ element: title })
    })

    // open the activity overview and check the actions on all shared activities
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('exist')
      cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
    })
    cy.get(`[data-cy="activity-MICRO_LEARNING-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="change-activity-name-${data.sharing.micro4}"]`).should(
      'not.exist'
    ) // name change action not available for ended activities

    // for a draft microlearning the following options should be available: publish, edit, open preview, access link, lti link, duplicate, share, remove, delete
    cy.get(`[data-cy="publish-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro1}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro1}"]`).should('exist')
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro1}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro1, data)

    // for a scheduled microlearning the following options should be available: access link, open preview, lti link, duplicate, share, unpublish, remove, delete
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro2}"]`).click()
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro2}"]`).should('exist')
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro2}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro2, data)

    // for a running microlearning the following options should be available: access link, evaluation, end, extend, open preview, lti link, duplicate, share, remove, delete
    cy.get(`[data-cy="copy-microlearning-link-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro3}"]`).click()
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro3}"]`
    ).should('exist')
    cy.get(`[data-cy="end-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="extend-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.micro3}"]`).should('exist')
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro3}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro3, data)

    // for a completed microlearning the following options should be available: evaluation, duplicate, convert, analytics, open preview, share, remove, delete
    cy.get(
      `[data-cy="evaluation-microlearning-${data.sharing.micro4}"]`
    ).should('exist')

    cy.get(`[data-cy="actions-MICRO_LEARNING-${data.sharing.micro4}"]`).click()
    cy.get(`[data-cy="duplicate-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="convert-microlearning-${data.sharing.micro4}-to-practice-quiz"]`
    ).should('exist')
    cy.get(`[data-cy="open-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-activity-log-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-microlearning-${data.sharing.micro4}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-microlearning-${data.sharing.micro4}"]`).should(
      'exist'
    )

    cy.get('body').type('{esc}') // close dropdown
    verifyMicroLearningDetailsModalContent(data.sharing.micro4, data)
  }

  function verifyREADPermissionsRevoked(data: any) {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared microlearnings should no longer be visible
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('not.exist')
    })
  }

  function verifyEXECUTEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared microlearnings should no longer be visible
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('not.exist')
    })
  }

  function verifyWRITEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="activities"]').click()

    // previously shared microlearnings should no longer be visible
    cy.wrap([
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('not.exist')
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
    ]).each((element: string) => {
      cy.validateElement({ element, shouldExist: false })
    })

    // previously shared microlearnings should no longer be visible
    cy.get('[data-cy="activities"]').click()
    const quizzes = [
      data.sharing.micro1,
      data.sharing.micro2,
      data.sharing.micro3,
      data.sharing.micro4,
    ]
    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('not.exist')
    })
  }

  it('Create four different microlearnings and make sure that all required actions are shown to the object owner', function () {
    cy.loginLecturer()

    // create four different microlearnings
    for (let i = 1; i <= 4; i++) {
      cy.createMicroLearning({
        name: this.data.sharing[`micro${i}`],
        displayName: this.data.sharing[`micro${i}Display`],
        courseName: this.data.seededCourse,
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
              this.data.CT.title,
            ],
          },
        ],
      })
      cy.get('[data-cy="create-new-activity"]').click()
    }

    // change the status of the second microlearning to scheduled
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.micro2,
      activityType: 'MICRO_LEARNING',
      status: 'SCHEDULED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Microlearning to change status was not found in the database'
        )
      }
    })

    // change the status of the third microlearning to published
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.micro3,
      activityType: 'MICRO_LEARNING',
      status: 'PUBLISHED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Microlearning to change status was not found in the database'
        )
      }
    })

    // change the status of the fourth microlearning to ended
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.micro4,
      activityType: 'MICRO_LEARNING',
      status: 'ENDED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Microlearning to change status was not found in the database'
        )
      }
    })
    cy.reload()

    // verify that the owner sees all the correct actions
    cy.get('[data-cy="activities"]').click()
    verifyMicroLearningOwnerPermissions(this.data)
  })

  it('Share the microlearnings individual with different users and different permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    // grant READ, EXECUTE, WRITE and ADMIN permissions on all microlearnings to the users 2, 3, 4 and 5, respectively
    cy.wrap([
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()

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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_INST3_SHORTNAME')}"]`
      )
        .should('exist')
        .contains(messages.manage.sharing.permissionsADMIN)

      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Log in as the user with READ permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningREADPermissions(this.data, false)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningEXECUTEPermissions(this.data, false)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningWRITEPermissions(this.data, false)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningADMINPermissions(this.data, false)
  })

  it('Revoke the direct individual permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]
    const users = [
      Cypress.env('LECTURER_IND_SHORTNAME'),
      Cypress.env('LECTURER_INST_SHORTNAME'),
      Cypress.env('LECTURER_INST2_SHORTNAME'),
      Cypress.env('LECTURER_INST3_SHORTNAME'),
    ]

    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()

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

  it('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the microlearnings with them', function () {
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

    // share the microlearnings with the user groups with READ, EXECUTE, WRITE and ADMIN permissions
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()

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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
      cy.get(`[data-cy="permission-${this.data.sharing.group4}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsADMIN)
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })

  it('Log in as the user with READ permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningREADPermissions(this.data, true)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningEXECUTEPermissions(this.data, true)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningWRITEPermissions(this.data, true)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyMicroLearningADMINPermissions(this.data, true)
  })

  it('Revoke the direct group permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]
    const groups = [
      this.data.sharing.group1,
      this.data.sharing.group2,
      this.data.sharing.group3,
      this.data.sharing.group4,
    ]

    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()

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

  it("Transfer ownership of all microlearnings to user 'pro1' using the username", function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.wrap([
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()

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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
    verifyMicroLearningOwnerPermissions(this.data)

    // transfer the ownership of all quizzes back to the main user
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()

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
      cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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

  it("Remove the shared microlearnings from user 'pro1' using the removal functionality", function () {
    cy.loginIndividualCatalyst()

    // remove the shared microlearnings from user pro1
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="remove-microlearning-${quiz}"]`).click()
      cy.get('[data-cy="confirm-deletion-final"]').click()
      cy.get('[data-cy="confirm-derived-access"]').click()
      cy.get('[data-cy="confirm-dependency-access"]').click()
      cy.get('[data-cy="confirmation-modal-confirm"]').click()
      cy.wait(500)
      cy.get(`[data-cy="activity-MICRO_LEARNING-${quiz}"]`).should('not.exist')
      cy.get('[data-cy="confirmation-modal-close"]').should('not.exist')
    })
    cy.logoutUser()

    // verify in the main user account that the corresponding permissions were removed
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.micro1,
      this.data.sharing.micro2,
      this.data.sharing.micro3,
      this.data.sharing.micro4,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-MICRO_LEARNING-${quiz}"]`).click()
      cy.get(`[data-cy="share-microlearning-${quiz}"]`).click()
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })
  // #endregion

  // ! Part 6: Activity Details Points
  // #region
  it('Create a microlearning in a gamified course and validate that points are shown correctly', function () {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: this.data.details.name,
      displayName: this.data.details.displayName,
      courseName: this.data.details.courseName,
      multiplier: messages.manage.activityWizard.multiplier2,
      startDate: {
        monthDelta: -2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: startDate1,
      },
      endDate: {
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
      stacks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.FC.title,
            this.data.CT.title,
          ],
        },
        {
          elements: [
            this.data.MCML.title,
            this.data.NRML.title,
            this.data.FTML.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.details.name}"]`
    ).should('exist')

    cy.get(`[data-cy="activity-name-${this.data.details.name}"]`).click()
    cy.assertAsynchronousActivityPoints({ totalPoints: 80 })

    cy.get('[data-cy="activity-details-stack-header-0"]').contains('20 P.')
    cy.get('[data-cy="activity-details-stack-header-1"]').contains('60 P.')

    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.CT.title)

    cy.assertAsynchronousInstancePoints({
      totalPoints: 20,
      stackIx: 0,
      instanceIx: 0,
    })
    cy.assertAsynchronousInstancePoints({
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 1,
    })
    cy.assertAsynchronousInstancePoints({
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 2,
    })

    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.NRML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.FTML.title)

    cy.assertAsynchronousInstancePoints({
      totalPoints: 20,
      stackIx: 1,
      instanceIx: 0,
    })
    cy.assertAsynchronousInstancePoints({
      totalPoints: 20,
      stackIx: 1,
      instanceIx: 1,
    })
    cy.assertAsynchronousInstancePoints({
      totalPoints: 20,
      stackIx: 1,
      instanceIx: 2,
    })

    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Create a microlearning in a non-gamified course and validate that no points are shown', function () {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: this.data.details.nameNonGamified,
      displayName: this.data.details.displayNameNonGamified,
      courseName: this.data.details.courseNonGamified,
      startDate: {
        monthDelta: -2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: startDate1,
      },
      endDate: {
        monthDelta: 2,
        day: 20,
        hour: 14,
        minute: 0,
        validation: endDate1,
      },
      stacks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.FC.title,
            this.data.CT.title,
          ],
        },
        {
          elements: [
            this.data.MCML.title,
            this.data.NRML.title,
            this.data.FTML.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.details.nameNonGamified}"]`
    ).should('exist')

    cy.get(
      `[data-cy="activity-name-${this.data.details.nameNonGamified}"]`
    ).click()
    cy.assertNoActivityPoints()

    cy.get('[data-cy="activity-details-stack-header-0"]').should(
      'not.contain',
      '20 P.'
    )
    cy.get('[data-cy="activity-details-stack-header-1"]').should(
      'not.contain',
      '60 P.'
    )

    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.FC.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.CT.title)

    cy.assertNoInstancePoints({ stackIx: 0, instanceIx: 0 })
    cy.assertNoInstancePoints({ stackIx: 0, instanceIx: 1 })
    cy.assertNoInstancePoints({ stackIx: 0, instanceIx: 2 })

    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.NRML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.FTML.title)

    cy.assertNoInstancePoints({ stackIx: 1, instanceIx: 0 })
    cy.assertNoInstancePoints({ stackIx: 1, instanceIx: 1 })
    cy.assertNoInstancePoints({ stackIx: 1, instanceIx: 2 })

    cy.get('[data-cy="close-activity-details-modal"]').click()
  })
  // #endregion
})
