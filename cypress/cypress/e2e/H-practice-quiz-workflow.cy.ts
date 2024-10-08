import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

const currentYear = new Date().getFullYear()
const testCourse = 'Testkurs'
const SCQuestionTitle = 'SC ' + uuid()
const SCQuestion = 'SC Question PQ'
const SCQuestionTitleNoSol = 'SC ' + uuid()
const SCQuestionNoSol = 'SC Question PQ No Solution'
const MCQuestionTitle = 'MC ' + uuid()
const MCQuestion = 'MC Question PQ'
const KPRIMQuestionTitle = 'KPRIM ' + uuid()
const KPRIMQuestion = 'KPRIM Question PQ'
const NRQuestionTitle = 'NR ' + uuid()
const NRQuestion = 'NR Question PQ'
const FTQuestionTitle = 'FT ' + uuid()
const FTQuestion = 'FT Question PQ'
const FCQuestionTitle = 'FC ' + uuid()
const FCQuestion = 'FC Question PQ'
const FCAnswer = 'FC Answer PQ'
const CTQuestionTitle = 'CT ' + uuid()
const CTQuestion = 'CT Question PQ'

const runningNameOLD = 'Running Practice Quiz OLD'
const runningDisplayNameOLD = 'Running Practice Quiz OLD'
const runningName = 'Running Practice Quiz'
const runningDisplayName = 'Running Practice Quiz'
const runningNameDupl = runningName + ' (Copy)'

