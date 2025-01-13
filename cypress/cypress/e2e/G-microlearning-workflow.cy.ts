import messages from '../../../packages/i18n/messages/en'

const currentYear = new Date().getFullYear()
const testCourse = 'Testkurs'
const SCQuestionTitle = 'SC 3c85c6e2-ee62-433e-a60d-7d8c3f4e89c1'
const SCQuestion = 'SC Question Micro'
const SCQuestionTitleNoSol = 'SC fb68bad7-ea26-4ce3-bf10-087e8c916ded'
const SCQuestionNoSol = 'SC Question Micro No Solution'
const MCQuestionTitle = 'MC 9ba32a20-b528-4b04-a474-75a41cb2a02f'
const MCQuestion = 'MC Question Micro'
const KPRIMQuestionTitle = 'KPRIM 185dcb86-3eda-4baa-8648-486d27d0ace9'
const KPRIMQuestion = 'KPRIM Question Micro'
const NRQuestionTitle = 'NR 17385009-e69b-4995-bcfc-a9ee289f40ea'
const NRQuestion = 'NR Question Micro'
const FTQuestionTitle = 'FT 371393fa-e632-487c-a4bf-f2b2e032231b'
const FTQuestion = 'FT Question Micro'
const FCQuestionTitle = 'FC c1e004c0-6a86-42cb-a67d-614a48b8a8a1'
const FCQuestion = 'FC Question Micro'
const FCAnswer = 'FC Answer Micro'
const CTQuestionTitle = 'CT fa7b655c-319a-4318-9f58-c743fbe5b2db'
const CTQuestion = 'CT Question Micro'
const SEQuestion = 'SE Question ML'
const SEQuestionTitle = 'SE cb23e8ed-0499-4011-b1d4-cfcdaad0b25a'
const SEQuestionInputs = 3
const SECollection = 'SE Collection ML'
const SECollectionDescription = 'SE Collection ML Description'
const SECollectionOptions = [
  'SE ML Option 1',
  'SE ML Option 2',
  'SE ML Option 3',
  'SE ML Option 4',
  'SE ML Option 5',
]
const SECollectionSolutions = [0, 1, 3]

const runningMLNameOLD = 'Running microlearning OLD'
const runningMLDisplayNameOLD = runningMLNameOLD + ' (Display)'
const runningMLDescriptionOLD = 'Running microlearning OLD description'
const runningMLName = 'Running microlearning'
const runningMLDisplayName = runningMLName + ' (Display)'
const runningMLDescription = 'Running microlearning description'
const runningStartOLD = `${currentYear - 1}-01-01T02:00`
const runningEndOLD = `${currentYear}-12-31T18:00`
const runningStart = `${currentYear - 2}-01-01T02:00`
const runningEnd = `${currentYear + 1}-12-31T18:00`
const runningEndExtended = `${currentYear + 5}-12-31T18:00`
const runningExtendedText = `End: 31.12.${currentYear + 5}, 18:00`
const stackTitle1OLD = 'Stack 1 Description Title OLD'
const stackTitle2OLD = 'Stack 2 Description Title OLD'
const stackTitle1 = 'Stack 1 Description Title'
const stackTitle2 = 'Stack 2 Description Title'

const futureMLName = 'Future microlearning'
const futureMLDisplayName = futureMLName + ' (Display)'
const futureMLDescription = 'Future microlearning description'

const completeMLName = 'Complete microlearning'
const completeMLDisplayName = completeMLName + ' (Display)'

const seededPastMicrolearning = 'Test Microlearning Past No FT'
const convertedPracticeQuizName = 'Practice Quiz Converted'
const convertedPracticeQuizDisplayName = 'Practice Quiz Converted Displayname'

const duplicatedMLName = runningMLName + ' (Copy)'
const duplicatedMLDisplayName = runningMLDisplayName + ' (NEW!)'

