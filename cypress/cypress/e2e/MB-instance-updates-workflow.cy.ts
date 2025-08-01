import { getDatetimeValidationString } from './helpers'

// global variable for ensured consistency with current dates
const currentYear = new Date().getFullYear()

describe('Create different types of elements (with and without sample solution) and edit them', function () {
  before(() => {
    cy.seed()

    // set browser language to english (independent of local machine setting
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setLocaleOverride',
      params: { locale: 'en' },
    })
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load data fixture', function () {
    cy.fixture('questions.json').then((sharedData) => {
      this.data = sharedData
    })
    cy.fixture('DM-questions.json').then((questionsData) => {
      this.data = { ...this.data, ...questionsData }
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  it('Create different elements and activities of each type', function () {
    cy.loginLecturer()

    // create three different types of questions
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionMC({
      name: this.data.MCML.title,
      content: this.data.MCML.content,
      choices: this.data.MCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionKPRIM({
      name: this.data.KPML.title,
      content: this.data.KPML.content,
      choices: this.data.KPML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create a live quiz with all created questions
    cy.createLiveQuiz({
      name: this.data.instanceUpdates.liveQuizName,
      displayName: this.data.instanceUpdates.liveQuizName,
      courseName: this.data.instanceUpdates.courseName,
      blocks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a practice quiz with all created questions
    cy.createPracticeQuiz({
      name: this.data.instanceUpdates.practiceQuizName,
      displayName: this.data.instanceUpdates.practiceQuizName,
      courseName: this.data.instanceUpdates.courseName,
      stacks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a microlearning with all created questions
    cy.createMicroLearning({
      name: this.data.instanceUpdates.microlearningName,
      displayName: this.data.instanceUpdates.microlearningName,
      courseName: this.data.instanceUpdates.courseName,
      startDate: {
        monthDelta: -3,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-2, '16') + ', 02:00',
      }, // 2 months in the past at 2:00
      endDate: {
        monthDelta: 3,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(4, '14') + ', 18:00',
      }, // 4 months in the future at 18:00
      stacks: [
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
          ],
        },
        {
          elements: [
            this.data.SCML.title,
            this.data.MCML.title,
            this.data.KPML.title,
          ],
        },
      ],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a group activity with all created questions
    cy.createGroupActivity({
      name: this.data.instanceUpdates.groupActivityName,
      displayName: this.data.instanceUpdates.groupActivityName,
      task: 'Task Description',
      courseName: this.data.instanceUpdates.courseName,
      scheduledStartDate: {
        monthDelta: -2,
        day: 10,
        hour: 12,
        minute: 30,
        validation: getDatetimeValidationString(-1, '10') + ', 12:30',
      }, // 1 month in the past at 12:30
      scheduledEndDate: {
        monthDelta: 1,
        day: 20,
        hour: 14,
        minute: 0,
        validation: getDatetimeValidationString(2, '20') + ', 14:00',
      }, // 2 months in the future at 14:00
      clues: [
        {
          type: 'text',
          name: 'Clue 1',
          displayName: 'First Hint',
          content: 'Lorem ipsum dolor sit amet',
        },
        {
          type: 'text',
          name: 'Clue 2',
          displayName: 'Second Hint',
          content: 'Consectetur adipiscing elit',
        },
      ],
      stack: {
        elements: [
          this.data.SCML.title,
          this.data.MCML.title,
          this.data.KPML.title,
          this.data.SCML.title,
          this.data.MCML.title,
          this.data.KPML.title,
        ],
      },
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // head to the activity overview and verify the content of all activities
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="stack-0-instance-3"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-4"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-5"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Check the edit view of all activities and verify that no update hint is shown', function () {
    cy.loginLecturer()

    // verify the edit view of the live quiz
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()

    // verify the edit view of the practice quiz
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()

    // verify the edit view of the microlearning
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="edit-microlearning-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()

    // verify the edit view of the group activity
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="edit-group-activity-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()
  })

  it('Update the single choice question and the second instances in all activities', function () {
    cy.loginLecturer()

    // update the single choice question
    cy.get(`[data-cy="edit-element-${this.data.SCML.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.SCML.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.instanceUpdates.newSCTitle)
    cy.get('[data-cy="instance-update-switch"]').click() // disable instance updates to verify option for manual updates
    cy.get('[data-cy="save-new-question"]').click()
    cy.get(
      `[data-cy="edit-element-${this.data.instanceUpdates.newSCTitle}"]`
    ).should('exist') // verify that the change went into effect

    // open the live quiz editing dialog and update the second instance of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')

    cy.get('[data-cy="update-element-0-block-1"]').click() // update the second instance of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the live quiz went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()

    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)

    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    // open the practice quiz editing dialog and update the second instance of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')

    cy.get('[data-cy="update-element-0-stack-1"]').click() // update the second instance of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the practice quiz went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()

    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    // open the microlearning editing dialog and update the second instance of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')

    cy.get('[data-cy="update-element-0-stack-1"]').click() // update the second instance of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the microlearning went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.microlearningName}"]`
    ).click()

    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    // open the group activity editing dialog and update the second instance of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')

    cy.get('[data-cy="update-element-3-stack-0"]').click() // update the second instance of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the group activity went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()

    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(this.data.SCML.title)
    cy.get('[data-cy="stack-0-instance-1"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="stack-0-instance-3"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-4"]').contains(this.data.MCML.title)
    cy.get('[data-cy="stack-0-instance-5"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })

  it('Verify that update message disappears correctly after updating all instances in an activity', function () {
    cy.loginLecturer()

    // open the live quiz editing dialog and update all instances of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')

    cy.get('[data-cy="update-element-0-block-0"]').click() // update all instances of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()

    // open the practice quiz editing dialog and update all instances of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')

    cy.get('[data-cy="update-element-0-stack-0"]').click() // update all instances of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()

    // open the microlearning editing dialog and update all instances of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')

    cy.get('[data-cy="update-element-0-stack-0"]').click() // update all instances of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()

    // open the group activity editing dialog and update all instances of the single choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')

    cy.get('[data-cy="update-element-0-stack-0"]').click() // update all instances of the single choice question
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')
    cy.get('[data-cy="cancel-activity-creation"]').click()
  })

  it('Update the multiple choice question and update all outdated instances in all activities', function () {
    cy.loginLecturer()

    // update the multiple choice question
    cy.get(`[data-cy="edit-element-${this.data.MCML.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.MCML.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.instanceUpdates.newMCTitle)
    cy.get('[data-cy="instance-update-switch"]').click() // disable instance updates to verify option for manual updates
    cy.get('[data-cy="save-new-question"]').click()
    cy.get(
      `[data-cy="edit-element-${this.data.instanceUpdates.newMCTitle}"]`
    ).should('exist') // verify that the change went into effect

    // open the live quiz editing dialog and update all instances of the multiple choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')

    cy.get('[data-cy="update-all-outdated-instances"]').click() // update all outdated instances in the activity
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-block-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-block-1"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the live quiz went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.liveQuizName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.liveQuizName}"]`
    ).click()

    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    // open the practice quiz editing dialog and update all instances of the multiple choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')

    cy.get('[data-cy="update-all-outdated-instances"]').click() // update all outdated instances in the activity
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the practice quiz went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.practiceQuizName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.practiceQuizName}"]`
    ).click()

    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    // open the microlearning editing dialog and update all instances of the multiple choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')

    cy.get('[data-cy="update-all-outdated-instances"]').click() // update all outdated instances in the activity
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-1"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-1"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the microlearning went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.instanceUpdates.microlearningName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.microlearningName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.microlearningName}"]`
    ).click()
    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="activity-details-accordion-trigger-1"]').click()
    cy.get('[data-cy="stack-1-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-1-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()

    // open the group activity editing dialog and update all instances of the multiple choice question
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.wait(1000) // wait for the query to finish
    cy.get('[data-cy="update-all-outdated-instances"]').should('exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')

    cy.get('[data-cy="update-all-outdated-instances"]').click() // update all outdated instances in the activity
    cy.wait(1000) // wait for the refetch to complete
    cy.get('[data-cy="update-all-outdated-instances"]').should('not.exist')
    cy.get('[data-cy="update-element-0-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-1-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-2-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-3-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-4-stack-0"]').should('not.exist')
    cy.get('[data-cy="update-element-5-stack-0"]').should('not.exist')
    cy.get('[data-cy="next-or-submit"]').click()

    // verify that the instance update for the group activity went into effect
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('exist')
    cy.get(
      `[data-cy="instances-outdated-${this.data.instanceUpdates.groupActivityName}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-name-${this.data.instanceUpdates.groupActivityName}"]`
    ).click()
    cy.get('[data-cy="activity-details-accordion-trigger-0"]').click()
    cy.get('[data-cy="stack-0-instance-0"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-1"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-2"]').contains(this.data.KPML.title)
    cy.get('[data-cy="stack-0-instance-3"]').contains(
      this.data.instanceUpdates.newSCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-4"]').contains(
      this.data.instanceUpdates.newMCTitle
    ) // updated title
    cy.get('[data-cy="stack-0-instance-5"]').contains(this.data.KPML.title)
    cy.get('[data-cy="close-activity-details-modal"]').click()
  })
})