// ? For consistency, all creation / editing / duplication workflows are run before checking the student views
describe('Different practice quiz workflows', () => {
  it('Create questions required for practice quiz creation', () => {
    cy.loginLecturer()

    // SC question with solution
    cy.createQuestionSC({
      title: SCQuestionTitle,
      content: SCQuestion,
      choices: [
        { content: '50%', correct: true },
        { content: '100%' },
        { content: '200%' },
        { content: '300%' },
      ],
    })

    // SC question without solution
    cy.createQuestionSC({
      title: SCQuestionTitleNoSol,
      content: SCQuestionNoSol,
      choices: [{ content: '50%' }, { content: '100%' }],
    })

    // MC question
    cy.createQuestionMC({
      title: MCQuestionTitle,
      content: MCQuestion,
      choices: [
        { content: '25%' },
        { content: '50%', correct: true },
        { content: '75%' },
        { content: '100%', correct: true },
        { content: '200%' },
      ],
    })

    // KPRIM question
    cy.createQuestionKPRIM({
      title: KPRIMQuestionTitle,
      content: KPRIMQuestion,
      choices: [
        { content: '25%' },
        { content: '50%', correct: true },
        { content: '75%' },
        { content: '100%', correct: true },
      ],
    })

    // NR question
    cy.createQuestionNR({
      title: NRQuestionTitle,
      content: NRQuestion,
      min: '0',
      max: '100',
      unit: '%',
      accuracy: '2',
      solutionRanges: [
        { min: '0', max: '25' },
        { min: '75', max: '100' },
      ],
    })

    // FT question
    cy.createQuestionFT({
      title: FTQuestionTitle,
      content: FTQuestion,
      maxLength: '100',
    })

    // FC question
    cy.createFlashcard({
      title: FCQuestionTitle,
      content: FCQuestion,
      explanation: FCAnswer,
    })

    // CT question
    cy.createContent({
      title: CTQuestionTitle,
      content: CTQuestion,
    })
  })

  it('Test the creation of a practice quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="questions"]').click()

    // create practice quiz
    cy.get('[data-cy="create-practice-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-practice-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').click().type(runningNameOLD)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(runningDisplayNameOLD)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${testCourse}"]`).click({ force: true })
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier1)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier2}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier2
    )
    cy.get('[data-cy="insert-reset-time-days"]').clear().type('4')
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSEQUENTIAL}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSPACED_REPETITION}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Create stacks
    cy.createStacks({
      stacks: [
        { elements: [SCQuestionTitle] },
        { elements: [MCQuestionTitle] },
        { elements: [KPRIMQuestionTitle] },
        { elements: [NRQuestionTitle] },
        { elements: [FTQuestionTitle] },
        { elements: [FCQuestionTitle] },
        { elements: [CTQuestionTitle] },
      ],
    })

    // SC question without sample solution should be rejected
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${SCQuestionTitleNoSol}"]`)
      .contains(SCQuestionTitleNoSol)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-1"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="question-1-stack-1"]').contains(SCQuestionTitleNoSol)
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="delete-question-1-stack-1"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // end the practice quiz creation
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${runningNameOLD}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Edit the first created practice quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-actions-${runningNameOLD}"]`).click()
    cy.get(`[data-cy="edit-practice-quiz-${runningNameOLD}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').should(
      'have.value',
      runningNameOLD
    )
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .clear()
      .type(runningName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
      'have.value',
      runningDisplayNameOLD
    )
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .clear()
      .type(runningDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier2
    )
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
    cy.get('[data-cy="select-order"]').click()
    cy.get(
      `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSEQUENTIAL}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Check content of stacks and add another question
    cy.get('[data-cy="question-0-stack-0"]').contains(
      SCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-1"]').contains(
      MCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-2"]').contains(
      KPRIMQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-3"]').contains(
      NRQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-4"]').contains(
      FTQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-5"]').contains(
      FCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-6"]').contains(
      CTQuestionTitle.substring(0, 20)
    )

    cy.get('[data-cy="drop-elements-add-stack"]').click()
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${SCQuestionTitle}"]`)
      .contains(SCQuestionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-7"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="question-0-stack-7"]').contains(
      SCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check on the course overview if the updated practice quiz is visible
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${runningName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Verify that the changes from editing went into effect', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-actions-${runningName}"]`).click()
    cy.get(`[data-cy="edit-practice-quiz-${runningName}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
      'exist'
    )

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').should(
      'have.value',
      runningName
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
      'have.value',
      runningDisplayName
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier4
    )
    cy.get('[data-cy="select-order"]')
      .should('exist')
      .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Check content of stacks and add another question
    cy.get('[data-cy="question-0-stack-0"]').contains(
      SCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-1"]').contains(
      MCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-2"]').contains(
      KPRIMQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-3"]').contains(
      NRQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-4"]').contains(
      FTQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-5"]').contains(
      FCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-6"]').contains(
      CTQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="question-0-stack-7"]').contains(
      SCQuestionTitle.substring(0, 20)
    )
    cy.get('[data-cy="next-or-submit"]').click()
  })

  // TODO: create a practice quiz with start date in the future

  // TODO: test duplication logic for running practice quiz

  it('Publish the practice quiz around the current time', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="publish-practice-quiz-${runningName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="practice-quiz-${runningName}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Solve the practice quiz and test the student view accordingly', () => {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${runningName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()

    // SC question
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="sc-1-answer-option-3"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // MC question
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="mc-1-answer-option-3"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // KPRIM question
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // NR question
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('-20')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear().type('0.55')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-1"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-1"]').type('100')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // FT question
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type('Testinput')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="free-text-input-1"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-1"]').type('correct')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // skip back and forth
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="practice-quiz-progress-3"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-1"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-2"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-0"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()
    cy.get('[data-cy="practice-quiz-continue"]').click()

    // Flashcard
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // Content
    cy.get('[data-cy="read-content-element-1"]').should('exist')
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .click()
    cy.get('[data-cy="student-stack-submit"]')
      .contains(messages.shared.generic.submit)
      .click()

    // SC question
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="sc-1-answer-option-3"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // finish the practice quiz
    cy.get('[data-cy="practice-quiz-continue"]')
      .contains(messages.shared.generic.finish)
      .click()
  })

  // TODO: cover potential other test elements that have not been considered so far

  it('Cleanup: Delete all created practice quizzes', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the running practice quiz
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-actions-${runningName}"]`).click()
    cy.get(`[data-cy="delete-practice-quiz-${runningName}"]`).click()
    cy.get(`[data-cy="activity-deletion-modal-confirm"]`).should('be.disabled')
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-deletion-modal-confirm"]`).click()
    cy.get(`[data-cy="practice-quiz-actions-${runningName}"]`).should(
      'not.exist'
    )
  })

  it('Check that none of the deleted practice quizzes are visible to students', () => {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${runningName}"]`).should('not.exist')
  })

  // it('Test scheduling and publishing functionalities of a practice quiz', () => {
  //   // create a practice quiz with availability starting in the future
  //   // switch to question pool view
  //   cy.get('[data-cy="questions"]').click()
  //   // set up question with solution
  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="insert-question-title"]').click().type(questionTitle3)
  //   cy.get('[data-cy="insert-question-text"]').click().type(question)
  //   cy.get('[data-cy="configure-sample-solution"]').click()
  //   cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
  //   cy.get('[data-cy="set-correctness-0"]').click({ force: true })
  //   cy.get('[data-cy="add-new-answer"]').click({ force: true })
  //   cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   // create practice quiz
  //   cy.get('[data-cy="create-practice-quiz"]').click()
  //   // step 1
  //   cy.get('[data-cy="insert-practice-quiz-name"]')
  //     .click()
  //     .type(practiceQuizName3)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="insert-practice-quiz-display-name"]')
  //     .click()
  //     .type(practiceQuizDisplayName3)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   // step 2
  //   cy.get('[data-cy="select-course"]').click()
  //   cy.get(`[data-cy="select-course-${courseName}"]`).click()
  //   cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
  //   cy.get('[data-cy="select-multiplier"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.multiplier1)
  //   cy.get('[data-cy="select-multiplier"]').click()
  //   cy.get(
  //     `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier2}"]`
  //   ).click()
  //   cy.get('[data-cy="select-multiplier"]').contains(
  //     messages.manage.sessionForms.multiplier2
  //   )
  //   // set future availability date
  //   cy.get('[data-cy="select-available-from"]')
  //     .click()
  //     .type(`${currentYear + 5}-01-01T02:00`)
  //   cy.get('[data-cy="insert-reset-time-days"]').clear().type('4')
  //   cy.get('[data-cy="select-order"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
  //   cy.get('[data-cy="select-order"]').click()
  //   cy.get(
  //     `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSEQUENTIAL}"]`
  //   ).click()
  //   cy.get('[data-cy="select-order"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
  //   cy.get('[data-cy="select-order"]').click()
  //   cy.get(
  //     `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSPACED_REPETITION}"]`
  //   ).click()
  //   cy.get('[data-cy="select-order"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   // step 3
  //   const dataTransfer = new DataTransfer()
  //   cy.get(`[data-cy="question-item-${questionTitle3}"]`)
  //     .contains(questionTitle3)
  //     .trigger('dragstart', {
  //       dataTransfer,
  //     })
  //   cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
  //     dataTransfer,
  //   })
  //   const dataTransfer2 = new DataTransfer()
  //   cy.get(`[data-cy="question-item-${questionTitle3}"]`)
  //     .contains(questionTitle3)
  //     .trigger('dragstart', {
  //       dataTransfer2,
  //     })
  //   cy.get('[data-cy="drop-elements-add-stack"]').trigger('drop', {
  //     dataTransfer2,
  //   })
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="load-session-list"]').click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizName3}"]`).contains(
  //     messages.shared.generic.draft
  //   )
  //   // publish practice quiz - should become "scheduled"
  //   cy.get(`[data-cy="publish-practice-quiz-${practiceQuizName3}"]`).click()
  //   cy.get('[data-cy="confirm-publish-action"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizName3}"]`).contains(
  //     messages.shared.generic.scheduled
  //   )
  //   // sign in as student
  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   // check if practice quiz is visible to the students
  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="quizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName3}"]`).should(
  //     'not.exist'
  //   )
  //   // switch back to the lecturer and unpublish the micro learning
  //   cy.clearAllCookies()
  //   cy.loginLecturer()
  //   cy.get('[data-cy="courses"]').click()
  //   cy.findByText(courseName).click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-actions-${practiceQuizName3}"]`).click()
  //   cy.get(`[data-cy="unpublish-practiceQuiz-${practiceQuizName3}"]`).click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizName3}"]`).contains(
  //     messages.shared.generic.draft
  //   )
  //   // edit the practice quiz and change the availability date to the past
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-actions-${practiceQuizName3}"]`).click()
  //   cy.get(`[data-cy="edit-practice-quiz-${practiceQuizName3}"]`).click()
  //   cy.findByText('Edit ' + messages.shared.generic.practiceQuiz).should(
  //     'exist'
  //   )
  //   cy.get('[data-cy="insert-practice-quiz-name"]').should(
  //     'have.value',
  //     practiceQuizName3
  //   )
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
  //     'have.value',
  //     practiceQuizDisplayName3
  //   )
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="select-available-from"]')
  //     .click()
  //     .type(`${currentYear - 1}-01-01T02:00`)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="load-session-list"]').click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizName3}"]`).contains(
  //     messages.shared.generic.draft
  //   )
  //   // publish the practice quiz again
  //   cy.get(`[data-cy="publish-practice-quiz-${practiceQuizName3}"]`).click()
  //   cy.get('[data-cy="confirm-publish-action"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizName3}"]`).contains(
  //     messages.shared.generic.published
  //   )
  //   // check if practice quiz is visible to the students
  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="quizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName3}"]`)
  //     .should('exist')
  //     .click()
  //   cy.get('[data-cy="start-practice-quiz"]').click()
  //   cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
  //   cy.findByText('50%').click()
  //   cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled').click()
  //   cy.wait(1000)
  //   cy.get('[data-cy="practice-quiz-continue"]').click()
  //   // navigate to the lecturer view and delete the practice quiz
  //   cy.clearAllCookies()
  //   cy.loginLecturer()
  //   cy.get('[data-cy="courses"]').click()
  //   cy.findByText(courseName).click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-actions-${practiceQuizName3}"]`).click()
  //   cy.get(`[data-cy="delete-practice-quiz-${practiceQuizName3}"]`).click()
  //   cy.get(`[data-cy="activity-deletion-modal-confirm"]`).should('be.disabled')
  //   cy.get(`[data-cy="confirm-deletion-responses"]`).click()
  //   cy.get(`[data-cy="activity-deletion-modal-confirm"]`).click()
  //   cy.get(`[data-cy="practice-quiz-actions-${practiceQuizName3}"]`).should(
  //     'not.exist'
  //   )
  //   // make sure that the practice quiz is no longer accessible to students
  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="quizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${practiceQuizDisplayName3}"]`).should(
  //     'not.exist'
  //   )
  // })

  // it('Create a practice quiz and duplicate it', () => {
  //   const questionTitleLocal = uuid()
  //   const questionTitleLocal2 = uuid()
  //   const questionLocal = uuid()
  //   const quizName = uuid()
  //   const quizNameDupl = `${quizName} (Copy)`
  //   const quizDisplayNameDupl = `${quizNameDupl} (NEW!)`
  //   const quizDisplayName = uuid()
  //   const quizDescription = uuid()
  //   // switch back to question pool view
  //   cy.get('[data-cy="questions"]').click()
  //   // set up question with solution
  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="insert-question-title"]').click().type(questionTitleLocal)
  //   cy.get('[data-cy="insert-question-text"]').click().type(questionLocal)
  //   cy.get('[data-cy="configure-sample-solution"]').click()
  //   cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
  //   cy.get('[data-cy="set-correctness-0"]').click({ force: true })
  //   cy.get('[data-cy="add-new-answer"]').click({ force: true })
  //   cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   cy.get('[data-cy="create-question"]').click()
  //   cy.get('[data-cy="insert-question-title"]')
  //     .click()
  //     .type(questionTitleLocal2)
  //   cy.get('[data-cy="insert-question-text"]').click().type(questionLocal)
  //   cy.get('[data-cy="configure-sample-solution"]').click()
  //   cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
  //   cy.get('[data-cy="set-correctness-0"]').click({ force: true })
  //   cy.get('[data-cy="add-new-answer"]').click({ force: true })
  //   cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
  //   cy.get('[data-cy="save-new-question"]').click({ force: true })
  //   // create practice quiz
  //   cy.get('[data-cy="create-practice-quiz"]').click()
  //   cy.get('[data-cy="cancel-session-creation"]').click()
  //   cy.get('[data-cy="create-practice-quiz"]').click()
  //   // step 1
  //   cy.get('[data-cy="insert-practice-quiz-name"]').click().type(quizName)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="insert-practice-quiz-display-name"]')
  //     .click()
  //     .type(quizDisplayName)
  //   cy.get('[data-cy="insert-practice-quiz-description"]')
  //     .focus()
  //     .type(quizDescription)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   // step 2
  //   cy.get('[data-cy="select-course"]').click()
  //   cy.get(`[data-cy="select-course-${courseName}"]`).click()
  //   cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
  //   cy.get('[data-cy="select-multiplier"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.multiplier1)
  //   cy.get('[data-cy="select-multiplier"]').click()
  //   cy.get(
  //     `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier2}"]`
  //   ).click()
  //   cy.get('[data-cy="select-multiplier"]').contains(
  //     messages.manage.sessionForms.multiplier2
  //   )
  //   cy.get('[data-cy="insert-reset-time-days"]').clear().type('4')
  //   cy.get('[data-cy="select-order"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.practiceQuizSPACED_REPETITION)
  //   cy.get('[data-cy="select-order"]').click()
  //   cy.get(
  //     `[data-cy="select-order-${messages.manage.sessionForms.practiceQuizSEQUENTIAL}"]`
  //   ).click()
  //   cy.get('[data-cy="select-order"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   // step 3
  //   const dataTransfer = new DataTransfer()
  //   cy.get(`[data-cy="question-item-${questionTitleLocal}"]`)
  //     .contains(questionTitleLocal)
  //     .trigger('dragstart', {
  //       dataTransfer,
  //     })
  //   cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
  //     dataTransfer,
  //   })
  //   const dataTransfer2 = new DataTransfer()
  //   cy.get(`[data-cy="question-item-${questionTitleLocal2}"]`)
  //     .contains(questionTitleLocal2)
  //     .trigger('dragstart', {
  //       dataTransfer2,
  //     })
  //   cy.get('[data-cy="drop-elements-add-stack"]').trigger('drop', {
  //     dataTransfer2,
  //   })
  //   cy.get('[data-cy="question-0-stack-0"]').contains(
  //     questionTitleLocal.substring(0, 20)
  //   )
  //   cy.get('[data-cy="question-0-stack-1"]').contains(
  //     questionTitleLocal2.substring(0, 20)
  //   )
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="load-session-list"]').click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizName}"]`).contains(
  //     messages.shared.generic.draft
  //   )
  //   // go to course overview and look for practice quiz with corresponding title
  //   cy.get('[data-cy="courses"]').click()
  //   cy.findByText(courseName).click()
  //   // publish practice quiz (should not impact the duplication process)
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizName}"]`).contains(
  //     messages.shared.generic.draft
  //   )
  //   cy.get(`[data-cy="publish-practice-quiz-${quizName}"]`).click()
  //   cy.get('[data-cy="confirm-publish-action"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizName}"]`).contains(
  //     messages.shared.generic.published
  //   )
  //   // start duplicating the practice quiz and check content of editor
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-actions-${quizName}"]`).click()
  //   cy.get(`[data-cy="duplicate-practice-quiz-${quizName}"]`).click()
  //   cy.findByText('Create ' + messages.shared.generic.practiceQuiz).should(
  //     'exist'
  //   )
  //   cy.get('[data-cy="insert-practice-quiz-name"]').should(
  //     'have.value',
  //     quizNameDupl
  //   )
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="insert-practice-quiz-display-name"]').should(
  //     'have.value',
  //     quizDisplayName
  //   )
  //   cy.get('[data-cy="insert-practice-quiz-display-name"]')
  //     .click()
  //     .clear()
  //     .type(quizDisplayNameDupl)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   // check if the settings are correct
  //   cy.get('[data-cy="select-multiplier"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.multiplier2)
  //   cy.get('[data-cy="insert-reset-time-days"]').should('have.value', '4')
  //   cy.get('[data-cy="select-order"]')
  //     .should('exist')
  //     .contains(messages.manage.sessionForms.practiceQuizSEQUENTIAL)
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   // check the content of the stack creation step
  //   cy.get('[data-cy="question-0-stack-0"]').contains(
  //     questionTitleLocal.substring(0, 20)
  //   )
  //   cy.get('[data-cy="question-0-stack-1"]').contains(
  //     questionTitleLocal2.substring(0, 20)
  //   )
  //   cy.get('[data-cy="next-or-submit"]').click()
  //   cy.get('[data-cy="load-session-list"]').click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizNameDupl}"]`).contains(
  //     messages.shared.generic.draft
  //   )
  //   // publish practice quiz
  //   cy.get(`[data-cy="publish-practice-quiz-${quizNameDupl}"]`).click()
  //   cy.get('[data-cy="confirm-publish-action"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizNameDupl}"]`).contains(
  //     messages.shared.generic.published
  //   )
  //   // sign in as student and answer practice quiz
  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="quizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizDisplayNameDupl}"]`)
  //     .contains(quizDisplayNameDupl)
  //     .click()
  //   cy.get('[data-cy="start-practice-quiz"]').click()
  //   cy.findByText('50%').click()
  //   cy.get('[data-cy="student-stack-submit"]').click()
  //   cy.wait(1000)
  //   cy.get('[data-cy="practice-quiz-continue"]').click()
  //   cy.findByText('50%').click()
  //   cy.get('[data-cy="student-stack-submit"]').click()
  //   cy.wait(1000)
  //   cy.get('[data-cy="practice-quiz-continue"]').click()
  //   // navigate to the lecturer view and delete the practice quiz
  //   cy.clearAllCookies()
  //   cy.loginLecturer()
  //   cy.get('[data-cy="courses"]').click()
  //   cy.findByText(courseName).click()
  //   cy.get('[data-cy="tab-practiceQuizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-actions-${quizNameDupl}"]`).click()
  //   cy.get(`[data-cy="delete-practice-quiz-${quizNameDupl}"]`).click()
  //   cy.get(`[data-cy="activity-deletion-modal-confirm"]`).should('be.disabled')
  //   cy.get(`[data-cy="confirm-deletion-responses"]`).click()
  //   cy.get(`[data-cy="activity-deletion-modal-confirm"]`).click()
  //   cy.get(`[data-cy="practice-quiz-actions-${quizNameDupl}"]`).should(
  //     'not.exist'
  //   )
  //   // make sure that the practice quiz is no longer accessible to students
  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.get('[data-cy="username-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]')
  //     .click()
  //     .type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="quizzes"]').click()
  //   cy.get(`[data-cy="practice-quiz-${quizDisplayNameDupl}"]`).should(
  //     'not.exist'
  //   )
  // })
})
