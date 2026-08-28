import { readFile } from 'node:fs/promises'
import type { Page, Request } from '@playwright/test'
import { getPrisma, seedActivities } from '../global-setup.js'
import { openCourseActionMenu } from '../util/actions.js'
import { cleanupTest } from '../util/cleanup.js'
import {
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  SEEDED_COURSE,
  USER_ID_TEST2,
  URL_MANAGE,
  viewPorts,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  prepareSeededCourseLearningAnalytics,
  prepareSeededCourseLearningAnalyticsOwnerAccess,
  prepareSeededCourseLearningAnalyticsReadAccess,
  prepareSeededLearningAnalyticsV2,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'

type GraphQLOperation = {
  operationName: string
  variables: Record<string, unknown>
}

type GraphQLResponseRecord = GraphQLOperation & {
  status: number
  body: unknown
}

type GraphQLRecorder = {
  operations: GraphQLOperation[]
  responses: GraphQLResponseRecord[]
}

const V1_DISCLOSURE_OPERATIONS = new Set([
  'GetCourseActivityAnalytics',
  'GetCourseWeeklyActivity',
  'GetCoursePerformanceAnalytics',
  'GetCourseActivities',
  'GetActivityAnalytics',
])

const V2_ACTIVITY_OPERATION = 'GetCourseActivityAnalyticsV2'
const V2_PERFORMANCE_OPERATION = 'GetCoursePerformanceAnalyticsV2'
const V2_EXPORT_OPERATION = 'GetCourseLearningAnalyticsExportV2'

const expectedStudents = Array.from({ length: 5 }, (_, index) => ({
  studentLabel: `Student ${index + 1}`,
  completedActivities: 1,
  meanCompletionPercent: 100,
}))
const expectedJsonExport = JSON.stringify({
  schemaVersion: 'v2',
  effectiveN: 5,
  students: expectedStudents,
})
const expectedCsvExport = [
  'schemaVersion,v2',
  'effectiveN,5',
  'studentLabel,completedActivities,meanCompletionPercent',
  ...expectedStudents.map(
    ({ studentLabel, completedActivities, meanCompletionPercent }) =>
      `${studentLabel},${completedActivities},${meanCompletionPercent}`
  ),
].join('\n')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseGraphQLOperation(request: Request): GraphQLOperation | undefined {
  if (request.method() !== 'POST' || !request.url().includes('/graphql')) {
    return undefined
  }

  try {
    const payload: unknown = request.postDataJSON()
    if (!isRecord(payload) || typeof payload.operationName !== 'string') {
      return undefined
    }

    return {
      operationName: payload.operationName,
      variables: isRecord(payload.variables) ? payload.variables : {},
    }
  } catch {
    return undefined
  }
}

function recordGraphQLOperations(page: Page): GraphQLRecorder {
  const recorder: GraphQLRecorder = { operations: [], responses: [] }

  page.on('request', (request) => {
    const operation = parseGraphQLOperation(request)
    if (operation) recorder.operations.push(operation)
  })
  page.on('response', (response) => {
    const operation = parseGraphQLOperation(response.request())
    if (!operation) return

    void response
      .json()
      .then((body: unknown) => {
        recorder.responses.push({
          ...operation,
          status: response.status(),
          body,
        })
      })
      .catch(() => undefined)
  })

  return recorder
}

function hasVariables(
  operation: GraphQLOperation,
  expectedVariables: Record<string, unknown>
) {
  return Object.entries(expectedVariables).every(
    ([key, value]) => operation.variables[key] === value
  )
}

async function waitForGraphQLResponse(
  recorder: GraphQLRecorder,
  operationName: string,
  expectedVariables: Record<string, unknown> = {}
) {
  await expect
    .poll(() =>
      recorder.responses.some(
        (response) =>
          response.operationName === operationName &&
          hasVariables(response, expectedVariables)
      )
    )
    .toBe(true)

  return recorder.responses.find(
    (response) =>
      response.operationName === operationName &&
      hasVariables(response, expectedVariables)
  )!
}

function graphQLResponseField(record: GraphQLResponseRecord, field: string) {
  expect(record.status).toBe(200)
  expect(isRecord(record.body)).toBe(true)
  const body = record.body as Record<string, unknown>
  expect(body.errors).toBeUndefined()
  expect(isRecord(body.data)).toBe(true)

  return (body.data as Record<string, unknown>)[field]
}

function withoutTypenames(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTypenames)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '__typename')
      .map(([key, child]) => [key, withoutTypenames(child)])
  )
}

