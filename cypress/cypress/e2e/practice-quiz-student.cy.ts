describe('Practice Quizzes as a Student', () => {
  beforeEach(() => {
    // cy.exec('cd .. && pnpm run prisma:setup:yes && cd cypress', {
    //   failOnNonZeroExit: false,
    // })
    cy.loginStudent()
  })

  it('run through a practice quiz', function () {
    cy.get('[data-cy="quizzes"]').click()

    cy.get('[data-cy="practice-quiz-Practice Quiz Demo Student Title"]').click()

    cy.get('[data-cy="start-practice-quiz"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="practice-quiz-progress-2"]').click()
    cy.get('[data-cy="practice-quiz-progress-1"]').click()
    cy.get('[data-cy="practice-quiz-progress-0"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="flashcard-front-2"]').click()
    cy.get('[data-cy="flashcard-response-2-Partially"]').click()
    cy.get('[data-cy="flashcard-front-3"]').click()
    cy.get('[data-cy="flashcard-response-3-No"]').click()
    cy.get('[data-cy="flashcard-front-4"]').click()
    cy.get('[data-cy="flashcard-response-4-Partially"]').click()
    cy.get('[data-cy="flashcard-front-5"]').click()
    cy.get('[data-cy="flashcard-response-5-Yes"]').click()
    cy.get('[data-cy="flashcard-front-6"]').click()
    cy.get('[data-cy="flashcard-response-6-Partially"]').click()
    cy.get('[data-cy="flashcard-front-7"]').click()
    cy.get('[data-cy="flashcard-response-7-No"]').click()
    cy.get('[data-cy="flashcard-front-8"]').click()
    cy.get('[data-cy="flashcard-response-8-Partially"]').click()
    cy.get('[data-cy="flashcard-front-9"]').click()
    cy.get('[data-cy="flashcard-response-9-Partially"]').click()
    cy.get('[data-cy="flashcard-front-10"]').click()
    cy.get('[data-cy="flashcard-response-10-Yes"]').click()
    cy.get('[data-cy="flashcard-front-11"]').click()
    cy.get('[data-cy="flashcard-response-11-Partially"]').click()
    cy.get('[data-cy="flashcard-front-12"]').click()
    cy.get('[data-cy="flashcard-response-12-No"]').click()
    cy.get('[data-cy="flashcard-front-13"]').click()
    cy.get('[data-cy="flashcard-response-13-No"]').click()
    cy.get('[data-cy="flashcard-front-14"]').click()
    cy.get('[data-cy="flashcard-response-14-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // TODO: continue with clean naming
    cy.get('.px-3 > .border > div').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('.px-3 > .border > div').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('.px-3 > .border > div').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('.flex-col > :nth-child(1) > .border').click()
    cy.get(':nth-child(2) > .flex > .prose-h4\\:text-md').click()
    cy.get('.flex-col > :nth-child(2) > .border > div').click()
    cy.get(':nth-child(3) > .border > div').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('.flex-1 > .flex-col').click()
    cy.get('[data-cy="flashcard-response-Yes"]').click()
    cy.get('.flex-col.gap-3 > .border-solid').click()
    cy.get('.border-solid > .border').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // TODO: check that answers are correctly shown on submission
    // TODO: check that skipping back and forth in quiz saves the previous answers
  })
})
