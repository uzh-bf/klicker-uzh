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
import { SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import {
  APP_SECRET,
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  USER_ID_TEST,
} from '../util/constants.js'

test.beforeEach(async ({}, info) => {
  test.skip(
    !/^(chromium|firefox)-(allowed|blocked|standard)$/.test(info.project.name),
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

test.beforeAll(async ({}, info) => {
  if (
    !/^(chromium|firefox)-(allowed|blocked|standard)$/.test(info.project.name)
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
    !/^(chromium|firefox)-(allowed|blocked|standard)$/.test(info.project.name)
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
  // A retained ambient A cannot replace active B during a client-renderable navigation.
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
  await navigate(frame, `/course/${COURSE_ID_TEST}/practiceQuizzes/${quizId}`)
  await expect(frame.getByTestId('start-practice-quiz')).toBeVisible()
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

test('successful explicit logout cannot restore the former profile on navigation', async ({
  page,
  context,
  baseURL,
}) => {
  const token = await signed({ sub: studentId, role: 'PARTICIPANT' }, '14d')
  await page.goto(
    `${baseURL}/editProfile?participantToken=${encodeURIComponent(token)}`
  )
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
})
