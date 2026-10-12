import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Frame,
  type Page,
  type Request,
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
  LECTURER_EMAIL,
  PARTICIPANT_IDS,
  STUDENT_PASSWORD,
  USER_ID_TEST,
} from '../util/constants.js'

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
// An allowed bridge launch redirects to the Chat app on its routed
// host (chat.klicker.localhost or chat.klicker.<workspace>.localhost).
const chatDestination = /^https:\/\/chat\./
let liveQuizBlockId: number
let chatbotId: string
let bridgeCourseId: string
let bridgeChatbotId: string
let bridgeMemberId: string
let bridgeOutsiderId: string
let email: string
let username: string
let elementId: number
const studentId = PARTICIPANT_IDS[1]!
const otherId = PARTICIPANT_IDS[0]!

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

async function launch(
  page: Page,
  destination: string,
  pathname = '/editProfile'
) {
  await page.route(`${lms}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body><iframe title="Synthetic LMS" src="${destination.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" style="width:100%;height:100vh"></iframe></body></html>`,
    })
  )
  await page.goto(`${lms}/launch`)
  await expect
    .poll(() =>
      page
        .frames()
        .find((item) => item.url().includes(pathname))
        ?.url()
    )
    .not.toBeUndefined()
  return page.frames().find((item) => item.url().includes(pathname))!
}

async function profile(frame: Frame) {
  await expect(frame.getByTestId('update-account-email')).toHaveValue(email)
  await expect(frame.getByTestId('update-account-username')).toHaveValue(
    username
  )
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

// Firefox denies a frame localStorage when it blocks all third-party cookies,
// and the practice quiz cannot render without it.
async function localStorageDenied(frame: Frame) {
  return frame.evaluate(() => {
    try {
      return !window.localStorage
    } catch {
      return true
    }
  })
}

// WebKit discards every cookie this local *.localhost stack sets, so cookie
// sessions cannot be exercised there.
function skipWithoutLocalCookies(projectName: string) {
  test.skip(
    projectName.startsWith('webkit-'),
    'WebKit discards cookies scoped to the local *.localhost domain'
  )
}

// The PWA resolves operation names from the GET query or the POST body. The
// lane runs development builds, but a built image can use GET persisted
// queries, so both shapes are recognized.
function graphqlOperationName(request: Request) {
  if (!request.url().includes('/api/graphql')) return null
  if (request.method() === 'GET')
    return new URL(request.url()).searchParams.get('operationName')
  try {
    return (
      (request.postDataJSON() as { operationName?: string } | null)
        ?.operationName ?? null
    )
  } catch {
    return null
  }
}

function waitForSelfResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/graphql') &&
      graphqlOperationName(response.request()) === 'Self'
  )
}

// The awaited post-login Self must arrive in cookie mode. A retained tab can
// still have an explicit-mode Layout request in flight, so consuming the
// first Self after a login click could assert the pre-transition identity.
function waitForCookieModeSelf(page: Page) {
  return page.waitForResponse(async (response) => {
    if (
      !response.url().includes('/api/graphql') ||
      graphqlOperationName(response.request()) !== 'Self'
    )
      return false
    const authorization = (await response.request().allHeaders()).authorization
    return !authorization || !authorization.startsWith('Bearer ')
  })
}

// Assert the error state without depending on translated feedback copy.
function toastItems(page: Page) {
  return page.locator('[data-sonner-toast][data-type="error"]')
}

// The bridge hands an allowed launch to the Chat app. Fulfilling the
// destination keeps the check on this stack without claiming Chat's own
// authenticated principal.
async function interceptChatDestination(context: BrowserContext) {
  const chatRequests: string[] = []
  await context.route(chatDestination, async (route) => {
    chatRequests.push(route.request().url())
    await route.fulfill({
      contentType: 'text/html',
      body: '<html><body><div data-cy="synthetic-chat-destination">Synthetic chat destination</div></body></html>',
    })
  })
  return chatRequests
}

// Stores an explicit credential in this tab and reloads the page so it binds
// it. An init script would seed the credential again after the tab clears it,
// which the lifecycle checks below must observe instead.
async function retainExplicitSession(
  page: Page,
  baseURL: string,
  token: string
) {
  await page.goto(`${baseURL}/editProfile`)
  await page.evaluate(
    (value) => sessionStorage.setItem('participant_token', value),
    token
  )
  await page.reload()
}

async function storedExplicitToken(page: Page) {
  return page.evaluate(() => sessionStorage.getItem('participant_token'))
}

// Decodes the participant credential a request carried without pinning its
// value: sub identifies the participant and exp its expiry.
async function explicitBearerPayload(request: Request) {
  const bearer = /^Bearer (.+)$/.exec(
    (await request.allHeaders()).authorization ?? ''
  )?.[1]
  if (!bearer) return null
  return JSON.parse(
    Buffer.from(bearer.split('.')[1]!, 'base64url').toString()
  ) as { sub?: string; exp?: number }
}

