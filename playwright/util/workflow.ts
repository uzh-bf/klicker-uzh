// @ts-nocheck
import { expect, type Locator, type Page } from '@playwright/test'
import * as jose from 'jose'
import { createHash } from 'node:crypto'
import {
  cleanupDatabase,
  getPrisma,
  seedActivities,
  seedDatabase,
  seedSemanticPracticeQuiz,
} from '../global-setup.js'
import { disableAnimations, setSessionCookieForUrl } from './authSession.js'
import {
  APP_SECRET,
  LECTURER_EMAIL,
  LECTURER_ID,
  LECTURER_IND_EMAIL,
  LECTURER_IND_ID,
  LECTURER_IND_SHORTNAME,
  LECTURER_INST2_EMAIL,
  LECTURER_INST2_ID,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_EMAIL,
  LECTURER_INST3_ID,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST4_EMAIL,
  LECTURER_INST4_ID,
  LECTURER_INST4_SHORTNAME,
  LECTURER_INST_EMAIL,
  LECTURER_INST_ID,
  LECTURER_INST_SHORTNAME,
  LECTURER_SHORTNAME,
  STUDENT_EMAIL,
  STUDENT_NOGROUP,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  STUDENT_USERNAME10,
  STUDENT_USERNAME11,
  STUDENT_USERNAME12,
  STUDENT_USERNAME15,
  STUDENT_USERNAME2,
  STUDENT_USERNAME3,
  STUDENT_USERNAME4,
  STUDENT_USERNAME5,
  STUDENT_USERNAME6,
  STUDENT_USERNAME7,
  STUDENT_USERNAME8,
  STUDENT_USERNAME9,
  URL_AUTH,
  URL_CONTROL,
  URL_MANAGE,
  URL_STUDENT,
  URL_STUDENT_LOGIN,
  USER_ID_TEST,
} from './constants.js'
import {
  createGroupActivity as createGroupActivityBase,
  createLiveQuiz as createLiveQuizBase,
  createMicroLearning as createMicroLearningBase,
  createPracticeQuiz as createPracticeQuizBase,
  createStacks as createStacksBase,
  dragAndDropElement as dragAndDropElementBase,
  selectOption,
  setDatetime as setDatetimeBase,
} from './fixtures/activities.js'
import {
  createAnswerCollection as createAnswerCollectionBase,
  createQuestionKPRIM as createQuestionKPRIMBase,
  createQuestionMC as createQuestionMCBase,
  createQuestionSC as createQuestionSCBase,
  createQuestionSE as createQuestionSEBase,
  deleteElement as deleteElementBase,
  searchAndEdit,
  validateElement as validateElementBase,
} from './fixtures/elements.js'

export { selectOption }

const envDefaults: Record<string, string> = {
  APP_SECRET,
  LECTURER_EMAIL,
  LECTURER_ID,
  LECTURER_IND_EMAIL,
  LECTURER_IND_ID,
  LECTURER_IND_SHORTNAME,
  LECTURER_INST_EMAIL,
  LECTURER_INST_ID,
  LECTURER_INST_SHORTNAME,
  LECTURER_INST2_EMAIL,
  LECTURER_INST2_ID,
  LECTURER_INST2_SHORTNAME,
  LECTURER_INST3_EMAIL,
  LECTURER_INST3_ID,
  LECTURER_INST3_SHORTNAME,
  LECTURER_INST4_EMAIL,
  LECTURER_INST4_ID,
  LECTURER_INST4_SHORTNAME,
  LECTURER_SHORTNAME,
  STUDENT_EMAIL,
  STUDENT_NOGROUP,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  STUDENT_USERNAME2,
  STUDENT_USERNAME3,
  STUDENT_USERNAME4,
  STUDENT_USERNAME5,
  STUDENT_USERNAME6,
  STUDENT_USERNAME7,
  STUDENT_USERNAME8,
  STUDENT_USERNAME9,
  STUDENT_USERNAME10,
  STUDENT_USERNAME11,
  STUDENT_USERNAME12,
  STUDENT_USERNAME15,
  URL_AUTH,
  URL_CONTROL,
  URL_MANAGE,
  URL_STUDENT,
  URL_STUDENT_LOGIN,
}

export function env(key: string) {
  return process.env[key] ?? envDefaults[key]
}

export async function typeInto(locator: Locator, text: string) {
  const parts = String(text)
    .split(/(\{[^}]+\})/g)
    .filter(Boolean)
  for (const part of parts) {
    const key = part.match(/^\{([^}]+)\}$/)?.[1]?.toLowerCase()
    if (!key) {
      await locator.pressSequentially(part)
    } else if (key === 'enter') {
      await locator.press('Enter')
    } else if (key === 'esc' || key === 'escape') {
      await locator.press('Escape')
    } else if (key === 'leftarrow') {
      await locator.press('ArrowLeft')
    } else if (key === 'rightarrow') {
      await locator.press('ArrowRight')
    } else if (key === 'uparrow') {
      await locator.press('ArrowUp')
    } else if (key === 'downarrow') {
      await locator.press('ArrowDown')
    } else if (key === 'backspace') {
      await locator.press('Backspace')
    }
  }
}