function expectNoRawParticipantData(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const participantId of PARTICIPANT_IDS.slice(0, 5)) {
    expect(serialized).not.toContain(participantId)
  }
  for (let index = 1; index <= 5; index++) {
    expect(serialized).not.toContain(`testuser${index}`)
    expect(serialized).not.toContain(`testuser${index}@test.uzh.ch`)
  }
  expect(serialized).not.toMatch(
    /participant(?:Id|Key)|username|email|activityId/i
  )
}

function expectNoV1DisclosureOperations(recorder: GraphQLRecorder) {
  expect(
    recorder.operations
      .map(({ operationName }) => operationName)
      .filter((operationName) => V1_DISCLOSURE_OPERATIONS.has(operationName))
  ).toEqual([])
}

async function expectV2DashboardNavigation(page: Page) {
  const navigation = page.getByTestId('analytics-dashboard-navigation')
  await expect(navigation).toBeVisible()
  await expect(navigation.locator('a[href*="/quizzes"]')).toHaveCount(0)
}

function analyticsUrl(
  locale: 'de' | 'en',
  route: 'activity' | 'performance' | 'quizzes' | `quizzes/${string}`
) {
  const manageUrl = (process.env.URL_MANAGE ?? URL_MANAGE).replace(/\/$/, '')
  const localePrefix = locale === 'de' ? '/de' : ''
  return `${manageUrl}${localePrefix}/analytics/${COURSE_ID_TEST}/${route}`
}

test('CLEANUP', cleanupTest)

