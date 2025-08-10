import messages from '../../../packages/i18n/messages/en'
import { getDatetimeValidationString } from './helpers'

describe('Feature test for review functionalities and batch operations', function () {
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
    cy.fixture('X-review.json').then((reviewData) => {
      this.data = { ...this.data, ...reviewData }
    })
  })

  // ! Part 1: Activity review functionality
  // #region
  it('Prepare two questions, one course, one activity of each type (two live quizzes - one without a course)', function () {
    cy.loginLecturer()

    // create two questions
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

    // create two courses
    cy.get('[data-cy="courses"]').click()
    cy.createCourse({
      name: this.data.review.course.name,
      displayName: this.data.review.course.displayName,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: {
        monthDelta: 1,
        day: 11,
        validation: getDatetimeValidationString(2, '11'),
      },
      endDate: {
        monthDelta: 6,
        day: 20,
        validation: getDatetimeValidationString(13, '20'),
      },
      groupFormationDeadline: {
        monthDelta: -5,
        day: 12,
        validation: getDatetimeValidationString(2, '12'),
      }, // 2 months in the future at 2:00
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    cy.createCourse({
      name: this.data.review.course2.name,
      displayName: this.data.review.course2.displayName,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: {
        monthDelta: 1,
        day: 11,
        validation: getDatetimeValidationString(2, '11'),
      },
      endDate: {
        monthDelta: 6,
        day: 20,
        validation: getDatetimeValidationString(13, '20'),
      },
      groupFormationDeadline: {
        monthDelta: -5,
        day: 12,
        validation: getDatetimeValidationString(2, '12'),
      }, // 2 months in the future at 2:00
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })

    // create two live quizzes, one with and one without course assignment
    cy.get('[data-cy="library"]').click()
    cy.createLiveQuiz({
      name: this.data.review.liveQuizNoCourse,
      displayName: this.data.review.liveQuizNoCourse,
      blocks: [{ elements: [this.data.SCML.title, this.data.MCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createLiveQuiz({
      name: this.data.review.liveQuiz,
      displayName: this.data.review.liveQuiz,
      courseName: this.data.review.course.name,
      blocks: [{ elements: [this.data.SCML.title, this.data.MCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a practice quiz
    cy.createPracticeQuiz({
      name: this.data.review.practiceQuiz,
      displayName: this.data.review.practiceQuiz,
      courseName: this.data.review.course.name,
      stacks: [{ elements: [this.data.SCML.title, this.data.MCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a microlearning
    cy.createMicroLearning({
      name: this.data.review.microLearning,
      displayName: this.data.review.microLearning,
      startDate: {
        monthDelta: 2,
        day: 11,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(3, '11') + ', 02:00',
      }, // 3 months in the future at 2:00
      endDate: {
        monthDelta: 4,
        day: 20,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(5, '20') + ', 18:00',
      }, // 7 months in the future at 18:00
      courseName: this.data.review.course.name,
      stacks: [{ elements: [this.data.SCML.title, this.data.MCML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    // create a group activity
    cy.createGroupActivity({
      name: this.data.review.groupActivity,
      displayName: this.data.review.groupActivity,
      courseName: this.data.review.course.name,
      scheduledStartDate: {
        monthDelta: 2,
        day: 11,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(3, '11') + ', 02:00',
      }, // 3 months in the future at 2:00
      scheduledEndDate: {
        monthDelta: 4,
        day: 20,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(5, '20') + ', 18:00',
      }, // 7 months in the future at 18:00
      task: 'TASK',
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
        elements: [this.data.SCML.title, this.data.MCML.title],
      },
    })
    cy.get('[data-cy="create-new-activity"]').click()
  })

  it('Share the live quiz without a course and the course with other users with READ, EXECUTE, WRITE, and ADMIN permissions, respectively', function () {
    cy.loginLecturer()

    // share the live quiz without course assignment with the users with READ, EXECUTE, WRITE, and ADMIN permissions
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get(
      `[data-cy="share-live-quiz-${this.data.review.liveQuizNoCourse}"]`
    ).click()

    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_IND_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsREAD,
    })
    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_INST_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsEXECUTE,
    })
    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_INST2_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsWRITE,
    })
    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_INST3_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsADMIN,
    })
    cy.get(`[data-cy="close-share-object"]`).click()

    // share the course with the users with READ, EXECUTE, WRITE, and ADMIN permissions
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.review.course.name}"]`
    ).click()
    cy.get('[data-cy="course-share-button"]').click()

    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_IND_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsREAD,
    })
    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_INST_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsEXECUTE,
    })
    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_INST2_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsWRITE,
    })
    cy.shareObject({
      usernameOrEmail: Cypress.env('LECTURER_INST3_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsADMIN,
    })
    cy.get(`[data-cy="close-share-object"]`).click()
  })

  function verifyActivityReviewButtonVisibility(
    data: any,
    expectedVisibility: boolean
  ) {
    cy.get('[data-cy="activities"]').click()

    for (const activity of [
      { name: data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      cy.get(`[data-cy="actions-${activity.type}-${activity.name}"]`).click()
      cy.get(`[data-cy="activity-information-${activity.name}"]`).click()
      cy.get('[data-cy="activity-review-button"]').should(
        expectedVisibility ? 'exist' : 'not.exist'
      )
      cy.get('[data-cy="close-activity-details-modal"]').click()
    }
  }

  it('Verify that the users with READ, EXECUTE, and WRITE permissions can open the details modal, but cannot see the review button', function () {
    cy.loginIndividualCatalyst()

    verifyActivityReviewButtonVisibility(this.data, false)
    cy.logoutUser()

    cy.loginInstitutionalCatalyst()
    verifyActivityReviewButtonVisibility(this.data, false)
    cy.logoutUser()

    cy.loginInstitutionalCatalyst2()
    verifyActivityReviewButtonVisibility(this.data, false)
    cy.logoutUser()
  })

  function markAllActivitiesAsReviewed(data: any) {
    for (const activity of [
      { name: data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      cy.get(`[data-cy="actions-${activity.type}-${activity.name}"]`).click()
      cy.get(`[data-cy="activity-information-${activity.name}"]`).click()
      cy.get('[data-cy="activity-review-button"]').should(
        'contain',
        messages.manage.activities.reviewCompleted
      )
      cy.get('[data-cy="activity-review-button"]').click()
      cy.get('[data-cy="activity-review-button"]').should(
        'contain',
        messages.manage.activities.resetReview
      )
      cy.get('[data-cy="close-activity-details-modal"]').click()
      cy.get(`[data-cy="activity-${activity.type}-${activity.name}"]`).should(
        'contain',
        messages.shared.generic.reviewed
      )
    }
  }

  it('Set all activities to reviewed through the OWNER and ADMIN users through activity list and course overview, unset it again and verify that all changes persist', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()

    // set all activities to reviwed through the activity list
    markAllActivitiesAsReviewed(this.data)
    cy.logoutUser()

    // reset the reviewed status of all activities through the activity list
    cy.loginInstitutionalCatalyst3()
    cy.get('[data-cy="activities"]').click()
    for (const activity of [
      { name: this.data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: this.data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: this.data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: this.data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: this.data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      cy.get('[data-cy="activities-search-input"]').type(
        `${activity.name}{enter}`
      )
      cy.get(`[data-cy="activity-${activity.type}-${activity.name}"]`).should(
        'contain',
        messages.shared.generic.reviewed
      )
      cy.get(`[data-cy="actions-${activity.type}-${activity.name}"]`).click()
      cy.get(`[data-cy="activity-information-${activity.name}"]`).click()
      cy.get('[data-cy="activity-review-button"]').should(
        'contain',
        messages.manage.activities.resetReview
      )
      cy.get('[data-cy="activity-review-button"]').click()
      cy.get('[data-cy="activity-review-button"]').should(
        'contain',
        messages.manage.activities.reviewCompleted
      )
      cy.get('[data-cy="close-activity-details-modal"]').click()
      cy.get(`[data-cy="activity-${activity.type}-${activity.name}"]`).should(
        'not.contain',
        messages.shared.generic.reviewed
      )
      cy.get('[data-cy="activities-search-input"]').clear()
    }

    // set the live quiz without course assignment back to reviewed
    cy.get('[data-cy="activities"]').click()
    cy.get('[data-cy="activities-search-input"]').type(
      `${this.data.review.liveQuizNoCourse}{enter}`
    )
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get(
      `[data-cy="activity-information-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get('[data-cy="activity-review-button"]').should(
      'contain',
      messages.manage.activities.reviewCompleted
    )
    cy.get('[data-cy="activity-review-button"]').click()
    cy.get('[data-cy="activity-review-button"]').should(
      'contain',
      messages.manage.activities.resetReview
    )
    cy.get('[data-cy="close-activity-details-modal"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).should('contain', messages.shared.generic.reviewed)
    cy.get('[data-cy="activities-search-input"]').clear()

    // set all activities back to reviewed through the course overview
    cy.get('[data-cy="courses"]').click()
    cy.get(
      `[data-cy="course-list-button-${this.data.review.course.name}"]`
    ).click()

    for (const activity of [
      {
        name: this.data.review.liveQuiz,
        type: 'LIVE_QUIZ',
        tabKey: 'liveQuizzes',
      },
      {
        name: this.data.review.practiceQuiz,
        type: 'PRACTICE_QUIZ',
        tabKey: 'practiceQuizzes',
      },
      {
        name: this.data.review.microLearning,
        type: 'MICRO_LEARNING',
        tabKey: 'microLearnings',
      },
      {
        name: this.data.review.groupActivity,
        type: 'GROUP_ACTIVITY',
        tabKey: 'groupActivities',
      },
    ]) {
      cy.get(`[data-cy="tab-${activity.tabKey}"]`).click()
      cy.get(`[data-cy="activity-${activity.type}-${activity.name}"]`).should(
        'not.contain',
        messages.shared.generic.reviewed
      )
      cy.get(`[data-cy="actions-${activity.type}-${activity.name}"]`).click()
      cy.get(`[data-cy="activity-information-${activity.name}"]`).click()
      cy.get('[data-cy="activity-review-button"]').should(
        'contain',
        messages.manage.activities.reviewCompleted
      )
      cy.get('[data-cy="activity-review-button"]').click()
      cy.get('[data-cy="activity-review-button"]').should(
        'contain',
        messages.manage.activities.resetReview
      )
      cy.get('[data-cy="close-activity-details-modal"]').click()
      cy.get(`[data-cy="activity-${activity.type}-${activity.name}"]`).should(
        'contain',
        messages.shared.generic.reviewed
      )
    }
  })

  it('Edit each activity through the wizard and verify that the status changes as expected', function () {
    cy.loginLecturer()

    // edit the live quiz without course assignment
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and verify that the review status has been updated correctly
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).should('contain', messages.shared.generic.modifiedAfterReview)

    // edit the live quiz with course assignment
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.review.liveQuiz}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.review.liveQuiz}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and verify that the review status has been updated correctly
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuiz}"]`
    ).should('contain', messages.shared.generic.modifiedAfterReview)

    // edit the practice quiz
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.review.practiceQuiz}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.review.practiceQuiz}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and verify that the review status has been updated correctly
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.review.practiceQuiz}"]`
    ).should('contain', messages.shared.generic.modifiedAfterReview)

    // edit the micro learning
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.review.microLearning}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.review.microLearning}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and verify that the review status has been updated correctly
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.review.microLearning}"]`
    ).should('contain', messages.shared.generic.modifiedAfterReview)

    // edit the group activity
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.review.groupActivity}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.review.groupActivity}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()

    // open the overview and verify that the review status has been updated correctly
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.review.groupActivity}"]`
    ).should('contain', messages.shared.generic.modifiedAfterReview)
  })

  it('Mark the activities as reviewed again and change the course assignments, verify that the review status is reset', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    markAllActivitiesAsReviewed(this.data)

    // assign the live quiz without course assignment to the second course and verify that the review status is reset
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get(
      `[data-cy="edit-live-quiz-${this.data.review.liveQuizNoCourse}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.review.course2.name)
    cy.get('[data-cy="select-course"]').contains(this.data.review.course2.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).should('not.contain', messages.shared.generic.modifiedAfterReview)
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).should('not.contain', messages.shared.generic.reviewed)

    // assign the live quiz from the first course to no course and verify that the review status is reset
    cy.get('[data-cy="activities"]').click()
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.review.liveQuiz}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.review.liveQuiz}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption(
      '[data-cy="select-course"]',
      messages.manage.activityWizard.liveQuizNoCourse
    )
    cy.get('[data-cy="select-course"]').contains(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuiz}"]`
    ).should('not.contain', messages.shared.generic.modifiedAfterReview)
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuiz}"]`
    ).should('not.contain', messages.shared.generic.reviewed)

    // assign the practice quiz from the first course to the second course and verify that the review status is reset
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.review.practiceQuiz}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.review.practiceQuiz}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.review.course2.name)
    cy.get('[data-cy="select-course"]').contains(this.data.review.course2.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.review.practiceQuiz}"]`
    ).should('not.contain', messages.shared.generic.modifiedAfterReview)
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.review.practiceQuiz}"]`
    ).should('not.contain', messages.shared.generic.reviewed)

    // assign the microlearning from the first course to the second course and verify that the review status is reset
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.review.microLearning}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.review.microLearning}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.review.course2.name)
    cy.get('[data-cy="select-course"]').contains(this.data.review.course2.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.review.microLearning}"]`
    ).should('not.contain', messages.shared.generic.modifiedAfterReview)
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.review.microLearning}"]`
    ).should('not.contain', messages.shared.generic.reviewed)

    // assign the group activity from the first course to the second course and verify that the review status is reset
    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.review.groupActivity}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.review.groupActivity}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.selectOption('[data-cy="select-course"]', this.data.review.course2.name)
    cy.get('[data-cy="select-course"]').contains(this.data.review.course2.name)
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="open-activity-overview"]').click()
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.review.groupActivity}"]`
    ).should('not.contain', messages.shared.generic.modifiedAfterReview)
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.review.groupActivity}"]`
    ).should('not.contain', messages.shared.generic.reviewed)
  })

  it('Mark the activities as reviewed again, modify a contained element and verify that the review status is updated correctly', function () {
    cy.loginLecturer()
    cy.get('[data-cy="activities"]').click()
    markAllActivitiesAsReviewed(this.data)

    // update the single choice question and save it
    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="edit-element-${this.data.SCML.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').click().type(' NEW')
    cy.get('[data-cy="save-new-question"]').click()
    cy.get(`[data-cy="edit-element-${this.data.SCML.title} NEW"]`).should(
      'exist'
    )

    // verify that all activities have the modifiedAfterReview status
    cy.get('[data-cy="activities"]').click()
    for (const activity of [
      { name: this.data.review.liveQuizNoCourse, type: 'LIVE_QUIZ' },
      { name: this.data.review.liveQuiz, type: 'LIVE_QUIZ' },
      { name: this.data.review.practiceQuiz, type: 'PRACTICE_QUIZ' },
      { name: this.data.review.microLearning, type: 'MICRO_LEARNING' },
      { name: this.data.review.groupActivity, type: 'GROUP_ACTIVITY' },
    ]) {
      cy.get(`[data-cy="activity-${activity.type}-${activity.name}"]`).should(
        'contain',
        messages.shared.generic.modifiedAfterReview
      )
    }
  })
  // #endregion
})
