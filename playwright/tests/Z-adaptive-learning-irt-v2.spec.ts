import { AdaptiveResultStatus } from '@klicker-uzh/prisma/client'
import { expect, type Page, type Request } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  assertNoSeriousAccessibilityViolations,
  assertReflowsAtTwoHundredPercent,
} from '../util/accessibility.js'
import {
  createAdaptiveV2ResearchDraftFixture,
  createAdaptiveV2ResultFixture,
  seedAdaptiveV2CompletedAttempts,
} from '../util/adaptive-irt-v2-fixtures.js'
import { COURSE_ID_TEST, URL_MANAGE, URL_STUDENT } from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'

const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
const studentUrl = process.env.URL_STUDENT ?? URL_STUDENT

test.describe('Adaptive PracticeQuiz IRT v2 evidence', () => {
  test.describe.configure({ timeout: 180_000 })

  test('authors and publishes a v2 Research quiz, then completes it without a proficiency result', async ({
    page,
    loginLecturer,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveV2ResearchDraftFixture({
      key: 'research-completion',
    })
    const prisma = await getPrisma()
    const quizName = 'Adaptive v2 Research authoring E2E'

    await prisma.practiceQuiz.deleteMany({ where: { name: quizName } })

    await loginLecturer()
    await page.goto(
      `${manageUrl}/resources/competenceTrees/${fixture.tree.id}`,
      { waitUntil: 'commit' }
    )
    await expect(page.getByTestId('adaptive-scale-panel')).toBeVisible()
    await assertNoSeriousAccessibilityViolations(page)
    await page.goto(manageUrl, { waitUntil: 'commit' })
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('insert-practice-quiz-name').fill(quizName)
    await page.getByTestId('practice-quiz-mode-adaptive').click()
    await page.getByTestId('next-or-submit').click()
    await page
      .getByTestId('insert-practice-quiz-display-name')
      .fill('Adaptive v2 Research')
    await page
      .getByTestId('insert-practice-quiz-description')
      .fill('Bayesian IRT Research practice quiz browser evidence.')
    await page.getByTestId('next-or-submit').click()
    await selectOption(page, '[data-cy="select-course"]', 'Testkurs')
    await page.getByTestId('adaptive-preset').click()
    await page.getByTestId('adaptive-preset-research').click()
    await page.getByTestId('adaptive-total-question-cap').fill('8')
    await page.getByTestId('next-or-submit').click()
    await selectOption(
      page,
      '[data-cy="adaptive-tree-select"]',
      fixture.tree.displayName
    )
    await expect(
      page.getByTestId('adaptive-selected-scale-version')
    ).toBeVisible()
    await expect(page.getByTestId('adaptive-use-active-scale')).toHaveCount(0)
    await page.getByTestId('adaptive-refresh-preview').click()
    await expect(page.getByTestId('adaptive-readiness-status')).toBeVisible()
    await expect(page.getByTestId('adaptive-readiness-errors')).toHaveCount(0)
    await assertNoSeriousAccessibilityViolations(page)
    await assertReflowsAtTwoHundredPercent(page)
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('open-activity-overview')).toBeVisible()

    const quiz = await prisma.practiceQuiz.findFirstOrThrow({
      where: { name: quizName },
      include: { adaptiveConfig: true },
    })
    expect(quiz.adaptiveConfig).toMatchObject({
      competenceTreeId: fixture.tree.id,
      scaleVersionId: fixture.scale.id,
      measurementVersion: 'IRT_V2_EAP_GRID_1',
      preset: 'RESEARCH',
    })

    await page.getByTestId('courses').click()
    await page
      .getByTestId('course-list-button-Testkurs')
      .click({ timeout: 30_000 })
    await page.getByRole('tab', { name: /^Practice Quizzes/ }).click()
    await page.getByTestId(`publish-practice-quiz-${quizName}`).click()
    await expect(page.getByTestId('adaptive-publication')).toBeVisible()
    await expect(page.getByTestId('adaptive-readiness-status')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-research-non-classifying')
    ).toBeVisible()
    await expect(
      page.getByTestId('publish-practice-quiz-immediately')
    ).toBeDisabled()
    await expect(
      page.getByText(/simulation (trigger|report|status)/i)
    ).toHaveCount(0)
    await assertNoSeriousAccessibilityViolations(page)
    const publicationConfirmation = page.getByTestId(
      'adaptive-research-publication-confirmation'
    )
    await publicationConfirmation.focus()
    await expect(publicationConfirmation).toBeFocused()
    await publicationConfirmation.press('Space')
    await expect(
      page.getByTestId('publish-practice-quiz-immediately')
    ).toBeEnabled()
    await page.getByTestId('publish-practice-quiz-immediately').click()

    await expect
      .poll(async () => {
        const publishedQuiz = await prisma.practiceQuiz.findUniqueOrThrow({
          where: { id: quiz.id },
          select: { status: true },
        })
        return publishedQuiz.status
      })
      .toBe('PUBLISHED')
    const publication =
      await prisma.practiceQuizAdaptivePublication.findFirstOrThrow({
        where: {
          configId: quiz.adaptiveConfig!.id,
          sealedAt: { not: null },
          supersededAt: null,
          unpublishedAt: null,
        },
      })
    expect(publication).toMatchObject({
      measurementVersion: 'IRT_V2_EAP_GRID_1',
      estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
      preset: 'RESEARCH',
      exposureCeiling: 0.4,
      researchAllocationPolicy: {
        version: 'IRT_V2_RESEARCH_ALLOCATION_2',
        minimumAnchorCountPerLeafBand: 1,
        fieldTestResponsesPerLeaf: 1,
        minimumDistinctAnchorItemsPerLeafBand: 3,
        minimumDistinctFieldTestItemsPerLeaf: 3,
      },
    })
    await expect(
      prisma.practiceQuizAdaptivePoolItem.count({
        where: { publicationId: publication.id },
      })
    ).resolves.toBe(26)
    await expect(
      prisma.adaptivePracticeQuizItemExposure.count({
        where: { publicationId: publication.id },
      })
    ).resolves.toBe(26)

    await loginStudentPassword('testuser16')
    await page.goto(
      `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${quiz.id}`,
      { waitUntil: 'commit' }
    )
    await expect(page.getByTestId('adaptive-practice-quiz-intro')).toBeVisible()
    await assertNoSeriousAccessibilityViolations(page)
    const runtimePayloads: Array<Promise<unknown>> = []
    page.on('response', (response) => {
      if (
        [
          'MStartAdaptivePracticeQuizAttempt',
          'MSubmitAdaptivePracticeQuizResponse',
        ].some((operationName) =>
          hasGraphqlOperation(response.request(), operationName)
        )
      ) {
        runtimePayloads.push(response.json())
      }
    })
    const startPayloadPromise = waitForGraphqlPayload(
      page,
      'MStartAdaptivePracticeQuizAttempt'
    )
    await page.getByTestId('start-adaptive-practice-quiz').click()
    await startPayloadPromise

    const resultPayloadPromise = waitForGraphqlPayload(
      page,
      'QAdaptivePracticeQuizResult'
    )
    for (let question = 1; question <= 8; question++) {
      await expect(
        page.getByTestId('adaptive-practice-quiz-question')
      ).toBeVisible()
      await expect(
        page.getByTestId('adaptive-question-progress')
      ).toContainText(`Question ${question}`)
      if (question === 1) {
        await assertNoSeriousAccessibilityViolations(page)
      }
      await page.getByTestId('sc-0-answer-option-0').click()
      await page.getByTestId('submit-adaptive-practice-quiz-response').click()
      if (question < 8) {
        await expect(
          page.getByTestId('adaptive-submitted-response-feedback')
        ).toContainText('Correct')
      }
    }

    await expect(
      page.getByTestId('adaptive-practice-quiz-result')
    ).toBeVisible()
    await expect(page.getByTestId('adaptive-result-overall-level')).toHaveText(
      'Practice completed'
    )
    await expect(page.getByText('No proficiency result')).toBeVisible()
    await expect(page.getByTestId('adaptive-result-trajectory')).toHaveCount(0)
    await expect(page.getByTestId('adaptive-competence-profile')).toHaveCount(0)
    await expect(page.getByTestId('adaptive-result-next-step')).toHaveCount(0)
    await expect(page.getByText(/estimated level|current level/i)).toHaveCount(
      0
    )
    await assertNoSeriousAccessibilityViolations(page)

    const resultPayload = await resultPayloadPromise
    const result = resultPayload.data?.adaptivePracticeQuizResult
    expect(result).toMatchObject({
      classification: 'RESEARCH_ONLY',
      levelLabel: null,
      leadingLevelLabels: [],
      classificationProbability: null,
      position: null,
      lowerPosition: null,
      upperPosition: null,
      levelBands: [],
      trajectory: [],
    })
    expectNoAdaptivePrivateKeys(resultPayload)
    for (const payload of await Promise.all(runtimePayloads)) {
      expectNoAdaptivePrivateKeys(payload)
    }
  })

  test('renders each releasable v2 participant result state without raw psychometric fields', async ({
    page,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveV2ResultFixture({
      key: 'participant-result-states',
    })
    const results = resultRows(1)
    await seedAdaptiveV2CompletedAttempts({ fixture, results })

    const representatives = [
      {
        username: 'testuser1',
        headline: 'Estimated level: Foundation',
        classification: 'CLASSIFIED',
      },
      {
        username: 'testuser6',
        headline: 'Between Foundation / Independent',
        classification: 'BETWEEN_LEVELS',
      },
      {
        username: 'testuser11',
        headline: 'No complete result yet',
        classification: 'INSUFFICIENT_EVIDENCE',
      },
      {
        username: 'testuser16',
        headline: 'More suitable questions are needed',
        classification: 'POOL_LIMITED',
      },
    ] as const

    for (const representative of representatives) {
      await loginStudentPassword(representative.username)
      const resultPayloadPromise = waitForGraphqlPayload(
        page,
        'QAdaptivePracticeQuizResult'
      )
      await page.goto(
        `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${fixture.quiz.id}`,
        { waitUntil: 'commit' }
      )
      await expect(
        page.getByTestId('adaptive-practice-quiz-result')
      ).toBeVisible()
      await expect(
        page.getByTestId('adaptive-result-overall-level')
      ).toHaveText(representative.headline)
      await expect(page.getByTestId('adaptive-result-trajectory')).toBeVisible()
      await expect(
        page.getByTestId('adaptive-competence-profile')
      ).toBeVisible()
      await expect(page.getByTestId('adaptive-result-next-step')).toBeVisible()
      await assertNoSeriousAccessibilityViolations(page)
      if (representative.username === 'testuser1') {
        await assertReflowsAtTwoHundredPercent(page)
      }

      const payload = await resultPayloadPromise
      expect(payload.data?.adaptivePracticeQuizResult?.classification).toBe(
        representative.classification
      )
      expectNoAdaptivePrivateKeys(payload)
    }
  })

  test('shows suppressed and released lecturer cohorts without participant identities', async ({
    page,
    loginLecturer,
  }) => {
    const suppressedFixture = await createAdaptiveV2ResultFixture({
      key: 'cohort-suppressed',
    })
    await seedAdaptiveV2CompletedAttempts({
      fixture: suppressedFixture,
      results: Array.from({ length: 4 }, (_, index) => ({
        participantUsername: `testuser${index + 21}`,
        status: AdaptiveResultStatus.CLASSIFIED,
      })),
    })
    const releasedFixture = await createAdaptiveV2ResultFixture({
      key: 'cohort-released',
    })
    await seedAdaptiveV2CompletedAttempts({
      fixture: releasedFixture,
      results: resultRows(1),
    })

    await loginLecturer(
      `${manageUrl}/practiceQuiz/${suppressedFixture.quiz.id}/evaluation`
    )
    await expect(page.getByTestId('adaptive-evaluation')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-cohort-suppressed')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-summary-suppressed')
    ).toBeVisible()
    await expect(page.getByText(/testuser/i)).toHaveCount(0)
    await assertNoSeriousAccessibilityViolations(page)

    const cohortPayloadPromise = waitForGraphqlPayload(
      page,
      'QAdaptivePracticeQuizCohortResults'
    )
    await page.goto(
      `${manageUrl}/practiceQuiz/${releasedFixture.quiz.id}/evaluation`,
      { waitUntil: 'commit' }
    )
    await expect(page.getByTestId('adaptive-evaluation')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-cohort-suppressed')
    ).toHaveCount(0)
    await expect(
      page.getByTestId('adaptive-evaluation-attempt-classified')
    ).toContainText('5')
    await expect(
      page.getByTestId('adaptive-evaluation-distribution-overall')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-root-distributions')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-calibration-health')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-calibration-health-status')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-calibration-health-open-tree')
    ).toBeVisible()
    await expect(page.getByText(/testuser/i)).toHaveCount(0)
    await assertNoSeriousAccessibilityViolations(page)

    const cohortPayload = await cohortPayloadPromise
    const cohort = cohortPayload.data?.adaptivePracticeQuizCohortResults
    expect(cohort).toMatchObject({
      competenceTreeId: releasedFixture.tree.id,
      cohortSize: 20,
      attemptSummary: {
        classified: 5,
        betweenLevels: 5,
        insufficientEvidence: 5,
        poolLimited: 5,
        researchOnly: 0,
      },
    })
    expectNoAdaptivePrivateKeys(cohortPayload)
  })
})

