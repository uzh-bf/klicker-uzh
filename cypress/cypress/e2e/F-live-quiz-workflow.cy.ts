import messages from '../../../packages/i18n/messages/en'

// questions used in live quiz workflows, including a question with and without sample solution for each supported type
const SCQuestion1Title = 'SC Title LQ Test 1'
const SCQuestion1Content = 'SC Question Content 1'
const SCQuestion1Choices = [{ content: '50%' }, { content: '100%' }]
const SCQuestion2Title = 'SC Title LQ Test 2'
const SCQuestion2Content = 'SC Question Content 2'
const SCQuestion2Choices = [
  { content: '50%', correct: true },
  { content: '100%' },
]

const MCQuestion1Title = 'MC Title LQ Test 1'
const MCQuestion1Content = 'MC Question Content 1'
const MCQuestion1Choices = [
  { content: '25%' },
  { content: '50%' },
  { content: '75%' },
  { content: '100%' },
]
const MCQuestion2Title = 'MC Title LQ Test 2'
const MCQuestion2Content = 'MC Question Content 2'
const MCQuestion2Choices = [
  { content: '25%', correct: false },
  { content: '50%', correct: true },
  { content: '75%' },
  { content: '100%' },
]

const KPRIMQuestion1Title = 'KPRIM Title LQ Test 1'
const KPRIMQuestion1Content = 'KPRIM Question Content 1'
const KPRIMQuestion1Choices = [
  { content: '10%' },
  { content: '50%' },
  { content: '80%' },
  { content: '100%' },
]
const KPRIMQuestion2Title = 'KPRIM Title LQ Test 2'
const KPRIMQuestion2Content = 'KPRIM Question Content 2'
const KPRIMQuestion2Choices = [
  { content: '10%', correct: false },
  { content: '50%', correct: true },
  { content: '80%' },
  { content: '100%' },
]

const NRQuestion1Title = 'NR Title LQ Test 1'
const NRQuestion1Content = 'NR Question Content 1'
const NRQuestion1Options = {}
const NRQuestion2Title = 'NR Title LQ Test 2'
const NRQuestion2Content = 'NR Question Content 2'
const NRQuestion2Options = {
  min: '0',
  max: '100',
  unit: '%',
  accuracy: '2',
  solutionRanges: [
    { min: '0', max: '25' },
    { min: '75', max: '100' },
  ],
}
const NRAnswer1 = '50'
const NRAnswer2 = '100'

const FTQuestion1Title = 'FT Title LQ Test 1'
const FTQuestion1Content = 'FT Question Content 1'
const FTQuestion1Options = {}
const FTQuestion2Title = 'FT Title LQ Test 2'
const FTQuestion2Content = 'FT Question Content 2'
const FTQuestion2Options = {
  maxLength: '100',
  solutions: ['Solution 1', 'Solution 2'],
}
const FTAnswer1 = 'Solution 1'
const FTAnswer2 = 'Answer 2'

// global variables to change live quiz settings
const quizName1 = 'Live Quiz 1'
const quizDisplayName1 = 'Live Quiz 1 (Display)'
const quizDescription1 = 'Live Quiz 1 Description'
const quizName1New = quizName1 + ' NEW'
const quizDisplayName1New = quizDisplayName1 + ' NEW'
const quizDescription1New = quizDescription1 + ' NEW'
const quizName1Dupl = quizName1New + ' (Copy)'
const quizName2 = 'Live Quiz 2'
const quizDisplayName2 = 'Live Quiz 2 (Display)'
const quizDescription2 = 'Live Quiz 2 Description'
const courseGamified = 'Testkurs'
const courseNonGamified = 'Non-Gamified Course'

const feedbackDesktop = 'Feedback Desktop'
const feedbackDesktop2 = 'Feedback Desktop 2'
const feedbackMobile = 'Feedback Mobile'
const feedbackResponse = 'Response to Feedback'
const defaultPoints = 50
const defaultCorrectPoints = 100
const maxBonusPoints = 200
const timeToZeroBonus = 100

