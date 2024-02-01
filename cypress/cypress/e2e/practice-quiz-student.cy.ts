import messages from '../../../packages/i18n/messages/en'

describe('Practice Quizzes as a Student', () => {
  beforeEach(() => {
    // cy.exec('cd .. && pnpm run prisma:setup:yes && cd cypress', {
    //   failOnNonZeroExit: false,
    // })
    cy.loginStudent()
  })

  it('run through a practice quiz', function () {
    cy.clearLocalStorage()
    cy.clearAllSessionStorage()
    cy.get('[data-cy="quizzes"]').click()

    cy.get('[data-cy="practice-quiz-Practice Quiz Demo Student Title"]').click()

    cy.get('[data-cy="start-practice-quiz"]').click()

    // answer stacks with single flashcards
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // skip back and forth
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="practice-quiz-progress-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-progress-0"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // answer another stack with a single flashcard
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-response-1-Partially"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // TODO: remove from seed or answer as well
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

    // answer stack with all flashcards
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
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
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="flashcard-front-14"]').click()
    cy.get('[data-cy="flashcard-response-14-Yes"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // TODO: answer free text question
    cy.get('[data-cy="practice-quiz-progress-right"]').click() // TODO: remove
    // cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // answer MC question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-1-answer-option-2"]').click()
    cy.get('[data-cy="mc-1-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // TODO: answer numerical question
    cy.get('[data-cy="practice-quiz-progress-right"]').click() // TODO: remove
    // cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // answer KPRIM question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-1-correct"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-2-incorrect"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-3-incorrect"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-1-answer-4-correct"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // answer SC question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="sc-1-answer-option-2"]').click()
    cy.get('[data-cy="sc-1-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // answer MC, PRIM and SC question
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="mc-2-answer-option-2"]').click()
    cy.get('[data-cy="mc-2-answer-option-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="toggle-kp-4-answer-1-correct"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-2-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-3-incorrect"]').click()
    cy.get('[data-cy="toggle-kp-4-answer-4-correct"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('be.disabled')
    cy.get('[data-cy="sc-5-answer-option-2"]').click()
    cy.get('[data-cy="sc-5-answer-option-2"]').click()
    cy.get('[data-cy="sc-5-answer-option-3"]').click()
    // cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    // cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click() // TODO: remove

    // answer content elements (single and stacked)
    cy.get('[data-cy="practice-quiz-stack-submit"]').should('not.be.disabled')
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="read-content-element-2"]').click()
    cy.get('[data-cy="read-content-element-3"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // use automatic marking as read for second content element stack
    cy.get('[data-cy="read-content-element-1"]').click()
    cy.get('[data-cy="practice-quiz-stack-submit"]').contains(
      messages.pwa.practiceQuiz.markAllAsRead
    ) // contains mark all as read
    cy.get('[data-cy="practice-quiz-stack-submit"]').click() // mark all as read
    cy.get('[data-cy="practice-quiz-stack-submit"]').contains(
      messages.shared.generic.continue
    ) // contains continue
    cy.get('[data-cy="practice-quiz-stack-submit"]').click() // continue / submit stack

    // TODO: add validity checks / disabled submission button checks for the following cases
    // answer combined stack with flashcard, content element and question
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-Yes"]').click()
    // TODO: answer question in combined stack
    cy.get('[data-cy="read-content-element-3"]').click()
    cy.get('[data-cy="practice-quiz-progress-right"]').click() // TODO: remove
    // cy.get('[data-cy="practice-quiz-stack-submit"]').click()

    // answer combined stack with flashcard, content element and question
    cy.get('[data-cy="practice-quiz-stack-submit"]')
      .contains(messages.pwa.practiceQuiz.markAllAsRead)
      .should('be.disabled') // contains mark all as read and is disabled
    cy.get('[data-cy="flashcard-front-1"]').click()
    cy.get('[data-cy="flashcard-response-1-No"]').click()
    // TODO: answer question in combined stack
    cy.get('[data-cy="practice-quiz-stack-submit"]').contains(
      messages.pwa.practiceQuiz.markAllAsRead
    ) // contains mark all as read
    cy.get('[data-cy="practice-quiz-progress-right"]').click() // TODO: remove
    // cy.get('[data-cy="practice-quiz-stack-submit"]').click() // mark all as read
    // cy.get('[data-cy="practice-quiz-stack-submit"]').contains(
    //   messages.shared.generic.finish
    // ) // contains continue
    // cy.get('[data-cy="practice-quiz-stack-submit"]').click() // continue / submit stack

    // TODO: check that answers are correctly shown on submission
    // TODO: check that skipping back and forth in quiz saves the previous answers
    // TODO: check that resetting answers works as to be expected
  })
})
