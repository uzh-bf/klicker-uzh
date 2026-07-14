import { ElementType, PermissionLevel } from '@klicker-uzh/prisma/client'
import { APIResponse, Page, Route, TestInfo } from '@playwright/test'
import { decodeJwt } from 'jose'
import { getPrisma } from '../../global-setup.js'
import {
  clickVisibleByTestId,
  openActionMenuByTestId,
} from '../../util/actions.js'
import {
  LECTURER_ID,
  LECTURER_SHORTNAME,
  URL_MANAGE,
} from '../../util/constants.js'
import { selectOption } from '../../util/fixtures/activities.js'
import {
  createAnswerCollection,
  createQuestionSC,
  createQuestionSE,
} from '../../util/fixtures/elements.js'
import { isGraphqlOperation } from '../../util/graphqlRequest.js'
import { enMessages as messages } from '../../util/messages.js'
import { expect } from './fixture.js'

type Choice = {
  value: string
  correct?: boolean
  feedback?: string
}

export async function shareElementWithUser(
  page: Page,
  {
    shortnameOrEmail,
    expectedPermissionKey = shortnameOrEmail,
    ownerPermissionKey = LECTURER_SHORTNAME,
    permission,
  }: {
    shortnameOrEmail: string
    expectedPermissionKey?: string
    ownerPermissionKey?: string
    permission: string
  }
) {
  await page.getByTestId('new-permission-username-or-email').click()
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(shortnameOrEmail)
  await selectOption(
    page,
    '[data-cy="new-permission-access-level"]',
    permission
  )
  await expect(page.getByTestId('new-permission-access-level')).toContainText(
    permission
  )
  await page.getByTestId('new-permission-submit').click()
  await expect(
    page.getByTestId(`permission-${expectedPermissionKey}`)
  ).toContainText(permission)
  await expect(
    page.getByTestId(`owner-permission-${ownerPermissionKey}`)
  ).toContainText(messages.manage.sharing.permissionsOWNER)
}

export async function openShareModalForElement(
  page: Page,
  elementName: string
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await page.getByTestId(`actions-element-${elementName}`).click()
  await page.getByTestId(`share-element-${elementName}`).click()
}
export const packageEntries = ['Package Alpha', 'Package Beta', 'Package Gamma']
const packageChoices: Choice[] = [
  { value: 'Package answer A', correct: true },
  { value: 'Package answer B', correct: false },
]
export const importUploadCapabilityHeader =
  'x-klicker-import-upload-capability' as const

type PreparedImportPackageUpload = {
  uploadURL: string
  uploadCapability: string
  artifactId: string
}

export function getManageOrigin() {
  return new URL(process.env.URL_MANAGE ?? URL_MANAGE).origin
}

export function getGraphqlApiUrl() {
  return new URL(
    '/api/graphql',
    process.env.NEXT_PUBLIC_API_URL ??
      process.env.API_URL ??
      'http://127.0.0.1:3000'
  ).toString()
}

export function getLookalikeOrigin(origin: string) {
  const url = new URL(origin)
  return `${url.protocol}//${url.hostname}.invalid${
    url.port ? `:${url.port}` : ''
  }`
}

export function expectNoStore(response: APIResponse) {
  expect(response.headers()['cache-control']).toBe('no-store')
}

export function expectAllowedUploadCors(response: APIResponse, origin: string) {
  const headers = response.headers()
  expect(headers['access-control-allow-origin']).toBe(origin)
  expect(headers['access-control-allow-credentials']).toBe('true')
}

export function expectNoUploadCors(response: APIResponse) {
  const headers = response.headers()
  expect(headers['access-control-allow-origin']).toBeUndefined()
  expect(headers['access-control-allow-credentials']).toBeUndefined()
}