type GraphqlPayload = {
  data?: {
    adaptivePracticeQuizResult?: Record<string, unknown> | null
    adaptivePracticeQuizCohortResults?: Record<string, unknown> | null
  }
  errors?: Array<{ message: string }>
}

function resultRows(firstParticipant: number) {
  const statuses = [
    AdaptiveResultStatus.CLASSIFIED,
    AdaptiveResultStatus.BETWEEN_LEVELS,
    AdaptiveResultStatus.INSUFFICIENT_EVIDENCE,
    AdaptiveResultStatus.POOL_LIMITED,
  ]
  return statuses.flatMap((status, statusIndex) =>
    Array.from({ length: 5 }, (_, index) => ({
      participantUsername: `testuser${firstParticipant + statusIndex * 5 + index}`,
      status,
    }))
  )
}

async function waitForGraphqlPayload(page: Page, operationName: string) {
  const response = await page.waitForResponse(
    (candidate) => hasGraphqlOperation(candidate.request(), operationName),
    { timeout: 120_000 }
  )
  expect(response.ok()).toBe(true)
  const payload = (await response.json()) as GraphqlPayload
  expect(payload.errors).toBeUndefined()
  return payload
}

function hasGraphqlOperation(request: Request, operationName: string) {
  let payload: unknown
  try {
    payload = request.postDataJSON()
  } catch {
    return false
  }
  const operations = Array.isArray(payload) ? payload : [payload]
  return operations.some(
    (operation) =>
      typeof operation === 'object' &&
      operation !== null &&
      'operationName' in operation &&
      operation.operationName === operationName
  )
}

function expectNoAdaptivePrivateKeys(value: unknown) {
  const forbidden = new Set([
    'theta',
    'standardError',
    'posterior',
    'bandProbabilities',
    'difficulty',
    'discrimination',
    'guessing',
    'calibrationId',
    'participantId',
    'participationId',
    'username',
    'email',
    'answerKey',
    'correctChoiceIndices',
    'futureItems',
    'sampleSolution',
    'solution',
  ])
  const keys = collectKeys(value)
  for (const key of forbidden) expect(keys).not.toContain(key)
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys)
    return keys
  }
  if (!value || typeof value !== 'object') return keys
  for (const [key, child] of Object.entries(value)) {
    keys.add(key)
    collectKeys(child, keys)
  }
  return keys
}
