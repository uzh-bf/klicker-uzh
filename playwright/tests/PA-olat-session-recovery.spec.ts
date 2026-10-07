import { expect, test, type Frame, type Page } from '@playwright/test'
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
import { getPrisma } from '../global-setup.js'
import {
  APP_SECRET,
  COURSE_ID_TEST,
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
let email: string
let username: string
let elementId: number
const studentId = PARTICIPANT_IDS[1]!
const otherId = PARTICIPANT_IDS[0]!

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
  if (elementId) await prisma.element.deleteMany({ where: { id: elementId } })
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

test('logout in one tab ends the session in every tab', async ({
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

test('password, magic-link and activation transitions navigate with the new identity', async ({
  page,
  context,
  baseURL,
}, info) => {
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
  for (const id of [otherId, studentId, otherId]) {
    await context.clearCookies()
    await page.goto('about:blank')
    await page.goto(`${baseURL}/login?redirect_to=/editProfile`)
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    const participant = participants.find((item) => item.id === id)!
    await page.getByTestId('username-field').fill(participant.username)
    await page.getByTestId('password-field').fill(STUDENT_PASSWORD)
    await page.getByTestId('submit-login').click()
    await expect(page).toHaveURL((url) => url.pathname.endsWith('/editProfile'))
    await expectIdentity(id)
  }
  for (const [path, scope, id] of [
    ['magicLogin', 'OTP', studentId],
    ['activation', 'ACTIVATION', otherId],
  ] as const) {
    const token = await signed({ sub: id, scope })
    await page.goto(`${baseURL}/${path}?token=${encodeURIComponent(token)}`)
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.goto(`${baseURL}/editProfile`)
    await expectIdentity(id)
  }
})
