import { expect, Page } from '@playwright/test'
import { getPrisma } from '../../global-setup.js'

export type ElementOptions = {
  title?: string
  status?: 'Draft' | 'Review' | 'Ready'
  text?: string
  answers?: { text: string }[]
}

/**
 * Holds the basic functionalities to test the creation of an element.
 * @param page The Playwright page object to perform actions on the page.
 * @param elementOptions The element options.
 */
export async function createElementFixture(
  page: Page,
  elementOptions: ElementOptions
) {
  await page.getByTestId('create-question').click()

  if (elementOptions.title) {
    await page.getByTestId('insert-question-title').fill(elementOptions.title)
  }

  if (elementOptions.status) {
    const statusSelect = page.getByTestId('select-question-status')
    await statusSelect.scrollIntoViewIfNeeded()
    await expect(statusSelect).toBeVisible()
    await statusSelect.click()

    await page
      .getByTestId(`select-question-status-${elementOptions.status}`)
      .click()
    await expect(statusSelect).toContainText(elementOptions.status)
  }

  if (elementOptions.text) {
    const editor = page.getByTestId('insert-question-text')
    await editor.scrollIntoViewIfNeeded()
    await expect(editor).toBeVisible()
    await editor.click()

    await editor.pressSequentially(elementOptions.text)
    await expect(editor).toContainText(elementOptions.text)
  }

  if (elementOptions.answers) {
    for (let i = 0; i < elementOptions.answers.length; i++) {
      const currentAnswer = elementOptions.answers[i]

      const answer = page.getByTestId(`insert-answer-field-${i}`)
      await answer.scrollIntoViewIfNeeded()
      await expect(answer).toBeVisible()
      await answer.click()
      await answer.pressSequentially(currentAnswer.text)

      if (i != elementOptions.answers.length - 1) {
        const addAnswer = page.getByTestId('add-new-answer')
        await addAnswer.scrollIntoViewIfNeeded()
        await expect(addAnswer).toBeVisible()
        await addAnswer.click()
      }
    }
  }

  await page.getByTestId('close-element-modal').click()
}

// ---------------------------------------------------------------------------
// Switch the question-type selector to the given label.
// ---------------------------------------------------------------------------
export async function switchElementType(page: Page, typeLabel: string) {
  await page.getByTestId('select-question-type').click()
  await page.getByTestId(`select-question-type-${typeLabel}`).click()
  await expect(page.getByTestId('select-question-type')).toContainText(
    typeLabel
  )
}

// ---------------------------------------------------------------------------
// Set the question-status selector to the given label.
// ---------------------------------------------------------------------------
export async function setElementStatus(page: Page, statusLabel: string) {
  const statusSelect = page.getByTestId('select-question-status')
  await statusSelect.scrollIntoViewIfNeeded()
  await statusSelect.click()
  await page.getByTestId(`select-question-status-${statusLabel}`).click()
  await expect(statusSelect).toContainText(statusLabel)
}

// ---------------------------------------------------------------------------
// Clear a rich-text editor through keyboard input so Slate emits onChange.
// ---------------------------------------------------------------------------
export async function clearEditorField(page: Page, testId: string) {
  const editor = page.getByTestId(testId)
  await editor.scrollIntoViewIfNeeded()
  await editor.click()
  await editor.press('ControlOrMeta+A')
  await editor.press('Backspace')
  await expect(editor).toHaveText('')
}

// ---------------------------------------------------------------------------
// Fill a rich-text editor field (click → pressSequentially).
// Optionally clears the field first.
// ---------------------------------------------------------------------------
export async function fillEditorField(
  page: Page,
  testId: string,
  text: string,
  clear = false
) {
  const editor = page.getByTestId(testId)
  await editor.scrollIntoViewIfNeeded()
  await editor.click()
  if (clear) await clearEditorField(page, testId)
  await editor.pressSequentially(text)
  await expect(editor).toContainText(text)
}

