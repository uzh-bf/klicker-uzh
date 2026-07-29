describe('Course Q&A course-level workflows', function () {
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

  it('Lecturer sees Q&A tab on rollout-enabled course with empty overview initially', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    cy.get('[data-cy="tab-discussions"]').should('exist').click()
    cy.get('[data-cy="course-qa-overview-empty"]').should('exist')
    cy.get('[data-cy="course-qa-generate-embed"]').should('exist')
  })

  it('Lecturer sees course-level Q&A settings', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-settings-button"]').click()
    cy.get('[data-cy="course-qa-enabled"]').should('exist')
    cy.get('[data-cy="course-qa-anonymous-enabled"]').should('exist')
    cy.get('body').type('{esc}')
  })

  it('Read-only course users do not see write-only Q&A tools', function () {
    cy.task('grantCourseReadAccess', {
      courseName: this.data.course,
      userEmail: 'free@df.uzh.ch',
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Could not grant read access to the Q&A course')
      }
    })

    cy.loginFreeUser()
    cy.visit(
      `${Cypress.env('URL_MANAGE')}/courses/${this.data.courseId}?tab=discussions`
    )
    cy.get('[data-cy="tab-discussions"]').should('not.exist')
    cy.get('[data-cy="course-qa-overview-empty"]').should('not.exist')
    cy.get('[data-cy="course-qa-generate-embed"]').should('not.exist')
  })

  it('Student sees integrated Q&A on the course overview and can open the fallback page', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()

    cy.get('[data-cy="course-overview-qa-panel"]').should('exist')
    cy.location('pathname').should('not.include', '/qa')
    cy.get('[data-cy="course-qa-empty"]').should('exist')

    cy.visit(`${Cypress.env('URL_STUDENT')}/course/${this.data.courseId}/qa`)
    cy.location('pathname').should(
      'include',
      `/course/${this.data.courseId}/qa`
    )
    cy.get('[data-cy="course-qa-empty"]').should('exist')
  })

  it('Student can expand the collapsed course Q&A on mobile', function () {
    cy.viewport(390, 844)
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()

    cy.get('[data-cy="course-overview-qa-toggle"]')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false')
    cy.get('[data-cy="course-qa-thread-input"]').should('not.be.visible')

    cy.get('[data-cy="course-overview-qa-toggle"]').click()
    cy.get('[data-cy="course-overview-qa-toggle"]').should(
      'have.attr',
      'aria-expanded',
      'true'
    )
    cy.get('[data-cy="course-qa-thread-input"]').should('be.visible')
  })

  it('Malformed external scope links fail closed without crashing the fallback page', function () {
    cy.loginStudent()
    const malformedScope = encodeURIComponent('ext:%E0%A4%A:ref')

    cy.visit(
      `${Cypress.env('URL_STUDENT')}/course/${this.data.courseId}/qa?scopeKey=${malformedScope}`
    )

    cy.get('[data-cy="course-qa-access-denied"]').should('exist')
    cy.get('[data-cy="course-qa-thread-input"]').should('not.exist')
  })

  context('Q&A-only course overview', function () {
    let originalSettings: {
      isGamificationEnabled: boolean
      isAssessmentEnabled: boolean
      description: string | null
    } | null = null

    beforeEach(function () {
      cy.task('getCourseOverviewSettings', {
        courseName: this.data.course,
      }).then((result) => {
        if (!result) {
          throw new Error('Could not read the course overview settings')
        }
        originalSettings = result as typeof originalSettings
      })
    })

    afterEach(function () {
      if (!originalSettings) return

      cy.task('setCourseQAFlags', {
        courseName: this.data.course,
        ...originalSettings,
      }).then((result: boolean) => {
        if (result === false) {
          throw new Error('Could not restore the course overview settings')
        }
      })
    })

    it('Student sees integrated Q&A when the course has no other overview content', function () {
      cy.task('setCourseQAFlags', {
        courseName: this.data.course,
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        description: null,
      }).then((result: boolean) => {
        if (result === false) {
          throw new Error('Could not configure a Q&A-only course')
        }
      })

      cy.loginStudent()
      cy.visit(`${Cypress.env('URL_STUDENT')}/course/${this.data.courseId}`)
      cy.get('[data-cy="course-overview-qa-panel"]').should('exist')
      cy.get('[data-cy="course-qa-empty"]').should('exist')
    })
  })

  it('Student creates a course-level thread and sees it appear', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()

    cy.get('[data-cy="course-qa-create-thread"]').should('be.disabled')
    cy.get('[data-cy="course-qa-thread-input"]').type(this.data.threads.course1)
    cy.get('[data-cy="course-qa-create-thread"]').should('not.be.disabled')
    cy.get('[data-cy="course-qa-create-thread"]').click()

    cy.findByText(this.data.threads.course1).should('exist')
    cy.get('[data-cy="course-qa-empty"]').should('not.exist')
  })

  it('Student upvotes their newly created thread and toggles it back off', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.findByText(this.data.threads.course1).should('exist')

    cy.get('[data-cy^="course-qa-thread-upvote-"]').first().click()
    cy.wait(500)
    cy.get('[data-cy^="course-qa-thread-upvote-"]')
      .first()
      .should('contain', '1')
    cy.get('[data-cy^="course-qa-thread-upvote-"]').first().click()
    cy.wait(500)
    cy.get('[data-cy^="course-qa-thread-upvote-"]')
      .first()
      .should('contain', '0')
  })

  it('Student replies to the thread and upvotes the reply', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()

    cy.contains(
      '[data-cy^="course-qa-thread-content-"]',
      this.data.threads.course1
    )
      .parents('[data-cy^="course-qa-thread-"]')
      .first()
      .within(() => {
        cy.get('[data-cy^="course-qa-reply-input-"]').type(
          this.data.threads.reply1
        )
        cy.get('[data-cy^="course-qa-create-reply-"]').click()
        cy.findByText(this.data.threads.reply1).should('exist')
        cy.get('[data-cy^="course-qa-reply-upvote-"]').first().click()
        cy.wait(500)
        cy.get('[data-cy^="course-qa-reply-upvote-"]')
          .first()
          .should('contain', '1')
      })
  })

  it('A second student can see the first thread and post their own', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()

    cy.findByText(this.data.threads.course1).should('exist')
    cy.get('[data-cy="course-qa-thread-input"]').type(this.data.threads.course2)
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.threads.course2).should('exist')
  })

  it('Lecturer refreshes paginated discussions without losing a boundary thread', function () {
    const initialThreads = Array.from(
      { length: 21 },
      (_, index) => `Pagination thread ${index + 1}`
    )
    const newestThread = 'Pagination thread added after page two'

    cy.task('seedCourseDiscussionThreads', {
      courseName: this.data.course,
      contents: initialThreads,
      replaceExisting: true,
    }).should('equal', true)

    cy.loginLecturer()
    cy.visit(`${Cypress.env('URL_MANAGE')}/courses/${this.data.courseId}`)
    cy.get('[data-cy="tab-discussions"]').click()
    cy.get('[data-cy^="course-qa-overview-thread-"]').should('have.length', 20)
    cy.get('[data-cy="course-qa-load-more-overview"]').click()
    cy.get('[data-cy^="course-qa-overview-thread-"]').should('have.length', 21)

    cy.task('seedCourseDiscussionThreads', {
      courseName: this.data.course,
      contents: [newestThread],
    }).should('equal', true)
    cy.get('[data-cy="course-qa-refresh-overview"]').click()
    cy.findByText(newestThread).should('exist')
    cy.get('[data-cy="course-qa-load-more-overview"]').should('not.be.disabled')
    cy.get('[data-cy="course-qa-load-more-overview"]').click()

    cy.get('[data-cy^="course-qa-overview-thread-"]').should('have.length', 22)
    cy.findByText('Pagination thread 2').should('exist')
  })
})
