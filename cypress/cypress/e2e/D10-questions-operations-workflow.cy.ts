import messages from '../../../packages/i18n/messages/en'

// global variable for ensured consistency with current dates
const currentYear = new Date().getFullYear()

describe('Create different types of elements (with and without sample solution) and edit them', function () {
  beforeEach('Load data fixture', function () {
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })
  })

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
      `[data-cy="duplicate-question-${this.data.duplication.title}"]`
    ).click()
    cy.wait(500)
    cy.findByText(messages.manage.questionForms.DUPLICATETitle).should('exist')
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
    cy.get(
      `[data-cy="delete-question-${this.data.duplication.title} (Copy)"]`
    ).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).should('not.exist')
    cy.get(`[data-cy="delete-question-${this.data.duplication.title}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
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
      .type(data.autoSave.choices[0].content)
    cy.wrap(data.autoSave.choices.slice(1)).each(
      (choice: { content: string }, ix) => {
        cy.get('[data-cy="add-new-answer"]').click()
        cy.wait(500)
        cy.get(`[data-cy="insert-answer-field-${ix + 1}"]`)
          .realClick()
          .type(choice.content)
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
      (choice: { content: string }, ix) => {
        cy.get(`[data-cy="insert-answer-field-${ix}"]`).contains(choice.content)
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
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
  })

  it('Verify that after editing a question and waiting for auto-save the corresponding content can be loaded', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

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
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
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
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

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
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
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
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that after editing an element and saving it, no prompt is shown to the user', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

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
    cy.get(
      `[data-cy="edit-question-${this.data.autoSave.titleEdited}"]`
    ).click()
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
      `[data-cy="duplicate-question-${this.data.autoSave.titleEdited}"]`
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
      `[data-cy="duplicate-question-${this.data.autoSave.titleEdited}"]`
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
    cy.get('[data-cy="live-quizzes"]').click()
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
      (choice: { content: string; feedback?: string }, ix) => {
        cy.get(`[data-cy="sc-0-answer-option-${ix}"]`).contains(choice.content)
      }
    )

    // in practice quizzes and microlearnings, submit an answer and verify the feedbacks as well
    if (submission) {
      cy.get('[data-cy="sc-0-answer-option-0"]').click()
      cy.get('[data-cy="student-stack-submit"]').click()
      cy.wrap(choices).each(
        (choice: { content: string; feedback?: string }, ix) => {
          cy.get(`[data-cy="sc-0-feedback-${ix}"]`).contains(choice.feedback)
        }
      )
    }
  }

  it('Create a single choice question with sample solution and answer feedbacks', function () {
    cy.loginLecturer()

    cy.createQuestionSC({
      title: this.data.update.title1,
      content: this.data.update.content1,
      choices: this.data.update.choices1,
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
    cy.get(`[data-cy="edit-question-${this.data.update.title1}"]`).click()

    // update content of the question
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.update.title2)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.update.content2)

    // update choices of the question
    cy.wrap(this.data.update.choices2).each(
      (choice: { content: string }, ix) => {
        cy.get(`[data-cy="insert-answer-field-${ix}"]`)
          .realClick()
          .clear()
          .type(choice.content)
      }
    )

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
    cy.get(`[data-cy="edit-question-${this.data.update.title2}"]`).click()

    // update content of the question
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.update.title3)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.update.content3)

    // update choices of the question
    cy.wrap(this.data.update.choices3).each(
      (choice: { content: string }, ix) => {
        cy.get(`[data-cy="insert-answer-field-${ix}"]`)
          .realClick()
          .clear()
          .type(choice.content)
      }
    )

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
    cy.get('[data-cy="live-quizzes"]').click()
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
      cy.get(`[data-cy="delete-live-quiz-${quiz}"]`).click()
      cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
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
      cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
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
      cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
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
      cy.get(`[data-cy="activity-confirmation-modal-confirm"]`).click()
      cy.get(`[data-cy="groupActivity-actions-${ga}"]`).should('not.exist')
    })
  })

  // ! Verification
  // #region
  it('Verify that all answer collections have been deleted successfully', function () {
    cy.loginLecturer()

    // validate that no collections except from the seeded ones remain
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
  // #endregion
})
