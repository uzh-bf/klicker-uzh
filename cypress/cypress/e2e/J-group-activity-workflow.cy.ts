import messages from '../../../packages/i18n/messages/en'

// set dates dynamically to ensure continued functionality
const currentYear = new Date().getFullYear()
const activityStart = `${currentYear + 1}-01-01T02:00`
const activityEnd = `${currentYear + 1}-12-31T18:00`
const runningActivityStart = `${currentYear - 1}-01-01T02:00`
const runningActivityEnd = `${currentYear + 1}-12-31T18:00`
const extendedActivityEnd = `${currentYear + 2}-12-31T18:00`
const extendedActivityEndText = `31.12.${currentYear + 2}, 18:00`
const synchronousActivityStart = `${currentYear + 1}-01-01T02:00`
const synchronousActivityEnd = `${currentYear + 1}-12-31T18:00`

describe('Create and solve a group activity', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('J-group-activity.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 0: Preparation - Question Creation
  it('Create questions required for microlearning creation', function () {
    cy.loginLecturer()

    // SC question with solution
    cy.createQuestionSC({
      title: this.data.questions.SC.title,
      content: this.data.questions.SC.content,
      choices: this.data.questions.SC.choices,
      multiplier: messages.manage.activityWizard.multiplier2,
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
      multiplier: messages.manage.activityWizard.multiplier3,
    })

    // FT question
    cy.createQuestionFT({
      title: this.data.questions.FT.title,
      content: this.data.questions.FT.content,
      ...this.data.questions.FT.options,
    })

    // CT question
    cy.createContent({
      title: this.data.questions.CT.title,
      content: this.data.questions.CT.content,
    })
  })

  // ! Part 1: Group Activity Creation
  it('Create a group activity with the created questions', function () {
    cy.loginLecturer()

    // Step 1: Name
    cy.get('[data-cy="create-group-activity"]').click()
    cy.get('[data-cy="insert-groupactivity-name"]')
      .click()
      .type(this.data.activity.name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .type(this.data.activity.displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .type(this.data.activity.task)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
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
    cy.get('[data-cy="select-start-date"]').click().type(activityStart)
    cy.get('[data-cy="select-end-date"]').click().type(activityEnd)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Clues
    // 1) Text clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.activity.clues[0].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.activity.clues[0].displayName)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .type(this.data.activity.clues[0].content)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.activity.clues[0].name).should('exist')
    cy.findByText(this.data.activity.clues[0].content).should('exist')

    // 2) Numerical clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.activity.clues[1].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.activity.clues[1].displayName)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(this.data.activity.clues[1].content)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(this.data.activity.clues[1].unit)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.activity.clues[1].name).should('exist')
    cy.findByText(
      this.data.activity.clues[1].content +
        ' ' +
        this.data.activity.clues[1].unit
    ).should('exist')

    // 3) Numerical clue without unit
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.activity.clues[2].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.activity.clues[2].displayName)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(this.data.activity.clues[2].content)
    )
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.activity.clues[2].name).should('exist')
    cy.findByText(this.data.activity.clues[2].content).should('exist')

    // Step 4: Questions / Elements
    cy.createStacks({
      stacks: [
        {
          elements: [
            this.data.questions.SC.title,
            this.data.questions.MC.title,
            this.data.questions.KP.title,
            this.data.questions.NR.title,
            this.data.questions.FT.title,
          ],
        },
      ],
    })

    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(this.data.activity.name).should('exist')
  })

  it('Creates a group activity that starts and ends in the future', function () {
    cy.loginLecturer()
    cy.createGroupActivity({
      name: this.data.synchronous.name,
      displayName: this.data.synchronous.displayName,
      task: this.data.synchronous.task,
      courseName: this.data.course,
      scheduledStartDate: synchronousActivityStart,
      scheduledEndDate: synchronousActivityEnd,
      clues: this.data.synchronous.clues,
      stack: {
        elements: [
          this.data.questions.SC.title,
          this.data.questions.MC.title,
          this.data.questions.KP.title,
        ],
      },
    })
  })

  it('Publish and unpublish the future group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${this.data.activity.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.activity.name}"]`
    ).click()
    cy.get('[data-cy="cancel-publish-action"]').click()
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.activity.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.activity.name}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
    cy.get(
      `[data-cy="unpublish-groupActivity-${this.data.activity.name}"]`
    ).click()
    cy.get(`[data-cy="groupActivity-${this.data.activity.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
  })

  it('Edit the group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.activity.name}"]`
    ).click()
    cy.get(`[data-cy="edit-groupActivity-${this.data.activity.name}"]`).click()

    // check the name, display name and task description and update them
    cy.get('[data-cy="insert-groupactivity-name"]')
      .click()
      .should('have.value', this.data.activity.name)
      .clear()
      .type(this.data.running.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .should('have.value', this.data.activity.displayName)
      .clear()
      .type(this.data.running.displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .contains(this.data.activity.task)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .clear()
      .type(this.data.running.task)
    cy.get('[data-cy="next-or-submit"]').click()

    // fill out the settings of the group activity
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
    cy.get('[data-cy="select-start-date"]').click().type(runningActivityStart)
    cy.get('[data-cy="select-end-date"]').click().type(runningActivityEnd)
    cy.get('[data-cy="next-or-submit"]').click()

    // check that clues exist and add a new one
    cy.findByText(this.data.activity.clues[0].name).should('exist')
    cy.findByText(this.data.activity.clues[1].name).should('exist')
    cy.findByText(this.data.activity.clues[2].name).should('exist')

    // edit existing clue
    cy.get(`[data-cy="edit-clue-${this.data.activity.clues[0].name}"]`).click()
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .should('have.value', this.data.activity.clues[0].name)
      .clear()
      .type(this.data.running.clues[0].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .should('have.value', this.data.activity.clues[0].displayName)
      .clear()
      .type(this.data.running.clues[0].displayName)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .should('have.value', this.data.activity.clues[0].content)
      .clear()
      .type(this.data.running.clues[0].content)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(this.data.running.clues[0].name).should('exist')
    cy.findByText(this.data.running.clues[0].content).should('exist')

    // delete existing clue
    cy.get(`[data-cy="remove-clue-${this.data.running.clues[0].name}"]`).click()
    cy.findByText(this.data.running.clues[0].name).should('not.exist')
    cy.findByText(this.data.running.clues[0].content).should('not.exist')

    // create a new clue
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.activityWizard.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .type(this.data.running.clues[1].name)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(this.data.running.clues[1].displayName)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(this.data.running.clues[1].content)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(this.data.running.clues[1].unit)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.get(
      `[data-cy="groupActivity-clue-${this.data.running.clues[1].name}"]`
    ).should('exist')
    cy.findByText(
      this.data.running.clues[1].content + ' ' + this.data.running.clues[1].unit
    ).should('exist')

    // add another question to the group activity
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.questions.SC.title}"]`)
      .contains(this.data.questions.SC.title)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })

    const dataTransfer2 = new DataTransfer()
    cy.get(`[data-cy="element-item-${this.data.questions.CT.title}"]`)
      .contains(this.data.questions.CT.title)
      .trigger('dragstart', {
        dataTransfer2,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer2,
    })

    // verify that the contained questions are correct
    cy.get(`[data-cy="element-0-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.SC.title.substring(0, 20))
    cy.get(`[data-cy="element-1-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.MC.title.substring(0, 20))
    cy.get(`[data-cy="element-2-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.KP.title.substring(0, 20))
    cy.get(`[data-cy="element-3-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.NR.title.substring(0, 20))
    cy.get(`[data-cy="element-4-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.FT.title.substring(0, 20))
    cy.get(`[data-cy="element-5-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.SC.title.substring(0, 20))
    cy.get(`[data-cy="element-6-stack-0"]`)
      .should('exist')
      .should('contain', this.data.questions.CT.title.substring(0, 20))
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="load-live-quiz-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(this.data.running.name).should('exist')
  })

  // ! Part 2: Running Group Activity & Participation
  function answerGroupActivity({ NRAnswer, FTAnswer }) {
    cy.get('[data-cy="sc-1-answer-option-1"]').click()
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-2-correct"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-3-answer-4-incorrect"]').click()
    cy.get('[data-cy="input-numerical-4"]').type(NRAnswer)
    cy.get('[data-cy="free-text-input-5"]').click().type(FTAnswer)
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

  function checkPersistentAnswers({ NRAnswer, FTAnswer }) {
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
      .should('have.value', NRAnswer)

    cy.get('[data-cy="free-text-input-5"]')
      .should('be.disabled')
      .contains(FTAnswer)

    cy.get('[data-cy="sc-6-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-6-answer-option-2"]').should('be.disabled')
  }

  function checkGradingVisualization(
    scores: string[],
    maxPoints: string[],
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
    cy.wrap(scores).each((score: string, ix) => {
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

    if (gradingComment !== null) {
      cy.get('[data-cy="group-activity-results-comment"]').should(
        'contain',
        gradingComment
      )
    }
  }

  it('Publish the group activity and check its status', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.running.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`)
      .findByText(messages.shared.generic.running)
      .should('exist')
  })

  it('Extend the running group activity', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // open extension modal
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="extend-groupActivity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="extend-groupActivity-${this.data.running.name}"]`).click()

    // change the end date and check if the changes are saved
    cy.get('[data-cy="extend-activity-date"]').click().type(extendedActivityEnd)
    cy.get('[data-cy="extend-activity-confirm"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`).contains(
      extendedActivityEndText
    )

    // check that changing the date to the past does not work
    cy.get(`[data-cy="extend-groupActivity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="extend-activity-confirm"]').should('not.be.disabled')
    cy.get('[data-cy="extend-activity-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T12:00`)
    cy.get('[data-cy="extend-activity-confirm"]').should('be.disabled')
    cy.get('[data-cy="extend-activity-cancel"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`).contains(
      extendedActivityEndText
    )
  })

  it('Take part in the group activity', function () {
    cy.loginStudent()

    // start the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
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
    cy.get('[data-cy="flag-element-textarea"]').type(
      this.data.running.flagging.text
    )
    cy.get('[data-cy="cancel-flag-element"]').click()
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').type(
      this.data.running.flagging.text
    )
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled').click()
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.running.flagging.text
    )
    cy.get('[data-cy="flag-element-textarea"]')
      .clear()
      .type(this.data.running.flagging.textNew)
    cy.get('[data-cy="submit-flag-element"]').click()
    cy.wait(500)
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      this.data.running.flagging.textNew
    )
    cy.get('[data-cy="cancel-flag-element"]').click()

    // answer the questions in the group activity
    answerGroupActivity({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswers({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    checkPersistentAnswers({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })
  })

  it('Login as the second group member and verify that submission was successful', function () {
    cy.loginStudent()

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()

    // check that the same answers are visible to the second student
    checkPersistentAnswers({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })
  })

  it('Solve the group activity as a second student', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME5') })

    // start the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // answer the questions in the group activity
    answerGroupActivity({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })

    // check that the answers are persistent and the fields disabled
    checkPersistentAnswers({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    checkPersistentAnswers({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })
  })

  it('Login as a student in a second group and start the group activity', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
  })

  // ! Part 3: Group Activity Ending and Grading
  it('End the running group activity through the corresponding action on the lecturer interface', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // end the group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="activity-confirmation-modal-cancel"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="end-group-activity-${this.data.running.name}"]`).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="activity-confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(`[data-cy="groupActivity-${this.data.running.name}"]`).findByText(
      messages.shared.generic.grading
    )
  })

  it('Verify that a valid submission is still visible after the group activity ended', function () {
    cy.loginStudent()

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).contains(messages.pwa.groupActivity.submitted)
    cy.get(
      `[data-cy="open-submission-${this.data.running.displayName}"]`
    ).click()

    // check that the same answers are visible to the student
    checkInputsDisabled()
    checkPersistentAnswers({
      NRAnswer: this.data.running.answers.numerical,
      FTAnswer: this.data.running.answers.freeText,
    })
    cy.get('[data-cy="submit-group-activity"]').should('not.exist')
  })

  it("Verify that a started group activity can still be seen, but not submitted after it's ended", function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).contains(messages.pwa.groupActivity.past)
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()

    // submission should not be possible and inputs should be disabled
    checkInputsDisabled()
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it("Verify that a group activity can't be started after it's ended", function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME3') })

    // open the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  // ! Part 4: Grading the Group Activity
  it('Grade the submissions to the group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="grade-groupActivity-${this.data.running.name}"]`).click()

    // grade the responses for the first submission
    cy.get('[data-cy="group-activity-submission-0"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
    cy.wrap(this.data.running.grading.scores1).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`)
        .click()
        .type(score)
      if (this.data.running.grading.comments1[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .type(this.data.running.grading.comments1[ix])
      }

      cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
        'be.disabled'
      )
    })

    if (this.data.running.grading.gradingComment1 !== null) {
      cy.get('[data-cy="groupActivity-general-grading-comment"]')
        .realClick()
        .type(this.data.running.grading.gradingComment1)
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
    cy.wrap(this.data.running.grading.scores1).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`).should(
        'have.value',
        score
      )
      if (this.data.running.grading.comments1[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .contains(this.data.running.grading.comments1[ix])
      }
    })

    // grade the responses for the second submission
    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.get('[data-cy="confirm-submission-switch"]').click()
    cy.get('[data-cy="finalize-grading"]').should('be.disabled')

    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )
    cy.wrap(this.data.running.grading.scores2).each((score: string, ix) => {
      cy.get(`[data-cy="groupActivity-grading-score-${ix}"]`)
        .click()
        .type(score)
      if (this.data.running.grading.comments2[ix]) {
        cy.get(`[data-cy="groupActivity-grading-comment-${ix}"]`)
          .realClick()
          .type(this.data.running.grading.comments2[ix])
      }
      cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
        'be.disabled'
      )
    })

    if (this.data.running.grading.gradingComment2 !== null) {
      cy.get('[data-cy="groupActivity-general-grading-comment"]')
        .realClick()
        .type(this.data.running.grading.gradingComment2)
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
    cy.wrap(this.data.running.grading.scores1).each((score: string, ix) => {
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
    cy.wrap(this.data.running.grading.scores2).each((score: string, ix) => {
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

  it('Verify that the student of the group with passing results can see the evaluation', function () {
    cy.loginStudent()

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.shared.generic.passed)

    cy.get(`[data-cy="open-feedback-${this.data.running.displayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(
      this.data.running.grading.scores1,
      this.data.running.grading.maxPoints,
      this.data.running.grading.comments1,
      this.data.running.grading.gradingComment1
    )
  })

  it('Verify that the second student of the first group can see the same results', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME15') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.shared.generic.passed)

    cy.get(`[data-cy="open-feedback-${this.data.running.displayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(
      this.data.running.grading.scores1,
      this.data.running.grading.maxPoints,
      this.data.running.grading.comments1,
      this.data.running.grading.gradingComment1
    )
  })

  it('Verify that the student of the group with failing results can see the evaluation', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME5') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.shared.generic.failed)

    cy.get(`[data-cy="open-feedback-${this.data.running.displayName}"]`).click()
    cy.findByText(messages.pwa.groupActivity.groupActivityFailed).should(
      'exist'
    )

    // check grading
    checkGradingVisualization(
      this.data.running.grading.scores2,
      this.data.running.grading.maxPoints,
      this.data.running.grading.comments2,
      this.data.running.grading.gradingComment2
    )
  })

  it("Verify that groups that have not attempted to submit anything to the group activity can't see any results", function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })

    // check if results are correctly marked as passed
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('contain', messages.pwa.groupActivity.past)

    cy.get(
      `[data-cy="open-group-activity-${this.data.running.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
    cy.findByText(messages.pwa.groupActivity.groupActivityEnded).should('exist')
  })

  it('Cleanup: Delete the running and solved group activity', function () {
    cy.loginLecturer()

    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.running.name}"]`
    ).click()
    cy.get(`[data-cy="delete-groupActivity-${this.data.running.name}"]`).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.running.name}"]`
    ).should('not.exist')
  })

  it('Verify that the group activity is not visible to students anymore', function () {
    cy.loginStudent()

    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.running.displayName}"]`
    ).should('not.exist')
  })

  // ! Part 5: Synchronous Group Activity
  it('Publish the synchronous group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()

    cy.get(`[data-cy="groupActivity-${this.data.synchronous.name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(
      `[data-cy="publish-groupActivity-${this.data.synchronous.name}"]`
    ).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${this.data.synchronous.name}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
  })

  it('Login as a student and check that the group activity is not visible', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${this.data.synchronous.displayName}"]`)
      .should('exist')
      .contains(messages.shared.generic.scheduled)
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).should('not.exist')
  })

  it('Start the synchronous group activity', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="start-group-activity-${this.data.synchronous.name}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="activity-confirmation-modal-cancel"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="start-group-activity-${this.data.synchronous.name}-now"]`
    ).click()
    cy.get('[data-cy="confirm-groups-getting-access"]').click()
    cy.get('[data-cy="confirm-activity-available-until"]').click()
    cy.get('[data-cy="activity-confirmation-modal-confirm"]').click()
  })

  it('Login as a student and solve the group activity', function () {
    cy.loginStudent()

    // start the group activity
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
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

  it('Login as a student and start the synchronous group activity', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
  })

  it('End the synchronous group activity', function () {
    // navigate to course overview
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(this.data.course).click()

    // end the group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="end-group-activity-${this.data.synchronous.name}"]`
    ).click()
    cy.get('[data-cy="confirm-instances-loosing-access"]').click()
    cy.get('[data-cy="activity-confirmation-modal-confirm"]').click()

    // check that the group activity is now in the grading state
    cy.get(
      `[data-cy="groupActivity-${this.data.synchronous.name}"]`
    ).findByText(messages.shared.generic.grading)
  })

  it('Login as a student with a valid submission', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-submission-${this.data.synchronous.displayName}"]`
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

  it('Login as a second student and check that the group activity cannot be started anymore', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.synchronous.displayName}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').should('not.exist')
  })

  it('Cleanup: Delete the synchronous group activity', function () {
    cy.loginLecturer()

    // delete the created group activities
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-groupActivity-${this.data.synchronous.name}"]`
    ).click()
    cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
    cy.get(`[data-cy="confirm-deletion-submissions"]`).click()
    cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
    cy.get(
      `[data-cy="groupActivity-actions-${this.data.synchronous.name}"]`
    ).should('not.exist')
  })

  it("Verify that the synchronous group activity isn't visible to students anymore", function () {
    cy.loginStudent()

    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="group-activity-${this.data.synchronous.displayName}"]`
    ).should('not.exist')
  })

  it('Cleanup: Delete all created questions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    const questions = [
      this.data.questions.SC.title,
      this.data.questions.MC.title,
      this.data.questions.KP.title,
      this.data.questions.NR.title,
      this.data.questions.FT.title,
      this.data.questions.CT.title,
    ]

    cy.wrap(questions).each((title: string) => {
      cy.get(`[data-cy="delete-question-${title}"]`).click()
      cy.get('[data-cy="confirm-question-deletion"]').click()
      cy.get(`[data-cy="element-item-${title}"]`).should('not.exist')
    })
  })

  // ! Part 6: Miscellaneous
  it('Check if group messages can be sent', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-message-textarea"]').type(this.data.group.message1)
    cy.get('[data-cy="group-message-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message1
    )

    // log into other student in the group and check for the message
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME15') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message1
    )
    cy.get('[data-cy="group-message-textarea"]').type(this.data.group.message2)
    cy.get('[data-cy="group-message-submit"]').click()
    cy.wait(500)
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message2
    )

    // log back into the first account and check if both messages are visible
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message1
    )
    cy.get('[data-cy="group-messages"]').should(
      'contain',
      this.data.group.message2
    )
  })
})
