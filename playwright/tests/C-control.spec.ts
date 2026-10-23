/**
 * C-control.spec.ts
 *
 * Equivalent of cypress/cypress/e2e/C-control-workflow.cy.ts
 * Tests the frontend-control application: creating a live quiz via DB helper,
 * running it from the control app, and cleaning up.
 */

import { readFileSync } from 'node:fs'
import { cleanupTest } from '../util/cleanup.js'
import { CONTROL_DATA, LECTURER_ID, viewPorts } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { createQuestionSC } from '../util/fixtures/elements.js'
import { removeSoftDeletedLiveQuiz } from '../util/fixtures/manage.js'

const persistedOperations = JSON.parse(
  readFileSync(
    new URL('../../packages/graphql/src/public/client.json', import.meta.url),
    'utf8'
  )
) as Record<string, string>
const persistedNames = new Map(
  Object.entries(persistedOperations).map(([name, hash]) => [hash, name])
)
const graphQLRoute = /\/graphql(?:-proxy)?(?:[/?]|$)/

function graphQLOperationName(request: {
  method(): string
  postDataJSON(): unknown
  url(): string
}) {
  try {
    const url = new URL(request.url())
    const payload =
      request.method() === 'POST'
        ? (request.postDataJSON() as {
            extensions?: {
              persistedQuery?: { sha256Hash?: string }
            }
            operationName?: string
          } | null)
        : null
    const extensions =
      payload?.extensions ??
      JSON.parse(url.searchParams.get('extensions') ?? 'null')
    const hash = extensions?.persistedQuery?.sha256Hash

    return (
      url.searchParams.get('operationName') ??
      payload?.operationName ??
      (hash ? persistedNames.get(hash) : undefined)
    )
  } catch {
    return undefined
  }
}

test('CLEANUP', cleanupTest)

