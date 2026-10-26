import {
  AccessMode,
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  PermissionLevel,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import { setSessionCookieForUrl } from '../util/authSession.js'
import {
  LECTURER_EMAIL,
  LECTURER_ID,
  PARTICIPANT_IDS,
  STUDENT_EMAIL,
  STUDENT_USERNAME,
} from '../util/constants.js'
import {
  createCourseRecord,
  deleteCourseWithActivitiesByName,
} from '../util/fixtures/courses.js'
import {
  createQuestionKPRIM,
  createQuestionSC,
} from '../util/fixtures/elements.js'
import { deleteLiveQuiz } from '../util/fixtures/manage.js'
import { test } from '../util/fixtures.js'
import { env, snapshotLocalForage } from '../util/workflow.js'

declare global {
  interface Window {
    __liveQuizRecoveryFaults?: {
      closeSockets: (code?: number) => number
      failOneOperation: (kind: 'error' | 'complete') => number
      setMode: (mode: 'normal' | 'drop-messages') => void
      state: () => { opens: number; openSockets: number; operations: number }
    }
  }
}

type AssessmentFixture = Awaited<ReturnType<typeof createAssessment>>
type QuizFixture = Awaited<ReturnType<typeof createQuiz>>

const SC_CHOICES = [
  { value: 'Synthetic recovery option A', correct: true },
  { value: 'Synthetic recovery option B', correct: false },
]
const KPRIM_CHOICES = [
  { value: 'Synthetic recovery statement A', correct: true },
  { value: 'Synthetic recovery statement B', correct: false },
  { value: 'Synthetic recovery statement C', correct: true },
  { value: 'Synthetic recovery statement D', correct: false },
]

const START = 'mutation($id: String!) { startLiveQuiz(id: $id) { id } }'
const OPEN =
  'mutation($quizId: String!, $blockId: Int!) {' +
  'activateLiveQuizBlock(quizId: $quizId, blockId: $blockId) {' +
  'id blocks { id status } } }'
const CLOSE =
  'mutation($quizId: String!, $blockId: Int!) {' +
  'deactivateLiveQuizBlock(quizId: $quizId, blockId: $blockId) }'
const END = 'mutation($id: String!) { endLiveQuiz(id: $id) { id } }'

function graphqlUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL
  if (configured) {
    const url = new URL(configured)
    return url.pathname.endsWith('/api/graphql')
      ? url.toString()
      : `${url.origin}/api/graphql`
  }
  const student = new URL(env('URL_STUDENT'))
  return student.hostname.startsWith('pwa.')
    ? `${student.protocol}//api.${student.hostname.slice(4)}/api/graphql`
    : 'http://127.0.0.1:3000/api/graphql'
}

async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await api.post(graphqlUrl(), {
    data: { query, variables },
    headers: {
      authorization: `Bearer ${token}`,
      'x-graphql-yoga-csrf': 'true',
    },
  })
  expect(response.ok()).toBe(true)
  const body = (await response.json()) as {
    data?: T
    errors?: Array<{ message?: string }>
  }
  expect(body.errors ?? []).toEqual([])
  if (!body.data) throw new Error('GraphQL response did not contain data')
  return body.data
}

async function lecturerToken(page: Page) {
  await setSessionCookieForUrl({
    context: page.context(),
    targetUrl: env('URL_STUDENT'),
    tokenData: {
      email: LECTURER_EMAIL,
      sub: LECTURER_ID,
      role: 'ADMIN',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: true,
      catalystIndividual: true,
    },
  })
  const cookie = (await page.context().cookies(env('URL_STUDENT'))).find(
    ({ name }) => name === 'next-auth.session-token'
  )
  if (!cookie) throw new Error('Lecturer cookie missing')
  await page.context().clearCookies({ name: 'next-auth.session-token' })
  return cookie.value
}

async function participantToken(page: Page) {
  await setSessionCookieForUrl({
    context: page.context(),
    cookieName: 'next-auth.participant-session-token',
    targetUrl: env('URL_STUDENT'),
    tokenData: {
      email: STUDENT_EMAIL,
      sub: PARTICIPANT_IDS[0]!,
      role: 'PARTICIPANT',
      scope: 'EDUID',
    },
  })
  const cookie = (await page.context().cookies(env('URL_STUDENT'))).find(
    ({ name }) => name === 'next-auth.participant-session-token'
  )
  if (!cookie) throw new Error('Participant cookie missing')
  await page.addInitScript((token) => {
    sessionStorage.setItem('participant_token', token)
  }, cookie.value)
  return cookie.value
}