function booleanAttribute(attribute: string) {
  return [
    'checked',
    'disabled',
    'multiple',
    'readonly',
    'required',
    'selected',
  ].includes(attribute)
}

export async function expectAttribute(
  locator: Locator,
  attribute: string,
  value: string
) {
  if (booleanAttribute(attribute) && attribute === value) {
    await expect(locator).toHaveAttribute(attribute, /.*/)
  } else {
    await expect(locator).toHaveAttribute(attribute, value)
  }
}

export async function expectNoAttribute(
  locator: Locator,
  attribute: string,
  value: string
) {
  if (booleanAttribute(attribute) && attribute === value) {
    await expect(locator).not.toHaveAttribute(attribute, /.*/)
  } else {
    await expect(locator).not.toHaveAttribute(attribute, value)
  }
}

export async function expectByAssertion(
  locator: Locator,
  assertion: string,
  ...args: unknown[]
) {
  if (assertion === 'exist') await expect(locator.first()).toBeAttached()
  else if (assertion === 'not.exist') await expect(locator).not.toBeAttached()
  else if (assertion === 'be.visible') await expect(locator).toBeVisible()
  else if (assertion === 'not.be.visible')
    await expect(locator).not.toBeVisible()
  else if (assertion === 'be.disabled') await expect(locator).toBeDisabled()
  else if (assertion === 'not.be.disabled')
    await expect(locator).not.toBeDisabled()
  else if (assertion === 'be.enabled') await expect(locator).toBeEnabled()
  else if (assertion === 'not.be.enabled')
    await expect(locator).not.toBeEnabled()
  else if (assertion === 'have.value')
    await expect(locator).toHaveValue(String(args[0] ?? ''))
  else if (assertion === 'contain' || assertion === 'contains')
    await expect(locator).toContainText(String(args[0] ?? ''))
  else if (assertion === 'not.contain')
    await expect(locator).not.toContainText(String(args[0] ?? ''))
  else if (assertion === 'have.css')
    await expect(locator).toHaveCSS(String(args[0]), String(args[1] ?? ''))
  else if (assertion === 'have.attr') {
    if (args.length === 1)
      await expect(locator).toHaveAttribute(String(args[0]))
    else await expectAttribute(locator, String(args[0]), String(args[1] ?? ''))
  } else if (assertion === 'not.have.attr') {
    if (args.length === 1)
      await expect(locator).not.toHaveAttribute(String(args[0]))
    else
      await expectNoAttribute(locator, String(args[0]), String(args[1] ?? ''))
  } else if (assertion === 'have.length') {
    await expect(locator).toHaveCount(Number(args[0]))
  } else if (assertion === 'have.class') {
    await expect(locator).toHaveClass(new RegExp(String(args[0])))
  } else {
    throw new Error(`Unsupported Cypress assertion: ${assertion}`)
  }
}

async function loginWithToken(
  page: Page,
  tokenData: jose.JWTPayload,
  targetUrl = env('URL_MANAGE'),
  cookieName = 'next-auth.session-token'
) {
  const context = page.context()
  await context.clearCookies()
  await setSessionCookieForUrl({
    context,
    cookieName,
    targetUrl,
    tokenData,
  })
  await page.goto(targetUrl, { waitUntil: 'commit', timeout: 300_000 })
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('hideLecturerSurvey', 'true')
    } catch {}
  })
  await disableAnimations(page)
}

export async function gotoCommit(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 300_000 })
  } catch (error) {
    if (!String(error).includes('ERR_ABORTED')) throw error
    await page.waitForTimeout(500)
    await page.goto(url, { waitUntil: 'commit', timeout: 300_000 })
  }
}

export async function loginLecturer(page: Page) {
  await loginWithToken(page, {
    email: LECTURER_EMAIL,
    sub: USER_ID_TEST,
    role: 'ADMIN',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: true,
  })
}

export async function loginLecturerControl(page: Page) {
  await loginWithToken(
    page,
    {
      email: LECTURER_EMAIL,
      sub: USER_ID_TEST,
      role: 'ADMIN',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: true,
      catalystIndividual: true,
    },
    env('URL_CONTROL')
  )
}

export async function loginFreeUser(page: Page) {
  await loginWithToken(page, {
    email: 'free@df.uzh.ch',
    sub: '76047345-3801-4628-ae7b-adbebcfe8822',
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: false,
    catalystIndividual: false,
  })
}

export async function loginIndividualCatalyst(page: Page) {
  await loginWithToken(page, {
    email: LECTURER_IND_EMAIL,
    sub: LECTURER_IND_ID,
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: false,
    catalystIndividual: true,
  })
}

