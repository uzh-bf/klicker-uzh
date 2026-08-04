import type { Page } from '@playwright/test'
import { promises as fs } from 'node:fs'
import { cleanupTest } from '../util/cleanup.js'
import {
  ASSESSMENT_REPORT_COURSE_NAME,
  ASSESSMENT_REPORT_COURSE_REFERENCE,
  ASSESSMENT_REPORT_PARTICIPANT_IDS,
  ASSESSMENT_REPORT_SUBJECT_EMAIL,
  COURSE_ID_ASSESSMENT_REPORT,
  URL_MANAGE,
  URL_STUDENT,
} from '../util/constants.js'
import {
  changeAssessmentReportCourseDisplayName,
  changeAssessmentReportSubjectScore,
  expectOneActiveAssessmentReport,
  getAssessmentReportRecords,
  resetAssessmentReportFixture,
  seedAssessmentReportFixture,
} from '../util/credentialVerification.js'
import { expect, test } from '../util/fixtures.js'
import type { TokenData } from '../util/types.js'

type LoginFactory = (
  tokenData: TokenData,
  cookieName?: string,
  redirectUrl?: string
) => Promise<void>

const assessmentManageUrl = process.env.URL_MANAGE ?? URL_MANAGE
const assessmentStudentUrl = process.env.URL_STUDENT ?? URL_STUDENT

async function loginAssessmentStudent(loginFactory: LoginFactory) {
  await loginFactory(
    {
      email: ASSESSMENT_REPORT_SUBJECT_EMAIL,
      sub: ASSESSMENT_REPORT_PARTICIPANT_IDS[0]!,
      role: 'PARTICIPANT',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    'participant_token',
    assessmentStudentUrl
  )
}

async function exportAssessmentReport(page: Page) {
  await page.goto(
    `${assessmentStudentUrl}/course/${COURSE_ID_ASSESSMENT_REPORT}`
  )
  const exportButton = page.getByTestId('export-report-button')
  await expect(exportButton).toBeVisible()
  await exportButton.click()

  const viewButton = page.getByTestId('view-assessment-report')
  const downloadButton = page.getByTestId('download-assessment-report')
  const refreshButton = page.getByTestId('refresh-assessment-report')
  await expect(viewButton).toBeVisible()
  await expect(downloadButton).toBeVisible()
  await expect(refreshButton).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadButton.click(),
  ])
  const path = await download.path()
  if (!path) throw new Error('ASSESSMENT_REPORT_DOWNLOAD_PATH_MISSING')
  const pdf = await fs.readFile(path)
  const reportWindowPromise = page.waitForEvent('popup')
  await viewButton.click()
  const reportPage = await reportWindowPromise
  await reportPage.waitForLoadState('load')
  const content = await reportPage.content()
  const qrCodeSize = await reportPage
    .getByRole('img', { name: 'QR code for the KlickerUZH verification page' })
    .evaluate((image: HTMLImageElement) => ({
      height: image.naturalHeight,
      width: image.naturalWidth,
    }))
  await reportPage.close()
  const match = content.match(/\/verify#([a-f0-9]{64})/)
  if (!match?.[1]) throw new Error('ASSESSMENT_REPORT_TOKEN_MISSING')
  return {
    content,
    filename: download.suggestedFilename(),
    pdf,
    qrCodeSize,
    token: match[1],
  }
}

async function revokeThroughLecturerUi({
  page,
  loginLecturer,
  subjectEmail,
}: {
  page: Page
  loginLecturer: () => Promise<void>
  subjectEmail: string
}) {
  await loginLecturer()
  await page.goto(
    `${assessmentManageUrl}/courses/${COURSE_ID_ASSESSMENT_REPORT}/assessment/results`
  )
  await page.getByTestId('assessment-quiz-credentials').click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('Issued assessment reports')
  const row = dialog.getByRole('row').filter({ hasText: subjectEmail })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Revoke' }).click()

  const confirmation = page.getByRole('dialog').last()
  await expect(confirmation).toContainText(
    'The same unchanged assessment snapshot cannot be issued again'
  )
  await confirmation.getByRole('button', { name: 'Revoke report' }).click()
  await expect(row).toContainText('Revoked')
}

test('CLEANUP', async () => {
  await cleanupTest()
  await seedAssessmentReportFixture()
})

