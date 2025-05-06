import { SharingObjectType } from '@klicker-uzh/types'
import messages from '../../../packages/i18n/messages/en'

// global variable for ensured consistency with current dates
const currentYear = new Date().getFullYear()

describe('Create different types of elements (with and without sample solution) and edit them', function () {
  before(() => {
    cy.seed()
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

  // ! Part 1: Question duplication
  // #region
  it('Create a new question, duplicates it and then deletes them again', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(
      this.data.duplication.title
    )
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.duplication.content)
    cy.get('[data-cy="insert-answer-field-0"]').realClick().type('50%')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]').realClick().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // duplicate question and save
    cy.get(
      `[data-cy="duplicate-element-${this.data.duplication.title}"]`
    ).click()
    cy.wait(500)
    cy.findByText(messages.manage.elements.DUPLICATETitle).should('exist')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // check if duplicated question exists alongside original question
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).should('exist')
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).contains(messages.shared.DRAFT.statusLabel)

    // delete the created and duplicated question
    cy.deleteElement({ elementName: `${this.data.duplication.title} (Copy)` })
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title} (Copy)"]`
    ).should('not.exist')
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.deleteElement({ elementName: this.data.duplication.title })
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'not.exist'
    )
  })
  // #endregion

  // ! Part 2: Auto-Save functionality for Elements
  // #region
  function enterSCQuestionContent(data) {
    cy.get('[data-cy="insert-question-title"]').type(data.autoSave.title)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(data.autoSave.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(data.autoSave.choices[0].value)
    cy.wrap(data.autoSave.choices.slice(1)).each(
      (choice: { value: string }, ix) => {
        cy.get('[data-cy="add-new-answer"]').click()
        cy.wait(500)
        cy.get(`[data-cy="insert-answer-field-${ix + 1}"]`)
          .realClick()
          .type(choice.value)
      }
    )
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.wrap(data.autoSave.choices).each((choice: { correct?: boolean }, ix) => {
      if (choice.correct) {
        cy.get(`[data-cy="set-correctness-${ix}"]`).click()
      }
    })
  }

  it('Verify that empty questions are not stored in local storage (creation)', function () {
    cy.loginLecturer()

    // open modal, wait for auto-save, close modal
    cy.get('[data-cy="create-question"]').click()
    cy.wait(3000) // wait longer than auto-save requires
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="select-question-type"]').contains(
      messages.shared.SC.typeLabel
    )
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that non-empty questions are stored and loaded correctly on demand (creation)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // re-open modal, load data, verify content, close modal
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.autoSave.content)
    cy.wrap(this.data.autoSave.choices).each(
      (choice: { value: string }, ix) => {
        cy.get(`[data-cy="insert-answer-field-${ix}"]`).contains(choice.value)
      }
    )
  })

  it('Verify that non-empty questions are stored and discarded on request (creation)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="discard-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that local storage is correctly cleared after creating a question', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // check that local storage is cleared correctly on save and new editor is empty
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that opening the edit modal and closing without modifications does not trigger prompt', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
  })

  it('Verify that after editing a question and waiting for auto-save the corresponding content can be loaded', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown & load data, verify updated content is visible
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
  })

  it('Verify that after editing a question, auto-saving and discarding the saved content, the original content is loaded', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown & discard data, verify original content is visible
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.wait(3000)
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that when closing and opening now after discarding, no prompt is shown
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that after editing an element and saving it, no prompt is shown to the user', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="save-new-question"]').click()

    // recovery prompt should not be shown, verify edited content is visible
    cy.get(`[data-cy="edit-element-${this.data.autoSave.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
  })

  it('Verify that when duplicating a question, wating for auto-save and opening the creation form, the content cannot be loaded', function () {
    cy.loginLecturer()
    cy.get(
      `[data-cy="duplicate-element-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the duplicated
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that when duplicating a question, modifying it slightly,wating for auto-save and opening the creation form, the content can be loaded', function () {
    cy.loginLecturer()
    cy.get(
      `[data-cy="duplicate-element-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited2)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the duplicated
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited2
    )
  })

  it('Cleanup: Delete the auto-saved element', function () {
    cy.loginLecturer()
    cy.deleteElement({ elementName: this.data.autoSave.titleEdited })
  })
  // #endregion

  // ! Part 3: Element instance updates
  // #region
  // helper function to publish / start one instance of each activity type with the defined name
  function publishSetOfActivities({
    course,
    liveQuiz,
    practiceQuiz,
    microlearning,
    groupActivity,
  }: {
    course: string
    liveQuiz: string
    practiceQuiz: string
    microlearning: string
    groupActivity: string
  }) {
    // start the first live quiz and open the first block
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="start-live-quiz-${liveQuiz}"]`).click()
    cy.wait(500)
    cy.get('[data-cy="next-block-timeline"]').click()
    cy.wait(500)

    // publish the first practice quiz
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="publish-practice-quiz-${practiceQuiz}"]`).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
    cy.get(`[data-cy="practice-quiz-${practiceQuiz}"]`).contains(
      messages.shared.generic.published
    )

    // publish the first microlearning
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(`[data-cy="publish-microlearning-${microlearning}"]`)
      .contains(messages.manage.course.publishMicrolearning)
      .click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="microlearning-${microlearning}"]`).contains(
      messages.shared.generic.published
    )

    // publish the first group activity
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get(`[data-cy="publish-groupActivity-${groupActivity}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${groupActivity}"]`)
      .findByText(messages.shared.generic.running)
      .should('exist')
  }

  function verifySingleChoiceQuestionContent({ submission, content, choices }) {
    // validate question content
    cy.get('[data-cy="instance-question-content"]').contains(content)

    // validate choices content
    cy.wrap(choices).each(
      (choice: { value: string; feedback?: string }, ix) => {
        cy.get(`[data-cy="sc-0-answer-option-${ix}"]`).contains(choice.value)
      }
    )

    // in practice quizzes and microlearnings, submit an answer and verify the feedbacks as well
    if (submission) {
      cy.get('[data-cy="sc-0-answer-option-0"]').click()
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.wrap(choices).each(
        (choice: { value: string; feedback?: string }, ix) => {
          cy.get(`[data-cy="sc-0-feedback-${ix}"]`).contains(choice.feedback)
        }
      )
    }
  }

  it('Create a single choice question with sample solution and answer feedbacks', function () {
    cy.loginLecturer()

    cy.createQuestionSC({
      name: this.data.update.title1,
      content: this.data.update.content1,
      choices: this.data.update.choices1,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Include the single choice question in three activities of each type', function () {
    cy.loginLecturer()

    // create three live quizzes
    cy.wrap([
      this.data.update.liveQuiz1,
      this.data.update.liveQuiz2,
      this.data.update.liveQuiz3,
    ]).each((quiz: string) => {
      cy.createLiveQuiz({
        name: quiz,
        displayName: quiz,
        courseName: this.data.update.course,
        blocks: [{ elements: [this.data.update.title1] }],
      })
      cy.get('[data-cy="create-new-element"]').click()
    })

    // create three practice quizzes
    cy.wrap([
      this.data.update.practiceQuiz1,
      this.data.update.practiceQuiz2,
      this.data.update.practiceQuiz3,
    ]).each((quiz: string) => {
      cy.createPracticeQuiz({
        name: quiz,
        displayName: quiz,
        courseName: this.data.update.course,
        stacks: [{ elements: [this.data.update.title1] }],
      })
      cy.get('[data-cy="create-new-element"]').click()
    })

    // create three microlearnings
    cy.wrap([
      this.data.update.microlearning1,
      this.data.update.microlearning2,
      this.data.update.microlearning3,
    ]).each((ml: string) => {
      cy.createMicroLearning({
        name: ml,
        displayName: ml,
        startDate: `${currentYear - 1}-01-01T02:00`,
        endDate: `${currentYear + 1}-01-01T02:00`,
        courseName: this.data.update.course,
        stacks: [{ elements: [this.data.update.title1] }],
      })
      cy.get('[data-cy="create-new-element"]').click()
    })

    // create three group activities
    cy.wrap([
      this.data.update.groupActivity1,
      this.data.update.groupActivity2,
      this.data.update.groupActivity3,
    ]).each((ga: string) => {
      cy.createGroupActivity({
        name: ga,
        displayName: ga,
        task: 'Task Description',
        courseName: this.data.update.course,
        scheduledStartDate: `${currentYear - 1}-01-01T02:00`,
        scheduledEndDate: `${currentYear + 1}-01-01T02:00`,
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
          elements: [this.data.update.title1],
        },
      })
      cy.get('[data-cy="create-new-element"]').click()
    })
  })

  it('Start one activity of each type (and open the first block for the live quiz', function () {
    cy.loginLecturer()

    publishSetOfActivities({
      course: this.data.update.course,
      liveQuiz: this.data.update.liveQuiz1,
      practiceQuiz: this.data.update.practiceQuiz1,
      microlearning: this.data.update.microlearning1,
      groupActivity: this.data.update.groupActivity1,
    })
  })

  it('Update the content of the single choice question (including answer feedbacks) and trigger instance updates', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.update.title1}"]`).click()

    // update content of the question
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.update.title2)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.update.content2)

    // update choices of the question
    cy.wrap(this.data.update.choices2).each((choice: { value: string }, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .clear()
        .type(choice.value)
    })

    // update feedbacks of the question
    cy.wrap(this.data.update.choices2).each(
      (choice: { feedback: string }, ix) => {
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
          .realClick()
          .clear()
          .type(choice.feedback)
      }
    )

    // trigger instance updates and verify that list of shown activities that should be updates is correct
    cy.get('[data-cy="instance-update-switch"]').click()
    cy.wrap([
      this.data.update.liveQuiz2,
      this.data.update.practiceQuiz2,
      this.data.update.microlearning2,
      this.data.update.groupActivity2,
      this.data.update.liveQuiz3,
      this.data.update.practiceQuiz3,
      this.data.update.microlearning3,
      this.data.update.groupActivity3,
    ]).each((activityName: string) => {
      cy.get(
        `[data-cy="instance-update-list-activity-${activityName}"]`
      ).should('exist')
    })
    cy.wrap([
      this.data.update.liveQuiz1,
      this.data.update.practiceQuiz1,
      this.data.update.microlearning1,
      this.data.update.groupActivity1,
    ]).each((activityName: string) => {
      cy.get(
        `[data-cy="instance-update-list-activity-${activityName}"]`
      ).should('not.exist')
    })

    // save modified question
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Publish / start the second set of activities', function () {
    cy.loginLecturer()

    publishSetOfActivities({
      course: this.data.update.course,
      liveQuiz: this.data.update.liveQuiz2,
      practiceQuiz: this.data.update.practiceQuiz2,
      microlearning: this.data.update.microlearning2,
      groupActivity: this.data.update.groupActivity2,
    })
  })

  it('Edit the question again and disable the sample solution, verify that no instances in practice quizzes / microlearnings are updated', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-element-${this.data.update.title2}"]`).click()

    // update content of the question
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.update.title3)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.update.content3)

    // update choices of the question
    cy.wrap(this.data.update.choices3).each((choice: { value: string }, ix) => {
      cy.get(`[data-cy="insert-answer-field-${ix}"]`)
        .realClick()
        .clear()
        .type(choice.value)
    })

    // disable sample solution
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })

    // trigger instance updates and verify that list of shown activities that should be updates is correct
    cy.get('[data-cy="instance-update-switch"]').click()
    cy.wrap([this.data.update.liveQuiz3, this.data.update.groupActivity3]).each(
      (activityName: string) => {
        cy.get(
          `[data-cy="instance-update-list-activity-${activityName}"]`
        ).should('exist')
      }
    )
    cy.wrap([
      this.data.update.liveQuiz1,
      this.data.update.practiceQuiz1,
      this.data.update.microlearning1,
      this.data.update.groupActivity1,
      this.data.update.liveQuiz2,
      this.data.update.practiceQuiz2,
      this.data.update.microlearning2,
      this.data.update.groupActivity2,
      this.data.update.practiceQuiz3,
      this.data.update.microlearning3,
    ]).each((activityName: string) => {
      cy.get(
        `[data-cy="instance-update-list-activity-${activityName}"]`
      ).should('not.exist')
    })

    // save modified question
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Publish / start all remaining activities', function () {
    cy.loginLecturer()

    publishSetOfActivities({
      course: this.data.update.course,
      liveQuiz: this.data.update.liveQuiz3,
      practiceQuiz: this.data.update.practiceQuiz3,
      microlearning: this.data.update.microlearning3,
      groupActivity: this.data.update.groupActivity3,
    })
  })

  it('Verify from a student perspective that all live quizzes have been correctly updated', function () {
    cy.loginStudent()

    // check out first live quiz with original content
    cy.findByText(this.data.update.liveQuiz1).click()
    verifySingleChoiceQuestionContent({
      submission: false,
      content: this.data.update.content1,
      choices: this.data.update.choices1,
    })

    // check out the second live quiz with updated content 1
    cy.get('[data-cy="header-home"]').click()
    cy.findByText(this.data.update.liveQuiz2).click()
    verifySingleChoiceQuestionContent({
      submission: false,
      content: this.data.update.content2,
      choices: this.data.update.choices2,
    })

    // check out the third live quiz with updated content 2
    cy.get('[data-cy="header-home"]').click()
    cy.findByText(this.data.update.liveQuiz3).click()
    verifySingleChoiceQuestionContent({
      submission: false,
      content: this.data.update.content3,
      choices: this.data.update.choices3,
    })
  })

  it('Verify from a student perspective that all practice quizzes have been correctly updated', function () {
    cy.loginStudent()

    // check out the first practice quiz with original content
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.update.practiceQuiz1}"]`
    ).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    verifySingleChoiceQuestionContent({
      submission: true,
      content: this.data.update.content1,
      choices: this.data.update.choices1,
    })

    // check out the second practice quiz with updated content 1
    cy.get('[data-cy="header-home"]').click()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.update.practiceQuiz2}"]`
    ).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    verifySingleChoiceQuestionContent({
      submission: true,
      content: this.data.update.content2,
      choices: this.data.update.choices2,
    })

    // check out the third practice quiz with updated content 1 (no sample solution provided during last update)
    cy.get('[data-cy="header-home"]').click()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-${this.data.update.practiceQuiz3}"]`
    ).click()
    cy.get('[data-cy="start-practice-quiz"]').click()
    verifySingleChoiceQuestionContent({
      submission: true,
      content: this.data.update.content2,
      choices: this.data.update.choices2,
    })
  })

  it('Verify from a student perspective that all microlearnings have been correctly updated', function () {
    cy.loginStudent()

    // check out the first microlearning with original content
    cy.get(
      `[data-cy="microlearning-${this.data.update.microlearning1}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()
    verifySingleChoiceQuestionContent({
      submission: true,
      content: this.data.update.content1,
      choices: this.data.update.choices1,
    })

    // check out the second microlearning with updated content 1
    cy.get('[data-cy="header-home"]').click()
    cy.get(
      `[data-cy="microlearning-${this.data.update.microlearning2}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()
    verifySingleChoiceQuestionContent({
      submission: true,
      content: this.data.update.content2,
      choices: this.data.update.choices2,
    })

    // check out the third microlearning with updated content 1 (no sample solution provided during last update)
    cy.get('[data-cy="header-home"]').click()
    cy.get(
      `[data-cy="microlearning-${this.data.update.microlearning3}"]`
    ).click()
    cy.get('[data-cy="start-microlearning"]').click()
    verifySingleChoiceQuestionContent({
      submission: true,
      content: this.data.update.content2,
      choices: this.data.update.choices2,
    })
  })

  it('Verify from a student perspective that all group activities have been correctly updated', function () {
    cy.loginStudent()

    // check out the first group activity with original content
    cy.get(`[data-cy="course-button-${this.data.update.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.update.groupActivity1}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
    verifySingleChoiceQuestionContent({
      submission: false,
      content: this.data.update.content1,
      choices: this.data.update.choices1,
    })

    // check out the second group activity with updated content 1
    cy.get('[data-cy="header-home"]').click()
    cy.get(`[data-cy="course-button-${this.data.update.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.update.groupActivity2}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
    verifySingleChoiceQuestionContent({
      submission: false,
      content: this.data.update.content2,
      choices: this.data.update.choices2,
    })

    // check out the third group activity with the latest content
    cy.get('[data-cy="header-home"]').click()
    cy.get(`[data-cy="course-button-${this.data.update.course}"]`).click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(
      `[data-cy="open-group-activity-${this.data.update.groupActivity3}"]`
    ).click()
    cy.get('[data-cy="start-group-activity"]').click()
    verifySingleChoiceQuestionContent({
      submission: false,
      content: this.data.update.content3,
      choices: this.data.update.choices3,
    })
  })

  it('Cleanup: Delete the created single choice questions and all created activities', function () {
    cy.loginLecturer()

    // delete the created element
    cy.deleteElement({ elementName: this.data.update.title3 })

    // end all created and running live quizzes and delete them
    cy.get('[data-cy="activities"]').click()
    cy.wrap([
      this.data.update.liveQuiz1,
      this.data.update.liveQuiz2,
      this.data.update.liveQuiz3,
    ]).each((quiz: string) => {
      // open lecturer cockpit
      cy.get(`[data-cy="live-quiz-cockpit-${quiz}"]`).click()
      cy.wait(1000)

      // end live quiz
      cy.get('[data-cy="next-block-timeline"]').click()
      cy.wait(500)
      cy.get('[data-cy="next-block-timeline"]').click()
      cy.wait(500)

      // delete live quiz
      cy.reload() // TODO: resolve issue that causes this to be required -> cache update works correctly locally
      cy.get(`[data-cy="actions-live-quiz-${quiz}"]`).realClick()
      cy.get(`[data-cy="delete-live-quiz-${quiz}"]`).click()
      cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
    })

    // delete all practice quizzes
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.update.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.wrap([
      this.data.update.practiceQuiz1,
      this.data.update.practiceQuiz2,
      this.data.update.practiceQuiz3,
    ]).each((quiz: string) => {
      cy.get(`[data-cy="practice-quiz-actions-${quiz}"]`).click()
      cy.get(`[data-cy="delete-practice-quiz-${quiz}"]`).click()
      cy.get(`[data-cy="confirm-deletion-responses"]`).click()
      cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
      cy.get(`[data-cy="practice-quiz-actions-${quiz}"]`).should('not.exist')
    })

    // delete all microlearnings
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.wrap([
      this.data.update.microlearning1,
      this.data.update.microlearning2,
      this.data.update.microlearning3,
    ]).each((ml: string) => {
      cy.get(`[data-cy="microlearning-actions-${ml}"]`).click()
      cy.get(`[data-cy="delete-microlearning-${ml}"]`).click()
      cy.get(`[data-cy="confirm-deletion-responses"]`).click()
      cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
      cy.get(`[data-cy="microlearning-actions-${ml}"]`).should('not.exist')
    })

    // delete all group activities
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.wrap([
      this.data.update.groupActivity1,
      this.data.update.groupActivity2,
      this.data.update.groupActivity3,
    ]).each((ga: string) => {
      cy.get(`[data-cy="groupActivity-actions-${ga}"]`).click()
      cy.get(`[data-cy="delete-groupActivity-${ga}"]`).click()
      cy.get(`[data-cy="confirm-deletion-started-instances"]`).click()
      cy.get(`[data-cy="confirmation-modal-confirm"]`).click()
      cy.get(`[data-cy="groupActivity-actions-${ga}"]`).should('not.exist')
    })
  })
  // #endregion

  // ! Part 4: Sharing functionalities for elements (restricted catalog collection)
  // #region
  it('Create a selection question', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Add the question as a restricted collection to the catalog', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add question to catalog as restricted object
    cy.addObjectToCatalog({
      objectName: this.data.SEML.title,
      objectType: SharingObjectType.ELEMENT,
      permissionLevel: 'restricted',
    })

    // check that import and request functionalities are not available for owner (but deletion is)
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="remove-object-${this.data.SEML.title}"]`).should('exist')
  })

  it('Test filters and search on the catalog page', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // test search
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get('[data-cy="search-catalog-collection"]')
      .click()
      .type('SOME NON-EXISTING TITLE')
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="search-catalog-collection"]')
      .clear()
      .type(this.data.SEML.title)
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')

    // test access type filters
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get('[data-cy="catalog-access-type-filter"]').contains(
      messages.manage.catalog.all
    )
    cy.get('[data-cy="catalog-access-type-filter"]').click()
    cy.get('[data-cy="catalog-access-public"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="catalog-access-type-filter"]').click()
    cy.get('[data-cy="catalog-access-restricted"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get('[data-cy="catalog-access-type-filter"]').click()
    cy.get('[data-cy="catalog-access-all"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
  })

  it('Request access to restricted question (for user pro1)', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="cancel-request-access"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Request access to restricted question (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that access requests are correctly shown to collection owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro1"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('exist')
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro2"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('exist')
  })

  it('Temporarily award ADMIN permissions to user pro3 and verify that the access requests are visible as well', function () {
    // grant ADMIN permissions to user pro3 through direct sharing
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST2_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
    cy.logoutUser()

    // verify that access requests are visible to user pro3
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro1"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('exist')
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro2"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('exist')
    cy.logoutUser()

    // revoke direct ADMIN permissions again
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SEML.title}"]`).click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')
    cy.logoutUser()

    // verify that the access requests are not visible anymore to user pro3
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro1"]`).should(
      'not.exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('not.exist')
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro2"]`).should(
      'not.exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('not.exist')
  })

  it('Cancel the request through user pro1 and request the element again', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).contains(
      messages.manage.catalog.accessRequested
    )

    // cancel the request
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="cancel-request-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-request-cancellation"]').click()

    // request the question again (should be possible)
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending again
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Grant access to restricted question (for user pro1)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="permission-level-select"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Decline access request to restricted question (for user pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro2"]`
    ).click()
  })

  it("Verify that the active permission for user 'pro1' is shown correctly", function () {
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it('Verify that restricted question is visible for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
  })

  it('Verify that restricted question is not visible for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
  })

  it('Change the access level of the question in the catalog to public', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get(`[data-cy="${this.data.SEML.title}-object-access"]`).contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get(`[data-cy="${this.data.SEML.title}-object-access"]`).realClick()
    cy.get('[data-cy="object-access-restricted"]').should('exist')
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="confirm-access-change"]').click()
    cy.get(`[data-cy="${this.data.SEML.title}-object-access"]`).contains(
      messages.manage.catalog.accessPUBLIC
    )
  })

  it('Verify that question can now be imported or requested', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')

    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).should('exist')

    // no owner / admin actions are available
    cy.get(`[data-cy="remove-object-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="${this.data.SEML.title}-object-access"]`).should(
      'not.exist'
    )
  })

  it('Remove the question from the catalog (by owner)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="remove-object-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-removal"]').click()
  })

  it('Verify that the question is no longer visible in the catalog', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
  })

  it('Re-add the question with restricted access to the restricted catalog collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.addObjectToCatalog({
      objectName: this.data.SEML.title,
      objectType: SharingObjectType.ELEMENT,
      permissionLevel: 'restricted',
    })
  })

  it("Grant admin access to user 'pro2' for the restricted question", function () {
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').clear()
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Verify that user pro2 should now be able to add this question to the catalog', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(`[data-cy="object-type-${SharingObjectType.ELEMENT}"]`).click()
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).should('exist')
  })

  it('Cleanup: Reset the database', function () {
    cy.cleanup()
    cy.seed()
  })
  // #endregion

  // ! Part 5: Sharing functionalities for elements (public catalog collection)
  // #region
  it('Create a selection question', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Add the question with public access to the catalog and verify visibility', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.addObjectToCatalog({
      objectName: this.data.SEML.title,
      objectType: SharingObjectType.ELEMENT,
      permissionLevel: 'public',
    })

    // question should be visible to owner, but cannot be requested / imported
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="remove-object-${this.data.SEML.title}"]`).should('exist')
  })

  it("Request access to the public question (for user 'pro1')", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).click()
    cy.findByText(messages.manage.catalog.requestPublicResource)
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it("Request access to the public question (for user 'pro2')", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that access requests are correctly shown to question owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro1"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro1"]`
    ).should('exist')
    cy.get(`[data-cy="sharing-request-${this.data.SEML.title}-pro2"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro2"]`
    ).should('exist')
  })

  it('Grant access to public question (for user pro1)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.SEML.title}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="permission-level-select"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Decline access request to public question (for user pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.SEML.title}-pro2"]`
    ).click()
  })

  it("Verify that the active permission for user 'pro1' is shown correctly", function () {
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SEML.title}"]`).click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it("Verify that the public question is visible for user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
  })

  it("Verify that the public question is not visible for user 'pro2'", function () {
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
  })

  it('Import (and copy) the public question (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="close-object-import-modal"]').click()

    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="cancel-object-import"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.SEML.title}"]`).click()
    cy.get('[data-cy="confirm-object-import"]').click()

    // check that the collection is visible in resources
    cy.get('[data-cy="library"]').click()
    cy.reload() // make sure data is refetched (works without - this is to avoid race conditions in testing)
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
  })

  it('Verify that imported question is visible to user pro2 (copied and with edit permissions)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="edit-element-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="duplicate-element-${this.data.SEML.title}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-element-${this.data.SEML.title}"]`).should(
      'exist'
    )
  })

  it('Remove the public question from user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
    cy.get(`[data-cy="remove-element-${this.data.SEML.title}"]`).click()

    cy.get('[data-cy="confirm-deletion-final"]').click()
    cy.get('[data-cy="confirm-derived-access"]').click()
    cy.get('[data-cy="confirm-dependency-access"]').click()
    cy.get('[data-cy="confirmation-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.SEML.title}"]`).should(
      'not.exist'
    )
  })

  it('Delete the original public question', function () {
    cy.loginLecturer()
    cy.deleteElement({ elementName: this.data.SEML.title })
  })

  it('Verify that imported question is still visible to user pro2 (due to derived permission)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
  })

  it('Remove the imported question from user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.deleteElement({ elementName: this.data.SEML.title })
  })

  it('Cleanup: Reset the database', function () {
    cy.cleanup()
    cy.seed()
  })
  // #endregion

  // ! Part 6: Direct sharing / enabled functionalities
  // #region
  it('Create a single choice question and share it with different permission levels', function () {
    // create SC question
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // share it directly with READ, WRITE and ADMIN permissions with the users pro1, pro2 and pro3, respectively
    cy.get(`[data-cy="actions-element-${this.data.SCML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SCML.title}"]`).click()

    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_IND_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)

    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST2_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Verify that the user with granted access are able to access the correct element manipulation functionalities', function () {
    // READ permissions should enable a user to duplicate the element (no editing, no re-use, no deletion / sharing)
    cy.loginIndividualCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`).should('exist')
    cy.get(`[data-cy="edit-element-${this.data.SCML.title}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="duplicate-element-${this.data.SCML.title}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-element-${this.data.SCML.title}"]`).should(
      'not.exist'
    )
    cy.logoutUser()

    // WRITE permissions should enable a user to duplicate or edit the element (no re-use, no deletion / sharing)
    cy.loginInstitutionalCatalyst()
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`).should('exist')
    cy.get(`[data-cy="edit-element-${this.data.SCML.title}"]`).should('exist')
    cy.get(`[data-cy="duplicate-element-${this.data.SCML.title}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-element-${this.data.SCML.title}"]`).should(
      'not.exist'
    )
    cy.logoutUser()

    // ADMIN permissions should enable a user to duplicate, edit, delete or share the element
    cy.loginInstitutionalCatalyst2()
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`).should('exist')
    cy.get(`[data-cy="edit-element-${this.data.SCML.title}"]`).should('exist')
    cy.get(`[data-cy="duplicate-element-${this.data.SCML.title}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-element-${this.data.SCML.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SCML.title}"]`).should('exist')
    cy.get(`[data-cy="delete-element-${this.data.SCML.title}"]`).should('exist')
  })

  it('Cleanup: Delete the created question again and verify deletion', function () {
    cy.loginLecturer()
    cy.deleteElement({ elementName: this.data.SCML.title })
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`).should(
      'not.exist'
    )

    cy.loginIndividualCatalyst()
    cy.reload()
    cy.get(`[data-cy="element-item-${this.data.SCML.title}"]`).should(
      'not.exist'
    )
  })

  it('Create user groups with all users and prepare a new selection question (incl. answer collection) for user group sharing', function () {
    // create catalog collection with restricted access
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.SEML2.title,
      content: this.data.SEML2.content,
      numberOfInputs: this.data.SEML2.inputs,
      collectionName: this.data.collection.name,
      correctAnswers: this.data.collection.options.filter((_, i) =>
        this.data.SEML2.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
    })

    // create user group with users 1 (OWNER) and pro1 (MEMBER)
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group1)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME')) // pro1 is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.group1}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.group1}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.group1}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.group1}"]`).should('exist')
    cy.get(`[data-cy="delete-group-${this.data.group1}"]`).should('exist')
    cy.get(`[data-cy="view-edit-group-${this.data.group1}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()

    // create user group with users 1 (OWNER) and pro2 (ADMIN)
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group2)
    cy.get('[data-cy="cancel-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group2)

    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST_EMAIL')) // pro2 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.group2}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.group2}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.group2}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.group2}"]`).should('exist')
    cy.get(`[data-cy="delete-group-${this.data.group2}"]`).should('exist')
    cy.get(`[data-cy="view-edit-group-${this.data.group2}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()
    cy.logoutUser()

    // create user group with users 1 (MEMBER) and pro3 (OWNER)
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group3)
    cy.get('[data-cy="cancel-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group3)

    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_SHORTNAME')) // lecturer is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.group3}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.group3}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.group3}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.group3}"]`).should('exist')
    cy.get(`[data-cy="delete-group-${this.data.group3}"]`).should('exist')

    cy.get(`[data-cy="view-edit-group-${this.data.group3}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()
    cy.logoutUser()
  })

  it('Grant direct READ, WRITE and ADMIN permissions to the element for the user groups', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="actions-element-${this.data.SEML2.title}"]`).click()
    cy.get(`[data-cy="share-element-${this.data.SEML2.title}"]`).click()

    // grant direct READ permissions to group 1
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-user-group"]').realClick()
    cy.get(`[data-cy="user-group-${this.data.group1}"]`).click()
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group1)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${this.data.group1}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)

    // grant direct WRITE permissions to group 2
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.get('[data-cy="new-permission-user-group"]').realClick()
    cy.get(`[data-cy="user-group-${this.data.group2}"]`).click()
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group2)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${this.data.group2}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // grant direct ADMIN permissions to group 3
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.get('[data-cy="new-permission-user-group"]').realClick()
    cy.get(`[data-cy="user-group-${this.data.group3}"]`).click()
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group3)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${this.data.group3}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Verify that the users in group 1 have been granted READ permissions on the element and contained answer collection', function () {
    cy.loginIndividualCatalyst()

    // check that the shared element is available with the correct permissions
    cy.get(`[data-cy="element-item-${this.data.SEML2.title}"]`).should('exist')
    cy.get(`[data-cy="duplicate-element-${this.data.SEML2.title}"]`).should(
      'exist'
    )

    // check that the contained answer collection is available with READ permissions
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.collection.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.collection.options).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Verify that the users in group 2 have been granted WRITE permissions on the element and contained answer collection', function () {
    cy.loginInstitutionalCatalyst()

    // check that the shared element is available with the correct permissions
    cy.get(`[data-cy="element-item-${this.data.SEML2.title}"]`).should('exist')
    cy.get(`[data-cy="duplicate-element-${this.data.SEML2.title}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="edit-element-${this.data.SEML2.title}"]`).should('exist')

    // check that the contained answer collection is available with READ permissions
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.collection.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.collection.options).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Verify that the users in group 3 have been granted ADMIN permissions on the element and contained answer collection', function () {
    cy.loginInstitutionalCatalyst2()

    // check that the shared element is available with the correct permissions
    cy.get(`[data-cy="element-item-${this.data.SEML2.title}"]`).should('exist')
    cy.get(`[data-cy="duplicate-element-${this.data.SEML2.title}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="edit-element-${this.data.SEML2.title}"]`).should('exist')
    cy.get(`[data-cy="actions-element-${this.data.SEML2.title}"]`).should(
      'exist'
    )

    // check that the contained answer collection is available with READ permissions
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.collection.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.collection.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.collection.options).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })
  // #endregion
})