export async function loginInstitutionalCatalyst(page: Page) {
  await loginWithToken(page, {
    email: LECTURER_INST_EMAIL,
    sub: LECTURER_INST_ID,
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
}

export async function loginInstitutionalCatalyst2(page: Page) {
  await loginWithToken(page, {
    email: LECTURER_INST2_EMAIL,
    sub: LECTURER_INST2_ID,
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
}

export async function loginInstitutionalCatalyst3(page: Page) {
  await loginWithToken(page, {
    email: LECTURER_INST3_EMAIL,
    sub: LECTURER_INST3_ID,
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
}

export async function loginInstitutionalCatalyst4(page: Page) {
  await loginWithToken(page, {
    email: LECTURER_INST4_EMAIL,
    sub: LECTURER_INST4_ID,
    role: 'USER',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: false,
  })
}

export async function loginStudent(page: Page) {
  await loginStudentPassword(page, { username: env('STUDENT_USERNAME') })
}

export async function loginStudentPassword(
  page: Page,
  { username }: { username: string }
) {
  await page.context().clearCookies()
  await page.goto('about:blank').catch(() => undefined)
  await gotoCommit(page, env('URL_STUDENT_LOGIN'))
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
  })
  await disableAnimations(page)
  await page.getByTestId('username-field').fill(username)
  await page.getByTestId('password-field').fill(env('STUDENT_PASSWORD'))
  await page.getByTestId('submit-login').click()
  await expect(page.getByTestId('homepage')).toBeVisible()
}

export async function acceptGamifiedLiveQuizAccountPrompt(
  page: Page,
  _activityDisplayName?: string
) {
  const dialog = page.getByRole('dialog', {
    name: /this live quiz is gamified/i,
  })
  const submitAnswer = page.getByTestId('student-submit-answer')

  for (let attempt = 0; attempt < 3; attempt++) {
    const promptAppeared = await dialog
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!promptAppeared) return

    await page.getByTestId('participate-anonymously').click()
    await expect(dialog).toBeHidden()
    await page.waitForTimeout(500)
  }

  await expect(dialog).toBeHidden()
  await expect(submitAnswer).toBeVisible({ timeout: 30000 })
}

export async function openStudentLiveQuiz(
  page: Page,
  activityDisplayName: string
) {
  const escapedName = activityDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const liveQuizLink = page
    .getByRole('link', { name: new RegExp(escapedName) })
    .first()

  await expect(liveQuizLink).toBeVisible({ timeout: 30000 })
  await Promise.all([
    page.waitForURL(/\/session\/[^/]+/, { timeout: 30000 }),
    liveQuizLink.click(),
  ])
}

export type LocalForageSnapshot = {
  storeName: string
  entries: [IDBValidKey, unknown][]
}[]

export async function snapshotLocalForage(
  page: Page
): Promise<LocalForageSnapshot> {
  return page.evaluate(async () => {
    function requestToPromise<T>(request: IDBRequest<T>) {
      return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }

    const db = await requestToPromise(indexedDB.open('localforage'))
    const snapshot: { storeName: string; entries: [IDBValidKey, unknown][] }[] =
      []

    for (const storeName of Array.from(db.objectStoreNames)) {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const [keys, values] = await Promise.all([
        requestToPromise(store.getAllKeys()),
        requestToPromise(store.getAll()),
      ])

      snapshot.push({
        storeName,
        entries: keys.map((key, index) => [key, values[index]]),
      })
    }

    db.close()
    return snapshot
  })
}

export async function restoreLocalForage(
  page: Page,
  snapshot: LocalForageSnapshot
) {
  await page.evaluate(async (snapshot) => {
    function requestToPromise<T>(request: IDBRequest<T>) {
      return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }

    function transactionDone(transaction: IDBTransaction) {
      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    }

    let db = await requestToPromise(indexedDB.open('localforage'))
    const missingStoreNames = snapshot
      .map((storeSnapshot) => storeSnapshot.storeName)
      .filter((storeName) => !db.objectStoreNames.contains(storeName))

    if (missingStoreNames.length > 0) {
      const nextVersion = db.version + 1
      db.close()

      db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('localforage', nextVersion)
        request.onupgradeneeded = () => {
          const upgradeDb = request.result
          for (const storeName of missingStoreNames) {
            if (!upgradeDb.objectStoreNames.contains(storeName)) {
              upgradeDb.createObjectStore(storeName)
            }
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }

    for (const storeSnapshot of snapshot) {
      if (!db.objectStoreNames.contains(storeSnapshot.storeName)) continue

      const transaction = db.transaction(storeSnapshot.storeName, 'readwrite')
      const store = transaction.objectStore(storeSnapshot.storeName)
      await requestToPromise(store.clear())

      for (const [key, value] of storeSnapshot.entries) {
        await requestToPromise(store.put(value, key))
      }

      await transactionDone(transaction)
    }

    db.close()
  }, snapshot)
}

export async function logoutUser(page: Page) {
  await page.context().clearCookies()
}

async function reloadAndValidate(page: Page, elementName?: string) {
  if (elementName) {
    await page.goto(env('URL_MANAGE'), { waitUntil: 'domcontentloaded' })
    const searchInput = page.getByTestId('elements-search-input')
    if (!(await searchInput.isVisible().catch(() => false))) {
      const libraryNav = page.getByTestId('library')
      if (await libraryNav.isVisible().catch(() => false)) {
        await libraryNav.click()
      }
    }
    await expect(searchInput).toBeVisible()
    await validateElementBase(page, elementName)
  }
}

export async function validateElement(
  page: Page,
  {
    element,
    shouldExist = true,
    contains = [],
  }: { element: string; shouldExist?: boolean; contains?: string[] }
) {
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(element)
  await page.keyboard.press('Enter')
  if (shouldExist) {
    const row = page.getByTestId(`element-item-${element}`).first()
    await expect(row).toBeAttached()
    for (const text of contains) await expect(row).toContainText(text)
  } else {
    const row = page.getByTestId(`element-item-${element}`)
    await expect(row).not.toBeAttached()
  }
  await page.getByTestId('elements-search-input').clear()
}

export async function editElement(
  page: Page,
  { element }: { element: string }
) {
  await searchAndEdit(page, element)
}

export async function deleteElement(
  page: Page,
  { elementName }: { elementName: string }
) {
  await deleteElementBase(page, elementName)
}

export async function deleteAllElements(page: Page) {
  const prisma = await getPrisma()
  await prisma.element.deleteMany({})
  await page.reload({ waitUntil: 'commit' })
}

export async function createAnswerCollection(page: Page, args: any) {
  await createAnswerCollectionBase(args)
  await gotoCommit(page, `${env('URL_MANAGE')}/resources/answerCollections`)
  await expect(page.getByTestId('create-answer-collection')).toBeVisible({
    timeout: 30000,
  })
  await expect(
    page.getByTestId(`answer-collection-${args.name}`).first()
  ).toBeVisible({ timeout: 30000 })
}

export async function deleteAnswerCollection(
  page: Page,
  { collectionName }: { collectionName: string }
) {
  await page.getByTestId(`answer-collection-actions-${collectionName}`).click()
  await page.getByTestId('delete-answer-collection').click()
  await page.getByTestId('confirm-delete-answer-collection').click()
  await expect(
    page.getByTestId(`answer-collection-${collectionName}`)
  ).not.toBeAttached()
}

export async function createQuestionSC(page: Page, args: any) {
  await createQuestionSCBase(args)
  await reloadAndValidate(page, args.name)
}

export async function createQuestionMC(page: Page, args: any) {
  await createQuestionMCBase(args)
  await reloadAndValidate(page, args.name)
}

export async function createQuestionKPRIM(page: Page, args: any) {
  await createQuestionKPRIMBase(args)
  await reloadAndValidate(page, args.name)
}

async function createElementWithPermission(args: any, data: any) {
  const prisma = await getPrisma()
  const { PermissionLevel: PL } = await import('@klicker-uzh/prisma/client')
  const element = await prisma.element.create({ data })
  await prisma.derivedPermission.upsert({
    where: { elementId_userId: { elementId: element.id, userId: args.userId } },
    create: {
      permissionLevel: PL.OWNER,
      element: { connect: { id: element.id } },
      user: { connect: { id: args.userId } },
    },
    update: { permissionLevel: PL.OWNER },
  })
  return element
}

export async function createQuestionNR(page: Page, args: any) {
  const { ElementType } = await import('@klicker-uzh/prisma/client')
  await createElementWithPermission(args, {
    type: ElementType.NUMERICAL,
    name: args.name,
    content: args.content,
    explanation: args.explanation ?? undefined,
    basePoints: true,
    pointsMultiplier: args.multiplier,
    isArchived: args.isArchived ?? false,
    options: {
      hasSampleSolution: !!args.solutionRanges?.length,
      unit: args.unit,
      accuracy: args.accuracy ? Number.parseFloat(args.accuracy) : undefined,
      restrictions:
        args.min !== undefined || args.max !== undefined
          ? {
              min: args.min ? Number.parseFloat(args.min) : null,
              max: args.max ? Number.parseFloat(args.max) : null,
            }
          : undefined,
      solutionRanges: args.solutionRanges?.map((range: any) => ({
        min: Number.parseFloat(range.min),
        max: Number.parseFloat(range.max),
      })),
      exactSolutions: args.exactSolutions?.map((value: string) =>
        Number.parseFloat(value)
      ),
    },
    owner: { connect: { id: args.userId } },
  })
  await reloadAndValidate(page, args.name)
}

export async function createQuestionFT(page: Page, args: any) {
  const { ElementType } = await import('@klicker-uzh/prisma/client')
  await createElementWithPermission(args, {
    type: ElementType.FREE_TEXT,
    name: args.name,
    content: args.content,
    explanation: args.explanation ?? undefined,
    basePoints: true,
    pointsMultiplier: args.multiplier,
    isArchived: args.isArchived ?? false,
    options: {
      hasSampleSolution: !!args.solutions?.length,
      restrictions: {
        maxLength: args.maxLength ? Number.parseInt(args.maxLength) : undefined,
      },
      solutions: args.solutions,
    },
    owner: { connect: { id: args.userId } },
  })
  await reloadAndValidate(page, args.name)
}

export async function createFlashcard(page: Page, args: any) {
  const { ElementType } = await import('@klicker-uzh/prisma/client')
  await createElementWithPermission(args, {
    type: ElementType.FLASHCARD,
    name: args.name,
    content: args.content,
    explanation: args.explanation,
    options: {},
    isArchived: args.isArchived ?? false,
    owner: { connect: { id: args.userId } },
  })
  await reloadAndValidate(page, args.name)
}

export async function createContent(page: Page, args: any) {
  const { ElementType } = await import('@klicker-uzh/prisma/client')
  await createElementWithPermission(args, {
    type: ElementType.CONTENT,
    name: args.name,
    content: args.content,
    options: {},
    isArchived: args.isArchived ?? false,
    owner: { connect: { id: args.userId } },
  })
  await reloadAndValidate(page, args.name)
}

export async function createQuestionSE(page: Page, args: any) {
  await createQuestionSEBase(args)
  await reloadAndValidate(page, args.name)
}

export async function createQuestionCS(page: Page, args: any) {
  const prisma = await getPrisma()
  const { ElementType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )
  const collection = await prisma.answerCollection.findFirst({
    where: {
      name: args.collectionName,
      isDeleted: false,
      permissions: { some: { userId: args.userId } },
    },
  })
  if (!collection)
    throw new Error(`Answer collection ${args.collectionName} not found`)
  const entries = await prisma.answerCollectionEntry.findMany({
    where: { collectionId: collection.id, value: { in: args.selectedItems } },
  })
  const element = await prisma.element.create({
    data: {
      type: ElementType.CASE_STUDY,
      name: args.name,
      content: args.content,
      explanation: args.explanation,
      pointsMultiplier: args.multiplier,
      isArchived: args.isArchived ?? false,
      options: {
        hasSampleSolution: !!args.solutions,
        criteria: args.criteria.map((criterion: any, ix: number) => ({
          id: criterion.id,
          name: criterion.name,
          order: ix,
          min: criterion.mode === 'steps' ? 1 : criterion.min,
          max: criterion.mode === 'steps' ? criterion.steps : criterion.max,
          step: criterion.mode === 'steps' ? 1 : criterion.step,
          unit: criterion.unit,
          labels: criterion.mode === 'steps' ? criterion.labels : undefined,
        })),
        cases: args.cases.map((caseItem: any, caseIx: number) => ({
          id: caseItem.id,
          order: caseIx,
          title: caseItem.title,
          description: caseItem.description,
          solutions: args.solutions?.[caseIx]
            ? Object.entries(args.solutions[caseIx]).map(
                ([itemIx, itemSolutions]: [string, any]) => ({
                  itemId: entries[Number(itemIx)].id,
                  criteriaSolutions: Object.entries(itemSolutions).map(
                    ([criterionIx, solution]: [string, any]) => ({
                      criterionId: args.criteria[Number(criterionIx)].id,
                      min: solution.lower,
                      max: solution.upper,
                    })
                  ),
                })
              )
            : undefined,
        })),
      },
      answerCollection: { connect: { id: collection.id } },
      answerCollectionItems: {
        connect: entries.map((entry) => ({ id: entry.id })),
      },
      owner: { connect: { id: args.userId } },
    },
  })
  await prisma.derivedPermission.upsert({
    where: { elementId_userId: { elementId: element.id, userId: args.userId } },
    create: {
      permissionLevel: PL.OWNER,
      element: { connect: { id: element.id } },
      user: { connect: { id: args.userId } },
    },
    update: { permissionLevel: PL.OWNER },
  })
  await reloadAndValidate(page, args.name)
}

export async function dragAndDropElement(page: Page, args: any) {
  await dragAndDropElementBase(page, args.element, args.target)
}

export async function createStacks(page: Page, args: any) {
  await createStacksBase(page, args)
}

export async function setDatetime(page: Page, args: any) {
  await setDatetimeBase(page, args)
}

export async function setDate(page: Page, args: any) {
  await page.getByTestId(args.cyString).click()
  const match = args.date.validation.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  const targetDataDay = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1])
  ).toLocaleDateString()
  const direction =
    args.date.monthDelta > 0
      ? `${args.cyString}-next-month`
      : `${args.cyString}-previous-month`
  for (let i = 0; i < Math.abs(args.date.monthDelta); i++) {
    await page.getByTestId(direction).locator('..').click()
  }
  await page
    .getByTestId(`${args.cyString}-calendar`)
    .locator(`[data-day="${targetDataDay}"]`)
    .click()
  await page.getByTestId(args.deselectorString).click()
  await expect(page.getByTestId(args.cyString)).toContainText(
    args.date.validation
  )
}

export async function createLiveQuiz(page: Page, args: any) {
  await createLiveQuizBase(page, args)
}

export async function getLiveQuizTemplateId(name: string) {
  const prisma = await getPrisma()
  const activity = await prisma.userActivities.findFirst({
    where: { name, type: 'LIVE_QUIZ' },
    select: { templateId: true },
  })

  if (!activity?.templateId) {
    throw new Error(`No template id found for live quiz template "${name}"`)
  }

  return activity.templateId
}

export async function getCatalogCollectionId(name: string) {
  const prisma = await getPrisma()
  const collection = await prisma.catalogCollection.findFirst({
    where: { name },
    select: { id: true },
  })

  if (!collection?.id) {
    throw new Error(`Could not find catalog collection with name "${name}"`)
  }

  return collection.id
}

export async function createPracticeQuiz(page: Page, args: any) {
  await createPracticeQuizBase(page, args)
}

export async function createMicroLearning(page: Page, args: any) {
  await createMicroLearningBase(page, args)
}

export async function createGroupActivity(page: Page, args: any) {
  await createGroupActivityBase(page, args)
}

export async function createCourse(page: Page, args: any) {
  const prisma = await getPrisma()
  const { CourseAuthType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )
  const course = await prisma.course.create({
    data: {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      notificationEmail: args.notificationEmail,
      isAssessmentEnabled: args.isAssessmentEnabled ?? false,
      isGamificationEnabled: args.isGamificationEnabled ?? true,
      color: args.color,
      pinCode:
        args.isAssessmentEnabled === false
          ? Math.floor(100000000 + Math.random() * 900000000)
          : null,
      startDate: args.startDate,
      endDate: args.endDate,
      isGroupCreationEnabled: args.isGroupCreationEnabled ?? true,
      groupDeadlineDate: args.groupDeadlineDate ?? args.endDate,
      maxGroupSize: args.maxGroupSize ?? 4,
      preferredGroupSize: args.preferredGroupSize ?? 2,
      authType:
        args.isAssessmentEnabled === false
          ? CourseAuthType.PIN
          : CourseAuthType.SSO,
      owner: { connect: { id: USER_ID_TEST } },
    },
  })
  await prisma.derivedPermission.upsert({
    where: { courseId_userId: { courseId: course.id, userId: USER_ID_TEST } },
    create: {
      permissionLevel: PL.OWNER,
      course: { connect: { id: course.id } },
      user: { connect: { id: USER_ID_TEST } },
    },
    update: { permissionLevel: PL.OWNER },
  })
  for (const username of args.participants ?? []) {
    const participant = await prisma.participant.findUnique({
      where: { username },
    })
    if (participant) {
      await prisma.participation.create({
        data: {
          participant: { connect: { id: participant.id } },
          course: { connect: { id: course.id } },
        },
      })
    }
  }
  await page.reload({ waitUntil: 'commit' })
}

export async function shareObject(
  page: Page,
  {
    usernameOrEmail,
    permissionLevel,
  }: { usernameOrEmail: string; permissionLevel: string }
) {
  await page
    .getByTestId('new-permission-username-or-email')
    .fill(usernameOrEmail)
  await selectOption(
    page,
    '[data-cy="new-permission-access-level"]',
    permissionLevel
  )
  await page.getByTestId('new-permission-submit').click()
  await expect(page.getByTestId(`permission-${usernameOrEmail}`)).toContainText(
    permissionLevel
  )
}

export async function addObjectToCatalog(page: Page, args: any) {
  await page.getByTestId('add-object-to-catalog-button').click()
  await page.getByTestId('object-type-selection').click()
  await page.getByTestId(`object-type-${args.objectType}`).click()
  await page.getByTestId('modal-object-access').click()
  await page.getByTestId(`object-access-${args.permissionLevel}`).click()
  await page.locator('#object-selection-catalog-addition').click()
  await page.getByText(args.objectName, { exact: true }).click()
  await page.getByTestId('submit-add-object-button').click()
  await expect(
    page.getByTestId(`catalog-object-${args.objectName}`)
  ).toBeAttached()
}

export async function convertLiveQuizToTemplate(page: Page, args: any) {
  await page.getByTestId(`actions-LIVE_QUIZ-${args.liveQuiz}`).click()
  await page.getByTestId(`template-from-live-quiz-${args.liveQuiz}`).click()
  await page
    .getByTestId(
      args.copyBeforeConversion
        ? 'copy-option-template'
        : 'convert-option-template'
    )
    .click()
  if (!args.copyBeforeConversion) {
    await page.getByTestId('confirm-activity-unavailability').click()
  }
  for (const id of [
    'confirm-content-visibility',
    'confirm-question-access',
    args.resourceAccessRequired ? 'confirm-resource-access' : undefined,
  ].filter(Boolean)) {
    await page.getByTestId(id).click()
  }
  await page.getByTestId('template-next-step').click()
  await page.getByTestId('template-name').fill(args.name)
  await typeInto(page.getByTestId('template-description'), args.description)
  await typeInto(page.getByTestId('template-instructions'), args.instructions)
  await page.getByTestId('submit-template-creation').click()
}

function slidedValue({ criterion, answer }: any) {
  const mid = criterion.min + (criterion.max - criterion.min) / 2
  const signedSteps = (answer.click === '{leftarrow}' ? -1 : 1) * answer.steps
  return Math.max(
    Math.min(mid + signedSteps * criterion.step, criterion.max),
    criterion.min
  )
}

export async function answerCaseStudy(page: Page, args: any) {
  await args.initialValidation?.()

  for (const [caseIx, caseAnswer] of Object.entries(args.answers)) {
    for (const [itemIx, itemAnswer] of Object.entries(caseAnswer as any)) {
      for (const [criterionIx, answer] of Object.entries(itemAnswer as any)) {
        const slider = page.getByTestId(
          `cs-slider-${args.elementIx}-${Number(caseIx)}-${Number(itemIx)}-${Number(criterionIx)}`
        )
        await slider.click()
        await typeInto(slider, answer.click.repeat(answer.steps))
        const criterion = args.criteria[Number(criterionIx)]
        const value = slidedValue({ criterion, answer })
        await expect(
          page.getByTestId(
            `cs-slider-nr-value-${args.elementIx}-${Number(caseIx)}-${Number(itemIx)}-${Number(criterionIx)}`
          )
        ).toContainText(
          criterion.unit ? `${value} ${criterion.unit}` : String(value)
        )
      }
    }
    if (args.sequentialUI && Number(caseIx) !== (args.cases?.length ?? 1) - 1) {
      await page.getByTestId('switch-next-case').click()
    }
  }
}

export async function verifyCaseStudyInputs(page: Page, args: any) {
  for (const [caseIx, caseAnswer] of Object.entries(args.answers)) {
    for (const [itemIx, itemAnswer] of Object.entries(caseAnswer as any)) {
      for (const [criterionIx, answer] of Object.entries(itemAnswer as any)) {
        if (args.verifyValues ?? true) {
          const criterion = args.criteria[Number(criterionIx)]
          const value = slidedValue({ criterion, answer })
          await expect(
            page.getByTestId(
              `cs-slider-nr-value-${args.elementIx}-${caseIx}-${itemIx}-${criterionIx}`
            )
          ).toContainText(
            criterion.unit ? `${value} ${criterion.unit}` : String(value)
          )
        }
        if (args.verifyDisabled) {
          await expect(
            page.getByTestId(
              `cs-slider-${args.elementIx}-${caseIx}-${itemIx}-${criterionIx}`
            )
          ).toHaveAttribute('data-disabled', /.*/)
        }
      }
    }
  }
}

export async function assertActivityPoints(page: Page, args: any) {
  await expect(page.getByTestId('base-points-activity')).toContainText(
    `${args.basePoints} P.`
  )
  await expect(page.getByTestId('correctness-points-activity')).toContainText(
    `${args.correctnessPoints} P.`
  )
  await expect(page.getByTestId('bonus-points-activity')).toContainText(
    `${args.bonusPoints} P.`
  )
  await expect(page.getByTestId('total-points-activity')).toContainText(
    `${args.totalPoints} P.`
  )
}

export async function assertInstancePoints(page: Page, args: any) {
  await expect(
    page.getByTestId(
      `base-points-stack-${args.stackIx}-instance-${args.instanceIx}`
    )
  ).toContainText(`${args.basePoints} P.`)
  await expect(
    page.getByTestId(
      `correctness-points-stack-${args.stackIx}-instance-${args.instanceIx}`
    )
  ).toContainText(`${args.correctnessPoints} P.`)
  await expect(
    page.getByTestId(
      `bonus-points-stack-${args.stackIx}-instance-${args.instanceIx}`
    )
  ).toContainText(`${args.bonusPoints} P.`)
  await expect(
    page.getByTestId(
      `total-points-stack-${args.stackIx}-instance-${args.instanceIx}`
    )
  ).toContainText(`${args.totalPoints} P.`)
}

export async function assertNoActivityPoints(page: Page) {
  for (const id of [
    'base-points-activity',
    'correctness-points-activity',
    'bonus-points-activity',
    'total-points-activity',
  ]) {
    await expect(page.getByTestId(id)).not.toBeAttached()
  }
}

export async function assertNoInstancePoints(page: Page, args: any) {
  for (const kind of ['base', 'correctness', 'bonus', 'total']) {
    await expect(
      page.getByTestId(
        `${kind}-points-stack-${args.stackIx}-instance-${args.instanceIx}`
      )
    ).not.toBeAttached()
  }
}

export async function assertAsynchronousActivityPoints(page: Page, args: any) {
  await expect(page.getByTestId('total-points-activity')).toContainText(
    `${args.totalPoints} P.`
  )
}

export async function assertAsynchronousInstancePoints(page: Page, args: any) {
  await expect(
    page.getByTestId(
      `total-points-stack-${args.stackIx}-instance-${args.instanceIx}`
    )
  ).toContainText(`${args.totalPoints} P.`)
}

export async function runTask(name: string, args: any = {}) {
  const prisma = await getPrisma()
  if (name === 'cleanupDatabase') return cleanupDatabase()
  if (name === 'seedDatabase') return seedDatabase()
  if (name === 'seedActivities') return seedActivities()
  if (name === 'seedSemanticPracticeQuiz') {
    return seedSemanticPracticeQuiz(args)
  }
  if (name === 'removeSoftDeletedPracticeQuiz') {
    return (
      (
        await prisma.practiceQuiz.deleteMany({
          where: { name: args.quizName, isDeleted: true },
        })
      ).count > 0
    )
  }
  if (name === 'removeSoftDeletedMicrolearning') {
    return (
      (
        await prisma.microLearning.deleteMany({
          where: { name: args.mlName, isDeleted: true },
        })
      ).count > 0
    )
  }
  if (name === 'removeSoftDeletedLiveQuiz') {
    return (
      (
        await prisma.liveQuiz.deleteMany({
          where: { name: args.lqName, isDeleted: true },
        })
      ).count > 0
    )
  }
  if (name === 'removeSoftDeletedGroupActivity') {
    return (
      (
        await prisma.groupActivity.deleteMany({
          where: { name: args.gaName, isDeleted: true },
        })
      ).count > 0
    )
  }
  if (name === 'getPracticeQuizInfo') {
    const quiz = await prisma.practiceQuiz.findFirst({
      where: { name: args.quizName },
    })
    return quiz ? { id: quiz.id, courseId: quiz.courseId } : null
  }
  if (name === 'getMicroLearningInfo') {
    const ml = await prisma.microLearning.findFirst({
      where: { name: args.mlName },
    })
    return ml ? { id: ml.id, courseId: ml.courseId } : null
  }
  if (name === 'getLiveQuizPin') {
    return (
      await prisma.liveQuiz.findFirstOrThrow({
        where: { name: args.name, isDeleted: false },
      })
    ).pinCode
  }
  if (name === 'verifyLiveQuizPin') {
    return (
      (
        await prisma.liveQuiz.findFirstOrThrow({
          where: { name: args.name, isDeleted: false },
        })
      ).pinCode === args.pin
    )
  }
  if (name === 'deleteLiveQuiz') {
    const liveQuiz = await prisma.liveQuiz.findFirstOrThrow({
      where: { name: args.name, isDeleted: false },
    })
    await prisma.liveQuiz.delete({ where: { id: liveQuiz.id } })
    return true
  }
  if (name === 'changeActivityStatus') {
    const table =
      args.activityType === 'LIVE_QUIZ'
        ? prisma.liveQuiz
        : args.activityType === 'PRACTICE_QUIZ'
          ? prisma.practiceQuiz
          : args.activityType === 'MICRO_LEARNING'
            ? prisma.microLearning
            : prisma.groupActivity
    const activity = await table.findFirstOrThrow({
      where: { name: args.activityName, isDeleted: false },
    })
    await table.update({
      where: { id: activity.id },
      data: { status: args.status },
    })
    return true
  }
  if (name === 'seedWordCloudLiveQuizResponses') {
    const { ElementBlockStatus, ElementType } = await import(
      '@klicker-uzh/prisma/client'
    )
    const liveQuiz = await prisma.liveQuiz.findFirstOrThrow({
      where: { name: args.quizName, isDeleted: false },
      include: {
        blocks: {
          include: { elements: true },
          orderBy: { order: 'asc' },
        },
      },
    })
    const block = liveQuiz.blocks[0]

    if (!block) {
      throw new Error(`Live quiz ${args.quizName} has no blocks`)
    }

    const instances = liveQuiz.blocks.flatMap((block) => block.elements)
    const getInstance = (
      title: string,
      type: (typeof ElementType)[keyof typeof ElementType]
    ) => {
      const instance = instances.find(
        (element) =>
          element.elementType === type &&
          typeof element.elementData === 'object' &&
          element.elementData !== null &&
          'name' in element.elementData &&
          element.elementData.name === title
      )

      if (!instance) {
        throw new Error(
          `Instance ${title} (${type}) not found in live quiz ${args.quizName}`
        )
      }

      return instance
    }
    const openResults = (value: string, normalize: boolean) => {
      const normalizedValue = normalize
        ? value.trim().toLowerCase()
        : String(parseFloat(value))
      const hash = createHash('md5').update(normalizedValue).digest('hex')

      return {
        responses: {
          [hash]: {
            value: normalizedValue,
            count: 1,
          },
        },
        total: 1,
      }
    }

    await prisma.$transaction([
      prisma.elementInstance.update({
        where: {
          id: getInstance(args.numericalTitle, ElementType.NUMERICAL).id,
        },
        data: {
          anonymousResults: openResults(args.numericalAnswer, false),
        },
      }),
      prisma.elementInstance.update({
        where: {
          id: getInstance(args.freeTextTitle, ElementType.FREE_TEXT).id,
        },
        data: {
          anonymousResults: openResults(args.freeTextAnswer, true),
        },
      }),
      prisma.elementInstance.update({
        where: {
          id: getInstance(args.secondFreeTextTitle, ElementType.FREE_TEXT).id,
        },
        data: {
          anonymousResults: openResults(args.secondFreeTextAnswer, true),
        },
      }),
      prisma.elementBlock.update({
        where: { id: block.id },
        data: {
          closedAt: new Date(),
          status: ElementBlockStatus.EXECUTED,
        },
      }),
      prisma.liveQuiz.update({
        where: { id: liveQuiz.id },
        data: { activeBlockId: null },
      }),
    ])

    return true
  }
  if (name === 'updateLecturerPreviewFlags') {
    await prisma.user.update({
      where: { shortname: 'lecturer' },
      data: {
        publicPreview: args.publicPreview,
        privatePreview: args.privatePreview,
      },
    })
    return true
  }
  if (name === 'getCoursePin') {
    return (
      await prisma.course.findFirstOrThrow({ where: { name: args.courseName } })
    ).pinCode
  }
  throw new Error(`Unsupported Playwright workflow task: ${name}`)
}
