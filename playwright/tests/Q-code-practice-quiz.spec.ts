import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  CodeSubmissionResult,
  HatchetHandlerGlobalContext,
} from '@klicker-uzh/types'
import {
  expect,
  type Page,
  type Route,
  type WebSocketRoute,
} from '@playwright/test'
import { execute, parse } from 'graphql'
import { getPrisma } from '../global-setup.js'
import { setSessionCookieForUrl } from '../util/authSession.js'
import {
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  USER_ID_TEST,
} from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { env } from '../util/workflow.js'

const QUIZ_ID = 'f3457155-12ca-44c3-9cf0-e118199c867d'
const QUIZ_NAME = 'CODE participant flow'
const MICROLEARNING_ID = '3901dd31-5c30-4fc8-b92a-267688a89877'
const MICROLEARNING_NAME = 'CODE microlearning evaluation'
const STARTER_CODE = 'def solve(a, b):\n    return 0'
const ANSWER_CODE = 'def solve(a, b):\n    return a + b'

type ReceiptStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

function receipt({ id, status }: { id: string; status: ReceiptStatus }) {
  return {
    __typename: 'CodeSubmissionReceipt',
    id,
    gradingStatus: status,
    feedback:
      status === 'COMPLETED'
        ? {
            __typename: 'CodeSubmissionFeedback',
            pointsPercentage: 1,
            publicTestResults: [
              {
                __typename: 'CodePublicTestResult',
                id: 'public-sum',
                name: 'Public sum example',
                passed: true,
                actualOutput: 3,
                stdout: null,
                stderr: null,
              },
            ],
          }
        : null,
  }
}

async function fulfillGraphql(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data }),
  })
}

async function forwardGraphql(route: Route) {
  const requestUrl = new URL(route.request().url())
  const backendUrl = new URL('http://127.0.0.1:3000/api/graphql')
  backendUrl.search = requestUrl.search
  const response = await route.fetch({
    url: backendUrl.toString(),
  })
  await route.fulfill({ response })
}

function operationName(route: Route) {
  const request = route.request()
  if (request.method() === 'GET') {
    return new URL(request.url()).searchParams.get('operationName')
  }

  const body = request.postDataJSON() as { operationName?: string } | null
  return body?.operationName ?? null
}

async function replaceEditorValue(page: Page, value: string) {
  const editor = page.getByTestId('code-response-editor').locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(value)
}

async function authenticateParticipant(page: Page, participantId: string) {
  const targetUrl = env('URL_STUDENT')
  await page.context().clearCookies()
  await setSessionCookieForUrl({
    context: page.context(),
    cookieName: 'participant_token',
    targetUrl,
    tokenData: {
      email: `${participantId}@example.test`,
      sub: participantId,
      role: 'PARTICIPANT',
      scope: 'ACCOUNT_OWNER',
    },
  })
  const participantCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'participant_token'
  )
  if (!participantCookie) throw new Error('Participant cookie was not created')

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
  await page.evaluate((token) => {
    sessionStorage.setItem('participant_token', token)
  }, participantCookie.value)
}