// ---------------------------------------------------------------------------
// Assert that a rich-text editor field contains the expected text (read-only).
// ---------------------------------------------------------------------------
export async function verifyEditorField(
  page: Page,
  testId: string,
  text: string
) {
  const editor = page.getByTestId(testId)
  await editor.scrollIntoViewIfNeeded()
  await editor.click()
  await expect(editor).toContainText(text)
}

// ---------------------------------------------------------------------------
// Save the element modal and wait for the DB write to settle.
// ---------------------------------------------------------------------------
export async function saveElement(page: Page) {
  await page.getByTestId('save-new-question').click({ force: true })
  await page.waitForTimeout(1000)
}

// ---------------------------------------------------------------------------
// Fill answer option field at the given index.
// ---------------------------------------------------------------------------
export async function fillAnswerField(
  page: Page,
  index: number,
  text: string,
  clear = false
) {
  const field = page.getByTestId(`insert-answer-field-${index}`)
  await field.scrollIntoViewIfNeeded()
  await field.click()
  if (clear) await clearEditorField(page, `insert-answer-field-${index}`)
  await field.pressSequentially(text)
  await expect(field).toContainText(text)
}

// ---------------------------------------------------------------------------
// Fill answer feedback field at the given index.
// ---------------------------------------------------------------------------
export async function fillFeedbackField(
  page: Page,
  index: number,
  text: string,
  clear = false
) {
  const field = page.getByTestId(`insert-answer-feedback-${index}`)
  await field.scrollIntoViewIfNeeded()
  await field.click()
  if (clear) await clearEditorField(page, `insert-answer-feedback-${index}`)
  await field.pressSequentially(text)
  await expect(field).toContainText(text)
}

// ---------------------------------------------------------------------------
// Assert that an answer field contains the expected text.
// ---------------------------------------------------------------------------
export async function verifyAnswerField(
  page: Page,
  index: number,
  text: string
) {
  const field = page.getByTestId(`insert-answer-field-${index}`)
  await field.scrollIntoViewIfNeeded()
  await expect(field).toContainText(text)
}

// ---------------------------------------------------------------------------
// Assert that an answer feedback field contains the expected text.
// ---------------------------------------------------------------------------
export async function verifyFeedbackField(
  page: Page,
  index: number,
  text: string
) {
  const field = page.getByTestId(`insert-answer-feedback-${index}`)
  await field.scrollIntoViewIfNeeded()
  await expect(field).toContainText(text)
}

// ---------------------------------------------------------------------------
// Verify all answer fields and (optionally) feedback fields match the
// provided arrays.
// ---------------------------------------------------------------------------
export async function verifyAnswerAndFeedbackFields(
  page: Page,
  choices: string[],
  feedbacks?: string[]
) {
  for (let ix = 0; ix < choices.length; ix++) {
    await verifyAnswerField(page, ix, choices[ix])
  }
  if (feedbacks) {
    for (let ix = 0; ix < feedbacks.length; ix++) {
      await verifyFeedbackField(page, ix, feedbacks[ix])
    }
  }
}

// ---------------------------------------------------------------------------
// Search for an element by name (pagination guard) then open its edit modal.
// Mirrors cy.editElement() in cypress/support/commands.ts.
// ---------------------------------------------------------------------------
export async function searchAndEdit(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`edit-element-${elementName}`).click()
}

// ---------------------------------------------------------------------------
// Search for an element by name, assert it contains the given strings, then
// clear the search. Used to validate after create/edit saves.
// ---------------------------------------------------------------------------
export async function validateElement(
  page: Page,
  elementName: string,
  contains: string[] = []
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  const el = page.getByTestId(`element-item-${elementName}`).first()
  await expect(el).toBeVisible()
  for (const text of contains) {
    await expect(el).toContainText(text)
  }
  await page.getByTestId('elements-search-input').clear()
}

