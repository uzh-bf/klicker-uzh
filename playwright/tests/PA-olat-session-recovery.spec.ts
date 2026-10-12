import {
  expect,
  type BrowserContext,
  type Frame,
  type Page,
  type Response,
  type Route,
  test,
} from '@playwright/test'
import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
} from '@klicker-uzh/prisma/client'
import type {
  ChoicesElementData,
  ElementInstanceResults,
} from '@klicker-uzh/types'
import { exportSPKI, generateKeyPair, SignJWT } from 'jose'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '../../packages/util/src/participantAccountDataUse.js'
import { getPrisma } from '../global-setup.js'
import {
  APP_SECRET,
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  STUDENT_PASSWORD,
  USER_ID_TEST,
} from '../util/constants.js'

// One regular participant login exists per browser cookie context. The
// HttpOnly participant_token cookie is the credential; the readable
// participant_session cookie is its non-secret revision. Successful
// authentication rotates the revision, every tab and app rebinds to it, and a
// request whose revision no longer matches is refused instead of executing
// under the replacement identity.

test.beforeEach(async ({}, info) => {
  test.skip(
    !/^(chromium|firefox|webkit)-(allowed|blocked|standard)$/.test(
      info.project.name
    ),
    'Requires olat-session.config.ts and its native cookie policy projects'
  )
})

const lms = 'https://lms.example.invalid'
const ssoId = `synthetic-olat-recovery-${randomUUID()}`
const quizId = randomUUID()
const liveQuizId = randomUUID()
const loginThreadId = randomUUID()
const ltiThreadId = randomUUID()
let liveQuizBlockId: number
let elementId: number
let chatbotId: string

// testuser1 is the ordinary login identity; testuser2 is the LTI identity the
// synthetic launch maps onto the linked participant account below.
const loginId = PARTICIPANT_IDS[0]!
const ltiId = PARTICIPANT_IDS[1]!
const loginUsername = 'testuser1'
const ltiUsername = 'testuser2'
const loginEmail = 'testuser1@test.uzh.ch'
const ltiEmail = 'testuser2@test.uzh.ch'

// Synthetic accounts exercise session handling after ordinary onboarding.
function completedDataUse() {
  const now = new Date()
  return {
    researchConsent: false,
    learningAnalyticsConsent: false,
    researchConsentChoiceAt: now,
    researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    learningAnalyticsChoiceAt: now,
    learningAnalyticsDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    dataUseAcknowledgedAt: now,
    dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    dataUseRevision: 1,
    dataUseEvents: {
      create: {
        revision: 1,
        disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        researchConsent: false,
        learningAnalyticsConsent: false,
        acknowledged: true,
      },
    },
  }
}

async function signed(
  payload: Record<string, unknown>,
  expiresIn: string | number = '5m'
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(process.env.APP_SECRET ?? APP_SECRET))
}

// The synthetic LMS page embeds the launch target in an iframe, so every
// launch happens in a third-party frame exactly like the real LMS embedding.
async function launch(page: Page, destination: string) {
  await page.route(`${lms}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body><iframe title="Synthetic LMS" src="${destination.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" style="width:100%;height:100vh"></iframe></body></html>`,
    })
  )
  await page.goto(`${lms}/launch`)
  // Keep the frame object across redirects; a recovery redirect can finish
  // before a poll observes the original launch pathname.
  await expect
    .poll(() =>
      page.frames().find((frame) => frame.parentFrame() === page.mainFrame())
    )
    .not.toBeUndefined()
  return page
    .frames()
    .find((frame) => frame.parentFrame() === page.mainFrame())!
}

