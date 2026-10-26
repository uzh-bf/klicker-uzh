/**
 * I-elements-numerical.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/I-elements-numerical-workflow.cy.ts
 * Tests creation, persistence, editing, range solutions, and exact solutions
 * for Numerical (NR) element type.
 */

import type { Page } from '@playwright/test'
import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { NR_DATA as NR, USER_ID_TEST } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  fillEditorField,
  fillNumericalFields,
  saveElement,
  searchAndEdit,
  setElementStatus,
  switchElementType,
  validateElement,
  verifyEditorField,
  verifyNumericalFields,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

type NumericalOptionsPayload = {
  accuracy?: number | null
  exactSolutions?: number[] | null
}

function expectNumericalOptions(
  options: NumericalOptionsPayload | undefined,
  expected: { accuracy?: number; exactSolutions: number[] }
) {
  expect(options?.exactSolutions).toEqual(expected.exactSolutions)
  if (expected.accuracy === undefined) {
    expect(options).not.toHaveProperty('accuracy')
  } else {
    expect(options?.accuracy).toBe(expected.accuracy)
  }
}

async function saveNumericalElement(page: Page) {
  const requestPromise = page.waitForRequest((request) => {
    if (
      request.method() !== 'POST' ||
      !request.url().includes('/api/graphql')
    ) {
      return false
    }

    try {
      const body = request.postDataJSON() as { operationName?: string }
      return body.operationName === 'ManipulateNumericalQuestion'
    } catch {
      return false
    }
  })

  await saveElement(page)
  const body = (await requestPromise).postDataJSON() as {
    variables?: { options?: NumericalOptionsPayload }
  }
  return body.variables?.options
}

async function readNumericalOptions(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  elementId: number
) {
  const element = await prisma.element.findUniqueOrThrow({
    where: { id: elementId },
    select: { options: true },
  })
  return element.options as NumericalOptionsPayload
}

async function createSyntheticNumericalElement(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  options: { name: string; accuracy: number; exactSolutions: number[] }
) {
  const element = await prisma.element.create({
    data: {
      type: 'NUMERICAL',
      status: 'READY',
      name: options.name,
      content: 'Synthetic legacy numerical content',
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: true,
        accuracy: options.accuracy,
        restrictions: { min: -1, max: 1 },
        exactSolutions: options.exactSolutions,
      },
      owner: { connect: { id: USER_ID_TEST } },
    },
  })
  await prisma.derivedPermission.upsert({
    where: {
      elementId_userId: {
        elementId: element.id,
        userId: USER_ID_TEST,
      },
    },
    create: {
      permissionLevel: PermissionLevel.OWNER,
      element: { connect: { id: element.id } },
      user: { connect: { id: USER_ID_TEST } },
    },
    update: { permissionLevel: PermissionLevel.OWNER },
  })
  return element
}

test('CLEANUP', cleanupTest)