// ---------------------------------------------------------------------------
// Search for an element by name and delete it via the actions menu.
// ---------------------------------------------------------------------------
export async function deleteElement(page: Page, elementName: string) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`actions-element-${elementName}`).click()
  await page.getByTestId(`delete-element-${elementName}`).click()
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const confirmation of [
      'confirm-deletion-final',
      'confirm-other-users-access',
      'confirm-derived-access',
      'confirm-dependency-access',
    ]) {
      const button = page.getByTestId(confirmation)
      if (
        (await button.count()) > 0 &&
        (await button.isVisible()) &&
        (await button.isEnabled())
      ) {
        await button.click()
        await page.waitForTimeout(100)
      }
    }

    if (await page.getByTestId('confirmation-modal-confirm').isEnabled()) break
  }
  await expect(page.getByTestId('confirmation-modal-confirm')).toBeEnabled()
  await page.getByTestId('confirmation-modal-confirm').click()
  await expect(
    page.getByTestId(`element-item-${elementName}`)
  ).not.toBeVisible()
}

// ---------------------------------------------------------------------------
// Fill answer fields in sequence. The first slot (startIndex) is assumed to
// already exist; "add-new-answer" is clicked before each subsequent slot.
// ---------------------------------------------------------------------------
export async function addAnswerChoices(
  page: Page,
  choices: string[],
  startIndex = 0
) {
  for (let i = 0; i < choices.length; i++) {
    const slotIndex = startIndex + i
    // Slot 0 is always pre-rendered; every other slot must be created first.
    if (slotIndex > 0) {
      await page.getByTestId('insert-question-title').click()
      await page.getByTestId('add-new-answer').click()
      await page.waitForTimeout(500)
    }
    await fillAnswerField(page, slotIndex, choices[i])
  }
}

// ---------------------------------------------------------------------------
// Fill numeric input fields (min, max, unit, accuracy) for Numerical elements.
// Pass undefined to skip a field.
// ---------------------------------------------------------------------------
export async function fillNumericalFields(
  page: Page,
  fields: {
    min?: string
    max?: string
    unit?: string
    accuracy?: string
  },
  clear = false
) {
  const ids = {
    min: 'set-numerical-minimum',
    max: 'set-numerical-maximum',
    unit: 'set-numerical-unit',
    accuracy: 'set-numerical-accuracy',
  } as const

  for (const [key, testId] of Object.entries(ids) as [
    keyof typeof ids,
    string,
  ][]) {
    const value = fields[key]
    if (value === undefined) continue
    const el = page.getByTestId(testId)
    await el.click()
    if (clear) await el.clear()
    await el.fill(value)
  }
}

// ---------------------------------------------------------------------------
// Assert the values of Numerical element input fields.
// ---------------------------------------------------------------------------
export async function verifyNumericalFields(
  page: Page,
  fields: {
    min?: string
    max?: string
    unit?: string
    accuracy?: string
  }
) {
  if (fields.min !== undefined)
    await expect(page.getByTestId('set-numerical-minimum')).toHaveValue(
      fields.min
    )
  if (fields.max !== undefined)
    await expect(page.getByTestId('set-numerical-maximum')).toHaveValue(
      fields.max
    )
  if (fields.unit !== undefined)
    await expect(page.getByTestId('set-numerical-unit')).toHaveValue(
      fields.unit
    )
  if (fields.accuracy !== undefined)
    await expect(page.getByTestId('set-numerical-accuracy')).toHaveValue(
      fields.accuracy
    )
}

// helper functions

