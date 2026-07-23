describe('Course Q&A rollout-gate workflow', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('Y-course-qa.json').then((data) => {
      this.data = data
    })
  })

  it('CLEANUP', function () {
    cy.cleanup()
    cy.seed()
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQARolloutEnabled: true,
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: true,
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Could not apply QA flags on Testkurs')
      }
    })
  })

  it('Creates a course thread for runtime-gate persistence checks', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-qa-thread-input"]').type(this.data.threads.course1)
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.threads.course1).should('exist')
  })

  it('Runtime gate off hides the integrated panel and shows the fallback notice', function () {
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQAEnabled: false,
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Unable to toggle isCourseQAEnabled off')
      }
    })

    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-overview-qa-panel"]').should('not.exist')

    cy.visit(`${Cypress.env('URL_STUDENT')}/course/${this.data.courseId}/qa`)
    cy.get('[data-cy="course-qa-disabled-notice"]').should('exist')
  })

  it('Lecturer sees the disabled notice while the runtime gate is off', function () {
    cy.loginLecturer()
    cy.visit(`${Cypress.env('URL_MANAGE')}/courses/${this.data.courseId}`)
    cy.get('[data-cy="tab-discussions"]').should('exist').click()
    cy.get('[data-cy="course-qa-disabled-notice"]').should('exist')
  })

  it('Runtime gate on restores the student panel and existing thread', function () {
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQAEnabled: true,
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Unable to toggle isCourseQAEnabled on')
      }
    })

    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-overview-qa-panel"]').should('exist')
    cy.get('[data-cy="course-qa-disabled-notice"]').should('not.exist')
    cy.findByText(this.data.threads.course1).should('exist')
  })

  it('Rollout gate off hides Q&A in Manage', function () {
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQARolloutEnabled: false,
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Unable to disable the rollout gate')
      }
    })

    cy.loginLecturer()
    cy.visit(`${Cypress.env('URL_MANAGE')}/courses/${this.data.courseId}`)
    cy.get('[data-cy="course-name-with-pin"]').should(
      'contain',
      this.data.course
    )
    cy.get('[data-cy="tab-discussions"]').should('not.exist')
  })

  it('Rollout gate off fails closed for student integrated and fallback views', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-overview-qa-panel"]').should('not.exist')
    cy.visit(`${Cypress.env('URL_STUDENT')}/course/${this.data.courseId}/qa`)
    cy.get('[data-cy="course-qa-access-denied"]').should('exist')

    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQARolloutEnabled: true,
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: true,
    })
  })
})