test.describe.serial('CODE participant and evaluation flow', () => {
  let stackId: number
  let microLearningStackId: number
  let microLearningInstanceId: number

  test.beforeAll(async () => {
    const prisma = await getPrisma()
    await prisma.practiceQuiz.deleteMany({ where: { id: QUIZ_ID } })
    await prisma.microLearning.deleteMany({ where: { id: MICROLEARNING_ID } })
    await prisma.element.deleteMany({
      where: { name: { in: [QUIZ_NAME, MICROLEARNING_NAME] } },
    })

    const options = {
      language: 'python' as const,
      starterCode: STARTER_CODE,
      entrypoint: 'solve',
      executionLimits: { perTestTimeoutSeconds: 5 as const },
      testCases: [
        {
          id: 'public-sum',
          name: 'Public sum example',
          args: [1, 2],
          expectedOutput: 3,
          visibility: 'public' as const,
          weight: 1,
        },
        {
          id: 'hidden-sum',
          name: 'Hidden sum example',
          args: [2, 3],
          expectedOutput: 5,
          visibility: 'hidden' as const,
          weight: 1,
        },
      ],
    }
    const element = await prisma.element.create({
      data: {
        type: ElementType.CODE,
        name: QUIZ_NAME,
        content: 'Return the sum of two numbers.',
        explanation: 'Use addition.',
        options,
        ownerId: USER_ID_TEST,
      },
    })
    const elementData = {
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
      type: ElementType.CODE,
      name: element.name,
      content: element.content,
      explanation: element.explanation,
      basePoints: element.basePoints,
      pointsMultiplier: element.pointsMultiplier,
      options,
    }
    const results = {
      tests: {
        'public-sum': { passed: 0, total: 0 },
        'hidden-sum': { passed: 0, total: 0 },
      },
      submissions: {},
      total: 0,
    }

    const quiz = await prisma.practiceQuiz.create({
      data: {
        id: QUIZ_ID,
        name: QUIZ_NAME,
        displayName: QUIZ_NAME,
        status: PublicationStatus.PUBLISHED,
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
                elementType: ElementType.CODE,
                order: 0,
                options: { pointsMultiplier: 1, resetTimeDays: 6 },
                elementData,
                results,
                anonymousResults: results,
                elementId: element.id,
                ownerId: USER_ID_TEST,
                instanceStatistics: { create: {} },
              },
            },
          },
        },
      },
      include: { stacks: true },
    })
    stackId = quiz.stacks[0]!.id

    const now = new Date()
    const microLearning = await prisma.microLearning.create({
      data: {
        id: MICROLEARNING_ID,
        name: MICROLEARNING_NAME,
        displayName: MICROLEARNING_NAME,
        status: PublicationStatus.PUBLISHED,
        scheduledStartAt: new Date(now.getTime() - 86_400_000),
        scheduledEndAt: new Date(now.getTime() + 86_400_000),
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
        permissions: {
          create: {
            userId: USER_ID_TEST,
            permissionLevel: PermissionLevel.ADMIN,
          },
        },
        stacks: {
          create: {
            type: ElementStackType.MICROLEARNING,
            order: 0,
            courseId: COURSE_ID_TEST,
            elements: {
              create: {
                type: ElementInstanceType.MICROLEARNING,
                elementType: ElementType.CODE,
                order: 0,
                options: { pointsMultiplier: 1, resetTimeDays: 6 },
                elementData,
                results,
                anonymousResults: results,
                elementId: element.id,
                ownerId: USER_ID_TEST,
                instanceStatistics: { create: {} },
              },
            },
          },
        },
      },
      include: { stacks: { include: { elements: true } } },
    })
    microLearningStackId = microLearning.stacks[0]!.id
    microLearningInstanceId = microLearning.stacks[0]!.elements[0]!.id
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: PARTICIPANT_IDS[0]!,
        },
      },
      data: { isActive: true },
    })
  })

  test.afterAll(async () => {
    const prisma = await getPrisma()
    await prisma.practiceQuiz.deleteMany({ where: { id: QUIZ_ID } })
    await prisma.microLearning.deleteMany({ where: { id: MICROLEARNING_ID } })
    await prisma.element.deleteMany({
      where: { name: { in: [QUIZ_NAME, MICROLEARNING_NAME] } },
    })
  })

  test('persists a pending receipt across reload and advances after completion', async ({
    page,
  }) => {
    const pollingStatus: ReceiptStatus = 'PENDING'
    const receiptId = 'code-receipt-reload'
    let subscriptionId: string | undefined
    let subscriptionSocket: WebSocketRoute | undefined
    await page.routeWebSocket('**/api/graphql', async (socket) => {
      subscriptionSocket = socket
      socket.onMessage((rawMessage) => {
        const message = JSON.parse(rawMessage.toString()) as {
          id?: string
          type?: string
          payload?: { query?: string }
        }
        if (message.type === 'connection_init') {
          socket.send(JSON.stringify({ type: 'connection_ack' }))
        } else if (
          message.type === 'subscribe' &&
          message.payload?.query?.includes('CodeSubmissionUpdated')
        ) {
          subscriptionId = message.id
        } else if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }))
        }
      })
    })
    await page.route('**/api/graphql*', async (route) => {
      const operation = operationName(route)
      if (operation === 'SubmitCodeResponse') {
        await fulfillGraphql(route, {
          submitCodeResponse: receipt({ id: receiptId, status: pollingStatus }),
        })
      } else if (operation === 'CodeSubmission') {
        await fulfillGraphql(route, {
          codeSubmission: receipt({ id: receiptId, status: pollingStatus }),
        })
      } else {
        await forwardGraphql(route)
      }
    })

    await authenticateParticipant(page, PARTICIPANT_IDS[0]!)
    await page.goto(
      `${env('URL_STUDENT')}/course/${COURSE_ID_TEST}/practiceQuizzes/${QUIZ_ID}`
    )
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText('Public sum example')).toBeVisible()
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)

    await replaceEditorValue(page, ANSWER_CODE)
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('code-submission-pending')).toBeVisible()
    await expect(page.getByTestId('student-stack-continue')).toHaveCount(0)

    const storageKey = `code-submission-${QUIZ_ID}-${stackId}`
    await expect
      .poll(async () =>
        page.evaluate((key) => localStorage.getItem(key), storageKey)
      )
      .toContain(receiptId)

    await page.reload()
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByTestId('code-submission-pending')).toBeVisible()
    await expect(page.getByTestId('code-response-editor')).toContainText(
      'return a + b'
    )

    await expect.poll(() => subscriptionId).toBeTruthy()
    subscriptionSocket!.send(
      JSON.stringify({
        id: subscriptionId,
        type: 'next',
        payload: {
          data: {
            codeSubmissionUpdated: receipt({
              id: receiptId,
              status: 'COMPLETED',
            }),
          },
        },
      })
    )
    await expect(page.getByTestId('code-submission-completed')).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByTestId('code-public-test-public-sum')).toContainText(
      'passed'
    )
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)
    await expect(page.getByTestId('student-stack-continue')).toBeVisible()

    await page.reload()
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByTestId('code-submission-completed')).toBeVisible()
    await expect(page.getByTestId('code-response-editor')).toContainText(
      'return a + b'
    )
    await expect(page.getByTestId('student-stack-continue')).toBeVisible()

    await authenticateParticipant(page, PARTICIPANT_IDS[1]!)
    await page.goto(
      `${env('URL_STUDENT')}/course/${COURSE_ID_TEST}/practiceQuizzes/${QUIZ_ID}`
    )
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByTestId('code-response-editor')).toContainText(
      'return 0'
    )
    await expect(page.getByTestId('code-submission-completed')).toHaveCount(0)
    await expect(page.getByTestId('student-stack-submit')).toBeEnabled()
  })

  test('keeps the code editable after failure and persists the retry receipt', async ({
    page,
  }) => {
    let mutationCount = 0
    const statuses = new Map<string, ReceiptStatus>()
    await page.route('**/api/graphql*', async (route) => {
      const operation = operationName(route)
      if (operation === 'SubmitCodeResponse') {
        mutationCount += 1
        const id = `code-receipt-retry-${mutationCount}`
        statuses.set(id, mutationCount === 1 ? 'FAILED' : 'PENDING')
        await fulfillGraphql(route, {
          submitCodeResponse: receipt({ id, status: statuses.get(id)! }),
        })
      } else if (operation === 'CodeSubmission') {
        const requestUrl = new URL(route.request().url())
        const variables = JSON.parse(
          requestUrl.searchParams.get('variables') ?? '{}'
        ) as { id?: string }
        const id = variables.id ?? 'missing'
        await fulfillGraphql(route, {
          codeSubmission: receipt({
            id,
            status: statuses.get(id) ?? 'FAILED',
          }),
        })
      } else {
        await forwardGraphql(route)
      }
    })

    await authenticateParticipant(page, PARTICIPANT_IDS[1]!)
    await page.goto(
      `${env('URL_STUDENT')}/course/${COURSE_ID_TEST}/practiceQuizzes/${QUIZ_ID}`
    )
    await page.getByTestId('start-practice-quiz').click()
    await replaceEditorValue(page, ANSWER_CODE)
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('code-submission-failed')).toBeVisible()

    await replaceEditorValue(page, `${ANSWER_CODE}\n`)
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('code-submission-pending')).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(
          (key) => localStorage.getItem(key),
          `code-submission-${QUIZ_ID}-${stackId}`
        )
      )
      .toContain('code-receipt-retry-2')
  })

  test('restores a completed microlearning evaluation', async ({ page }) => {
    let receiptId: string | undefined
    let initialEvaluationReadbackCompleted = false
    let blockEvaluationReadback = false
    let successfulEvaluationReadbacks = 0
    let latestEvaluationPayload: unknown
    let submittedCode: string | undefined
    await page.routeWebSocket('**/api/graphql', async (socket) => {
      socket.onMessage((rawMessage) => {
        const message = JSON.parse(rawMessage.toString()) as { type?: string }
        if (message.type === 'connection_init') {
          socket.send(JSON.stringify({ type: 'connection_ack' }))
        } else if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }))
        }
      })
    })
    await page.route('**/api/graphql*', async (route) => {
      const operation = operationName(route)
      if (
        operation === 'GetPreviousStackEvaluation' &&
        blockEvaluationReadback
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'Temporary evaluation readback failure' }],
          }),
        })
        return
      }
      if (operation === 'SubmitCodeResponse') {
        const request = route.request().postDataJSON() as {
          operationName?: string
          query?: string
          variables?: Record<string, unknown>
        }
        if (!request.query) {
          throw new Error('CODE submission mutation contains no query')
        }

        const prisma = await getPrisma()
        const { processCodeSubmission, schema } = await import(
          '@klicker-uzh/graphql'
        )
        const mutationResult = await execute({
          schema,
          document: parse(request.query),
          operationName: request.operationName,
          variableValues: request.variables,
          contextValue: {
            user: {
              sub: PARTICIPANT_IDS[0]!,
              role: UserRole.PARTICIPANT,
              scope: UserLoginScope.ACCOUNT_OWNER,
              catalystInstitutional: false,
              catalystIndividual: false,
            },
            prisma,
            tasks: {
              gradeCodeSubmission: {
                runNoWait: async () => ({
                  workflowRunId: 'playwright-code-finalization',
                }),
              },
            },
          },
        })
        const payload = mutationResult as {
          data?: { submitCodeResponse?: { id?: string } }
        }
        receiptId = payload.data?.submitCodeResponse?.id
        if (!receiptId) {
          throw new Error(
            `Real CODE submission mutation returned no receipt: ${JSON.stringify(payload)}`
          )
        }

        const executorResult: CodeSubmissionResult = {
          pointsPercentage: 0.5,
          publicTestResults: [
            {
              id: 'public-sum',
              name: 'Public sum example',
              passed: true,
              actualOutput: 3,
              stdout: '',
              stderr: '',
            },
          ],
          hiddenTestResults: [{ id: 'hidden-sum', passed: false }],
        }
        const processed = await processCodeSubmission(
          { submissionId: receiptId },
          {
            prisma,
            pubSub: { publish: () => undefined },
          } as unknown as HatchetHandlerGlobalContext,
          async () => executorResult
        )
        if (!processed) {
          throw new Error('Real CODE submission was not finalized')
        }
        submittedCode = (
          await prisma.codeSubmission.findUniqueOrThrow({
            where: { id: receiptId },
            select: { code: true },
          })
        ).code
        blockEvaluationReadback = true

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mutationResult),
        })
        return
      }

      const requestUrl = new URL(route.request().url())
      const backendUrl = new URL('http://127.0.0.1:3000/api/graphql')
      backendUrl.search = requestUrl.search
      const response = await route.fetch({
        url: backendUrl.toString(),
      })
      if (operation === 'GetPreviousStackEvaluation') {
        initialEvaluationReadbackCompleted = true
        successfulEvaluationReadbacks += 1
        latestEvaluationPayload = await response.json()
      }

      await route.fulfill({ response })
    })

    await authenticateParticipant(page, PARTICIPANT_IDS[0]!)
    await page.goto(
      `${env('URL_STUDENT')}/course/${COURSE_ID_TEST}/microLearnings/${MICROLEARNING_ID}`
    )
    await page.getByTestId('start-microlearning').click()
    await expect(page.getByText('Public sum example')).toBeVisible()
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)
    await expect.poll(() => initialEvaluationReadbackCompleted).toBe(true)

    await replaceEditorValue(page, ANSWER_CODE)
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('code-submission-completed')).toBeVisible()
    await expect(
      page.getByTestId('code-evaluation-readback-failed')
    ).toBeVisible()
    await expect(page.getByTestId('student-stack-continue')).toHaveCount(0)
    blockEvaluationReadback = false
    await page
      .getByTestId('code-evaluation-readback-retry')
      .dispatchEvent('click')
    await expect.poll(() => successfulEvaluationReadbacks).toBeGreaterThan(1)
    expect(latestEvaluationPayload).toMatchObject({
      data: {
        getPreviousStackEvaluation: {
          evaluations: [
            {
              __typename: 'CodeInstanceEvaluation',
            },
          ],
        },
      },
    })
    await expect(page.getByTestId('student-stack-continue')).toBeVisible()
    await expect(
      page.getByTestId('code-evaluation-readback-failed')
    ).toHaveCount(0)
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)
    expect(receiptId).toBeTruthy()
    expect(submittedCode).toBeTruthy()
    await expect
      .poll(async () =>
        page.evaluate(
          ({ key, instanceId }) => {
            const rawStorage = localStorage.getItem(key)
            if (!rawStorage) return null

            const storage = JSON.parse(rawStorage) as Record<
              number,
              { response?: string }
            >
            return storage[instanceId]?.response ?? null
          },
          {
            key: `qi-code-${MICROLEARNING_ID}-${microLearningStackId}-${PARTICIPANT_IDS[0]}`,
            instanceId: microLearningInstanceId,
          }
        )
      )
      .toBe(submittedCode)

    await page.getByTestId('student-stack-continue').click()
    await expect(page).toHaveURL(
      new RegExp(
        `/course/${COURSE_ID_TEST}/microLearnings/${MICROLEARNING_ID}/evaluation`
      )
    )
    await expect(page.getByText('5/10')).toBeVisible()
  })

  test('shows per-test instructor aggregates for a CODE microlearning', async ({
    page,
    loginLecturer,
  }) => {
    let evaluationPayload: unknown
    await page.route('**/api/graphql*', async (route) => {
      const requestUrl = new URL(route.request().url())
      const backendUrl = new URL('http://127.0.0.1:3000/api/graphql')
      backendUrl.search = requestUrl.search
      const response = await route.fetch({
        url: backendUrl.toString(),
      })
      if (operationName(route) === 'GetMicroLearningEvaluation') {
        evaluationPayload = await response.json()
      }
      await route.fulfill({ response })
    })
    await loginLecturer()
    await page.goto(
      `${env('URL_MANAGE')}/microLearning/${MICROLEARNING_ID}/evaluation`,
      { waitUntil: 'domcontentloaded' }
    )
    await expect.poll(() => evaluationPayload).toBeTruthy()
    expect(evaluationPayload).toMatchObject({
      data: {
        getMicroLearningEvaluation: {
          results: [
            {
              instances: [
                {
                  __typename: 'CodeActivityEvaluationData',
                },
              ],
            },
          ],
        },
      },
    })
    await expect(page.getByTestId('code-evaluation')).toBeVisible()
    const publicRow = page.getByTestId('code-evaluation-test-public-sum')
    await expect(publicRow.locator('td').nth(0)).toHaveText(
      'Public sum example'
    )
    await expect(publicRow.locator('td').nth(1)).toHaveText('1')
    await expect(publicRow.locator('td').nth(2)).toHaveText('1')

    const hiddenRow = page.getByTestId('code-evaluation-test-hidden-sum')
    await expect(hiddenRow.locator('td').nth(0)).toHaveText(
      'Hidden sum example'
    )
    await expect(hiddenRow.locator('td').nth(1)).toHaveText('0')
    await expect(hiddenRow.locator('td').nth(2)).toHaveText('1')
  })
})