describe('Different live-quiz workflows', () => {
  // ! Part 0: Preparation
  it('Create the questions required in the live quiz test workflows', () => {
    cy.loginLecturer()
    cy.createQuestionSC({
      title: SCQuestion1Title,
      content: SCQuestion1Content,
      choices: SCQuestion1Choices,
    })
    cy.createQuestionSC({
      title: SCQuestion2Title,
      content: SCQuestion2Content,
      choices: SCQuestion2Choices,
    })

    cy.createQuestionMC({
      title: MCQuestion1Title,
      content: MCQuestion1Content,
      choices: MCQuestion1Choices,
    })
    cy.createQuestionMC({
      title: MCQuestion2Title,
      content: MCQuestion2Content,
      choices: MCQuestion2Choices,
    })

    cy.createQuestionKPRIM({
      title: KPRIMQuestion1Title,
      content: KPRIMQuestion1Content,
      choices: KPRIMQuestion1Choices,
    })
    cy.createQuestionKPRIM({
      title: KPRIMQuestion2Title,
      content: KPRIMQuestion2Content,
      choices: KPRIMQuestion2Choices,
    })

    cy.createQuestionNR({
      title: NRQuestion1Title,
      content: NRQuestion1Content,
      ...NRQuestion1Options,
    })
    cy.createQuestionNR({
      title: NRQuestion2Title,
      content: NRQuestion2Content,
      ...NRQuestion2Options,
    })

    cy.createQuestionFT({
      title: FTQuestion1Title,
      content: FTQuestion1Content,
      ...FTQuestion1Options,
    })
    cy.createQuestionFT({
      title: FTQuestion2Title,
      content: FTQuestion2Content,
      ...FTQuestion2Options,
    })
  })

  // ! Part 1: Live Quiz Creation
  it('Test adding and deleting blocks to a live quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="cancel-activity-creation"]').click()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type('TEMP')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type('TEMP DISPLAY')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
    cy.get('[data-cy="drop-elements-add-block"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 2)
    cy.get('[data-cy="delete-block-1"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
  })

  it('Create a live quiz with two questions and test all settings', () => {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(quizName1)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(quizDisplayName1)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .type(quizDescription1)
    cy.get('[data-cy="insert-live-description"]').contains(quizDescription1)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // course settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.activityWizard.liveQuizNoCourse)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseGamified}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseNonGamified}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseNonGamified)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseGamified}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseGamified)

    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-default-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-default-points"]').click().type('-10') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-default-points"]').should('have.value', '10')
    cy.get('[data-cy="live-quiz-default-points"]')
      .click()
      .clear()
      .type(String(defaultPoints))
    cy.get('[data-cy="live-quiz-default-points"]').should(
      'have.value',
      String(defaultPoints)
    )
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-default-correct-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-default-correct-points"]').click().type('-20') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      '20'
    )
    cy.get('[data-cy="live-quiz-default-correct-points"]')
      .click()
      .clear()
      .type(String(defaultCorrectPoints))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-max-bonus-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-max-bonus-points"]').click().type('-30') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should('have.value', '30')
    cy.get('[data-cy="live-quiz-max-bonus-points"]')
      .click()
      .clear()
      .type(String(maxBonusPoints))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').click().type('-40') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should(
      'have.value',
      '40'
    )
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]')
      .click()
      .clear()
      .type(String(timeToZeroBonus))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()

    cy.get('[data-cy="select-multiplier"]').should('exist')
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

    // toggle settings
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-feedback-enabled"]').click()
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )

    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').click()
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )

    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // add two questions in separate blocks, move blocks and add time limit of 10 for first and 20 for second block
    cy.createStacks({
      stacks: [
        { elements: [SCQuestion1Title] },
        { elements: [SCQuestion2Title] },
      ],
      type: 'block',
    })

    // test sorting of blocks
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', SCQuestion2Title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', SCQuestion1Title.substring(0, 20))
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', SCQuestion1Title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', SCQuestion2Title.substring(0, 20))

    // add time limits
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').type('10')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').type('20')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="close-block-settings"]').click()

    // switch questions and check if settings persist
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Edit the created live quiz and check if all settings persist', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()

    cy.contains('[data-cy="live-quiz-block"]', quizName1)
    cy.get(`[data-cy="edit-live-quiz-${quizName1}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should('have.value', quizName1)
    cy.get('[data-cy="insert-live-quiz-name"]').clear().type(quizName1New)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      quizDisplayName1
    )
    cy.get('[data-cy="insert-live-display-name"]')
      .clear()
      .type(quizDisplayName1New)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(quizDescription1)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .clear()
      .type(quizDescription1New)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(quizDescription1New)
    cy.get('[data-cy="next-or-submit"]').click()

    // check settings and modify them
    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
    cy.get('[data-cy="live-quiz-default-points"]').should(
      'have.value',
      defaultPoints
    )
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      defaultCorrectPoints
    )
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should(
      'have.value',
      maxBonusPoints
    )
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should(
      'have.value',
      timeToZeroBonus
    )
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )

    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.activityWizard.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
    cy.get('[data-cy="set-feedback-enabled"]').click()
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // check questions and modify them
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', SCQuestion1Title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', SCQuestion2Title.substring(0, 20))
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '10')
    cy.get('[data-cy="block-time-limit"]').clear().type('15')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '15')
    cy.get('[data-cy="close-block-settings"]').click()

    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '20')
    cy.get('[data-cy="block-time-limit"]').clear().type('25')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '25')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', SCQuestion2Title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', SCQuestion1Title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    //  start editing again and check if correct values were saved
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.contains('[data-cy="live-quiz-block"]', quizName1New)
    cy.get(`[data-cy="edit-live-quiz-${quizName1New}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      quizName1New
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      quizDisplayName1New
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(quizDescription1New)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="set-feedback-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-enabled"]').should(
      'not.have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'data-state',
      'unchecked'
    )
    cy.get('[data-cy="set-liveqa-moderation"]').should(
      'have.attr',
      'disabled',
      'disabled'
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', SCQuestion2Title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', SCQuestion1Title.substring(0, 20))
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '25')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '15')
    cy.get('[data-cy="close-block-settings"]').click()
  })

  it('Duplicate the live quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.contains('[data-cy="live-quiz-block"]', quizName1New)

    // duplicate the live quiz and verify that the content is the same as for the original live quiz
    cy.get(`[data-cy="duplicate-live-quiz-${quizName1New}"]`).click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      quizName1Dupl
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      quizDisplayName1New
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(quizDescription1New)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', SCQuestion2Title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', SCQuestion1Title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.contains('[data-cy="live-quiz-block"]', quizName1Dupl)
  })

  it('Cleanup: Delete the duplicated live quiz', () => {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()
    cy.findByText(quizName1Dupl).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${quizName1Dupl}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(`[data-cy="delete-live-quiz-${quizName1Dupl}"]`).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(quizName1Dupl).should('not.exist')
  })

  // ! Part 2: Live Quiz Control
  it('Start the created live quizzes, abort it, and restart & completes it', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.contains('[data-cy="live-quiz-block"]', quizName1New)

    // start live quiz and then abort it
    cy.get(`[data-cy="start-live-quiz-${quizName1New}"]`).click()
    cy.get('[data-cy="abort-live-quiz-cockpit"]').click()
    cy.get('[data-cy="abort-cancel-live-quiz"]').click()
    cy.get('[data-cy="abort-live-quiz-cockpit"]').click()
    cy.get('[data-cy="lq-deletion-responses-confirm"]').should('not.exist')
    cy.get('[data-cy="lq-deletion-feedbacks-confirm"]').should('not.exist')
    cy.get('[data-cy="lq-deletion-confusion-feedbacks-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="lq-deletion-leaderboard-entries-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="confirm-cancel-live-quiz"]')
      .should('not.be.disabled')
      .click()

    // start live quiz and then skip through the blocks
    cy.get(`[data-cy="start-live-quiz-${quizName1New}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Cleanup: Delete the created and completed live quiz', () => {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()

    cy.findByText(quizName1New).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${quizName1New}"]`).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist') // ? azure functions do not work in cypress CI actions
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(quizName1New).should('not.exist')
  })

  // ! Part 3: Full Live Quiz Execution Cycle
  it('Create and start a live quiz with all question types (with and without sample solution) to test the entire execution cycle', () => {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-live-quiz-name"]').type(quizName2)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-live-display-name"]').type(quizDisplayName2)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .type(quizDescription2)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(quizDescription2)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.activityWizard.liveQuizNoCourse)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseGamified}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseNonGamified}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseNonGamified)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseGamified}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="select-multiplier"]').should('exist')
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
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Questions
    cy.createStacks({
      stacks: [
        {
          elements: [
            SCQuestion1Title,
            MCQuestion1Title,
            KPRIMQuestion1Title,
            NRQuestion1Title,
            FTQuestion1Title,
          ],
        },
        {
          elements: [
            SCQuestion2Title,
            MCQuestion2Title,
            KPRIMQuestion2Title,
            NRQuestion2Title,
            FTQuestion2Title,
          ],
        },
      ],
      type: 'block',
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="live-quiz"]').contains(quizName2)

    // start live quiz and first block
    cy.get(`[data-cy="start-live-quiz-${quizName2}"]`).click()
    cy.wait(1000)
  })

  it('Check that the live quiz description is correctly shown to students', () => {
    // check if live quiz description is shown to students on desktop view
    cy.loginStudent()
    cy.findByText(quizDisplayName2).click()
    cy.get('[data-cy="live-quiz-description"]').contains(quizDisplayName2)
    cy.get('[data-cy="live-quiz-description"]').contains(quizDescription2)

    // check if the description is also shown correctly on mobile view
    cy.viewport('iphone-x')
    cy.get('[data-cy="live-quiz-description"]').contains(quizDisplayName2)
    cy.get('[data-cy="live-quiz-description"]').contains(quizDescription2)
  })

  it('Start the first block of the live quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Responds to the first block of the running live quiz from the student view', () => {
    // login student and answer first question
    cy.loginStudent()
    cy.findByText(quizDisplayName2).click()
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-1"]').click()
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-4-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // provide feedback while moderation is enabled
    cy.get('[data-cy="feedback-input"]').click().type(feedbackDesktop)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedbackDesktop).should('not.exist')
    cy.wait(500)
  })

  it('Test the live quiz functionalities on mobile devices', () => {
    // login student again on mobile, test navigation and answer second question
    cy.viewport('iphone-x')
    cy.loginStudent()
    cy.findByText(quizDisplayName2).click()
    cy.findByText(NRQuestion1Content).should('exist')

    cy.get('[data-cy="mobile-menu-leaderboard"]').click()
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="mobile-menu-questions"]').click()
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-4"]').clear().type(NRAnswer1)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-5"]').type(FTAnswer1)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // provide feedback while moderation is enabled
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="feedback-input"]').click().type(feedbackMobile)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedbackDesktop).should('not.exist')
    cy.findByText(feedbackMobile).should('not.exist')
    cy.wait(500)
  })

  it('Start the second block of the live quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Make feedbacks visible, respond to one and disable moderation', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)

    // make both feedbacks visible and respond to one of them (moderation enabled)
    cy.get(`[data-cy="publish-feedback-${feedbackDesktop}"]`).click()
    cy.get(`[data-cy="publish-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedbackDesktop}"]`).click()
    cy.get(`[data-cy="respond-to-feedback-${feedbackDesktop}"]`)
      .click()
      .type(feedbackResponse)
    cy.get(`[data-cy="submit-feedback-response-${feedbackDesktop}"]`).click()

    // pin and unpin feedback
    cy.get(`[data-cy="open-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="pin-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="pin-feedback-${feedbackMobile}"]`).click()

    // disable moderation
    cy.get('[data-cy="toggle-moderation"]').click()
  })

  it('Student answers questions in second block', () => {
    cy.loginStudent()
    cy.findByText(quizDisplayName2).click()
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="mc-2-answer-option-1"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-4-correct"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="input-numerical-4"]').clear().type(NRAnswer2)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="free-text-input-5"]').type(FTAnswer2)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
  })

  it('Verify that the feedbacks and the given feedback answer are visible to the student', () => {
    cy.loginStudent()
    cy.findByText(quizDisplayName2).click()

    // check that feedbacks are now visible and upvote them
    cy.findByText(feedbackDesktop).should('exist')
    cy.findByText(feedbackMobile).should('exist')
    cy.findByText(feedbackResponse).should('exist')
    cy.get(`[data-cy="feedback-upvote-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="feedback-response-upvote-${feedbackResponse}"]`).click()

    // add another feedback, which should be immediately visible (no moderation)
    cy.get('[data-cy="feedback-input"]').click().type(feedbackDesktop2)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedbackDesktop2).should('exist')
    cy.wait(500)
  })

  it('Check out the public evaluation links accessible through the embedding modal', () => {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)

    // read required public evaluation links
    cy.get('[data-cy="embed-evaluation-cockpit"]').click()
    cy.get('[data-cy="open-embedding-link-generic-evaluation"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkEvaluation')
      })
    cy.get('[data-cy="open-embedding-link-question-0"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkQuestion0')
      })
    cy.get('[data-cy="open-embedding-link-question-7"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkQuestion7')
      })
    cy.get('[data-cy="open-embedding-link-leaderboard"]')
      .invoke('text')
      .then((text) => {
        cy.wrap(text).as('publicLinkLeaderboard')
      })

    // log out as a lecturer
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.wait(500)
    cy.reload()
    cy.get('button[data-cy="tos-checkbox"]').should('exist')

    // check out generic evaluation
    cy.get('@publicLinkEvaluation').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(SCQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(MCQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(SCQuestion1Content).should('exist')

    // check out specific question evaluation
    cy.get('@publicLinkQuestion0').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(SCQuestion1Content).should('exist')
    cy.get('@publicLinkQuestion7').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(KPRIMQuestion2Content).should('exist')

    // check out leaderboard
    cy.get('@publicLinkLeaderboard').then((link) => {
      cy.visit(String(link))
    })
  })

  it('Check out evaluation view of live quiz and its content', () => {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.visit(`${Cypress.env('URL_MANAGE')}/quizzes/${quizId}/evaluation`)
    })

    // check content of evaluation view
    cy.findByText(SCQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(MCQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(SCQuestion1Content).should('exist')

    // test instance navigation
    cy.get('[data-cy="evaluate-question-select"]')
      .should('exist')
      .contains(SCQuestion1Title)
    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${KPRIMQuestion1Title}"]`
    ).click()
    cy.get('[data-cy="evaluate-question-select"]').contains(KPRIMQuestion1Title)
    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(`[data-cy="evaluation-select-instance-${SCQuestion1Title}"]`).click()
    cy.get('[data-cy="evaluate-question-select"]').contains(SCQuestion1Title)

    // navigate forwards and backwards through all questions
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(KPRIMQuestion1Title).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(NRQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(FTQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(SCQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(MCQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(KPRIMQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(NRQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(FTQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(NRQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(SCQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(FTQuestion1Content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(MCQuestion1Title).should('exist')

    // test navigation through blocks
    cy.get('[data-cy="evaluate-stack-1"]').click()
    cy.findByText(SCQuestion2Content).should('exist')
    cy.get('[data-cy="evaluate-stack-0"]').click()
    cy.findByText(SCQuestion1Title).should('exist')
    cy.get('[data-cy="evaluate-stack-1"]').click()
    cy.findByText(SCQuestion2Content).should('exist')
  })

  it('Close block and delete feedback / feedback response', () => {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()

    // delete feedback mobile and response to desktop feedback
    cy.get(`[data-cy="delete-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="delete-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedbackDesktop}"]`).click()
    cy.get(`[data-cy="delete-response-${feedbackResponse}"]`).click()
  })

  it('Check that the deleted feedbacks are not visible anymore', () => {
    cy.loginStudent()
    cy.findByText(quizDisplayName2).click()
    cy.findByText(feedbackDesktop).should('exist')
    cy.findByText(feedbackDesktop2).should('exist')
    cy.findByText(feedbackMobile).should('not.exist')
    cy.findByText(feedbackResponse).should('not.exist')
  })

  it('End live quiz on lecturer cockpit', () => {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(`[data-cy="live-quiz-cockpit-${quizName2}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Cleanup: Delete the live quiz used for the full cycle test', () => {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()

    cy.findByText(quizName2).should('exist')
    cy.get(`[data-cy="delete-live-quiz-${quizName2}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist') // ? azure functions do not work in cypress CI actions
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).click()
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'not.be.disabled'
    )
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(`[data-cy="delete-live-quiz-${quizName2}"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(quizName2).should('not.exist')
  })

  it('Cleanup: Delete the created questions from the question pool for repeated test execution', () => {
    cy.loginLecturer()

    const questions = [
      SCQuestion1Title,
      MCQuestion1Title,
      KPRIMQuestion1Title,
      NRQuestion1Title,
      FTQuestion1Title,
      SCQuestion2Title,
      MCQuestion2Title,
      KPRIMQuestion2Title,
      NRQuestion2Title,
      FTQuestion2Title,
    ]
    questions.forEach((question) => {
      cy.get(`[data-cy="element-item-${question}"]`).should('exist')
      cy.get(`[data-cy="delete-question-${question}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${question}"]`).should('not.exist')
    })
  })
})
