import { expect, Page } from '@playwright/test'
import { getPrisma } from '../../global-setup.js'

export type StackType = {
  elements: string[]
}

export type DatetimeType = {
  monthDelta: number
  day: number
  hour: number
  minute: number
  validation: string
}

export type GroupActivityClueType = {
  type: 'text' | 'number'
  name: string
  displayName: string
  content: string
  unit?: string
}

export async function selectOption(
  page: Page,
  selector: string,
  optionText: string
) {
  const trigger = page.locator(selector)
  await trigger.scrollIntoViewIfNeeded()
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeEnabled()
  await trigger.click()
  await page.waitForTimeout(100)

  const testId = selector.match(/\[data-cy="([^"]+)"\]/)?.[1]
  const candidates = [
    testId ? page.getByTestId(`${testId}-${optionText}`) : undefined,
    testId
      ? page.locator(`[data-cy*="${testId}"][data-cy*="${optionText}"]`)
      : undefined,
    page.locator(`[data-value="${optionText}"]`),
    page.locator('[role="option"]').filter({ hasText: optionText }),
    page.getByText(optionText, { exact: true }),
  ].filter((locator): locator is ReturnType<Page['locator']> =>
    Boolean(locator)
  )

  for (const candidate of candidates) {
    if ((await candidate.count()) === 0) continue

    const option = candidate.first()
    if (await option.isVisible().catch(() => false)) {
      await option.scrollIntoViewIfNeeded()
      await option.click()
      return
    }
  }

  throw new Error(`Unable to select option "${optionText}" for ${selector}`)
}

export async function dragAndDropElement(
  page: Page,
  element: string,
  target: string
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(element)
  await page.keyboard.press('Enter')

  const source = page.getByTestId(`element-item-${element}`).first()
  const dropTarget = page.getByTestId(target)
  await expect(source).toBeVisible()
  await source.dragTo(dropTarget)
  await page.getByTestId('elements-search-input').clear()
}

export async function createStacks(
  page: Page,
  {
    stacks,
    type = 'stack',
  }: {
    stacks: StackType[]
    type?: 'block' | 'stack'
  }
) {
  for (let stackIx = 0; stackIx < stacks.length; stackIx++) {
    if (stackIx > 0) {
      await page.getByTestId(`drop-elements-add-${type}`).click()
    }

    for (
      let elementIx = 0;
      elementIx < stacks[stackIx].elements.length;
      elementIx++
    ) {
      const element = stacks[stackIx].elements[elementIx]
      await dragAndDropElement(
        page,
        element,
        `drop-elements-${type}-${stackIx}`
      )
      await expect(
        page.getByTestId(`element-${elementIx}-${type}-${stackIx}`)
      ).toContainText(element.substring(0, 20))
    }
  }
}

function getCalendarDataDay(validation: string) {
  const match = validation.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) {
    throw new Error(`setDatetime: cannot parse date from "${validation}"`)
  }

  const [, dayString, monthString, yearString] = match
  return new Date(
    Number(yearString),
    Number(monthString) - 1,
    Number(dayString)
  ).toLocaleDateString()
}

export async function setDatetime(
  page: Page,
  {
    cyString,
    deselectorString,
    datetime,
  }: {
    cyString: string
    deselectorString: string
    datetime: DatetimeType
  }
) {
  await page.getByTestId(cyString).click()

  const hour = String(datetime.hour).padStart(2, '0')
  const minute = String(datetime.minute).padStart(2, '0')
  const targetDataDay = getCalendarDataDay(datetime.validation)

  const direction =
    datetime.monthDelta > 0
      ? `${cyString}-next-month`
      : `${cyString}-previous-month`
  for (let i = 0; i < Math.abs(datetime.monthDelta); i++) {
    const button = page.getByTestId(direction).locator('..')
    await expect(button).toBeEnabled()
    await button.click()
    await page.waitForTimeout(100)
  }

  await page
    .getByTestId(`${cyString}-calendar`)
    .locator(`[data-day="${targetDataDay}"]`)
    .click()
  await page.waitForTimeout(100)

  for (const [testId, value] of [
    [`${cyString}-hours`, hour],
    [`${cyString}-minutes`, minute],
  ] as const) {
    const input = page.getByTestId(testId)
    await input.click()
    await input.press('ControlOrMeta+A')
    await input.pressSequentially(value)
  }

  const minutesInput = page.getByTestId(`${cyString}-minutes`)
  const closeAttempts = [
    () => page.getByTestId(deselectorString).click({ timeout: 3000 }),
    () => page.getByRole('heading').first().click({ timeout: 3000 }),
    () => page.keyboard.press('Escape'),
  ]

  for (const close of closeAttempts) {
    if (!(await minutesInput.isVisible())) break
    await close().catch(() => undefined)
  }

  await expect(minutesInput).not.toBeAttached()
  await expect(page.getByTestId(cyString)).toContainText(datetime.validation)
}