test.describe('Test creation and editing functionalities for Numerical elements', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create a Numerical question', async ({ page }) => {
    await page.getByTestId('create-question').click()

    await expect(page.getByTestId('select-question-type')).toContainText(
      elementTypeLabels.singleChoice
    )
    await switchElementType(page, elementTypeLabels.numerical)
    await page.getByTestId('insert-question-title').fill(NR.title)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(page, 'insert-question-text', NR.content)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await fillNumericalFields(page, {
      min: String(NR.min),
      max: String(NR.max),
      unit: NR.unit,
      accuracy: String(NR.accuracy),
    })

    await saveElement(page)
    await validateElement(page, NR.title, [
      NR.content,
      NR.title,
      statusLabels.ready,
    ])

    // Verify bounds display
    await searchAndEdit(page, NR.title)
    await expect(page.getByTestId('input-numerical-minimum')).toContainText(
      `Min: ${NR.min}`
    )
    await expect(page.getByTestId('input-numerical-maximum')).toContainText(
      `Max: ${NR.max}`
    )
    await expect(page.getByTestId('input-numerical-accuracy')).toContainText(
      `Precision: ${NR.accuracy}`
    )
    await expect(page.getByTestId('input-numerical-unit')).toContainText(
      NR.unit
    )
    await page.getByTestId('close-element-modal').click()
  })

  test('Check that values of Numerical question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.title)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      NR.title
    )
    await expect(page.getByTestId('select-question-status')).toContainText(
      statusLabels.ready
    )
    await verifyEditorField(page, 'insert-question-text', NR.content)
    await verifyNumericalFields(page, {
      min: String(NR.min),
      max: String(NR.max),
      unit: NR.unit,
      accuracy: String(NR.accuracy),
    })

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit a Numerical question and add a sample solution', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.title)
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('insert-question-title').clear()
    await page.getByTestId('insert-question-title').fill(NR.titleEdited)
    await fillEditorField(page, 'insert-question-text', NR.contentEdited, true)
    await fillNumericalFields(
      page,
      {
        min: String(NR.minEdited),
        max: String(NR.maxEdited),
        unit: NR.unitEdited,
        accuracy: String(NR.accuracyEdited),
      },
      true
    )
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    // Enable sample solution — type selection required
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await page.waitForTimeout(500)
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Select range solution type
    await page.getByTestId('set-solution-type-range').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    // Add solution ranges
    for (let ix = 0; ix < NR.solutionRanges.length; ix++) {
      const range = NR.solutionRanges[ix]
      await page.getByTestId('add-solution-range').click()
      if (range.min !== null) {
        await page.getByTestId(`set-solution-range-min-${ix}`).click()
        await page
          .getByTestId(`set-solution-range-min-${ix}`)
          .fill(String(range.min))
      }
      if (range.max !== null) {
        await page.getByTestId(`set-solution-range-max-${ix}`).click()
        await page
          .getByTestId(`set-solution-range-max-${ix}`)
          .fill(String(range.max))
      }
      await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    }

    // Test boundary validation for an extra range
    const newIx = NR.solutionRanges.length
    await page.getByTestId('add-solution-range').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId(`set-solution-range-min-${newIx}`).click()
    await page
      .getByTestId(`set-solution-range-min-${newIx}`)
      .fill(String(NR.minEdited - 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`set-solution-range-min-${newIx}`).click()
    await page.getByTestId(`set-solution-range-min-${newIx}`).clear()
    await page
      .getByTestId(`set-solution-range-min-${newIx}`)
      .fill(String(NR.minEdited))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId(`delete-solution-range-ix-${newIx}`).click()
    await page.getByTestId('add-solution-range').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    await page.getByTestId(`set-solution-range-max-${newIx}`).click()
    await page
      .getByTestId(`set-solution-range-max-${newIx}`)
      .fill(String(NR.maxEdited + 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`set-solution-range-max-${newIx}`).click()
    await page.getByTestId(`set-solution-range-max-${newIx}`).clear()
    await page
      .getByTestId(`set-solution-range-max-${newIx}`)
      .fill(String(NR.maxEdited))
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId(`delete-solution-range-ix-${newIx}`).click()
    await saveElement(page)
    await validateElement(page, NR.titleEdited, [
      NR.contentEdited,
      NR.titleEdited,
    ])
  })

  test('Check that edited Numerical question is stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.titleEdited)

    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      NR.titleEdited
    )
    await verifyEditorField(page, 'insert-question-text', NR.contentEdited)
    await verifyNumericalFields(page, {
      min: String(NR.minEdited),
      max: String(NR.maxEdited),
      unit: NR.unitEdited,
      accuracy: String(NR.accuracyEdited),
    })

    for (let ix = 0; ix < NR.solutionRanges.length; ix++) {
      const range = NR.solutionRanges[ix]
      if (range.min !== null)
        await expect(
          page.getByTestId(`set-solution-range-min-${ix}`)
        ).toHaveValue(String(range.min))
      if (range.max !== null)
        await expect(
          page.getByTestId(`set-solution-range-max-${ix}`)
        ).toHaveValue(String(range.max))
    }

    await page.getByTestId('close-element-modal').click()
  })

  test('Edit the numerical question again and set an exact solution', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.titleEdited)

    await page.getByTestId('set-solution-type-exact').click()
    await expect(page.getByTestId('save-new-question')).toBeDisabled()

    for (let ix = 0; ix < NR.exactSolutions.length; ix++) {
      await page.getByTestId('add-exact-solution').click()
      await page.getByTestId(`set-exact-solution-${ix}`).click()
      await page
        .getByTestId(`set-exact-solution-${ix}`)
        .fill(String(NR.exactSolutions[ix]))
      await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
    }

    // Exact solutions outside restrictions are invalid
    const newIx = NR.exactSolutions.length
    await page.getByTestId('add-exact-solution').click()
    await page.getByTestId(`set-exact-solution-${newIx}`).click()
    await page
      .getByTestId(`set-exact-solution-${newIx}`)
      .fill(String(NR.minEdited - 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`delete-exact-solution-${newIx}`).click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await page.getByTestId('add-exact-solution').click()
    await page.getByTestId(`set-exact-solution-${newIx}`).click()
    await page
      .getByTestId(`set-exact-solution-${newIx}`)
      .fill(String(NR.maxEdited + 10))
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await page.getByTestId(`delete-exact-solution-${newIx}`).click()
    await expect(page.getByTestId('save-new-question')).not.toBeDisabled()

    await saveElement(page)
  })

  test('Verify that the exact solutions of the numerical question are stored and loaded correctly', async ({
    page,
  }) => {
    await searchAndEdit(page, NR.titleEdited)

    for (let ix = 0; ix < NR.exactSolutions.length; ix++) {
      await expect(page.getByTestId(`set-exact-solution-${ix}`)).toHaveValue(
        String(NR.exactSolutions[ix])
      )
    }

    await page.getByTestId('close-element-modal').click()
  })

  test('Preserves numerical precision contracts across create, edit, and reopen', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    const precisionTitle = 'Numerical Precision Contract'
    const legacyTitle = 'Numerical Legacy Precision Contract'
    const legacyTitleEdited = `${legacyTitle} Edited`
    const invalidLegacyTitle = 'Numerical Legacy Invalid Precision Contract'
    const invalidLegacyTitleEdited = `${invalidLegacyTitle} Edited`
    const prisma = await getPrisma()

    await prisma.element.deleteMany({
      where: {
        ownerId: USER_ID_TEST,
        name: {
          in: [
            precisionTitle,
            legacyTitle,
            legacyTitleEdited,
            invalidLegacyTitle,
            invalidLegacyTitleEdited,
          ],
        },
      },
    })

    const legacyElement = await createSyntheticNumericalElement(prisma, {
      name: legacyTitle,
      accuracy: 2,
      exactSolutions: [-0.024],
    })
    const invalidLegacyElement = await createSyntheticNumericalElement(prisma, {
      name: invalidLegacyTitle,
      accuracy: 101,
      exactSolutions: [-0.024],
    })

    await page.getByTestId('create-question').click()
    await switchElementType(page, elementTypeLabels.numerical)
    await page.getByTestId('insert-question-title').fill(precisionTitle)
    await setElementStatus(page, statusLabels.ready)
    await fillEditorField(
      page,
      'insert-question-text',
      'Synthetic numerical precision content'
    )
    await fillNumericalFields(page, { min: '-1', max: '1' })
    await page.getByTestId('configure-sample-solution').click({ force: true })
    await page.getByTestId('set-solution-type-exact').click()

    for (const [index, solution] of [0.024, -0.024].entries()) {
      await page.getByTestId('add-exact-solution').click()
      await page
        .getByTestId(`set-exact-solution-${index}`)
        .fill(String(solution))
    }
    await expect(page.getByTestId('save-new-question')).toBeEnabled()

    const blankPrecisionPayload = await saveNumericalElement(page)
    expectNumericalOptions(blankPrecisionPayload, {
      exactSolutions: [0.024, -0.024],
    })
    const createdElement = await prisma.element.findFirstOrThrow({
      where: { name: precisionTitle, ownerId: USER_ID_TEST },
      select: { id: true },
    })
    const blankPrecisionStored = await readNumericalOptions(
      prisma,
      createdElement.id
    )
    expectNumericalOptions(blankPrecisionStored, {
      exactSolutions: [0.024, -0.024],
    })

    await searchAndEdit(page, precisionTitle)
    await expect(page.getByTestId('set-numerical-accuracy')).toHaveValue('')
    await expect(page.getByTestId('set-exact-solution-0')).toHaveValue('0.024')
    await expect(page.getByTestId('set-exact-solution-1')).toHaveValue('-0.024')
    await page.getByTestId('set-exact-solution-0').fill('0.02')
    await page.getByTestId('set-exact-solution-1').fill('-0.02')
    await fillNumericalFields(page, { accuracy: '0' })

    const explicitZeroPayload = await saveNumericalElement(page)
    expectNumericalOptions(explicitZeroPayload, {
      accuracy: 0,
      exactSolutions: [0, 0],
    })
    expectNumericalOptions(
      await readNumericalOptions(prisma, createdElement.id),
      { accuracy: 0, exactSolutions: [0, 0] }
    )

    await searchAndEdit(page, precisionTitle)
    await expect(page.getByTestId('set-numerical-accuracy')).toHaveValue('0')
    await page.getByTestId('set-numerical-accuracy').clear()
    await page.getByTestId('set-exact-solution-0').fill('-0.024')
    await page.getByTestId('set-exact-solution-1').fill('0.024')
    await fillNumericalFields(page, { accuracy: '2' })

    const twoDecimalsPayload = await saveNumericalElement(page)
    expectNumericalOptions(twoDecimalsPayload, {
      accuracy: 2,
      exactSolutions: [-0.02, 0.02],
    })
    expectNumericalOptions(
      await readNumericalOptions(prisma, createdElement.id),
      { accuracy: 2, exactSolutions: [-0.02, 0.02] }
    )

    await searchAndEdit(page, precisionTitle)
    await expect(page.getByTestId('set-exact-solution-0')).toHaveValue('-0.02')
    const precisionInput = page.getByTestId('set-numerical-accuracy')
    await precisionInput.fill('101')
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await precisionInput.fill('100')
    await expect(page.getByTestId('save-new-question')).toBeEnabled()
    await precisionInput.clear()
    await page.getByTestId('set-exact-solution-0').fill('-0.024')
    await page.getByTestId('set-exact-solution-1').fill('0.024')

    const clearedPrecisionPayload = await saveNumericalElement(page)
    expectNumericalOptions(clearedPrecisionPayload, {
      exactSolutions: [-0.024, 0.024],
    })
    const clearedPrecisionStored = await readNumericalOptions(
      prisma,
      createdElement.id
    )
    expectNumericalOptions(clearedPrecisionStored, {
      exactSolutions: [-0.024, 0.024],
    })

    await searchAndEdit(page, legacyTitle)
    await page.getByTestId('insert-question-title').fill(legacyTitleEdited)
    const legacyMetadataPayload = await saveNumericalElement(page)
    expectNumericalOptions(legacyMetadataPayload, {
      accuracy: 2,
      exactSolutions: [-0.024],
    })
    const legacyMetadataStored = await readNumericalOptions(
      prisma,
      legacyElement.id
    )
    expectNumericalOptions(legacyMetadataStored, {
      accuracy: 2,
      exactSolutions: [-0.024],
    })

    await searchAndEdit(page, legacyTitleEdited)
    await fillNumericalFields(page, { accuracy: '1' })
    const legacyPrecisionChangePayload = await saveNumericalElement(page)
    expectNumericalOptions(legacyPrecisionChangePayload, {
      accuracy: 1,
      exactSolutions: [0],
    })
    const legacyPrecisionChangeStored = await readNumericalOptions(
      prisma,
      legacyElement.id
    )
    expectNumericalOptions(legacyPrecisionChangeStored, {
      accuracy: 1,
      exactSolutions: [0],
    })

    await searchAndEdit(page, invalidLegacyTitle)
    await page
      .getByTestId('insert-question-title')
      .fill(invalidLegacyTitleEdited)
    const invalidLegacyPayload = await saveNumericalElement(page)
    expectNumericalOptions(invalidLegacyPayload, {
      accuracy: 101,
      exactSolutions: [-0.024],
    })
    const invalidLegacyStored = await readNumericalOptions(
      prisma,
      invalidLegacyElement.id
    )
    expectNumericalOptions(invalidLegacyStored, {
      accuracy: 101,
      exactSolutions: [-0.024],
    })
  })
})
