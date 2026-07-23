describe('Course Q&A practice workflow', function () {
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

  it('Creates a question for the practice quiz', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.question1.title,
      content: this.data.question1.content,
      choices: this.data.question1.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Creates and publishes a practice quiz', function () {
    cy.loginLecturer()
    cy.createPracticeQuiz({
      name: this.data.PQ.name,
      displayName: this.data.PQ.displayName,
      courseName: this.data.course,
      stacks: [{ elements: [this.data.question1.title] }],
    })

    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-practiceQuizzes"]').click()
    cy.get(`[data-cy="publish-practice-quiz-${this.data.PQ.name}"]`).click()
    cy.get('[data-cy="publish-practice-quiz-immediately"]').click()
  })

  it('Creates a course-level thread for scope-boundary checks', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-qa-thread-input"]').type(this.data.threads.course1)
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.threads.course1).should('exist')
  })

  it('Student completes a practice stack and posts in the in-page discussion', function () {
    cy.viewport('iphone-x')
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

  it('Course feed excludes stack-scoped threads', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).click()
    cy.get('[data-cy="course-overview-qa-panel"]').should('exist')
    cy.findByText(this.data.threads.course1).should('exist')
    cy.findByText(this.data.threads.stack1).should('not.exist')
  })

  it('Lecturer overview groups course and stack threads', function () {
    cy.loginLecturer()
    cy.get('[data-cy="courses"]').click()
    cy.get(`[data-cy="course-list-button-${this.data.course}"]`).click()
    cy.get('[data-cy="tab-discussions"]').click()

    cy.get('[data-cy="course-qa-refresh-overview"]').click()
    cy.get('[data-cy="course-qa-overview-groups"]').should('exist')
    cy.findByText(this.data.threads.course1).should('exist')
    cy.findByText(this.data.threads.stack1).should('exist')
  })
})