export async function createLiveQuiz(
  page: Page,
  {
    name,
    displayName,
    courseName,
    multiplier,
    gamificationWithoutCourse,
    pinProtectionWithoutCourse,
    responseCollectionMode,
    blocks,
  }: {
    name: string
    displayName: string
    courseName?: string
    multiplier?: string
    gamificationWithoutCourse?: boolean
    pinProtectionWithoutCourse?: boolean
    responseCollectionMode?: 'aggregated' | 'correlated'
    blocks: StackType[]
  }
) {
  await page.getByTestId('create-live-quiz').click()

  await page.getByTestId('insert-live-quiz-name').fill(name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('insert-live-display-name').fill(displayName)
  await page.getByTestId('next-or-submit').click()

  if (courseName) {
    await selectOption(page, '[data-cy="select-course"]', courseName)
    await expect(page.getByTestId('select-course')).toContainText(courseName)

    if (multiplier) {
      await page.getByTestId('select-multiplier').click()
      await page.getByTestId(`select-multiplier-${multiplier}`).click()
      await expect(page.getByTestId('select-multiplier')).toContainText(
        multiplier
      )
    }
  }

  if (gamificationWithoutCourse) {
    await page.getByTestId('set-quiz-gamification').click()
  }
  if (pinProtectionWithoutCourse) {
    await page.getByTestId('set-quiz-pin-protection').click()
  }
  if (responseCollectionMode === 'correlated') {
    await page.getByTestId('set-quiz-response-collection-correlated').click()
  }

  await page.getByTestId('next-or-submit').click()
  await createStacks(page, { stacks: blocks, type: 'block' })
  await page.getByTestId('next-or-submit').click()
}

export async function createPracticeQuiz(
  page: Page,
  {
    name,
    displayName,
    description,
    courseName,
    multiplier,
    stacks,
  }: {
    name: string
    displayName: string
    description?: string
    courseName: string
    multiplier?: string
    stacks: StackType[]
  }
) {
  await page.getByTestId('create-practice-quiz').click()

  await page.getByTestId('insert-practice-quiz-name').fill(name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('insert-practice-quiz-display-name').fill(displayName)
  if (description) {
    await page.getByTestId('insert-practice-quiz-description').click()
    await page
      .getByTestId('insert-practice-quiz-description')
      .pressSequentially(description)
  }
  await page.getByTestId('next-or-submit').click()

  await selectOption(page, '[data-cy="select-course"]', courseName)
  await expect(page.getByTestId('select-course')).toContainText(courseName)
  if (multiplier) {
    await page.getByTestId('select-multiplier').click()
    await page.getByTestId(`select-multiplier-${multiplier}`).click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      multiplier
    )
  }
  await page.getByTestId('next-or-submit').click()

  await createStacks(page, { stacks })
  await page.getByTestId('next-or-submit').click()
}

export async function createMicroLearning(
  page: Page,
  {
    name,
    displayName,
    description,
    courseName,
    multiplier,
    startDate,
    endDate,
    stacks,
  }: {
    name: string
    displayName: string
    description?: string
    courseName: string
    multiplier?: string
    startDate: DatetimeType
    endDate: DatetimeType
    stacks: StackType[]
  }
) {
  await page.getByTestId('create-microlearning').click()

  await page.getByTestId('insert-microlearning-name').fill(name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('insert-microlearning-display-name').fill(displayName)
  if (description) {
    await page.getByTestId('insert-microlearning-description').click()
    await page
      .getByTestId('insert-microlearning-description')
      .pressSequentially(description)
  }
  await page.getByTestId('next-or-submit').click()

  await selectOption(page, '[data-cy="select-course"]', courseName)
  await expect(page.getByTestId('select-course')).toContainText(courseName)
  await setDatetime(page, {
    cyString: 'select-start-date',
    deselectorString: 'availability-section-header',
    datetime: { ...startDate, monthDelta: startDate.monthDelta - 1 },
  })
  await setDatetime(page, {
    cyString: 'select-end-date',
    deselectorString: 'availability-section-header',
    datetime: { ...endDate, monthDelta: endDate.monthDelta - 1 },
  })
  if (multiplier) {
    await page.getByTestId('select-multiplier').click()
    await page.getByTestId(`select-multiplier-${multiplier}`).click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      multiplier
    )
  }
  await page.getByTestId('next-or-submit').click()

  await createStacks(page, { stacks })
  await page.getByTestId('next-or-submit').click()
}

export async function createGroupActivity(
  page: Page,
  {
    name,
    displayName,
    task,
    courseName,
    multiplier,
    scheduledStartDate,
    scheduledEndDate,
    clues,
    stack,
  }: {
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
) {
  await page.getByTestId('create-group-activity').click()

  await page.getByTestId('insert-groupactivity-name').fill(name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('back-activity-creation').click()
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('insert-groupactivity-display-name').fill(displayName)
  await page.getByTestId('insert-groupactivity-description').click()
  await page
    .getByTestId('insert-groupactivity-description')
    .pressSequentially(task)
  await page.getByTestId('next-or-submit').click()

  await selectOption(page, '[data-cy="select-course"]', courseName)
  await expect(page.getByTestId('select-course')).toContainText(courseName)
  if (multiplier) {
    await page.getByTestId('select-multiplier').click()
    await page.getByTestId(`select-multiplier-${multiplier}`).click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      multiplier
    )
  }

  await setDatetime(page, {
    cyString: 'select-start-date',
    deselectorString: 'availability-section-header',
    datetime: {
      ...scheduledStartDate,
      monthDelta: scheduledStartDate.monthDelta - 1,
    },
  })
  await setDatetime(page, {
    cyString: 'select-end-date',
    deselectorString: 'availability-section-header',
    datetime: {
      ...scheduledEndDate,
      monthDelta: scheduledEndDate.monthDelta - 1,
    },
  })
  await page.getByTestId('next-or-submit').click()

  for (const clue of clues) {
    await page.getByTestId('add-group-activity-clue').click()
    await page.getByTestId('group-activity-clue-type').click()
    await page
      .getByTestId(
        `group-activity-clue-type-${clue.type === 'text' ? 'string' : 'number'}`
      )
      .click()
    await page.getByTestId('group-activity-clue-name').fill(clue.name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(clue.displayName)
    await page
      .getByTestId(
        `group-activity-${clue.type === 'text' ? 'string' : 'number'}-clue-value`
      )
      .fill(clue.content)

    if (clue.type === 'number' && clue.unit) {
      await page.getByTestId('group-activity-number-clue-unit').fill(clue.unit)
    }

    await page.getByTestId('group-activity-clue-save').click()
    await expect(page.getByText(clue.name, { exact: true })).toBeVisible()
  }

  await createStacks(page, { stacks: [stack] })
  await page.getByTestId('next-or-submit').click()
}

export async function removeSoftDeletedPracticeQuiz(quizName: string) {
  const prisma = await getPrisma()
  const practiceQuizzes = await prisma.practiceQuiz.deleteMany({
    where: {
      name: quizName,
      isDeleted: true,
    },
  })

  return practiceQuizzes.count > 0
}

export async function removeSoftDeletedMicrolearning(mlName: string) {
  const prisma = await getPrisma()
  const microLearnings = await prisma.microLearning.deleteMany({
    where: {
      name: mlName,
      isDeleted: true,
    },
  })

  return microLearnings.count > 0
}
