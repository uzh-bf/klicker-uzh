import { configure } from '@testing-library/cypress'
import '@testing-library/cypress/add-commands'
import 'cypress-real-events'
import * as jose from 'jose'
import localforage from 'localforage'
import messages from '../../../packages/i18n/messages/en'

/// <reference types="cypress" />

// Only do this in headless/CI runs to keep rich errors locally
if (!Cypress.config('isInteractive')) {
  configure({
    // Return only the message, skip prettyDOM DOM dump
    getElementError: (message /*, container */) => {
      const err = new Error(message)
      err.name = 'TestingLibraryElementError'
      return err
    },
  })
}

// Custom command for reliable select interactions
Cypress.Commands.add('selectOption', (selector: string, optionText: string) => {
  cy.log(
    `selectOption: Looking for option "${optionText}" in selector "${selector}"`
  )

  // Wait for element to be ready and scroll it into view
  cy.get(selector)
    .scrollIntoView() // Scroll first to ensure element is in viewport
    .should('be.visible') // Then verify visibility
    .should('not.be.disabled')

  // Use realClick from cypress-real-events (handles pointer events properly)
  cy.get(selector).realClick()

  // Small wait for dropdown animation (since we disabled CSS animations)
  cy.wait(100)

  // Try different approaches to find and click the option
  const baseSelectorKey = selector.replace('[data-cy="', '').replace('"]', '')
  cy.log(`selectOption: Base selector key is "${baseSelectorKey}"`)

  // Try multiple strategies in order of preference
  cy.get('body').then(($body) => {
    // Strategy 1: Direct data-cy pattern match
    const directSelector = `[data-cy="${baseSelectorKey}-${optionText}"]`
    if ($body.find(directSelector).length > 0) {
      cy.log(`selectOption: Found using direct selector: ${directSelector}`)
      cy.get(directSelector).first().scrollIntoView().click()
      return
    }

    // Strategy 2: Partial match with base selector and option text
    const partialSelector = `[data-cy*="${baseSelectorKey}"][data-cy*="${optionText}"]`
    if ($body.find(partialSelector).length > 0) {
      cy.log(`selectOption: Found using partial selector: ${partialSelector}`)
      cy.get(partialSelector).first().scrollIntoView().click()
      return
    }

    // Strategy 3: Data-value attribute
    const valueSelector = `[data-value="${optionText}"]`
    if ($body.find(valueSelector).length > 0) {
      cy.log(`selectOption: Found using data-value selector: ${valueSelector}`)
      cy.get(valueSelector).first().scrollIntoView().click()
      return
    }

    // Strategy 4: Role-based options (common in RadixUI/ShadCN)
    if ($body.find(`[role="option"]`).length > 0) {
      cy.log(`selectOption: Found role="option" elements, using contains`)
      cy.get(`[role="option"]`).contains(optionText).scrollIntoView().click()
      return
    }

    // Strategy 5: Final fallback - any element containing the text
    cy.log(`selectOption: Using fallback contains strategy`)
    cy.contains(optionText).scrollIntoView().click()
  })
})

Cypress.Commands.add('seed', () => {
  // seed all required initial data directly into the database
  cy.task('seedDatabase').then((result: boolean) => {
    // check if the query was successful
    if (result === null) {
      throw new Error(
        'Seeding of required data into database was not successful!'
      )
    }
  })
  cy.reload()
})

Cypress.Commands.add('seedActivities', () => {
  // seed all required initial data directly into the database
  cy.task('seedActivities').then((result: boolean) => {
    // check if the query was successful
    if (result === null) {
      throw new Error(
        'Seeding of required activities into database was not successful!'
      )
    }
  })
  cy.reload()
})

Cypress.Commands.add('cleanup', () => {
  // delete all objects and clear entire database
  cy.task('cleanupDatabase').then((result: boolean) => {
    // check if the query was successful
    if (result === null) {
      throw new Error('An error occurred while resetting the database!')
    }
  })
  cy.reload()
})

const clearPersistedClientState = () => {
  return cy.wrap(null, { log: false }).then(async () => {
    await localforage.clear()
  })
}

const assertManageSession = () => {
  cy.location('origin').should('eq', Cypress.env('URL_MANAGE'))
  cy.location('pathname').should('not.eq', '/login')
  cy.location('search').should('not.contain', 'expired=true')
}

