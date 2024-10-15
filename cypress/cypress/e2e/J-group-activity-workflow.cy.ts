import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

const SCQuestionTitle = uuid()
const SCQuestion = 'SC Question Group Activity'
const MCQuestionTitle = uuid()
const MCQuestion = 'MC Question Group Activity'
const KPRIMQuestionTitle = uuid()
const KPRIMQuestion = 'KPRIM Question Group Activity'
const NRQuestionTitle = uuid()
const NRQuestion = 'NR Question Group Activity'
const FTQuestionTitle = uuid()
const FTQuestion = 'FT Question Group Activity'
const CTQuestionTitle = uuid()
const CTQuestion = 'CT Question Group Activity'

const currentYear = new Date().getFullYear()
const testCourse = 'Testkurs'
const groupMessage1 = 'Hello group! (initial message)' + uuid()
const groupMessage2 = 'Hello! (response)' + uuid()

const activityName = 'Group Activity Running'
const activityDisplayName = activityName + ' (Display)'
const activityTask = 'Group Activity Task Description'
const activityStart = `${currentYear + 1}-01-01T02:00`
const activityEnd = `${currentYear + 1}-12-31T18:00`

const clueName1 = 'Test Clue 1'
const clueDisplayName1 = 'Test Clue Display Name 1'
const clueContent1 = 'Test Clue Content 1'
const clueName2 = 'Test Clue 2'
const clueDisplayName2 = 'Test Clue Display Name 2'
const clueContent2 = 42
const clueUnit2 = 'kg'
const clueName3 = 'Test Clue 3'
const clueDisplayName3 = 'Test Clue Display Name 3'
const clueContent3 = 60

const runningActivityName = 'Group Activity Running'
const runningActivityDisplayName = runningActivityName + ' (Display)'
const runningActivityTask = 'Group Activity Task Description'
const runningActivityStart = `${currentYear - 1}-01-01T02:00`
const runningActivityEnd = `${currentYear + 1}-12-31T18:00`
const extendedActivityEnd = `${currentYear + 2}-12-31T18:00`
const extendedActivityEndText = `31.12.${currentYear + 2}, 18:00`

const clueName4 = 'Test Clue 4'
const clueDisplayName4 = 'Test Clue Display Name 4'
const clueContent4 = 'Test Clue Content 4'
const clueName5 = 'Test Clue 5'
const clueDisplayName5 = 'Test Clue Display Name 5'
const clueContent5 = 50
const clueUnit5 = 'kg'

const flaggingText = 'This is a test flagging message'
const flaggingTextNew = 'This is a NEW test flagging message'
const freeTextAnswer = 'Testanswer to Free-Text Question'
const numericalAnswer = '100'

const maxPoints = ['200', '100', '100', '300', '100', '200']
const scores1 = ['100', '100', '50', '200', '80', '200']
const scores2 = ['50', '25', '25', '75', '25', '50']
const comments1 = [
  'Great job at question 1!',
  undefined,
  undefined,
  'Great job at question 4!',
  'Good job at question 5!',
  undefined,
]
const comments2 = [
  'This is not correct for question 1...',
  undefined,
  'This is not correct for question 3...',
  undefined,
  undefined,
  'This is not correct for question 6...',
]
const gradingComment1 = 'This is a test grading comment'
const gradingComment2 = undefined

const synchronousActivityName = 'Synchronous Group Activity'
const synchronousActivityDisplayName = synchronousActivityName + ' (Display)'
const synchronousActivityTask = 'Synchronous Group Activity Task Description'
const synchronousActivityStart = `${currentYear + 1}-01-01T02:00`
const synchronousActivityEnd = `${currentYear + 1}-12-31T18:00`
const synchronousActivityClues: {
  type: 'text' | 'number'
  name: string
  displayName: string
  content: string
  unit?: string
}[] = [
  {
    type: 'text',
    name: 'Test Clue 1',
    displayName: 'Test Clue Display Name 1',
    content: 'Test Clue Content 1',
  },
  {
    type: 'number',
    name: 'Test Clue 2',
    displayName: 'Test Clue Display Name 2',
    content: '42',
    unit: 'kg',
  },
  {
    type: 'text',
    name: 'Test Clue 3',
    displayName: 'Test Clue Display Name 3',
    content: 'Content 3',
  },
]