function autoPost(action: string, fields: Record<string, string>) {
  const escape = (value: string) =>
    value.replace(/[&"<>]/g, (char) => `&#${char.charCodeAt(0)};`)
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`
    )
    .join('')
  return `<html><body><form method="post" action="${escape(action)}">${inputs}</form><script>document.forms[0].submit()</script></body></html>`
}

async function navigate(frame: Frame, path: string) {
  await frame.evaluate(async (destination) => {
    const next = (
      window as unknown as {
        next: { router: { push: (path: string) => Promise<boolean> } }
      }
    ).next
    await next.router.push(destination)
  }, path)
}

async function expectIdentity(
  subject:
    | Page
    | { getByTestId: (id: string) => ReturnType<Page['getByTestId']> },
  participant: { email: string | null; username: string }
) {
  if (participant.email)
    await expect(subject.getByTestId('update-account-email')).toHaveValue(
      participant.email
    )
  await expect(subject.getByTestId('update-account-username')).toHaveValue(
    participant.username
  )
}

async function sessionRevision(subject: Page | Frame) {
  return subject.evaluate(
    () =>
      document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('participant_session='))
        ?.split('=')[1]
  )
}

async function signInAs(
  page: Page,
  baseURL: string,
  username: string,
  password = STUDENT_PASSWORD
) {
  await page.goto(`${baseURL}/login?redirect_to=/editProfile`)
  await page.getByTestId('username-field').fill(username)
  await page.getByTestId('password-field').fill(password)
  await page.getByTestId('submit-login').click()
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
}

async function signOut(page: Page) {
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/login'))
}

// WebKit discards cookies scoped to the local *.localhost stack, so real
// cookie-session flows cannot be exercised in its project.
function skipWithoutCookieSessions(projectName: string) {
  test.skip(
    projectName.startsWith('webkit-'),
    'WebKit discards cookies scoped to the local *.localhost domain'
  )
}

// Lecturers change live quiz state through the API so the response pipeline
// sees the state the UI holds.
async function lecturer(
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
  query: string,
  variables: Record<string, unknown>
) {
  const token = await signed({
    email: 'lecturer@test.uzh.ch',
    sub: USER_ID_TEST,
    role: 'ADMIN',
    scope: 'ACCOUNT_OWNER',
    catalystInstitutional: true,
    catalystIndividual: true,
  })
  const response = await request.post(
    `${baseURL.replace('://pwa.', '://api.')}/api/graphql`,
    {
      headers: {
        origin: process.env.URL_MANAGE!,
        cookie: `next-auth.session-token=${token}`,
        'x-graphql-yoga-csrf': '1',
      },
      data: { query, variables },
    }
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  expect(body.errors).toBeUndefined()
  return body.data
}

test.beforeAll(async ({}, info) => {
  if (
    !/^(chromium|firefox|webkit)-(allowed|blocked|standard)$/.test(
      info.project.name
    )
  )
    return
  const prisma = await getPrisma()
  const ltiParticipant = await prisma.participant.findUniqueOrThrow({
    where: { id: ltiId },
  })
  // The synthetic LMS launch below is linked to the seeded participant that
  // the LTI identity resolves to. The link is spec-owned and removed in
  // afterAll; the seeded rows themselves stay untouched.
  await prisma.participantAccount.create({
    data: {
      ssoId,
      ssoEmail: ltiParticipant.email ?? ltiEmail,
      ssoType: 'LTI1.3',
      participantId: ltiId,
    },
  })
  // The header chatbot gate needs a published chatbot on the seeded course.
  chatbotId = (
    await prisma.chatbot.create({
      data: {
        name: 'Synthetic session recovery chatbot',
        status: 'PUBLISHED',
        ownerId: USER_ID_TEST,
        courseId: COURSE_ID_TEST,
      },
    })
  ).id
  await prisma.chatThread.createMany({
    data: [
      {
        id: loginThreadId,
        title: loginThreadId,
        chatbotId,
        participantId: loginId,
      },
      { id: ltiThreadId, title: ltiThreadId, chatbotId, participantId: ltiId },
    ],
  })
  const element = await prisma.element.create({
    data: {
      name: 'Synthetic session recovery question',
      content: 'Choose the correct synthetic answer.',
      type: ElementType.SC,
      status: 'READY',
      ownerId: USER_ID_TEST,
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'Incorrect', correct: false },
          { ix: 1, value: 'Correct', correct: true },
        ],
      },
    },
  })
  elementId = element.id
  const elementData = {
    ...element,
    id: `${element.id}-v${element.version}`,
    elementId: element.id,
  } as ChoicesElementData
  const results: ElementInstanceResults = {
    choices: { '0': 0, '1': 0 },
    total: 0,
  }
  await prisma.practiceQuiz.create({
    data: {
      id: quizId,
      name: 'Synthetic session recovery',
      displayName: 'Synthetic session recovery',
      status: 'PUBLISHED',
      courseId: COURSE_ID_TEST,
      ownerId: USER_ID_TEST,
      stacks: {
        create: {
          type: ElementStackType.PRACTICE_QUIZ,
          order: 0,
          courseId: COURSE_ID_TEST,
          elements: {
            create: {
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.SC,
              elementId,
              order: 0,
              options: { basePoints: true, pointsMultiplier: 1 },
              elementData,
              results,
              anonymousResults: results,
              instanceStatistics: { create: {} },
              ownerId: USER_ID_TEST,
            },
          },
        },
      },
    },
  })
  const liveQuiz = await prisma.liveQuiz.create({
    data: {
      id: liveQuizId,
      name: 'Synthetic session recovery live quiz',
      displayName: 'Synthetic session recovery live quiz',
      status: 'PUBLISHED',
      isGamificationEnabled: true,
      courseId: COURSE_ID_TEST,
      ownerId: USER_ID_TEST,
      blocks: {
        create: {
          order: 0,
          elements: {
            create: {
              order: 0,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.SC,
              elementData,
              options: { basePoints: true, pointsMultiplier: 1 },
              results,
              anonymousResults: results,
              element: { connect: { id: elementId } },
              owner: { connect: { id: USER_ID_TEST } },
            },
          },
        },
      },
      permissions: {
        create: { permissionLevel: 'OWNER', userId: USER_ID_TEST },
      },
    },
    include: { blocks: true },
  })
  liveQuizBlockId = liveQuiz.blocks[0]!.id
})

test.afterAll(async ({}, info) => {
  if (
    !/^(chromium|firefox|webkit)-(allowed|blocked|standard)$/.test(
      info.project.name
    )
  )
    return
  const prisma = await getPrisma()
  await prisma.participantAccount.deleteMany({ where: { ssoId } })
  await prisma.practiceQuiz.deleteMany({ where: { id: quizId } })
  await prisma.liveQuiz.deleteMany({ where: { id: liveQuizId } })
  if (elementId) await prisma.element.deleteMany({ where: { id: elementId } })
  if (chatbotId) {
    await prisma.chatThread.deleteMany({ where: { chatbotId } })
    await prisma.chatbot.deleteMany({ where: { id: chatbotId } })
  }
})

// Observe the application's own request, so a fresh test-authored fetch cannot
// hide a stale Chat document or cache. Each participant owns one empty thread.
function waitForChatIdentity(context: BrowserContext, threadId: string) {
  return context.waitForEvent('response', {
    timeout: 30_000,
    predicate: async (response) => {
      if (
        new URL(response.url()).pathname !==
          `/api/chatbots/${chatbotId}/threads` ||
        response.request().method() !== 'GET' ||
        response.status() !== 200
      )
        return false
      const threads = await response.json().catch(() => null)
      return (
        Array.isArray(threads) &&
        threads.some((thread) => thread.id === threadId)
      )
    },
  })
}

async function expectChatIdentity(
  chat: Page,
  response: Response,
  threadId: string
) {
  expect(response.request().frame().page()).toBe(chat)
  expect(
    (await response.json()).map((thread: { id: string }) => thread.id)
  ).toEqual([threadId])
  const headers = await response.request().allHeaders()
  expect(headers['x-participant-session']).toBe(await sessionRevision(chat))
  expect(headers.authorization ?? '').not.toMatch(/^Bearer /)
  await expect(chat.getByTestId('chat-thread-list')).toBeVisible()
  // UUID titles are test-owned identity markers, independent of UI copy.
  await expect(
    chat.getByTestId('chat-thread-select').filter({ hasText: threadId })
  ).toBeVisible()
  const previous = threadId === loginThreadId ? ltiThreadId : loginThreadId
  await expect(
    chat.getByTestId('chat-thread-select').filter({ hasText: previous })
  ).toHaveCount(0)
  await expect(chat.getByTestId('chat-no-login')).toHaveCount(0)
}

async function openChat(page: Page, baseURL: string) {
  await page.goto(`${baseURL}/course/${COURSE_ID_TEST}`)
  const identity = waitForChatIdentity(page.context(), loginThreadId)
  const popup = page.waitForEvent('popup')
  await page.getByTestId('student-course-chatbot-link').click()
  const chat = await popup
  await expectChatIdentity(chat, await identity, loginThreadId)
  await page.goto(`${baseURL}/editProfile`)
  await expectIdentity(page, { email: loginEmail, username: loginUsername })
  return chat
}

// The frame owns both the successful profile and refused-cookie recovery.
async function settleLaunch(frame: Frame, profile: () => Promise<void>) {
  await expect(
    frame
      .getByTestId('update-account-username')
      .or(frame.getByTestId('cookies-required-recovery'))
  ).toBeVisible({ timeout: 30_000 })
  if (await frame.getByTestId('cookies-required-recovery').isVisible()) {
    await expect(frame.getByTestId('update-account-email')).toHaveCount(0)
    return 'cookies-refused'
  }
  await profile()
  return 'accepted'
}

test('existing PWA and Chat tabs adopt ordinary login and clear on logout', async ({
  page: first,
  context,
  baseURL,
}, info) => {
  skipWithoutCookieSessions(info.project.name)
  await signInAs(first, baseURL!, loginUsername)
  const second = await context.newPage()
  await second.goto(`${baseURL}/editProfile`)
  await expectIdentity(second, { email: loginEmail, username: loginUsername })
  const chat = await openChat(first, baseURL!)
  const previousChatDocument = await chat
    .getByTestId('chat-thread-list')
    .elementHandle()
  const firstRevision = await sessionRevision(first)

  const replacement = waitForChatIdentity(context, ltiThreadId)
  await signInAs(first, baseURL!, ltiUsername)
  expect(await sessionRevision(first)).not.toBe(firstRevision)
  // No navigation, reload or test fetch in either observing tab.
  await expectIdentity(second, { email: ltiEmail, username: ltiUsername })
  await chat.bringToFront()
  await expectChatIdentity(chat, await replacement, ltiThreadId)
  expect(
    await previousChatDocument!
      .evaluate((node) => node.isConnected)
      .catch(() => false)
  ).toBe(false)

  await first.bringToFront()
  await signOut(first)
  await expect(second.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(second.getByTestId('update-account-email')).toHaveCount(0)
  await chat.bringToFront()
  await expect(chat.getByTestId('chat-no-login')).toBeVisible()
  await expect(chat.getByTestId('chat-thread-list')).toHaveCount(0)
  await expect(chat.getByTestId('chat-composer-input')).toHaveCount(0)
})

test('refused launch cookies show recovery in the standalone page and LMS frame', async ({
  page,
  context,
  baseURL,
  request,
}, info) => {
  skipWithoutCookieSessions(info.project.name)
  const refuseCookies = async (route: Route) => {
    // The isolated request fixture must not accept cookies into the browser
    // before we strip Set-Cookie from the response it will receive.
    const response = await request.fetch(route.request())
    const headers = { ...response.headers() }
    delete headers['set-cookie']
    await route.fulfill({ response, headers })
  }
  await page.route('**/editProfile*', refuseCookies)
  await page.goto(
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  )
  expect(await settleLaunch(page.mainFrame(), async () => {})).toBe(
    'cookies-refused'
  )
  expect(await sessionRevision(page)).toBeUndefined()

  await page.unroute('**/editProfile*', refuseCookies)
  await signInAs(page, baseURL!, loginUsername)
  await expectIdentity(page, { email: loginEmail, username: loginUsername })
  await page.route('**/editProfile*', refuseCookies)
  const frame = await launch(
    page,
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  )
  expect(await settleLaunch(frame, async () => {})).toBe('cookies-refused')
  await expect(frame.getByTestId('cookies-required-recovery')).toBeVisible()
  await expect(frame.getByTestId('update-account-email')).toHaveCount(0)
})

test('an invalid launch or query token cannot create a session or retain an identity', async ({
  page,
  context,
  baseURL,
}, info) => {
  skipWithoutCookieSessions(info.project.name)
  const frame = await launch(
    page,
    `${baseURL}/editProfile?jwt=${encodeURIComponent('not-a-valid-jwt')}`
  )
  await expect
    .poll(() => frame.url(), { timeout: 30_000 })
    .toContain('serverError?freshLaunch=true')
  await expect(
    frame
      .getByTestId('fresh-launch-recovery')
      .or(frame.getByTestId('cookies-required-recovery'))
  ).toBeVisible()
  await expect(frame.getByTestId('update-account-email')).toHaveCount(0)

  // The retired URL credential parameter is ignored: it neither signs in as
  // that participant nor blocks the anonymous sign-in surface.
  const other = await signed({ sub: loginId, role: 'PARTICIPANT' }, '14d')
  await page.goto(
    `${baseURL}/editProfile?participantToken=${encodeURIComponent(other)}`
  )
  await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(page.getByTestId('update-account-email')).toHaveCount(0)
})

test('a full LTI 1.3 launch through the tool signs in a new account without retaining a URL credential', async ({
  page,
  context,
  baseURL,
  request,
}, info) => {
  const tool = baseURL!.replace('://pwa.', '://lti.')
  const available = await request
    .get(`${tool}/login`)
    .then((response) => response.status() === 400)
    .catch(() => false)
  test.skip(
    !available,
    'Requires the routed LTI service; run with --runtime-profile full'
  )
  // One platform registration per project avoids races between parallel
  // projects; registering again replaces the key.
  const clientId = `synthetic-playwright-${info.project.name}`
  const deploymentId = 'synthetic-deployment'
  const platformKey = await generateKeyPair('RS256')
  const forgedKey = await generateKeyPair('RS256')
  execFileSync(
    'devrouter',
    [
      'exec',
      fileURLToPath(new URL('../..', import.meta.url)),
      '--',
      'node',
      'apps/lti/scripts/register-local-platform.mjs',
      Buffer.from(
        JSON.stringify({
          url: lms,
          name: 'Synthetic LMS',
          clientId,
          authenticationEndpoint: `${lms}/auth`,
          accesstokenEndpoint: `${lms}/token`,
          authConfig: {
            method: 'RSA_KEY',
            key: await exportSPKI(platformKey.publicKey),
          },
        })
      ).toString('base64url'),
    ],
    { stdio: 'pipe' }
  )
  let signingKey = platformKey.privateKey
  const createSsoId = `synthetic-registration-${randomUUID()}`
  const createEmail = `${randomUUID()}@example.invalid`
  const createUsername = `pa${randomUUID().slice(0, 8)}`
  // Route handlers never see a redirect target, so the tool's redirect to the
  // mocked authorization endpoint becomes a navigation the LMS route serves.
  await context.route(`${tool}/login`, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 })
    const {
      location,
      'content-security-policy': _,
      ...headers
    } = response.headers()
    if (!location) return route.fulfill({ response })
    await route.fulfill({
      response,
      status: 200,
      headers: { ...headers, 'content-type': 'text/html' },
      body: `<script>location.replace(${JSON.stringify(location)})</script>`,
    })
  })
  await context.route(`${lms}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/course')
      return route.fulfill({
        contentType: 'text/html',
        body: `<html><body><iframe title="Synthetic LMS" src="${lms}/initiate" style="width:100%;height:100vh"></iframe></body></html>`,
      })
    if (url.pathname === '/initiate')
      return route.fulfill({
        contentType: 'text/html',
        body: autoPost(`${tool}/login`, {
          iss: lms,
          login_hint: createSsoId,
          target_link_uri: `${tool}/`,
          client_id: clientId,
          lti_deployment_id: deploymentId,
        }),
      })
    if (url.pathname !== '/auth') return route.fulfill({ status: 404 })
    const params = url.searchParams
    const claim = 'https://purl.imsglobal.org/spec/lti/claim'
    const idToken = await new SignJWT({
      nonce: params.get('nonce'),
      email: createEmail,
      [`${claim}/message_type`]: 'LtiResourceLinkRequest',
      [`${claim}/version`]: '1.3.0',
      [`${claim}/deployment_id`]: deploymentId,
      [`${claim}/target_link_uri`]: `${tool}/`,
      [`${claim}/resource_link`]: { id: 'synthetic-resource' },
      [`${claim}/context`]: { id: 'synthetic-course' },
      [`${claim}/roles`]: [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
      ],
      [`${claim}/custom`]: { klicker_redirect_to: `${baseURL}/editProfile` },
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(lms)
      .setAudience(clientId)
      .setSubject(createSsoId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey)
    return route.fulfill({
      contentType: 'text/html',
      body: autoPost(params.get('redirect_uri')!, {
        id_token: idToken,
        state: params.get('state')!,
      }),
    })
  })
  const handoff = () =>
    page.waitForRequest((item) =>
      item.url().startsWith(`${baseURL}/editProfile?jwt=`)
    )
  try {
    // The full launch starts at the mocked LMS, runs the real ltijs
    // verification and hands the PWA a one-time jwt framed as the new linked
    // account, which the frame registers.
    let launched = handoff()
    await page.goto(`${lms}/course`)
    await launched
    await expect
      .poll(() =>
        page.frames().find((item) => item.url().includes('/createAccount'))
      )
      .not.toBeUndefined()
    let frame = page
      .frames()
      .find((item) => item.url().includes('/createAccount'))!
    await expect(
      frame
        .getByTestId('email-field')
        .or(frame.getByTestId('cookies-required-recovery'))
    ).toBeVisible()
    let recoveryPage: Page | undefined
    if (await frame.getByTestId('cookies-required-recovery').isVisible()) {
      const opened = context.waitForEvent('page')
      await frame
        .getByTestId('cookies-required-recovery')
        .getByRole('link')
        .click()
      recoveryPage = await opened
      frame = recoveryPage.mainFrame()
    }
    await expect(frame.getByTestId('email-field')).toHaveValue(createEmail)
    await frame
      .getByTestId('username-field-account-creation')
      .fill(createUsername)
    await frame.getByTestId('password-field').fill('signupPassword123!')
    await frame
      .getByTestId('password-repetition-field')
      .fill('signupPassword123!')
    await frame.getByTestId('research-consent-toggle').click()
    await frame.getByTestId('research-consent-no').click()
    await frame.getByTestId('learning-analytics-consent-no').click()
    await frame.getByTestId('tos-checkbox').click()
    await frame.getByTestId('create-profile-button').click()
    const outcome = await settleLaunch(frame, () =>
      expectIdentity(frame, { email: createEmail, username: createUsername })
    )
    if (
      (!recoveryPage && info.project.name.endsWith('-blocked')) ||
      info.project.name.startsWith('webkit-')
    )
      expect(outcome).toBe('cookies-refused')
    if (outcome === 'accepted') {
      expect(await sessionRevision(frame)).toBeTruthy()
      expect(new URL(frame.url()).searchParams.has('participantToken')).toBe(
        false
      )
    }
    await recoveryPage?.close()

    // A token the platform did not sign never reaches the PWA.
    await context.clearCookies()
    signingKey = forgedKey.privateKey
    const rejected = page.waitForResponse(
      (response) =>
        response.url() === `${tool}/` && response.request().method() === 'POST'
    )
    let forwarded = false
    page.on('request', (item) => {
      if (item.url().startsWith(`${baseURL}/editProfile?jwt=`)) forwarded = true
    })
    await page.goto(`${lms}/initiate`)
    expect((await rejected).status()).toBe(401)
    expect(forwarded).toBe(false)
  } finally {
    const prisma = await getPrisma()
    await prisma.participant.deleteMany({ where: { email: createEmail } })
  }
})

test('LTI B replaces A in an existing PWA profile and existing Chat tab', async ({
  page: first,
  context,
  baseURL,
}, info) => {
  skipWithoutCookieSessions(info.project.name)
  await signInAs(first, baseURL!, loginUsername)
  const second = await context.newPage()
  await second.goto(`${baseURL}/editProfile`)
  await expectIdentity(second, { email: loginEmail, username: loginUsername })
  const chat = await openChat(first, baseURL!)
  const loginRevision = await sessionRevision(second)
  const replacement = waitForChatIdentity(context, ltiThreadId)

  const destination = `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  const frame = await launch(first, destination)
  const outcome = await settleLaunch(frame, () =>
    expectIdentity(frame, { email: ltiEmail, username: ltiUsername })
  )
  if (info.project.name.endsWith('-blocked'))
    expect(outcome).toBe('cookies-refused')
  if (outcome === 'cookies-refused') {
    await expect(frame.getByTestId('cookies-required-recovery')).toBeVisible()
    await expect(frame.getByTestId('update-account-email')).toHaveCount(0)
    // Restricted projects then exercise a permitted top-level launch with
    // the original PWA observer and Chat tab still open.
    await first.goto(
      `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
    )
    await expectIdentity(first, { email: ltiEmail, username: ltiUsername })
  }
  expect(await sessionRevision(second)).not.toBe(loginRevision)
  await second.bringToFront()
  await expectIdentity(second, { email: ltiEmail, username: ltiUsername })
  await chat.bringToFront()
  await expectChatIdentity(chat, await replacement, ltiThreadId)
})