async function expectParticipantIdentity(
  subject: Page | Frame,
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

// Lecturer operations go through the API so the live quiz state in the cache
// is the one the response pipeline relies on.
async function lecturer(
  request: APIRequestContext,
  baseURL: string,
  query: string,
  variables: Record<string, unknown>
) {
  const token = await signed({
    email: LECTURER_EMAIL,
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
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: studentId },
  })
  email = participant.email!
  username = participant.username
  // The global setup seeds users, courses and participants but no chatbot;
  // the header chatbot gate needs a published chatbot on the seeded course.
  // This synthetic bot is owned by the spec and is never a shared fixture.
  const chatbot = await prisma.chatbot.create({
    data: {
      name: 'Synthetic session recovery chatbot',
      status: 'PUBLISHED',
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
    },
  })
  chatbotId = chatbot.id
  // Membership-differential fixtures for the direct bridge: a member on a
  // spec-owned course and a valid participant without course access. Keeping
  // them separate avoids touching seeded memberships or shared fixtures.
  const bridgeCourse = await prisma.course.create({
    data: {
      name: `Synthetic session recovery bridge course ${randomUUID().slice(0, 8)}`,
      displayName: 'Synthetic session recovery bridge course',
      authType: 'SSO',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      groupDeadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      owner: { connect: { id: USER_ID_TEST } },
    },
  })
  bridgeCourseId = bridgeCourse.id
  bridgeChatbotId = (
    await prisma.chatbot.create({
      data: {
        name: 'Synthetic session recovery bridge chatbot',
        status: 'PUBLISHED',
        ownerId: USER_ID_TEST,
        courseId: bridgeCourseId,
      },
    })
  ).id
  const bridgeMember = await prisma.participant.create({
    data: {
      username: `pa${randomUUID().slice(0, 8)}`,
      email: `bridge-member-${randomUUID()}@example.invalid`,
      password: randomUUID(),
      ...completedDataUse(),
    },
  })
  bridgeMemberId = bridgeMember.id
  const bridgeOutsider = await prisma.participant.create({
    data: {
      username: `pa${randomUUID().slice(0, 8)}`,
      email: `bridge-outsider-${randomUUID()}@example.invalid`,
      password: randomUUID(),
      ...completedDataUse(),
    },
  })
  bridgeOutsiderId = bridgeOutsider.id
  await prisma.participation.create({
    data: { courseId: bridgeCourseId, participantId: bridgeMemberId },
  })
  await prisma.participantAccount.create({
    data: {
      ssoId,
      ssoEmail: email,
      ssoType: 'LTI1.3',
      participantId: studentId,
    },
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
  if (chatbotId) await prisma.chatbot.deleteMany({ where: { id: chatbotId } })
  if (bridgeChatbotId)
    await prisma.chatbot.deleteMany({ where: { id: bridgeChatbotId } })
  for (const id of [bridgeMemberId, bridgeOutsiderId]) {
    if (id) await prisma.participant.deleteMany({ where: { id } })
  }
  if (bridgeCourseId)
    await prisma.course.deleteMany({ where: { id: bridgeCourseId } })
})

test('fresh embedded launch without email restores linked B, supersedes retained A and supports quiz access', async ({
  page,
  context,
  baseURL,
  browser,
}, info) => {
  expect(new URL(baseURL!).protocol).toBe('https:')
  const a = await signed({ sub: otherId, role: 'PARTICIPANT' }, '14d')
  await context.addCookies([
    {
      name: 'participant_token',
      value: a,
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  await context.addInitScript((token) => {
    if (window.location.hostname !== 'lms.example.invalid') {
      try {
        if (!sessionStorage.getItem('participant_token'))
          sessionStorage.setItem('participant_token', token)
      } catch {}
    }
  }, a)
  const jwt = await signed({ sub: ssoId, scope: 'LTI1.3' })
  const nativeRequests = new Map<
    string,
    { url?: string; cookieSent?: boolean; blockedReasons?: string[] }
  >()
  const cdp = info.project.name.startsWith('chromium-')
    ? await context.newCDPSession(page)
    : undefined
  if (cdp) {
    await cdp.send('Network.enable')
    cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
      nativeRequests.set(requestId, {
        ...nativeRequests.get(requestId),
        url: request.url,
      })
    })
    cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
      // These headers reflect cookie policy after the network stack applies it.
      const cookie = Object.entries(event.headers).find(
        ([name]) => name.toLowerCase() === 'cookie'
      )?.[1]
      nativeRequests.set(event.requestId, {
        ...nativeRequests.get(event.requestId),
        cookieSent: /(?:^|;\s*)participant_token=/.test(cookie ?? ''),
        blockedReasons: event.associatedCookies
          .filter(({ cookie }) => cookie.name === 'participant_token')
          .flatMap(({ blockedReasons }) => blockedReasons),
      })
    })
  }
  const launchRequest = page.waitForRequest((request) =>
    request.url().startsWith(`${baseURL}/editProfile?jwt=`)
  )
  const frame = await launch(
    page,
    `${baseURL}/editProfile?jwt=${encodeURIComponent(jwt)}`
  )
  let participantCookieSent: boolean
  if (cdp) {
    const nativeLaunch = () =>
      [...nativeRequests.values()].find((request) =>
        request.url?.startsWith(`${baseURL}/editProfile?jwt=`)
      )
    await expect.poll(() => nativeLaunch()?.cookieSent).not.toBeUndefined()
    participantCookieSent = nativeLaunch()!.cookieSent!
    if (info.project.name.endsWith('-blocked'))
      expect(nativeLaunch()!.blockedReasons?.length).toBeGreaterThan(0)
  } else {
    const cookieHeader = (await (await launchRequest).allHeaders()).cookie ?? ''
    participantCookieSent = /(?:^|;\s*)participant_token=/.test(cookieHeader)
  }
  if (info.project.name.endsWith('-blocked'))
    expect(participantCookieSent).toBe(false)
  if (info.project.name === 'chromium-allowed')
    expect(participantCookieSent).toBe(true)
  await profile(frame)
  await info.attach('browser-provenance', {
    body: JSON.stringify({
      engine: browser.version(),
      project: info.project.name,
      topLevel: lms,
      embeddedOrigin: new URL(baseURL!).origin,
      boundary: 'after ltijs verification',
    }),
    contentType: 'application/json',
  })
  if (await localStorageDenied(frame)) {
    info.annotations.push({
      type: 'skipped-step',
      description:
        'practice quiz needs localStorage, which this frame is denied',
    })
  } else {
    await navigate(frame, `/course/${COURSE_ID_TEST}/practiceQuizzes/${quizId}`)
    await expect(frame.getByTestId('start-practice-quiz')).toBeVisible()
    await expect(
      frame.getByTestId('login-to-student-login-collect-points')
    ).toHaveCount(0)
    await frame.getByTestId('start-practice-quiz').click()
    await frame.getByTestId('sc-0-answer-option-1').click()
    await frame.getByTestId('student-stack-submit').click()
    const prisma = await getPrisma()
    await expect
      .poll(() =>
        prisma.questionResponse.count({
          where: { practiceQuizId: quizId, participantId: studentId },
        })
      )
      .toBe(1)
    expect(
      await prisma.questionResponse.count({
        where: { practiceQuizId: quizId, participantId: otherId },
      })
    ).toBe(0)
  }
  // A full reload inside the frame keeps B: the cookie when the browser sends
  // one, otherwise the credential this tab kept, already on the first query.
  // A frame that is denied storage as well keeps B only until it reloads.
  const storageAvailable = await frame.evaluate(() => {
    try {
      return window.sessionStorage.getItem('participant_token') !== null
    } catch {
      return false
    }
  })
  const reloadSelf = page.waitForRequest(
    (request) =>
      request.url().includes('/api/graphql') &&
      /"operationName":"Self"|operationName=Self/.test(
        request.postData() ?? request.url()
      )
  )
  await frame.goto(`${baseURL}/editProfile`)
  const reloadHeaders = await (await reloadSelf).allHeaders()
  const credentialSent =
    /^Bearer \S+/.test(reloadHeaders.authorization ?? '') ||
    /(?:^|;\s*)participant_token=/.test(reloadHeaders.cookie ?? '')
  if (credentialSent) await profile(frame)
  else {
    expect(storageAvailable).toBe(false)
    await expect(
      frame.getByTestId('participant-session-recovery')
    ).toBeVisible()
    await frame.goto(
      `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
    )
    await profile(frame)
  }
  // A cookie session for another participant established later, e.g. by a
  // login in another tab, does not replace the identity this frame launched.
  await context.addCookies([
    {
      name: 'participant_token',
      value: a,
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  await frame.getByTestId('header-avatar').click()
  await frame.getByTestId('header-setup-profile').click()
  await profile(frame)
  await info.attach('authenticated-profile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})

test('registration preserves the fresh launch across a redirect with an old or missing LTI cookie', async ({
  page,
  context,
  baseURL,
}) => {
  const newSsoId = `synthetic-registration-${randomUUID()}`
  const newEmail = `${randomUUID()}@example.invalid`
  const jwt = await signed({
    sub: newSsoId,
    email: newEmail,
    scope: 'LTI1.3',
  })
  const older = await signed({ sub: ssoId, email, scope: 'LTI1.3' })
  for (const retainOldCookie of [true, false]) {
    await context.clearCookies()
    if (retainOldCookie) {
      await context.addCookies([
        {
          name: 'lti-token',
          value: older,
          domain: `.${process.env.COOKIE_DOMAIN!}`,
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'None',
        },
      ])
    }
    const frame = await launch(
      page,
      `${baseURL}/editProfile?jwt=${encodeURIComponent(jwt)}`,
      '/createAccount'
    )
    await expect(frame.getByTestId('email-field')).toHaveValue(newEmail)
    const registration = await frame.evaluate(() => {
      const data = JSON.parse(
        document.getElementById('__NEXT_DATA__')!.textContent!
      )
      return data.props.pageProps
    })
    expect(registration.sessionState).toBe('registration_required')
    expect(registration.signedLtiData).toBe(jwt)
    expect(registration.ssoId).toBe(newSsoId)
    await expect(frame.getByTestId('update-account-email')).toHaveCount(0)
  }
})

test('registration inside the frame lands on the new profile without a URL token', async ({
  page,
  baseURL,
}) => {
  const newSsoId = `synthetic-registration-${randomUUID()}`
  const newUsername = `pa${randomUUID().slice(0, 8)}`
  const newEmail = `${newUsername}@example.invalid`
  const jwt = await signed({ sub: newSsoId, email: newEmail, scope: 'LTI1.3' })
  const navigations: string[] = []
  page.on('framenavigated', (item) => navigations.push(item.url()))
  try {
    const frame = await launch(
      page,
      `${baseURL}/editProfile?jwt=${encodeURIComponent(jwt)}`,
      '/createAccount'
    )
    await expect(frame.getByTestId('email-field')).toHaveValue(newEmail)
    await frame.getByTestId('username-field-account-creation').fill(newUsername)
    await frame.getByTestId('password-field').fill('signupPassword123!')
    await frame
      .getByTestId('password-repetition-field')
      .fill('signupPassword123!')
    await frame.getByTestId('research-consent-toggle').click()
    await frame.getByTestId('research-consent-no').click()
    await frame.getByTestId('learning-analytics-consent-no').click()
    await frame.getByTestId('tos-checkbox').click()
    await frame.getByTestId('create-profile-button').click()
    await expect
      .poll(() => frame.url())
      .toContain('/editProfile?newAccount=true')
    await expect(frame.getByTestId('update-account-email')).toHaveValue(
      newEmail
    )
    await expect(frame.getByTestId('update-account-username')).toHaveValue(
      newUsername
    )
    expect(navigations.some((url) => url.includes('participantToken'))).toBe(
      false
    )
  } finally {
    const prisma = await getPrisma()
    await prisma.participant.deleteMany({ where: { email: newEmail } })
  }
})

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

// Runs the whole LTI 1.3 launch: the synthetic LMS initiates the OIDC login,
// the real LTI service (ltijs) redirects to the mocked authorization endpoint,
// which posts back an RS256 id_token. ltijs verifies it and hands the PWA its
// one-time jwt. Production, like this stack, runs ltijs in dev mode, so a
// frame without third-party cookies still passes the state check.
test('a full LTI 1.3 launch through the tool signs in the linked account in the frame and at top level', async ({
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
  const authRequests: URLSearchParams[] = []
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
          login_hint: ssoId,
          target_link_uri: `${tool}/`,
          client_id: clientId,
          lti_deployment_id: deploymentId,
        }),
      })
    if (url.pathname !== '/auth') return route.fulfill({ status: 404 })
    const params = url.searchParams
    authRequests.push(params)
    const claim = 'https://purl.imsglobal.org/spec/lti/claim'
    const idToken = await new SignJWT({
      nonce: params.get('nonce'),
      email,
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
      .setSubject(ssoId)
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

  let launched = handoff()
  await page.goto(`${lms}/course`)
  await launched
  await expect
    .poll(() =>
      page.frames().find((item) => item.url().includes('/editProfile'))
    )
    .not.toBeUndefined()
  await profile(
    page.frames().find((item) => item.url().includes('/editProfile'))!
  )

  await context.clearCookies()
  launched = handoff()
  await page.goto(`${lms}/initiate`)
  await launched
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
  await profile(page.mainFrame())

  expect(authRequests).toHaveLength(2)
  for (const params of authRequests) {
    expect(Object.fromEntries(params)).toMatchObject({
      response_type: 'id_token',
      response_mode: 'form_post',
      scope: 'openid',
      prompt: 'none',
      client_id: clientId,
      login_hint: ssoId,
      lti_deployment_id: deploymentId,
      redirect_uri: `${tool}/`,
    })
    expect(params.get('nonce')).toBeTruthy()
    expect(params.get('state')).toBeTruthy()
  }

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
})

test('memory-only B survives navigation and full reload settles before a fresh relaunch', async ({
  page,
  context,
  baseURL,
}) => {
  const observedSelf: (string | null)[] = []
  page.on('response', async (response) => {
    if (!response.url().includes('/api/graphql')) return
    try {
      const data = await response.json()
      if (data.data && Object.hasOwn(data.data, 'self'))
        observedSelf.push(data.data.self?.id ?? null)
    } catch {}
  })
  await context.addInitScript(() => {
    if (window.location.hostname !== 'lms.example.invalid')
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException('Synthetic storage denial', 'SecurityError')
        },
      })
  })
  // Cookie removal is fault injection here; native cookie restrictions are checked separately.
  await context.route('**/api/graphql*', async (route) => {
    const headers = { ...route.request().headers() }
    delete headers.cookie
    const response = await route.fetch({ headers })
    const responseHeaders = { ...response.headers() }
    delete responseHeaders['set-cookie']
    await route.fulfill({ response, headers: responseHeaders })
  })
  const jwt = await signed({ sub: ssoId, email, scope: 'LTI1.3' })
  const frame = await launch(
    page,
    `${baseURL}/editProfile?jwt=${encodeURIComponent(jwt)}`
  )
  await profile(frame)
  await context.clearCookies()
  if (!(await localStorageDenied(frame))) {
    await navigate(frame, `/course/${COURSE_ID_TEST}/practiceQuizzes/${quizId}`)
    await expect(frame.getByTestId('start-practice-quiz')).toBeVisible()
  }
  await navigate(frame, '/editProfile')
  await profile(frame)
  await frame.goto(`${baseURL}/editProfile`)
  await expect(frame.getByTestId('update-account-email')).toHaveCount(0)
  await expect(frame.getByTestId('participant-session-recovery')).toBeVisible()
  for (const variant of [
    { locale: 'en', viewport: { width: 1440, height: 1000 } },
    { locale: 'de', viewport: { width: 390, height: 844 } },
  ]) {
    await page.setViewportSize(variant.viewport)
    await frame.goto(`${baseURL}/${variant.locale}/editProfile`)
    await expect(
      frame.getByTestId('participant-session-recovery')
    ).toBeVisible()
    await test.info().attach(`anonymous-${variant.locale}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
  for (const variant of [
    { locale: 'en', viewport: { width: 1440, height: 1000 } },
    { locale: 'de', viewport: { width: 390, height: 844 } },
  ]) {
    await page.setViewportSize(variant.viewport)
    await frame.goto(
      `${baseURL}/${variant.locale}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, email, scope: 'LTI1.3' }, Math.floor(Date.now() / 1000) - 60))}`
    )
    await expect(frame.getByTestId('fresh-launch-recovery')).toBeVisible()
    await test.info().attach(`fresh-launch-${variant.locale}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
  await frame.goto(
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, email, scope: 'LTI1.3' }))}`
  )
  await profile(frame)
  expect(observedSelf).not.toContain(otherId)
})

test('a failed profile query offers one manual retry and recovers the intended identity', async ({
  page,
  baseURL,
}) => {
  let failSelf = true
  await page.route('**/api/graphql*', async (route) => {
    const request = route.request()
    const operationName =
      request.method() === 'GET'
        ? new URL(request.url()).searchParams.get('operationName')
        : request.postDataJSON()?.operationName
    if (operationName === 'Self' && failSelf) {
      await route.fulfill({ status: 503, body: 'Synthetic query outage' })
    } else await route.continue()
  })
  for (const variant of [
    { locale: 'en', viewport: { width: 1440, height: 1000 } },
    { locale: 'de', viewport: { width: 390, height: 844 } },
  ]) {
    failSelf = true
    await page.setViewportSize(variant.viewport)
    const frame = await launch(
      page,
      `${baseURL}/${variant.locale}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, email, scope: 'LTI1.3' }))}`
    )
    await expect(frame.getByTestId('participant-session-error')).toBeVisible()
    await expect(frame.getByTestId('update-account-email')).toHaveCount(0)
    await expect(frame.getByTestId('participant-session-retry')).toBeEnabled()
    await test.info().attach(`query-error-${variant.locale}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    failSelf = false
    await frame.getByTestId('participant-session-retry').click()
    await profile(frame)
  }
})

test('a participant token in the URL cannot replace or create a session', async ({
  page,
  context,
  baseURL,
}, info) => {
  skipWithoutLocalCookies(info.project.name)
  const other = await signed({ sub: otherId, role: 'PARTICIPANT' }, '14d')
  await page.goto(
    `${baseURL}/editProfile?participantToken=${encodeURIComponent(other)}`
  )
  await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
  await context.addCookies([
    {
      name: 'participant_token',
      value: await signed({ sub: studentId, role: 'PARTICIPANT' }, '14d'),
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  await page.goto(
    `${baseURL}/editProfile?participantToken=${encodeURIComponent(other)}`
  )
  await profile(page.mainFrame())
})

test('logout ends the shared cookie session in tabs that authenticate with the cookie', async ({
  page,
  context,
  baseURL,
}, info) => {
  skipWithoutLocalCookies(info.project.name)
  await context.addCookies([
    {
      name: 'participant_token',
      value: await signed({ sub: studentId, role: 'PARTICIPANT' }, '14d'),
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  const other = await context.newPage()
  await other.goto(`${baseURL}/editProfile`)
  await profile(other.mainFrame())
  await page.goto(`${baseURL}/editProfile`)
  await profile(page.mainFrame())
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'participant_token'
    )
  ).toBe(false)
  await page.goto(`${baseURL}/editProfile`)
  await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(page.getByTestId('update-account-email')).toHaveCount(0)
  // The other tab never held a copy of the cookie session.
  await other.goto(`${baseURL}/editProfile`)
  await expect(other.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(other.getByTestId('update-account-email')).toHaveCount(0)
})

test('password, magic-link and activation success replace an active explicit session with the ordinary cookie identity', async ({
  page,
  context,
  baseURL,
}, info) => {
  test.setTimeout(120_000)
  skipWithoutLocalCookies(info.project.name)
  const prisma = await getPrisma()
  const participants = await prisma.participant.findMany({
    where: { id: { in: [otherId, studentId] } },
  })
  const expectIdentity = async (id: string) => {
    const participant = participants.find((item) => item.id === id)!
    await expect(page.getByTestId('update-account-email')).toHaveValue(
      participant.email!
    )
    await expect(page.getByTestId('update-account-username')).toHaveValue(
      participant.username
    )
  }
  // Each iteration starts from an active explicit session in this tab, never
  // from cleared storage, and proves the tab ends on the cookie identity.
  for (const { retained, target } of [
    { retained: studentId, target: otherId },
    { retained: otherId, target: studentId },
    { retained: studentId, target: otherId },
  ] as const) {
    await context.clearCookies()
    await retainExplicitSession(
      page,
      baseURL!,
      await signed({ sub: retained, role: 'PARTICIPANT' }, '14d')
    )
    await expectIdentity(retained)
    await page.goto(`${baseURL}/login?redirect_to=/editProfile`)
    const identitySelf = waitForCookieModeSelf(page)
    const participant = participants.find((item) => item.id === target)!
    await page.getByTestId('username-field').fill(participant.username)
    await page.getByTestId('password-field').fill(STUDENT_PASSWORD)
    const loginResponse = page.waitForResponse(
      (response) =>
        graphqlOperationName(response.request()) === 'LoginParticipant'
    )
    await page.getByTestId('submit-login').click()
    expect(
      (await (await loginResponse).json()).data.loginParticipant
    ).toBeTruthy()
    await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
    const response = await identitySelf
    const headers = await response.request().allHeaders()
    expect(headers.authorization ?? '').not.toMatch(/^Bearer /)
    expect((await response.json()).data.self.id).toBe(target)
    await expectIdentity(target)
    expect(await storedExplicitToken(page)).toBeNull()
  }
  for (const [path, scope, retained, target] of [
    ['magicLogin', 'OTP', otherId, studentId],
    ['activation', 'ACTIVATION', studentId, otherId],
  ] as const) {
    await context.clearCookies()
    await retainExplicitSession(
      page,
      baseURL!,
      await signed({ sub: retained, role: 'PARTICIPANT' }, '14d')
    )
    await expectIdentity(retained)
    const token = await signed({ sub: target, scope })
    await page.goto(`${baseURL}/${path}?token=${encodeURIComponent(token)}`)
    await expect(page.getByTestId('homepage')).toBeVisible()
    expect(await storedExplicitToken(page)).toBeNull()
    const identitySelf = waitForCookieModeSelf(page)
    await page.goto(`${baseURL}/editProfile`)
    const response = await identitySelf
    const headers = await response.request().allHeaders()
    expect(headers.authorization ?? '').not.toMatch(/^Bearer /)
    expect((await response.json()).data.self.id).toBe(target)
    await expectIdentity(target)
  }
})

test('an ordinary login and logout in another tab leave this tab attributed to its explicit identity', async ({
  page,
  context,
  baseURL,
}, info) => {
  skipWithoutLocalCookies(info.project.name)
  const prisma = await getPrisma()
  const participants = await prisma.participant.findMany({
    where: { id: { in: [otherId, studentId] } },
  })
  const explicitParticipant = participants.find(
    (item) => item.id === studentId
  )!
  const cookieParticipant = participants.find((item) => item.id === otherId)!
  const explicitToken = await signed(
    { sub: studentId, role: 'PARTICIPANT' },
    '14d'
  )
  await retainExplicitSession(page, baseURL!, explicitToken)
  await expectParticipantIdentity(page, explicitParticipant)
  const observedSelf: (string | null)[] = []
  page.on('response', async (response) => {
    if (!response.url().includes('/api/graphql')) return
    try {
      const data = await response.json()
      if (data.data && Object.hasOwn(data.data, 'self'))
        observedSelf.push(data.data.self?.id ?? null)
    } catch {}
  })

  // The ordinary login in the second tab replaces the shared cookie only;
  // this tab never authenticates with it.
  const other = await context.newPage()
  await other.goto(`${baseURL}/login?redirect_to=/editProfile`)
  await other.getByTestId('username-field').fill(cookieParticipant.username)
  await other.getByTestId('password-field').fill(STUDENT_PASSWORD)
  await other.getByTestId('submit-login').click()
  await expect(other).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
  await expectParticipantIdentity(other, cookieParticipant)
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'participant_token'
    )
  ).toBe(true)

  // This tab keeps sending its explicit credential and shows its own identity.
  const afterLogin = page.waitForRequest(
    (request) => graphqlOperationName(request) === 'Self'
  )
  await page.goto(`${baseURL}/editProfile`)
  expect((await explicitBearerPayload(await afterLogin))?.sub).toBe(studentId)
  await expectParticipantIdentity(page, explicitParticipant)

  // Logout in the second tab ends the cookie session for that tab.
  await other.getByTestId('header-avatar').click()
  await other.getByTestId('logout').click()
  await expect(other).toHaveURL(/\/login(?:\?|$)/)
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'participant_token'
    )
  ).toBe(false)

  // This tab still holds and sends its own credential afterwards.
  const afterLogout = page.waitForRequest(
    (request) => graphqlOperationName(request) === 'Self'
  )
  await page.goto(`${baseURL}/editProfile`)
  expect((await explicitBearerPayload(await afterLogout))?.sub).toBe(studentId)
  await expectParticipantIdentity(page, explicitParticipant)
  expect(await storedExplicitToken(page)).toBe(explicitToken)
  expect(observedSelf).not.toContain(otherId)
})

test('a declined header logout keeps the explicit identity and its retry ends it without falling back to the cookie', async ({
  page,
  context,
  baseURL,
}, info) => {
  skipWithoutLocalCookies(info.project.name)
  const prisma = await getPrisma()
  const explicitParticipant = await prisma.participant.findUniqueOrThrow({
    where: { id: studentId },
  })
  await context.addCookies([
    {
      name: 'participant_token',
      value: await signed({ sub: otherId, role: 'PARTICIPANT' }, '14d'),
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  await retainExplicitSession(
    page,
    baseURL!,
    await signed({ sub: studentId, role: 'PARTICIPANT' }, '14d')
  )
  await expectParticipantIdentity(page, explicitParticipant)

  // The server-declared rejection is fulfilled before any backend mutation.
  await page.route('**/api/graphql*', async (route) => {
    if (graphqlOperationName(route.request()) === 'LogoutParticipant') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { logoutParticipant: null } }),
      })
    } else await route.continue()
  })
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('logout').click()
  await expect(toastItems(page).first()).toBeVisible()
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
  await expectParticipantIdentity(page, explicitParticipant)
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'participant_token'
    )
  ).toBe(true)

  const retained = page.waitForRequest(
    (request) => graphqlOperationName(request) === 'Self'
  )
  await page.goto(`${baseURL}/editProfile`)
  expect((await explicitBearerPayload(await retained))?.sub).toBe(studentId)
  await expectParticipantIdentity(page, explicitParticipant)

  // The retry runs the real command: this tab's credential and the applicable
  // cookie both end, and the page settles into recovery.
  await page.unroute('**/api/graphql*')
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'participant_token'
    )
  ).toBe(false)
  expect(await storedExplicitToken(page)).toBeNull()
  await page.goto(`${baseURL}/editProfile`)
  await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(page.getByTestId('update-account-email')).toHaveCount(0)
  await expect(page.getByTestId('participant-session-login')).toBeVisible()
})

test('a declined account deletion keeps the disposable participant and a retry deletes it', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000)
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
  try {
    await retainExplicitSession(
      page,
      baseURL!,
      await signed({ sub: disposable.id, role: 'PARTICIPANT' }, '14d')
    )
    await expectParticipantIdentity(page, disposable)

    // The false result is declared before any backend mutation runs.
    let declineDelete = true
    await page.route('**/api/graphql*', async (route) => {
      if (
        declineDelete &&
        graphqlOperationName(route.request()) === 'DeleteParticipantAccount'
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
    // The declined command renders feedback, closes the modal, and leaves both
    // the account and this tab's credential intact.
    await expect(toastItems(page).first()).toBeVisible()
    await expect(page.getByTestId('delete-account-command')).toBeHidden()
    expect(
      await prisma.participant.findUnique({ where: { id: disposable.id } })
    ).not.toBeNull()

    const retained = page.waitForRequest(
      (request) => graphqlOperationName(request) === 'Self'
    )
    await page.goto(`${baseURL}/editProfile`)
    expect((await explicitBearerPayload(await retained))?.sub).toBe(
      disposable.id
    )
    await expectParticipantIdentity(page, disposable)

    // The retry runs the real command and ends this synthetic session.
    declineDelete = false
    await page.getByTestId('confirm-delete-account').click()
    await page.getByTestId('delete-account-command').click()
    await expect
      .poll(() =>
        prisma.participant.findUnique({ where: { id: disposable.id } })
      )
      .toBeNull()
    await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
    await expect(page.getByTestId('update-account-email')).toHaveCount(0)
    expect(await storedExplicitToken(page)).toBeNull()
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === 'participant_token'
      )
    ).toBe(false)
  } finally {
    await prisma.participant.deleteMany({ where: { id: disposable.id } })
  }
})

test('an expired retained credential does not fall back to a valid ambient cookie and a fresh launch recovers', async ({
  page,
  context,
  baseURL,
}, info) => {
  test.setTimeout(120_000)
  skipWithoutLocalCookies(info.project.name)
  const prisma = await getPrisma()
  const ambientParticipant = await prisma.participant.findUniqueOrThrow({
    where: { id: otherId },
  })
  await context.addCookies([
    {
      name: 'participant_token',
      value: await signed({ sub: otherId, role: 'PARTICIPANT' }, '14d'),
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  await page.goto(`${baseURL}/editProfile`)
  await expectParticipantIdentity(page, ambientParticipant)
  await page.evaluate(
    (value) => sessionStorage.setItem('participant_token', value),
    await signed(
      { sub: studentId, role: 'PARTICIPANT' },
      Math.floor(Date.now() / 1000) - 60
    )
  )

  // The unusable bearer is authoritative: the page settles into recovery
  // without an identity from the still-valid ambient cookie and without the
  // login redirect an Unauthorized error would trigger.
  const expiredSelf = page.waitForRequest(
    (request) => graphqlOperationName(request) === 'Self'
  )
  const recoverySelf = waitForSelfResponse(page)
  await page.reload()
  await expect(page.getByTestId('participant-session-recovery')).toBeVisible()
  await expect(page.getByTestId('participant-session-login')).toBeVisible()
  await expect(page.getByTestId('update-account-email')).toHaveCount(0)
  await expect(page).toHaveURL((url) => url.pathname === '/editProfile')
  const expiredPayload = await explicitBearerPayload(await expiredSelf)
  expect(expiredPayload?.sub).toBe(studentId)
  expect(expiredPayload?.exp).toBeLessThan(Date.now() / 1000)
  expect((await (await recoverySelf).json()).data.self).toBeNull()

  // The same expired credential also fails a protected, read-only membership
  // operation while the valid ambient cookie is still attached by the browser.
  const protectedResult = await page.evaluate(
    async ({ apiUrl, courseId }) => {
      const response = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-graphql-yoga-csrf': 'true',
          authorization: `Bearer ${sessionStorage.getItem('participant_token')}`,
        },
        body: JSON.stringify({
          query:
            'mutation EnsureParticipation($courseId: String!) { ensureParticipation(courseId: $courseId) }',
          operationName: 'EnsureParticipation',
          variables: { courseId },
        }),
      })
      return response.json()
    },
    {
      apiUrl: `${baseURL!.replace('://pwa.', '://api.')}/api/graphql`,
      courseId: COURSE_ID_TEST,
    }
  )
  expect(protectedResult.data?.ensureParticipation).not.toBe(true)
  expect(protectedResult.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ message: 'Unauthorized' }),
    ])
  )

  // The ambient cookie is valid for this browser: removing only the tab's
  // credential reveals it, which the settled recovery above refused to do.
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await expectParticipantIdentity(page, ambientParticipant)

  // A fresh handoff replaces the tab session with the launched participant.
  const launchSelf = waitForSelfResponse(page)
  await page.goto(
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  )
  expect((await (await launchSelf).json()).data.self.id).toBe(studentId)
  await expectParticipantIdentity(
    page,
    await prisma.participant.findUniqueOrThrow({ where: { id: studentId } })
  )
  const stored = (await storedExplicitToken(page))!
  const storedPayload = JSON.parse(
    Buffer.from(stored.split('.')[1]!, 'base64url').toString()
  ) as { sub?: string; exp?: number }
  expect(storedPayload.sub).toBe(studentId)
  expect(storedPayload.exp).toBeGreaterThan(Date.now() / 1000)
})

test('the course chatbot entry gate makes no bridge request while an explicit credential exists', async ({
  page,
  context,
  baseURL,
}, info) => {
  test.setTimeout(120_000)
  skipWithoutLocalCookies(info.project.name)
  const prisma = await getPrisma()
  const cookieParticipant = await prisma.participant.findUniqueOrThrow({
    where: { id: otherId },
  })
  await retainExplicitSession(
    page,
    baseURL!,
    await signed({ sub: studentId, role: 'PARTICIPANT' }, '14d')
  )
  const bridgeRequests: string[] = []
  const popups: Page[] = []
  page.on('request', (request) => {
    if (request.url().includes(`/course/${COURSE_ID_TEST}/chatbot/`))
      bridgeRequests.push(request.url())
  })
  page.on('popup', (popup) => popups.push(popup))

  // Explicit B without a cookie: recovery guidance instead of the bridge.
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'participant_token'
    )
  ).toBe(false)
  const courseUrl = `${baseURL}/course/${COURSE_ID_TEST}`
  await page.goto(courseUrl)
  await expect(
    page.getByTestId('student-course-chatbot-recovery')
  ).toBeVisible()
  await expect(page.getByTestId('student-course-chatbot-link')).toHaveCount(0)
  expect(bridgeRequests).toEqual([])
  expect(popups).toEqual([])
  await page.getByTestId('student-course-chatbot-recovery').click()
  await expect(page.getByTestId('course-chatbot-recovery-modal')).toBeVisible()
  await page.getByTestId('course-chatbot-recovery-close').click()
  await expect(page.getByTestId('course-chatbot-recovery-modal')).toBeHidden()
  await page.getByTestId('student-course-chatbot-recovery').click()
  await page.getByTestId('course-chatbot-recovery-cancel').click()
  await expect(page.getByTestId('course-chatbot-recovery-modal')).toBeHidden()
  expect(bridgeRequests).toEqual([])
  expect(popups).toEqual([])

  const explicitParticipant = await prisma.participant.findUniqueOrThrow({
    where: { id: studentId },
  })
  const afterCancel = waitForSelfResponse(page)
  await page.goto(`${baseURL}/editProfile`)
  const retainedResponse = await afterCancel
  expect((await explicitBearerPayload(retainedResponse.request()))?.sub).toBe(
    studentId
  )
  expect((await retainedResponse.json()).data.self.id).toBe(studentId)
  await expectParticipantIdentity(page, explicitParticipant)

  // A conflicting ambient cookie keeps the same conservative gate.
  await context.addCookies([
    {
      name: 'participant_token',
      value: await signed({ sub: otherId, role: 'PARTICIPANT' }, '14d'),
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  const conflictingSelf = waitForSelfResponse(page)
  await page.goto(courseUrl)
  const conflictingResponse = await conflictingSelf
  expect(
    (await explicitBearerPayload(conflictingResponse.request()))?.sub
  ).toBe(studentId)
  expect((await conflictingResponse.json()).data.self.id).toBe(studentId)
  await expect(
    page.getByTestId('student-course-chatbot-recovery')
  ).toBeVisible()
  await expect(page.getByTestId('student-course-chatbot-link')).toHaveCount(0)
  expect(bridgeRequests).toEqual([])

  // An ordinary login in this tab ends the explicit credential and restores
  // the cookie-mode link.
  await page.getByTestId('student-course-chatbot-recovery').click()
  await page.getByTestId('course-chatbot-recovery-login').click()
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/login' &&
      url.searchParams.get('redirect_to') === `/course/${COURSE_ID_TEST}`
  )
  await page.getByTestId('username-field').fill(cookieParticipant.username)
  await page.getByTestId('password-field').fill(STUDENT_PASSWORD)
  await page.getByTestId('submit-login').click()
  await expect(page).toHaveURL((url) =>
    url.pathname.endsWith(`/course/${COURSE_ID_TEST}`)
  )
  await expect(page.getByTestId('student-course-chatbot-link')).toBeVisible()
  await expect(page.getByTestId('student-course-chatbot-recovery')).toHaveCount(
    0
  )
  expect(await storedExplicitToken(page)).toBeNull()
  const identitySelf = waitForCookieModeSelf(page)
  await page.goto(`${baseURL}/editProfile`)
  const response = await identitySelf
  const headers = await response.request().allHeaders()
  expect(headers.authorization ?? '').not.toMatch(/^Bearer /)
  expect((await response.json()).data.self.id).toBe(otherId)
  expect(popups).toEqual([])

  const chatRequests = await interceptChatDestination(context)
  await page.goto(courseUrl)
  const chatLink = page.locator('a').filter({
    has: page.getByTestId('student-course-chatbot-link'),
  })
  await expect(chatLink).toHaveAttribute('target', '_blank')
  const bridgePath = await chatLink.getAttribute('href')
  expect(bridgePath).toContain(`/course/${COURSE_ID_TEST}/chatbot/`)
  const popupPromise = page.waitForEvent('popup')
  await chatLink.click()
  const popup = await popupPromise
  await expect(popup.getByTestId('synthetic-chat-destination')).toBeVisible()
  expect(new URL(popup.url()).pathname).toBe(
    `/${bridgePath!.split('/').at(-1)}`
  )
  expect(chatRequests).toHaveLength(1)
  await popup.close()

  // A fresh OLAT launch restores an explicit session and therefore still
  // needs ordinary login before another cross-app bridge navigation.
  await page.goto(
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  )
  await expectParticipantIdentity(page, explicitParticipant)
  await page.goto(courseUrl)
  await expect(
    page.getByTestId('student-course-chatbot-recovery')
  ).toBeVisible()
  await expect(page.getByTestId('student-course-chatbot-link')).toHaveCount(0)
  expect(chatRequests).toHaveLength(1)
})

test('the direct chatbot bridge authorizes its own cookie principal despite a conflicting tab credential', async ({
  context,
  baseURL,
}, info) => {
  skipWithoutLocalCookies(info.project.name)
  const chatRequests = await interceptChatDestination(context)
  const bridgePath = `/course/${bridgeCourseId}/chatbot/${bridgeChatbotId}`
  for (const cookieId of [null, bridgeMemberId, bridgeOutsiderId]) {
    await context.clearCookies()
    if (cookieId) {
      await context.addCookies([
        {
          name: 'participant_token',
          value: await signed({ sub: cookieId, role: 'PARTICIPANT' }, '14d'),
          domain: `.${process.env.COOKIE_DOMAIN!}`,
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'None',
        },
      ])
    }
    const page = await context.newPage()
    const explicitId =
      cookieId === bridgeMemberId ? bridgeOutsiderId : bridgeMemberId
    await retainExplicitSession(
      page,
      baseURL!,
      await signed({ sub: explicitId, role: 'PARTICIPANT' }, '14d')
    )
    const ownRequest = page.waitForRequest(
      (request) =>
        request.isNavigationRequest() &&
        new URL(request.url()).pathname.endsWith(bridgePath)
    )
    const redirectsBefore = chatRequests.length
    await page.goto(`${baseURL}${bridgePath}`)
    expect(
      (await (await ownRequest).allHeaders()).authorization ?? ''
    ).not.toMatch(/^Bearer /)
    if (!cookieId) {
      await expect(page).toHaveURL(
        (url) =>
          url.pathname.endsWith('/login') &&
          (url.searchParams.get('redirect_to') ?? '').endsWith(bridgePath)
      )
      expect(chatRequests).toHaveLength(redirectsBefore)
    } else if (cookieId === bridgeMemberId) {
      await expect(page.getByTestId('synthetic-chat-destination')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe(`/${bridgeChatbotId}`)
      expect(chatRequests).toHaveLength(redirectsBefore + 1)
    } else {
      await expect(page).toHaveURL((url) => url.pathname.endsWith(bridgePath))
      // The server-generated result is structured evidence of the failed
      // membership check, independent of localized notification wording.
      expect(
        await page
          .locator('#__NEXT_DATA__')
          .evaluate(
            (element) =>
              JSON.parse(element.textContent!).props.pageProps
                .participationError
          )
      ).toBe(true)
      await expect(
        page.locator(`a[href$="/course/${bridgeCourseId}"]`).last()
      ).toBeVisible()
      expect(chatRequests).toHaveLength(redirectsBefore)
    }
    await page.close()
  }
})

test('a live quiz answer counts for the participant the frame shows, not a later cookie session', async ({
  page,
  context,
  baseURL,
  request,
}, info) => {
  const prisma = await getPrisma()
  const participations = await prisma.participation.findMany({
    where: {
      courseId: COURSE_ID_TEST,
      participantId: { in: [studentId, otherId] },
    },
  })
  expect(participations).toHaveLength(2)
  const responseApi = `${baseURL!.replace('://pwa.', '://response-api.')}/AddResponse`
  const a = await signed({ sub: otherId, role: 'PARTICIPANT' }, '14d')
  const frame = await launch(
    page,
    `${baseURL}/editProfile?jwt=${encodeURIComponent(await signed({ sub: ssoId, scope: 'LTI1.3' }))}`
  )
  await profile(frame)
  // A cookie session for another participant established after the launch,
  // e.g. by a login in another tab, reaches the response API on every answer
  // the browser sends with cookies.
  await context.addCookies([
    {
      name: 'participant_token',
      value: a,
      domain: `.${process.env.COOKIE_DOMAIN!}`,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ])
  const started = await lecturer(
    request,
    baseURL!,
    'mutation ($id: String!) { startLiveQuiz(id: $id) { id } }',
    { id: liveQuizId }
  )
  expect(started.startLiveQuiz.id).toBe(liveQuizId)
  const instanceId = (
    await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlockId: liveQuizBlockId },
    })
  ).id
  try {
    // Leaderboard rows only exist for participants who opted in.
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
    // A credential the response API cannot use is refused instead of being
    // recorded under the cookie identity.
    const refused = await request.post(responseApi, {
      headers: {
        origin: new URL(baseURL!).origin,
        authorization: 'Bearer invalid',
        cookie: `participant_token=${a}`,
      },
      data: {
        response: { choices: [1] },
        liveQuizId,
        instanceId,
      },
    })
    expect(refused.status()).toBe(401)
    if (await localStorageDenied(frame)) {
      info.annotations.push({
        type: 'skipped-step',
        description: 'live quiz needs localStorage, which this frame is denied',
      })
      return
    }
    await navigate(frame, `/session/${liveQuizId}`)
    const answer = page.waitForRequest(
      (item) => item.url() === responseApi && item.method() === 'POST'
    )
    await frame.getByTestId('sc-0-answer-option-1').click()
    await frame.getByTestId('student-submit-answer').click()
    const sent = await answer
    const bearer = /^Bearer (\S+)$/.exec(
      (await sent.allHeaders()).authorization ?? ''
    )?.[1]
    expect(bearer).toBeDefined()
    expect(
      JSON.parse(Buffer.from(bearer!.split('.')[1]!, 'base64url').toString())
        .sub
    ).toBe(studentId)
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
          )?.numOfParticipants
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
    expect(scored.map(({ participantId }) => participantId)).toEqual([
      studentId,
    ])
  } finally {
    try {
      await lecturer(
        request,
        baseURL!,
        'mutation ($id: String!) { endLiveQuiz(id: $id) { id } }',
        { id: liveQuizId }
      )
    } finally {
      for (const { id, isActive } of participations)
        await prisma.participation.update({ where: { id }, data: { isActive } })
    }
  }
})