export async function createQuestionSC({
  name,
  content,
  explanation,
  choices,
  multiplier,
  isArchived = false,
  userId,
}: {
  name: string
  content: string
  explanation?: string
  choices: { value: string; correct?: boolean; feedback?: string }[]
  multiplier?: number
  isArchived?: boolean
  userId: string
}) {
  const prisma = await getPrisma()
  const { ElementType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )

  if (choices.length < 2) {
    throw new Error('SC questions require at least 2 choices')
  }

  const hasSampleSolution = choices.some(
    (c) => typeof c.correct !== 'undefined'
  )
  const hasAnswerFeedbacks = choices.every(
    (c) => typeof c.feedback !== 'undefined'
  )

  try {
    const question = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name,
        content,
        explanation: explanation ?? undefined,
        basePoints: true,
        pointsMultiplier: multiplier,
        isArchived,
        options: {
          hasSampleSolution,
          hasAnswerFeedbacks,
          displayMode: 'LIST',
          choices: choices.map((choice, ix) => ({
            ix,
            value: choice.value,
            correct: hasSampleSolution ? (choice.correct ?? false) : undefined,
            feedback: hasAnswerFeedbacks ? choice.feedback : undefined,
          })),
        },
        owner: { connect: { id: userId } },
      },
    })

    await prisma.derivedPermission.upsert({
      where: { elementId_userId: { elementId: question.id, userId } },
      create: {
        permissionLevel: PL.OWNER,
        element: { connect: { id: question.id } },
        user: { connect: { id: userId } },
      },
      update: { permissionLevel: PL.OWNER },
    })

    return true
  } catch (error) {
    throw error
  }
}

export async function createQuestionMC({
  name,
  content,
  explanation,
  choices,
  multiplier,
  isArchived = false,
  userId,
}: {
  name: string
  content: string
  explanation?: string
  choices: { value: string; correct?: boolean; feedback?: string }[]
  multiplier?: number
  isArchived?: boolean
  userId: string
}) {
  const prisma = await getPrisma()
  const { ElementType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )

  if (choices.length < 2) {
    throw new Error('MC questions require at least 2 choices')
  }

  const hasSampleSolution = choices.some(
    (c) => typeof c.correct !== 'undefined'
  )
  const hasAnswerFeedbacks = choices.every(
    (c) => typeof c.feedback !== 'undefined'
  )

  try {
    const question = await prisma.element.create({
      data: {
        type: ElementType.MC,
        name,
        content,
        explanation: explanation ?? undefined,
        basePoints: true,
        pointsMultiplier: multiplier,
        isArchived,
        options: {
          hasSampleSolution,
          hasAnswerFeedbacks,
          displayMode: 'LIST',
          choices: choices.map((choice, ix) => ({
            ix,
            value: choice.value,
            correct: hasSampleSolution ? (choice.correct ?? false) : undefined,
            feedback: hasAnswerFeedbacks ? choice.feedback : undefined,
          })),
        },
        owner: { connect: { id: userId } },
      },
    })

    await prisma.derivedPermission.upsert({
      where: { elementId_userId: { elementId: question.id, userId } },
      create: {
        permissionLevel: PL.OWNER,
        element: { connect: { id: question.id } },
        user: { connect: { id: userId } },
      },
      update: { permissionLevel: PL.OWNER },
    })

    return true
  } catch (error) {
    throw error
  }
}

export async function createQuestionKPRIM({
  name,
  content,
  explanation,
  choices,
  multiplier,
  isArchived = false,
  userId,
}: {
  name: string
  content: string
  explanation?: string
  choices: { value: string; correct?: boolean; feedback?: string }[]
  multiplier?: number
  isArchived?: boolean
  userId: string
}) {
  const prisma = await getPrisma()
  const { ElementType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )

  if (choices.length !== 4) {
    throw new Error('KPRIM questions require exactly 4 choices')
  }

  const hasSampleSolution = choices.some(
    (c) => typeof c.correct !== 'undefined'
  )
  const hasAnswerFeedbacks = choices.every(
    (c) => typeof c.feedback !== 'undefined'
  )

  try {
    const question = await prisma.element.create({
      data: {
        type: ElementType.KPRIM,
        name,
        content,
        explanation: explanation ?? undefined,
        basePoints: true,
        pointsMultiplier: multiplier,
        isArchived,
        options: {
          hasSampleSolution,
          hasAnswerFeedbacks,
          displayMode: 'LIST',
          choices: choices.map((choice, ix) => ({
            ix,
            value: choice.value,
            correct: hasSampleSolution ? (choice.correct ?? false) : undefined,
            feedback: hasAnswerFeedbacks ? choice.feedback : undefined,
          })),
        },
        owner: { connect: { id: userId } },
      },
    })

    await prisma.derivedPermission.upsert({
      where: { elementId_userId: { elementId: question.id, userId } },
      create: {
        permissionLevel: PL.OWNER,
        element: { connect: { id: question.id } },
        user: { connect: { id: userId } },
      },
      update: { permissionLevel: PL.OWNER },
    })

    return true
  } catch (error) {
    throw error
  }
}

