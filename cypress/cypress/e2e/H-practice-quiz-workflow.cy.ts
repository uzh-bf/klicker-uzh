import messages from '../../../packages/i18n/messages/en'

// timestamps need to be dynamic to ensure full continued functionality
const currentYear = new Date().getFullYear()

const SCQuestion = 'SC Question PQ'
const MCQuestion = 'MC Question PQ'
const KPRIMQuestion = 'KPRIM Question PQ'
const NRQuestion = 'NR Question PQ'
const FTQuestion = 'FT Question PQ'
const FCQuestion = 'FC Question PQ'
const CTQuestion = 'CT Question PQ'
const SEQuestion = 'SE Question PQ'
const SEQuestionTitle = 'SE 1f6bf5c9-13a0-4cbc-abb7-bb77fe7381f1'
const SEQuestionInputs = 3
const SECollection = 'SE Collection PQ'
const SECollectionDescription = 'SE Collection PQ Description'
const SECollectionOptions = [
  'SE PQ Option 1',
  'SE PQ Option 2',
  'SE PQ Option 3',
  'SE PQ Option 4',
  'SE PQ Option 5',
]
const SECollectionSolutions = [0, 1, 2, 4]

const runningDisplayName = 'Running Practice Quiz'
const runningDescription =
  'This is the description of the running practice quiz'

