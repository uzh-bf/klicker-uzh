import messages from '../../../packages/i18n/messages/en'

// timestamps need to be dynamic to ensure full continued functionality
const currentYear = new Date().getFullYear()

// ? For consistency, all creation / editing / duplication workflows are run before checking the student views
describe('Different practice quiz workflows', function () {
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
    cy.fixture('Q-practice-quiz.json').then((practiceQuizData) => {
      this.data = { ...this.data, ...practiceQuizData }
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
  it('Create questions required for practice quiz creation', function () {
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

  // ! Part 1: Practice Quiz Creation
  // #region
  it('Test the creation of a practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()

    // create practice quiz
    cy.get('[data-cy="create-practice-quiz"]').click()
    cy.get('[data-cy="cancel-activity-creation"]').click()
    cy.get('[data-cy="create-practice-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .type(this.data.running.name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(this.data.running.displayName)
    cy.get('[data-cy="insert-practice-quiz-description"]')
      .realClick()
      .type(this.data.running.description)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course}"]`).click({
      force: true,
    })
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
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.activityWizard.practiceQuizSEQUENTIAL}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.activityWizard.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.activityWizard.practiceQuizSPACED_REPETITION}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.activityWizard.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Create stacks
    cy.createStacks({
      stacks: [
        { elements: [this.data.SCML.title] },
        { elements: [this.data.MCML.title] },
        { elements: [this.data.KPML.title] },
        { elements: [this.data.NRML.title] },
        { elements: [this.data.FTML.title] },
        { elements: [this.data.SEML.title] },
        { elements: [this.data.CSML.title] },
        { elements: [this.data.FC.title] },
        { elements: [this.data.CT.title] },
      ],
    })

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
    cy.get('[data-cy="element-1-stack-1"]').contains(this.data.SC.title)
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="remove-element-1-stack-1"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // end the practice quiz creation
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.running.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.name}-DRAFT"]`).should('exist')
  })

  it('Edit the first created practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="edit-practice-quiz-${this.data.running.name}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').should(
      'have.value',
      this.data.running.name
    )
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .clear()
      .type(this.data.running.nameNew)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
      'have.value',
      this.data.running.displayName
    )
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .clear()
      .type(this.data.running.displayNameNew)
    cy.get('[data-cy="insert-practice-quiz-description"]').contains(
      this.data.running.description
    )
    cy.get('[data-cy="insert-practice-quiz-description"]')
      .realClick()
      .clear()
      .type(this.data.running.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.activityWizard.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.activityWizard.practiceQuizSEQUENTIAL}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Check content of stacks and add another question
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.MCML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-2"]').contains(
      this.data.KPML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-3"]').contains(
      this.data.NRML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-4"]').contains(
      this.data.FTML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-5"]').contains(
      this.data.SEML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-6"]').contains(
      this.data.CSML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-7"]').contains(
      this.data.FC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-8"]').contains(
      this.data.CT.title.substring(0, 20)
    )

    cy.get('[data-cy="drop-elements-add-stack"]').click()
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`)
      .contains(this.data.SCML.title)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-9"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="element-0-stack-9"]').contains(
      this.data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.running.nameNew}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.nameNew}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Verify that the changes from editing went into effect', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.running.nameNew}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').should(
      'have.value',
      this.data.running.nameNew
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
      'have.value',
      this.data.running.displayNameNew
    )
    cy.get('[data-cy="insert-practice-quiz-description"]').contains(
      this.data.running.descriptionNew
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(this.data.course)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.activityWizard.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Check content of stacks and add another question
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.MCML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-2"]').contains(
      this.data.KPML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-3"]').contains(
      this.data.NRML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-4"]').contains(
      this.data.FTML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-5"]').contains(
      this.data.SEML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-6"]').contains(
      this.data.CSML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-7"]').contains(
      this.data.FC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-8"]').contains(
      this.data.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-9"]').contains(
      this.data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Create a practice quiz that will be scheduled', function () {
    cy.loginLecturer()
    cy.createPracticeQuiz({
      name: this.data.scheduled.name,
      displayName: this.data.scheduled.displayName,
      courseName: this.data.course,
      stacks: [
        { elements: [this.data.SCML.title] },
        { elements: [this.data.MCML.title] },
      ],
    })
  })

  it('Duplicate a practice quiz and validate its content', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="duplicate-practice-quiz-${this.data.running.nameNew}"]`
    ).click()
    cy.findByText('Create ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').should(
      'have.value',
      this.data.running.nameDupl
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
      'have.value',
      this.data.running.displayNameNew
    )
    cy.get('[data-cy="insert-practice-quiz-description"]').contains(
      this.data.running.descriptionNew
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.activityWizard.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Check content of stacks and add another question
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.MCML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-2"]').contains(
      this.data.KPML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-3"]').contains(
      this.data.NRML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-4"]').contains(
      this.data.FTML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-5"]').contains(
      this.data.SEML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-6"]').contains(
      this.data.CSML.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-7"]').contains(
      this.data.FC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-8"]').contains(
      this.data.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-9"]').contains(
      this.data.SCML.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Cleanup: Delete the duplicated practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.running.nameDupl}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.running.nameDupl}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.running.nameDupl}"]`
    ).should('not.exist')
  })
  // #endregion

  // ! Part 2: Running Practice Quizzes
  // #region
  // provide answers for all questions in the practice quiz and check that the corresponding fields are disabled after submission
  function answerRunningPracticeQuiz(data) {
    // SC question
    cy.findByText(data.SCML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // MC question
    cy.findByText(data.MCML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="mc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-1"]').click()
    cy.get('[data-cy="mc-0-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="mc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // KPRIM question
    cy.findByText(data.KPML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-0-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-1-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-2-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-3-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="toggle-kp-0-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-0-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // NR question
    cy.findByText(data.NRML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-0"]').clear().type('-20')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-0"]').clear().type('0.55')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-0"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-0"]').type(data.NRML.answer)
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="input-numerical-0"]')
      .should('have.value', data.NRML.answer)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // FT question
    cy.findByText(data.FTML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-0"]').type('Testinput')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="free-text-input-0"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-0"]').type(data.FTML.answer)
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="free-text-input-0"]')
      .should('have.value', data.FTML.answer)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // SE QUESTION
    cy.findByText(data.SEML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[id="selection-0-field-1"]').click()
    cy.get('[id="react-select-selection-0-field-1-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[id="selection-0-field-0"]').click()
    cy.get('[id="react-select-selection-0-field-0-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[id="selection-0-field-2"]').click()
    cy.get('[id="react-select-selection-0-field-2-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[id="selection-0-field-0"]')
      .contains(data.collection.options[1])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-0-field-1"]')
      .contains(data.collection.options[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-0-field-2"]')
      .contains(data.collection.options[3])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[data-cy="student-stack-continue"]').click()

    // CS Question
    cy.findByText(data.CSML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.answerCaseStudy({
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: cy
        .get('[data-cy="student-stack-submit"]')
        .should('be.disabled'),
    })
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.verifyCaseStudyInputs({
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    cy.get('[data-cy="student-stack-continue"]').click()

    // skip back and forth
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="practice-quiz-progress-5"]').click()
    cy.get('[data-cy="student-stack-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-3"]').click()
    cy.get('[data-cy="student-stack-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-1"]').click()
    cy.get('[data-cy="student-stack-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-2"]').click()
    cy.get('[data-cy="student-stack-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-0"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    // Flashcard
    cy.findByText(data.FC.content).should('exist')
    cy.get('[data-cy="flashcard-front-0"]').click()
    cy.get('[data-cy="flashcard-response-0-No"]').click()
    cy.get('[data-cy="flashcard-response-0-Yes"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // Content
    cy.findByText(data.CT.content).should('exist')
    cy.get('[data-cy="read-content-element-0"]').should('exist')
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .click()
    cy.get('[data-cy="student-stack-submit"]')
      .contains(messages.shared.generic.submit)
      .click()

    // SC question
    cy.findByText(data.SCML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')

    // finish the practice quiz
    cy.get('[data-cy="student-stack-continue"]')
      .contains(messages.shared.generic.finish)
      .click()
  }

  function answerRunningPracticeQuizPreview(data) {
    cy.origin(Cypress.env('URL_STUDENT'), { args: { data } }, ({ data }) => {
      // start practice quiz and answer the first few questions - remaining logic is
      // the same as on student side (no need for explicit testing)
      cy.get('[data-cy="start-practice-quiz"]').click()

      // SC question
      cy.get('[data-cy="instance-question-content"]').contains(
        data.SCML.content
      )
      cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
      cy.get('[data-cy="sc-0-answer-option-1"]').click()
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
      cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')
      cy.get('[data-cy="student-stack-continue"]').click()

      // MC question
      cy.get('[data-cy="instance-question-content"]').contains(
        data.MCML.content
      )
      cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
      cy.get('[data-cy="mc-0-answer-option-1"]').click()
      cy.get('[data-cy="mc-0-answer-option-2"]').click()
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.get('[data-cy="mc-0-answer-option-0"]').should('be.disabled')
      cy.get('[data-cy="mc-0-answer-option-1"]').should('be.disabled')
      cy.get('[data-cy="mc-0-answer-option-2"]').should('be.disabled')
      cy.get('[data-cy="mc-0-answer-option-3"]').should('be.disabled')
      cy.get('[data-cy="student-stack-continue"]').click()

      // KPRIM question
      cy.get('[data-cy="instance-question-content"]').contains(
        data.KPML.content
      )
      cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-0-correct"]').click()
      cy.get('[data-cy="toggle-kp-0-answer-1-incorrect"]').click()
      cy.get('[data-cy="toggle-kp-0-answer-2-incorrect"]').click()
      cy.get('[data-cy="toggle-kp-0-answer-3-correct"]').click()
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.get('[data-cy="toggle-kp-0-answer-0-correct"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-0-incorrect"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-1-correct"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-1-incorrect"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-2-correct"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-2-incorrect"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-3-correct"]').should('be.disabled')
      cy.get('[data-cy="toggle-kp-0-answer-3-incorrect"]').should('be.disabled')
      cy.get('[data-cy="student-stack-continue"]').click()
    })
  }

  // only provide partial answers for all question types that support this
  function answerRunningPracticeQuizPartial(data) {
    cy.findByText(data.running.descriptionNew).should('exist')
    cy.get('[data-cy="start-practice-quiz"]').click()

    // SC question - no partial submissions possible
    cy.findByText(data.SCML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // MC question - no partial submissions possible
    cy.findByText(data.MCML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="mc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-0-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // KPRIM question - no partial submissions possible
    cy.findByText(data.KPML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-0-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-1-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-2-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-3-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="toggle-kp-0-answer-0-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-0-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-0-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // NR question - no partial submissions possible
    cy.findByText(data.NRML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-0"]').clear().type(data.NRML.answer)
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="input-numerical-0"]')
      .should('have.value', data.NRML.answer)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // FT question - no partial submissions possible
    cy.findByText(data.FTML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-0"]').type(data.FTML.answer)
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="free-text-input-0"]')
      .should('have.value', data.FTML.answer)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // SE QUESTION - partial submissions possible
    cy.findByText(data.SEML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[id="selection-0-field-0"]').click()
    cy.get('[id="react-select-selection-0-field-0-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[id="selection-0-field-0"]')
      .contains(data.collection.options[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-0-field-1"]')
      .contains(messages.shared.questions.seSelectOption)
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-0-field-2"]')
      .contains(messages.shared.questions.seSelectOption)
      .should('have.css', 'pointer-events', 'none')
    cy.get('[data-cy="student-stack-continue"]').click()

    // CS Question - no partial submissions possible
    cy.findByText(data.CSML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.answerCaseStudy({
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      initialValidation: cy
        .get('[data-cy="student-stack-submit"]')
        .should('be.disabled'), // full answer required
    })
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.verifyCaseStudyInputs({
      elementIx: 0,
      answers: data.CSML.answers,
      criteria: data.CSML.criteria,
      verifyDisabled: true,
    })
    cy.get('[data-cy="student-stack-continue"]').click()

    // Flashcard - no partial submissions possible
    cy.findByText(data.FC.content).should('exist')
    cy.get('[data-cy="flashcard-front-0"]').click()
    cy.get('[data-cy="flashcard-response-0-No"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // Content - no partial submissions possible
    cy.findByText(data.CT.content).should('exist')
    cy.get('[data-cy="read-content-element-0"]').should('exist')
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .click()
    cy.get('[data-cy="student-stack-submit"]')
      .contains(messages.shared.generic.submit)
      .click()

    // SC question (required to complete activity)
    cy.findByText(data.SCML.content).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-0-answer-option-0"]').should('be.disabled')
    cy.get('[data-cy="sc-0-answer-option-1"]').should('be.disabled')

    // finish the practice quiz
    cy.get('[data-cy="student-stack-continue"]')
      .contains(messages.shared.generic.finish)
      .click()
  }

  it('Check out the preview of the draft practice quiz and validate its content', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getPracticeQuizInfo', {
      quizName: this.data.running.nameNew,
    }).then((quiz: { id: string; courseId: string }) => {
      // check if the query was successful
      if (quiz === null) {
        throw new Error('Practice quiz not found')
      }

      // visit the activity preview with the manager cookie being active
      cy.visit(
        `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/quiz/${quiz.id}`
      )

      // respond to the questions in the draft practice quiz (same functionality as for students when it's running)
      answerRunningPracticeQuizPreview(this.data)
    })
  })

  it('Publish the practice quiz around the current time', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="publish-practice-quiz-${this.data.running.nameNew}"]`
    ).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.running.nameNew}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.running.nameNew}-PUBLISHED"]`).should(
      'exist'
    )
  })

  it('Solve the practice quiz and test the student view accordingly', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.running.displayNameNew}"]`
    ).click()
    cy.findByText(this.data.running.descriptionNew).should('exist')
    cy.get('[data-cy="start-practice-quiz"]').click()
    answerRunningPracticeQuiz(this.data)
  })

  it('Solve the practice quiz with partial answers (where supported)', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.running.displayNameNew}"]`
    ).click()
    answerRunningPracticeQuizPartial(this.data)
  })

  it('Check that published practice quizzes can still be accessed as a preview', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getPracticeQuizInfo', {
      quizName: this.data.running.nameNew,
    }).then((quiz: { id: string; courseId: string }) => {
      // check if the query was successful
      if (quiz === null) {
        throw new Error('Practice quiz not found')
      }

      // visit the activity preview with the manager cookie being active
      cy.visit(
        `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/quiz/${quiz.id}`
      )

      // respond to the questions in the running practice quiz, previous answers should not persist
      answerRunningPracticeQuizPreview(this.data)
    })
  })

  it('Cleanup: Delete the running practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.running.nameNew}"]`
    ).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted practice quiz (with results) directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedPracticeQuiz', {
      quizName: this.data.running.nameNew,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted practice quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  it('Verify that the running practice quiz is no longer visible to students', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.running.nameNew}"]`).should(
      'not.exist'
    )
  })
  // #endregion

  // ! Part 3: Future Practice Quizzes
  // #region
  it('Publish the future practice quiz and verify scheduled state', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="publish-practice-quiz-${this.data.scheduled.name}"]`
    ).click()

    // check that if publication date is before course start date, submission is disabled
    cy.get('[data-cy="schedule-practice-quiz-publication"]').should(
      'be.disabled'
    )
    cy.get('[data-cy="practice-quiz-available-from"]')
      .click()
      .type(`${currentYear - 10}-01-01T02:00`)
    cy.get('[data-cy="schedule-practice-quiz-publication"]').should(
      'be.disabled'
    )

    // set future publication date
    cy.get('[data-cy="practice-quiz-available-from"]')
      .click()
      .type(`${currentYear + 5}-01-01T02:00`)
    cy.get('[data-cy="schedule-practice-quiz-publication"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.scheduled.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.scheduled.name}-SCHEDULED"]`).should(
      'exist'
    )
  })

  it('Verify that scheduled practice quizzes are not visible to students', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.scheduled.displayName}"]`
    ).should('not.exist')
  })

  it('Check that scheduled practice quizzes can be accessed as a preview', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getPracticeQuizInfo', { quizName: this.data.scheduled.name }).then(
      (quiz: { id: string; courseId: string }) => {
        // check if the query was successful
        if (quiz === null) {
          throw new Error('Practice quiz not found')
        }

        // visit the activity preview with the manager cookie being active
        cy.visit(
          `${Cypress.env('URL_STUDENT')}/course/${quiz.courseId}/quiz/${quiz.id}`
        )

        // verify that the scheduled practice quiz is visible to lecturers
        cy.origin(Cypress.env('URL_STUDENT'), () =>
          cy.get('[data-cy="start-practice-quiz"]').should('exist')
        )
      }
    )
  })

  it('Unpublish the practice quiz again on the lecturer view', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.scheduled.name}"]`
    ).click()
    cy.get(
      `[data-cy="unpublish-practice-quiz-${this.data.scheduled.name}"]`
    ).click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.scheduled.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.scheduled.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Check that immediate publication works for practice quizzes with past start dates', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="publish-practice-quiz-${this.data.scheduled.name}"]`
    ).click()
    cy.get('[data-cy="practice-quiz-available-from"]')
      .click()
      .type(`${currentYear - 1}-01-01T02:00`)
    cy.get('[data-cy="schedule-practice-quiz-publication"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.scheduled.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.scheduled.name}-PUBLISHED"]`).should(
      'exist'
    )
  })

  it('Verify that the modified and published practice quiz is available to students', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.scheduled.displayName}"]`
    ).should('exist')
  })

  it('Cleanup: Delete the scheduled practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.scheduled.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.scheduled.name}"]`
    ).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.scheduled.name}"]`
    ).should('not.exist')
  })

  it('Verify that the scheduled practice quiz is not visible to students', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.scheduled.displayName}"]`
    ).should('not.exist')
  })
  // #endregion

  // ! Part 4: Verify Editing / Duplication with Updated / Deleted Questions
  // #region
  it('Create a numerical question and included it in a practice quiz', function () {
    cy.loginLecturer()
    cy.createQuestionNR({
      name: this.data.NRML2.title,
      content: this.data.NRML2.content,
      ...this.data.NRML2.options,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createPracticeQuiz({
      name: this.data.manipulation.name,
      displayName: this.data.manipulation.displayName,
      courseName: this.data.manipulation.course,
      stacks: [{ elements: [this.data.NRML2.title] }],
    })

    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.manipulation.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Edit the numerical question, edit and save the unmodified practice quiz -> verify that nothing changed', function () {
    cy.loginLecturer()

    // modify numerical question
    cy.get(`[data-cy="edit-element-${this.data.NRML2.title}"]`).click()
    cy.get('[data-cy="instance-update-switch"]').click() // deactivate instance updates (on by default)
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.manipulation.newNRTitle)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.manipulation.newNRContent)
    cy.get('[data-cy="save-new-question"]').click()

    // edit and save the unmodified practice quiz
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // save the practice quiz without modifications
    cy.get('[data-cy="insert-practice-quiz-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-stack-0"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(`[data-cy="status-${this.data.manipulation.name}-DRAFT"]`).should(
      'exist'
    )
  })

  it('Edit the practice quiz again and add the modified NR question and a new FT question', function () {
    cy.loginLecturer()

    // create a new FT question
    cy.createQuestionFT({
      name: this.data.FTML2.title,
      content: this.data.FTML2.content,
      ...this.data.FTML2.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // edit the practice quiz again and add the modified NR question and the new FT question
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // add the modified numerical question and free text question
    cy.get('[data-cy="insert-practice-quiz-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.manipulation.newNRTitle}"]`)
      .contains(this.data.manipulation.newNRTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get(`[data-cy="drop-elements-stack-0"]`).trigger('drop', {
      dataTransfer,
    })
    cy.get(`[data-cy="element-1-stack-0"]`).contains(
      this.data.manipulation.newNRTitle.substring(0, 20)
    )

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="drop-elements-add-stack"]`).click()
    cy.get(`[data-cy="element-item-${this.data.FTML2.title}"]`)
      .contains(this.data.FTML2.title)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get(`[data-cy="drop-elements-stack-1"]`).trigger('drop', {
      dataTransfer2,
    })
    cy.get(`[data-cy="element-0-stack-1"]`).contains(
      this.data.FTML2.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Delete the created questions and edit and re-order the blocks in the practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    cy.deleteElement({ elementName: this.data.manipulation.newNRTitle })
    cy.deleteElement({ elementName: this.data.FTML2.title })

    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.manipulation.name}"]`
    ).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // re-order the stacks in the practice quiz
    cy.get('[data-cy="insert-practice-quiz-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="move-stack-0-right"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Duplicate the practice quiz, verify that the same instances are shown in the editor, and publish both practice quizzes', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="duplicate-practice-quiz-${this.data.manipulation.name}"]`
    ).click()

    // verify that the duplicated practice quiz contains the same element content as the original quiz
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .clear()
      .type(this.data.manipulation.duplicateName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .clear()
      .type(this.data.manipulation.duplicateDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.manipulation.course}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.manipulation.course)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-stack-0"]').contains(
      this.data.FTML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.NRML2.title.substring(0, 20)
    )
    cy.get('[data-cy="element-1-stack-1"]').contains(
      this.data.manipulation.newNRTitle.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // publish both practice quizzes
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="publish-practice-quiz-${this.data.manipulation.name}"]`
    ).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.manipulation.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="status-${this.data.manipulation.name}-PUBLISHED"]`
    ).should('exist')

    cy.get(
      `[data-cy="publish-practice-quiz-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.manipulation.duplicateName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="status-${this.data.manipulation.duplicateName}-PUBLISHED"]`
    ).should('exist')
  })

  it('Answer the first practice quiz through the student view and verify its content', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.manipulation.displayName}"]`
    ).click()
    cy.get('[data-cy="start-practice-quiz"]').click()

    // stack 1
    cy.findByText(this.data.FTML2.content).should('exist')
    cy.get('[data-cy="free-text-input-0"]').type('Testinput')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    // stack 2
    cy.findByText(this.data.NRML2.content).should('exist')
    cy.findByText(this.data.manipulation.newNRTitle).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-0"]').clear().type('10')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('10')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
  })

  it('Answer the duplicated practice quiz through the student view and verify its content', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.manipulation.duplicateDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-practice-quiz"]').click()

    // stack 1
    cy.findByText(this.data.FTML2.content).should('exist')
    cy.get('[data-cy="free-text-input-0"]').type('Testinput')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    // stack 2
    cy.findByText(this.data.NRML2.content).should('exist')
    cy.findByText(this.data.manipulation.newNRTitle).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-0"]').clear().type('10')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('10')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
  })

  it('Delete the created practice quizzes', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.manipulation.course}"]`
    ).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.manipulation.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.manipulation.name}"]`
    ).click()
    cy.wait(500)
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.manipulation.name}"]`
    ).should('not.exist')

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.manipulation.duplicateName}"]`
    ).click()
    cy.wait(500)
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.manipulation.duplicateName}"]`
    ).should('not.exist')
  })
  // #endregion

  // ! Part 5: Sharing Practice Quizzes
  // #region
  function verifyPracticeQuizDetailsModalContent(
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

  function verifyPracticeQuizOwnerPermissions(data: any) {
    // for a draft practice quiz the following options should be available: publish, edit, open preview, access link, lti link, duplicate, share, delete
    cy.get(`[data-cy="publish-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="edit-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz1}"]`
    ).realClick()
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="duplicate-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz1}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled practice quiz the following options should be available: access link, open preview, lti link, duplicate, share, unpublish, delete
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz2}"]`).should('exist')

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz2}"]`
    ).realClick()

    cy.get(`[data-cy="duplicate-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz2}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running practice quiz the following options should be available: evaluation, access link, open preview, lti link, duplicate, share, delete
    cy.get(`[data-cy="evaluation-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz3}"]`
    ).realClick()
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="duplicate-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz3}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  function verifyPracticeQuizREADPermissions(
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
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
      }
    )

    // for a draft practice quiz the following options should be available: open preview, access link, lti link,remove
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz1}"]`).should('exist')

    if (!groupPermission) {
      cy.get(
        `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz1}"]`
      ).realClick()
      cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz1}"]`).should(
        'exist'
      )
      cy.get(`[data-cy="activity-name-${data.sharing.quiz1}"]`).realClick() // close dropdown
    }
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled practice quiz the following options should be available: access link, open preview, lti link, remove
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz2}"]`).should('exist')

    if (!groupPermission) {
      cy.get(
        `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz2}"]`
      ).realClick()
      cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz2}"]`).should(
        'exist'
      )
      cy.get(`[data-cy="activity-name-${data.sharing.quiz2}"]`).realClick() // close dropdown
    }
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running practice quiz the following options should be available: evaluation, access link, open preview, lti link, remove
    cy.get(`[data-cy="evaluation-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz3}"]`
    ).realClick()
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz3}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  function verifyPracticeQuizEXECUTEPermissions(
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
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('not.exist')
      }
    )

    // for a draft practice quiz the following options should be available: publish, open preview, access link, lti link,remove
    cy.get(`[data-cy="publish-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz1}"]`).should('exist')

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz1}"]`
    ).realClick()
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz1}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled practice quiz the following options should be available: access link, open preview, lti link, unpublish, remove
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz2}"]`).should('exist')

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz2}"]`
    ).realClick()
    cy.get(`[data-cy="unpublish-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz2}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running practice quiz the following options should be available: evaluation, access link, open preview, lti link, remove
    cy.get(`[data-cy="evaluation-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz3}"]`
    ).realClick()
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz3}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  function verifyPracticeQuizWRITEPermissions(
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
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
      }
    )

    // for a draft practice quiz the following options should be available: publish, edit, open preview, access link, lti link,remove
    cy.get(`[data-cy="publish-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="edit-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz1}"]`
    ).realClick()
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz1}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled practice quiz the following options should be available: access link, open preview, lti link, unpublish, remove
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz2}"]`).should('exist')

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz2}"]`
    ).realClick()
    cy.get(`[data-cy="unpublish-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz2}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running practice quiz the following options should be available: evaluation, access link, open preview, lti link, remove
    cy.get(`[data-cy="evaluation-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz3}"]`
    ).realClick()
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz3}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  function verifyPracticeQuizADMINPermissions(
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
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('exist')
        cy.get(`[data-cy="change-activity-name-${quiz}"]`).should('exist')
      }
    )

    // for a draft practice quiz the following options should be available: publish, edit, open preview, access link, lti link, duplicate, share, remove, delete
    cy.get(`[data-cy="publish-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="edit-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz1}"]`
    ).realClick()
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz1}"]`).should('exist')
    cy.get(`[data-cy="duplicate-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz1}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-practice-quiz-${data.sharing.quiz1}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz1}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz1, data)

    // for a scheduled practice quiz the following options should be available: access link, open preview, lti link, duplicate, share, unpublish, remove, delete
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz2}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz2}"]`).should('exist')

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz2}"]`
    ).realClick()
    cy.get(`[data-cy="duplicate-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="unpublish-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz2}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-practice-quiz-${data.sharing.quiz2}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz2}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz2, data)

    // for a running practice quiz the following options should be available: evaluation, access link, open preview, lti link, duplicate, share, remove, delete
    cy.get(`[data-cy="evaluation-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="copy-access-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="open-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${data.sharing.quiz3}"]`
    ).realClick()
    cy.get(`[data-cy="copy-lti-link-${data.sharing.quiz3}"]`).should('exist')
    cy.get(`[data-cy="duplicate-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="share-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-practice-quiz-${data.sharing.quiz3}"]`).should(
      groupPermission ? 'not.exist' : 'exist'
    )
    cy.get(`[data-cy="delete-practice-quiz-${data.sharing.quiz3}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="activity-name-${data.sharing.quiz3}"]`).realClick() // close dropdown
    verifyPracticeQuizDetailsModalContent(data.sharing.quiz3, data)
  }

  function verifyREADPermissionsRevoked(data: any) {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared practice quizzes should no longer be visible
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('not.exist')
      }
    )
  }

  function verifyEXECUTEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="activities"]').click()

    // previously shared practice quizzes should no longer be visible
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('not.exist')
      }
    )
  }

  function verifyWRITEPermissionsRevoked(data: any) {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="activities"]').click()

    // previously shared practice quizzes should no longer be visible
    cy.wrap([data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]).each(
      (quiz) => {
        cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('not.exist')
      }
    )
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

    // previously shared practice quizzes should no longer be visible
    cy.get('[data-cy="activities"]').click()
    const quizzes = [data.sharing.quiz1, data.sharing.quiz2, data.sharing.quiz3]
    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="activity-PRACTICE_QUIZ-${quiz}"]`).should('not.exist')
    })
  }

  it('Create four different practice quizzes and make sure that all required actions are shown to the object owner', function () {
    cy.loginLecturer()

    // create four different practice quizzes
    for (let i = 1; i <= 3; i++) {
      cy.createPracticeQuiz({
        name: this.data.sharing[`quiz${i}`],
        displayName: this.data.sharing[`quiz${i}Display`],
        courseName: this.data.seededCourse,
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

    // change the status of the second practice quiz to scheduled
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.quiz2,
      activityType: 'PRACTICE_QUIZ',
      status: 'SCHEDULED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Practice quiz to change status was not found in the database'
        )
      }
    })

    // change the status of the third practice quiz to published
    cy.task('changeActivityStatus', {
      activityName: this.data.sharing.quiz3,
      activityType: 'PRACTICE_QUIZ',
      status: 'PUBLISHED',
    }).then((result: boolean) => {
      // check if the modification was successful
      if (result === false) {
        throw new Error(
          'Practice quiz to change status was not found in the database'
        )
      }
    })
    cy.reload()

    // verify that the owner sees all the correct actions
    cy.get('[data-cy="activities"]').click()
    verifyPracticeQuizOwnerPermissions(this.data)
  })

  it('Share the practice quizzes individual with different users and different permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    // grant READ, EXECUTE, WRITE and ADMIN permissions on all practice quizzes to the users 2, 3, 4 and 5, respectively
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()

      // grant READ permission to user 2
      cy.get('[data-cy="new-permission-username-or-email"]').type(
        Cypress.env('LECTURER_IND_SHORTNAME')
      )
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-READ"]').click()
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsREAD)

      // grant EXECUTE permission to user 3
      cy.get('[data-cy="new-permission-username-or-email"]').type(
        Cypress.env('LECTURER_INST_SHORTNAME')
      )
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-EXECUTE"]').click()
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsEXECUTE)

      // grand WRITE permissions to user 4
      cy.get('[data-cy="new-permission-username-or-email"]').type(
        Cypress.env('LECTURER_INST2_SHORTNAME')
      )
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-WRITE"]').click()
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
      cy.get('[data-cy="new-permission-username-or-email"]').type(
        Cypress.env('LECTURER_INST3_SHORTNAME')
      )
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-ADMIN"]').click()
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
    verifyPracticeQuizREADPermissions(this.data, false)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyPracticeQuizEXECUTEPermissions(this.data, false)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyPracticeQuizWRITEPermissions(this.data, false)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyPracticeQuizADMINPermissions(this.data, false)
  })

  it('Revoke the direct individual permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]
    const users = [
      Cypress.env('LECTURER_IND_SHORTNAME'),
      Cypress.env('LECTURER_INST_SHORTNAME'),
      Cypress.env('LECTURER_INST2_SHORTNAME'),
      Cypress.env('LECTURER_INST3_SHORTNAME'),
    ]

    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()

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

  it('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the practice quizzes with them', function () {
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

    // share the practice quizzes with the user groups with READ, EXECUTE, WRITE and ADMIN permissions
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()

      // grant READ permission to user group 1
      cy.get('[data-cy="new-permission-user-group"]').click()
      cy.get(`[data-cy="user-group-${this.data.sharing.group1}"]`).click()
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-READ"]').click()
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsREAD
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group1}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsREAD)

      // grant EXECUTE permission to user group 2
      cy.get('[data-cy="new-permission-user-group"]').click()
      cy.get(`[data-cy="user-group-${this.data.sharing.group2}"]`).click()
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-EXECUTE"]').click()
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsEXECUTE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group2}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsEXECUTE)

      // grand WRITE permissions to user group 3
      cy.get('[data-cy="new-permission-user-group"]').click()
      cy.get(`[data-cy="user-group-${this.data.sharing.group3}"]`).click()
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-WRITE"]').click()
      cy.get('[data-cy="new-permission-access-level"]').contains(
        messages.manage.sharing.permissionsWRITE
      )
      cy.get('[data-cy="new-permission-submit"]').click()
      cy.get(`[data-cy="permission-${this.data.sharing.group3}"]`)
        .should('exist')
        .contains(messages.manage.sharing.permissionsWRITE)

      // grant ADMIN permissions to user group 4
      cy.get('[data-cy="new-permission-user-group"]').click()
      cy.get(`[data-cy="user-group-${this.data.sharing.group4}"]`).click()
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-ADMIN"]').click()
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
    verifyPracticeQuizREADPermissions(this.data, true)
  })

  it('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', function () {
    verifyPracticeQuizEXECUTEPermissions(this.data, true)
  })

  it('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', function () {
    verifyPracticeQuizWRITEPermissions(this.data, true)
  })

  it('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', function () {
    verifyPracticeQuizADMINPermissions(this.data, true)
  })

  it('Revoke the direct group permissions for all users through the activity owner account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    const quizzes = [
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]
    const groups = [
      this.data.sharing.group1,
      this.data.sharing.group2,
      this.data.sharing.group3,
      this.data.sharing.group4,
    ]

    cy.wrap(quizzes).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()

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

  it("Transfer ownership of all practice quizzes to user 'pro1' using the username", function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()

      // share the course with WRITE permissions with user pro1
      cy.get('[data-cy="new-permission-username-or-email"]').type(
        Cypress.env('LECTURER_IND_SHORTNAME')
      )
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-WRITE"]').click()
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
    verifyPracticeQuizOwnerPermissions(this.data)

    // transfer the ownership of all quizzes back to the main user
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()

      // grant a WRITE permission to the main user (should change the existing permission in this case)
      cy.get('[data-cy="new-permission-username-or-email"]').type(
        Cypress.env('LECTURER_SHORTNAME')
      )
      cy.get('[data-cy="new-permission-access-level"]').click()
      cy.get('[data-cy="permission-level-WRITE"]').click()
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

  it("Remove the shared practice quizzes from user 'pro1' using the removal functionality", function () {
    cy.loginIndividualCatalyst()

    // remove the shared practice quizzes from user pro1
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="remove-practice-quiz-${quiz}"]`).click()
      cy.get('[data-cy="confirm-deletion-final"]').click()
      cy.get('[data-cy="confirm-derived-access"]').click()
      cy.get('[data-cy="confirm-dependency-access"]').click()
      cy.get('[data-cy="confirmation-modal-confirm"]').click()
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).should('not.exist')
      cy.get('[data-cy="confirmation-modal-close"]').should('not.exist')
    })
    cy.logoutUser()

    // verify in the main user account that the corresponding permissions were removed
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.sharing.quiz1,
      this.data.sharing.quiz2,
      this.data.sharing.quiz3,
    ]).each((quiz) => {
      cy.get(`[data-cy="actions-PRACTICE_QUIZ-${quiz}"]`).realClick()
      cy.get(`[data-cy="share-practice-quiz-${quiz}"]`).click()
      cy.get(
        `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
      ).should('not.exist')
      cy.get(`[data-cy="close-share-object"]`).click()
    })
  })
  // #endregion
})
