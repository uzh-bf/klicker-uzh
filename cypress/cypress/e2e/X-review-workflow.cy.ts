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
        messages.shared.generic.reviewStatusREVIEWED
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
        messages.shared.generic.reviewStatusREVIEWED
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
        messages.shared.generic.reviewStatusREVIEWED
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
    ).should('contain', messages.shared.generic.reviewStatusREVIEWED)
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
        messages.shared.generic.reviewStatusREVIEWED
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
        messages.shared.generic.reviewStatusREVIEWED
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
    ).should(
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )

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
    ).should(
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )

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
    ).should(
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )

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
    ).should(
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )

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
    ).should(
      'contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
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
    ).should(
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuizNoCourse}"]`
    ).should('not.contain', messages.shared.generic.reviewStatusREVIEWED)

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
    ).should(
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    cy.get(
      `[data-cy="activity-LIVE_QUIZ-${this.data.review.liveQuiz}"]`
    ).should('not.contain', messages.shared.generic.reviewStatusREVIEWED)

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
    ).should(
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    cy.get(
      `[data-cy="activity-PRACTICE_QUIZ-${this.data.review.practiceQuiz}"]`
    ).should('not.contain', messages.shared.generic.reviewStatusREVIEWED)

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
    ).should(
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    cy.get(
      `[data-cy="activity-MICRO_LEARNING-${this.data.review.microLearning}"]`
    ).should('not.contain', messages.shared.generic.reviewStatusREVIEWED)

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
    ).should(
      'not.contain',
      messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
    )
    cy.get(
      `[data-cy="activity-GROUP_ACTIVITY-${this.data.review.groupActivity}"]`
    ).should('not.contain', messages.shared.generic.reviewStatusREVIEWED)
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
        messages.shared.generic.reviewStatusMODIFIED_AFTER_REVIEW
      )
    }
  })
  // #endregion

  // ! Part 2: Element list batch operations
  // #region
  it('Prepare elements for element list batch operations', function () {
    cy.cleanup()
    cy.seed()

    // login and show archived elements
    cy.loginLecturer()
    cy.wait(1000)
    cy.get('[data-cy="show-archive-switch"]').click()

    // SC question with solution
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      multiplier: 2,
      isArchived: true,
      userId: Cypress.env('LECTURER_ID'),
    })

    // MC question with solution
    cy.createQuestionMC({
      name: this.data.MCML.title,
      content: this.data.MCML.content,
      choices: this.data.MCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })

    // KPRIM question without solution
    cy.createQuestionKPRIM({
      name: this.data.KP.title,
      content: this.data.KP.content,
      choices: this.data.KP.choices,
      isArchived: true,
      userId: Cypress.env('LECTURER_ID'),
    })

    // NR question with solution
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
      multiplier: 3,
      userId: Cypress.env('LECTURER_ID'),
    })

    // FT question without solution
    cy.createQuestionFT({
      name: this.data.FT.title,
      content: this.data.FT.content,
      ...this.data.FT.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // FC flashcard
    cy.createFlashcard({
      name: this.data.FC.title,
      content: this.data.FC.content,
      explanation: this.data.FC.explanation,
      isArchived: true,
      userId: Cypress.env('LECTURER_ID'),
    })

    // CT element
    cy.createContent({
      name: this.data.CT.title,
      content: this.data.CT.content,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create answer collection
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.collection.name,
      description: this.data.collection.description,
      entries: this.data.collection.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // SE question with solution
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

    // CS question without solution
    cy.createQuestionCS({
      name: this.data.CS.title,
      content: this.data.CS.content,
      explanation: this.data.CS.explanation,
      collectionName: this.data.collection.name,
      selectedItems: this.data.collection.options.filter((_, i) =>
        this.data.CS.selectedItems.includes(i)
      ),
      criteria: this.data.CS.criteria,
      cases: this.data.CS.cases,
      solutions: this.data.CS.solutions,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Verify that selected elements are shown correctly in element batch operations modal', function () {
    cy.loginLecturer()
    cy.get('[data-cy="show-archive-switch"]').click() // show archived elements

    // select specific elements
    cy.get(`[data-cy="element-checkbox-${this.data.SCML.title}"]`).click()
    cy.get(`[data-cy="element-checkbox-${this.data.KP.title}"]`).click()
    cy.get(`[data-cy="element-checkbox-${this.data.FC.title}"]`).click()
    cy.get(`[data-cy="element-checkbox-${this.data.CS.title}"]`).click()

    // open batch operations dialog and verify that correct elements are shown
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.KP.title,
      this.data.FC.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('not.exist')
    })
    cy.wrap([
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.CT.title,
      this.data.SEML.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('not.exist')
    })
    cy.get('[data-cy="close-batch-operations-modal"]').click()

    // select all elements through the corresponding checkbox
    cy.get('[data-cy="select-all-elements"]').click().wait(500) // deselect all
    cy.get('[data-cy="select-all-elements"]').click() // select all

    // open batch operations dialog and verify that all elements are
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.FC.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('not.exist')
    })
  })

  it('Verify that the applied operations are displayed correctly in batch operations modal', function () {
    cy.loginLecturer()
    cy.get('[data-cy="show-archive-switch"]').click() // show archived elements
    cy.get('[data-cy="select-all-elements"]').click() // select all
    cy.get('[data-cy="element-batch-operations"]').click()

    // select the option to archive elements
    cy.get('[data-cy="archive-button"]').click()
    cy.wrap([
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([
      this.data.SCML.title,
      this.data.KP.title,
      this.data.FC.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })

    // select the option to unarchive elements
    cy.get('[data-cy="unarchive-button"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.KP.title,
      this.data.FC.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })

    // select the option to change the status of elements (deselect it again; archiving options are automatically deselected)
    cy.get('[data-cy="status-checkbox"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.FC.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.get('[data-cy="status-checkbox"]').click()

    // select the option to change the multiplier of elements (deselect it again)
    cy.get('[data-cy="multiplier-checkbox"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.SEML.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([
      this.data.KP.title,
      this.data.FT.title,
      this.data.FC.title,
      this.data.CT.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })
    cy.get('[data-cy="multiplier-checkbox"]').click()

    // select the option to enable / disable base points (deselect it again)
    cy.get('[data-cy="base-points-checkbox"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([this.data.FC.title, this.data.CT.title]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })
    cy.get('[data-cy="base-points-checkbox"]').click()

    // select status and base points change (verify only questions selected), add multiplier (verify only questions with sample solution selected)
    cy.get('[data-cy="status-checkbox"]').click()
    cy.get('[data-cy="base-points-checkbox"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([this.data.FC.title, this.data.CT.title]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })

    cy.get('[data-cy="multiplier-checkbox"]').click()
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.SEML.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([
      this.data.KP.title,
      this.data.FT.title,
      this.data.FC.title,
      this.data.CT.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })
  })

  it('Verify that archiving / unarchiving elements works correctly', function () {
    cy.loginLecturer()
    cy.get('[data-cy="show-archive-switch"]').click() // show archived elements
    const allElements = [
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.FC.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]

    // verify that only the seeded archived elements have the corresponding badge
    cy.wrap([
      this.data.SCML.title,
      this.data.KP.title,
      this.data.FC.title,
    ]).each((title) => {
      cy.get(`[data-cy="archive-badge-${title}"]`).should('exist')
    })

    // archive all elements
    cy.get('[data-cy="select-all-elements"]').click() // select all
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.get('[data-cy="archive-button"]').click()
    cy.wrap([
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-check-${title}"]`).should('exist')
    })
    cy.wrap([
      this.data.SCML.title,
      this.data.KP.title,
      this.data.FC.title,
    ]).each((title) => {
      cy.get(`[data-cy="element-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="element-batch-x-${title}"]`).should('exist')
    })
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that all elements are archived now
    cy.wrap(allElements).each((title) => {
      cy.get(`[data-cy="archive-badge-${title}"]`).should('exist')
    })

    // unarchive all elements again
    cy.get('[data-cy="select-all-elements"]').click() // select all
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.get('[data-cy="unarchive-button"]').click()
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that none of the elements are archived
    cy.wrap(allElements).each((title) => {
      cy.get(`[data-cy="archive-badge-${title}"]`).should('not.exist')
    })
  })

  it('Verify that status changes are possible for all elements', function () {
    cy.loginLecturer()

    const allElements = [
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.FC.title,
      this.data.CT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]

    // verify that all elements are in ready state
    cy.wrap(allElements).each((title) => {
      cy.get(`[data-cy="element-item-${title}"]`).should(
        'contain',
        messages.shared.READY.statusLabel
      )
    })

    // set all elements to a reviewed status
    cy.get('[data-cy="select-all-elements"]').click() // select all
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.get('[data-cy="status-checkbox"]').click()
    cy.selectOption(
      '[data-cy="element-status-select"]',
      messages.shared.REVIEW.statusLabel
    )
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that all elements are in reviewed state
    cy.wrap(allElements).each((title) => {
      cy.get(`[data-cy="element-item-${title}"]`).should(
        'contain',
        messages.shared.REVIEW.statusLabel
      )
    })
  })

  it('Verify that points multiplier and base point operations are only applied for supported elements', function () {
    cy.loginLecturer()

    // disabled base points for all elements
    cy.get('[data-cy="select-all-elements"]').click()
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.get('[data-cy="base-points-checkbox"]').click()
    cy.get('[data-cy="base-points-switch"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="base-points-switch"]').click()
    cy.get('[data-cy="base-points-switch"]').should(
      'not.have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that base points have been disabled for all questions
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.KP.title,
      this.data.NRML.title,
      this.data.FT.title,
      this.data.SEML.title,
      this.data.CS.title,
    ]).each((element) => {
      cy.get(`[data-cy="edit-element-${element}"]`).click()
      cy.get('[data-cy="configure-base-points"]').should(
        'not.have.attr',
        'data-state',
        'checked'
      )
      cy.get('[data-cy="close-element-modal"]').click()
    })

    // change the multiplier (to 3x) and enable base points
    cy.get('[data-cy="select-all-elements"]').click()
    cy.get('[data-cy="element-batch-operations"]').click()
    cy.get('[data-cy="base-points-checkbox"]').click()
    cy.get('[data-cy="base-points-switch"]').should(
      'have.attr',
      'data-state',
      'checked'
    )
    cy.get('[data-cy="multiplier-checkbox"]').click()
    cy.selectOption('[data-cy="select-multiplier"]', '3')
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that base points have been enabled for all questions with sample solution
    cy.wrap([
      this.data.SCML.title,
      this.data.MCML.title,
      this.data.NRML.title,
      this.data.SEML.title,
    ]).each((element) => {
      cy.get(`[data-cy="edit-element-${element}"]`).click()
      cy.get('[data-cy="configure-base-points"]').should(
        'have.attr',
        'data-state',
        'checked'
      )
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier3)
      cy.get('[data-cy="close-element-modal"]').click()
    })

    cy.wrap([this.data.KP.title, this.data.FT.title, this.data.CS.title]).each(
      (element) => {
        cy.get(`[data-cy="edit-element-${element}"]`).click()
        cy.get('[data-cy="configure-base-points"]').should(
          'not.have.attr',
          'data-state',
          'checked'
        )
        cy.get('[data-cy="close-element-modal"]').click()
      }
    )
  })
  // #endregion

  // ! Part 3: Activity list batch operations
  // #region
  const validCourseStart = {
    monthDelta: 1,
    day: 11,
    validation: getDatetimeValidationString(2, '11'),
  }
  const validCourseGroupDeadline = {
    monthDelta: -4,
    day: 12,
    validation: getDatetimeValidationString(3, '12'),
  }
  const validCourseEnd = {
    monthDelta: 6,
    day: 20,
    validation: getDatetimeValidationString(13, '20'),
  }

  const invalidCourseStart = {
    monthDelta: 3,
    day: 20,
    validation: getDatetimeValidationString(4, '20'),
  }
  const invalidCourseGroupDeadline = {
    monthDelta: -3,
    day: 21,
    validation: getDatetimeValidationString(4, '21'),
  }
  const invalidCourseEnd = {
    monthDelta: -1,
    day: 20,
    validation: getDatetimeValidationString(6, '20'),
  }

  // 3 months in the future at 2:00
  const activityStart = {
    monthDelta: 3,
    day: 11,
    hour: 2,
    minute: 0,
    validation: getDatetimeValidationString(4, '11') + ', 02:00',
  }
  // 7 months in the future at 18:00
  const activityEnd = {
    monthDelta: 6,
    day: 20,
    hour: 18,
    minute: 0,
    validation: getDatetimeValidationString(7, '20') + ', 18:00',
  }

  it('Prepare elements, activities, and courses for activity batch operations', function () {
    cy.cleanup()
    cy.seed()

    // create two questions (both with sample solutions -> valid in asynchronous activities)
    cy.loginLecturer()
    cy.wait(1000)
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionNR({
      name: this.data.NRML.title,
      content: this.data.NRML.content,
      ...this.data.NRML.options,
      userId: Cypress.env('LECTURER_ID'),
    })

    // 2 valid courses with group formation and gamification enabled; duration longer than any activity
    cy.get('[data-cy="courses"]').click()
    cy.createCourse({
      name: this.data.batch.course1,
      displayName: this.data.batch.course1,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: validCourseStart,
      endDate: validCourseEnd,
      groupFormationDeadline: validCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    cy.createCourse({
      name: this.data.batch.course2,
      displayName: this.data.batch.course2,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: validCourseStart,
      endDate: validCourseEnd,
      groupFormationDeadline: validCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })

    // 3 invalid courses with start / end / group formation deadline dates that interfere with the activity availability timeframes
    cy.createCourse({
      name: this.data.batch.course3,
      displayName: this.data.batch.course3,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: validCourseStart,
      endDate: invalidCourseEnd,
      groupFormationDeadline: validCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    cy.createCourse({
      name: this.data.batch.course4,
      displayName: this.data.batch.course4,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: invalidCourseStart,
      endDate: invalidCourseEnd,
      groupFormationDeadline: invalidCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })
    cy.createCourse({
      name: this.data.batch.course5,
      displayName: this.data.batch.course5,
      isGamificationEnabled: true,
      isGroupFormationEnabled: true,
      startDate: invalidCourseStart,
      endDate: validCourseEnd,
      groupFormationDeadline: invalidCourseGroupDeadline,
      maxGroupSize: 4,
      preferredGroupSize: 2,
    })

    // course without group formation enabled (cannot be used for group activities)
    cy.createCourse({
      name: this.data.batch.courseNoGroups,
      displayName: this.data.batch.courseNoGroups,
      isGamificationEnabled: true,
      isGroupFormationEnabled: false,
      startDate: validCourseStart,
      endDate: validCourseEnd,
    })

    // course without gamification (cannot be combined with multiplier updates)
    cy.createCourse({
      name: this.data.batch.courseNotGamified,
      displayName: this.data.batch.courseNotGamified,
      isGamificationEnabled: false,
      isGroupFormationEnabled: false,
      startDate: validCourseStart,
      endDate: validCourseEnd,
    })

    // create one activity of each type
    cy.get('[data-cy="library"]').click()
    cy.createLiveQuiz({
      name: this.data.batch.liveQuiz,
      displayName: this.data.batch.liveQuiz,
      courseName: this.data.batch.course1,
      blocks: [{ elements: [this.data.SCML.title, this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createPracticeQuiz({
      name: this.data.batch.practiceQuiz,
      displayName: this.data.batch.practiceQuiz,
      courseName: this.data.batch.course1,
      stacks: [{ elements: [this.data.SCML.title, this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createMicroLearning({
      name: this.data.batch.microLearning,
      displayName: this.data.batch.microLearning,
      courseName: this.data.batch.course1,
      startDate: activityStart,
      endDate: activityEnd,
      stacks: [{ elements: [this.data.SCML.title, this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createGroupActivity({
      name: this.data.batch.groupActivity,
      displayName: this.data.batch.groupActivity,
      courseName: this.data.batch.course1,
      scheduledStartDate: activityStart,
      scheduledEndDate: activityEnd,
      task: 'TASK',
      clues: this.data.groupActivityStandardClues,
      stack: { elements: [this.data.SCML.title, this.data.NRML.title] },
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createLiveQuiz({
      name: this.data.batch.liveQuiz2,
      displayName: this.data.batch.liveQuiz2,
      courseName: this.data.batch.courseNotGamified,
      blocks: [{ elements: [this.data.SCML.title, this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createPracticeQuiz({
      name: this.data.batch.practiceQuiz2,
      displayName: this.data.batch.practiceQuiz2,
      courseName: this.data.batch.courseNotGamified,
      stacks: [{ elements: [this.data.SCML.title, this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()

    cy.createMicroLearning({
      name: this.data.batch.microLearning2,
      displayName: this.data.batch.microLearning2,
      courseName: this.data.batch.courseNotGamified,
      startDate: activityStart,
      endDate: activityEnd,
      stacks: [{ elements: [this.data.SCML.title, this.data.NRML.title] }],
    })
    cy.get('[data-cy="create-new-activity"]').click()
  })

  it('Verify that selected activities are shown correctly in activity batch operations modal', function () {
    cy.loginLecturer()

    // select specific activities
    cy.get(`[data-cy="activities"]`).click().wait(500) // wait for activity list to load
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz}"]`).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.microLearning}"]`
    ).click()

    // open batch operations dialog and verify that correct activities are shown
    cy.get('[data-cy="activity-batch-operations"]').click()
    cy.wrap([this.data.batch.liveQuiz, this.data.batch.microLearning]).each(
      (title) => {
        cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
        cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
        cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
      }
    )
    cy.wrap([this.data.batch.practiceQuiz, this.data.batch.groupActivity]).each(
      (title) => {
        cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('not.exist')
      }
    )
    cy.get('[data-cy="close-batch-operations-modal"]').click()

    // select all activities through the corresponding checkbox
    cy.get('[data-cy="select-all-activities"]').click().wait(500) // deselect all
    cy.get('[data-cy="select-all-activities"]').click() // select all

    // open batch operations dialog and verify that all activities are selected
    cy.get('[data-cy="activity-batch-operations"]').click()
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.microLearning,
      this.data.batch.practiceQuiz,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
  })

  it('Verify that the applied operations are displayed correctly in activity batch operations modal', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click().wait(500) // wait for activity list to load
    cy.get('[data-cy="select-all-activities"]').click() // select all
    cy.get('[data-cy="activity-batch-operations"]').click()

    // if multiplier is selected, only gamified activities are affected
    cy.get('[data-cy="multiplier-checkbox"]').click() // enable multiplier modification
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.microLearning,
      this.data.batch.practiceQuiz,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.wrap([
      this.data.batch.liveQuiz2,
      this.data.batch.microLearning2,
      this.data.batch.practiceQuiz2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })

    // if non-gamified course is selected, multiplier modification is automatically de-selected
    cy.get('[data-cy="course-checkbox"]').click() // enable course re-assignment
    cy.selectOption(
      '[data-cy="select-course"]',
      this.data.batch.courseNotGamified
    ) // select non-gamified course (multiplier should automatically be de-selected)
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.microLearning,
      this.data.batch.practiceQuiz,
      this.data.batch.liveQuiz2,
      this.data.batch.microLearning2,
      this.data.batch.practiceQuiz2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })

    // group activity will not be updated for non-gamified course
    cy.get(
      `[data-cy="activity-batch-entry-${this.data.batch.groupActivity}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-batch-check-${this.data.batch.groupActivity}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="activity-batch-x-${this.data.batch.groupActivity}"]`
    ).should('exist')

    // if course with durations not entirely containing activity duration is selected, corresponding updates are not applied
    cy.selectOption('[data-cy="select-course"]', this.data.batch.course3) // invalid course runtime for microlearnings and group activities (other activities are updated)
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.liveQuiz2,
      this.data.batch.practiceQuiz,
      this.data.batch.practiceQuiz2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.wrap([
      this.data.batch.microLearning,
      this.data.batch.microLearning2,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })

    cy.selectOption('[data-cy="select-course"]', this.data.batch.course4) // invalid course runtime for microlearnings and group activities (other activities are updated)
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.liveQuiz2,
      this.data.batch.practiceQuiz,
      this.data.batch.practiceQuiz2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.wrap([
      this.data.batch.microLearning,
      this.data.batch.microLearning2,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })

    cy.selectOption('[data-cy="select-course"]', this.data.batch.course5) // invalid course runtime for microlearnings and group activities (other activities are updated)
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.liveQuiz2,
      this.data.batch.practiceQuiz,
      this.data.batch.practiceQuiz2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.wrap([
      this.data.batch.microLearning,
      this.data.batch.microLearning2,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })

    // if live quiz points are selected, only live quizzes are affected
    cy.get('[data-cy="course-checkbox"]').click() // deselect course re-assignment
    cy.get('[data-cy="live-quiz-points-checkbox"]').click() // enable live quiz points modification
    cy.get(
      `[data-cy="activity-batch-entry-${this.data.batch.liveQuiz}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-batch-check-${this.data.batch.liveQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-batch-x-${this.data.batch.liveQuiz}"]`).should(
      'not.exist'
    )

    cy.wrap([
      this.data.batch.liveQuiz2, // non-gamified live quizzes are not affected
      this.data.batch.practiceQuiz,
      this.data.batch.practiceQuiz2,
      this.data.batch.microLearning,
      this.data.batch.microLearning2,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })
  })

  it('Verify that multiplier changes are applied correctly', function () {
    cy.loginLecturer()
    cy.get(`[data-cy="activities"]`).click().wait(500) // wait for activity list to load
    cy.get('[data-cy="select-all-activities"]').click() // select all
    cy.get('[data-cy="activity-batch-operations"]').click()

    // udpate gamified activities with new multiplier
    cy.get('[data-cy="multiplier-checkbox"]').click() // enable multiplier modification
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.microLearning,
      this.data.batch.practiceQuiz,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.wrap([
      this.data.batch.liveQuiz2,
      this.data.batch.microLearning2,
      this.data.batch.practiceQuiz2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })
    cy.selectOption(
      '[data-cy="select-multiplier"]',
      messages.manage.activityWizard.multiplier3
    ) // set multiplier to 3
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify through activity wizards that updates have been successful
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier3
    )

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz2}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz2}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').should('not.exist') // non-gamified activity should not have multiplier

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.batch.practiceQuiz}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.batch.practiceQuiz}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier3
    )

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.batch.practiceQuiz2}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.batch.practiceQuiz2}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').should('not.exist') // non-gamified activity should not have multiplier

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.batch.microLearning}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.batch.microLearning}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier3
    )

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.batch.microLearning2}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.batch.microLearning2}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').should('not.exist') // non-gamified activity should not have multiplier

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier3
    )
  })

  it('Verify that course re-assignments are applied correctly', function () {
    cy.loginLecturer()

    // select all gamified activities and re-assign them to the second gamified course
    cy.get(`[data-cy="activities"]`).click().wait(500) // wait for activity list to load
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz}"]`).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.practiceQuiz}"]`
    ).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.microLearning}"]`
    ).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get('[data-cy="activity-batch-operations"]').click()

    cy.get('[data-cy="course-checkbox"]').click() // enable course re-assignment
    cy.selectOption('[data-cy="select-course"]', this.data.batch.course2)
    cy.wrap([
      this.data.batch.liveQuiz,
      this.data.batch.microLearning,
      this.data.batch.practiceQuiz,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify through activity wizards that re-assignments have been successful
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.batch.practiceQuiz}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.batch.practiceQuiz}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.batch.microLearning}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.batch.microLearning}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)
  })

  it('Verify that customized live quiz grading logic is applied correctly', function () {
    cy.loginLecturer()

    // select both live quizzes
    cy.get(`[data-cy="activities"]`).click().wait(500) // wait for activity list to load
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz}"]`).click()
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz2}"]`).click()
    cy.get('[data-cy="activity-batch-operations"]').click()

    // modify live quiz grading logic updates
    cy.get('[data-cy="live-quiz-points-checkbox"]').click() // enable live quiz points modification
    cy.get(`[data-cy="base-points-input"]`).clear().type('100')
    cy.get(`[data-cy="correctness-points-input"]`).clear().type('200')
    cy.get(`[data-cy="bonus-points-input"]`).clear().type('300')
    cy.get(`[data-cy="bonus-times-input"]`).clear().type('60')

    // changes should be applied to gamified live quiz only
    cy.get(
      `[data-cy="activity-batch-entry-${this.data.batch.liveQuiz}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-batch-check-${this.data.batch.liveQuiz}"]`
    ).should('exist')
    cy.get(`[data-cy="activity-batch-x-${this.data.batch.liveQuiz}"]`).should(
      'not.exist'
    )

    cy.get(
      `[data-cy="activity-batch-entry-${this.data.batch.liveQuiz2}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-batch-check-${this.data.batch.liveQuiz2}"]`
    ).should('not.exist')
    cy.get(`[data-cy="activity-batch-x-${this.data.batch.liveQuiz2}"]`).should(
      'exist'
    )
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify through the activity wizard if the changes have been applied
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="live-quiz-advanced-settings"]').click()
    cy.get('[data-cy="live-quiz-default-points"]').should('have.value', '100')
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      '200'
    )
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should('have.value', '300')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should(
      'have.value',
      '60'
    )
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()

    // for the non-gamified live quiz, the settings should not be available
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz2}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz2}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="live-quiz-advanced-settings"]').should('not.exist')
  })

  it('Verify that the combination of multiplier change and course re-assignment is possible simultaneously', function () {
    cy.loginLecturer()

    // assign all non-gamified activities and the group activity to the second valid course and set the multiplier to 4
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz2}"]`).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.practiceQuiz2}"]`
    ).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.microLearning2}"]`
    ).click()
    cy.get(
      `[data-cy="activity-checkbox-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get('[data-cy="activity-batch-operations"]').click()

    // change the muliplier to 4
    cy.get('[data-cy="multiplier-checkbox"]').click() // enable multiplier modification
    cy.selectOption(
      '[data-cy="select-multiplier"]',
      messages.manage.activityWizard.multiplier4
    )

    cy.get(
      `[data-cy="activity-batch-entry-${this.data.batch.groupActivity}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-batch-check-${this.data.batch.groupActivity}"]`
    ).should('exist')
    cy.get(
      `[data-cy="activity-batch-x-${this.data.batch.groupActivity}"]`
    ).should('not.exist')

    cy.wrap([
      this.data.batch.liveQuiz2,
      this.data.batch.practiceQuiz2,
      this.data.batch.microLearning2,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('not.exist') // activities are still in non-gamified course before selecting new course
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('exist')
    })

    // assign second valid course
    cy.get('[data-cy="course-checkbox"]').click() // enable course re-assignment
    cy.selectOption('[data-cy="select-course"]', this.data.batch.course2)
    cy.wrap([
      this.data.batch.liveQuiz2,
      this.data.batch.practiceQuiz2,
      this.data.batch.microLearning2,
      this.data.batch.groupActivity,
    ]).each((title) => {
      cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
      cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
    })
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that the changes went into effect
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz2}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz2}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-PRACTICE_QUIZ-${this.data.batch.practiceQuiz2}"]`
    ).click()
    cy.get(
      `[data-cy="edit-practice-quiz-${this.data.batch.practiceQuiz2}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-MICRO_LEARNING-${this.data.batch.microLearning2}"]`
    ).click()
    cy.get(
      `[data-cy="edit-microlearning-${this.data.batch.microLearning2}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(
      `[data-cy="actions-GROUP_ACTIVITY-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get(
      `[data-cy="edit-group-activity-${this.data.batch.groupActivity}"]`
    ).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course2)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier4
    )
  })

  it('Verify that the combination of multiplier change, course re-assignment and customized grading logic is possible for the live quiz', function () {
    cy.loginLecturer()

    // assign the two live quizzes to course 3, set the multiplier to 2 and set new grading logic
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz}"]`).click()
    cy.get(`[data-cy="activity-checkbox-${this.data.batch.liveQuiz2}"]`).click()
    cy.get('[data-cy="activity-batch-operations"]').click()

    // assign third course
    cy.get('[data-cy="course-checkbox"]').click() // enable course re-assignment
    cy.selectOption('[data-cy="select-course"]', this.data.batch.course3)

    // change the muliplier to 2
    cy.get('[data-cy="multiplier-checkbox"]').click() // enable multiplier modification
    cy.selectOption(
      '[data-cy="select-multiplier"]',
      messages.manage.activityWizard.multiplier2
    )

    // apply new custom live quiz grading logic
    cy.get('[data-cy="live-quiz-points-checkbox"]').click() // enable live quiz points modification
    cy.get(`[data-cy="base-points-input"]`).clear().type('1')
    cy.get(`[data-cy="correctness-points-input"]`).clear().type('2')
    cy.get(`[data-cy="bonus-points-input"]`).clear().type('3')
    cy.get(`[data-cy="bonus-times-input"]`).clear().type('4')

    // verify that the changes will affect both activities and apply the changes
    cy.wrap([this.data.batch.liveQuiz, this.data.batch.liveQuiz2]).each(
      (title) => {
        cy.get(`[data-cy="activity-batch-entry-${title}"]`).should('exist')
        cy.get(`[data-cy="activity-batch-check-${title}"]`).should('exist')
        cy.get(`[data-cy="activity-batch-x-${title}"]`).should('not.exist')
      }
    )
    cy.get('[data-cy="apply-batch-operations"]').click()

    // verify that the changes were applied successfully to both quizzes
    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course3)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )
    cy.get('[data-cy="live-quiz-advanced-settings"]').click()
    cy.get('[data-cy="live-quiz-default-points"]').should('have.value', '1')
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      '2'
    )
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should('have.value', '3')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should('have.value', '4')
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()

    cy.get(`[data-cy="activities"]`).click().wait(500)
    cy.get(`[data-cy="actions-LIVE_QUIZ-${this.data.batch.liveQuiz2}"]`).click()
    cy.get(`[data-cy="edit-live-quiz-${this.data.batch.liveQuiz2}"]`).click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="select-course"]').contains(this.data.batch.course3)
    cy.get('[data-cy="select-multiplier"]').contains(
      messages.manage.activityWizard.multiplier2
    )
    cy.get('[data-cy="live-quiz-advanced-settings"]').click()
    cy.get('[data-cy="live-quiz-default-points"]').should('have.value', '1')
    cy.get('[data-cy="live-quiz-default-correct-points"]').should(
      'have.value',
      '2'
    )
    cy.get('[data-cy="live-quiz-max-bonus-points"]').should('have.value', '3')
    cy.get('[data-cy="live-quiz-time-to-zero-bonus"]').should('have.value', '4')
    cy.get('[data-cy="live-quiz-advanced-settings-close"]').click()
  })
  // #endregion
})