test('the last completed login response replaces earlier cookies and cached identities', async ({
  page: first,
  context,
  baseURL,
  playwright,
}, info) => {
  test.setTimeout(60_000)
  skipWithoutCookieSessions(info.project.name)
  await signInAs(first, baseURL!, loginUsername)
  const second = await context.newPage()
  await second.goto(`${baseURL}/editProfile`)
  await expectIdentity(second, { email: loginEmail, username: loginUsername })
  const chat = await openChat(first, baseURL!)
  const initialRevision = await sessionRevision(first)

  // An inert same-origin document keeps the pending browser fetch alive while
  // application tabs react to the other login. The real backend still signs
  // both login responses; only delivery of B's response is delayed.
  const driver = await context.newPage()
  await driver.route(`${baseURL}/session-race-driver`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body></body></html>',
    })
  )
  await driver.goto(`${baseURL}/session-race-driver`)
  const isolated = await playwright.request.newContext({
    ignoreHTTPSErrors: true,
  })
  let release!: () => void
  const delivery = new Promise<void>((resolve) => {
    release = resolve
  })
  let captured = false
  let delivered = false
  let captureError: unknown
  let delayedRevision: string | undefined
  let deliveryTimedOut = false
  const deadline = setTimeout(() => {
    deliveryTimedOut = true
    release()
  }, 20_000)
  const api = `${baseURL!.replace('://pwa.', '://api.')}/api/graphql`
  await driver.route(`${api}*`, async (route) => {
    try {
      // route.fetch would update the browser context's cookies immediately.
      // This isolated request context keeps Set-Cookie pending until fulfill.
      const response = await isolated.fetch(route.request(), {
        timeout: 10_000,
      })
      expect(response.ok()).toBe(true)
      expect((await response.json()).data.loginParticipant).toBeTruthy()
      delayedRevision = response
        .headersArray()
        .filter(({ name }) => name.toLowerCase() === 'set-cookie')
        .map(({ value }) => /^participant_session=([^;]+)/.exec(value)?.[1])
        .find(Boolean)
      expect(delayedRevision).toBeTruthy()
      captured = true
      await delivery
      await route.fulfill({ response })
      delivered = true
    } catch (error) {
      captureError = error
      await route.abort().catch(() => {})
    }
  })
  const pending = driver
    .evaluate(
      async ({ api, revision, username, password }) => {
        const response = await fetch(api, {
          method: 'POST',
          credentials: 'include',
          signal: AbortSignal.timeout(25_000),
          headers: {
            'content-type': 'application/json',
            'x-graphql-yoga-csrf': '1',
            'x-participant-session': revision!,
          },
          body: JSON.stringify({
            operationName: 'LoginParticipant',
            query:
              'mutation LoginParticipant($usernameOrEmail: String!, $password: String!) { loginParticipant(usernameOrEmail: $usernameOrEmail, password: $password) }',
            variables: { usernameOrEmail: username, password },
          }),
        })
        return response.json()
      },
      {
        api,
        revision: initialRevision,
        username: ltiUsername,
        password: STUDENT_PASSWORD,
      }
    )
    .catch(() => null)
  try {
    await expect
      .poll(() => captured || !!captureError, { timeout: 12_000 })
      .toBe(true)
    expect(captureError).toBeUndefined()
    expect(await sessionRevision(first)).toBe(initialRevision)
    const earlier = waitForChatIdentity(context, loginThreadId)
    await signInAs(first, baseURL!, loginUsername)
    const earlierRevision = await sessionRevision(first)
    expect(earlierRevision).not.toBe(initialRevision)
    await expectChatIdentity(chat, await earlier, loginThreadId)
    await expectIdentity(second, { email: loginEmail, username: loginUsername })
    expect(deliveryTimedOut).toBe(false)
    expect(delivered).toBe(false)

    const last = waitForChatIdentity(context, ltiThreadId)
    release()
    expect((await pending)?.data.loginParticipant).toBeTruthy()
    expect(await sessionRevision(first)).toBe(delayedRevision)
    expect(delayedRevision).not.toBe(earlierRevision)
    await expectIdentity(first, { email: ltiEmail, username: ltiUsername })
    await expectIdentity(second, { email: ltiEmail, username: ltiUsername })
    await chat.bringToFront()
    await expectChatIdentity(chat, await last, ltiThreadId)
  } finally {
    clearTimeout(deadline)
    release()
    await pending
    await driver.close()
    await isolated.dispose()
  }
})