test.describe('Assessment report credential lifecycle', () => {
  test.beforeEach(async () => {
    await resetAssessmentReportFixture()
  })

  test('student downloads a self-contained report from the server snapshot', async ({
    page,
    loginFactory,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const { content, filename, pdf, qrCodeSize, token } =
      await exportAssessmentReport(page)

    expect(filename).toMatch(/\.pdf$/)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString().match(/\/Type\s*\/Page\b/g)).toHaveLength(1)
    expect(qrCodeSize).toEqual({ height: 336, width: 336 })
    expect(content).toContain('Universität Zürich')
    expect(content).toContain(ASSESSMENT_REPORT_COURSE_NAME)
    expect(content).toContain(ASSESSMENT_REPORT_COURSE_REFERENCE)
    expect(content).toContain(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    expect(content).toContain('Accepted assessment-course invitation email')
    expect(content).toContain('Peer comparison')
    expect(content).toContain('Europe/Zurich')
    expect(content).toContain('Your score range:')
    expect(content).toContain('(You)')
    expect(content).toContain(`/verify#${token}`)
    expect(content).not.toContain(`/verify/${token}`)
    expect(content).not.toContain('digitally signed')
    expect(content).toContain(
      `Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`
    )

    const reportPagePromise = page.waitForEvent('popup')
    await page.getByTestId('view-assessment-report').click()
    const reportPage = await reportPagePromise
    await expect(reportPage).toHaveTitle(
      `Assessment performance report - ${ASSESSMENT_REPORT_COURSE_NAME}`
    )
    await expect(
      reportPage.getByRole('heading', {
        name: 'Assessment performance report',
      })
    ).toBeVisible()
    await reportPage.close()

    const histogramBarWidths = Array.from(
      content.matchAll(/<rect x="[^"]+" y="[^"]+" width="([^"]+)"/g),
      (match) => Number(match[1])
    )
    expect(histogramBarWidths).toHaveLength(3)
    expect(histogramBarWidths[0]).toBeGreaterThan(histogramBarWidths[1]!)

    const record = await expectOneActiveAssessmentReport()
    expect(record.token).toBe(token)
    expect(record.subjectEmail).toBe(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    expect(record.snapshotVersion).toBe(1)
  })

  test('standalone report escapes course-controlled HTML', async ({
    page,
    loginFactory,
  }) => {
    const maliciousName = '</title><script>window.reportInjected=true</script>'
    await changeAssessmentReportCourseDisplayName(maliciousName)
    await loginAssessmentStudent(loginFactory)
    const { content } = await exportAssessmentReport(page)

    expect(content).toContain(
      '&lt;/title&gt;&lt;script&gt;window.reportInjected=true&lt;/script&gt;'
    )
    expect(content).not.toContain('<script')
  })

  test('public verification shows active claims without leaking the token', async ({
    page,
    loginFactory,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const { token } = await exportAssessmentReport(page)
    const requestUrls: string[] = []
    const requestBodies: string[] = []
    page.on('request', (request) => {
      requestUrls.push(request.url())
      if (request.postData()) requestBodies.push(request.postData()!)
    })

    await page.goto(`${assessmentStudentUrl}/verify#${token}`)
    await expect(
      page.getByRole('heading', { name: 'Active assessment record' })
    ).toBeVisible()
    await expect(page.getByText(ASSESSMENT_REPORT_COURSE_NAME)).toBeVisible()
    await expect(
      page.getByText(ASSESSMENT_REPORT_COURSE_REFERENCE)
    ).toBeVisible()
    await expect(page.getByText(ASSESSMENT_REPORT_SUBJECT_EMAIL)).toBeVisible()
    await expect(
      page.getByText('Accepted assessment-course invitation email')
    ).toBeVisible()
    await expect(
      page.getByText('Comparison cohort: 10 active participants')
    ).toBeVisible()
    await expect(page.getByText(/Europe\/Zurich/)).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Your score range:/ })
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: '(You)' })
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText(token)
    expect(requestUrls.some((url) => url.includes(token))).toBe(false)
    expect(requestBodies.some((body) => body.includes(token))).toBe(true)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow,noarchive'
    )
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
      'content',
      'no-referrer'
    )
    const logo = page.getByRole('img', { name: 'Universität Zürich' })
    await expect(logo).toBeVisible()
    expect(
      await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)
    ).toBeGreaterThan(0)
  })

  test('lecturer can search, copy, and revoke without displaying the full token', async ({
    context,
    page,
    loginFactory,
    loginLecturer,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const { token } = await exportAssessmentReport(page)
    await expectOneActiveAssessmentReport()

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: assessmentManageUrl,
    })
    await loginLecturer()
    await page.goto(
      `${assessmentManageUrl}/courses/${COURSE_ID_ASSESSMENT_REPORT}/assessment/results`
    )
    await expect(page.getByTestId('assessment-quiz-credentials')).toContainText(
      '(1)'
    )
    await page.getByTestId('assessment-quiz-credentials').click()
    const dialog = page.getByRole('dialog').first()
    const recipientSearch = dialog.getByRole('textbox', {
      name: 'Search recipient email',
    })
    await expect(recipientSearch).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Status' })).toBeVisible()
    await recipientSearch.fill(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    const row = dialog
      .getByRole('row')
      .filter({ hasText: ASSESSMENT_REPORT_SUBJECT_EMAIL })
    await expect(row).toContainText(`${token.slice(0, 8)}...${token.slice(-4)}`)
    await expect(row).not.toContainText(token)
    await expect(row).toContainText('Europe/Zurich')

    let failRecordsRefresh = false
    await page.route('**/*', async (route) => {
      const request = route.request()
      if (
        failRecordsRefresh &&
        request.method() === 'POST' &&
        request.postData()?.includes('QGetCourseVerificationRecords')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'ASSESSMENT_REPORT_TEST_REFRESH_FAILED' }],
          }),
        })
        return
      }
      await route.continue()
    })

    await row.getByRole('button', { name: 'Copy verification link' }).click()
    const copiedLink = await page.evaluate(() => navigator.clipboard.readText())
    expect(copiedLink).toContain(`/verify#${token}`)

    await row.getByRole('button', { name: 'Revoke' }).click()
    const confirmation = page.getByRole('dialog').last()
    await expect(confirmation).toContainText(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    failRecordsRefresh = true
    await confirmation.getByRole('button', { name: 'Revoke report' }).click()
    await expect(
      page.getByTestId('confirm-assessment-report-revocation')
    ).not.toBeVisible()
    await expect(
      page.getByText('The assessment report was revoked.')
    ).toBeVisible()
    await expect(page.getByText(/list could not be refreshed/)).toBeVisible()
    await expect(row).toContainText('Revoked')
  })

  test('revoked claims stay redacted while changed authoritative data can reissue', async ({
    page,
    loginFactory,
    loginLecturer,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const first = await exportAssessmentReport(page)
    await revokeThroughLecturerUi({
      page,
      loginLecturer,
      subjectEmail: ASSESSMENT_REPORT_SUBJECT_EMAIL,
    })

    await page.goto(`${assessmentStudentUrl}/verify#${first.token}`)
    await expect(
      page.getByRole('heading', { name: 'Revoked assessment record' })
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText(
      ASSESSMENT_REPORT_SUBJECT_EMAIL
    )
    await expect(page.locator('body')).not.toContainText(
      ASSESSMENT_REPORT_COURSE_NAME
    )

    await loginAssessmentStudent(loginFactory)
    await page.goto(
      `${assessmentStudentUrl}/course/${COURSE_ID_ASSESSMENT_REPORT}`
    )
    await page.getByTestId('export-report-button').click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'was revoked and cannot be issued again' })
    ).toBeVisible()

    await changeAssessmentReportSubjectScore()
    await loginAssessmentStudent(loginFactory)
    const replacement = await exportAssessmentReport(page)
    expect(replacement.token).not.toBe(first.token)
    expect(replacement.content).toContain('>3<')

    const records = await getAssessmentReportRecords()
    expect(records.map((record) => record.status).sort()).toEqual([
      'ACTIVE',
      'REVOKED',
    ])
    await page.goto(`${assessmentStudentUrl}/verify#${replacement.token}`)
    await expect(
      page.getByRole('heading', { name: 'Active assessment record' })
    ).toBeVisible()
  })

  test('public route handles missing and malformed fragments locally', async ({
    page,
  }) => {
    await page.goto(`${assessmentStudentUrl}/verify`)
    await expect(
      page.getByRole('heading', { name: 'Invalid verification link' })
    ).toBeVisible()
    await expect(
      page.getByText('does not contain a verification token')
    ).toBeVisible()

    await page.goto(`${assessmentStudentUrl}/verify#not-a-token`)
    await expect(page.getByText('has an invalid format')).toBeVisible()
  })
})