export async function prepareImportPackageUpload(
  page: Page,
  bytes: number,
  trackArtifactId: (artifactId: string) => void
): Promise<PreparedImportPackageUpload> {
  const response = await page.request.post(getGraphqlApiUrl(), {
    headers: {
      'Content-Type': 'application/json',
      'x-graphql-yoga-csrf': '1',
      Origin: getManageOrigin(),
    },
    data: {
      operationName: 'PrepareElementImportPackageUpload',
      query: `
        mutation PrepareElementImportPackageUpload(
          $filename: String!
          $bytes: Int!
        ) {
          prepareElementImportPackageUpload(
            filename: $filename
            bytes: $bytes
          ) {
            uploadURL
            uploadCapability
            artifactId
          }
        }
      `,
      variables: { filename: 'http-boundary.zip', bytes },
    },
  })

  expect(response.status()).toBe(200)
  const body = (await response.json()) as {
    data?: { prepareElementImportPackageUpload?: PreparedImportPackageUpload }
    errors?: unknown[]
  }
  expect(body.errors).toBeUndefined()
  const upload = body.data?.prepareElementImportPackageUpload
  if (upload?.artifactId) trackArtifactId(upload.artifactId)
  expect(upload).toBeDefined()
  expect(upload?.artifactId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
  expect(upload?.uploadCapability).not.toBe('')
  expect(upload?.uploadURL).toContain(`/${upload?.artifactId}/upload`)

  return upload!
}

export function packageNames(suffix: string) {
  return {
    collection: `PW Package Collection ${suffix}`,
    singleChoice: `PW Package SC ${suffix}`,
    selection: `PW Package SE ${suffix}`,
  }
}

export function getElementsSearchInput(page: Page) {
  return page
    .getByTestId('elements-search-input')
    .or(page.getByRole('textbox', { name: /Search|Suchen/ }))
}

async function expectPackageElement(page: Page, elementName: string) {
  const searchInput = getElementsSearchInput(page)
  await searchInput.clear()
  await searchInput.fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await searchInput.clear()
}

export async function seedPackageElements({
  page,
  suffix,
  userId = LECTURER_ID,
  collectionDescription = `Answer collection for ${suffix}`,
}: {
  page: Page
  suffix: string
  userId?: string
  collectionDescription?: string
}) {
  const names = packageNames(suffix)

  await createAnswerCollection({
    name: names.collection,
    description: collectionDescription,
    entries: packageEntries,
    userId,
  })
  await createQuestionSC({
    name: names.singleChoice,
    content: `Single choice package content ${suffix}`,
    choices: packageChoices,
    userId,
  })
  await createQuestionSE({
    name: names.selection,
    content: `Selection package content ${suffix}`,
    numberOfInputs: 1,
    collectionName: names.collection,
    correctAnswers: [packageEntries[0]],
    userId,
  })

  await page.goto(process.env.URL_MANAGE ?? URL_MANAGE, { waitUntil: 'commit' })
  await expect(getElementsSearchInput(page)).toBeVisible({ timeout: 30_000 })
  await expectPackageElement(page, names.singleChoice)
  await expectPackageElement(page, names.selection)

  return names
}

export async function seedNumericalPackageElement({
  name,
  content,
  placeholder,
  userId,
}: {
  name: string
  content: string
  placeholder: string
  userId: string
}) {
  const prisma = await getPrisma()
  const element = await prisma.element.create({
    data: {
      type: ElementType.NUMERICAL,
      name,
      content,
      basePoints: true,
      pointsMultiplier: 2,
      options: {
        hasSampleSolution: true,
        unit: 'µm',
        accuracy: 2,
        placeholder,
        restrictions: { min: 0, max: 100 },
        solutionRanges: [{ min: 10, max: 20 }],
      },
      owner: { connect: { id: userId } },
    },
  })
  await prisma.derivedPermission.create({
    data: {
      permissionLevel: PermissionLevel.OWNER,
      element: { connect: { id: element.id } },
      user: { connect: { id: userId } },
    },
  })

  return name
}

async function selectElementForPackage(page: Page, elementName: string) {
  const searchInput = getElementsSearchInput(page)
  await searchInput.clear()
  await searchInput.fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
  await page.getByTestId(`element-checkbox-${elementName}`).click()
}

function getSharedSearchTerm(elementNames: string[]) {
  if (elementNames.length <= 1) {
    return elementNames[0]
  }

  let suffix = elementNames[0]
  for (const elementName of elementNames.slice(1)) {
    while (suffix && !elementName.endsWith(suffix)) {
      suffix = suffix.slice(1)
    }
  }

  return suffix.trim() || elementNames[0]
}

async function selectElementsForPackage(page: Page, elementNames: string[]) {
  const searchInput = getElementsSearchInput(page)
  await searchInput.clear()
  await searchInput.fill(getSharedSearchTerm(elementNames))
  await page.keyboard.press('Enter')

  for (const elementName of elementNames) {
    await expect(page.getByTestId(`element-item-${elementName}`)).toBeVisible()
    await page.getByTestId(`element-checkbox-${elementName}`).click()
  }
}

export async function expectElementSearchResultCount(
  page: Page,
  elementName: string,
  count: number
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(elementName)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`element-item-${elementName}`)).toHaveCount(
    count
  )
  await page.getByTestId('elements-search-input').clear()
}

