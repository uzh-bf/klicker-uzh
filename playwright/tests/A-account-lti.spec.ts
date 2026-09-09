import { expect, test } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import {
  assertProductionExecution,
  deleteSyntheticParticipant,
  getPwaUrl,
  hasVerifiedParticipantCookie,
  setSyntheticLtiCookie,
  signSyntheticLtiToken,
  suppressCookieHeaders,
  tamperJwtSignature,
} from '../util/account.js'
import {
  COURSE_ID_TEST,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
} from '../util/constants.js'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

type SyntheticIdentity = {
  email: string
  username: string
  sub: string
  password: string
}

function createIdentity(label: string): SyntheticIdentity {
  const id = randomUUID().replaceAll('-', '')
  return {
    email: `account-lti-${label}-${id}@example.invalid`,
    username: `lti${id.slice(0, 10)}`,
    sub: `account-lti-${label}-${id}`,
    password: `synthetic-${id}-password`,
  }
}

const newIdentity = createIdentity('new')
const existingIdentity = createIdentity('existing')
const expiredIdentity = createIdentity('expired')
const badSignatureIdentity = createIdentity('bad-signature')
const createdParticipants: SyntheticIdentity[] = []
const participantIds = new Map<string, string>()

function courseCreateAccountUrl() {
  return getPwaUrl(`/course/${COURSE_ID_TEST}/createAccount`)
}

async function loginSeededStudent(page: import('@playwright/test').Page) {
  await page.goto(getPwaUrl('/login'))
  await page
    .getByTestId('username-field')
    .fill(process.env.STUDENT_USERNAME ?? STUDENT_USERNAME)
  await page
    .getByTestId('password-field')
    .fill(process.env.STUDENT_PASSWORD ?? STUDENT_PASSWORD)
  await page.getByTestId('submit-login').click()
  await expect(page.getByTestId('homepage')).toBeVisible()
}

async function expectProfileIdentity(
  page: import('@playwright/test').Page,
  identity: SyntheticIdentity
) {
  await expect(page.getByTestId('update-account-username')).toHaveValue(
    identity.username
  )
  await expect(page.getByTestId('update-account-email')).toHaveValue(
    identity.email
  )
}

async function createNewLtiAccount(
  page: import('@playwright/test').Page,
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  identity: SyntheticIdentity
) {
  const before = await prisma.participant.findMany({
    where: { OR: [{ email: identity.email }, { username: identity.username }] },
    select: { id: true },
  })
  expect(before).toHaveLength(0)

  const token = await signSyntheticLtiToken({
    sub: identity.sub,
    email: identity.email,
  })
  await suppressCookieHeaders(page)
  await page.goto(
    `${courseCreateAccountUrl()}?jwt=${encodeURIComponent(token)}`
  )

  expect(new URL(page.url()).pathname).toMatch(/^\/(?:en\/)?createAccount$/)
  expect(new URL(page.url()).searchParams.has('jwt')).toBe(true)
  const emailField = page.getByTestId('email-field')
  await expect(emailField).toHaveValue(identity.email)
  await expect(emailField).toBeDisabled()
  await page
    .getByTestId('username-field-account-creation')
    .fill(identity.username)
  await page.getByTestId('password-field').fill(identity.password)
  await page.getByTestId('password-repetition-field').fill(identity.password)
  const profilePublicToggle = page.getByTestId('toggle-profile-public-setting')
  await profilePublicToggle.click()
  await expect(profilePublicToggle).not.toBeChecked()
  await page.getByTestId('tos-checkbox').click()
  const submit = page.getByTestId('create-profile-button')
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .toMatch(/^\/(?:en\/)?editProfile$/)
  await expectProfileIdentity(page, identity)
  expect(new URL(page.url()).searchParams.has('participantToken')).toBe(true)
  await page.reload()
  await expectProfileIdentity(page, identity)

  const participant = await prisma.participant.findUniqueOrThrow({
    where: {
      email_isSSOAccount: { email: identity.email, isSSOAccount: true },
    },
    include: { accounts: true },
  })
  participantIds.set(identity.sub, participant.id)
  createdParticipants.push(identity)
  expect(participant.username).toBe(identity.username)
  expect(participant.email).toBe(identity.email)
  expect(participant.isEmailValid).toBe(true)
  expect(participant.isProfilePublic).toBe(false)
  expect(participant.isSSOAccount).toBe(true)
  expect(participant.accounts).toHaveLength(1)
  expect(participant.accounts[0]?.ssoId).toBe(identity.sub)
  expect(participant.accounts[0]?.ssoType).toBe('LTI1.3')
  expect(participant.accounts[0]?.ssoEmail).toBe(identity.email)
  expect(
    await hasVerifiedParticipantCookie(page.context(), participant.id)
  ).toBe(true)
}

test.beforeAll(() => {
  assertProductionExecution()
})

test.afterAll(async () => {
  if (createdParticipants.length === 0) return
  const prisma = await getPrisma()
  for (const identity of createdParticipants) {
    const id = participantIds.get(identity.sub)
    if (id) {
      await deleteSyntheticParticipant(prisma, {
        id,
        email: identity.email,
        username: identity.username,
      })
    }
  }
})

