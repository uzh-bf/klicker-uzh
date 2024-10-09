import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

// global variables to change live quiz settings
const questionTitle1 = 'Title ' + uuid()
const questionContent1 = 'Question Content 1'
const questionTitle2 = 'Title ' + uuid()
const questionContent2 = 'Question Content 2'

const sessionName1 = 'Session 1'
const sessionDisplayName1 = 'Session 1 (Display)'
const sessionDescription1 = 'Session 1 Description'
const sessionName1New = sessionName1 + ' NEW'
const sessionDisplayName1New = sessionDisplayName1 + ' NEW'
const sessionDescription1New = sessionDescription1 + ' NEW'
const sessionName1Dupl = sessionName1New + ' (Copy)'
const sessionName2 = 'Session 2'
const sessionDisplayName2 = 'Session 2 (Display)'
const courseGamified = 'Testkurs'
const courseNonGamified = 'Non-Gamified Course'

const feedbackDesktop = 'Feedback Desktop'
const feedbackDesktop2 = 'Feedback Desktop 2'
const feedbackMobile = 'Feedback Mobile'
const feedbackResponse = 'Response to Feedback'
const maxBonusPoints = 200
const timeToZeroBonus = 100

describe('Different live-quiz workflows', () => {
  it('Test adding and deleting blocks to a live quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type('TEMP')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type('TEMP DISPLAY')
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
    cy.get('[data-cy="add-block"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 2)
    cy.get('[data-cy="delete-block-1"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
  })

  it('Create a live quiz with two questions and test all settings', () => {
    cy.loginLecturer()
    cy.createQuestionSC({
      title: questionTitle1,
      content: questionContent1,
      choices: [{ content: '50%' }, { content: '100%' }],
    })
    cy.createQuestionSC({
      title: questionTitle2,
      content: questionContent2,
      choices: [{ content: '50%' }, { content: '100%' }],
    })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName1)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(sessionDisplayName1)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .type(sessionDescription1)
    cy.get('[data-cy="insert-live-description"]').contains(sessionDescription1)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // course settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
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
    cy.get('[data-cy="live-quiz-max-bonus-points"]')
      .click()
      .clear()
      .type(String(maxBonusPoints))
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]')
      .click()
      .clear()
      .type(String(timeToZeroBonus))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()

    cy.get('[data-cy="select-multiplier"]').should('exist')
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

    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // add two questions in separate blocks, move blocks and add time limit of 10 for first and 20 for second block
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle1}"]`)
      .contains(questionTitle1)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get(`[data-cy="question-item-${questionTitle2}"]`)
      .contains(questionTitle2)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="add-block"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))

    // test sorting of blocks
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))

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
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
  })

  it('Edit the created session and check if all settings persist', () => {
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()

    cy.contains('[data-cy="session-block"]', sessionName1)
    cy.get(`[data-cy="edit-session-${sessionName1}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      sessionName1
    )
    cy.get('[data-cy="insert-live-quiz-name"]').clear().type(sessionName1New)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      sessionDisplayName1
    )
    cy.get('[data-cy="insert-live-display-name"]')
      .clear()
      .type(sessionDisplayName1New)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(sessionDescription1)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .clear()
      .type(sessionDescription1New)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(sessionDescription1New)
    cy.get('[data-cy="next-or-submit"]').click()

    // check settings and modify them
    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
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
      messages.manage.sessionForms.multiplier2
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
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier4}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier4
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
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
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
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    //  start editing again and check if correct values were saved
    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName1New)
    cy.get(`[data-cy="edit-session-${sessionName1New}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      sessionName1New
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      sessionDisplayName1New
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(sessionDescription1New)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]').contains(courseGamified)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier4
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

    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '25')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '15')
    cy.get('[data-cy="close-block-settings"]').click()
  })

  it('Duplicate the live quiz', () => {
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.contains('[data-cy="session-block"]', sessionName1New)

    // duplicate the session and verify that the content is the same as for the original session
    cy.get(`[data-cy="duplicate-session-${sessionName1New}"]`).click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      sessionName1Dupl
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      sessionDisplayName1New
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(sessionDescription1New)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle1.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName1Dupl)
  })

  it('Start the created live quizzes, abort it, and restart & completes it', () => {
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.contains('[data-cy="session-block"]', sessionName1New)

    // start session and then abort it
    cy.get(`[data-cy="start-session-${sessionName1New}"]`).click()
    cy.get('[data-cy="abort-session-cockpit"]').click()
    cy.get('[data-cy="abort-cancel-session"]').click()
    cy.get('[data-cy="abort-session-cockpit"]').click()
    cy.get('[data-cy="lq-deletion-responses-confirm"]').should('not.exist')
    cy.get('[data-cy="lq-deletion-feedbacks-confirm"]').should('not.exist')
    cy.get('[data-cy="lq-deletion-confusion-feedbacks-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="lq-deletion-leaderboard-entries-confirm"]').should(
      'not.exist'
    )
    cy.get('[data-cy="confirm-cancel-session"]')
      .should('not.be.disabled')
      .click()

    // start session and then skip through the blocks
    cy.get(`[data-cy="start-session-${sessionName1New}"]`).click()
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

  it('Create and start a live quiz to test the entire execution cycle', () => {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName2)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-live-display-name"]').type(sessionDisplayName2)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
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
      .contains(messages.manage.sessionForms.multiplier1)
    cy.get('[data-cy="select-multiplier"]').click()
    cy.get(
      `[data-cy="select-multiplier-${messages.manage.sessionForms.multiplier2}"]`
    ).click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.sessionForms.multiplier2
    )
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // TODO: replace this with cy.createStacks function after migration to element stacks
    // Step 4: Questions
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle1}"]`)
        .contains(questionTitle1)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here-0"]').trigger('drop', {
        dataTransfer,
      })
    }

    cy.get('[data-cy="add-block"]').click()
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle2}"]`)
        .contains(questionTitle2)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here-1"]').trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="session"]').contains(sessionName2)

    // start session and first block
    cy.get(`[data-cy="start-session-${sessionName2}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Responds to the first block of the running session from the student view', () => {
    // login student and answer first question
    cy.loginStudent()
    cy.findByText(sessionDisplayName2).click()
    cy.get('[data-cy="sc-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // provide feedback while moderation is enabled
    cy.get('[data-cy="feedback-input"]').click().type(feedbackDesktop)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedbackDesktop).should('not.exist')
    cy.wait(500)

    // login student again on mobile, test navigation and answer second question
    cy.viewport('iphone-x')
    cy.loginStudent()
    cy.findByText(sessionDisplayName2).click()
    cy.findByText(questionContent1).should('exist')

    cy.get('[data-cy="mobile-menu-leaderboard"]').click()
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="mobile-menu-questions"]').click()
    cy.get('[data-cy="sc-answer-option-1"]').click()
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
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName2}"]`).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

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
    cy.findByText(sessionDisplayName2).click()
    cy.get('[data-cy="sc-answer-option-0"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="sc-answer-option-1"]').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

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

  it('Close block and delete feedback / feedback response', () => {
    cy.loginLecturer()

    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName2}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()

    // delete feedback mobile and response to desktop feedback
    cy.get(`[data-cy="delete-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="delete-feedback-${feedbackMobile}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedbackDesktop}"]`).click()
    cy.get(`[data-cy="delete-response-${feedbackResponse}"]`).click()
    cy.get(`[data-cy="delete-response-${feedbackResponse}"]`).click()
  })

  it('Check that the deleted feedbacks are not visible anymore', () => {
    cy.loginStudent()
    cy.findByText(sessionDisplayName2).click()

    cy.findByText(feedbackDesktop).should('exist')
    cy.findByText(feedbackDesktop2).should('exist')
    cy.findByText(feedbackMobile).should('not.exist')
    cy.findByText(feedbackResponse).should('not.exist')
  })

  it('End session on lecturer cockpit', () => {
    cy.loginLecturer()

    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName2}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('Cleanup: Delete all created live quizzes', () => {
    cy.loginLecturer()
    cy.get(`[data-cy="sessions"]`).click()

    cy.findByText(sessionName1New).should('exist')
    cy.get(`[data-cy="delete-past-session-${sessionName1New}"]`).click()
    cy.get(`[data-cy="cancel-delete-live-quiz"]`).click()
    cy.get(`[data-cy="delete-past-session-${sessionName1New}"]`).click()
    cy.get(`[data-cy="confirm-delete-live-quiz"]`).click()
    cy.findByText(sessionName1New).should('not.exist')

    cy.findByText(sessionName1Dupl).should('exist')
    cy.get(`[data-cy="delete-session-${sessionName1Dupl}"]`).click()
    cy.get(`[data-cy="confirm-delete-live-quiz"]`).click()
    cy.findByText(sessionName1Dupl).should('not.exist')

    cy.findByText(sessionName2).should('exist')
    cy.get(`[data-cy="delete-past-session-${sessionName2}"]`).click()
    cy.get(`[data-cy="confirm-delete-live-quiz"]`).click()
    cy.findByText(sessionName2).should('not.exist')
  })
})