function withAssessmentCookie(token: string, existing = '') {
  const cookies = existing
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(
      (cookie) =>
        cookie && !cookie.startsWith('next-auth.participant-session-token=')
    )
  return [...cookies, `next-auth.participant-session-token=${token}`].join('; ')
}

function corsHeaders() {
  return {
    'access-control-allow-origin': new URL(env('URL_STUDENT')).origin,
    'access-control-allow-credentials': 'true',
  }
}

async function forwardedResponse(route: Route, token: string) {
  return route.fetch({
    headers: {
      ...route.request().headers(),
      cookie: withAssessmentCookie(token, route.request().headers().cookie),
    },
  })
}

async function forwardResponse(route: Route, token: string) {
  await route.fulfill({ response: await forwardedResponse(route, token) })
}

async function createAssessment() {
  const marker = `O3 recovery ${Date.now()} ${randomUUID()}`
  const now = new Date()
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const course = await createCourseRecord({
    name: marker,
    displayName: marker,
    description: 'Disposable synthetic assessment course.',
    startDate: now,
    endDate: end,
    groupDeadlineDate: end,
    isAssessmentEnabled: true,
    isGamificationEnabled: false,
    isGroupCreationEnabled: false,
    participants: [STUDENT_USERNAME],
    ownerId: LECTURER_ID,
  })
  const prisma = await getPrisma()
  await prisma.participation.updateMany({
    where: { courseId: course.id, participantId: PARTICIPANT_IDS[0]! },
    data: {
      isActive: true,
      assessmentGivenName: 'Synthetic',
      assessmentSurname: 'Participant',
      assessmentMatriculationNumber: `o3-${randomUUID()}`,
    },
  })

  await Promise.all([
    createQuestionSC({
      name: `${marker} SC`,
      content: 'Synthetic recovery SC question.',
      choices: SC_CHOICES,
      userId: LECTURER_ID,
    }),
    createQuestionKPRIM({
      name: `${marker} KPRIM`,
      content: 'Synthetic recovery KPRIM question.',
      choices: KPRIM_CHOICES,
      userId: LECTURER_ID,
    }),
  ])

  const select = {
    id: true,
    version: true,
    name: true,
    type: true,
    content: true,
    explanation: true,
    options: true,
    basePoints: true,
    pointsMultiplier: true,
  } as const
  const elements = await Promise.all(
    [`${marker} SC`, `${marker} KPRIM`].map((name) =>
      prisma.element.findFirstOrThrow({
        where: { name, ownerId: LECTURER_ID },
        select,
      })
    )
  )
  return { courseId: course.id, courseName: marker, elements }
}

async function createQuiz(
  assessment: AssessmentFixture,
  timedFirstBlock = false
) {
  const prisma = await getPrisma()
  const name = `${assessment.courseName} quiz ${randomUUID()}`
  const quiz = await prisma.liveQuiz.create({
    data: {
      name,
      displayName: name,
      description: 'Disposable synthetic assessment recovery quiz.',
      status: PublicationStatus.DRAFT,
      accessMode: AccessMode.PUBLIC,
      isAssessmentEnabled: true,
      isGamificationEnabled: false,
      ownerId: LECTURER_ID,
      courseId: assessment.courseId,
      blocks: {
        create: Array.from(
          { length: timedFirstBlock ? 6 : 5 },
          (_, order) => assessment.elements[order % 2]!
        ).map((element, order) => ({
          order,
          status: ElementBlockStatus.SCHEDULED,
          timeLimit: timedFirstBlock && order === 0 ? 8 : null,
          elements: {
            create: {
              order: 0,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: element.type,
              elementData: {
                ...element,
                id: `${element.id}-v${element.version}`,
                elementId: element.id,
              },
              options: {
                basePoints: element.basePoints,
                pointsMultiplier: element.pointsMultiplier,
              },
              results: {},
              anonymousResults: {},
              element: { connect: { id: element.id } },
              owner: { connect: { id: LECTURER_ID } },
            },
          },
        })),
      },
    },
    include: {
      blocks: { include: { elements: true }, orderBy: { order: 'asc' } },
    },
  })
  await prisma.derivedPermission.create({
    data: {
      permissionLevel: PermissionLevel.OWNER,
      liveQuizId: quiz.id,
      userId: LECTURER_ID,
    },
  })
  return {
    id: quiz.id,
    blocks: quiz.blocks.map((block) => ({
      id: block.id,
      instanceId: block.elements[0]!.id,
    })),
  }
}