test('rejected logout and account deletion keep the shared session and succeed on retry', async ({
  page,
  context,
  baseURL,
}, info) => {
  skipWithoutCookieSessions(info.project.name)
  // A declined logout leaves this tab signed in and does not discard the
  // shared session for the other tab.
  await signInAs(page, baseURL!, loginUsername)
  await expectIdentity(page, { email: loginEmail, username: loginUsername })
  const second = await context.newPage()
  await second.goto(`${baseURL}/editProfile`)
  await expectIdentity(second, { email: loginEmail, username: loginUsername })
  await page.route('**/api/graphql*', async (route) => {
    if (route.request().postData()?.includes('LogoutParticipant')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { logoutParticipant: null } }),
      })
    } else await route.continue()
  })
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
  await expectIdentity(page, { email: loginEmail, username: loginUsername })
  await second.goto(`${baseURL}/editProfile`)
  await expectIdentity(second, { email: loginEmail, username: loginUsername })
  // The retry runs the real command and ends the session for both tabs.
  await page.unroute('**/api/graphql*')
  await signOut(page)
  expect(await sessionRevision(page)).toBeTruthy()
  await second.goto(`${baseURL}/editProfile`)
  await expect(second.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(second.getByTestId('update-account-email')).toHaveCount(0)

  // A declined account deletion keeps the disposable participant; the retry
  // deletes it and ends the shared session.
  const prisma = await getPrisma()
  const disposableUsername = `pa${randomUUID().slice(0, 8)}`
  const disposable = await prisma.participant.create({
    data: {
      username: disposableUsername,
      email: `${disposableUsername}@example.invalid`,
      password: randomUUID(),
      ...completedDataUse(),
    },
  })
  const disposableSsoId = `synthetic-deletion-${randomUUID()}`
  await prisma.participantAccount.create({
    data: {
      ssoId: disposableSsoId,
      ssoEmail: disposable.email!,
      ssoType: 'LTI1.3',
      participantId: disposable.id,
    },
  })
  try {
    const disposableJwt = await signed(
      { sub: disposableSsoId, scope: 'LTI1.3' },
      '1h'
    )
    await page.goto(
      `${baseURL}/editProfile?jwt=${encodeURIComponent(disposableJwt)}`
    )
    await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
    await expectIdentity(page, {
      email: disposable.email,
      username: disposable.username,
    })
    let declineDelete = true
    await page.route('**/api/graphql*', async (route) => {
      if (
        declineDelete &&
        route.request().postData()?.includes('DeleteParticipantAccount')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { deleteParticipantAccount: false } }),
        })
      } else await route.continue()
    })
    await page.getByTestId('confirm-delete-account').click()
    await page.getByTestId('delete-account-command').click()
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]').first()
    ).toBeVisible()
    await expect(page.getByTestId('delete-account-command')).toBeHidden()
    expect(
      await prisma.participant.findUnique({ where: { id: disposable.id } })
    ).not.toBeNull()
    await page.reload()
    await expectIdentity(page, {
      email: disposable.email,
      username: disposable.username,
    })

    declineDelete = false
    await page.getByTestId('confirm-delete-account').click()
    await page.getByTestId('delete-account-command').click()
    await expect
      .poll(() =>
        prisma.participant.findUnique({ where: { id: disposable.id } })
      )
      .toBeNull()
    await page.goto(`${baseURL}/editProfile`)
    await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
    await expect(page.getByTestId('update-account-email')).toHaveCount(0)
  } finally {
    await prisma.participant.deleteMany({ where: { id: disposable.id } })
  }
})