test('creates an LTI account through the real cookie-free query handoff', async ({
  browser,
}) => {
  const prisma = await getPrisma()
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  })
  try {
    const page = await context.newPage()
    await createNewLtiAccount(page, prisma, newIdentity)
  } finally {
    await context.unrouteAll({ behavior: 'wait' })
    await context.close()
  }
})

test('links an existing participant through cookie and cookie-free query launches', async ({
  browser,
}) => {
  const prisma = await getPrisma()
  const participant = await prisma.participant.create({
    data: {
      email: existingIdentity.email,
      username: existingIdentity.username,
      password: await bcrypt.hash(existingIdentity.password, 10),
      isSSOAccount: false,
      isProfilePublic: true,
    },
  })
  participantIds.set(existingIdentity.sub, participant.id)
  createdParticipants.push(existingIdentity)

  const token = await signSyntheticLtiToken({
    sub: existingIdentity.sub,
    email: existingIdentity.email,
  })

  const cookieContext = await browser.newContext({ ignoreHTTPSErrors: true })
  try {
    await setSyntheticLtiCookie(cookieContext, token)
    const cookiePage = await cookieContext.newPage()
    await cookiePage.goto(courseCreateAccountUrl())
    expect(new URL(cookiePage.url()).pathname).toMatch(
      /^\/(?:en\/)?editProfile$/
    )
    await expectProfileIdentity(cookiePage, existingIdentity)
    await cookiePage.reload()
    await expectProfileIdentity(cookiePage, existingIdentity)
    expect(
      await hasVerifiedParticipantCookie(cookieContext, participant.id)
    ).toBe(true)
  } finally {
    await cookieContext.close()
  }

  const queryContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  })
  try {
    const queryPage = await queryContext.newPage()
    await loginSeededStudent(queryPage)
    const cookieRelay = await suppressCookieHeaders(queryPage)
    await queryPage.goto(
      `${courseCreateAccountUrl()}?jwt=${encodeURIComponent(token)}`
    )
    expect(cookieRelay.incomingCookieRequests).toBeGreaterThan(0)
    expect(cookieRelay.relayedCookieFreeRequests).toBeGreaterThan(0)
    expect(cookieRelay.wireRequests).toBeGreaterThan(0)
    expect(cookieRelay.cookieHeadersOnWire).toBe(0)
    expect(cookieRelay.interceptionFailures).toBe(0)
    expect(new URL(queryPage.url()).pathname).toMatch(
      /^\/(?:en\/)?editProfile$/
    )
    await expectProfileIdentity(queryPage, existingIdentity)
    expect(new URL(queryPage.url()).searchParams.has('participantToken')).toBe(
      true
    )
    await queryPage.reload()
    await expectProfileIdentity(queryPage, existingIdentity)
    expect(
      await hasVerifiedParticipantCookie(queryContext, participant.id)
    ).toBe(true)
  } finally {
    await queryContext.unrouteAll({ behavior: 'wait' })
    await queryContext.close()
  }

  expect(
    await prisma.participant.count({ where: { email: existingIdentity.email } })
  ).toBe(1)
  const accounts = await prisma.participantAccount.findMany({
    where: { participantId: participant.id },
  })
  expect(accounts).toHaveLength(1)
  expect(accounts[0]?.ssoId).toBe(existingIdentity.sub)
  expect(accounts[0]?.ssoType).toBe('LTI1.3')
  expect(accounts[0]?.ssoEmail).toBe(existingIdentity.email)

  const updatedParticipant = await prisma.participant.findUniqueOrThrow({
    where: { id: participant.id },
  })
  expect(updatedParticipant.isSSOAccount).toBe(false)
})

test('rejects expired and bad-signature launches without adopting an unrelated session', async ({
  browser,
}) => {
  const prisma = await getPrisma()
  const expiredToken = await signSyntheticLtiToken({
    sub: expiredIdentity.sub,
    email: expiredIdentity.email,
    expiresAt: Math.floor(Date.now() / 1000) - 10,
  })
  const validToken = await signSyntheticLtiToken({
    sub: badSignatureIdentity.sub,
    email: badSignatureIdentity.email,
  })
  const cases = [
    { identity: expiredIdentity, token: expiredToken },
    {
      identity: badSignatureIdentity,
      token: tamperJwtSignature(validToken),
    },
  ]

  for (const { identity, token } of cases) {
    expect(
      await prisma.participant.count({ where: { email: identity.email } })
    ).toBe(0)
    expect(
      await prisma.participantAccount.count({ where: { ssoId: identity.sub } })
    ).toBe(0)

    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    try {
      const page = await context.newPage()
      await loginSeededStudent(page)
      await page.goto(
        `${courseCreateAccountUrl()}?jwt=${encodeURIComponent(token)}`
      )
      expect(new URL(page.url()).pathname).toMatch(/^\/(?:en\/)?serverError$/)
      await page.goto(getPwaUrl('/editProfile'))
      await expect(page.getByTestId('update-account-username')).toHaveValue(
        process.env.STUDENT_USERNAME ?? STUDENT_USERNAME
      )
    } finally {
      await context.unrouteAll({ behavior: 'wait' })
      await context.close()
    }

    expect(
      await prisma.participant.count({ where: { email: identity.email } })
    ).toBe(0)
    expect(
      await prisma.participantAccount.count({ where: { ssoId: identity.sub } })
    ).toBe(0)
  }
})