async function openSession(page: Page, quizId: string) {
  await page.goto(`${env('URL_STUDENT')}/en/session/${quizId}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByTestId('live-quiz-connection-status')).toBeHidden({
    timeout: 30_000,
  })
}

async function waitForSubscriptions(page: Page) {
  await page.waitForFunction(() => {
    const state = window.__liveQuizRecoveryFaults?.state()
    return !!state && state.openSockets > 0 && state.operations >= 2
  })
}

async function installWebSocketFaults(context: BrowserContext) {
  await context.addInitScript(() => {
    const Native = window.WebSocket
    const operations = new WeakMap<WebSocket, Set<string>>()
    const sockets = new Set<WebSocket>()
    let dropMessages = false
    let opens = 0

    window.WebSocket = new Proxy(Native, {
      construct(target, args) {
        const socket = Reflect.construct(target, args) as WebSocket
        const active = new Set<string>()
        sockets.add(socket)
        operations.set(socket, active)
        let messageHandler: ((event: MessageEvent) => unknown) | null = null
        Object.defineProperty(socket, 'onmessage', {
          configurable: true,
          get: () => messageHandler,
          set(handler) {
            messageHandler = handler
          },
        })
        const add = socket.addEventListener.bind(socket)
        add('message', (event) => {
          if (!dropMessages) messageHandler?.call(socket, event)
        })
        socket.addEventListener = function (type, listener, options) {
          if (type !== 'message' || typeof listener !== 'function') {
            return add(type, listener, options)
          }
          return add(
            type,
            (event) => {
              if (!dropMessages) listener.call(socket, event)
            },
            options
          )
        }
        const send = socket.send.bind(socket)
        socket.send = function (data) {
          if (typeof data === 'string') {
            try {
              const frame = JSON.parse(data) as {
                id?: unknown
                type?: unknown
              }
              if (typeof frame.id === 'string') {
                if (frame.type === 'subscribe') active.add(frame.id)
                if (frame.type === 'complete') active.delete(frame.id)
              }
            } catch {
              // Native WebSocket frames need not be JSON.
            }
          }
          return send(data)
        }
        add('open', () => {
          opens += 1
        })
        add('close', () => sockets.delete(socket))
        return socket
      },
    })
    window.__liveQuizRecoveryFaults = {
      setMode(next: 'normal' | 'drop-messages') {
        dropMessages = next === 'drop-messages'
      },
      closeSockets(code = 4000) {
        const active = [...sockets]
        active.forEach((socket) =>
          socket.close(code, 'synthetic recovery test')
        )
        return active.length
      },
      failOneOperation(kind: 'error' | 'complete') {
        for (const socket of sockets) {
          if (socket.readyState !== Native.OPEN) continue
          const active = operations.get(socket)
          const id = active?.values().next().value
          if (!active || typeof id !== 'string') continue
          active.delete(id)
          socket.dispatchEvent(
            new MessageEvent('message', {
              data: JSON.stringify({
                id,
                type: kind,
                ...(kind === 'error'
                  ? { payload: [{ message: 'Synthetic terminal failure' }] }
                  : {}),
              }),
            })
          )
          return 1
        }
        return 0
      },
      state() {
        return {
          opens,
          openSockets: sockets.size,
          operations: [...sockets].reduce(
            (total, socket) => total + (operations.get(socket)?.size ?? 0),
            0
          ),
        }
      },
    }
  })
}

async function setFaultMode(page: Page, mode: 'normal' | 'drop-messages') {
  await page.evaluate((next) => {
    window.__liveQuizRecoveryFaults?.setMode(next)
  }, mode)
}

async function terminalFailure(page: Page, kind: 'error' | 'complete') {
  expect(
    await page.evaluate(
      (next) => window.__liveQuizRecoveryFaults?.failOneOperation(next) ?? 0,
      kind
    )
  ).toBe(1)
  await expect(page.getByTestId('live-quiz-connection-status')).toHaveAttribute(
    'data-state',
    'failed'
  )
  await expect(page.getByTestId('live-quiz-reconnect')).toBeVisible()
}

async function reconnect(page: Page) {
  await page.getByTestId('live-quiz-reconnect').click()
  await expect(page.getByTestId('live-quiz-connection-status')).toBeHidden({
    timeout: 30_000,
  })
  await waitForSubscriptions(page)
}

async function draftValue(page: Page, key: string) {
  const snapshot = await snapshotLocalForage(page)
  return snapshot
    .flatMap((store) => store.entries)
    .find(([storedKey]) => storedKey === key)?.[1]
}

async function expectDraft(page: Page, key: string) {
  await expect.poll(() => draftValue(page, key)).toBeDefined()
}

let api: APIRequestContext
let assessment: AssessmentFixture

const open = (token: string, quiz: QuizFixture, index: number) =>
  gql(token, OPEN, { quizId: quiz.id, blockId: quiz.blocks[index]!.id })
const close = (token: string, quiz: QuizFixture, index: number) =>
  gql(token, CLOSE, { quizId: quiz.id, blockId: quiz.blocks[index]!.id })

async function withQuiz(
  page: Page,
  timed: boolean,
  run: (quiz: QuizFixture, token: string) => Promise<void>
) {
  const quiz = await createQuiz(assessment, timed)
  let token: string | undefined
  try {
    token = await lecturerToken(page)
    await gql(token, START, { id: quiz.id })
    await run(quiz, token)
  } finally {
    if (token) await gql(token, END, { id: quiz.id }).catch(() => undefined)
    await deleteLiveQuiz(quiz.id).catch(() => undefined)
  }
}

test.describe.serial('Assessment live-quiz recovery', () => {
  test.setTimeout(90_000)

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ ignoreHTTPSErrors: true })
    assessment = await createAssessment()
  })

  test.afterAll(async () => {
    await api.dispose()
    await deleteCourseWithActivitiesByName({
      courseName: assessment.courseName,
      ownerId: LECTURER_ID,
    })
    const prisma = await getPrisma()
    await prisma.element.deleteMany({
      where: {
        name: { startsWith: assessment.courseName },
        ownerId: LECTURER_ID,
      },
    })
  })

  test.afterEach(async ({ page }) => {
    await page
      .context()
      .setOffline(false)
      .catch(() => undefined)
    await page.unroute('**/AddResponse').catch(() => undefined)
  })

  test('recovers a missed event, retryable close, and terminal operations', async ({
    page,
  }) => {
    await installWebSocketFaults(page.context())
    await withQuiz(page, false, async (quiz, token) => {
      await participantToken(page)
      await openSession(page, quiz.id)
      await waitForSubscriptions(page)

      await setFaultMode(page, 'drop-messages')
      await open(token, quiz, 0)
      await page.waitForTimeout(500)
      await expect(page.getByTestId('sc-0-answer-option-0')).toHaveCount(0)
      await setFaultMode(page, 'normal')
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
      await expect(page.getByTestId('sc-0-answer-option-0')).toBeVisible({
        timeout: 30_000,
      })

      for (let episode = 0; episode < 3; episode++) {
        const opens = await page.evaluate(
          () => window.__liveQuizRecoveryFaults?.state().opens ?? 0
        )
        expect(
          await page.evaluate(
            () => window.__liveQuizRecoveryFaults?.closeSockets(4000) ?? 0
          )
        ).toBeGreaterThan(0)
        await page.waitForFunction(
          (before) =>
            (window.__liveQuizRecoveryFaults?.state().opens ?? 0) > before,
          opens,
          { timeout: 30_000 }
        )
        await waitForSubscriptions(page)
      }
      await close(token, quiz, 0)
      await open(token, quiz, 1)
      await expect(
        page.getByTestId('toggle-kp-0-answer-0-correct')
      ).toBeVisible({ timeout: 30_000 })

      await terminalFailure(page, 'error')
      await page.evaluate(() => {
        window.dispatchEvent(new Event('pageshow'))
        window.dispatchEvent(new Event('focus'))
      })
      await expect(
        page.getByTestId('live-quiz-connection-status')
      ).toHaveAttribute('data-state', 'failed')
      await reconnect(page)
      await terminalFailure(page, 'complete')
      await reconnect(page)
      await close(token, quiz, 1)
      await open(token, quiz, 2)
      await expect(page.getByTestId('sc-0-answer-option-1')).toBeVisible({
        timeout: 30_000,
      })
    })
  })

  test('keeps a draft through HTTP and network failures before retry', async ({
    page,
  }) => {
    await withQuiz(page, false, async (quiz, token) => {
      await open(token, quiz, 0)
      const participant = await participantToken(page)
      let mode: 'pass' | '503' | 'offline' = '503'
      await page.route('**/AddResponse', async (route) => {
        if (mode === '503') {
          await route.fulfill({ status: 503, headers: corsHeaders(), body: '' })
        } else if (mode === 'offline') {
          await route.abort('internetdisconnected')
        } else {
          await forwardResponse(route, participant)
        }
      })

      await openSession(page, quiz.id)
      const answer = page.getByTestId('sc-0-answer-option-0')
      const submit = page.getByTestId('student-submit-answer')
      const key = `lq-${quiz.id}-ex-0-i-${quiz.blocks[0]!.instanceId}-temp`
      await expect(answer).toBeVisible()
      await answer.click()
      await submit.click()
      await expect(submit).toBeEnabled({ timeout: 15_000 })
      await expectDraft(page, key)
      await expect(
        page.getByTestId('live-quiz-submission-unconfirmed')
      ).toBeVisible()
      await expect(page.getByTestId('live-quiz-block-submitted')).toHaveCount(0)

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(answer).toBeVisible()
      mode = 'offline'
      await page.context().setOffline(true)
      await submit.click()
      await expect(submit).toBeEnabled({ timeout: 15_000 })
      await expect(
        page.getByTestId('live-quiz-submission-unconfirmed')
      ).toBeVisible()
      await expect(page.getByTestId('live-quiz-block-submitted')).toHaveCount(0)
      await page.context().setOffline(false)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(answer).toBeVisible()
      await expectDraft(page, key)

      mode = 'pass'
      await submit.click()
      await expect(page.getByTestId('live-quiz-block-submitted')).toBeVisible({
        timeout: 30_000,
      })
      await expect(
        page.getByTestId('live-quiz-submission-unconfirmed')
      ).toHaveCount(0)
    })
  })

  test('keeps only a prior-answer marker after HTTP 208', async ({ page }) => {
    await withQuiz(page, false, async (quiz, token) => {
      const participant = await participantToken(page)
      await open(token, quiz, 0)
      let calls = 0
      await page.route('**/AddResponse', async (route) => {
        calls += 1
        if (calls === 1) {
          const response = await forwardedResponse(route, participant)
          expect(response.status()).toBe(200)
          await route.abort('failed')
        } else {
          await route.fulfill({
            status: 208,
            contentType: 'application/json',
            headers: corsHeaders(),
            body: JSON.stringify({ responseTimestamp: Date.now() }),
          })
        }
      })

      await openSession(page, quiz.id)
      const submit = page.getByTestId('student-submit-answer')
      await expect(page.getByTestId('sc-0-answer-option-0')).toBeVisible()
      await page.getByTestId('sc-0-answer-option-0').click()
      await submit.click()
      await expect(submit).toBeEnabled({ timeout: 15_000 })
      await expect(
        page.getByTestId('live-quiz-submission-unconfirmed')
      ).toBeVisible()
      expect(calls).toBe(1)
      await page.getByTestId('sc-0-answer-option-1').click()
      await submit.click()
      await expect(page.getByTestId('live-quiz-previous-answer')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('live-quiz-block-submitted')).toBeVisible()
      await expect(
        page.getByTestId('live-quiz-submission-unconfirmed')
      ).toHaveCount(0)
      expect(calls).toBe(2)
      expect(
        await draftValue(
          page,
          `lq-${quiz.id}-ex-0-i-${quiz.blocks[0]!.instanceId}`
        )
      ).toEqual({ previouslySubmitted: true })
      await close(token, quiz, 0)
      await expect(page.getByTestId('live-quiz-block-closed')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('live-quiz-block-submitted')).toHaveCount(0)
    })
  })

  test('shows only the neutral closed state after timer expiry', async ({
    page,
  }) => {
    await withQuiz(page, true, async (quiz, token) => {
      await participantToken(page)
      await openSession(page, quiz.id)
      await open(token, quiz, 0)
      await expect(page.getByTestId('sc-0-answer-option-0')).toBeVisible()
      await expect(page.getByTestId('live-quiz-block-closed')).toBeVisible({
        timeout: 25_000,
      })
      await expect(page.getByTestId('live-quiz-block-submitted')).toHaveCount(0)
    })
  })
})
