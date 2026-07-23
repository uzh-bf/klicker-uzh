describe('Course Q&A workflows (course-level + stack-level discussions, embed, rollout gates)', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('Y-course-qa.json').then((data) => {
      this.data = data
    })
  })

  // Fail-fast handled globally in support/e2e.ts

  it('CLEANUP', function () {
    cy.cleanup()
    cy.seed()
    // ensure baseline QA flags are applied on Testkurs
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

  // ! Part 0: Preparation - Question + Practice Quiz
  // #region
  it('Create question required for course QA practice quiz scenarios', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.question1.title,
      content: this.data.question1.content,
      choices: this.data.question1.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Create + publish a practice quiz for stack-level discussion tests', function () {
    cy.loginLecturer()
    cy.createPracticeQuiz({
      name: this.data.PQ.name,
      displayName: this.data.PQ.displayName,
      courseName: this.data.course,
      stacks: [{ elements: [this.data.question1.title] }],
    })

    // publish the practice quiz
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="publish-practice-quiz-${this.data.PQ.name}"]`).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
  })
  // #endregion

  // ! Part 1: Lecturer-side Q&A tab visibility and overview
  // #region
  it('Lecturer sees Q&A tab on rollout-enabled course with empty overview initially', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()

    cy.get('[data-cy="tab-discussions"]').should('exist').click()
    cy.get('[data-cy="course-qa-overview-empty"]').should('exist')
    cy.get('[data-cy="course-qa-generate-embed"]').should('exist')
  })

  it('Lecturer toggles course-level QA settings through the course settings modal', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-settings-button"]').click()
    cy.get('[data-cy="course-qa-enabled"]').should('exist')
    cy.get('[data-cy="course-qa-anonymous-enabled"]').should('exist')
    cy.get('body').type('{esc}')
  })
  // #endregion

  // ! Part 2: Student course-level Q&A (post thread, upvote, reply)
  // #region
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

    // thread ids are DB auto-increment and not known up front — scope by prefix + .first()
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

    cy.findByText(this.data.threads.course1).should('exist')

    cy.get('[data-cy^="course-qa-thread-"]')
      .contains(this.data.threads.course1)
      .parents('[data-cy^="course-qa-thread-"]')
      .first()
      .invoke('attr', 'data-cy')
      .then((attr) => {
        const threadId = attr?.replace('course-qa-thread-', '')

        cy.get(`[data-cy="course-qa-reply-input-${threadId}"]`).type(
          this.data.threads.reply1
        )
        cy.get(`[data-cy="course-qa-create-reply-${threadId}"]`).click()

        cy.findByText(this.data.threads.reply1).should('exist')

        cy.get('[data-cy^="course-qa-reply-upvote-"]').first().click()
        cy.wait(500)
        cy.get('[data-cy^="course-qa-reply-upvote-"]')
          .first()
          .should('contain', '1')
      })
  })

  it('A second student can see the first thread + post their own', function () {
    cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME2') })
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()

    cy.findByText(this.data.threads.course1).should('exist')
    cy.get('[data-cy="course-qa-thread-input"]').type(this.data.threads.course2)
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.threads.course2).should('exist')
  })
  // #endregion

  // ! Part 3: Stack-level Q&A via practice quiz evaluation
  // #region
  it('Student completes a practice quiz stack and posts in its in-page discussion', function () {
    cy.loginStudent()
    cy.get('[data-cy="quizzes"]').click()
    cy.get(`[data-cy="practice-quiz-${this.data.PQ.displayName}"]`).click()
    cy.get('[data-cy="start-practice-quiz"]').click()

    cy.get('[data-cy="student-stack-discussion-rail"]').should('not.exist')
    cy.get('[data-cy="sc-0-answer-option-0"]').click()
    cy.get('[data-cy="student-stack-submit"]').click()
    cy.wait(500)

    cy.get('[data-cy="student-stack-discussion-rail"]').should('exist')
    cy.get('[data-cy="student-stack-discussion-toggle"]').click()
    cy.get('[data-cy="student-stack-discussion-toggle"]').should(
      'have.attr',
      'aria-expanded',
      'true'
    )
    cy.location('pathname').should('not.include', '/qa')

    cy.get('[data-cy="course-qa-thread-input"]').type(this.data.threads.stack1)
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.threads.stack1).should('exist')
  })

  it('Course-level feed does NOT aggregate stack-scoped threads (alpha surface boundary)', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-overview-qa-panel"]').should('exist')
    cy.findByText(this.data.threads.course1).should('exist')
    cy.findByText(this.data.threads.stack1).should('not.exist')
  })
  // #endregion

  // ! Part 4: Lecturer overview aggregates both course and stack threads
  // #region
  it('Lecturer overview groups show both course-scoped and stack-scoped threads', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-discussions"]').click()

    cy.get('[data-cy="course-qa-refresh-overview"]').click()
    cy.wait(500)

    cy.get('[data-cy="course-qa-overview-groups"]').should('exist')
    cy.findByText(this.data.threads.course1).should('exist')
    cy.findByText(this.data.threads.stack1).should('exist')
  })
  // #endregion

  // ! Part 5: Embed link generation + anonymous posting flow
  // #region
  it('Lecturer generates an embed link for an external block', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-discussions"]').click()
    cy.get('[data-cy="course-qa-embed-generator-toggle"]').click()

    cy.get('[data-cy="course-qa-generate-embed"]').should('be.disabled')
    cy.get('[data-cy="course-qa-external-source"]').type(
      this.data.embed.externalSource
    )
    cy.get('[data-cy="course-qa-external-ref"]').type(
      this.data.embed.externalRef
    )
    cy.get('[data-cy="course-qa-allow-anonymous-embed"]').check({ force: true })
    cy.get('[data-cy="course-qa-generate-embed"]').should('not.be.disabled')
    cy.get('[data-cy="course-qa-generate-embed"]').click()

    cy.get('[data-cy="course-qa-embed-url"]')
      .should('exist')
      .invoke('text')
      .then((embedUrl) => {
        // persist for subsequent tests (survives browser reload between it() blocks)
        cy.writeFile('cypress/fixtures/_qa-embed-url.txt', embedUrl.trim())
      })
  })

  it('Embed URL (with anonymous allowed) renders embedded + allows anonymous posting', function () {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.readFile('cypress/fixtures/_qa-embed-url.txt').then((embedUrl) => {
      if (!embedUrl) {
        throw new Error('embed url not set by previous test')
      }
      cy.visit(embedUrl)
    })

    cy.get('[data-cy="course-qa-thread-input"]').should('exist')
    cy.get('[data-cy="course-qa-thread-anonymous"]')
      .should('exist')
      .check({ force: true })
    cy.get('[data-cy="course-qa-thread-input"]').type(
      this.data.embed.anonymousThread
    )
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.embed.anonymousThread).should('exist')
    cy.get('[data-cy="course-qa-thread-input"]').should('have.value', '')
    cy.get('[data-cy="course-qa-thread-anonymous"]').should('not.be.checked')

    cy.get('[data-cy^="course-qa-thread-"]')
      .contains(this.data.embed.anonymousThread)
      .parents('[data-cy^="course-qa-thread-"]')
      .first()
      .invoke('attr', 'data-cy')
      .then((attr) => {
        const threadId = attr?.replace('course-qa-thread-', '')

        cy.get(`[data-cy="course-qa-reply-input-${threadId}"]`).type(
          this.data.embed.anonymousReply
        )
        cy.get(`[data-cy="course-qa-reply-anonymous-${threadId}"]`).check({
          force: true,
        })
        cy.get(`[data-cy="course-qa-create-reply-${threadId}"]`).click()

        cy.findByText(this.data.embed.anonymousReply).should('exist')
        cy.get(`[data-cy="course-qa-reply-input-${threadId}"]`).should(
          'have.value',
          ''
        )
        cy.get(`[data-cy="course-qa-reply-anonymous-${threadId}"]`).should(
          'not.be.checked'
        )
      })
  })

  it('Tampered embed token is rejected with access-denied', function () {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.readFile('cypress/fixtures/_qa-embed-url.txt').then((embedUrl) => {
      if (!embedUrl) {
        throw new Error('embed url not set by previous test')
      }

      // flip the token's final char to produce an invalid JWT signature
      const url = new URL(embedUrl)
      const token = url.searchParams.get('embedToken') ?? ''
      const tampered =
        token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a')
      url.searchParams.set('embedToken', tampered)

      cy.visit(url.toString())
    })

    cy.get('[data-cy="course-qa-access-denied"]').should('exist')
  })
  // #endregion

  // ! Part 6: Runtime toggle (rollout on, runtime off/on)
  // #region
  it('Disabling isCourseQAEnabled hides the integrated panel and shows the fallback notice', function () {
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

  it('Lecturer still sees the tab but overview shows disabled notice when runtime is off', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-discussions"]').should('exist').click()
    cy.get('[data-cy="course-qa-disabled-notice"]').should('exist')
  })

  it('Re-enabling isCourseQAEnabled restores the student QA surface', function () {
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
  // #endregion

  // ! Part 7: Rollout gate off
  // #region
  it('Turning off the rollout gate hides the Q&A tab in Manage (lecturer)', function () {
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQARolloutEnabled: false,
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Unable to disable the rollout gate')
      }
    })

    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-name-with-pin"]').should(
      'contain',
      this.data.course
    )
    cy.get('[data-cy="tab-discussions"]').should('not.exist')
  })

  it('Rollout gate off: student direct /qa visit fails closed and integrated panel is hidden', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-overview-qa-panel"]').should('not.exist')
    cy.visit(`${Cypress.env('URL_STUDENT')}/course/${this.data.courseId}/qa`)
    cy.get('[data-cy="course-qa-access-denied"]').should('exist')

    // restore the baseline rollout gate for subsequent runs / spec state
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQARolloutEnabled: true,
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: true,
    })
  })
  // #endregion
})