test.describe('Test functionalities of frontend-control application', () => {
  test('Create a live quiz with a new SC question to test execution from control app', async ({
    page,
    loginLecturer,
    createLiveQuiz,
  }) => {
    // Seed the SC question directly via DB helper
    await createQuestionSC({
      name: CONTROL_DATA.questionTitle,
      content: CONTROL_DATA.questionContent,
      choices: [{ value: '50%' }, { value: '100%' }],
      userId: LECTURER_ID,
    })

    await loginLecturer()
    await page.reload()

    await createLiveQuiz(page, {
      name: CONTROL_DATA.quizName,
      displayName: CONTROL_DATA.quizDisplayName,
      questionTitle: CONTROL_DATA.questionTitle,
    })
  })

  test('Log in as the lecturer in the control application and test different screen sizes', async ({
    page,
    context,
    loginLecturerControl,
  }) => {
    await loginLecturerControl()
    const controlOrigin = new URL(page.url()).origin

    // PPT link and start quiz
    await page.getByTestId('unassigned-live-quizzes').click()
    await expect(
      page.getByTestId(`ppt-link-${CONTROL_DATA.quizName}`)
    ).toBeVisible()
    await page.getByTestId(`ppt-link-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('close-embedding-modal').click()
    await page.getByTestId(`start-live-quiz-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('confirm-start-live-quiz').click()

    // Mobile navigation test (iphone-6: 375x667): app bar PPT and back buttons
    await page.setViewportSize(viewPorts.iphone6)
    await page.getByTestId('session-ppt-link').click()
    await page.getByTestId('close-embedding-modal').click()
    await page.getByTestId('app-bar-back').click() // session -> quiz list
    await expect(page).toHaveURL(/\/course\/unassigned$/)
    await page.getByTestId('app-bar-back').click() // quiz list -> home
    await page.getByTestId('unassigned-live-quizzes').click()
    await page.getByTestId(`running-live-quiz-${CONTROL_DATA.quizName}`).click()
    await expect(page).toHaveURL(/\/session\/[^/]+$/)
    await page.getByTestId('app-bar-back').click()
    await expect(page).toHaveURL(/\/course\/unassigned$/)
    await page.getByTestId(`running-live-quiz-${CONTROL_DATA.quizName}`).click()
    await expect(page).toHaveURL(/\/session\/[^/]+$/)
    await page.setViewportSize(viewPorts.default)

    // Open a block before exercising overview-stop and live updates
    await page.getByTestId('activate-next-block').click()
    await expect(page.getByTestId('deactivate-block')).toBeVisible()

    // A rejected close must keep the overview stop sheet open and must not
    // send the end mutation. Cover both false and null mutation results.
    let deactivationResult: boolean | null = false
    let deactivationRequests = 0
    let endRequests = 0
    await page.route(graphQLRoute, async (route) => {
      const operationName = graphQLOperationName(route.request())
      if (operationName?.includes('DeactivateLiveQuizBlock')) {
        deactivationRequests += 1
        await route.fulfill({
          json: { data: { deactivateLiveQuizBlock: deactivationResult } },
        })
        return
      }
      if (operationName?.includes('EndLiveQuiz')) {
        endRequests += 1
        await route.fulfill({ json: { data: { endLiveQuiz: true } } })
        return
      }
      await route.continue()
    })

    await page.goto(`${controlOrigin}/`)
    await page.getByTestId(`stop-running-quiz-${CONTROL_DATA.quizName}`).click()
    const confirmStop = page.getByTestId('confirm-stop-running-quiz')
    await expect(confirmStop).toBeEnabled()
    await confirmStop.click()
    await expect.poll(() => deactivationRequests).toBe(1)
    await expect(page.getByTestId('stop-running-quiz-sheet')).toBeVisible()
    await expect(confirmStop).toBeEnabled()
    expect(endRequests).toBe(0)

    deactivationResult = null
    await confirmStop.click()
    await expect.poll(() => deactivationRequests).toBe(2)
    await expect(page.getByTestId('stop-running-quiz-sheet')).toBeVisible()
    await expect(confirmStop).toBeEnabled()
    expect(endRequests).toBe(0)

    await page.unroute(graphQLRoute)
    await page.getByTestId('cancel-stop-running-quiz').click()
    await page
      .getByTestId(`running-banner-link-${CONTROL_DATA.quizName}`)
      .click()
    await expect(page.getByTestId('deactivate-block')).toBeVisible()

    // Two independently loaded control pages must observe Q&A polling after
    // it was disabled and empty. No reload occurs after their first load.
    const sessionPath = new URL(page.url()).pathname
    const secondPage = await context.newPage()
    const sessionQuizId = sessionPath.split('/').at(-1) as string
    let feedbacksEnabled = false
    let feedbackRequests = 0
    const feedbackPages = new Set<typeof page>()
    const remoteQuestion = {
      __typename: 'Feedback',
      id: 1,
      content: 'Synthetic remote question',
      votes: 1,
      isPublished: false,
      isResolved: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      responses: [],
    }
    // Mock only the feedback feed. Both pages read the same changing state.
    await context.route(graphQLRoute, async (route) => {
      const operationName = graphQLOperationName(route.request())
      if (!operationName?.includes('GetControlLiveQuizFeedbacks')) {
        await route.continue()
        return
      }

      feedbackRequests += 1
      const requestingPage = route.request().frame().page()
      if (requestingPage) feedbackPages.add(requestingPage)
      await route.fulfill({
        json: {
          data: {
            controlLiveQuizFeedbacks: {
              __typename: 'LiveQuiz',
              id: sessionQuizId,
              isLiveQAEnabled: feedbacksEnabled,
              isModerationEnabled: feedbacksEnabled,
              feedbacks: feedbacksEnabled ? [remoteQuestion] : [],
            },
          },
        },
      })
    })

    await Promise.all([
      page.goto(`${controlOrigin}${sessionPath}`),
      secondPage.goto(`${controlOrigin}${sessionPath}`),
    ])
    await expect.poll(() => feedbackPages.size).toBe(2)
    expect(feedbackRequests).toBeGreaterThanOrEqual(2)
    for (const controlPage of [page, secondPage]) {
      await expect(controlPage.getByTestId('session-tab-qa')).toBeVisible()
      await expect(
        controlPage.getByTestId('session-tab-qa-pending')
      ).toHaveCount(0)
    }

    feedbacksEnabled = true
    await Promise.all(
      [page, secondPage].map((controlPage) =>
        expect(
          controlPage
            .getByTestId('session-tab-qa-pending')
            .locator('span[aria-hidden="true"]')
        ).toHaveText('1', { timeout: 8000 })
      )
    )
    for (const controlPage of [page, secondPage]) {
      await controlPage.getByTestId('session-tab-qa').click()
      await expect(controlPage.getByTestId('qa-toggle-enabled')).toBeChecked()
      await expect(controlPage.getByTestId('qa-question-1')).toBeVisible()
    }
    await secondPage.close()
    await context.unroute(graphQLRoute)

    // Content acknowledgments carry totalAnswers but are not questions. They
    // must not inflate votes, question counts or fallback participants.
    await page.route(graphQLRoute, async (route) => {
      const operationName = graphQLOperationName(route.request())
      if (!operationName?.includes('GetControlLiveQuizEvaluation')) {
        await route.continue()
        return
      }

      await route.fulfill({
        json: {
          data: {
            liveQuizEvaluation: {
              __typename: 'ActivityEvaluation',
              id: sessionQuizId,
              isAssessmentEnabled: false,
              results: [
                {
                  __typename: 'StackEvaluation',
                  stackId: 1,
                  stackName: null,
                  stackDescription: null,
                  stackOrder: 0,
                  stackActive: true,
                  status: 'ACTIVE',
                  expiresAt: null,
                  timeLimit: null,
                  instances: [
                    {
                      __typename: 'ChoicesActivityEvaluationData',
                      id: 101,
                      type: 'SC',
                      name: 'Synthetic question',
                      content: 'Synthetic question',
                      hasSampleSolution: false,
                      hasAnswerFeedbacks: false,
                      results: {
                        __typename: 'ChoicesElementResults',
                        totalAnswers: 3,
                        anonymousAnswers: 0,
                        choices: [],
                      },
                    },
                    {
                      __typename: 'ContentActivityEvaluationData',
                      id: 102,
                      type: 'CONTENT',
                      name: 'Synthetic content',
                      content: 'Synthetic content',
                      hasSampleSolution: false,
                      hasAnswerFeedbacks: false,
                      results: {
                        __typename: 'ContentElementResults',
                        totalAnswers: 12,
                        anonymousAnswers: 0,
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      })
    })

    await page.getByTestId('session-tab-stats').click()
    await expect(
      page.getByTestId('stats-votes').locator(':scope > div').nth(1)
    ).toHaveText('3')
    await expect(
      page.getByTestId('stats-participants').locator(':scope > div').nth(1)
    ).toHaveText('3')
    const firstBlock = page.getByTestId('stats-block-1')
    await expect(
      firstBlock.locator(':scope > div').first().locator('span').last()
    ).toHaveText('3')
    await expect(firstBlock.locator(':scope > div').last()).toHaveText(
      /\b3\b\D+\b3\b\D+\b1\b/
    )
    await page.unroute(graphQLRoute)

    // Deactivate the real block, end quiz (with confirmation)
    await page.getByTestId('session-tab-control').click()
    await page.getByTestId('deactivate-block').click()
    await page.getByTestId('end-live-quiz').click()
    await page.getByTestId('confirm-end-live-quiz').click()
    await expect(page.getByTestId('live-quiz-ended')).toBeVisible()
    await page.getByTestId('back-to-course').click()

    await expect(
      page.getByTestId(`start-live-quiz-${CONTROL_DATA.quizName}`)
    ).not.toBeVisible()
    await expect(
      page.getByTestId(`running-live-quiz-${CONTROL_DATA.quizName}`)
    ).not.toBeVisible()
  })

  test('Cleanup: Delete the created and completed live quiz', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await page.getByTestId('activities').click()

    await expect(
      page.getByTestId(`activity-LIVE_QUIZ-${CONTROL_DATA.quizName}`)
    ).toBeVisible()
    await page.getByTestId(`actions-LIVE_QUIZ-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId(`delete-live-quiz-${CONTROL_DATA.quizName}`).click()
    await page.getByTestId('confirmation-modal-confirm').click()
    await expect(page.getByText(CONTROL_DATA.quizName)).not.toBeVisible()
  })

  test('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', async ({
    loginLecturer,
  }) => {
    await removeSoftDeletedLiveQuiz({ lqName: CONTROL_DATA.quizName })
    await loginLecturer()
  })
})