export async function createAnswerCollection({
  name,
  description,
  entries,
  userId,
}: {
  name: string
  description: string
  entries: string[]
  userId: string
}) {
  const prisma = await getPrisma()
  const { PermissionLevel: PL } = await import('@klicker-uzh/prisma/client')

  const answerCollection = await prisma.answerCollection.create({
    data: {
      name,
      description,
      entries: {
        create: entries.map((entry) => ({
          value: entry,
        })),
      },
      owner: { connect: { id: userId } },
    },
  })

  await prisma.derivedPermission.upsert({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: answerCollection.id,
        userId,
      },
    },
    create: {
      permissionLevel: PL.OWNER,
      answerCollection: { connect: { id: answerCollection.id } },
      user: { connect: { id: userId } },
    },
    update: { permissionLevel: PL.OWNER },
  })

  return true
}

export async function createQuestionSE({
  name,
  content,
  explanation,
  multiplier,
  collectionName,
  numberOfInputs,
  correctAnswers,
  isArchived = false,
  userId,
}: {
  name: string
  content: string
  explanation?: string
  multiplier?: number
  collectionName: string
  numberOfInputs: number
  correctAnswers?: string[]
  isArchived?: boolean
  userId: string
}) {
  const prisma = await getPrisma()
  const { ElementType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )

  const dbAnswerCollection = await prisma.answerCollection.findFirst({
    where: {
      name: collectionName,
      isDeleted: false,
      permissions: { some: { userId } },
    },
  })

  if (!dbAnswerCollection) {
    throw new Error(`Answer collection ${collectionName} not found`)
  }

  const hasSampleSolution = Boolean(correctAnswers?.length)
  const dbAnswerCollectionItems: Array<{ id: number }> = hasSampleSolution
    ? await prisma.answerCollectionEntry.findMany({
        where: {
          collectionId: dbAnswerCollection.id,
          value: { in: correctAnswers },
        },
      })
    : []

  if (
    hasSampleSolution &&
    correctAnswers!.length !== dbAnswerCollectionItems.length
  ) {
    throw new Error(
      `Answer collection ${collectionName} does not contain all correct answers`
    )
  }

  const selectionQuestion = await prisma.element.create({
    data: {
      type: ElementType.SELECTION,
      name,
      content,
      explanation,
      pointsMultiplier: multiplier,
      isArchived,
      options: {
        hasSampleSolution,
        numberOfInputs,
      },
      answerCollection: { connect: { id: dbAnswerCollection.id } },
      answerCollectionItems: hasSampleSolution
        ? {
            connect: dbAnswerCollectionItems.map((item) => ({
              id: item.id,
            })),
          }
        : undefined,
      owner: { connect: { id: userId } },
    },
  })

  await prisma.derivedPermission.upsert({
    where: {
      elementId_userId: {
        elementId: selectionQuestion.id,
        userId,
      },
    },
    create: {
      permissionLevel: PL.OWNER,
      element: { connect: { id: selectionQuestion.id } },
      user: { connect: { id: userId } },
    },
    update: { permissionLevel: PL.OWNER },
  })

  await prisma.derivedPermission.upsert({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: dbAnswerCollection.id,
        userId,
      },
    },
    create: {
      permissionLevel: PL.READ,
      derived: true,
      answerCollection: { connect: { id: dbAnswerCollection.id } },
      user: { connect: { id: userId } },
    },
    update: {},
  })

  return true
}
