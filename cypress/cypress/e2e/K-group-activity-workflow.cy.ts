import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

describe('Create and solve a group activity', () => {
  it('create a group activity and edit it', function () {
    const questionTitle = uuid()
    const question = uuid()

    const random = Math.floor(Math.random() * 1000)
    const name = 'Test Group Activity ' + random
    const displayName = 'Test Group Activity Display Name ' + random
    const description = 'Test Group Activity Description ' + random
    const courseName = 'Testkurs'
    const currentYear = new Date().getFullYear()

    cy.loginLecturer()

    // set up question with solution
    cy.get('[data-cy="questions"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle)
    cy.get('[data-cy="insert-question-text"]').click().type(question)
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="insert-answer-field-0"]').click().type('50%')
    cy.get('[data-cy="set-correctness"]').click({ force: true })
    cy.get('[data-cy="add-new-answer"]').click({ force: true })
    cy.get('[data-cy="insert-answer-field-1"]').click().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })

    // fill out first step of creation process
    cy.get('[data-cy="create-group-activity"]').click()
    cy.get('[data-cy="insert-groupactivity-name"]').click().type(name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .type(displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .focus()
      .type(description)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // fill out the settings of the group activity
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
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
    cy.get('[data-cy="select-start-date"]')
      .click()
      .type(`${currentYear + 1}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear + 1}-12-31T18:00`)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // add clues to the group activity
    // create 1 text clue and two numerical clues (one with and one without unit)
    const clueName = 'Test Clue ' + random
    const clueDisplayName = 'Test Clue Display Name ' + random
    const clueContent = 'Test Clue Content ' + random
    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueName)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayName)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .type(clueContent)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName).should('exist')
    cy.findByText(clueContent).should('exist')

    const clueName2 = 'Test Clue 2 ' + random
    const clueDisplayName2 = 'Test Clue Display Name 2 ' + random
    const clueContent2 = Math.floor(Math.random() * 1000)
    const clueUnit = 'kg'
    const fullContent2 = clueContent2 + ' ' + clueUnit
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
    cy.get('[data-cy="group-activity-number-clue-unit"]').click().type(clueUnit)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueName2).should('exist')
    cy.findByText(fullContent2).should('exist')

    const clueName3 = 'Test Clue 3 ' + random
    const clueDisplayName3 = 'Test Clue Display Name 3 ' + random
    const clueContent3 = Math.floor(Math.random() * 1000)
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

    // add questions to the group activity
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer()
      cy.get(`[data-cy="question-item-${questionTitle}"]`)
        .contains(questionTitle)
        .trigger('dragstart', {
          dataTransfer,
        })
      cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
        dataTransfer,
      })
    }
    cy.get('[data-cy="back-session-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(name).should('exist')

    // publish and unpublish the group activity
    cy.get(`[data-cy="groupActivity-${name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(`[data-cy="publish-groupActivity-${name}"]`).click()
    cy.get('[data-cy="cancel-publish-action"]').click()
    cy.get(`[data-cy="publish-groupActivity-${name}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${name}"]`)
      .findByText(messages.shared.generic.scheduled)
      .should('exist')
    cy.get(`[data-cy="unpublish-groupActivity-${name}"]`).click()
    cy.get(`[data-cy="groupActivity-${name}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')

    // start editing the group activity
    const newName = 'Edited ' + name
    const newDisplayName = 'Edited ' + displayName
    const newDescription = 'Edited ' + description

    cy.get(`[data-cy="groupActivity-actions-${name}"]`).click()
    cy.get(`[data-cy="edit-groupActivity-${name}"]`).click()

    cy.get('[data-cy="insert-groupactivity-name"]')
      .click()
      .should('have.value', name)
      .clear()
      .type(newName)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .should('have.value', displayName)
      .clear()
      .type(newDisplayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .focus()
      .clear()
      .type(newDescription)
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
    cy.get('[data-cy="select-start-date"]')
      .click()
      .type(`${currentYear - 1}-01-01T02:00`)
    cy.get('[data-cy="select-end-date"]')
      .click()
      .type(`${currentYear + 1}-12-31T18:00`)
    cy.get('[data-cy="next-or-submit"]').click()

    // check that clues exist and add a new one
    cy.findByText(clueName).should('exist')
    cy.findByText(clueName2).should('exist')
    cy.findByText(clueName3).should('exist')

    // edit existing clue
    const clueNameEdited = 'Edited ' + clueName
    const clueDisplayNameEdited = 'Edited ' + clueDisplayName
    const clueContentEdited = 'Edited ' + clueContent
    cy.get(`[data-cy="edit-clue-${clueName}"]`).click()
    cy.get('[data-cy="group-activity-clue-name"]')
      .click()
      .should('have.value', clueName)
      .clear()
      .type(clueNameEdited)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .should('have.value', clueDisplayName)
      .clear()
      .type(clueDisplayNameEdited)
    cy.get('[data-cy="group-activity-string-clue-value"]')
      .click()
      .should('have.value', clueContent)
      .clear()
      .type(clueContentEdited)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.findByText(clueNameEdited).should('exist')
    cy.findByText(clueContentEdited).should('exist')

    // delete existing clue
    cy.get(`[data-cy="remove-clue-${clueNameEdited}"]`).click()
    cy.findByText(clueNameEdited).should('not.exist')
    cy.findByText(clueContentEdited).should('not.exist')

    const clueNameNew = 'New Clue ' + random
    const clueDisplayNameNew = 'New Clue Display Name ' + random
    const clueContentNew = random
    const clueUnitNew = 'm'
    const fullContentNew = clueContentNew + ' ' + clueUnitNew

    cy.get('[data-cy="add-group-activity-clue"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.textClue)
    cy.get('[data-cy="group-activity-clue-type"]').click()
    cy.get('[data-cy="group-activity-clue-type-number"]').click()
    cy.get('[data-cy="group-activity-clue-type"]')
      .should('exist')
      .contains(messages.manage.sessionForms.numericalClue)
    cy.get('[data-cy="group-activity-clue-name"]').click().type(clueNameNew)
    cy.get('[data-cy="group-activity-clue-display-name"]')
      .click()
      .type(clueDisplayNameNew)
    cy.get('[data-cy="group-activity-number-clue-value"]').type(
      String(clueContentNew)
    )
    cy.get('[data-cy="group-activity-number-clue-unit"]')
      .click()
      .type(clueUnitNew)
    cy.get('[data-cy="group-activity-clue-save"]').click()
    cy.get(`[data-cy="groupActivity-clue-${clueNameNew}"]`).should('exist')
    cy.findByText(fullContentNew).should('exist')

    // add another question to the group activity
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="question-item-${questionTitle}"]`)
      .contains(questionTitle)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get('[data-cy="drop-elements-stack-0"]').trigger('drop', {
      dataTransfer,
    })
    cy.get('[data-cy="next-or-submit"]').click()

    // check if the created group activity exists
    cy.get('[data-cy="load-session-list"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.findByText(newName).should('exist')

    // publish the group activity and check its status
    cy.get(`[data-cy="groupActivity-${newName}"]`)
      .findByText(messages.shared.generic.draft)
      .should('exist')
    cy.get(`[data-cy="publish-groupActivity-${newName}"]`).click()
    cy.get('[data-cy="confirm-publish-action"]').click()
    cy.get(`[data-cy="groupActivity-${newName}"]`)
      .findByText(messages.shared.generic.running)
      .should('exist')
  })

  it('can send a message to the group', function () {
    cy.loginStudent()

    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get('[data-cy="group-message-textarea"]').type('hello group!')
    cy.get('[data-cy="group-message-submit"]').click()
    cy.get('[data-cy="group-message-textarea"]').should('have.value', '')
    cy.get('[data-cy="group-messages"]').should('contain', 'hello group!')
  })

  it('take part in the seeded group activity', function () {
    cy.loginStudent()
    const activityDisplayName = 'Gruppenquest Published'

    // start the group activity
    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="open-group-activity-${activityDisplayName}"]`).click()
    cy.get('[data-cy="start-group-activity"]').click()

    // test rating and flagging of group activity instances
    const flaggingText = 'Test flagging question on group activity'
    const flaggingTextNew = 'Test flagging question on group activity NEW'
    cy.get('[data-cy="upvote-element-0-button"]').click()
    cy.wait(1000)
    cy.get('[data-cy="downvote-element-0-button"]').click()
    cy.wait(1000)
    cy.get('[data-cy="upvote-element-1-button"]').click()
    cy.wait(1000)
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
    cy.wait(1000)
    cy.get('[data-cy="flag-element-1-button"]').click()
    cy.get('[data-cy="submit-flag-element"]').should('not.be.disabled')
    cy.get('[data-cy="flag-element-textarea"]').should(
      'have.value',
      flaggingTextNew
    )
    cy.get('[data-cy="cancel-flag-element"]').click()

    // answer the questions in the group activity
    cy.get('[data-cy="free-text-input-1"]').click().type('Testanswer 1')
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="mc-2-answer-option-4"]').click()
    cy.get('[data-cy="input-numerical-3"]').type('57')
    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').click()
    cy.get('[data-cy="sc-5-answer-option-5"]').click()
    cy.get('[data-cy="submit-group-activity"]').click()

    // check that the answers are persistent and the fields disabled
    cy.get('[data-cy="free-text-input-1"]')
      .should('be.disabled')
      .contains('Testanswer 1')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', '57')

    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-5"]').should('be.disabled')

    // check that the answers are persistent and the fields disabled after reload
    cy.reload()
    cy.get('[data-cy="free-text-input-1"]')
      .should('be.disabled')
      .contains('Testanswer 1')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', '57')

    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-5"]').should('be.disabled')

    // login again with second group member and check that the results
    // are still there and the inputs submitted
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
    cy.clearLocalStorage()

    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="password-login"]').click()
    cy.get('[data-cy="username-field"]').click().type('testuser15')
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)

    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="open-group-activity-${activityDisplayName}"]`).click()

    cy.get('[data-cy="free-text-input-1"]')
      .should('be.disabled')
      .contains('Testanswer 1')

    cy.get('[data-cy="mc-2-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-5"]').should('be.disabled')

    cy.get('[data-cy="input-numerical-3"]')
      .should('be.disabled')
      .should('have.value', '57')

    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-4-incorrect"]').should('be.disabled')

    cy.get('[data-cy="sc-5-answer-option-1"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-3"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-4"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-5"]').should('be.disabled')
  })

  it('grade the seeded group acivity', function () {
    cy.loginLecturer()

    cy.get('[data-cy="courses"]').click()
    cy.get('[data-cy="course-list-button-Testkurs"]').click()
    cy.get('[data-cy="tab-groupActivities"]').click()
    cy.get('[data-cy="grade-groupActivity-Gruppenquest Completed"]').click()

    const scores1 = ['10', '20', '50', '10', '20']
    const comment1_1 = 'Test Comment'
    const comment1_2 = 'Test Comment 2'
    const gradingComment1 = 'Test Comment 3'
    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.get('[data-cy="groupActivity-grading-comment-0"]')
      .click()
      .type(comment1_1)
    cy.get('[data-cy="groupActivity-grading-score-0"]').type(scores1[0])
    cy.get('[data-cy="groupActivity-grading-score-1"]').type(scores1[1])
    cy.get('[data-cy="groupActivity-grading-score-2"]').type(scores1[2])
    cy.get('[data-cy="groupActivity-grading-comment-2"]')
      .click()
      .type(comment1_2)
    cy.get('[data-cy="groupActivity-grading-score-3"]').type(scores1[3])
    cy.get('[data-cy="groupActivity-grading-score-4"]').type(scores1[4])
    cy.get('[data-cy="group-activity-submission-2"]').click()
    cy.get('[data-cy="cancel-submission-switch"]').click()
    cy.get('[data-cy="groupActivity-passed"]').click()
    cy.get('[data-cy="groupActivity-general-grading-comment"]').type(
      gradingComment1
    )
    cy.get('[data-cy="groupActivity-save-submission-grading"]').click()

    const scores2 = ['10', '10', '10', '10', '10']
    cy.get('[data-cy="group-activity-submission-2"]').click()
    cy.get('[data-cy="groupActivity-grading-score-0"]').type(scores2[0])
    cy.get('[data-cy="groupActivity-grading-score-1"]').type(scores2[1])
    cy.get('[data-cy="groupActivity-grading-score-2"]').type(scores2[2])
    cy.get('[data-cy="groupActivity-grading-score-3"]').type(scores2[3])
    cy.get('[data-cy="groupActivity-grading-score-4"]').type(scores2[4])
    cy.get('[data-cy="groupActivity-failed"]').click()
    cy.get('[data-cy="groupActivity-save-submission-grading"]').click()

    cy.get('[data-cy="group-activity-submission-3"]').click()
    cy.get('[data-cy="groupActivity-grading-comment-0"]')
      .click()
      .type('Test Comment 4')
    cy.get('[data-cy="groupActivity-grading-score-0"]').clear()
    cy.get('[data-cy="groupActivity-grading-score-0"]').type('15')
    cy.get('[data-cy="group-activity-submission-1"]').click()
    cy.get('[data-cy="confirm-submission-switch"]').click()
    cy.get('[data-cy="group-activity-submission-3"]').click()
    cy.get('[data-cy="groupActivity-grading-score-0"]').type('5')
    cy.get('[data-cy="groupActivity-grading-score-1"]').type('5')
    cy.get('[data-cy="groupActivity-grading-score-2"]').type('5')
    cy.get('[data-cy="groupActivity-grading-score-3"]').type('5')
    cy.get('[data-cy="groupActivity-grading-score-4"]').type('5')
    cy.get('[data-cy="groupActivity-failed"]').click()
    cy.get('[data-cy="groupActivity-save-submission-grading"]').click()

    cy.get('[data-cy="finalize-grading"]').click()
    cy.get('[data-cy="cancel-finalize-grading"]').click()
    cy.get('[data-cy="finalize-grading"]').click()
    cy.get('[data-cy="confirm-finalize-grading"]').click()

    cy.get('[data-cy="group-activity-submission-2"]').click()
    cy.get('[data-cy="groupActivity-grading-score-0"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-grading-score-1"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-grading-score-2"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-grading-score-3"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-grading-score-4"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-failed"]').should('be.disabled')
    cy.get('[data-cy="groupActivity-save-submission-grading"]').should(
      'be.disabled'
    )

    // login as a student with passed group activitiy and check the results (group 1)
    cy.clearAllCookies()
    cy.clearLocalStorage()
    cy.loginStudent()
    const activityDisplayName = 'Gruppenquest Completed'

    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${activityDisplayName}"]`).should(
      'contain',
      messages.shared.generic.passed
    )
    cy.get(`[data-cy="open-group-activity-${activityDisplayName}"]`).click()

    cy.findByText(messages.pwa.groupActivity.groupActivityPassed).should(
      'exist'
    )
    cy.findByText('110/200 Points').should('exist')
    cy.get('[data-cy="group-activity-grading-feedback-0"]').should(
      'contain',
      `${scores1[0]}/50 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-0"]').should(
      'contain',
      comment1_1
    )
    cy.get('[data-cy="group-activity-grading-feedback-1"]').should(
      'contain',
      `${scores1[1]}/50 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-2"]').should(
      'contain',
      `${scores1[2]}/50 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-2"]').should(
      'contain',
      comment1_2
    )
    cy.get('[data-cy="group-activity-grading-feedback-3"]').should(
      'contain',
      `${scores1[3]}/25 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-4"]').should(
      'contain',
      `${scores1[4]}/25 Points`
    )
    cy.get('[data-cy="group-activity-results-comment"]').should(
      'contain',
      gradingComment1
    )

    // Check student view for failed group activity submission (group 2)
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="password-login"]').click()
    cy.get('[data-cy="username-field"]')
      .click()
      .type(Cypress.env('STUDENT_USERNAME2'))
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.wait(1000)

    cy.get('[data-cy="course-button-Testkurs"]').click()
    cy.get('[data-cy="student-course-existing-group-0"]').click()
    cy.get(`[data-cy="group-activity-${activityDisplayName}"]`).should(
      'contain',
      messages.shared.generic.failed
    )
    cy.get(`[data-cy="open-group-activity-${activityDisplayName}"]`).click()

    cy.findByText(messages.pwa.groupActivity.groupActivityFailed).should(
      'exist'
    )
    cy.findByText('50/200 Points').should('exist')
    cy.get('[data-cy="group-activity-grading-feedback-0"]').should(
      'contain',
      `${scores2[0]}/50 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-1"]').should(
      'contain',
      `${scores2[1]}/50 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-2"]').should(
      'contain',
      `${scores2[2]}/50 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-3"]').should(
      'contain',
      `${scores2[3]}/25 Points`
    )
    cy.get('[data-cy="group-activity-grading-feedback-4"]').should(
      'contain',
      `${scores2[4]}/25 Points`
    )
  })
})
