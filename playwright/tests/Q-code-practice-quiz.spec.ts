import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { expect, type Page, type Route } from '@playwright/test'
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
  const response = await route.fetch({
    url: 'http://127.0.0.1:3000/api/graphql',
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

test.describe.serial('CODE practice-quiz participant flow', () => {
  let stackId: number

  test.beforeAll(async () => {
    const prisma = await getPrisma()
    await prisma.practiceQuiz.deleteMany({ where: { id: QUIZ_ID } })
    await prisma.element.deleteMany({ where: { name: QUIZ_NAME } })

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
  })

  test.afterAll(async () => {
    const prisma = await getPrisma()
    await prisma.practiceQuiz.deleteMany({ where: { id: QUIZ_ID } })
    await prisma.element.deleteMany({ where: { name: QUIZ_NAME } })
  })

  test('persists a pending receipt across reload and advances after completion', async ({
    page,
  }) => {
    let status: ReceiptStatus = 'PENDING'
    const receiptId = 'code-receipt-reload'
    await page.route('**/api/graphql*', async (route) => {
      const operation = operationName(route)
      if (operation === 'SubmitCodeResponse') {
        await fulfillGraphql(route, {
          submitCodeResponse: receipt({ id: receiptId, status }),
        })
      } else if (operation === 'CodeSubmission') {
        await fulfillGraphql(route, {
          codeSubmission: receipt({ id: receiptId, status }),
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

    status = 'COMPLETED'
    await expect(page.getByTestId('code-submission-completed')).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByTestId('code-public-test-public-sum')).toContainText(
      'passed'
    )
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)
    await expect(page.getByTestId('student-stack-continue')).toBeVisible()

    status = 'PENDING'
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
})
