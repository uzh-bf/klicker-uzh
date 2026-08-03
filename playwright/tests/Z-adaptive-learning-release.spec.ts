import {
  AdaptivePracticeQuizAttemptStatus,
  AdaptivePracticeQuizPreset,
  ElementType,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { expect, type Page, type Request, type Route } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  ADAPTIVE_RELEASE_ELEMENT_TYPES,
  createAdaptiveReleaseCourse,
  createAdaptiveReleaseFixture,
  seedTenPersonSuppressedCohort,
} from '../util/adaptive-release-fixtures.js'
import {
  COURSE_ID_TEST,
  USER_ID_TEST,
  USER_ID_TEST4,
} from '../util/constants.js'
import { test } from '../util/fixtures.js'

const manageUrl = process.env.URL_MANAGE ?? 'http://manage.be06.localhost:3302'
const studentUrl = process.env.URL_STUDENT ?? 'http://pwa.be06.localhost:3301'
const graphqlUrl =
  process.env.PLAYWRIGHT_GRAPHQL_URL ??
  'http://api.be06.localhost:3300/api/graphql'

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{
    message: string
    extensions?: { code?: string }
  }>
}

const attemptStateFields = `
  attemptId
  status
  answeredQuestions
  questionNumber
  maximumQuestions
  servedItem {
    poolItemId
    type
  }
`