export async function openExportPackageModal(
  page: Page,
  elementNames: string[]
) {
  if (elementNames.length === 1) {
    await selectElementForPackage(page, elementNames[0])
  } else {
    await selectElementsForPackage(page, elementNames)
  }

  await page.getByTestId('elements-download').click()
  await expect(
    page.getByTestId('download-selected-elements-package')
  ).toBeVisible()
}

export async function openElementsLibraryPage(page: Page) {
  await page.getByTestId('library').click()
  await expect(page.getByTestId('elements-search-input')).toBeVisible()
}

async function openAnswerCollectionsPage(page: Page) {
  await page.getByTestId('resources').click()
  await page.getByTestId('answer-collections').click()
  await expect(page.getByTestId('answer-collection-list')).toBeVisible()
}

export async function shareAnswerCollectionWithUser(
  page: Page,
  {
    collectionName,
    shortnameOrEmail,
    expectedPermissionKey = shortnameOrEmail,
    ownerPermissionKey = LECTURER_SHORTNAME,
    permission,
  }: {
    collectionName: string
    shortnameOrEmail: string
    expectedPermissionKey?: string
    ownerPermissionKey?: string
    permission: string
  }
) {
  await openAnswerCollectionsPage(page)
  await openActionMenuByTestId(
    page,
    `answer-collection-actions-${collectionName}`,
    'share-answer-collection'
  )
  const permissionInput = page.getByTestId('new-permission-username-or-email')
  const clickError = await clickVisibleByTestId(
    page,
    'share-answer-collection',
    2_000
  ).then(
    () => null,
    (error: unknown) => error
  )
  if (clickError && !(await permissionInput.isVisible().catch(() => false))) {
    throw clickError
  }
  await expect(permissionInput).toBeVisible()
  await shareElementWithUser(page, {
    shortnameOrEmail,
    expectedPermissionKey,
    ownerPermissionKey,
    permission,
  })
  await page.getByTestId('close-share-object').click()
}

export async function verifyReadOnlyAnswerCollectionVisible(
  page: Page,
  collectionName: string,
  entries: string[]
) {
  await openAnswerCollectionsPage(page)
  await expect(
    page.getByTestId(`answer-collection-${collectionName}`)
  ).toBeVisible()
  await openActionMenuByTestId(
    page,
    `answer-collection-actions-${collectionName}`,
    'view-answer-collection'
  )
  await expect(page.getByTestId('view-answer-collection')).toBeVisible()
  await expect(page.getByTestId('edit-answer-collection')).not.toBeVisible()
  await page.getByTestId('view-answer-collection').click()
  await page.getByTestId('open-collection-options').click()

  for (const [index, entry] of entries.entries()) {
    await expect(
      page.getByTestId(`viewing-collection-answer-${index}`)
    ).toContainText(entry)
  }

  await page.getByTestId('close-viewing-collection-modal').click()
  await expect(
    page.getByTestId('close-viewing-collection-modal')
  ).not.toBeAttached()
}

