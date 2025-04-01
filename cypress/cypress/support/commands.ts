import { CatalogObjectType } from '@klicker-uzh/types'
import '@testing-library/cypress/add-commands'
import 'cypress-real-events'
import * as jose from 'jose'
import * as localforage from 'localforage'
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
    localforage.setItem('hideLecturerSurvey', 'true')

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

Cypress.Commands.add('logoutLecturer', () => {
  cy.clearCookie('next-auth.session-token')
})

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

interface AnswerCollectionArgs {
  name: string
  description: string
  entries: string[]
  userId: string
}

Cypress.Commands.add(
  'createAnswerCollection',
  ({ name, description, entries, userId }: AnswerCollectionArgs) => {
    // trigger answer collection creation directly through prisma action
    cy.task('createAnswerCollection', {
      name,
      description,
      entries,
      userId,
    }).then((quiz: { id: string; courseId: string }) => {
      // check if the query was successful
      if (quiz === null) {
        throw new Error('Answer collection creation failed!')
      }
    })

    // check if the created answer collection is visible
    cy.reload()
    cy.get(`[data-cy="answer-collection-${name}"]`).should('exist')
  }
)

interface DeleteCollectionArgs {
  collectionName: string
}

Cypress.Commands.add(
  'deleteAnswerCollection',
  ({ collectionName }: DeleteCollectionArgs) => {
    cy.get(`[data-cy="answer-collection-actions-${collectionName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${collectionName}"]`).should(
      'not.exist'
    )
  }
)

interface AddObjectToCatalogArgs {
  objectName: string
  objectType: CatalogObjectType
  permissionLevel: 'public' | 'restricted'
}

Cypress.Commands.add(
  'addObjectToCatalog',
  ({ objectName, objectType, permissionLevel }: AddObjectToCatalogArgs) => {
    cy.get('[data-cy="add-object-to-catalog-button"]').click()

    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(`[data-cy="object-type-${objectType}"]`).click()
    cy.get('[data-cy="object-type-selection"]').contains(
      messages.shared.types[objectType]
    )

    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-restricted"]').should('exist')
    cy.get('[data-cy="object-access-public"]').should('exist')
    cy.get(`[data-cy="object-access-${permissionLevel}"]`).click()

    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.findByText(objectName).click()
    cy.get('[data-cy="submit-add-object-button"]').click()

    cy.get(`[data-cy="catalog-object-${objectName}"]`).should('exist')
  }
)

interface CreateChoicesQuestionArgs {
  title: string
  content: string
  explanation?: string
  choices: { content: string; feedback?: string; correct?: boolean }[]
  multiplier?: string
}