describe('Create and solve a group activity', () => {
  it('Create questions required for microlearning creation', () => {
    cy.loginLecturer()

    // SC question with solution
    cy.createQuestionSC({
      title: SCQuestionTitle,
      content: SCQuestion,
      choices: [{ content: '50%', correct: true }, { content: '100%' }],
      multiplier: messages.manage.sessionForms.multiplier2,
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
      multiplier: messages.manage.sessionForms.multiplier3,
    })

    // FT question
    cy.createQuestionFT({
      title: FTQuestionTitle,
      content: FTQuestion,
      maxLength: '100',
    })

    // CT question
    cy.createContent({
      title: CTQuestionTitle,
      content: CTQuestion,
    })
  })

  it('Create a group activity with the created questions', () => {
    cy.loginLecturer()

    // Step 1: Name
    cy.get('[data-cy="create-group-activity"]').click()
    cy.get('[data-cy="insert-groupactivity-name"]').click().type(activityName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .type(activityDisplayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .type(activityTask)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${testCourse}"]`).click()
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
    cy.get('[data-cy="select-start-date"]').click().type(activityStart)
    cy.get('[data-cy="select-end-date"]').click().type(activityEnd)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Clues
    // 1) Text clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName1)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName1)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .type(clueContent1)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName1).should('exist')
    cy.findByText(clueContent1).should('exist')

    // 2) Numerical clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName2)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName2)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(clueContent2)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(clueUnit2)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName2).should('exist')
    cy.findByText(clueContent2 + ' ' + clueUnit2).should('exist')

    // 3) Numerical clue without unit
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName3)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName3)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(clueContent3)
    )
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName3).should('exist')
    cy.findByText(clueContent3).should('exist')

    // Step 4: Questions / Elements
    const elements = [
      SCQuestionTitle,
      MCQuestionTitle,
      KPRIMQuestionTitle,
      NRQuestionTitle,
      FTQuestionTitle,
    ]
    elements.forEach((title, ix) => {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${title}"]`)
        .contains(title)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
        dataTransfer,
      })
      cy.get(`[data-cy="question-${ix}-stack-0"]`)
        .should('exist')
        .should('contain', title.substring(0, 20))
    })

    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(activityName).should('exist')
  })

  it('Creates a group activity that starts and ends in the future', () => {
    cy.loginLecturer()
    cy.createGroupActivity({
      name: synchronousActivityName,
      displayName: synchronousActivityDisplayName,
      task: synchronousActivityTask,
      courseName: testCourse,
      scheduledStartDate: synchronousActivityStart,
      scheduledEndDate: synchronousActivityEnd,
      clues: synchronousActivityClues,
      stack: {
        elements: [SCQuestionTitle, MCQuestionTitle, KPRIMQuestionTitle],
      },
    })
  })

  it('Publish and unpublish the future group activity', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${activityName}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(`[data-cy="publish-groupActivity-${activityName}"]`).click()
    cy.get('[data-cy="cancel-publish-action"]').click()
    cy.get(`[data-cy="publish-groupActivity-${activityName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${activityName}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
    cy.get(`[data-cy="unpublish-groupActivity-${activityName}"]`).click()
    cy.get(`[data-cy="groupActivity-${activityName}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
  })

  it('Edit the group activity', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="groupActivity-actions-${activityName}"]`).click()
    cy.get(`[data-cy="edit-groupActivity-${activityName}"]`).click()

    // check the name, display name and task description and update them
    cy.get('[data-cy="insert-groupactivity-name"]')
      .click()
      .should('have.value', activityName)
      .clear()
      .type(runningActivityName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .should('have.value', activityDisplayName)
      .clear()
      .type(runningActivityDisplayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .contains(activityTask)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .clear()
      .type(runningActivityTask)
    cy.get('[data-cy="next-or-submit"]').click()

    // fill out the settings of the group activity
    cy.get('[data-cy="select-multiplier"]')
      .should('exist')
      .contains(messages.manage.sessionForms.multiplier2)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier4
    )
    cy.get('[data-cy="select-start-date"]').click().type(runningActivityStart)
    cy.get('[data-cy="select-end-date"]').click().type(runningActivityEnd)
    cy.get('[data-cy="next-or-submit"]').click()

    // check that clues exist and add a new one
    cy.findByText(clueName1).should('exist')
    cy.findByText(clueName2).should('exist')
    cy.findByText(clueName3).should('exist')

    // edit existing clue
    cy.get(`[data-cy="edit-clue-${clueName1}"]`).click()
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .should('have.value', clueName1)
      .clear()
      .type(clueName4)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .should('have.value', clueDisplayName1)
      .clear()
      .type(clueDisplayName4)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .should('have.value', clueContent1)
      .clear()
      .type(clueContent4)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName4).should('exist')
    cy.findByText(clueContent4).should('exist')

    // delete existing clue
    cy.get(`[data-cy="remove-clue-${clueName4}"]`).click()
    cy.findByText(clueName4).should('not.exist')
    cy.findByText(clueContent4).should('not.exist')

    // create a new clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName5)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName5)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(clueContent5)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(clueUnit5)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.get(`[data-cy="groupActivity-clue-${clueName5}"]`).should('exist')
    cy.findByText(clueContent5 + ' ' + clueUnit5).should('exist')

    // add another question to the group activity
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${SCQuestionTitle}"]`)
      .contains(SCQuestionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${CTQuestionTitle}"]`)
      .contains(CTQuestionTitle)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer2,
    })

    // verify that the contained questions are correct
    cy.get(`[data-cy="question-0-stack-0"]`)
      .should('exist')
      .should('contain', SCQuestionTitle.substring(0, 20))
    cy.get(`[data-cy="question-1-stack-0"]`)
      .should('exist')
      .should('contain', MCQuestionTitle.substring(0, 20))
    cy.get(`[data-cy="question-2-stack-0"]`)
      .should('exist')
      .should('contain', KPRIMQuestionTitle.substring(0, 20))
    cy.get(`[data-cy="question-3-stack-0"]`)
      .should('exist')
      .should('contain', NRQuestionTitle.substring(0, 20))
    cy.get(`[data-cy="question-4-stack-0"]`)
      .should('exist')
      .should('contain', FTQuestionTitle.substring(0, 20))
    cy.get(`[data-cy="question-5-stack-0"]`)
      .should('exist')
      .should('contain', SCQuestionTitle.substring(0, 20))
    cy.get(`[data-cy="question-6-stack-0"]`)
      .should('exist')
      .should('contain', CTQuestionTitle.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(runningActivityName).should('exist')
  })

  it('Publish the group activity and check its status', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${runningActivityName}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(`[data-cy="publish-groupActivity-${runningActivityName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${runningActivityName}"]`)
      .findByText(messages.shared.generic.running)
      .should('exist')
  })

  it('Extend the running group activity', () => {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(testCourse).click()

    // open extension modal
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="extend-groupActivity-${runningActivityName}"]`).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="extend-groupActivity-${runningActivityName}"]`).click()

    // change the end date and check if the changes are saved
    cy.get('[data-cy="extend-activity-date"]').click().type(extendedActivityEnd)
    cy.get('[data-cy="extend-activity-confirm"]').click()
    cy.get(`[data-cy="groupActivity-${runningActivityName}"]`).contains(
      extendedActivityEndText
    )

    // check that changing the date to the past does not work
    cy.get(`[data-cy="extend-groupActivity-${runningActivityName}"]`).click()
    cy.get('[data-cy="extend-activity-confirm"]').should('not.be.disabled')
    cy.get('[data-cy="extend-activity-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T12:00`)
    cy.get('[data-cy="extend-activity-confirm"]').should('be.disabled')
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="groupActivity-${runningActivityName}"]`).contains(
      extendedActivityEndText
    )
  })

  it('Check if group messages can be sent', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-message-textarea"]').type(groupMessage1)
    cy.get('[data-cy="group-message-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should('contain', groupMessage1)

    // log into other student in the group and check for the message
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME15') })
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-messages"]').should('contain', groupMessage1)
    cy.get('[data-cy="group-message-textarea"]').type(groupMessage2)
    cy.get('[data-cy="group-message-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should('contain', groupMessage2)

    // log back into the first account and check if both messages are visible
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-messages"]').should('contain', groupMessage1)
    cy.get('[data-cy="group-messages"]').should('contain', groupMessage2)
  })

  function answerGroupActivity() {
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-2-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-4-incorrect"]').click()
    cy.get('[data-cy="input-numerical-4"]').type(numericalAnswer)
    cy.get('[data-cy="free-text-input-5"]').click().type(freeTextAnswer)
    cy.get('[data-cy="sc-6-answer-option-1"]').click()
    cy.get('[data-cy="submit-group-activity"]').click()
  }

  function checkInputsDisabled() {
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-4-incorrect"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-4"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-5"]').should('be.disabled')
    cy.get('[data-cy="sc-6-answer-option-1"]').should('be.disabled')
  }

  function checkPersistentAnswers() {
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('be.disabled')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-4"]')
      .should('be.disabled')
      .should('have.value', numericalAnswer)

    cy.get('[data-cy="free-text-input-5"]')
      .should('be.disabled')
      .contains(freeTextAnswer)

    cy.get('[data-cy="sc-6-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-6-answer-option-2"]').should('be.disabled')
  }

  it('Take part in the group activity', function () {
    cy.loginStudent()

    // start the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
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
    cy.get('[data-cy="flag-element-textarea"]').type(flaggingText)
    cy.get('[data-cy="cancel-flag-element"]').click()
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(flaggingText)
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      flaggingText
    )
    cy.get('[data-cy="flag-element-textarea"]').clear().type(flaggingTextNew)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      flaggingTextNew
    )
    cy.get('[data-cy="cancel-flag-element"]').click()

    // answer the questions in the group activity
    answerGroupActivity()

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswers()

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    checkPersistentAnswers()
  })

  it('Login as the second group member and verify that submission was successful', () => {
    cy.loginStudent()

    // open the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
    ).click()

    // check that the same answers are visible to the second student
    checkPersistentAnswers()
  })

  it('Solve the group activity as a second student', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME5') })

    // start the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // answer the questions in the group activity
    answerGroupActivity()

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswers()

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    checkPersistentAnswers()
  })

  it('Login as a student in a second group and start the group activity', () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // open the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
  })

  it('End the running group activity through the corresponding action on the lecturer interface', () => {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(testCourse).click()

    // end the group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="groupActivity-actions-${runningActivityName}"]`).click()
    cy.get(`[data-cy="end-group-activity-${runningActivityName}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="activity-confirmation-modal-cancel"]').click()
    cy.get(`[data-cy="groupActivity-actions-${runningActivityName}"]`).click()
    cy.get(`[data-cy="end-group-activity-${runningActivityName}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="activity-confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(`[data-cy="groupActivity-${runningActivityName}"]`).findByText(
      messages.shared.generic.grading
    )
  })

  it('Verify that a valid submission is still visible after the group activity ended', () => {
    cy.loginStudent()

    // open the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${runningActivityDisplayName}"]`).contains(
      messages.pwa.groupActivity.submitted
    )
    cy.get(`[data-cy="open-submission-${runningActivityDisplayName}"]`).click()

    // check that the same answers are visible to the student
    checkInputsDisabled()
    checkPersistentAnswers()
    cy.get('[data-cy="submit-group-activity"]').should('not.exist')
  })

  it("Verify that a started group activity can still be seen, but not submitted after it's ended", () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // open the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${runningActivityDisplayName}"]`).contains(
      messages.pwa.groupActivity.past
    )
    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
    ).click()

    // submission should not be possible and inputs should be disabled
    checkInputsDisabled()
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it("Verify that a group activity can't be started after it's ended", () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME3') })

    // open the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it('Create the submissions to the group activity', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="grade-groupActivity-${runningActivityName}"]`).click()

    // grade the responses for the first submission
    cy.get('[data-cy="group-activity-submission-0"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
    scores1.forEach((score, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`)
        .click()
        .type(score)
      if (comments1[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .type(comments1[ix])
      }

      cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
        'be.disabled'
      )
    })

    if (typeof gradingComment1 !== 'undefined') {
      cy.get('[data-cy="groupActivity-general-grading-comment"]')
        .realClick()
        .type(gradingComment1)
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
    scores1.forEach((score, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'have.value',
        score
      )
      if (comments1[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .contains(comments1[ix])
      }
    })

    // grade the responses for the second submission
    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.get('[data-cy="confirm-submission-switch"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')

    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
    scores2.forEach((score, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`)
        .click()
        .type(score)
      if (comments2[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .type(comments2[ix])
      }
      cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
        'be.disabled'
      )
    })

    if (typeof gradingComment2 !== 'undefined') {
      cy.get('[data-cy="groupActivity-general-grading-comment"]')
        .realClick()
        .type(gradingComment2)
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
    scores1.forEach((score, ix) => {
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
    scores2.forEach((score, ix) => {
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

  function checkGradingVisualization(
    scores: string[],
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
    scores.forEach((score, ix) => {
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

    if (typeof gradingComment !== 'undefined') {
      cy.get('[data-cy="group-activity-results-comment"]').should(
        'contain',
        gradingComment
      )
    }
  }

  it('Verify that the student of the group with passing results can see the evaluation', () => {
    cy.loginStudent()

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${runningActivityDisplayName}"]`).should(
      'contain',
      messages.shared.generic.passed
    )

    cy.get(`[data-cy="open-feedback-${runningActivityDisplayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(scores1, comments1, gradingComment1)
  })

  it('Verify that the second student of the first group can see the same results', () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME15') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${runningActivityDisplayName}"]`).should(
      'contain',
      messages.shared.generic.passed
    )

    cy.get(`[data-cy="open-feedback-${runningActivityDisplayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(scores1, comments1, gradingComment1)
  })

  it('Verify that the student of the group with failing results can see the evaluation', () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME5') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${runningActivityDisplayName}"]`).should(
      'contain',
      messages.shared.generic.failed
    )

    cy.get(`[data-cy="open-feedback-${runningActivityDisplayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityFailed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(scores2, comments2, gradingComment2)
  })

  it("Verify that groups that have not attempted to submit anything to the group activity can't see any results", () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${runningActivityDisplayName}"]`).should(
      'contain',
      messages.pwa.groupActivity.past
    )

    cy.get(
      `[data-cy="open-group-activity-${runningActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it('Publish the synchronous group activity', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${synchronousActivityName}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${synchronousActivityName}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${synchronousActivityName}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
  })

  it('Login as a student and check that the group activity is not visible', () => {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${synchronousActivityDisplayName}"]`
    ).should('not.exist')
  })

  it('Start the synchronous group activity', () => {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${synchronousActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="start-group-activity-${synchronousActivityName}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="activity-confirmation-modal-cancel"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${synchronousActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="start-group-activity-${synchronousActivityName}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="activity-confirmation-modal-confirm"]').click()
  })

  it('Login as a student and solve the group activity', () => {
    cy.loginStudent()

    // start the group activity
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${synchronousActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // answer the questions
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="submit-group-activity"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-2-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-4-incorrect"]').click()
    cy.get('[data-cy="submit-group-activity"]').click()
    cy.wait(2000)
  })

  it('Login as a student and start the synchronous group activity', () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${synchronousActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
  })

  it('End the synchronous group activity', () => {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(testCourse).click()

    // end the group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${synchronousActivityName}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${synchronousActivityName}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="activity-confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(`[data-cy="groupActivity-${synchronousActivityName}"]`).findByText(
      messages.shared.generic.grading
    )
  })

  it('Login as a student with a valid submission', () => {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-submission-${synchronousActivityDisplayName}"]`
    ).click()

    // check that the inputs are disabled
    cy.get('[data-cy="sc-1-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-4-incorrect"]').should('be.disabled')
  })

  it('Login as a second student and check that the group activity cannot be started anymore', () => {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${testCourse}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${synchronousActivityDisplayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
  })

  it('Cleanup: Delete all the created group activities', () => {
    cy.loginLecturer()

    // delete the created group activities
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${testCourse}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="groupActivity-actions-${runningActivityName}"]`).click()
    cy.get(`[data-cy="delete-groupActivity-${runningActivityName}"]`).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(`[data-cy="groupActivity-actions-${runningActivityName}"]`).should(
      'not.exist'
    )

    cy.get(
      `[data-cy="groupActivity-actions-${synchronousActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="delete-groupActivity-${synchronousActivityName}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="groupActivity-actions-${synchronousActivityName}"]`
    ).should('not.exist')
  })
})
