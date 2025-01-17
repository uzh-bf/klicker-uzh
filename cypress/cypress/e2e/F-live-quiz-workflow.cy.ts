import messages from '../../../packages/i18n/messages/en'

describe('Different live-quiz workflows', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('F-live-quiz.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 0: Preparation
  it('Create the questions required in the live quiz test workflows', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      title: this.data.SC1.title,
      content: this.data.SC1.content,
      choices: this.data.SC1.choices,
    })
    cy.createQuestionSC({
      title: this.data.SC2.title,
      content: this.data.SC2.content,
      choices: this.data.SC2.choices,
    })

    cy.createQuestionMC({
      title: this.data.MC1.title,
      content: this.data.MC1.content,
      choices: this.data.MC1.choices,
    })
    cy.createQuestionMC({
      title: this.data.MC2.title,
      content: this.data.MC2.content,
      choices: this.data.MC2.choices,
    })

    cy.createQuestionKPRIM({
      title: this.data.KP1.title,
      content: this.data.KP1.content,
      choices: this.data.KP1.choices,
    })
    cy.createQuestionKPRIM({
      title: this.data.KP2.title,
      content: this.data.KP2.content,
      choices: this.data.KP2.choices,
    })

    cy.createQuestionNR({
      title: this.data.NR1.title,
      content: this.data.NR1.content,
      ...this.data.NR1.options,
    })
    cy.createQuestionNR({
      title: this.data.NR2.title,
      content: this.data.NR2.content,
      ...this.data.NR2.options,
    })

    cy.createQuestionFT({
      title: this.data.FT1.title,
      content: this.data.FT1.content,
      ...this.data.FT1.options,
    })
    cy.createQuestionFT({
      title: this.data.FT2.title,
      content: this.data.FT2.content,
      ...this.data.FT2.options,
    })
  })

  // ! Part 1: Live Quiz Creation
  it('Test adding and deleting blocks to a live quiz', function () {
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

  it('Create a live quiz with two questions and test all settings', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()
    cy.get('[data-cy="insert-live-quiz-name"]').type(
      this.data.course1.quiz.name
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-live-display-name"]').type(
      this.data.course1.quiz.displayName
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .type(this.data.course1.quiz.description)
    cy.get('[data-cy="insert-live-description"]').contains(
      this.data.course1.quiz.description
    )
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
    cy.get(`[data-cy="select-course-${this.data.course1.name}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course2.name)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course1.name}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)

    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-default-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-default-points"]').click().type('-10') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-default-points"]').should('have.value', '10')
    cy.get('[data-cy="live-quiz-default-points"]')
      .click()
      .clear()
      .type(String(this.data.course1.quiz.defaultPoints))
    cy.get('[data-cy="live-quiz-default-points"]').should(
      'have.value',
      String(this.data.course1.quiz.defaultPoints)
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
      .type(String(this.data.course1.quiz.defaultCorrectPoints))
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('exist')
    cy.get('[data-cy="live-quiz-max-bonus-points"]').click().clear()
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').should('not.exist')
    cy.get('[data-cy="live-quiz-max-bonus-points"]').click().type('-30') // negative values should not be accepted
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should('have.value', '30')
    cy.get('[data-cy="live-quiz-max-bonus-points"]')
      .click()
      .clear()
      .type(String(this.data.course1.quiz.maxBonusPoints))
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
      .type(String(this.data.course1.quiz.timeToZeroBonus))
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
        { elements: [this.data.SC1.title] },
        { elements: [this.data.SC2.title] },
      ],
      type: 'block',
    })

    // test sorting of blocks
    cy.get('[data-cy="move-block-1-left"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SC2.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC1.title.substring(0, 20))
    cy.get('[data-cy="move-block-0-right"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SC1.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC2.title.substring(0, 20))

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

  it('Edit the created live quiz and check if all settings persist', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()

    cy.contains('[data-cy="live-quiz-block"]', this.data.course1.quiz.name)
    cy.get(`[data-cy="edit-live-quiz-${this.data.course1.quiz.name}"]`).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      this.data.course1.quiz.name
    )
    cy.get('[data-cy="insert-live-quiz-name"]')
      .clear()
      .type(this.data.course1.quiz.nameNew)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      this.data.course1.quiz.displayName
    )
    cy.get('[data-cy="insert-live-display-name"]')
      .clear()
      .type(this.data.course1.quiz.displayNameNew)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.description)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .clear()
      .type(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()

    // check settings and modify them
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('exist').click()
    cy.get('[data-cy="live-quiz-default-points"]').should(
      'have.value',
      this.data.course1.quiz.defaultPoints
    )
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      this.data.course1.quiz.defaultCorrectPoints
    )
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should(
      'have.value',
      this.data.course1.quiz.maxBonusPoints
    )
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should(
      'have.value',
      this.data.course1.quiz.timeToZeroBonus
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
      .should('contain', this.data.SC1.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC2.title.substring(0, 20))
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
      .should('contain', this.data.SC2.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC1.title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    //  start editing again and check if correct values were saved
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.contains('[data-cy="live-quiz-block"]', this.data.course1.quiz.nameNew)
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      this.data.course1.quiz.nameNew
    )
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      this.data.course1.quiz.displayNameNew
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()

    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
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
      .should('contain', this.data.SC2.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC1.title.substring(0, 20))
    cy.get('[data-cy="open-block-0-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '25')
    cy.get('[data-cy="close-block-settings"]').click()
    cy.get('[data-cy="open-block-1-settings"]').click()
    cy.get('[data-cy="block-time-limit"]').should('have.value', '15')
    cy.get('[data-cy="close-block-settings"]').click()
  })

  it('Duplicate the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.contains('[data-cy="live-quiz-block"]', this.data.course1.quiz.nameNew)

    // duplicate the live quiz and verify that the content is the same as for the original live quiz
    cy.get(
      `[data-cy="duplicate-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-quiz-name"]').should(
      'have.value',
      this.data.course1.quiz.nameDupl
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').should('not.be.disabled')
    cy.get('[data-cy="insert-live-display-name"]').should(
      'have.value',
      this.data.course1.quiz.displayNameNew
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course1.quiz.descriptionNew)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="element-0-block-0"]')
      .should('exist')
      .should('contain', this.data.SC2.title.substring(0, 20))
    cy.get('[data-cy="element-0-block-1"]')
      .should('exist')
      .should('contain', this.data.SC1.title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.contains('[data-cy="live-quiz-block"]', this.data.course1.quiz.nameDupl)
  })

  it('Cleanup: Delete the duplicated live quiz', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()
    cy.findByText(this.data.course1.quiz.nameDupl).should('exist')
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course1.quiz.nameDupl}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-cancel"]`).click()
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course1.quiz.nameDupl}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.course1.quiz.nameDupl).should('not.exist')
  })

  // ! Part 2: Live Quiz Control
  it('Start the created live quizzes, abort it, and restart & complete it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.contains('[data-cy="live-quiz-block"]', this.data.course1.quiz.nameNew)

    // start live quiz and then abort it
    cy.get(
      `[data-cy="start-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
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
    cy.get(
      `[data-cy="start-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
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

  it('Cleanup: Delete the created and completed live quiz', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()

    cy.findByText(this.data.course1.quiz.nameNew).should('exist')
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course1.quiz.nameNew}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-responses"]`).should('not.exist') // ? azure functions do not work in cypress CI actions
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).should('not.exist')
    cy.get(`[data-cy="confirm-deletion-confusion-feedbacks"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.course1.quiz.nameNew).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedLiveQuiz', {
      lqName: this.data.course1.quiz.nameNew,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  // ! Part 3: Full Live Quiz Execution Cycle
  it('Create and start a live quiz with all question types (with and without sample solution) to test the entire execution cycle', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-live-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-live-quiz-name"]').type(
      this.data.course2.quiz.name
    )
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-live-display-name"]').type(
      this.data.course2.quiz.displayName
    )
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .type(this.data.course2.quiz.description)
    cy.get('[data-cy="insert-live-description"]')
      .realClick()
      .contains(this.data.course2.quiz.description)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]')
      .should('exist')
      .contains(messages.manage.activityWizard.liveQuizNoCourse)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course1.name}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
    cy.get('[data-cy="select-multiplier"]').should('exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course2.name}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course2.name)
    cy.get('[data-cy="select-multiplier"]').should('not.exist')
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${this.data.course1.name}"]`).click()
    cy.get('[data-cy="select-course"]').contains(this.data.course1.name)
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
            this.data.SC1.title,
            this.data.MC1.title,
            this.data.KP1.title,
            this.data.NR1.title,
            this.data.FT1.title,
          ],
        },
        {
          elements: [
            this.data.SC2.title,
            this.data.MC2.title,
            this.data.KP2.title,
            this.data.NR2.title,
            this.data.FT2.title,
          ],
        },
      ],
      type: 'block',
    })
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="live-quiz"]').contains(this.data.course2.quiz.name)

    // start live quiz and first block
    cy.get(`[data-cy="start-live-quiz-${this.data.course2.quiz.name}"]`).click()
    cy.wait(1000)
  })

  it('Check that the live quiz description is correctly shown to students', function () {
    // check if live quiz description is shown to students on desktop view
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
    cy.get('[data-cy="live-quiz-description"]').contains(
      this.data.course2.quiz.displayName
    )
    cy.get('[data-cy="live-quiz-description"]').contains(
      this.data.course2.quiz.description
    )

    // check if the description is also shown correctly on mobile view
    cy.viewport('iphone-x')
    cy.get('[data-cy="live-quiz-description"]').contains(
      this.data.course2.quiz.displayName
    )
    cy.get('[data-cy="live-quiz-description"]').contains(
      this.data.course2.quiz.description
    )
  })

  it('Start the first block of the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Respond to the first block of the running live quiz from the student view', function () {
    // login student and answer first question
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
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
    cy.get('[data-cy="feedback-input"]')
      .click()
      .type(this.data.course2.quiz.feedbackDesktop)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('not.exist')
    cy.wait(500)
  })

  it('Test the live quiz functionalities on mobile devices', function () {
    // login student again on mobile, test navigation and answer second question
    cy.viewport('iphone-x')
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
    cy.findByText(this.data.NR1.content).should('exist')

    cy.get('[data-cy="mobile-menu-leaderboard"]').click()
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="mobile-menu-questions"]').click()
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="input-numerical-4"]').clear().type(this.data.NR1.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="student-submit-answer"]').should('be.disabled')
    cy.get('[data-cy="free-text-input-5"]').type(this.data.FT1.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)

    // provide feedback while moderation is enabled
    cy.get('[data-cy="mobile-menu-feedbacks"]').click()
    cy.get('[data-cy="feedback-input"]')
      .click()
      .type(this.data.course2.quiz.feedbackMobile)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('not.exist')
    cy.findByText(this.data.course2.quiz.feedbackMobile).should('not.exist')
    cy.wait(500)
  })

  it('Start the second block of the live quiz', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)
  })

  it('Make feedbacks visible, respond to one and disable moderation', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    // make both feedbacks visible and respond to one of them (moderation enabled)
    cy.get(
      `[data-cy="publish-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()
    cy.get(
      `[data-cy="publish-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="open-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()
    cy.get(
      `[data-cy="respond-to-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    )
      .click()
      .type(this.data.course2.quiz.feedbackResponse)
    cy.get(
      `[data-cy="submit-feedback-response-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()

    // pin and unpin feedback
    cy.get(
      `[data-cy="open-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="pin-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="pin-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()

    // disable moderation
    cy.get('[data-cy="toggle-moderation"]').click()
  })

  it('Answer questions in second block from student view', function () {
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
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
    cy.get('[data-cy="input-numerical-4"]').clear().type(this.data.NR2.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="free-text-input-5"]').type(this.data.FT2.answer)
    cy.get('[data-cy="student-submit-answer"]').click()
    cy.wait(500)
  })

  it('Verify that the feedbacks and the given feedback response are visible to the student', function () {
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()

    // check that feedbacks are now visible and upvote them
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackMobile).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackResponse).should('exist')
    cy.get(
      `[data-cy="feedback-upvote-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="feedback-response-upvote-${this.data.course2.quiz.feedbackResponse}"]`
    ).click()

    // add another feedback, which should be immediately visible (no moderation)
    cy.get('[data-cy="feedback-input"]')
      .click()
      .type(this.data.course2.quiz.feedbackDesktop2)
    cy.get('[data-cy="feedback-submit"]').click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop2).should('exist')
    cy.wait(500)
  })

  it('Check out the public evaluation links accessible through the embedding modal', function () {
    cy.loginLecturer()
    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
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
    cy.findByText(this.data.SC1.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MC1.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.SC1.content).should('exist')

    // check out specific question evaluation
    cy.get('@publicLinkQuestion0').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.SC1.content).should('exist')
    cy.get('@publicLinkQuestion7').then((link) => {
      cy.visit(String(link))
    })
    cy.findByText(this.data.KP2.content).should('exist')

    // check out leaderboard
    cy.get('@publicLinkLeaderboard').then((link) => {
      cy.visit(String(link))
    })
  })

  it('Check out evaluation view of live quiz and its content', function () {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)

    // extract the quiz id from the URL and visit the evaluation view
    cy.location('href').then((href) => {
      const quizId = href.split('/')[4]
      cy.visit(`${Cypress.env('URL_MANAGE')}/quizzes/${quizId}/evaluation`)
    })

    // check content of evaluation view
    cy.findByText(this.data.SC1.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MC1.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.SC1.content).should('exist')

    // test instance navigation
    cy.get('[data-cy="evaluate-question-select"]')
      .should('exist')
      .contains(this.data.SC1.title)
    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.KP1.title}"]`
    ).click()
    cy.get('[data-cy="evaluate-question-select"]').contains(this.data.KP1.title)
    cy.get('[data-cy="evaluate-question-select"]').click()
    cy.get(
      `[data-cy="evaluation-select-instance-${this.data.SC1.title}"]`
    ).click()
    cy.get('[data-cy="evaluate-question-select"]').contains(this.data.SC1.title)

    // navigate forwards and backwards through all questions
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KP1.title).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.NR1.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.FT1.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.SC2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.MC2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.KP2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.NR2.content).should('exist')
    cy.get('[data-cy="evaluate-next-question"]').click()
    cy.findByText(this.data.FT2.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.NR2.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.SC2.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.FT1.content).should('exist')
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.get('[data-cy="evaluate-previous-question"]').click()
    cy.findByText(this.data.MC1.title).should('exist')

    // test navigation through blocks
    cy.get('[data-cy="evaluate-stack-1"]').click()
    cy.findByText(this.data.SC2.content).should('exist')
    cy.get('[data-cy="evaluate-stack-0"]').click()
    cy.findByText(this.data.SC1.title).should('exist')
    cy.get('[data-cy="evaluate-stack-1"]').click()
    cy.findByText(this.data.SC2.content).should('exist')
  })

  it('Close block and delete feedback / feedback response', function () {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()

    // delete feedback mobile and response to desktop feedback
    cy.get(
      `[data-cy="delete-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="delete-feedback-${this.data.course2.quiz.feedbackMobile}"]`
    ).click()
    cy.get(
      `[data-cy="open-feedback-${this.data.course2.quiz.feedbackDesktop}"]`
    ).click()
    cy.get(
      `[data-cy="delete-response-${this.data.course2.quiz.feedbackResponse}"]`
    ).click()
  })

  it('Check that the deleted feedbacks are not visible anymore', function () {
    cy.loginStudent()
    cy.findByText(this.data.course2.quiz.displayName).click()
    cy.findByText(this.data.course2.quiz.feedbackDesktop).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackDesktop2).should('exist')
    cy.findByText(this.data.course2.quiz.feedbackMobile).should('not.exist')
    cy.findByText(this.data.course2.quiz.feedbackResponse).should('not.exist')
  })

  it('End live quiz on lecturer cockpit', function () {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="live-quiz-cockpit-${this.data.course2.quiz.name}"]`
    ).click()
    cy.wait(1000)
    cy.get('[data-cy="next-block-timeline"]').click()
  })

  // ! Cleanup
  it('Cleanup: Delete the live quiz used for the full cycle test', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="live-quizzes"]`).click()

    cy.findByText(this.data.course2.quiz.name).should('exist')
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course2.quiz.name}"]`
    ).click()
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
    cy.get(
      `[data-cy="delete-live-quiz-${this.data.course2.quiz.name}"]`
    ).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).should(
      'be.disabled'
    )
    cy.get(`[data-cy="confirm-deletion-qa-feedbacks"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.findByText(this.data.course2.quiz.name).should('not.exist')
  })

  it('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', function () {
    cy.loginLecturer()
    cy.wait(2000)
    cy.task('removeSoftDeletedLiveQuiz', {
      lqName: this.data.course2.quiz.name,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })

  it('Cleanup: Delete the created questions from the question pool for repeated test execution', function () {
    cy.loginLecturer()

    const questions = [
      this.data.SC1.title,
      this.data.MC1.title,
      this.data.KP1.title,
      this.data.NR1.title,
      this.data.FT1.title,
      this.data.SC2.title,
      this.data.MC2.title,
      this.data.KP2.title,
      this.data.NR2.title,
      this.data.FT2.title,
    ]
    cy.wrap(questions).each((question: string) => {
      cy.get(`[data-cy="element-item-${question}"]`).should('exist')
      cy.get(`[data-cy="delete-question-${question}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${question}"]`).should('not.exist')
    })
  })
})
