import { SubmitCodeResponseDocument } from '@klicker-uzh/graphql/dist/ops.js'
import {
  ElementType,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  CodeSubmissionResult,
  HatchetHandlerGlobalContext,
} from '@klicker-uzh/types'
import { expect, type Page, type Route } from '@playwright/test'
import { execute } from 'graphql'
import { getPrisma } from '../global-setup.js'
import {
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  USER_ID_TEST,
} from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { createLiveQuiz, env, loginLecturer } from '../util/workflow.js'

const ELEMENT_NAME = 'CODE Live Quiz Playwright'
const LIVE_QUIZ_NAME = 'CODE Live Quiz activity'
const ANSWER_CODE = 'def solve(a, b):\n    return a + b'

function operationName(route: Route) {
  const request = route.request()
  if (request.method() === 'GET') {
    return new URL(request.url()).searchParams.get('operationName')
  }
  return (request.postDataJSON() as { operationName?: string } | null)
    ?.operationName
}

async function replaceEditorValue(page: Page, value: string) {
  const editor = page.getByTestId('code-response-editor').locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type(value)
}

test.describe('CODE Live Quiz authoring', () => {
  test.beforeAll(async () => {
    const prisma = await getPrisma()
    await prisma.liveQuiz.deleteMany({ where: { name: LIVE_QUIZ_NAME } })
    await prisma.element.deleteMany({ where: { name: ELEMENT_NAME } })
    await prisma.element.create({
      data: {
        type: ElementType.CODE,
        name: ELEMENT_NAME,
        content: 'Return the sum of two numbers.',
        explanation: 'Use addition.',
        options: {
          language: 'python',
          starterCode: 'def solve(a, b):\n    return 0',
          entrypoint: 'solve',
          executionLimits: { perTestTimeoutSeconds: 5 },
          testCases: [
            {
              id: 'public-sum',
              name: 'Public sum example',
              args: [1, 2],
              expectedOutput: 3,
              visibility: 'public',
              weight: 1,
            },
            {
              id: 'hidden-sum',
              name: 'Hidden sum example',
              args: [2, 3],
              expectedOutput: 5,
              visibility: 'hidden',
              weight: 1,
            },
          ],
        },
        ownerId: USER_ID_TEST,
      },
    })
  })

  test.afterAll(async () => {
    const prisma = await getPrisma()
    await prisma.liveQuiz.deleteMany({ where: { name: LIVE_QUIZ_NAME } })
    await prisma.element.deleteMany({ where: { name: ELEMENT_NAME } })
  })

  test('authors and completes a CODE-only course Live Quiz flow', async ({
    browser,
    page,
    loginStudent,
  }) => {
    const prisma = await getPrisma()
    const course = await prisma.course.findUniqueOrThrow({
      where: { id: COURSE_ID_TEST },
      select: { name: true },
    })

    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: LIVE_QUIZ_NAME,
      displayName: LIVE_QUIZ_NAME,
      courseName: course.name,
      blocks: [{ elements: [ELEMENT_NAME] }],
    })

    await page.getByTestId('activities').click()
    await page.getByTestId('activities-search-input').fill(LIVE_QUIZ_NAME)
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${LIVE_QUIZ_NAME}`)
    ).toBeVisible()
    await expect
      .poll(async () => {
        return await prisma.liveQuiz.findFirst({
          where: { name: LIVE_QUIZ_NAME },
          select: {
            id: true,
            courseId: true,
            blocks: {
              select: {
                id: true,
                elements: { select: { id: true, elementType: true } },
              },
            },
          },
        })
      })
      .toMatchObject({
        courseId: COURSE_ID_TEST,
        blocks: [{ elements: [{ elementType: ElementType.CODE }] }],
      })

    const persistedLiveQuiz = await prisma.liveQuiz.findFirstOrThrow({
      where: { name: LIVE_QUIZ_NAME },
      include: { blocks: { include: { elements: true } } },
    })
    const instance = persistedLiveQuiz.blocks[0]!.elements[0]!

    await page.getByTestId(`start-live-quiz-${LIVE_QUIZ_NAME}`).click()
    await expect(page.getByTestId('abort-live-quiz-cockpit')).toBeVisible()
    await page.getByTestId('next-block-timeline').click()
    await expect
      .poll(async () => {
        return await prisma.liveQuiz.findUnique({
          where: { id: persistedLiveQuiz.id },
          select: { activeBlockId: true },
        })
      })
      .toMatchObject({ activeBlockId: persistedLiveQuiz.blocks[0]!.id })

    let receiptId: string | undefined
    let submitCodeResponseCalls = 0
    let addResponseCalls = 0
    await page.route('**/AddResponse', async (route) => {
      addResponseCalls += 1
      await route.continue()
    })
    await page.route('**/api/graphql*', async (route) => {
      const operation = operationName(route)
      if (operation === 'SubmitCodeResponse') {
        submitCodeResponseCalls += 1
        const request = route.request().postDataJSON() as {
          variables?: Record<string, unknown>
        }
        expect(request).toMatchObject({
          variables: {
            instanceId: instance.id,
            courseId: COURSE_ID_TEST,
            code: ANSWER_CODE,
          },
        })

        const { schema } = await import('@klicker-uzh/graphql')
        const mutationResult = await execute({
          schema,
          document: SubmitCodeResponseDocument,
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
                  workflowRunId: 'playwright-code-live-quiz-finalization',
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
            `Real Live Quiz CODE mutation returned no receipt: ${JSON.stringify(payload)}`
          )
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mutationResult),
        })
        return
      }
      await route.continue()
    })

    await loginStudent()
    await page.goto(`${env('URL_STUDENT')}/session/${persistedLiveQuiz.id}`)
    await expect(page.getByText('Return the sum of two numbers.')).toBeVisible()
    await expect(page.getByText('Public sum example')).toBeVisible()
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)

    await replaceEditorValue(page, ANSWER_CODE)
    await page.getByTestId('student-submit-answer').click()
    await expect(page.getByTestId('code-submission-pending')).toBeVisible()
    expect(submitCodeResponseCalls).toBe(1)
    expect(addResponseCalls).toBe(0)
    expect(receiptId).toBeTruthy()

    const lecturerContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    })
    try {
      const lecturerPage = await lecturerContext.newPage()
      await loginLecturer(lecturerPage)
      await lecturerPage.goto(
        `${env('URL_MANAGE')}/quizzes/${persistedLiveQuiz.id}/cockpit`
      )
      await expect(
        lecturerPage.getByTestId('abort-live-quiz-cockpit')
      ).toBeVisible()
      await lecturerPage.getByTestId('next-block-timeline').click()
      await expect
        .poll(async () => {
          return await prisma.liveQuiz.findUnique({
            where: { id: persistedLiveQuiz.id },
            select: { activeBlockId: true },
          })
        })
        .toMatchObject({ activeBlockId: null })
    } finally {
      await lecturerContext.close()
    }

    const executorResult: CodeSubmissionResult = {
      pointsPercentage: 1,
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
      hiddenTestResults: [{ id: 'hidden-sum', passed: true }],
    }
    const { processCodeSubmission } = await import('@klicker-uzh/graphql')
    expect(
      await processCodeSubmission(
        { submissionId: receiptId! },
        {
          prisma,
          pubSub: { publish: () => undefined },
          redisExec: { eval: async () => 1 },
          redisAssessmentExec: { eval: async () => 1 },
        } as unknown as HatchetHandlerGlobalContext,
        async () => executorResult
      )
    ).toBe(true)

    await expect(page.getByTestId('code-submission-completed')).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByTestId('code-public-test-public-sum')).toContainText(
      'passed'
    )
    await expect(page.getByText('Hidden sum example')).toHaveCount(0)
    await expect(
      page.getByText('All questions have been answered.')
    ).toBeVisible()
    await expect
      .poll(async () => {
        return await prisma.liveQuizResponse.count({
          where: {
            instanceId: instance.id,
            participantId: PARTICIPANT_IDS[0]!,
            elementBlockExecution: persistedLiveQuiz.blocks[0]!.execution,
          },
        })
      })
      .toBe(1)
  })
})
