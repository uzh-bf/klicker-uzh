import '@testing-library/cypress/add-commands'
import 'cypress-real-events'
import * as jose from 'jose'
import messages from '../../../packages/i18n/messages/en'

/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })

const loginFactory = (tokenData) => {
  return () => {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()

    cy.viewport('macbook-16')

    const secret = new TextEncoder().encode('abcd')
    const alg = 'HS256'

    cy.wrap(null).then(async () => {
      const token = await new jose.SignJWT(tokenData)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret)

      cy.setCookie('next-auth.session-token', token, {
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      })
    })

    cy.visit(Cypress.env('URL_MANAGE'))
  }
}

Cypress.Commands.add(
  'loginLecturer',
  loginFactory({
    email: 'lecturer@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8821',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: true,
  })
)

Cypress.Commands.add(
  'loginFreeUser',
  loginFactory({
    email: 'free@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8822',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: false,
    catalystIndividual: false,
  })
)

Cypress.Commands.add(
  'loginIndividualCatalyst',
  loginFactory({
    email: 'pro1@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8823',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: false,
    catalystIndividual: true,
  })
)

Cypress.Commands.add(
  'loginInstitutionalCatalyst',
  loginFactory({
    email: 'pro2@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8824',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
)

Cypress.Commands.add(
  'loginInstitutionalCatalyst2',
  loginFactory({
    email: 'pro3@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8825',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
)

Cypress.Commands.add('loginStudent', () => {
  cy.loginStudentPassword({ username: Cypress.env('STUDENT_USERNAME') })
})

Cypress.Commands.add(
  'loginStudentPassword',
  ({ username }: { username: string }) => {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(Cypress.env('URL_STUDENT_LOGIN'))
    cy.get('[data-cy="username-field"]').click().type(username)
    cy.get('[data-cy="password-field"]')
      .click()
      .type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
  }
)

Cypress.Commands.add('loginControlApp', () => {
  cy.visit(Cypress.env('URL_CONTROL'))
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.viewport('macbook-16')
  cy.get('[data-cy="login-logo"]').should('exist')
  cy.get('[data-cy="shortname-field"]').type(Cypress.env('LECTURER_SHORTNAME'))
  cy.get('@token').then((token) => {
    cy.get('[data-cy="token-field"]').type(String(token))
  })
  cy.get('[data-cy="submit-login"]').click()
})

interface AnswerCollectionArgs {
  name: string
  accessCy: string
  access: string
  description: string
  entries: string[]
}

Cypress.Commands.add(
  'createAnswerCollection',
  ({ name, accessCy, access, description, entries }: AnswerCollectionArgs) => {
    cy.get('[data-cy="create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').type(name)
    cy.get('[data-cy="answer-collection-name"]').should('have.value', name)

    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPRIVATE
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get(`[data-cy="answer-collection-access-${accessCy}"]`).click()
    cy.get('[data-cy="answer-collection-access"]').contains(access)

    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .type(description)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(description)

    cy.get('[data-cy="response-entry-0"]').type(entries[0])
    cy.get('[data-cy="response-entry-0"]').should('have.value', entries[0])
    cy.get('[data-cy="response-entry-1"]').type(entries[1])
    cy.get('[data-cy="response-entry-1"]').should('have.value', entries[1])
    entries.slice(2).forEach((value, ix) => {
      cy.get('[data-cy="add-response-entry"]').click()
      cy.get(`[data-cy="response-entry-${ix + 2}"]`).type(value)
      cy.get(`[data-cy="response-entry-${ix + 2}"]`).should('have.value', value)
    })

    cy.get('[data-cy="submit-create-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${name}"]`).should('exist')
    cy.get(`[data-cy="answer-collection-${name}"]`).contains(access)
  }
)

interface DeleteCollectionArgs {
  collectionName: string
}

Cypress.Commands.add(
  'deleteAnswerCollection',
  ({ collectionName }: DeleteCollectionArgs) => {
    cy.get(`[data-cy="answer-collection-${collectionName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${collectionName}"]`).should(
      'not.exist'
    )
  }
)

interface CreateChoicesQuestionArgs {
  title: string
  content: string
  choices: { content: string; correct?: boolean }[]
  multiplier?: string
}

Cypress.Commands.add(
  'createQuestionSC',
  ({ title, content, choices, multiplier }: CreateChoicesQuestionArgs) => {
    // throw an error if no choices were provided
    if (choices.length < 2) {
      throw new Error('SC questions require at least 2 choices')
    }

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(title)

    if (typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    cy.get('[data-cy="insert-question-text"]').realClick().type(content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(choices[0].content)

    cy.wrap(choices.slice(1)).each((choice: { content: string }, ix) => {
      cy.get('[data-cy="add-new-answer"]').click()
      cy.wait(500)
      cy.get(`[data-cy="insert-answer-field-${ix + 1}"]`)
        .realClick()
        .type(choice.content)
    })

    if (choices.some((choice) => typeof choice.correct !== 'undefined')) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })

      cy.wrap(choices).each((choice: { correct?: boolean }, ix) => {
        if (choice.correct) {
          cy.get(`[data-cy="set-correctness-${ix}"]`).click()
        }
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

Cypress.Commands.add(
  'createQuestionMC',
  ({ title, content, choices, multiplier }: CreateChoicesQuestionArgs) => {
    // throw an error if no choices were provided
    if (choices.length < 2) {
      throw new Error('MC questions require at least 2 choices')
    }

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.MC.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.MC.typeLabel)

    cy.get('[data-cy="insert-question-title"]').type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(choices[0].content)

    if (typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    cy.wrap(choices.slice(1)).each((choice: { content: string }, ix) => {
      cy.get('[data-cy="add-new-answer"]').click()
      cy.wait(500)
      cy.get(`[data-cy="insert-answer-field-${ix + 1}"]`)
        .realClick()
        .type(choice.content)
    })

    if (choices.some((choice) => typeof choice.correct !== 'undefined')) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })

      cy.wrap(choices).each((choice: { correct?: boolean }, ix) => {
        if (choice.correct) {
          cy.get(`[data-cy="set-correctness-${ix}"]`).click()
        }
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

Cypress.Commands.add(
  'createQuestionKPRIM',
  ({ title, content, choices, multiplier }: CreateChoicesQuestionArgs) => {
    // throw an error if there are not 4 choices
    if (choices.length !== 4) {
      throw new Error('KPRIM questions require exactly 4 choices')
    }

    const choice1 = choices[0]
    const choice2 = choices[1]
    const choice3 = choices[2]
    const choice4 = choices[3]

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.KPRIM.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.KPRIM.typeLabel)

    cy.get('[data-cy="insert-question-title"]').click().type(title)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()

    if (typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    cy.get('[data-cy="insert-question-text"]').realClick().type(content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(choice1.content)
    cy.get('[data-cy="insert-answer-field-0"]').findByText(choice1.content)
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(choice2.content)
    cy.get('[data-cy="insert-answer-field-1"]').findByText(choice2.content)
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .type(choice3.content)
    cy.get('[data-cy="insert-answer-field-2"]').findByText(choice3.content)
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .type(choice4.content)
    cy.get('[data-cy="insert-answer-field-3"]').findByText(choice4.content)
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus

    // set correctness values for KPRIM question
    if (choices.some((choice) => typeof choice.correct !== 'undefined')) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
      cy.get('[data-cy="set-correctness-0"]').click().type(choice4.content)
      cy.get('[data-cy="set-correctness-2"]').click().type(choice4.content)
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

interface CreateQuestionNRArgs {
  title: string
  content: string
  min?: string
  max?: string
  unit?: string
  accuracy?: string
  solutionRanges?: { min: string; max: string }[] | null
  exactSolutions?: string[] | null
  multiplier?: string
}

Cypress.Commands.add(
  'createQuestionNR',
  ({
    title,
    content,
    min,
    max,
    unit,
    accuracy,
    solutionRanges,
    exactSolutions,
    multiplier,
  }: CreateQuestionNRArgs) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.NUMERICAL.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.NUMERICAL.typeLabel)

    cy.get('[data-cy="insert-question-title"]').click().type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)

    if (typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    if (typeof min !== 'undefined') {
      cy.get('[data-cy="set-numerical-minimum"]').click().type(min)
    }
    if (typeof max !== 'undefined') {
      cy.get('[data-cy="set-numerical-maximum"]').click().type(max)
    }
    if (typeof unit !== 'undefined') {
      cy.get('[data-cy="set-numerical-unit"]').click().type(unit)
    }
    if (typeof accuracy !== 'undefined') {
      cy.get('[data-cy="set-numerical-accuracy"]').click().type(accuracy)
    }

    if (
      typeof solutionRanges !== 'undefined' &&
      solutionRanges !== null &&
      solutionRanges.length > 0
    ) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
      cy.get('[data-cy="set-solution-type-range"]').click()
      cy.wrap(solutionRanges).each(
        (range: { min: string; max: string }, ix) => {
          cy.get('[data-cy="add-solution-range"]').click()
          cy.get(`[data-cy="set-solution-range-min-${ix}"]`)
            .click()
            .type(range.min)
          cy.get(`[data-cy="set-solution-range-max-${ix}"]`)
            .click()
            .type(range.max)
        }
      )
    }

    if (
      typeof exactSolutions !== 'undefined' &&
      exactSolutions !== null &&
      exactSolutions.length > 0
    ) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
      cy.get('[data-cy="set-solution-type-exact"]').click()
      cy.wrap(exactSolutions).each((solution: string, ix) => {
        cy.get(`[data-cy="add-exact-solution"]`).click()
        cy.get(`[data-cy="set-exact-solution-${ix}"]`)
          .click()
          .type(String(solution))
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

interface CreateQuestionFTArgs {
  title: string
  content: string
  maxLength?: string
  solutions?: string[]
  multiplier?: string
}

Cypress.Commands.add(
  'createQuestionFT',
  ({
    title,
    content,
    maxLength,
    solutions,
    multiplier,
  }: CreateQuestionFTArgs) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FREE_TEXT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FREE_TEXT.typeLabel)

    cy.get('[data-cy="insert-question-title"]').click().type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)

    if (typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    if (typeof maxLength !== 'undefined') {
      cy.get('[data-cy="set-free-text-length"]').click().type(maxLength)
    }

    if (typeof solutions !== 'undefined' && solutions.length > 0) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
      cy.wrap(solutions).each((solution: string, ix) => {
        cy.get(`[data-cy="add-solution-value"]`).click()
        cy.get(`[data-cy="set-solution-ix-${ix}"]`).click().type(solution)
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

interface CreateSelectionArgs {
  title: string
  content: string
  explanation?: string
  collectionName: string
  numberOfInputs: number
  correctAnswers?: string[]
}

Cypress.Commands.add(
  'createQuestionSE',
  ({
    title,
    content,
    explanation,
    collectionName,
    numberOfInputs,
    correctAnswers,
  }: CreateSelectionArgs) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SELECTION.typeLabel)

    cy.get('[data-cy="insert-question-title"]').click().type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)

    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
    }

    cy.get('[data-cy="select-answer-collection"]').contains(
      messages.manage.questionForms.selectCollection
    )
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(`[data-cy="select-answer-collection-${collectionName}"]`).click()
    cy.get('[data-cy="select-answer-collection"]').contains(collectionName)
    cy.get('[data-cy="configure-number-of-inputs"]')
      .click()
      .type(String(numberOfInputs))

    if (correctAnswers && correctAnswers.length > 0) {
      cy.get('[data-cy="configure-sample-solution"]').click()
      correctAnswers.forEach((solution) => {
        cy.get('[data-cy="choose-correct-answer-options"]').click()
        cy.findByText(solution).realClick()
        cy.get('[data-cy="choose-correct-answer-options"]').contains(solution)
      })
    }

    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)
  }
)

interface CreateFlashcardArgs {
  title: string
  content: string
  explanation: string
}

Cypress.Commands.add(
  'createFlashcard',
  ({ title, content, explanation }: CreateFlashcardArgs) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FLASHCARD.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)

    cy.get('[data-cy="insert-question-title"]').type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(explanation)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

interface CreateContentArgs {
  title: string
  content: string
}

Cypress.Commands.add(
  'createContent',
  ({ title, content }: CreateContentArgs) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CONTENT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CONTENT.typeLabel)

    cy.get('[data-cy="insert-question-title"]').type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

interface DeleteElementArgs {
  elementName: string
}

Cypress.Commands.add('deleteElement', ({ elementName }: DeleteElementArgs) => {
  cy.get(`[data-cy="delete-question-${elementName}"]`).click()
  cy.get('[data-cy="confirm-question-deletion"]').click()
  cy.get(`[data-cy="element-item-${elementName}"]`).should('not.exist')
})

interface CreateLiveQuizArgs {
  name: string
  displayName: string
  courseName?: string
  blocks: { elements: string[] }[]
}

Cypress.Commands.add(
  'createLiveQuiz',
  ({ name, displayName, courseName, blocks }: CreateLiveQuizArgs) => {
    cy.get('[data-cy="create-live-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-live-quiz-name"]').type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-live-display-name"]').type(displayName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    if (typeof courseName !== 'undefined') {
      cy.get('[data-cy="select-course"]')
        .should('exist')
        .contains(messages.manage.activityWizard.liveQuizNoCourse)
      cy.get('[data-cy="select-course"]').click()
      cy.get(`[data-cy="select-course-${courseName}"]`).click()
      cy.get('[data-cy="select-course"]').contains(courseName)
    }
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Blocks & Questions
    cy.createStacks({
      stacks: blocks,
      type: 'block',
    })
    cy.get('[data-cy="next-or-submit"]').click()
  }
)

interface StackType {
  elements: string[]
}

function createStacks({
  stacks,
  type = 'stack',
}: {
  stacks: StackType[]
  type?: 'block' | 'stack'
}) {
  cy.wrap(stacks[0].elements).each((element: string, ix) => {
    const dataTransfer = new DataTransfer()
    cy.get(`[data-cy="element-item-${element}"]`)
      .contains(element)
      .trigger('dragstart', {
        dataTransfer,
      })
    cy.get(`[data-cy="drop-elements-${type}-0"]`).trigger('drop', {
      dataTransfer,
    })
    cy.get(`[data-cy="element-${ix}-${type}-0"]`).contains(
      element.substring(0, 20)
    )
  })

  if (stacks.length > 1) {
    cy.wrap(stacks.slice(1)).each((stack: { elements: string[] }, ix) => {
      cy.get(`[data-cy="drop-elements-add-${type}"]`).click()
      cy.wrap(stack.elements).each((element: string, jx) => {
        const dataTransfer = new DataTransfer()
        cy.get(`[data-cy="element-item-${element}"]`)
          .contains(element)
          .trigger('dragstart', {
            dataTransfer,
          })
        cy.get(`[data-cy="drop-elements-${type}-${ix + 1}"]`).trigger('drop', {
          dataTransfer,
        })
        cy.get(`[data-cy="element-${jx}-${type}-${ix + 1}"]`).contains(
          element.substring(0, 20)
        )
      })
    })
  }
}
Cypress.Commands.add('createStacks', createStacks)

interface CreatePracticeQuizArgs {
  name: string
  displayName: string
  description?: string
  courseName: string
  stacks: StackType[]
}

Cypress.Commands.add(
  'createPracticeQuiz',
  ({
    name,
    displayName,
    description,
    courseName,
    stacks,
  }: CreatePracticeQuizArgs) => {
    cy.get('[data-cy="create-practice-quiz"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-practice-quiz-name"]').click().type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-practice-quiz-display-name"]')
      .click()
      .type(displayName)

    if (typeof description !== 'undefined') {
      cy.get('[data-cy="insert-practice-quiz-description"]')
        .realClick()
        .type(description)
    }
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Stacks
    createStacks({ stacks })

    cy.get('[data-cy="next-or-submit"]').click()
  }
)

interface CreateMicrolearningArgs {
  name: string
  displayName: string
  description?: string
  courseName: string
  multiplier?: string
  startDate: string
  endDate: string
  stacks: StackType[]
}

Cypress.Commands.add(
  'createMicroLearning',
  ({
    name,
    displayName,
    description,
    courseName,
    multiplier,
    startDate,
    endDate,
    stacks,
  }: CreateMicrolearningArgs) => {
    cy.get('[data-cy="create-microlearning"]').click()

    // Step 1: Name
    cy.get('[data-cy="insert-microlearning-name"]').click().type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="insert-microlearning-display-name"]')
      .click()
      .type(displayName)
    if (description) {
      cy.get('[data-cy="insert-microlearning-description"]')
        .realClick()
        .type(description)
    }
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.get('[data-cy="select-start-date"]').click().type(startDate)
    cy.get('[data-cy="select-end-date"]').click().type(endDate)

    if (multiplier) {
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Stacks
    createStacks({ stacks })

    cy.get('[data-cy="next-or-submit"]').click()
  }
)

interface GroupActivityClueType {
  type: 'text' | 'number'
  name: string
  displayName: string
  content: string
  unit?: string
}

interface CreateGroupActivityArgs {
  name: string
  displayName: string
  task: string
  courseName: string
  multiplier?: string
  scheduledStartDate: string
  scheduledEndDate: string
  clues: GroupActivityClueType[]
  stack: StackType
}

Cypress.Commands.add(
  'createGroupActivity',
  ({
    name,
    displayName,
    task,
    courseName,
    multiplier,
    scheduledStartDate,
    scheduledEndDate,
    clues,
    stack,
  }: CreateGroupActivityArgs) => {
    // Step 1: Name
    cy.get('[data-cy="create-group-activity"]').click()
    cy.get('[data-cy="insert-groupactivity-name"]').click().type(name)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 2: Display name and description
    cy.get('[data-cy="back-activity-creation"]').click()
    cy.get('[data-cy="next-or-submit"]').click()
    cy.get('[data-cy="insert-groupactivity-display-name"]')
      .click()
      .type(displayName)
    cy.get('[data-cy="insert-groupactivity-description"]')
      .realClick()
      .type(task)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 3: Settings
    cy.get('[data-cy="select-course"]').click()
    cy.get(`[data-cy="select-course-${courseName}"]`).click()
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)

    if (multiplier) {
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    cy.get('[data-cy="select-start-date"]').click().type(scheduledStartDate)
    cy.get('[data-cy="select-end-date"]').click().type(scheduledEndDate)
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Clues
    cy.wrap(clues).each((clue: GroupActivityClueType) => {
      cy.get('[data-cy="add-group-activity-clue"]').click()
      cy.get('[data-cy="group-activity-clue-type"]').click()
      cy.get(
        `[data-cy="group-activity-clue-type-${clue.type === 'text' ? 'string' : 'number'}"]`
      ).click()
      cy.get('[data-cy="group-activity-clue-name"]').click().type(clue.name)
      cy.get('[data-cy="group-activity-clue-display-name"]')
        .click()
        .type(clue.displayName)
      cy.get(
        `[data-cy="group-activity-${clue.type === 'text' ? 'string' : 'number'}-clue-value"]`
      )
        .click()
        .type(clue.content)

      if (clue.type === 'number' && clue.unit) {
        cy.get('[data-cy="group-activity-number-clue-unit"]')
          .click()
          .type(clue.unit)
      }

      cy.get('[data-cy="group-activity-clue-save"]').click()
      cy.findByText(clue.name).should('exist')
    })

    // Step 4: Questions / Elements
    cy.createStacks({ stacks: [stack] })
    cy.get('[data-cy="next-or-submit"]').click()
  }
)

declare global {
  namespace Cypress {
    interface Chainable {
      loginLecturer(): Chainable<void>
      loginFreeUser(): Chainable<void>
      loginIndividualCatalyst(): Chainable<void>
      loginInstitutionalCatalyst(): Chainable<void>
      loginInstitutionalCatalyst2(): Chainable<void>
      loginStudent(): Chainable<void>
      loginStudentPassword({ username }: { username: string }): Chainable<void>
      loginControlApp(): Chainable<void>
      createAnswerCollection({
        name,
        accessCy,
        access,
        description,
        entries,
      }: AnswerCollectionArgs): Chainable<void>
      deleteAnswerCollection({
        collectionName,
      }: DeleteCollectionArgs): Chainable<void>
      createQuestionSC({
        title,
        content,
        choices,
        multiplier,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionMC({
        title,
        content,
        choices,
        multiplier,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionKPRIM({
        title,
        content,
        choices,
        multiplier,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionNR({
        title,
        content,
        min,
        max,
        unit,
        accuracy,
        solutionRanges,
        multiplier,
      }: CreateQuestionNRArgs): Chainable<void>
      createQuestionFT({
        title,
        content,
        maxLength,
        solutions,
        multiplier,
      }: CreateQuestionFTArgs): Chainable<void>
      createQuestionSE({
        title,
        content,
        explanation,
        collectionName,
        numberOfInputs,
        correctAnswers,
      }: CreateSelectionArgs): Chainable<void>
      createFlashcard({
        title,
        content,
        explanation,
      }: CreateFlashcardArgs): Chainable<void>
      createContent({ title, content }: CreateContentArgs): Chainable<void>
      deleteElement({ elementName }: DeleteElementArgs): Chainable<void>
      createLiveQuiz({
        name,
        displayName,
        courseName,
        blocks,
      }: CreateLiveQuizArgs): Chainable<void>
      createStacks({
        stacks,
        type,
      }: {
        stacks: StackType[]
        type?: 'block' | 'stack'
      }): Chainable<void>
      createPracticeQuiz({
        name,
        displayName,
        description,
        courseName,
        stacks,
      }: CreatePracticeQuizArgs): Chainable<void>
      createMicroLearning({
        name,
        displayName,
        description,
        courseName,
        multiplier,
        startDate,
        endDate,
        stacks,
      }: CreateMicrolearningArgs): Chainable<void>
      createGroupActivity({
        name,
        displayName,
        task,
        courseName,
        multiplier,
        scheduledStartDate,
        scheduledEndDate,
        clues,
        stack,
      }: CreateGroupActivityArgs): Chainable<void>
    }
  }
}
