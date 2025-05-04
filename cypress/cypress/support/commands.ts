import { SharingObjectType } from '@klicker-uzh/types'
import '@testing-library/cypress/add-commands'
import 'cypress-real-events'
import * as jose from 'jose'
import * as localforage from 'localforage'
import messages from '../../../packages/i18n/messages/en'

/// <reference types="cypress" />

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
    role: 'ADMIN',
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

Cypress.Commands.add('logoutUser', () => {
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
  objectType: SharingObjectType
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
  name: string
  content: string
  explanation?: string
  choices: { value: string; correct?: boolean; feedback?: string }[]
  multiplier?: number
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Single choice question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Multiple choice question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('KPRIM question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Numerical question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
  }
)

interface CreateQuestionFTArgs {
  name: string
  content: string
  explanation?: string
  multiplier?: number
  maxLength?: string
  solutions?: string[]
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Free Text question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Selection question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
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
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Case study question creation failed!')
      }
    })

    // check if the created question is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
  }
)

interface CreateFlashcardArgs {
  name: string
  content: string
  explanation: string
  userId: string
}

Cypress.Commands.add(
  'createFlashcard',
  ({ name, content, explanation, userId }: CreateFlashcardArgs) => {
    // trigger flashcard creation directly through prisma action
    cy.task('createFlashcard', {
      name,
      content,
      explanation,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Flashcard creation failed!')
      }
    })

    // check if the created flashcard is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
  }
)

interface CreateContentArgs {
  name: string
  content: string
  userId: string
}

Cypress.Commands.add(
  'createContent',
  ({ name, content, userId }: CreateContentArgs) => {
    // trigger flashcard creation directly through prisma action
    cy.task('createContentElement', {
      name,
      content,
      userId,
    }).then((result: boolean) => {
      // check if the query was successful
      if (result === null) {
        throw new Error('Content element creation failed!')
      }
    })

    // check if the created content element is visible
    cy.reload()
    cy.get(`[data-cy="element-item-${name}"]`).should('exist')
  }
)

interface DeleteElementArgs {
  elementName: string
}

Cypress.Commands.add('deleteElement', ({ elementName }: DeleteElementArgs) => {
  cy.get(`[data-cy="actions-element-${elementName}"]`).first().realClick()
  cy.get(`[data-cy="delete-element-${elementName}"]`).first().click()
  cy.get(`[data-cy="confirm-deletion-final"]`).click()
  cy.get(`[data-cy="confirm-other-users-access"]`).click()
  cy.get(`[data-cy="confirm-derived-access"]`).click()
  cy.get(`[data-cy="confirm-dependency-access"]`).click()
  cy.get('[data-cy="confirmation-modal-confirm"]').click()
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
      seed(): Chainable<void>
      cleanup(): Chainable<void>
      loginLecturer(): Chainable<void>
      loginFreeUser(): Chainable<void>
      loginIndividualCatalyst(): Chainable<void>
      loginInstitutionalCatalyst(): Chainable<void>
      loginInstitutionalCatalyst2(): Chainable<void>
      logoutUser(): Chainable<void>
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