Cypress.Commands.add(
  'createQuestionSC',
  ({
    title,
    content,
    explanation,
    choices,
    multiplier,
  }: CreateChoicesQuestionArgs) => {
    // throw an error if no choices were provided
    if (choices.length < 2) {
      throw new Error('SC questions require at least 2 choices')
    }

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(title)

    // enter optional explanation
    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
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

    // set correctness values for SC question
    const hasSampleSolution = choices.some(
      (choice) => typeof choice.correct !== 'undefined'
    )
    if (hasSampleSolution) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })

      cy.wrap(choices).each((choice: { correct?: boolean }, ix) => {
        if (choice.correct) {
          cy.get(`[data-cy="set-correctness-${ix}"]`).click()
        }
      })
    }

    // multiplier only takes effect with sample solution activated
    if (hasSampleSolution && typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    // set answer feedbacks for SC question
    if (choices.every((choice) => typeof choice.feedback !== 'undefined')) {
      cy.get('[data-cy="configure-answer-feedbacks"]').click()

      cy.wrap(choices).each((choice: { feedback: string }, ix) => {
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
          .realClick()
          .type(choice.feedback)
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`).contains(
          choice.feedback
        )
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

Cypress.Commands.add(
  'createQuestionMC',
  ({
    title,
    content,
    explanation,
    choices,
    multiplier,
  }: CreateChoicesQuestionArgs) => {
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

    // enter optional explanation
    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
    }

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

    // set correctness values for MC question
    const hasSampleSolution = choices.some(
      (choice) => typeof choice.correct !== 'undefined'
    )
    if (hasSampleSolution) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })

      cy.wrap(choices).each((choice: { correct?: boolean }, ix) => {
        if (choice.correct) {
          cy.get(`[data-cy="set-correctness-${ix}"]`).click()
        }
      })
    }

    // multiplier only takes effect with sample solution activated
    if (hasSampleSolution && typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    // set answer feedbacks for MC question
    if (choices.every((choice) => typeof choice.feedback !== 'undefined')) {
      cy.get('[data-cy="configure-answer-feedbacks"]').click()

      cy.wrap(choices).each((choice: { feedback: string }, ix) => {
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
          .realClick()
          .type(choice.feedback)
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`).contains(
          choice.feedback
        )
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

Cypress.Commands.add(
  'createQuestionKPRIM',
  ({
    title,
    content,
    explanation,
    choices,
    multiplier,
  }: CreateChoicesQuestionArgs) => {
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

    // enter optional explanation
    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
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
    const hasSampleSolution = choices.some(
      (choice) => typeof choice.correct !== 'undefined'
    )
    if (hasSampleSolution) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
      cy.get('[data-cy="set-correctness-0"]').click().type(choice4.content)
      cy.get('[data-cy="set-correctness-2"]').click().type(choice4.content)
    }

    // multiplier only takes effect with sample solution activated
    if (hasSampleSolution && typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    // set answer feedbacks for KPRIM question
    if (choices.every((choice) => typeof choice.feedback !== 'undefined')) {
      cy.get('[data-cy="configure-answer-feedbacks"]').click()

      cy.wrap(choices).each((choice: { feedback: string }, ix) => {
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`)
          .realClick()
          .type(choice.feedback)
        cy.get(`[data-cy="insert-answer-feedback-${ix}"]`).contains(
          choice.feedback
        )
      })
    }

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)
  }
)

interface CreateQuestionNRArgs {
  title: string
  content: string
  explanation?: string
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
    explanation,
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

    // enter optional explanation
    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
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

    // set solution ranges
    const hasSampleSolution =
      typeof solutionRanges !== 'undefined' &&
      solutionRanges !== null &&
      solutionRanges.length > 0
    if (hasSampleSolution) {
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

    // multiplier only takes effect with sample solution activated
    if (hasSampleSolution && typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
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
  explanation?: string
  maxLength?: string
  solutions?: string[]
  multiplier?: string
}

Cypress.Commands.add(
  'createQuestionFT',
  ({
    title,
    content,
    explanation,
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

    // enter optional explanation
    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
    }

    if (typeof maxLength !== 'undefined') {
      cy.get('[data-cy="set-free-text-length"]').click().type(maxLength)
    }

    // set solution values
    const hasSampleSolution =
      typeof solutions !== 'undefined' && solutions.length > 0
    if (hasSampleSolution) {
      cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
      cy.wrap(solutions).each((solution: string, ix) => {
        cy.get(`[data-cy="add-solution-value"]`).click()
        cy.get(`[data-cy="set-solution-ix-${ix}"]`).click().type(solution)
      })
    }

    // multiplier only takes effect with sample solution activated
    if (hasSampleSolution && typeof multiplier !== 'undefined') {
      cy.get('[data-cy="select-multiplier"]')
        .should('exist')
        .contains(messages.manage.activityWizard.multiplier1)
      cy.get('[data-cy="select-multiplier"]').click()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).click()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
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

interface CreateCaseStudyArgs {
  title: string
  content: string
  explanation?: string
  collectionName: string
  selectedItems: string[]
  criteria: {
    mode: 'range' | 'steps'
    name: string
    // range criterion attributes
    min?: number
    max?: number
    step?: number
    unit?: string
    // steps criterion attribute
    steps?: number
    labels?: {
      min: string
      mid?: string
      max: string
    }
  }[]
  cases: {
    title: string
    description: string
  }[]
  solutions?: {
    [caseIx: string]: {
      [itemIx: string]: {
        [criterionIx: string]: {
          lower: number
          upper: number
        }
      }
    }
  }
}

Cypress.Commands.add(
  'createQuestionCS',
  ({
    title,
    content,
    explanation,
    collectionName,
    selectedItems,
    criteria,
    cases,
    solutions,
  }: CreateCaseStudyArgs) => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CASE_STUDY.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CASE_STUDY.typeLabel)

    // enter title and content
    cy.get('[data-cy="insert-question-title"]').click().type(title)
    cy.get('[data-cy="insert-question-text"]').realClick().type(content)

    // enter optional explanation
    if (explanation) {
      cy.get('[data-cy="insert-question-explanation"]')
        .realClick()
        .type(explanation)
    }

    // select an answer collection
    cy.get('[data-cy="select-answer-collection"]').contains(
      messages.manage.questionForms.selectCollection
    )
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(`[data-cy="select-answer-collection-${collectionName}"]`).click()
    cy.get('[data-cy="select-answer-collection"]').contains(collectionName)

    // select items for case study
    cy.wrap(selectedItems).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').click()
      cy.findByText(item).realClick()
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    // add criteria
    cy.wrap(criteria).each(
      (criterion: CreateCaseStudyArgs['criteria'][0], ix) => {
        cy.get(`[data-cy="add-${criterion.mode}-criterion"]`).click()
        cy.get(`[data-cy="criterion-${ix}-name"]`)
          .click()
          .clear()
          .type(criterion.name)

        // for range criteria, enter min, max, and step - unit is optional
        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`)
            .click()
            .clear()
            .type(String(criterion.min))
          cy.get(`[data-cy="criterion-${ix}-max"]`)
            .click()
            .clear()
            .type(String(criterion.max))
          cy.get(`[data-cy="criterion-${ix}-step"]`)
            .click()
            .clear()
            .type(String(criterion.step))
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`)
              .click()
              .type(criterion.unit)
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.min))
          cy.get(`[data-cy="criterion-${ix}-max-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.max))
          cy.get(`[data-cy="criterion-${ix}-steps"]`)
            .click()
            .clear()
            .type(String(criterion.steps))

          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`)
              .click()
              .clear()
              .type(String(criterion.labels.mid))
          }
        } else {
          throw new Error('Invalid criterion mode')
        }

        // validate inputs for both range and steps / likert criteria
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )

        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`).should(
            'have.value',
            String(criterion.min)
          )
          cy.get(`[data-cy="criterion-${ix}-max"]`).should(
            'have.value',
            String(criterion.max)
          )
          cy.get(`[data-cy="criterion-${ix}-step"]`).should(
            'have.value',
            String(criterion.step)
          )
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
              'have.value',
              criterion.unit
            )
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`).should(
            'have.value',
            criterion.labels.min
          )
          cy.get(`[data-cy="criterion-${ix}-max-label"]`).should(
            'have.value',
            criterion.labels.max
          )
          cy.get(`[data-cy="criterion-${ix}-steps"]`).should(
            'have.value',
            String(criterion.steps)
          )
          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`).should(
              'have.value',
              criterion.labels.mid
            )
          }
        } else {
          throw new Error('Invalid criterion mode')
        }
      }
    )

    // add cases
    cy.wrap(cases).each((caseItem: CreateCaseStudyArgs['cases'][0], ix) => {
      // add new case information
      cy.get('[data-cy="add-new-case"]').click()
      cy.get(`[data-cy="case-title-${ix}"]`).click().type(caseItem.title)
      cy.get(`[data-cy="case-description-${ix}"]`)
        .realClick()
        .type(caseItem.description)

      // verify that all data has been entered correctly
      cy.get(`[data-cy="case-title-${ix}"]`).should(
        'have.value',
        caseItem.title
      )
      cy.get(`[data-cy="case-description-${ix}"]`).contains(
        caseItem.description
      )
    })

    // add solutions (if defined)
    if (solutions) {
      cy.get('[data-cy="configure-sample-solution"]').click()
      Object.entries(solutions).forEach(([caseIx, caseValue]) => {
        Object.entries(caseValue).forEach(([itemIx, itemValue]) => {
          Object.entries(itemValue).forEach(([criterionIx, criterionValue]) => {
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
            )
              .click()
              .type(String(criterionValue.lower))
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
            )
              .click()
              .type(String(criterionValue.upper))

            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
            ).should('have.value', String(criterionValue.lower))
            cy.get(
              `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
            ).should('have.value', String(criterionValue.upper))
          })
        })
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
  cy.get(`[data-cy="delete-question-${elementName}"]`).first().click()
  cy.get('[data-cy="confirm-question-deletion"]').click()
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

interface ConvertLiveQuizToTemplateArgs {
  liveQuiz: string
  name: string
  description: string
  instructions: string
  copyBeforeConversion: boolean // flag to signal if the existing live quiz should be converted into a template or a copy should be created first
  resourceAccessRequired: boolean // flag to signal if elements with answer collection dependencies are used in the activity
}

Cypress.Commands.add(
  'convertLiveQuizToTemplate',
  ({
    liveQuiz,
    name,
    description,
    instructions,
    copyBeforeConversion,
    resourceAccessRequired,
  }: ConvertLiveQuizToTemplateArgs) => {
    // depending on the setting, choose between conversion and copy & conversion of activity
    cy.get(`[data-cy="template-from-live-quiz-${liveQuiz}"]`).click()

    if (copyBeforeConversion) {
      cy.get('[data-cy="copy-option-template"]').click()
      cy.get('[data-cy="confirm-activity-unavailability"]').should('not.exist')
    } else {
      cy.get('[data-cy="convert-option-template"]').click()
      cy.get('[data-cy="template-next-step"]').should('be.disabled')
      cy.get('[data-cy="confirm-activity-unavailability"]').click()
    }

    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-content-visibility"]').click()
    cy.get('[data-cy="confirm-content-visibility"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').should('be.disabled')
    cy.get('[data-cy="confirm-question-access"]').click()
    cy.get('[data-cy="confirm-question-access"]').should('not.exist')
    if (resourceAccessRequired) {
      cy.get('[data-cy="template-next-step"]').should('be.disabled')
      cy.get('[data-cy="confirm-resource-access"]').click()
    }
    cy.get('[data-cy="confirm-resource-access"]').should('not.exist')
    cy.get('[data-cy="template-next-step"]').click()

    // insert name, description and instructions for the new template
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-name"]').click().type(name)
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-description"]').realClick().type(description)
    cy.get('[data-cy="submit-template-creation"]').should('be.disabled')
    cy.get('[data-cy="template-instructions"]').realClick().type(instructions)
    cy.get('[data-cy="submit-template-creation"]').click()
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

function computeCaseStudySlidedValue({ criterion, answer }) {
  const criterionMin = criterion.min
  const criterionMax = criterion.max
  const criterionStep = criterion.step
  const midValue = criterionMin + (criterionMax - criterionMin) / 2
  const signedSteps = (answer.click === '{leftarrow}' ? -1 : 1) * answer.steps
  const slidedValue = Math.max(
    Math.min(midValue + signedSteps * criterionStep, criterionMax),
    criterionMin
  )

  return slidedValue
}

interface CaseStudyLoopArgs {
  object: any
  callback: ({
    caseIx,
    itemIx,
    criterionIx,
    innerValue,
  }: {
    caseIx: number
    itemIx: number
    criterionIx: number
    innerValue: any
  }) => void
}

Cypress.Commands.add(
  'caseStudyLoop',
  ({ object, callback }: CaseStudyLoopArgs) => {
    Object.entries(object).forEach(([caseIx, caseValue]) => {
      Object.entries(caseValue).forEach(([itemIx, itemValue]) => {
        Object.entries(itemValue).forEach(([criterionIx, innerValue]) => {
          callback({
            caseIx: Number(caseIx),
            itemIx: Number(itemIx),
            criterionIx: Number(criterionIx),
            innerValue,
          })
        })
      })
    })
  }
)

interface AnswerCaseStudyArgs {
  elementIx: number
  answers: {
    [caseIx: string]: {
      [itemIx: string]: {
        [criterionIx: string]: { click: string; steps: number }
      }
    }
  }
  criteria: { min: number; max: number; step: number; unit?: string | null }[]
  initialValidation?: any
  cases?: { id: string }[]
  sequentialUI?: boolean
}

Cypress.Commands.add(
  'answerCaseStudy',
  ({
    elementIx,
    answers,
    criteria,
    initialValidation,
    cases,
    sequentialUI = false,
  }: AnswerCaseStudyArgs) => {
    Object.entries(answers).forEach(([caseIx, caseAnswer]) => {
      Object.entries(caseAnswer).forEach(([itemIx, itemAnswer]) => {
        Object.entries(itemAnswer).forEach(([criterionIx, answer]) => {
          // optional initial validation statement
          {
            initialValidation
          }

          // move sliders to answer values
          cy.get(
            `[data-cy="cs-slider-${elementIx}-${parseInt(caseIx)}-${parseInt(itemIx)}-${parseInt(criterionIx)}"]`
          )
            .click()
            .type(answer.click.repeat(answer.steps))

          // verify that correct value is set
          const criterion = criteria[criterionIx]
          const slidedValue = computeCaseStudySlidedValue({
            criterion,
            answer,
          })
          cy.get(
            `[data-cy="cs-slider-nr-value-${elementIx}-${parseInt(caseIx)}-${parseInt(itemIx)}-${parseInt(criterionIx)}"]`
          ).contains(
            criterion.unit ? `${slidedValue} ${criterion.unit}` : slidedValue
          )
        })
      })

      // switch to the next case, if sequential UI is enabled
      if (sequentialUI && parseInt(caseIx) !== (cases?.length ?? 1) - 1) {
        cy.get('[data-cy="switch-next-case"]').click()
      }
    })
  }
)

interface VerifyCaseStudyInputsArgs {
  elementIx: number
  answers: {
    [caseIx: string]: {
      [itemIx: string]: {
        [criterionIx: string]: { click: string; steps: number }
      }
    }
  }
  criteria: { min: number; max: number; step: number; unit?: string | null }[]
  verifyValues?: boolean
  verifyDisabled?: boolean
}

Cypress.Commands.add(
  'verifyCaseStudyInputs',
  ({
    elementIx,
    answers,
    criteria,
    verifyValues = true,
    verifyDisabled = false,
  }: VerifyCaseStudyInputsArgs) => {
    cy.caseStudyLoop({
      object: answers,
      callback: ({ caseIx, itemIx, criterionIx, innerValue }) => {
        // verify that correct value is still set
        if (verifyValues) {
          const criterion = criteria[criterionIx]
          const slidedValue = computeCaseStudySlidedValue({
            criterion,
            answer: innerValue,
          })
          cy.get(
            `[data-cy="cs-slider-nr-value-${elementIx}-${caseIx}-${itemIx}-${criterionIx}"]`
          ).contains(
            criterion.unit ? `${slidedValue} ${criterion.unit}` : slidedValue
          )
        }

        // verify that the disabled attribute is set on the slider
        if (verifyDisabled) {
          cy.get(
            `[data-cy="cs-slider-${elementIx}-${caseIx}-${itemIx}-${criterionIx}"]`
          ).should('have.attr', 'data-disabled')
        }
      },
    })
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
      logoutLecturer(): Chainable<void>
      loginStudent(): Chainable<void>
      loginStudentPassword({ username }: { username: string }): Chainable<void>
      createAnswerCollection({
        name,
        description,
        entries,
        userId,
      }: AnswerCollectionArgs): Chainable<void>
      deleteAnswerCollection({
        collectionName,
      }: DeleteCollectionArgs): Chainable<void>
      addObjectToCatalog({
        objectName,
        objectType,
        permissionLevel,
      }: AddObjectToCatalogArgs): Chainable<void>
      createQuestionSC({
        title,
        content,
        explanation,
        choices,
        multiplier,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionMC({
        title,
        content,
        explanation,
        choices,
        multiplier,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionKPRIM({
        title,
        content,
        explanation,
        choices,
        multiplier,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionNR({
        title,
        content,
        explanation,
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
        explanation,
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
      createQuestionCS({
        title,
        content,
        explanation,
        collectionName,
        selectedItems,
        criteria,
        cases,
        solutions,
      }: CreateCaseStudyArgs): Chainable<void>
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
      convertLiveQuizToTemplate({
        liveQuiz,
        name,
        description,
        instructions,
        copyBeforeConversion,
        resourceAccessRequired,
      }: ConvertLiveQuizToTemplateArgs): Chainable<void>
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
      caseStudyLoop({ object, callback }: CaseStudyLoopArgs): Chainable<void>
      answerCaseStudy({
        elementIx,
        answers,
        cases,
        criteria,
        initialValidation,
        sequentialUI,
      }: AnswerCaseStudyArgs): Chainable<void>
      verifyCaseStudyInputs({
        elementIx,
        answers,
        criteria,
        verifyDisabled,
      }: VerifyCaseStudyInputsArgs): Chainable<void>
    }
  }
}
