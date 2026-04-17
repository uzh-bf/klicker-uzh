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
  if (clear) await editor.clear()
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
  if (clear) await field.clear()
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
  if (clear) await field.clear()
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
  const el = page.getByTestId(`element-item-${elementName}`)
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
  await page.getByTestId('confirm-deletion-final').click()
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
