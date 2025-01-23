import messages from '../../../packages/i18n/messages/en'

describe('Tests the availability of certain functionalities to catalyst users only', () => {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('B-feature-access.json').then((data) => {
      this.data = data
    })
  })

  function validateFeatureAvailability({
    data,
    publicPreview,
    privatePreview,
  }: {
    data: any
    publicPreview: boolean
    privatePreview: boolean
  }) {
    // public preview features in menubar
    if (publicPreview) {
      cy.get('[data-cy="analytics"]').should('exist')
    } else {
      cy.get('[data-cy="analytics"]').should('not.exist')
    }

    // (public) learning analytics course link available
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${data.seed.courseName}"]`).click()
    if (publicPreview) {
      cy.get('[data-cy="course-learning-analytics-link"]').should('exist')
    } else {
      cy.get('[data-cy="course-learning-analytics-link"]').should('not.exist')
    }

    // (public) learning analytics link on microlearnings
    cy.get('[data-cy="tab-microLearnings"]').click()
    cy.get(
      `[data-cy="microlearning-actions-${data.seed.microlearning}"]`
    ).click()
    if (publicPreview) {
      cy.get('[data-cy="open-analytics-async-activity"]').should('exist')
    } else {
      cy.get('[data-cy="open-analytics-async-activity"]').should('not.exist')
    }
    cy.get(`[data-cy="copy-lti-link-${data.seed.microlearning}"]`).click()

    // (public) learning analytics link on practice quizzes
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(
      `[data-cy="practice-quiz-actions-${data.seed.practiceQuiz}"]`
    ).click()
    if (publicPreview) {
      cy.get('[data-cy="open-analytics-async-activity"]').should('exist')
    } else {
      cy.get('[data-cy="open-analytics-async-activity"]').should('not.exist')
    }
    cy.get(`[data-cy="copy-lti-link-${data.seed.practiceQuiz}"]`).click()

    // private preview features in menubar
    cy.get('[data-cy="library"]').click()
    if (privatePreview) {
      cy.get('[data-cy="resources"]').should('exist')
      cy.get('[data-cy="catalog"]').should('exist')
    } else {
      cy.get('[data-cy="resources"]').should('not.exist')
      cy.get('[data-cy="catalog"]').should('not.exist')
    }

    // (private) check that new question type filters are available
    if (privatePreview) {
      cy.get('[data-cy="element-type-filter-SELECTION"]').should('exist')
    } else {
      cy.get('[data-cy="element-type-filter-SELECTION"]').should('not.exist')
    }

    // (private) check that new question types are available during element creation
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    if (privatePreview) {
      cy.get(
        `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
      ).click()
    } else {
      cy.get(
        `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
      ).should('not.exist')
      cy.get(
        `[data-cy="select-question-type-${messages.shared.SC.typeLabel}"]`
      ).click()
    }
    cy.get('[data-cy="close-question-modal"]').click()
  }

  it('Test login for catalyst users and non-catalyst users', function () {
    cy.loginLecturer()
    cy.wait(1000)
    cy.loginFreeUser()
    cy.wait(1000)
    cy.loginIndividualCatalyst()
    cy.wait(1000)
    cy.loginInstitutionalCatalyst()
  })

  it('Test that the creation buttons for practice quizzes and microlearnings are only available to catalyst users', function () {
    cy.loginLecturer()
    cy.wait(1000)
    cy.get('[data-cy="create-practice-quiz"]').should('not.be.disabled')
    cy.get('[data-cy="create-microlearning"]').should('not.be.disabled')
    cy.loginFreeUser()
    cy.wait(1000)
    cy.get('[data-cy="create-practice-quiz"]').should('be.disabled')
    cy.get('[data-cy="create-microlearning"]').should('be.disabled')
    cy.loginIndividualCatalyst()
    cy.wait(1000)
    cy.get('[data-cy="create-practice-quiz"]').should('not.be.disabled')
    cy.get('[data-cy="create-microlearning"]').should('not.be.disabled')
    cy.loginInstitutionalCatalyst()
    cy.wait(1000)
    cy.get('[data-cy="create-practice-quiz"]').should('not.be.disabled')
    cy.get('[data-cy="create-microlearning"]').should('not.be.disabled')
  })

  it('Verify that both public and private preview features are available for lecturer', function () {
    cy.loginLecturer()

    validateFeatureAvailability({
      data: this.data,
      publicPreview: true,
      privatePreview: true,
    })
  })

  it('Verify that only the public preview features are available if the corresponding flag is set', function () {
    // modify access permissions
    cy.task('updateLecturerPermissions', {
      publicPreview: true,
      privatePreview: false,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error('Permissions of user could not be updated.')
      }

      // login as lecturer
      cy.loginLecturer()
      cy.reload()

      // validate the feature availability
      validateFeatureAvailability({
        data: this.data,
        publicPreview: true,
        privatePreview: false,
      })
    })
  })

  it('Verify that only private preview features are available if the corresponding flag is set', function () {
    // modify access permissions
    cy.task('updateLecturerPermissions', {
      publicPreview: false,
      privatePreview: true,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error('Permissions of user could not be updated.')
      }

      // login as lecturer
      cy.loginLecturer()
      cy.reload()

      // validate the feature availability
      validateFeatureAvailability({
        data: this.data,
        publicPreview: false,
        privatePreview: true,
      })
    })
  })

  it('Verify that without feature flags, preview features are not visible', function () {
    // modify access permissions
    cy.task('updateLecturerPermissions', {
      publicPreview: false,
      privatePreview: false,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error('Permissions of user could not be updated.')
      }

      // login as lecturer
      cy.loginLecturer()
      cy.reload()

      // validate the feature availability
      validateFeatureAvailability({
        data: this.data,
        publicPreview: false,
        privatePreview: false,
      })
    })
  })

  it('Cleanup: Change back the user permissions to their original state', function () {
    // modify access permissions
    cy.task('updateLecturerPermissions', {
      publicPreview: true,
      privatePreview: true,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error('Permissions of user could not be updated.')
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
})