// ? All microlearning creation steps are bundled in the beginning of the test, since reloading the page
// ? sometimes triggers a recomputation of the randomized question titles, not allowing for a comparison anymore
describe('Different microlearning workflows', () => {
  // ! Part 0: Preparation - Question Creation
  it('Create questions required for microlearning creation', () => {
    cy.loginLecturer()

    // SC question with solution
    cy.createQuestionSC({
      title: SCQuestionTitle,
      content: SCQuestion,
      choices: [{ content: '50%', correct: true }, { content: '100%' }],
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

  // ! Part 1: Microlearning Creation
  it('Create a microlearning around the current time', () => {
    // Start creation
    cy.loginLecturer()
    cy.get('[data-cy="create-microlearning"]').click()
    cy.get('[data-cy="cancel-activity-creation"]').click()
    cy.get('[data-cy="create-microlearning"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .type(runningMLNameOLD)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(runningMLDisplayNameOLD)
    cy.get('[data-cy="insert-microlearning-description"]')
      .realClick()
      .type(runningMLDescriptionOLD)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${testCourse}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
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
        { elements: [SCQuestionTitle, FTQuestionTitle] },
        { elements: [FCQuestionTitle, CTQuestionTitle] },
      ],
    })
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // SC question without sample solution should be rejected
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${SCQuestionTitleNoSol}"]`)
      .contains(SCQuestionTitleNoSol)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-1"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="element-2-stack-1"]').contains(SCQuestionTitleNoSol)
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="remove-element-2-stack-1"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')

    // add displayname and description to stacks
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').click().type(stackTitle1OLD)
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      stackTitle1OLD
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').click().type(stackTitle2OLD)
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      stackTitle2OLD
    )
    cy.get('[data-cy="close-stack-description"]').click()

    // move stacks around
    cy.get('[data-cy="move-stack-0-right"]').click()
    cy.get('[data-cy="element-0-stack-1"]').contains(SCQuestionTitle)
    cy.get('[data-cy="element-1-stack-1"]').contains(FTQuestionTitle)
    cy.get('[data-cy="element-0-stack-0"]').contains(FCQuestionTitle)
    cy.get('[data-cy="element-1-stack-0"]').contains(CTQuestionTitle)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      stackTitle2OLD
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      stackTitle1OLD
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="move-stack-1-left"]').click()
    cy.get('[data-cy="element-0-stack-0"]').contains(SCQuestionTitle)
    cy.get('[data-cy="element-1-stack-0"]').contains(FTQuestionTitle)
    cy.get('[data-cy="element-0-stack-1"]').contains(FCQuestionTitle)
    cy.get('[data-cy="element-1-stack-1"]').contains(CTQuestionTitle)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should(
      'have.value',
      stackTitle1OLD
    )
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      stackTitle2OLD
    )
    cy.get('[data-cy="close-stack-description"]').click()

    // move questions in stack
    cy.get('[data-cy="move-element-0-stack-1-down"]').click()
    cy.get('[data-cy="element-0-stack-1"]').contains(CTQuestionTitle)
    cy.get('[data-cy="element-1-stack-1"]').contains(FCQuestionTitle)
    cy.get('[data-cy="move-element-1-stack-1-up"]').click()
    cy.get('[data-cy="element-0-stack-1"]').contains(FCQuestionTitle)
    cy.get('[data-cy="element-1-stack-1"]').contains(CTQuestionTitle)

    // finalize microlearning creation
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // navigate to list of microlearnings and check status
    cy.get('[data-cy="load-live-quiz-list"]').click()
  })

  it('Edit the running microlearnings content', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="microlearning-actions-${runningMLNameOLD}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${runningMLNameOLD}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // check if the first page of the edit form are shown correctly
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', runningMLNameOLD)
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .clear()
      .type(runningMLName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', runningMLDisplayNameOLD)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .clear()
      .type(runningMLDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]').contains(
      runningMLDescriptionOLD
    )
    cy.get('[data-cy="insert-microlearning-description"]')
      .realClick()
      .clear()
      .type(runningMLDescription)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)

    // check if correct values are in the form and rename it
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
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
    const addQuestions = [SCQuestionTitle, FTQuestionTitle]
    cy.get('[data-cy="drop-elements-add-stack"]').click()
    addQuestions.forEach((element, ix) => {
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
      stackTitle1OLD
    )
    cy.get('[data-cy="stack-0-displayname"]').click().clear().type(stackTitle1)
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle1)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should(
      'have.value',
      stackTitle2OLD
    )
    cy.get('[data-cy="stack-1-displayname"]').click().clear().type(stackTitle2)
    cy.get('[data-cy="stack-1-displayname"]').should('have.value', stackTitle2)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${runningMLName}"]`).contains(
      messages.shared.generic.draft
    )

    // recheck if the changes have been saved
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="edit-microlearning-${runningMLName}"]`).click()
    cy.findByText('Edit ' + messages.shared.generic.microlearning).should(
      'exist'
    )
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', runningMLName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', runningMLDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]').contains(
      runningMLDescription
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-start-date"]')
      .click()
      .should('have.value', runningStart)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .should('have.value', runningEnd)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="element-0-stack-0"]').contains(SCQuestionTitle)
    cy.get('[data-cy="element-1-stack-0"]').contains(FTQuestionTitle)
    cy.get('[data-cy="element-0-stack-1"]').contains(FCQuestionTitle)
    cy.get('[data-cy="element-1-stack-1"]').contains(CTQuestionTitle)
    cy.get('[data-cy="element-0-stack-2"]').contains(SCQuestionTitle)
    cy.get('[data-cy="element-1-stack-2"]').contains(FTQuestionTitle)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle1)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should('have.value', stackTitle2)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${runningMLName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Duplicate a microlearning and check the editors content', () => {
    // duplicate the microlearning
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="duplicate-microlearning-${runningMLName}"]`).click()
    cy.findByText('Create ' + messages.shared.generic.microlearning).should(
      'exist'
    )

    // check general information
    cy.get('[data-cy="insert-microlearning-name"]')
      .click()
      .should('have.value', duplicatedMLName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .should('have.value', runningMLDisplayName)
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .clear()
      .type(duplicatedMLDisplayName)
    cy.get('[data-cy="insert-microlearning-description"]').contains(
      runningMLDescription
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the settings have been copied correctly
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
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
    cy.get('[data-cy="element-0-stack-0"]').contains(SCQuestionTitle)
    cy.get('[data-cy="element-1-stack-0"]').contains(FTQuestionTitle)
    cy.get('[data-cy="element-0-stack-1"]').contains(FCQuestionTitle)
    cy.get('[data-cy="element-1-stack-1"]').contains(CTQuestionTitle)
    cy.get('[data-cy="element-0-stack-2"]').contains(SCQuestionTitle)
    cy.get('[data-cy="element-1-stack-2"]').contains(FTQuestionTitle)
    cy.get('[data-cy="open-stack-0-description"]').realClick()
    cy.get('[data-cy="stack-0-displayname"]').should('have.value', stackTitle1)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="open-stack-1-description"]').realClick()
    cy.get('[data-cy="stack-1-displayname"]').should('have.value', stackTitle2)
    cy.get('[data-cy="close-stack-description"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // go to microlearning list and check if it exists in draft state
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${duplicatedMLName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Create a microlearning that starts in the future', () => {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: futureMLName,
      displayName: futureMLDisplayName,
      description: futureMLDescription,
      courseName: testCourse,
      multiplier: messages.manage.activityWizard.multiplier2,
      startDate: `${currentYear + 1}-01-01T02:00`,
      endDate: `${currentYear + 1}-12-31T18:00`,
      stacks: [{ elements: [SCQuestionTitle] }],
    })

    // check if creation was successful
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-${futureMLName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Create a microlearning with all element types', () => {
    cy.loginLecturer()
    cy.createMicroLearning({
      name: completeMLName,
      displayName: completeMLDisplayName,
      courseName: testCourse,
      startDate: `${currentYear - 1}-01-01T02:00`,
      endDate: `${currentYear + 1}-12-31T18:00`,
      stacks: [
        {
          elements: [
            SCQuestionTitle,
            MCQuestionTitle,
            KPRIMQuestionTitle,
            NRQuestionTitle,
            FTQuestionTitle,
            SEQuestionTitle,
            FCQuestionTitle,
            CTQuestionTitle,
          ],
        },
      ],
    })
  })

  // ! Part 2: Running Microlearning
  function answerMicroLearningPreview() {
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').click().type('Free text answer')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()

    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="read-content-element-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').click().type('Free text answer 2')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
  }

  it('Check if the drafted microlearning can be accessed by the lecturer through the activity preview', () => {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getMicroLearningInfo', { mlName: runningMLName }).then(
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
        answerMicroLearningPreview()
      }
    )
  })

  it('Publish a microlearning that will immediately be running', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="publish-microlearning-${runningMLName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${runningMLName}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Check if the running microlearning can be accessed by the lecturer through the activity preview', () => {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getMicroLearningInfo', { mlName: runningMLName }).then(
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
        answerMicroLearningPreview()
      }
    )
  })

  it('Extend the running microlearning', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()

    // open extension modal
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="extend-microlearning-${runningMLName}"]`).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="extend-microlearning-${runningMLName}"]`).click()

    // change the end date and check if the changes are saved
    cy.get('[data-cy="extend-activity-date"]').click().type(runningEndExtended)
    cy.get('[data-cy="extend-activity-confirm"]').click()
    cy.get(`[data-cy="microlearning-${runningMLName}"]`).contains(
      runningExtendedText
    )

    // check that changing the date to the past does not work
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="extend-microlearning-${runningMLName}"]`).click()
    cy.get('[data-cy="extend-activity-confirm"]').should('not.be.disabled')
    cy.get('[data-cy="extend-activity-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T12:00`)
    cy.get('[data-cy="extend-activity-confirm"]').should('be.disabled')
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="microlearning-${runningMLName}"]`).contains(
      runningExtendedText
    )
  })

  it('Respond to the first stack of the running microlearning from a laptop', () => {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${runningMLDisplayName}"]`).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').click().type('Free text answer')
    cy.get('[data-cy="student-stack-submit"]').click()
  })

  it("Check that the student's previous response is correctly loaded and respond to the second stack", () => {
    // sign in as a student on a mobile device and respond to the all questions
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.loginStudent()

    cy.get(`[data-cy="microlearning-${runningMLDisplayName}"]`).click()
    cy.get('[data-cy="start-microlearning"]').click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').should(
      'have.value',
      'Free text answer'
    )
    cy.get('[data-cy="student-stack-continue"]').click() // skip first already answered question (fetch from backend)

    // answer the second element stack
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="read-content-element-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()

    // answer the third element stack and finish microlearning
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-2"]').click().type('Free text answer 2')
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.get('[data-cy="student-stack-continue"]').click()
    cy.get('[data-cy="finish-microlearning"]').click()
    cy.wait(1000)
    cy.get(`[data-cy="microlearning-${runningMLDisplayName}"]`).should('exist')
    cy.get(`[data-cy="microlearning-${runningMLDisplayName}"]`).should(
      'be.disabled'
    )
  })

  it('End the running microlearning', () => {
    cy.viewport('macbook-16')
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="end-microlearning-${runningMLName}"]`).click()
    cy.get(`[data-cy="confirm-responses-microlearning"]`).should('not.exist')
    cy.get(`[data-cy="confirm-anonymous-responses-microlearning"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="end-microlearning-${runningMLName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
  })

  it('Check that the microlearning is no longer visible to the student that submitted answers', () => {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${runningMLDisplayName}"]`).should(
      'not.exist'
    )
  })

  it("Check that other students can't see the microlearning", () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="microlearning-${runningMLDisplayName}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Delete the running microlearning to avoid name collisions', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the running microlearning
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${runningMLName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'not.be.disabled'
    )
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${runningMLName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${runningMLName}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Delete the duplicated microlearning to avoid name collisions', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the duplicated microlearning
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="microlearning-actions-${duplicatedMLName}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${duplicatedMLName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${duplicatedMLName}"]`).should(
      'not.exist'
    )
  })

  // ! Part 3: Future Microlearning
  it('Publish the future microlearning', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="publish-microlearning-${futureMLName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${futureMLName}"]`).contains(
      messages.shared.generic.scheduled
    )
  })

  it('Verify that future microlearnings are not shown to students', () => {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${futureMLDisplayName}"]`).should(
      'not.exist'
    )
  })

  it('Check that a scheduled microlearning can be accessed through the activity preview', () => {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('getMicroLearningInfo', { mlName: futureMLName }).then(
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
        cy.get('[data-cy="start-microlearning"]').should('exist')
      }
    )
  })

  it('Unpublish the future microlearning from the lecturer view', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="microlearning-actions-${futureMLName}"]`).click()
    cy.get(`[data-cy="unpublish-microlearning-${futureMLName}"]`).click()
    cy.get(`[data-cy="microlearning-${futureMLName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Cleanup: Delete the future microlearning to avoid name collisions', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the future microlearning
    cy.get(`[data-cy="microlearning-actions-${futureMLName}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${futureMLName}"]`).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-anonymous-responses"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${futureMLName}"]`).should(
      'not.exist'
    )
  })

  // ! Part 4: Complete Microlearning
  it('Publish the microlearning that contains all question types', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    cy.get(`[data-cy="publish-microlearning-${completeMLName}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${completeMLName}"]`).contains(
      messages.shared.generic.published
    )
  })

  it('Respond to all questions in the microlearning covering all element types', () => {
    cy.loginStudent()

    cy.get(`[data-cy="microlearning-${completeMLDisplayName}"]`).click()
    cy.get('[data-cy="start-microlearning"]').click()

    // enter valid response for all questions to check correct input validation afterwards
    cy.get('[data-cy="practice-quiz-mark-all-as-read"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-4-correct"]').click()
    cy.get('[data-cy="input-numerical-4"]').clear().type('0.55')
    cy.get('[data-cy="free-text-input-5"]').type('Testinput')
    cy.get('[data-cy="selection-6-field-1"]').click()
    cy.get(`[data-cy="select-answer-${SECollectionOptions[0]}"]`).click()
    cy.get('[data-cy="selection-6-field-1"]').contains(SECollectionOptions[0])
    cy.get('[data-cy="selection-6-field-2"]').click()
    cy.get(`[data-cy="select-answer-${SECollectionOptions[1]}"]`).click()
    cy.get('[data-cy="selection-6-field-2"]').contains(SECollectionOptions[1])
    cy.get('[data-cy="selection-6-field-3"]').click()
    cy.get(`[data-cy="select-answer-${SECollectionOptions[2]}"]`).click()
    cy.get('[data-cy="selection-6-field-3"]').contains(SECollectionOptions[2])
    cy.get('[data-cy="flashcard-front-7"]').click()
    cy.get('[data-cy="flashcard-response-7-No"]').click()
    cy.get('[data-cy="flashcard-response-7-Yes"]').click()
    cy.get('[data-cy="read-content-element-8"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')

    // test inputs to MC question (2)
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()

    // test inputs to NR question (4)
    cy.get('[data-cy="input-numerical-4"]').clear().type('-20')
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-4"]').clear().type('10.45')
    cy.get('[data-cy="student-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="input-numerical-4"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-4"]').type('100')

    // test inputs to FT question (5)
    cy.get('[data-cy="free-text-input-5"]').clear()
    cy.get('[data-cy="student-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-5"]').type('correct')

    // submit responses
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-stack-continue"]')
      .contains(messages.shared.generic.finish)
      .click() // finish quiz
  })

  it('Cleanup: Delete the complete microlearning to avoid naming collisions', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-microLearnings"]').click()

    // delete the microlearning with all element types
    cy.get(`[data-cy="microlearning-actions-${completeMLName}"]`).click()
    cy.get(`[data-cy="delete-microlearning-${completeMLName}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="microlearning-actions-${completeMLName}"]`).should(
      'not.exist'
    )
  })

  it('Make sure that the complete microlearning is no longer visible to students', () => {
    cy.loginStudent()
    cy.get(`[data-cy="microlearning-${completeMLDisplayName}"]`).should(
      'not.exist'
    )
  })

  // ! Part 5: Practice Quiz Conversion
  it('Convert the seeded past microlearning into a practice quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()

    // start conversion of a microlearning into a practice quiz
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="microlearning-actions-${seededPastMicrolearning}"]`
    ).click()
    cy.get(
      `[data-cy="convert-microlearning-${seededPastMicrolearning}-to-practice-quiz"]`
    ).click()

    // check if the practice quiz editor is open
    cy.get('[data-cy="insert-practice-quiz-name"]')
      .click()
      .should('have.value', `${seededPastMicrolearning} (converted)`)
      .clear()
      .type(convertedPracticeQuizName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .should('have.value', seededPastMicrolearning)
      .clear()
      .type(convertedPracticeQuizDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // continue to the next step and change the default settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${testCourse}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(testCourse)
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
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${convertedPracticeQuizName}"]`).contains(
      messages.shared.generic.draft
    )
  })

  it('Cleanup: Delete the converted practice quiz to avoid naming collisions', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()

    // delete the converted practice quiz
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${convertedPracticeQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-practice-quiz-${convertedPracticeQuizName}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="practice-quiz-actions-${convertedPracticeQuizName}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete all created questions', () => {
    cy.loginLecturer()
    cy.deleteElement({ elementName: SCQuestionTitle })
    cy.deleteElement({ elementName: SCQuestionTitleNoSol })
    cy.deleteElement({ elementName: MCQuestionTitle })
    cy.deleteElement({ elementName: KPRIMQuestionTitle })
    cy.deleteElement({ elementName: NRQuestionTitle })
    cy.deleteElement({ elementName: FTQuestionTitle })
    cy.deleteElement({ elementName: SEQuestionTitle })
    cy.deleteElement({ elementName: FCQuestionTitle })
    cy.deleteElement({ elementName: CTQuestionTitle })
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