test.describe('Adaptive PracticeQuiz release boundaries', () => {
  test.describe.configure({ timeout: 180_000 })

  test('does not enumerate adaptive metadata across owner or course boundaries', async ({
    page,
    loginInstitutionalCatalyst,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveReleaseFixture({
      key: 'permission-boundary',
    })
    const foreignCourse = await createAdaptiveReleaseCourse({
      key: 'foreign-owner',
      ownerId: USER_ID_TEST4,
    })
    const unenrolledCourse = await createAdaptiveReleaseCourse({
      key: 'unenrolled-student',
      ownerId: fixture.ownerId,
    })
    const unenrolledFixture = await createAdaptiveReleaseFixture({
      key: 'unenrolled-student',
      courseId: unenrolledCourse.id,
    })

    await loginInstitutionalCatalyst()
    await page.goto(`${manageUrl}/resources/competenceTrees`, {
      waitUntil: 'commit',
    })
    await expect(page.getByTestId('competence-tree-create')).toBeVisible()
    await expect(page.getByText(fixture.tree.displayName)).toHaveCount(0)

    const treeList = await graphql<{
      competenceTrees: Array<{ id: string; name: string }>
    }>(page, {
      operationName: 'AdaptiveReleaseCompetenceTrees',
      query: `
        query AdaptiveReleaseCompetenceTrees {
          competenceTrees {
            id
            name
          }
        }
      `,
    })
    expect(treeList.errors).toBeUndefined()
    expect(treeList.data?.competenceTrees.map(({ id }) => id)).not.toContain(
      fixture.tree.id
    )

    const directTree = await graphql<{
      competenceTree: { id: string; name: string } | null
    }>(page, {
      operationName: 'AdaptiveReleaseCompetenceTree',
      query: `
        query AdaptiveReleaseCompetenceTree($id: String!) {
          competenceTree(id: $id) {
            id
            name
          }
        }
      `,
      variables: { id: fixture.tree.id },
    })
    expect(directTree.errors).toBeUndefined()
    expect(directTree.data?.competenceTree).toBeNull()

    const directQuiz = await graphql<{
      practiceQuiz: { id: string; displayName: string } | null
    }>(page, {
      operationName: 'AdaptiveReleasePracticeQuiz',
      query: `
        query AdaptiveReleasePracticeQuiz($id: String!) {
          practiceQuiz(id: $id) {
            id
            displayName
          }
        }
      `,
      variables: { id: fixture.quiz.id },
    })
    expect(directQuiz.errors).toBeUndefined()
    expect(directQuiz.data?.practiceQuiz).toBeNull()

    const forbiddenLink = await graphql<{
      linkCompetenceTreeToCourse: { id: string } | null
    }>(page, {
      operationName: 'AdaptiveReleaseLinkCompetenceTree',
      query: `
        mutation AdaptiveReleaseLinkCompetenceTree(
          $treeId: String!
          $courseId: String!
        ) {
          linkCompetenceTreeToCourse(treeId: $treeId, courseId: $courseId) {
            id
          }
        }
      `,
      variables: {
        treeId: fixture.tree.id,
        courseId: foreignCourse.id,
      },
    })
    expectGraphqlError(forbiddenLink, 'NOT_FOUND')
    await expect(
      (await getPrisma()).competenceTreeCourse.count({
        where: {
          treeId: fixture.tree.id,
          courseId: foreignCourse.id,
        },
      })
    ).resolves.toBe(0)

    await loginStudentPassword('testuser1')
    await page.goto(
      `${studentUrl}/course/${unenrolledCourse.id}/practiceQuizzes/${unenrolledFixture.quiz.id}`,
      { waitUntil: 'commit' }
    )
    await expect(
      page.getByText(
        'The corresponding practice quiz is either not available or not yet published.'
      )
    ).toBeVisible()
    await expect(page.getByTestId('adaptive-practice-quiz-intro')).toHaveCount(
      0
    )

    const forbiddenStart = await startAdaptiveAttempt(
      page,
      unenrolledFixture.quiz.id
    )
    expectGraphqlError(forbiddenStart, 'ADAPTIVE_PARTICIPATION_REQUIRED')
  })

  test('revokes browser and API access immediately after unpublication', async ({
    page,
    loginLecturer,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveReleaseFixture({
      key: 'publication-revocation',
    })
    const quizUrl = `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${fixture.quiz.id}`

    await loginStudentPassword('testuser1')
    await page.goto(quizUrl, { waitUntil: 'commit' })
    await expect(page.getByTestId('adaptive-practice-quiz-intro')).toBeVisible()
    await page.getByTestId('start-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toBeVisible()

    const prisma = await getPrisma()
    const startedAttempt =
      await prisma.adaptivePracticeQuizAttempt.findFirstOrThrow({
        where: {
          practiceQuizId: fixture.quiz.id,
          status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
        },
      })

    await loginLecturer()
    const unpublished = await graphql<{
      unpublishPracticeQuiz: {
        id: string
        status: PublicationStatus
      } | null
    }>(page, {
      operationName: 'AdaptiveReleaseUnpublishPracticeQuiz',
      query: `
        mutation AdaptiveReleaseUnpublishPracticeQuiz($id: String!) {
          unpublishPracticeQuiz(id: $id) {
            id
            status
          }
        }
      `,
      variables: { id: fixture.quiz.id },
    })
    expect(unpublished.errors).toBeUndefined()
    expect(unpublished.data?.unpublishPracticeQuiz).toEqual({
      id: fixture.quiz.id,
      status: PublicationStatus.DRAFT,
    })

    await loginStudentPassword('testuser1')
    await page.goto(quizUrl, { waitUntil: 'commit' })
    await expect(
      page.getByText(
        'The corresponding practice quiz is either not available or not yet published.'
      )
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toHaveCount(0)

    const rejectedStart = await startAdaptiveAttempt(page, fixture.quiz.id)
    expectGraphqlError(rejectedStart, 'ADAPTIVE_QUIZ_UNAVAILABLE')
    await expect(
      prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
        where: { id: startedAttempt.id },
        select: { status: true },
      })
    ).resolves.toEqual({
      status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
    })
    await expect(
      prisma.practiceQuizAdaptivePoolItem.count({
        where: { configId: fixture.config.id },
      })
    ).resolves.toBe(1)
  })

  test('renders all five element types and supports resume and start-over', async ({
    page,
    loginStudentPassword,
  }) => {
    test.setTimeout(180_000)
    const fixture = await createAdaptiveReleaseFixture({
      key: 'five-types-lifecycle',
      elementTypes: ADAPTIVE_RELEASE_ELEMENT_TYPES,
    })
    const quizUrl = `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${fixture.quiz.id}`
    const prisma = await getPrisma()
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { username: 'testuser1' },
      select: { id: true },
    })

    await loginStudentPassword('testuser1')
    await page.goto(quizUrl, { waitUntil: 'commit' })
    await page.getByTestId('start-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toBeVisible()
    const originalAttempt =
      await prisma.adaptivePracticeQuizAttempt.findFirstOrThrow({
        where: {
          practiceQuizId: fixture.quiz.id,
          participantId: participant.id,
          status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
        },
        select: { id: true, nextPoolItemId: true },
      })

    await page.reload({ waitUntil: 'commit' })
    await expect(
      page.getByTestId('adaptive-practice-quiz-resume-info')
    ).toBeVisible()
    await page.getByTestId('resume-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toBeVisible()
    await expect
      .poll(async () => {
        const attempt =
          await prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
            where: { id: originalAttempt.id },
            select: { nextPoolItemId: true },
          })
        return attempt.nextPoolItemId
      })
      .toBe(originalAttempt.nextPoolItemId)

    await page.reload({ waitUntil: 'commit' })
    await page.getByTestId('open-restart-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('confirm-restart-adaptive-practice-quiz')
    ).toBeVisible()
    let restartCommitted = false
    const restartResponseLoss = async (route: Route) => {
      if (
        !hasGraphqlOperation(
          route.request(),
          'MRestartAdaptivePracticeQuizAttempt'
        )
      ) {
        await route.continue()
        return
      }

      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      const payload = (await response.json()) as GraphqlResponse<unknown>
      expect(payload.errors, JSON.stringify(payload.errors)).toBeUndefined()
      restartCommitted = true
      await fulfillGraphqlError(route, 'Simulated lost restart response.')
    }
    await page.route('**/api/graphql', restartResponseLoss)
    await page.getByTestId('confirm-restart-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toBeVisible()
    expect(restartCommitted).toBe(true)
    await page.unroute('**/api/graphql', restartResponseLoss)

    await expect
      .poll(async () => {
        const attempts = await prisma.adaptivePracticeQuizAttempt.findMany({
          where: {
            practiceQuizId: fixture.quiz.id,
            participantId: participant.id,
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, status: true },
        })
        return attempts
      })
      .toEqual([
        {
          id: originalAttempt.id,
          status: AdaptivePracticeQuizAttemptStatus.ABANDONED,
        },
        {
          id: expect.not.stringMatching(originalAttempt.id),
          status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
        },
      ])

    const seenTypes = new Set<ElementType>()
    for (
      let question = 1;
      question <= ADAPTIVE_RELEASE_ELEMENT_TYPES.length;
      question++
    ) {
      await expect(
        page.getByTestId('adaptive-question-progress')
      ).toContainText(`Question ${question}`)
      const attempt = await prisma.adaptivePracticeQuizAttempt.findFirstOrThrow(
        {
          where: {
            practiceQuizId: fixture.quiz.id,
            participantId: participant.id,
            status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
          },
          include: { nextPoolItem: true },
        }
      )
      if (!attempt.nextPoolItem) {
        throw new Error(`Question ${question} has no served pool item.`)
      }

      seenTypes.add(attempt.nextPoolItem.elementType)
      await expect(
        page.getByTestId('adaptive-practice-quiz-question')
      ).toContainText(
        `Adaptive release ${attempt.nextPoolItem.elementType} question`
      )
      await answerAdaptiveQuestion(page, attempt.nextPoolItem.elementType)
      const submissionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/graphql') &&
          hasGraphqlOperation(
            response.request(),
            'MSubmitAdaptivePracticeQuizResponse'
          )
      )
      await page.getByTestId('submit-adaptive-practice-quiz-response').click()
      const submission = await submissionResponse
      const submissionPayload =
        (await submission.json()) as GraphqlResponse<unknown>
      expect(
        submissionPayload.errors,
        JSON.stringify(submissionPayload.errors)
      ).toBeUndefined()

      if (question < ADAPTIVE_RELEASE_ELEMENT_TYPES.length) {
        await expect(
          page.getByTestId('adaptive-question-progress')
        ).toContainText(`Question ${question + 1}`)
      }
    }

    await expect(
      page.getByTestId('adaptive-practice-quiz-result')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-result-level-interpretation')
    ).toContainText('diagnostic rule')
    expect([...seenTypes].sort()).toEqual(
      [...ADAPTIVE_RELEASE_ELEMENT_TYPES].sort()
    )
    await expect(
      prisma.adaptivePracticeQuizResponse.count({
        where: {
          attempt: {
            practiceQuizId: fixture.quiz.id,
            participantId: participant.id,
          },
        },
      })
    ).resolves.toBe(5)
  })

  test('preserves unknown elapsed time when an attempt is resumed', async ({
    page,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveReleaseFixture({
      key: 'unknown-elapsed-time',
      elementTypes: [ElementType.SC, ElementType.SC],
    })
    const quizUrl = `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${fixture.quiz.id}`

    await loginStudentPassword('testuser1')
    const started = await startAdaptiveAttempt(page, fixture.quiz.id)
    expect(started.errors).toBeUndefined()
    const state = started.data?.startAdaptivePracticeQuizAttempt
    if (!state?.servedItem) throw new Error('Adaptive attempt did not start.')

    const submitted = await submitAdaptiveResponse(page, {
      attemptId: state.attemptId,
      servedItemId: state.servedItem.poolItemId,
      response: { choiceIndices: [0] },
      elapsedSeconds: null,
    })
    expect(submitted.errors).toBeUndefined()

    await page.goto(quizUrl, { waitUntil: 'commit' })
    await page.getByTestId('resume-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toBeVisible()
    await expect(page.getByTestId('adaptive-question-timer')).toHaveCount(0)
  })

  test('explains placement result bands in English and German', async ({
    page,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveReleaseFixture({
      key: 'placement-result-interpretation',
      elementTypes: ADAPTIVE_RELEASE_ELEMENT_TYPES,
      preset: AdaptivePracticeQuizPreset.PLACEMENT,
    })
    const quizPath = `/course/${COURSE_ID_TEST}/practiceQuizzes/${fixture.quiz.id}`
    const prisma = await getPrisma()

    await loginStudentPassword('testuser1')
    await page.goto(`${studentUrl}${quizPath}`, { waitUntil: 'commit' })
    await page.getByTestId('start-adaptive-practice-quiz').click()
    await expect(
      page.getByTestId('adaptive-practice-quiz-question')
    ).toBeVisible()

    for (
      let question = 0;
      question < ADAPTIVE_RELEASE_ELEMENT_TYPES.length;
      question++
    ) {
      const attempt = await prisma.adaptivePracticeQuizAttempt.findFirstOrThrow(
        {
          where: {
            practiceQuizId: fixture.quiz.id,
            status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
          },
          include: { nextPoolItem: true },
        }
      )
      if (!attempt.nextPoolItem) {
        throw new Error(`Placement question ${question + 1} is missing.`)
      }
      await answerAdaptiveQuestion(page, attempt.nextPoolItem.elementType)
      const submissionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/graphql') &&
          hasGraphqlOperation(
            response.request(),
            'MSubmitAdaptivePracticeQuizResponse'
          )
      )
      await page.getByTestId('submit-adaptive-practice-quiz-response').click()
      const submission = await submissionResponse
      const submissionPayload =
        (await submission.json()) as GraphqlResponse<unknown>
      expect(
        submissionPayload.errors,
        JSON.stringify(submissionPayload.errors)
      ).toBeUndefined()
    }

    await expect(
      page.getByTestId('adaptive-practice-quiz-result')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-result-level-interpretation')
    ).toContainText('placement rule')

    await page.goto(`${studentUrl}/de${quizPath}`, { waitUntil: 'commit' })
    await expect(
      page.getByTestId('adaptive-result-level-interpretation')
    ).toContainText('Einstufungsregel')
  })

  test('keeps a course with retained adaptive history and explains why', async ({
    page,
    loginLecturer,
    loginStudentPassword,
  }) => {
    const course = await createAdaptiveReleaseCourse({
      key: 'retained-history',
      ownerId: USER_ID_TEST,
    })
    const fixture = await createAdaptiveReleaseFixture({
      key: 'retained-history',
      courseId: course.id,
    })
    const prisma = await getPrisma()
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { username: 'testuser1' },
      select: { id: true },
    })
    await prisma.participation.create({
      data: { courseId: course.id, participantId: participant.id },
    })

    await loginStudentPassword('testuser1')
    const started = await startAdaptiveAttempt(page, fixture.quiz.id)
    expect(started.errors).toBeUndefined()

    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`delete-course-${course.name}`).click()
    await page.getByTestId('course-deletion-participations-confirm').click()
    await page.getByTestId('course-deletion-practice-quiz-confirm').click()
    await expect(
      page.getByTestId('course-deletion-modal-confirm')
    ).toBeEnabled()
    await page.getByTestId('course-deletion-modal-confirm').click()

    await expect(page.getByTestId('course-deletion-error')).toContainText(
      'Archive the course instead'
    )
    await expect(
      page.getByTestId('course-deletion-modal-confirm')
    ).toBeVisible()
    await expect(
      prisma.course.findUnique({ where: { id: course.id } })
    ).resolves.not.toBeNull()
  })

  test('rejects stale and concurrent duplicate submissions at the API boundary', async ({
    page,
    loginStudentPassword,
  }) => {
    const fixture = await createAdaptiveReleaseFixture({
      key: 'submission-integrity',
      elementTypes: [ElementType.SC, ElementType.SC],
    })
    await loginStudentPassword('testuser1')

    const started = await startAdaptiveAttempt(page, fixture.quiz.id)
    expect(started.errors).toBeUndefined()
    const state = started.data?.startAdaptivePracticeQuizAttempt
    if (!state?.servedItem) throw new Error('Adaptive attempt did not start.')
    const staleItem = fixture.poolItems.find(
      ({ id }) => id !== state.servedItem!.poolItemId
    )
    if (!staleItem) throw new Error('A stale adaptive pool item is required.')

    const stale = await submitAdaptiveResponse(page, {
      attemptId: state.attemptId,
      servedItemId: staleItem.id,
      response: { choiceIndices: [0] },
    })
    expectGraphqlError(stale, 'ADAPTIVE_ITEM_NOT_SERVED')

    const concurrent = await Promise.all([
      submitAdaptiveResponse(page, {
        attemptId: state.attemptId,
        servedItemId: state.servedItem.poolItemId,
        response: { choiceIndices: [0] },
      }),
      submitAdaptiveResponse(page, {
        attemptId: state.attemptId,
        servedItemId: state.servedItem.poolItemId,
        response: { choiceIndices: [0] },
      }),
    ])
    const successes = concurrent.filter(
      (result) => result.data?.submitAdaptivePracticeQuizResponse
    )
    const failures = concurrent.filter((result) =>
      result.errors?.some(
        ({ extensions }) =>
          extensions?.code === 'ADAPTIVE_RESPONSE_ALREADY_SUBMITTED'
      )
    )
    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)

    const prisma = await getPrisma()
    await expect(
      prisma.adaptivePracticeQuizResponse.count({
        where: { attemptId: state.attemptId },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
        where: { id: state.attemptId },
        select: { nextPoolItemId: true },
      })
    ).resolves.toEqual({ nextPoolItemId: staleItem.id })
  })

  test('releases ten-person results while suppressing small complementary cells', async ({
    page,
    loginLecturer,
  }) => {
    const fixture = await createAdaptiveReleaseFixture({
      key: 'ten-person-privacy',
    })
    await seedTenPersonSuppressedCohort(fixture)

    await loginLecturer(
      `${manageUrl}/practiceQuiz/${fixture.quiz.id}/evaluation`
    )
    await expect(page.getByTestId('adaptive-evaluation')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-attempt-completed')
    ).toContainText('10')
    await expect(
      page.getByTestId('adaptive-evaluation-summary-suppressed')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-distribution-overall-suppressed')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-attempt-insufficientData')
    ).toContainText('Withheld')

    const cohort = await graphql<{
      adaptivePracticeQuizCohortResults: {
        cohortSize: number | null
        suppressed: boolean
        attemptSummary: {
          suppressed: boolean
          capped: number | null
          insufficientData: number | null
          suppressions: Array<{ field: string; reason: string }>
        }
        distributions: Array<{
          nodeKind: string
          suppressed: boolean
          buckets: Array<{ count: number }>
          suppressions: Array<{ field: string; reason: string }>
        }>
      } | null
    }>(page, {
      operationName: 'AdaptiveReleaseCohortResults',
      query: `
        query AdaptiveReleaseCohortResults($practiceQuizId: String!) {
          adaptivePracticeQuizCohortResults(
            practiceQuizId: $practiceQuizId
          ) {
            cohortSize
            suppressed
            attemptSummary {
              suppressed
              capped
              insufficientData
              suppressions {
                field
                reason
              }
            }
            distributions {
              nodeKind
              suppressed
              buckets {
                count
              }
              suppressions {
                field
                reason
              }
            }
          }
        }
      `,
      variables: { practiceQuizId: fixture.quiz.id },
    })
    expect(cohort.errors).toBeUndefined()
    const results = cohort.data?.adaptivePracticeQuizCohortResults
    expect(results).not.toBeNull()
    expect(results).toMatchObject({
      cohortSize: 10,
      suppressed: true,
      attemptSummary: {
        suppressed: true,
        capped: 10,
        insufficientData: null,
      },
    })
    expect(results?.attemptSummary.suppressions).toContainEqual({
      field: 'INSUFFICIENT_DATA',
      reason: 'SMALL_CELL_OR_COMPLEMENT',
    })
    expect(
      results?.distributions.find(({ nodeKind }) => nodeKind === 'OVERALL')
    ).toMatchObject({
      suppressed: true,
      buckets: [],
      suppressions: [
        {
          field: 'DISTRIBUTION',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
      ],
    })
    await expect(
      (await getPrisma()).adaptivePracticeQuizCohortSnapshot.findMany({
        where: { configId: fixture.config.id },
        select: { releaseSize: true },
      })
    ).resolves.toEqual([{ releaseSize: 10 }])
  })
})

