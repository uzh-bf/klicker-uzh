import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

describe('Different live-quiz workflows', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('adds and then deletes a second question block', () => {
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="cancel-session-creation"]').click()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
    cy.get('[data-cy="add-block"]').click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 2)
    cy.get('[data-cy="delete-block"]').eq(1).click()
    cy.get('[data-cy="block-container-header"]').should('have.length', 1)
  })

  it('creates a session with two questions and edits it', () => {
    const questionTitle1 = 'Title ' + uuid()
    const question1 = 'Content ' + uuid()
    const questionTitle2 = 'Title ' + uuid()
    const question2 = 'Content ' + uuid()
    const sessionName = uuid()
    const session = uuid()

    const courseGamified = 'Testkurs'
    const courseNonGamified = 'Non-Gamified Course'

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle1)
    cy.get('[data-cy="insert-question-text"]').click().type(question1)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle2)
    cy.get('[data-cy="insert-question-text"]').click().type(question2)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click()

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()

    // course settings
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

    cy.get('[data-cy="next-or-submit"]').click()

    // add two questions in separate blocks, move blocks and add time limit of 10 for first and 20 for second block
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle1}"]`)
      .contains(questionTitle1)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
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
    cy.get('[data-cy="next-or-submit"]').click()

    // EDITING - check if the same values as before has been stored and modify them
    const newSessionName = uuid()
    const newSessionDisplayName = uuid()
    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName)
    cy.get(`[data-cy="edit-session-${sessionName}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      sessionName
    )
    cy.get('[data-cy="insert-live-quiz-name"]').clear().type(newSessionName)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should('have.value', session)
    cy.get('[data-cy="insert-live-display-name"]')
      .clear()
      .type(newSessionDisplayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // check settings and modify them
    cy.get('[data-cy="select-course"]').contains(courseGamified)
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

    // TODO: start editing again and check if correct values were saved
    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', newSessionName)
    cy.get(`[data-cy="edit-session-${newSessionName}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      newSessionName
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      newSessionDisplayName
    )
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

  it('creates a session with one block while testing all settings and deletes it afterwards', () => {
    const questionTitle = uuid()
    const question = uuid()
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName)

    // rename the session
    const newSessionName = uuid()
    const newSessionDisplayName = uuid()
    cy.findByText(sessionName).should('exist')
    cy.get(`[data-cy="change-liveQuiz-name-${sessionName}"]`).click()
    cy.get('[data-cy="live-quiz-name-change-confirm"]').should(
      'not.be.disabled'
    )
    cy.get('[data-cy="live-quiz-name-change-cancel"]').click()
    cy.get(`[data-cy="change-liveQuiz-name-${sessionName}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').clear().type(newSessionName)
    cy.get('[data-cy="insert-live-quiz-display-name"]')
      .clear()
      .type(newSessionDisplayName)
    cy.get('[data-cy="live-quiz-name-change-confirm"]').click()

    // delete this session again
    cy.findByText(newSessionName).should('exist')
    cy.get(`[data-cy="delete-session-${newSessionName}"]`).click()
    cy.get(`[data-cy="cancel-delete-live-quiz"]`).click()
    cy.get(`[data-cy="delete-session-${newSessionName}"]`).click()
    cy.get(`[data-cy="confirm-delete-live-quiz"]`).click()
    cy.findByText(newSessionName).should('not.exist')
  })

  it('creates a session with two blocks and duplicates it', () => {
    const questionTitle = uuid()
    const questionTitle2 = uuid()
    const question = uuid()
    const question2 = uuid()
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle2)
    cy.get('[data-cy="insert-question-text"]').click().type(question2)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle2}"]`)
      .contains(questionTitle2)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="add-block"]').trigger('drop', {
      dataTransfer2,
    })

    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName)

    // duplicate the session and verify that the content is the same as for the original session
    cy.get(`[data-cy="duplicate-session-${sessionName}"]`).click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      `${sessionName} (Copy)`
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').should('have.value', session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="question-0-block-0"]')
      .should('exist')
      .should('contain', questionTitle.substring(0, 20))
    cy.get('[data-cy="question-0-block-1"]')
      .should('exist')
      .should('contain', questionTitle2.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', `${sessionName} (Copy)`)
  })

  it('creates a session, starts it and aborts it and then restarts it', () => {
    const questionTitle = uuid()
    const question = uuid()
    const sessionName = uuid()
    const session = uuid()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.contains('[data-cy="session-block"]', sessionName)

    // start session and then abort it
    cy.get(`[data-cy="start-session-${sessionName}"]`).click()
    cy.get('[data-cy="abort-session-cockpit"]').click()
    cy.get('[data-cy="abort-cancel-session"]').click()
    cy.get('[data-cy="abort-session-cockpit"]').click()
    cy.get('[data-cy="confirm-cancel-session"]').should('be.disabled')
    cy.get('[data-cy="abort-enter-name"]').type(sessionName)
    cy.get('[data-cy="confirm-cancel-session"]')
      .should('not.be.disabled')
      .click()

    // start session and then skip through the blocks
    cy.get(`[data-cy="start-session-${sessionName}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  it('shows a possible workflow of running a session and answering questions', () => {
    const session = uuid()
    const sessionName = uuid()
    const questionTitle = uuid()
    const question = uuid()
    const courseName = 'Testkurs'
    const nonGamifiedCourseName = 'Non-Gamified Course'

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('25%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // step 1
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(session)
    cy.get('[data-cy="next-or-submit"]').click()

    // step 2
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseName)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${nonGamifiedCourseName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(nonGamifiedCourseName)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseName)
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
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
        dataTransfer,
      })
    }

    cy.get('[data-cy="add-block"]').click()
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-questions-here"]').eq(1).trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="session"]').contains(sessionName)

    // start session and first block
    cy.get(`[data-cy="start-session-${sessionName}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click()

    // login student and answer first question
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // login student again on mobile, test navigation and answer second question
    cy.viewport('iphone-x')
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText(question).should('exist')

    // TODO: test feedback mechanism (including lecturer response, publishing, moderation, etc.)
    cy.get('[data-cy="mobile-menu-leaderboard"]').click()
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="mobile-menu-questions"]').click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.loginLecturer()

    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.wait(1000)

    // close first block
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    // start next block
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

    // login student and answer first question
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // repeat student actions on mobile device and answer second question
    cy.loginStudent()
    cy.findByText(session).click()
    cy.findByText('25%').click()
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    cy.loginLecturer()

    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()

    cy.url().then((url) => {
      const sessionIdEvaluation = url.split('/')[4]
      cy.visit(
        Cypress.env('URL_MANAGE') +
          '/sessions/' +
          sessionIdEvaluation +
          '/evaluation'
      )
    })

    // TODO: bugfix: evaluation is broken - does not fetch any answers. Once fixed, write better checks
    //  cy.get('[data-cy="session-total-participants"]').should('have.text', 'Total Teilnehmende: 1');
    //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
    cy.get('[data-cy="evaluate-next-question"]').click()
    //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
    //   cy.get('[data-cy="evaluate-next-question"]').click();
    //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
  })

  it('creates a live quiz without questions and tests the feedback mechanisms and deletes the completed live session', () => {
    const courseName = 'Testkurs'
    const questionTitle = uuid()
    const question = uuid()
    const sessionName = uuid()

    // create a question
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // create a live quiz with a single question
    // TODO - once this is possible, create an empty live quiz here
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(sessionName)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.sessionForms.liveQuizNoCourse)
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').contains(courseName)
    cy.get('[data-cy="set-liveqa-enabled"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="quick-start"]').click()

    // test feedback submission with moderation enabled, does not show up until published
    const feedback1 = 'Feedback during moderation enabled'
    cy.loginStudent()
    cy.clearAllLocalStorage()
    cy.findByText(sessionName).click()

    cy.get('[data-cy="feedback-input"]').type(feedback1)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedback1).should('not.exist')

    // check that feedback is visible to lecturer and switch its status to visible
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback1}"]`).should('exist').click()
    cy.get(`[data-cy="pin-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="pin-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="publish-feedback-${feedback1}"]`).click()
    cy.wait(1000)

    // check if feedback is now visible
    cy.loginStudent()
    cy.reload()
    cy.findByText(sessionName).click()
    cy.findByText(feedback1).should('exist')

    // login to lecturer and disable moderation
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get('[data-cy="toggle-moderation"]').click()

    // submit second feedback and check if it is immediately visible
    const feedback2 = 'Feedback without moderation'
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.get('[data-cy="feedback-input"]').type(feedback2)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(feedback2).should('exist')

    // upvote both first and second feedback
    cy.get(`[data-cy="feedback-upvote-${feedback1}"]`).click()
    cy.get(`[data-cy="feedback-upvote-${feedback2}"]`).click()

    // login to lecturer and answer second feedback
    const feedbackAnswer = 'Answer to feedback'
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback2}"]`).should('exist').click()
    cy.get(`[data-cy="respond-to-feedback-${feedback2}"]`).type(feedbackAnswer)
    cy.get(`[data-cy="submit-feedback-response-${feedback2}"]`).click()

    // check on student view that feedback answer is visible
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.findByText(feedbackAnswer).should('exist')
    cy.get(`[data-cy="feedback-response-upvote-${feedbackAnswer}"]`).click()

    // login to lecturer and pin feedback, check lecturer display
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback1}"]`).should('exist').click()
    cy.get(`[data-cy="pin-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="open-lecturer-overview-session-${sessionName}"]`).click()
    cy.findByText(feedback1).should('exist')
    cy.findByText(feedback2).should('not.exist')

    // delete feedback response
    cy.visit(Cypress.env('URL_MANAGE'))
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="open-feedback-${feedback2}"]`).should('exist').click()
    cy.get(`[data-cy="delete-response-${feedbackAnswer}"]`).click()
    cy.get(`[data-cy="delete-response-${feedbackAnswer}"]`).click()

    // check on student frontend that deleted feedback is no longer visible
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.findByText(feedbackAnswer).should('not.exist')

    // delete feedback
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get(`[data-cy="delete-feedback-${feedback1}"]`).click()
    cy.get(`[data-cy="delete-feedback-${feedback1}"]`).click()

    // check on student frontend that deleted feedback is no longer visible
    cy.loginStudent()
    cy.findByText(sessionName).click()
    cy.findByText(feedback1).should('not.exist')

    // click through blocks and end session
    cy.loginLecturer()
    cy.get('[data-cy="sessions"]').click()
    cy.get(`[data-cy="session-cockpit-${sessionName}"]`).click()
    cy.get('[data-cy="next-block-timeline"]').click() // open block
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click() // close block
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click() // end session

    // delete past session
    cy.findByText(sessionName).should('exist')
    cy.get(`[data-cy="delete-past-session-${sessionName}"]`).click()
    cy.get(`[data-cy="cancel-delete-live-quiz"]`).click()
    cy.get(`[data-cy="delete-past-session-${sessionName}"]`).click()
    cy.get(`[data-cy="confirm-delete-live-quiz"]`).click()
    cy.findByText(sessionName).should('not.exist')
  })
})