const responseApi = (baseURL: string) =>
  `${baseURL.replace('://pwa.', '://response-api.')}/AddResponse`

test('a live quiz answer and a practice submission are recorded for the shared cookie participant', async ({
  page,
  context,
  baseURL,
  request,
}, info) => {
  const prisma = await getPrisma()
  const participations = await prisma.participation.findMany({
    where: {
      courseId: COURSE_ID_TEST,
      participantId: { in: [loginId, ltiId] },
    },
  })
  expect(participations).toHaveLength(2)

  // Before any launch, an unauthenticated tab cannot answer: the response API
  // refuses a request whose revision does not match the browser cookies.
  const anonymous = await request.post(responseApi(baseURL!), {
    headers: {
      origin: new URL(baseURL!).origin,
      'x-participant-session': 'stale-revision',
      cookie: 'participant_session=current-revision',
    },
    data: { response: { choices: [1] }, liveQuizId, instanceId: 0 },
  })
  expect(anonymous.status()).toBe(409)

  const frame = await launch(
    page,
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  )
  const outcome = await settleLaunch(frame, () =>
    expectIdentity(frame, { email: ltiEmail, username: ltiUsername })
  )
  if (
    info.project.name.endsWith('-blocked') ||
    info.project.name.startsWith('webkit-')
  )
    expect(outcome).toBe('cookies-refused')
  const cookieSessions = outcome === 'accepted'
  if (!cookieSessions) {
    info.annotations.push({
      type: 'skipped-step',
      description:
        'Browser refused the shared cookie, so the frame fails closed before quiz access',
    })
    return
  }
  expect(await sessionRevision(frame)).toBeTruthy()

  // The practice quiz is answered in the frame under the shared cookie.
  await navigate(frame, `/course/${COURSE_ID_TEST}/practiceQuizzes/${quizId}`)
  await expect(frame.getByTestId('start-practice-quiz')).toBeVisible()
  await expect(
    frame.getByTestId('login-to-student-login-collect-points')
  ).toHaveCount(0)
  await frame.getByTestId('start-practice-quiz').click()
  await frame.getByTestId('sc-0-answer-option-1').click()
  await frame.getByTestId('student-stack-submit').click()
  await expect
    .poll(
      () =>
        prisma.questionResponse.count({
          where: { practiceQuizId: quizId, participantId: ltiId },
        }),
      { timeout: 30_000 }
    )
    .toBe(1)
  expect(
    await prisma.questionResponse.count({
      where: { practiceQuizId: quizId, participantId: loginId },
    })
  ).toBe(0)

  // The live quiz answer is attributed to the same shared cookie participant;
  // a request carrying a mismatched revision is refused instead.
  await lecturer(
    request,
    baseURL!,
    'mutation ($id: String!) { startLiveQuiz(id: $id) { id } }',
    { id: liveQuizId }
  )
  const instanceId = (
    await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlockId: liveQuizBlockId },
    })
  ).id
  const participationSnapshot = participations.map(({ id, isActive }) => ({
    id,
    isActive,
  }))
  try {
    await prisma.participation.updateMany({
      where: { id: { in: participations.map(({ id }) => id) } },
      data: { isActive: true },
    })
    await lecturer(
      request,
      baseURL!,
      'mutation ($quizId: String!, $blockId: Int!) { activateLiveQuizBlock(quizId: $quizId, blockId: $blockId) { id } }',
      { quizId: liveQuizId, blockId: liveQuizBlockId }
    )
    await navigate(frame, `/session/${liveQuizId}`)
    const answer = page.waitForRequest(
      (item) => item.url() === responseApi(baseURL!) && item.method() === 'POST'
    )
    await frame.getByTestId('sc-0-answer-option-1').click()
    await frame.getByTestId('student-submit-answer').click()
    const sent = await answer
    const headers = await sent.allHeaders()
    expect(headers['x-participant-session']).toBe(await sessionRevision(frame))
    expect((await sent.response())?.status()).toBe(200)
    await expect
      .poll(
        async () =>
          (
            await lecturer(
              request,
              baseURL!,
              'query ($id: String!) { cockpitQuiz(id: $id) { blocks { id numOfParticipants } } }',
              { id: liveQuizId }
            )
          ).cockpitQuiz.blocks.find(
            ({ id }: { id: number }) => id === liveQuizBlockId
          )?.numOfParticipants,
        { timeout: 30_000 }
      )
      .toBe(1)
    await lecturer(
      request,
      baseURL!,
      'mutation ($quizId: String!, $blockId: Int!) { deactivateLiveQuizBlock(quizId: $quizId, blockId: $blockId) }',
      { quizId: liveQuizId, blockId: liveQuizBlockId }
    )
    const scored = await prisma.leaderboardEntry.findMany({
      where: { liveQuizId },
      select: { participantId: true },
    })
    expect(scored.map(({ participantId }) => participantId)).toEqual([ltiId])
  } finally {
    try {
      await lecturer(
        request,
        baseURL!,
        'mutation ($id: String!) { endLiveQuiz(id: $id) { id } }',
        { id: liveQuizId }
      )
    } finally {
      for (const { id, isActive } of participationSnapshot)
        await prisma.participation.update({ where: { id }, data: { isActive } })
    }
  }
})