async function graphql<T>(
  page: Page,
  {
    operationName,
    query,
    variables,
  }: {
    operationName: string
    query: string
    variables?: Record<string, unknown>
  }
): Promise<GraphqlResponse<T>> {
  const response = await page.request.post(graphqlUrl, {
    headers: {
      'content-type': 'application/json',
      origin: new URL(page.url()).origin,
      'x-graphql-yoga-csrf': 'true',
    },
    data: { operationName, query, variables },
  })
  expect(response.ok()).toBe(true)
  return (await response.json()) as GraphqlResponse<T>
}

async function startAdaptiveAttempt(page: Page, practiceQuizId: string) {
  return await graphql<{
    startAdaptivePracticeQuizAttempt: {
      attemptId: string
      status: string
      answeredQuestions: number
      questionNumber: number | null
      maximumQuestions: number
      servedItem: { poolItemId: number; type: ElementType } | null
    } | null
  }>(page, {
    operationName: 'AdaptiveReleaseStartAttempt',
    query: `
      mutation AdaptiveReleaseStartAttempt($practiceQuizId: String!) {
        startAdaptivePracticeQuizAttempt(practiceQuizId: $practiceQuizId) {
          ${attemptStateFields}
        }
      }
    `,
    variables: { practiceQuizId },
  })
}

