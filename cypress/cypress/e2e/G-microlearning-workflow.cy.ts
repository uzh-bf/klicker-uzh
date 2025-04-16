import messages from '../../../packages/i18n/messages/en'

// dates - hard-coded in test due to dependency on current year
const currentYear = new Date().getFullYear()
const runningStartOLD = `${currentYear - 1}-01-01T02:00`
const runningEndOLD = `${currentYear}-12-31T18:00`
const runningStart = `${currentYear - 2}-01-01T02:00`
const runningEnd = `${currentYear + 1}-12-31T18:00`
const runningEndExtended = `${currentYear + 5}-12-31T18:00`
const runningExtendedText = `End: 31.12.${currentYear + 5}, 18:00`

// ? All microlearning creation steps are bundled in the beginning of the test, since reloading the page
// ? sometimes triggers a recomputation of the randomized question titles, not allowing for a comparison anymore
describe('Different microlearning workflows', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('questions.json').then((questionData) => {
      this.data = questionData
    })
    cy.fixture('G-microlearning.json').then((liveQuizData) => {
      this.data = { ...this.data, ...liveQuizData }
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
      .type(this.data.running.description)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course}"]`).click()
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-start-date"]').click().type(runningStartOLD)
    cy.get('[data-cy="select-end-date"]').click().type(runningEndOLD)
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
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Create stacks
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.createStacks({
      stacks: [
        // FT questions should also be accepted without sample solution
        {
          elements: [this.data.SCML.title, this.data.FTML.title],
        },
        {
          elements: [this.data.FC.title, this.data.CT.title],
        },
      ],
    })
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // SC question without sample solution should be rejected
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.SC.title}"]`)
      .contains(this.data.SC.title)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-1"]').trigger('drop', {
      dataTransfer,
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
      `[data-cy="microlearning-actions-${this.data.running.name}"]`
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
      .type(this.data.running.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)

    // check if correct values are in the form and rename it
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-start-date"]')
      .click()
      .should('have.value', runningStartOLD)
      .type(runningStart)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .should('have.value', runningEndOLD)
      .type(runningEnd)
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
    cy.get('[data-cy="next-or-submit"]').click()

    // add another stack to the microlearning
    const addQuestions = [this.data.SCML.title, this.data.FTML.title]
    cy.get('[data-cy="drop-elements-add-stack"]').click()
    cy.wrap(addQuestions).each((element: string, ix) => {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="element-item-${element}"]`)
        .contains(element)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get(`[data-cy="drop-elements-stack-2"]`).trigger('drop', {
        dataTransfer,
      })
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
    cy.get(`[data-cy="microlearning-${this.data.running.nameNew}"]`).contains(
      messages.shared.generic.draft
    )

    // recheck if the changes have been saved
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
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
    cy.get('[data-cy="select-start-date"]')
      .click()
      .should('have.value', runningStart)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .should('have.value', runningEnd)
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
    cy.get(`[data-cy="microlearning-${this.data.running.nameNew}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Duplicate a microlearning and check the editors content', function () {
    // duplicate the microlearning
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
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
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-start-date"]')
      .click()
      .should('have.value', runningStart)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .should('have.value', runningEnd)
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
    cy.get(`[data-cy="microlearning-${this.data.duplication.name}"]`).contains(
      messages.shared.generic.draft
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
      startDate: `${currentYear + 1}-01-01T02:00`,
      endDate: `${currentYear + 1}-12-31T18:00`,
      stacks: [{ elements: [this.data.SCML.title] }],
    })

    // check if creation was successful
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${this.data.future.name}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Create a microlearning with all element types', function () {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: this.data.completed.name,
      displayName: this.data.completed.displayName,
      courseName: this.data.course,
      startDate: `${currentYear - 1}-01-01T02:00`,
      endDate: `${currentYear + 1}-12-31T18:00`,
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
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/microlearning/${quiz.id}`
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

    cy.get(`[data-cy="publish-microlearning-${this.data.running.nameNew}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${this.data.running.nameNew}"]`).contains(
      messages.shared.generic.published
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
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/microlearning/${quiz.id}`
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
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="extend-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="extend-microlearning-${this.data.running.nameNew}"]`
    ).click()

    // change the end date and check if the changes are saved
    cy.get('[data-cy="extend-activity-date"]').click().type(runningEndExtended)
    cy.get('[data-cy="extend-activity-confirm"]').click()
    cy.get(`[data-cy="microlearning-${this.data.running.nameNew}"]`).contains(
      runningExtendedText
    )

    // check that changing the date to the past does not work
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="extend-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get('[data-cy="extend-activity-confirm"]').should('not.be.disabled')
    cy.get('[data-cy="extend-activity-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T12:00`)
    cy.get('[data-cy="extend-activity-confirm"]').should('be.disabled')
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="microlearning-${this.data.running.nameNew}"]`).contains(
      runningExtendedText
    )
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
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="end-microlearning-${this.data.running.nameNew}"]`).click()
    cy.get(`[data-cy="confirm-responses-microlearning"]`).should('not.exist')
    cy.get(`[data-cy="confirm-anonymous-responses-microlearning"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="end-microlearning-${this.data.running.nameNew}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
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
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'not.be.disabled'
    )
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.running.nameNew}"]`
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
      `[data-cy="microlearning-actions-${this.data.duplication.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.duplication.name}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.duplication.name}"]`
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

    cy.get(`[data-cy="publish-microlearning-${this.data.future.name}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${this.data.future.name}"]`).contains(
      messages.shared.generic.scheduled
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
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/microlearning/${quiz.id}`
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

    cy.get(`[data-cy="microlearning-actions-${this.data.future.name}"]`).click()
    cy.get(
      `[data-cy="unpublish-microlearning-${this.data.future.name}"]`
    ).click()
    cy.get(`[data-cy="microlearning-${this.data.future.name}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Cleanup: Delete the future microlearning to avoid name collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the future microlearning
    cy.get(`[data-cy="microlearning-actions-${this.data.future.name}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${this.data.future.name}"]`).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-anonymous-responses"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${this.data.future.name}"]`).should(
      'not.exist'
    )
  })
  // #endregion

  // ! Part 4: Complete Microlearning
  // #region
  it('Publish the microlearning that contains all question types', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="publish-microlearning-${this.data.completed.name}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${this.data.completed.name}"]`).contains(
      messages.shared.generic.published
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
      `[data-cy="microlearning-actions-${this.data.completed.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.completed.name}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.completed.name}"]`
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
  it('Convert the seeded past microlearning into a practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    // start conversion of a microlearning into a practice quiz
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.conversion.pastML}"]`
    ).click()
    cy.get(
      `[data-cy="convert-microlearning-${this.data.conversion.pastML}-to-practice-quiz"]`
    ).click()

    // check if the practice quiz editor is open
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .should('have.value', `${this.data.conversion.pastML} (converted)`)
      .clear()
      .type(this.data.conversion.pqName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .should('have.value', this.data.conversion.pastML)
      .clear()
      .type(this.data.conversion.pqDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // continue to the next step and change the default settings
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
    cy.get(`[data-cy="practice-quiz-${this.data.conversion.pqName}"]`).contains(
      messages.shared.generic.draft
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
      startDate: `${currentYear - 1}-01-01T02:00`,
      endDate: `${currentYear + 1}-01-01T02:00`,
      courseName: this.data.manipulation.course,
      stacks: [{ elements: [this.data.SEML2.title] }],
    })
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${this.data.manipulation.name}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Edit the selection questions and edit & save the microlearning without making any changes', function () {
    cy.loginLecturer()

    // modify numerical question
    cy.get(`[data-cy="edit-question-${this.data.SEML2.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.manipulation.newSETitle)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.manipulation.newSEContent)
    cy.get('[data-cy="save-new-question"]').click()

    // edit and save the unmodified practice quiz
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.manipulation.name}"]`
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
    cy.get(`[data-cy="microlearning-${this.data.manipulation.name}"]`).contains(
      messages.shared.generic.draft
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
      `[data-cy="microlearning-actions-${this.data.manipulation.name}"]`
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

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.manipulation.newSETitle}"]`)
      .contains(this.data.manipulation.newSETitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get(`[data-cy="drop-elements-stack-0"]`).trigger('drop', {
      dataTransfer,
    })
    cy.get(`[data-cy="element-1-stack-0"]`).contains(
      this.data.manipulation.newSETitle.substring(0, 20)
    )

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="drop-elements-add-stack"]`).click()
    cy.get(`[data-cy="element-item-${this.data.CSML2.title}"]`)
      .contains(this.data.CSML2.title)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get(`[data-cy="drop-elements-stack-1"]`).trigger('drop', {
      dataTransfer2,
    })
    cy.get(`[data-cy="element-0-stack-1"]`).contains(
      this.data.CSML2.title.substring(0, 20)
    )

    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${this.data.manipulation.name}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Delete the selection and case study elements in the library, as well as the associated answer collection, re-order the stacks on the microlearning and publish it', function () {
    cy.loginLecturer()

    // delete elements
    cy.deleteElement({ elementName: this.data.manipulation.newSETitle })
    cy.deleteElement({ elementName: this.data.CSML2.title })

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
      `[data-cy="microlearning-actions-${this.data.manipulation.name}"]`
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
    cy.get(`[data-cy="microlearning-${this.data.manipulation.name}"]`).contains(
      messages.shared.generic.draft
    )

    // publish the microlearning
    cy.get(`[data-cy="publish-microlearning-${this.data.manipulation.name}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${this.data.manipulation.name}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Respond to the elements in the published microlearning and verify their content', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.manipulation.displayName}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // answer elements in stack 1
    cy.findByText(this.data.CSML2.title).should('exist')
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
      `[data-cy="microlearning-actions-${this.data.manipulation.name}"]`
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
    cy.get('[data-cy="select-course"]').should('exist')
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
      `[data-cy="microlearning-${this.data.manipulation.duplicateName}"]`
    ).contains(messages.shared.generic.draft)

    // publish the microlearning
    cy.get(
      `[data-cy="publish-microlearning-${this.data.manipulation.duplicateName}"]`
    )
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(
      `[data-cy="microlearning-${this.data.manipulation.duplicateName}"]`
    ).contains(messages.shared.generic.published)
  })

  it('Respond to the elements in the duplicated microlearning and verify their content', function () {
    cy.loginStudent()
    cy.get(
      `[data-cy="microlearning-${this.data.manipulation.duplicateDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // answer elements in stack 1
    cy.findByText(this.data.CSML2.title).should('exist')
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
      `[data-cy="microlearning-actions-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.manipulation.name}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.manipulation.name}"]`
    ).should('not.exist')

    // delete the duplicated microlearning
    cy.get(
      `[data-cy="microlearning-actions-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-microlearning-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="microlearning-actions-${this.data.manipulation.duplicateName}"]`
    ).should('not.exist')
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Delete all created questions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    const questions = [
      this.data.SCML.title,
      this.data.SC.title,
      this.data.MCML.title,
      this.data.KPML.title,
      this.data.NRML.title,
      this.data.FTML.title,
      this.data.SEML.title,
      this.data.CSML.title,
      this.data.FC.title,
      this.data.CT.title,
    ]

    cy.wrap(questions).each((title: string) => {
      cy.get(`[data-cy="delete-question-${title}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })
  })

  it('Cleanup: Delete the converted practice quiz to avoid naming collisions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    // delete the converted practice quiz
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.conversion.pqName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.conversion.pqName}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.conversion.pqName}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete the created answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({
      collectionName: this.data.collection.name,
    })
  })

  it('Cleanup: Verify that all answer collections have been deleted properly', function () {
    cy.task('verifyDeletionAnswerCollections').then((result) => {
      // check if the verification was successful
      if (result === null || result === false) {
        throw new Error(
          'The database contains answer collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion
})