// ? For consistency, all creation / editing / duplication workflows are run before checking the student views
describe('Different practice quiz workflows', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('H-practice-quiz.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 0: Preparation - Question Creation
  it('Create questions required for practice quiz creation', function () {
    cy.loginLecturer()

    // SC question with solution
    cy.createQuestionSC({
      title: this.data.questions.SC1.title,
      content: this.data.questions.SC1.content,
      choices: this.data.questions.SC1.choices,
    })

    // SC question without solution
    cy.createQuestionSC({
      title: this.data.questions.SC2.title,
      content: this.data.questions.SC2.content,
      choices: this.data.questions.SC2.choices,
    })

    // MC question
    cy.createQuestionMC({
      title: this.data.questions.MC.title,
      content: this.data.questions.MC.content,
      choices: this.data.questions.MC.choices,
    })

    // KPRIM question
    cy.createQuestionKPRIM({
      title: this.data.questions.KP.title,
      content: this.data.questions.KP.content,
      choices: this.data.questions.KP.choices,
    })

    // NR question
    cy.createQuestionNR({
      title: this.data.questions.NR.title,
      content: this.data.questions.NR.content,
      ...this.data.questions.NR.options,
    })

    // FT question
    cy.createQuestionFT({
      title: this.data.questions.FT.title,
      content: this.data.questions.FT.content,
      ...this.data.questions.FT.options,
    })

    // FC question
    cy.createFlashcard({
      title: this.data.questions.FC.title,
      content: this.data.questions.FC.content,
      explanation: this.data.questions.FC.explanation,
    })

    // CT question
    cy.createContent({
      title: this.data.questions.CT.title,
      content: this.data.questions.CT.content,
    })

    // create answer collection
    cy.get('[data-cy="resources"]').click()
    cy.createAnswerCollection({
      name: SECollection,
      description: SECollectionDescription,
      entries: SECollectionOptions,
      access: messages.manage.resources.accessPRIVATE,
      accessCy: 'private',
    })

    // create selection question
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      title: SEQuestionTitle,
      content: SEQuestion,
      numberOfInputs: SEQuestionInputs,
      collectionName: SECollection,
      correctAnswers: SECollectionOptions.filter((_, i) =>
        SECollectionSolutions.includes(i)
      ),
    })
  })

  // ! Part 1: Practice Quiz Creation
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
        { elements: [this.data.questions.SC1.title] },
        { elements: [this.data.questions.MC.title] },
        { elements: [this.data.questions.KP.title] },
        { elements: [this.data.questions.NR.title] },
        { elements: [this.data.questions.FT.title] },
        { elements: [SEQuestionTitle] },
        { elements: [this.data.questions.FC.title] },
        { elements: [this.data.questions.CT.title] },
      ],
    })

    // SC question without sample solution should be rejected
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.questions.SC2.title}"]`)
      .contains(this.data.questions.SC2.title)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-1"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="element-1-stack-1"]').contains(
      this.data.questions.SC2.title
    )
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="remove-element-1-stack-1"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // end the practice quiz creation
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.running.name}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Edit the first created practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.name}"]`
    ).click()
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
      this.data.questions.SC1.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.questions.MC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-2"]').contains(
      this.data.questions.KP.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-3"]').contains(
      this.data.questions.NR.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-4"]').contains(
      this.data.questions.FT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-5"]').contains(
      SEQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-6"]').contains(
      this.data.questions.FC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-7"]').contains(
      this.data.questions.CT.title.substring(0, 20)
    )

    cy.get('[data-cy="drop-elements-add-stack"]').click()
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.questions.SC1.title}"]`)
      .contains(this.data.questions.SC1.title)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-8"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="element-0-stack-8"]').contains(
      this.data.questions.SC1.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.running.nameNew}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Verify that the changes from editing went into effect', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.nameNew}"]`
    ).click()
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
      this.data.questions.SC1.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.questions.MC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-2"]').contains(
      this.data.questions.KP.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-3"]').contains(
      this.data.questions.NR.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-4"]').contains(
      this.data.questions.FT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-5"]').contains(
      SEQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-6"]').contains(
      this.data.questions.FC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-7"]').contains(
      this.data.questions.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-8"]').contains(
      this.data.questions.SC1.title.substring(0, 20)
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
        { elements: [this.data.questions.SC1.title] },
        { elements: [this.data.questions.MC.title] },
      ],
    })
  })

  it('Duplicate a practice quiz and validate its content', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.nameNew}"]`
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
      this.data.questions.SC1.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-1"]').contains(
      this.data.questions.MC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-2"]').contains(
      this.data.questions.KP.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-3"]').contains(
      this.data.questions.NR.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-4"]').contains(
      this.data.questions.FT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-5"]').contains(
      SEQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-6"]').contains(
      this.data.questions.FC.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-7"]').contains(
      this.data.questions.CT.title.substring(0, 20)
    )
    cy.get('[data-cy="element-0-stack-8"]').contains(
      this.data.questions.SC1.title.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Cleanup: Delete the duplicated practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()

    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.nameDupl}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.running.nameDupl}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.nameDupl}"]`
    ).should('not.exist')
  })

  // ! Part 2: Running Practice Quiz
  // provide answers for all questions in the practice quiz and check that the corresponding fields are disabled after submission
  function answerRunningPracticeQuiz() {
    // SC question
    cy.findByText(SCQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="sc-1-answer-option-3"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // MC question
    cy.findByText(MCQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="mc-1-answer-option-3"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-5"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // KPRIM question
    cy.findByText(KPRIMQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-incorrect"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // NR question
    const NRinputFinal = '0.55'
    cy.findByText(NRQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('-20')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('0.55')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').type(NRinputFinal)
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="input-numerical-1"]')
      .should('have.value', NRinputFinal)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // FT question
    const FTinputFinal = 'correct'
    cy.findByText(FTQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type('Testinput')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="free-text-input-1"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type(FTinputFinal)
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="free-text-input-1"]')
      .should('have.value', FTinputFinal)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // SE QUESTION
    cy.findByText(SEQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[id="selection-1-field-2"]').click()
    cy.get('[id="react-select-selection-1-field-2-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[id="selection-1-field-1"]').click()
    cy.get('[id="react-select-selection-1-field-1-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[id="selection-1-field-3"]').click()
    cy.get('[id="react-select-selection-1-field-3-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[id="selection-1-field-1"]')
      .contains(SECollectionOptions[1])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-1-field-2"]')
      .contains(SECollectionOptions[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-1-field-3"]')
      .contains(SECollectionOptions[3])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[data-cy="student-stack-continue"]').click()

    // skip back and forth
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
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

    // Flashcard
    cy.findByText(FCQuestion).should('exist')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // Content
    cy.findByText(CTQuestion).should('exist')
    cy.get('[data-cy="read-content-element-1"]').should('exist')
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .click()
    cy.get('[data-cy="student-stack-submit"]')
      .contains(messages.shared.generic.submit)
      .click()

    // SC question
    cy.findByText(SCQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="sc-1-answer-option-3"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-4"]').should('be.disabled')

    // finish the practice quiz
    cy.get('[data-cy="student-stack-continue"]')
      .contains(messages.shared.generic.finish)
      .click()
  }

  // only provide partial answers for all question types that support this
  function answerRunningPracticeQuizPartial() {
    cy.findByText(runningDescription).should('exist')
    cy.get('[data-cy="start-practice-quiz"]').click()

    // SC question - no partial submissions possible
    cy.findByText(SCQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // MC question - no partial submissions possible
    cy.findByText(MCQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="mc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-5"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // KPRIM question - no partial submissions possible
    cy.findByText(KPRIMQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-incorrect"]').should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // NR question - no partial submissions possible
    const NRinputFinal = '0.55'
    cy.findByText(NRQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type(NRinputFinal)
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="input-numerical-1"]')
      .should('have.value', NRinputFinal)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // FT question - no partial submissions possible
    const FTinputFinal = 'Testinput'
    cy.findByText(FTQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type(FTinputFinal)
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="free-text-input-1"]')
      .should('have.value', FTinputFinal)
      .should('be.disabled')
    cy.get('[data-cy="student-stack-continue"]').click()

    // SE QUESTION - partial submissions possible
    cy.findByText(SEQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[id="selection-1-field-1"]').click()
    cy.get('[id="react-select-selection-1-field-1-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[id="selection-1-field-1"]')
      .contains(SECollectionOptions[0])
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-1-field-2"]')
      .contains(messages.shared.questions.seSelectOption)
      .should('have.css', 'pointer-events', 'none')
    cy.get('[id="selection-1-field-3"]')
      .contains(messages.shared.questions.seSelectOption)
      .should('have.css', 'pointer-events', 'none')
    cy.get('[data-cy="student-stack-continue"]').click()

    // Flashcard - no partial submissions possible
    cy.findByText(FCQuestion).should('exist')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // Content - no partial submissions possible
    cy.findByText(CTQuestion).should('exist')
    cy.get('[data-cy="read-content-element-1"]').should('exist')
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .click()
    cy.get('[data-cy="student-stack-submit"]')
      .contains(messages.shared.generic.submit)
      .click()

    // SC question (required to complete activity)
    cy.findByText(SCQuestion).should('exist')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-4"]').should('be.disabled')

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
      cy.findByText(this.data.running.descriptionNew).should('exist')
      cy.get('[data-cy="start-practice-quiz"]').click()
      answerRunningPracticeQuiz()
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
    cy.get(`[data-cy="practice-quiz-${this.data.running.nameNew}"]`).contains(
      messages.shared.generic.published
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
    answerRunningPracticeQuiz()
  })

  it('Solve the practice quiz with partial answers (where supported)', () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${runningDisplayName}"]`).click()
    answerRunningPracticeQuizPartial()
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
      cy.findByText(this.data.running.descriptionNew).should('exist')
      cy.get('[data-cy="start-practice-quiz"]').click()
      answerRunningPracticeQuiz()
    })
  })

  it('Cleanup: Delete the running practice quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()

    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.nameNew}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.running.nameNew}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.running.nameNew}"]`
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

  // ! Part 3: Future Practice Quiz
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
    cy.get(`[data-cy="practice-quiz-${this.data.scheduled.name}"]`).contains(
      messages.shared.generic.scheduled
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
        cy.get('[data-cy="start-practice-quiz"]').should('exist')
      }
    )
  })

  it('Unpublish the practice quiz again on the lecturer view', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.scheduled.name}"]`
    ).click()
    cy.get(
      `[data-cy="unpublish-practiceQuiz-${this.data.scheduled.name}"]`
    ).click()
    cy.get(`[data-cy="practice-quiz-${this.data.scheduled.name}"]`).contains(
      messages.shared.generic.draft
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
    cy.get(`[data-cy="practice-quiz-${this.data.scheduled.name}"]`).contains(
      messages.shared.generic.published
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
      `[data-cy="practice-quiz-actions-${this.data.scheduled.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${this.data.scheduled.name}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="practice-quiz-actions-${this.data.scheduled.name}"]`
    ).should('not.exist')
  })

  it('Verify that the scheduled practice quiz is not visible to students', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.scheduled.displayName}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete all created questions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    const questions = [
      this.data.questions.SC1.title,
      this.data.questions.SC2.title,
      this.data.questions.MC.title,
      this.data.questions.KP.title,
      this.data.questions.NR.title,
      this.data.questions.FT.title,
      SEQuestionTitle,
      this.data.questions.FC.title,
      this.data.questions.CT.title,
    ]

    cy.wrap(questions).each((title: string) => {
      cy.deleteElement({ elementName: title })
    })
  })

  it('Cleanup: Delete the created answer collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.deleteAnswerCollection({ collectionName: SECollection })
  })

  it('Cleanup: Verify that all answer collections have been deleted properly', () => {
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
})
