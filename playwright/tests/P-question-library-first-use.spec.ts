import {
  ElementStatus,
  ElementType,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import { expect, test as baseTest } from '../util/fixtures.js'
import {
  fillEditorField,
  saveElement,
  switchElementType,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

type TestPrismaClient = Awaited<ReturnType<typeof getPrisma>>

type SyntheticLecturer = {
  id: string
  email: string
  shortname: string
}

type OwnedResourceSnapshot = {
  elements: Array<{ name: string; type: ElementType }>
  answerCollections: Array<{ name: string; entries: string[] }>
  tags: string[]
  liveQuizzes: string[]
}

const EMPTY_RESOURCES: OwnedResourceSnapshot = {
  elements: [],
  answerCollections: [],
  tags: [],
  liveQuizzes: [],
}

const EXPECTED_DEMO_ELEMENTS: OwnedResourceSnapshot['elements'] = [
  { name: 'Demo Content Element', type: ElementType.CONTENT },
  { name: 'Demo Flashcard', type: ElementType.FLASHCARD },
  { name: 'Demoquestion CS', type: ElementType.CASE_STUDY },
  { name: 'Demoquestion FT', type: ElementType.FREE_TEXT },
  { name: 'Demoquestion KPRIM', type: ElementType.KPRIM },
  { name: 'Demoquestion MC', type: ElementType.MC },
  { name: 'Demoquestion NR', type: ElementType.NUMERICAL },
  { name: 'Demoquestion SC', type: ElementType.SC },
  { name: 'Demoquestion SE', type: ElementType.SELECTION },
]

const EXPECTED_DEMO_RESOURCES: OwnedResourceSnapshot = {
  elements: EXPECTED_DEMO_ELEMENTS,
  answerCollections: [
    {
      name: 'Demo Teaching Activities',
      entries: [
        'Instructor demonstration',
        'Live poll',
        'Mini-lecture',
        'One-minute paper',
        'Small-group case discussion',
        'Think-pair-share',
      ],
    },
  ],
  tags: ['Demo Tag'],
  liveQuizzes: ['Demo Live Quiz'],
}

function createSyntheticLecturer(): SyntheticLecturer {
  const id = randomUUID()
  const suffix = randomUUID().replaceAll('-', '')

  return {
    id,
    email: `w7-first-use-${suffix}@example.invalid`,
    shortname: `w7${suffix.slice(0, 8)}`,
  }
}

async function getOwnedResourceSnapshot(
  prisma: TestPrismaClient,
  userId: string
): Promise<OwnedResourceSnapshot> {
  const [elements, answerCollections, tags, liveQuizzes] = await Promise.all([
    prisma.element.findMany({
      where: { ownerId: userId },
      select: { name: true, type: true },
    }),
    prisma.answerCollection.findMany({
      where: { ownerId: userId },
      select: {
        name: true,
        entries: { select: { value: true } },
      },
    }),
    prisma.tag.findMany({
      where: { ownerId: userId },
      select: { name: true },
    }),
    prisma.liveQuiz.findMany({
      where: { ownerId: userId },
      select: { name: true },
    }),
  ])

  return {
    elements: elements.sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    answerCollections: answerCollections
      .map((collection) => ({
        name: collection.name,
        entries: collection.entries
          .map((entry) => entry.value)
          .sort((left, right) => left.localeCompare(right)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    tags: tags
      .map((tag) => tag.name)
      .sort((left, right) => left.localeCompare(right)),
    liveQuizzes: liveQuizzes
      .map((liveQuiz) => liveQuiz.name)
      .sort((left, right) => left.localeCompare(right)),
  }
}

async function assertFreshFirstUseBaseline(
  prisma: TestPrismaClient,
  lecturer: SyntheticLecturer
) {
  const user = await prisma.user.findUnique({
    where: { id: lecturer.id },
    select: { id: true, email: true, shortname: true, firstLogin: true },
  })
  expect(user).toEqual({
    id: lecturer.id,
    email: lecturer.email,
    shortname: lecturer.shortname,
    firstLogin: true,
  })
  expect(await getOwnedResourceSnapshot(prisma, lecturer.id)).toEqual(
    EMPTY_RESOURCES
  )
}

async function assertFirstLoginCompleted(
  prisma: TestPrismaClient,
  lecturer: SyntheticLecturer
) {
  await expect(
    prisma.user.findUnique({
      where: { id: lecturer.id },
      select: { id: true, email: true, shortname: true, firstLogin: true },
    })
  ).resolves.toEqual({
    id: lecturer.id,
    email: lecturer.email,
    shortname: lecturer.shortname,
    firstLogin: false,
  })
}

async function assertSyntheticCleanup(
  prisma: TestPrismaClient,
  userId: string
) {
  const [user, elements, answerCollections, tags, liveQuizzes, instances] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.element.count({ where: { ownerId: userId } }),
      prisma.answerCollection.count({ where: { ownerId: userId } }),
      prisma.tag.count({ where: { ownerId: userId } }),
      prisma.liveQuiz.count({ where: { ownerId: userId } }),
      prisma.elementInstance.count({ where: { ownerId: userId } }),
    ])

  expect(user).toBeNull()
  expect({ elements, answerCollections, tags, liveQuizzes, instances }).toEqual(
    {
      elements: 0,
      answerCollections: 0,
      tags: 0,
      liveQuizzes: 0,
      instances: 0,
    }
  )
}

async function chooseDemoContent(
  page: import('@playwright/test').Page,
  seedDemoElements: boolean
) {
  await expect(
    page.getByTestId('first-login-seed-demo-elements-yes')
  ).toBeVisible()
  await expect(
    page.getByTestId('first-login-seed-demo-elements-no')
  ).toBeVisible()

  const saveButton = page.getByTestId('first-login-save-settings')
  await expect(saveButton).toBeDisabled()
  await page
    .getByTestId(
      seedDemoElements
        ? 'first-login-seed-demo-elements-yes'
        : 'first-login-seed-demo-elements-no'
    )
    .click()
  await expect(saveButton).toBeEnabled()

  const mutationRequest = page.waitForRequest((request) => {
    if (
      request.method() !== 'POST' ||
      !request.url().includes('/api/graphql')
    ) {
      return false
    }

    const postData = request.postData()
    if (!postData) return false

    try {
      return (
        (JSON.parse(postData) as { operationName?: string }).operationName ===
        'ChangeInitialSettings'
      )
    } catch {
      return false
    }
  })

  await saveButton.click()

  const request = await mutationRequest
  const payload = JSON.parse(request.postData() ?? '{}') as {
    operationName?: string
    variables?: { seedDemoElements?: boolean }
  }
  expect(payload.operationName).toBe('ChangeInitialSettings')
  expect(payload.variables?.seedDemoElements).toBe(seedDemoElements)

  await expect(saveButton).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('elements-search-input')).toBeVisible()
  await expect(page.getByTestId('result-range-summary-top')).toBeVisible()
}

const test = baseTest.extend<{ firstUseLecturer: SyntheticLecturer }>({
  firstUseLecturer: async ({}, use) => {
    const prisma = await getPrisma()
    const lecturer = createSyntheticLecturer()
    let userCreated = false

    try {
      await prisma.user.create({
        data: {
          id: lecturer.id,
          email: lecturer.email,
          shortname: lecturer.shortname,
          name: 'Synthetic W7 first-use lecturer',
          role: UserRole.USER,
          firstLogin: true,
        },
      })
      userCreated = true

      await assertFreshFirstUseBaseline(prisma, lecturer)
      await use(lecturer)
    } finally {
      if (userCreated) {
        await prisma.user.deleteMany({ where: { id: lecturer.id } })
      }
      await assertSyntheticCleanup(prisma, lecturer.id)
    }
  },
})

test.describe('Question library first-use baseline', () => {
  test('creates the first Ready element and recovers every narrowed zero-result state', async ({
    page,
    loginFactory,
    firstUseLecturer,
  }) => {
    await loginFactory({
      email: firstUseLecturer.email,
      sub: firstUseLecturer.id,
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
    })

    const prisma = await getPrisma()
    await chooseDemoContent(page, false)
    await assertFirstLoginCompleted(prisma, firstUseLecturer)

    await expect(page.locator('[data-cy^="element-item-"]')).toHaveCount(0)
    await expect(page.getByTestId('elements-empty-state')).toBeVisible()
    await expect(page.getByText('Create your first element')).toBeVisible()

    const elementName = `W7 First Element ${firstUseLecturer.shortname}`
    await page.getByTestId('elements-empty-create').click()
    await switchElementType(page, elementTypeLabels.content)
    await page.getByTestId('insert-question-title').fill(elementName)
    await fillEditorField(
      page,
      'insert-question-text',
      'Synthetic first element content'
    )
    await saveElement(page)

    const elementCard = page.getByTestId(`element-item-${elementName}`)
    await expect(elementCard).toBeVisible()
    await expect(elementCard).toContainText(statusLabels.ready)
    await expect(
      prisma.element.findFirst({
        where: { ownerId: firstUseLecturer.id, name: elementName },
        select: { name: true, status: true },
      })
    ).resolves.toEqual({ name: elementName, status: ElementStatus.READY })

    await page.getByTestId('element-status-filter-DRAFT').click()
    await expect(page.getByTestId('elements-no-results')).toBeVisible()
    await expect(page.getByTestId('elements-reset-filters')).toBeVisible()
    await expect(page.getByTestId('elements-clear-search')).toHaveCount(0)

    const search = page.getByTestId('elements-search-input')
    const noMatch = `No match ${firstUseLecturer.shortname}`
    await search.fill(noMatch)
    await search.press('Enter')
    await expect(page.getByTestId('elements-clear-search')).toBeVisible()
    await expect(page.getByTestId('elements-reset-filters')).toBeVisible()

    await page.getByTestId('elements-clear-search').click()
    await expect(search).toHaveValue('')
    await expect(page.getByTestId('elements-clear-search')).toHaveCount(0)
    await expect(page.getByTestId('elements-reset-filters')).toBeVisible()

    await search.fill(noMatch)
    await search.press('Enter')
    await page.getByTestId('elements-reset-filters').click()
    await expect(page.getByTestId('elements-reset-filters')).toHaveCount(0)
    await expect(page.getByTestId('elements-clear-search')).toBeVisible()

    await page.getByTestId('elements-clear-search').click()
    await expect(elementCard).toBeVisible()
  })

  test('routes the empty-state action through saved-draft recovery', async ({
    page,
    loginFactory,
    firstUseLecturer,
  }) => {
    await loginFactory({
      email: firstUseLecturer.email,
      sub: firstUseLecturer.id,
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
    })

    const prisma = await getPrisma()
    await chooseDemoContent(page, false)
    await assertFirstLoginCompleted(prisma, firstUseLecturer)
    await expect(page.getByTestId('elements-empty-state')).toBeVisible()

    await page.evaluate(() => {
      localStorage.setItem('autosave-element-creation', '{}')
    })
    await page.getByTestId('elements-empty-create').click()
    await expect(page.getByTestId('load-recovered-element-data')).toBeVisible()
    await expect(
      page.getByTestId('discard-recovered-element-data')
    ).toBeVisible()

    await page.getByTestId('discard-recovered-element-data').click()
    await expect(page.getByTestId('select-question-type')).toBeVisible()
    await page.getByTestId('close-element-modal').click()
    expect(
      await page.evaluate(() =>
        localStorage.getItem('autosave-element-creation')
      )
    ).toBeNull()
    expect(await getOwnedResourceSnapshot(prisma, firstUseLecturer.id)).toEqual(
      EMPTY_RESOURCES
    )
  })

  test('creates exactly the established demo bundle when demo content is accepted', async ({
    page,
    loginFactory,
    firstUseLecturer,
  }) => {
    await loginFactory({
      email: firstUseLecturer.email,
      sub: firstUseLecturer.id,
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
    })

    const prisma = await getPrisma()
    await chooseDemoContent(page, true)
    await assertFirstLoginCompleted(prisma, firstUseLecturer)

    expect(await getOwnedResourceSnapshot(prisma, firstUseLecturer.id)).toEqual(
      EXPECTED_DEMO_RESOURCES
    )
    for (const element of EXPECTED_DEMO_ELEMENTS) {
      await expect(
        page.getByTestId(`element-item-${element.name}`)
      ).toBeVisible()
    }
  })
})
