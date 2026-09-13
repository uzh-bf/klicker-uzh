import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import {
  assertProductionExecution,
  deleteSyntheticParticipant,
  findActivationLink,
  getPwaUrl,
  hasVerifiedParticipantCookie,
  installMinimalActivationTemplate,
} from '../util/account.js'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const synthetic = {
  email: `account-registration-${randomUUID()}@example.invalid`,
  username: `acct${randomUUID().replaceAll('-', '').slice(0, 10)}`,
  password: `synthetic-${randomUUID()}-password`,
}

let participantId: string | undefined
let restoreActivationTemplate: (() => Promise<void>) | undefined

test.beforeAll(async () => {
  assertProductionExecution()
  const prisma = await getPrisma()
  restoreActivationTemplate = await installMinimalActivationTemplate(prisma)
})

test.afterAll(async () => {
  if (!participantId && !restoreActivationTemplate) return
  const prisma = await getPrisma()
  try {
    if (participantId) {
      await deleteSyntheticParticipant(prisma, {
        id: participantId,
        email: synthetic.email,
        username: synthetic.username,
      })
    }
  } finally {
    await restoreActivationTemplate?.()
  }
})

test('creates, activates, logs in, and deduplicates a real participant account', async ({
  page,
  request,
}) => {
  const prisma = await getPrisma()
  const pwaUrl = getPwaUrl()
  const createAccountUrl = getPwaUrl('/createAccount')
  const normalizedEmail = synthetic.email.toLowerCase()

  const before = await prisma.participant.findMany({
    where: {
      OR: [{ email: normalizedEmail }, { username: synthetic.username }],
    },
    select: { id: true },
  })
  expect(before).toHaveLength(0)

  await page.goto(createAccountUrl)
  await page.getByTestId('email-field').fill(synthetic.email)
  await page
    .getByTestId('username-field-account-creation')
    .fill(synthetic.username)
  await page.getByTestId('password-field').fill(synthetic.password)
  await page.getByTestId('password-repetition-field').fill(synthetic.password)

  const profilePublicToggle = page.getByTestId('toggle-profile-public-setting')
  await profilePublicToggle.click()
  await expect(profilePublicToggle).not.toBeChecked()
  await page.getByTestId('tos-checkbox').click()

  const submit = page.getByTestId('create-profile-button')
  await expect(submit).toBeEnabled()
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/login'),
    submit.click(),
  ])
  expect(new URL(page.url()).searchParams.get('newAccount')).toBe('true')

  const created = await prisma.participant.findUniqueOrThrow({
    where: {
      email_isSSOAccount: { email: normalizedEmail, isSSOAccount: false },
    },
    include: { accounts: true },
  })
  participantId = created.id
  expect(created.username).toBe(synthetic.username)
  expect(created.email).toBe(normalizedEmail)
  expect(created.isEmailValid).toBe(false)
  expect(created.isProfilePublic).toBe(false)
  expect(created.isSSOAccount).toBe(false)
  expect(created.accounts).toHaveLength(0)

  await expect
    .poll(() => findActivationLink(request, normalizedEmail), {
      timeout: 20_000,
      intervals: [250, 500, 1000],
    })
    .toBeTruthy()
  const activationLink = await findActivationLink(request, normalizedEmail)
  expect(activationLink).toBeTruthy()

  await page.goto(activationLink as string)
  await expect(page.getByTestId('homepage')).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(async () => {
      const activated = await prisma.participant.findUnique({
        where: { id: created.id },
        select: { isEmailValid: true },
      })
      return activated?.isEmailValid
    })
    .toBe(true)

  const browser = page.context().browser()
  if (!browser) throw new Error('A browser is required for fresh-context login')
  const freshContext = await browser.newContext({ ignoreHTTPSErrors: true })
  try {
    const freshPage = await freshContext.newPage()
    await freshPage.goto(getPwaUrl('/login'))
    await freshPage.getByTestId('username-field').fill(synthetic.username)
    await freshPage.getByTestId('password-field').fill(synthetic.password)
    await freshPage.getByTestId('submit-login').click()
    await expect(freshPage.getByTestId('homepage')).toBeVisible()
    expect(await hasVerifiedParticipantCookie(freshContext, created.id)).toBe(
      true
    )
    await freshPage.reload()
    await expect(freshPage.getByTestId('homepage')).toBeVisible()
  } finally {
    await freshContext.close()
  }

  const duplicateUsername = `dup${randomUUID().replaceAll('-', '').slice(0, 10)}`
  expect(
    await prisma.participant.findUnique({
      where: { username: duplicateUsername },
      select: { id: true },
    })
  ).toBeNull()

  const duplicateContext = await browser.newContext({ ignoreHTTPSErrors: true })
  try {
    const duplicatePage = await duplicateContext.newPage()
    await duplicatePage.goto(createAccountUrl)
    await duplicatePage.getByTestId('email-field').fill(synthetic.email)
    await duplicatePage
      .getByTestId('username-field-account-creation')
      .fill(duplicateUsername)
    await duplicatePage.getByTestId('password-field').fill(synthetic.password)
    await duplicatePage
      .getByTestId('password-repetition-field')
      .fill(synthetic.password)
    await duplicatePage.getByTestId('tos-checkbox').click()
    const duplicateSubmit = duplicatePage.getByTestId('create-profile-button')
    await expect(duplicateSubmit).toBeEnabled()
    const duplicateMutation = duplicatePage.waitForResponse(
      (response) =>
        response.url().includes('/api/graphql') &&
        response.request().method() === 'POST'
    )
    await duplicateSubmit.click()
    await duplicateMutation
  } finally {
    await duplicateContext.close()
  }

  const sameIdentity = await prisma.participant.findMany({
    where: { email: normalizedEmail },
    include: { accounts: true },
  })
  expect(sameIdentity).toHaveLength(1)
  expect(sameIdentity[0]?.id).toBe(created.id)
  expect(
    await prisma.participant.findUnique({
      where: { username: duplicateUsername },
      select: { id: true },
    })
  ).toBeNull()

  expect(new URL(page.url()).origin).toBe(new URL(pwaUrl).origin)
})