async function submitAdaptiveResponse(
  page: Page,
  variables: {
    attemptId: string
    servedItemId: number
    response: {
      choiceIndices?: number[]
      numericalResponse?: string
      freeTextResponse?: string
    }
    elapsedSeconds?: number | null
  }
) {
  return await graphql<{
    submitAdaptivePracticeQuizResponse: {
      attemptId: string
      status: string
      answeredQuestions: number
      questionNumber: number | null
      maximumQuestions: number
      servedItem: { poolItemId: number; type: ElementType } | null
    } | null
  }>(page, {
    operationName: 'AdaptiveReleaseSubmitResponse',
    query: `
      mutation AdaptiveReleaseSubmitResponse(
        $attemptId: String!
        $servedItemId: Int!
        $response: AdaptivePracticeQuizResponseInput!
        $elapsedSeconds: Int
      ) {
        submitAdaptivePracticeQuizResponse(
          attemptId: $attemptId
          servedItemId: $servedItemId
          response: $response
          elapsedSeconds: $elapsedSeconds
        ) {
          ${attemptStateFields}
        }
      }
    `,
    variables,
  })
}

async function fulfillGraphqlError(route: Route, message: string) {
  const origin = route.request().headers().origin

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: origin
      ? {
          'access-control-allow-credentials': 'true',
          'access-control-allow-origin': origin,
          vary: 'Origin',
        }
      : undefined,
    body: JSON.stringify({
      data: null,
      errors: [{ message }],
    }),
  })
}

function expectGraphqlError(
  response: GraphqlResponse<unknown>,
  expectedCode: string
) {
  expect(response.errors?.map(({ extensions }) => extensions?.code)).toContain(
    expectedCode
  )
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

async function answerAdaptiveQuestion(page: Page, type: ElementType) {
  if (type === ElementType.SC) {
    await page.getByTestId('sc-0-answer-option-0').click()
    return
  }
  if (type === ElementType.MC) {
    await page.getByTestId('mc-0-answer-option-0').click()
    await page.getByTestId('mc-0-answer-option-2').click()
    return
  }
  if (type === ElementType.KPRIM) {
    for (const [index, answer] of [
      [0, 'correct'],
      [1, 'incorrect'],
      [2, 'correct'],
      [3, 'incorrect'],
    ] as const) {
      await page.getByTestId(`toggle-kp-0-answer-${index}-${answer}`).click()
    }
    return
  }
  if (type === ElementType.NUMERICAL) {
    await page.getByTestId('adaptive-numerical-response').fill('50%')
    return
  }
  if (type === ElementType.FREE_TEXT) {
    await page.getByTestId('free-text-input-0').fill('adaptive')
    return
  }
  throw new Error(`Unsupported adaptive release element type: ${type}`)
}