const loginFactory = (
  tokenData: {
    email: string
    sub: string
    role: 'ADMIN' | 'USER' | 'PARTICIPANT'
    scope: 'ACCOUNT_OWNER' | 'EDUID'
    catalystInstitutional?: boolean
    catalystIndividual?: boolean
  },
  cookieName: string = 'next-auth.session-token',
  redirectUrl?: string
) => {
  return () => {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()

    cy.viewport('macbook-16')
    localforage.setItem('hideLecturerSurvey', 'true')

    const secret = new TextEncoder().encode(Cypress.env('APP_SECRET'))
    const alg = 'HS256'

    cy.wrap(null).then(async () => {
      const token = await new jose.SignJWT(tokenData)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('2h')
        .setIssuer(process.env.APP_ORIGIN_AUTH)
        .sign(secret)

      cy.setCookie(cookieName, token, {
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      })
    })

    cy.visit(redirectUrl ?? Cypress.env('URL_MANAGE'))

    if (!redirectUrl) {
      assertManageSession()
    }
  }
}

Cypress.Commands.add(
  'loginLecturer',
  loginFactory({
    email: 'lecturer@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8821',
    role: 'ADMIN',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: true,
  })
)

Cypress.Commands.add(
  'loginLecturerControl',
  loginFactory(
    {
      email: 'lecturer@df.uzh.ch',
      sub: '76047345-3801-4628-ae7b-adbebcfe8821',
      role: 'ADMIN',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: true,
      catalystIndividual: true,
    },
    undefined,
    Cypress.env('URL_CONTROL')
  )
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

Cypress.Commands.add(
  'loginInstitutionalCatalyst3',
  loginFactory({
    email: 'pro4@df.uzh.ch',
    sub: '8509238a-cb2e-4d50-832e-971cdf2f9e55',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
)

Cypress.Commands.add(
  'loginInstitutionalCatalyst4',
  loginFactory({
    email: 'pro5@df.uzh.ch',
    sub: '2437de71-b552-48c8-865a-1d9c12fb7975',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
)

// TODO: before using this function validate its correctness -> not used yet
Cypress.Commands.add(
  'loginAssessmentStudent',
  loginFactory(
    {
      email: 'testuser1@test.uzh.ch',
      sub: '6f45065c-667f-4259-818c-c6f6b477eb48',
      role: 'PARTICIPANT',
      scope: 'EDUID',
    },
    'next-auth.participant-session-token',
    Cypress.env('URL_ASSESSMENT')
  )
)

Cypress.Commands.add('logoutUser', () => {
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
  clearPersistedClientState()
  cy.clearCookie('next-auth.session-token')
})

interface StudentLoginOptions {
  preserveClientState?: boolean
}

Cypress.Commands.add('loginStudent', (options: StudentLoginOptions = {}) => {
  cy.loginStudentPassword({
    username: Cypress.env('STUDENT_USERNAME'),
    preserveClientState: options.preserveClientState,
  })
})

Cypress.Commands.add(
  'loginStudentPassword',
  ({
    username,
    preserveClientState = false,
  }: { username: string } & StudentLoginOptions) => {
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.visit(
      Cypress.env('URL_STUDENT_LOGIN'),
      preserveClientState
        ? undefined
        : {
            onBeforeLoad: (win) => {
              win.localStorage.clear()
              win.sessionStorage.clear()
              try {
                win.indexedDB?.deleteDatabase('localforage')
              } catch {
                // Fall back to the regular localforage clear after load.
              }
            },
          }
    )
    if (!preserveClientState) {
      clearPersistedClientState()
    }
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
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
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
  objectType: string // --> DB.ObjectType
  permissionLevel: 'public' | 'restricted'
}

Cypress.Commands.add(
  'addObjectToCatalog',
  ({ objectName, objectType, permissionLevel }: AddObjectToCatalogArgs) => {
    cy.get('[data-cy="add-object-to-catalog-button"]').click()

    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-${objectType}"]`).realClick()
    cy.get('[data-cy="object-type-selection"]').contains(
      messages.shared.types[objectType]
    )

    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').should('exist')
    cy.get('[data-cy="object-access-public"]').should('exist')
    cy.get(`[data-cy="object-access-${permissionLevel}"]`).realClick()

    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.findByText(objectName).click()
    cy.get('[data-cy="submit-add-object-button"]').click()

    cy.get(`[data-cy="catalog-object-${objectName}"]`).should('exist')
  }
)

interface ValidateElementArgs {
  element: string // name / title of the element in question
  shouldExist?: boolean // whether the element should exist or not (default: true)
  contains?: string[] // optional array of strings that the element item should contain
}

Cypress.Commands.add(
  'validateElement',
  ({ element, shouldExist = true, contains }: ValidateElementArgs) => {
    const elementSelector = `[data-cy="element-item-${element}"]`

    // search for the element in the list (required due to pagination)
    cy.get('[data-cy="elements-search-input"]')
      .clear()
      .type(`${element}{enter}`)

    // verify the element's existence / non-existence
    if (shouldExist) {
      cy.get(elementSelector).should('exist')
    } else {
      cy.get(elementSelector).should('not.exist')
    }

    // if the element should contain specific text, verify that
    if (contains) {
      contains.forEach((text) => {
        cy.get(elementSelector).contains(text)
      })
    }

    // clear the search input after validating the element
    cy.get('[data-cy="elements-search-input"]').clear()
  }
)

interface EditElementArgs {
  element: string // name / title of the element in question
}
Cypress.Commands.add('editElement', ({ element }: EditElementArgs) => {
  // search for the element in the list (required due to pagination)
  cy.get('[data-cy="elements-search-input"]').clear().type(`${element}{enter}`)

  // click the edit button for the element
  cy.get(`[data-cy="edit-element-${element}"]`).click()
})

interface CreateChoicesQuestionArgs {
  name: string
  content: string
  explanation?: string
  choices: { value: string; correct?: boolean; feedback?: string }[]
  multiplier?: number
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createQuestionSC',
  ({
    name,
    content,
    explanation,
    choices,
    multiplier,
    isArchived = false,
    userId,
  }: CreateChoicesQuestionArgs) => {
    // trigger single choice question creation directly through prisma action
    cy.task('createQuestionChoices', {
      type: 'SC',
      name,
      content,
      explanation,
      multiplier,
      choices,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Single choice question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

Cypress.Commands.add(
  'createQuestionMC',
  ({
    name,
    content,
    explanation,
    choices,
    multiplier,
    isArchived = false,
    userId,
  }: CreateChoicesQuestionArgs) => {
    // trigger multiple choice question creation directly through prisma action
    cy.task('createQuestionChoices', {
      type: 'MC',
      name,
      content,
      explanation,
      multiplier,
      choices,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Multiple choice question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

Cypress.Commands.add(
  'createQuestionKPRIM',
  ({
    name,
    content,
    explanation,
    choices,
    multiplier,
    isArchived = false,
    userId,
  }: CreateChoicesQuestionArgs) => {
    // trigger kprim question creation directly through prisma action
    cy.task('createQuestionChoices', {
      type: 'KPRIM',
      name,
      content,
      explanation,
      multiplier,
      choices,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('KPRIM question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface CreateQuestionNRArgs {
  name: string
  content: string
  explanation?: string
  multiplier?: number
  min?: string
  max?: string
  unit?: string
  accuracy?: string
  solutionRanges?: { min: string; max: string }[] | null
  exactSolutions?: string[] | null
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createQuestionNR',
  ({
    name,
    content,
    explanation,
    multiplier,
    min,
    max,
    unit,
    accuracy,
    solutionRanges,
    exactSolutions,
    isArchived = false,
    userId,
  }: CreateQuestionNRArgs) => {
    // trigger numerical question creation directly through prisma action
    cy.task('createQuestionNumerical', {
      name,
      content,
      explanation,
      multiplier,
      min,
      max,
      unit,
      accuracy,
      solutionRanges,
      exactSolutions,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Numerical question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface CreateQuestionFTArgs {
  name: string
  content: string
  explanation?: string
  multiplier?: number
  maxLength?: string
  solutions?: string[]
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createQuestionFT',
  ({
    name,
    content,
    explanation,
    multiplier,
    maxLength,
    solutions,
    isArchived = false,
    userId,
  }: CreateQuestionFTArgs) => {
    // trigger free text question creation directly through prisma action
    cy.task('createQuestionFreeText', {
      name,
      content,
      explanation,
      multiplier,
      maxLength,
      solutions,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Free Text question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface CreateSelectionArgs {
  name: string
  content: string
  explanation?: string
  multiplier?: number
  collectionName: string
  numberOfInputs: number
  correctAnswers?: string[]
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createQuestionSE',
  ({
    name,
    content,
    explanation,
    multiplier,
    collectionName,
    numberOfInputs,
    correctAnswers,
    isArchived = false,
    userId,
  }: CreateSelectionArgs) => {
    // trigger selection question creation directly through prisma action
    cy.task('createQuestionSelection', {
      name,
      content,
      explanation,
      multiplier,
      collectionName,
      numberOfInputs,
      correctAnswers,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Selection question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface CreateCaseStudyArgs {
  name: string
  content: string
  explanation?: string
  multiplier?: number
  collectionName: string
  selectedItems: string[]
  criteria: {
    mode: 'range' | 'steps'
    id: string
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
    id: string
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
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createQuestionCS',
  ({
    name,
    content,
    explanation,
    multiplier,
    collectionName,
    selectedItems,
    criteria,
    cases,
    solutions,
    isArchived = false,
    userId,
  }: CreateCaseStudyArgs) => {
    // trigger case study question creation directly through prisma action
    cy.task('createQuestionCaseStudy', {
      name,
      content,
      explanation,
      multiplier,
      collectionName,
      selectedItems,
      criteria,
      cases,
      solutions,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Case study question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface CreateFlashcardArgs {
  name: string
  content: string
  explanation: string
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createFlashcard',
  ({
    name,
    content,
    explanation,
    isArchived = false,
    userId,
  }: CreateFlashcardArgs) => {
    // trigger flashcard creation directly through prisma action
    cy.task('createFlashcard', {
      name,
      content,
      explanation,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Flashcard creation failed!')
      }
    })

    // check if the created flashcard is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface CreateContentArgs {
  name: string
  content: string
  isArchived?: boolean
  userId: string
}

Cypress.Commands.add(
  'createContent',
  ({ name, content, isArchived = false, userId }: CreateContentArgs) => {
    // trigger flashcard creation directly through prisma action
    cy.task('createContentElement', {
      name,
      content,
      isArchived,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Content element creation failed!')
      }
    })

    // check if the created content element is visible
    cy.reload()
    cy.validateElement({ element: name })
  }
)

interface DeleteElementArgs {
  elementName: string
}

Cypress.Commands.add('deleteElement', ({ elementName }: DeleteElementArgs) => {
  // find the element in the list (required due to pagination)
  cy.get('[data-cy="elements-search-input"]')
    .clear()
    .type(`${elementName}{enter}`)

  cy.get(`[data-cy="actions-element-${elementName}"]`).first().realClick()
  cy.get(`[data-cy="delete-element-${elementName}"]`).first().click()
  cy.get(`[data-cy="confirm-deletion-final"]`).click()

  // only click confirmation buttons if they exist
  cy.get('body').then(($body) => {
    if ($body.find(`[data-cy="confirm-other-users-access"]`).length > 0) {
      cy.get(`[data-cy="confirm-other-users-access"]`).click()
    }
    if ($body.find(`[data-cy="confirm-derived-access"]`).length > 0) {
      cy.get(`[data-cy="confirm-derived-access"]`).click()
    }
    if ($body.find(`[data-cy="confirm-dependency-access"]`).length > 0) {
      cy.get(`[data-cy="confirm-dependency-access"]`).click()
    }
  })

  cy.get('[data-cy="confirmation-modal-confirm"]').click()
  cy.wait(500)

  // reset the search
  cy.get('[data-cy="elements-search-input"]').clear()
})

Cypress.Commands.add('deleteAllElements', () => {
  // trigger the deletion of all elements
  cy.task('deleteElements').then((result: boolean) => {
    // check if the query was successful
    if (result === null) {
      throw new Error('Deletion of elements in the database failed!')
    }
  })
  cy.reload()
})

interface CreateLiveQuizArgs {
  name: string
  displayName: string
  courseName?: string
  multiplier?: string
  gamificationWithoutCourse?: boolean
  pinProtectionWithoutCourse?: boolean
  blocks: { elements: string[] }[]
}

Cypress.Commands.add(
  'createLiveQuiz',
  ({
    name,
    displayName,
    courseName,
    multiplier,
    gamificationWithoutCourse,
    pinProtectionWithoutCourse,
    blocks,
  }: CreateLiveQuizArgs) => {
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
      cy.selectOption('[data-cy="select-course"]', courseName)
      cy.get('[data-cy="select-course"]').contains(courseName)

      if (multiplier) {
        cy.get('[data-cy="select-multiplier"]').realClick()
        cy.get(`[data-cy="select-multiplier-${multiplier}"]`).realClick()
        cy.get('[data-cy="select-multiplier"]').contains(multiplier)
      }
    }

    if (gamificationWithoutCourse) {
      cy.get('[data-cy="set-quiz-gamification"]').click()
    }
    if (pinProtectionWithoutCourse) {
      cy.get('[data-cy="set-quiz-pin-protection"]').click()
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
    cy.get(`[data-cy="actions-LIVE_QUIZ-${liveQuiz}"]`).realClick()
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

interface DragAndDropElementArgs {
  element: string // the name of the element to be dragged
  target: string // testing attribute of the dropping target
}

Cypress.Commands.add(
  'dragAndDropElement',
  ({ element, target }: DragAndDropElementArgs) => {
    const dataTransfer = new DataTransfer()

    // search for the element in the list (required due to pagination)
    cy.get('[data-cy="elements-search-input"]')
      .clear()
      .type(`${element}{enter}`)

    // start dragging the element
    cy.get(`[data-cy="element-item-${element}"]`)
      .contains(element)
      .trigger('dragstart', {
        dataTransfer,
      })

    // drop the element on the target
    cy.get(`[data-cy="${target}"]`).trigger('drop', {
      dataTransfer,
    })

    // clear the element list search input to avoid any impact on other statements
    cy.get('[data-cy="elements-search-input"]').clear()
  }
)

interface StackType {
  elements: string[]
}

interface DatetimeType {
  monthDelta: number // month delta to be set relative to the default values
  day: number // day of the month to be set
  hour: number // hour of the day to be set
  minute: number // minute of the hour to be set
  validation: string // validation string to be used for the date input
}

interface DateType {
  monthDelta: number // month delta to be set relative to the default values
  day: number // day of the month to be set
  validation: string // validation string to be used for the date input
}

function createStacks({
  stacks,
  type = 'stack',
}: {
  stacks: StackType[]
  type?: 'block' | 'stack'
}) {
  cy.wrap(stacks[0].elements).each((element: string, ix) => {
    cy.dragAndDropElement({
      element,
      target: `drop-elements-${type}-0`,
    })
    cy.get(`[data-cy="element-${ix}-${type}-0"]`).contains(
      element.substring(0, 20)
    )
  })

  if (stacks.length > 1) {
    cy.wrap(stacks.slice(1)).each((stack: { elements: string[] }, ix) => {
      cy.get(`[data-cy="drop-elements-add-${type}"]`).click()
      cy.wrap(stack.elements).each((element: string, jx) => {
        cy.dragAndDropElement({
          element,
          target: `drop-elements-${type}-${ix + 1}`,
        })

        // verify that the element was dropped correctly
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
  multiplier?: string
  stacks: StackType[]
}

Cypress.Commands.add(
  'createPracticeQuiz',
  ({
    name,
    displayName,
    description,
    courseName,
    multiplier,
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
    cy.selectOption('[data-cy="select-course"]', courseName)
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    if (multiplier) {
      cy.get('[data-cy="select-multiplier"]').realClick()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).realClick()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Stacks
    createStacks({ stacks })

    cy.get('[data-cy="next-or-submit"]').click()
  }
)

interface SetDatetimeArgs {
  cyString: string // data-cy attribute of the datetime input
  deselectorString: string // data-cy attribute of the element to deselect the calendar
  datetime: DatetimeType // object containing monthDelta, day, hour, minute, and validation string
}

function getCalendarDataDay(validation: string) {
  const match = validation.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) {
    throw new Error(
      `setDate/setDatetime: cannot parse date from "${validation}"`
    )
  }
  const [, dayString, monthString, yearString] = match
  return new Date(
    Number(yearString),
    Number(monthString) - 1,
    Number(dayString)
  ).toLocaleDateString()
}

Cypress.Commands.add(
  'setDatetime',
  ({ cyString, deselectorString, datetime }: SetDatetimeArgs) => {
    cy.get(`[data-cy="${cyString}"]`).realClick()

    const hour = String(datetime.hour).padStart(2, '0')
    const minute = String(datetime.minute).padStart(2, '0')
    const targetDataDay = getCalendarDataDay(datetime.validation)

    if (datetime.monthDelta > 0) {
      for (let i = 0; i < datetime.monthDelta; i++) {
        cy.get(`[data-cy="${cyString}-next-month"]`)
          .closest('button')
          .should('not.be.disabled')
          .should('not.have.attr', 'aria-disabled', 'true')
          .realClick()
          .wait(100)
      }
    } else if (datetime.monthDelta < 0) {
      for (let i = 0; i < Math.abs(datetime.monthDelta); i++) {
        cy.get(`[data-cy="${cyString}-previous-month"]`)
          .closest('button')
          .should('not.be.disabled')
          .should('not.have.attr', 'aria-disabled', 'true')
          .realClick()
          .wait(100)
      }
    }

    cy.get(`[data-cy="${cyString}-calendar"]`)
      .find(`[data-day="${targetDataDay}"]`)
      .should('have.length', 1)
      .realClick()
      .wait(100)
    cy.get(`[data-cy="${cyString}-hours"]`)
      .realClick()
      .type(hour, { delay: 50 })
    cy.get(`[data-cy="${cyString}-minutes"]`)
      .realClick()
      .type(minute, { delay: 50 })
    cy.get(`[data-cy="${deselectorString}"]`).realClick()
    cy.get(`[data-cy="${cyString}-minutes"]`).should('not.exist')
    cy.get(`[data-cy="${cyString}"]`, { timeout: 10000 }).should(
      'contain',
      datetime.validation
    )
  }
)

interface SetDateArgs {
  cyString: string // data-cy attribute of the datetime input
  deselectorString: string // data-cy attribute of the element to deselect the calendar
  date: DateType // object containing monthDelta, day, and validation string
}

Cypress.Commands.add(
  'setDate',
  ({ cyString, deselectorString, date }: SetDateArgs) => {
    cy.get(`[data-cy="${cyString}"]`).realClick()

    const targetDataDay = getCalendarDataDay(date.validation)

    if (date.monthDelta > 0) {
      for (let i = 0; i < date.monthDelta; i++) {
        cy.get(`[data-cy="${cyString}-next-month"]`)
          .closest('button')
          .realClick()
          .wait(100)
      }
    } else if (date.monthDelta < 0) {
      for (let i = 0; i < Math.abs(date.monthDelta); i++) {
        cy.get(`[data-cy="${cyString}-previous-month"]`)
          .closest('button')
          .realClick()
          .wait(100)
      }
    }

    cy.get(`[data-cy="${cyString}-calendar"]`)
      .find(`[data-day="${targetDataDay}"]`)
      .should('have.length', 1)
      .realClick()
      .wait(100)
    cy.get(`[data-cy="${deselectorString}"]`).realClick()
    cy.get(`[data-cy="${cyString}-minutes"]`).should('not.exist')
    cy.get(`[data-cy="${cyString}"]`, { timeout: 10000 }).should(
      'contain',
      date.validation
    )
  }
)

interface CreateMicrolearningArgs {
  name: string
  displayName: string
  description?: string
  courseName: string
  multiplier?: string
  startDate: DatetimeType
  endDate: DatetimeType
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
    cy.selectOption('[data-cy="select-course"]', courseName)
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)
    cy.setDatetime({
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: { ...startDate, monthDelta: startDate.monthDelta - 1 }, // pre-selected date is at beginning of next month
    })
    cy.setDatetime({
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: { ...endDate, monthDelta: endDate.monthDelta - 1 }, // pre-selected date is at beginning of next month
    })

    if (multiplier) {
      cy.get('[data-cy="select-multiplier"]').realClick()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).realClick()
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
  scheduledStartDate: DatetimeType
  scheduledEndDate: DatetimeType
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
    cy.selectOption('[data-cy="select-course"]', courseName)
    cy.get('[data-cy="select-course"]').should('exist').contains(courseName)

    if (multiplier) {
      cy.get('[data-cy="select-multiplier"]').realClick()
      cy.get(`[data-cy="select-multiplier-${multiplier}"]`).realClick()
      cy.get('[data-cy="select-multiplier"]').contains(multiplier)
    }

    cy.setDatetime({
      cyString: 'select-start-date',
      deselectorString: 'availability-section-header',
      datetime: {
        ...scheduledStartDate,
        monthDelta: scheduledStartDate.monthDelta - 1,
      }, // pre-selected date is at beginning of next month
    })
    cy.setDatetime({
      cyString: 'select-end-date',
      deselectorString: 'availability-section-header',
      datetime: {
        ...scheduledEndDate,
        monthDelta: scheduledEndDate.monthDelta - 1,
      }, // pre-selected date is at beginning of next month
    })
    cy.get('[data-cy="next-or-submit"]').click()

    // Step 4: Clues
    cy.wrap(clues).each((clue: GroupActivityClueType) => {
      cy.get('[data-cy="add-group-activity-clue"]').click()
      cy.get('[data-cy="group-activity-clue-type"]').realClick()
      cy.get(
        `[data-cy="group-activity-clue-type-${clue.type === 'text' ? 'string' : 'number'}"]`
      ).realClick()
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

interface CreateCourseArgs {
  name: string
  displayName: string
  description?: string
  notificationEmail?: string
  startDate?: Date
  endDate?: Date
  color?: string
  isAssessmentEnabled?: boolean
  isGamificationEnabled?: boolean
  isGroupCreationEnabled?: boolean
  groupDeadlineDate?: Date
  maxGroupSize?: number
  preferredGroupSize?: number
  participants?: string[]
}

Cypress.Commands.add(
  'createCourse',
  ({
    name,
    displayName,
    description,
    notificationEmail,
    startDate,
    endDate,
    color,
    isAssessmentEnabled = false,
    isGamificationEnabled = true,
    isGroupCreationEnabled = true,
    groupDeadlineDate,
    maxGroupSize = 4,
    preferredGroupSize = 2,
    participants = [],
  }: CreateCourseArgs) => {
    // trigger answer collection creation directly through prisma action
    cy.get('[data-cy="courses"]').click()
    cy.task('createCourse', {
      name,
      displayName,
      description,
      notificationEmail,
      startDate,
      endDate,
      color,
      isAssessmentEnabled,
      isGamificationEnabled,
      isGroupCreationEnabled,
      groupDeadlineDate,
      maxGroupSize,
      preferredGroupSize,
      participants,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === false) {
        throw new Error('Course creation failed!')
      }
    })

    // check if the course is in the list
    cy.reload()
    cy.get('[data-cy="courses"]').click()
    cy.findByText(name).should('exist')
  }
)

interface ShareObjectArgs {
  usernameOrEmail: string
  permissionLevel: string
}

Cypress.Commands.add(
  'shareObject',
  ({ usernameOrEmail, permissionLevel }: ShareObjectArgs) => {
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(usernameOrEmail)
    cy.selectOption('[data-cy="new-permission-access-level"]', permissionLevel)
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${usernameOrEmail}"]`)
      .should('exist')
      .contains(permissionLevel)
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

interface AssertActivityPointsArgs {
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  totalPoints: number
}

Cypress.Commands.add(
  'assertActivityPoints',
  ({
    basePoints,
    correctnessPoints,
    bonusPoints,
    totalPoints,
  }: AssertActivityPointsArgs) => {
    cy.get('[data-cy="base-points-activity"]').contains(`${basePoints} P.`)
    cy.get('[data-cy="correctness-points-activity"]').contains(
      `${correctnessPoints} P.`
    )
    cy.get('[data-cy="bonus-points-activity"]').contains(`${bonusPoints} P.`)
    cy.get('[data-cy="total-points-activity"]').contains(`${totalPoints} P.`)
  }
)

interface AssertInstancePointsArgs {
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  totalPoints: number
  stackIx: number
  instanceIx: number
}

Cypress.Commands.add(
  'assertInstancePoints',
  ({
    basePoints,
    correctnessPoints,
    bonusPoints,
    totalPoints,
    stackIx,
    instanceIx,
  }: AssertInstancePointsArgs) => {
    cy.get(
      `[data-cy="base-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).contains(`${basePoints} P.`)
    cy.get(
      `[data-cy="correctness-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).contains(`${correctnessPoints} P.`)
    cy.get(
      `[data-cy="bonus-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).contains(`${bonusPoints} P.`)
    cy.get(
      `[data-cy="total-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).contains(`${totalPoints} P.`)
  }
)

Cypress.Commands.add('assertNoActivityPoints', () => {
  cy.get('[data-cy="base-points-activity"]').should('not.exist')
  cy.get('[data-cy="correctness-points-activity"]').should('not.exist')
  cy.get('[data-cy="bonus-points-activity"]').should('not.exist')
  cy.get('[data-cy="total-points-activity"]').should('not.exist')
})

interface StackInstanceArgs {
  stackIx: number
  instanceIx: number
}

Cypress.Commands.add(
  'assertNoInstancePoints',
  ({ stackIx, instanceIx }: StackInstanceArgs) => {
    cy.get(
      `[data-cy="base-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="correctness-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="bonus-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="total-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).should('not.exist')
  }
)

interface TotalPointsArgs {
  totalPoints: number
}

Cypress.Commands.add(
  'assertAsynchronousActivityPoints',
  ({ totalPoints }: TotalPointsArgs) => {
    cy.get('[data-cy="total-points-activity"]').contains(`${totalPoints} P.`)
  }
)

Cypress.Commands.add(
  'assertAsynchronousInstancePoints',
  ({
    totalPoints,
    stackIx,
    instanceIx,
  }: TotalPointsArgs & StackInstanceArgs) => {
    cy.get(
      `[data-cy="total-points-stack-${stackIx}-instance-${instanceIx}"]`
    ).contains(`${totalPoints} P.`)
  }
)

// override type command to have minimal delay for faster test workflows
Cypress.Commands.overwrite<'type', 'element'>(
  'type',
  (originalFn, element, text, options = {}) => {
    options.delay = options.delay ?? 2
    return originalFn(element, text, options)
  }
)

declare global {
  namespace Cypress {
    interface Chainable {
      seed(): Chainable<void>
      seedActivities(): Chainable<void>
      cleanup(): Chainable<void>
      loginLecturer(): Chainable<void>
      loginLecturerControl(): Chainable<void>
      loginFreeUser(): Chainable<void>
      loginIndividualCatalyst(): Chainable<void>
      loginInstitutionalCatalyst(): Chainable<void>
      loginInstitutionalCatalyst2(): Chainable<void>
      loginInstitutionalCatalyst3(): Chainable<void>
      loginInstitutionalCatalyst4(): Chainable<void>
      logoutUser(): Chainable<void>
      loginStudent(options?: StudentLoginOptions): Chainable<void>
      loginAssessmentStudent(): Chainable<void>
      loginStudentPassword({
        username,
        preserveClientState,
      }: { username: string } & StudentLoginOptions): Chainable<void>
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
      validateElement({
        element,
        shouldExist,
        contains,
      }: ValidateElementArgs): Chainable<void>
      editElement({ element }: EditElementArgs): Chainable<void>
      createQuestionSC({
        name,
        content,
        explanation,
        choices,
        multiplier,
        userId,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionMC({
        name,
        content,
        explanation,
        choices,
        multiplier,
        userId,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionKPRIM({
        name,
        content,
        explanation,
        choices,
        multiplier,
        userId,
      }: CreateChoicesQuestionArgs): Chainable<void>
      createQuestionNR({
        name,
        content,
        explanation,
        multiplier,
        min,
        max,
        unit,
        accuracy,
        solutionRanges,
        exactSolutions,
        userId,
      }: CreateQuestionNRArgs): Chainable<void>
      createQuestionFT({
        name,
        content,
        explanation,
        multiplier,
        maxLength,
        solutions,
        userId,
      }: CreateQuestionFTArgs): Chainable<void>
      createQuestionSE({
        name,
        content,
        explanation,
        collectionName,
        numberOfInputs,
        correctAnswers,
        userId,
      }: CreateSelectionArgs): Chainable<void>
      createQuestionCS({
        name,
        content,
        explanation,
        multiplier,
        collectionName,
        selectedItems,
        criteria,
        cases,
        solutions,
        userId,
      }: CreateCaseStudyArgs): Chainable<void>
      createFlashcard({
        name,
        content,
        explanation,
        userId,
      }: CreateFlashcardArgs): Chainable<void>
      createContent({
        name,
        content,
        userId,
      }: CreateContentArgs): Chainable<void>
      deleteElement({ elementName }: DeleteElementArgs): Chainable<void>
      deleteAllElements(): Chainable<void>
      createLiveQuiz({
        name,
        displayName,
        courseName,
        multiplier,
        gamificationWithoutCourse,
        pinProtectionWithoutCourse,
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
      dragAndDropElement({
        element,
        target,
      }: DragAndDropElementArgs): Chainable<void>
      createStacks({
        stacks,
        type,
      }: {
        stacks: StackType[]
        type?: 'block' | 'stack'
      }): Chainable<void>
      setDatetime({
        cyString,
        deselectorString,
        datetime,
      }: SetDatetimeArgs): Chainable<void>
      setDate({
        cyString,
        deselectorString,
        date,
      }: SetDateArgs): Chainable<void>
      shareObject({
        usernameOrEmail,
        permissionLevel,
      }: ShareObjectArgs): Chainable<void>
      createPracticeQuiz({
        name,
        displayName,
        description,
        courseName,
        multiplier,
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
      createCourse({
        name,
        displayName,
        description,
        notificationEmail,
        startDate,
        endDate,
        color,
        isAssessmentEnabled,
        isGamificationEnabled,
        isGroupCreationEnabled,
        groupDeadlineDate,
        maxGroupSize,
        preferredGroupSize,
      }: CreateCourseArgs): Chainable<void>
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
      selectOption(selector: string, optionText: string): Chainable<void>
      assertActivityPoints({
        basePoints,
        correctnessPoints,
        bonusPoints,
        totalPoints,
      }: AssertActivityPointsArgs): Chainable<void>
      assertInstancePoints({
        basePoints,
        correctnessPoints,
        bonusPoints,
        totalPoints,
        stackIx,
        instanceIx,
      }: AssertInstancePointsArgs): Chainable<void>
      assertNoActivityPoints(): Chainable<void>
      assertNoInstancePoints({
        stackIx,
        instanceIx,
      }: StackInstanceArgs): Chainable<void>
      assertAsynchronousActivityPoints({
        totalPoints,
      }: TotalPointsArgs): Chainable<void>
      assertAsynchronousInstancePoints({
        totalPoints,
        stackIx,
        instanceIx,
      }: TotalPointsArgs & StackInstanceArgs): Chainable<void>
    }
  }
}