export async function downloadElementPackage({
  page,
  testInfo,
  elementNames,
}: {
  page: Page
  testInfo: TestInfo
  elementNames: string[]
}) {
  await openExportPackageModal(page, elementNames)

  await expect(
    page.getByTestId('download-selected-elements-package')
  ).toBeEnabled()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('download-selected-elements-package').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.zip$/)

  const zipPath = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(zipPath)
  await page.getByTestId('close-element-download-modal').click()
  await expect(
    page.getByTestId('download-selected-elements-package')
  ).not.toBeAttached()

  return zipPath
}

export async function openImportPackageModal(page: Page) {
  await page.getByTestId('elements-upload').click()
  await expect(page.getByTestId('element-import-dropzone')).toBeVisible()
}

export async function uploadPackageFile(page: Page, filePath: string) {
  await page
    .getByTestId('element-import-dropzone')
    .locator('input[type="file"]')
    .setInputFiles(filePath)
}

export async function observeImportValidationBoundary(
  page: Page,
  expectedOwnerId: string
) {
  const graphqlUrl = getGraphqlApiUrl()
  let observedValidations = 0
  const observationErrors: unknown[] = []
  const handler = async (route: Route) => {
    const request = route.request()
    if (!isGraphqlOperation(request, 'ValidateElementImportPackage')) {
      await route.continue()
      return
    }

    try {
      const payload = request.postDataJSON() as {
        variables?: { artifactId?: unknown }
      }
      const artifactId = payload.variables?.artifactId
      expect(typeof artifactId).toBe('string')

      const prisma = await getPrisma()
      const artifact = await prisma.importExportPackageArtifact.findUnique({
        where: { id: artifactId as string },
        select: {
          bytes: true,
          completedAt: true,
          direction: true,
          expiresAt: true,
          ownerId: true,
          sha256: true,
          state: true,
        },
      })
      expect(artifact).toMatchObject({
        direction: 'IMPORT',
        ownerId: expectedOwnerId,
        state: 'READY',
      })
      expect(artifact?.bytes).toBeGreaterThan(0)
      expect(artifact?.completedAt).not.toBeNull()
      expect(artifact?.expiresAt.getTime()).toBeGreaterThan(Date.now())
      expect(artifact?.sha256).toMatch(/^[a-f0-9]{64}$/)

      const sessionCookie = (await page.context().cookies(graphqlUrl)).find(
        ({ name }) => name === 'next-auth.session-token'
      )
      expect(sessionCookie).toBeDefined()
      expect(decodeJwt(sessionCookie!.value).sub).toBe(expectedOwnerId)
    } catch (error) {
      observationErrors.push(error)
    } finally {
      observedValidations += 1
      await route.continue()
    }
  }

  const graphqlRoute = `${graphqlUrl}*`
  await page.route(graphqlRoute, handler)
  return async () => {
    await page.unroute(graphqlRoute, handler)
    expect(observedValidations).toBeGreaterThan(0)
    if (observationErrors.length > 0) throw observationErrors[0]
  }
}

export function observePreparePackageUploadRequests(page: Page) {
  let requests = 0

  page.on('request', (request) => {
    if (isGraphqlOperation(request, 'PrepareElementImportPackageUpload')) {
      requests++
    }
  })

  return () => requests
}

export async function importPackageFile(page: Page, filePath: string) {
  await openImportPackageModal(page)
  await uploadPackageFile(page, filePath)
  await expect(page.getByTestId('element-import-preview-panel')).toBeVisible()
  await expect(page.getByTestId('confirm-element-import')).toBeEnabled()
  await page.getByTestId('confirm-element-import').click()
  await expect(
    page.getByTestId('element-import-preview-panel')
  ).not.toBeAttached({
    timeout: 30000,
  })
}

export async function expectAnswerCollectionCount(
  page: Page,
  collectionName: string,
  count: number
) {
  await openAnswerCollectionsPage(page)
  await expect(
    page.getByTestId(`answer-collection-${collectionName}`)
  ).toHaveCount(count)
}