test.describe('Tests the availability of standard activity creation formats', () => {
  test.beforeAll(async () => {
    await seedActivities()
    await prepareSeededAnalyticsActivities()
  })

  test.afterAll(async () => {
    // Restore the lecturer flag and shared activity fixtures for later specs.
    await cleanupTest()
    await updateLecturerPrivatePreview(true)
  })

  test('Test login for catalyst users and non-catalyst users', async ({
    page,
    loginLecturer,
    loginFreeUser,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginIndividualCatalyst()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('homepage')).toBeVisible()
  })

  test('Test that all standard creation buttons open for free users', async ({
    page,
    loginFreeUser,
  }) => {
    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    for (const [button, firstStep] of [
      ['create-live-quiz', 'insert-live-quiz-name'],
      ['create-practice-quiz', 'insert-practice-quiz-name'],
      ['create-microlearning', 'insert-microlearning-name'],
      ['create-group-activity', 'insert-groupactivity-name'],
    ]) {
      await expect(page.getByTestId(button)).not.toBeDisabled()
      await page.getByTestId(button).click()
      await expect(page.getByTestId(firstStep)).toBeVisible()
      await page.getByTestId('cancel-activity-creation').click()
      await expect(page.getByTestId(button)).toBeVisible()
    }
  })

  test('Test that all standard creation buttons are enabled for catalyst users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await expect(page.getByTestId('create-live-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-practice-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-microlearning')).not.toBeDisabled()
    await expect(page.getByTestId('create-group-activity')).not.toBeDisabled()
  })

  test('Verify that learning analytics and private preview features are available for lecturer', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPrivatePreview(true)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: true,
      privatePreview: true,
    })
  })

  test('Verify that only learning analytics is available if private preview is disabled', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPrivatePreview(false)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: true,
      privatePreview: false,
    })
  })

  test('Verify that only private preview features are available if learning analytics is disabled', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await mockGrowthBookLearningAnalytics(page, false)
    await updateLecturerPrivatePreview(true)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: false,
      privatePreview: true,
    })
  })

  test('Verify that analytics controls remain visible but disabled without feature access', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await mockGrowthBookLearningAnalytics(page, false)
    await updateLecturerPrivatePreview(false)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: false,
      privatePreview: false,
    })
  })

  test('Keep learning analytics affordances disabled without Catalyst access', async ({
    page,
    loginFreeUser,
  }) => {
    await prepareSeededCourseLearningAnalytics()
    await prepareSeededCourseLearningAnalyticsOwnerAccess(USER_ID_TEST2)
    await loginFreeUser()

    const analyticsNavigation = page.getByTestId('analytics')
    await expect(analyticsNavigation).toBeDisabled()
    await analyticsNavigation.hover()
    await expect(page.getByRole('tooltip')).toContainText(
      'Learning analytics require Catalyst access.'
    )
    await page.keyboard.press('Escape')

    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()
    await openCourseActionMenu(page, 'course-learning-analytics-link')

    for (const testId of [
      'course-learning-analytics-link',
      'course-learning-analytics-settings',
    ]) {
      const affordance = page.getByTestId(testId)
      await expect(affordance).toBeDisabled()
      await affordance.locator('[data-slot="tooltip-trigger"]').hover()
      await expect(page.getByRole('tooltip')).toContainText(
        'Learning analytics require Catalyst access.'
      )
      await page.keyboard.press('Escape')
    }

    const recorder = recordGraphQLOperations(page)
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

    for (const path of [
      '/analytics',
      `/analytics/${COURSE_ID_TEST}/activity`,
      `/analytics/${COURSE_ID_TEST}/performance`,
    ]) {
      await page.goto(`${manageUrl}${path}`)
      await expect(
        page.getByText('Learning analytics require Catalyst access.', {
          exact: true,
        })
      ).toBeVisible()
    }

    const operationNames = recorder.operations.map(
      (operation) => operation.operationName
    )
    for (const protectedOperationName of [
      'GetLearningAnalyticsCourses',
      'GetCourseLearningAnalyticsControl',
      V2_ACTIVITY_OPERATION,
      V2_PERFORMANCE_OPERATION,
      V2_EXPORT_OPERATION,
    ]) {
      expect(operationNames).not.toContain(protectedOperationName)
    }
  })

  test('Show analytics to a non-manager without exposing course settings', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await prepareSeededCourseLearningAnalytics()
    await prepareSeededCourseLearningAnalyticsReadAccess()
    await loginIndividualCatalyst()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()

    await openCourseActionMenu(page, 'course-learning-analytics-link')
    await expect(
      page.getByTestId('course-learning-analytics-link')
    ).toBeEnabled()
    await expect(
      page.getByTestId('course-learning-analytics-settings')
    ).not.toBeAttached()
  })

  test('Show the pending state while analytics recomputation is incomplete', async ({
    page,
    loginLecturer,
  }) => {
    await prepareSeededCourseLearningAnalytics({ valid: false })
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)

    await expect(
      page.getByText(
        'Learning analytics is being prepared for this course. Dashboards become available after the next successful recomputation.'
      )
    ).toBeVisible()
  })

  test('Release deidentified V2 analytics at N=5 in EN desktop and DE mobile', async ({
    page,
    loginLecturer,
  }) => {
    await prepareSeededLearningAnalyticsV2({ eligibleParticipants: 5 })
    const recorder = recordGraphQLOperations(page)
    await loginLecturer()

    await page.setViewportSize(viewPorts.default)
    await page.goto(analyticsUrl('en', 'activity'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('analytics-activity-v2')).toBeVisible()
    await expect(page.getByTestId('analytics-effective-n')).toContainText('5')
    await expectV2DashboardNavigation(page)

    const activityRecord = await waitForGraphQLResponse(
      recorder,
      V2_ACTIVITY_OPERATION
    )
    const activityData = withoutTypenames(
      graphQLResponseField(activityRecord, 'getCourseActivityAnalyticsV2')
    )
    expect(activityData).toEqual({
      isSuppressed: false,
      effectiveN: 5,
      weeklyActivity: [{ periodIndex: 1, effectiveN: 5 }],
    })
    expectNoRawParticipantData(activityData)

    await page.setViewportSize(viewPorts.mobile)
    await page.goto(analyticsUrl('de', 'performance'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByTestId('analytics-performance-v2')).toBeVisible()
    await expect(page.getByTestId('analytics-effective-n')).toContainText('5')
    await expect(page.getByTestId('analytics-student-report-v2')).toBeVisible()
    await expectV2DashboardNavigation(page)

    const performanceRecord = await waitForGraphQLResponse(
      recorder,
      V2_PERFORMANCE_OPERATION
    )
    const performanceData = withoutTypenames(
      graphQLResponseField(performanceRecord, 'getCoursePerformanceAnalyticsV2')
    )
    expect(performanceData).toEqual({
      isSuppressed: false,
      effectiveN: 5,
      activitySummaries: [
        {
          activityIndex: 1,
          activityType: 'PRACTICE_QUIZ',
          effectiveN: 5,
          completionPercent: 100,
          correctPercent: null,
        },
      ],
      studentReport: {
        isSuppressed: false,
        effectiveN: 5,
        students: expectedStudents,
      },
    })
    expectNoRawParticipantData(performanceData)

    const jsonDownloadPromise = page.waitForEvent('download')
    await page.getByTestId('analytics-export-json').click()
    const jsonDownload = await jsonDownloadPromise
    expect(jsonDownload.suggestedFilename()).toBe(
      'learning-analytics-student-report.json'
    )
    expect(await jsonDownload.failure()).toBeNull()
    const jsonPath = await jsonDownload.path()
    expect(jsonPath).not.toBeNull()
    const jsonContent = await readFile(jsonPath!, 'utf8')
    expect(jsonContent).toBe(expectedJsonExport)
    const parsedJson: unknown = JSON.parse(jsonContent)
    expectNoRawParticipantData(parsedJson)

    const jsonExportRecord = await waitForGraphQLResponse(
      recorder,
      V2_EXPORT_OPERATION,
      { format: 'JSON' }
    )
    const jsonExportData = withoutTypenames(
      graphQLResponseField(
        jsonExportRecord,
        'getCourseLearningAnalyticsExportV2'
      )
    )
    expect(jsonExportData).toEqual({
      format: 'JSON',
      filename: 'learning-analytics-student-report.json',
      mimeType: 'application/json',
      effectiveN: 5,
      content: expectedJsonExport,
    })
    expectNoRawParticipantData(jsonExportData)

    const csvDownloadPromise = page.waitForEvent('download')
    await page.getByTestId('analytics-export-csv').click()
    const csvDownload = await csvDownloadPromise
    expect(csvDownload.suggestedFilename()).toBe(
      'learning-analytics-student-report.csv'
    )
    expect(await csvDownload.failure()).toBeNull()
    const csvPath = await csvDownload.path()
    expect(csvPath).not.toBeNull()
    const csvContent = await readFile(csvPath!, 'utf8')
    expect(csvContent).toBe(expectedCsvExport)
    expectNoRawParticipantData(csvContent)

    const csvExportRecord = await waitForGraphQLResponse(
      recorder,
      V2_EXPORT_OPERATION,
      { format: 'CSV' }
    )
    const csvExportData = withoutTypenames(
      graphQLResponseField(
        csvExportRecord,
        'getCourseLearningAnalyticsExportV2'
      )
    )
    expect(csvExportData).toEqual({
      format: 'CSV',
      filename: 'learning-analytics-student-report.csv',
      mimeType: 'text/csv',
      effectiveN: 5,
      content: expectedCsvExport,
    })
    expectNoRawParticipantData(csvExportData)

    expectNoV1DisclosureOperations(recorder)
  })

  test('Suppress V2 analytics at N=4 and retire quiz routes in DE desktop and EN mobile', async ({
    page,
    loginLecturer,
  }) => {
    const { practiceQuizId } = await prepareSeededLearningAnalyticsV2({
      eligibleParticipants: 4,
    })
    const recorder = recordGraphQLOperations(page)
    await loginLecturer()

    await page.setViewportSize(viewPorts.default)
    await page.goto(analyticsUrl('de', 'activity'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByTestId('analytics-activity-v2')).toBeVisible()
    const activitySuppressed = page.getByTestId('analytics-suppressed')
    await expect(activitySuppressed).toBeVisible()
    await expect(activitySuppressed).not.toContainText(/\b[1-4]\b/)
    await expect(page.getByTestId('analytics-effective-n')).not.toBeAttached()
    await expectV2DashboardNavigation(page)

    const activityRecord = await waitForGraphQLResponse(
      recorder,
      V2_ACTIVITY_OPERATION
    )
    const activityData = withoutTypenames(
      graphQLResponseField(activityRecord, 'getCourseActivityAnalyticsV2')
    )
    expect(activityData).toEqual({
      isSuppressed: true,
      effectiveN: null,
      weeklyActivity: [],
    })
    expectNoRawParticipantData(activityData)

    await page.setViewportSize(viewPorts.mobile)
    await page.goto(analyticsUrl('en', 'performance'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('analytics-performance-v2')).toBeVisible()
    const performanceSuppressed = page.getByTestId('analytics-suppressed')
    await expect(performanceSuppressed).toBeVisible()
    await expect(performanceSuppressed).not.toContainText(/\b[1-4]\b/)
    await expect(page.getByTestId('analytics-effective-n')).not.toBeAttached()
    await expect(
      page.getByTestId('analytics-student-report-v2')
    ).not.toBeAttached()
    await expect(page.getByTestId('analytics-export-json')).not.toBeAttached()
    await expect(page.getByTestId('analytics-export-csv')).not.toBeAttached()
    await expectV2DashboardNavigation(page)

    const performanceRecord = await waitForGraphQLResponse(
      recorder,
      V2_PERFORMANCE_OPERATION
    )
    const performanceData = withoutTypenames(
      graphQLResponseField(performanceRecord, 'getCoursePerformanceAnalyticsV2')
    )
    expect(performanceData).toEqual({
      isSuppressed: true,
      effectiveN: null,
      activitySummaries: [],
      studentReport: {
        isSuppressed: true,
        effectiveN: null,
        students: [],
      },
    })
    expectNoRawParticipantData(performanceData)

    await page.goto(analyticsUrl('de', 'quizzes'))
    await expect(page).toHaveURL(analyticsUrl('de', 'activity'))
    await expect(page.getByTestId('analytics-activity-v2')).toBeVisible()

    await page.goto(analyticsUrl('en', `quizzes/${practiceQuizId}`))
    await expect(page).toHaveURL(analyticsUrl('en', 'activity'))
    await expect(page.getByTestId('analytics-activity-v2')).toBeVisible()

    expect(
      recorder.operations.some(
        ({ operationName }) => operationName === V2_EXPORT_OPERATION
      )
    ).toBe(false)
    expectNoV1DisclosureOperations(recorder)
  })

  test('Fail closed in an open analytics tab after an out-of-band disable', async ({
    page,
    context,
    loginLecturer,
  }) => {
    await prepareSeededLearningAnalyticsV2({ eligibleParticipants: 5 })
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)
    await expect(page.getByTestId('analytics-activity-v2')).toBeVisible()

    const secondTab = await context.newPage()
    try {
      await secondTab.goto('about:blank')
      await secondTab.bringToFront()

      const prisma = await getPrisma()
      await prisma.course.update({
        where: { id: COURSE_ID_TEST },
        data: {
          isLearningAnalyticsEnabled: false,
          areAnalyticsValid: false,
          analyticsFinalizedAt: null,
          chatAnalyticsValidAt: null,
        },
      })

      await page.bringToFront()
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('focus'))
      })
      await expect(
        page.getByText('Learning analytics is disabled for this course.')
      ).toBeVisible()
    } finally {
      await secondTab.close()
    }
  })

  test('Disable course learning analytics and hide dashboards immediately', async ({
    page,
    loginLecturer,
  }) => {
    await prepareSeededCourseLearningAnalytics()
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()

    await openCourseActionMenu(page, 'course-learning-analytics-settings')
    await page.getByTestId('course-learning-analytics-settings').click()
    await expect(
      page.getByRole('heading', { name: 'Learning analytics settings' })
    ).toBeVisible()
    await page.getByTestId('course-learning-analytics-switch').click()
    await expect(
      page.getByText('Dashboards become unavailable immediately.')
    ).toBeVisible()
    await page.getByTestId('course-learning-analytics-save').click()
    await expect(
      page.getByRole('heading', { name: 'Learning analytics settings' })
    ).not.toBeVisible()

    await openCourseActionMenu(page, 'course-learning-analytics-link')
    const analyticsLink = page.getByTestId('course-learning-analytics-link')
    await expect(analyticsLink).toBeDisabled()
    await analyticsLink.hover()
    await expect(page.getByRole('tooltip')).toContainText(
      'Learning analytics is disabled for this course.'
    )

    const prisma = await getPrisma()
    await expect(
      prisma.course.findUniqueOrThrow({
        where: { id: COURSE_ID_TEST },
        select: {
          isLearningAnalyticsEnabled: true,
          areAnalyticsValid: true,
          analyticsFinalizedAt: true,
          chatAnalyticsValidAt: true,
        },
      })
    ).resolves.toEqual({
      isLearningAnalyticsEnabled: false,
      areAnalyticsValid: false,
      analyticsFinalizedAt: null,
      chatAnalyticsValidAt: null,
    })

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)
    await expect(
      page.getByText('Learning analytics is disabled for this course.')
    ).toBeVisible()
  })
})
